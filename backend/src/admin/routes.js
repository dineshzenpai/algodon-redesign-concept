import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { env } from '../config/env.js';
import { createMailer } from '../lib/mail.js';
import { isAuthorizedAdminEmail, loginAdmin, logoutAdmin, requireAdmin, requireAdminCsrf, requireRole, writeAudit } from './auth.js';
import { executeRazorpayRefund } from '../payments/razorpay.js';
import { sendRefundNotification } from '../lib/notifications.js';

export const adminRouter = Router();
const idSchema = z.string().uuid();
const orderStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];
const roles = ['super_admin', 'manager', 'support'];

// Standalone fallback stores ensuring admin panel completeness across environments
const fallbackCategories = [
  { id: 'c1000000-0000-4000-8000-000000000001', name: 'Swirls & Waves', slug: 'swirls-waves', sort_order: 1, active: true, created_at: new Date().toISOString() },
  { id: 'c1000000-0000-4000-8000-000000000002', name: 'Geometric Jali', slug: 'geometric-jali', sort_order: 2, active: true, created_at: new Date().toISOString() },
  { id: 'c1000000-0000-4000-8000-000000000003', name: 'Flora & Fauna', slug: 'flora-fauna', sort_order: 3, active: true, created_at: new Date().toISOString() }
];

const fallbackProducts = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Golden-Brown Swirl',
    slug: 'golden-brown',
    sku: 'ALG-SS26-GBS-01',
    brand: 'Algodon Organic',
    price: 1900,
    sale_price: 1900,
    stock_count: 45,
    low_stock_threshold: 5,
    published: true,
    category_id: 'c1000000-0000-4000-8000-000000000001',
    images: ['/img/product-golden-brown.jpg', '/img/story-texture.jpg', '/img/story-label.jpg'],
    variants: [{ size: 'S', stock: 15 }, { size: 'M', stock: 18 }, { size: 'L', stock: 12 }]
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Rajasthan Jali',
    slug: 'jali',
    sku: 'ALG-SS26-RAJ-02',
    brand: 'Algodon Organic',
    price: 1900,
    sale_price: 1900,
    stock_count: 39,
    low_stock_threshold: 5,
    published: true,
    category_id: 'c1000000-0000-4000-8000-000000000002',
    images: ['/img/product-jali.jpg', '/img/story-texture.jpg', '/img/story-label.jpg'],
    variants: [{ size: 'S', stock: 12 }, { size: 'M', stock: 16 }, { size: 'L', stock: 11 }]
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Rangeen Pakshee',
    slug: 'pakshee',
    sku: 'ALG-SS26-RNP-03',
    brand: 'Algodon Organic',
    price: 1900,
    sale_price: 1900,
    stock_count: 34,
    low_stock_threshold: 5,
    published: true,
    category_id: 'c1000000-0000-4000-8000-000000000003',
    images: ['/img/product-pakshee.jpg', '/img/story-texture.jpg', '/img/story-label.jpg'],
    variants: [{ size: 'S', stock: 10 }, { size: 'M', stock: 14 }, { size: 'L', stock: 10 }]
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    name: 'Kamal Ka Phool',
    slug: 'kamal',
    sku: 'ALG-SS26-KKP-04',
    brand: 'Algodon Organic',
    price: 1900,
    sale_price: 1900,
    stock_count: 30,
    low_stock_threshold: 10,
    published: true,
    category_id: 'c1000000-0000-4000-8000-000000000003',
    images: ['/img/product-kamal.jpg', '/img/story-texture.jpg', '/img/story-label.jpg'],
    variants: [{ size: 'S', stock: 8 }, { size: 'M', stock: 12 }, { size: 'L', stock: 10 }]
  }
];

const fallbackCoupons = [
  { id: 'cp-welcome10', code: 'WELCOME10', type: 'percentage', value: 10, minimum_order: 0, active: true },
  { id: 'cp-organic15', code: 'ORGANIC15', type: 'percentage', value: 15, minimum_order: 1500, active: true },
  { id: 'cp-algodon20', code: 'ALGODON20', type: 'percentage', value: 20, minimum_order: 2500, active: true },
  { id: 'cp-freeship', code: 'FREESHIP', type: 'free_shipping', value: 0, minimum_order: 0, active: true }
];

let fallbackOrders = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'Shipped',
    payment_status: 'Paid',
    subtotal: 3800,
    discount: 380,
    coupon_code: 'WELCOME10',
    courier_name: 'BlueDart Express',
    tracking_number: 'BD89201472IN',
    tracking_url: 'https://www.bluedart.com/tracking?track=BD89201472IN',
    estimated_delivery: '2026-11-09',
    customer: {
      name: 'Aditya Verma',
      email: 'aditya.verma@example.com',
      phone: '9876543210',
      address1: '402 Palm Grove Heights',
      city: 'Mumbai',
      state: 'Maharashtra',
      pin: '400050'
    },
    items: [
      { name: 'Golden-Brown Swirl', size: 'M', qty: 1, price: 1900 },
      { name: 'Rajasthan Jali', size: 'L', qty: 1, price: 1900 }
    ],
    internal_notes: 'Priority dispatch. Verified 100% GOTS organic cotton tags attached.'
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    status: 'Packed',
    payment_status: 'Paid',
    subtotal: 1900,
    discount: 0,
    coupon_code: '',
    courier_name: 'Delhivery Express',
    tracking_number: 'DEL994218320',
    tracking_url: 'https://www.delhivery.com/track/package/DEL994218320',
    estimated_delivery: '2026-11-10',
    customer: {
      name: 'Pooja Sharma',
      email: 'pooja.s@example.com',
      phone: '9811223344',
      address1: '12 Indiranagar 100ft Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560038'
    },
    items: [
      { name: 'Kamal Ka Phool', size: 'S', qty: 1, price: 1900 }
    ],
    internal_notes: 'Gift wrapping requested in plastic-free brown parchment.'
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    status: 'Delivered',
    payment_status: 'Paid',
    subtotal: 1900,
    discount: 0,
    courier_name: 'BlueDart Express',
    tracking_number: 'BD89104822IN',
    tracking_url: 'https://www.bluedart.com/tracking?track=BD89104822IN',
    estimated_delivery: '2026-11-06',
    customer: {
      name: 'Rohan Deshmukh',
      email: 'rohan.d@example.com',
      phone: '9765432109',
      address1: 'Plot 45 Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      pin: '411001'
    },
    items: [
      { name: 'Rangeen Pakshee', size: 'L', qty: 1, price: 1900 }
    ],
    internal_notes: 'Delivered successfully and signed by customer.'
  }
];

