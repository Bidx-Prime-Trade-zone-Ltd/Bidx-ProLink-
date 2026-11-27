import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {MessageCircle,Send,FileText,Receipt,CheckCheck,ArrowLeft,CalendarDays,MapPin,UserRound,BriefcaseBusiness,Plus,Trash2,Printer} from 'lucide-react';
import './work-requests.css';

const dateLabel=value=>value?new Date(value+'T00:00:00').toLocaleDateString(): 'Flexible';
const money=(amount,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD'}).format(Number(amount||0));
const CURRENCIES=[['NGN','Nigeria — NGN (₦)'],['USD','United States — USD ($)'],['GHS','Ghana — GHS (GH₵)'],['KES','Kenya — KES (KSh)'],['ZAR','South Africa — ZAR (R)'],['GBP','United Kingdom — GBP (£)'],['EUR','Euro — EUR (€)'],['CAD','Canada — CAD ($)'],['AUD','Australia — AUD ($)'],['NZD','New Zealand — NZD ($)'],['XOF','West African CFA franc — XOF'],['XAF','Central African CFA franc — XAF'],['EGP','Egypt — EGP'],['MAD','Morocco — MAD'],['INR','India — INR (₹)'],['JPY','Japan — JPY (¥)'],['CNY','China — CNY (¥)'],['AED','United Arab Emirates — AED'],['SAR','Saudi Arabia — SAR'],['QAR','Qatar — QAR'],['CHF','Switzerland — CHF'],['SEK','Sweden — SEK'],['NOK','Norway — NOK'],['DKK','Denmark — DKK'],['SGD','Singapore — SGD ($)'],['HKD','Hong Kong — HKD ($)'],['MYR','Malaysia — MYR'],['PHP','Philippines — PHP (₱)'],['IDR','Indonesia — IDR'],['BRL','Brazil — BRL (R$)'],['MXN','Mexico — MXN ($)'],['THB','Thailand — THB (฿)'],['TRY','Türkiye — TRY (₺)'],['PKR','Pakistan — PKR (₨)'],['BDT','Bangladesh — BDT (৳)'],['UGX','Uganda — UGX'],['TZS','Tanzania — TZS'],['RWF','Rwanda — RWF'],['ETB','Ethiopia — ETB'],['ZMW','Zambia — ZMW']];
const stamp=value=>value?new Date(value).toLocaleString(): '';

const newInvoiceItem=()=>({key:globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random()),description:'',quantity:'1',unit:'pcs',unitPrice:''});
const escapeInvoiceHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const printWorkInvoice=(inv,work)=>{
 const rows=(inv.line_items?.length?inv.line_items:[{description:inv.quotation,quantity:1,unit_price:inv.amount,line_total:inv.amount}]).map(item=>'<tr><td>'+escapeInvoiceHtml(item.description)+'</td><td>'+item.quantity+' '+escapeInvoiceHtml(item.unit||'')+'</td><td>'+money(item.unit_price,inv.currency)+'</td><td>'+money(item.line_total??item.quantity*item.unit_price,inv.currency)+'</td></tr>').join('');
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Invoice '+escapeInvoiceHtml(inv.invoice_number)+'</title><style>body{font:14px Arial;color:#20364b;margin:35px}h1{color:#145b91}.top{display:flex;justify-content:space-between;border-bottom:3px solid #145b91;padding-bottom:15px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:25px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce5ed}th{background:#edf4fa}.totals{width:340px;max-width:100%;margin:20px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:6px}.grand{font-size:18px;font-weight:bold;border-top:2px solid #145b91}.notes{white-space:pre-wrap;margin-top:20px}@media print{body{margin:18mm}}</style></head><body><div class="top"><div><h1>INVOICE</h1><p>Bidx ProLink</p></div><div><b>'+escapeInvoiceHtml(inv.invoice_number)+'</b><p>Invoice date: '+dateLabel(inv.invoice_date)+'</p><p>Due date: '+dateLabel(inv.due_date)+'</p><p>Status: '+escapeInvoiceHtml(inv.status)+'</p></div></div><div class="parties"><div><b>FROM</b><p>'+escapeInvoiceHtml(inv.from_name||'Professional')+'<br>'+escapeInvoiceHtml(inv.from_address||'')+'<br>'+escapeInvoiceHtml(inv.from_contact||'')+'</p></div><div><b>BILL TO</b><p>'+escapeInvoiceHtml(inv.bill_to_name||work?.requester_name||'Customer')+'<br>'+escapeInvoiceHtml(inv.bill_to_address||'')+'</p></div></div><p><b>Job:</b> '+escapeInvoiceHtml(work?.job_description||'Professional service')+'</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals"><div><span>Subtotal</span><b>'+money(inv.subtotal??inv.amount,inv.currency)+'</b></div>'+(Number(inv.discount_amount)>0?'<div><span>Discount</span><b>- '+money(inv.discount_amount,inv.currency)+'</b></div>':'')+(Number(inv.tax_percent)>0?'<div><span>Tax ('+inv.tax_percent+'%)</span><b>'+money(inv.tax_amount,inv.currency)+'</b></div>':'')+'<div class="grand"><span>Total due</span><b>'+money(inv.amount,inv.currency)+'</b></div></div>'+(inv.notes?'<div class="notes"><b>Notes / terms</b><p>'+escapeInvoiceHtml(inv.notes)+'</p></div>':'')+'<script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>';
 const win=window.open('','_blank');if(!win){alert('Allow pop-ups to print or save this invoice as PDF.');return;}win.document.open();win.document.write(html);win.document.close();
};
export default function WorkRequestWorkspace({session,requests=[],loading=false,onRefresh,onUpdate,direction='incoming'}){
 const [active,setActive]=useState(null),[messages,setMessages]=useState([]),[invoices,setInvoices]=useState([]);
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [showInvoice,setShowInvoice]=useState(false),[invoiceDate,setInvoiceDate]=useState(new Date().toISOString().slice(0,10));
 const [dueDate,setDueDate]=useState(''),[currency,setCurrency]=useState('USD');
 const [items,setItems]=useState([newInvoiceItem()]),[taxPercent,setTaxPercent]=useState('0'),[discountAmount,setDiscountAmount]=useState('0'),[notes,setNotes]=useState('');
 const [fromName,setFromName]=useState(''),[fromAddress,setFromAddress]=useState(''),[fromContact,setFromContact]=useState(''),[billToName,setBillToName]=useState(''),[billToAddress,setBillToAddress]=useState('');
 const [invoiceBusy,setInvoiceBusy]=useState(false),[invoiceActionBusy,setInvoiceActionBusy]=useState('');
 const lineItems=useMemo(()=>items.map(i=>({...i,quantity:Number(i.quantity),unit_price:Number(i.unitPrice),line_total:Math.round(Number(i.quantity)*Number(i.unitPrice)*100)/100})).filter(i=>i.description.trim()&&i.quantity>0&&i.unit_price>=0),[items]);
 const subtotal=lineItems.reduce((sum,i)=>sum+i.line_total,0),discount=Math.min(Math.max(0,Number(discountAmount)||0),subtotal),tax=Math.round((subtotal-discount)*Math.max(0,Number(taxPercent)||0))/100,total=Math.max(0,Math.round((subtotal-discount+tax)*100)/100);
 const token=session?.access_token;
 const mine=useMemo(()=>requests.filter(r=>r.direction===direction),[requests,direction]);
 const loadThread=useCallback(async(id,silent=false)=>{
  if(!token||!id)return;
  if(!silent)setBusy(true);
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(id)+'/conversation',{headers:{authorization:'Bearer '+token}});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'The work conversation could not be loaded.');
   setMessages(data.messages||[]);setInvoices(data.invoices||[]);if(data.workRequest)setActive(current=>current?.id===id?{...current,...data.workRequest}:current);setError('');
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
  event.preventDefault();if(!active||invoiceBusy)return;setError('');
  const payloadItems=lineItems.map(({description,quantity,unit,unit_price,line_total})=>({description:description.trim(),quantity,unit,unit_price,line_total}));
  if(!payloadItems.length){setError('Add at least one complete invoice item.');return;}
  if(items.some(i=>!i.description.trim()||!Number(i.quantity)||Number(i.quantity)<=0||i.unitPrice===''||Number(i.unitPrice)<0)){setError('Complete every invoice row or remove unused rows.');return;}
  if(total<=0){setError('The invoice total must be greater than zero.');return;}
  setInvoiceBusy(true);
  try{
   const response=await fetch('/api/work-requests/'+encodeURIComponent(active.id)+'/invoices',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({invoiceDate,dueDate,currency:currency.toUpperCase(),lineItems:payloadItems,taxPercent:Number(taxPercent)||0,discountAmount:discount,notes,fromName,fromAddress,fromContact,billToName,billToAddress})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Invoice could not be sent.');
   setShowInvoice(false);setItems([newInvoiceItem()]);setTaxPercent('0');setDiscountAmount('0');setNotes('');setDueDate('');await loadThread(active.id,true);
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
 return <main className="work-request-page-scroll"><section className="work-workspace">
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
     <div className="work-invoice-parties"><span><b>From:</b> {inv.from_name||'Professional'} {inv.from_contact&&' · '+inv.from_contact}</span><span><b>Bill to:</b> {inv.bill_to_name||active.requester_name||'Customer'}</span></div>
     <div className="work-invoice-table-wrap"><table className="work-invoice-table"><thead><tr><th>Item / description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{(inv.line_items?.length?inv.line_items:[{description:inv.quotation,quantity:1,unit_price:inv.amount,line_total:inv.amount}]).map((item,i)=><tr key={i}><td>{item.description}{item.unit?' ('+item.unit+')':''}</td><td>{item.quantity}</td><td>{money(item.unit_price,inv.currency)}</td><td>{money(item.line_total??Number(item.quantity)*Number(item.unit_price),inv.currency)}</td></tr>)}</tbody></table></div>
     <div className="work-invoice-totals"><div><span>Subtotal</span><b>{money(inv.subtotal??inv.amount,inv.currency)}</b></div>{Number(inv.discount_amount)>0&&<div><span>Discount</span><b>- {money(inv.discount_amount,inv.currency)}</b></div>}{Number(inv.tax_percent)>0&&<div><span>Tax ({inv.tax_percent}%)</span><b>{money(inv.tax_amount,inv.currency)}</b></div>}<div className="work-invoice-grand"><span>Total due</span><b>{money(inv.amount,inv.currency)}</b></div></div>
     {inv.notes&&<p className="work-invoice-quotation"><b>Notes / payment terms</b><br/>{inv.notes}</p>}
     <div className="work-card-actions"><button type="button" className="work-open-chat" onClick={()=>printWorkInvoice(inv,active)}><Printer size={16}/> Print / Save PDF</button>{inv.sender_user_id!==session?.user?.id&&inv.status==='sent'&&<><button type="button" className="work-accept" disabled={invoiceActionBusy===inv.id} onClick={()=>invoiceAction(inv.id,'accepted')}>Accept invoice</button><button type="button" className="work-decline" disabled={invoiceActionBusy===inv.id} onClick={()=>invoiceAction(inv.id,'declined')}>Decline</button></>}</div>
     {inv.sender_user_id===session?.user?.id&&<small className="work-invoice-note">Sent to the customer · {inv.recipient_read_at?'Viewed by customer':'Awaiting customer review'}</small>}
    </article>)}
   </div>
   {professional&&active.status==='accepted'&&<div className="work-invoice-toolbar"><button type="button" onClick={()=>setShowInvoice(v=>!v)}><Receipt size={16}/>{showInvoice?'Close invoice form':'Create and send invoice'}</button></div>}
   {showInvoice&&<form className="work-invoice-form" onSubmit={submitInvoice}>
    <div className="work-invoice-form-title"><div><span className="work-eyebrow">PROFESSIONAL DOCUMENT</span><h3>Create invoice</h3><p>Add products, materials, labour or services. Totals calculate automatically.</p></div><FileText size={26}/></div>
    <div className="work-invoice-fields">
     <label>Invoice date<input type="date" required value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} required>{CURRENCIES.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
     <label>Professional / business name<input value={fromName} onChange={e=>setFromName(e.target.value)} placeholder="Your name or business"/></label><label>Professional address<input value={fromAddress} onChange={e=>setFromAddress(e.target.value)} placeholder="Business address"/></label><label>Phone or email<input value={fromContact} onChange={e=>setFromContact(e.target.value)} placeholder="Contact details"/></label><label>Customer name<input value={billToName} onChange={e=>setBillToName(e.target.value)} placeholder={active.requester_name||'Customer name'}/></label><label>Customer address<input value={billToAddress} onChange={e=>setBillToAddress(e.target.value)} placeholder="Customer address (optional)"/></label>
    </div>
    <div className="work-invoice-items-heading"><div><h4>Items and services</h4><p>Add each product, material, labour charge or service separately.</p></div></div>
    <div className="work-invoice-item-list">{items.map((item,index)=><div className="work-invoice-item" key={item.key}><div className="work-invoice-item-top"><b>Item {index+1}</b>{items.length>1&&<button type="button" onClick={()=>setItems(prev=>prev.filter(row=>row.key!==item.key))}><Trash2 size={15}/> Remove</button>}</div><label className="work-item-description">Description<input required value={item.description} onChange={e=>setItems(prev=>prev.map(row=>row.key===item.key?{...row,description:e.target.value}:row))} placeholder="e.g. Electrical breaker, cable, labour"/></label><div className="work-item-fields"><label>Quantity<input type="number" min="0.001" step="0.001" required value={item.quantity} onChange={e=>setItems(prev=>prev.map(row=>row.key===item.key?{...row,quantity:e.target.value}:row))}/></label><label>Unit<input value={item.unit} onChange={e=>setItems(prev=>prev.map(row=>row.key===item.key?{...row,unit:e.target.value}:row))} placeholder="pcs, metre, hour"/></label><label>Unit price<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e=>setItems(prev=>prev.map(row=>row.key===item.key?{...row,unitPrice:e.target.value}:row))} placeholder="0.00"/></label></div><div className="work-item-line-total"><span>Line total</span><b>{money((Number(item.quantity)||0)*(Number(item.unitPrice)||0),currency)}</b></div></div>)}</div>
    <button type="button" className="work-add-invoice-item" onClick={()=>setItems(prev=>[...prev,newInvoiceItem()])}><Plus size={17}/> Add another item</button>
    <div className="work-invoice-adjustments"><label>Discount amount<input type="number" min="0" step="0.01" value={discountAmount} onChange={e=>setDiscountAmount(e.target.value)}/></label><label>Tax (%)<input type="number" min="0" max="100" step="0.01" value={taxPercent} onChange={e=>setTaxPercent(e.target.value)}/></label></div>
    <div className="work-invoice-live-total"><div><span>Subtotal</span><b>{money(subtotal,currency)}</b></div><div><span>Discount</span><b>- {money(discount,currency)}</b></div><div><span>Tax</span><b>{money(tax,currency)}</b></div><div className="work-invoice-grand"><span>Grand total</span><b>{money(total,currency)}</b></div></div>
    <label className="work-invoice-quotation-field">Notes or payment terms<textarea rows={3} maxLength={3000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional scope, warranty, payment instructions or notes (optional)."/></label>
    <button className="work-invoice-submit" disabled={invoiceBusy||!lineItems.length}>{invoiceBusy?'Preparing invoice…':'Review and send invoice to customer'}</button>
   </form>}
   <form className="work-thread-composer" onSubmit={send}><textarea rows={2} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={5000} placeholder="Write a message about this job…"/><button type="submit" disabled={!draft.trim()||busy}><Send size={17}/> Send</button></form>
   {error&&<p className="work-thread-error" role="alert">{error}</p>}
  </>}
 </section></main>;
}
