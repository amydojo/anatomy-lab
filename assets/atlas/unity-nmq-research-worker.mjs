// Research worker: independently opens pinned manifests and one immutable overview pack.
import './vendor/meshopt_decoder.js';
import {openNmoResearch,loadOverviewPack} from './unity-nmo-codec.mjs';
import {packCompact} from './unity-geometry.mjs';
let session=null,pack=null,opening=null,generation=0;
const respond=(id,data)=>self.postMessage({id,...data});
function close(){generation++;opening?.abort();opening=null;pack?.release();pack=null;session=null;}
self.onmessage=async({data})=>{
 const {id,type}=data;
 try{
  if(type==='close'){close();respond(id,{closed:true});return;}
  if(type==='open'){
   close();const g=generation,controller=new AbortController();opening=controller;
   const s=await openNmoResearch({...data.options,signal:controller.signal});if(g!==generation)return;
   if(!s.preflight.steadyFits||!s.preflight.payloadFits)throw Error('research resource gate failed');
   const p=await loadOverviewPack(data.options.root,s.manifest,{signal:controller.signal});if(g!==generation){p.release();return;}session=s;pack=p;opening=null;respond(id,{version:s.version,preflight:s.preflight,releaseEligible:false});return;
  }
  if(type==='decode'){
   if(!session||!pack)throw Error('research pack not open');const g=generation;
   const mesh=await pack.decode(data.structureId,self.MeshoptDecoder);if(g!==generation)return;
   const packed=packCompact(mesh),record=session.manifest.structures.find(s=>s.id===data.structureId);
   if(packed.bytes!==record.gpuBytes)throw Error('packed allocation mismatch');
   self.postMessage({id,packed},[packed.vertices.buffer,packed.indices.buffer]);return;
  }
  throw Error('unknown research worker command');
 }catch(e){respond(id,{error:String(e.message||e)});}
};