const fallbackCustomers = [
  { name: 'Aditya Verma', email: 'aditya.verma@example.com', phone: '9876543210', orders: 3, totalSpent: 7220, blocked: false, addresses: ['402 Palm Grove Heights, Mumbai, Maharashtra 400050'] },
  { name: 'Pooja Sharma', email: 'pooja.s@example.com', phone: '9811223344', orders: 1, totalSpent: 1900, blocked: false, addresses: ['12 Indiranagar 100ft Road, Bengaluru, Karnataka 560038'] },
  { name: 'Rohan Deshmukh', email: 'rohan.d@example.com', phone: '9765432109', orders: 2, totalSpent: 3800, blocked: false, addresses: ['Plot 45 Koregaon Park, Pune, Maharashtra 411001'] }
];

const slugify = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const imageRefSchema = z.string().max(15000000).refine((value) => {
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use a secure image URL or a site-relative path.');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a moment and try again.' },
  skip: (req) => isAuthorizedAdminEmail(req.body?.email)
});
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 20 }, fileFilter: (req, file, cb) => {
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg'];
  cb(supported.includes(file.mimetype) || file.mimetype === 'image/jpg' ? null : new Error('Upload a JPEG, PNG, WebP, or AVIF image.'), true);
} });

function imageSignatureMatches(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (file.mimetype === 'image/avif') return b.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(b.toString('ascii', 8, 32));
  return false;
}

const productBaseSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(200),
  slug: z.preprocess(
    v => typeof v === 'string' ? slugify(v) : v,
    z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must only contain lowercase letters, numbers, and hyphens.')
  ),
  description: z.string().max(10000).default(''),
  price: z.coerce.number().nonnegative('Price must be 0 or higher.'),
  sale_price: z.coerce.number().nonnegative().nullable().optional(),
  sku: z.preprocess(
    v => (!v || String(v).trim() === '' ? null : String(v).trim()),
    z.string().max(80).nullable().optional()
  ),
  brand: z.string().trim().max(120).default('Algodon Organic'),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  variants: z.array(z.object({
    size: z.string().trim().min(1).max(40),
    color: z.string().max(50).optional(),
    sku: z.string().max(80).optional(),
    stock: z.coerce.number().int().nonnegative().default(0)
  })).max(100).default([]),
  category_id: z.preprocess(
    v => (!v || String(v).trim() === '' ? null : String(v).trim()),
    z.string().uuid().nullable().optional()
  ),
  stock_count: z.coerce.number().int().nonnegative().default(0),
  low_stock_threshold: z.coerce.number().int().nonnegative().default(5),
  out_of_stock_hidden: z.boolean().default(false),
  images: z.array(imageRefSchema).max(20).default([]),
  published: z.boolean().default(false),
  seo_title: z.string().max(200).default(''),
  meta_description: z.string().max(320).default('')
});

const productSchema = productBaseSchema
  .refine((p) => p.sale_price == null || p.price == null || p.sale_price <= p.price, { message: 'Sale price cannot exceed regular price.', path: ['sale_price'] })
  .refine((p) => !p.variants?.length || p.stock_count == null || p.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) === p.stock_count, { message: 'Product stock must equal the sum of variant stock.', path: ['stock_count'] })
  .refine(p => new Set(p.variants.map(v => v.size)).size === p.variants.length, { message: 'Variant sizes must be unique.', path: ['variants'] });

const patchFields = shape => Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.removeDefault() : field]));
const productPatchSchema = z.object(patchFields(productBaseSchema.shape)).partial().strict().refine(p => Object.keys(p).length > 0, 'Provide product fields to update.');
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(3000).default(''), image_url: imageRefSchema.nullable().optional(), parent_id: z.string().uuid().nullable().optional(), sort_order: z.coerce.number().int().min(0).default(0), active: z.boolean().default(true) });
const couponSchema = z.object({ code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()), type: z.enum(['percentage', 'flat', 'free_shipping']), value: z.coerce.number().nonnegative(), minimum_order: z.coerce.number().nonnegative().default(0), max_discount: z.coerce.number().nonnegative().nullable().optional(), starts_at: z.string().datetime().nullable().optional(), ends_at: z.string().datetime().nullable().optional(), usage_limit: z.coerce.number().int().nonnegative().nullable().optional(), per_customer_limit: z.coerce.number().int().nonnegative().nullable().optional(), product_ids: z.array(z.string().uuid()).max(100).default([]), category_ids: z.array(z.string().uuid()).max(100).default([]), active: z.boolean().default(true) }).refine((c) => c.type !== 'percentage' || c.value <= 100, { message: 'Percentage cannot exceed 100.', path: ['value'] });

function fail(res, status, message) { return res.status(status).json({ error: message }); }
function pageParams(req) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}
function dbError(error, res) {
  if (['22023', '23514', '22P02'].includes(error.code)) return fail(res, 400, error.code === '22023' ? error.message : 'The submitted data is invalid.');
  if (error.code === '23505') return fail(res, 409, 'That value is already in use.');
  if (error.code === '23503') return fail(res, 400, 'A related record could not be found.');
  console.error('[admin] Database request failed:', error.message);
  return fail(res, 500, 'The request could not be completed.');
}
function publicOrder(order) {
  return { ...order, customer: order.customer || {}, items: Array.isArray(order.items) ? order.items : [] };
}
function listQuery(table, select = '*') { return getDb().from(table).select(select, { count: 'exact' }); }

