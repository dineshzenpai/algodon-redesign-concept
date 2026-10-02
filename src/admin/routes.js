import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { env } from '../config/env.js';
import { loginAdmin, logoutAdmin, requireAdmin, requireAdminCsrf, requireRole, writeAudit } from './auth.js';

export const adminRouter = Router();
const idSchema = z.string().uuid();
const orderStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];
const roles = ['super_admin', 'manager', 'support'];
const imageRefSchema = z.string().max(2048).refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use a secure image URL or a site-relative path.');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 8 }, fileFilter: (req, file, cb) => {
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  cb(supported.includes(file.mimetype) ? null : new Error('Upload a JPEG, PNG, WebP, or AVIF image.'), supported.includes(file.mimetype));
} });

function imageSignatureMatches(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (file.mimetype === 'image/avif') return b.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(b.toString('ascii', 8, 32));
  return false;
}

const productSchema = z.object({
  name: z.string().trim().min(1).max(200), slug: z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(10000).default(''), price: z.coerce.number().nonnegative(), sale_price: z.coerce.number().nonnegative().nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(), brand: z.string().trim().max(120).default('Algodon Organic'),
  tags: z.array(z.string().trim().max(40)).max(30).default([]), variants: z.array(z.object({ size: z.string().max(40), color: z.string().max(50).optional(), sku: z.string().max(80).optional(), stock: z.number().int().nonnegative().default(0) })).max(100).default([]),
  category_id: z.string().uuid().nullable().optional(), stock_count: z.coerce.number().int().nonnegative().default(0), low_stock_threshold: z.coerce.number().int().nonnegative().default(5),
  out_of_stock_hidden: z.boolean().default(false), images: z.array(imageRefSchema).max(20).default([]), published: z.boolean().default(false),
  seo_title: z.string().max(200).default(''), meta_description: z.string().max(320).default('')
}).refine((p) => p.sale_price == null || p.price == null || p.sale_price <= p.price, { message: 'Sale price cannot exceed regular price.', path: ['sale_price'] })
  .refine((p) => !p.variants?.length || p.stock_count == null || p.variants.reduce((sum, variant) => sum + variant.stock, 0) === p.stock_count, { message: 'Product stock must equal the sum of variant stock.', path: ['stock_count'] });
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(3000).default(''), image_url: imageRefSchema.nullable().optional(), parent_id: z.string().uuid().nullable().optional(), sort_order: z.coerce.number().int().min(0).default(0), active: z.boolean().default(true) });
const couponSchema = z.object({ code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()), type: z.enum(['percentage', 'flat', 'free_shipping']), value: z.coerce.number().nonnegative(), minimum_order: z.coerce.number().nonnegative().default(0), max_discount: z.coerce.number().nonnegative().nullable().optional(), starts_at: z.string().datetime().nullable().optional(), ends_at: z.string().datetime().nullable().optional(), usage_limit: z.coerce.number().int().nonnegative().nullable().optional(), per_customer_limit: z.coerce.number().int().nonnegative().nullable().optional(), product_ids: z.array(z.string().uuid()).max(100).default([]), category_ids: z.array(z.string().uuid()).max(100).default([]), active: z.boolean().default(true) }).refine((c) => c.type !== 'percentage' || c.value <= 100, { message: 'Percentage cannot exceed 100.', path: ['value'] });

function fail(res, status, message) { return res.status(status).json({ error: message }); }
function pageParams(req) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}
function dbError(error, res) {
  if (error.code === '23505') return fail(res, 409, 'That value is already in use.');
  if (error.code === '23503') return fail(res, 400, 'A related record could not be found.');
  console.error('[admin] Database request failed:', error.message);
  return fail(res, 500, 'The request could not be completed.');
}
function publicOrder(order) {
  return { ...order, customer: order.customer || {}, items: Array.isArray(order.items) ? order.items : [] };
}
function listQuery(table, select = '*') { return getDb().from(table).select(select, { count: 'exact' }); }

