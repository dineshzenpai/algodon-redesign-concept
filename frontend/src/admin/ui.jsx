import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdmin } from './context.jsx';
import { useDialog } from '../shared/useDialog.js';

export const Button=({children,primary=false,danger=false,...props}) => <button type="button" className={'btn'+(primary?' primary':'')+(danger?' danger':'')} {...props}>{children}</button>;
export function Badge({value}) {
  const text=String(value || 'Pending'), color=['Delivered','Paid','Confirmed'].includes(text)?'green':['Cancelled','Failed','Refunded'].includes(text)?'red':['Pending','Packed','Shipped'].includes(text)?'amber':'';
  return <span className={'badge '+color}>{text}</span>;
}
export function Field({name,label=name,value='',required=false,type='text',...props}) {
  return <div className="field"><label htmlFor={'f-'+name}>{label}</label><input id={'f-'+name} name={name} type={type} defaultValue={value ?? ''} required={required} {...(type==='number'?{min:0,step:'.01'}:{})} {...props} /></div>;
}
export function Select({name,label,value='',options,children,...props}) {
  return <div className="field"><label htmlFor={'f-'+name}>{label}</label><select id={'f-'+name} name={name} defaultValue={value || ''} {...props}>{options?.map(option => <option key={option} value={option}>{option}</option>)}{children}</select></div>;
}
export function Textarea({name,label,value='',...props}) {
  return <div className="field full"><label htmlFor={'f-'+name}>{label}</label><textarea id={'f-'+name} name={name} defaultValue={value || ''} rows="4" {...props} /></div>;
}
export function Check({name,label,checked}) { return <label className="checkline full"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>; }
export function Modal({children,close}) {
  const ref=useRef(null);
  useDialog(true,ref,close);
  return createPortal(<div className="modal-backdrop" id="activeModal" ref={ref} onClick={event => { if(event.target===event.currentTarget)close(); }}><section className="modal" role="dialog" aria-modal="true" aria-label="Store management">{children}</section></div>,document.body);
}
export function ModalActions({saving=false,label='Save',children}) {
  const {closeModal}=useAdmin();
  return <div className="modal-actions">{children}<Button onClick={closeModal}>Cancel</Button><button className="btn primary" type="submit" disabled={saving}>{saving?'Saving…':label}</button></div>;
}
export function ResourceState({resource,children}) {
  if(resource.loading)return <div className="loading-screen" role="status">Loading…</div>;
  if(resource.error)return <div className="panel"><p className="error" role="alert">{resource.error}</p><Button id="retry" onClick={resource.reload}>Try again</Button></div>;
  return children(resource.data);
}
export function DataTable({columns,children,empty='No records found.'}) {
  return <div className="table-wrap"><table><thead><tr>{columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{children?.length?children:<tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}</tbody></table></div>;
}
export function TablePage({title,columns,rows,pagination,search,setSearch,page,setPage,tools}) {
  const [draft,setDraft]=useState(search);
  useEffect(()=>setDraft(search),[search]);
  const total=pagination.total || 0, limit=pagination.limit || 25, end=Math.min(total,page*limit), start=total?(page-1)*limit+1:0;
  function submit(event){event.preventDefault();setSearch(draft);setPage(1);}
  return <><div className="toolbar"><form className="toolbar-left" onSubmit={submit}><input className="search" id="tableSearch" type="search" placeholder={'Search '+title.toLowerCase()} value={draft} onChange={event=>setDraft(event.target.value)} /><button className="btn" id="searchBtn">Search</button></form><div className="toolbar-right">{tools}</div></div><DataTable columns={columns} empty={'No '+title.toLowerCase()+' found.'}>{rows}</DataTable><div className="pagination"><span>Showing {start}–{end} of {total}</span><span><Button id="prevPage" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</Button>{' '}<Button id="nextPage" disabled={end>=total} onClick={()=>setPage(page+1)}>Next</Button></span></div></>;
}
