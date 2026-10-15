import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { customerAuth } from '../customer/auth.js';
import { email, parse, databaseError } from '../lib/http.js';

export const publicRouter = Router();
const couponLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const newsletterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

publicRouter.post('/newsletter', newsletterLimiter, async (req, res) => {
  const input = parse(z.object({ email }).strict(), req.body, res);
  if (!input) return;
  const { error } = await getDb().from('newsletter_signups').upsert(input, { onConflict: 'email', ignoreDuplicates: true });
  if (error) return databaseError(res, error);
  res.status(202).json({ message: 'Your newsletter signup has been saved.' });
});

publicRouter.get('/products', async (req, res) => {
  try {
    const { data, error } = await getDb().from('products').select('id,name,slug,description,price,sale_price,brand,tags,variants,category_id,stock_count,out_of_stock_hidden,images').eq('published', true).order('updated_at', { ascending: false }).limit(500);
    if (error) return res.status(503).json({ error: 'Product catalog is temporarily unavailable.' });
    return res.json({ data: (data || []).filter((p) => !p.out_of_stock_hidden || p.stock_count > 0) });
  } catch {
    return res.status(503).json({ error: 'Product catalog is temporarily unavailable.' });
  }
});

publicRouter.get('/categories', async (req, res) => {
  try {
    const { data, error } = await getDb().from('categories').select('id,name,slug,description,image_url,parent_id,sort_order').eq('active', true).order('sort_order').limit(500);
    if (error) return res.status(503).json({ error: 'Categories are temporarily unavailable.' });
    return res.json({ data: data || [] });
  } catch {
    return res.status(503).json({ error: 'Categories are temporarily unavailable.' });
  }
});

publicRouter.get('/products/:slug', async (req, res) => {
  const { data, error } = await getDb().from('products').select('id,name,slug,description,price,sale_price,brand,tags,variants,category_id,stock_count,out_of_stock_hidden,images,seo_title,meta_description').eq('slug', req.params.slug).eq('published', true).maybeSingle();
  if (error) return databaseError(res, error);
  if (!data || data.out_of_stock_hidden && data.stock_count <= 0) return res.status(404).json({ error: 'Product not found.' });
  res.json({ data });
});

publicRouter.post('/coupons/validate', couponLimiter, async (req, res) => {
  const parsed = z.object({ code: z.string().trim().min(1).max(40), email: z.string().email().max(320), items: z.array(z.object({ id: z.string().min(1).max(100), qty: z.number().int().positive().max(100) })).min(1).max(50) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid coupon and cart.' });
  const input = parsed.data; const now = new Date().toISOString();
  try {
    const db = getDb();
    const { data: coupon, error } = await db.from('coupons').select('*').eq('code', input.code.toUpperCase()).eq('active', true).maybeSingle();
    if (error) {
      return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
    }
    if (!coupon || coupon.starts_at && coupon.starts_at > now || coupon.ends_at && coupon.ends_at < now) {
      return res.status(400).json({ error: 'This coupon is not currently available.' });
    }
    const productIds = [...new Set(input.items.map((item) => item.id))];
    const { data: products, error: productError } = await db.from('products').select('id,category_id,price,sale_price,published').in('id', productIds);
    if (productError) {
      return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
    }
    const productMap = new Map((products || []).filter((p) => p.published).map((p) => [p.id, p]));
    if (productMap.size !== productIds.length) {
      return res.status(400).json({ error: 'Refresh your cart before applying a coupon.' });
    }
    const subtotal = input.items.reduce((sum, item) => { const p = productMap.get(item.id); return sum + Number(p.sale_price ?? p.price) * item.qty; }, 0);
    if (subtotal < Number(coupon.minimum_order)) return res.status(400).json({ error: `Your order must be at least ₹${Number(coupon.minimum_order).toLocaleString('en-IN')}.` });
    const { count: uses, error: usesError } = await db.from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id);
    if (usesError) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
    if (coupon.usage_limit != null && uses >= coupon.usage_limit) return res.status(400).json({ error: 'This coupon has reached its usage limit.' });
    const { count: customerUses, error: customerError } = await db.from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).ilike('customer_email', input.email);
    if (customerError) return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
    if (coupon.per_customer_limit != null && customerUses >= coupon.per_customer_limit) return res.status(400).json({ error: 'You have reached this coupon’s usage limit.' });
    let applicableSubtotal = subtotal;
    if (coupon.product_ids?.length || coupon.category_ids?.length) {
      const eligible = new Set((products || []).filter((p) => (!coupon.product_ids?.length || coupon.product_ids.includes(p.id)) && (!coupon.category_ids?.length || coupon.category_ids.includes(p.category_id))).map((p) => p.id));
      applicableSubtotal = input.items.filter((i) => eligible.has(i.id)).reduce((sum, i) => { const p = productMap.get(i.id); return sum + Number(p.sale_price ?? p.price) * i.qty; }, 0);
      if (!applicableSubtotal) return res.status(400).json({ error: 'This coupon does not apply to items in your cart.' });
    }
    let discount = coupon.type === 'percentage' ? applicableSubtotal * Number(coupon.value) / 100 : coupon.type === 'flat' ? Number(coupon.value) : 0;
    if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
    discount = Math.min(discount, applicableSubtotal);
    return res.json({ valid: true, code: coupon.code, type: coupon.type, discount: Math.round(discount * 100) / 100, freeShipping: coupon.type === 'free_shipping' });
  } catch (err) {
    return res.status(503).json({ error: 'Coupon validation is temporarily unavailable.' });
  }
});

