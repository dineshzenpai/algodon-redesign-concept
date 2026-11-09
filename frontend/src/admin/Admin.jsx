import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../shared/api.js';
import { AdminContext } from './context.jsx';
import { Button, Modal } from './ui.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Categories } from './Catalog.jsx';
import { Orders, Customers, Coupons, Staff, Activity } from './Management.jsx';
import { Settings } from './Settings.jsx';
import './styles.css';

const navigation=[['dashboard','Overview'],['products','Products'],['categories','Categories'],['orders','Orders'],['coupons','Coupons'],['customers','Customers'],['staff','Team'],['activity','Activity log'],['settings','Settings']];

export default function Admin({ onClose, isEmbedded } = {}){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),[page,setPage]=useState('dashboard'),[revision,setRevision]=useState(0),[modal,setModal]=useState(null),[toast,setToast]=useState(null),[loginError,setLoginError]=useState(''),[loginBusy,setLoginBusy]=useState(false);
  const timer=useRef(),notifyTimer=useRef();

  const api=useCallback(async(path,options={})=>{
    let adminToken = '';
    try { adminToken = localStorage.getItem('algodon_admin_token') || ''; } catch {}
    const headers = {
      'X-Admin-Request': '1',
      ...(adminToken ? { 'X-Admin-Session': adminToken } : {}),
      ...options.headers
    };
    try{return await request('/api/admin'+path,{...options,headers});}
    catch(error){
      if(error.status===401){
        try{localStorage.removeItem('algodon_admin_token');}catch{}
        setUser(null);setModal(null);
      }
      throw error;
    }
  },[]);

  const notify=useCallback((message,error=false)=>{setToast({message,error});clearTimeout(notifyTimer.current);notifyTimer.current=setTimeout(()=>setToast(null),2800);},[]);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]),closeModal=useCallback(()=>setModal(null),[]);
  const logout=useCallback(async()=>{
    try{await api('/auth/logout',{method:'POST'});}
    catch(error){notify(error.message,true);}
    finally{
      try{localStorage.removeItem('algodon_admin_token');}catch{}
      try{localStorage.removeItem('algodon_customer_token');}catch{}
      try{localStorage.removeItem('algodon_customer_user');}catch{}
      setUser(null);setModal(null);
      if(typeof onClose === 'function'){
        onClose();
      }
      if(typeof window !== 'undefined'){
        window.location.href = '/';
      }
    }
  },[api,notify,onClose]);

  function onLogin(account){setUser(account);setPage(account.role==='support'?'orders':'dashboard');}

  async function submitLogin(event){
    event.preventDefault();setLoginBusy(true);setLoginError('');
    const form=new FormData(event.currentTarget);
    const email=String(form.get('email')||'').trim().toLowerCase();
    const password=String(form.get('password')||'');
    try{
      const res = await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      if(res?.token){
        try{localStorage.setItem('algodon_admin_token',res.token);}catch{}
      }
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
    let dark = false;
    try {
      const saved = localStorage.getItem('algodon-admin-dark');
      dark = saved !== null ? saved === '1' : Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    } catch {}
    document.body.classList.toggle('dark', dark);
    let cancelled=false;
    api('/me').then(result=>{if(!cancelled)onLogin(result.user);}).catch(error=>{
      if(!cancelled&&error.status!==401)setLoginError(error.message);
    }).finally(()=>{if(!cancelled)setReady(true);});
    return()=>{cancelled=true;clearTimeout(timer.current);clearTimeout(notifyTimer.current);};
  },[api]);

  useEffect(()=>{
    if(!user)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(logout,20*60*1000);};
    reset();for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,reset,{passive:true});
    return()=>{clearTimeout(timer.current);for(const event of ['pointerdown','keydown','scroll'])window.removeEventListener(event,reset);};
  },[user,logout]);

  useEffect(() => {
    if (ready && !user) {
      if (typeof onClose === 'function') onClose();
      else if (typeof window !== 'undefined') window.location.href = '/';
    }
  }, [ready, user, onClose]);

  const pages={dashboard:Dashboard,products:Products,categories:Categories,orders:Orders,coupons:Coupons,customers:Customers,staff:Staff,activity:Activity,settings:Settings},Page=pages[page];
  const allowed=navigation.filter(([key])=>user?.role==='support'?['products','orders','customers'].includes(key):!['staff','activity'].includes(key)||user?.role==='super_admin');
  const context={user,api,revision,refresh,notify,closeModal,openModal:setModal,canEdit:['super_admin','manager'].includes(user?.role)};

  return <AdminContext.Provider value={context}>{!ready||!user?<div className="loading-screen">Algodon Organic · Admin</div>:<div className="shell"><aside className="sidebar"><a href="/" onClick={onClose ? (e) => { e.preventDefault(); onClose(); } : undefined} className="brand" title="View Storefront" style={{textDecoration:'none',color:'inherit',display:'block'}}>Algodon Organic<small>Store administration ↗</small></a><nav className="nav">{allowed.map(([key,label])=><Button key={key} data-page={key} className={page===key?'active':''} onClick={()=>{setModal(null);setPage(key);}}>{label}</Button>)}</nav><div className="sidebar-bottom"><div className="user-badge">{user.email}<br/>{user.role.replaceAll('_',' ')}</div></div></aside><main className="main"><div className="topbar"><h1>{navigation.find(([key])=>key===page)?.[1]}</h1><div className="top-actions"><span className="live-pill" title="Live sync active: updates every 3.5s"><span className="live-dot" />Live</span><Button id="adminRefreshBtn" onClick={refresh} title="Fetch latest data now">⟳ Refresh</Button>{isEmbedded&&<Button id="returnStoreBtn" onClick={onClose} style={{background:'var(--admin-accent)',borderColor:'var(--admin-accent)',color:'#fff'}}>← Back to Store</Button>}<Button id="themeBtn" title="Toggle light and dark mode" onClick={()=>{const isDark=document.body.classList.toggle('dark');try{localStorage.setItem('algodon-admin-dark',isDark?'1':'0');}catch{}}}>◐ Theme</Button><Button id="logoutBtn" onClick={logout}>Sign out</Button><span className="user-badge" style={{color:'var(--admin-ink-muted)',fontWeight:600}}>{user.role.replaceAll('_',' ')}</span></div></div><div className="content"><Page key={page}/></div></main></div>}{modal&&user&&<Modal close={closeModal}>{modal}</Modal>}<div id="toast" className={'toast'+(toast?' show':'')} role="status" aria-live="polite" style={{position:'fixed',zIndex:100001,bottom:'20px',right:'20px',background:toast?.error?'#8c3f3a':'#211c16',color:'#fff',padding:'12px 18px',borderRadius:'8px',boxShadow:'0 10px 30px rgba(0,0,0,0.5)',pointerEvents:'none'}}>{toast?.message}</div></AdminContext.Provider>;
}
