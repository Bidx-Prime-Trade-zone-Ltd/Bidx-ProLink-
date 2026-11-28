import React,{useEffect,useState} from 'react';
import {ArrowLeft,Building2,Users,BriefcaseBusiness,RefreshCw,PlusCircle,Lock,CheckCircle2,Clock3,AlertCircle} from 'lucide-react';

const statusText=value=>String(value||'pending').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const emptyEmployer={company_name:'',registration_number:'',industry:'',website:'',description:'',contact_email:'',phone:'',country_name:'',region:'',city:'',address:''};
const emptySeeker={full_name:'',headline:'',skills:'',experience:'',bio:'',country_name:'',region:'',city:''};
const emptyJob={title:'',description:'',requirements:'',location:'',country_name:'',employment_type:'full_time',workplace_type:'onsite',salary_min:'',salary_max:'',currency:''};

export default function RecruitmentWorkspace({session,onBack}){
 const [section,setSection]=useState('employer'),[data,setData]=useState({employer:null,jobSeeker:null,jobs:[]});
 const [employer,setEmployer]=useState(emptyEmployer),[seeker,setSeeker]=useState(emptySeeker),[job,setJob]=useState(emptyJob);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 const token=session?.access_token;
 const load=async()=>{
  if(!token)return;
  setLoading(true);
  try{const response=await fetch('/api/recruitment',{headers:{authorization:'Bearer '+token}});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Recruitment workspace could not load.');setData(payload);if(payload.employer)setEmployer({...emptyEmployer,...payload.employer});if(payload.jobSeeker)setSeeker({...emptySeeker,...payload.jobSeeker,skills:(payload.jobSeeker.skills||[]).join(', ')});}
  catch(error){setNotice(error.message||'Recruitment workspace could not load.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{load();},[token]);
 const submit=async(kind,values)=>{
  setBusy(true);setNotice('');
  try{const response=await fetch('/api/recruitment',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({kind,...values})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Your submission could not be saved.');setNotice(payload.message||'Submitted successfully.');await load();}
  catch(error){setNotice(error.message||'Your submission could not be saved.');}
  finally{setBusy(false);}
 };
 const close=async(action,id)=>{
  if(!window.confirm(action==='close_job'?'Close this vacancy? It will disappear from public listings.':'Close your job-seeker profile? You will no longer appear in active job-seeker listings.'))return;
  setBusy(true);setNotice('');
  try{const response=await fetch('/api/recruitment',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({action,id})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not close this record.');setNotice(payload.message||'Closed successfully.');await load();}
  catch(error){setNotice(error.message||'Could not close this record.');}
  finally{setBusy(false);}
 };
 const stateBadge=(status)=><span className={'recruitment-status '+status}>{statusText(status)}</span>;
 return <main className="content-wrap info-page account-page-shell recruitment-workspace">
  <button className="recruitment-back" type="button" onClick={onBack}><ArrowLeft size={17}/> Back to ProLink</button>
  <span className="eyebrow">BIDX PROLINK · EMPLOYMENT WORKSPACE</span>
  <h1>Employment workspace</h1>
  <p className="lead">Create an employer or job-seeker profile. Company profiles and candidate profiles are reviewed before they become active. Every vacancy is separately reviewed before publication.</p>
  {notice&&<p className="recruitment-notice" role="status">{notice}</p>}
  <div className="recruitment-tabs">
   <button className={section==='employer'?'active':''} onClick={()=>setSection('employer')}><Building2 size={17}/> Employer profile</button>
   <button className={section==='jobs'?'active':''} onClick={()=>setSection('jobs')}><BriefcaseBusiness size={17}/> Post a job</button>
   <button className={section==='seeker'?'active':''} onClick={()=>setSection('seeker')}><Users size={17}/> Job-seeker profile</button>
  </div>
  {loading?<p className="recruitment-loading">Loading your employment records…</p>:<>
   {section==='employer'&&<section className="recruitment-card"><div className="recruitment-card-heading"><div><h2>Company / employer profile</h2><p>Submit your organisation details for review. Approval is required before posting vacancies.</p></div>{data.employer&&stateBadge(data.employer.status)}</div>
    <form className="recruitment-form" onSubmit={e=>{e.preventDefault();submit('employer',employer);}}>
     <label>Company / organisation name<input required value={employer.company_name} onChange={e=>setEmployer({...employer,company_name:e.target.value})}/></label>
     <div className="recruitment-form-grid"><label>Registration number (optional)<input value={employer.registration_number||''} onChange={e=>setEmployer({...employer,registration_number:e.target.value})}/></label><label>Industry<input value={employer.industry||''} onChange={e=>setEmployer({...employer,industry:e.target.value})}/></label>
      <label>Contact email<input type="email" value={employer.contact_email||session?.user?.email||''} onChange={e=>setEmployer({...employer,contact_email:e.target.value})}/></label><label>Phone<input value={employer.phone||''} onChange={e=>setEmployer({...employer,phone:e.target.value})}/></label>
      <label>Country<input value={employer.country_name||''} onChange={e=>setEmployer({...employer,country_name:e.target.value})}/></label><label>State / region<input value={employer.region||''} onChange={e=>setEmployer({...employer,region:e.target.value})}/></label><label>City<input value={employer.city||''} onChange={e=>setEmployer({...employer,city:e.target.value})}/></label><label>Website<input type="url" value={employer.website||''} onChange={e=>setEmployer({...employer,website:e.target.value})}/></label></div>
     <label>Company address<input value={employer.address||''} onChange={e=>setEmployer({...employer,address:e.target.value})}/></label><label>About the company<textarea rows="4" value={employer.description||''} onChange={e=>setEmployer({...employer,description:e.target.value})}/></label>
     {data.employer?.review_reason&&<p className="recruitment-review-reason">Admin feedback: {data.employer.review_reason}</p>}
     <button className="primary-button" disabled={busy}>{busy?'Submitting…':data.employer?'Resubmit company profile for review':'Submit company profile'}</button>
    </form>
   </section>}
   {section==='jobs'&&<><section className="recruitment-card"><div className="recruitment-card-heading"><div><h2>Post a vacancy</h2><p>Jobs are not public until Admin approval.</p></div>{data.employer&&stateBadge(data.employer.status)}</div>
    {!data.employer||data.employer.status!=='approved'?<div className="recruitment-callout"><Lock size={18}/><span>Your employer company profile must be approved before you can submit a job.</span><button type="button" onClick={()=>setSection('employer')}>Open employer profile</button></div>:<form className="recruitment-form" onSubmit={e=>{e.preventDefault();submit('job',job);setJob(emptyJob);}}>
     <label>Job title<input required minLength="3" value={job.title} onChange={e=>setJob({...job,title:e.target.value})}/></label><label>Job description<textarea required minLength="20" rows="5" value={job.description} onChange={e=>setJob({...job,description:e.target.value})}/></label><label>Requirements<textarea rows="4" value={job.requirements} onChange={e=>setJob({...job,requirements:e.target.value})}/></label>
     <div className="recruitment-form-grid"><label>Work location<input value={job.location} onChange={e=>setJob({...job,location:e.target.value})}/></label><label>Country<input value={job.country_name} onChange={e=>setJob({...job,country_name:e.target.value})}/></label>
      <label>Employment type<select value={job.employment_type} onChange={e=>setJob({...job,employment_type:e.target.value})}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="temporary">Temporary</option><option value="internship">Internship</option></select></label><label>Workplace type<select value={job.workplace_type} onChange={e=>setJob({...job,workplace_type:e.target.value})}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
      <label>Minimum salary<input type="number" min="0" step="0.01" value={job.salary_min} onChange={e=>setJob({...job,salary_min:e.target.value})}/></label><label>Maximum salary<input type="number" min="0" step="0.01" value={job.salary_max} onChange={e=>setJob({...job,salary_max:e.target.value})}/></label><label>Currency code<input placeholder="NGN, GHS, USD…" value={job.currency} onChange={e=>setJob({...job,currency:e.target.value.toUpperCase()})}/></label></div>
     <button className="primary-button" disabled={busy}>{busy?'Submitting…':'Submit job for approval'}</button>
    </form>}
   </section><section className="recruitment-card"><h2>Your job postings</h2>{data.jobs.length?data.jobs.map(item=><article className="recruitment-job-row" key={item.id}><div><b>{item.title}</b><small>{item.location||item.country_name||'Location not supplied'} · {stateBadge(item.status)}</small>{item.review_reason&&<small className="recruitment-review-reason">Admin feedback: {item.review_reason}</small>}</div>{item.status==='live'&&<button type="button" disabled={busy} onClick={()=>close('close_job',item.id)}>Close job</button>}</article>):<p>You have not posted any jobs yet.</p>}</section></>}
   {section==='seeker'&&<section className="recruitment-card"><div className="recruitment-card-heading"><div><h2>Job-seeker profile</h2><p>Make your profile available to employers after Admin review. Close it when you are no longer looking for work.</p></div>{data.jobSeeker&&stateBadge(data.jobSeeker.status)}</div>
    <form className="recruitment-form" onSubmit={e=>{e.preventDefault();submit('job_seeker',seeker);}}>
     <label>Full name<input required value={seeker.full_name} onChange={e=>setSeeker({...seeker,full_name:e.target.value})}/></label><label>Professional headline<input value={seeker.headline||''} onChange={e=>setSeeker({...seeker,headline:e.target.value})}/></label><label>Skills (separate with commas)<input value={seeker.skills||''} onChange={e=>setSeeker({...seeker,skills:e.target.value})}/></label><label>Experience<textarea rows="3" value={seeker.experience||''} onChange={e=>setSeeker({...seeker,experience:e.target.value})}/></label><label>About you<textarea rows="4" value={seeker.bio||''} onChange={e=>setSeeker({...seeker,bio:e.target.value})}/></label>
     <div className="recruitment-form-grid"><label>Country<input value={seeker.country_name||''} onChange={e=>setSeeker({...seeker,country_name:e.target.value})}/></label><label>State / region<input value={seeker.region||''} onChange={e=>setSeeker({...seeker,region:e.target.value})}/></label><label>City<input value={seeker.city||''} onChange={e=>setSeeker({...seeker,city:e.target.value})}/></label></div>
     {data.jobSeeker?.review_reason&&<p className="recruitment-review-reason">Admin feedback: {data.jobSeeker.review_reason}</p>}
     <button className="primary-button" disabled={busy}>{busy?'Submitting…':data.jobSeeker?'Resubmit profile for review':'Submit job-seeker profile'}</button>
    </form>
    {data.jobSeeker?.seeking_status==='active'&&<button className="recruitment-close-profile" type="button" disabled={busy} onClick={()=>close('close_job_seeker')}>Close my job-seeker profile — I am no longer looking</button>}
    {data.jobSeeker?.seeking_status==='closed'&&<p className="recruitment-callout"><CheckCircle2 size={18}/> Your job-seeker profile is closed and hidden from active listings.</p>}
   </section>}
  </>}
 </main>;
}