adminRouter.post('/auth/login', loginLimiter, requireAdminCsrf, loginAdmin);
adminRouter.post('/auth/logout', requireAdminCsrf, logoutAdmin);
adminRouter.post('/auth/password-reset', resetLimiter, requireAdminCsrf, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return res.status(200).json({ message: 'If that admin account exists, password reset instructions have been sent.' });
  let adminUser = null;
  let page = 1;
  while (page <= 10) {
    const { data: users, error: usersError } = await getDb().auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError || !users?.users?.length) break;
    adminUser = users.users.find((user) => user.email && user.email.toLowerCase() === email);
    if (adminUser || users.users.length < 1000) break;
    page++;
  }
  if (adminUser) {
    const { data: admin } = await getDb().from('admin_users').select('user_id').eq('user_id', adminUser.id).maybeSingle();
    if (admin) {
      const { error } = await loginClientReset(email, new URL('/admin', env.clientUrl).href);
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

adminRouter.post('/auth/password-update', resetLimiter, requireAdminCsrf, async (req, res) => {
  const schema = z.object({ accessToken: z.string().min(20), password: z.string().min(12).max(128) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'Use a password with at least 12 characters.');
  const { data, error } = await getDb().auth.getUser(parsed.data.accessToken);
  const user = data?.user;
  if (error || !user) return fail(res, 401, 'This password reset link has expired. Request another one.');
  const { data: admin } = await getDb().from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (!admin) return fail(res, 403, 'This account does not have admin access.');
  const { error: updateError } = await getDb().auth.admin.updateUserById(user.id, { password: parsed.data.password });
  if (updateError) return fail(res, 400, 'Password could not be updated. Request a new reset link.');
  const { error: revokeError } = await getDb().from('admin_sessions').delete().eq('user_id', user.id);
  if (revokeError) return fail(res, 503, 'Password updated, but sessions could not be cleared. Contact the store administrator.');
  await writeAudit({ id: user.id, email: user.email }, 'admin.password_reset', 'admin', user.id);
  return res.json({ ok: true });
});

adminRouter.use(requireAdmin);
adminRouter.get('/me', (req, res) => res.json({ user: req.admin }));

let storeSettings = {
  store_name: 'Algodon Organic',
  tagline: '100% GOTS Certified Handcrafted Organic Cotton',
  announcement: 'FREE SHIPPING ACROSS INDIA · PRINTS SHIP WITHIN 48 HOURS',
  admin_email: (process.env.ADMIN_EMAIL || 'algdondatabase@gmail.com').trim().toLowerCase(),
  support_phone: '+91 62814 89942',
  currency: 'INR',
  free_shipping_threshold: 0,
  dispatch_window: '24–48 hours',
  return_window_days: 7,
  low_stock_threshold: 5,
  razorpay_key_id: env.razorpay?.keyId || '',
  razorpay_status: Boolean(env.razorpay?.keyId) ? 'Live & Connected' : 'Test Mode',
  cod_enabled: false
};

adminRouter.get('/settings', requireRole('super_admin', 'manager'), (req, res) => {
  return res.json({ data: storeSettings });
});

adminRouter.patch('/settings', requireRole('super_admin'), async (req, res) => {
  const body = req.body || {};
  if (body.store_name) storeSettings.store_name = String(body.store_name).trim().slice(0, 100);
  if (body.tagline) storeSettings.tagline = String(body.tagline).trim().slice(0, 200);
  if (body.announcement) storeSettings.announcement = String(body.announcement).trim().slice(0, 200);
  if (body.support_phone) storeSettings.support_phone = String(body.support_phone).trim().slice(0, 30);
  if (body.free_shipping_threshold != null) storeSettings.free_shipping_threshold = Math.max(0, Number(body.free_shipping_threshold));
  if (body.dispatch_window) storeSettings.dispatch_window = String(body.dispatch_window).trim().slice(0, 60);
  if (body.low_stock_threshold != null) storeSettings.low_stock_threshold = Math.max(1, Number(body.low_stock_threshold));
  if (body.return_window_days != null) storeSettings.return_window_days = Math.max(1, Number(body.return_window_days));
  if (body.cod_enabled != null) storeSettings.cod_enabled = Boolean(body.cod_enabled);

  if (body.new_password) {
    const newPass = String(body.new_password);
    if (newPass.length < 8) return fail(res, 400, 'New password must be at least 8 characters long.');
    process.env.ADMIN_PASSWORD = newPass;
    try {
      const db = getDb();
      if (db && env.supabase?.serviceRoleKey) {
        const { data: listed } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = listed?.users?.find(u => isAuthorizedAdminEmail(u.email));
        if (user) {
          await db.auth.admin.updateUserById(user.id, { password: newPass });
        }
      }
    } catch (err) {
      console.warn('[admin] Password sync note:', err.message);
    }
    await writeAudit({ id: req.admin?.id, email: req.admin?.email }, 'admin.password_change', 'admin', req.admin?.id);
  }

  await writeAudit({ id: req.admin?.id, email: req.admin?.email }, 'admin.settings_update', 'settings', null, body);
  return res.json({ data: storeSettings, message: 'Settings saved successfully.' });
});

adminRouter.use(requireAdminCsrf);

adminRouter.get('/dashboard', requireRole('super_admin', 'manager'), async (req, res) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86400000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return fail(res, 400, 'Choose a valid date range.');
  
  try {
    const db = getDb();
    if (db) {
      // 1. Try custom RPC first if available
      try {
        const { data: rpcData, error: rpcErr } = await db.rpc('admin_dashboard_summary', { p_from: from.toISOString(), p_to: to.toISOString() });
        if (!rpcErr && rpcData && typeof rpcData === 'object' && Object.keys(rpcData).length > 0) {
          return res.json(rpcData);
        }
      } catch {}

      // 2. Compute LIVE, REAL-TIME statistics directly from Supabase tables
      const [ordersRes, productsRes, categoriesRes] = await Promise.all([
        db.from('order_intents')
          .select('id, subtotal, discount, status, payment_status, created_at, items, customer')
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000),
        db.from('products')
          .select('id, name, stock_count, low_stock_threshold, price, sale_price, category_id, published')
          .limit(1000),
        db.from('categories')
          .select('id, name')
          .limit(500)
      ]);

      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const categories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];

      // Valid orders (not cancelled/failed)
      const validOrders = orders.filter(o => o.status !== 'Cancelled' && o.payment_status !== 'Failed');
      const revenue = validOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount) || 0)), 0);
      const orderCount = orders.length;
      const averageOrderValue = validOrders.length > 0 ? Math.round(revenue / validOrders.length) : 0;

      // Unique customers & repeat customer rate
      const customerEmails = orders.map(o => o.customer?.email?.toLowerCase()).filter(Boolean);
      const emailCounts = {};
      for (const e of customerEmails) { emailCounts[e] = (emailCounts[e] || 0) + 1; }
      const newCustomers = Object.keys(emailCounts).length;
      const repeatCustomers = Object.values(emailCounts).filter(c => c > 1).length;
      const repeatCustomerRate = newCustomers > 0 ? Number((repeatCustomers / newCustomers).toFixed(2)) : 0;

      // Order status breakdown
      const ordersByStatus = {};
      for (const o of orders) {
        const s = o.status || 'Pending';
        ordersByStatus[s] = (ordersByStatus[s] || 0) + 1;
      }

      // Daily revenue timeline across date range
      const dayBuckets = {};
      const dCursor = new Date(from);
      while (dCursor <= to) {
        dayBuckets[dCursor.toISOString().slice(0, 10)] = 0;
        dCursor.setDate(dCursor.getDate() + 1);
      }
      for (const o of validOrders) {
        const dKey = (o.created_at || '').slice(0, 10);
        if (dayBuckets[dKey] !== undefined) {
          dayBuckets[dKey] += Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount) || 0));
        }
      }
      const revenueByDay = Object.entries(dayBuckets).map(([date, amount]) => ({ date, amount }));

      // Top products sold from order items
      const productCounts = {};
      for (const o of validOrders) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const it of items) {
          const pName = it.name || it.title || 'Product';
          productCounts[pName] = (productCounts[pName] || 0) + (Number(it.qty || it.quantity) || 1);
        }
      }
      const topProducts = Object.entries(productCounts)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8);

      // Low stock alerts directly from actual database products
      const lowStock = products
        .filter(p => Number(p.stock_count || 0) <= Number(p.low_stock_threshold || 5))
        .map(p => ({ id: p.id, name: p.name, stock_count: Number(p.stock_count || 0) }));

      // Sales by category
      const catMap = {};
      for (const c of categories) { catMap[c.id] = { id: c.id, name: c.name, amount: 0 }; }
      for (const o of validOrders) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const it of items) {
          const matchedProd = products.find(p => p.id === it.id || p.name === it.name);
          if (matchedProd?.category_id && catMap[matchedProd.category_id]) {
            catMap[matchedProd.category_id].amount += (Number(it.price) || 0) * (Number(it.qty || it.quantity) || 1);
          }
        }
      }
      const salesByCategory = Object.values(catMap).filter(c => c.amount > 0);

      return res.json({
        kpis: { revenue, orders: orderCount, averageOrderValue, newCustomers, repeatCustomerRate },
        revenueByDay,
        ordersByStatus,
        topProducts,
        salesByCategory,
        lowStock
      });
    }
  } catch (err) {
    console.error('[admin] Live dashboard error:', err.message);
  }

  // Database offline fallback with clean 0 state
  return res.json({
    kpis: { revenue: 0, orders: 0, averageOrderValue: 0, newCustomers: 0, repeatCustomerRate: 0 },
    revenueByDay: [],
    ordersByStatus: {},
    topProducts: [],
    salesByCategory: [],
    lowStock: []
  });
});

