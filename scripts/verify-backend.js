// Uses the configured Supabase project. Creates only uniquely named test records
// and removes them in finally; never use an existing customer or product as a fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../backend/src/app.js';
import { connectDB, getDb } from '../backend/src/config/db.js';
import { runSql, sqlLiteral } from './lib/postgres.js';
await connectDB();
const db = getDb();
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const suffix = randomUUID().replaceAll('-', '');
const testEmail = `backend-${suffix}@example.invalid`;
const password = `Test!${randomUUID()}`;
const users = [];
let productId, categoryId, couponId, orderId, adminCookie;
async function request(path, { method = 'GET', body, token, admin = false, key, expected = 200 } = {}) {
  const response = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(admin ? { Cookie: adminCookie, 'X-Admin-Request': '1' } : {}), ...(key ? { 'Idempotency-Key': key } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
async function checked(promise) { const result = await promise; if (result.error) throw new Error(result.error.message); return result.data; }
try {
  const login = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  assert.equal(login.status, 200, await login.text());
  adminCookie = login.headers.get('set-cookie').split(';')[0];
  for (let index = 0; index < 2; index++) {
    const data = await checked(db.auth.admin.createUser({ email: index ? `other-${suffix}@example.invalid` : testEmail, password, email_confirm: true }));
    users.push(data.user);
  }
  const session = await request('/api/auth/login', { method: 'POST', body: { email: testEmail, password } });
  const token = session.session.access_token;
  const other = await request('/api/auth/login', { method: 'POST', body: { email: users[1].email, password } });
  await request('/api/account/me', { token });
  const profile = await request('/api/account/me', { method: 'PATCH', token, body: { full_name: 'Backend test', phone: '0000000000' } });
  assert.equal(profile.data.full_name, 'Backend test');
  categoryId = (await request('/api/admin/categories', { method: 'POST', admin: true, expected: 201, body: { name: 'Backend test', slug: `backend-${suffix}` } })).data.id;
  productId = (await request('/api/admin/products', { method: 'POST', admin: true, expected: 201, body: { name: 'Backend test shirt', slug: `backend-${suffix}`, price: 100, sale_price: 80, published: true, stock_count: 5, variants: [{ size: 'M', stock: 5 }], category_id: categoryId } })).data.id;
  const edited = await request('/api/admin/products/' + productId, { method: 'PATCH', admin: true, body: { seo_title: 'Verified backend' } });
  assert.equal(edited.data.stock_count, 5); assert.equal(Number(edited.data.price), 100);
  assert.equal(edited.data.published, true); assert.equal(edited.data.variants.length, 1);
  await request('/api/admin/products/' + productId, { method: 'PATCH', admin: true, expected: 400, body: { stock_count: 99 } });
  await request('/api/admin/products/bulk-stock', { method: 'PATCH', admin: true, body: { items: [{ id: productId, stock_count: 8 }] } });
  await request('/api/admin/categories/reorder', { method: 'PATCH', admin: true, body: { items: [{ id: categoryId, sort_order: 2 }] } });
  const code = 'TEST' + suffix;
  couponId = (await request('/api/admin/coupons', { method: 'POST', admin: true, expected: 201, body: { code, type: 'percentage', value: 10, product_ids: [productId] } })).data.id;
  const coupon = await request('/api/admin/coupons/' + couponId, { method: 'PATCH', admin: true, body: { max_discount: 50 } });
  assert.equal(coupon.data.code, code.toUpperCase()); assert.equal(Number(coupon.data.value), 10);
  await request('/api/products/backend-' + suffix);
  await request('/api/account/cart', { method: 'PUT', token, body: { items: [{ id: productId, size: 'M', qty: 2 }] } });
  const cart = await request('/api/account/cart', { token });
  assert.equal(cart.data[0].price, 80); assert.equal(cart.data[0].available, true);
  await request('/api/account/wishlist/' + productId, { method: 'PUT', token });
  assert.equal((await request('/api/account/wishlist', { token })).data[0].product.id, productId);
  const input = { items: [{ id: productId, size: 'M', qty: 2 }], coupon_code: code, customer: { name: 'Backend test', email: 'forged@example.invalid', phone: '0000000000', address1: 'Test street', city: 'Test', state: 'Test', pin: '000000' } };
  const order = await request('/api/checkout/orders', { method: 'POST', token, key: suffix, expected: 201, body: input });
  orderId = order.data.id;
  assert.equal(Number(order.data.subtotal), 160); assert.equal(Number(order.data.discount), 16);
  assert.equal(order.data.customer.email, testEmail);
  const replay = await request('/api/checkout/orders', { method: 'POST', token, key: suffix, expected: 201, body: input });
  assert.equal(replay.data.id, orderId);
  const mine = await request('/api/account/orders/' + orderId, { token });
  assert.equal(mine.data.payment_status, 'Pending'); assert.ok(!('internal_notes' in mine.data));
  await request('/api/account/orders/' + orderId, { token: other.session.access_token, expected: 404 });
  const status = await request('/api/admin/orders/' + orderId, { method: 'PATCH', admin: true, body: { status: 'Confirmed' } });
  assert.equal(status.data.status, 'Confirmed'); assert.equal(status.notificationSent, false);
  assert.equal((await request('/api/account/orders/' + orderId, { token })).data.status, 'Confirmed');
  await request('/api/admin/dashboard', { admin: true });
  await request('/api/newsletter', { method: 'POST', expected: 202, body: { email: testEmail } });
  await request('/api/newsletter', { method: 'POST', expected: 202, body: { email: testEmail } });
  await request('/api/admin/newsletter', { admin: true });
  await request('/api/account/cart', { method: 'DELETE', token });
  await request('/api/account/wishlist/' + productId, { method: 'DELETE', token });
  const refreshed = await request('/api/auth/refresh', { method: 'POST', body: { refresh_token: session.session.refresh_token } });
  await request('/api/auth/logout', { method: 'POST', token: refreshed.session.access_token });
  await request('/api/account/me', { token: refreshed.session.access_token, expected: 401 });
  console.log('Live backend checks passed: auth, profile, catalog, atomic stock edits, categories, coupons, cart, wishlist, checkout, retry protection, order privacy, status updates, dashboard, newsletter, refresh and logout.');
} finally {
  try {
    await checked(db.from('newsletter_signups').delete().eq('email', testEmail));
    if (orderId) {
      runSql(`delete from public.checkout_idempotency where result->>'id'=${sqlLiteral(orderId)};`);
      await checked(db.from('coupon_redemptions').delete().eq('order_ref', orderId));
      await checked(db.from('order_intents').delete().eq('id', orderId));
    }
    if (couponId) await checked(db.from('coupons').delete().eq('id', couponId));
    if (productId) await checked(db.from('products').delete().eq('id', productId));
    if (categoryId) await checked(db.from('categories').delete().eq('id', categoryId));
    for (const user of users) await checked(db.auth.admin.deleteUser(user.id));
    if (adminCookie) await request('/api/admin/auth/logout', { method: 'POST', admin: true });
    console.log('Temporary verification records removed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
