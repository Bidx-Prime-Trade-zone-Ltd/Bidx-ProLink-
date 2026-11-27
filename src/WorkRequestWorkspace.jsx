import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {MessageCircle,Send,FileText,Receipt,Clock3,Check,CheckCheck,ArrowLeft,LoaderCircle,CalendarDays,MapPin,UserRound,BriefcaseBusiness} from 'lucide-react';
import './work-requests.css';

const dateLabel=value=>value?new Date(value+'T00:00:00').toLocaleDateString(): 'Flexible';
const money=(amount,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD'}).format(Number(amount||0));
const stamp=value=>value?new Date(value).toLocaleString(): '';

export default function WorkRequestWorkspace({session,requests=[],loading=false,onRefresh,onUpdate,direction='incoming'}){
 const [active,setActive]=useState(null),[messages,setMessages]=useState([]),[invoices,setInvoices]=useState([]);
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [showInvoice,setShowInvoice]=useState(false),[invoiceDate,setInvoiceDate]=useState(new Date().toISOString().slice(0,10));
 const [dueDate,setDueDate]=useState(''),[currency,setCurrency]=useState('USD'),[amount,setAmount]=useState('');
 const [quotation,setQuotation]=useState(''),[invoiceBusy,setInvoiceBusy]=useState(false),[invoiceActionBusy,setInvoiceActionBusy]=useState('');
 const token=session?.access_token;
 const mine=useMemo(()=>requests.filter(r=>r.direction===direction),[requests,direction]);
 const loadThread=useCallback(async(id,silent=false)=>{
  if(!token||!id)return;
  if(!silent)setBusy(true);
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(id)+'/conversation',{headers:{authorization:'Bearer '+token}});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'The work conversation could not be loaded.');
   setMessages(data.messages||[]);setInvoices(data.invoices||[]);setError('');
  }catch(e){if(!silent)setError(e.message||'The conversation could not be loaded.');}
  finally{if(!silent)setBusy(false);}
 },[token]);
 useEffect(()=>{if(active?.id)loadThread(active.id);},[active?.id,loadThread]);
 useEffect(()=>{
  if(!active?.id)return;
  const timer=setInterval(()=>loadThread(active.id,true),5000);
  return()=>clearInterval(timer);
 },[active?.id,loadThread]);
 const send=async event=>{
  event.preventDefault();const body=draft.trim();if(!body||!active||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(active.id)+'/messages',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({body})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Message could not be sent.');
   setDraft('');await loadThread(active.id,true);
  }catch(e){setError(e.message||'Message could not be sent.');}
  finally{setBusy(false);}
 };
 const submitInvoice=async event=>{
  event.preventDefault();if(!active||invoiceBusy)return;
  setInvoiceBusy(true);setError('');
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(active.id)+'/invoices',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({invoiceDate,dueDate,currency:currency.toUpperCase(),amount,quotation})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Invoice could not be sent.');
   setShowInvoice(false);setAmount('');setQuotation('');setDueDate('');await loadThread(active.id,true);
  }catch(e){setError(e.message||'Invoice could not be sent.');}
  finally{setInvoiceBusy(false);}
 };
 const invoiceAction=async(invoiceId,status)=>{
  setInvoiceActionBusy(invoiceId);setError('');
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(active.id)+'/invoices',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({invoiceId,status})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Invoice response could not be saved.');
   await loadThread(active.id,true);
  }catch(e){setError(e.message||'Invoice response could not be saved.');}
  finally{setInvoiceActionBusy('');}
 };
 const professional=direction==='incoming';
 return <section className="work-workspace">
  {!active?<>
   <div className="work-workspace-heading"><div><h1>{professional?'Incoming work requests':'My work requests'}</h1><p>{professional?'Private customer requests sent directly to your professional account.':'Requests you have sent to professionals, including their replies and quotations.'}</p></div><button className="outline-button" type="button" onClick={onRefresh} disabled={loading}>{loading?'Refreshing…':'Refresh requests'}</button></div>
   {loading&&!mine.length?<p className="work-empty">Loading your work requests…</p>:mine.length?mine.map(r=><article className="work-request-card" key={r.id}>
    <div className="work-card-top"><span className="work-eyebrow">DIRECT CUSTOMER REQUEST</span><span className={'work-status status-'+r.status}>{r.status.replaceAll('_',' ')}</span></div>
    <h2>{r.job_description}</h2><div className="work-meta"><span><MapPin size={15}/>{r.job_location}</span><span><CalendarDays size={15}/>Preferred: {dateLabel(r.preferred_date)}</span></div>
    <p className="work-request-date">Submitted {stamp(r.created_at)}</p>
    {!professional&&<p className="work-professional-name"><UserRound size={15}/> Sent to {r.professional_name}</p>}
    {professional&&<p className="work-received-state">{r.professional_read_at?'You have viewed this request':'New request · Not yet viewed'}</p>}
    <div className="work-card-actions">
     {professional&&r.status==='pending'&&<><button type="button" className="work-accept" onClick={()=>onUpdate(r.id,'accepted')}>Accept request</button><button type="button" className="work-decline" onClick={()=>onUpdate(r.id,'declined')}>Decline</button></>}
     {!professional&&r.status==='pending'&&<button type="button" className="work-decline" onClick={()=>onUpdate(r.id,'cancelled')}>Cancel request</button>}
     <button type="button" className="work-open-chat" onClick={()=>setActive(r)}><MessageCircle size={16}/> Open conversation</button>
    </div>
   </article>):<div className="work-empty"><BriefcaseBusiness size={28}/><b>{professional?'No incoming requests yet':'You have not sent any work requests yet'}</b><span>When a customer or professional starts a request, it will appear here.</span></div>}
  </>:<>
   <div className="work-thread-heading"><button type="button" onClick={()=>{setActive(null);setShowInvoice(false);setError('');}}><ArrowLeft size={17}/> All requests</button><div><b>{professional?active.requester_name||'Customer':active.professional_name}</b><small>{active.status.toUpperCase()} · Work request conversation</small></div></div>
   <div className="work-thread-job"><span className="work-eyebrow">JOB DETAILS</span><b>{active.job_description}</b><span><MapPin size={14}/>{active.job_location}</span><span><CalendarDays size={14}/>Preferred date: {dateLabel(active.preferred_date)}</span></div>
   <div className="work-thread-messages">
    {busy&&!messages.length&&!invoices.length&&<p className="work-empty">Opening conversation…</p>}
    {!messages.length&&!invoices.length&&!busy&&<p className="work-empty">This is the beginning of your private conversation about this job. Discuss the work, timing and quotation here.</p>}
    {messages.map(m=><article key={m.id} className={'work-chat-message '+(m.sender_user_id===session?.user?.id?'mine':'theirs')}><b>{m.sender_user_id===session?.user?.id?'You':professional?'Customer':active.professional_name}</b><p>{m.body}</p><small>{stamp(m.created_at)} {m.recipient_read_at&&<CheckCheck size={12}/>}</small></article>)}
    {invoices.map(inv=><article key={inv.id} className="work-invoice-card">
     <div className="work-invoice-head"><Receipt size={19}/><div><b>Invoice {inv.invoice_number}</b><small>Issued {dateLabel(inv.invoice_date)}{inv.due_date?' · Due '+dateLabel(inv.due_date):''}</small></div><span className={'work-status status-'+inv.status}>{inv.status}</span></div>
     <strong className="work-invoice-amount">{money(inv.amount,inv.currency)}</strong><p className="work-invoice-quotation">{inv.quotation}</p>
     {inv.sender_user_id!==session?.user?.id&&inv.status==='sent'&&<div className="work-card-actions"><button type="button" className="work-accept" disabled={invoiceActionBusy===inv.id} onClick={()=>invoiceAction(inv.id,'accepted')}>Accept quotation</button><button type="button" className="work-decline" disabled={invoiceActionBusy===inv.id} onClick={()=>invoiceAction(inv.id,'declined')}>Decline</button></div>}
     {inv.sender_user_id===session?.user?.id&&<small className="work-invoice-note">Sent to the customer · {inv.recipient_read_at?'Viewed by customer':'Awaiting customer review'}</small>}
    </article>)}
   </div>
   {professional&&active.status==='accepted'&&<div className="work-invoice-toolbar"><button type="button" onClick={()=>setShowInvoice(v=>!v)}><Receipt size={16}/>{showInvoice?'Close invoice form':'Create and send invoice'}</button></div>}
   {showInvoice&&<form className="work-invoice-form" onSubmit={submitInvoice}>
    <h3>Create invoice / quotation</h3><div className="work-invoice-fields"><label>Invoice date<input type="date" required value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label><label>Due date (optional)<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Currency<input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} maxLength={8} required placeholder="USD"/></label><label>Amount<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter total amount"/></label></div>
    <label className="work-invoice-quotation-field">Quotation and work breakdown<textarea required minLength={5} maxLength={5000} rows={4} value={quotation} onChange={e=>setQuotation(e.target.value)} placeholder="Describe labour, materials, transport, scope of work and any other charges."/></label>
    <button className="work-accept" disabled={invoiceBusy}>{invoiceBusy?'Sending invoice…':'Send invoice to customer'}</button>
   </form>}
   <form className="work-thread-composer" onSubmit={send}><textarea rows={2} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={5000} placeholder="Write a message about this job…"/><button type="submit" disabled={!draft.trim()||busy}><Send size={17}/> Send</button></form>
   {error&&<p className="work-thread-error" role="alert">{error}</p>}
  </>}
 </section>;
}
