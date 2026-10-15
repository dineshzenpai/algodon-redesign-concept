import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../shared/api.js';
import { AdminContext } from './context.jsx';
import { Button, Modal } from './ui.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Categories } from './Catalog.jsx';
import { Orders, Customers, Coupons, Staff, Activity } from './Management.jsx';
import './styles.css';

const navigation=[['dashboard','Overview'],['products','Products'],['categories','Categories'],['orders','Orders'],['coupons','Coupons'],['customers','Customers'],['staff','Team'],['activity','Activity log']];
function Login({api,onLogin}) {
  const [mode,setMode]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('access_token')?'recovery':'signin');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const token=useRef(new URLSearchParams(location.hash.slice(1)).get('access_token'));
  async function submit(event){
    event.preventDefault();const form=event.currentTarget;setMessage('');setBusy(true);
    try {
      const input=Object.fromEntries(new FormData(form));
      if(mode==='recovery'){
        await api('/auth/password-update',{method:'POST',body:JSON.stringify({accessToken:token.current,password:input.password})});
        token.current=null;history.replaceState(null,'','/admin');setMode('signin');setMessage('Password updated. Sign in with your new password.');
      }else if(mode==='reset'){
        const result=await api('/auth/password-reset',{method:'POST',body:JSON.stringify({email:input.email})});setMessage(result.message);
      }else{
        const result=await api('/auth/login',{method:'POST',body:JSON.stringify(input)});onLogin(result.user);
      }
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  if(mode==='recovery')return <main className="login-wrap"><form className="login-card" id="resetForm" onSubmit={submit}><h1>Set a new password</h1><p>Use at least 12 characters for your admin password.</p><div className="field"><label htmlFor="newPassword">New password</label><input id="newPassword" name="password" type="password" minLength="12" maxLength="128" autoComplete="new-password" required /></div><p className="error" id="loginError" role="status">{message}</p><button className="btn primary" style={{width:'100%',padding:13}} disabled={busy}>Update password</button></form></main>;
  return <main className="login-wrap"><form className="login-card" id="loginForm" onSubmit={submit}><div className="brand" style={{padding:0,color:'var(--ink)',marginBottom:26}}>Algodon Organic<small style={{color:'var(--soft)'}}>Store administration</small></div><h1 id="loginTitle">{mode==='reset'?'Reset password':'Admin sign in'}</h1><p id="loginDescription">{mode==='reset'?'We will email a secure reset link if this address belongs to an admin.':'Use your authorized staff account to manage the store.'}</p><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required maxLength="320" /></div><div className="field" id="passwordField" hidden={mode==='reset'}><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required={mode==='signin'} disabled={mode==='reset'} maxLength="1024" /></div><p className="error" id="loginError" role="status">{message}</p><button className="btn primary" style={{width:'100%',padding:13}} type="submit" id="loginSubmit" disabled={busy}>{busy?'Please wait…':mode==='reset'?'Send reset link':'Sign in'}</button><Button style={{width:'100%',marginTop:10}} id="forgotToggle" onClick={()=>{setMode(mode==='reset'?'signin':'reset');setMessage('');}}> {mode==='reset'?'Back to sign in':'Forgot password?'} </Button></form></main>;
}
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
    if(!user)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(logout,20*60*1000);};
    reset();for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,reset,{passive:true});
    return()=>{clearTimeout(timer.current);for(const event of ['pointerdown','keydown','scroll'])window.removeEventListener(event,reset);};
  },[user,logout]);
  const pages={dashboard:Dashboard,products:Products,categories:Categories,orders:Orders,coupons:Coupons,customers:Customers,staff:Staff,activity:Activity},Page=pages[page];
  const allowed=navigation.filter(([key])=>user?.role==='support'?['products','orders','customers'].includes(key):!['staff','activity'].includes(key)||user?.role==='super_admin');
  const context={user,api,revision,refresh,notify,closeModal,openModal:setModal,canEdit:['super_admin','manager'].includes(user?.role)};
  return <AdminContext.Provider value={context}>{!ready?<div className="loading-screen">Algodon Organic · Admin</div>:!user?<Login api={api} onLogin={onLogin}/>:<div className="shell"><aside className="sidebar"><div className="brand">Algodon Organic<small>Store administration</small></div><nav className="nav">{allowed.map(([key,label])=><Button key={key} data-page={key} className={page===key?'active':''} onClick={()=>{setModal(null);setPage(key);}}>{label}</Button>)}</nav><div className="sidebar-bottom"><div className="user-badge">{user.email}<br/>{user.role.replaceAll('_',' ')}</div></div></aside><main className="main"><div className="topbar"><h1>{navigation.find(([key])=>key===page)?.[1]}</h1><div className="top-actions"><Button id="logoutBtn" onClick={logout}>Sign out</Button><Button id="themeBtn" title="Toggle light and dark mode" onClick={()=>{document.body.classList.toggle('dark');try{localStorage.setItem('algodon-admin-dark',document.body.classList.contains('dark')?'1':'0');}catch{}}}>◐</Button><span className="user-badge" style={{color:'var(--soft)'}}>{user.role.replaceAll('_',' ')}</span></div></div><div className="content"><Page key={page}/></div></main></div>}{modal&&user&&<Modal close={closeModal}>{modal}</Modal>}<div id="toast" className={'toast'+(toast?' show':'')} role="status" aria-live="polite" style={{background:toast?.error?'#8c3f3a':''}}>{toast?.message}</div></AdminContext.Provider>;
}