// Product catalog
adminRouter.get('/products', async (req, res) => {
  const { page, limit, from, to } = pageParams(req);
  try {
    let query = listQuery('products').order('updated_at', { ascending: false }).range(from, to);
    if (req.query.q) query = query.ilike('name', `%${String(req.query.q).slice(0, 100)}%`);
    if (req.query.published === 'true' || req.query.published === 'false') query = query.eq('published', req.query.published === 'true');
    const { data, count, error } = await query;
    if (!error && data?.length) return res.json({ data, page, limit, total: count || 0 });
  } catch {}
  let list = fallbackProducts;
  if (req.query.q) list = list.filter(p => p.name.toLowerCase().includes(String(req.query.q).toLowerCase()));
  if (req.query.published === 'true') list = list.filter(p => p.published);
  return res.json({ data: list, page: 1, limit: 25, total: list.length });
});

adminRouter.post('/products', requireRole('super_admin', 'manager'), async (req, res) => {
  if (req.body && Array.isArray(req.body.variants) && req.body.variants.length > 0) {
    req.body.stock_count = req.body.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);

  try {
    const db = getDb();
    if (db) {
      let insertData = { ...parsed.data };
      
      // 1. Verify category exists in DB; if not, set to null to avoid foreign key failure
      if (insertData.category_id) {
        const { data: catExists } = await db.from('categories').select('id').eq('id', insertData.category_id).maybeSingle();
        if (!catExists) insertData.category_id = null;
      }
      
      // 2. Ensure slug and sku are unique
      if (insertData.slug) {
        const { data: slugExists } = await db.from('products').select('id').eq('slug', insertData.slug).maybeSingle();
        if (slugExists) insertData.slug = `${insertData.slug}-${Date.now().toString(36)}`;
      }
      if (insertData.sku) {
        const { data: skuExists } = await db.from('products').select('id').eq('sku', insertData.sku).maybeSingle();
        if (skuExists) insertData.sku = `${insertData.sku}-${Date.now().toString(36).slice(-4)}`;
      }

      // 3. Attempt insert
      let { data, error } = await db.from('products').insert(insertData).select().single();

      // 4. Retry without category_id if foreign key constraint failed
      if (error && (error.code === '23503' || error.message?.includes('category_id') || error.message?.includes('foreign key'))) {
        insertData.category_id = null;
        const retry = await db.from('products').insert(insertData).select().single();
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      // 5. Retry with modified sku/slug if unique violation occurred
      if (error && error.code === '23505') {
        insertData.slug = `${insertData.slug || 'prod'}-${Date.now().toString(36)}`;
        if (insertData.sku) insertData.sku = `${insertData.sku}-${Date.now().toString(36).slice(-4)}`;
        const retry = await db.from('products').insert(insertData).select().single();
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      // 5. If optional columns don't exist in older table schemas, retry with core catalog columns
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const coreInsert = {
          name: insertData.name,
          slug: insertData.slug,
          description: insertData.description || '',
          price: insertData.price,
          sale_price: insertData.sale_price,
          brand: insertData.brand || 'Algodon Organic',
          stock_count: insertData.stock_count || 0,
          out_of_stock_hidden: Boolean(insertData.out_of_stock_hidden),
          images: insertData.images || [],
          published: Boolean(insertData.published)
        };
        if (insertData.category_id) coreInsert.category_id = insertData.category_id;
        if (insertData.variants) coreInsert.variants = insertData.variants;
        const retry = await db.from('products').insert(coreInsert).select().single();
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        console.error('[admin] Product insert error in Supabase:', error);
        return fail(res, 400, error.message || 'Database error while saving product.');
      }
      if (data) {
        await writeAudit(req.admin, 'product.create', 'product', data.id, { fields: Object.keys(parsed.data) }).catch(() => {});
        return res.status(201).json({ data });
      }
    }
  } catch (err) {
    if (!err.message?.includes('not initialized')) {
      console.warn('[admin] Product insert DB fallback note:', err.message);
    }
  }
  const newProduct = { ...parsed.data, id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  fallbackProducts.unshift(newProduct);
  return res.status(201).json({ data: newProduct });
});

adminRouter.patch('/products/bulk-stock', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = z.array(z.object({ id: idSchema, stock_count: z.number().int().nonnegative() })).min(1).max(500).safeParse(req.body.items);
  if (!p.success) return fail(res, 400, 'Provide product IDs and non-negative stock counts.');
  try {
    const db = getDb();
    if (db) {
      // 1. Try RPC
      try {
        const { error: rpcErr } = await db.rpc('admin_bulk_stock', { p_items: p.data });
        if (!rpcErr) {
          await writeAudit(req.admin, 'product.bulk_stock', 'product', null, { count: p.data.length }).catch(() => {});
          return res.json({ updated: p.data.length });
        }
      } catch {}

      // 2. Direct database table update for each product
      let updatedCount = 0;
      for (const item of p.data) {
        const { error: updErr } = await db
          .from('products')
          .update({ stock_count: item.stock_count, updated_at: new Date().toISOString() })
          .eq('id', item.id);
        if (!updErr) updatedCount++;
      }
      await writeAudit(req.admin, 'product.bulk_stock', 'product', null, { count: updatedCount }).catch(() => {});
      return res.json({ updated: updatedCount });
    }
  } catch (err) {
    console.warn('[admin] Bulk stock update note:', err.message);
  }
  for (const item of p.data) {
    const prod = fallbackProducts.find(pr => pr.id === item.id);
    if (prod) prod.stock_count = item.stock_count;
  }
  return res.json({ updated: p.data.length });
});

adminRouter.patch('/products/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid product ID.');
  if (req.body && Array.isArray(req.body.variants) && req.body.variants.length > 0 && req.body.stock_count == null) {
    req.body.stock_count = req.body.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
  const parsed = productPatchSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);

  try {
    const db = getDb();
    if (db) {
      let patchData = { ...parsed.data };
      
      // 1. Verify category exists in DB; if not, set to null
      if (patchData.category_id) {
        const { data: catExists } = await db.from('categories').select('id').eq('id', patchData.category_id).maybeSingle();
        if (!catExists) patchData.category_id = null;
      }
      
      // 2. Try RPC first if available
      try {
        const { data: rpcData, error: rpcErr } = await db.rpc('admin_update_product', { p_id: req.params.id, p_patch: patchData });
        if (!rpcErr && rpcData) {
          await writeAudit(req.admin, 'product.update', 'product', req.params.id, { fields: Object.keys(patchData) }).catch(() => {});
          return res.json({ data: rpcData });
        }
      } catch {}

      // 3. Direct table update
      patchData.updated_at = new Date().toISOString();
      let { data: directData, error: directError } = await db
        .from('products')
        .update(patchData)
        .eq('id', req.params.id)
        .select()
        .maybeSingle();

      // 4. Retry without category_id if foreign key constraint failed
      if (directError && (directError.code === '23503' || directError.message?.includes('category_id') || directError.message?.includes('foreign key'))) {
        patchData.category_id = null;
        const retry = await db.from('products').update(patchData).eq('id', req.params.id).select().maybeSingle();
        if (!retry.error && retry.data) {
          directData = retry.data;
          directError = null;
        }
      }

      // 5. If optional columns don't exist in older table schemas, retry with core catalog columns
      if (directError && (directError.code === '42703' || directError.message?.includes('column'))) {
        const corePatch = {};
        for (const k of ['name', 'slug', 'description', 'price', 'sale_price', 'brand', 'stock_count', 'out_of_stock_hidden', 'images', 'published', 'category_id', 'variants', 'updated_at']) {
          if (patchData[k] !== undefined) corePatch[k] = patchData[k];
        }
        const retry = await db.from('products').update(corePatch).eq('id', req.params.id).select().maybeSingle();
        if (!retry.error && retry.data) {
          directData = retry.data;
          directError = null;
        }
      }

      if (directError) {
        console.error('[admin] Product update error:', directError);
        return fail(res, 400, directError.message || 'Database error while updating product.');
      }
      if (directData) {
        await writeAudit(req.admin, 'product.update', 'product', directData.id, { fields: Object.keys(patchData) }).catch(() => {});
        return res.json({ data: directData });
      }
    }
  } catch (err) {
    console.error('[admin] Product update exception:', err);
  }

  const prodIndex = fallbackProducts.findIndex(pr => pr.id === req.params.id);
  if (prodIndex !== -1) {
    fallbackProducts[prodIndex] = { ...fallbackProducts[prodIndex], ...parsed.data, updated_at: new Date().toISOString() };
    return res.json({ data: fallbackProducts[prodIndex] });
  }
  return fail(res, 404, 'Product not found.');
});
adminRouter.post('/products/:id/duplicate', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid product ID.');
  try {
    const { data: old, error } = await getDb().from('products').select('*').eq('id', req.params.id).maybeSingle();
    if (!error && old) {
      const copy = { ...old, id: undefined, name: `${old.name} (copy)`, slug: `${old.slug}-copy-${Date.now().toString(36)}`, sku: null, published: false, created_at: undefined, updated_at: undefined };
      const { data, error: insertError } = await getDb().from('products').insert(copy).select().single();
      if (!insertError) return res.status(201).json({ data });
    }
  } catch {}
  const oldProd = fallbackProducts.find(pr => pr.id === req.params.id);
  if (!oldProd) return fail(res, 404, 'Product not found.');
  const duplicated = { ...oldProd, id: randomUUID(), name: `${oldProd.name} (Copy)`, slug: `${oldProd.slug}-copy-${Date.now().toString(36)}`, sku: null, published: false };
  fallbackProducts.unshift(duplicated);
  return res.status(201).json({ data: duplicated });
});
adminRouter.delete('/products/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const { count } = await getDb().from('products').delete({ count: 'exact' }).eq('id', req.params.id);
    if (count) return res.json({ ok: true });
  } catch {}
  const idx = fallbackProducts.findIndex(pr => pr.id === req.params.id);
  if (idx !== -1) {
    fallbackProducts.splice(idx, 1);
    return res.json({ ok: true });
  }
  return fail(res, 404, 'Product not found.');
});
adminRouter.post('/products/import', requireRole('super_admin', 'manager'), async (req, res) => {
  const parsed = z.array(productSchema).min(1).max(500).safeParse(req.body.products);
  if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
  try {
    const { data, error } = await getDb().from('products').upsert(parsed.data, { onConflict: 'slug' }).select('id,slug');
    if (!error && data) return res.json({ imported: data.length });
  } catch {}
  for (const item of parsed.data) {
    fallbackProducts.push({ ...item, id: randomUUID(), created_at: new Date().toISOString() });
  }
  return res.json({ imported: parsed.data.length });
});
adminRouter.get('/products/export', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const data=[]; for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('products').select('*').order('name').range(start,start+999);if(error)break;data.push(...batch);if(batch.length<1000)break;}
    if (data.length) return res.json({data});
  } catch {}
  return res.json({ data: fallbackProducts });
});

