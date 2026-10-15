import test, { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

describe('Checkout HTTP unit tests (mocked database)', () => {
  let server;
  let baseUrl;
  let setDb;
  let mockRpcHandler;

  const validProductId = 'a0000000-0000-0000-0000-000000000001';
  const validProductId2 = 'b0000000-0000-0000-0000-000000000002';

  const validCustomer = {
    name: 'Aarav Patel',
    email: 'aarav@example.com',
    phone: '+91 98765 43210',
    address1: '42 Heritage Lane',
    city: 'Jaipur',
    state: 'Rajasthan',
    pin: '302001'
  };

  before(async () => {
    const dbModule = await import('../backend/src/config/db.js');
    setDb = dbModule.setDb;

    const appModule = await import('../backend/src/app.js');
    const app = appModule.default;

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    setDb(null);
  });

  beforeEach(() => {
    mockRpcHandler = null;
    setDb({
      rpc: async (funcName, params) => {
        if (mockRpcHandler) return mockRpcHandler(funcName, params);
        return { data: null, error: new Error('Unconfigured mock RPC') };
      }
    });
  });

  it('validates the idempotency header before calling the database', async () => {
    mockRpcHandler = () => { throw new Error('Must not call RPC'); };
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'short' },
      body: JSON.stringify({ items: [{ id: validProductId, size: 'M', qty: 1 }], customer: validCustomer })
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Idempotency-Key/);
  });

  it('passes the key to RPC, strips payment fields, and preserves size case', async () => {
    mockRpcHandler = async (name, params) => {
      assert.equal(name, 'storefront_create_order');
      assert.equal(params.p_idempotency_key, 'checkout-unit-key-001');
      assert.equal(params.p_items.length, 2);
      assert.equal(params.p_customer.card_number, undefined);
      return { data: { id: 'test-order' }, error: null };
    };
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'checkout-unit-key-001' },
      body: JSON.stringify({ items: [{ id: validProductId, size: 'M', qty: 1 }, { id: validProductId, size: 'm', qty: 1 }], customer: { ...validCustomer, card_number: 'synthetic-forbidden-field' } })
    });
    assert.equal(res.status, 201);
  });

  it('maps persistent idempotency conflicts to HTTP 409', async () => {
    mockRpcHandler = async () => ({ data: null, error: { code: 'P4090' } });
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'checkout-unit-key-001' },
      body: JSON.stringify({ items: [{ id: validProductId, size: 'M', qty: 1 }], customer: validCustomer })
    });
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /different checkout request/);
  });

  it('rejects invalid product ID format with 400 client error', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: 'not-a-valid-uuid', size: 'M', qty: 1 }],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Invalid product ID format/i);
  });

  it('rejects empty cart with 400 client error', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Cart is empty/i);
  });

  it('rejects invalid customer email with 400 client error', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: validProductId, size: 'M', qty: 1 }],
        customer: { ...validCustomer, email: 'not-an-email' }
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Enter a valid customer email/i);
  });

  it('never returns HTTP 201 or fake ALG- order on database failure', async () => {
    mockRpcHandler = async () => ({
      data: null,
      error: { code: '08006', message: 'connection failure to PostgreSQL' }
    });

    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: validProductId, size: 'M', qty: 1 }],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 500, 'Must return 500 on database failure');
    const json = await res.json();
    assert.strictEqual(json.error, 'Order could not be processed at this time. Please try again.');
    assert.strictEqual(json.data, undefined, 'Must not return order data on database failure');
    assert.ok(!JSON.stringify(json).includes('ALG-'), 'Must never return fake ALG- order ID');
    assert.ok(!JSON.stringify(json).includes('connection failure'), 'Must not leak database internals');
  });

  it('returns 400 with procedure message on business rule violation (e.g. out of stock)', async () => {
    mockRpcHandler = async () => ({
      data: null,
      error: { code: '22023', message: 'A selected size is out of stock.' }
    });

    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: validProductId, size: 'M', qty: 1 }],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error, 'A selected size is out of stock.');
  });

  it('returns 400 with message on blocked customer account', async () => {
    mockRpcHandler = async () => ({
      data: null,
      error: { code: '42501', message: 'This customer account cannot place orders.' }
    });

    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: validProductId, size: 'M', qty: 1 }],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error, 'This customer account cannot place orders.');
  });

  it('preserves valid duplicate lines for database aggregation, including totals above 100', async () => {
    let capturedParams = null;
    mockRpcHandler = async (funcName, params) => {
      capturedParams = params;
      return {
        data: {
          id: 'ord-uuid-9999',
          items: params.p_items,
          subtotal: 3780,
          discount: 0,
          customer: params.p_customer,
          status: 'Pending',
          coupon_code: ''
        },
        error: null
      };
    };

    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: validProductId, size: 'M', qty: 60 },
          { id: validProductId2, size: 'L', qty: 1 },
          { id: validProductId, size: 'M', qty: 60 } // duplicate product & size
        ],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.id, 'ord-uuid-9999');

    assert.ok(capturedParams, 'RPC must be invoked with parameters');
    assert.equal(capturedParams.p_items.length, 3);
    const duplicates = capturedParams.p_items.filter(item => item.id === validProductId);
    assert.deepEqual(duplicates.map(item => item.qty), [60, 60]);

  });

  it('returns the mocked persisted order response with 201', async () => {
    const realDbOrder = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ id: validProductId, name: 'Natural Khadi Shirt', size: 'M', qty: 1, price: 1890 }],
      subtotal: 1890,
      discount: 0,
      customer: validCustomer,
      status: 'Pending',
      coupon_code: ''
    };

    mockRpcHandler = async () => ({
      data: realDbOrder,
      error: null
    });

    const res = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: validProductId, size: 'M', qty: 1 }],
        customer: validCustomer
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.deepStrictEqual(json.data, realDbOrder);
  });
});

