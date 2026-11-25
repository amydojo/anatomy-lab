/* Exact pinned VHF source; display transform provisional, no atlas registration. */
globalThis.BodyVHF=(function sourceModule(){
 const base='/assets/atlas/vhf/';
 const hash='2aac40404f4aee5867d0f4feb13cf6aab5db2bc2360f0585356738113c35fb7c',worldHash='b4403e606faac7fca9525692f51a4d83db8d6a44622ab78a3b2bd07bf3e545c0';
 const names=['Femur','Tibia','Fibula','Patella','Distal femoral cartilage','Patellar cartilage','Lateral tibial cartilage','Medial tibial cartilage','Anterior cruciate ligament','Posterior cruciate ligament','Medial collateral ligament','Lateral collateral ligament','Vastus lateralis','Vastus medialis','Vastus intermedius','Biceps femoris short head','Popliteus'];
 const colors={Bone:[.85,.78,.66],Cartilage:[.57,.68,.68],Ligament:[.82,.75,.60],Muscle:[.70,.35,.32]};
 const transform=p=>[p[0]*.005,(p[2]+10)*.005,-p[1]*.005];
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 function compact(pos,idx,axis=false){
 const positions=new Float32Array(pos.length),indices=pos.length/3<=65536?new Uint16Array(idx.length):new Uint32Array(idx.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pos.length;i+=3){positions[i]=axis?(240-pos[i])*.005:pos[i]*.005;positions[i+1]=axis?(pos[i+2]-1000)*.005:(pos[i+2]+10)*.005;positions[i+2]=axis?(pos[i+1]-235)*.005:-pos[i+1]*.005;for(let k=0;k<3;k++){const v=positions[i+k];if(!Number.isFinite(v))throw Error('Invalid source coordinate');min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}}
 for(let i=0;i<idx.length;i++){const v=idx[i];if(!Number.isInteger(v)||v<0||v>=pos.length/3)throw Error('Source index out of bounds');indices[i]=v;}
 return {positions,indices,min,max};
}
 function inView(p,c){
 if(!p.min||!p.max||!c.width||!c.height||!c.frameSpan)return true;
 const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),scale=Math.min(c.width/3.25,c.height/c.frameSpan)*c.zoom;
 const ax=Number.isFinite(c.anchorX)?c.anchorX:.5,ay=Number.isFinite(c.anchorY)?c.anchorY:.5;
 let outside=63;
 for(let i=0;i<8;i++){
  const x0=(i&1?p.max[0]:p.min[0])-c.target.x,y0=(i&2?p.max[1]:p.min[1])-c.target.y,z0=(i&4?p.max[2]:p.min[2])-c.target.z;
  const x=x0*cy+z0*sy,z=z0*cy-x0*sy,y=y0*cp-z*sp,z2=y0*sp+z*cp,w=(7.4-z2)/7.4;
  if(!Number.isFinite(w)||w<=.10)return true; // perspective clamp: conservatively retain
  const X=x*scale/(c.width*.5)+(ax-.5)*2*w,Y=(y-.04)*scale/(c.height*.5)-(ay-.5)*2*w,Z=-z2/15;
  const margin=.005*Math.max(1,w);
  let mask=0;if(X < -w-margin)mask|=1;if(X>w+margin)mask|=2;if(Y< -w-margin)mask|=4;if(Y>w+margin)mask|=8;if(Z< -w-margin)mask|=16;if(Z>w+margin)mask|=32;
  outside&=mask;if(!outside)return true;
 }
 return outside===0;
}
 function packVertices(positions,indices){
 const n=positions.length/3,flat=new Float32Array(n*7);
 for(let i=0;i<n;i++){flat[i*7]=positions[i*3];flat[i*7+1]=positions[i*3+1];flat[i*7+2]=positions[i*3+2];}
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  for(let j=0;j<3;j++){const k=indices[i+j]*7+3;flat[k]+=nx;flat[k+1]+=ny;flat[k+2]+=nz;}
 }
 for(let i=0;i<n;i++){const k=i*7+3,len=Math.hypot(flat[k],flat[k+1],flat[k+2])||1;flat[k]/=len;flat[k+1]/=len;flat[k+2]/=len;}
 return flat;
}
 function intersect(parts,view,c,x,y,ray,boxHit,visible){
 const {o,d}=ray(c,x,y);let best=Infinity,id=null;
 for(const p of parts){
  if((view.renderedIds&&!view.renderedIds.has(p.id))||!visible(p,view)||!boxHit(o,d,p.min,p.max))continue;
  const positions=p.positions,indices=p.indices,len=indices?indices.length/3:p.faces.length;
  for(let i=0;i<len;i++){
   const ia=indices?indices[i*3]:p.faces[i][0],ib=indices?indices[i*3+1]:p.faces[i][1],ic=indices?indices[i*3+2]:p.faces[i][2];
   const ax=positions?positions[ia*3]:p.vertices[ia][0],ay=positions?positions[ia*3+1]:p.vertices[ia][1],az=positions?positions[ia*3+2]:p.vertices[ia][2];
   const ux=(positions?positions[ib*3]:p.vertices[ib][0])-ax,uy=(positions?positions[ib*3+1]:p.vertices[ib][1])-ay,uz=(positions?positions[ib*3+2]:p.vertices[ib][2])-az;
   const vx=(positions?positions[ic*3]:p.vertices[ic][0])-ax,vy=(positions?positions[ic*3+1]:p.vertices[ic][1])-ay,vz=(positions?positions[ic*3+2]:p.vertices[ic][2])-az;
   const hx=d[1]*vz-d[2]*vy,hy=d[2]*vx-d[0]*vz,hz=d[0]*vy-d[1]*vx,det=ux*hx+uy*hy+uz*hz;
   if(Math.abs(det)<1e-12)continue;
   const sx=o[0]-ax,sy=o[1]-ay,sz=o[2]-az,u=(sx*hx+sy*hy+sz*hz)/det;if(u<0||u>1)continue;
   const qx=sy*uz-sz*uy,qy=sz*ux-sx*uz,qz=sx*uy-sy*ux,v=(d[0]*qx+d[1]*qy+d[2]*qz)/det;if(v<0||u+v>1)continue;
   const t=(vx*qx+vy*qy+vz*qz)/det;if(t>0&&t<best){best=t;id=p.id;}
  }
 }
 return id?{id,point:{x:o[0]+d[0]*best,y:o[1]+d[1]*best,z:o[2]+d[2]*best}}:null;
}
 function parse(buffer,manifest,world=false,axis=false){
  const dv=new DataView(buffer);
  if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid GLB header');
  const n=dv.getUint32(12,true),offset=20+n;
  if(offset+8>buffer.byteLength||dv.getUint32(16,true)!==0x4e4f534a||dv.getUint32(offset+4,true)!==0x004e4942||offset+8+dv.getUint32(offset,true)!==buffer.byteLength)throw Error('Invalid GLB chunks');
  const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n))),start=offset+8;
  if(doc.meshes.length!==manifest.structures.length||(!world&&doc.meshes.length!==17))throw Error('Unexpected source inventory');
  function accessor(index,type,component,lanes){
   const ac=doc.accessors[index],bv=doc.bufferViews[ac.bufferView],bytes=4,begin=start+(bv.byteOffset||0)+(ac.byteOffset||0),len=ac.count*lanes;
   if(ac.type!==type||ac.componentType!==component||ac.sparse||bv.buffer!==0||bv.byteStride||begin<start||begin+len*bytes>start+(bv.byteOffset||0)+bv.byteLength||begin+len*bytes>buffer.byteLength||begin%4)throw Error('Unsupported GLB accessor');
   return component===5126?new Float32Array(buffer,begin,len):new Uint32Array(buffer,begin,len);
  }
  return doc.meshes.map((m,j)=>{
   const s=world?manifest.structures.find(s=>s.id===m.name):manifest.structures[j],p=m.primitives[0];
   if(m.name!==s.id||m.primitives.length!==1||p.mode!==4||!colors[s.tissue])throw Error('Source identity mismatch');
   const pos=accessor(p.attributes.POSITION,'VEC3',5126,3),idx=accessor(p.indices,'SCALAR',5125,1);
   if(pos.length!==s.vertices*3||idx.length!==s.triangles*3)throw Error('Source count mismatch');
   const geometry=compact(pos,idx,axis);
   return {id:s.id,name:axis?s.source_name.replace(/VERTEBRA_/,'').replaceAll('_',' '):world?`${s.source_name} · ${/^(Sacrum|Coccyx)$/i.test(s.source_name)?'Central':s.side}`:names[j],category:s.tissue,color:colors[s.tissue],...geometry};
  });
 }
 async function load(){
  const [mr,gr]=await Promise.all([fetch(base+'manifest.json'),fetch(base+'vhf-right-knee-source.glb')]);
  if(!mr.ok||!gr.ok)throw Error('Source asset unavailable');
  const [manifestBytes,buffer]=await Promise.all([mr.arrayBuffer(),gr.arrayBuffer()]);const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));const manifestHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',manifestBytes)),v=>v.toString(16).padStart(2,'0')).join('');if(manifestHash!=='ed46e43fca5e8f3ecc4176be1b4fc2229d039dabd63880f070e7a9650f7060f8')throw Error('Knee manifest hash mismatch');
  if(buffer.byteLength!==6929868||manifest.glb.sha256!==hash)throw Error('Source asset size or manifest mismatch');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==hash)throw Error('Source SHA-256 mismatch');
  await nextFrame();const parts=parse(buffer,manifest);parts.sourceInfo={specimen:'VHF right knee · Denver',geometryHash:hash,manifestHash,bundles:[{file:'vhf-right-knee-source.glb',sha256:hash}],coverage:'right knee'};return parts;
 }
 async function loadWorld(){
  const root=base+'world/', response=await fetch(root+'lower-body-manifest.json');if(!response.ok)throw Error('World manifest unavailable');const bytes=await response.arrayBuffer();const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(await digest(bytes)!==worldHash)throw Error('World manifest hash mismatch');const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schema!=='body-live-vhf-lower-body-1'||m.bundles.length!==8||m.structures.length!==128)throw Error('World inventory mismatch');const parts=[],timings=[];for(const b of m.bundles){const started=performance.now(),response=await fetch(root+b.file);if(!response.ok)throw Error('World bundle unavailable: '+b.file);const data=await response.arrayBuffer(),fetched=performance.now();if(data.byteLength!==b.bytes||await digest(data)!==b.sha256)throw Error('World bundle integrity: '+b.file);const structures=m.structures.filter(s=>s.side===b.side&&s.tissue===b.tissue);await nextFrame();const decoding=performance.now();parts.push(...parse(data,{structures},true));timings.push({file:b.file,fetchMs:fetched-started,decodeMs:performance.now()-decoding});}parts.sourceInfo={specimen:'VHF lower body · Denver',manifestHash:worldHash,bundles:m.bundles.map(b=>({file:b.file,sha256:b.sha256,bytes:b.bytes})),coverage:'lower body',timings};return parts;
 }
 const axisManifestHash='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7',axisRegions=['PELVIS / LUMBAR SPINE','THORACIC CAGE','CERVICAL SPINE','CRANIUM'];
 function axisIncludes(s,region){const n=s.source_name;if(region===0)return n==='SACRUM'||n.startsWith('HIP_')||/^VERTEBRA_L[1-6]$/.test(n)||n==='VERTEBRA_T12';if(region===1)return /^VERTEBRA_T\d+$/.test(n)||n==='VERTEBRA_L1'||n==='VERTEBRA_C7'||s.region==='THORAX'||n.startsWith('CLAVICLE_')||n.startsWith('SCAPULA_');if(region===2)return /^VERTEBRA_C[1-7]$/.test(n)||n==='VERTEBRA_T1';return s.region==='SKULL'||n==='VERTEBRA_C1'||n==='VERTEBRA_C2';}
 async function loadAxis(region,previous=[],signal){const root=base+'axis/v1/',digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');const response=await fetch(root+'manifest.json',{signal});if(!response.ok)throw Error('AXIS manifest unavailable');const bytes=await response.arrayBuffer();if(await digest(bytes)!==axisManifestHash)throw Error('AXIS manifest mismatch');const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schema!=='body-live-axis-source-1'||m.structures.length!==61)throw Error('AXIS inventory mismatch');const selected=m.structures.filter(s=>axisIncludes(s,region)),parts=[],timings=[];for(const s of selected){const cached=previous.find(p=>p.id===s.id);if(cached){parts.push(cached);continue;}const start=performance.now(),res=await fetch(root+s.file,{signal});if(!res.ok)throw Error('AXIS geometry unavailable: '+s.file);const data=await res.arrayBuffer(),fetched=performance.now();if(data.byteLength!==s.bytes||await digest(data)!==s.sha256)throw Error('AXIS asset integrity: '+s.file);await nextFrame();if(signal?.aborted)throw Error('AXIS request canceled');const decode=performance.now();parts.push(...parse(data,{structures:[{...s,tissue:'Bone'}]},true,true));timings.push({file:s.file,fetchMs:fetched-start,decodeMs:performance.now()-decode});}parts.sourceInfo={specimen:'BoneHub VHF · separate CT reconstruction',registrationStatus:'unregistered to Denver',manifestHash:axisManifestHash,geometryRevision:m.revision,coverage:axisRegions[region],availableStructures:59,availableTriangles:m.structures.filter(s=>!s.source_name.startsWith('FEMUR_')).reduce((n,s)=>n+s.triangles,0),bundles:selected.map(s=>({file:s.file,sha256:s.sha256,bytes:s.bytes})),timings};return parts;}
 // CONTINUUM: manifest-derived world bounds, exact source geometry and independent asset failures.
 const axisInventory=m=>m.structures.filter(s=>!s.source_name.startsWith('FEMUR_'));
 function axisBox(s){return {id:s.id,min:[(240-s.max[0])*.005,(s.min[2]-1000)*.005,(s.min[1]-235)*.005],max:[(240-s.min[0])*.005,(s.max[2]-1000)*.005,(s.max[1]-235)*.005]};}
 function axisWorldLayout(m){const entries=axisInventory(m);if(entries.length!==59)throw Error('Unexpected axial world inventory');const boxes=entries.map(axisBox);const landmarks=axisRegions.map((label,i)=>{const b=bounds(entries.filter(s=>axisIncludes(s,i)).map(axisBox));return {label,point:b.min.map((v,k)=>(v+b.max[k])/2)};});return {entries,boxes,bounds:bounds(boxes),landmarks};}
 function axisLocation(points,c,previous){if(c.zoom<1.5)return 'AXIAL WORLD';const distances=points.map((p,i)=>({i,d:Math.abs(p.point[1]-c.target.y)})).sort((a,b)=>a.d-b.d);const old=distances.find(x=>x.i===previous);return old&&old.d<=distances[0].d+.12?old.i:distances[0].i;}
 // Worker ownership is scoped to each streaming pass. Transfer buffers rather than clone.
 function axisDecoder(enabled=true){
  let worker=null,serial=0,disabled=!enabled;const jobs=new Map();
  function close(reason='decoder closed'){disabled=true;if(worker){worker.terminate();worker=null;}for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error(reason));}jobs.clear();}
  function ensure(){if(disabled)return false;if(worker)return true;try{worker=new Worker('/assets/atlas/vhf-geometry-worker.js');worker.onmessage=event=>{const {id,part,error,decodeMs,packMs}=event.data,j=jobs.get(id);if(!j)return;jobs.delete(id);clearTimeout(j.timer);if(error)j.reject(Error(error));else j.resolve({part,decodeMs,packMs,execution:'worker'});};worker.onerror=()=>close('geometry worker unavailable');worker.onmessageerror=()=>close('geometry worker message unavailable');return true;}catch{close('geometry worker unavailable');return false;}}
  async function decode(buffer,structure){if(!ensure()){await nextFrame();const start=performance.now(),part=parse(buffer,{structures:[{...structure,tissue:'Bone'}]},true,true)[0],decoded=performance.now();await nextFrame();part.packed=packVertices(part.positions,part.indices);return {part,decodeMs:decoded-start,packMs:performance.now()-decoded,execution:'main-fallback'};}
   const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>close('geometry worker timed out'),30000);jobs.set(id,{resolve,reject,timer});try{worker.postMessage({id,buffer,structure},[buffer]);}catch(e){close(e.message);}});}
  return {decode,close};
 }
 async function openAxisWorld(signal){const root=base+'axis/v1/',digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');const response=await fetch(root+'manifest.json',{signal});if(!response.ok)throw Error('AXIS manifest unavailable');const bytes=await response.arrayBuffer();if(await digest(bytes)!==axisManifestHash)throw Error('AXIS manifest mismatch');const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schema!=='body-live-axis-source-1'||m.structures.length!==61)throw Error('AXIS inventory mismatch');const layout=axisWorldLayout(m),parts=[],timings=[],failures=new Map();parts.sourceInfo={specimen:'BoneHub VHF · separate CT reconstruction',registrationStatus:'unregistered to Denver',manifestHash:axisManifestHash,geometryRevision:m.revision,coverage:'AXIAL WORLD',availableStructures:layout.entries.length,availableTriangles:layout.entries.reduce((n,s)=>n+s.triangles,0),bundles:layout.entries.map(s=>({file:s.file,sha256:s.sha256,bytes:s.bytes})),timings};let running=false;
 async function stream(onChange,signal,priority=()=>null){if(running)return;running=true;const queued=layout.entries.filter(s=>!parts.some(p=>p.id===s.id)),legacy=new URLSearchParams(globalThis.location?.search||'').get('velocity')==='legacy',decoder=axisDecoder(!legacy);const started=performance.now();let first=true;parts.sourceInfo.processing=legacy?'legacy':'worker-preferred';parts.sourceInfo.streamStartedAt=started;
 const rank=s=>s.source_name==='SKULL_CRANIAL_MAXILLA'||s.source_name==='SACRUM'||s.source_name==='STERNUM'||s.source_name==='VERTEBRA_C1'||s.source_name==='HIP_LEFT'||s.source_name==='HIP_RIGHT'||/^RIB_[12]_/.test(s.source_name)?0:1;
 const take=()=>{const c=priority();queued.sort((a,b)=>{if(parts.length<8)return rank(a)-rank(b)||a.bytes-b.bytes;if(!c)return 0;const distance=s=>{const q=axisBox(s);return Math.hypot(...q.min.map((v,k)=>(v+q.max[k])/2-c.target[['x','y','z'][k]]));};return distance(a)-distance(b);});return queued.shift();};
 async function lane(){while(queued.length&&!signal?.aborted){const s=take();if(!s)return;for(let attempt=0;attempt<2&&!signal?.aborted;attempt++){try{const start=performance.now(),res=await fetch(root+s.file,{signal});if(!res.ok)throw Error('HTTP '+res.status);const data=await res.arrayBuffer(),fetched=performance.now();if(data.byteLength!==s.bytes||await digest(data)!==s.sha256)throw Error('asset integrity');if(signal?.aborted)return;let result;if(legacy){await nextFrame();const t=performance.now();result={part:parse(data,{structures:[{...s,tissue:'Bone'}]},true,true)[0],decodeMs:performance.now()-t,packMs:null,execution:'legacy'};}else result=await decoder.decode(data,s);if(signal?.aborted)return;parts.push(result.part);failures.delete(s.id);timings.push({file:s.file,fetchMs:fetched-start,decodeMs:result.decodeMs,packMs:result.packMs,execution:result.execution});if(first){first=false;parts.sourceInfo.firstGeometryMs=performance.now()-started;}onChange();break;}catch(e){if(signal?.aborted)return;failures.set(s.id,e.message);if(attempt===1)onChange();}}}}
 const abort=()=>decoder.close('stream aborted');signal?.addEventListener('abort',abort,{once:true});try{await Promise.all([lane(),lane()]);}finally{signal?.removeEventListener('abort',abort);decoder.close();running=false;parts.sourceInfo.lastStreamDurationMs=performance.now()-started;onChange();}}

 return {...layout,parts,failures,stream,get running(){return running;}};
 }
 function landmarks(parts){const points=[];const center=p=>p.min.map((v,k)=>(v+p.max[k])/2);for(const side of ['left','right']){const get=n=>parts.find(p=>p.id==='vhf-'+side+'-bone-'+n);const femur=get('femur'),tibia=get('tibia'),patella=get('patella'),talus=get('talus'),foot=get('calcaneous'),pelvis=get('pelvis');const add=(label,p)=>{if(p)points.push({label:side.toUpperCase()+' '+label,point:center(p)});};add('HIP',pelvis);add('THIGH',femur);add('KNEE',patella);add('LOWER LEG',tibia);add('ANKLE',talus);add('FOOT',foot);}const sacrum=parts.find(p=>p.id==='vhf-left-bone-sacrum');if(sacrum)points.push({label:'PELVIS',point:center(sacrum)});return points;}
 function neighborhood(points,c,previous){if(c.zoom<3||!points.length)return 'LOWER BODY';const distances=points.map(p=>({label:p.label,d:Math.hypot(p.point[0]-c.target.x,p.point[1]-c.target.y,p.point[2]-c.target.z)})).sort((a,b)=>a.d-b.d);const best=distances[0],old=distances.find(x=>x.label===previous);if(best.d>.65)return 'LOWER BODY';return old&&old.d<=best.d+.10?old.label:best.label;}
 function evictionPlan(entries,protectedIds,now,budget,dwell=5000){let bytes=entries.reduce((n,e)=>n+e.bytes,0);const evict=[];for(const e of entries.filter(e=>!protectedIds.has(e.id)&&now-e.lastUse>=dwell).sort((a,b)=>a.lastUse-b.lastUse)){if(bytes<=budget)break;evict.push(e.id);bytes-=e.bytes;}return {evict,bytes,overBudget:bytes>budget};}
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
 function pickHit(parts,view,c,x,y){return intersect(parts,view,c,x,y,ray,boxHit,visible);}
 function pick(parts,view,c,x,y){return pickHit(parts,view,c,x,y)?.id||null;}
 return Object.freeze({load,loadWorld,loadAxis,openAxisWorld,axisWorldLayout,axisLocation,axisRegions,axisIncludes,parse,transform,bounds,visible,pick,pickHit,inView,compact,packVertices,hash,worldHash,landmarks,neighborhood,evictionPlan});
})();
