import {decodeVelocityGLB,closeVelocity} from './glb-material.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
// The pinned runtime derivative only. No arbitrary GLB, native master edits or physics changes.
export const VECTOR_SHA='e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66';
export function createRideAsset(boardAPI){
 let parts=null,active=false,quality='full',error='',generation=0,pending=false;
 const original=boardAPI.motion(),kinetic=createKinetic(boardAPI);
 return {
  async load(file){
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
    if(parts)closeVelocity(parts);parts=decoded;active=true;return true;
   }catch(e){if(decoded)closeVelocity(decoded);if(token===generation)error=e.message;return false;}
   finally{if(token===generation)pending=false;}
  },
  get parts(){return parts;},get active(){return active;},get quality(){return quality;},
  toggle(){if(parts&&!pending){active=!active;}return active;},
  setQuality(q){quality=q==='performance'?'performance':'full';},
  fail(msg){active=false;error=String(msg);},
  reset(){original.reset();kinetic.reset();},
  update(state,base,dt){const a=original.update(state,base,dt),v=kinetic.update(state,base,dt);return active?{...v,vehicle:{...v.vehicle,vector:true,quality}}:a;},
  report(){return {active,pending,loaded:!!parts,quality,error,sha256:parts?VECTOR_SHA:null};},
  dispose(){generation++;pending=false;active=false;if(parts)closeVelocity(parts);parts=null;}
 };
}
