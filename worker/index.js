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


async function galleryUpload(request,env){
  const auth=await signedInProfileUser(request,env);
  if(auth.error)return auth.error;
  if(!env.MY_R2)return json({error:"Cloudflare MY_R2 is not connected. Check the Worker binding named MY_R2."},503);
  let form;
  try{form=await request.formData();}catch{return json({error:"The photo upload request could not be read. Please select the photos again."},400);}
  const files=form.getAll("files").filter(file=>file&&typeof file.arrayBuffer==="function"&&typeof file.size==="number");
  const caption=String(form.get("caption")||"").trim().slice(0,140);
  if(!files.length)return json({error:"Choose at least one photo to upload."},400);
  if(files.length>15)return json({error:"You can upload no more than 15 photos at a time."},400);
  const extensionByType={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  for(const file of files){
    if(!extensionByType[file.type])return json({error:"Only JPEG, PNG and WebP photos are supported."},400);
    if(file.size>8388608)return json({error:"Each photo must be no larger than 8 MB."},400);
  }
  const config=auth.config,userId=auth.user.id;
  const uploadedKeys=[],savedIds=[],savedItems=[];
  async function rollback(){
    if(savedIds.length){try{await supabaseRest(config,"/rest/v1/prolink_work_gallery?id=in.("+savedIds.join(",")+")&user_id=eq."+encodeURIComponent(userId),{method:"DELETE"});}catch(error){console.error("[prolink-gallery] rollback_records_failed",{name:error?.name||"Error"});}}
    if(uploadedKeys.length){try{await env.MY_R2.delete(uploadedKeys);}catch(error){console.error("[prolink-gallery] rollback_r2_failed",{name:error?.name||"Error"});}}
  }
  try{
    const existing=await supabaseRest(config,"/rest/v1/prolink_work_gallery?select=id&user_id=eq."+encodeURIComponent(userId)+"&limit=15");
    if((existing?.length||0)+files.length>15)return json({error:"Your portfolio can contain up to 15 photos. Remove a photo before adding more."},400);
    for(const file of files){
      const safeName=String(file.name||"work-photo").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"work-photo";
      const key="portfolio/"+userId+"/"+crypto.randomUUID()+"-"+safeName;
      await env.MY_R2.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=31536000, immutable"}});
      uploadedKeys.push(key);
      const inserted=await supabaseRest(config,"/rest/v1/prolink_work_gallery",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({user_id:userId,object_path:key,caption})});
      const item=Array.isArray(inserted)?inserted[0]:null;
      if(!item?.id)throw new Error("The photo was uploaded but its portfolio record could not be saved.");
      savedIds.push(item.id);
      savedItems.push({...item,url:"/api/gallery/photo?id="+encodeURIComponent(item.id)});
    }
    return json({items:savedItems,message:files.length+" work photo(s) uploaded successfully."});
  }catch(error){
    await rollback();
    console.error("[prolink-gallery] upload_failed",{name:error?.name||"Error",message:String(error?.message||"").slice(0,180)});
    return json({error:error?.message||"Photo upload failed. Please try again."},502);
  }
}

async function galleryPhoto(request,env){
  if(!env.MY_R2)return json({error:"Portfolio image storage is not configured."},503);
  const id=String(new URL(request.url).searchParams.get("id")||"").trim();
  if(!id)return json({error:"A portfolio photo ID is required."},400);
  const config=adminConfig(env);
  if(!config.url||!config.serviceKey||!config.anonKey)return json({error:"Portfolio image service is not configured."},503);
  let rows;
  try{rows=await supabaseRest(config,"/rest/v1/prolink_work_gallery?select=id,user_id,object_path,is_public&id=eq."+encodeURIComponent(id)+"&limit=1");}
  catch{return json({error:"Could not find this portfolio photo."},404);}
  const item=Array.isArray(rows)?rows[0]:null;
  if(!item)return json({error:"Portfolio photo not found."},404);
  if(!item.is_public){
    const authorization=request.headers.get("authorization")||"";
    if(!authorization.startsWith("Bearer "))return json({error:"Sign in to view this portfolio photo."},401);
    const verify=await fetch(config.url+"/auth/v1/user",{headers:{apikey:config.anonKey,authorization}});
    if(!verify.ok)return json({error:"Your session is invalid or expired."},401);
    const user=await verify.json();
    if(user.id!==item.user_id)return json({error:"You are not authorised to view this photo."},403);
  }
  try{
    if(String(item.object_path||"").startsWith("portfolio/")){
      const object=await env.MY_R2.get(item.object_path);
      if(!object)return json({error:"Portfolio image is not available in R2."},404);
      const headers=new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-type",object.httpMetadata?.contentType||"application/octet-stream");
      headers.set("x-content-type-options","nosniff");
      headers.set("cache-control",item.is_public?"public, max-age=3600":"private, no-store");
      return new Response(object.body,{headers});
    }
    const encoded=item.object_path.split("/").map(encodeURIComponent).join("/");
    const legacy=await fetch(config.url+"/storage/v1/object/prolink-work-gallery/"+encoded,{headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey}});
    if(!legacy.ok)return json({error:"Legacy portfolio photo could not be retrieved."},502);
    const headers=new Headers();
    headers.set("content-type",legacy.headers.get("content-type")||"application/octet-stream");
    headers.set("x-content-type-options","nosniff");
    headers.set("cache-control",item.is_public?"public, max-age=300":"private, no-store");
    return new Response(legacy.body,{headers});
  }catch(error){
    console.error("[prolink-gallery] photo_read_failed",{name:error?.name||"Error"});
    return json({error:"Could not retrieve this portfolio photo."},502);
  }
}

