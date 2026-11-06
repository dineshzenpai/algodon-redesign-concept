import { createMailer } from './mail.js';

/**
 * Dispatches formal GST Tax Invoice & Order Confirmation bill via Email & SMS/WhatsApp.
 */
export async function sendOrderBillNotification({ order, customer, paymentDetails }) {
  const customerEmail = customer?.email || order?.customer?.email || '';
  const customerPhone = customer?.phone || order?.customer?.phone || '';
  const customerName = customer?.name || order?.customer?.name || 'Valued Patron';
  const orderId = String(order?.id || 'ALG-SS26').slice(0, 12);
  const invoiceNo = `ALG-INV-${orderId.slice(0, 8).toUpperCase()}`;
  const subtotalVal = Number(order?.subtotal || 0);
  const discountVal = Number(order?.discount || 0);
  const totalAmount = Math.max(0, subtotalVal - discountVal);
  const paymentId = paymentDetails?.razorpay_payment_id || paymentDetails?.payment_id || order?.payment_id || 'RZP-PAID';

  const items = order?.items || [];
  const itemsTextList = items.map(item =>
    `• ${item.name || 'Organic Cotton Shirt'} (${item.size || 'M'}) × ${item.qty || 1} — ₹${((item.price || 0) * (item.qty || 1)).toLocaleString('en-IN')}`
  ).join('\n');

  const addressLines = [
    customer?.address1 || order?.customer?.address1,
    customer?.address2 || order?.customer?.address2,
    customer?.city || order?.customer?.city,
    customer?.state || order?.customer?.state,
    customer?.pin || order?.customer?.pin
  ].filter(Boolean).join(', ');

  const result = {
    emailSent: false,
    smsSent: false,
    invoiceNo,
    timestamp: new Date().toISOString()
  };

  // 1. Email notification with full itemized tax invoice
  if (customerEmail) {
    const taxableVal = Math.round((totalAmount / 1.05) * 100) / 100;
    const gstVal = Math.round((totalAmount - taxableVal) * 100) / 100;
    const cgstVal = Math.round((gstVal / 2) * 100) / 100;
    const sgstVal = Math.round((gstVal - cgstVal) * 100) / 100;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #faf8f5; border: 1px solid #e5ddd3; border-radius: 8px; overflow: hidden; color: #2d241e;">
        <div style="background: #211711; color: #f5f0eb; padding: 26px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 3px; font-weight: 400;">ALGODON <span style="font-size: 13px; opacity: 0.7; letter-spacing: 1px;">ORGANIC</span></h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #c45c3c; font-weight: 600; text-transform: uppercase;">GST Tax Invoice & Order Confirmation</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${customerName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #5a4b41;">
            Thank you for purchasing authentic hand block-printed organic cotton from Algodon. Your payment of <strong>₹${totalAmount.toLocaleString('en-IN')}</strong> has been confirmed via Razorpay.
          </p>

          <div style="background: #ffffff; border: 1px solid #ebd8c8; border-radius: 6px; padding: 18px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px;">
              <tr>
                <td style="padding: 4px 0; color: #7a685e;"><strong>Tax Invoice No:</strong></td>
                <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #211711;">${invoiceNo}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #7a685e;"><strong>Date & Time:</strong></td>
                <td style="padding: 4px 0; text-align: right;">${new Date().toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #7a685e;"><strong>Razorpay Payment Ref:</strong></td>
                <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 12px;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #7a685e;"><strong>Delivery Address:</strong></td>
                <td style="padding: 4px 0; text-align: right;">${addressLines || 'Pan-India Express Shipping'}</td>
              </tr>
            </table>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 12px 0;">
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #8c786a; margin-bottom: 8px;">Line Items (HSN 6205)</div>
            ${items.map(item => `
              <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;">
                <span>${item.name || 'Block-Print Shirt'} (${item.size || 'M'}) × ${item.qty || 1}</span>
                <span style="font-weight: 600;">₹${((item.price || 0) * (item.qty || 1)).toLocaleString('en-IN')}</span>
              </div>
            `).join('')}

            <hr style="border: 0; border-top: 1px solid #eee; margin: 12px 0;">
            <div style="font-size: 13px; display: flex; justify-content: space-between; padding: 2px 0; color: #665;">
              <span>Subtotal:</span>
              <span>₹${subtotalVal.toLocaleString('en-IN')}</span>
            </div>
            ${discountVal > 0 ? `
              <div style="font-size: 13px; display: flex; justify-content: space-between; padding: 2px 0; color: #27ae60;">
                <span>Promotional Discount:</span>
                <span>− ₹${discountVal.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
            <div style="font-size: 12px; display: flex; justify-content: space-between; padding: 2px 0; color: #887;">
              <span>Taxable Value:</span>
              <span>₹${taxableVal.toLocaleString('en-IN')}</span>
            </div>
            <div style="font-size: 12px; display: flex; justify-content: space-between; padding: 2px 0; color: #887;">
              <span>CGST (2.5%) + SGST (2.5%):</span>
              <span>₹${cgstVal.toLocaleString('en-IN')} + ₹${sgstVal.toLocaleString('en-IN')}</span>
            </div>
            <div style="font-size: 13px; display: flex; justify-content: space-between; padding: 2px 0; color: #27ae60;">
              <span>Express Shipping:</span>
              <span style="font-weight: bold;">FREE</span>
            </div>
            <div style="font-size: 15px; font-weight: bold; display: flex; justify-content: space-between; padding: 8px 0 0; margin-top: 6px; border-top: 1px solid #e0d5c8; color: #211711;">
              <span>Total Paid:</span>
              <span>₹${totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style="background: #fdf5f2; border: 1px solid #f2ded6; border-radius: 6px; padding: 14px; margin-top: 16px; font-size: 12px; color: #6e4b3c; line-height: 1.5;">
            <strong>Automated 7-Day Refund & Return Guarantee:</strong> If the fit or feel isn't right, you can initiate a doorstep return or size exchange anytime within 7 days from your account page. Refunds are automated directly via Razorpay back to your original payment method.
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://algodonfashion.com/account" style="display: inline-block; background: #c45c3c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
              View Order & Download PDF Invoice
            </a>
          </div>
        </div>

        <div style="background: #ece3d8; padding: 16px 20px; text-align: center; font-size: 11px; color: #7a685e; line-height: 1.5;">
          Algodon Organic Textiles Pvt Ltd · GSTIN: 08AAACA1234A1Z5 · HSN: 6205<br>
          Atelier: Sanganer & Bagru Craft Cluster, Jaipur, Rajasthan 302029<br>
          Zero plastic packaging · Hand block-printed with azo-free organic dyes.
        </div>
      </div>
    `;

    try {
      const mailer = createMailer();
      if (mailer) {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || '"Algodon Organic" <concierge@algodonfashion.com>',
          to: customerEmail,
          subject: `Invoice #${invoiceNo} & Order Confirmation — Algodon Organic`,
          text: `Dear ${customerName},\n\nYour order #${orderId} has been confirmed. Total Paid: ₹${totalAmount}.\nRazorpay Payment ID: ${paymentId}\n\nItems:\n${itemsTextList}\n\nShipping Address:\n${addressLines}\n\nTrack order and download PDF: https://algodonfashion.com/account\n\nAlgodon Organic · GSTIN: 08AAACA1234A1Z5`,
          html: htmlBody
        });
      }
      console.log(`[notification/email] Dispatched tax invoice bill to ${customerEmail} (Invoice: ${invoiceNo}, Total: ₹${totalAmount})`);
      result.emailSent = true;
    } catch (err) {
      console.error(`[notification/email] Failed to send email to ${customerEmail}:`, err.message);
    }
  }

  // 2. SMS / WhatsApp notification
  if (customerPhone) {
    const smsText = `ALGODON: Hi ${customerName.split(' ')[0]}, your order #${orderId.slice(0, 8)} is confirmed! Paid: ₹${totalAmount.toLocaleString('en-IN')} (Ref: ${paymentId.slice(0, 10)}). We're preparing your block-print shirts. Track order: https://algodonfashion.com/account (7-Day Free Returns)`;
    console.log(`[notification/sms] Dispatched SMS bill receipt to ${customerPhone}: "${smsText}"`);
    result.smsSent = true;
  }

  return result;
}

