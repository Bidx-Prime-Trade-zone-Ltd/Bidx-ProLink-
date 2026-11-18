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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/geography" && request.method === "GET") return geography(request, ctx);

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
