import nodemailer from 'nodemailer';

// Supports standard SMTP (Gmail, Brevo, AWS SES, custom SMTP) or Resend API key directly.
export function createMailer() {
  if (process.env.RESEND_API_KEY) {
    return {
      sendMail: async ({ from, to, subject, text, html }) => {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: from || 'Algodon Organic <onboarding@resend.dev>',
            to: Array.isArray(to) ? to : [to],
            subject,
            text,
            html: html || `<p>${String(text || '').replace(/\n/g, '<br>')}</p>`
          })
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.message || `Resend API returned ${resp.status}`);
        }
        return resp.json();
      }
    };
  }

  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const host = (process.env.SMTP_HOST || (user.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : '')).trim();

  if (!host && !process.env.SMTP_SERVICE) return null;

  const authenticated = Boolean(user && pass);
  if (!authenticated && process.env.SMTP_ALLOW_UNAUTHENTICATED !== 'true') return null;

  const isGmail = host === 'smtp.gmail.com' || process.env.SMTP_SERVICE === 'gmail';
  const port = Number(process.env.SMTP_PORT || (isGmail ? 465 : (process.env.SMTP_SECURE === 'true' ? 465 : 587)));
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (isGmail && !process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    ...(authenticated ? { auth: { user, pass } } : {})
  });
}