adminRouter.post('/auth/login', loginLimiter, loginAdmin);
adminRouter.post('/auth/logout', requireAdminCsrf, logoutAdmin);
adminRouter.post('/auth/password-reset', resetLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return res.status(200).json({ message: 'If that admin account exists, password reset instructions have been sent.' });
  const { data: users, error: usersError } = await getDb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  const adminUser = !usersError && users.users.find((user) => user.email && user.email.toLowerCase() === email);
  if (adminUser) {
    const { data: admin } = await getDb().from('admin_users').select('user_id').eq('user_id', adminUser.id).maybeSingle();
    if (admin) {
      const { error } = await loginClientReset(email, `${req.protocol}://${req.get('host')}/admin`);
      if (error) console.error('[admin] Password reset request failed:', error.message);
    }
  }
  return res.json({ message: 'If that admin account exists, password reset instructions have been sent.' });
});

async function loginClientReset(email, redirectTo) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.supabase.url, env.supabase.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client.auth.resetPasswordForEmail(email, { redirectTo });
}

adminRouter.post('/auth/password-update', resetLimiter, async (req, res) => {
  const schema = z.object({ accessToken: z.string().min(20), password: z.string().min(12).max(128) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'Use a password with at least 12 characters.');
  const { data: { user }, error } = await getDb().auth.getUser(parsed.data.accessToken);
  if (error || !user) return fail(res, 401, 'This password reset link has expired. Request another one.');
  const { data: admin } = await getDb().from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (!admin) return fail(res, 403, 'This account does not have admin access.');
  const { error: updateError } = await getDb().auth.admin.updateUserById(user.id, { password: parsed.data.password });
  if (updateError) return fail(res, 400, 'Password could not be updated. Request a new reset link.');
  await writeAudit({ id: user.id, email: user.email }, 'admin.password_reset', 'admin', user.id);
  return res.json({ ok: true });
});

adminRouter.use(requireAdmin);
adminRouter.get('/me', (req, res) => res.json({ user: req.admin }));
adminRouter.use(requireAdminCsrf);

adminRouter.get('/dashboard', requireRole('super_admin', 'manager'), async (req, res) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86400000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return fail(res, 400, 'Choose a valid date range.');
  const { data, error } = await getDb().rpc('admin_dashboard_summary', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return dbError(error, res);
  return res.json(data);
});

// Product catalog
adminRouter.get('/products', async (req, res) => {
  const { page, limit, from, to } = pageParams(req); let query = listQuery('products').order('updated_at', { ascending: false }).range(from, to);
  if (req.query.q) query = query.ilike('name', `%${String(req.query.q).slice(0, 100)}%`);
  if (req.query.published === 'true' || req.query.published === 'false') query = query.eq('published', req.query.published === 'true');
  const { data, count, error } = await query;
  if (error) return dbError(error, res);
  return res.json({ data, page, limit, total: count || 0 });
});
adminRouter.post('/products', requireRole('super_admin', 'manager'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body); if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  const { data, error } = await getDb().from('products').insert(parsed.data).select().single();
  if (error) return dbError(error, res);
  await writeAudit(req.admin, 'product.create', 'product', data.id, { fields: Object.keys(parsed.data) });
  return res.status(201).json({ data });
});
adminRouter.patch('/products/bulk-stock', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = z.array(z.object({ id: idSchema, stock_count: z.number().int().nonnegative() })).min(1).max(500).safeParse(req.body.items);
  if (!p.success) return fail(res, 400, 'Provide product IDs and non-negative stock counts.');
  for (const item of p.data) {
    const { data: product, error: readError } = await getDb().from('products').select('variants').eq('id',item.id).maybeSingle(); if(readError)return dbError(readError,res); if(!product)return fail(res,404,'A selected product was not found.');
    const variants=product.variants||[]; const perVariant=Math.floor(item.stock_count/Math.max(variants.length,1)); const remainder=variants.length?item.stock_count%variants.length:0;
    const nextVariants=variants.map((v,index)=>({...v,stock:perVariant+(index<remainder?1:0)}));
    const { error } = await getDb().from('products').update({ stock_count: item.stock_count, ...(variants.length?{variants:nextVariants}:{}), updated_at: new Date().toISOString() }).eq('id', item.id); if (error) return dbError(error, res);
  }
  await writeAudit(req.admin, 'product.bulk_stock', 'product', null, { count: p.data.length }); return res.json({ updated: p.data.length });
});
adminRouter.patch('/products/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid product ID.');
  const parsed = productSchema.partial().safeParse(req.body); if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  const { data, error } = await getDb().from('products').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
  if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Product not found.');
  await writeAudit(req.admin, 'product.update', 'product', data.id, { fields: Object.keys(parsed.data) }); return res.json({ data });
});
adminRouter.post('/products/:id/duplicate', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid product ID.');
  const { data: old, error } = await getDb().from('products').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return dbError(error, res); if (!old) return fail(res, 404, 'Product not found.');
  const copy = { ...old, id: undefined, name: `${old.name} (copy)`, slug: `${old.slug}-copy-${Date.now().toString(36)}`, sku: null, published: false, created_at: undefined, updated_at: undefined };
  const { data, error: insertError } = await getDb().from('products').insert(copy).select().single();
  if (insertError) return dbError(insertError, res); await writeAudit(req.admin, 'product.duplicate', 'product', data.id, { sourceId: old.id }); return res.status(201).json({ data });
});
adminRouter.delete('/products/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const { error, count } = await getDb().from('products').delete({ count: 'exact' }).eq('id', req.params.id);
  if (error) return dbError(error, res); if (!count) return fail(res, 404, 'Product not found.');
  await writeAudit(req.admin, 'product.delete', 'product', req.params.id); return res.json({ ok: true });
});
adminRouter.post('/products/import', requireRole('super_admin', 'manager'), async (req, res) => {
  const parsed = z.array(productSchema).min(1).max(500).safeParse(req.body.products);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  const { data, error } = await getDb().from('products').upsert(parsed.data, { onConflict: 'slug' }).select('id,slug');
  if (error) return dbError(error, res); await writeAudit(req.admin, 'product.import', 'product', null, { count: data.length }); return res.json({ imported: data.length });
});
adminRouter.get('/products/export', requireRole('super_admin', 'manager'), async (req, res) => {
  const data=[]; for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('products').select('*').order('name').range(start,start+999);if(error)return dbError(error,res);data.push(...batch);if(batch.length<1000)break;} return res.json({data});
});

