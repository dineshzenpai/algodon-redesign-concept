import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../shared/api.js';
import { AdminContext } from './context.jsx';
import { Button, Modal } from './ui.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Categories } from './Catalog.jsx';
import { Orders, Customers, Coupons, Staff, Activity } from './Management.jsx';
import './styles.css';

const navigation=[['dashboard','Overview'],['products','Products'],['categories','Categories'],['orders','Orders'],['coupons','Coupons'],['customers','Customers'],['staff','Team'],['activity','Activity log']];

function AdminLogin({onSubmit,onGoogleSignIn,error,busy,onClose}){
  return <main className="login-wrap"><section className="login-card"><div className="brand">Algodon Organic<small>Store administration</small></div><h1>Admin sign in</h1><p>Sign in with your authorized administrator account to access the store management dashboard.</p><button type="button" id="adminGoogleSignInBtn" className="btn" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',padding:'12px 16px',fontSize:'0.92rem',fontWeight:600,background:'#ffffff',color:'#1f2937',border:'1px solid #d1d5db',borderRadius:'6px',marginBottom:'16px',cursor:'pointer'}} disabled={busy} onClick={onGoogleSignIn}><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>{busy?'Connecting…':'Continue with Google'}</button><div style={{display:'flex',alignItems:'center',margin:'16px 0',gap:'10px'}}><div style={{flex:1,height:'1px',background:'var(--line,#333)'}}/><span style={{fontSize:'0.78rem',color:'var(--soft,#888)'}}>or sign in with password</span><div style={{flex:1,height:'1px',background:'var(--line,#333)'}}/></div><form id="adminLoginForm" onSubmit={onSubmit}><div className="field"><label htmlFor="adminEmail">Email</label><input id="adminEmail" name="email" type="email" defaultValue="algdondatabase@gmail.com" placeholder="algdondatabase@gmail.com" autoComplete="username" required/></div><div className="field"><label htmlFor="adminPassword">Password</label><input id="adminPassword" name="password" type="password" placeholder="••••••••••••" autoComplete="current-password" required/></div>{error&&<p id="adminLoginError" className="error" role="alert">{error}</p>}<button id="adminLoginSubmit" className="btn primary" type="submit" disabled={busy}>{busy?'Verifying…':'Sign in'}</button></form><div style={{marginTop:'20px',paddingTop:'16px',borderTop:'1px solid var(--line,#333)',textAlign:'center'}}><a href="/" onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined} style={{fontSize:'0.82rem',color:'var(--soft,#888)',textDecoration:'none'}}>← Back to Storefront</a></div></section></main>;
}

