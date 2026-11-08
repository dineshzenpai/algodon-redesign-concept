import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('Razorpay Standard Checkout backend endpoints', () => {
  let server;
  let baseUrl;
  const keySecret = '16pvnW9QuHHkv0mr0vg1tqFW';

  before(async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_TxoPNM2XG7QyHf';
    process.env.RAZORPAY_KEY_SECRET = keySecret;

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
  });

  it('POST /api/create-order rejects amounts under 100 paise', async () => {
    const res = await fetch(`${baseUrl}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, currency: 'INR' })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /at least 100 paise/i);
  });

  it('POST /api/create-order rejects missing amount', async () => {
    const res = await fetch(`${baseUrl}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'INR' })
    });

    assert.equal(res.status, 400);
  });

  it('POST /api/create-order creates order with valid amount and returns order_id', async () => {
    const res = await fetch(`${baseUrl}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 25000, // 250 INR
        currency: 'INR',
        receipt: `test_${Date.now()}`
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.order_id);
    assert.ok(data.order_id.startsWith('order_'));
    assert.equal(data.amount, 25000);
    assert.equal(data.currency, 'INR');
  });

  it('POST /api/verify-payment returns 400 for missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order_123' })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /missing/i);
  });

  it('POST /api/verify-payment rejects signature mismatch with 400', async () => {
    const res = await fetch(`${baseUrl}/api/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_mock_123',
        razorpay_payment_id: 'pay_mock_456',
        razorpay_signature: 'invalid_hex_signature_deadbeef1234'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /signature mismatch/i);
  });

  it('POST /api/verify-payment successfully verifies valid HMAC-SHA256 signature', async () => {
    const orderId = 'order_valid_12345';
    const paymentId = 'pay_valid_67890';
    const validSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const res = await fetch(`${baseUrl}/api/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.order_id, orderId);
    assert.equal(data.payment_id, paymentId);
  });

  it('POST /api/config returns razorpay key ID and paymentsEnabled true', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.checkout?.paymentsEnabled, true);
    assert.equal(data.checkout?.razorpayKeyId, 'rzp_test_TxoPNM2XG7QyHf');
  });

  it('POST /api/checkout/notify-bill sends tax invoice bill to customer email and SMS', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/notify-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: {
          id: 'a1000000-0000-4000-8000-000000000001',
          subtotal: 1900,
          discount: 0,
          items: [{ name: 'Golden-Brown Swirl', size: 'M', qty: 1, price: 1900 }]
        },
        customer: {
          name: 'Aditya Verma',
          email: 'aditya.verma@example.com',
          phone: '9876543210',
          address1: '402 Palm Grove Heights',
          city: 'Mumbai',
          state: 'Maharashtra',
          pin: '400050'
        },
        payment: {
          razorpay_payment_id: 'pay_test_notify_123'
        }
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.emailSent, true);
    assert.equal(data.smsSent, true);
    assert.ok(data.invoiceNo.startsWith('ALG-INV-'));
  });

  it('POST /api/refund executes automated refund for order', async () => {
    const res = await fetch(`${baseUrl}/api/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: 'pay_test_order_123',
        order_id: 'a1000000-0000-4000-8000-000000000001',
        amount: 1900,
        reason: 'Customer 7-Day Return / Size Exchange',
        customer: {
          email: 'aditya.verma@example.com',
          phone: '9876543210'
        }
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.automated, true);
    assert.ok(data.refund_id);
  });
});

