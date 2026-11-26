// Pinned meshoptimizer 0.22 vs existing correspondence-preserving collapse.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import {createRequire} from 'node:module';
import '../assets/atlas/vhf-source.js';
import {lodTopology,prefixTrials} from './nanite_c_correspondence.mjs';
import {certifyDirected} from './nanite_c_surface.mjs';
const req=createRequire(import.meta.url),vendor=new URL('./vendor/meshoptimizer-0.22/',import.meta.url);
for(const [f,pin] of Object.entries({'meshopt_simplifier.cjs':'7114fe6c19215c41664c37e7ffe6c58096b8ab71','meshopt_encoder.cjs':'4626f83cf510c7244431471aff0a42a6bdf8b630','meshopt_decoder.cjs':'f8318d979dd01d1d31aeac04771e50769d67c7d5'})){const b=readFileSync(new URL(f,vendor)),sha=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');if(sha!==pin)throw Error('vendored blob mismatch '+f);}
const S=req(new URL('meshopt_simplifier.cjs',vendor).pathname),E=req(new URL('meshopt_encoder.cjs',vendor).pathname),D=req(new URL('meshopt_decoder.cjs',vendor).pathname);
await Promise.all([S.ready,E.ready,D.ready]);S.useExperimentalFeatures=true;
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const [root,out,scope='cohort']=process.argv.slice(2);if(!root||!out)throw Error('usage: matrix SOURCE_DIR OUTPUT_DIR [cohort|all]');mkdirSync(out,{recursive:true});
const raw=readFileSync(join(root,'manifest.json')),source=JSON.parse(raw),pin='e8c22674b3f29c3db3671632cb4ba0ccfcf7168a319dc9f77fb3c3773f09273f';if(sha(raw)!==pin||source.structures.length!==143)throw Error('source manifest pin');
const V=globalThis.BodyVHF;
function protection(mesh,top){
 const p=mesh.positions,f=mesh.indices,n=p.length/3,faceN=new Float64Array(f.length),sum=new Float32Array(p.length),first=new Map(),locked=new Uint8Array(n),protectedEdges=[];
 for(let j=0;j<f.length;j+=3){const a=f[j]*3,b=f[j+1]*3,c=f[j+2]*3,u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...q);for(let k=0;k<3;k++){faceN[j+k]=q[k]/(len||1);for(let x=0;x<3;x++)sum[f[j+x]*3+k]+=q[k];}
  for(let k=0;k<3;k++){const a=f[j+k],b=f[j+(k+1)%3],key=top.key(a,b);if(!first.has(key)){first.set(key,j);continue;}const old=first.get(key),dot=faceN[old]*faceN[j]+faceN[old+1]*faceN[j+1]+faceN[old+2]*faceN[j+2];if(dot<Math.SQRT1_2){locked[a]=locked[b]=1;protectedEdges.push(key);}}
 }
 for(const [key,count] of top.edges)if(count!==2){locked[Math.floor(key/n)]=locked[key%n]=1;protectedEdges.push(key);}
 for(let j=0;j<sum.length;j+=3){const len=Math.hypot(sum[j],sum[j+1],sum[j+2])||1;for(let k=0;k<3;k++)sum[j+k]/=len;}
 return {locked,normals:sum,protectedEdges:[...new Set(protectedEdges)]};
}
function compact(p,f){const map=new Int32Array(p.length/3);map.fill(-1);const v=[],idx=new Uint32Array(f.length);for(let j=0;j<f.length;j++){let i=f[j];if(map[i]<0){map[i]=v.length/3;v.push(p[i*3],p[i*3+1],p[i*3+2]);}idx[j]=map[i];}return {positions:new Float32Array(v),indices:v.length/3<=65536?new Uint16Array(idx):idx};}
function transport(mesh){
 const idx=new Uint32Array(mesh.indices),[remap,count]=E.reorderMesh(idx,true,true),pos=new Float32Array(count*3);
 for(let j=0;j<remap.length;j++)if(remap[j]!==0xffffffff){pos.set(mesh.positions.subarray(j*3,j*3+3),remap[j]*3);}
 const w=count<=65536?2:4,ii=w===2?new Uint16Array(idx):idx,v=E.encodeVertexBuffer(new Uint8Array(pos.buffer),count,12),i=E.encodeIndexSequence(new Uint8Array(ii.buffer),ii.length,w),dv=new Uint8Array(pos.byteLength),di=new Uint8Array(ii.byteLength),t=performance.now();D.decodeVertexBuffer(dv,count,12,v);D.decodeIndexSequence(di,ii.length,w,i);const decodeMs=performance.now()-t;
 if(!Buffer.from(dv).equals(Buffer.from(pos.buffer))||!Buffer.from(di).equals(Buffer.from(ii.buffer)))throw Error('meshopt codec round-trip');
 const header=Buffer.alloc(24);header.write('NMO1');[count,ii.length,w,v.length,i.length].forEach((x,k)=>header.writeUInt32LE(x,4+k*4));const payload=Buffer.concat([header,v,i]),gzip=gzipSync(payload,{level:9});return {payload,gzip,bytes:payload.length,gzipBytes:gzip.length,decodedBytes:pos.byteLength+ii.byteLength,decodeMs,gpuBytes:count*16+ii.byteLength};
}
const rows=[],es=[...source.structures].sort((a,b)=>b.triangles-a.triangles);for(const e of scope==='all'?es:es.slice(0,8)){
 const b=readFileSync(join(root,e.file));if(sha(b)!==e.sha256||b.length!==e.bytes)throw Error('source GLB '+e.id);
 const part=V.parse(ab(b),{structures:[{...e,tissue:'Bone'}]},true,true)[0],top=lodTopology(part.indices,part.positions.length/3),feature=protection(part,top),limit=Math.hypot(...part.max.map((x,k)=>x-part.min[k]))*.012,baseline=prefixTrials(part,.012,12);
 const row={id:e.id,sourceHash:e.sha256,sourceTriangles:e.triangles,sourceTopology:top.signature,limit,lockedVertices:feature.locked.reduce((n,x)=>n+x,0),protectedEdges:feature.protectedEdges.length,baseline:{trials:baseline.trials,best:baseline.best?{pass:baseline.best.pass,triangles:baseline.best.triangles,error:baseline.best.error}:null},meshopt:[]};
 const exact=transport(part);row.exactTransport={bytes:exact.bytes,gzipBytes:exact.gzipBytes,gpuBytes:exact.gpuBytes,decodeMs:exact.decodeMs};
 let best=null;
 for(const target of [.5,.25,.1]){
  const t=performance.now(),[idx,internalError]=S.simplifyWithAttributes(new Uint32Array(part.indices),part.positions,3,feature.normals,3,[.15,.15,.15],feature.locked,Math.max(3,Math.floor(e.triangles*target)*3),limit,['LockBorder','ErrorAbsolute']);
  const nextTop=lodTopology(idx,part.positions.length/3),topologyPass=JSON.stringify(top.signature)===JSON.stringify(nextTop.signature),missingEdges=feature.protectedEdges.filter(k=>!nextTop.edges.has(k)).length,missingLocks=feature.locked.reduce((n,x,i)=>n+Number(x&&!nextTop.used[i]),0);
  const m={...compact(part.positions,idx),min:part.min,max:part.max},trans=transport(m),r={target,triangles:idx.length/3,vertices:m.positions.length/3,internalErrorProposalOnly:internalError,topologyPass,missingEdges,missingLocks,bytes:trans.bytes,gzipBytes:trans.gzipBytes,gpuBytes:trans.gpuBytes,decodedBytes:trans.decodedBytes,decodeMs:trans.decodeMs,forward:null,reverse:null,passed:false};
  if(topologyPass&&!missingEdges&&!missingLocks&&idx.length<part.indices.length*.95){r.forward=certifyDirected(part,m,limit);if(r.forward.passed)r.reverse=certifyDirected(m,part,limit);r.passed=!!(r.forward.passed&&r.reverse?.passed);}
  r.elapsedMs=performance.now()-t;row.meshopt.push(r);
  if(r.passed&&(!best||r.gpuBytes<best.r.gpuBytes))best={r,trans};
 }
 if(best){const f=e.id+'.nmo.gz';writeFileSync(join(out,f),best.trans.gzip);row.candidate={file:f,sha256:sha(best.trans.gzip),...best.r};}
 rows.push(row);writeFileSync(join(out,e.id+'.json'),JSON.stringify(row,null,2));writeFileSync(join(out,'matrix.json'),JSON.stringify({schema:'nanite-c-matrix-1',sourceManifestSha256:pin,scope,rows,limitations:['experimental feature lock is geometry proxy, not anatomical landmark review','bound uses conservative floating margin, not interval arithmetic','cell/depth exhaustion rejects','no mixed-resolution render integration']},null,2));console.log(e.id,JSON.stringify(row.meshopt.map(({target,triangles,passed,missingEdges,forward,reverse})=>({target,triangles,passed,missingEdges,forward:forward?.reason,reverse:reverse?.reason}))));
}