// Categories
adminRouter.get('/categories', requireRole('super_admin', 'manager'), async (req, res) => { const { data, error } = await getDb().from('categories').select('*').order('sort_order').limit(500); return error ? dbError(error, res) : res.json({ data }); });
adminRouter.post('/categories', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = categorySchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  const { data, error } = await getDb().from('categories').insert(p.data).select().single(); if (error) return dbError(error, res);
  await writeAudit(req.admin, 'category.create', 'category', data.id, { fields: Object.keys(p.data) }); return res.status(201).json({ data });
});
adminRouter.patch('/categories/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = categorySchema.partial().safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  const { data, error } = await getDb().from('categories').update({ ...p.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
  if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Category not found.'); await writeAudit(req.admin, 'category.update', 'category', data.id, { fields: Object.keys(p.data) }); return res.json({ data });
});
adminRouter.delete('/categories/:id', requireRole('super_admin', 'manager'), async (req, res) => { const { error, count } = await getDb().from('categories').delete({ count: 'exact' }).eq('id', req.params.id); if (error) return dbError(error, res); if (!count) return fail(res, 404, 'Category not found.'); await writeAudit(req.admin, 'category.delete', 'category', req.params.id); return res.json({ ok: true }); });
adminRouter.patch('/categories/reorder', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = z.array(z.object({ id: idSchema, sort_order: z.number().int().nonnegative() })).max(500).safeParse(req.body.items); if (!p.success) return fail(res, 400, 'Invalid category order.');
  const { error } = await getDb().rpc('admin_reorder_categories', { p_items: p.data }); if (error) return dbError(error, res);
  await writeAudit(req.admin, 'category.reorder', 'category', null, { count: p.data.length }); return res.json({ ok: true });
});

