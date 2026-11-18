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

async function adminDashboard(request,env) {
  const auth=await requireProlinkAdmin(request,env);if(auth.error)return auth.error;
  try{
    const {config}=auth;
    const [profiles,reviews]=await Promise.all([
      supabaseRest(config,"/rest/v1/prolink_professional_profiles?select=*&order=approved_at.desc&limit=5000"),
      supabaseRest(config,"/rest/v1/prolink_review_records?select=*&order=submitted_at.desc&limit=5000")
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
    return json({counts,users,profiles,reviews,adminEmail:auth.user.email});
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
    if (url.pathname === "/api/geography" && request.method === "GET") return geography(request, ctx);
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
