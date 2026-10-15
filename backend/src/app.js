import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { checkDatabase } from './config/db.js';
import { authRouter } from './customer/auth.js';
import { accountRouter } from './customer/routes.js';
import { createMailer } from './lib/mail.js';
import { adminRouter } from './admin/routes.js';
import { publicRouter } from './admin/public.js';
import { requireAdmin, requireAdminCsrf } from './admin/auth.js';
import { requireFirebaseAuth, requireFirebaseAdmin } from './firebase/admin.js';


const app = express();
if (process.env.RENDER === 'true') app.set('trust proxy', 1);

const allowedOrigins = new Set(env.allowedOrigins);

// Global Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://www.gstatic.com', 'https://apis.google.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
      connectSrc: ["'self'", ...(env.supabase.url ? [env.supabase.url, env.supabase.url.replace(/^https:/, 'wss:')] : []), 'https://*.googleapis.com', 'https://*.firebaseio.com', 'wss://*.firebaseio.com'],
      frameSrc: ['https://*.firebaseapp.com', 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: env.nodeEnv === 'production' ? [] : null
    }
  },
  strictTransportSecurity: env.nodeEnv === 'production' ? undefined : false
}));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  return next();
});
app.use(cors({
  origin: (origin, callback) => callback(null, origin && allowedOrigins.has(origin) ? origin : false),
  credentials: true
}));
app.use('/api/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (req.body == null) req.body = {};
    if (Array.isArray(req.body) || typeof req.body !== 'object') return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  next();
});
app.use(cookieParser());
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// API Routes
app.get('/js/config.js', (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-store').send(`window.APP_CONFIG = ${JSON.stringify({ SUPABASE_URL: env.supabase.url, SUPABASE_PUBLISHABLE_KEY: env.supabase.anonKey, FIREBASE_ENABLED: Boolean(env.firebase.projectId && !env.firebase.projectId.startsWith('your_')) }).replace(/</g, '\\u003c')};`);
});
app.get('/api/config', (req, res) => res.json({
  supabase: { url: env.supabase.url, publishableKey: env.supabase.anonKey },
  checkout: { paymentsEnabled: false },
  firebaseEnabled: Boolean(env.firebase.projectId && !env.firebase.projectId.startsWith('your_'))
}));
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running' });
});

app.get('/api/health/ready', async (req, res) => {
  const connected = await checkDatabase();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ready' : 'unavailable',
    database: connected ? 'connected' : 'unavailable'
  });
});

// Firebase web keys are public by design. Only the six browser config values
// leave the server; service account credentials stay in firebase-admin.
app.get('/api/firebase-config', (req, res) => {
  const f = env.firebase;
  const config = [
    ['FIREBASE_API_KEY', f.apiKey],
    ['FIREBASE_AUTH_DOMAIN', f.authDomain],
    ['FIREBASE_PROJECT_ID', f.projectId],
    ['FIREBASE_STORAGE_BUCKET', f.storageBucket],
    ['FIREBASE_MESSAGING_SENDER_ID', f.messagingSenderId],
    ['FIREBASE_APP_ID', f.appId]
  ];
  const missing = config.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) return res.status(503).json({ error: 'Firebase web app configuration is incomplete.', missing });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ apiKey: f.apiKey, authDomain: f.authDomain, projectId: f.projectId,
    storageBucket: f.storageBucket, messagingSenderId: f.messagingSenderId, appId: f.appId });
});

// A claim-protected namespace is available to Firebase-authenticated admin
// APIs. The established /api/admin cookie flow stays intact for the current panel.
app.get('/api/firebase-admin/whoami', requireFirebaseAuth, requireFirebaseAdmin, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email, admin: true });
});

app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

import nodemailer from 'nodemailer';
import { z } from 'zod';

const invoiceRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  invoiceNo: z.string().min(1).max(50),
  subtotal: z.number().nonnegative(),
  cart: z.array(z.object({
    name: z.string().min(1).max(200),
    size: z.string().min(1).max(20),
    qty: z.number().int().positive().max(100),
    price: z.number().nonnegative()
  })).min(1).max(50)
});

const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const transporter = createMailer();

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// The preview accepts caller-supplied recipients and totals: restrict it to staff.
app.post('/api/invoice', invoiceLimiter, (req, res) => {
  res.status(410).json({ error: 'Public invoice emailing is disabled. Contact the store for an invoice.' });
});
app.post('/api/admin/invoice', invoiceLimiter, requireAdminCsrf, requireAdmin, async (req, res) => {
    const parsed = invoiceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid invoice request' });
    }
    try {
        if (!transporter) return res.status(503).json({ error: 'Invoice email is not configured.' });
        const { email, name, invoiceNo, subtotal, cart } = parsed.data;

        let itemsHtml = cart.map(item => `<li>${escapeHtml(item.name)} (Size: ${escapeHtml(item.size)}) x${item.qty} - Rs. ${(item.qty * item.price).toLocaleString('en-IN')}</li>`).join('');
        
        let mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@algodonorganic.com',
            to: email,
            subject: `Invoice ${invoiceNo} from Algodon Organic`,
            html: `<div style="font-family: sans-serif; color: #362e26;">
                <h2>Hello ${escapeHtml(name)},</h2>
                <p>Thank you for your order!</p>
                <h3>Order Details (Invoice: ${escapeHtml(invoiceNo)})</h3>
                <ul>${itemsHtml}</ul>
                <p><strong>Total: Rs. ${subtotal.toLocaleString('en-IN')}</strong> (Free Shipping)</p>
                <p style="color: #8a7c6c; font-size: 0.8rem; margin-top: 20px;">This is a concept preview invoice.</p>
            </div>`
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
        res.json({ success: true, previewUrl: nodemailer.getTestMessageUrl(info) });
    } catch (err) {
        console.error('SMTP Error:', err);
        res.status(500).json({ error: 'Failed to send invoice email' });
    }
});

// The React frontend is hosted separately on Vercel (Vite during development).
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.get('/', (req, res) => res.json({ status: 'API is running', frontend: env.clientUrl }));
app.use((req, res) => res.status(404).json({ error:'Endpoint not found.' }));

// Global Error Handler
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') return res.status(400).json({ error: 'Image upload must be under 10 MB with no more than 8 files.' });
  if (err && err.message === 'Upload a JPEG, PNG, WebP, or AVIF image.') return res.status(400).json({ error: err.message });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  console.error('[app] Error:', err && err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
