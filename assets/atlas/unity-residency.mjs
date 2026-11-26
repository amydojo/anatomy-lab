// NANITE WebGL adapter. Host owns camera, shader, context recovery and draw loop.
import {Residency,packCompact,chooseLevel,loadDisplay,verifiedBytes,validateManifest} from './unity-geometry.mjs';
function require(x,m){if(!x)throw Error(m);}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
export function disposeGeometry(gl,h){if(!h)return;gl.deleteBuffer(h.vertex);gl.deleteBuffer(h.index);}
export async function uploadGeometry(gl,packed,{signal,yieldFrame=frame,chunkBytes=256*1024}={}){
 const vertex=gl.createBuffer(),index=gl.createBuffer(),h={vertex,index,count:packed.indices.length,indexType:packed.indices.BYTES_PER_ELEMENT===2?gl.UNSIGNED_SHORT:gl.UNSIGNED_INT,bytes:0};
 function check(){require(!signal?.aborted&&!gl.isContextLost(),'upload interrupted');require(gl.getError()===gl.NO_ERROR,'WebGL allocation/upload error');}
 try{
  require(vertex&&index,'buffer creation failed');require(Number.isInteger(chunkBytes)&&chunkBytes>0,'invalid chunk size');
  for(const [target,handle,data] of [[gl.ARRAY_BUFFER,vertex,packed.vertices],[gl.ELEMENT_ARRAY_BUFFER,index,new Uint8Array(packed.indices.buffer,packed.indices.byteOffset,packed.indices.byteLength)]]){
   check();gl.bindBuffer(target,handle);gl.bufferData(target,data.byteLength,gl.STATIC_DRAW);check();
   const actual=gl.getBufferParameter(target,gl.BUFFER_SIZE);require(actual===data.byteLength,'GPU buffer size mismatch');h.bytes+=actual;
   for(let offset=0;offset<data.byteLength;offset+=chunkBytes){if(offset>0)await yieldFrame();check();gl.bindBuffer(target,handle);gl.bufferSubData(target,offset,data.subarray(offset,offset+chunkBytes));check();}
  }
  require(h.bytes===packed.bytes,'GPU total mismatch');return h;
 }catch(e){disposeGeometry(gl,h);throw e;}
}
export function bindGeometry(gl,h,{position,normal,weight}){
 gl.bindBuffer(gl.ARRAY_BUFFER,h.vertex);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,16,0);
 gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.BYTE,true,16,12);
 if(weight>=0){gl.disableVertexAttribArray(weight);gl.vertexAttrib1f(weight,0);}
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,h.index);
}
// One upload at a time. No exact-source request is required to obtain display LOD.
// Host supplies a worker-backed prepare() to keep CPU processing off input thread.
export class UnityGeometrySession{
 constructor({gl,manifest,source,root,exactRoot,prepare,budget}){
  this.gl=gl;this.manifest=validateManifest(manifest,source);this.source=source;this.root=root;this.exactRoot=exactRoot;this.prepare=prepare;this.ledger=new Residency(budget);this.active=null;this.closed=false;this.failures=new Map();
 }
 requests(camera,selected,visible=()=>true){
  return this.ledger.queue(this.manifest.structures.filter(e=>visible(e)||e.id===selected).map(e=>{
   // Load complete overview coverage before requesting improvements.
   const current=this.ledger.resident.get(e.id)?.level;
   const selectedLevel=current?chooseLevel(e,camera,current,e.id===selected):e.levels.find(l=>l.level===e.overviewLevel);
   const r=selectedLevel.level==='exact'?e.levels.find(l=>l.level==='exact-display'):selectedLevel;
   return {id:e.id,entry:e,...r};
  }).filter(r=>r.level!=='exact'&&!this.failures.has(r.id+':'+r.level)),selected);
 }
 async step(camera,selected,visible=()=>true){
  if(this.closed||this.active)return false;
  const protectedIds=new Set(this.manifest.structures.filter(visible).map(e=>e.id));
  if(selected)protectedIds.add(selected);
  const dispose=h=>disposeGeometry(this.gl,h);
  for(const r of this.requests(camera,selected,visible)){
   const token=this.ledger.reserve(r.id,r.level,r.gpuBytes,performance.now(),protectedIds,dispose);if(!token)continue;
   const abort=new AbortController();this.active=abort;let h;
   try{
    const packed=await this.prepare(r,this.root,abort.signal);
    require(packed.bytes===r.gpuBytes,'prepared bytes mismatch');
    h=await uploadGeometry(this.gl,packed,{signal:abort.signal});
    require(!this.closed&&!abort.signal.aborted,'session closed');
    this.ledger.commit(token,h,h.bytes,performance.now(),dispose);return true;
   }catch(e){if(h)dispose(h);this.ledger.cancel(token);if(!abort.signal.aborted)this.failures.set(r.id+':'+r.level,String(e.message||e));return false;}
   finally{this.active=null;}
  }
  return false;
 }
 // Exact original GLB is verified separately; host parser/picking retains source identity.
 async exact(id,signal){const e=this.manifest.structures.find(s=>s.id===id);require(e,'unknown source ID');return verifiedBytes(new URL(e.exact.file,this.exactRoot),e.exact,{signal});}
 retry(){this.failures.clear();}
 dispose(){this.closed=true;this.active?.abort();for(const r of this.ledger.resident.values())disposeGeometry(this.gl,r.handle);this.ledger.resident.clear();}
}
// Explicit fallback for testing only; production should provide a worker-backed prepare.
export async function prepareOnMainThread(record,root,signal){return packCompact(await loadDisplay(root,record,{signal}));}
