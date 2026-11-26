// NANITE v1: isolated UNITY geometry contract. No scene or legacy renderer mutation.
export const SCHEMA='body-live-unity-geometry-1';
export const BUDGET=32*1024*1024;
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const count=n=>Number.isSafeInteger(n)&&n>0;
const require=(x,m)=>{if(!x)throw Error(m);};
export function gpuBytes(vertices,indexCount,indexWidth){
 require(count(vertices)&&count(indexCount)&&indexCount%3===0&&[2,4].includes(indexWidth),'invalid geometry counts');
 return vertices*16+indexCount*indexWidth;
}
export function validateManifest(m,source,sourceHash){
 require(m.schema===SCHEMA&&validHash(sourceHash)&&m.sourceManifestSha256===sourceHash&&m.sourceRevision===source.revision,'manifest identity');
 require(source.schema==='body-live-unity-source-1'&&source.structures.length===143&&m.structures.length===143,'coverage');
 const ids=new Set();
 for(const e of m.structures){
  const s=source.structures.find(x=>x.id===e.id);
  require(s&&!ids.has(e.id)&&validHash(s.sha256)&&s.sha256===e.sourceHash&&s.sha256===e.exact.sha256&&s.file===e.exact.file&&s.bytes===e.exact.bytes&&s.vertices===e.exact.vertices&&s.triangles===e.exact.triangles&&e.exact.file===e.id+'.glb'&&/^bonehub-vhf-[a-z0-9_]+$/.test(e.id),'source mismatch '+e.id);ids.add(e.id);
  require(e.min.length===3&&e.max.length===3&&e.min.every((x,i)=>Number.isFinite(x)&&Number.isFinite(e.max[i])&&x<=e.max[i]),'bounds');
  require(e.levels.some(l=>l.level==='exact-display')&&e.levels.some(l=>l.level===e.overviewLevel)&&new Set(e.levels.map(l=>l.level)).size===e.levels.length,'levels');
  for(const l of e.levels){
   require(['overview','regional','exact-display'].includes(l.level)&&validHash(l.sha256)&&validHash(l.decodedSha256)&&count(l.bytes)&&count(l.decodedBytes)&&l.decodedBytes===16+l.vertices*12+l.triangles*3*l.indexWidth&&l.gpuBytes===gpuBytes(l.vertices,l.triangles*3,l.indexWidth),'level counts');
   require(typeof l.file==='string'&&/^[a-z0-9_.-]+\.bld\.gz$/.test(l.file),'unsafe file');
   require(Number.isFinite(l.error)&&l.error>=0&&l.error<=l.limit&&Number.isFinite(l.limit),'error certificate');
   require(l.level==='exact-display'?l.error===0&&l.triangles===s.triangles&&l.vertices===s.vertices:l.certificate?.method==='face-correspondence-bound-v1'&&l.certificate.maxSurfaceDistanceUpperBound===l.error,'qualification');
  }
 }
 return m;
}
// Matches RESIDENCY camera perspective. Conservative box bound on projection Jacobian.
// A box crossing the near clamp requests detail rather than understating error.
export function projectedError(e,error,c){
 if(error===0)return 0;
 const {width,height,frameSpan,zoom,yaw,pitch,target}=c;
 if(![width,height,frameSpan,zoom,yaw,pitch,target?.x,target?.y,target?.z].every(Number.isFinite)||Math.min(width,height,frameSpan,zoom)<=0)return Infinity;
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 let maxZ=-Infinity,maxR=0;
 for(let i=0;i<8;i++){
  const a=(i&1?e.max[0]:e.min[0])-target.x,b=(i&2?e.max[1]:e.min[1])-target.y,d=(i&4?e.max[2]:e.min[2])-target.z;
  const x=a*cy+d*sy,z=d*cy-a*sy,y=b*cp-z*sp,depth=b*sp+z*cp;
  maxZ=Math.max(maxZ,depth);maxR=Math.max(maxR,Math.hypot(x,y-.04));
 }
 const w=1-(maxZ+error)/7.4;
 if(w<=.1)return Infinity;
 return error*Math.min(width/3.25,height/frameSpan)*zoom*(1/w+(maxR+error)/(7.4*w*w));
}
export function chooseLevel(e,c,current,selected=false,threshold=1.5){
 require(Number.isFinite(threshold)&&threshold>0,'invalid threshold');
 if(selected)return {level:'exact',...e.exact};
 const levels=[...e.levels].sort((a,b)=>a.gpuBytes-b.gpuBytes||b.error-a.error);
 const old=levels.find(l=>l.level===current);
 if(old&&projectedError(e,old.error,c)<=threshold*1.2){
  const cheaper=levels.find(l=>l.gpuBytes<old.gpuBytes&&projectedError(e,l.error,c)<=threshold*.75);
  return cheaper||old;
 }
 return levels.find(l=>projectedError(e,l.error,c)<=threshold)||{level:'exact',...e.exact};
}
export function decodeBLD(buffer,record){
 const d=new DataView(buffer);
 require(buffer.byteLength===record.decodedBytes&&d.getUint32(0,true)===0x31444c42,'BLD header');
 const n=d.getUint32(4,true),i=d.getUint32(8,true),w=d.getUint32(12,true);
 require(n===record.vertices&&i===record.triangles*3&&w===record.indexWidth&&buffer.byteLength===16+n*12+i*w,'BLD counts');
 const positions=new Float32Array(n*3),indices=w===2?new Uint16Array(i):new Uint32Array(i);
 for(let k=0;k<positions.length;k++){positions[k]=d.getFloat32(16+4*k,true);require(Number.isFinite(positions[k]),'nonfinite position');}
 for(let k=0;k<i;k++){indices[k]=w===2?d.getUint16(16+n*12+k*w,true):d.getUint32(16+n*12+k*w,true);require(indices[k]<n,'invalid index');}
 return {positions,indices};
}
export async function verifiedBytes(url,record,{signal,fetcher=fetch,digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}={}){
 const response=await fetcher(url,{signal});require(response.ok,'geometry unavailable');
 const data=await response.arrayBuffer();require(data.byteLength===record.bytes&&await digest(data)===record.sha256,'geometry integrity');
 return data;
}
export async function loadDisplay(root,record,options={}){
 const compressed=await verifiedBytes(new URL(record.file,root),record,options);
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const output=new Uint8Array(record.decodedBytes);let offset=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;require(offset+value.length<=output.length,'decoded length overflow');output.set(value,offset);offset+=value.length;}}
 finally{await reader.cancel();}
 const digest=options.digest|| (async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join(''));
 require(offset===output.length&&await digest(output.buffer)===record.decodedSha256,'decoded integrity');
 return decodeBLD(output.buffer,record);
}
// Float32 positions remain exact to the derivative; normals only are SNORM8.
export function packCompact(mesh){
 const {positions:p,indices:i}=mesh,n=p.length/3,normal=new Float32Array(p.length),bytes=new ArrayBuffer(n*16),view=new DataView(bytes);
 for(let k=0;k<i.length;k+=3){const a=i[k]*3,b=i[k+1]*3,c=i[k+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
  for(const v of [a,b,c]){normal[v]+=uy*vz-uz*vy;normal[v+1]+=uz*vx-ux*vz;normal[v+2]+=ux*vy-uy*vx;}
 }
 for(let v=0;v<n;v++){const k=v*3,o=v*16,len=Math.hypot(normal[k],normal[k+1],normal[k+2])||1;
  for(let j=0;j<3;j++){view.setFloat32(o+j*4,p[k+j],true);view.setInt8(o+12+j,Math.round(127*normal[k+j]/len));}
 }
 return {vertices:new Uint8Array(bytes),indices:i,bytes:bytes.byteLength+i.byteLength,layout:{stride:16,position:{offset:0,type:'FLOAT',size:3},normal:{offset:12,type:'BYTE',size:3,normalized:true}}};
}
// Strict budget includes committed and in-flight GPU allocations. Adapter must dispose
// abandoned/failed handles; only complete handles may be committed.
export class Residency {
 constructor(budget=BUDGET,headroom=0){require(count(budget)&&Number.isSafeInteger(headroom)&&headroom>=0&&headroom<budget,'invalid budget/headroom');this.budget=budget;this.headroom=headroom;this.resident=new Map();this.pending=new Map();this.serial=0;this.peak=0;this.denied=0;}
 get bytes(){return [...this.resident.values(),...this.pending.values()].reduce((n,r)=>n+r.bytes,0);}
 get committedBytes(){return [...this.resident.values()].reduce((n,r)=>n+r.bytes,0);}
 diagnostics(){return {budget:this.budget,headroom:this.headroom,committedBytes:this.committedBytes,stagedBytes:this.bytes-this.committedBytes,peakBytes:this.peak,denied:this.denied,residentCount:this.resident.size,pendingCount:this.pending.size};}
 reserve(id,level,bytes,now,protectedIds=new Set(),dispose=()=>{}){
  require(count(bytes)&&Number.isFinite(now),'invalid reservation');
  if(this.pending.size)return null; // one in-flight transaction; conservative steady-state accounting
  const old=this.resident.get(id),steady=this.budget-this.headroom;
  if(this.pending.has(id)||old?.level===level)return null;
  // Reserve headroom for replacements, not steady allocations. Plan before
  // evicting anything; an impossible request must not churn unrelated meshes.
  const fits=(total)=>total+bytes<=this.budget&&total+bytes-(old?.bytes||0)<=steady;
  let total=this.bytes;const victims=[];
  for(const [key,r] of [...this.resident].sort((a,b)=>a[1].lastUse-b[1].lastUse)){
   if(fits(total))break;
   if(key!==id&&!protectedIds.has(key)&&!this.pending.has(key)&&now-r.lastUse>=5000){victims.push([key,r]);total-=r.bytes;}
  }
  if(!fits(total)){this.denied++;return null;}
  for(const [key,r] of victims){dispose(r.handle);this.resident.delete(key);}
  const token={id,level,bytes,serial:++this.serial};this.pending.set(id,token);this.peak=Math.max(this.peak,this.bytes);return token;
 }
 commit(token,handle,actualBytes,now,dispose=()=>{}){
  require(this.pending.get(token.id)===token,'stale upload');
  require(actualBytes===token.bytes&&handle!=null&&Number.isFinite(now),'allocation mismatch');
  const old=this.resident.get(token.id);if(old)dispose(old.handle);
  this.pending.delete(token.id);this.resident.set(token.id,{...token,handle,lastUse:now});
 }
 cancel(token){if(this.pending.get(token.id)===token)this.pending.delete(token.id);}
 touch(id,now){const r=this.resident.get(id);if(r)r.lastUse=now;}
 queue(requests,selected){return [...requests].filter(r=>!this.pending.has(r.id)&&this.resident.get(r.id)?.level!==r.level).sort((a,b)=>Number(this.resident.has(a.id))-Number(this.resident.has(b.id))||Number(b.id===selected)-Number(a.id===selected)||(b.priority||0)-(a.priority||0)||a.id.localeCompare(b.id));}
}
// Whole-structure atomicity only. Exact partitions share identical position values;
// no independent mixed-resolution seam transitions are authorized.
export function partitionExact(mesh,maxTriangles=16384){
 require(count(maxTriangles),'cluster size');const {positions,indices}=mesh;
 const ids=Array.from({length:indices.length/3},(_,i)=>i);
 const center=(f,k)=>(positions[indices[f*3]*3+k]+positions[indices[f*3+1]*3+k]+positions[indices[f*3+2]*3+k])/3;
 const out=[];
 function split(faces){
  if(faces.length>maxTriangles){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const f of faces)for(let k=0;k<3;k++){const x=center(f,k);lo[k]=Math.min(lo[k],x);hi[k]=Math.max(hi[k],x);}
   const axis=[0,1,2].sort((a,b)=>(hi[b]-lo[b])-(hi[a]-lo[a]))[0];faces.sort((a,b)=>center(a,axis)-center(b,axis)||a-b);const mid=faces.length>>1;split(faces.slice(0,mid));split(faces.slice(mid));return;
  }
  const remap=new Map(),p=[],i=[];for(const f of faces)for(let j=0;j<3;j++){const v=indices[f*3+j];if(!remap.has(v)){remap.set(v,p.length/3);p.push(...positions.subarray(v*3,v*3+3));}i.push(remap.get(v));}
  out.push({positions:new Float32Array(p),indices:p.length/3<=65536?new Uint16Array(i):new Uint32Array(i),sourceFaces:faces});
 }
 split(ids);return out;
}

// Both pins must originate outside the downloaded manifests (reviewed deployment).
export async function openVerifiedManifests({sourceUrl,derivativeUrl,sourceHash,derivativeHash,fetcher=fetch,digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join(''),signal}){
 require(validHash(sourceHash)&&validHash(derivativeHash),'independent manifest pins required');
 async function read(url,pin){const r=await fetcher(url,{signal});require(r.ok,'manifest unavailable');const b=await r.arrayBuffer();require(await digest(b)===pin,'manifest digest mismatch');return JSON.parse(new TextDecoder().decode(b));}
 const [source,manifest]=await Promise.all([read(sourceUrl,sourceHash),read(derivativeUrl,derivativeHash)]);
 validateManifest(manifest,source,sourceHash);return {source,manifest,sourceHash,derivativeHash};
}
