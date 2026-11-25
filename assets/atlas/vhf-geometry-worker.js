/* VELOCITY: exact-source preprocessing, no geometry simplification. */
importScripts('/assets/atlas/vhf-source.js');
self.onmessage=event=>{
 const {id,buffer,structure}=event.data;
 try{
  const start=performance.now();
  const part=self.BodyVHF.parse(buffer,{structures:[{...structure,tissue:'Bone'}]},true,true)[0];
  const decoded=performance.now();
  part.packed=self.BodyVHF.packVertices(part.positions,part.indices);
  const packed=performance.now();
  self.postMessage({id,part,decodeMs:decoded-start,packMs:packed-decoded},[part.positions.buffer,part.indices.buffer,part.packed.buffer]);
 }catch(error){self.postMessage({id,error:String(error.message||error)});}
};
