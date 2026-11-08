import { useState } from 'react';
import { useAdmin, useResource } from './context.jsx';
import { Button, Check, Field, ResourceState } from './ui.jsx';

export function Settings() {
  const a = useAdmin();
  const resource = useResource('/settings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const body = {
      store_name: String(form.get('store_name') || '').trim(),
      tagline: String(form.get('tagline') || '').trim(),
      announcement: String(form.get('announcement') || '').trim(),
      support_phone: String(form.get('support_phone') || '').trim(),
      free_shipping_threshold: Number(form.get('free_shipping_threshold') || 0),
      dispatch_window: String(form.get('dispatch_window') || '').trim(),
      return_window_days: Number(form.get('return_window_days') || 7),
      low_stock_threshold: Number(form.get('low_stock_threshold') || 5),
      cod_enabled: form.get('cod_enabled') === 'on'
    };

    const newPass = String(form.get('new_password') || '').trim();
    const confirmPass = String(form.get('confirm_password') || '').trim();
    if (newPass) {
      if (newPass.length < 8) {
        setSaving(false);
        setError('New password must be at least 8 characters long.');
        return;
      }
      if (newPass !== confirmPass) {
        setSaving(false);
        setError('Passwords do not match.');
        return;
      }
      body.new_password = newPass;
    }

    try {
      const res = await a.api('/settings', {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      a.notify(res.message || 'Settings saved successfully.');
      a.refresh();
      const p1 = document.getElementById('f-new_password');
      const p2 = document.getElementById('f-confirm_password');
      if (p1) p1.value = '';
      if (p2) p2.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResourceState resource={resource}>
      {({ data }) => (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <form id="settingsForm" onSubmit={submit}>
            {/* 1. Brand & Store Info */}
            <div className="panel" style={{ marginBottom: '24px' }}>
              <h2>Store & Brand Identity</h2>
              <p className="muted small" style={{ margin: '-10px 0 18px' }}>
                Manage your store details, public announcement banner, and contact information.
              </p>
              <div className="form-grid">
                <Field name="store_name" label="Store Name" defaultValue={data.store_name} required />
                <Field name="support_phone" label="Support Phone Number" defaultValue={data.support_phone} />
                <div className="field full">
                  <label htmlFor="f-tagline">Brand Tagline</label>
                  <input id="f-tagline" name="tagline" defaultValue={data.tagline} />
                </div>
                <div className="field full">
                  <label htmlFor="f-announcement">Top Announcement Bar Notice</label>
                  <input id="f-announcement" name="announcement" defaultValue={data.announcement} />
                </div>
              </div>
            </div>

            {/* 2. Admin Security & Password */}
            <div className="panel" style={{ marginBottom: '24px' }}>
              <h2>Admin Account & Security</h2>
              <p className="muted small" style={{ margin: '-10px 0 18px' }}>
                Primary super administrator credentials for store management.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="f-admin_email">Primary Admin Email</label>
                  <input id="f-admin_email" name="admin_email" defaultValue={data.admin_email} disabled style={{ opacity: 0.75, cursor: 'not-allowed' }} />
                  <span className="small muted">Fixed store owner login ID.</span>
                </div>
                <div className="field">
                  <label htmlFor="f-currency">Store Currency</label>
                  <input id="f-currency" name="currency" defaultValue="INR (₹)" disabled style={{ opacity: 0.75, cursor: 'not-allowed' }} />
                </div>
                <div className="field">
                  <label htmlFor="f-new_password">Change Admin Password</label>
                  <input id="f-new_password" name="new_password" type="password" placeholder="Leave blank to keep current password" autoComplete="new-password" />
                </div>
                <div className="field">
                  <label htmlFor="f-confirm_password">Confirm New Password</label>
                  <input id="f-confirm_password" name="confirm_password" type="password" placeholder="Re-type new password" />
                </div>
              </div>
            </div>

            {/* 3. Shipping & Operations */}
            <div className="panel" style={{ marginBottom: '24px' }}>
              <h2>Orders & Inventory Operations</h2>
              <p className="muted small" style={{ margin: '-10px 0 18px' }}>
                Fulfillment settings, customer policies, and inventory safety alerts.
              </p>
              <div className="form-grid">
                <Field name="free_shipping_threshold" label="Free Shipping Minimum Order (₹)" type="number" defaultValue={data.free_shipping_threshold ?? 0} />
                <Field name="dispatch_window" label="Dispatch Delivery Window" defaultValue={data.dispatch_window || '24–48 hours'} />
                <Field name="return_window_days" label="Return & Size Exchange Window (Days)" type="number" defaultValue={data.return_window_days ?? 7} />
                <Field name="low_stock_threshold" label="Low Stock Warning Alert Count" type="number" defaultValue={data.low_stock_threshold ?? 5} />
              </div>
            </div>

            {/* 4. Payment Gateway Status */}
            <div className="panel" style={{ marginBottom: '24px' }}>
              <h2>Payments & Gateways</h2>
              <p className="muted small" style={{ margin: '-10px 0 18px' }}>
                Real-time online payment gateway integration status.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="f-razorpay_gateway">Primary Gateway</label>
                  <input id="f-razorpay_gateway" defaultValue="Razorpay" disabled style={{ opacity: 0.8 }} />
                </div>
                <div className="field">
                  <label htmlFor="f-razorpay_status">Gateway Status</label>
                  <input id="f-razorpay_status" defaultValue={data.razorpay_status || 'Live & Connected'} disabled style={{ opacity: 0.8, fontWeight: 700, color: 'var(--green)' }} />
                </div>
                <div className="field full">
                  <label htmlFor="f-razorpay_key">Active Razorpay Key ID</label>
                  <input id="f-razorpay_key" defaultValue={data.razorpay_key_id ? (data.razorpay_key_id.slice(0, 10) + '••••••••••') : 'Configured via Environment Variables'} disabled style={{ opacity: 0.8 }} />
                </div>
                <Check name="cod_enabled" label="Enable Cash on Delivery (COD) Option at Checkout" checked={Boolean(data.cod_enabled)} />
              </div>
            </div>

            {error && <p className="error" role="alert" style={{ marginBottom: '16px' }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <Button type="submit" primary disabled={saving} style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                {saving ? 'Saving changes…' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </ResourceState>
  );
}
