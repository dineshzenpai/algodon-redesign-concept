import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../shared/api.js';
import { AdminContext } from './context.jsx';
import { Button, Modal } from './ui.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Categories } from './Catalog.jsx';
import { Orders, Customers, Coupons, Staff, Activity } from './Management.jsx';
import './styles.css';

const navigation=[['dashboard','Overview'],['products','Products'],['categories','Categories'],['orders','Orders'],['coupons','Coupons'],['customers','Customers'],['staff','Team'],['activity','Activity log']];
export default function Admin(){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),[page,setPage]=useState('dashboard'),[revision,setRevision]=useState(0),[modal,setModal]=useState(null),[toast,setToast]=useState(null);
  const timer=useRef(),notifyTimer=useRef();
  const api=useCallback(async(path,options={})=>{
    try{return await request('/api/admin'+path,{...options,headers:{'X-Admin-Request':'1',...options.headers}});}
    catch(error){if(error.status===401){setUser(null);setModal(null);}throw error;}
  },[]);
  const notify=useCallback((message,error=false)=>{setToast({message,error});clearTimeout(notifyTimer.current);notifyTimer.current=setTimeout(()=>setToast(null),2800);},[]);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]),closeModal=useCallback(()=>setModal(null),[]);
  const logout=useCallback(async()=>{try{await api('/auth/logout',{method:'POST'});}catch(error){notify(error.message,true);}finally{setUser(null);setModal(null);}},[api,notify]);
  function onLogin(account){setUser(account);setPage(account.role==='support'?'orders':'dashboard');}
  useEffect(()=>{
    document.title='Admin · Algodon Organic';
    const font=document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    if(font)font.href='https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&family=Archivo:wght@400;500;600;700&display=swap';
    let dark=false;try{dark=localStorage.getItem('algodon-admin-dark')==='1';}catch{}
    document.body.classList.toggle('dark',dark);
    let cancelled=false;api('/me').then(result=>{if(!cancelled)onLogin(result.user);}).catch(()=>{}).finally(()=>{if(!cancelled)setReady(true);});
    return()=>{cancelled=true;clearTimeout(timer.current);clearTimeout(notifyTimer.current);};
  },[api]);
  useEffect(()=>{
    if(ready&&!user)location.replace('/account');
  },[ready,user]);
  useEffect(()=>{
    if(!user)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(logout,20*60*1000);};
    reset();for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,reset,{passive:true});
    return()=>{clearTimeout(timer.current);for(const event of ['pointerdown','keydown','scroll'])window.removeEventListener(event,reset);};
  },[user,logout]);
  const pages={dashboard:Dashboard,products:Products,categories:Categories,orders:Orders,coupons:Coupons,customers:Customers,staff:Staff,activity:Activity},Page=pages[page];
  const allowed=navigation.filter(([key])=>user?.role==='support'?['products','orders','customers'].includes(key):!['staff','activity'].includes(key)||user?.role==='super_admin');
  const context={user,api,revision,refresh,notify,closeModal,openModal:setModal,canEdit:['super_admin','manager'].includes(user?.role)};
  return <AdminContext.Provider value={context}>{!ready||!user?<div className="loading-screen">Algodon Organic · Admin</div>:<div className="shell"><aside className="sidebar"><div className="brand">Algodon Organic<small>Store administration</small></div><nav className="nav">{allowed.map(([key,label])=><Button key={key} data-page={key} className={page===key?'active':''} onClick={()=>{setModal(null);setPage(key);}}>{label}</Button>)}</nav><div className="sidebar-bottom"><div className="user-badge">{user.email}<br/>{user.role.replaceAll('_',' ')}</div></div></aside><main className="main"><div className="topbar"><h1>{navigation.find(([key])=>key===page)?.[1]}</h1><div className="top-actions"><Button id="logoutBtn" onClick={logout}>Sign out</Button><Button id="themeBtn" title="Toggle light and dark mode" onClick={()=>{document.body.classList.toggle('dark');try{localStorage.setItem('algodon-admin-dark',document.body.classList.contains('dark')?'1':'0');}catch{}}}>◐</Button><span className="user-badge" style={{color:'var(--soft)'}}>{user.role.replaceAll('_',' ')}</span></div></div><div className="content"><Page key={page}/></div></main></div>}{modal&&user&&<Modal close={closeModal}>{modal}</Modal>}<div id="toast" className={'toast'+(toast?' show':'')} role="status" aria-live="polite" style={{background:toast?.error?'#8c3f3a':''}}>{toast?.message}</div></AdminContext.Provider>;
}