export default function Admin({ onClose, isEmbedded } = {}){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),[page,setPage]=useState('dashboard'),[revision,setRevision]=useState(0),[modal,setModal]=useState(null),[toast,setToast]=useState(null),[loginError,setLoginError]=useState(''),[loginBusy,setLoginBusy]=useState(false);
  const timer=useRef(),notifyTimer=useRef();

  const api=useCallback(async(path,options={})=>{
    try{return await request('/api/admin'+path,{...options,headers:{'X-Admin-Request':'1',...options.headers}});}
    catch(error){if(error.status===401){setUser(null);setModal(null);}throw error;}
  },[]);

  const notify=useCallback((message,error=false)=>{setToast({message,error});clearTimeout(notifyTimer.current);notifyTimer.current=setTimeout(()=>setToast(null),2800);},[]);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]),closeModal=useCallback(()=>setModal(null),[]);
  const logout=useCallback(async()=>{try{await api('/auth/logout',{method:'POST'});}catch(error){notify(error.message,true);}finally{setUser(null);setModal(null);}},[api,notify]);

  function onLogin(account){setUser(account);setPage(account.role==='support'?'orders':'dashboard');}

  async function onGoogleSignIn(){
    setLoginBusy(true);setLoginError('');
    try {
      const config = await request('/api/config').catch(() => ({}));
      if (config?.supabase?.url && config?.supabase?.publishableKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(config.supabase.url, config.supabase.publishableKey);
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/admin`
          : 'https://www.algodonfashion.com/admin';
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: 'select_account' }
          }
        });
        if (error) throw error;
        if (data?.url) { window.location.href = data.url; return; }
      }
      const result = await request('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ email: 'algdondatabase@gmail.com', name: 'Algodon Admin', provider: 'google' })
      });
      if (result?.isAdmin) {
        onLogin({ email: 'algdondatabase@gmail.com', role: 'super_admin' });
      } else {
        throw new Error(result?.error || 'This Google account does not have admin access.');
      }
    } catch(err) {
      setLoginError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function submitLogin(event){
    event.preventDefault();setLoginBusy(true);setLoginError('');
    const form=new FormData(event.currentTarget);
    const email=String(form.get('email')||'').trim().toLowerCase();
    const password=String(form.get('password')||'');
    try{
      await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      const result=await api('/me'),account=result.user;
      if(!account||!['super_admin','manager','support'].includes(account.role))throw new Error('This account does not have admin access.');
      onLogin(account);
    }catch(error){setLoginError(error.message);}
    finally{setLoginBusy(false);}
  }

  useEffect(()=>{
    document.title='Admin · Algodon Organic';
    const font=document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    if(font)font.href='https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&family=Archivo:wght@400;500;600;700&display=swap';
    let dark=false;try{dark=localStorage.getItem('algodon-admin-dark')==='1';}catch{}
    document.body.classList.toggle('dark',dark);
    let cancelled=false;
    api('/me').then(result=>{if(!cancelled)onLogin(result.user);}).catch(error=>{
      if(!cancelled&&error.status!==401)setLoginError(error.message);
      request('/api/config').then(async (config) => {
        if (cancelled || !config?.supabase?.url || !config?.supabase?.publishableKey) return;
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(config.supabase.url, config.supabase.publishableKey);
          const sessionRes = await supabase.auth.getSession();
          const googleUser = sessionRes?.data?.session?.user;
          if (googleUser?.email) {
            const authRes = await request('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ email: googleUser.email, name: googleUser.user_metadata?.full_name || 'Admin', provider: 'google' })
            });
            if (authRes?.isAdmin && !cancelled) {
              onLogin({ email: googleUser.email, role: 'super_admin' });
            }
          }
        } catch {}
      }).catch(() => {});
    }).finally(()=>{if(!cancelled)setReady(true);});
    return()=>{cancelled=true;clearTimeout(timer.current);clearTimeout(notifyTimer.current);};
  },[api]);

  useEffect(()=>{
    if(!user)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(logout,20*60*1000);};
    reset();for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,reset,{passive:true});
    return()=>{clearTimeout(timer.current);for(const event of ['pointerdown','keydown','scroll'])window.removeEventListener(event,reset);};
  },[user,logout]);

  const pages={dashboard:Dashboard,products:Products,categories:Categories,orders:Orders,coupons:Coupons,customers:Customers,staff:Staff,activity:Activity},Page=pages[page];
  const allowed=navigation.filter(([key])=>user?.role==='support'?['products','orders','customers'].includes(key):!['staff','activity'].includes(key)||user?.role==='super_admin');
  const context={user,api,revision,refresh,notify,closeModal,openModal:setModal,canEdit:['super_admin','manager'].includes(user?.role)};

  return <AdminContext.Provider value={context}>{!ready?<div className="loading-screen">Algodon Organic · Admin</div>:!user?<AdminLogin onSubmit={submitLogin} onGoogleSignIn={onGoogleSignIn} error={loginError} busy={loginBusy} onClose={onClose}/>:<div className="shell"><aside className="sidebar"><a href="/" onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined} className="brand" title="View Storefront" style={{textDecoration:'none',color:'inherit',display:'block'}}>Algodon Organic<small>Store administration ↗</small></a><nav className="nav">{allowed.map(([key,label])=><Button key={key} data-page={key} className={page===key?'active':''} onClick={()=>{setModal(null);setPage(key);}}>{label}</Button>)}</nav><div className="sidebar-bottom"><div className="user-badge">{user.email}<br/>{user.role.replaceAll('_',' ')}</div></div></aside><main className="main"><div className="topbar"><h1>{navigation.find(([key])=>key===page)?.[1]}</h1><div className="top-actions">{isEmbedded&&<Button id="returnStoreBtn" onClick={onClose} style={{background:'var(--accent)',borderColor:'var(--accent)',color:'#fff'}}>← Back to Store</Button>}<Button id="logoutBtn" onClick={logout}>Sign out</Button><Button id="themeBtn" title="Toggle light and dark mode" onClick={()=>{document.body.classList.toggle('dark');try{localStorage.setItem('algodon-admin-dark',document.body.classList.contains('dark')?'1':'0');}catch{}}}>◐</Button><span className="user-badge" style={{color:'var(--soft)'}}>{user.role.replaceAll('_',' ')}</span></div></div><div className="content"><Page key={page}/></div></main></div>}{modal&&user&&<Modal close={closeModal}>{modal}</Modal>}<div id="toast" className={'toast'+(toast?' show':'')} role="status" aria-live="polite" style={{background:toast?.error?'#8c3f3a':''}}>{toast?.message}</div></AdminContext.Provider>;
}