async function galleryDelete(request,env){
  const auth=await signedInProfileUser(request,env);
  if(auth.error)return auth.error;
  const id=String(new URL(request.url).searchParams.get("id")||"").trim();
  if(!id)return json({error:"A portfolio photo ID is required."},400);
  const config=auth.config,userId=auth.user.id;
  try{
    const rows=await supabaseRest(config,"/rest/v1/prolink_work_gallery?select=id,user_id,object_path&id=eq."+encodeURIComponent(id)+"&user_id=eq."+encodeURIComponent(userId)+"&limit=1");
    const item=Array.isArray(rows)?rows[0]:null;
    if(!item)return json({error:"Photo not found or you do not own it."},404);
    if(String(item.object_path||"").startsWith("portfolio/")){
      if(!env.MY_R2)return json({error:"MY R2 storage is not connected. The photo record was not deleted."},503);
      await env.MY_R2.delete(item.object_path);
    }else{
      const remove=await fetch(config.url+"/storage/v1/object/prolink-work-gallery",{method:"DELETE",headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey,"content-type":"application/json"},body:JSON.stringify({prefixes:[item.object_path]})});
      if(!remove.ok)throw new Error("The stored photo could not be removed.");
    }
    await supabaseRest(config,"/rest/v1/prolink_work_gallery?id=eq."+encodeURIComponent(id)+"&user_id=eq."+encodeURIComponent(userId),{method:"DELETE"});
    return json({success:true,message:"Photo removed."});
  }catch(error){
    console.error("[prolink-gallery] delete_failed",{name:error?.name||"Error",message:String(error?.message||"").slice(0,140)});
    return json({error:error?.message||"Could not remove this photo."},502);
  }
}

