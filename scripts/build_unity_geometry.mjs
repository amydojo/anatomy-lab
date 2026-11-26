// Offline whole-skeleton NANITE build. Input is the qualified UNITY artifact, not Denver.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import '../assets/atlas/vhf-source.js';
import {SCHEMA,gpuBytes,packCompact,partitionExact,validateManifest,decodeBLD} from '../assets/atlas/unity-geometry.mjs';
const V=globalThis.BodyVHF,sha=b=>createHash('sha256').update(b).digest('hex');
const [sourceDir,outputDir]=process.argv.slice(2);
if(!sourceDir||!outputDir)throw Error('usage: node scripts/build_unity_geometry.mjs <qualified directory> <new output directory>');
const root=resolve(sourceDir),out=resolve(outputDir),raw=readFileSync(join(root,'manifest.json')),source=JSON.parse(raw),qualification=JSON.parse(readFileSync(join(root,'qualification.json')),);
const contract=JSON.parse(readFileSync(new URL('../docs/UNITY_CONTRACT.json',import.meta.url)));
const sourceManifestSha256=sha(raw);
if(source.schema!=='body-live-unity-source-1'||source.revision!==contract.canonicalSource.revision||source.source!==contract.canonicalSource.repo||source.structures.length!==143||qualification.manifestSha256!==sourceManifestSha256||qualification.labels!==143||qualification.denverFusion!==false)throw Error('Unqualified UNITY inventory');
const inventory=JSON.parse(readFileSync(join(root,'source-inventory.json')));
if(inventory.length!==143||new Set(inventory.map(s=>s.source_sha256)).size!==143)throw Error('Source inventory');
for(const e of source.structures){const s=inventory.find(s=>'bonehub-vhf-'+s.name.toLowerCase()===e.id);if(!s||e.source_sha256!==s.source_sha256||e.source_bytes!==s.source_bytes||e.file!==e.id+'.glb'||!/^bonehub-vhf-[a-z0-9_]+$/.test(e.id))throw Error('Source provenance '+e.id);}
mkdirSync(out);
const p3=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const sub=(a,b)=>a.map((x,k)=>x-b[k]),add=(a,b)=>a.map((x,k)=>x+b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0),d2=(a,b)=>dot(sub(a,b),sub(a,b));
// Independent exact point-to-triangle closest point (Voronoi-region tests).
function distance2(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2a=dot(ac,ap);
 const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 if(dot(cross,cross)<1e-28){const segment=(x,y)=>{const v=sub(y,x),n=dot(v,v),t=n?Math.max(0,Math.min(1,dot(sub(p,x),v)/n)):0;return d2(p,add(x,mul(v,t)));};return Math.min(segment(a,b),segment(b,c),segment(c,a));}
 if(d1<=0&&d2a<=0)return d2(p,a);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return d2(p,b);
 const vc=d1*d4-d3*d2a;if(vc<=0&&d1>=0&&d3<=0)return d2(p,add(a,mul(ab,d1/(d1-d3))));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return d2(p,c);
 const vb=d5*d2a-d1*d6;if(vb<=0&&d2a>=0&&d6<=0)return d2(p,add(a,mul(ac,d2a/(d2a-d6))));
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return d2(p,add(b,mul(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)))));
 const denom=va+vb+vc;if(!denom)return Math.min(d2(p,a),d2(p,b),d2(p,c));
 return d2(p,add(a,add(mul(ab,vb/denom),mul(ac,vc/denom))));
}
function tree(mesh){
 const {positions:p,indices:i}=mesh,n=i.length/3,lo=new Float32Array(n*3),hi=new Float32Array(n*3),center=new Float32Array(n*3);
 for(let f=0;f<n;f++)for(let k=0;k<3;k++){const a=p[i[f*3]*3+k],b=p[i[f*3+1]*3+k],c=p[i[f*3+2]*3+k];lo[f*3+k]=Math.min(a,b,c);hi[f*3+k]=Math.max(a,b,c);center[f*3+k]=(lo[f*3+k]+hi[f*3+k])/2;}
 function node(ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const f of ids)for(let k=0;k<3;k++){min[k]=Math.min(min[k],lo[f*3+k]);max[k]=Math.max(max[k],hi[f*3+k]);}
  if(ids.length<=12)return {min,max,ids};let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;
  ids.sort((a,b)=>center[a*3+axis]-center[b*3+axis]);const mid=ids.length>>1;return {min,max,left:node(ids.slice(0,mid)),right:node(ids.slice(mid))};
 }
 return node(Array.from({length:n},(_,i)=>i));
}
function nearest(mesh,root,point){
 const box=n=>point.reduce((s,v,k)=>s+(v<n.min[k]?(n.min[k]-v)**2:v>n.max[k]?(v-n.max[k])**2:0),0);
 let best=Infinity;const visit=n=>{if(box(n)>best)return;if(n.ids){for(const f of n.ids){const i=mesh.indices,p=mesh.positions;best=Math.min(best,distance2(point,p3(p,i[f*3]),p3(p,i[f*3+1]),p3(p,i[f*3+2])));}return;}
  const first=box(n.left)<=box(n.right)?n.left:n.right,second=first===n.left?n.right:n.left;visit(first);visit(second);};
 visit(root);return Math.sqrt(best);
}
// Deterministic area-weighted triangle surface samples plus extreme vertices.
function samples(mesh,count=256){
 const p=mesh.positions,i=mesh.indices,cdf=new Float64Array(i.length/3);let area=0;
 for(let f=0;f<cdf.length;f++){const a=p3(p,i[f*3]),b=p3(p,i[f*3+1]),c=p3(p,i[f*3+2]),u=sub(b,a),v=sub(c,a);area+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;cdf[f]=area;}
 let seed=0x8c91cafe;const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 const points=[];
 for(let j=0;j<count;j++){const target=(j+rnd())/count*area;let lo=0,hi=cdf.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<target)lo=m+1;else hi=m;}const a=p3(p,i[lo*3]),b=p3(p,i[lo*3+1]),c=p3(p,i[lo*3+2]),u=Math.sqrt(rnd()),v=rnd();points.push(a.map((x,k)=>(1-u)*x+u*(1-v)*b[k]+u*v*c[k]));}
 for(let k=0;k<3;k++)for(const sign of [-1,1]){let best=0;for(let v=1;v<p.length/3;v++)if(sign*p[v*3+k]>sign*p[best*3+k])best=v;points.push(p3(p,best));}
 return points;
}
const summarize=a=>{if(!a.length||a.some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid independent distance measurement');a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))],maximum:a[a.length-1]};};

function encode(p){
 const header=Buffer.alloc(16);header.write('BLD1');header.writeUInt32LE(p.positions.length/3,4);header.writeUInt32LE(p.indices.length,8);header.writeUInt32LE(p.indices.BYTES_PER_ELEMENT,12);
 const bytes=Buffer.alloc(16+p.positions.byteLength+p.indices.byteLength);header.copy(bytes);
 for(let i=0;i<p.positions.length;i++)bytes.writeFloatLE(p.positions[i],16+i*4);
 const start=16+p.positions.byteLength;for(let i=0;i<p.indices.length;i++)p.indices.BYTES_PER_ELEMENT===2?bytes.writeUInt16LE(p.indices[i],start+i*2):bytes.writeUInt32LE(p.indices[i],start+i*4);
 return bytes;
}
const arrayBuffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
function publish(id,level,p,certificate=null,independentSamples=null){
 const raw=encode(p),gzip=gzipSync(raw,{level:9}),file=id+'.'+level+'.bld.gz';
 const rec={level,file,sha256:sha(gzip),decodedSha256:sha(raw),bytes:gzip.length,decodedBytes:raw.length,vertices:p.positions.length/3,triangles:p.indices.length/3,indexWidth:p.indices.BYTES_PER_ELEMENT,gpuBytes:gpuBytes(p.positions.length/3,p.indices.length,p.indices.BYTES_PER_ELEMENT),legacyGpuBytes:p.positions.length/3*28+p.indices.byteLength,error:certificate?.maxSurfaceDistanceUpperBound||0,limit:certificate?.limit||0,certificate,independentSamples};
 const decoded=decodeBLD(arrayBuffer(gunzipSync(gzip)),rec);
 if(decoded.positions.some((v,i)=>!Object.is(v,p.positions[i]))||decoded.indices.some((v,i)=>v!==p.indices[i])||packCompact(decoded).bytes!==rec.gpuBytes)throw Error('Derivative round trip '+id);
 writeFileSync(join(out,file),gzip);return rec;
}
const rows=[],structures=[],started=performance.now();
for(const e of source.structures){
 const begin=performance.now(),bytes=readFileSync(join(root,e.file));
 if(bytes.length!==e.bytes||sha(bytes)!==e.sha256)throw Error('Exact GLB integrity '+e.id);
 const exact=V.parse(arrayBuffer(bytes),{structures:[{...e,tissue:'Bone'}]},true,true)[0],levels=[],rejected=[];
 // A longer collapse sequence can invalidate the final certificate even if a
 // shorter one qualified. Keep both trials; never discard a qualified tier merely
 // because a more aggressive trial failed.
 const trials=[12,4].map(rounds=>({rounds,lods:V.buildLods(exact,rounds)}));let sourceTree;
 for(const level of ['overview','regional']){
  const candidates=trials.flatMap(t=>t.lods.filter(l=>l.lodLevel===level).map(l=>({lod:l,rounds:t.rounds}))).sort((a,b)=>gpuBytes(a.lod.positions.length/3,a.lod.indices.length,a.lod.indices.BYTES_PER_ELEMENT)-gpuBytes(b.lod.positions.length/3,b.lod.indices.length,b.lod.indices.BYTES_PER_ELEMENT));
  for(const t of trials)if(!t.lods.some(l=>l.lodLevel===level))rejected.push({level,rounds:t.rounds,reason:'existing topology/correspondence/reduction gate returned no candidate'});
  for(const {lod,rounds} of candidates){
   sourceTree??=tree(exact);const targetTree=tree(lod);
   const forward=summarize(samples(exact,512).map(p=>nearest(lod,targetTree,p))),reverse=summarize(samples(lod,512).map(p=>nearest(exact,sourceTree,p)));
   const upper=lod.certificate.maxSurfaceDistanceUpperBound;
   if(Math.max(forward.maximum,reverse.maximum)>upper+1e-6){rejected.push({level,rounds,reason:'independent distance exceeds bound',forward,reverse,upper});continue;}
   levels.push({...publish(e.id,level,lod,lod.certificate,{sourceToLod:forward,lodToSource:reverse}),rounds});break;
  }
 }
 // An exact-display fallback is always lossless to transformed float32 source arrays.
 levels.push(publish(e.id,'exact-display',exact));
 const overview=levels.find(l=>l.level==='overview')||levels.find(l=>l.level==='regional')||levels.at(-1);
 let clusterExperiment=null;
 if(e.triangles>100000){
  const clusters=partitionExact(exact),seen=new Set();let sum=0,dup=0;
  for(const c of clusters){sum+=c.indices.length/3;dup+=c.positions.length/3;const map=new Map();for(let j=0;j<c.sourceFaces.length;j++){const f=c.sourceFaces[j];if(seen.has(f))throw Error('duplicate cluster face');seen.add(f);for(let k=0;k<3;k++){const a=exact.indices[f*3+k],b=c.indices[j*3+k];if(map.has(b)&&map.get(b)!==a)throw Error('cluster remap');map.set(b,a);for(let axis=0;axis<3;axis++)if(!Object.is(exact.positions[a*3+axis],c.positions[b*3+axis]))throw Error('cluster seam coordinate');}}}
  if(sum!==e.triangles||seen.size!==e.triangles)throw Error('cluster coverage');
  clusterExperiment={clusters:clusters.length,triangles:sum,vertices:dup,duplicationRatio:dup/exact.positions.length*3,rawBytes:clusters.reduce((n,c)=>n+c.positions.byteLength+c.indices.byteLength+16,0),gzipBytes:clusters.reduce((n,c)=>n+gzipSync(encode(c),{level:9}).length,0),gpuBytes:clusters.reduce((n,c)=>n+gpuBytes(c.positions.length/3,c.indices.length,c.indices.BYTES_PER_ELEMENT),0),status:'exact partition verified; not independently renderable across mixed LOD seams'};
 }
 const record={id:e.id,name:exact.name,region:e.region,sourceHash:e.sha256,min:exact.min,max:exact.max,exact:{file:e.file,sha256:e.sha256,bytes:e.bytes,vertices:e.vertices,triangles:e.triangles},levels,overviewLevel:overview.level};
 structures.push(record);rows.push({id:e.id,sourceTriangles:e.triangles,sourceBytes:e.bytes,overview,rejected,clusterExperiment,buildMs:performance.now()-begin});console.log(e.id,overview.level,e.triangles,'→',overview.triangles,overview.bytes);
}
const manifest={schema:SCHEMA,sourceManifestSha256,sourceRevision:source.revision,coordinateSpace:'RESIDENCY display transform; physical units unconfirmed',sourceLicense:source.license,structures};
validateManifest(manifest,source);
const sum=(fn)=>rows.reduce((n,r)=>n+fn(r),0),overviewBytes=sum(r=>r.overview.bytes),overviewGpuBytes=sum(r=>r.overview.gpuBytes);
const report={sourceManifestSha256,labels:rows.length,sourceTriangles:sum(r=>r.sourceTriangles),sourceGLBBytes:sum(r=>r.sourceBytes),overviewTriangles:sum(r=>r.overview.triangles),overviewBytes,overviewGpuBytes,overviewLegacyGpuBytes:sum(r=>r.overview.legacyGpuBytes),fallbackLabels:rows.filter(r=>r.overview.level==='exact-display').length,buildMs:performance.now()-started,gates:{coverage:rows.length===143,payload:overviewBytes<5000000,gpu:overviewGpuBytes<=32*1024*1024,landmarks:'not validated',device:'not measured',timeToExplore:'not measured'},limitations:['GPU bytes are exact packed-array allocation sizes, not driver measurements','Compressed payload excludes manifest and request overhead','Position quantization not enabled; normals only quantized','Independent samples not exact Hausdorff; correspondence certificate supplies bound','No clinical or physical-unit claim; no independent anatomical landmarks','Exact partition experiments do not authorize mixed-resolution rendering'],rows};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
if(!report.gates.payload||!report.gates.gpu)throw Error('NANITE overview budget gate failed; report preserved');
