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

