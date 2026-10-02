import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../config/db.js';

export const publicRouter = Router();
const couponLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

publicRouter.get('/products', async (req, res) => {
  const { data, error } = await getDb().from('products').select('id,name,slug,description,price,sale_price,brand,tags,variants,category_id,stock_count,out_of_stock_hidden,images').eq('published', true).order('updated_at', { ascending: false }).limit(500);
  if (error) return res.status(503).json({ error: 'Product catalog is temporarily unavailable.' });
  return res.json({ data: (data || []).filter((p) => !p.out_of_stock_hidden || p.stock_count > 0) });
});
publicRouter.get('/categories', async (req, res) => {
  const { data, error } = await getDb().from('categories').select('id,name,slug,description,image_url,parent_id,sort_order').eq('active', true).order('sort_order').limit(500);
  if (error) return res.status(503).json({ error: 'Collections are temporarily unavailable.' });
  return res.json({ data });
});

publicRouter.post('/coupons/validate', couponLimiter, async (req, res) => {
  const parsed = z.object({ code: z.string().trim().min(1).max(40), email: z.string().email().max(320), items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().positive().max(100) })).min(1).max(50) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid coupon and cart.' });
  const input = parsed.data; const now = new Date().toISOString();
  const { data: coupon, error } = await getDb().from('coupons').select('*').eq('code', input.code.toUpperCase()).eq('active', true).maybeSingle();
  if (error) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
  if (!coupon || coupon.starts_at && coupon.starts_at > now || coupon.ends_at && coupon.ends_at < now) return res.status(400).json({ error: 'This coupon is not currently available.' });
  const productIds = [...new Set(input.items.map((item) => item.id))];
  const { data: products, error: productError } = await getDb().from('products').select('id,category_id,price,sale_price,published').in('id', productIds);
  if (productError) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
  const productMap = new Map((products || []).filter((p) => p.published).map((p) => [p.id, p]));
  if (productMap.size !== productIds.length) return res.status(400).json({ error: 'Refresh your cart before applying a coupon.' });
  const subtotal = input.items.reduce((sum, item) => { const p = productMap.get(item.id); return sum + Number(p.sale_price ?? p.price) * item.qty; }, 0);
  if (subtotal < Number(coupon.minimum_order)) return res.status(400).json({ error: `Your order must be at least ₹${Number(coupon.minimum_order).toLocaleString('en-IN')}.` });
  const { count: uses, error: usesError } = await getDb().from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id);
  if (usesError) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
  if (coupon.usage_limit != null && uses >= coupon.usage_limit) return res.status(400).json({ error: 'This coupon has reached its usage limit.' });
  const { count: customerUses, error: customerError } = await getDb().from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).ilike('customer_email', input.email);
  if (customerError) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
  if (coupon.per_customer_limit != null && customerUses >= coupon.per_customer_limit) return res.status(400).json({ error: 'You have reached this coupon’s usage limit.' });
  let applicableSubtotal = subtotal;
  if (coupon.product_ids.length || coupon.category_ids.length) {
    const eligible = new Set((products || []).filter((p) => (!coupon.product_ids.length || coupon.product_ids.includes(p.id)) && (!coupon.category_ids.length || coupon.category_ids.includes(p.category_id))).map((p) => p.id));
    applicableSubtotal = input.items.filter((i) => eligible.has(i.id)).reduce((sum, i) => { const p = productMap.get(i.id); return sum + Number(p.sale_price ?? p.price) * i.qty; }, 0);
    if (!applicableSubtotal) return res.status(400).json({ error: 'This coupon does not apply to items in your cart.' });
  }
  let discount = coupon.type === 'percentage' ? applicableSubtotal * Number(coupon.value) / 100 : coupon.type === 'flat' ? Number(coupon.value) : 0;
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = Math.min(discount, applicableSubtotal);
  return res.json({ valid: true, code: coupon.code, type: coupon.type, discount: Math.round(discount * 100) / 100, freeShipping: coupon.type === 'free_shipping' });
});

publicRouter.post('/checkout/orders', orderLimiter, async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({ id: z.string().uuid(), size: z.string().min(1).max(40), qty: z.number().int().positive().max(100) })).min(1).max(50),
    customer: z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(320), phone: z.string().trim().min(7).max(30), address1: z.string().trim().min(1).max(300), address2: z.string().trim().max(300).optional().default(''), city: z.string().trim().min(1).max(120), state: z.string().trim().min(1).max(120), pin: z.string().trim().min(4).max(20) }),
    coupon_code: z.string().trim().max(40).optional().default('')
  }).safeParse(req.body);
  if (!schema.success) return res.status(400).json({ error: schema.error.issues[0].message });
  const { data, error } = await getDb().rpc('storefront_create_order', {
    p_items: schema.data.items,
    p_customer: schema.data.customer,
    p_coupon_code: schema.data.coupon_code || null
  });
  if (error) {
    const clientErrors = ['22023', '42501'].includes(error.code);
    if (!clientErrors) console.error('[storefront] Order creation failed:', error.message);
    return res.status(clientErrors ? 400 : 503).json({ error: clientErrors ? error.message : 'We could not place this order right now. Please try again.' });
  }
  return res.status(201).json({ data });
});
