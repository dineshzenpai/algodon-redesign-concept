import { createContext, useCallback, useContext, useEffect, useState } from 'react';
export const AdminContext=createContext(null);
export const useAdmin=() => useContext(AdminContext);
export const adminMoney=value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value || 0));
export function useResource(path) {
  const {api,revision}=useAdmin(), [result,setResult]=useState({data:null,error:'',loading:true}), [retry,setRetry]=useState(0);
  useEffect(() => {
    let cancelled=false; setResult({data:null,error:'',loading:true});
    api(path).then(data => { if (!cancelled) setResult({data,error:'',loading:false}); }).catch(error => { if (!cancelled) setResult({data:null,error:error.message,loading:false}); });
    return () => { cancelled=true; };
  },[path,api,revision,retry]);
  const reload=useCallback(() => setRetry(value => value+1),[]);
  return {...result,reload};
}
