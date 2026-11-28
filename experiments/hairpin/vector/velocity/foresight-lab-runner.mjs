/* Reproducible offline research harness, not a gameplay physics engine.
 * Reads immutable pinned assets, invokes existing fixed-step solver, and audits
 * the actual full vehicle triangles at each synchronized 10 Hz pose.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import '../../../../assets/atlas/marrow-ride.js';
import '../../../../assets/atlas/marrow-surface.js';
import '../../../../assets/atlas/marrow-board.js';
import '../../../../assets/atlas/marrow.js';
import '../../../../assets/atlas/vhf-source.js';
import {seedRoutes} from './osteodynamics-replay.mjs';
import {flowRoute} from './flow-lab.mjs';
import {createIntersectionAudit} from './flow-intersection.mjs';
import {createConfigurationOracle,commonCorrection} from './kinesis-oracle.mjs';
import {initialConfiguration,feasibilityPrefix,classifyRecorded} from './kinesis-path.mjs';
import {foresightRoute,classifyPlacement,supportCheck} from './foresight-planner.mjs';
import {footprint} from './osteodynamics.mjs';
const SHA='e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66',MANIFEST='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7';
const sha=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const dir='assets/atlas/vhf/axis/v1',rawManifest=fs.readFileSync(path.join(dir,'manifest.json')),asset=fs.readFileSync('experiments/hairpin/vector/velocity/generated/VECTOR-005-VELOCITY-20000.glb');
if(sha(rawManifest)!==MANIFEST||sha(asset)!==SHA)throw Error('Pinned asset digest mismatch');
const manifest=JSON.parse(rawManifest);
// Pinned runtime asset has identity node transforms and exactly five nodes.
// Read all actual position/index buffers, not extremal witnesses or proxies.
function vehicle(buffer){
 const bytes=ab(buffer),d=new DataView(bytes),l=d.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+l))),start=28+l;
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(24+l,true)!==0x004e4942)throw Error('GLB contract');
 function access(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],n=a.type==='VEC3'?3:1,read=a.componentType===5126?'getFloat32':a.componentType===5123?'getUint16':a.componentType===5125?'getUint32':'getUint8',w=a.componentType===5123?2:a.componentType===5121?1:4,stride=v.byteStride||n*w,arr=a.componentType===5126?new Float32Array(a.count*n):new Uint32Array(a.count*n);
  for(let q=0;q<a.count;q++)for(let k=0;k<n;k++)arr[q*n+k]=d[read](start+(v.byteOffset||0)+(a.byteOffset||0)+q*stride+k*w,true);return arr;}
 const out=[];for(const node of j.nodes){if(node.matrix||node.translation||node.rotation||node.scale||node.children)throw Error('Unexpected node transform');for(const [k,p] of j.meshes[node.mesh].primitives.entries())out.push({id:node.name+'_'+k,assembly:node.extras.assembly,positions:access(p.attributes.POSITION),indices:access(p.indices)});}
 if(out.length!==5||out.reduce((s,p)=>s+p.indices.length/3,0)!==19986)throw Error('Qualified five-assembly contract');
 return out;
}
const parts=vehicle(asset),B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow,S=globalThis.BodyMarrowSurface;
const names=['VERTEBRA_C1','SCAPULA_LEFT','RIB_1_LEFT','FEMUR_LEFT','SKULL_CRANIAL_MAXILLA'],name=process.env.FORESIGHT_SPECIMEN||names[0],out=process.env.FORESIGHT_OUTPUT||'foresight-results';
if(!names.includes(name))throw Error('Unknown specimen');
fs.mkdirSync(out,{recursive:true});
const report={assetSHA256:SHA,manifestSHA256:MANIFEST,vehicleTriangles:19986,source:name,liveAuthorized:false,limitations:'Independent offline 120 Hz transactional MARROW rollouts, common correction chassis, conditional closed-solid OBB and declared mechanically coupled root/parameter interpolation. No browser/device or whole-scene certification. Ground only; explicit flight requests stop. Candidate failure does not prove geometrical impossibility.',routes:[],refinement:[]};
const save=()=>fs.writeFileSync(path.join(out,'foresight-'+name+'.json'),JSON.stringify(report));
const src=manifest.structures.find(s=>s.source_name===name),raw=fs.readFileSync(path.join(dir,src.file));
if(raw.byteLength!==src.bytes||sha(raw)!==src.sha256)throw Error('Source integrity '+name);
const [part]=globalThis.BodyVHF.parse(ab(raw),{structures:[{...src,tissue:'Bone'}]},true,true);if(part.indices.length/3!==src.triangles)throw Error('Triangle count');
const world=M.collision([part],null,true),seeds=seedRoutes(world,part,parts,B,M.boardMatrix),oracle=createConfigurationOracle(part,parts,B,{maxDepth:8}),audit=createIntersectionAudit(part,parts,B),foot=footprint(parts);
report.sourceSHA=src.sha256;report.triangles=src.triangles;report.topology=oracle.topology;report.vehicleTopology=oracle.vehicleTopology;report.seed=seeds.selected;
if(!seeds.selected)throw Error('No initial seed');
const viable=seeds.seeds.filter(q=>q.supportRatio>=.55&&q.hit?.point),far=viable.filter(q=>Math.hypot(...q.hit.point.map((v,k)=>v-seeds.selected.hit.point[k]))>.005).sort((a,b)=>Math.hypot(...b.hit.point.map((v,k)=>v-seeds.selected.hit.point[k]))-Math.hypot(...a.hit.point.map((v,k)=>v-seeds.selected.hit.point[k])))[0];
const unseen=viable.filter(q=>[seeds.selected,far].filter(Boolean).every(s=>Math.hypot(...q.hit.point.map((v,k)=>v-s.hit.point[k]))>.005)).sort((a,b)=>Math.min(...[seeds.selected,far].filter(Boolean).map(s=>Math.hypot(...b.hit.point.map((v,k)=>v-s.hit.point[k]))))-Math.min(...[seeds.selected,far].filter(Boolean).map(s=>Math.hypot(...a.hit.point.map((v,k)=>v-s.hit.point[k])))))[0];
const primary=name==='VERTEBRA_C1'||name==='SCAPULA_LEFT',adverse=name==='VERTEBRA_C1'?{approach:'parallel',push:.35}:{approach:'diagonal',push:1};
const jobs=[{seed:seeds.selected,seedIndex:0,...adverse,steps:240,schedule:'straight',horizons:primary?[4,8,16,'adaptive','refined']:['adaptive']},{seed:seeds.selected,seedIndex:0,approach:'perpendicular',push:1,steps:240,schedule:'straight',horizons:['adaptive']},{seed:seeds.selected,seedIndex:0,approach:'diagonal',push:.65,steps:360,schedule:'carve',horizons:['adaptive']},{seed:seeds.selected,seedIndex:0,approach:'parallel',push:.35,steps:720,schedule:'flight',horizons:['adaptive']},...([far,unseen].map((seed,i)=>({seed,seedIndex:i+1,approach:'diagonal',push:.35,steps:240,schedule:'straight',horizons:['adaptive']}))).filter(q=>q.seed)];
// Higher-resolution static feasibility reference at actual rejected historical poses.
// All search failures are classified as unresolved, never absolute impassability.
const refinementRoute=flowRoute(world,seeds.selected,parts,B,S,M.boardMatrix,{...adverse,mode:'slipstream',steps:240,sampleEvery:4});
for(const row of refinementRoute.rows.filter(q=>[8,12,96,100,112,132,144,156].includes(q.step))){
 const item={step:row.step,base:classifyPlacement(oracle,world,parts,B,row,row.pose,{foot}),exact:audit.measure(row.pose),candidates:[],historicalNegative:row.negative};
 for(const lift of [0,.001,.002,.004,.006,.008])for(const [pitch,roll] of [[0,0],[.06,0],[-.06,0],[0,.06],[0,-.06],[.12,0],[-.12,0],[0,.12],[0,-.12],[.24,0],[-.24,0],[0,.24],[0,-.24]]){
  const pose=commonCorrection(row.pose,pitch,roll,lift),q=classifyPlacement(oracle,world,parts,B,row,pose,{foot});item.candidates.push({lift,pitch,roll,coarse:q.coarse.clear,fine:q.fine.clear,support:q.support?.ok??null,reason:q.classification});
 }
 item.fineOnly=item.candidates.filter(q=>q.fine&&!q.coarse).length;item.admitted=item.candidates.filter(q=>q.fine&&q.support).length;item.outcome=item.admitted?'local-pose-admission-not-path-proof':item.candidates.some(q=>q.fine)?'conditional-clearance-without-support':'unresolved-in-bounded-search';report.refinement.push(item);save();
}
for(const job of jobs){const {seed,horizons,...cfg}=job,trial={...cfg,seed:seed.hit.point,modes:{},foresight:[]};
 for(const mode of ['legacy','adaptive','slipstream','slipstream-strict']){
  const q=flowRoute(world,seed,parts,B,S,M.boardMatrix,{...cfg,mode,sampleEvery:12});
  const refs=q.rows.filter((row,i)=>i%4===0||row===q.rows.at(-1)).map(row=>({step:row.step,...audit.measure(row.pose),envelope:oracle.pose(row.pose,5)}));
  trial.modes[mode]={summary:q.summary,reference:refs};
 }
 const start=initialConfiguration(world,seed,B,S,M.boardMatrix,cfg.approach),old=flowRoute(world,seed,parts,B,S,M.boardMatrix,{...cfg,mode:'slipstream',sampleEvery:12});
 const prefix=feasibilityPrefix(oracle,world,parts,B,start,old.rows);trial.kinesis={admitted:prefix.acceptedIntervals,total:prefix.totalRecordedIntervals,stop:prefix.stop,rejected:prefix.rejected};
 for(const h of horizons){
  const q=foresightRoute(world,seed,parts,B,S,M.boardMatrix,oracle,{...cfg,horizon:typeof h==='string'?8:h,adaptiveHorizon:typeof h==='string',depth:h==='refined'?8:5,maxSub:h==='refined'?3:2,maxCandidates:h==='refined'?9:7,queryBudget:12000,sampleEvery:12});
  q.reference=q.rows.map(row=>({step:row.step,...audit.measure(row.pose),envelope:oracle.pose(row.pose,8)}));q.observedUnsafe=q.reference.some(x=>x.pairs>0||x.nearCoplanar>0||x.boundaryCandidates>0);
  q.experiment=h;const baseline=trial.modes.slipstream.summary;q.acceptance={liveAuthorized:false,completed:q.committed===cfg.steps,structuralReferenceClear:!q.observedUnsafe,blockRegression:q.summary.blockedSteps>baseline.blockedSteps,progressRatio:baseline.rideDistance>0?q.summary.distance/baseline.rideDistance:null,speedRatio:baseline.meanGroundSpeed>0?(q.summary.meanGroundSpeed||0)/baseline.meanGroundSpeed:null,jerkRatio:baseline.p95ChassisJerk>0&&Number.isFinite(q.summary.p95ChassisJerk)?q.summary.p95ChassisJerk/baseline.p95ChassisJerk:null,groundOnly:cfg.schedule==='flight',reasons:['conditional model not physical certification','actual runtime budget not qualified']};if(q.committed!==cfg.steps)q.acceptance.reasons.push('incomplete schedule');if(q.observedUnsafe)q.acceptance.reasons.push('reference structural rejection');if(q.acceptance.progressRatio!==null&&q.acceptance.progressRatio<.95)q.acceptance.reasons.push('progress below 95% of Continuous');if(q.acceptance.speedRatio!==null&&q.acceptance.speedRatio<.95)q.acceptance.reasons.push('speed below 95% of Continuous');
  trial.foresight.push(q);if(!report.routes.includes(trial))report.routes.push(trial);save();
  console.log('FORESIGHT_ROUTE',JSON.stringify({name,...cfg,horizon:h,committed:q.committed,stop:q.stop,summary:q.summary,cpu:q.cpuMs,unsafe:q.observedUnsafe,queries:q.queries}));
 }
}
report.gate={liveAuthorized:false,routeCount:report.routes.length,experiments:report.routes.reduce((n,q)=>n+q.foresight.length,0),complete:report.routes.flatMap(q=>q.foresight).filter(q=>q.committed===q.steps).length};save();
