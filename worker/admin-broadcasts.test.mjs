import test from "node:test";
import assert from "node:assert/strict";
import {adminBroadcasts,broadcastEmailHtml} from "./index.js";

const env={
  SUPABASE_URL:"https://prolink-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:"service-role-test",
  SUPABASE_ANON_KEY:"anon-test",
  RESEND_API_KEY:"re_test",
  BIDX_PROLINK_EMAIL_FROM:"Bidx ProLink <updates@bidxpro.online>"
};
const adminUser={id:"admin-id",email:"ojepaamedu@gmail.com"};
const campaignId="11111111-1111-4111-8111-111111111111";
function jsonResponse(value,status=200){return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});}
async function withFetch(mock,run){const original=globalThis.fetch;globalThis.fetch=mock;try{return await run();}finally{globalThis.fetch=original;}}
function adminRequest(body){return new Request("https://prolink.example/api/admin/broadcasts",{method:"POST",headers:{authorization:"Bearer admin-session","content-type":"application/json"},body:JSON.stringify(body)});}

test("broadcast recipient HTML safely escapes administrator-supplied content",()=>{
  const html=broadcastEmailHtml("<script>alert(1)</script>","Hello <img src=x onerror=alert(1)>\nSecond line");
  assert.equal(html.includes("<script>"),false);
  assert.equal(html.includes("<img"),false);
  assert.equal(html.includes("&lt;script&gt;"),true);
  assert.equal(html.includes("&lt;img"),true);
  assert.equal(html.includes("<br>Second line"),true);
});

test("only the authorised ProLink administrator can create a broadcast",async()=>{
  await withFetch(async input=>{
    if(String(input).endsWith("/auth/v1/user"))return jsonResponse({id:"other",email:"ordinary@example.test"});
    throw new Error("No other service should be called.");
  },async()=>{
    const response=await adminBroadcasts(adminRequest({action:"create",subject:"Notice",message:"Hello"}),env);
    assert.equal(response.status,403);
  });
});

test("broadcast creation snapshots only unique, confirmed, valid, non-deleted user emails",async()=>{
  const users=[
    {email:"ojepaamedu@gmail.com",email_confirmed_at:"2026-01-01",id:"1"},
    {email:"OJEPAAMEDU@gmail.com",email_confirmed_at:"2026-01-01",id:"2"},
    {email:"confirmed@example.test",email_confirmed_at:"2026-01-01",id:"3"},
    {email:"CONFIRMED@example.test",email_confirmed_at:"2026-01-01",id:"4"},
    {email:"pending@example.test",email_confirmed_at:null,id:"5"},
    {email:"bad-email",email_confirmed_at:"2026-01-01",id:"6"},
    {email:"deleted@example.test",email_confirmed_at:"2026-01-01",deleted_at:"2026-01-02",id:"7"}
  ];
  let saved=null;
  await withFetch(async(input,options={})=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse(adminUser);
    if(url.includes("/auth/v1/admin/users?page=1"))return jsonResponse({users});
    if(url.includes("/rest/v1/prolink_admin_broadcasts")&&options.method==="POST"){
      saved=JSON.parse(options.body);return jsonResponse([{id:campaignId,created_at:"2026-11-23T00:00:00Z"}],201);
    }
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminBroadcasts(adminRequest({action:"create",subject:"Service notice",message:"Important update"}),env);
    const body=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));
    assert.equal(body.campaign.recipient_count,1);
    assert.deepEqual(saved.recipient_emails,["confirmed@example.test"]);
    assert.equal(saved.created_by,adminUser.id);
    assert.equal(saved.status,"queued");
  });
});

test("broadcast sends no more than 100 individual emails per batch and advances only after acceptance",async()=>{
  const recipients=Array.from({length:101},(_,i)=>"user"+i+"@example.test");
  let batch=null,patch=null,idempotencyKey="";
  await withFetch(async(input,options={})=>{
    const url=String(input);
    if(url.endsWith("/auth/v1/user"))return jsonResponse(adminUser);
    if(url.includes("/rest/v1/prolink_admin_broadcasts?select=id,subject,body")){
      return jsonResponse([{id:campaignId,subject:"Update",body:"Hello",recipient_emails:recipients,recipient_count:101,sent_count:0,next_index:0,status:"queued"}]);
    }
    if(url==="https://api.resend.com/emails/batch"){
      batch=JSON.parse(options.body);idempotencyKey=options.headers["Idempotency-Key"];return jsonResponse({data:batch.map((_,i)=>({id:"email-"+i}))});
    }
    if(url.includes("/rest/v1/prolink_admin_broadcasts?id=eq.")){
      patch=JSON.parse(options.body);return new Response(null,{status:204});
    }
    throw new Error("Unexpected request: "+url);
  },async()=>{
    const response=await adminBroadcasts(adminRequest({action:"send",campaignId}),env);
    const body=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));
    assert.equal(body.done,false);
    assert.equal(batch.length,100);
    assert.equal(batch[0].to[0],"user0@example.test");
    assert.equal(batch[99].to[0],"user99@example.test");
    assert.equal(idempotencyKey,"prolink-broadcast-"+campaignId+"-chunk-0");
    assert.equal(patch.next_index,100);
    assert.equal(patch.sent_count,100);
    assert.equal(patch.status,"queued");
  });
});
