import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

// Always creates its own cluster. Never consumes application env or a database URL.
const bin = process.env.TEST_PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin');
let dir, port, started = false;
function run(name, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, name), args, { windowsHide: true, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG'))), PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGDATABASE: 'postgres' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d); child.stderr.on('data', d => stderr += d);
    child.on('error', reject);
    child.on(name === 'pg_ctl' ? 'exit' : 'close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${name} exit ${code}: ${stderr}`)));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const sql = (text, database = 'postgres') => run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', database], text);
const id = 'a0000000-0000-0000-0000-000000000001';
const id2 = 'b0000000-0000-0000-0000-000000000002';
const customer = { name: 'Test Buyer', email: 'buyer@example.invalid', phone: '0000000000', address1: 'Test street', city: 'Test', state: 'Test', pin: '000000' };
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
function checkout(key, items = [{ id, size: 'M', qty: 1 }], coupon = null) {
  return `select public.storefront_create_order(${literal(items)}, ${literal(customer)}, ${coupon ? "'" + coupon + "'" : 'null'}${key ? ", '" + key + "'" : ''});`;
}
async function reset(stock = 5) {
  await sql(`truncate public.checkout_idempotency, public.coupon_redemptions, public.order_intents, public.products, public.coupons cascade;
    insert into public.products(id,name,slug,price,sale_price,published,stock_count,variants) values
    ('${id}','Test shirt','test',100,80,true,${stock},'[{"size":"M","stock":${stock}},{"size":"m","stock":${stock}}]'),
    ('${id2}','Other shirt','other',200,null,true,0,'[]');
    insert into public.coupons(code,type,value,usage_limit,per_customer_limit) values ('TEST10','percentage',10,1,1);`);
}
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'algodon-checkout-'));
  const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  port = socket.address().port; await new Promise(r => socket.close(r));
  await run('initdb', ['-D', path.join(dir, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  await run('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
  console.log(`Disposable PostgreSQL: 127.0.0.1:${port}; artifacts: ${dir}`);
  await sql(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await sql('begin;\n' + await readFile(path.join('supabase/migrations', file), 'utf8') + '\ncommit;');
    console.log(`Applied ${file}`);
  }
  // Hold the transaction open after stock updates to force concurrency overlap.
  await sql(`create function public.test_checkout_delay() returns trigger language plpgsql as $$ begin perform pg_sleep(0.2); return new; end $$;
    create trigger test_checkout_delay before insert on public.order_intents for each row execute function public.test_checkout_delay();`);
});
after(async () => {
  if (started) await run('pg_ctl', ['-D', path.join(dir, 'data'), '-m', 'immediate', '-w', 'stop']);
});
test('all migrations applied and security settings retained', async () => {
  assert.equal(await sql("select count(*) from pg_class where oid in ('public.products'::regclass,'public.order_intents'::regclass,'public.coupons'::regclass,'public.coupon_redemptions'::regclass,'public.checkout_idempotency'::regclass) and relrowsecurity"), '5');
});

test('partial product edits and bulk stock are validated atomically', async () => {
  await reset();
  await sql(`update public.products set variants='[{"size":"M","stock":5}]' where id='${id}';`);
  const edited = JSON.parse(await sql(`select public.admin_update_product('${id}','{"published":false}');`));
  assert.equal(edited.price, 100); assert.equal(edited.stock_count, 5); assert.equal(edited.variants[0].stock, 5);
  await assert.rejects(sql(`select public.admin_update_product('${id}','{"stock_count":99}');`), /sum of variant stock/);
  await assert.rejects(sql(`select public.admin_update_product('${id}','{"sale_price":101}');`), /exceed regular price/);
  await assert.rejects(sql(`select public.admin_bulk_stock('[{"id":"${id}","stock_count":12},{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","stock_count":1}]');`), /not found/);
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '5');
  assert.equal(await sql(`select public.admin_bulk_stock('[{"id":"${id}","stock_count":12}]');`), '1');
  assert.equal(await sql(`select variants->0->>'stock' from public.products where id='${id}'`), '12');
});

test('customer carts roll back failed replacements and authenticated checkout binds ownership', async () => {
  await reset();
  const user = 'c0000000-0000-4000-8000-000000000001';
  await sql(`insert into auth.users(id) values('${user}') on conflict do nothing;`);
  await sql(`select public.customer_replace_cart('${user}','[{"id":"${id}","size":"M","qty":1}]');`);
  await assert.rejects(sql(`select public.customer_replace_cart('${user}','[{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","size":"M","qty":1}]');`), /foreign key/);
  assert.equal(await sql(`select count(*) from public.customer_cart_items where user_id='${user}'`), '1');
  const query = `select public.customer_create_order('${user}',${literal([{ id, size: 'M', qty: 1 }])},${literal(customer)},null,'account-retry-0001');`;
  const first = JSON.parse(await sql(query));
  const replay = JSON.parse(await sql(query));
  assert.equal(first.id, replay.id);
  assert.equal(await sql(`select customer_user_id from public.order_intents where id='${first.id}'`), user);
  for (const role of ['anon','authenticated']) {
    await assert.rejects(sql(`set role ${role}; select * from public.customer_profiles;`), /permission denied/);
    await assert.rejects(sql(`set role ${role}; select public.customer_replace_cart('${user}','[]');`), /permission denied/);
  }
});
test('persists trusted prices and duplicate lines; exact size case remains distinct', async () => {
  await reset();
  const order = JSON.parse(await sql(checkout('success-key-00001', [{ id, size: 'M', qty: 1, price: 1 }, { id: id.toUpperCase(), size: 'M', qty: 1 }, { id, size: 'm', qty: 1 }])));
  assert.equal(order.subtotal, 240); assert.equal(order.items.length, 2);
  assert.equal(await sql('select count(*) from public.order_intents'), '1');
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '2');
});
test('insufficient stock rolls back idempotency record and inventory', async () => {
  await reset(1);
  await assert.rejects(sql(checkout('insufficient-0001', [{ id, size: 'M', qty: 2 }])), /out of stock/);
  assert.equal(await sql('select count(*) from public.checkout_idempotency'), '0');
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '1');
});
test('shared product stock caps multiple variants and non-variant inventory is protected', async () => {
  await reset(1);
  await assert.rejects(sql(checkout('variant-total-001', [{ id, size: 'M', qty: 1 }, { id, size: 'm', qty: 1 }])), /out of stock/);
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '1');
  await sql(`update public.products set stock_count=1 where id='${id2}'`);
  const outcomes = await Promise.allSettled(['plain-stock-0001','plain-stock-0002'].map(key => sql(checkout(key, [{ id: id2, size: 'One', qty: 1 }]))));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await sql(`select stock_count from public.products where id='${id2}'`), '0');
});
test('concurrent distinct keys compete for final unit', async () => {
  await reset(1);
  const results = await Promise.allSettled([sql(checkout('competition-0001')), sql(checkout('competition-0002'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '0');
  assert.equal(await sql('select count(*) from public.order_intents'), '1');
});
test('simultaneous same-key requests replay original result and redeem once', async () => {
  await reset();
  const query = checkout('same-request-0001', undefined, 'TEST10');
  const [a,b] = await Promise.all([sql(query),sql(query)]); assert.deepEqual(JSON.parse(a), JSON.parse(b));
  assert.equal(await sql(query), a);
  assert.equal(await sql('select count(*) from public.order_intents'), '1');
  assert.equal(await sql('select count(*) from public.coupon_redemptions'), '1');
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '4');
  await assert.rejects(sql(checkout('same-request-0001', [{ id, size: 'M', qty: 2 }], 'TEST10')), /different checkout request/);
});
test('equivalent reordered duplicate lines replay the original snapshot after catalog changes', async () => {
  await reset();
  const original = await sql(checkout('canonical-key-001', [{ id, size: 'M', qty: 2 }, { id, size: 'm', qty: 1 }], 'TEST10'));
  await sql(`update public.products set price=120,sale_price=100 where id='${id}'; update public.order_intents set status='Confirmed'; update public.coupons set active=false;`);
  const replay = await sql(checkout('canonical-key-001', [{ id, size: 'm', qty: 1 }, { id: id.toUpperCase(), size: 'M', qty: 1 }, { id, size: 'M', qty: 1 }], ' test10 '));
  assert.equal(replay, original);
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '2');
  assert.equal(await sql('select count(*) from public.coupon_redemptions'), '1');
});
test('failure after inventory and order insert fully rolls back; same key can retry', async () => {
  await reset();
  await sql(`create function public.test_fail_redemption() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
    create trigger test_fail before insert on public.coupon_redemptions for each row execute function public.test_fail_redemption();`);
  try {
    await assert.rejects(sql(checkout('rollback-key-0001', undefined, 'TEST10')), /injected failure/);
    assert.equal(await sql('select count(*) from public.order_intents'), '0');
    assert.equal(await sql('select count(*) from public.checkout_idempotency'), '0');
    assert.equal(await sql('select count(*) from public.coupon_redemptions'), '0');
    assert.equal(await sql(`select stock_count || ':' || (variants->0->>'stock') from public.products where id='${id}'`), '5:5');
  } finally { await sql('drop trigger test_fail on public.coupon_redemptions; drop function public.test_fail_redemption();'); }
  await sql(checkout('rollback-key-0001', undefined, 'TEST10'));
});
test('coupon limit checked atomically across concurrent orders', async () => {
  await reset();
  const results = await Promise.allSettled([sql(checkout('coupon-race-0001', undefined, 'TEST10')), sql(checkout('coupon-race-0002', undefined, 'TEST10'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await sql('select count(*) from public.coupon_redemptions'), '1');
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '4');
});
test('coupon product AND category restrictions match validation', async () => {
  await reset();
  await sql(`update public.coupons set product_ids=array['${id}'::uuid],category_ids=array['cccccccc-0000-0000-0000-000000000001'::uuid]`);
  await assert.rejects(sql(checkout('coupon-scope-0001', undefined, 'TEST10')), /does not apply/);
  assert.equal(await sql('select count(*) from public.order_intents'), '0');
});
test('untrusted roles cannot execute either overload or access idempotency data; service role can execute', async () => {
  await reset();
  for (const role of ['anon', 'authenticated']) {
    for (const key of [null, 'unauthorized-001']) await assert.rejects(sql(`set role ${role}; ${checkout(key)}`), /permission denied for function/);
    for (const table of ['checkout_idempotency','order_intents']) await assert.rejects(sql(`set role ${role}; select * from public.${table};`), /permission denied/);
  }
  assert.ok(JSON.parse(await sql(`set role service_role; ${checkout('authorized-00001')}`)).id);
});
test('null or fractional quantities are rejected without orders', async () => {
  await reset();
  for (const qty of [null, 1.5]) await assert.rejects(sql(checkout('invalid-qty-0001', [{ id, size: 'M', qty }])), /Invalid product quantity/);
  assert.equal(await sql('select count(*) from public.order_intents'), '0');
});


test('split duplicate quantities above the per-line limit aggregate and replay consistently', async () => {
  await reset(200);
  const items = [{ id, size: 'M', qty: 60 }, { id, size: 'M', qty: 60 }];
  const result = JSON.parse(await sql(checkout('large-duplicates-001', items)));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 120);
  assert.equal(result.subtotal, 9600);
  assert.deepEqual(JSON.parse(await sql(checkout('large-duplicates-001', items))), result);
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), '80');
});

