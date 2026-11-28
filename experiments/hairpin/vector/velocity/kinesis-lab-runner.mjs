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
const names=['VERTEBRA_C1','SCAPULA_LEFT','RIB_1_LEFT','FEMUR_LEFT','SKULL_CRANIAL_MAXILLA'],modes=['legacy','adaptive','slipstream','slipstream-strict'],out=process.env.KINESIS_OUTPUT||'kinesis-results';
fs.mkdirSync(out,{recursive:true});
const report={assetSHA256:SHA,manifestSHA256:MANIFEST,vehicleTriangles:19986,liveAuthorized:false,limitations:'Conditional OBB surface/solid classification assumes closed, non-self-intersecting geometry; edge incidence alone does not prove this. Sweeps bound declared independent assembly interpolation only. KINESIS is an offline prefix on Continuous recorded poses, not a new authoritative ride. No runtime or physical qualification.',labs:[]};
const save=()=>fs.writeFileSync(path.join(out,'kinesis-labs.json'),JSON.stringify(report));
for(const name of names){
 const src=manifest.structures.find(s=>s.source_name===name);if(!src)throw Error('Source absent '+name);
 const raw=fs.readFileSync(path.join(dir,src.file));if(raw.byteLength!==src.bytes||sha(raw)!==src.sha256)throw Error('Source integrity '+name);
 const [part]=globalThis.BodyVHF.parse(ab(raw),{structures:[{...src,tissue:'Bone'}]},true,true);
 if(part.indices.length/3!==src.triangles)throw Error('Triangle count '+name);
 const world=M.collision([part],null,true),seeds=seedRoutes(world,part,parts,B,M.boardMatrix),oracle=createConfigurationOracle(part,parts,B),primary=name==='VERTEBRA_C1'||name==='SCAPULA_LEFT',audit=primary?createIntersectionAudit(part,parts,B):null;
 const lab={source:name,id:src.id,sha256:src.sha256,triangles:src.triangles,topology:oracle.topology,vehicleTopology:oracle.vehicleTopology,spawns:[],routes:[],status:seeds.selected?'sampled':'no-seed'};report.labs.push(lab);save();
 const viable=seeds.seeds.filter(q=>q.supportRatio>=.55&&q.hit?.point),selected=seeds.selected;
 if(!selected)continue;
 const far=viable.filter(q=>Math.hypot(...q.hit.point.map((v,k)=>v-selected.hit.point[k]))>.005).sort((a,b)=>Math.hypot(...b.hit.point.map((v,k)=>v-selected.hit.point[k]))-Math.hypot(...a.hit.point.map((v,k)=>v-selected.hit.point[k])))[0];
 for(const q of viable)for(const approach of ['parallel','diagonal','perpendicular']){const start=initialConfiguration(world,q,B,S,M.boardMatrix,approach);lab.spawns.push({point:q.hit.point,approach,classification:oracle.pose(start.pose)});}
 for(const [seedIndex,seed] of [selected,far].entries()){
  if(!seed)continue;
  const schedules=seedIndex===0?[...([.35,1].flatMap(push=>['parallel','diagonal','perpendicular'].map(approach=>({approach,push,steps:240,schedule:'straight'})))),{approach:'diagonal',push:.65,steps:360,schedule:'carve'},{approach:'parallel',push:.35,steps:720,schedule:'flight'}]:[{approach:'parallel',push:.35,steps:240,schedule:'straight'},{approach:'diagonal',push:1,steps:240,schedule:'straight'},{approach:'perpendicular',push:1,steps:240,schedule:'straight'}];
  for(const cfg of schedules){
   const start=initialConfiguration(world,seed,B,S,M.boardMatrix,cfg.approach),trial={...cfg,seedIndex,seed:seed.hit.point,modes:{},prefix:null};
   const sampleEvery=primary&&seedIndex===0&&cfg.schedule==='straight'&&((name==='VERTEBRA_C1'&&cfg.approach==='parallel'&&cfg.push===.35)||(name==='SCAPULA_LEFT'&&cfg.push===1&&['diagonal','perpendicular'].includes(cfg.approach)))?4:12;
   for(const mode of modes){
    const q=flowRoute(world,seed,parts,B,S,M.boardMatrix,{...cfg,mode,sampleEvery}),classification=classifyRecorded(oracle,start,q.rows);
    const reference=audit?[start,...q.rows.filter(row=>[12,132,144,156,240].includes(row.step))].map(row=>({step:row.step,...audit.measure(row.pose),envelope:oracle.pose(row.pose)})):[];
    trial.modes[mode]={summary:q.summary,manifold:q.trajectory.manifold,classification,reference};
    if(mode==='slipstream'){
     const prefix=feasibilityPrefix(oracle,world,parts,B,start,q.rows);trial.prefix=prefix;
     if(audit)prefix.reference=prefix.accepted.filter(row=>[0,12,132,144,156,240].includes(row.step)||row===prefix.accepted.at(-1)).map(row=>({step:row.step,...audit.measure(row.pose)}));
     // Exact reference failure overrides the conditional envelope result.
     prefix.observedUnsafe=!!prefix.reference?.some(x=>x.pairs>0||x.nearCoplanar>0||x.boundaryCandidates>0);
    }
   }
   lab.routes.push(trial);save();console.log('KINESIS_ROUTE',JSON.stringify({name,seedIndex,...cfg,sampleEvery,baseline:Object.fromEntries(modes.map(mode=>[mode,{clear:trial.modes[mode].classification.clearPoses,sweeps:trial.modes[mode].classification.clearEnvelopes,blocked:trial.modes[mode].summary.blockedSteps,jerk:trial.modes[mode].summary.p95ChassisJerk}])),prefix:{admitted:trial.prefix.acceptedIntervals,total:trial.prefix.totalRecordedIntervals,stop:trial.prefix.stop,unsafe:trial.prefix.observedUnsafe,cpu:trial.prefix.cpuMs}}));
  }
 }
}
report.gate={liveAuthorized:false,reasons:['Offline recorded prefix is not a fixed-step KINESIS trajectory','Conditional interpolation is not actual swept articulation certification','Physical acceptance remains outstanding'],routeCount:report.labs.reduce((s,l)=>s+l.routes.length,0),completedPrefixes:report.labs.flatMap(l=>l.routes).filter(q=>q.prefix?.acceptedIntervals===q.prefix?.totalRecordedIntervals&&!q.prefix?.observedUnsafe).length};save();console.log('KINESIS_GATE',JSON.stringify(report.gate));
