import React,{useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from './lib/supabase.js';
import {ShieldCheck,Users,Clock3,CheckCircle2,FileCheck,Search,ArrowLeft,RefreshCw,Check,X,Eye,Globe2,UserRound,CalendarDays,LockKeyhole,BriefcaseBusiness,ClipboardCheck,History,MessageCircle,Mail,LayoutDashboard,ChevronRight,Send} from 'lucide-react';
import SupportInbox from './SupportInbox.jsx';
import BroadcastManager from './BroadcastManager.jsx';

const ADMIN_EMAIL='ojepaamedu@gmail.com';
const tabs=['Overview','Users','Professional profiles','Work Requests','Employers','Job approvals','Job seekers','Live jobs','Closed jobs','Document review','Profile Change Requests','Review history','Support Inbox','Email broadcasts'];
const fmt=value=>value?new Date(value).toLocaleString():'—';
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminPortal(){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[tab,setTab]=useState('Overview');
 const [dashboard,setDashboard]=useState({counts:{},users:[],profiles:[],reviews:[],profileChangeRequests:[],workRequests:[],employerProfiles:[],jobSeekerProfiles:[],jobs:[],warnings:[]});
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(null),[reason,setReason]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[documentUrl,setDocumentUrl]=useState('');
 const [documentLoading,setDocumentLoading]=useState(false);
 const [unreadSupportConversations,setUnreadSupportConversations]=useState(0);
 const [selectedUser,setSelectedUser]=useState(null),[userMessage,setUserMessage]=useState(''),[sendingUserMessage,setSendingUserMessage]=useState(false),[userConversation,setUserConversation]=useState([]),[userConversationLoading,setUserConversationLoading]=useState(false),[userFilter,setUserFilter]=useState('all');
 const userChatEndRef=useRef(null);
 const userChatAtBottomRef=useRef(true);
 const admin=!!user&&String(user.email||'').toLowerCase()===ADMIN_EMAIL;

 // Keep Android/browser Back inside the restricted Admin workspace. The visible
 // Return to ProLink button remains the intentional way to leave this portal.
 useEffect(()=>{
  try{window.BidxNativeUI?.setAdminPortalOpen?.(true);window.BidxNativeUI?.setHomeScreen?.(false);}catch{}
  const holdAdminRoute=()=>{window.history.pushState({...(window.history.state||{}),prolinkAdminStay:true},'',window.location.href);};
  window.history.pushState({...(window.history.state||{}),prolinkAdminStay:true},'',window.location.href);
  window.addEventListener('popstate',holdAdminRoute);
  return()=>{window.removeEventListener('popstate',holdAdminRoute);try{window.BidxNativeUI?.setAdminPortalOpen?.(false);}catch{}};
 },[]);

 const load=async()=>{
  if(!supabase)return;
  setBusy(true);setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw new Error('Your session has expired. Sign in again.');
   const response=await fetch('/api/admin/dashboard',{headers:{authorization:'Bearer '+session.access_token}});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Dashboard could not be loaded.');
   setDashboard({counts:payload.counts||{},users:payload.users||[],profiles:payload.profiles||[],reviews:payload.reviews||[],profileChangeRequests:payload.profileChangeRequests||[],workRequests:payload.workRequests||[],employerProfiles:payload.employerProfiles||[],jobSeekerProfiles:payload.jobSeekerProfiles||[],jobs:payload.jobs||[],warnings:payload.warnings||[]});
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
  if(!admin){setUnreadSupportConversations(0);return;}
  let active=true;
  const refresh=async()=>{
   try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)return;
    const response=await fetch('/api/admin/support/unread',{headers:{authorization:'Bearer '+session.access_token}});
    if(!response.ok)return;
    const payload=await response.json();
    if(active)setUnreadSupportConversations(Number(payload.unreadConversations)||0);
   }catch{}
  };
  refresh();
  const timer=setInterval(refresh,7000);
  return()=>{active=false;clearInterval(timer);};
 },[admin]);

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
 const users=useMemo(()=>dashboard.users.filter(u=>{const matches=(u.email+' '+u.id+' '+(u.profile?.full_name||'')+' '+(u.profile?.professional_name||'')).toLowerCase().includes(query.toLowerCase());const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date());const isToday=u.created_at&&new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(u.created_at))===today;return matches&&(userFilter!=='today'||isToday);}),[dashboard.users,query,userFilter]);
 const profiles=useMemo(()=>dashboard.profiles.filter(p=>(p.full_name+' '+p.professional_name+' '+p.country_name+' '+p.region+' '+p.city+' '+p.user_id).toLowerCase().includes(query.toLowerCase())),[dashboard.profiles,query]);
 const reviews=useMemo(()=>dashboard.reviews.filter(r=>(r.section+' '+r.status+' '+r.user_id+' '+(r.submitted_data?.document_name||'')).toLowerCase().includes(query.toLowerCase())),[dashboard.reviews,query]);
 const pending=reviews.filter(r=>r.status==='pending');
 const workRequests=useMemo(()=>dashboard.workRequests.filter(r=>(r.professional_name+' '+r.job_description+' '+r.job_location+' '+r.status+' '+r.requester_user_id+' '+r.professional_user_id).toLowerCase().includes(query.toLowerCase())),[dashboard.workRequests,query]);

 const openUser=(userId,extra={})=>{
  const account=dashboard.users.find(item=>item.id===userId)||{id:userId,email:''};
  const profile=dashboard.profiles.find(item=>item.user_id===userId)||account.profile||null;
  setSelectedUser({...account,...extra,profile});setUserMessage('');setUserConversation([]);userChatAtBottomRef.current=true;setNotice('');
 };
 const loadUserConversation=async(showLoading=false)=>{
  if(!selectedUser?.id)return;
  if(showLoading)setUserConversationLoading(true);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw new Error('Your admin session has expired. Sign in again.');
   const response=await fetch('/api/admin/users/message?userId='+encodeURIComponent(selectedUser.id),{headers:{authorization:'Bearer '+session.access_token}});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Conversation could not be loaded.');
   setUserConversation(payload.messages||[]);
  }catch(error){setNotice(error.message||'Conversation could not be loaded.');}
  finally{if(showLoading)setUserConversationLoading(false);}
 };
 useEffect(()=>{
  if(!selectedUser?.id)return;
  let active=true;
  const refresh=async()=>{
   try{
    const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return;
    const response=await fetch('/api/admin/users/message?userId='+encodeURIComponent(selectedUser.id),{headers:{authorization:'Bearer '+session.access_token}});
    const payload=await response.json();if(response.ok&&active)setUserConversation(payload.messages||[]);
   }catch{}
  };
  setUserConversationLoading(true);refresh().finally(()=>{if(active)setUserConversationLoading(false);});
  const timer=setInterval(refresh,5000);
  return()=>{active=false;clearInterval(timer);};
 },[selectedUser?.id]);
 useEffect(()=>{
  const node=userChatEndRef.current?.parentElement;
  if(node&&userChatAtBottomRef.current)node.scrollTop=node.scrollHeight;
 },[userConversation]);
 const openMetric=name=>{
  setQuery('');
  if(name==='Registered users'){setUserFilter('all');setTab('Users');}
  else if(name==='New users today'){setUserFilter('today');setTab('Users');}
  else if(name==='Professional profiles')setTab('Professional profiles');
  else if(name==='Employers'||name==='Pending employer profiles')setTab('Employers');
  else if(name==='Job seekers'||name==='Active job seekers'||name==='Pending job-seeker profiles')setTab('Job seekers');
  else if(name==='Jobs awaiting approval')setTab('Job approvals');
  else if(name==='Live jobs')setTab('Live jobs');
  else if(name==='Closed jobs')setTab('Closed jobs');
  else if(name==='Documents awaiting review')setTab('Document review');
  else if(name==='Approved documents'||name==='Rejected documents')setTab('Review history');
  setSelected(null);
 };
 const sendUserMessage=async event=>{
  event.preventDefault();const message=userMessage.trim();
  if(!selectedUser||!message||sendingUserMessage)return;
  userChatAtBottomRef.current=true;
  setSendingUserMessage(true);setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch('/api/admin/users/message',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({userId:selectedUser.id,message})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Message could not be sent.');
   if(payload.message)setUserConversation(current=>[...current.filter(item=>item.id!==payload.message.id),payload.message]);
   setUserMessage('');setNotice('Message sent and saved to this conversation.');
  }catch(error){setNotice(error.message||'Message could not be sent.');}
  finally{setSendingUserMessage(false);}
 };

 const reviewProfileChange=async(row,action)=>{
  if(action==='reject'&&!reason.trim()){setNotice('Enter a reason before rejecting this request.');return;}
  setBusy(true);setNotice('');
  try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch('/api/admin/profile-change',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({requestId:row.id,action,reason})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Profile change review failed.');setNotice(payload.message||'Decision saved.');setReason('');await load();}
  catch(error){setNotice(error.message||'Profile change review failed.');}finally{setBusy(false);}
 };

 const recruitmentAct=async(kind,id,action)=>{
  const rejectionReason=action==='reject'?window.prompt('Enter the reason for rejecting this submission:',''):null;
  if(action==='reject'&&!String(rejectionReason||'').trim()){setNotice('A rejection reason is required.');return;}
  if(action==='close'&&!window.confirm('Close this job? It will be removed from public listings.'))return;
  setBusy(true);setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch('/api/admin/recruitment',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({kind,id,action,reason:rejectionReason||''})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Recruitment action failed.');
   setNotice(payload.message||'Recruitment decision saved.');await load();
  }catch(error){setNotice(error.message||'Recruitment action failed.');}
  finally{setBusy(false);}
 };
 const recruitmentRows=(rows,kind,actions=[])=> <div className="admin-recruitment-list">{rows.map(row=><article className="admin-recruitment-row" key={row.id||row.user_id}>
  <div className="admin-recruitment-row-main"><b>{kind==='employer'?row.company_name:kind==='job_seeker'?row.full_name:row.title}</b>
   <small>{kind==='employer'?[row.industry,row.country_name,row.city].filter(Boolean).join(' · '):kind==='job_seeker'?[row.headline,row.country_name,row.city].filter(Boolean).join(' · '):[row.location,row.employment_type,row.country_name].filter(Boolean).join(' · ')}</small>
   {kind==='job'&&<p>{String(row.description||'').slice(0,420)}</p>}
   {kind==='employer'&&<small>Contact: {row.contact_email||'—'} · {row.phone||'—'} · Registration: {row.registration_number||'Not supplied'}</small>}
   {kind==='job_seeker'&&<small>Skills: {(row.skills||[]).join(', ')||'Not supplied'} · Seeking: {label(row.seeking_status)}</small>}
   <small>Submitted: {fmt(row.submitted_at)} · Status: <b className={'admin-status '+row.status}>{label(row.status)}</b>{row.review_reason?' · '+row.review_reason:''}</small>
  </div>
  <div className="admin-recruitment-actions">{actions.filter(action=>action==='approve'||action==='reject'?row.status==='pending':action==='close'?row.status==='live':false).map(action=><button key={action} type="button" disabled={busy} className={'admin-recruitment-action '+action} onClick={()=>recruitmentAct(kind,row.id||row.user_id,action)}>{action==='approve'?'Approve':action==='reject'?'Reject':'Close job'}</button>)}</div>
 </article>)}{!rows.length&&<p className="admin-empty">No records in this section.</p>}</div>;

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
  ['Registered users',counts.totalUsers,Users],
  ['New users today',counts.newUsersToday,CalendarDays],
  ['Professional profiles',counts.professionalProfiles,UserRound],
  ['Employers',counts.employerProfiles,Building2],
  ['Pending employer profiles',counts.pendingEmployerProfiles,Clock3],
  ['Job seekers',counts.jobSeekerProfiles,Users],
  ['Active job seekers',counts.activeJobSeekers,UserRound],
  ['Pending job-seeker profiles',counts.pendingJobSeekerProfiles,Clock3],
  ['Jobs awaiting approval',counts.pendingJobs,ClipboardCheck],
  ['Live jobs',counts.liveJobs,BriefcaseBusiness],
  ['Closed jobs',counts.closedJobs,FileCheck],
  ['Documents awaiting review',counts.pendingDocuments,Clock3],
  ['Approved documents',counts.approvedDocuments,CheckCircle2],
  ['Rejected documents',counts.rejectedDocuments,FileCheck]
 ];
 const moduleGroups=[
  {title:'Workspace',items:[
   {tab:'Users',title:'User directory',description:'View registered accounts and account status',Icon:Users},
   {tab:'Professional profiles',title:'Professional profiles',description:'Review professional details and published profiles',Icon:UserRound},
   {tab:'Work Requests',title:'Work requests',description:'View direct requests sent to professionals',Icon:BriefcaseBusiness},
   {tab:'Employers',title:'Employer profiles',description:'Review company registrations and approve employers',Icon:Building2},
   {tab:'Job approvals',title:'Job approval queue',description:'Review every vacancy before it becomes public',Icon:ClipboardCheck},
   {tab:'Job seekers',title:'Job-seeker profiles',description:'Review candidate profiles and active job seekers',Icon:Users},
   {tab:'Live jobs',title:'Live jobs',description:'Monitor published vacancies and close jobs when required',Icon:BriefcaseBusiness},
   {tab:'Closed jobs',title:'Closed jobs',description:'Retain closed vacancies for audit and records',Icon:FileCheck}
  ]},
  {title:'Verification & records',items:[
   {tab:'Document review',title:'Document review',description:'Inspect submitted documents and make decisions',Icon:FileCheck},
   {tab:'Profile Change Requests',title:'Profile change requests',description:'Review proposed professional profile updates',Icon:ClipboardCheck},
   {tab:'Review history',title:'Review history',description:'See completed document review decisions',Icon:History}
  ]},
  {title:'Communication',items:[
   {tab:'Support Inbox',title:'Support inbox',description:'Attend to AI and customer support conversations',Icon:MessageCircle},
   {tab:'Email broadcasts',title:'Email broadcasts',description:'Prepare and manage ProLink announcements',Icon:Mail}
  ]}
 ];
 return <div className="admin-shell">
  <header className="admin-header"><div className="admin-brand"><span className="admin-brand-mark">P</span><div><span className="admin-kicker">PROLINK · RESTRICTED ADMINISTRATION</span><h1>ProLink Admin Portal</h1><p className="admin-subtitle">{ADMIN_EMAIL}</p></div></div><button className="admin-return-button" type="button" onClick={()=>window.location.assign("/")} aria-label="Return to ProLink" title="Return to ProLink"><ArrowLeft size={17}/> <span>Return to ProLink</span></button></header>
  <div className="admin-security-note"><LockKeyhole size={16}/><span>Secure internal workspace · Account and professional records are view-only. Authorised administrators can review documents and manage support conversations.</span></div>
  {tab!=='Overview'&&<div className="admin-page-toolbar"><button type="button" onClick={()=>{setTab('Overview');setSelected(null);setQuery('');}}><ArrowLeft size={16}/> Dashboard overview</button><span><LayoutDashboard size={15}/> {tab}{tab==='Support Inbox'&&unreadSupportConversations>0&&<b className="admin-support-unread-badge">{unreadSupportConversations>99?'99+':unreadSupportConversations}</b>}</span></div>}
  {notice&&<p className="admin-notice" role="status">{notice}</p>}
  {!!dashboard.warnings?.length&&<p className="admin-notice admin-warning" role="status">Some dashboard sections could not be loaded: {dashboard.warnings.map(name=>name.replaceAll('_',' ')).join(', ')}. Other figures are still available. Use Refresh to try again.</p>}
  {tab==='Overview'&&<>
   <div className="admin-metrics">{metrics.map(([name,value,Icon])=><button type="button" className="admin-metric admin-metric-button" key={name} onClick={()=>openMetric(name)} aria-label={'Open '+name}><span className="admin-metric-icon"><Icon size={19}/></span><div><span>{name}</span><b className={value==null?'admin-metric-unavailable':''}>{value==null?'Unavailable':value}</b><small>View records <ChevronRight size={12}/></small></div></button>)}</div>
   <div className="admin-module-groups">{moduleGroups.map(group=><section className="admin-module-section" key={group.title}><div className="admin-section-heading"><h2>{group.title}</h2><span>{group.items.length} sections</span></div><div className="admin-module-grid">{group.items.map(item=><button type="button" className="admin-module-card" key={item.tab} onClick={()=>{setTab(item.tab);setSelected(null);setQuery('');}}><span className="admin-module-icon"><item.Icon size={21}/></span><span className="admin-module-copy"><b>{item.title}{item.tab==='Support Inbox'&&unreadSupportConversations>0&&<em className="admin-support-unread-badge">{unreadSupportConversations>99?'99+':unreadSupportConversations}</em>}</b><small>{item.description}</small></span><span className="admin-module-arrow"><ChevronRight size={18}/></span></button>)}</div></section>)}</div>
   <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Pending document reviews</h2><p>Latest submissions requiring an approval decision.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>
    {dashboard.reviews.filter(r=>r.status==='pending').slice(0,8).map(r=><button key={r.id} className="admin-row" onClick={()=>{setSelected(r);setTab('Document review');}}><span><b>{label(r.submitted_data?.document_type||r.section)}</b><small>{r.submitted_data?.document_name||r.user_id}</small></span><em>Pending</em><small>{fmt(r.submitted_at)}</small></button>)}
    {!pending.length&&<p className="admin-empty">There are no pending document reviews.</p>}
   </section>
  </>}
  {tab==='Users'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Registered users</h2><p>Choose any account to inspect its profile and send a private ProLink message. Total: {counts.totalUsers??dashboard.users.length}</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search email or user ID"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>User ID</th><th>Sign-up date</th><th>Provider</th><th>Email status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="admin-user-row" onClick={()=>openUser(u.id)}><td><b>{u.profile?.professional_name||u.profile?.full_name||'ProLink user'}</b></td><td>{u.email||'—'}</td><td className="admin-id">{u.id}</td><td>{fmt(u.created_at)}</td><td>{label(u.provider)}</td><td>{u.email_confirmed_at?'Confirmed':'Not confirmed'}</td><td><button type="button" className="admin-inline-action" onClick={event=>{event.stopPropagation();openUser(u.id);}}>View / Message</button></td></tr>)}</tbody></table></div>
   {!users.length&&<p className="admin-empty">No matching registered users.</p>}
  </section>}
  {tab==='Professional profiles'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Professional profiles</h2><p>View-only professional information.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, country or area"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Professional</th><th>Trade</th><th>Country</th><th>Region / State</th><th>District</th><th>City</th><th>Published</th></tr></thead><tbody>{profiles.map(p=><tr key={p.user_id}><td><button type="button" className="admin-user-link" onClick={()=>openUser(p.user_id)}>{p.professional_name||p.full_name||'—'}</button><small className="admin-cell-sub">{p.user_id}</small></td><td>{p.subcategory||p.category||'—'}</td><td>{p.country_name||'—'}</td><td>{p.region||'—'}</td><td>{p.district||'—'}</td><td>{p.city||'—'}</td><td>{p.is_published?'Yes':'No'}</td></tr>)}</tbody></table></div>
  </section>}
  {tab==='Work Requests'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Direct work-request records</h2><p>Administrative copies of customer requests. Each request is addressed to one selected professional only; this Admin record is not broadcast.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, professional or job"/></label></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Submitted</th><th>Professional</th><th>Professional account ID</th><th>Customer account ID</th><th>Job description</th><th>Preferred date</th><th>Job location</th><th>Professional viewed</th><th>Status</th></tr></thead><tbody>{workRequests.map(r=><tr key={r.id}><td>{fmt(r.created_at)}</td><td>{r.professional_name||'—'}</td><td><button type="button" className="admin-user-link" onClick={()=>openUser(r.professional_user_id)}>{r.professional_user_id}</button></td><td><button type="button" className="admin-user-link" onClick={()=>openUser(r.requester_user_id)}>{r.requester_user_id}</button></td><td style={{whiteSpace:'pre-wrap',minWidth:240}}>{r.job_description}</td><td>{r.preferred_date||'Flexible'}</td><td>{r.job_location}</td><td>{r.professional_read_at?`Delivered · Viewed ${fmt(r.professional_read_at)}`:'Delivered · Not viewed yet'}</td><td>{label(r.status)}</td></tr>)}</tbody></table></div>{!workRequests.length&&<p className="admin-empty">No work requests have been submitted.</p>}</section>}
  {tab==='Document review'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Document approval queue</h2><p>Inspect the submitted file, then approve or reject it. Submitted personal details are not editable.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search applicant or document"/></label></div>
   <div className="admin-review-layout"><div className="admin-review-list">{reviews.map(r=><button key={r.id} className={'admin-row '+(selected?.id===r.id?'chosen':'')} onClick={()=>setSelected(r)}><span><b>{label(r.submitted_data?.document_type||r.section)}</b><small>{r.submitted_data?.document_name||r.user_id}</small></span><em>{label(r.status)}</em></button>)}</div>
    {selected?<article className="admin-detail"><h3>Document review</h3><dl className="admin-readonly"><div><dt>Applicant ID</dt><dd><button type="button" className="admin-user-link" onClick={()=>openUser(selected.user_id)}>View applicant / Send message</button></dd></div><div><dt>Document type</dt><dd>{label(selected.submitted_data?.document_type||selected.section)}</dd></div><div><dt>File name</dt><dd>{selected.submitted_data?.document_name||'—'}</dd></div><div><dt>Submitted</dt><dd>{fmt(selected.submitted_at)}</dd></div><div><dt>Status</dt><dd>{label(selected.status)}</dd></div></dl>
     {selected.document_path&&<div className="admin-document-preview"><h4>Submitted document</h4>{documentLoading?<p>Preparing secure preview…</p>:documentUrl?<><a href={documentUrl} target="_blank" rel="noreferrer">Open document in a new tab</a>{(selected.submitted_data?.mime_type||'').startsWith('image/')?<img src={documentUrl} alt="Submitted document" style={{display:'block',maxWidth:'100%',maxHeight:480,objectFit:'contain',marginTop:12}}/>:selected.submitted_data?.mime_type==='application/pdf'?<iframe title="Submitted document" src={documentUrl} style={{width:'100%',height:480,border:0,marginTop:12}}/>:null}</>:<p>Document preview is unavailable.</p>}</div>}
     {selected.status==='pending'?<><label className="admin-reason">Rejection reason (required only when rejecting)<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain what is missing or unclear"/></label><div className="admin-actions"><button onClick={()=>act('approve')} disabled={busy}><Check size={15}/> Approve document</button><button className="admin-reject" onClick={()=>act('reject')} disabled={busy}><X size={15}/> Reject document</button></div></>:<p className="admin-readonly-status">This item has already been reviewed. No further changes are available here.</p>}
    </article>:<div className="admin-detail admin-detail-empty"><Eye size={22}/><p>Select a document to inspect it.</p></div>}
   </div>
  </section>}

  {tab==='Profile Change Requests'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Profile Change Requests</h2><p>Review proposed changes. Approved information remains unchanged until you approve a request.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search applicant or field"/></label></div>
   {(dashboard.profileChangeRequests||[]).filter(r=>(r.status+' '+r.user_id+' '+JSON.stringify(r.requested_changes||{})).toLowerCase().includes(query.toLowerCase())).map(r=><article className="admin-detail" key={r.id} style={{marginBottom:16}}><div className="admin-panel-heading"><div><h3>Applicant</h3><p className="admin-id"><button type="button" className="admin-user-link" onClick={()=>openUser(r.user_id)}>View user / Send message</button> · {r.user_id}</p></div><span className={'admin-status '+r.status}>{label(r.status)}</span></div><p><b>Requested:</b> {fmt(r.requested_at)}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Information</th><th>Proposed value</th></tr></thead><tbody>{Object.entries(r.requested_changes||{}).map(([key,value])=><tr key={key}><td>{label(key)}</td><td style={{whiteSpace:'pre-wrap'}}>{typeof value==='object'?JSON.stringify(value):String(value??'—')}</td></tr>)}</tbody></table></div>{r.status==='pending'?<><label className="admin-reason">Reason (required when rejecting)<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the decision"/></label><div className="admin-actions"><button disabled={busy} onClick={()=>reviewProfileChange(r,'approve')}><Check size={15}/> Approve changes</button><button className="admin-reject" disabled={busy} onClick={()=>reviewProfileChange(r,'reject')}><X size={15}/> Reject request</button></div></>:<p className="admin-readonly-status">Reviewed {fmt(r.reviewed_at)} · {r.review_reason||'No reason supplied'}</p>}</article>)}
   {!(dashboard.profileChangeRequests||[]).length&&<p className="admin-empty">No profile change requests have been submitted.</p>}
  </section>}
  {tab==='Review history'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Document review history</h2><p>Audit view of completed approval decisions.</p></div><label className="admin-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search history"/></label></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Document</th><th>Applicant ID</th><th>Decision</th><th>Submitted</th><th>Reviewed</th><th>Reason</th></tr></thead><tbody>{reviews.filter(r=>r.status!=='pending').map(r=><tr key={r.id}><td>{label(r.submitted_data?.document_type||r.section)}</td><td><button type="button" className="admin-user-link" onClick={()=>openUser(r.user_id)}>{r.user_id}</button></td><td><span className={'admin-status '+r.status}>{label(r.status)}</span></td><td>{fmt(r.submitted_at)}</td><td>{fmt(r.reviewed_at)}</td><td>{r.review_reason||'—'}</td></tr>)}</tbody></table></div>
  </section>}
  {tab==='Employers'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Employer / company profiles</h2><p>{counts.pendingEmployerProfiles??0} awaiting approval · {counts.employerProfiles??0} total employers. Approve a company profile before its owner can submit jobs.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>{recruitmentRows((dashboard.employerProfiles||[]).filter(r=>!query||((r.company_name+' '+r.contact_email+' '+r.country_name).toLowerCase().includes(query.toLowerCase()))),'employer',['approve','reject'])}</section>}
  {tab==='Job approvals'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Jobs awaiting approval</h2><p>Each job is reviewed separately. Approval publishes it to public job listings.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>{recruitmentRows((dashboard.jobs||[]).filter(r=>r.status==='pending'),'job',['approve','reject'])}</section>}
  {tab==='Job seekers'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Job-seeker profiles</h2><p>{counts.activeJobSeekers??0} approved and actively seeking · {counts.pendingJobSeekerProfiles??0} awaiting review.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>{recruitmentRows((dashboard.jobSeekerProfiles||[]),'job_seeker',['approve','reject'])}</section>}
  {tab==='Live jobs'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Live jobs</h2><p>Approved jobs currently visible to job seekers.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>{recruitmentRows((dashboard.jobs||[]).filter(r=>r.status==='live'),'job',['close'])}</section>}
  {tab==='Closed jobs'&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Closed jobs</h2><p>Closed jobs are retained for administration and removed from public listings.</p></div><button onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>{recruitmentRows((dashboard.jobs||[]).filter(r=>r.status==='closed'),'job',[])}</section>}
  {tab==='Support Inbox'&&<SupportInbox/>}
  {tab==='Email broadcasts'&&<BroadcastManager/>}
  {selectedUser&&<div className="admin-user-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedUser(null);}}>
   <section className="admin-user-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title">
    <header className="admin-user-dialog-header"><div><span className="admin-kicker">USER ACCOUNT · VIEW ONLY</span><h2 id="admin-user-dialog-title">{selectedUser.profile?.professional_name||selectedUser.profile?.full_name||'ProLink user'}</h2><p>{selectedUser.email||selectedUser.id}</p></div><button type="button" onClick={()=>setSelectedUser(null)} aria-label="Close user profile"><X size={20}/></button></header>
    <div className="admin-user-profile-grid">
     <div><small>Account ID</small><b className="admin-id">{selectedUser.id}</b></div>
     <div><small>Account created</small><b>{fmt(selectedUser.created_at)}</b></div>
     <div><small>Email verification</small><b>{selectedUser.email_confirmed_at?'Confirmed':'Not confirmed'}</b></div>
     <div><small>Sign-in provider</small><b>{label(selectedUser.provider)}</b></div>
     <div><small>Professional status</small><b>{selectedUser.profile?(selectedUser.profile.is_published?'Published profile':'Profile not published'):'No professional profile'}</b></div>
     <div><small>Profession</small><b>{selectedUser.profile?.subcategory||selectedUser.profile?.category||'Not provided'}</b></div>
     <div><small>Location</small><b>{[selectedUser.profile?.city,selectedUser.profile?.region,selectedUser.profile?.country_name].filter(Boolean).join(', ')||'Not provided'}</b></div>
     <div><small>Last sign-in</small><b>{fmt(selectedUser.last_sign_in_at)}</b></div>
    </div>
    <section className="admin-user-chat">
     <div className="admin-user-chat-heading"><div><h3><MessageCircle size={18}/> Conversation with user</h3><p>Messages stay in this ProLink Support conversation. Keep this window open to continue chatting; close it with × when finished.</p></div><span className="admin-chat-live">Live · 5s refresh</span></div>
     <div className="admin-user-chat-history" aria-live="polite" onScroll={event=>{const node=event.currentTarget;userChatAtBottomRef.current=node.scrollHeight-node.scrollTop-node.clientHeight<48;}}>
      {userConversationLoading&&!userConversation.length?<p className="admin-chat-state">Loading conversation…</p>:userConversation.length?userConversation.map(message=><article key={message.id||message.created_at+message.content} className={'admin-chat-message '+(message.sender_role==='admin'?'from-admin':message.sender_role==='user'?'from-user':'from-ai')}>
       <div className="admin-chat-message-meta"><b>{message.sender_role==='admin'?'You · Admin':message.sender_role==='user'?'User':'ProLink AI'}</b><time>{fmt(message.created_at)}</time></div>
       <p>{message.content}</p>
       {message.sender_role==='admin'&&<small className="admin-chat-receipt">{message.user_read_at?'Seen':message.delivered_at?'Delivered':'Sent'}</small>}
      </article>):<p className="admin-chat-state">No messages in this conversation yet. Send the first message below.</p>}
      <div ref={userChatEndRef}/>
     </div>
     <form className="admin-user-message-form" onSubmit={sendUserMessage}>
      <textarea rows="3" maxLength="6000" value={userMessage} onChange={event=>setUserMessage(event.target.value)} placeholder="Write a message…" required/>
      <div className="admin-user-message-actions"><small>{userMessage.length}/6000</small><button type="submit" disabled={sendingUserMessage||!userMessage.trim()}>{sendingUserMessage?'Sending…':<><Send size={15}/> Send message</>}</button></div>
     </form>
    </section>
   </section>
  </div>}
  <footer className="admin-footer"><ShieldCheck size={15}/> Bidx ProLink · Internal document review and customer support · User records remain read-only</footer>
 </div>;
}
