import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../shared/api.js';
import { AdminContext } from './context.jsx';
import { Button, Modal } from './ui.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Categories } from './Catalog.jsx';
import { Orders, Customers, Coupons, Staff, Activity } from './Management.jsx';
import './styles.css';

const navigation=[['dashboard','Overview'],['products','Products'],['categories','Categories'],['orders','Orders'],['coupons','Coupons'],['customers','Customers'],['staff','Team'],['activity','Activity log']];
function AdminLogin({onSubmit,error,busy}){
  return <main className="login-wrap"><section className="login-card"><div className="brand">Algodon Organic<small>Store administration</small></div><h1>Admin sign in</h1><p>Sign in with an authorized administrator account.</p><form id="adminLoginForm" onSubmit={onSubmit}><div className="field"><label htmlFor="adminEmail">Email</label><input id="adminEmail" name="email" type="email" autoComplete="username" required/></div><div className="field"><label htmlFor="adminPassword">Password</label><input id="adminPassword" name="password" type="password" autoComplete="current-password" required/></div><p id="adminLoginError" className="error" role="alert">{error}</p><button id="adminLoginSubmit" className="btn primary" type="submit" disabled={busy}>{busy?'Verifying…':'Sign in'}</button></form></section></main>;
}
export default function Admin(){
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
  async function submitLogin(event){
    event.preventDefault();setLoginBusy(true);setLoginError('');
    const form=new FormData(event.currentTarget);
    try{
      await api('/auth/login',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});
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
    let cancelled=false;api('/me').then(result=>{if(!cancelled)onLogin(result.user);}).catch(error=>{if(!cancelled&&error.status!==401)setLoginError(error.message);}).finally(()=>{if(!cancelled)setReady(true);});
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
  return <AdminContext.Provider value={context}>{!ready?<div className="loading-screen">Algodon Organic · Admin</div>:!user?<AdminLogin onSubmit={submitLogin} error={loginError} busy={loginBusy}/>:<div className="shell"><aside className="sidebar"><div className="brand">Algodon Organic<small>Store administration</small></div><nav className="nav">{allowed.map(([key,label])=><Button key={key} data-page={key} className={page===key?'active':''} onClick={()=>{setModal(null);setPage(key);}}>{label}</Button>)}</nav><div className="sidebar-bottom"><div className="user-badge">{user.email}<br/>{user.role.replaceAll('_',' ')}</div></div></aside><main className="main"><div className="topbar"><h1>{navigation.find(([key])=>key===page)?.[1]}</h1><div className="top-actions"><Button id="logoutBtn" onClick={logout}>Sign out</Button><Button id="themeBtn" title="Toggle light and dark mode" onClick={()=>{document.body.classList.toggle('dark');try{localStorage.setItem('algodon-admin-dark',document.body.classList.contains('dark')?'1':'0');}catch{}}}>◐</Button><span className="user-badge" style={{color:'var(--soft)'}}>{user.role.replaceAll('_',' ')}</span></div></div><div className="content"><Page key={page}/></div></main></div>}{modal&&user&&<Modal close={closeModal}>{modal}</Modal>}<div id="toast" className={'toast'+(toast?' show':'')} role="status" aria-live="polite" style={{background:toast?.error?'#8c3f3a':''}}>{toast?.message}</div></AdminContext.Provider>;
}
