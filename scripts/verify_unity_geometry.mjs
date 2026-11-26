// Independent artifact reader: never regenerate or trust report totals.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import '../assets/atlas/vhf-source.js';
import {validateManifest,decodeBLD,packCompact} from '../assets/atlas/unity-geometry.mjs';
const [sourceDir,derivativeDir,expectedSourceHash,expectedDerivativeHash,output]=process.argv.slice(2);
if(!output||![expectedSourceHash,expectedDerivativeHash].every(s=>/^[a-f0-9]{64}$/.test(s)))throw Error('usage: node scripts/verify_unity_geometry.mjs SOURCE DERIVATIVE SOURCE_SHA DERIVATIVE_SHA OUTPUT_JSON');
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const check=(x,m)=>{if(!x)throw Error(m);};
const sourceRaw=readFileSync(join(sourceDir,'manifest.json')),derivativeRaw=readFileSync(join(derivativeDir,'manifest.json'));
check(sha(sourceRaw)===expectedSourceHash,'source manifest pin mismatch');check(sha(derivativeRaw)===expectedDerivativeHash,'derivative manifest pin mismatch');
const source=JSON.parse(sourceRaw),manifest=JSON.parse(derivativeRaw),qualification=JSON.parse(readFileSync(join(sourceDir,'qualification.json')));
check(qualification.manifestSha256===expectedSourceHash&&qualification.labels===143&&qualification.denverFusion===false,'qualification mismatch');
validateManifest(manifest,source,expectedSourceHash);
const sourceInventory=JSON.parse(readFileSync(join(sourceDir,'source-inventory.json')));
check(sourceInventory.length===143&&new Set(sourceInventory.map(s=>s.source_sha256)).size===143,'inventory mismatch');
const rows=[],files=new Set();
for(const e of manifest.structures){
 const s=source.structures.find(s=>s.id===e.id),original=sourceInventory.find(x=>'bonehub-vhf-'+x.name.toLowerCase()===e.id);
 check(original&&original.source_sha256===s.source_sha256&&original.source_bytes===s.source_bytes,'STL identity '+e.id);
 const raw=readFileSync(join(sourceDir,s.file));
 check(raw.length===s.bytes&&sha(raw)===s.sha256,'exact hash '+e.id);
 const exact=BodyVHF.parse(ab(raw),{structures:[{...s,tissue:'Bone'}]},true,true)[0];
 for(const l of e.levels){
  check(!files.has(l.file),'duplicate derivative filename');files.add(l.file);
  const zipped=readFileSync(join(derivativeDir,l.file));check(zipped.length===l.bytes&&sha(zipped)===l.sha256,'compressed hash '+l.file);
  const unpacked=gunzipSync(zipped,{maxOutputLength:l.decodedBytes});check(unpacked.length===l.decodedBytes&&sha(unpacked)===l.decodedSha256,'decoded hash '+l.file);
  const mesh=decodeBLD(ab(unpacked),l);check(packCompact(mesh).bytes===l.gpuBytes,'packed byte count '+l.file);
  if(l.level==='exact-display'){
   check(mesh.positions.length===exact.positions.length&&mesh.indices.length===exact.indices.length&&mesh.positions.every((v,i)=>Object.is(v,exact.positions[i]))&&mesh.indices.every((v,i)=>v===exact.indices[i]),'exact display differs '+e.id);
  }else{
   const a=l.independentSamples?.sourceToLod,b=l.independentSamples?.lodToSource;
   check([a,b].every(x=>x&&x.samples===518&&Number.isFinite(x.maximum)&&x.maximum>=0&&x.maximum<=l.error+1e-6),'missing or failed surface audit '+l.file);
  }
 }
 const overview=e.levels.find(l=>l.level===e.overviewLevel),exactLevel=e.levels.find(l=>l.level==='exact-display');
 rows.push({id:e.id,sourceTriangles:s.triangles,sourceBytes:s.bytes,overviewTriangles:overview.triangles,overviewBytes:overview.bytes,overviewGpuBytes:overview.gpuBytes,exactGpuBytes:exactLevel.gpuBytes,level:overview.level,upgradeAdditionalBytes:exactLevel.gpuBytes-overview.gpuBytes});
}
check(readdirSync(derivativeDir).filter(s=>s.endsWith('.bld.gz')).every(f=>files.has(f)),'unexpected derivative payload');
const sum=k=>rows.reduce((a,r)=>a+r[k],0),budget=32*1024*1024,headroom=4*1024*1024,overview=sum('overviewGpuBytes');
const result={sourceManifestSha256:expectedSourceHash,derivativeManifestSha256:expectedDerivativeHash,labels:rows.length,verifiedDerivativeFiles:files.size,sourceTriangles:sum('sourceTriangles'),sourceBytes:sum('sourceBytes'),overviewTriangles:sum('overviewTriangles'),triangleReduction:1-sum('overviewTriangles')/sum('sourceTriangles'),overviewTransferBytes:sum('overviewBytes'),manifestTransferBytes:sourceRaw.length+derivativeRaw.length,overviewGpuBytes:overview,exactFallbackLabels:rows.filter(r=>r.level==='exact-display').map(r=>r.id),topGpu:[...rows].sort((a,b)=>b.overviewGpuBytes-a.overviewGpuBytes).slice(0,15),topTransfer:[...rows].sort((a,b)=>b.overviewBytes-a.overviewBytes).slice(0,15),gates:{payload:sum('overviewBytes')<5000000,gpu:overview<=budget,steadyWithHeadroom:overview<=budget-headroom},atomicUpgradeAtFullOverview:rows.filter(r=>r.level!=='exact-display').map(r=>({id:r.id,peakBytes:overview+r.exactGpuBytes,finalBytes:overview+r.upgradeAdditionalBytes,possible:overview+r.exactGpuBytes<=budget&&overview+r.upgradeAdditionalBytes<=budget-headroom})),rows};
writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined,atomicUpgradeAtFullOverview:undefined},null,2));
if(!result.gates.payload||!result.gates.gpu||!result.gates.steadyWithHeadroom)process.exitCode=1;
