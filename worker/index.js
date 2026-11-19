function json(body, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl }
  });
}

function normalizeAreaName(value) {
  return String(value || "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function featureName(feature) {
  const p = feature?.properties || {};
  return p.shapeName || p.NAME_1 || p.NAME_2 || p.NAME_3 || p.name || p.NAME || p.admin || p.NAME_EN || "";
}

function pointOnSegment(point, a, b) {
  const cross = (point[1]-a[1])*(b[0]-a[0])-(point[0]-a[0])*(b[1]-a[1]);
  if (Math.abs(cross) > 1e-8) return false;
  return point[0] >= Math.min(a[0],b[0])-1e-8 && point[0] <= Math.max(a[0],b[0])+1e-8 &&
    point[1] >= Math.min(a[1],b[1])-1e-8 && point[1] <= Math.max(a[1],b[1])+1e-8;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[j], b=ring[i];
    if (pointOnSegment(point,a,b)) return true;
    const intersects=((b[1]>point[1]) !== (a[1]>point[1])) &&
      (point[0] < (a[0]-b[0])*(point[1]-b[1])/(a[1]-b[1])+b[0]);
    if(intersects)inside=!inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!polygon?.length || !pointInRing(point,polygon[0])) return false;
  for(let i=1;i<polygon.length;i++) if(pointInRing(point,polygon[i])) return false;
  return true;
}

function pointInGeometry(point, geometry) {
  if(!geometry)return false;
  if(geometry.type==="Polygon")return pointInPolygon(point,geometry.coordinates);
  if(geometry.type==="MultiPolygon")return geometry.coordinates.some(polygon=>pointInPolygon(point,polygon));
  return false;
}

function representativePoint(feature) {
  const geometry=feature?.geometry;
  const polygons=geometry?.type==="Polygon"?[geometry.coordinates]:geometry?.type==="MultiPolygon"?geometry.coordinates:[];
  for(const polygon of polygons){
    const ring=polygon?.[0]||[];
    if(ring.length<3)continue;
    let x=0,y=0;
    for(const point of ring){x+=point[0];y+=point[1];}
    const average=[x/ring.length,y/ring.length];
    if(pointInPolygon(average,polygon))return average;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const candidate=[(a[0]+b[0]+average[0])/3,(a[1]+b[1]+average[1])/3];
      if(pointInPolygon(candidate,polygon))return candidate;
    }
    for(const point of ring)if(pointInPolygon(point,polygon))return point;
  }
  return null;
}

async function loadBoundaryLayer(iso3, level) {
  const metadataResponse=await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM${level}/`,{headers:{accept:"application/json"}});
  if(metadataResponse.status===404)return null;
  if(!metadataResponse.ok)throw new Error("Boundary metadata unavailable");
  const metadata=await metadataResponse.json();
  const dataUrl=metadata.simplifiedGeometryGeoJSON||metadata.gjDownloadURL;
  if(!dataUrl)return null;
  const boundaryResponse=await fetch(dataUrl,{headers:{accept:"application/geo+json, application/json"}});
  if(!boundaryResponse.ok)throw new Error("Boundary geometry unavailable");
  return {metadata,geo:await boundaryResponse.json()};
}

async function geography(request, ctx) {
  const url=new URL(request.url);
  const iso3=(url.searchParams.get("country")||"").toUpperCase();
  const level=Number(url.searchParams.get("level"));
  const parent=String(url.searchParams.get("parent")||"").trim();
  if(!/^[A-Z]{3}$/.test(iso3)||!Number.isInteger(level)||level<1||level>5)
    return json({error:"A valid ISO-3 country code and administrative level (1–5) are required."},400);
  if(level>1&&!parent)return json({error:"Select the parent administrative area first."},400);

  const cache=caches.default;
  const parentKey=normalizeAreaName(parent).replace(/ /g,"-");
  const cacheKey=new Request(`https://prolink-geo-cache.invalid/${iso3}/ADM${level}/${parentKey||"all"}`);
  const cached=await cache.match(cacheKey);
  if(cached)return cached;

  try{
    const childLayer=await loadBoundaryLayer(iso3,level);
    if(!childLayer)return json({country:iso3,level,areas:[],available:false},200,"public, max-age=21600");
    let parentFeature=null;
    if(level>1){
      const parentLayer=await loadBoundaryLayer(iso3,level-1);
      const wanted=normalizeAreaName(parent);
      parentFeature=(parentLayer?.geo?.features||[]).find(feature=>normalizeAreaName(featureName(feature))===wanted);
      if(!parentFeature)return json({country:iso3,level,parent,areas:[],available:false,parentNotFound:true},200,"public, max-age=1800");
    }
    const areas=(childLayer.geo.features||[]).filter(feature=>{
      if(!parentFeature)return true;
      const point=representativePoint(feature);
      return Boolean(point&&pointInGeometry(point,parentFeature.geometry));
    }).map(feature=>{
      const p=feature.properties||{};
      const name=featureName(feature);
      const id=p.shapeID||p.shapeISO||p.GID_1||p.GID_2||p.id||name;
      return name?{id:String(id||name),name:String(name)}:null;
    }).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
    const response=json({
      country:iso3,countryName:childLayer.metadata.boundaryName||iso3,level,
      levelName:childLayer.metadata.boundaryCanonical||`Administrative level ${level}`,
      parent:parent||null,source:"geoBoundaries",license:childLayer.metadata.boundaryLicense||"See source metadata",
      attribution:"Administrative boundary data from geoBoundaries. Check each layer's licence before redistribution.",
      available:areas.length>0,areas
    },200,"public, max-age=21600");
    ctx.waitUntil(cache.put(cacheKey,response.clone()));
    return response;
  }catch(error){
    console.error("[prolink-geography] lookup_failed",{country:iso3,level,name:error?.name||"Error"});
    return json({error:"Geographical data is temporarily unavailable. Enter the area manually."},502);
  }
}