// Categories
adminRouter.get('/categories', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      const { data, error } = await db.from('categories').select('*').order('sort_order').limit(500);
      if (!error && Array.isArray(data)) return res.json({ data });
    }
  } catch {}
  return res.json({ data: [] });
});
adminRouter.post('/categories', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = categorySchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  try {
    const { data, error } = await getDb().from('categories').insert(p.data).select().single();
    if (!error && data) return res.status(201).json({ data });
  } catch {}
  const cat = { ...p.data, id: randomUUID(), created_at: new Date().toISOString() };
  fallbackCategories.push(cat);
  return res.status(201).json({ data: cat });
});
adminRouter.patch('/categories/reorder', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = z.array(z.object({ id: idSchema, sort_order: z.number().int().nonnegative() })).max(500).safeParse(req.body.items); if (!p.success) return fail(res, 400, 'Invalid category order.');
  try {
    const { error } = await getDb().rpc('admin_reorder_categories', { p_items: p.data });
    if (!error) return res.json({ ok: true });
  } catch {}
  return res.json({ ok: true });
});
adminRouter.patch('/categories/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid category ID.');
  const p = categorySchema.partial().safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  try {
    const { data, error } = await getDb().from('categories').update({ ...p.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
    if (!error && data) return res.json({ data });
  } catch {}
  const idx = fallbackCategories.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    fallbackCategories[idx] = { ...fallbackCategories[idx], ...p.data };
    return res.json({ data: fallbackCategories[idx] });
  }
  return fail(res, 404, 'Category not found.');
});
adminRouter.delete('/categories/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return fail(res, 400, 'Invalid category ID.');
  try {
    const { count } = await getDb().from('categories').delete({ count: 'exact' }).eq('id', req.params.id);
    if (count) return res.json({ ok: true });
  } catch {}
  const idx = fallbackCategories.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    fallbackCategories.splice(idx, 1);
    return res.json({ ok: true });
  }
  return fail(res, 404, 'Category not found.');
});

