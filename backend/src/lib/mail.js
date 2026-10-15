import nodemailer from 'nodemailer';

// A sample SMTP host alone must not trigger network attempts on every order update.
export function createMailer() {
  if (!process.env.SMTP_HOST) return null;
  const authenticated = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  if (!authenticated && process.env.SMTP_ALLOW_UNAUTHENTICATED !== 'true') return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', connectionTimeout: 10000, socketTimeout: 10000,
    ...(authenticated ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {})
  });
}