test('simultaneous different payloads with one key create exactly one order', async () => {
  await reset();
  const outcomes = await Promise.allSettled([
    sql(checkout('conflicting-race-001')),
    sql(checkout('conflicting-race-001', [{ id, size: 'M', qty: 2 }]))
  ]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  const failure = outcomes.find(r => r.status === 'rejected');
  assert.match(failure.reason.message, /different checkout request/);
  const winner = JSON.parse(outcomes.find(r => r.status === 'fulfilled').value);
  assert.equal(await sql('select count(*) from public.order_intents'), '1');
  assert.equal(await sql('select count(*) from public.checkout_idempotency'), '1');
  assert.equal(await sql(`select stock_count from public.products where id='${id}'`), String(5 - winner.items[0].qty));
});

// Characterization tests: these expose incompatible contracts, not a claim that
// both inventory models can safely sell the same physical units.
for (const setupFirst of [true, false]) {
  test(`legacy/setup coexistence (${setupFirst ? 'setup first' : 'migrations first'}) preserves functions but has independent inventory`, async () => {
    const database = setupFirst ? 'setup_first' : 'migrations_first';
    await sql(`create database ${database};`);
    const query = text => sql(text, database);
    await query(`create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key, bucket_id text);
      alter table storage.objects enable row level security;`);
    const apply = async directory => {
      for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql') && !f.startsWith('05_')).sort()) {
        await query('begin;\n' + await readFile(path.join(directory, file), 'utf8') + '\ncommit;');
      }
    };
    const coreDefinition = () => query("select pg_get_functiondef('public.storefront_create_order(jsonb,jsonb,text)'::regprocedure)");
    if (setupFirst) {
      await apply('supabase/setup');
      await apply('supabase/migrations');
    } else {
      await apply('supabase/migrations');
      const original = await coreDefinition();
      await apply('supabase/setup');
      assert.equal(await coreDefinition(), original, 'setup must not replace protected core');
    }
    // Re-running setup 04 must not replace either protected overload.
    const original = await coreDefinition();
    const keyed = await query("select pg_get_functiondef('public.storefront_create_order(jsonb,jsonb,text,text)'::regprocedure)");
    await query('begin;\n' + await readFile('supabase/setup/04_storage_business_logic.sql', 'utf8') + '\ncommit;');
    assert.equal(await coreDefinition(), original);
    assert.equal(await query("select pg_get_functiondef('public.storefront_create_order(jsonb,jsonb,text,text)'::regprocedure)"), keyed);

    const user = 'c0000000-0000-0000-0000-000000000001';
    const address = 'd0000000-0000-0000-0000-000000000001';
    const variant = 'e0000000-0000-0000-0000-000000000001';
    await query(`insert into auth.users(id,email) values ('${user}','legacy@example.invalid');
      insert into public.addresses(id,user_id,recipient_name,phone,address_line1,city,state_region,postal_code)
        values ('${address}','${user}','Test Buyer','0000000000','Test street','Test','Test','000000');
      insert into public.products(id,name,slug,price,sale_price,published,is_active,stock_count,variants)
        values ('${id}','Shared ID','shared',100,80,true,true,1,'[{"size":"M","stock":1}]');
      insert into public.product_variants(id,product_id,size,color,sku,stock,price_override)
        values ('${variant}','${id}','M','Navy','TEST-NAVY',3,90);
      insert into public.carts(user_id) values ('${user}');
      insert into public.cart_items(cart_id,variant_id,quantity) select id,'${variant}',1 from public.carts;`);
    const legacy = `select public.place_order('${address}',null);`;
    await assert.rejects(query(`set role anon; ${legacy}`), /permission denied for function/);
    await assert.rejects(query(`set role authenticated; ${legacy}`), /Sign in/);
    await assert.rejects(query(`set role authenticated; set request.jwt.claim.sub = '${user}'; select public.place_order('${variant}',null);`), /saved addresses/);
    assert.equal(await query('select count(*) from public.orders'), '0');
    const legacyOrder = await query(`set role authenticated; set request.jwt.claim.sub = '${user}'; ${legacy}`);
    assert.match(legacyOrder, /^[0-9a-f-]{36}$/);
    assert.equal(await query('select subtotal from public.orders'), '90.00');
    assert.equal(await query(`select stock_count from public.products where id='${id}'`), '1');
    assert.equal(await query(`select stock from public.product_variants where id='${variant}'`), '2');
    const managed = JSON.parse(await query(checkout('coexistence-key-001')));
    assert.equal(managed.subtotal, 80);
    assert.equal(await query(`select stock_count from public.products where id='${id}'`), '0');
    assert.equal(await query(`select stock from public.product_variants where id='${variant}'`), '2');
    assert.equal(await query('select count(*) from public.order_intents'), '1');
    for (const role of ['anon', 'authenticated']) {
      for (const key of [null, 'bypass-attempt-001']) {
        await assert.rejects(query(`set role ${role}; ${checkout(key)}`), /permission denied for function/);
      }
      await assert.rejects(query(`set role ${role}; insert into public.order_intents default values;`), /permission denied/);
      await assert.rejects(query(`set role ${role}; insert into public.orders(user_id,address_snapshot,subtotal,total) values ('${user}','{}',0,0);`), /row-level security|permission denied/);
    }
    // Demonstrate why historical migrations must never be manually replayed.
    const historical = await readFile('supabase/migrations/202610020001_admin_panel.sql', 'utf8');
    const overwritten = await query('begin;\n' + historical + "\nselect pg_get_functiondef('public.storefront_create_order(jsonb,jsonb,text)'::regprocedure);\nrollback;");
    assert.notEqual(overwritten, original);
    assert.equal(await coreDefinition(), original, 'diagnostic replay must roll back');
  });
}
