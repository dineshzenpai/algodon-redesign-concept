import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { adminRouter } from './admin/routes.js';
import { publicRouter } from './admin/public.js';
import { requireFirebaseAuth, requireFirebaseAdmin } from './firebase/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // disabled for local dev/serving frontend
}));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running' });
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

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

app.get(['/admin', '/admin/'], (req, res) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; '));
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});


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

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
}) : null;

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

app.post('/api/invoice', invoiceLimiter, async (req, res) => {
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

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html for SPA routing (if any)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  } else {
    next();
  }
});

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