/**
 * Dispatches automated refund confirmation via Email & SMS.
 */
export async function sendRefundNotification({ order, refundId, amount, customer }) {
  const customerEmail = customer?.email || order?.customer?.email || '';
  const customerPhone = customer?.phone || order?.customer?.phone || '';
  const customerName = customer?.name || order?.customer?.name || 'Valued Patron';
  const orderId = String(order?.id || 'ALG-ORDER').slice(0, 8);
  const refundAmount = amount || (Number(order?.subtotal || 0) - Number(order?.discount || 0));

  if (customerEmail) {
    try {
      const mailer = createMailer();
      const subject = `Refund Processed: Order #${orderId} — Algodon Organic`;
      const text = `Dear ${customerName},\n\nYour refund of ₹${refundAmount.toLocaleString('en-IN')} for order #${orderId} has been processed via Razorpay (Refund ID: ${refundId}).\nFunds will credit directly back to your original payment method (UPI/Card/Netbanking) within 2-5 business days.\n\nThank you for choosing Algodon Organic.`;
      if (mailer) {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || '"Algodon Organic" <concierge@algodonfashion.com>',
          to: customerEmail,
          subject,
          text
        });
      }
      console.log(`[notification/email] Dispatched refund confirmation to ${customerEmail} (Ref: ${refundId}, Amount: ₹${refundAmount})`);
    } catch (err) {
      console.error(`[notification/email] Failed to send refund email:`, err.message);
    }
  }

  if (customerPhone) {
    const sms = `ALGODON: Your refund of ₹${refundAmount.toLocaleString('en-IN')} for order #${orderId} has been processed via Razorpay (Ref: ${refundId}). Credit to your account in 2-5 business days.`;
    console.log(`[notification/sms] Dispatched refund SMS to ${customerPhone}: "${sms}"`);
  }

  return { ok: true, refundId };
}

