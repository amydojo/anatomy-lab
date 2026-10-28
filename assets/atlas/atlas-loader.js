/* V6 abortable lazy geometry/provenance loader. Fixed, audited same-origin paths. */
(function(){'use strict';
const FIXED={atlas:'/atlas/assets/body-skeleton.json',provenance:'/atlas/assets/provenance.json',hip:'/hip/spatial/assets/provenance.json',nerve:'/hip/spatial/assets/sciatic-provenance.json'};
const cache=new Map(),pending=new Map(),hashes=new Map();
async function sha256(text){
 if(!globalThis.crypto?.subtle||typeof TextEncoder==='undefined')throw Error('Secure browser digest unavailable; refusing unverified geometry');
 const data=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function verifyAtlas(asset,proof){
 if(asset?.schema!=='body-live/atlas-skeleton-v1'||proof?.schema!=='body-live/atlas-provenance-v1')throw Error('Atlas source/provenance schema mismatch');
 if(proof.pinned_commit!==asset.source_commit||proof.part_count!==asset.parts.length||proof.source_frame?.scale!==asset.source_frame?.scale)throw Error('Atlas source-frame/provenance mismatch');
 if(proof.anatomist_reviewed!==false||proof.patient_specific!==false)throw Error('Atlas scientific disclosure mismatch');
 if(!/^[a-f0-9]{64}$/i.test(proof.lod_json_sha256)||hashes.get('atlas')!==proof.lod_json_sha256)throw Error('Atlas LOD SHA-256 mismatch; refusing to display sourced model');
 if(asset.parts.some(p=>proof.models?.[p.id]?.fma!==p.fma||proof.models?.[p.id]?.lod_triangles!==p.faces.length))throw Error('Atlas model ID/count provenance mismatch');
 return true;
}
async function load(key,{refresh=false}={}){
 if(!Object.hasOwn(FIXED,key))throw Error('Unknown asset type');
 if(!refresh&&cache.has(key))return cache.get(key);
 if(pending.has(key))return pending.get(key).promise;
 const controller=new AbortController();
 const promise=(async()=>{
  const response=await fetch(FIXED[key],{signal:controller.signal,cache:'force-cache'});
  if(!response.ok)throw Error('Asset '+key+': HTTP '+response.status);
  const body=await response.text();
  const json=JSON.parse(body);
  if(key==='atlas')hashes.set(key,await sha256(body));
  if(key==='atlas'){
   if(json.schema!=='body-live/atlas-skeleton-v1'||json.license!=='CC BY 4.0'||json.parts?.length<60)throw Error('Invalid Atlas source');
   for(const part of json.parts){
    if(!part.name||!part.fma||!Array.isArray(part.vertices)||!Array.isArray(part.faces))throw Error('Invalid skeletal component');
    if(part.vertices.length<35||part.faces.length<70)throw Error('Incomplete skeletal LOD');
    if(part.faces.some(f=>f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=part.vertices.length)))throw Error('Corrupt mesh topology');
   }
  }
  if(key==='provenance'&&(json.schema!=='body-live/atlas-provenance-v1'||json.anatomist_reviewed!==false||!json.source_files))throw Error('Atlas provenance mismatch');
  cache.set(key,json);return json;
 })();
 pending.set(key,{controller,promise});
 try{return await promise;}finally{pending.delete(key);}
}
function cancel(key){if(key)pending.get(key)?.controller.abort();else for(const x of pending.values())x.controller.abort();}
window.BodyAtlasLoader=Object.freeze({load,cancel,verifyAtlas,knownAssets:Object.keys(FIXED)});
})();