async function migratePortfolioBatch(request,env){
  const auth=await requireProlinkAdmin(request,env);
  if(auth.error)return auth.error;
  if(!env.MY_R2)return json({error:"Cloudflare R2 binding MY_R2 is not connected."},503);
  const url=new URL(request.url);
  const offset=Math.max(0,Number.parseInt(url.searchParams.get("offset")||"0",10)||0);
  const limit=Math.min(10,Math.max(1,Number.parseInt(url.searchParams.get("limit")||"10",10)||10));
  const config=auth.config;
  try{
    const rows=await supabaseRest(config,"/rest/v1/prolink_work_gallery?select=id,user_id,object_path&order=created_at.asc&limit="+limit+"&offset="+offset);
    let migrated=0,skipped=0,failed=0;
    for(const item of rows||[]){
      if(String(item.object_path||"").startsWith("portfolio/")){skipped++;continue;}
      try{
        const encoded=item.object_path.split("/").map(encodeURIComponent).join("/");
        const source=await fetch(config.url+"/storage/v1/object/prolink-work-gallery/"+encoded,{headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey}});
        if(!source.ok)throw new Error("Legacy Supabase image download failed ("+source.status+").");
        const contentType=source.headers.get("content-type")||"application/octet-stream";
        const extension=contentType==="image/png"?"png":contentType==="image/webp"?"webp":"jpg";
        const key="portfolio/"+item.user_id+"/"+crypto.randomUUID()+"."+extension;
        await env.MY_R2.put(key,await source.arrayBuffer(),{httpMetadata:{contentType,cacheControl:"public, max-age=31536000, immutable"}});
        try{await supabaseRest(config,"/rest/v1/prolink_work_gallery?id=eq."+encodeURIComponent(item.id),{method:"PATCH",body:JSON.stringify({object_path:key})});}
        catch(updateError){await env.MY_R2.delete(key);throw updateError;}
        const removed=await fetch(config.url+"/storage/v1/object/prolink-work-gallery",{method:"DELETE",headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey,"content-type":"application/json"},body:JSON.stringify({prefixes:[item.object_path]})});
        if(!removed.ok)console.error("[prolink-gallery] legacy_cleanup_pending",{id:item.id,status:removed.status});
        migrated++;
      }catch(error){
        failed++;
        console.error("[prolink-gallery] migration_item_failed",{id:item.id,message:String(error?.message||"").slice(0,160)});
      }
    }
    const nextOffset=offset+((rows||[]).length);
    return json({success:failed===0,migrated,skipped,failed,processed:(rows||[]).length,nextOffset,hasMore:(rows||[]).length===limit,message:failed?"Some photos need retry.":"Migration batch completed."});
  }catch(error){
    console.error("[prolink-gallery] migration_batch_failed",{message:String(error?.message||"").slice(0,180)});
    return json({error:"Could not process this portfolio migration batch."},502);
  }
}

async function verificationDocumentUpload(request,env){
  const auth=await signedInProfileUser(request,env);
  if(auth.error)return auth.error;
  if(!env.R2)return json({error:"Professional document storage is not connected. Check the Worker binding named R2."},503);
  let form;
  try{form=await request.formData();}catch{return json({error:"The document upload request could not be read. Please select the file again."},400);}
  const file=form.get("file");
  const type=String(form.get("document_type")||"");
  const allowedTypes=new Set(["working_id","competency_certificate","additional_skill_document"]);
  const allowedMime=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
  if(!file||typeof file.arrayBuffer!=="function"||!allowedTypes.has(type))return json({error:"Choose a valid professional document."},400);
  if(!allowedMime.has(file.type))return json({error:"Only JPEG, PNG, WebP and PDF documents are accepted."},400);
  if(file.size<1||file.size>10485760)return json({error:"Each professional document must be no larger than 10 MB."},400);
  const userId=auth.user.id;
  const safeName=String(file.name||"professional-document").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"professional-document";
  const key="verification/"+userId+"/"+type+"-"+crypto.randomUUID()+"-"+safeName;
  try{
    await env.R2.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:"private, no-store"}});
    let record;
    try{
      const inserted=await supabaseRest(auth.config,"/rest/v1/prolink_review_records",{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({
        user_id:userId,section:"supporting_document",status:"pending",document_path:key,
        submitted_data:{document_type:type,document_name:file.name,mime_type:file.type,country_code:String(form.get("country_code")||"").slice(0,3),storage_provider:"cloudflare_r2"}
      })});
      record=Array.isArray(inserted)?inserted[0]:null;
      if(!record?.id)throw new Error("The document review record could not be saved.");
    }catch(error){await env.R2.delete(key);throw error;}
    return json({success:true,id:record.id,path:key,message:"Professional document submitted for manual review."});
  }catch(error){
    console.error("[prolink-documents] upload_failed",{name:error?.name||"Error",message:String(error?.message||"").slice(0,160)});
    return json({error:error?.message||"Professional document upload failed."},502);
  }
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