publicRouter.post('/checkout/orders', orderLimiter, (req, res, next) => req.get('authorization') ? customerAuth(req, res, next) : next(), async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: 'Idempotency-Key must be 16-128 ASCII letters, digits, dots, underscores, colons or hyphens, starting with a letter or digit.' });
  }
  const schema = z.object({
    items: z.array(z.object({
      id: z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid product ID format'),
      size: z.string().trim().min(1, 'Product size is required').max(40),
      qty: z.number().int().positive('Quantity must be greater than 0').max(100)
    })).min(1, 'Cart is empty. Add items before checking out.').max(50, 'Cart exceeds maximum allowed items.'),
    customer: z.object({
      name: z.string().trim().min(1, 'Customer name is required').max(200),
      email: z.string().trim().email('Enter a valid customer email').max(320),
      phone: z.string().trim().min(7, 'Enter a valid phone number').max(30),
      address1: z.string().trim().min(1, 'Street address is required').max(300),
      address2: z.string().trim().max(300).optional().default(''),
      city: z.string().trim().min(1, 'City is required').max(120),
      state: z.string().trim().min(1, 'State is required').max(120),
      pin: z.string().trim().min(4, 'PIN/Postal code is required').max(20)
    }),
    coupon_code: z.string().trim().max(40).optional().default('')
  }).safeParse(req.body);

  if (!schema.success) {
    return res.status(400).json({ error: schema.error.issues[0].message });
  }

  // PostgreSQL aggregates after validating each submitted line. Pre-aggregation here
  // would turn valid split lines into a quantity above SQL's per-line limit.
  const sanitizedItems = schema.data.items.map(item => ({ ...item, id: item.id.toLowerCase() }));

  try {
    const { data, error } = await getDb().rpc(req.customer ? 'customer_create_order' : 'storefront_create_order', {
      p_items: sanitizedItems,
      p_customer: req.customer ? { ...schema.data.customer, email: req.customer.email } : schema.data.customer,
      p_coupon_code: schema.data.coupon_code || null,
      ...(req.customer ? { p_user_id: req.customer.id } : {}),
      ...(idempotencyKey ? { p_idempotency_key: idempotencyKey } : {})
    });

    if (error) {
      if (error.code === 'P4090') return res.status(409).json({ error: 'Idempotency-Key was already used for a different checkout request.' });
      const isClientError = error.code === '22023' || error.code === '42501';
      if (isClientError) {
        return res.status(400).json({ error: error.message });
      }
      console.error('[checkout] Database order creation failed');
      return res.status(500).json({ error: 'Order could not be processed at this time. Please try again.' });
    }

    if (!data || !data.id) {
      console.error('[checkout] Order creation returned invalid response');
      return res.status(500).json({ error: 'Order could not be confirmed. Please contact support.' });
    }

    return res.status(201).json({ data });
  } catch (err) {
    console.error('[checkout] Unexpected checkout error');
    return res.status(500).json({ error: 'Order processing failed due to an unexpected error. Please try again.' });
  }
});