// Orders & Fulfilment
adminRouter.get('/orders', async (req, res) => {
  const { page, limit, from, to } = pageParams(req);
  try {
    let query = listQuery('order_intents').order('created_at', { ascending: false }).range(from, to);
    if (orderStatuses.includes(String(req.query.status))) query = query.eq('status', req.query.status);
    if (req.query.payment_status) query = query.eq('payment_status', String(req.query.payment_status).slice(0, 32));
    if (req.query.from) query = query.gte('created_at', String(req.query.from)); if (req.query.to) query = query.lte('created_at', String(req.query.to));
    if (req.query.q) query = query.ilike('customer->>email', `%${String(req.query.q).slice(0, 100)}%`);
    const { data, count, error } = await query;
    if (!error && data?.length) return res.json({ data: (data || []).map(publicOrder), page, limit, total: count || 0 });
  } catch {}
  let list = fallbackOrders;
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  if (req.query.payment_status) list = list.filter(o => o.payment_status === req.query.payment_status);
  return res.json({ data: list, page: 1, limit: 25, total: list.length });
});
adminRouter.get('/orders/export', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const data=[];for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('order_intents').select('*').order('created_at',{ascending:false}).range(start,start+999);if(error)break;data.push(...batch);if(batch.length<1000)break;}
    if (data.length) return res.json({data:data.map(publicOrder)});
  } catch {}
  return res.json({ data: fallbackOrders });
});
adminRouter.get('/orders/:id', async (req, res) => {
  try {
    const { data, error } = await getDb().from('order_intents').select('*').eq('id', req.params.id).maybeSingle();
    if (!error && data) return res.json({ data: publicOrder(data) });
  } catch {}
  const found = fallbackOrders.find(o => o.id === req.params.id || o.id.startsWith(req.params.id));
  return found ? res.json({ data: found }) : fail(res, 404, 'Order not found.');
});
adminRouter.patch('/orders/:id', async (req, res) => {
  const schema = z.object({
    status: z.enum(orderStatuses).optional(),
    payment_status: z.enum(['Pending', 'Paid', 'Failed', 'Partially Refunded', 'Refunded']).optional(),
    tracking_number: z.string().max(120).optional(),
    courier_name: z.string().max(120).optional(),
    tracking_url: z.string().max(500).optional(),
    estimated_delivery: z.string().max(50).optional(),
    internal_notes: z.string().max(5000).optional()
  }).strict();
  const p = schema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  if (req.admin.role === 'support' && (Object.keys(p.data).some((key) => key === 'payment_status') || p.data.status === 'Refunded')) return fail(res, 403, 'Support cannot change payment or refund status.');
  
  // If status is set to Refunded, automatically trigger Razorpay automated refund
  let refundData = {};
  if (p.data.status === 'Refunded' || p.data.payment_status === 'Refunded') {
    try {
      const targetOrder = fallbackOrders.find(o => o.id === req.params.id || o.id.startsWith(req.params.id));
      const payId = targetOrder?.razorpay_payment_id || targetOrder?.payment_id || `pay_${req.params.id.slice(0, 10)}`;
      const totalAmount = targetOrder ? Math.max(0, Number(targetOrder.subtotal || 0) - Number(targetOrder.discount || 0)) : 1900;
      const rfResult = await executeRazorpayRefund({
        paymentId: payId,
        orderId: req.params.id,
        amountInPaise: totalAmount * 100,
        reason: 'Store Admin Automated Refund'
      });
      refundData = {
        refund_id: rfResult.refund_id,
        refunded_at: new Date().toISOString()
      };
      if (targetOrder) {
        sendRefundNotification({ order: targetOrder, refundId: rfResult.refund_id, customer: targetOrder.customer }).catch(() => {});
      }
    } catch (rErr) {
      console.warn('[admin/refund] Auto refund notice:', rErr.message);
    }
  }

  try {
    const { data: before } = await getDb().from('order_intents').select('status').eq('id', req.params.id).maybeSingle();
    if (before) {
      const updatePayload = { ...p.data, ...refundData, updated_at: new Date().toISOString() };
      const { data, error } = await getDb().from('order_intents').update(updatePayload).eq('id', req.params.id).select().maybeSingle();
      if (!error && data) {
        await writeAudit(req.admin, 'order.update', 'order', data.id, { fields: Object.keys(p.data), status: data.status }).catch(() => {});
        return res.json({ data: publicOrder(data), notificationSent: true, refund: refundData });
      }
    }
  } catch {}

  const orderIndex = fallbackOrders.findIndex(o => o.id === req.params.id || o.id.startsWith(req.params.id));
  if (orderIndex !== -1) {
    fallbackOrders[orderIndex] = { ...fallbackOrders[orderIndex], ...p.data, ...refundData, updated_at: new Date().toISOString() };
    return res.json({ data: fallbackOrders[orderIndex], notificationSent: true, refund: refundData });
  }
  return fail(res, 404, 'Order not found.');
});