async function migrateVerificationDocumentsBatch(request,env){
  const auth=await requireProlinkAdmin(request,env);
  if(auth.error)return auth.error;
  if(!env.R2)return json({error:"Professional document R2 binding R2 is not connected."},503);
  const url=new URL(request.url);
  const offset=Math.max(0,Number.parseInt(url.searchParams.get("offset")||"0",10)||0);
  const limit=Math.min(10,Math.max(1,Number.parseInt(url.searchParams.get("limit")||"10",10)||10));
  const config=auth.config;
  try{
    const rows=await supabaseRest(config,"/rest/v1/prolink_review_records?select=id,user_id,document_path,submitted_data&section=eq.supporting_document&document_path=not.is.null&order=created_at.asc&limit="+limit+"&offset="+offset);
    let migrated=0,skipped=0,failed=0;
    for(const item of rows||[]){
      if(String(item.document_path||"").startsWith("verification/")){skipped++;continue;}
      try{
        const encoded=String(item.document_path||"").split("/").map(encodeURIComponent).join("/");
        const source=await fetch(config.url+"/storage/v1/object/prolink-verification-documents/"+encoded,{headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey}});
        if(!source.ok)throw new Error("Legacy Supabase document download failed ("+source.status+").");
        const contentType=source.headers.get("content-type")||item.submitted_data?.mime_type||"application/octet-stream";
        if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(contentType))throw new Error("Unsupported legacy document type.");
        const safeName=String(item.submitted_data?.document_name||"document").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
        const key="verification/"+item.user_id+"/migrated-"+crypto.randomUUID()+"-"+safeName;
        await env.R2.put(key,await source.arrayBuffer(),{httpMetadata:{contentType,cacheControl:"private, no-store"}});
        try{
          const meta={...(item.submitted_data||{}),storage_provider:"cloudflare_r2",migrated_from:"supabase_storage"};
          await supabaseRest(config,"/rest/v1/prolink_review_records?id=eq."+encodeURIComponent(item.id),{method:"PATCH",body:JSON.stringify({document_path:key,submitted_data:meta})});
        }catch(updateError){await env.R2.delete(key);throw updateError;}
        const legacyRemoved=await fetch(config.url+"/storage/v1/object/prolink-verification-documents",{method:"DELETE",headers:{apikey:config.serviceKey,authorization:"Bearer "+config.serviceKey,"content-type":"application/json"},body:JSON.stringify({prefixes:[item.document_path]})});
        if(!legacyRemoved.ok)console.error("[prolink-documents] legacy_cleanup_pending",{id:item.id,status:legacyRemoved.status});
        migrated++;
      }catch(error){
        failed++;
        console.error("[prolink-documents] migration_item_failed",{id:item.id,message:String(error?.message||"").slice(0,160)});
      }
    }
    return json({success:failed===0,migrated,skipped,failed,processed:(rows||[]).length,nextOffset:offset+(rows||[]).length,hasMore:(rows||[]).length===limit,message:failed?"Some documents need retry.":"Document migration batch completed. Legacy copies have been retained for safety."});
  }catch(error){
    console.error("[prolink-documents] migration_failed",{message:String(error?.message||"").slice(0,160)});
    return json({error:"Could not migrate professional documents."},502);
  }
}