// Orders, notes, fulfilment and manual payment/refund recording
adminRouter.get('/orders', async (req, res) => {
  const { page, limit, from, to } = pageParams(req); let query = listQuery('order_intents').order('created_at', { ascending: false }).range(from, to);
  if (orderStatuses.includes(String(req.query.status))) query = query.eq('status', req.query.status);
  if (req.query.payment_status) query = query.eq('payment_status', String(req.query.payment_status).slice(0, 32));
  if (req.query.from) query = query.gte('created_at', String(req.query.from)); if (req.query.to) query = query.lte('created_at', String(req.query.to));
  if (req.query.q) query = query.ilike('customer->>email', `%${String(req.query.q).slice(0, 100)}%`);
  const { data, count, error } = await query; if (error) return dbError(error, res); return res.json({ data: (data || []).map(publicOrder), page, limit, total: count || 0 });
});
adminRouter.get('/orders/export', requireRole('super_admin', 'manager'), async (req, res) => { const data=[];for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('order_intents').select('*').order('created_at',{ascending:false}).range(start,start+999);if(error)return dbError(error,res);data.push(...batch);if(batch.length<1000)break;}return res.json({data:data.map(publicOrder)}); });
adminRouter.get('/orders/:id', async (req, res) => { const { data, error } = await getDb().from('order_intents').select('*').eq('id', req.params.id).maybeSingle(); if (error) return dbError(error, res); return data ? res.json({ data: publicOrder(data) }) : fail(res, 404, 'Order not found.'); });
adminRouter.patch('/orders/:id', async (req, res) => {
  const schema = z.object({ status: z.enum(orderStatuses).optional(), payment_status: z.enum(['Pending', 'Paid', 'Failed', 'Partially Refunded', 'Refunded']).optional(), tracking_number: z.string().max(120).optional(), courier_name: z.string().max(120).optional(), internal_notes: z.string().max(5000).optional() }).strict();
  const p = schema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  if (req.admin.role === 'support' && (Object.keys(p.data).some((key) => key === 'payment_status') || p.data.status === 'Refunded')) return fail(res, 403, 'Support cannot change payment or refund status.');
  const { data: before, error: readError } = await getDb().from('order_intents').select('status').eq('id', req.params.id).maybeSingle();
  if (readError) return dbError(readError, res); if (!before) return fail(res, 404, 'Order not found.');
  const { data, error } = await getDb().from('order_intents').update({ ...p.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
  if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Order not found.');
  const statusChanged = Boolean(p.data.status && p.data.status !== before.status);
  let notificationSent = false;
  await writeAudit(req.admin, 'order.update', 'order', data.id, { fields: Object.keys(p.data), status: data.status });
  if (statusChanged && data.customer && data.customer.email && process.env.SMTP_HOST) {
    try {
      const nodemailer = await import('nodemailer');
      const mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
      await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@algodonorganic.com', to: data.customer.email, subject: `Your Algodon order is ${data.status}`, text: `Your order status is now ${data.status}.${data.tracking_number ? ` Tracking: ${data.courier_name} ${data.tracking_number}` : ''}` });
      notificationSent = true;
    } catch (mailError) { console.error('[admin] Order notification failed:', mailError.message); }
  }
  return res.json({ data: publicOrder(data), notificationSent });
});

// Coupons
adminRouter.get('/coupons', requireRole('super_admin', 'manager'), async (req, res) => { const { page, limit, from, to } = pageParams(req); let q = listQuery('coupons').order('created_at', { ascending: false }).range(from, to); if (req.query.q) q = q.ilike('code', `%${String(req.query.q).slice(0, 40)}%`); const { data, error, count } = await q; return error ? dbError(error, res) : res.json({ data, page, limit, total: count || 0 }); });
adminRouter.post('/coupons', requireRole('super_admin', 'manager'), async (req, res) => { const p = couponSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message); const { data, error } = await getDb().from('coupons').insert(p.data).select().single(); if (error) return dbError(error, res); await writeAudit(req.admin, 'coupon.create', 'coupon', data.id, { code: data.code }); return res.status(201).json({ data }); });
adminRouter.patch('/coupons/:id', requireRole('super_admin', 'manager'), async (req, res) => { const p = couponSchema.partial().safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message); const { data, error } = await getDb().from('coupons').update({ ...p.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle(); if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Coupon not found.'); await writeAudit(req.admin, 'coupon.update', 'coupon', data.id, { fields: Object.keys(p.data) }); return res.json({ data }); });
adminRouter.delete('/coupons/:id', requireRole('super_admin', 'manager'), async (req, res) => { const { error, count } = await getDb().from('coupons').delete({ count: 'exact' }).eq('id', req.params.id); if (error) return dbError(error, res); if (!count) return fail(res, 404, 'Coupon not found.'); await writeAudit(req.admin, 'coupon.delete', 'coupon', req.params.id); return res.json({ ok: true }); });
adminRouter.get('/coupons/:id/usage', requireRole('super_admin', 'manager'), async (req, res) => { const { page, limit, from, to } = pageParams(req); const { data, count, error } = await listQuery('coupon_redemptions').eq('coupon_id', req.params.id).order('redeemed_at', { ascending: false }).range(from, to); return error ? dbError(error, res) : res.json({ data, page, limit, total: count || 0 }); });

// Customer list is derived from existing order customer snapshots.
adminRouter.get('/customers', async (req, res) => {
  const { page, limit, from, to } = pageParams(req); let query = getDb().from('customer_admin_summary').select('*', { count: 'exact' }).order('last_order_at', { ascending: false }).range(from, to);
  if (req.query.q) { const q = String(req.query.q).replace(/[(),]/g,' ').slice(0,100); query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`); }
  const { data, count, error } = await query; if (error) return dbError(error, res);
  return res.json({ data: (data || []).map(c=>({...c,totalSpent:Number(c.total_spent),lastOrderAt:c.last_order_at})), page, limit, total: count || 0 });
});
adminRouter.get('/customers/export', requireRole('super_admin', 'manager'), async (req, res) => { const data=[]; for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('customer_admin_summary').select('*').order('last_order_at',{ascending:false}).range(start,start+999);if(error)return dbError(error,res);data.push(...batch);if(batch.length<1000)break;} return res.json({data:data.map(c=>({...c,totalSpent:Number(c.total_spent),lastOrderAt:c.last_order_at}))}); });
adminRouter.get('/customers/:email', async (req, res) => {
  const email = req.params.email.trim().toLowerCase(); if (!z.string().email().safeParse(email).success) return fail(res, 400, 'Invalid customer email.');
  const { data: summary, error: summaryError } = await getDb().from('customer_admin_summary').select('*').eq('email', email).maybeSingle();
  if (summaryError) return dbError(summaryError, res); if (!summary) return fail(res, 404, 'Customer not found.');
  const { data: orders, error } = await getDb().from('order_intents').select('*').ilike('customer->>email', email).order('created_at', { ascending: false }).limit(200);
  if (error) return dbError(error, res);
  const addresses=(summary.addresses||[]).map(a=>[a.address1,a.address2,a.city,a.state,a.pin].filter(Boolean).join(', '));
  return res.json({ data: { email, name:summary.name||'', phone:summary.phone||'', addresses, orders:(orders||[]).map(publicOrder), totalSpent:Number(summary.total_spent), orderCount:Number(summary.orders), blocked:Boolean(summary.blocked), note:summary.note||'' } });
});
adminRouter.patch('/customers/:email/block', requireRole('super_admin', 'manager'), async (req, res) => {
  const email = req.params.email.trim().toLowerCase(); if (!z.string().email().safeParse(email).success) return fail(res, 400, 'Invalid customer email.');
  const p = z.object({ blocked: z.boolean(), note: z.string().max(500).default('') }).safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  const { error } = await getDb().from('customer_admin_flags').upsert({ email, ...p.data, updated_at: new Date().toISOString() }); if (error) return dbError(error, res);
  await writeAudit(req.admin, p.data.blocked ? 'customer.block' : 'customer.unblock', 'customer', email); return res.json({ ok: true });
});

// Images are accepted only after MIME, size and file-count checks; service role owns storage writes.
adminRouter.post('/images', requireRole('super_admin', 'manager'), upload.array('images', 8), async (req, res) => {
  if (!req.files?.length) return fail(res, 400, 'Choose at least one image.');
  if (req.files.some((file) => !imageSignatureMatches(file))) return fail(res, 400, 'One or more uploads are not valid image files.');
  const uploaded = [];
  for (const file of req.files) {
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[file.mimetype];
    const path = `${Date.now()}-${randomUUID()}.${ext}`;
    const { error } = await getDb().storage.from('admin-product-images').upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) return dbError(error, res);
    const { data } = getDb().storage.from('admin-product-images').getPublicUrl(path); uploaded.push({ path, url: data.publicUrl });
  }
  await writeAudit(req.admin, 'image.upload', 'product_image', null, { count: uploaded.length }); return res.status(201).json({ data: uploaded });
});
adminRouter.delete('/images', requireRole('super_admin', 'manager'), async (req, res) => {
  const parsed = z.object({ url: z.string().url() }).safeParse(req.body); if (!parsed.success) return fail(res, 400, 'Invalid image URL.');
  let imageUrl; try { imageUrl = new URL(parsed.data.url); } catch { return fail(res, 400, 'Invalid image URL.'); }
  const storageUrl = new URL(env.supabase.url);
  const prefix = '/storage/v1/object/public/admin-product-images/';
  if (imageUrl.origin !== storageUrl.origin || !imageUrl.pathname.startsWith(prefix)) return fail(res, 400, 'Only images in the admin product image bucket can be deleted.');
  const objectPath = decodeURIComponent(imageUrl.pathname.slice(prefix.length));
  if (!objectPath || objectPath.includes('..')) return fail(res, 400, 'Invalid image path.');
  const { error } = await getDb().storage.from('admin-product-images').remove([objectPath]);
  if (error) return dbError(error, res);
  await writeAudit(req.admin, 'image.delete', 'product_image', objectPath); return res.json({ ok: true });
});

adminRouter.get('/activity', requireRole('super_admin'), async (req, res) => { const { page, limit, from, to } = pageParams(req); const { data, count, error } = await listQuery('admin_activity_logs').order('created_at', { ascending: false }).range(from, to); return error ? dbError(error, res) : res.json({ data, page, limit, total: count || 0 }); });
adminRouter.get('/staff', requireRole('super_admin'), async (req, res) => { const { data, error } = await getDb().from('admin_users').select('user_id,role,created_at').order('created_at'); if (error) return dbError(error, res); const { data: users, error: usersError } = await getDb().auth.admin.listUsers({ page: 1, perPage: 1000 }); if (usersError) return dbError(usersError, res); const emails = new Map(users.users.map(u=>[u.id,u.email])); return res.json({ data: data.map(a=>({...a,email:emails.get(a.user_id)||''})) }); });
adminRouter.post('/staff', requireRole('super_admin'), async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string().min(12).max(128), role: z.enum(['manager', 'support']) }).safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  const { data: created, error } = await getDb().auth.admin.createUser({ email: p.data.email, password: p.data.password, email_confirm: true });
  if (error) return fail(res, 400, error.message);
  const { error: roleError } = await getDb().from('admin_users').insert({ user_id: created.user.id, role: p.data.role }); if (roleError) return dbError(roleError, res);
  await writeAudit(req.admin, 'staff.create', 'admin', created.user.id, { role: p.data.role }); return res.status(201).json({ data: { user_id: created.user.id, email: created.user.email, role: p.data.role } });
});
adminRouter.patch('/staff/:id', requireRole('super_admin'), async (req, res) => { const p = z.object({ role: z.enum(roles) }).safeParse(req.body); if (!p.success) return fail(res, 400, 'Invalid admin role.'); if (req.params.id === req.admin.id && p.data.role !== 'super_admin') return fail(res, 400, 'You cannot remove your own Super Admin role.'); const { data, error } = await getDb().from('admin_users').update({ role: p.data.role, updated_at: new Date().toISOString() }).eq('user_id', req.params.id).select().maybeSingle(); if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Admin not found.'); await writeAudit(req.admin, 'staff.role_update', 'admin', req.params.id, { role: data.role }); return res.json({ data }); });
adminRouter.delete('/staff/:id', requireRole('super_admin'), async (req, res) => { if (req.params.id === req.admin.id) return fail(res, 400, 'You cannot remove your own admin access.'); const { error } = await getDb().from('admin_users').delete().eq('user_id', req.params.id); if (error) return dbError(error, res); await writeAudit(req.admin, 'staff.revoke', 'admin', req.params.id); return res.json({ ok: true }); });
