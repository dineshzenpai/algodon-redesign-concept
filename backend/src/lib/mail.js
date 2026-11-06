import nodemailer from 'nodemailer';

// Supports standard SMTP (Gmail, Resend, Brevo) or Resend API key directly.
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
            html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
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

  if (!process.env.SMTP_HOST) return null;
  const authenticated = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  if (!authenticated && process.env.SMTP_ALLOW_UNAUTHENTICATED !== 'true') return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587)),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    ...(authenticated ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {})
  });
}
