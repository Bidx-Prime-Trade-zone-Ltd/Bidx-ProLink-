import React,{useCallback,useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,X,Paperclip,ShieldCheck,Headset,LoaderCircle,FileText,Image as ImageIcon,Check,CheckCheck} from 'lucide-react';
import './support-chat.css';

const formatTime=value=>value?new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
const shortSize=value=>value<1024*1024?Math.max(1,Math.round(value/1024))+' KB':(value/1024/1024).toFixed(1)+' MB';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const typingDuration=text=>{const length=String(text||'').trim().length;return length<=140?1000:length<=500?1500:2000;};

export default function SupportChat({session,profile}){
 const [open,setOpen]=useState(false);
 const [conversation,setConversation]=useState(null);
 const [messages,setMessages]=useState([]);
 const [draft,setDraft]=useState('');
 const [loading,setLoading]=useState(false);
 const [sending,setSending]=useState(false);
 const [aiTyping,setAiTyping]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const listRef=useRef(null);
 const panelRef=useRef(null);
 const fileRef=useRef(null);
 const stickToBottom=useRef(true);
 const readReceiptInFlight=useRef(false);
 const token=session?.access_token;

 // Lock the page behind the support window while keeping the chat's own message
 // list scrollable. Restore the exact previous page position when it closes.
 useEffect(()=>{
  if(!open)return;
  // Tell the native Android shell that Support Chat owns touch gestures now.
  // This disables the parent SwipeRefreshLayout so pulling through the chat
  // history can never refresh the underlying Home page.
  try{window.BidxNativeUI?.setSupportChatOpen(true);}catch{}
  const scrollY=window.scrollY;
  const body=document.body;
  const html=document.documentElement;
  const previous={position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:body.style.overflow,htmlOverflow:html.style.overflow};
  body.style.position='fixed';
  body.style.top=`-${scrollY}px`;
  body.style.left='0';
  body.style.right='0';
  body.style.width='100%';
  body.style.overflow='hidden';
  html.style.overflow='hidden';
  return()=>{
   body.style.position=previous.position;
   body.style.top=previous.top;
   body.style.left=previous.left;
   body.style.right=previous.right;
   body.style.width=previous.width;
   body.style.overflow=previous.overflow;
   html.style.overflow=previous.htmlOverflow;
   window.scrollTo(0,scrollY);
   try{window.BidxNativeUI?.setSupportChatOpen(false);}catch{}
  };
 },[open]);
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

 useEffect(()=>{if(open){stickToBottom.current=true;load();}},[open,load]);
 useEffect(()=>{
  if(!open||!token)return;
  const timer=setInterval(()=>load(true),2000);
  return()=>clearInterval(timer);
 },[open,token,load]);
 useEffect(()=>{
  if(open&&stickToBottom.current&&listRef.current){
   const node=listRef.current;
   node.scrollTop=node.scrollHeight;
  }
 },[open,messages,aiTyping]);

 // Mark human Admin replies read after they have appeared in the open support thread.
 useEffect(()=>{
  if(!open||!token||!messages.some(message=>message.sender_role==='admin'&&!message.user_read_at)||readReceiptInFlight.current)return;
  readReceiptInFlight.current=true;
  fetch('/api/support/read',{method:'POST',headers:{authorization:'Bearer '+token}})
   .then(response=>response.ok?response.json():null)
   .then(payload=>{
    if(!payload?.read_at)return;
    setMessages(current=>current.map(message=>message.sender_role==='admin'&&!message.user_read_at?{...message,user_read_at:payload.read_at}:message));
   })
   .catch(()=>{})
   .finally(()=>{readReceiptInFlight.current=false;});
 },[open,token,messages]);
 const onMessagesScroll=()=>{
  const node=listRef.current;if(!node)return;
  stickToBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<44;
 };

 const send=async()=>{
  const message=draft.trim();if(!message||sending||!token)return;
  const localId='pending-'+Date.now();
  const started=Date.now();
  stickToBottom.current=true;
  setSending(true);setAiTyping(true);setError('');setDraft('');
  setMessages(current=>[...current,{id:localId,sender_role:'user',content:message,created_at:new Date().toISOString(),local_status:'sending'}]);
  try{
   const response=await fetch('/api/support/message',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({message,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Lagos'})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Your message could not be sent.');
   const savedUserMessage=(payload.messages||[]).find(item=>item.sender_role==='user');
   const aiMessage=(payload.messages||[]).find(item=>item.sender_role==='ai');
   setAiTyping(Boolean(aiMessage));
   if(aiMessage){
    const remaining=Math.max(0,typingDuration(aiMessage.content)-(Date.now()-started));
    if(remaining)await wait(remaining);
   }
   // Keep the user's persisted message in the local thread as well as the AI
   // reply. The Admin and user must see the same chronological conversation.
   setMessages(current=>{
    const next=current.map(item=>item.id===localId
     ?(savedUserMessage?{...savedUserMessage,local_status:'sent'}:{...item,local_status:'sent'})
     :item);
    if(aiMessage&&!next.some(item=>item.id===aiMessage.id))next.push(aiMessage);
    return next;
   });
  }catch(err){
   setMessages(current=>current.filter(item=>item.id!==localId));
   setDraft(message);setError(err.message||'Your message could not be sent.');
  }finally{setSending(false);setAiTyping(false);}
 };

 const upload=async file=>{
  if(!file||!token)return;
  stickToBottom.current=true;
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
  {open&&<div className="prolink-support-overlay" aria-hidden="true"/>}
  <button type="button" className={'prolink-support-fab'+(open?' is-open':'')} onClick={()=>setOpen(v=>!v)} aria-label={open?'Close ProLink support':'Chat with ProLink Admin'}>
   {open?<X size={21}/>:<MessageCircle size={21}/>}<span>{open?'Close':'Chat Admin'}</span>
  </button>
  {open&&<section ref={panelRef} className="prolink-support-panel" role="dialog" aria-modal="true" aria-label="Bidx ProLink support chat">
   <header className="prolink-support-header">
    <div className="prolink-support-avatar"><Headset size={21}/></div>
    <div className="prolink-support-heading"><b>ProLink Support</b><small><span className="prolink-support-live-dot"/> {statusLabel}</small></div>
    <button type="button" onClick={()=>setOpen(false)} aria-label="Close support chat"><X size={20}/></button>
   </header>
   <div className="prolink-support-security"><ShieldCheck size={15}/> Private conversation with AI Assistant and ProLink Admin</div>
   <div className="prolink-support-messages" ref={listRef} onScroll={onMessagesScroll}>
    {loading&&!messages.length&&<div className="prolink-support-loading"><LoaderCircle className="spin" size={20}/> Opening your support chat…</div>}
    {!loading&&!messages.length&&<div className="prolink-support-loading">Ask ProLink anything about professional registration, profiles, membership or app navigation.</div>}
    {messages.map(message=><article key={message.id} className={'prolink-support-message '+(message.sender_role==='user'?'from-user':message.sender_role==='admin'?'from-admin':'from-ai')}>
      <div className="prolink-support-sender">{message.sender_role==='user'?'You':message.sender_role==='admin'?'ProLink Admin':message.sender_role==='system'?'Support update':'AI Assistant'}</div>
      {message.content&&<p>{message.content}</p>}
      {(message.attachments||[]).map((file,index)=><div className="prolink-support-attachment" key={file.path||index}>{file.kind==='image'?<ImageIcon size={16}/>:<FileText size={16}/>}<span>{file.name}</span><small>{shortSize(file.size||0)}</small></div>)}
      <div className="prolink-support-message-meta"><time>{formatTime(message.created_at)}</time>
       {message.sender_role==='user'&&<span className={'prolink-support-delivery '+(message.read_at?'is-read':'')} title={message.read_at?'Read by Admin':'Sent to support'} aria-label={message.read_at?'Read by Admin':'Sent to support'}>{message.local_status==='sending'?<LoaderCircle className="spin" size={12}/>:message.read_at?<CheckCheck size={14}/>:<Check size={14}/>}<small>{message.local_status==='sending'?'Sending':message.read_at?'Read':'Sent'}</small></span>}
      </div>
      {message.pinned_for_admin&&<small className="prolink-support-pinned"><CheckCheck size={12}/> Pinned for Admin review</small>}
    </article>)}
    {aiTyping&&<div className="prolink-support-typing" aria-live="polite"><span>AI Assistant is typing</span><i/><i/><i/></div>}
   </div>
   <div className="prolink-support-actions">
    {status==='admin_requested'&&<span className="prolink-support-pending"><ClockIcon/> Admin request is in the queue. AI help remains available.</span>}
    {status==='admin_attending'&&<span className="prolink-support-pending"><Headset size={14}/> A human Admin is attending this conversation.</span>}
    {(status==='ai_active'||status==='resolved')&&<button type="button" onClick={requestAdmin} disabled={sending||loading}>Connect me to human Admin</button>}
   </div>
   <form className="prolink-support-composer" onSubmit={event=>{event.preventDefault();send();}}>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={event=>upload(event.target.files?.[0])}/>
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