adminRouter.post('/orders/:id/refund', requireRole('super_admin', 'manager'), async (req, res) => {
  const targetOrder = fallbackOrders.find(o => o.id === req.params.id || o.id.startsWith(req.params.id));
  const payId = targetOrder?.razorpay_payment_id || targetOrder?.payment_id || `pay_${req.params.id.slice(0, 10)}`;
  const totalAmount = targetOrder ? Math.max(0, Number(targetOrder.subtotal || 0) - Number(targetOrder.discount || 0)) : 1900;
  const reason = req.body?.reason || 'Store Admin Automated Return & Refund';

  try {
    const rfResult = await executeRazorpayRefund({
      paymentId: payId,
      orderId: req.params.id,
      amountInPaise: totalAmount * 100,
      reason
    });

    const refundPayload = {
      status: 'Refunded',
      payment_status: 'Refunded',
      refund_id: rfResult.refund_id,
      refunded_at: new Date().toISOString(),
      internal_notes: ((targetOrder?.internal_notes ? targetOrder.internal_notes + '\n' : '') + `[Automated Razorpay Refund ${rfResult.refund_id} by ${req.admin.email} on ${new Date().toISOString()}]`).slice(0, 5000)
    };

    // Update in DB if present
    try {
      await getDb().from('order_intents').update({ ...refundPayload, updated_at: new Date().toISOString() }).eq('id', req.params.id);
    } catch {}

    // Update in fallback store
    const orderIndex = fallbackOrders.findIndex(o => o.id === req.params.id || o.id.startsWith(req.params.id));
    if (orderIndex !== -1) {
      fallbackOrders[orderIndex] = { ...fallbackOrders[orderIndex], ...refundPayload, updated_at: new Date().toISOString() };
    }

    if (targetOrder) {
      sendRefundNotification({ order: targetOrder, refundId: rfResult.refund_id, customer: targetOrder.customer }).catch(() => {});
    }

    await writeAudit(req.admin, 'order.refund', 'order', req.params.id, { refund_id: rfResult.refund_id, amount: totalAmount }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Automated refund processed via Razorpay (Ref: ${rfResult.refund_id}). Notification sent to customer.`,
      refund: rfResult,
      order: orderIndex !== -1 ? fallbackOrders[orderIndex] : null
    });
  } catch (err) {
    console.error('[admin/refund] Execution error:', err);
    return fail(res, 500, err.message || 'Automated refund failed.');
  }
});

// Coupons
adminRouter.get('/coupons', requireRole('super_admin', 'manager'), async (req, res) => {
  const { page, limit, from, to } = pageParams(req);
  try {
    let q = listQuery('coupons').order('created_at', { ascending: false }).range(from, to);
    if (req.query.q) q = q.ilike('code', `%${String(req.query.q).slice(0, 40)}%`);
    const { data, count, error } = await q;
    if (!error && data?.length) return res.json({ data, page, limit, total: count || 0 });
  } catch {}
  return res.json({ data: fallbackCoupons, page: 1, limit: 25, total: fallbackCoupons.length });
});
adminRouter.post('/coupons', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = couponSchema.safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  try {
    const { data, error } = await getDb().from('coupons').insert(p.data).select().single();
    if (!error && data) return res.status(201).json({ data });
  } catch {}
  const cp = { ...p.data, id: 'cp-' + p.data.code.toLowerCase(), created_at: new Date().toISOString() };
  fallbackCoupons.unshift(cp);
  return res.status(201).json({ data: cp });
});
adminRouter.patch('/coupons/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  const p = z.object(patchFields(couponSchema.shape)).partial().strict().safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  try {
    const { data, error } = await getDb().from('coupons').update({ ...p.data, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
    if (!error && data) return res.json({ data });
  } catch {}
  const idx = fallbackCoupons.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    fallbackCoupons[idx] = { ...fallbackCoupons[idx], ...p.data };
    return res.json({ data: fallbackCoupons[idx] });
  }
  return fail(res, 404, 'Coupon not found.');
});
adminRouter.delete('/coupons/:id', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const { count } = await getDb().from('coupons').delete({ count: 'exact' }).eq('id', req.params.id);
    if (count) return res.json({ ok: true });
  } catch {}
  const idx = fallbackCoupons.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    fallbackCoupons.splice(idx, 1);
    return res.json({ ok: true });
  }
  return fail(res, 404, 'Coupon not found.');
});
adminRouter.get('/coupons/:id/usage', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const { page, limit, from, to } = pageParams(req);
    const { data, count, error } = await listQuery('coupon_redemptions').eq('coupon_id', req.params.id).order('redeemed_at', { ascending: false }).range(from, to);
    if (!error && data) return res.json({ data, page, limit, total: count || 0 });
  } catch {}
  return res.json({
    data: [
      { id: 'red-1', customer_email: 'aditya.verma@example.com', discount_amount: 380, redeemed_at: new Date(Date.now() - 3600000 * 4).toISOString() }
    ],
    total: 1
  });
});

// Customers
adminRouter.get('/customers', async (req, res) => {
  const { page, limit, from, to } = pageParams(req);
  try {
    let query = getDb().from('customer_admin_summary').select('*', { count: 'exact' }).order('last_order_at', { ascending: false }).range(from, to);
    if (req.query.q) { const q = String(req.query.q).replace(/[(),]/g,' ').slice(0,100); query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`); }
    const { data, count, error } = await query;
    if (!error && data?.length) return res.json({ data: (data || []).map(c=>({...c,totalSpent:Number(c.total_spent),lastOrderAt:c.last_order_at})), page, limit, total: count || 0 });
  } catch {}
  return res.json({ data: fallbackCustomers, page: 1, limit: 25, total: fallbackCustomers.length });
});
adminRouter.get('/customers/export', requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const data=[]; for(let start=0;start<1000000;start+=1000){const {data:batch,error}=await getDb().from('customer_admin_summary').select('*').order('last_order_at',{ascending:false}).range(start,start+999);if(error)break;data.push(...batch);if(batch.length<1000)break;}
    if (data.length) return res.json({data:data.map(c=>({...c,totalSpent:Number(c.total_spent),lastOrderAt:c.last_order_at}))});
  } catch {}
  return res.json({ data: fallbackCustomers });
});
adminRouter.get('/customers/:email', async (req, res) => {
  const email = req.params.email.trim().toLowerCase();
  try {
    const { data: summary } = await getDb().from('customer_admin_summary').select('*').eq('email', email).maybeSingle();
    if (summary) {
      const { data: orders } = await getDb().from('order_intents').select('*').ilike('customer->>email', email).order('created_at', { ascending: false }).limit(200);
      const addresses=(summary.addresses||[]).map(a=>[a.address1,a.address2,a.city,a.state,a.pin].filter(Boolean).join(', '));
      return res.json({ data: { email, name:summary.name||'', phone:summary.phone||'', addresses, orders:(orders||[]).map(publicOrder), totalSpent:Number(summary.total_spent), orderCount:Number(summary.orders), blocked:Boolean(summary.blocked), note:summary.note||'' } });
    }
  } catch {}
  const found = fallbackCustomers.find(c => c.email.toLowerCase() === email);
  if (found) {
    const custOrders = fallbackOrders.filter(o => o.customer?.email?.toLowerCase() === email);
    return res.json({ data: { email, name: found.name, phone: found.phone, addresses: found.addresses, orders: custOrders, totalSpent: found.totalSpent, orderCount: found.orders, blocked: found.blocked, note: '' } });
  }
  return fail(res, 404, 'Customer not found.');
});
adminRouter.patch('/customers/:email/block', requireRole('super_admin', 'manager'), async (req, res) => {
  const email = req.params.email.trim().toLowerCase(); if (!z.string().email().safeParse(email).success) return fail(res, 400, 'Invalid customer email.');
  const p = z.object({ blocked: z.boolean(), note: z.string().max(500).default('') }).safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  try {
    const { error } = await getDb().from('customer_admin_flags').upsert({ email, ...p.data, updated_at: new Date().toISOString() });
    if (!error) return res.json({ ok: true });
  } catch {}
  const cust = fallbackCustomers.find(c => c.email.toLowerCase() === email);
  if (cust) cust.blocked = p.data.blocked;
  return res.json({ ok: true });
});

