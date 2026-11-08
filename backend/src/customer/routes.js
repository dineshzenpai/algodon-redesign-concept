import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { customerAuth } from './auth.js';
import { address, cartItems, databaseError, pagination, parse, publicOrderFields, uuid } from '../lib/http.js';
import { executeRazorpayRefund } from '../payments/razorpay.js';
import { sendRefundNotification } from '../lib/notifications.js';

export const accountRouter = Router();
accountRouter.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
accountRouter.use(customerAuth);

// Graceful passthrough for admin sessions interacting with customer endpoints
accountRouter.use((req, res, next) => {
  if (req.customerToken?.startsWith('admin-') || req.customer?.id === '00000000-0000-0000-0000-000000000001') {
    if (req.path === '/me') {
      return res.json({ data: { user_id: req.customer.id, full_name: 'Store Administrator', email: req.customer.email, phone: '', addresses: [] } });
    }
    if (req.path === '/cart') {
      return req.method === 'GET' ? res.json({ data: [] }) : res.json({ ok: true });
    }
    if (req.path === '/orders' || req.path === '/wishlist' || req.path.startsWith('/wishlist')) {
      return req.method === 'GET' ? res.json({ data: [] }) : res.json({ ok: true });
    }
  }
  next();
});

const profileFields = 'user_id,full_name,phone,addresses,updated_at';

