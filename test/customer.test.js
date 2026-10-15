import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../backend/src/app.js';
import { setDb } from '../backend/src/config/db.js';

test('customer API verifies ownership and validates mutation inputs', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const userId = 'a0000000-0000-4000-8000-000000000010';
  const productId = 'a0000000-0000-4000-8000-000000000011';
  const orderId = 'a0000000-0000-4000-8000-000000000012';
  const queries = [];
  let lastRpc;
  const db = {
    auth: { getUser: async token => token === 'valid' ? { data: { user: { id: userId, email: 'verified@example.com', email_confirmed_at: '2026-01-01' } }, error: null } : { data: { user: null }, error: { message: 'Invalid' } } },
    from(table) {
      const calls = []; queries.push({ table, calls });
      const builder = new Proxy({}, { get(_, key) {
        if (key === 'then') return resolve => resolve({ data: [], error: null, count: 0 });
        return (...args) => { calls.push([key, ...args]); if (key === 'maybeSingle') return Promise.resolve({ data: null, error: null }); return builder; };
      } });
      return builder;
    },
    rpc: async (name, args) => { lastRpc = { name, args }; return { data: name === 'customer_create_order' ? { id: orderId } : null, error: null }; }
  };
  const request = (path, method = 'GET', body, token = 'valid') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  try {
    setDb(db);
    assert.equal((await request('/api/account/orders', 'GET', undefined, '')).status, 401);
    assert.equal((await request('/api/account/orders', 'GET', undefined, 'invalid')).status, 401);
    const orders = await request('/api/account/orders');
    assert.equal(orders.status, 200);
    const orderQuery = queries.find(q => q.table === 'order_intents');
    assert.ok(orderQuery.calls.some(call => call[0] === 'eq' && call[1] === 'customer_user_id' && call[2] === userId));
    assert.ok(!orderQuery.calls.find(call => call[0] === 'select')[1].includes('internal_notes'));
    assert.equal((await request('/api/account/orders/' + orderId)).status, 404);
    assert.equal((await request('/api/account/me', 'PATCH', { user_id: productId, role: 'super_admin' })).status, 400);
    assert.equal((await request('/api/account/cart', 'PUT', { items: [{ id: productId, size: 'M', qty: 1, price: 1 }] })).status, 400);
    assert.equal((await request('/api/account/cart', 'PUT', { items: [{ id: productId, size: 'M', qty: 1 }] })).status, 200);
    assert.equal(lastRpc.name, 'customer_replace_cart');
    assert.equal(lastRpc.args.p_user_id, userId);
    assert.equal((await request('/api/account/wishlist/not-a-uuid', 'PUT', {})).status, 400);
    const checkout = await request('/api/checkout/orders', 'POST', {
      items: [{ id: productId, size: 'M', qty: 1 }],
      customer: { name: 'Buyer', email: 'forged@example.com', phone: '1234567890', address1: 'Street', city: 'City', state: 'State', pin: '123456' }
    });
    assert.equal(checkout.status, 201);
    assert.equal(lastRpc.name, 'customer_create_order');
    assert.equal(lastRpc.args.p_user_id, userId);
    assert.equal(lastRpc.args.p_customer.email, 'verified@example.com');
    assert.equal((await request('/api/newsletter', 'POST', { email: 'not-email' }, '')).status, 400);
    assert.equal((await request('/api/auth/signup', 'POST', { email: 'buyer@example.com', name: 'Buyer', password: 'short' }, '')).status, 400);
    assert.equal((await request('/api/not-a-route')).status, 404);
    const config = await (await request('/js/config.js')).text();
    assert.ok(config.includes('SUPABASE_PUBLISHABLE_KEY'));
    assert.ok(!config.includes('SUPABASE_SECRET_KEY') && !config.includes('sb_secret_'));
  } finally { setDb(null); await new Promise(resolve => server.close(resolve)); }
});