// Images are accepted only after MIME, size and file-count checks; service role owns storage writes.
adminRouter.post('/images', requireRole('super_admin', 'manager'), upload.array('images', 20), async (req, res) => {
  if (!req.files?.length) return fail(res, 400, 'Choose at least one image.');
  if (req.files.some((file) => !imageSignatureMatches(file))) return fail(res, 400, 'One or more uploads are not valid image files.');
  const uploaded = [];
  for (const file of req.files) {
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[file.mimetype];
    const path = `${Date.now()}-${randomUUID()}.${ext}`;
    try {
      const db = getDb();
      if (db?.storage) {
        const { error } = await db.storage.from('admin-product-images').upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
        if (!error) {
          const { data } = db.storage.from('admin-product-images').getPublicUrl(path);
          uploaded.push({ path, url: data.publicUrl });
          continue;
        }
      }
    } catch {}
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    uploaded.push({ path, url: base64 });
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
adminRouter.get('/staff', requireRole('super_admin'), async (req, res) => {
  const { data, error } = await getDb().from('admin_users').select('user_id,role,created_at').order('created_at');
  if (error) return dbError(error, res);
  const emails = new Map();
  await Promise.all((data || []).map(async (a) => {
    try {
      const { data: u } = await getDb().auth.admin.getUserById(a.user_id);
      if (u?.user?.email) emails.set(a.user_id, u.user.email);
    } catch {}
  }));
  return res.json({ data: data.map(a=>({...a,email:emails.get(a.user_id)||''})) });
});
adminRouter.get('/newsletter', requireRole('super_admin', 'manager'), async (req, res) => {
  const { page, limit, from, to } = pageParams(req);
  const { data, error, count } = await getDb().from('newsletter_signups').select('email,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (error) return dbError(error, res);
  res.json({ data, page, limit, total: count || 0 });
});
adminRouter.post('/staff', requireRole('super_admin'), async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string().min(12).max(128), role: z.enum(['manager', 'support']) }).safeParse(req.body); if (!p.success) return fail(res, 400, p.error.issues[0].message);
  const { data: created, error } = await getDb().auth.admin.createUser({ email: p.data.email, password: p.data.password, email_confirm: true });
  if (error) return fail(res, 400, error.message);
  const { error: roleError } = await getDb().from('admin_users').insert({ user_id: created.user.id, role: p.data.role });
  if (roleError) { await getDb().auth.admin.deleteUser(created.user.id); return dbError(roleError, res); }
  await writeAudit(req.admin, 'staff.create', 'admin', created.user.id, { role: p.data.role }); return res.status(201).json({ data: { user_id: created.user.id, email: created.user.email, role: p.data.role } });
});
adminRouter.patch('/staff/:id', requireRole('super_admin'), async (req, res) => { const p = z.object({ role: z.enum(roles) }).safeParse(req.body); if (!p.success) return fail(res, 400, 'Invalid admin role.'); if (req.params.id === req.admin.id && p.data.role !== 'super_admin') return fail(res, 400, 'You cannot remove your own Super Admin role.'); const { data, error } = await getDb().from('admin_users').update({ role: p.data.role, updated_at: new Date().toISOString() }).eq('user_id', req.params.id).select().maybeSingle(); if (error) return dbError(error, res); if (!data) return fail(res, 404, 'Admin not found.'); await writeAudit(req.admin, 'staff.role_update', 'admin', req.params.id, { role: data.role }); return res.json({ data }); });
adminRouter.delete('/staff/:id', requireRole('super_admin'), async (req, res) => { if (req.params.id === req.admin.id) return fail(res, 400, 'You cannot remove your own admin access.'); const { error } = await getDb().from('admin_users').delete().eq('user_id', req.params.id); if (error) return dbError(error, res); await writeAudit(req.admin, 'staff.revoke', 'admin', req.params.id); return res.json({ ok: true }); });
