import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from './lib/supabase.js';
import {RefreshCw,Search,Headset,Send,CheckCircle2,Paperclip,Image as ImageIcon,FileText,Clock3,LoaderCircle} from 'lucide-react';

const fmt=value=>value?new Date(value).toLocaleString():'—';
export default function SupportInbox(){
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[query,setQuery]=useState(''),[reply,setReply]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[files,setFiles]=useState({});
 const token=async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.access_token||'';};
 const loadInbox=useCallback(async(silent=false)=>{
  try{if(!silent)setBusy(true);const access=await token();const response=await fetch('/api/admin/support/inbox',{headers:{authorization:'Bearer '+access}});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Support inbox unavailable.');setItems(payload.conversations||[]);if(selected){const fresh=(payload.conversations||[]).find(x=>x.id===selected.id);if(fresh)setSelected(fresh);}}
  catch(error){if(!silent)setNotice(error.message||'Could not load support inbox.');}
  finally{if(!silent)setBusy(false);}
 },[selected?.id]);
 const loadMessages=useCallback(async(id,silent=false)=>{
  if(!id)return;
  try{const access=await token();const response=await fetch('/api/admin/support/messages?conversationId='+encodeURIComponent(id),{headers:{authorization:'Bearer '+access}});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Conversation could not be opened.');setMessages(payload.messages||[]);setSelected(current=>current?{...current,status:payload.conversation?.status||current.status}:current);setNotice('');}
  catch(error){if(!silent)setNotice(error.message||'Could not load conversation.');}
 },[]);
 useEffect(()=>{loadInbox();const timer=setInterval(()=>loadInbox(true),8000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!selected?.id)return;loadMessages(selected.id);const timer=setInterval(()=>loadMessages(selected.id,true),6000);return()=>clearInterval(timer);},[selected?.id]);
 useEffect(()=>{
  let active=true;const urls={};
  (async()=>{const access=await token();const all=messages.flatMap(m=>(m.attachments||[]).map(a=>a.path).filter(Boolean));for(const path of all){try{const response=await fetch('/api/admin/support/attachment?path='+encodeURIComponent(path),{headers:{authorization:'Bearer '+access}});if(response.ok)urls[path]=URL.createObjectURL(await response.blob());}catch{}}
   if(active)setFiles(urls);else Object.values(urls).forEach(URL.revokeObjectURL);
  })();
  return()=>{active=false;Object.values(urls).forEach(URL.revokeObjectURL);};
 },[messages]);
 const act=async(action)=>{
  if(!selected)return;setBusy(true);setNotice('');
  try{const access=await token();const response=await fetch('/api/admin/support/action',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+access},body:JSON.stringify({conversationId:selected.id,action,message:action==='reply'?reply.trim():undefined})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Support action failed.');if(action==='reply')setReply('');setNotice(payload.message||'Support updated.');await loadMessages(selected.id,true);await loadInbox(true);}
  catch(error){setNotice(error.message||'Support action failed.');}finally{setBusy(false);}
 };
 const filtered=useMemo(()=>items.filter(item=>(item.display_name+' '+item.profession+' '+item.location+' '+item.user_id+' '+item.status).toLowerCase().includes(query.toLowerCase())),[items,query]);
 return <section className="admin-support-workspace">
  <div className="admin-support-sidebar">
   <div className="admin-panel-heading"><div><h2>Support conversations</h2><p>AI and human Admin only — customer-to-professional messages are not included.</p></div><button onClick={()=>loadInbox()} disabled={busy}><RefreshCw size={14}/></button></div>
   <label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search support users"/></label>
   <div className="admin-support-list">{filtered.map(item=><button key={item.id} className={'admin-support-row '+(selected?.id===item.id?'active':'')} onClick={()=>{setSelected(item);setMessages([]);}}>
    <span className="admin-support-avatar"><Headset size={17}/></span><span className="admin-support-row-copy"><b>{item.display_name}</b><small>{item.profession||item.location||item.user_id}</small><small>{item.last_message?.content||'No messages yet'}</small></span><span className={'admin-support-status '+item.status}>{item.status==='admin_requested'?'Requested':item.status==='admin_attending'?'Attending':item.status==='resolved'?'Resolved':'AI'}</span>
   </button>)}{!filtered.length&&<p className="admin-empty">No support conversations found.</p>}</div>
  </div>
  <div className="admin-support-detail">
   {!selected?<div className="admin-support-empty"><Headset size={28}/><h3>Select a support conversation</h3><p>Review the AI/user history and any files submitted for Admin attention.</p></div>:<>
    <div className="admin-panel-heading"><div><h2>{selected.display_name}</h2><p>{selected.profession||'ProLink user'} · {selected.location||selected.user_id}</p><span className={'admin-support-status '+selected.status}>{selected.status.replaceAll('_',' ')}</span></div><div className="admin-support-controls">{selected.status!=='admin_attending'&&selected.status!=='resolved'&&<button disabled={busy} onClick={()=>act('attend')}><Headset size={14}/> Attend</button>}{selected.status==='admin_attending'&&<button disabled={busy} onClick={()=>act('resolve')}><CheckCircle2 size={14}/> Resolve</button>}</div></div>
    <div className="admin-support-thread">{messages.map(message=><article key={message.id} className={'admin-support-message '+message.sender_role}><div className="admin-support-message-meta"><b>{message.sender_role==='user'?'User':message.sender_role==='admin'?'You · Admin':message.sender_role==='ai'?'AI Assistant':'System'}</b><time>{fmt(message.created_at)}</time></div><p>{message.content}</p>{(message.attachments||[]).map((file,index)=><div className="admin-support-file" key={file.path||index}>{file.kind==='image'?<ImageIcon size={16}/>:<FileText size={16}/>}<span>{file.name}</span>{files[file.path]&&<a href={files[file.path]} target="_blank" rel="noreferrer">Open file</a>}{file.ai_summary&&<small>AI visual notes: {file.ai_summary}</small>}{message.pinned_for_admin&&<em><Paperclip size={12}/> Pinned for review</em>}</div>)}</article>)}{!messages.length&&<p className="admin-empty">Loading conversation…</p>}</div>
    <form className="admin-support-reply" onSubmit={e=>{e.preventDefault();if(reply.trim())act('reply');}}><textarea rows="2" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a reply to the user in this same support conversation…"/><button disabled={busy||!reply.trim()}><Send size={15}/> Send reply</button></form>
    {selected.status==='admin_attending'&&<small className="admin-support-ai-paused"><CheckCircle2 size={13}/> AI replies are paused while you are attending this conversation.</small>}
   </>}
  </div>
  {notice&&<p className="admin-notice admin-support-notice" role="status">{notice}</p>}
 </section>;
}