function passwordChangeConfig(env) {
  return {url:env.VITE_SUPABASE_URL||env.SUPABASE_URL||"",anonKey:env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||"",serviceKey:env.SUPABASE_SERVICE_ROLE_KEY||"",resendKey:env.RESEND_API_KEY||""};
}
async function digestHex(value) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function passwordEncryptionKey(secret) {
  const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("bidx-prolink-password-change:"+secret));
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function encryptPendingPassword(password,secret) {
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await passwordEncryptionKey(secret);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(password));
  return {iv:[...iv].map(b=>b.toString(16).padStart(2,"0")).join(""),cipher:[...new Uint8Array(encrypted)].map(b=>b.toString(16).padStart(2,"0")).join("")};
}
async function decryptPendingPassword(row,secret) {
  const fromHex=s=>new Uint8Array((s.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
  const key=await passwordEncryptionKey(secret);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromHex(row.encryption_iv)},key,fromHex(row.encrypted_password));
  return new TextDecoder().decode(plain);
}
async function passwordChangeStart(request,env) {
  const cfg=passwordChangeConfig(env);
  if(!cfg.url||!cfg.anonKey||!cfg.serviceKey||!cfg.resendKey)return json({error:"Password-change service is not fully configured. Please contact support."},503);
  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Please sign in again before changing your password."},401);
  let body;try{body=await request.json();}catch{return json({error:"Invalid request."},400);}
  const current=String(body.currentPassword||""),next=String(body.newPassword||""),confirm=String(body.confirmPassword||"");
  if(!current||!next||next.length<8||next!==confirm)return json({error:"Enter your current password and matching new passwords of at least 8 characters."},400);
  if(current===next)return json({error:"Your new password must be different from your current password."},400);
  const userResponse=await fetch(cfg.url+"/auth/v1/user",{headers:{apikey:cfg.anonKey,authorization:auth}});
  if(!userResponse.ok)return json({error:"Your sign-in session has expired. Sign in again."},401);
  const user=await userResponse.json();
  if(!user.email||!user.id)return json({error:"Your account email could not be verified."},400);
  const check=await fetch(cfg.url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:cfg.anonKey,"content-type":"application/json"},body:JSON.stringify({email:user.email,password:current})});
  if(!check.ok)return json({error:"Your current password is incorrect."},400);
  const verified=await check.json();
  if(verified.user?.id!==user.id)return json({error:"The current password could not be verified for this account."},400);
  const tokenBytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...tokenBytes].map(b=>b.toString(16).padStart(2,"0")).join("");
  const tokenHash=await digestHex(token);
  const encrypted=await encryptPendingPassword(next,cfg.serviceKey);
  const expiresAt=new Date(Date.now()+20*60*1000).toISOString();
  try {
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_pending_password_changes?user_id=eq."+encodeURIComponent(user.id),{method:"DELETE"});
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_pending_password_changes",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,email:user.email,token_hash:tokenHash,encrypted_password:encrypted.cipher,encryption_iv:encrypted.iv,expires_at:expiresAt})});
    const confirmUrl=new URL("/api/auth/password-change/confirm",request.url);confirmUrl.searchParams.set("token",token);
    const emailResponse=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+cfg.resendKey,"content-type":"application/json"},body:JSON.stringify({from:env.BIDX_PROLINK_EMAIL_FROM||"Bidx ProLink <no-reply@bidxpro.online>",to:[user.email],subject:"Confirm your Bidx ProLink password change",html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24372d"><h2>Confirm your password change</h2><p>We received a request to change the password for your Bidx ProLink account.</p><p>Your current password will remain active until you confirm this request.</p><p style="margin:28px 0"><a href="${confirmUrl}" style="background:#146b50;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Confirm password change</a></p><p>This one-time link expires in 20 minutes. If you did not request this change, ignore this email. Your password will not be changed.</p><p>Bidx ProLink Support</p></div>`})});
    if(!emailResponse.ok){await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_pending_password_changes?user_id=eq."+encodeURIComponent(user.id),{method:"DELETE"});return json({error:"We could not send the confirmation email. Please try again later."},502);}
    return json({success:true,message:"A confirmation link has been sent to your registered email. Your current password remains active until you confirm it."});
  }catch(error){console.error("[prolink-password-change] request_failed",{name:error?.name||"Error"});return json({error:"We could not prepare your password change. Please try again later."},502);}
}
async function passwordChangeConfirm(request,env) {
  const cfg=passwordChangeConfig(env),url=new URL(request.url),token=url.searchParams.get("token")||"";
  const appUrl=new URL("/",request.url);
  if(!cfg.url||!cfg.serviceKey||token.length!==64){appUrl.searchParams.set("password_change","invalid");return Response.redirect(appUrl.toString(),302);}
  try{
    const tokenHash=await digestHex(token);
    const rows=await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_pending_password_changes?select=*&token_hash=eq."+tokenHash+"&limit=1");
    const row=rows?.[0];
    if(!row||row.used_at||new Date(row.expires_at).getTime()<Date.now()){appUrl.searchParams.set("password_change","expired");return Response.redirect(appUrl.toString(),302);}
    const password=await decryptPendingPassword(row,cfg.serviceKey);
    const update=await fetch(cfg.url+"/auth/v1/admin/users/"+encodeURIComponent(row.user_id),{method:"PUT",headers:{apikey:cfg.serviceKey,authorization:"Bearer "+cfg.serviceKey,"content-type":"application/json"},body:JSON.stringify({password})});
    if(!update.ok)throw new Error("Password update failed");
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_pending_password_changes?user_id=eq."+encodeURIComponent(row.user_id),{method:"DELETE"});
    appUrl.searchParams.set("password_change","success");
    return Response.redirect(appUrl.toString(),302);
  }catch(error){console.error("[prolink-password-change] confirmation_failed",{name:error?.name||"Error"});appUrl.searchParams.set("password_change","error");return Response.redirect(appUrl.toString(),302);}
}

const PROLINK_ADMIN_EMAIL = "ojepaamedu@gmail.com";

function adminConfig(env) {
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL || "",
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    anonKey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || ""
  };
}

