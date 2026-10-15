import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { customerAuth } from './auth.js';
import { address, cartItems, databaseError, pagination, parse, publicOrderFields, uuid } from '../lib/http.js';

export const accountRouter = Router();
accountRouter.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
accountRouter.use(customerAuth);
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