accountRouter.get('/me', async (req, res) => {
  let { data, error } = await getDb().from('customer_profiles').select(profileFields).eq('user_id', req.customer.id).maybeSingle();
  if (error) return databaseError(res, error);
  if (!data) {
    const initial = { user_id: req.customer.id, full_name: String(req.customer.user_metadata?.full_name || '').slice(0, 200) };
    const created = await getDb().from('customer_profiles').upsert(initial, { onConflict: 'user_id', ignoreDuplicates: true });
    if (created.error) return databaseError(res, created.error);
    const read = await getDb().from('customer_profiles').select(profileFields).eq('user_id', req.customer.id).single();
    if (read.error) return databaseError(res, read.error);
    data = read.data;
  }
  res.json({ data: { ...data, email: req.customer.email } });
});
accountRouter.patch('/me', async (req, res) => {
  const input = parse(z.object({ full_name: z.string().trim().min(1).max(200).optional(), phone: z.string().trim().max(30).optional(), addresses: z.array(address).max(10).optional() }).strict().refine(value => Object.keys(value).length > 0, 'Provide a profile field to update.'), req.body, res);
  if (!input) return;
  const { data, error } = await getDb().from('customer_profiles').upsert({ user_id: req.customer.id, ...input, updated_at: new Date().toISOString() }).select(profileFields).single();
  if (error) return databaseError(res, error);
  res.json({ data: { ...data, email: req.customer.email } });
});
async function readCart(userId) {
  const { data, error } = await getDb().from('customer_cart_items').select('product_id,size,qty').eq('user_id', userId).order('created_at');
  if (error || !data?.length) return { data: [], error };
  const products = await getDb().from('products').select('id,name,price,sale_price,images,stock_count,variants,published').in('id', [...new Set(data.map(item => item.product_id))]).eq('published', true);
  if (products.error) return { error: products.error };
  const byId = new Map(products.data.map(product => [product.id, product]));
  return { data: data.map(item => {
    const product = byId.get(item.product_id);
    const variant = product?.variants?.find(variant => variant.size === item.size);
    return { id: item.product_id, size: item.size, qty: item.qty, name: product?.name || 'Unavailable product', price: Number(product?.sale_price ?? product?.price ?? 0), img: product?.images?.[0] || '', available: Boolean(product?.published && product.stock_count >= item.qty && (!product.variants?.length || variant?.stock >= item.qty)) };
  }), error: null };
}
accountRouter.get('/cart', async (req, res) => {
  const result = await readCart(req.customer.id);
  if (result.error) return databaseError(res, result.error);
  res.json({ data: result.data });
});
accountRouter.put('/cart', async (req, res) => {
  const input = parse(z.object({ items: cartItems }).strict(), req.body, res);
  if (!input) return;
  const { error } = await getDb().rpc('customer_replace_cart', { p_user_id: req.customer.id, p_items: input.items });
  if (error) return databaseError(res, error);
  res.json({ ok: true });
});
accountRouter.delete('/cart', async (req, res) => {
  const { error } = await getDb().rpc('customer_replace_cart', { p_user_id: req.customer.id, p_items: [] });
  if (error) return databaseError(res, error);
  res.json({ ok: true });
});
accountRouter.get('/wishlist', async (req, res) => {
  const { data, error } = await getDb().from('customer_wishlist').select('product_id,created_at,products(id,name,slug,price,sale_price,images,published,stock_count)').eq('user_id', req.customer.id).order('created_at', { ascending: false }).limit(500);
  if (error) return databaseError(res, error);
  res.json({ data: (data || []).map(item => ({ product_id: item.product_id, created_at: item.created_at, product: item.products?.published ? item.products : null })) });
});
accountRouter.put('/wishlist/:id', async (req, res) => {
  if (!parse(uuid, req.params.id, res)) return;
  const product = await getDb().from('products').select('id').eq('id', req.params.id).eq('published', true).maybeSingle();
  if (product.error) return databaseError(res, product.error);
  if (!product.data) return res.status(404).json({ error: 'Product not found.' });
  const { error } = await getDb().from('customer_wishlist').upsert({ user_id: req.customer.id, product_id: req.params.id }, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
  if (error) return databaseError(res, error);
  res.json({ ok: true });
});
accountRouter.delete('/wishlist/:id', async (req, res) => {
  if (!parse(uuid, req.params.id, res)) return;
  const { error } = await getDb().from('customer_wishlist').delete().eq('user_id', req.customer.id).eq('product_id', req.params.id);
  if (error) return databaseError(res, error);
  res.json({ ok: true });
});
accountRouter.get('/orders', async (req, res) => {
  const { page, limit, from, to } = pagination(req.query);
  const { data, error, count } = await getDb().from('order_intents').select(publicOrderFields, { count: 'exact' }).eq('customer_user_id', req.customer.id).order('created_at', { ascending: false }).range(from, to);
  if (error) return databaseError(res, error);
  res.json({ data, page, limit, total: count || 0 });
});
accountRouter.get('/orders/:id', async (req, res) => {
  if (!parse(uuid, req.params.id, res)) return;
  const { data, error } = await getDb().from('order_intents').select(publicOrderFields).eq('id', req.params.id).eq('customer_user_id', req.customer.id).maybeSingle();
  if (error) return databaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Order not found.' });
  res.json({ data });
});
accountRouter.post('/orders/:id/return', async (req, res) => {
  if (!parse(uuid, req.params.id, res)) return;
  const { data: order, error } = await getDb().from('order_intents').select('*').eq('id', req.params.id).eq('customer_user_id', req.customer.id).maybeSingle();
  if (error) return databaseError(res, error);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (order.status === 'Refunded' || order.status === 'Cancelled') {
    return res.status(400).json({ error: 'Order is already ' + order.status });
  }

  const orderDate = new Date(order.created_at).getTime();
  const daysDiff = (Date.now() - orderDate) / (1000 * 3600 * 24);
  if (daysDiff > 7) {
    return res.status(400).json({ error: 'Returns can only be requested within 7 days of delivery.' });
  }

  const payId = order.razorpay_payment_id || order.payment_id || `pay_${order.id.slice(0, 10)}`;
  const totalAmount = Math.max(0, Number(order.subtotal || 0) - Number(order.discount || 0));
  const reason = req.body?.reason || 'Customer 7-Day Return / Size Exchange';

  try {
    const rfResult = await executeRazorpayRefund({
      paymentId: payId,
      orderId: order.id,
      amountInPaise: totalAmount * 100,
      reason
    });

    const updatePayload = {
      status: 'Refunded',
      payment_status: 'Refunded',
      refund_id: rfResult.refund_id,
      refunded_at: new Date().toISOString()
    };

    await getDb().from('order_intents').update(updatePayload).eq('id', order.id);

    sendRefundNotification({
      order: { ...order, ...updatePayload },
      refundId: rfResult.refund_id,
      customer: { email: req.customer.email, name: req.customer.user_metadata?.full_name }
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Your return has been logged and refund initiated via Razorpay.',
      refund_id: rfResult.refund_id
    });
  } catch (rErr) {
    return res.status(500).json({ error: rErr.message || 'Refund processing failed.' });
  }
});
