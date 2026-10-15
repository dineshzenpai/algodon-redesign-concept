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
  return data.toSorted((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)).map(order => {
    const status=(order.status || 'Pending').toLowerCase(), stages=['confirmed','packed','shipped','delivered'], current=stages.indexOf(status);
    return <div className="order-card" key={order.id}>
      <div className="order-header"><div><div className="order-id">{order.id}</div><div style={{fontSize:'.75rem',color:'var(--ink-soft)'}}>{new Date(order.created_at).toLocaleString('en-IN')}</div></div><span className="order-status-badge">{order.status || 'Pending'}</span></div>
      <div className="order-stepper">{['Confirmed','Tailored','Shipped','Delivered'].map((label,index) => <div key={label} className={'step-dot '+(index < current ? 'completed' : index === current ? 'active' : '')}><span>{label}</span></div>)}</div>
      <div className="order-items-list">{(order.items || []).map((item,index) => <div className="order-item-row" key={index}><span>{item.name} ({item.size}) × {item.qty}</span><span>{s.money(item.price*item.qty)}</span></div>)}</div>
      {order.discount > 0 && <div className="order-item-row" style={{color:'var(--accent)'}}><span>Discount</span><span>− {s.money(order.discount)}</span></div>}
      <div className="order-footer-row"><span>Order total</span><span>{s.money(Number(order.subtotal)-Number(order.discount || 0))}</span></div>
      <button type="button" className="btn btn-ghost" data-action="order-invoice" style={{width:'100%',justifyContent:'center',fontSize:'.78rem',padding:'8px 12px',marginTop:4}} onClick={() => s.downloadInvoice(order)}>Download PDF Invoice</button>
    </div>;
  });
}
