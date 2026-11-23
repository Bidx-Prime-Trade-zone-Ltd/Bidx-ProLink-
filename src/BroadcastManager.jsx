import React,{useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase.js';
import {Mail,RefreshCw,Send,PauseCircle,Clock3,CheckCircle2,AlertCircle} from 'lucide-react';

const fmt=value=>value?new Date(value).toLocaleString():'—';

export default function BroadcastManager(){
 const [subject,setSubject]=useState('');
 const [message,setMessage]=useState('');
 const [campaigns,setCampaigns]=useState([]);
 const [prepared,setPrepared]=useState(null);
 const [busy,setBusy]=useState(false);
 const [sending,setSending]=useState(false);
 const [notice,setNotice]=useState('');
 const stopRef=useRef(false);

 const token=async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('Your administrator session has expired. Sign in again.');
  return session.access_token;
 };
 const load=useCallback(async()=>{
  try{
   const accessToken=await token();
   const response=await fetch('/api/admin/broadcasts',{headers:{authorization:'Bearer '+accessToken}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Broadcast history could not be loaded.');
   setCampaigns(payload.campaigns||[]);
  }catch(error){setNotice(error.message||'Broadcast history could not be loaded.');}
 },[]);
 useEffect(()=>{load();},[load]);

 const prepare=async event=>{
  event.preventDefault();
  setBusy(true);setNotice('Preparing the recipient list…');
  try{
   const accessToken=await token();
   const response=await fetch('/api/admin/broadcasts',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken},body:JSON.stringify({action:'create',subject,message})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'The broadcast could not be prepared.');
   setPrepared(payload.campaign);
   setNotice(payload.message||'Broadcast prepared. Review the recipient count before sending.');
   await load();
  }catch(error){setNotice(error.message||'The broadcast could not be prepared.');}
  finally{setBusy(false);}
 };

 const send=async campaign=>{
  if(!campaign?.id)return;
  stopRef.current=false;setSending(true);setBusy(true);
  setNotice('Sending in batches. Keep this page open; you can pause after the current batch.');
  try{
   let done=false;
   while(!done&&!stopRef.current){
    const accessToken=await token();
    const response=await fetch('/api/admin/broadcasts',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken},body:JSON.stringify({action:'send',campaignId:campaign.id})});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'An email batch could not be sent.');
    done=!!payload.done;
    if(payload.campaign)setPrepared(payload.campaign);
    await load();
    if(done)setNotice(payload.message||'Broadcast completed.');
   }
   if(!done&&stopRef.current)setNotice('Sending paused after the last completed batch. Select Resume to continue.');
  }catch(error){setNotice(error.message||'Sending stopped. You can safely retry the next batch.');await load();}
  finally{setSending(false);setBusy(false);}
 };

 const statusLabel=status=>({queued:'Ready to send',sending:'Sending',paused:'Paused',sent:'Completed'}[status]||status);
 return <section className="admin-panel broadcast-panel">
  <div className="admin-panel-heading"><div><h2><Mail size={17}/> Email broadcasts</h2><p>Send official ProLink service announcements to registered users with confirmed email addresses.</p></div><button type="button" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>
  <div className="broadcast-guidance"><b>Recipient rule:</b> all unique, valid, confirmed registered email addresses are included. Unconfirmed accounts, deleted accounts and the administrator account are excluded. Each recipient receives an individual email; addresses are not exposed to other recipients.</div>
  <form className="broadcast-compose" onSubmit={prepare}>
   <label>Message subject<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Enter the announcement subject"/></label>
   <label>Message<textarea required maxLength={10000} rows={8} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write the official announcement for ProLink users."/></label>
   <div className="broadcast-compose-footer"><small>{message.length.toLocaleString()} / 10,000 characters</small><button type="submit" disabled={busy||!subject.trim()||!message.trim()}><Mail size={15}/> Prepare recipient list</button></div>
  </form>
  {prepared&&prepared.status!=='sent'&&<div className="broadcast-confirm">
   <div><b>Broadcast prepared for {Number(prepared.recipient_count||0).toLocaleString()} recipients</b><p>Subject: {prepared.subject||subject}</p><small>Nothing has been emailed yet. Confirm below to start sending.</small></div>
   <button type="button" disabled={busy||sending} onClick={()=>send(prepared)}><Send size={15}/> Send to {Number(prepared.recipient_count||0).toLocaleString()}</button>
  </div>}
  {sending&&<div className="broadcast-running"><span><Clock3 size={16}/> Sending email batches…</span><button type="button" onClick={()=>{stopRef.current=true;}}> <PauseCircle size={15}/> Pause after this batch</button></div>}
  {notice&&<p className="admin-notice" role="status">{notice}</p>}
  <div className="broadcast-history-heading"><h3>Broadcast history</h3><small>Most recent 50 campaigns</small></div>
  {!campaigns.length?<p className="admin-empty">No email broadcasts have been created.</p>:<div className="broadcast-history">
   {campaigns.map(c=>{
    const total=Number(c.recipient_count)||0,sent=Number(c.sent_count)||0,percent=total?Math.min(100,Math.round(sent/total*100)):0;
    return <article className="broadcast-history-card" key={c.id}>
     <div className="broadcast-history-top"><div><b>{c.subject}</b><small>Created {fmt(c.created_at)}</small></div><span className={'broadcast-status '+c.status}>{statusLabel(c.status)}</span></div>
     <div className="broadcast-progress"><div><span>{sent.toLocaleString()} sent</span><span>{total.toLocaleString()} eligible recipients</span></div><progress max="100" value={percent}/></div>
     {c.last_error&&<p className="broadcast-error"><AlertCircle size={14}/>{c.last_error}</p>}
     {c.status!=='sent'&&<div className="broadcast-card-actions"><button type="button" disabled={busy||sending} onClick={()=>send(c)}><Send size={14}/>{sent?'Resume sending':'Start sending'}</button></div>}
     {c.status==='sent'&&<small className="broadcast-completed"><CheckCircle2 size={14}/> Completed {fmt(c.sent_at)}</small>}
    </article>;
   })}
  </div>}
 </section>;
}
