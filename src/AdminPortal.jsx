import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './lib/supabase.js';
import {ShieldCheck,Users,Clock3,CheckCircle2,FileCheck,Search,LogOut,RefreshCw,Check,X,Eye,Globe2,UserRound,CalendarDays,LockKeyhole} from 'lucide-react';
import SupportInbox from './SupportInbox.jsx';

const ADMIN_EMAIL='ojepaamedu@gmail.com';
const tabs=['Overview','Users','Professional profiles','Document review','Profile Change Requests','Review history','Support Inbox'];
const fmt=value=>value?new Date(value).toLocaleString():'—';
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminPortal(){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[tab,setTab]=useState('Overview');
 const [dashboard,setDashboard]=useState({counts:{},users:[],profiles:[],reviews:[],profileChangeRequests:[]});
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(null),[reason,setReason]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[documentUrl,setDocumentUrl]=useState('');
 const [documentLoading,setDocumentLoading]=useState(false);
 const admin=!!user&&String(user.email||'').toLowerCase()===ADMIN_EMAIL;

 const load=async()=>{
  if(!supabase)return;
  setBusy(true);setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw new Error('Your session has expired. Sign in again.');
   const response=await fetch('/api/admin/dashboard',{headers:{authorization:'Bearer '+session.access_token}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Dashboard could not be loaded.');
   setDashboard({counts:payload.counts||{},users:payload.users||[],profiles:payload.profiles||[],reviews:payload.reviews||[],profileChangeRequests:payload.profileChangeRequests||[]});
  }catch(error){setNotice(error.message||'Dashboard could not be loaded.');}
  finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  supabase.auth.getUser().then(({data})=>{setUser(data.user||null);setReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(admin)load();},[admin]);
 useEffect(()=>{
  let active=true;setDocumentUrl('');
  if(!selected?.document_path)return()=>{active=false;};
  let objectUrl='';
  (async()=>{
   setDocumentLoading(true);
   try{
    const {data:{session}}=await supabase.auth.getSession();
    const response=await fetch('/api/admin/document?path='+encodeURIComponent(selected.document_path),{headers:{authorization:'Bearer '+session.access_token}});
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||'Document preview unavailable.');}
    const blob=await response.blob();
    objectUrl=URL.createObjectURL(blob);
    if(active)setDocumentUrl(objectUrl);else URL.revokeObjectURL(objectUrl);
   }catch(error){if(active)setNotice(error.message);}
   finally{if(active)setDocumentLoading(false);}
  })();
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[selected?.document_path]);

 const counts=dashboard.counts||{};
 const users=useMemo(()=>dashboard.users.filter(u=>(u.email+' '+u.id).toLowerCase().includes(query.toLowerCase())),[dashboard.users,query]);
 const profiles=useMemo(()=>dashboard.profiles.filter(p=>(p.full_name+' '+p.professional_name+' '+p.country_name+' '+p.region+' '+p.city+' '+p.user_id).toLowerCase().includes(query.toLowerCase())),[dashboard.profiles,query]);
 const reviews=useMemo(()=>dashboard.reviews.filter(r=>(r.section+' '+r.status+' '+r.user_id+' '+(r.submitted_data?.document_name||'')).toLowerCase().includes(query.toLowerCase())),[dashboard.reviews,query]);
 const pending=reviews.filter(r=>r.status==='pending');

 const reviewProfileChange=async(row,action)=>{
  if(action==='reject'&&!reason.trim()){setNotice('Enter a reason before rejecting this request.');return;}
  setBusy(true);setNotice('');
  try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch('/api/admin/profile-change',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({requestId:row.id,action,reason})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Profile change review failed.');setNotice(payload.message||'Decision saved.');setReason('');await load();}
  catch(error){setNotice(error.message||'Profile change review failed.');}finally{setBusy(false);}
 };

 const act=async action=>{
  if(!selected)return;
  if(action==='reject'&&!reason.trim()){setNotice('Enter a reason before rejecting this document.');return;}
  setBusy(true);setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch('/api/admin/review',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({recordId:selected.id,action,reason})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Review action failed.');
   setNotice(action==='approve'?'Document approved.':'Document rejected.');
   setSelected(null);setReason('');await load();
  }catch(error){setNotice(error.message||'Review action failed.');}
  finally{setBusy(false);}
 };

 if(!ready)return <div className="admin-loading"><ShieldCheck/><p>Checking secure administrator access…</p></div>;
 if(!user)return <div className="admin-login"><ShieldCheck size={38}/><h1>Bidx ProLink Internal Admin</h1><p>Sign in with the authorised administrator account.</p><a href="/">Return to ProLink sign in</a></div>;
 if(!admin)return <div className="admin-login"><LockKeyhole size={38}/><h1>Access restricted</h1><p>This account is not authorised to access ProLink Internal Admin.</p><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>;

 const metrics=[
  ['Registered users',counts.totalUsers??'—',Users],
  ['New users today',counts.newUsersToday??'—',CalendarDays],
  ['Professional profiles',counts.professionalProfiles??'—',UserRound],
  ['Documents awaiting review',counts.pendingDocuments??'—',Clock3],
  ['Approved documents',counts.approvedDocuments??'—',CheckCircle2],
  ['Rejected documents',counts.rejectedDocuments??'—',FileCheck]
 ];
 return <div className="admin-shell">
  <header className="admin-header"><div><span className="admin-kicker">RESTRICTED · DOCUMENT APPROVAL ONLY</span><h1>Bidx ProLink Internal Admin</h1><p className="admin-subtitle">{ADMIN_EMAIL}</p></div><button onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button></header>
  <div className="admin-security-note"><LockKeyhole size={16}/><span>Read-only access to account and professional information. This administrator can approve or reject submitted documents only. Profile details cannot be edited here.</span></div>
  <nav className="admin-tabs">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSelected(null);setQuery('');}}>{t}</button>)}</nav>
  {notice&&<p className="admin-notice" role="status">{notice}</p>}
  {tab==='Overview'&&<>
   <div className="admin-metrics">{metrics.map(([name,value,Icon])=><article className="admin-metric" key={name}><Icon size={18}/><span>{name}</span><b>{value}</b></article>)}</div>
   <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Pending document reviews</h2><p>Latest submissions requiring an approval decision.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>
    {dashboard.reviews.filter(r=>r.status==='pending').slice(0,8).map(r=><button key={r.id} className="admin-row" onClick={()=>{setSelected(r);setTab('Document review');}}><span><b>{label(r.submitted_data?.document_type||r.section)}</b><small>{r.submitted_data?.document_name||r.user_id}</small></span><em>Pending</em><small>{fmt(r.submitted_at)}</small></button>)}
    {!pending.length&&<p className="admin-empty">There are no pending document reviews.</p>}
   </section>
  </>}
  {tab==='Users'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Registered users</h2><p>Account details are view-only. Total: {counts.totalUsers??dashboard.users.length}</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search email or user ID"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email</th><th>User ID</th><th>Sign-up date</th><th>Last sign-in</th><th>Provider</th><th>Email status</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.email||'—'}</td><td className="admin-id">{u.id}</td><td>{fmt(u.created_at)}</td><td>{fmt(u.last_sign_in_at)}</td><td>{label(u.provider)}</td><td>{u.email_confirmed_at?'Confirmed':'Not confirmed'}</td></tr>)}</tbody></table></div>
   {!users.length&&<p className="admin-empty">No matching registered users.</p>}
  </section>}
  {tab==='Professional profiles'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Professional profiles</h2><p>View-only professional information.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, country or area"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Professional</th><th>Trade</th><th>Country</th><th>Region / State</th><th>District</th><th>City</th><th>Published</th></tr></thead><tbody>{profiles.map(p=><tr key={p.user_id}><td>{p.professional_name||p.full_name||'—'}<small className="admin-cell-sub">{p.user_id}</small></td><td>{p.subcategory||p.category||'—'}</td><td>{p.country_name||'—'}</td><td>{p.region||'—'}</td><td>{p.district||'—'}</td><td>{p.city||'—'}</td><td>{p.is_published?'Yes':'No'}</td></tr>)}</tbody></table></div>
  </section>}
  {tab==='Document review'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Document approval queue</h2><p>Inspect the submitted file, then approve or reject it. Submitted personal details are not editable.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search applicant or document"/></label></div>
   <div className="admin-review-layout"><div className="admin-review-list">{reviews.map(r=><button key={r.id} className={'admin-row '+(selected?.id===r.id?'chosen':'')} onClick={()=>setSelected(r)}><span><b>{label(r.submitted_data?.document_type||r.section)}</b><small>{r.submitted_data?.document_name||r.user_id}</small></span><em>{label(r.status)}</em></button>)}</div>
    {selected?<article className="admin-detail"><h3>Document review</h3><dl className="admin-readonly"><div><dt>Applicant ID</dt><dd>{selected.user_id}</dd></div><div><dt>Document type</dt><dd>{label(selected.submitted_data?.document_type||selected.section)}</dd></div><div><dt>File name</dt><dd>{selected.submitted_data?.document_name||'—'}</dd></div><div><dt>Submitted</dt><dd>{fmt(selected.submitted_at)}</dd></div><div><dt>Status</dt><dd>{label(selected.status)}</dd></div></dl>
     {selected.document_path&&<div className="admin-document-preview"><h4>Submitted document</h4>{documentLoading?<p>Preparing secure preview…</p>:documentUrl?<><a href={documentUrl} target="_blank" rel="noreferrer">Open document in a new tab</a>{(selected.submitted_data?.mime_type||'').startsWith('image/')?<img src={documentUrl} alt="Submitted document" style={{display:'block',maxWidth:'100%',maxHeight:480,objectFit:'contain',marginTop:12}}/>:selected.submitted_data?.mime_type==='application/pdf'?<iframe title="Submitted document" src={documentUrl} style={{width:'100%',height:480,border:0,marginTop:12}}/>:null}</>:<p>Document preview is unavailable.</p>}</div>}
     {selected.status==='pending'?<><label className="admin-reason">Rejection reason (required only when rejecting)<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain what is missing or unclear"/></label><div className="admin-actions"><button onClick={()=>act('approve')} disabled={busy}><Check size={15}/> Approve document</button><button className="admin-reject" onClick={()=>act('reject')} disabled={busy}><X size={15}/> Reject document</button></div></>:<p className="admin-readonly-status">This item has already been reviewed. No further changes are available here.</p>}
    </article>:<div className="admin-detail admin-detail-empty"><Eye size={22}/><p>Select a document to inspect it.</p></div>}
   </div>
  </section>}

  {tab==='Profile Change Requests'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Profile Change Requests</h2><p>Review proposed changes. Approved information remains unchanged until you approve a request.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search applicant or field"/></label></div>
   {(dashboard.profileChangeRequests||[]).filter(r=>(r.status+' '+r.user_id+' '+JSON.stringify(r.requested_changes||{})).toLowerCase().includes(query.toLowerCase())).map(r=><article className="admin-detail" key={r.id} style={{marginBottom:16}}><div className="admin-panel-heading"><div><h3>Applicant</h3><p className="admin-id">{r.user_id}</p></div><span className={'admin-status '+r.status}>{label(r.status)}</span></div><p><b>Requested:</b> {fmt(r.requested_at)}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Information</th><th>Proposed value</th></tr></thead><tbody>{Object.entries(r.requested_changes||{}).map(([key,value])=><tr key={key}><td>{label(key)}</td><td style={{whiteSpace:'pre-wrap'}}>{typeof value==='object'?JSON.stringify(value):String(value??'—')}</td></tr>)}</tbody></table></div>{r.status==='pending'?<><label className="admin-reason">Reason (required when rejecting)<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the decision"/></label><div className="admin-actions"><button disabled={busy} onClick={()=>reviewProfileChange(r,'approve')}><Check size={15}/> Approve changes</button><button className="admin-reject" disabled={busy} onClick={()=>reviewProfileChange(r,'reject')}><X size={15}/> Reject request</button></div></>:<p className="admin-readonly-status">Reviewed {fmt(r.reviewed_at)} · {r.review_reason||'No reason supplied'}</p>}</article>)}
   {!(dashboard.profileChangeRequests||[]).length&&<p className="admin-empty">No profile change requests have been submitted.</p>}
  </section>}
  {tab==='Review history'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Document review history</h2><p>Audit view of completed approval decisions.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search history"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Document</th><th>Applicant ID</th><th>Decision</th><th>Submitted</th><th>Reviewed</th><th>Reason</th></tr></thead><tbody>{reviews.filter(r=>r.status!=='pending').map(r=><tr key={r.id}><td>{label(r.submitted_data?.document_type||r.section)}</td><td className="admin-id">{r.user_id}</td><td><span className={'admin-status '+r.status}>{label(r.status)}</span></td><td>{fmt(r.submitted_at)}</td><td>{fmt(r.reviewed_at)}</td><td>{r.review_reason||'—'}</td></tr>)}</tbody></table></div>
  </section>}
  {tab==='Support Inbox'&&<SupportInbox/>}
  <footer className="admin-footer"><ShieldCheck size={15}/> Bidx ProLink · Internal document moderation · Read-only user records</footer>
 </div>;
}
