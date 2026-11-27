import {decodeVelocityGLB,closeVelocity} from './glb-material.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
// The pinned runtime derivative only. No arbitrary GLB, native master edits or physics changes.
export const VECTOR_SHA='e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66';
const CACHE='mapo-vector-005-'+VECTOR_SHA,ASSET='/experiments/hairpin/vector/velocity/generated/VECTOR-005-VELOCITY-20000.glb';
export function createRideAsset(boardAPI){
 let parts=null,active=false,quality='full',error='',generation=0,pending=false,origin=null;const storage={available:typeof caches!=='undefined',read:'not-attempted',write:'not-attempted',bundled:'not-attempted',digest:'not-attempted',decode:'not-attempted'};
 const cacheKey=()=>new Request(new URL(ASSET,location.origin).href);
 const original=boardAPI.motion(),kinetic=createKinetic(boardAPI);
 return {
  async load(file,source='manual'){
   const token=++generation;pending=true;error='';
   let decoded=null;
   try{
    if(!file||file.size>4*1024*1024)throw Error('Select the qualified 20K VECTOR GLB');
    const buffer=await file.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
    storage.digest=hash===VECTOR_SHA?'verified':'mismatch';if(hash!==VECTOR_SHA)throw Error('Asset digest mismatch; original MARROW preserved');
    storage.decode='decoding';decoded=await decodeVelocityGLB(buffer);storage.decode='decoded';
    if(decoded.length!==5||decoded.reduce((n,p)=>n+p.indices.length/3,0)!==19986)throw Error('VECTOR assembly contract mismatch');
    if(token!==generation){closeVelocity(decoded);return false;}
    if(parts)closeVelocity(parts);parts=decoded;active=true;origin=source;
    if(source!=='cache'){storage.write='writing';try{const cache=await caches.open(CACHE);await cache.put(cacheKey(),new Response(buffer,{headers:{'Content-Type':'model/gltf-binary'}}));const check=await cache.match(cacheKey());if(!check|| (await check.arrayBuffer()).byteLength!==buffer.byteLength)throw Error('Cache read-after-write failed');storage.write='verified';}catch(e){storage.write='failed: '+e.message;}}
    return token===generation;
   }catch(e){if(storage.decode==='decoding')storage.decode='failed: '+e.message;if(decoded)closeVelocity(decoded);if(token===generation)error=e.message;return false;}
   finally{if(token===generation)pending=false;}
  },
  async autoLoad(){
   const token=generation;let cache;
   try{storage.read='reading';cache=await caches.open(CACHE);const hit=await cache.match(cacheKey());if(token!==generation)return false;storage.read=hit?'hit':'miss';if(hit){if(await this.load(await hit.blob(),'cache'))return true;storage.read='invalid cached asset';await cache.delete(cacheKey());}}catch(e){storage.read='failed: '+e.message;}
   if(token!==generation&&storage.read!=='invalid cached asset')return false;
   const fetchGeneration=generation;
   // Only the same-origin, fixed qualified path is allowed. Missing asset or
   // restricted storage leaves the original vehicle and manual import intact.
   try{storage.bundled='fetching';const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);let response;try{response=await fetch(ASSET,{signal:ctl.signal,credentials:'same-origin'});}finally{clearTimeout(timer);}storage.bundled='HTTP '+response.status;if(!response.ok||fetchGeneration!==generation)return false;const file=await response.blob();if(fetchGeneration!==generation)return false;return await this.load(file,'bundled');}catch(e){storage.bundled='failed: '+e.message;return false;}
  },
  get parts(){return parts;},get active(){return active;},get quality(){return quality;},
  toggle(){if(parts&&!pending){active=!active;}return active;},
  setQuality(q){quality=q==='performance'?'performance':'full';},
  fail(msg){active=false;error=String(msg);},
  reset(){original.reset();kinetic.reset();},
  update(state,base,dt){const a=original.update(state,base,dt),v=kinetic.update(state,base,dt,{hover:.00035});return active?{...v,vehicle:{...v.vehicle,vector:true,quality}}:a;},
  report(){return {active,pending,loaded:!!parts,quality,error,origin,storage:{...storage},sha256:parts?VECTOR_SHA:null};},
  dispose(){generation++;pending=false;active=false;if(parts)closeVelocity(parts);parts=null;origin=null;}
 };
}