describe('Static SQL migration assertions (no database execution)', () => {
  const migrationPath = path.join(
    projectRoot,
    'supabase',
    'migrations',
    '202610150002_safe_checkout_inventory.sql'
  );

  it('migration file exists with proper timestamped naming', () => {
    assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  });

  it('migration locks products in deterministic order (id asc for update) to prevent deadlocks', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    // Checks that products are locked with deterministic ORDER BY id ASC FOR UPDATE
    assert.match(
      sql,
      /perform\s+1\s+from\s+public\.products[\s\S]+?order\s+by\s+id\s+asc\s+for\s+update;/i,
      'Must lock products in deterministic ascending UUID order'
    );
  });

  it('migration aggregates repeated cart lines in SQL', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(
      sql,
      /group\s+by\s+\(val->>'id'\)::uuid,\s*coalesce\(val->>'size',\s*''\)/i,
      'Must group line items by product UUID and size'
    );
    assert.match(
      sql,
      /sum\(\(val->>'qty'\)::integer\)::integer\s+as\s+total_qty/i,
      'Must sum quantity across matching lines'
    );
  });

  it('migration validates product UUID regex format before execution', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}/i, 'Must check UUID regex format');
  });

  it('migration checks against negative stock and overselling', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(
      sql,
      /curr_variant_stock\s*<\s*agg_record\.total_qty/i,
      'Must verify variant stock is sufficient'
    );
    assert.match(
      sql,
      /product_row\.stock_count\s*<\s*agg_record\.total_qty/i,
      'Must verify product stock_count is sufficient'
    );
  });

  it('migration keeps inventory, coupon, and order persistence in single atomic transaction', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /create\s+or\s+replace\s+function\s+public\.storefront_create_order/i);
    assert.match(sql, /update\s+public\.products/i);
    assert.match(sql, /insert\s+into\s+public\.order_intents/i);
    assert.match(sql, /insert\s+into\s+public\.coupon_redemptions/i);
  });

  it('migration restricts execution strictly to service_role', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(
      sql,
      /revoke\s+all\s+on\s+function\s+public\.storefront_create_order\(jsonb,jsonb,text\)\s+from\s+public,\s*anon,\s*authenticated;/i
    );
    assert.match(
      sql,
      /grant\s+execute\s+on\s+function\s+public\.storefront_create_order\(jsonb,jsonb,text\)\s+to\s+service_role;/i
    );
  });
});