async function adminDocument(request,env) {
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  const url=new URL(request.url),path=url.searchParams.get("path")||"";
  if(!path||path.startsWith("/")||path.split("/").some(part=>part===".."||!part))return json({error:"Invalid document path."},400);
  try{
    if(path.startsWith("verification/")){
      if(!env.R2)return json({error:"Professional document R2 storage is not connected."},503);
      const object=await env.R2.get(path);
      if(!object)return json({error:"Professional document not found in R2."},404);
      const headers=new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-type",object.httpMetadata?.contentType||"application/octet-stream");
      headers.set("content-disposition","inline");
      headers.set("cache-control","private, no-store");
      headers.set("x-content-type-options","nosniff");
      return new Response(object.body,{headers});
    }
    const response=await fetch(auth.config.url+"/storage/v1/object/sign/prolink-verification-documents/"+path.split("/").map(encodeURIComponent).join("/") ,{
      method:"POST",headers:{apikey:auth.config.serviceKey,authorization:"Bearer "+auth.config.serviceKey,"content-type":"application/json"},
      body:JSON.stringify({expiresIn:300})
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data?.message||"Document preview unavailable.");
    const signed=data.signedURL||data.signedUrl||"";
    if(!signed)throw new Error("Document preview URL was not returned.");
    const signedUrl=signed.startsWith("http")?signed:auth.config.url+"/storage/v1"+signed;
    const legacyDocument=await fetch(signedUrl);
    if(!legacyDocument.ok)throw new Error("Legacy document preview could not be retrieved.");
    const headers=new Headers();
    headers.set("content-type",legacyDocument.headers.get("content-type")||"application/octet-stream");
    headers.set("content-disposition","inline");
    headers.set("cache-control","private, no-store");
    headers.set("x-content-type-options","nosniff");
    return new Response(legacyDocument.body,{headers});
  }catch(error){return json({error:error?.message||"Document preview unavailable."},502);}
}


function subscriptionConfig(env) {
  return {url:env.VITE_SUPABASE_URL||env.SUPABASE_URL||"",anonKey:env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||"",serviceKey:env.SUPABASE_SERVICE_ROLE_KEY||"",flutterwaveKey:env.FLUTTERWAVE_SECRET_KEY||""};
}
async function subscriptionStart(request,env) {
  const cfg=subscriptionConfig(env);
  if(!cfg.url||!cfg.anonKey||!cfg.serviceKey||!cfg.flutterwaveKey)return json({error:"Secure card payments are not fully configured on the server yet."},503);
  const authorization=request.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer "))return json({error:"Sign in to subscribe."},401);
  const userResponse=await fetch(cfg.url+"/auth/v1/user",{headers:{apikey:cfg.anonKey,authorization}});
  if(!userResponse.ok)return json({error:"Your sign-in session has expired. Sign in again."},401);
  const user=await userResponse.json();
  if(!user.id||!user.email)return json({error:"A verified account email is required to subscribe."},400);
  const txRef="PROLINK-"+user.id+"-"+crypto.randomUUID(),origin=new URL(request.url).origin;
  let stage="record_payment";
  try {
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_subscription_payments",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,tx_ref:txRef,amount:5,currency:"USD",status:"pending"})});
    stage="flutterwave_checkout";
    const response=await fetch("https://api.flutterwave.com/v3/payments",{method:"POST",headers:{authorization:"Bearer "+cfg.flutterwaveKey,"content-type":"application/json",accept:"application/json"},body:JSON.stringify({tx_ref:txRef,amount:5,currency:"USD",redirect_url:origin+"/api/subscription/callback",customer:{email:user.email,name:user.user_metadata?.full_name||user.user_metadata?.name||user.email},customizations:{title:"Bidx ProLink Professional Annual Plan",description:"12 months professional membership"},payment_options:"card",meta:{user_id:user.id,plan:"professional_annual"}})});
    let result;try{result=await response.json();}catch{result={};}
    const checkoutUrl=result?.data?.link;
    if(!response.ok||result?.status!=="success"||!checkoutUrl){
      const providerMessage=String(result?.message||result?.error||"Flutterwave did not return a checkout link.").slice(0,220);
      console.error("[prolink-subscription] flutterwave_rejected",{httpStatus:response.status,providerMessage});
      return json({error:"Flutterwave could not create checkout ("+response.status+"): "+providerMessage},502);
    }
    stage="save_checkout_link";
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_subscription_payments?tx_ref=eq."+encodeURIComponent(txRef),{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({checkout_url:checkoutUrl})});
    return json({checkoutUrl});
  }catch(error){console.error("[prolink-subscription] checkout_failed",{stage,name:error?.name||"Error",message:String(error?.message||"").slice(0,220)});return json({error:"Payment setup failed at "+stage+". "+String(error?.message||"Please try again.").slice(0,180)},502);}
}
async function subscriptionCallback(request,env) {
  const cfg=subscriptionConfig(env),url=new URL(request.url),txRef=url.searchParams.get("tx_ref")||"",transactionId=url.searchParams.get("transaction_id")||"",status=url.searchParams.get("status")||"",appUrl=new URL("/",url.origin);
  if(status!=="successful"||!txRef||!transactionId){appUrl.searchParams.set("subscription","not-completed");return Response.redirect(appUrl.toString(),303);}
  try{
    const rows=await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/prolink_subscription_payments?select=id,user_id,tx_ref,amount,currency,status&tx_ref=eq."+encodeURIComponent(txRef)+"&limit=1"),payment=rows?.[0];
    if(!payment)throw new Error("Payment reference not found");
    if(payment.status==="successful"){appUrl.searchParams.set("subscription","success");return Response.redirect(appUrl.toString(),303);}
    const verifyResponse=await fetch("https://api.flutterwave.com/v3/transactions/"+encodeURIComponent(transactionId)+"/verify",{headers:{authorization:"Bearer "+cfg.flutterwaveKey,accept:"application/json"}});
    const verified=await verifyResponse.json(),data=verified?.data;
    if(!verifyResponse.ok||verified?.status!=="success"||data?.status!=="successful"||String(data?.tx_ref)!==txRef||String(data?.currency)!=="USD"||Number(data?.amount)<5||Number(data?.charged_amount||data?.amount)<5)throw new Error("Flutterwave verification did not match expected payment.");
    await supabaseRest({url:cfg.url,serviceKey:cfg.serviceKey},"/rest/v1/rpc/prolink_activate_membership",{method:"POST",body:JSON.stringify({p_tx_ref:txRef,p_transaction_id:String(data.id)})});
    appUrl.searchParams.set("subscription","success");
  }catch(error){console.error("[prolink-subscription] verification_failed",{name:error?.name||"Error"});appUrl.searchParams.set("subscription","verification-pending");}
  return Response.redirect(appUrl.toString(),303);
}


async function reverseGeocode(request, env) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return json({ error: "Valid latitude and longitude are required." }, 400);
  }
  const apiKey = env.GEOAPIFY_API_KEY;
  if (!apiKey) return json({ error: "Location service is not configured." }, 503);
  try {
    const endpoint = new URL("https://api.geoapify.com/v1/geocode/reverse");
    endpoint.searchParams.set("lat", String(lat));
    endpoint.searchParams.set("lon", String(lon));
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("lang", "en");
    endpoint.searchParams.set("limit", "1");
    endpoint.searchParams.set("apiKey", apiKey);
    const response = await fetch(endpoint.toString(), { headers: { accept: "application/json" } });
    if (!response.ok) {
      console.error("[prolink-location] geocoder_rejected", { status: response.status });
      return json({ error: "We could not identify this location. Please enter your city manually." }, 502);
    }
    const data = await response.json();
    const place = data?.results?.[0] || data?.features?.[0]?.properties || null;
    if (!place) return json({ error: "No readable location was found. Please enter your city manually." }, 404);
    const localArea = place.suburb || place.neighbourhood || place.neighborhood || place.quarter || place.residential || "";
    const district = place.district || place.county || place.municipality || "";
    const city = place.city || place.town || place.village || place.municipality || "";
    const region = place.state || place.region || place.state_district || "";
    const country = place.country || "";
    const countryCode = String(place.country_code || "").toUpperCase();
    const displayName = [localArea || city || district || region, country].filter(Boolean).join(", ") || place.formatted || "";
    if (!displayName) return json({ error: "No readable location was found. Please enter your city manually." }, 404);
    return json({ displayName, localArea, district, city, region, country, countryCode, postcode: place.postcode || "" }, 200, "private, max-age=300");
  } catch (error) {
    console.error("[prolink-location] reverse_geocode_failed", { name: error?.name || "Error" });
    return json({ error: "Location lookup is temporarily unavailable. Please enter your city manually." }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscription/checkout" && request.method === "POST") return subscriptionStart(request, env);
    if (url.pathname === "/api/subscription/callback" && request.method === "GET") return subscriptionCallback(request, env);
    if (url.pathname === "/api/auth/password-change" && request.method === "POST") return passwordChangeStart(request, env);
    if (url.pathname === "/api/auth/password-change/confirm" && request.method === "GET") return passwordChangeConfirm(request, env);
    if (url.pathname === "/api/geography" && request.method === "GET") return geography(request, ctx);
    if (url.pathname === "/api/location/reverse" && request.method === "GET") return reverseGeocode(request, env);
    if (url.pathname === "/api/profile/change-status" && request.method === "GET") return profileChangeStatus(request, env);
    if (url.pathname === "/api/profile/change-request" && request.method === "POST") return profileChangeRequest(request, env);
    if (url.pathname === "/api/admin/profile-change" && request.method === "POST") return adminProfileChange(request, env);
    if (url.pathname === "/api/admin/dashboard" && request.method === "GET") return adminDashboard(request, env);
    if (url.pathname === "/api/admin/review" && request.method === "POST") return adminReview(request, env);
    if (url.pathname === "/api/admin/document" && request.method === "GET") return adminDocument(request, env);
    if (url.pathname === "/api/verification/document" && request.method === "POST") return verificationDocumentUpload(request, env);
    if (url.pathname === "/api/admin/verification/migrate-r2" && request.method === "POST") return migrateVerificationDocumentsBatch(request, env);
    if (url.pathname === "/api/gallery/upload" && request.method === "POST") return galleryUpload(request, env);
    if (url.pathname === "/api/gallery/photo" && request.method === "GET") return galleryPhoto(request, env);
    if (url.pathname === "/api/gallery/delete" && request.method === "DELETE") return galleryDelete(request, env);
    if (url.pathname === "/api/admin/gallery/migrate-r2" && request.method === "POST") return migratePortfolioBatch(request, env);

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
