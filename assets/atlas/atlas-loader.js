/* V6 abortable lazy geometry/provenance loader. Fixed, audited same-origin paths. */
(function(){'use strict';
const FIXED={atlas:'/atlas/assets/body-skeleton.json',provenance:'/atlas/assets/provenance.json',hip:'/hip/spatial/assets/provenance.json',nerve:'/hip/spatial/assets/sciatic-provenance.json',hipGeometry:'/hip/spatial/assets/hip-source.json',kneeGeometry:'/knee/spatial/assets/bp3d-right-knee-4.0.json',shoulderGeometry:'/shoulder/spatial/assets/shoulder-source.json',shoulderProof:'/shoulder/spatial/assets/provenance.json',extendedProof:'/atlas/regions/provenance.json',skullRegion:'/atlas/regions/skull.json',neckRegion:'/atlas/regions/neck.json',thoraxRegion:'/atlas/regions/thorax.json',elbowRegion:'/atlas/regions/elbow.json',wristRegion:'/atlas/regions/wrist.json',ankleRegion:'/atlas/regions/ankle.json',kneeMuscles:'/knee/spatial/assets/knee-muscles-source.json',kneeMuscleProof:'/knee/spatial/assets/knee-muscles-provenance.json'};
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
  if(key==='atlas'||key==='shoulderGeometry'||key==='kneeMuscles'||key.endsWith('Region'))hashes.set(key,await sha256(body));
  if(key==='atlas'){
   if(json.schema!=='body-live/atlas-skeleton-v1'||json.license!=='CC BY 4.0'||json.parts?.length<60)throw Error('Invalid Atlas source');
   for(const part of json.parts){
    if(!part.name||!part.fma||!Array.isArray(part.vertices)||!Array.isArray(part.faces))throw Error('Invalid skeletal component');
    if(part.vertices.length<35||part.faces.length<70)throw Error('Incomplete skeletal LOD');
    if(part.faces.some(f=>f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=part.vertices.length)))throw Error('Corrupt mesh topology');
   }
  }
  if(key==='provenance'&&(json.schema!=='body-live/atlas-provenance-v1'||json.anatomist_reviewed!==false||!json.source_files))throw Error('Atlas provenance mismatch');
  if(key==='hipGeometry'||key==='kneeGeometry'){
    const hip=key==='hipGeometry';
    if(json.schema!==(hip?'body-live/hip-sourced-v1':'body-live/sourced-knee-geometry-v1')||json.license!=='CC BY 4.0')throw Error('Region sourced geometry schema/license mismatch');
    const pinned='1c38bf35c254a891200d3cedecfd57abebe83d8d';
    if((hip?json.source_commit:json.upstream_commit)!==pinned)throw Error('Region mesh is not from pinned BodyParts3D reference');
    const parts=hip?json.parts:json.bone_meshes;
    const required=hip?['hipBone','femur','sacrum','maximus','medius','minimus','piriformis','obturator','gemellusSuperior','gemellusInferior','quadratus']:['femur','tibia','fibula','patella'];
    if(!parts||required.some(k=>!parts[k]?.vertices?.length||!parts[k]?.faces?.length))throw Error('Incomplete licensed source geometry');
  }
  if(key==='kneeMuscles'){
    if(json.schema!=='body-live/knee-muscles-v1'||json.license!=='CC BY 4.0'||json.source_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d')throw Error('Invalid pinned knee muscle source');
    if(json.source_frame?.scale!==7.5||JSON.stringify(json.source_frame?.origin_metres)!=='[-0.09092915,0.4491462,-0.01654605]')throw Error('Knee muscle frame mismatch');
    const required=['popliteus','vastusMedialis','vastusLateralis','vastusIntermedius','bicepsShort'];
    for(const id of required){
      const p=json.parts?.[id];if(!p||p.system!=='muscle'||p.vertices?.length<35||p.faces?.length<60)throw Error('Missing sourced knee muscle: '+id);
      if(p.faces.some(face=>face.length!==3||face.some(v=>!Number.isInteger(v)||v<0||v>=p.vertices.length)))throw Error('Knee muscle topology error: '+id);
    }
  }
  if(key==='kneeMuscleProof'&&(json.schema!=='body-live/knee-muscles-provenance-v1'||json.pinned_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d'||json.anatomist_reviewed!==false))throw Error('Knee muscle provenance mismatch');
  if(key.endsWith('Region')){
    const region=key.slice(0,-6);
    if(!['skull','neck','thorax','elbow','wrist','ankle'].includes(region)||json.schema!=='body-live/extended-region-v1'||json.region!==region||json.license!=='CC BY 4.0'||json.source_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d')throw Error('Invalid extended anatomy identity: '+region);
    if(JSON.stringify(json.source_frame?.origin_metres)!=='[0,0.9,0]'||json.source_frame?.scale!==5)throw Error('Whole-body geometry reference mismatch');
    if(!json.parts||Object.keys(json.parts).length<3)throw Error('Empty sourced region: '+region);
    for(const [id,part] of Object.entries(json.parts)){
      if(!part.name||!part.fma||part.system!=='bone'||part.vertices?.length<35||part.faces?.length<50)throw Error('Incomplete source part '+id);
      if(part.vertices.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v)))||part.faces.some(face=>face.length!==3||face.some(v=>!Number.isInteger(v)||v<0||v>=part.vertices.length)))throw Error('Invalid sourced anatomy mesh '+id);
    }
  }
  if(key==='extendedProof'&&(json.schema!=='body-live/extended-regions-provenance-v1'||json.anatomist_reviewed!==false||json.kinematics_validated!==false||json.pinned_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d'))throw Error('Whole-body anatomical source proof mismatch');
  if(key==='shoulderGeometry'){
    if(json.schema!=='body-live/shoulder-sourced-v1'||json.license!=='CC BY 4.0'||json.source_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d')throw Error('Shoulder source identity mismatch');
    if(json.source_frame?.scale!==5||JSON.stringify(json.source_frame?.origin_metres)!=='[0,0.9,0]')throw Error('Shoulder source coordinate frame does not match skeleton');
    for(const id of ['scapula','humerus','clavicle','supraspinatus','infraspinatus','subscapularis','teresMinor']){
      const part=json.parts?.[id];
      if(!part||!Array.isArray(part.vertices)||part.vertices.length<35||!Array.isArray(part.faces)||part.faces.length<60)throw Error('Missing or incomplete real right-shoulder model '+id);
      if(part.faces.some(face=>face.length!==3||face.some(v=>!Number.isInteger(v)||v<0||v>=part.vertices.length)))throw Error('Corrupt shoulder topology '+id);
    }
  }
  if(key==='shoulderProof'&&(json.schema!=='body-live/shoulder-provenance-v1'||json.anatomist_reviewed!==false||json.pinned_commit!=='1c38bf35c254a891200d3cedecfd57abebe83d8d'))throw Error('Shoulder source provenance mismatch');
  cache.set(key,json);return json;
 })();
 pending.set(key,{controller,promise});
 try{return await promise;}finally{pending.delete(key);}
}
function cancel(key){if(key)pending.get(key)?.controller.abort();else for(const x of pending.values())x.controller.abort();}
function verifyShoulder(asset,proof){
 if(asset?.schema!=='body-live/shoulder-sourced-v1'||proof?.schema!=='body-live/shoulder-provenance-v1')throw Error('Shoulder source/provenance mismatch');
 if(asset.source_commit!==proof.pinned_commit||proof.anatomist_reviewed!==false||proof.kinematics_validated!==false)throw Error('Shoulder source truth flags mismatch');
 if(!/^[a-f0-9]{64}$/i.test(proof.asset_sha256)||hashes.get('shoulderGeometry')!==proof.asset_sha256)throw Error('Shoulder model SHA-256 mismatch');
 for(const [id,part] of Object.entries(asset.parts)){
  const item=proof.models?.[id];
  if(!item||item.fma!==part.fma||item.triangles!==part.faces.length)throw Error('Shoulder structure source audit failed: '+id);
 }
 return true;
}
function verifyKneeMuscles(asset,proof){
 if(asset?.schema!=='body-live/knee-muscles-v1'||proof?.schema!=='body-live/knee-muscles-provenance-v1')throw Error('Knee muscle source/provenance mismatch');
 if(asset.source_commit!==proof.pinned_commit||proof.anatomist_reviewed!==false||proof.kinematics_validated!==false)throw Error('Knee muscle source truth flags mismatch');
 if(!/^[a-f0-9]{64}$/i.test(proof.asset_sha256)||hashes.get('kneeMuscles')!==proof.asset_sha256)throw Error('Knee muscle SHA-256 mismatch');
 for(const [id,p] of Object.entries(asset.parts)){
  if(proof.models?.[id]?.fma!==p.fma||proof.models?.[id]?.triangles!==p.faces.length)throw Error('Knee source structure mismatch: '+id);
 }
 return true;
}
function verifyExtended(region,asset,proof){
 if(!['skull','neck','thorax','elbow','wrist','ankle'].includes(region)||asset?.region!==region||asset?.schema!=='body-live/extended-region-v1'||proof?.schema!=='body-live/extended-regions-provenance-v1')throw Error('Extended source identity mismatch');
 if(asset.source_commit!==proof.pinned_commit||proof.anatomist_reviewed!==false||proof.kinematics_validated!==false)throw Error('Extended source truth flags mismatch');
 const record=proof.regions?.[region],sha=hashes.get(region+'Region');
 if(!record||!/^[a-f0-9]{64}$/i.test(record.asset_sha256)||sha!==record.asset_sha256)throw Error('Whole-body region SHA-256 mismatch '+region);
 if(Object.keys(asset.parts).length!==record.source_parts)throw Error('Whole-body structure count mismatch '+region);
 for(const [id,part] of Object.entries(asset.parts)){
  const partProof=record.structures?.[id];
  if(!partProof||partProof.fma!==part.fma||partProof.triangles!==part.faces.length||partProof.vertices!==part.vertices.length)throw Error('Whole-body bone topology or identity mismatch '+region+'/'+id);
 }
 return true;
}
window.BodyAtlasLoader=Object.freeze({load,cancel,verifyAtlas,verifyShoulder,verifyKneeMuscles,verifyExtended,knownAssets:Object.keys(FIXED)});
})();