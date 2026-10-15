import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { request, money, readStorage, writeStorage, removeStorage } from '../shared/api.js';
import { normalizeCart } from '../shared/safety.js';
import { conceptProducts } from './catalog.js';

const CART = 'algodon_demo_cart', OWNER = 'algodon_customer_cart_owner', ADDRESS = 'algodon_demo_address';
const route = () => location.pathname.replace(/\/$/,'');
const emptyAddress = {name:'',email:'',phone:'',address1:'',address2:'',city:'',state:'',pin:''};
function cartOwner() {
  try { const owner=localStorage.getItem(OWNER); if (!owner) return null; try { return JSON.parse(owner); } catch { return owner; } } catch { return null; }
}
function savedAddress() {
  const saved = readStorage(ADDRESS, {});
  return Object.fromEntries(Object.keys(emptyAddress).map(key => [key, saved[key] || saved['ship'+key[0].toUpperCase()+key.slice(1)] || '']));
}
export function useStorefront() {
  const [products,setProducts] = useState(conceptProducts);
  const [panel,setPanel] = useState(null), [menuOpen,setMenuOpen] = useState(false), [accountMenu,setAccountMenu] = useState(false);
  const [scrolled,setScrolled] = useState(scrollY > 12);
  const [cart,setCart] = useState(() => cartOwner() ? [] : normalizeCart(readStorage(CART,[])));
  const [coupon,setCoupon] = useState(null), [couponCode,setCouponCode] = useState(''), [couponMessage,setCouponMessage] = useState('');
  const [user,setUser] = useState(null), [client,setClient] = useState(null), [authReady,setAuthReady] = useState(false);
  const [authMode,setAuthMode] = useState(() => new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery' ? 'recovery' : 'signin');
  const [authError,setAuthError] = useState(''), [guest,setGuest] = useState(false), [accountView,setAccountView] = useState('shipping');
  const [address,setAddress] = useState(savedAddress), [addressError,setAddressError] = useState('');
  const [newsletterOptIn,setNewsletterOptIn] = useState(true), [newsletterMessage,setNewsletterMessage] = useState('Saved to a live database — real signups.');
  const [busy,setBusy] = useState(''), [toast,setToast] = useState(''), [lastOrder,setLastOrder] = useState(null);
  const [cartNote,setCartNote] = useState('Concept preview — no real payment, but your order and shipping details are saved to a live database.');
  const [cartReady,setCartReady] = useState(false);
  const customerId = useRef(null), cartRef = useRef(cart), toastTimer = useRef();
  cartRef.current = cart;
  const notify = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''),4000); },[]);
  const close = useCallback(() => { setPanel(null); setMenuOpen(false); setAccountMenu(false); },[]);
  const open = useCallback(value => { setMenuOpen(false); setAccountMenu(false); setPanel(value); },[]);
  const openAccount = () => { setGuest(false); setAccountView('shipping'); open('account'); };
  const changeAuth = mode => { setAuthMode(mode); setAuthError(''); };
  const accountFetch = useCallback(async (url,options = {}) => {
    const session = client ? (await client.auth.getSession()).data.session : null;
    return request(url,{...options,headers:{...options.headers,...(session ? {Authorization:`Bearer ${session.access_token}`} : {})}});
  },[client]);

  useEffect(() => {
    let cancelled = false, subscription;
    request('/api/config').then(config => {
      if (cancelled || !config.supabase?.url || !config.supabase.publishableKey) return;
      const supabase = createClient(config.supabase.url,config.supabase.publishableKey);
      setClient(supabase);
      subscription = supabase.auth.onAuthStateChange((event,session) => {
        if (cancelled) return;
        setUser(session?.user || null); setAuthReady(true);
        if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); setPanel('account'); }
      }).data.subscription;
      return supabase.auth.getSession().then(({data,error}) => {
        if (cancelled) return;
        if (error) throw error;
        setUser(data.session?.user || null);
        if (new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery') setPanel('account');
      });
    }).catch(() => { if (!cancelled) notify('Accounts are temporarily unavailable. Please try again later.'); })
      .finally(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; subscription?.unsubscribe(); clearTimeout(toastTimer.current); };
  },[notify]);
  useEffect(() => {
    const controller = new AbortController();
    request('/api/products',{signal:controller.signal}).then(result => {
      if (result.data?.length) setProducts(result.data);
    }).catch(error => { if (error.name !== 'AbortError') notify('The catalog is temporarily unavailable. Please refresh to try again.'); });
    return () => controller.abort();
  },[notify]);
  useEffect(() => {
    const scroll = () => setScrolled(scrollY > 12);
    const escape = event => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll',scroll,{passive:true}); document.addEventListener('keydown',escape);
    return () => { window.removeEventListener('scroll',scroll); document.removeEventListener('keydown',escape); };
  },[close]);
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    setCartReady(false);
    if (!user) {
      if (customerId.current || cartOwner()) { setCart([]); removeStorage(CART); removeStorage(OWNER); }
      customerId.current = null; setCartReady(true); return;
    }
    customerId.current = user.id;
    const guestCart = cartOwner() ? [] : cartRef.current;
    accountFetch('/api/account/cart').then(result => {
      if (cancelled) return;
      const merged = new Map((result.data || []).map(item => [item.id+':'+item.size,item]));
      guestCart.filter(item => /^[\da-f-]{36}$/i.test(item.id)).forEach(item => {
        const key=item.id+':'+item.size, previous=merged.get(key);
        merged.set(key,{...item,qty:Math.min(100,item.qty+(previous?.qty || 0))});
      });
      writeStorage(OWNER,user.id); setCart(normalizeCart([...merged.values()])); setCartReady(true);
    }).catch(error => { if (!cancelled) notify(error.message); });
    accountFetch('/api/account/me').then(({data}) => {
      if (!cancelled) setAddress(current => ({...current,...data.addresses?.[0],name:data.full_name || current.name,email:data.email || user.email,phone:data.phone || current.phone}));
    }).catch(error => { if (!cancelled) notify(error.message); });
    return () => { cancelled = true; };
  },[authReady,user?.id,accountFetch,notify]);
  useEffect(() => {
    if (!cartReady) return;
    writeStorage(CART,cart); setCoupon(null);
    if (!user) return;
    const timer = setTimeout(() => {
      accountFetch('/api/account/cart',{method:'PUT',body:JSON.stringify({items:cart.map(({id,size,qty}) => ({id,size,qty}))})}).catch(error => notify('Cart could not be saved: '+error.message));
    },300);
    return () => clearTimeout(timer);
  },[cart,cartReady,user?.id,accountFetch,notify]);
  useEffect(() => {
    if (!authReady) return;
    const current = route();
    if (current === '/orders' || current === '/wishlist') { setAccountView(current.slice(1)); setGuest(!user); setPanel('account'); }
    else if (current === '/account') setPanel('account');
  },[authReady,user?.id]);
  useEffect(() => {
    if (authMode !== 'recovery' || !authReady) return;
    setPanel('account'); setGuest(false);
    if (!user) { setAuthMode('reset'); setAuthError('This reset link has expired. Request a new link.'); }
    history.replaceState(null,'',location.pathname+location.search);
  },[authMode,authReady,user?.id]);

  async function submitAuth(event) {
    event.preventDefault(); setAuthError('');
    if (!client) { setAuthError("Accounts aren't reachable right now."); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy('auth');
    try {
      if (authMode === 'recovery') {
        if (data.password !== data.confirm) throw new Error('Passwords must match.');
        await accountFetch('/api/auth/password-update',{method:'POST',body:JSON.stringify({password:data.password})});
        await accountFetch('/api/auth/logout',{method:'POST'}).catch(() => {});
        await client.auth.signOut({scope:'local'}); setAuthMode('signin'); setAuthError('Password updated. Sign in with your new password.'); return;
      }
      if (authMode === 'reset') {
        const result = await request('/api/auth/password-reset',{method:'POST',body:JSON.stringify({email:data.email})});
        setAuthError(result.message); return;
      }
      const result = await request('/api/auth/'+(authMode === 'signup' ? 'signup' : 'login'),{method:'POST',body:JSON.stringify({email:data.email,password:data.password,...(authMode === 'signup' ? {name:data.name} : {})})});
      if (authMode === 'signup' && data.newsletter === 'on') request('/api/newsletter',{method:'POST',body:JSON.stringify({email:data.email})}).catch(() => notify('Your account was created, but newsletter signup could not be saved.'));
      if (!result.session) { setAuthMode('signin'); setAuthError('Check your email to confirm your account, then sign in.'); return; }
      const stored = await client.auth.setSession(result.session);
      if (stored.error) throw stored.error;
      setUser(stored.data.user); setGuest(false); close();
    } catch(error) { setAuthError(error.message); }
    finally { setBusy(''); }
  }
  async function signOut() {
    try {
      if (user) await accountFetch('/api/auth/logout',{method:'POST'}).catch(error => { if(error.status !== 401) throw error; });
      await client?.auth.signOut({scope:'local'}); setUser(null); setGuest(false); setCart([]); close();
    } catch(error) { notify(error.message); }
  }
  function showShipping() { setGuest(!user); setAccountView('shipping'); open('account'); }
  function showHistory(view) { setGuest(!user); setAccountView(view); open('account'); }
  async function saveAddress(event) {
    event.preventDefault(); setAddressError(''); setBusy('address');
    try {
      const trimmed = Object.fromEntries(Object.entries(address).map(([key,value]) => [key,String(value || '').trim()]));
      if (!Object.entries(trimmed).every(([key,value]) => key === 'address2' || value)) throw new Error('Please complete your shipping details.');
      if (user) {
        const {email,...shipping} = trimmed;
        await accountFetch('/api/account/me',{method:'PATCH',body:JSON.stringify({full_name:trimmed.name,phone:trimmed.phone,addresses:[shipping]})});
      }
      writeStorage(ADDRESS,trimmed); setAddress(trimmed); setCartNote('Shipping details saved. You can now checkout.'); open('cart');
    } catch(error) { setAddressError(error.message); }
    finally { setBusy(''); }
  }
  const subtotal = cart.reduce((sum,item) => sum+item.price*item.qty,0), total = Math.max(0,subtotal-(coupon?.discount || 0));
  async function applyCoupon() {
    setCouponMessage('');
    if (!couponCode.trim()) return setCouponMessage('Enter a coupon code.');
    if (!cart.length) return setCouponMessage('Add an item to your cart before applying a coupon.');
    setBusy('coupon');
    try {
      const result = await accountFetch('/api/coupons/validate',{method:'POST',body:JSON.stringify({code:couponCode.trim().toUpperCase(),email:address.email || user?.email || 'guest@algodon.store',items:cart.map(({id,qty}) => ({id,qty}))})});
      setCoupon(result); setCouponMessage(result.type === 'free_shipping' ? 'Free shipping coupon applied.' : 'Coupon applied — '+money(result.discount)+' off.');
    } catch(error) { setCoupon(null); setCouponMessage(error.message); }
    finally { setBusy(''); }
  }
  async function checkout() {
    if (busy) return;
    if (!cart.length) { setCartNote('Your cart is empty. Add a shirt first.'); return; }
    if (Object.entries(address).some(([key,value]) => key !== 'address2' && !value.trim())) { setAddressError('Please fill your shipping details to complete checkout.'); showShipping(); return; }
    setBusy('checkout');
    const input = {items:cart.map(({id,size,qty}) => ({id,size,qty})),customer:address,coupon_code:coupon?.code || ''};
    const fingerprint = JSON.stringify(input);
    let pending = readStorage('algodon_pending_checkout',null,sessionStorage);
    if (!pending || pending.fingerprint !== fingerprint) { pending={fingerprint,key:crypto.randomUUID()}; writeStorage('algodon_pending_checkout',pending,sessionStorage); }
    try {
      const result = await accountFetch('/api/checkout/orders',{method:'POST',headers:{'Idempotency-Key':pending.key},body:JSON.stringify(input)});
      if (!result.data?.id) throw new Error('Your order could not be confirmed. Please try again.');
      removeStorage('algodon_pending_checkout',sessionStorage);
      const order=result.data; setLastOrder(order);
      const saved=readStorage('algodon_demo_orders',[]);
      if (!user && !saved.some(item => item.id === order.id)) writeStorage('algodon_demo_orders',[...saved,order]);
      setCart([]); setCoupon(null); setCartNote('Order saved ('+order.id.slice(0,8)+'). No payment was collected.');
      if (newsletterOptIn) request('/api/newsletter',{method:'POST',body:JSON.stringify({email:address.email})}).catch(() => {});
    } catch(error) { setCartNote(error.message); }
    finally { setBusy(''); }
  }
  async function downloadInvoice(order) {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({unit:'pt',format:'a4'});
      doc.setFont('times','italic'); doc.setFontSize(22); doc.text('Algodon Organic',48,64);
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text('Order '+order.id,48,100); doc.text(new Date(order.created_at).toLocaleDateString('en-IN'),48,118);
      const customer=order.customer || {};
      doc.text(doc.splitTextToSize([customer.name,customer.email,[customer.address1,customer.address2,customer.city,customer.state,customer.pin].filter(Boolean).join(', ')].filter(Boolean).join('\n'),490),48,145);
      let y=230;
      for (const item of order.items || []) {
        if (y>720) { doc.addPage(); y=64; }
        const lines=doc.splitTextToSize(`${item.name} · ${item.size} · ${item.qty} × ${money(item.price)}`,490);
        doc.text(lines,48,y); y+=lines.length*14+12;
      }
      if (y>690) { doc.addPage(); y=64; }
      doc.text('Total: '+money(Number(order.subtotal)-Number(order.discount || 0)),48,y+20);
      doc.text('Order record only. No payment was collected.',48,y+44);
      doc.save('algodon-invoice-'+order.id.slice(0,8)+'.pdf');
    } catch { notify('The invoice could not be downloaded. Please try again.'); }
  }
  async function subscribe(event) {
    event.preventDefault(); const form=event.currentTarget;
    setBusy('newsletter');
    try { await request('/api/newsletter',{method:'POST',body:JSON.stringify({email:form.elements.newsletterEmail.value.trim()})}); setNewsletterMessage("You're on the list. Thanks for subscribing!"); form.reset(); }
    catch(error) { setNewsletterMessage(error.message); }
    finally { setBusy(''); }
  }
  function addProduct(product,size) {
    const stock = product.variants?.length ? product.variants.find(item => item.size === size)?.stock || 0 : product.stock_count;
    const previous=cart.find(item => item.id === product.id && item.size === size);
    if ((previous?.qty || 0) >= Math.min(100,stock)) return 'Maximum available quantity reached.';
    if (!previous && cart.length >= 50) return 'Your cart has reached the maximum number of items.';
    setCart(items => previous ? items.map(item => item === previous ? {...item,qty:item.qty+1} : item) : [...items,{id:product.id,name:product.name,size,qty:1,price:Number(product.sale_price ?? product.price),img:product.images?.[0] || ''}]);
    open('cart'); return '';
  }
  return {products,panel,open,close,menuOpen,setMenuOpen,accountMenu,setAccountMenu,scrolled,cart,setCart,coupon,couponCode,setCouponCode,couponMessage,applyCoupon,subtotal,total,money,user,authReady,authMode,changeAuth,authError,submitAuth,signOut,openAccount,guest,setGuest,accountView,setAccountView,showShipping,showHistory,address,setAddress,addressError,saveAddress,newsletterOptIn,setNewsletterOptIn,newsletterMessage,subscribe,busy,toast,notify,lastOrder,cartNote,checkout,downloadInvoice,accountFetch,addProduct};
}
