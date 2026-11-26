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
  const x=x0*cy+z0*sy,z=z0*cy-x0*sy,y=y0*cp-z*sp,z2=y0*sp+z*cp,w=(c.flight?-z2:7.4-z2)/7.4;
  if(!Number.isFinite(w)||(!c.flight&&w<=.10))return true; // perspective clamp: conservatively retain
  const X=x*scale/(c.width*.5)+(ax-.5)*2*w,Y=(y-(c.flight?0:.04))*scale/(c.height*.5)-(ay-.5)*2*w,Z=c.flight?((250+.005)/(250-.005)*(-z2)-2*250*.005/(250-.005))/7.4:-z2/15;
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
 const world=ray(c,x,y);let best=Infinity,id=null;
 for(const p of parts){
  const transform=view.playground?.transform(p.id),{o,d}=transform?globalThis.BodyPlayground.ray(transform,world.o,world.d):world;
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
   const t=(vx*qx+vy*qy+vz*qz)/det;if(t>0&&t<best&&(!c.flight||t*7.4>=.005&&t*7.4<=250)){best=t;id=p.id;}
  }
 }
 return id?{id,point:{x:world.o[0]+world.d[0]*best,y:world.o[1]+world.d[1]*best,z:world.o[2]+world.d[2]*best}}:null;
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
 async function loadAxis(region,previous=[],signal,onProgress=()=>{}){const root=base+'axis/v1/',digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');const response=await fetch(root+'manifest.json',{signal});if(!response.ok)throw Error('AXIS manifest unavailable');const bytes=await response.arrayBuffer();if(await digest(bytes)!==axisManifestHash)throw Error('AXIS manifest mismatch');const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schema!=='body-live-axis-source-1'||m.structures.length!==61)throw Error('AXIS inventory mismatch');const selected=m.structures.filter(s=>axisIncludes(s,region)),parts=[],timings=[];onProgress({loaded:0,total:selected.length});for(const s of selected){const cached=previous.find(p=>p.id===s.id);if(cached){parts.push(cached);onProgress({loaded:parts.length,total:selected.length});continue;}const start=performance.now(),res=await fetch(root+s.file,{signal});if(!res.ok)throw Error('AXIS geometry unavailable: '+s.file);const data=await res.arrayBuffer(),fetched=performance.now();if(data.byteLength!==s.bytes||await digest(data)!==s.sha256)throw Error('AXIS asset integrity: '+s.file);await nextFrame();if(signal?.aborted)throw Error('AXIS request canceled');const decode=performance.now();parts.push(...parse(data,{structures:[{...s,tissue:'Bone'}]},true,true));timings.push({file:s.file,fetchMs:fetched-start,decodeMs:performance.now()-decode});onProgress({loaded:parts.length,total:selected.length});}parts.sourceInfo={specimen:'BoneHub VHF · separate CT reconstruction',registrationStatus:'unregistered to Denver',manifestHash:axisManifestHash,geometryRevision:m.revision,coverage:axisRegions[region],availableStructures:59,availableTriangles:m.structures.filter(s=>!s.source_name.startsWith('FEMUR_')).reduce((n,s)=>n+s.triangles,0),bundles:selected.map(s=>({file:s.file,sha256:s.sha256,bytes:s.bytes})),timings};return parts;}
 // CONTINUUM: manifest-derived world bounds, exact source geometry and independent asset failures.
 const axisInventory=m=>m.structures.filter(s=>!s.source_name.startsWith('FEMUR_'));
 function axisBox(s){return {id:s.id,min:[(240-s.max[0])*.005,(s.min[2]-1000)*.005,(s.min[1]-235)*.005],max:[(240-s.min[0])*.005,(s.max[2]-1000)*.005,(s.max[1]-235)*.005]};}
 function axisWorldLayout(m){const entries=axisInventory(m);if(entries.length!==59)throw Error('Unexpected axial world inventory');const boxes=entries.map(axisBox);const landmarks=axisRegions.map((label,i)=>{const b=bounds(entries.filter(s=>axisIncludes(s,i)).map(axisBox));return {label,point:b.min.map((v,k)=>(v+b.max[k])/2)};});return {entries,boxes,bounds:bounds(boxes),landmarks};}
 function axisLocation(points,c,previous){if(!c.flight&&c.zoom<1.5)return 'AXIAL WORLD';const distances=points.map((p,i)=>({i,d:Math.abs(p.point[1]-c.target.y)})).sort((a,b)=>a.d-b.d);const old=distances.find(x=>x.i===previous);return old&&old.d<=distances[0].d+.12?old.i:distances[0].i;}

 // RESIDENCY: geometric correspondence certificate for display-only LOD.
 // Every source face maps to a retained triangle, edge or vertex; every retained
 // triangle has a source preimage. The maximum vertex displacement consequently
 // bounds both directed surface distances by barycentric interpolation.
 function lodTopology(indices,n){
  const parent=new Int32Array(n),used=new Uint8Array(n),edges=new Map();
  parent.fill(-1);
  const root=(a)=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  const use=a=>{if(!used[a]){used[a]=1;parent[a]=a;}};
  const join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a;};
  const key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];use(a);use(b);use(c);join(a,b);join(b,c);for(const [u,v] of [[a,b],[b,c],[c,a]]){const k=key(u,v);edges.set(k,(edges.get(k)||0)+1);}}
  const components=new Set();let vertices=0;for(let i=0;i<n;i++)if(used[i]){vertices++;components.add(root(i));}
  const degree=new Uint32Array(n),badVertex=new Uint8Array(n),boundaryParent=new Int32Array(n);boundaryParent.fill(-1);let nonmanifold=0;
  const br=a=>{while(boundaryParent[a]!==a){boundaryParent[a]=boundaryParent[boundaryParent[a]];a=boundaryParent[a];}return a;};
  for(const [k,count] of edges){const a=Math.floor(k/n),b=k%n;if(count>2){nonmanifold++;badVertex[a]=badVertex[b]=1;}if(count!==1)continue;for(const v of [a,b]){degree[v]++;if(boundaryParent[v]<0)boundaryParent[v]=v;}const x=br(a),y=br(b);if(x!==y)boundaryParent[y]=x;}
  const boundaries=new Set();let irregularBoundary=0;for(let i=0;i<n;i++)if(degree[i]){boundaries.add(br(i));if(degree[i]!==2)irregularBoundary++;}
  return {used,edges,key,degree,badVertex,signature:{components:components.size,euler:vertices-edges.size+indices.length/3,boundaries:boundaries.size,irregularBoundary,nonmanifold}};
 }

 // Independent manifold edge collapses with a one-ring exclusion per pass.
 // The exact source coordinates of surviving vertices are retained.
 function collapseRound(pos,idx,radii,limit,top){
  const n=pos.length/3,counts=new Uint32Array(n),offsets=new Uint32Array(n+1);
  for(const v of idx)counts[v]++;for(let i=0;i<n;i++)offsets[i+1]=offsets[i]+counts[i];
  const cursor=offsets.slice(),incident=new Uint32Array(idx.length);
  for(let i=0;i<idx.length;i++)incident[cursor[idx[i]]++]=Math.floor(i/3)*3;
  const neighbors=v=>{const set=new Set();for(let k=offsets[v];k<offsets[v+1];k++){const f=incident[k];for(let j=0;j<3;j++)if(idx[f+j]!==v)set.add(idx[f+j]);}return set;};
  const normal=(a,b,c)=>{a*=3;b*=3;c*=3;const x=pos[b]-pos[a],y=pos[b+1]-pos[a+1],z=pos[b+2]-pos[a+2],u=pos[c]-pos[a],v=pos[c+1]-pos[a+1],w=pos[c+2]-pos[a+2];return [y*w-z*v,z*u-x*w,x*v-y*u];};
  const safe=(from,to,dist)=>{if(radii[from]+dist>limit)return false;const faceKeys=new Set();
   for(const v of [from,to])for(let k=offsets[v];k<offsets[v+1];k++){const f=incident[k],old=[idx[f],idx[f+1],idx[f+2]];if(old.includes(from)&&old.includes(to))continue;const next=old.map(x=>x===from?to:x);const key=[...next].sort((a,b)=>a-b).join(',');if(faceKeys.has(key))return false;faceKeys.add(key);if(v===from){const a=normal(...old),b=normal(...next),dot=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=Math.hypot(...a)*Math.hypot(...b);if(!len||dot<len*.5)return false;}}
   return true;};
  const blocked=new Uint8Array(n),representative=Uint32Array.from({length:n},(_,i)=>i);let removed=0;
  for(const [k,edgeFaces] of top.edges){if(edgeFaces>2)continue;let a=Math.floor(k/n),b=k%n;if(blocked[a]||blocked[b]||top.badVertex[a]||top.badVertex[b])continue;
   const ba=top.degree[a],bb=top.degree[b];if((ba||bb)&&(edgeFaces!==1||ba!==2||bb!==2))continue;
   const dist=Math.hypot(pos[a*3]-pos[b*3],pos[a*3+1]-pos[b*3+1],pos[a*3+2]-pos[b*3+2]);if(!dist||Math.min(radii[a],radii[b])+dist>limit)continue;
   const na=neighbors(a),nb=neighbors(b);let common=0;for(const x of na)if(nb.has(x))common++;if(common!==edgeFaces)continue;
   // A surviving link must contain exactly the edge's opposite vertices.
   const opposite=new Set();for(let j=offsets[a];j<offsets[a+1];j++){const f=incident[j],tri=[idx[f],idx[f+1],idx[f+2]];if(tri.includes(b))for(const x of tri)if(x!==a&&x!==b)opposite.add(x);}
   if(opposite.size!==edgeFaces||[...opposite].some(x=>!na.has(x)||!nb.has(x)))continue;
   if(!safe(b,a,dist)){if(!safe(a,b,dist))continue;[a,b]=[b,a];}
   representative[b]=a;radii[a]=Math.max(radii[a],radii[b]+dist);blocked[a]=blocked[b]=1;for(const x of na)blocked[x]=1;for(const x of nb)blocked[x]=1;removed++;
  }
  if(!removed)return null;
  const remap=new Uint32Array(n),index=new Int32Array(n);index.fill(-1);const coords=[],outRadii=[];
  for(let i=0;i<n;i++){const j=representative[i];if(index[j]<0){index[j]=coords.length/3;coords.push(pos[j*3],pos[j*3+1],pos[j*3+2]);outRadii.push(radii[j]);}remap[i]=index[j];}
  const faces=[];for(let i=0;i<idx.length;i+=3){const a=remap[idx[i]],b=remap[idx[i+1]],c=remap[idx[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
  return {positions:new Float32Array(coords),indices:new Uint32Array(faces),radii:new Float64Array(outRadii),remap,removed};
 }
 function edgeCorrespondence(part,limit,sourceTopology,maxRounds=4){
  const source=part.positions,n=source.length/3;
  let pos=source,idx=part.indices,radii=new Float64Array(n),mapped=Uint32Array.from({length:n},(_,i)=>i),top=sourceTopology;
  for(let pass=0;pass<maxRounds;pass++){
   const round=collapseRound(pos,idx,radii,limit,top);if(!round)break;
   const next=lodTopology(round.indices,round.positions.length/3);
   if(JSON.stringify(next.signature)!==JSON.stringify(sourceTopology.signature))break;
   for(let i=0;i<n;i++)mapped[i]=round.remap[mapped[i]];
   pos=round.positions;idx=round.indices;radii=round.radii;top=next;
   if(idx.length<part.indices.length*.45)break;
  }
  let error=0;for(let i=0;i<n;i++){const j=mapped[i];error=Math.max(error,Math.hypot(source[i*3]-pos[j*3],source[i*3+1]-pos[j*3+1],source[i*3+2]-pos[j*3+2]));}
  return {mapped,coords:pos,error};
 }

 function deriveLod(part,fraction,level,sourceTopology,maxRounds=4){
  const pos=part.positions,idx=part.indices,n=pos.length/3,diagonal=Math.hypot(...part.max.map((v,k)=>v-part.min[k]));
  if(!Number.isFinite(diagonal)||diagonal<=0||idx.length<300)return null;
  const limit=diagonal*fraction,{mapped,coords,error}=edgeCorrespondence(part,limit,sourceTopology,maxRounds);
  if(error>limit||coords.length>=pos.length*.95)return null;
  const faces=[],unique=new Map(),collapsed=[];
  const normal=(p,a,b,c)=>{a*=3;b*=3;c*=3;const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],u=p[c]-p[a],v=p[c+1]-p[a+1],w=p[c+2]-p[a+2];return [y*w-z*v,z*u-x*w,x*v-y*u];};
  for(let i=0;i<idx.length;i+=3){const a=mapped[idx[i]],b=mapped[idx[i+1]],c=mapped[idx[i+2]];if(a===b||b===c||c===a){collapsed.push(a,b,c);continue;}const old=normal(pos,idx[i],idx[i+1],idx[i+2]),next=normal(coords,a,b,c);if(old[0]*next[0]+old[1]*next[1]+old[2]*next[2]<=0)return null;const sorted=[a,b,c].sort((x,y)=>x-y),key=sorted.join(','),orientation=(a===sorted[0]&&b===sorted[1])||(b===sorted[0]&&c===sorted[1])||(c===sorted[0]&&a===sorted[1]);if(unique.has(key)){if(unique.get(key)!==orientation)return null;continue;}unique.set(key,orientation);faces.push(a,b,c);}
  if(faces.length<3||faces.length>=idx.length*.95)return null;
  const count=coords.length/3,top=lodTopology(faces,count);
  for(let i=0;i<collapsed.length;i+=3){const distinct=[...new Set(collapsed.slice(i,i+3))];if(distinct.some(v=>!top.used[v])||(distinct.length===2&&!top.edges.has(top.key(...distinct))))return null;}
  if(JSON.stringify(top.signature)!==JSON.stringify(sourceTopology.signature))return null;
  // Use the source AABB conservatively for visibility; actual vertices never leave it.
  const positions=new Float32Array(coords),indices=count<=65536?new Uint16Array(faces):new Uint32Array(faces);
  return {id:part.id,name:part.name,category:part.category,color:part.color,min:part.min,max:part.max,positions,indices,lodLevel:level,certificate:{method:'face-correspondence-bound-v1',maxSurfaceDistanceUpperBound:error,limit,relativeBound:error/diagonal,sourceTriangles:idx.length/3,triangles:indices.length/3,topologyInvariants:top.signature,units:'display units; physical mm unconfirmed'}};
 }
 function buildLods(part,maxRounds=4){
  const topology=lodTopology(part.indices,part.positions.length/3),levels=[];
  for(const [fraction,level] of [[.012,'overview'],[.004,'regional']]){
   // Conservative rejection is expected for thin, unusual or non-manifold geometry.
   const candidate=deriveLod(part,fraction,level,topology,maxRounds);if(candidate)levels.push(candidate);
  }
  return levels;
 }
 function chooseLod(part,c,selected,current){
  const levels=part.lods||[],find=level=>levels.find(p=>p.lodLevel===level);
  if(selected===part.id||c.zoom>=4.5||(current==='exact'&&c.zoom>3.8))return part;
  if(c.zoom>=1.7||(current==='regional'&&c.zoom>1.4))return find('regional')||part;
  return find('overview')||find('regional')||part;
 }
 function overviewFrameSpan(b){return Math.max(3.25,2*(b.radius+.04)/Math.max(.1,1-b.radius/7.4)*1.12);}
 // Bounded network operations, including reading the response body. Unlike RAF,
 // a timeout-backed task yield does not depend on animation frame delivery.
 async function axisFetch(url,signal,timeout=20000){
  const ac=new AbortController(),abort=()=>ac.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>ac.abort(Error('AXIS fetch deadline exceeded')),timeout);
  try{const response=await fetch(url,{signal:ac.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.arrayBuffer();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));

 // Worker ownership is scoped to each streaming pass. Transfer buffers rather than clone.
 function axisDecoder(enabled=true,lod=true){
  let worker=null,serial=0,disabled=!enabled;const jobs=new Map();
  function close(reason='decoder closed'){disabled=true;if(worker){worker.terminate();worker=null;}for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error(reason));}jobs.clear();}
  function ensure(){if(disabled)return false;if(worker)return true;try{worker=new Worker('/assets/atlas/vhf-geometry-worker.js');worker.onmessage=event=>{const {id,part,error,decodeMs,packMs}=event.data,j=jobs.get(id);if(!j)return;jobs.delete(id);clearTimeout(j.timer);if(error)j.reject(Error(error));else j.resolve({part,decodeMs,packMs,execution:'worker'});};worker.onerror=()=>close('geometry worker unavailable');worker.onmessageerror=()=>close('geometry worker message unavailable');return true;}catch{close('geometry worker unavailable');return false;}}
  async function decode(buffer,structure){if(!ensure()){await yieldTask();const start=performance.now(),part=parse(buffer,{structures:[{...structure,tissue:'Bone'}]},true,true)[0],decoded=performance.now();await yieldTask();part.packed=packVertices(part.positions,part.indices);return {part,decodeMs:decoded-start,packMs:performance.now()-decoded,execution:'main-fallback'};}
   const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>close('geometry worker timed out'),30000);jobs.set(id,{resolve,reject,timer});try{worker.postMessage({id,buffer,structure,lod},[buffer]);}catch(e){close(e.message);}});}
  return {decode,close};
 }
 async function openAxisWorld(signal){const root=base+'axis/v1/',digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');const bytes=await axisFetch(root+'manifest.json',signal);if(await digest(bytes)!==axisManifestHash)throw Error('AXIS manifest mismatch');const m=JSON.parse(new TextDecoder().decode(bytes));if(m.schema!=='body-live-axis-source-1'||m.structures.length!==61)throw Error('AXIS inventory mismatch');const layout=axisWorldLayout(m),parts=[],timings=[],failures=new Map();parts.sourceInfo={specimen:'BoneHub VHF · separate CT reconstruction',registrationStatus:'unregistered to Denver',manifestHash:axisManifestHash,geometryRevision:m.revision,coverage:'AXIAL WORLD',availableStructures:layout.entries.length,availableTriangles:layout.entries.reduce((n,s)=>n+s.triangles,0),bundles:layout.entries.map(s=>({file:s.file,sha256:s.sha256,bytes:s.bytes})),timings};let running=false;
 async function stream(onChange,signal,priority=()=>null){if(running)return;running=true;const queued=layout.entries.filter(s=>!parts.some(p=>p.id===s.id)),legacy=new URLSearchParams(globalThis.location?.search||'').get('velocity')==='legacy',lodEnabled=new URLSearchParams(globalThis.location?.search||'').get('lod')!=='off',decoders=[axisDecoder(!legacy,lodEnabled),axisDecoder(!legacy,lodEnabled)];const started=performance.now();let first=true;parts.sourceInfo.processing=legacy?'legacy':'worker-preferred';parts.sourceInfo.streamStartedAt=started;
 const rank=s=>s.source_name==='SKULL_CRANIAL_MAXILLA'||s.source_name==='SACRUM'||s.source_name==='STERNUM'||s.source_name==='VERTEBRA_C1'||s.source_name==='HIP_LEFT'||s.source_name==='HIP_RIGHT'||/^RIB_[12]_/.test(s.source_name)?0:1;
 const take=()=>{const c=priority();queued.sort((a,b)=>{if(parts.length<8)return rank(a)-rank(b)||a.bytes-b.bytes;if(!c)return 0;const distance=s=>{const q=axisBox(s);return Math.hypot(...q.min.map((v,k)=>(v+q.max[k])/2-c.target[['x','y','z'][k]]));};return distance(a)-distance(b);});return queued.shift();};
 async function lane(decoder){while(queued.length&&!signal?.aborted){const s=take();if(!s)return;for(let attempt=0;attempt<2&&!signal?.aborted;attempt++){try{const start=performance.now(),data=await axisFetch(root+s.file,signal),fetched=performance.now();if(data.byteLength!==s.bytes||await digest(data)!==s.sha256)throw Error('asset integrity');if(signal?.aborted)return;let result;if(legacy){await yieldTask();const t=performance.now();result={part:parse(data,{structures:[{...s,tissue:'Bone'}]},true,true)[0],decodeMs:performance.now()-t,packMs:null,execution:'legacy'};}else result=await decoder.decode(data,s);if(signal?.aborted)return;parts.push(result.part);failures.delete(s.id);timings.push({file:s.file,fetchMs:fetched-start,decodeMs:result.decodeMs,packMs:result.packMs,execution:result.execution,lodStatus:result.part.lodStatus||'exact',lod:(result.part.lods||[]).map(p=>({level:p.lodLevel,...p.certificate}))});if(first){first=false;parts.sourceInfo.firstGeometryMs=performance.now()-started;}onChange();break;}catch(e){if(signal?.aborted)return;failures.set(s.id,e.message);if(attempt===1)onChange();}}}}
 const abort=()=>decoders.forEach(d=>d.close('stream aborted'));signal?.addEventListener('abort',abort,{once:true});try{await Promise.all(decoders.map(lane));}finally{signal?.removeEventListener('abort',abort);decoders.forEach(d=>d.close());running=false;parts.sourceInfo.lastStreamDurationMs=performance.now()-started;onChange();}}

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
  const o=c.flight?[0,0,0]:inverse(0,.04,7.4),d=inverse((x-c.width*(c.anchorX??.5))/scale,-(y-c.height*(c.anchorY??.5))/scale,-7.4);
  return {o:[o[0]+c.target.x,o[1]+c.target.y,o[2]+c.target.z],d};
 }
 function boxHit(o,d,min,max){let lo=0,hi=Infinity;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-12){if(o[k]<min[k]||o[k]>max[k])return false;continue;}let a=(min[k]-o[k])/d[k],b=(max[k]-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return false;}return true;}
 function pickHit(parts,view,c,x,y){return intersect(parts,view,c,x,y,ray,boxHit,visible);}
 function pick(parts,view,c,x,y){return pickHit(parts,view,c,x,y)?.id||null;}
 return Object.freeze({load,loadWorld,loadAxis,openAxisWorld,axisWorldLayout,axisLocation,axisRegions,axisIncludes,buildLods,chooseLod,overviewFrameSpan,parse,transform,bounds,visible,pick,pickHit,ray,inView,compact,packVertices,hash,worldHash,landmarks,neighborhood,evictionPlan});
})();
