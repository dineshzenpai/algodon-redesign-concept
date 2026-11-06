import { useEffect, useState } from 'react';
import { readStorage } from '../shared/api.js';
import { safeImageUrl } from '../shared/safety.js';

export function CartItems({s}) {
  const change = (index,delta) => s.setCart(items => items.map((item,i) => i === index ? {...item,qty:Math.min(100,item.qty+delta)} : item).filter(item => item.qty > 0));
  return s.cart.length ? s.cart.map((item,index) => <div className="cart-row" key={item.id+':'+item.size}>
    <img src={safeImageUrl(item.img) || '/img/product-golden-brown.jpg'} alt="" />
    <div className="meta"><span className="name">{item.name}</span><span className="size">Size {item.size}</span>
      <div className="qty-row"><button type="button" data-action="dec" aria-label="Decrease quantity" onClick={() => change(index,-1)}>−</button><span>{item.qty}</span><button type="button" data-action="inc" aria-label="Increase quantity" disabled={item.qty >= 100} onClick={() => change(index,1)}>+</button></div>
      <button type="button" className="remove-link" data-action="remove" onClick={() => s.setCart(items => items.filter((_,i) => i !== index))}>Remove</button>
    </div><div className="price">{s.money(item.qty*item.price)}</div>
  </div>) : <p className="cart-empty">Your cart is empty — the print edit is right there.</p>;
}

export function AccountHistory({s}) {
  const [data,setData] = useState([]), [error,setError] = useState(''), [loading,setLoading] = useState(false), [version,setVersion] = useState(0);
  useEffect(() => {
    if (s.accountView === 'shipping' || s.panel !== 'account') return;
    let cancelled = false;
    setError(''); setData([]);
    if (!s.user) {
      setLoading(false);
      if (s.accountView === 'orders') setData(readStorage('algodon_demo_orders',[]).filter(order => !order.customer_user_id && order.customer?.email === s.address.email));
      return;
    }
    setLoading(true);
    s.accountFetch('/api/account/'+s.accountView+'?limit=100').then(result => { if (!cancelled) setData(result.data || []); })
      .catch(error => { if (!cancelled) setError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  },[s.accountView,s.panel,s.user?.id,s.accountFetch,s.address.email,version]);
  if (loading) return <p role="status">Loading {s.accountView}…</p>;
  if (error) return <p role="alert">{error} <button className="btn btn-ghost" onClick={() => setVersion(value => value+1)}>Try again</button></p>;
  if (s.accountView === 'wishlist') return !s.user ? <p className="cart-empty">Sign in to save shirts to your wishlist.</p> : data.length ? data.map(item => <p key={item.product_id}>{item.product?.name || 'Unavailable product'} <button className="btn btn-ghost" onClick={async () => {
    try { await s.accountFetch('/api/account/wishlist/'+encodeURIComponent(item.product_id),{method:'DELETE'}); setVersion(value => value+1); } catch(error) { s.notify(error.message); }
  }}>Remove</button></p>) : <p>Your wishlist is empty.</p>;
  if (!data.length) return <div style={{textAlign:'center',padding:'28px 8px'}}><p style={{fontWeight:700,marginBottom:6,fontFamily:"'Fraunces',serif",fontSize:'1.15rem'}}>No orders placed yet</p><p style={{color:'var(--ink-soft)',fontSize:'.82rem',margin:0}}>Add shirts to your cart and checkout to track your orders in real time.</p></div>;
  return [...data].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)).map(order => {
    const rawStatus = (order.status || 'Confirmed').toLowerCase();
    const stages = ['placed', 'confirmed', 'packed', 'shipped', 'out for delivery', 'delivered'];
    const current = stages.indexOf(rawStatus) !== -1 ? stages.indexOf(rawStatus) : 1;
    const isCancelled = rawStatus === 'cancelled';
    const isRefunded = rawStatus === 'refunded' || order.payment_status === 'Refunded';

    return <div className="order-card" key={order.id} style={{ background: 'var(--card)', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid var(--line)' }}>
      <div className="order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div className="order-id" style={{ fontWeight: 700, fontSize: '0.9rem' }}>Order {order.id.slice(0, 12)}…</div>
          <div style={{ fontSize: '.75rem', color: 'var(--ink-soft)' }}>Placed on {new Date(order.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <span className="order-status-badge" style={{ background: isRefunded ? '#8c3f3a' : isCancelled ? '#8c3f3a' : '#27ae60', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
          {isRefunded ? 'Refunded' : (order.status || 'Confirmed')}
        </span>
      </div>

      {/* Tracking Milestones Stepper */}
      {!isCancelled && !isRefunded && (
        <div style={{ margin: '14px 0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', textAlign: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
            {['Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].map((label, index) => {
              const active = index <= current;
              return (
                <div key={label} style={{ color: active ? 'var(--accent)' : 'var(--ink-soft)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: active ? 'var(--accent)' : 'var(--line)', margin: '0 auto 4px' }}></div>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Courier & Tracking Info */}
      <div style={{ background: 'rgba(196, 92, 60, 0.06)', borderRadius: '6px', padding: '10px 12px', margin: '10px 0', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: 'var(--ink-soft)' }}>Courier: </span>
            <strong>{order.courier_name || 'BlueDart Express'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--ink-soft)' }}>AWB: </span>
            <strong>{order.tracking_number || `BD${order.id.slice(0, 8).toUpperCase()}`}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: 'var(--ink-soft)' }}>Estimated Delivery: <strong>2–4 Business Days</strong></span>
          <a
            href={order.tracking_url || `https://www.bluedart.com/tracking?track=${order.tracking_number || order.id.slice(0, 8)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
          >
            Live Tracking ↗
          </a>
        </div>
      </div>

      {/* Items list */}
      <div className="order-items-list" style={{ margin: '12px 0', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
        {(order.items || []).map((item, index) => (
          <div className="order-item-row" key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '3px 0' }}>
            <span>{item.name} ({item.size}) × {item.qty}</span>
            <span>{s.money((item.price || 0) * (item.qty || 1))}</span>
          </div>
        ))}
      </div>

      {order.discount > 0 && (
        <div className="order-item-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#27ae60' }}>
          <span>Discount ({order.coupon_code || 'PROMO'})</span>
          <span>− {s.money(order.discount)}</span>
        </div>
      )}

      <div className="order-footer-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem', borderTop: '1px solid var(--line)', paddingTop: '8px', marginTop: '6px' }}>
        <span>Total Paid</span>
        <span>{s.money(Number(order.subtotal) - Number(order.discount || 0))}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          className="btn btn-solid"
          data-action="order-invoice"
          style={{ flex: 1, justifyContent: 'center', fontSize: '.78rem', padding: '10px 12px' }}
          onClick={() => s.downloadInvoice(order)}
        >
          📄 Download GST Invoice (PDF)
        </button>
      </div>
    </div>;
  });
}
