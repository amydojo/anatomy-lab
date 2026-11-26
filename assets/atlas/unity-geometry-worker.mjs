import {loadDisplay,packCompact} from './unity-geometry.mjs';
const jobs=new Map();
self.onmessage=async({data})=>{
 if(data.cancel){jobs.get(data.id)?.abort();return;}
 const {id,record,root}=data,controller=new AbortController();jobs.set(id,controller);
 try{
  const packed=packCompact(await loadDisplay(root,record,{signal:controller.signal}));
  if(!controller.signal.aborted)self.postMessage({id,packed},[packed.vertices.buffer,packed.indices.buffer]);
 }catch(e){self.postMessage({id,error:String(e.message||e)});}
 finally{jobs.delete(id);}
};