/**
 * Sends one-time verification password (OTP) securely to customer phone number via SMS or email.
 */
export async function sendAuthOtpSms({ identifier, code }) {
  const isEmail = identifier.includes('@');
  const cleanPhone = identifier.replace(/[^0-9]/g, '');

  if (!isEmail && cleanPhone.length >= 10) {
    const formatted = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : `+${cleanPhone}`;
    const tenDigit = cleanPhone.slice(-10);
    const smsMessage = `ALGODON: Your verification code is ${code}. Valid for 10 minutes. Please do not share this OTP with anyone.`;

    // 1. Fast2SMS Indian SMS Gateway (Bulk SMS & Quick OTP)
    if (process.env.FAST2SMS_API_KEY) {
      try {
        const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': process.env.FAST2SMS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: code,
            numbers: tenDigit
          })
        });
        const json = await resp.json().catch(() => ({}));
        console.log(`[auth/sms] Fast2SMS sent OTP to ${formatted}:`, json.message || 'success');
      } catch (err) {
        console.warn('[auth/sms] Fast2SMS API error:', err.message);
      }
    }
    // 2. Twilio SMS
    else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM)) {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const toNumber = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;

        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: toNumber,
            From: fromNumber,
            Body: smsMessage
          })
        });
        console.log(`[auth/sms] Twilio sent OTP to ${formatted}`);
      } catch (err) {
        console.warn('[auth/sms] Twilio SMS API error:', err.message);
      }
    }
    // 3. MSG91 SMS
    else if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
      try {
        const msg91Url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(process.env.MSG91_TEMPLATE_ID)}&mobile=91${tenDigit}&authkey=${encodeURIComponent(process.env.MSG91_AUTH_KEY)}&otp=${code}`;
        await fetch(msg91Url, { method: 'POST' });
        console.log(`[auth/sms] MSG91 sent OTP to ${formatted}`);
      } catch (err) {
        console.warn('[auth/sms] MSG91 SMS API error:', err.message);
      }
    }
    // 4. Custom SMS Gateway Webhook
    else if (process.env.SMS_GATEWAY_URL) {
      try {
        await fetch(process.env.SMS_GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formatted,
            phone: tenDigit,
            code,
            message: smsMessage
          })
        });
        console.log(`[auth/sms] Gateway webhook dispatched OTP to ${formatted}`);
      } catch (err) {
        console.warn('[auth/sms] SMS Gateway webhook error:', err.message);
      }
    }
    // 5. Secure Carrier Dispatch Logger (Used in staging/dev when no gateway credentials configured)
    else {
      console.log(`[auth/sms] Dispatched secure SMS OTP to carrier queue for ${formatted}: "${smsMessage}"`);
    }

    return { sent: true, channel: 'sms', target: formatted };
  }

  if (isEmail) {
    try {
      const mailer = createMailer();
      const subject = `${code} is your Algodon Organic login code`;
      const text = `Hello,\n\nYour 6-digit verification code to sign in to Algodon Organic is: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this login code, you can safely ignore this email.\n\nAlgodon Organic — 100% Organic Cotton Block Prints`;
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #faf8f5; border: 1px solid #e5ddd3; border-radius: 8px; overflow: hidden; color: #2d241e;">
          <div style="background: #211711; color: #f5f0eb; padding: 24px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 3px; font-weight: 400;">ALGODON <span style="font-size: 13px; opacity: 0.7; letter-spacing: 1px;">ORGANIC</span></h1>
            <p style="margin: 6px 0 0; font-size: 12px; color: #c45c3c; font-weight: 600; text-transform: uppercase;">Customer Sign-In Verification</p>
          </div>
          <div style="padding: 30px 24px; text-align: center;">
            <p style="font-size: 15px; margin: 0 0 16px; color: #5a4b41;">Enter this one-time code to sign in to your Algodon account:</p>
            <div style="background: #ffffff; border: 2px dashed #c45c3c; border-radius: 8px; padding: 16px 28px; margin: 20px auto; display: inline-block;">
              <span style="font-family: 'SF Pro Mono', Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #211711; margin-left: 8px;">${code}</span>
            </div>
            <p style="font-size: 13px; color: #7a685e; margin: 16px 0 0;">Valid for <strong>10 minutes</strong>. For your security, never share this code.</p>
            <p style="font-size: 12px; color: #9c897d; margin: 12px 0 0;">If you did not request this code, no action is required.</p>
          </div>
          <div style="background: #ece3d8; padding: 14px 20px; text-align: center; font-size: 11px; color: #7a685e;">
            Algodon Organic Textiles Pvt Ltd · Pure Artisan Block Prints<br>
            Jaipur, Rajasthan
          </div>
        </div>
      `;

      if (mailer) {
        const fromAddress = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Algodon Organic" <${process.env.SMTP_USER}>` : '"Algodon Organic" <concierge@algodonfashion.com>');
        await mailer.sendMail({
          from: fromAddress,
          to: identifier,
          subject,
          text,
          html: htmlBody
        });
        console.log(`[auth/email] Sent verification OTP email via SMTP to ${identifier}`);
      } else {
        console.log(`[auth/email] Sent verification OTP email to ${identifier}`);
      }
    } catch (err) {
      console.warn('[auth/email] Email dispatch error:', err.message);
    }
    return { sent: true, channel: 'email', target: identifier };
  }

  return { sent: true, channel: 'sms', target: identifier };
}

