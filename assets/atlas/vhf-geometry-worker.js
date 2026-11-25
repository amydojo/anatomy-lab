/* RESIDENCY: exact-source decoding and conservative display-only LOD candidates. */
importScripts('/assets/atlas/vhf-source.js');
self.onmessage=event=>{
 const {id,buffer,structure,lod=false}=event.data;
 try{
  const start=performance.now();
  const part=self.BodyVHF.parse(buffer,{structures:[{...structure,tissue:'Bone'}]},true,true)[0];
  const decoded=performance.now();
  const transfers=[part.positions.buffer,part.indices.buffer];
  if(lod){part.lods=self.BodyVHF.buildLods(part);for(const p of part.lods)transfers.push(p.positions.buffer,p.indices.buffer);}
  const initial=part.lods?.find(p=>p.lodLevel==='overview')||part.lods?.find(p=>p.lodLevel==='regional')||part;
  initial.packed=self.BodyVHF.packVertices(initial.positions,initial.indices);transfers.push(initial.packed.buffer);
  const packed=performance.now();
  self.postMessage({id,part,decodeMs:decoded-start,packMs:packed-decoded},transfers);
 }catch(error){self.postMessage({id,error:String(error.message||error)});}
};