async function requireProlinkAdmin(request, env) {
  const config=adminConfig(env);
  if(!config.url||!config.serviceKey||!config.anonKey) return {error:json({error:"Internal Admin server configuration is incomplete."},503)};
  const authorization=request.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer ")) return {error:json({error:"Sign in is required."},401)};
  const verify=await fetch(config.url+"/auth/v1/user",{headers:{apikey:config.anonKey,authorization}});
  if(!verify.ok) return {error:json({error:"Your session is invalid or expired."},401)};
  const user=await verify.json();
  if(String(user.email||"").toLowerCase()!==PROLINK_ADMIN_EMAIL) return {error:json({error:"You are not authorised to access ProLink Internal Admin."},403)};
  return {config,user};
}

async function supabaseRest(config,path,options={}) {
  const response=await fetch(config.url+path,{...options,headers:{
    apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey,
    "content-type":"application/json",...(options.headers||{})
  }});
  const raw=await response.text();
  let data=null;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
  if(!response.ok)throw new Error(data?.message||data?.error||"Supabase request failed.");
  return data;
}

const PROFILE_CHANGE_FIELDS = new Set(["title","full_name","date_of_birth","phone","whatsapp","country_code","country_iso3","country_name","region","district","city","local_area","professional_name","category","subcategory","experience","skills","about","business_phone","business_email","website","business_address"]);
async function signedInProfileUser(request,env){
  const config=adminConfig(env),authorization=request.headers.get("authorization")||"";
  if(!config.url||!config.serviceKey||!config.anonKey)return {error:json({error:"Profile change service is not configured."},503)};
  if(!authorization.startsWith("Bearer "))return {error:json({error:"Sign in is required."},401)};
  const response=await fetch(config.url+"/auth/v1/user",{headers:{apikey:config.anonKey,authorization}});
  if(!response.ok)return {error:json({error:"Your session is invalid or expired."},401)};
  return {config,user:await response.json(),authorization};
}
async function profileChangeStatus(request,env){
  const auth=await signedInProfileUser(request,env);if(auth.error)return auth.error;
  try{
    const rows=await supabaseRest(auth.config,"/rest/v1/prolink_professional_profiles?select=approved_at&user_id=eq."+encodeURIComponent(auth.user.id)+"&limit=1");
    const approvedAt=rows?.[0]?.approved_at||null,unlockAt=approvedAt?new Date(new Date(approvedAt).getTime()+90*86400000).toISOString():null;
    const requests=await supabaseRest(auth.config,"/rest/v1/prolink_profile_change_requests?select=id,status,requested_at,reviewed_at,review_reason&user_id=eq."+encodeURIComponent(auth.user.id)+"&order=requested_at.desc&limit=5");
    return json({approvedAt,unlockAt,locked:!unlockAt||Date.now()<new Date(unlockAt).getTime(),requests});
  }catch(error){return json({error:"Profile change status is temporarily unavailable."},502);}
}
async function profileChangeRequest(request,env){
  const auth=await signedInProfileUser(request,env);if(auth.error)return auth.error;
  try{
    const body=await request.json(),changes=body.changes||{},keys=Object.keys(changes);
    if(!keys.length||keys.some(key=>!PROFILE_CHANGE_FIELDS.has(key)))return json({error:"The request contains no valid profile changes."},400);
    const rows=await supabaseRest(auth.config,"/rest/v1/prolink_professional_profiles?select=approved_at&user_id=eq."+encodeURIComponent(auth.user.id)+"&limit=1");
    const approvedAt=rows?.[0]?.approved_at;
    if(!approvedAt)return json({error:"Your professional profile must be approved before requesting changes."},409);
    const unlockAt=new Date(new Date(approvedAt).getTime()+90*86400000);
    if(Date.now()<unlockAt.getTime())return json({error:"Your approved information is locked for 90 days. You can request changes after "+unlockAt.toLocaleDateString("en-GB")+"."},409);
    const pending=await supabaseRest(auth.config,"/rest/v1/prolink_profile_change_requests?select=id&user_id=eq."+encodeURIComponent(auth.user.id)+"&status=eq.pending&limit=1");
    if(pending?.length)return json({error:"You already have a change request awaiting Admin review."},409);
    await supabaseRest(auth.config,"/rest/v1/prolink_profile_change_requests",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({user_id:auth.user.id,requested_changes:changes,status:"pending"})});
    return json({success:true,message:"Your request has been sent to Admin. Your approved profile remains unchanged until approval."});
  }catch(error){return json({error:"Your profile change request could not be submitted."},502);}
}
async function adminProfileChange(request,env){
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  try{
    const body=await request.json(),id=String(body.requestId||""),action=String(body.action||""),reason=String(body.reason||"").trim();
    if(!id||!["approve","reject"].includes(action))return json({error:"Choose a valid review decision."},400);
    if(action==="reject"&&!reason)return json({error:"Enter a reason before rejecting this request."},400);
    const rows=await supabaseRest(auth.config,"/rest/v1/prolink_profile_change_requests?select=*&id=eq."+encodeURIComponent(id)+"&status=eq.pending&limit=1");
    const item=rows?.[0];if(!item)return json({error:"This request is no longer pending."},404);
    if(action==="approve"){
      const allowed=Object.fromEntries(Object.entries(item.requested_changes||{}).filter(([key])=>PROFILE_CHANGE_FIELDS.has(key)));
      const userResponse=await fetch(auth.config.url+"/auth/v1/admin/users/"+encodeURIComponent(item.user_id),{headers:{apikey:auth.config.serviceKey,authorization:"Bearer "+auth.config.serviceKey}});
      if(!userResponse.ok)throw new Error("Could not load the professional account.");
      const account=await userResponse.json();
      const metadata={...(account.user_metadata||{}),...allowed};
      const update=await fetch(auth.config.url+"/auth/v1/admin/users/"+encodeURIComponent(item.user_id),{method:"PUT",headers:{apikey:auth.config.serviceKey,authorization:"Bearer "+auth.config.serviceKey,"content-type":"application/json"},body:JSON.stringify({user_metadata:metadata})});
      if(!update.ok)throw new Error("Could not apply the approved account information.");
      const profileUpdate=await fetch(auth.config.url+"/rest/v1/prolink_professional_profiles?user_id=eq."+encodeURIComponent(item.user_id),{method:"PATCH",headers:{apikey:auth.config.serviceKey,authorization:"Bearer "+auth.config.serviceKey,"content-type":"application/json",prefer:"return=minimal"},body:JSON.stringify({...allowed,approved_at:new Date().toISOString()})});
      if(!profileUpdate.ok)throw new Error("Account details were updated, but the public professional record could not be updated. Contact support.");
    }
    await supabaseRest(auth.config,"/rest/v1/prolink_profile_change_requests?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:action==="approve"?"approved":"rejected",reviewed_at:new Date().toISOString(),reviewed_by:auth.user.id,review_reason:reason||null,approved_at:action==="approve"?new Date().toISOString():null})});
    return json({success:true,message:action==="approve"?"Profile changes approved. The 90-day lock has restarted.":"Profile change request rejected."});
  }catch(error){console.error("[prolink-admin] profile_change_review_failed",{name:error?.name||"Error"});return json({error:error?.message||"Profile change review failed."},502);}
}

async function adminDashboard(request,env) {
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  try{
    const {config}=auth;
    const [profiles,reviews,profileChangeRequests]=await Promise.all([
      supabaseRest(config,"/rest/v1/prolink_professional_profiles?select=*&order=approved_at.desc&limit=5000"),
      supabaseRest(config,"/rest/v1/prolink_review_records?select=*&order=submitted_at.desc&limit=5000"),
      supabaseRest(config,"/rest/v1/prolink_profile_change_requests?select=*&order=requested_at.desc&limit=1000")
    ]);
    let users=[],page=1;
    for(;page<=100;page++){
      const result=await supabaseRest(config,`/auth/v1/admin/users?page=${page}&per_page=1000`);
      const batch=result?.users||[];
      users.push(...batch.map(u=>({id:u.id,email:u.email||"",created_at:u.created_at||null,last_sign_in_at:u.last_sign_in_at||null,email_confirmed_at:u.email_confirmed_at||null,provider:u.app_metadata?.provider||"email"})));
      if(batch.length<1000)break;
    }
    const counts={
      totalUsers:users.length,
      newUsersToday:users.filter(u=>u.created_at&&new Date(u.created_at).toDateString()===new Date().toDateString()).length,
      professionalProfiles:profiles.length,
      pendingDocuments:reviews.filter(r=>r.status==="pending"&&r.document_path).length,
      pendingReviews:reviews.filter(r=>r.status==="pending").length,
      approvedDocuments:reviews.filter(r=>r.status==="approved").length,
      rejectedDocuments:reviews.filter(r=>r.status==="rejected").length
    };
    return json({counts,users,profiles,reviews,profileChangeRequests,adminEmail:auth.user.email});
  }catch(error){console.error("[prolink-admin] dashboard_failed",{name:error?.name||"Error"});return json({error:"Could not load the internal admin dashboard. Check the ProLink tables and service configuration."},502);}
}

async function adminReview(request,env) {
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  try{
    const body=await request.json();
    const recordId=String(body.recordId||"");
    const action=String(body.action||"");
    const reason=String(body.reason||"").trim();
    if(!recordId||!["approve","reject"].includes(action))return json({error:"Choose a valid document review action."},400);
    if(action==="reject"&&!reason)return json({error:"A reason is required when rejecting a document."},400);
    const response=await fetch(auth.config.url+"/rest/v1/rpc/prolink_admin_review",{
      method:"POST",headers:{apikey:auth.config.anonKey,authorization:request.headers.get("authorization"),"content-type":"application/json"},
      body:JSON.stringify({p_record_id:recordId,p_action:action,p_reason:reason||null})
    });
    const raw=await response.text();let result=null;try{result=raw?JSON.parse(raw):null;}catch{result=raw;}
    if(!response.ok)return json({error:result?.message||result?.error||"The document review action was not authorised or could not be saved."},response.status);
    return json({success:true,result});
  }catch(error){console.error("[prolink-admin] review_failed",{name:error?.name||"Error"});return json({error:error?.message||"Document review could not be saved."},502);}
}

async function adminDocument(request,env) {
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  const url=new URL(request.url),path=url.searchParams.get("path")||"";
  if(!path||path.startsWith("/")||path.split("/").some(part=>part===".."||!part))return json({error:"Invalid document path."},400);
  try{
    const response=await fetch(auth.config.url+"/storage/v1/object/sign/prolink-verification-documents/"+path.split("/").map(encodeURIComponent).join("/") ,{
      method:"POST",headers:{apikey:auth.config.serviceKey,authorization:"Bearer "+auth.config.serviceKey,"content-type":"application/json"},
      body:JSON.stringify({expiresIn:300})
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data?.message||"Document preview unavailable.");
    const signed=data.signedURL||data.signedUrl||"";
    return json({url:signed.startsWith("http")?signed:auth.config.url+"/storage/v1"+signed});
  }catch(error){return json({error:error?.message||"Document preview unavailable."},502);}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/password-change" && request.method === "POST") return passwordChangeStart(request, env);
    if (url.pathname === "/api/auth/password-change/confirm" && request.method === "GET") return passwordChangeConfirm(request, env);
    if (url.pathname === "/api/geography" && request.method === "GET") return geography(request, ctx);
    if (url.pathname === "/api/profile/change-status" && request.method === "GET") return profileChangeStatus(request, env);
    if (url.pathname === "/api/profile/change-request" && request.method === "POST") return profileChangeRequest(request, env);
    if (url.pathname === "/api/admin/profile-change" && request.method === "POST") return adminProfileChange(request, env);
    if (url.pathname === "/api/admin/dashboard" && request.method === "GET") return adminDashboard(request, env);
    if (url.pathname === "/api/admin/review" && request.method === "POST") return adminReview(request, env);
    if (url.pathname === "/api/admin/document" && request.method === "GET") return adminDocument(request, env);

    // National identity lookups are retired. Prolink now uses manual document review.
    if (url.pathname === "/api/identro-nin") {
      return json({ success: false, retired: true, message: "National identity lookup is not used by Prolink." }, 410);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);

    // Supabase public credentials are stored as Worker runtime secrets in the
    // hosting environment. Inject only the URL and publishable/anon key into
    // the HTML shell so Vite does not need them at build time.
    const assetsResponse = await env.ASSETS.fetch(request);
    const contentType = assetsResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return assetsResponse;

    const runtimeConfig = {
      supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL || "",
      supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || ""
    };
    const safeConfig = JSON.stringify(runtimeConfig).replace(/</g, "\\u003c");
    const configScript = `<script>window.__BIDX_PROLINK_CONFIG__=${safeConfig};</script>`;
    return new HTMLRewriter()
      .on("head", { element(element) { element.append(configScript, { html: true }); } })
      .transform(assetsResponse);
  }
};
