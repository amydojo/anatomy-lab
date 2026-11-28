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

import {createSynapseSession} from './synapse-session.mjs';
const name=process.env.SYNAPSE_SPECIMEN||'SKULL_CRANIAL_MAXILLA',src=manifest.structures.find(s=>s.source_name===name),raw=fs.readFileSync(path.join(dir,src.file));if(sha(raw)!==src.sha256)throw Error('source hash');
const [part]=globalThis.BodyVHF.parse(ab(raw),{structures:[{...src,tissue:'Bone'}]},true,true),world=M.collision([part],null,true),seeds=seedRoutes(world,part,parts,B,M.boardMatrix),t0=performance.now(),oracle=createConfigurationOracle(part,parts,B),initMs=performance.now()-t0,audit=createIntersectionAudit(part,parts,B);
const identity={sourceSHA:src.sha256,vehicleSHA:SHA,coordinateFrame:'VHF-axis-v1 (240-X,Z-1000,Y-235)*.005',solver:'ae84289+SYNAPSE-1',sourceID:src.id},report={identity,initMs,runs:[],liveAuthorized:false};const save=()=>fs.writeFileSync(process.env.SYNAPSE_OUTPUT||'synapse-restricted-results.json',JSON.stringify(report));
const first=seeds.selected,far=seeds.seeds.filter(q=>q.supportRatio>=.55).sort((a,b)=>Math.hypot(...b.hit.point.map((v,k)=>v-first.hit.point[k]))-Math.hypot(...a.hit.point.map((v,k)=>v-first.hit.point[k])))[0];
const prior=JSON.parse(fs.readFileSync(process.env.SYNAPSE_TRAINING||'synapse-restricted-results.json'));if(JSON.stringify(prior.identity)!==JSON.stringify(identity))throw Error('identity mismatch');
for(const [index,seed] of [first,far].entries()){if(!seed)continue;for(const variation of ['horizon-unseen']){const session=createSynapseSession(world,seed,parts,B,S,M.boardMatrix,oracle,identity),begin=performance.now();let prepared=0;for(const c of prior.runs[index].cells)if(session.memory.build(c.pose))prepared++;const prepareMs=performance.now()-begin,run={index,variation,prepared,prepareMs,rows:[],reference:[]};report.runs.push(run);const calls=session.memory.report().oracleCalls;
 for(let i=0;i<1440;i++){const cycle=i%360,phase=cycle%180,forward=cycle<180?-1:1,steer=(phase<45?.48:phase<90?-.52:phase<130?.32:-.25)*(index?-.8:1),push=phase<65?.24:phase<105?.13:phase<130?0:phase<150?.22:0,brake=phase>=150?.8:0;const input={stick:[steer,forward],controlYaw:0,push,brake},old=session.current().pose,q=session.step(input);if(q.committed&&i%60===0){const a=audit.measure(q.state.pose);run.reference.push({step:i+1,pairs:a.pairs,nearCoplanar:a.nearCoplanar,boundary:a.boundaryCandidates,oracle:oracle.articulatedSweep(old,q.state.pose,{maxSub:2}).clear});}if(i%12===0)run.rows.push({wallStep:i+1,...session.current(),input,committed:q.committed,reason:q.reason});}
 run.summary=session.report();run.oracleCallsDuringSteps=run.summary.cache.oracleCalls-calls;save();console.log(JSON.stringify({index,variation,prepared,prepareMs,summary:run.summary,reference:run.reference.length,unsafe:run.reference.filter(q=>q.pairs||q.nearCoplanar||q.boundary||!q.oracle).length,oracleCallsDuringSteps:run.oracleCallsDuringSteps}));}}
