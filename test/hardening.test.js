import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import app from '../backend/src/app.js';
import { setDb } from '../backend/src/config/db.js';
import { env } from '../backend/src/config/env.js';
import { escapeHtml, normalizeCart, safeImageUrl } from '../frontend/src/shared/safety.js';

test('cart data cannot introduce HTML attributes or markup', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(safeImageUrl('javascript:alert(1)'), '');
  assert.equal(safeImageUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeImageUrl('/img/shirt.jpg'), '/img/shirt.jpg');
  assert.deepEqual(normalizeCart({}), []);
  assert.deepEqual(normalizeCart([{ id: 'shirt', name: 'Shirt', size: 'M', qty: '<script>', price: 10 }]), []);
  const [item] = normalizeCart([{ id: 'shirt', name: 'Shirt', size: 'M', qty: 1, price: 10, img: 'javascript:alert(1)' }]);
  assert.equal(item.img, '');
});

test('HTTP security boundaries, coupons, and session revocation', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, headers = {}) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  try {
    const page = await fetch(base + '/');
    const csp = page.headers.get('content-security-policy');
    assert.match(csp, /script-src-attr 'none'/);
    assert.match(csp, /object-src 'none'/);
    const html = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<script type="importmap">/);
    assert.ok(!csp.split(';').find(directive => directive.trim().startsWith('script-src ')).includes("'unsafe-inline'"));
    assert.equal((await post('/api/invoice', { email: 'victim@example.com' })).status, 410);
    assert.equal((await post('/api/admin/invoice', {}, { 'X-Admin-Request': '1' })).status, 401);
    assert.equal((await post('/api/admin/auth/login', { email: 'test@example.com', password: 'test' })).status, 403);
    assert.equal((await post('/api/admin/auth/login', {}, { 'X-Admin-Request': '1', Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/api/admin/auth/login', {}, { Origin: new URL(env.clientUrl).origin })).status, 403);

    const coupon = { code: 'ALGODON10', email: 'buyer@example.com', items: [{ id: 'shirt', qty: 1 }] };
    setDb({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) });
    assert.equal((await post('/api/coupons/validate', coupon)).status, 400);
    setDb({ from() { throw new Error('private database error'); } });
    const unavailable = await post('/api/coupons/validate', coupon);
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(await unavailable.text(), /private database error/);

    let active = true;
    setDb({
      rpc: async () => ({ data: active, error: null }),
      auth: { getUser: async () => ({ data: { user: { id: 'admin-id', email: 'admin@example.com' } }, error: null }) },
      from: table => {
        if (table === 'admin_sessions') return { delete: () => ({ eq: async () => { active = false; return { error: null }; } }) };
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'super_admin' }, error: null }) }) }) };
      }
    });
    const headers = { Cookie: 'algodon_admin_session=valid-token' };
    const me = await fetch(base + '/api/admin/me', { headers });
    assert.equal(me.status, 200);
    assert.equal(me.headers.get('cache-control'), 'no-store');
    assert.equal((await post('/api/admin/auth/logout', {}, { ...headers, 'X-Admin-Request': '1' })).status, 200);
    assert.equal((await fetch(base + '/api/admin/me', { headers })).status, 401);
    setDb({ rpc: async () => ({ error: new Error('private session error') }) });
    const failedSession = await fetch(base + '/api/admin/me', { headers });
    assert.equal(failedSession.status, 503);
    assert.doesNotMatch(await failedSession.text(), /private session error/);
  } finally {
    setDb(null);
    await new Promise(resolve => server.close(resolve));
  }
});
