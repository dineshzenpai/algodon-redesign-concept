import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('Auth OTP and Storefront Coupons Verification', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'AdminPassword123!';
    const appModule = await import('../backend/src/app.js');
    const app = appModule.default;

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  it('POST /api/auth/otp/send rejects empty identifier', async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '' })
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/otp/send generates 6-digit OTP for customer phone or email', async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '9876543210' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.match(data.otp, /^\d{6}$/);
  });

  it('POST /api/auth/otp/verify verifies code and establishes customer session', async () => {
    const phone = '9876543210';
    const sendRes = await fetch(`${baseUrl}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer1@algodonfashion.com' })
    });
    const { otp } = await sendRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer1@algodonfashion.com', otp })
    });

    assert.equal(verifyRes.status, 200);
    const data = await verifyRes.json();
    assert.equal(data.ok, true);
    assert.equal(data.isAdmin, false);
    assert.equal(data.role, 'customer');
    assert.ok(data.user);
  });

  it('POST /api/auth/otp/verify for admin returns admin role and sets admin session cookie', async () => {
    const adminEmail = 'admin@example.com';
    const sendRes = await fetch(`${baseUrl}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail })
    });
    const { otp } = await sendRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail, otp })
    });

    assert.equal(verifyRes.status, 200);
    const data = await verifyRes.json();
    assert.equal(data.ok, true);
    assert.equal(data.isAdmin, true);
    assert.equal(data.role, 'super_admin');
    const cookieHeader = verifyRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('algodon_admin_session'));
  });

  it('POST /api/coupons/validate verifies promotional discount coupon WELCOME10', async () => {
    const res = await fetch(`${baseUrl}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'WELCOME10',
        email: 'test@example.com',
        items: [{ id: 'golden-brown', qty: 2 }]
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.valid, true);
    assert.equal(data.code, 'WELCOME10');
    assert.equal(data.type, 'percentage');
    // 2 shirts at ₹1900 each = ₹3800. 10% = ₹380
    assert.equal(data.discount, 380);
  });

  it('POST /api/coupons/validate verifies promotional discount coupon FREESHIP', async () => {
    const res = await fetch(`${baseUrl}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'FREESHIP',
        email: 'test@example.com',
        items: [{ id: 'jali', qty: 1 }]
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.valid, true);
    assert.equal(data.freeShipping, true);
  });
});
