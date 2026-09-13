import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // disabled for local dev/serving frontend
}));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());
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

// Generate Ethereal test account for SMTP (For concept/dev use)
let transporter;
nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return process.exit(1);
    }
    transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass
        }
    });
});

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
        const { email, name, invoiceNo, subtotal, cart } = parsed.data;

        let itemsHtml = cart.map(item => `<li>${escapeHtml(item.name)} (Size: ${escapeHtml(item.size)}) x${item.qty} - Rs. ${(item.qty * item.price).toLocaleString('en-IN')}</li>`).join('');
        
        let mailOptions = {
            from: '"Algodon Organic" <orders@algodonorganic.com>',
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
  console.error('[app] Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
