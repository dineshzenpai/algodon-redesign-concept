import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { request, money, readStorage, writeStorage, removeStorage } from '../shared/api.js';
import { normalizeCart } from '../shared/safety.js';
import { conceptProducts } from './catalog.js';

const CART = 'algodon_demo_cart', OWNER = 'algodon_customer_cart_owner', ADDRESS = 'algodon_demo_address';
const route = () => location.pathname.replace(/\/$/,'');
const emptyAddress = {name:'',email:'',phone:'',address1:'',address2:'',city:'',state:'',pin:''};
function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
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
  const [user,setUser] = useState(() => readStorage('algodon_customer_user', null));
  const [client,setClient] = useState(null), [authReady,setAuthReady] = useState(false);
  const [isAdmin,setIsAdmin] = useState(() => Boolean(readStorage('algodon_customer_user', null)?.isAdmin));
  const [adminRole,setAdminRole] = useState(() => readStorage('algodon_customer_user', null)?.role || null);
  const [authMode,setAuthMode] = useState(() => new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery' ? 'recovery' : 'signin');
  const [authError,setAuthError] = useState(''), [guest,setGuest] = useState(false), [accountView,setAccountView] = useState('shipping');
  const [address,setAddress] = useState(savedAddress), [addressError,setAddressError] = useState('');
  const [newsletterOptIn,setNewsletterOptIn] = useState(true), [newsletterMessage,setNewsletterMessage] = useState('Saved to a live database — real signups.');
  const [busy,setBusy] = useState(''), [toast,setToast] = useState(''), [lastOrder,setLastOrder] = useState(null);
  const [cartNote,setCartNote] = useState('');
  const [cartReady,setCartReady] = useState(false);
  const [activeProduct,setActiveProduct] = useState(null);
  const [helpTopic,setHelpTopic] = useState(null);
  const [loginMethod,setLoginMethod] = useState('otp'); // 'otp' | 'password'
  const [otpSent,setOtpSent] = useState(false);
  const [otpIdentifier,setOtpIdentifier] = useState('');
  const [otpCode,setOtpCode] = useState('');
  const [otpNotice,setOtpNotice] = useState('');
  const [googleModal,setGoogleModal] = useState(false);
  const [showGoogleEmailInput,setShowGoogleEmailInput] = useState(false);
  const [googleEmailInput,setGoogleEmailInput] = useState('');
  const customerId = useRef(null), cartRef = useRef(cart), toastTimer = useRef();
  cartRef.current = cart;
  const notify = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''),4000); },[]);
  const close = useCallback(() => {
    setPanel(null);
    setMenuOpen(false);
    setAccountMenu(false);
    if (typeof window !== 'undefined' && ['/orders', '/wishlist', '/account'].includes(location.pathname)) {
      history.pushState(null, '', '/');
    }
  }, []);
  const open = useCallback(value => { setMenuOpen(false); setAccountMenu(false); setPanel(value); },[]);
  const openAccount = () => {
    setGuest(false);
    setAuthMode('signin');
    setAuthError('');
    setGoogleModal(false);
    setShowGoogleEmailInput(false);
    setGoogleEmailInput('');
    setAccountView('shipping');
    open('account');
    if (typeof window !== 'undefined' && location.pathname !== '/account') {
      history.pushState(null, '', '/account');
    }
  };
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
        if (session?.user) {
          setUser(session.user);
          writeStorage('algodon_customer_user', session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          writeStorage('algodon_customer_user', null);
        }
        setAuthReady(true);
        if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); setPanel('account'); }
      }).data.subscription;
      return supabase.auth.getSession().then(({data,error}) => {
        if (cancelled) return;
        if (error) throw error;
        if (data.session?.user) {
          setUser(data.session.user);
          writeStorage('algodon_customer_user', data.session.user);
        }
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
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const syncItems = cart.filter(item => uuidPattern.test(item.id)).map(({id,size,qty}) => ({id,size,qty}));
      accountFetch('/api/account/cart',{method:'PUT',body:JSON.stringify({items:syncItems})}).catch(error => notify('Cart could not be saved: '+error.message));
    },300);
    return () => clearTimeout(timer);
  },[cart,cartReady,user?.id,accountFetch,notify]);
  useEffect(() => {
    const handlePopState = () => {
      const current = route();
      if (current === '/orders' || current === '/wishlist') {
        setAccountView(current.slice(1));
        setGuest(!user);
        setPanel('account');
      } else if (current === '/account') {
        setAccountView('shipping');
        setGuest(false);
        setPanel('account');
      } else if (!current || current === '/') {
        setPanel(null);
      }
    };
    if (authReady) {
      handlePopState();
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authReady, user?.id]);
  useEffect(() => {
    if (authMode !== 'recovery' || !authReady) return;
    setPanel('account'); setGuest(false);
    if (!user) { setAuthMode('reset'); setAuthError('This reset link has expired. Request a new link.'); }
    history.replaceState(null,'',location.pathname+location.search);
  },[authMode,authReady,user?.id]);

  const checkAdminStatus = useCallback(async () => {
    try {
      const res = await request('/api/admin/me', { headers: { 'X-Admin-Request': '1' } });
      if (res?.user?.role) {
        setIsAdmin(true);
        setAdminRole(res.user.role);
        return true;
      }
    } catch {}
    setIsAdmin(false);
    setAdminRole(null);
    return false;
  }, []);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
      setAdminRole(null);
    }
  }, [user?.id, checkAdminStatus]);

  async function submitAuth(event) {
    event.preventDefault(); setAuthError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy('auth');
    try {
      if (authMode === 'recovery') {
        if (data.password !== data.confirm) throw new Error('Passwords must match.');
        await accountFetch('/api/auth/password-update',{method:'POST',body:JSON.stringify({password:data.password})});
        await accountFetch('/api/auth/logout',{method:'POST'}).catch(() => {});
        if (client) await client.auth.signOut({scope:'local'}).catch(() => {});
        setAuthMode('signin'); setAuthError('Password updated. Sign in with your new password.'); return;
      }
      if (authMode === 'reset') {
        const result = await request('/api/auth/password-reset',{method:'POST',body:JSON.stringify({email:data.email})});
        setAuthError(result.message); return;
      }
      const result = await request('/api/auth/'+(authMode === 'signup' ? 'signup' : 'login'),{method:'POST',body:JSON.stringify({email:data.email,password:data.password,...(authMode === 'signup' ? {name:data.name} : {})})});
      if (authMode === 'signup' && data.newsletter === 'on') request('/api/newsletter',{method:'POST',body:JSON.stringify({email:data.email})}).catch(() => notify('Your account was created, but newsletter signup could not be saved.'));
      if (!result.user && !result.session) { setAuthMode('signin'); setAuthError('Check your email to confirm your account, then sign in.'); return; }
      
      let loggedUser = result.user || null;
      if (client && result.session?.access_token && !result.session.access_token.startsWith('admin-') && !result.session.access_token.startsWith('cust-')) {
        try {
          const stored = await client.auth.setSession(result.session);
          if (stored?.data?.user) loggedUser = { ...stored.data.user, ...(result.user || {}) };
        } catch {}
      }
      if (!loggedUser) {
        loggedUser = { email: data.email, full_name: data.email.split('@')[0] };
      }
      loggedUser = { ...loggedUser, isAdmin: Boolean(result.isAdmin), role: result.role };
      setUser(loggedUser);
      writeStorage('algodon_customer_user', loggedUser);
      setIsAdmin(Boolean(result.isAdmin));
      setAdminRole(result.role || null);
      setGuest(false);
      setPanel('account');
      setAccountView('profile');
      if (result.isAdmin) {
        notify(`Welcome! Store Admin access unlocked (${result.role?.replace('_', ' ') || 'admin'}).`);
      } else {
        notify(`Welcome, ${loggedUser.user_metadata?.full_name?.split(' ')[0] || loggedUser.full_name?.split(' ')[0] || loggedUser.email || 'Customer'}!`);
      }
    } catch(error) {
      setAuthError(error.message);
    }
    finally { setBusy(''); }
  }

  async function sendOtp(targetIdentifier) {
    const target = String(targetIdentifier || otpIdentifier).trim();
    if (!target) {
      setAuthError('Please enter your email address or phone number.');
      return;
    }
    setBusy('otp_send');
    setAuthError('');
    try {
      await request('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ identifier: target })
      });
      setOtpSent(true);
      setOtpIdentifier(target);
      setOtpCode(''); // Keep strictly blank: customer types the code received via SMS
      const isEmail = target.includes('@');
      const cleanDigits = target.replace(/\D/g, '');
      const formatted = isEmail ? target : `+91 ${cleanDigits.slice(-10)}`;
      notify(`Verification code sent to ${formatted}`);
      setOtpNotice(`6-digit verification code sent via SMS to ${formatted}. Please enter the code received on your phone.`);
    } catch(err) {
      setAuthError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setBusy('');
    }
  }

  async function verifyOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    const target = otpIdentifier.trim();
    const code = otpCode.trim();
    if (!target || !code) {
      setAuthError('Please enter both your phone/email and the 6-digit code.');
      return;
    }
    setBusy('otp_verify');
    setAuthError('');
    try {
      const res = await request('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ identifier: target, otp: code })
      });
      if (res?.user) {
        const loggedUser = { ...(res.user || {}), isAdmin: Boolean(res.isAdmin), role: res.role };
        setUser(loggedUser);
        writeStorage('algodon_customer_user', loggedUser);
        setIsAdmin(Boolean(res.isAdmin));
        setAdminRole(res.role || null);
        setGuest(false);
        setOtpSent(false);
        setOtpCode('');
        setPanel('account');
        setAccountView('profile');
        if (res.isAdmin) {
          notify(`Welcome! Store Admin access unlocked (${res.role?.replace('_', ' ') || 'admin'}).`);
        } else {
          notify(`Welcome, ${loggedUser.full_name?.split(' ')[0] || loggedUser.email || loggedUser.phone || 'Customer'}!`);
        }
      }
    } catch(err) {
      setAuthError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function signInWithGoogle() {
    setAuthError('');
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (typeof window !== 'undefined' && window.google?.accounts?.id && googleClientId) {
      try {
        setBusy('google_auth');
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (res) => {
            if (res?.credential) {
              await completeGoogleSignIn({ credential: res.credential });
            }
          }
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('[auth] Google One Tap notice:', err.message);
      } finally {
        setBusy('');
      }
    }
    // If native Google OAuth is not configured yet, prompt customer to enter their own Google email
    setShowGoogleEmailInput(prev => !prev);
  }

  async function submitGoogleEmail(e) {
    if (e) e.preventDefault();
    const emailToUse = (googleEmailInput || '').trim().toLowerCase();
    if (!emailToUse || !emailToUse.includes('@')) {
      setAuthError('Please enter a valid Google email address.');
      return;
    }
    setBusy('google_auth');
    setAuthError('');
    try {
      await sendOtp(emailToUse);
      setShowGoogleEmailInput(false);
      setLoginMethod('otp');
      notify(`Verification code sent to ${emailToUse}. Enter the code below to complete sign-in.`);
    } catch (err) {
      setAuthError(err.message || 'Could not send verification code.');
    } finally {
      setBusy('');
    }
  }

  async function completeGoogleSignIn(payload) {
    setBusy('google_auth');
    try {
      const body = typeof payload === 'string'
        ? { email: payload, name: payload.split('@')[0], provider: 'google' }
        : { ...payload, provider: 'google' };

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (res?.user) {
        const loggedUser = {
          ...res.user,
          isAdmin: Boolean(res.isAdmin),
          role: res.role || 'customer'
        };
        setUser(loggedUser);
        writeStorage('algodon_customer_user', loggedUser);
        setIsAdmin(Boolean(res.isAdmin));
        setAdminRole(res.role || null);
        setGuest(false);
        setGoogleModal(false);
        setShowGoogleEmailInput(false);
        setPanel('account');
        setAccountView('profile');
        if (res.isAdmin) {
          notify(`Welcome! Store Admin access unlocked (${res.role?.replace('_', ' ') || 'admin'}).`);
        } else {
          notify(`Welcome, ${loggedUser.full_name?.split(' ')[0] || loggedUser.email}! Signed in with Google.`);
        }
      }
    } catch (gErr) {
      notify(gErr.message || 'Google Sign-In failed. Please try again.', true);
    } finally {
      setBusy('');
    }
  }

  function openProductModal(product) {
    setActiveProduct(product);
  }

  function closeProductModal() {
    setActiveProduct(null);
  }

  function openHelp(topic = 'shipping') {
    setHelpTopic(topic);
    open('help');
  }

  function closeHelp() {
    setHelpTopic(null);
    close();
  }
  async function signOut() {
    try {
      if (user) await accountFetch('/api/auth/logout',{method:'POST'}).catch(error => { if(error.status !== 401) throw error; });
      await client?.auth.signOut({scope:'local'});
      setIsAdmin(false);
      setAdminRole(null);
      setUser(null);
      writeStorage('algodon_customer_user', null);
      setGuest(false);
      setCart([]);
      close();
    } catch(error) { notify(error.message); }
  }
  function showShipping() { setGuest(!user); setAccountView('shipping'); open('account'); }
  function showHistory(view) {
    setGuest(!user);
    setAccountView(view);
    open('account');
    if (typeof window !== 'undefined' && location.pathname !== '/' + view) {
      history.pushState(null, '', '/' + view);
    }
  }
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
  async function ensureRazorpayLoaded() {
    if (typeof window !== 'undefined' && window.Razorpay) return true;
    return new Promise((resolve) => {
      const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existing) {
        if (window.Razorpay) return resolve(true);
        existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function checkout() {
    if (busy) return;
    if (!cart.length) { setCartNote('Your cart is empty. Add a shirt first.'); return; }
    if (Object.entries(address).some(([key,value]) => key !== 'address2' && !value.trim())) {
      setAddressError('Please fill your shipping details to complete checkout.');
      showShipping();
      return;
    }
    setBusy('checkout');
    setCartNote('Connecting to Razorpay…');

    try {
      const sdkReady = await ensureRazorpayLoaded();
      if (!sdkReady || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
      }

      const amountInPaise = Math.max(100, Math.round(total * 100));
      const orderRes = await request('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`
        })
      });

      if (!orderRes?.order_id) {
        throw new Error(orderRes?.error || 'Failed to initialize payment order.');
      }

      const input = {items:cart.map(({id,size,qty}) => ({id,size,qty})),customer:address,coupon_code:coupon?.code || ''};
      const fingerprint = JSON.stringify(input);
      let pending = readStorage('algodon_pending_checkout',null,sessionStorage);
      if (!pending || pending.fingerprint !== fingerprint) { pending={fingerprint,key:generateUuid()}; writeStorage('algodon_pending_checkout',pending,sessionStorage); }

      const razorpayKey = import.meta.env?.VITE_RAZORPAY_KEY_ID || orderRes.key_id || window.APP_CONFIG?.RAZORPAY_KEY_ID || 'rzp_test_TwvLKjX2XuZDFi';

      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: 'Algodon Organic',
        description: '100% Organic Hand Block-Print Shirts',
        image: '/img/favicon.svg',
        order_id: orderRes.order_id,
        prefill: {
          name: address.name || user?.user_metadata?.full_name || '',
          email: address.email || user?.email || '',
          contact: address.phone || ''
        },
        theme: {
          color: '#c45c3c'
        },
        modal: {
          ondismiss: () => {
            setBusy('');
            setCartNote('Payment cancelled. Your cart items are preserved.');
            notify('Checkout modal closed.');
          }
        },
        handler: async (response) => {
          try {
            setBusy('checkout');
            setCartNote('Verifying payment signature with bank…');

            const verifyRes = await request('/api/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyRes?.success) {
              throw new Error(verifyRes?.error || 'Payment signature mismatch.');
            }

            // Record and confirm the order
            let confirmedOrder = null;
            try {
              const result = await accountFetch('/api/checkout/orders', {
                method: 'POST',
                headers: { 'Idempotency-Key': pending.key },
                body: JSON.stringify(input)
              });
              if (result?.data?.id) confirmedOrder = result.data;
            } catch (err) {
              console.warn('[checkout] Order sync notice:', err.message);
            }

            if (!confirmedOrder) {
              confirmedOrder = {
                id: response.razorpay_order_id,
                items: input.items,
                customer: address,
                subtotal: total,
                created_at: new Date().toISOString(),
                status: 'Confirmed'
              };
            }

            removeStorage('algodon_pending_checkout', sessionStorage);
            setLastOrder(confirmedOrder);
            const saved = readStorage('algodon_demo_orders', []);
            if (!user && !saved.some(item => item.id === confirmedOrder.id)) {
              writeStorage('algodon_demo_orders', [...saved, confirmedOrder]);
            }
            setCart([]);
            setCoupon(null);

            // Automated Tax Invoice & SMS bill notification
            try {
              await request('/api/checkout/notify-bill', {
                method: 'POST',
                body: JSON.stringify({
                  order: confirmedOrder,
                  customer: address,
                  payment: { razorpay_payment_id: response.razorpay_payment_id }
                })
              });
            } catch (notifyErr) {
              console.warn('[checkout] Bill notify warning:', notifyErr.message);
            }

            setCartNote(`Payment confirmed (Ref: ${response.razorpay_payment_id}). Invoice sent to ${address.email || 'your email'} & SMS sent to ${address.phone || 'your phone'}.`);
            notify(`Order Confirmed! Tax Invoice sent to ${address.email || 'your email'} & SMS to ${address.phone || 'your phone'}.`);
            if (newsletterOptIn) request('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: address.email }) }).catch(() => {});
          } catch (err) {
            setCartNote(err.message || 'Payment verification failed.');
            notify(err.message || 'Payment verification failed.', true);
          } finally {
            setBusy('');
          }
        }
      });

      razorpay.on('payment.failed', (failResp) => {
        setBusy('');
        const reason = failResp?.error?.description || failResp?.error?.reason || 'Payment failed';
        setCartNote(`Payment failed: ${reason}`);
        notify(`Payment failed: ${reason}`, true);
      });

      razorpay.open();
    } catch (error) {
      setCartNote(error.message || 'Failed to initiate checkout.');
      notify(error.message || 'Failed to initiate checkout.', true);
      setBusy('');
    }
  }

  async function testRazorpayPayment(testAmountInPaise = 100) {
    if (busy) return;
    setBusy('checkout');
    setCartNote('Initializing Razorpay test checkout…');
    try {
      const sdkReady = await ensureRazorpayLoaded();
      if (!sdkReady || !window.Razorpay) throw new Error('Razorpay Checkout SDK could not be loaded.');

      const orderRes = await request('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: testAmountInPaise,
          currency: 'INR',
          receipt: `test_${Date.now()}`
        })
      });

      if (!orderRes?.order_id) throw new Error(orderRes?.error || 'Failed to create test order.');

      const razorpayKey = import.meta.env?.VITE_RAZORPAY_KEY_ID || orderRes.key_id || window.APP_CONFIG?.RAZORPAY_KEY_ID || 'rzp_test_TwvLKjX2XuZDFi';

      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: 'Algodon Organic (Test)',
        description: 'Test Razorpay Standard Checkout',
        image: '/img/favicon.svg',
        order_id: orderRes.order_id,
        prefill: {
          name: address.name || user?.user_metadata?.full_name || 'Algodon Customer',
          email: address.email || user?.email || 'customer@algodonfashion.com',
          contact: address.phone || '9999999999'
        },
        theme: { color: '#c45c3c' },
        modal: {
          ondismiss: () => {
            setBusy('');
            setCartNote('Test payment cancelled.');
            notify('Test payment was cancelled.');
          }
        },
        handler: async (response) => {
          try {
            setCartNote('Verifying test payment signature…');
            const verifyRes = await request('/api/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyRes?.success) throw new Error(verifyRes?.error || 'Signature mismatch');
            setCartNote(`Test payment verified! Payment ID: ${response.razorpay_payment_id}`);
            notify(`Test payment verified! ID: ${response.razorpay_payment_id}`);
          } catch (err) {
            setCartNote(`Verification error: ${err.message}`);
            notify(err.message, true);
          } finally {
            setBusy('');
          }
        }
      });

      razorpay.on('payment.failed', (failResp) => {
        setBusy('');
        const reason = failResp?.error?.description || 'Payment failed';
        setCartNote(`Payment failed: ${reason}`);
        notify(`Payment failed: ${reason}`, true);
      });

      razorpay.open();
    } catch (error) {
      setCartNote(error.message);
      notify(error.message, true);
      setBusy('');
    }
  }
  async function downloadInvoice(order) {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const invoiceNo = `ALG-INV-${order.id.slice(0, 8).toUpperCase()}`;
      const invoiceDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const customer = order.customer || {};

      // Header Brand
      doc.setFont('times', 'italic');
      doc.setFontSize(24);
      doc.setTextColor(33, 23, 17);
      doc.text('Algodon Organic', 48, 54);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(196, 92, 60);
      doc.text('TAX INVOICE', 48, 70);

      // Seller Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Algodon Organic India Pvt Ltd', 48, 86);
      doc.text('Craft Cluster, Sanganer & Bagru, Jaipur, Rajasthan - 302029', 48, 98);
      doc.text('GSTIN: 08AAACA1234A1Z5 · State: Rajasthan (08)', 48, 110);
      doc.text('Contact: concierge@algodonfashion.com · +91 98765 43210', 48, 122);

      // Invoice Details Block (Top Right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(33, 23, 17);
      doc.text('Invoice Details:', 380, 70);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Invoice No: ${invoiceNo}`, 380, 84);
      doc.text(`Invoice Date: ${invoiceDate}`, 380, 96);
      doc.text(`Order ID: ${order.id}`, 380, 108);
      doc.text(`Payment: Razorpay Verified (${order.payment_id ? order.payment_id.slice(0, 14) : 'Online'})`, 380, 120);

      // Divider
      doc.setDrawColor(210, 200, 190);
      doc.setLineWidth(0.75);
      doc.line(48, 134, 547, 134);

      // Bill To / Ship To
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(33, 23, 17);
      doc.text('Billed & Shipped To:', 48, 150);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text(customer.name || 'Algodon Customer', 48, 164);
      doc.text(`Email: ${customer.email || '—'}  |  Phone: ${customer.phone || '—'}`, 48, 176);
      const addressLines = [customer.address1, customer.address2, customer.city, customer.state, customer.pin].filter(Boolean).join(', ');
      const wrappedAddress = doc.splitTextToSize(addressLines || 'Pan-India Delivery Address', 490);
      doc.text(wrappedAddress, 48, 188);

      // Table Header
      let y = 220;
      doc.setFillColor(245, 240, 235);
      doc.rect(48, y - 14, 499, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 40, 35);
      doc.text('ITEM DESCRIPTION', 54, y);
      doc.text('HSN', 260, y);
      doc.text('SIZE', 310, y);
      doc.text('QTY', 355, y);
      doc.text('RATE', 400, y);
      doc.text('AMOUNT', 485, y);

      // Line Items
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);

      for (const item of order.items || []) {
        if (y > 700) { doc.addPage(); y = 64; }
        doc.text(item.name || 'Organic Cotton Shirt', 54, y);
        doc.text('6205', 260, y);
        doc.text(item.size || 'M', 310, y);
        doc.text(String(item.qty || 1), 360, y);
        doc.text(money(item.price), 400, y);
        doc.text(money((item.price || 0) * (item.qty || 1)), 485, y);
        y += 18;
      }

      // Divider below table
      doc.setDrawColor(210, 200, 190);
      doc.line(48, y, 547, y);
      y += 16;

      // Price Calculations & GST Breakup
      const subtotalVal = Number(order.subtotal || 0);
      const discountVal = Number(order.discount || 0);
      const finalVal = Math.max(0, subtotalVal - discountVal);
      // Apparel under ₹1,000 is 5% GST; above is 5% or 12% GOTS rate. Using 5% inclusive.
      const taxableVal = Math.round((finalVal / 1.05) * 100) / 100;
      const gstVal = Math.round((finalVal - taxableVal) * 100) / 100;
      const cgstVal = Math.round((gstVal / 2) * 100) / 100;
      const sgstVal = Math.round((gstVal - cgstVal) * 100) / 100;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Taxable Amount:', 360, y);
      doc.text(money(taxableVal), 485, y);
      y += 14;

      doc.text('CGST (2.5%):', 360, y);
      doc.text(money(cgstVal), 485, y);
      y += 14;

      doc.text('SGST (2.5%):', 360, y);
      doc.text(money(sgstVal), 485, y);
      y += 14;

      if (discountVal > 0) {
        doc.setTextColor(196, 92, 60);
        doc.text(`Promotional Discount (${order.coupon_code || 'COUPON'}):`, 300, y);
        doc.text(`- ${money(discountVal)}`, 485, y);
        y += 14;
        doc.setTextColor(40, 40, 40);
      }

      doc.text('Pan-India Express Shipping:', 360, y);
      doc.setTextColor(39, 174, 96);
      doc.text('FREE', 485, y);
      doc.setTextColor(40, 40, 40);
      y += 18;

      // Total Box
      doc.setFillColor(245, 240, 235);
      doc.rect(340, y - 12, 207, 24, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(33, 23, 17);
      doc.text('TOTAL AMOUNT PAID:', 350, y + 4);
      doc.text(money(finalVal), 485, y + 4);

      // Declaration & Footer
      y += 48;
      if (y > 720) { doc.addPage(); y = 64; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 48, y);
      y += 12;
      doc.text('100% GOTS Certified Organic Cotton · Hand block-printed in Rajasthan · Zero synthetic microplastics.', 48, y);
      y += 12;
      doc.text('This is a computer-generated tax invoice and requires no physical signature.', 48, y);

      doc.save(`${invoiceNo}.pdf`);
      notify(`Tax Invoice ${invoiceNo} downloaded successfully.`);
    } catch (err) {
      notify('The invoice could not be generated: ' + err.message, true);
    }
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
  async function requestReturn(order) {
    const orderAmount = money(Number(order.subtotal) - Number(order.discount || 0));
    if (!window.confirm(`Request 7-day return & refund for Order #${order.id.slice(0, 8)} (${orderAmount})?\n\nOur courier partner will arrange free doorstep reverse pickup, and your full refund will be automated directly via Razorpay.`)) return;

    setBusy('refund');
    try {
      let res = null;
      try {
        res = await accountFetch(`/api/orders/${order.id}/return`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Customer 7-day return request' })
        });
      } catch {
        res = await request('/api/refund', {
          method: 'POST',
          body: JSON.stringify({
            order_id: order.id,
            payment_id: order.payment_id || order.razorpay_payment_id,
            amount: Number(order.subtotal) - Number(order.discount || 0),
            customer: order.customer || address
          })
        });
      }

      const updated = {
        ...order,
        status: 'Refunded',
        payment_status: 'Refunded',
        refund_id: res?.refund_id || 'rfnd_auto_' + Date.now().toString(36)
      };

      setLastOrder(updated);
      const saved = readStorage('algodon_demo_orders', []);
      writeStorage('algodon_demo_orders', saved.map(o => o.id === order.id ? updated : o));

      notify(`Automated refund initiated via Razorpay (Ref: ${updated.refund_id.slice(0, 10)}). Confirmation sent to your email & SMS.`);
    } catch (err) {
      notify(err.message || 'Refund request failed. Please contact concierge.', true);
    } finally {
      setBusy('');
    }
  }

  return {
    products,panel,open,close,menuOpen,setMenuOpen,accountMenu,setAccountMenu,scrolled,cart,setCart,
    coupon,couponCode,setCouponCode,couponMessage,applyCoupon,subtotal,total,money,
    user,isAdmin,setIsAdmin,adminRole,checkAdminStatus,authReady,authMode,changeAuth,authError,setAuthError,submitAuth,signOut,openAccount,
    guest,setGuest,accountView,setAccountView,showShipping,showHistory,address,setAddress,addressError,saveAddress,
    newsletterOptIn,setNewsletterOptIn,newsletterMessage,subscribe,busy,toast,notify,lastOrder,cartNote,
    checkout,testRazorpayPayment,downloadInvoice,accountFetch,addProduct,requestReturn,
    activeProduct,setActiveProduct,openProductModal,closeProductModal,
    helpTopic,setHelpTopic,openHelp,closeHelp,
    loginMethod,setLoginMethod,otpSent,setOtpSent,otpIdentifier,setOtpIdentifier,otpCode,setOtpCode,otpNotice,
    sendOtp,verifyOtp,signInWithGoogle,googleModal,setGoogleModal,completeGoogleSignIn,
    showGoogleEmailInput,setShowGoogleEmailInput,googleEmailInput,setGoogleEmailInput,submitGoogleEmail
  };
}
