import React,{useCallback,useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,X,Paperclip,ShieldCheck,Headset,LoaderCircle,FileText,Image as ImageIcon,CheckCheck} from 'lucide-react';
import './support-chat.css';

const formatTime=value=>value?new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
const shortSize=value=>value<1024*1024?Math.max(1,Math.round(value/1024))+' KB':(value/1024/1024).toFixed(1)+' MB';

export default function SupportChat({session,profile}){
 const [open,setOpen]=useState(false);
 const [conversation,setConversation]=useState(null);
 const [messages,setMessages]=useState([]);
 const [draft,setDraft]=useState('');
 const [loading,setLoading]=useState(false);
 const [sending,setSending]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const listRef=useRef(null);
 const fileRef=useRef(null);
 const token=session?.access_token;
 const firstName=(profile?.full_name||session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name||'').trim().split(/\s+/)[0];

 const load=useCallback(async(silent=false)=>{
  if(!token)return;
  if(!silent)setLoading(true);
  try{
   const response=await fetch('/api/support/messages',{headers:{authorization:'Bearer '+token}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Support chat could not be loaded.');
   setConversation(payload.conversation||null);
   setMessages(payload.messages||[]);
   setError('');
  }catch(err){if(!silent)setError(err.message||'Support chat is temporarily unavailable.');}
  finally{if(!silent)setLoading(false);}
 },[token]);

 useEffect(()=>{if(open)load();},[open,load]);
 useEffect(()=>{
  if(!open||!token)return;
  const timer=setInterval(()=>load(true),7000);
  return()=>clearInterval(timer);
 },[open,token,load]);
 useEffect(()=>{if(open&&listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;},[open,messages]);

 const send=async()=>{
  const message=draft.trim();if(!message||sending||!token)return;
  setSending(true);setError('');setDraft('');
  try{
   const response=await fetch('/api/support/message',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({message,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Lagos'})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Your message could not be sent.');
   await load(true);
  }catch(err){setDraft(message);setError(err.message||'Your message could not be sent.');}
  finally{setSending(false);}
 };
 const upload=async file=>{
  if(!file||!token)return;
  setUploading(true);setError('');
  try{
   const form=new FormData();form.append('file',file);
   const response=await fetch('/api/support/attachment',{method:'POST',headers:{authorization:'Bearer '+token},body:form});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'File upload failed.');
   await load(true);
  }catch(err){setError(err.message||'File upload failed.');}
  finally{setUploading(false);if(fileRef.current)fileRef.current.value='';}
 };
 const requestAdmin=async()=>{
  if(!token)return;
  setSending(true);setError('');
  try{
   const response=await fetch('/api/support/request-admin',{method:'POST',headers:{authorization:'Bearer '+token}});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Admin request failed.');
   await load(true);
  }catch(err){setError(err.message||'Admin request failed.');}
  finally{setSending(false);}
 };
 const status=conversation?.status||'ai_active';
 const statusLabel=status==='admin_attending'?'Admin is attending':status==='admin_requested'?'Admin requested · AI remains available':status==='resolved'?'Resolved · AI available':'AI Assistant is available';

 return <>
  <button type="button" className={'prolink-support-fab'+(open?' is-open':'')} onClick={()=>setOpen(v=>!v)} aria-label={open?'Close ProLink support':'Chat with ProLink Admin'}>
   {open?<X size={21}/>:<MessageCircle size={21}/>}<span>{open?'Close':'Chat Admin'}</span>
  </button>
  {open&&<section className="prolink-support-panel" role="dialog" aria-modal="false" aria-label="Bidx ProLink support chat">
   <header className="prolink-support-header">
    <div className="prolink-support-avatar"><Headset size={21}/></div>
    <div className="prolink-support-heading"><b>ProLink Support</b><small><span className="prolink-support-live-dot"/> {statusLabel}</small></div>
    <button type="button" onClick={()=>setOpen(false)} aria-label="Close support chat"><X size={20}/></button>
   </header>
   <div className="prolink-support-security"><ShieldCheck size={15}/> Private conversation with AI Assistant and ProLink Admin</div>
   <div className="prolink-support-messages" ref={listRef}>
    {loading&&!messages.length&&<div className="prolink-support-loading"><LoaderCircle className="spin" size={20}/> Opening your support chat…</div>}
    {!loading&&!messages.length&&<div className="prolink-support-loading">Welcome{firstName?', '+firstName:''}. How can we help?</div>}
    {messages.map(message=><article key={message.id} className={'prolink-support-message '+(message.sender_role==='user'?'from-user':message.sender_role==='admin'?'from-admin':'from-ai')}>
      <div className="prolink-support-sender">{message.sender_role==='user'?'You':message.sender_role==='admin'?'ProLink Admin':message.sender_role==='system'?'Support update':'AI Assistant'}</div>
      {message.content&&<p>{message.content}</p>}
      {(message.attachments||[]).map((file,index)=><div className="prolink-support-attachment" key={file.path||index}>{file.kind==='image'?<ImageIcon size={16}/>:<FileText size={16}/>}<span>{file.name}</span><small>{shortSize(file.size||0)}</small></div>)}
      <time>{formatTime(message.created_at)}</time>
      {message.pinned_for_admin&&<small className="prolink-support-pinned"><CheckCheck size={12}/> Pinned for Admin review</small>}
    </article>)}
    {sending&&<div className="prolink-support-typing">Sending securely…</div>}
   </div>
   <div className="prolink-support-actions">
    {status==='admin_requested'&&<span className="prolink-support-pending"><ClockIcon/> Admin request is in the queue. AI help remains available.</span>}
    {status==='admin_attending'&&<span className="prolink-support-pending"><Headset size={14}/> A human Admin is attending this conversation.</span>}
    {(status==='ai_active'||status==='resolved')&&<button type="button" onClick={requestAdmin} disabled={sending||loading}>Connect me to human Admin</button>}
   </div>
   <form className="prolink-support-composer" onSubmit={event=>{event.preventDefault();send();}}>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" hidden onChange={event=>upload(event.target.files?.[0])}/>
    <button type="button" className="prolink-support-attach" onClick={()=>fileRef.current?.click()} disabled={uploading||sending} aria-label="Attach image or document">{uploading?<LoaderCircle className="spin" size={19}/>:<Paperclip size={19}/>}</button>
    <textarea value={draft} onChange={event=>setDraft(event.target.value)} placeholder={status==='admin_attending'?'Reply to ProLink Admin…':'Ask ProLink anything…'} rows={1} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}}}/>
    <button type="submit" className="prolink-support-send" disabled={!draft.trim()||sending||uploading} aria-label="Send message"><Send size={18}/></button>
   </form>
   {error&&<p className="prolink-support-error" role="alert">{error}</p>}
   <footer className="prolink-support-footer">Do not share passwords, one-time codes or payment card details.</footer>
  </section>}
 </>;
}

function ClockIcon(){return <span aria-hidden="true">◷</span>;}
