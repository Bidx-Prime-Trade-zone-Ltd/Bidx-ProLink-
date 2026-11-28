import test from "node:test";
import assert from "node:assert/strict";
import { adminDashboard } from "./index.js";

const env={
  SUPABASE_URL:"https://prolink-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:"service-role-test",
  SUPABASE_ANON_KEY:"anon-test"
};
const userRows=Array.from({length:5},(_,i)=>({
  id:"user-"+i,email:i===0?"ojepaamedu@gmail.com":"user"+i+"@example.test",created_at:new Date().toISOString(),
  last_sign_in_at:null,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:"email"}
}));
const profileRows=[{user_id:"profile-1",full_name:"Test Professional"}];
const reviewRows=[
  {id:1,status:"approved",document_path:"doc-1"},
  {id:2,status:"approved",document_path:"doc-2"},
  {id:3,status:"approved",document_path:"doc-3"},
  {id:4,status:"approved",document_path:"doc-4"}
];

async function withFetch(mock,run){
  const original=globalThis.fetch;
  globalThis.fetch=mock;
  try{return await run();}finally{globalThis.fetch=original;}
}
function adminRequest(){
  return new Request("https://prolink.example/api/admin/dashboard",{
    headers:{authorization:"Bearer admin-session"}
  });
}
function jsonResponse(value,status=200){
  return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
}

test("admin dashboard returns real counts from the ProLink account and review tables",async()=>{
  await withFetch(async input=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse({id:"admin-id",email:"ojepaamedu@gmail.com"});
    if(url.includes("/rest/v1/prolink_professional_profiles"))return jsonResponse(profileRows);
    if(url.includes("/rest/v1/prolink_review_records"))return jsonResponse(reviewRows);
    if(url.includes("/rest/v1/prolink_profile_change_requests"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_employer_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_job_seeker_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_jobs"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_employer_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_job_seeker_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_jobs"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_recruitment_registrations"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_work_requests"))return jsonResponse([]);
    if(url.includes("/auth/v1/admin/users?page=1"))return jsonResponse({users:userRows});
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminDashboard(adminRequest(),env);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.counts.totalUsers,4);
    assert.equal(body.users.length,4);
    assert.equal(body.users.some(user=>user.email.toLowerCase()==='ojepaamedu@gmail.com'),false);
    assert.equal(body.counts.newUsersToday,4);
    assert.equal(body.counts.professionalProfiles,1);
    assert.equal(body.counts.pendingDocuments,0);
    assert.equal(body.counts.approvedDocuments,4);
    assert.equal(body.counts.rejectedDocuments,0);
    assert.equal(body.counts.employerAccounts,0);
    assert.equal(body.counts.employerProfiles,0);
    assert.equal(body.counts.pendingEmployerProfiles,0);
    assert.equal(body.counts.jobSeekerAccounts,0);
    assert.equal(body.counts.jobSeekerProfiles,0);
    assert.equal(body.counts.pendingJobs,0);
    assert.equal(body.counts.liveJobs,0);
    assert.equal(body.counts.closedJobs,0);
    assert.deepEqual(body.warnings,[]);
  });
});

test("one unavailable dashboard table does not blank every metric",async()=>{
  await withFetch(async input=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse({id:"admin-id",email:"ojepaamedu@gmail.com"});
    if(url.includes("/rest/v1/prolink_professional_profiles"))return jsonResponse(profileRows);
    if(url.includes("/rest/v1/prolink_review_records"))return jsonResponse(reviewRows);
    if(url.includes("/rest/v1/prolink_profile_change_requests"))return jsonResponse({message:"relation does not exist"},404);
    if(url.includes("/rest/v1/prolink_employer_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_job_seeker_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_jobs"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_work_requests"))return jsonResponse([]);
    if(url.includes("/auth/v1/admin/users?page=1"))return jsonResponse({users:userRows});
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminDashboard(adminRequest(),env);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.counts.totalUsers,4);
    assert.equal(body.counts.professionalProfiles,1);
    assert.equal(body.counts.approvedDocuments,4);
    assert.deepEqual(body.warnings,["profile_change_requests"]);
    assert.deepEqual(body.profileChangeRequests,[]);
  });
});

test("an unavailable user directory marks only user counts unavailable",async()=>{
  await withFetch(async input=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse({id:"admin-id",email:"ojepaamedu@gmail.com"});
    if(url.includes("/rest/v1/prolink_professional_profiles"))return jsonResponse(profileRows);
    if(url.includes("/rest/v1/prolink_review_records"))return jsonResponse(reviewRows);
    if(url.includes("/rest/v1/prolink_profile_change_requests"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_employer_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_job_seeker_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_jobs"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_work_requests"))return jsonResponse([]);
    if(url.includes("/auth/v1/admin/users?page=1"))return jsonResponse({message:"forbidden"},403);
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminDashboard(adminRequest(),env);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.counts.totalUsers,null);
    assert.equal(body.counts.newUsersToday,null);
    assert.equal(body.counts.professionalProfiles,1);
    assert.equal(body.counts.approvedDocuments,4);
    assert.deepEqual(body.warnings,["registered_users"]);
  });
});

test("employer and job-seeker account cards count registrations before profiles exist",async()=>{
  const registrations=[
    {user_id:"user-1",account_type:"employer",registered_at:new Date().toISOString()},
    {user_id:"user-2",account_type:"job_seeker",registered_at:new Date().toISOString()},
    {user_id:"user-3",account_type:"job_seeker",registered_at:new Date().toISOString()}
  ];
  await withFetch(async input=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse({id:"admin-id",email:"ojepaamedu@gmail.com"});
    if(url.includes("/rest/v1/prolink_professional_profiles"))return jsonResponse(profileRows);
    if(url.includes("/rest/v1/prolink_review_records"))return jsonResponse(reviewRows);
    if(url.includes("/rest/v1/prolink_profile_change_requests"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_employer_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_job_seeker_profiles"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_jobs"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_work_requests"))return jsonResponse([]);
    if(url.includes("/rest/v1/prolink_recruitment_registrations"))return jsonResponse(registrations);
    if(url.includes("/auth/v1/admin/users?page=1"))return jsonResponse({users:userRows});
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminDashboard(adminRequest(),env);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.counts.employerAccounts,1);
    assert.equal(body.counts.jobSeekerAccounts,2);
    assert.equal(body.counts.employerProfiles,0);
    assert.equal(body.counts.jobSeekerProfiles,0);
    assert.deepEqual(body.users.find(user=>user.id==="user-1").recruitmentRoles,["employer"]);
    assert.deepEqual(body.users.find(user=>user.id==="user-2").recruitmentRoles,["job_seeker"]);
  });
});
