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
import {createIntersectionAudit,summarizeIntersections} from './flow-intersection.mjs';
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
const names=['VERTEBRA_C1','SCAPULA_LEFT','FEMUR_LEFT','SKULL_CRANIAL_MAXILLA','RIB_1_LEFT'],modes=['legacy','adaptive','slipstream','slipstream-strict'],out=process.env.SLIPSTREAM_OUTPUT||'slipstream-results';
fs.mkdirSync(out,{recursive:true});
const report={assetSHA256:SHA,manifestSHA256:MANIFEST,vehicleTriangles:19986,limitations:'Single source per replay. Exact mesh transverse crossings only; near-coplanar candidates separate. 10 Hz snapshots, plus selected 30 Hz actual fixed-step pose audits. No swept/containment certification. Continuous chart changes central guide trajectory, so same-input comparisons do not imply identical spatial trajectories. Node CPU is not hardware timing.',labs:[],gate:null};
const save=()=>fs.writeFileSync(path.join(out,'slipstream-labs.json'),JSON.stringify(report));
for(const name of names){
 const src=manifest.structures.find(s=>s.source_name===name);if(!src)throw Error('Manifest source missing '+name);
 const raw=fs.readFileSync(path.join(dir,src.file));if(raw.byteLength!==src.bytes||sha(raw)!==src.sha256)throw Error('Source integrity '+name);
 const [part]=globalThis.BodyVHF.parse(ab(raw),{structures:[{...src,tissue:'Bone'}]},true,true);
 if(part.indices.length/3!==src.triangles)throw Error('Triangle count '+name);
 const world=M.collision([part],null,true),seeds=seedRoutes(world,part,parts,B,M.boardMatrix),primary=name==='VERTEBRA_C1'||name==='SCAPULA_LEFT',audit=primary?createIntersectionAudit(part,parts,B):null,lab={source:name,id:src.id,sha256:src.sha256,triangles:src.triangles,seed:seeds.selected,seeds,routes:[]};
 report.labs.push(lab);save();
 if(!seeds.selected){lab.status='no-qualified-seed';continue;}
 lab.status='sampled';
 const schedules=[];for(const push of [.35,1])for(const approach of ['parallel','diagonal','perpendicular'])schedules.push({approach,push,steps:240,schedule:'straight'});
 schedules.push({approach:'diagonal',push:.65,steps:360,schedule:'carve'},{approach:'parallel',push:.35,steps:720,schedule:'flight'});
 for(const cfg of schedules){
  const trial={...cfg,modes:{}};
  for(const mode of modes){
   const q=flowRoute(world,seeds.selected,parts,B,S,M.boardMatrix,{...cfg,mode,auditContact:true});
   if(audit&&cfg.schedule==='straight'){const rows=q.rows.map(row=>({step:row.step,...audit.measure(row.pose)}));q.intersections={...summarizeIntersections(rows),rows};}
   trial.modes[mode]=q;
   if(q.summary.remounts!==0)throw Error('Unexpected automatic remount '+name+' '+mode);
   if(cfg.schedule!=='flight'&&q.summary.flights!==0)throw Error('Unintended launch '+name+' '+mode);
  }
  lab.routes.push(trial);save();
  console.log('FLOW_ROUTE',JSON.stringify({name,...cfg,modes:Object.fromEntries(modes.map(m=>[m,{summary:trial.modes[m].summary,manifold:trial.modes[m].trajectory.manifold,intersections:trial.modes[m].intersections?Object.fromEntries(Object.entries(trial.modes[m].intersections).filter(([k])=>k!=='rows')):null}]))}));
 }
}
// Higher-frequency audit of the exact fixed-step states on the two
// most relevant original failure routes. Not interpolated/swept certification.
report.highFrequency=[];
for(const [name,push,approach] of [['VERTEBRA_C1',.35,'parallel'],['SCAPULA_LEFT',1,'diagonal']]){
 const lab=report.labs.find(l=>l.source===name),src=manifest.structures.find(s=>s.source_name===name),raw=fs.readFileSync(path.join(dir,src.file));
 if(raw.byteLength!==src.bytes||sha(raw)!==src.sha256)throw Error('Source integrity '+name);
 const [part]=globalThis.BodyVHF.parse(ab(raw),{structures:[{...src,tissue:'Bone'}]},true,true),world=M.collision([part],null,true),audit=createIntersectionAudit(part,parts,B),trial={source:name,push,approach,sampleInterval:4/120,modes:{}};
 for(const mode of ['legacy','adaptive','slipstream']){
  const q=flowRoute(world,lab.seed,parts,B,S,M.boardMatrix,{mode,push,approach,steps:240,sampleEvery:4});
  const rows=q.rows.map(row=>({step:row.step,...audit.measure(row.pose)})),summary=summarizeIntersections(rows);
  trial.modes[mode]={...summary,sampledExposureSeconds:summary.intersectingPoses/30,longestSampleRunSeconds:summary.longestSampleRunSeconds/3,rows};
 }
 report.highFrequency.push(trial);save();
}
function gate(mode){
 const failed=[],results=[];
 for(const lab of report.labs)for(const q of lab.routes){
  const old=q.modes.legacy,newer=q.modes[mode],x=old.summary,y=newer.summary,a=old.intersections,b=newer.intersections,issues=[];
  if(y.blockedSteps>x.blockedSteps)issues.push('blocked steps increased');
  if(y.longestBlockSeconds>x.longestBlockSeconds+1e-8)issues.push('longest block increased');
  if(q.schedule!=='flight'&&y.meanGroundSpeed+1e-8<x.meanGroundSpeed*.95)issues.push('speed retention below 95% of baseline');
  if(q.schedule!=='flight'&&y.rideDistance+1e-8<x.rideDistance*.95)issues.push('guide path distance below 95% of baseline');
  if(y.negativeSamples>x.negativeSamples)issues.push('negative directional gaps increased');
  if(y.p95ChassisJerk>x.p95ChassisJerk+1e-8)issues.push('p95 jerk increased');
  if(y.remounts||y.flights>x.flights)issues.push('unintended flight/remount');
  if(q.schedule==='flight'&&x.ground&&x.landings>0&&(!y.ground||!y.landings))issues.push('capture regression');
  if(a&&b&&(b.totalPairs>a.totalPairs||b.intersectingPoses>a.intersectingPoses||b.maxSegmentLength>a.maxSegmentLength+1e-8))issues.push('structural severity increased');
  if((newer.trajectory.manifold?.transportEnergyError??Infinity)>1e-8)issues.push('transport energy error');
  if(issues.length)failed.push({source:lab.source,approach:q.approach,push:q.push,schedule:q.schedule,issues});
  results.push({source:lab.source,approach:q.approach,push:q.push,schedule:q.schedule,baseline:{blocked:x.blockedSteps,jerk:x.p95ChassisJerk,speed:x.meanGroundSpeed,pairs:a?.totalPairs},candidate:{blocked:y.blockedSteps,jerk:y.p95ChassisJerk,speed:y.meanGroundSpeed,pairs:b?.totalPairs},issues});
 }
 return {qualified:false,failed,results,limitations:'No live authorization: full structural clearance, continuous sweep/containment, and physical device acceptance remain required.'};
}
report.gate={slipstream:gate('slipstream'),'slipstream-strict':gate('slipstream-strict')};save();console.log('SLIPSTREAM_GATE',JSON.stringify(report.gate));
