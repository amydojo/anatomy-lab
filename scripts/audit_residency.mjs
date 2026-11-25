// Offline full-inventory validation; no network or third-party dependencies.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import '../assets/atlas/vhf-source.js';
const V=globalThis.BodyVHF,root=new URL('../assets/atlas/vhf/axis/v1/',import.meta.url);
const rawManifest=readFileSync(new URL('manifest.json',root));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceManifestHash='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7';
if(sha(rawManifest)!==sourceManifestHash)throw Error('Pinned source manifest mismatch');
const manifest=JSON.parse(rawManifest),entries=V.axisWorldLayout(manifest).entries;
const out='test-results/residency-lod';mkdirSync(out,{recursive:true});
const p3=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const sub=(a,b)=>a.map((x,k)=>x-b[k]),add=(a,b)=>a.map((x,k)=>x+b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0),d2=(a,b)=>dot(sub(a,b),sub(a,b));
// Independent exact point-to-triangle closest point (Voronoi-region tests).
function distance2(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2a=dot(ac,ap);
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
const summarize=a=>{a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))],maximum:a[a.length-1]};};
const estimatedGpu=p=>p.positions.length/3*28+p.indices.byteLength;
const rows=[],derived=[];let fullTriangles=0,overviewTriangles=0,fullGpu=0,overviewGpu=0;
for(const e of entries){
 const bytes=readFileSync(new URL(e.file,root));if(bytes.length!==e.bytes||sha(bytes)!==e.sha256)throw Error('Source integrity failure '+e.id);
 const exact=V.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{structures:[{...e,tissue:'Bone'}]},true,true)[0];
 const levels=V.buildLods(exact),row={id:e.id,sourceHash:e.sha256,sourceTriangles:exact.indices.length/3,sourceGpuEstimate:estimatedGpu(exact),levels:[]};let sourceTree;
 for(const lod of levels){
  sourceTree??=tree(exact);const targetTree=tree(lod);
  const forward=summarize(samples(exact).map(p=>nearest(lod,targetTree,p))),reverse=summarize(samples(lod).map(p=>nearest(exact,sourceTree,p)));
  const upper=lod.certificate.maxSurfaceDistanceUpperBound,tolerance=1e-6;
  if(Math.max(forward.maximum,reverse.maximum)>upper+tolerance)throw Error('Independent surface-distance check failed: '+e.id+' '+lod.lodLevel);
  const header=Buffer.alloc(16);header.write('BLD1');header.writeUInt32LE(lod.positions.length/3,4);header.writeUInt32LE(lod.indices.length,8);header.writeUInt32LE(lod.indices.BYTES_PER_ELEMENT,12);
  const payload=Buffer.concat([header,Buffer.from(lod.positions.buffer,lod.positions.byteOffset,lod.positions.byteLength),Buffer.from(lod.indices.buffer,lod.indices.byteOffset,lod.indices.byteLength)]);
  const file=e.id+'.'+lod.lodLevel+'.bin';writeFileSync(join(out,file),payload);
  const rec={id:e.id,sourceHash:e.sha256,level:lod.lodLevel,file,sha256:sha(payload),bytes:payload.length,triangles:lod.indices.length/3,vertices:lod.positions.length/3,estimatedGpuBytes:estimatedGpu(lod),certificate:lod.certificate,independentSamples:{sourceToLod:forward,lodToSource:reverse}};
  derived.push(rec);row.levels.push(rec);
 }
 const overview=levels.find(p=>p.lodLevel==='overview')||levels.find(p=>p.lodLevel==='regional')||exact;
 row.overviewTriangles=overview.indices.length/3;row.overviewGpuEstimate=estimatedGpu(overview);row.overviewLevel=overview.lodLevel||'exact';row.browserDerivationAllowed=exact.indices.length/3<=250000;
 fullTriangles+=row.sourceTriangles;overviewTriangles+=row.overviewTriangles;fullGpu+=row.sourceGpuEstimate;overviewGpu+=row.overviewGpuEstimate;rows.push(row);console.log(e.id,row.overviewLevel,row.sourceTriangles,'→',row.overviewTriangles);
}
const report={schema:'body-live-residency-audit-1',sourceManifestHash,structures:rows.length,derivedStructures:rows.filter(r=>r.levels.length).length,fullTriangles,overviewTriangles,triangleReduction:1-overviewTriangles/fullTriangles,fullGpuEstimateBytes:fullGpu,overviewGpuEstimateBytes:overviewGpu,targetGpuBytes:32*1024*1024,withinTarget:overviewGpu<=32*1024*1024,rows,limitations:['Provisional display-coordinate limits, not physical mm or clinical validation','Sampled independent distances are not an exact Hausdorff measurement; correspondence certificate supplies the bound','Topology invariants do not prove full topological equivalence or landmark fidelity','GPU bytes estimate packed buffers only']};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
writeFileSync(join(out,'manifest.json'),JSON.stringify({schema:'body-live-residency-lod-1',sourceManifestHash,entries:derived},null,2));
console.log(JSON.stringify({...report,rows:undefined},null,2));
if(rows.length!==59||!derived.length||overviewTriangles>=fullTriangles)throw Error('No meaningful validated overview candidate');
// Budget is a separate release gate, not a reason to falsify coverage or omit exact fallbacks.
if(!report.withinTarget)throw Error('Overview GPU estimate exceeds 32 MiB target; inspect audit artifact');
