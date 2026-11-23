import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function polygonFeature(name,id,coordinates=[[[0,0],[4,0],[4,4],[0,4],[0,0]]]){
  return {type:"Feature",properties:{shapeName:name,shapeID:id},geometry:{type:"Polygon",coordinates}};
}
function layer(iso,level,features){
  return {
    type:"FeatureCollection",features
  };
}
function metadata(iso,level,count,url){
  return {boundaryISO:iso,boundaryType:"ADM"+level,boundaryName:"Test Country",boundaryCanonical:"Test administrative units",admUnitCount:String(count),boundaryID:iso+"-ADM"+level,boundaryYearRepresented:"2025",boundarySource:"National mapping authority",boundaryLicense:"CC BY 4.0",licenseSource:"https://example.test/license",simplifiedGeometryGeoJSON:url};
}
async function requestWithMock(mockFetch,url="https://prolink.example/api/geography?country=NGA&level=1"){
  const originalFetch=globalThis.fetch;
  const originalCaches=globalThis.caches;
  globalThis.fetch=mockFetch;
  const store=new Map();
  globalThis.caches={default:{
    async match(key){return store.get(String(key.url))||null;},
    async put(key,value){store.set(String(key.url),value);}
  }};
  try{
    return await worker.fetch(new Request(url),{}, {waitUntil:promise=>promise});
  }finally{
    globalThis.fetch=originalFetch;
    if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;
  }
}

test("geography rejects malformed ISO country codes before requesting source data",async()=>{
  let called=false;
  const response=await requestWithMock(async()=>{called=true;throw new Error("fetch should not run");},"https://prolink.example/api/geography?country=NG&level=1");
  assert.equal(response.status,400);
  assert.equal(called,false);
});

test("geography rejects metadata for a different country or administrative level",async()=>{
  const response=await requestWithMock(async input=>{
    const url=String(input);
    if(url.includes("/api/current/"))return Response.json(metadata("GHA",1,1,"https://data.test/layer"));
    throw new Error("Unexpected geometry download");
  });
  assert.equal(response.status,502);
  assert.equal((await response.json()).qualityStatus,"integrity-check-failed");
});

test("geography rejects a boundary file whose feature count differs from source metadata",async()=>{
  const response=await requestWithMock(async input=>{
    const url=String(input);
    if(url.includes("/api/current/"))return Response.json(metadata("NGA",1,2,"https://data.test/layer"));
    if(url==="https://data.test/layer")return Response.json(layer("NGA",1,[polygonFeature("Lagos","NG-LA")]));
    throw new Error("Unexpected request: "+url);
  });
  assert.equal(response.status,502);
  assert.equal((await response.json()).qualityStatus,"integrity-check-failed");
});

test("geography rejects duplicate administrative names instead of returning ambiguous choices",async()=>{
  const response=await requestWithMock(async input=>{
    const url=String(input);
    if(url.includes("/api/current/"))return Response.json(metadata("NGA",1,2,"https://data.test/layer"));
    if(url==="https://data.test/layer")return Response.json(layer("NGA",1,[
      polygonFeature("Central","NG-C1"),
      polygonFeature("Central","NG-C2",[[[5,0],[9,0],[9,4],[5,4],[5,0]]])
    ]));
    throw new Error("Unexpected request: "+url);
  });
  assert.equal(response.status,502);
  assert.equal((await response.json()).qualityStatus,"integrity-check-failed");
});

test("geography flags a parent name that matches multiple parent features",async()=>{
  const response=await requestWithMock(async input=>{
    const url=String(input);
    if(url.includes("/NGA/ADM2/"))return Response.json(metadata("NGA",2,1,"https://data.test/child"));
    if(url.includes("/NGA/ADM1/"))return Response.json(metadata("NGA",1,2,"https://data.test/parent"));
    if(url==="https://data.test/child")return Response.json(layer("NGA",2,[polygonFeature("Child","NG-CH")]));
    if(url==="https://data.test/parent")return Response.json(layer("NGA",1,[
      polygonFeature("Central","NG-P1"),
      polygonFeature("Central","NG-P2",[[[5,0],[9,0],[9,4],[5,4],[5,0]]])
    ]));
    throw new Error("Unexpected request: "+url);
  },"https://prolink.example/api/geography?country=NGA&level=2&parent=Central");
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.parentAmbiguous,true);
  assert.equal(body.areas.length,0);
});
