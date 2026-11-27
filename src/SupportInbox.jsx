import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from './lib/supabase.js';
import {RefreshCw,Search,Headset,Send,CheckCircle2,Check,CheckCheck,Paperclip,Image as ImageIcon,FileText,LoaderCircle,ArrowLeft} from 'lucide-react';

const fmt=value=>value?new Date(value).toLocaleString():'—';
export default function SupportInbox(){
 const [items,setItems]=useState([]);
 const [selected,setSelected]=useState(null);
 const [messages,setMessages]=useState([]);
 const [query,setQuery]=useState('');
 const [reply,setReply]=useState('');
 const [busy,setBusy]=useState(false);
 const [sendingReply,setSendingReply]=useState(false);
 const [loadingMessages,setLoadingMessages]=useState(false);
 const [notice,setNotice]=useState('');
 const [files,setFiles]=useState({});
 const [mobileDetail,setMobileDetail]=useState(false);
 const selectedIdRef=useRef(null);
 const messageRequest=useRef(0);
 const busyRef=useRef(false);

 const token=async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token||'';};

 const loadInbox=useCallback(async(silent=false)=>{
  try{
   if(!silent)setBusy(true);
   const access=await token();
   const response=await fetch('/api/admin/support/inbox',{headers:{authorization:'Bearer '+access}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Support inbox unavailable.');
   const rows=payload.conversations||[];
   setItems(rows);
   // Refresh metadata without replacing the open conversation or its thread.
   setSelected(current=>{
    if(!current)return current;
    const fresh=rows.find(row=>row.id===current.id);
    return fresh?{...current,...fresh}:current;
   });
  }catch(error){if(!silent)setNotice(error.message||'Could not load support inbox.');}
  finally{if(!silent)setBusy(false);}
 },[]);

 const loadMessages=useCallback(async(id,silent=false)=>{
  if(!id)return;
  const requestId=++messageRequest.current;
  try{
   if(!silent&&selectedIdRef.current===id)setLoadingMessages(true);
   const access=await token();
   const response=await fetch('/api/admin/support/messages?conversationId='+encodeURIComponent(id),{headers:{authorization:'Bearer '+access}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Conversation could not be opened.');
   if(requestId!==messageRequest.current||selectedIdRef.current!==id)return;
   // Only replace the thread after a successful response. A transient poll
   // failure must never blank the conversation while an Admin is replying.
   setMessages(payload.messages||[]);
   setSelected(current=>current?.id===id?{...current,status:payload.conversation?.status||current.status}:current);
   setNotice('');
  }catch(error){if(!silent&&requestId===messageRequest.current)setNotice(error.message||'Could not load conversation.');}
  finally{if(requestId===messageRequest.current)setLoadingMessages(false);}
 },[]);

 useEffect(()=>{loadInbox();const timer=setInterval(()=>loadInbox(true),12000);return()=>clearInterval(timer);},[loadInbox]);
 useEffect(()=>{
  if(!selected?.id)return;
  selectedIdRef.current=selected.id;
  loadMessages(selected.id);
  const timer=setInterval(()=>loadMessages(selected.id,true),2000);
  return()=>clearInterval(timer);
 },[selected?.id,loadMessages]);
 useEffect(()=>{
  let active=true;const urls={};
  (async()=>{
   const access=await token();
   const all=messages.flatMap(m=>(m.attachments||[]).map(a=>a.path).filter(Boolean));
   for(const path of all){
    try{
     const response=await fetch('/api/admin/support/attachment?path='+encodeURIComponent(path),{headers:{authorization:'Bearer '+access}});
     if(response.ok)urls[path]=URL.createObjectURL(await response.blob());
    }catch{}
   }
   if(active)setFiles(urls);else Object.values(urls).forEach(URL.revokeObjectURL);
  })();
  return()=>{active=false;Object.values(urls).forEach(URL.revokeObjectURL);};
 },[messages]);

 const selectConversation=item=>{
  messageRequest.current++;
  selectedIdRef.current=item.id;
  setSelected(item);
  setItems(current=>current.map(row=>row.id===item.id?{...row,has_unread_user_messages:false}:row));
  setMessages([]);
  setFiles({});
  setNotice('');
  setMobileDetail(true);
 };
 const act=async(action)=>{
  if(!selected||busyRef.current)return;
  const message=action==='reply'?reply.trim():'';
  if(action==='reply'&&!message)return;
  busyRef.current=true;setNotice('');
  const optimisticId='admin-pending-'+Date.now();
  if(action==='reply'){
   // Put the Admin reply into the thread immediately; replace it when the server confirms it.
   setReply('');
   setMessages(current=>[...current,{id:optimisticId,sender_role:'admin',content:message,created_at:new Date().toISOString(),local_status:'sending'}]);
   setSendingReply(true);
  }else setBusy(true);
  try{
   const access=await token();
   const response=await fetch('/api/admin/support/action',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+access},body:JSON.stringify({conversationId:selected.id,action,message:action==='reply'?message:undefined})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Support action failed.');
   if(action==='reply'){
    setMessages(current=>current.map(item=>item.id===optimisticId?{...payload.message,local_status:'sent'}:item));
    setNotice('Reply sent to the user.');
   }else setNotice(payload.message||'Support updated.');
   await loadMessages(selected.id,true);
   await loadInbox(true);
  }catch(error){
   if(action==='reply'){
    setMessages(current=>current.filter(item=>item.id!==optimisticId));
    setReply(message);
   }
   setNotice(error.message||'Support action failed.');
  }finally{
   busyRef.current=false;
   if(action==='reply')setSendingReply(false);else setBusy(false);
  }
 };

 const filtered=useMemo(()=>items.filter(item=>(item.display_name+' '+item.profession+' '+item.location+' '+item.user_id+' '+item.status).toLowerCase().includes(query.toLowerCase())),[items,query]);
 const statusLabel=status=>status==='admin_requested'?'Waiting for Admin':status==='admin_attending'?'Admin attending':status==='resolved'?'Resolved':'AI active';

 return <section className="admin-support-workspace" data-mobile-view={mobileDetail?'detail':'inbox'}>
  <div className="admin-support-sidebar">
   <div className="admin-panel-heading"><div><h2>Support conversations</h2><p>Open any user to review the complete AI and Admin conversation.</p></div><button type="button" onClick={()=>loadInbox()} disabled={busy}><RefreshCw size={14}/></button></div>
   <label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search support users"/></label>
   <div className="admin-support-list">{filtered.map(item=><button type="button" key={item.id} className={'admin-support-row '+(selected?.id===item.id?'active':'')} onClick={()=>selectConversation(item)}>
    <span className="admin-support-avatar"><Headset size={17}/></span><span className="admin-support-row-copy"><b>{item.display_name}</b><small>{item.profession||item.location||item.user_id}</small><small>{item.last_message?.content||'No messages yet'}</small></span><span className="admin-support-row-meta">{item.has_unread_user_messages&&<b className="admin-support-unread-badge" aria-label="Unread messages from this user">1</b>}<span className={'admin-support-status '+item.status}>{statusLabel(item.status)}</span></span>
   </button>)}{!filtered.length&&<p className="admin-empty">No support conversations found.</p>}</div>
  </div>
  <div className="admin-support-detail">
   {!selected?<div className="admin-support-empty"><Headset size={28}/><h3>Select a support conversation</h3><p>The complete conversation will open here, including messages exchanged with the AI Assistant and human Admin.</p></div>:<>
    <div className="admin-panel-heading admin-support-detail-heading">
     <div className="admin-support-title"><button type="button" className="admin-support-back" onClick={()=>setMobileDetail(false)}><ArrowLeft size={15}/> Back to queue</button><h2>{selected.display_name}</h2><p>{selected.profession||'ProLink user'} · {selected.location||selected.user_id}</p><span className={'admin-support-status '+selected.status}>{statusLabel(selected.status)}</span></div>
     <div className="admin-support-controls">{selected.status!=='admin_attending'&&selected.status!=='resolved'&&<button type="button" disabled={busy} onClick={()=>act('attend')}><Headset size={14}/> Attend conversation</button>}{selected.status==='admin_attending'&&<button type="button" disabled={busy} onClick={()=>act('resolve')}><CheckCircle2 size={14}/> Resolve</button>}</div>
    </div>
    <div className="admin-support-thread" aria-live="polite">
     {loadingMessages&&!messages.length&&<p className="admin-empty">Loading the complete conversation…</p>}
     {messages.map(message=><article key={message.id} className={'admin-support-message '+message.sender_role}><div className="admin-support-message-meta"><b>{message.sender_role==='user'?'User':message.sender_role==='admin'?'You · Admin':message.sender_role==='ai'?'AI Assistant':'System'}</b><span className="admin-support-message-time"><time>{fmt(message.created_at)}</time>{message.sender_role==='admin'&&<span className={'admin-support-delivery'+(message.user_read_at?' is-read':'')} title={message.user_read_at?'Read by user':message.delivered_at?'Delivered to user':message.local_status==='sending'?'Sending':'Sent to server'} aria-label={message.user_read_at?'Read by user':message.delivered_at?'Delivered to user':message.local_status==='sending'?'Sending':'Sent to server'}>{message.local_status==='sending'?'Sending':message.user_read_at?<CheckCheck size={14}/>:message.delivered_at?<CheckCheck size={14}/>:<Check size={14}/>}</span>}</span></div><p>{message.content}</p>{(message.attachments||[]).map((file,index)=><div className="admin-support-file" key={file.path||index}>{file.kind==='image'?<ImageIcon size={16}/>:<FileText size={16}/>}<span>{file.name}</span>{files[file.path]&&<a href={files[file.path]} target="_blank" rel="noreferrer">Open file</a>}{file.ai_summary&&<small>AI visual notes: {file.ai_summary}</small>}{message.pinned_for_admin&&<em><Paperclip size={12}/> Pinned for review</em>}</div>)}</article>)}
     {!loadingMessages&&!messages.length&&<p className="admin-empty">No messages are available in this conversation yet.</p>}
    </div>
    <form className="admin-support-reply" onSubmit={event=>{event.preventDefault();act('reply');}}>
     <textarea rows="2" value={reply} onChange={event=>setReply(event.target.value)} placeholder="Write a reply to this user. Your message will appear in the same ProLink Support conversation…" disabled={busy||sendingReply}/>
     <button type="submit" disabled={busy||sendingReply||!reply.trim()}><Send size={15}/> Send reply</button>
    </form>
    {selected.status==='admin_attending'&&<small className="admin-support-ai-paused"><CheckCircle2 size={13}/> You are attending this case. AI replies are paused; your replies appear in the user's existing support chat.</small>}
   </>}
  </div>
  {notice&&<p className="admin-notice admin-support-notice" role="status">{notice}</p>}
 </section>;
}
