import { Router } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { env } from '../config/env.js';

export const razorpayRouter = Router();

function getCredentials() {
  const keyId = env.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = env.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
  return { keyId, keySecret };
}

let cachedClient = null;
let cachedKeyId = null;
let cachedKeySecret = null;

export function getRazorpayClient() {
  const { keyId, keySecret } = getCredentials();
  if (!keyId || !keySecret) {
    return null;
  }
  if (cachedClient && cachedKeyId === keyId && cachedKeySecret === keySecret) {
    return cachedClient;
  }
  cachedClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  cachedKeyId = keyId;
  cachedKeySecret = keySecret;
  return cachedClient;
}

const createOrderSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  currency: z.string().trim().min(3).max(5).optional().default('INR'),
  receipt: z.string().trim().max(40).optional(),
  notes: z.record(z.any()).optional().default({})
});

export async function handleCreateOrder(req, res) {
  const { keyId, keySecret } = getCredentials();
  if (!keyId || !keySecret) {
    return res.status(401).json({
      error: 'Razorpay credentials are not configured or invalid.'
    });
  }

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order parameters.' });
  }

  const { amount, currency, receipt, notes } = parsed.data;

  // Amount must be in paise and at least 100 paise (₹1.00)
  if (!Number.isFinite(amount) || amount < 100) {
    return res.status(400).json({
      error: 'Amount must be at least 100 paise (₹1.00).'
    });
  }

  try {
    const client = getRazorpayClient();
    if (!client) {
      return res.status(401).json({ error: 'Razorpay client authentication failed.' });
    }

    const orderOptions = {
      amount: Math.round(amount),
      currency: currency.toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notes
    };

    const order = await client.orders.create(orderOptions);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId
    });
  } catch (error) {
    console.error('[razorpay] Create order error:', error);
    if (error.statusCode === 401 || error.error?.code === 'BAD_REQUEST_ERROR' && /auth/i.test(error.message || '')) {
      return res.status(401).json({ error: 'Razorpay authentication failed.' });
    }
    return res.status(500).json({
      error: error.error?.description || error.message || 'Failed to create Razorpay order'
    });
  }
}

export async function handleVerifyPayment(req, res) {
  const body = req.body || {};
  const orderId = body.razorpay_order_id || body.order_id;
  const paymentId = body.razorpay_payment_id || body.payment_id;
  const signature = body.razorpay_signature || body.signature;

  // Missing fields: return 400
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing required payment verification fields (order_id, payment_id, signature).'
    });
  }

  const { keySecret } = getCredentials();
  if (!keySecret) {
    return res.status(401).json({
      success: false,
      error: 'Razorpay secret key is not configured.'
    });
  }

  try {
    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');

    const isMatch =
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!isMatch) {
      // Signature mismatch: return 400, do NOT mark as paid
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: signature mismatch.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order_id: orderId,
      payment_id: paymentId
    });
  } catch (err) {
    console.error('[razorpay] Signature verification exception:', err);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error verifying payment signature.'
    });
  }
}

razorpayRouter.post('/create-order', handleCreateOrder);
razorpayRouter.post('/checkout/razorpay/create-order', handleCreateOrder);

razorpayRouter.post('/verify-payment', handleVerifyPayment);
razorpayRouter.post('/checkout/razorpay/verify-payment', handleVerifyPayment);

