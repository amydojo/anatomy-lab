import {decodeVelocityGLB,closeVelocity} from './glb-material.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
// The pinned runtime derivative only. No arbitrary GLB, native master edits or physics changes.
export const VECTOR_SHA='e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66';
const CACHE='mapo-vector-005-'+VECTOR_SHA,ASSET='/experiments/hairpin/vector/velocity/generated/VECTOR-005-VELOCITY-20000.glb';
export function createRideAsset(boardAPI){
 let parts=null,active=false,quality='full',error='',generation=0,pending=false,origin=null;
 const original=boardAPI.motion(),kinetic=createKinetic(boardAPI);
 return {
  async load(file,source='manual'){
   const token=++generation;pending=true;error='';
   let decoded=null;
   try{
    if(!file||file.size>4*1024*1024)throw Error('Select the qualified 20K VECTOR GLB');
    const buffer=await file.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==VECTOR_SHA)throw Error('Asset digest mismatch; original MARROW preserved');
    decoded=await decodeVelocityGLB(buffer);
    if(decoded.length!==5||decoded.reduce((n,p)=>n+p.indices.length/3,0)!==19986)throw Error('VECTOR assembly contract mismatch');
    if(token!==generation){closeVelocity(decoded);return false;}
    if(parts)closeVelocity(parts);parts=decoded;active=true;origin=source;
    if(source!=='cache'){try{const cache=await caches.open(CACHE);await cache.put(ASSET,new Response(buffer,{headers:{'Content-Type':'model/gltf-binary'}}));}catch{}}
    return token===generation;
   }catch(e){if(decoded)closeVelocity(decoded);if(token===generation)error=e.message;return false;}
   finally{if(token===generation)pending=false;}
  },
  async autoLoad(){
   const token=generation;let cache;
   try{cache=await caches.open(CACHE);const hit=await cache.match(ASSET);if(token!==generation)return false;if(hit){if(await this.load(await hit.blob(),'cache'))return true;await cache.delete(ASSET);return false;}}catch{}
   if(token!==generation)return false;
   // Only the same-origin, fixed qualified path is allowed. Missing asset or
   // restricted storage leaves the original vehicle and manual import intact.
   try{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3500);let response;try{response=await fetch(ASSET,{signal:ctl.signal,credentials:'same-origin'});}finally{clearTimeout(timer);}if(!response.ok||token!==generation)return false;const file=await response.blob();if(token!==generation)return false;return await this.load(file,'bundled');}catch{return false;}
  },
  get parts(){return parts;},get active(){return active;},get quality(){return quality;},
  toggle(){if(parts&&!pending){active=!active;}return active;},
  setQuality(q){quality=q==='performance'?'performance':'full';},
  fail(msg){active=false;error=String(msg);},
  reset(){original.reset();kinetic.reset();},
  update(state,base,dt){const a=original.update(state,base,dt),v=kinetic.update(state,base,dt);return active?{...v,vehicle:{...v.vehicle,vector:true,quality}}:a;},
  report(){return {active,pending,loaded:!!parts,quality,error,origin,sha256:parts?VECTOR_SHA:null};},
  dispose(){generation++;pending=false;active=false;if(parts)closeVelocity(parts);parts=null;origin=null;}
 };
}
