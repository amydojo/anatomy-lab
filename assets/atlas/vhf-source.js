/* Exact pinned VHF source; display transform provisional, no atlas registration. */
globalThis.BodyVHF=(function sourceModule(){
 const base='/assets/atlas/vhf/';
 const hash='2aac40404f4aee5867d0f4feb13cf6aab5db2bc2360f0585356738113c35fb7c';
 const names=['Femur','Tibia','Fibula','Patella','Distal femoral cartilage','Patellar cartilage','Lateral tibial cartilage','Medial tibial cartilage','Anterior cruciate ligament','Posterior cruciate ligament','Medial collateral ligament','Lateral collateral ligament','Vastus lateralis','Vastus medialis','Vastus intermedius','Biceps femoris short head','Popliteus'];
 const colors={Bone:[.85,.78,.66],Cartilage:[.57,.68,.68],Ligament:[.82,.75,.60],Muscle:[.70,.35,.32]};
 const transform=p=>[p[0]*.005,(p[2]+10)*.005,-p[1]*.005];
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 function parse(buffer,manifest){
  const dv=new DataView(buffer);
  if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid GLB header');
  const n=dv.getUint32(12,true),offset=20+n;
  if(offset+8>buffer.byteLength||dv.getUint32(16,true)!==0x4e4f534a||dv.getUint32(offset+4,true)!==0x004e4942||offset+8+dv.getUint32(offset,true)!==buffer.byteLength)throw Error('Invalid GLB chunks');
  const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n))),start=offset+8;
  if(doc.meshes.length!==17||manifest.structures.length!==17)throw Error('Unexpected source inventory');
  function accessor(index,type,component,lanes){
   const ac=doc.accessors[index],bv=doc.bufferViews[ac.bufferView],bytes=4,begin=start+(bv.byteOffset||0)+(ac.byteOffset||0),len=ac.count*lanes;
   if(ac.type!==type||ac.componentType!==component||ac.sparse||bv.buffer!==0||bv.byteStride||begin<start||begin+len*bytes>start+(bv.byteOffset||0)+bv.byteLength||begin+len*bytes>buffer.byteLength||begin%4)throw Error('Unsupported GLB accessor');
   return component===5126?new Float32Array(buffer,begin,len):new Uint32Array(buffer,begin,len);
  }
  return doc.meshes.map((m,j)=>{
   const s=manifest.structures[j],p=m.primitives[0];
   if(m.name!==s.id||m.primitives.length!==1||p.mode!==4||!colors[s.tissue])throw Error('Source identity mismatch');
   const pos=accessor(p.attributes.POSITION,'VEC3',5126,3),idx=accessor(p.indices,'SCALAR',5125,1);
   if(pos.length!==s.vertices*3||idx.length!==s.triangles*3)throw Error('Source count mismatch');
   const vertices=[],faces=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<pos.length;i+=3){const v=transform(pos.subarray(i,i+3));if(v.some(x=>!Number.isFinite(x)))throw Error('Invalid source coordinate');vertices.push(v);for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}
   for(let i=0;i<idx.length;i+=3){const f=[idx[i],idx[i+1],idx[i+2]];if(f.some(x=>x>=vertices.length))throw Error('Source index out of bounds');faces.push(f);}
   return {id:s.id,name:names[j],category:s.tissue,color:colors[s.tissue],vertices,faces,min,max};
  });
 }
 async function load(){
  const [mr,gr]=await Promise.all([fetch(base+'manifest.json'),fetch(base+'vhf-right-knee-source.glb')]);
  if(!mr.ok||!gr.ok)throw Error('Source asset unavailable');
  const [manifest,buffer]=await Promise.all([mr.json(),gr.arrayBuffer()]);
  if(buffer.byteLength!==6929868||manifest.glb.sha256!==hash)throw Error('Source asset size or manifest mismatch');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==hash)throw Error('Source SHA-256 mismatch');
  await nextFrame();return parse(buffer,manifest);
 }
 function bounds(parts){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of parts)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p.min[k]);max[k]=Math.max(max[k],p.max[k]);}return {min,max,radius:Math.hypot(...max.map((x,i)=>x-min[i]))/2,center:{x:0,y:0,z:0}};}
 function visible(part,view){return (!view.isolated||part.id===view.isolated)&&(view.category==='All'||view.category===part.category);}
 function ray(c,x,y){
  const scale=Math.min(c.width/3.25,c.height/c.frameSpan)*c.zoom;
  const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  const inverse=(a,b,d)=>{const z=d*cp-b*sp;return [a*cy-z*sy,b*cp+d*sp,a*sy+z*cy];};
  const o=inverse(0,.04,7.4),d=inverse((x-c.width*c.anchorX)/scale,-(y-c.height*c.anchorY)/scale,-7.4);
  return {o:[o[0]+c.target.x,o[1]+c.target.y,o[2]+c.target.z],d};
 }
 function boxHit(o,d,min,max){let lo=0,hi=Infinity;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-12){if(o[k]<min[k]||o[k]>max[k])return false;continue;}let a=(min[k]-o[k])/d[k],b=(max[k]-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return false;}return true;}
 function pick(parts,view,c,x,y){
  const {o,d}=ray(c,x,y);let best=Infinity,hit=null;
  for(const p of parts){
   if(!visible(p,view)||!boxHit(o,d,p.min,p.max))continue;
   for(const f of p.faces){
    const a=p.vertices[f[0]],b=p.vertices[f[1]],z=p.vertices[f[2]];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=z[0]-a[0],vy=z[1]-a[1],vz=z[2]-a[2];
    const hx=d[1]*vz-d[2]*vy,hy=d[2]*vx-d[0]*vz,hz=d[0]*vy-d[1]*vx,det=ux*hx+uy*hy+uz*hz;
    if(Math.abs(det)<1e-12)continue;
    const sx=o[0]-a[0],sy=o[1]-a[1],sz=o[2]-a[2],u=(sx*hx+sy*hy+sz*hz)/det;if(u<0||u>1)continue;
    const qx=sy*uz-sz*uy,qy=sz*ux-sx*uz,qz=sx*uy-sy*ux,v=(d[0]*qx+d[1]*qy+d[2]*qz)/det;if(v<0||u+v>1)continue;
    const t=(vx*qx+vy*qy+vz*qz)/det;if(t>0&&t<best){best=t;hit=p.id;}
   }
  }
  return hit;
 }
 return Object.freeze({load,parse,transform,bounds,visible,pick,hash});
})();
