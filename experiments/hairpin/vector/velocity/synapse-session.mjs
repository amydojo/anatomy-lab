/* Research-only existing MARROW solver adapter. Expensive cell construction is
 * exposed separately from the cache-only step. No live controller interception. */
import {createSlipstreamManifold} from './slipstream-manifold.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
import {footprint} from './osteodynamics.mjs';
import {commonCorrection} from './kinesis-oracle.mjs';
import {initialConfiguration} from './kinesis-path.mjs';
import {supportCheck} from './foresight-planner.mjs';
import {createSpatialMemory} from './synapse-cells.mjs';
const DT=1/120,dist=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k])),pct=(a,p)=>a.length?a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*p)]:null;
export function createSynapseSession(world,seed,parts,B,S,boardMatrix,oracle,identity,{approach='diagonal',depth=5,maxCells=2048}={}){
 const init=initialConfiguration(world,seed,B,S,boardMatrix,approach),sim=S.create(world,{...seed.hit,forward:init.f},{manifold:createSlipstreamManifold(world,parts),researchCheckpoint:true}),kin=createKinetic(B),foot=footprint(parts),memory=createSpatialMemory(oracle,parts,B,identity,{depth,maxCells}),start=performance.now();
 let state=sim.researchState(),base=kin.update(state,boardMatrix(state),0,{hover:.00035}),pose=null,correction=null,drive=1,attempts=0,committed=0,holds=0,hardStops=0,slow=0,distance=0,lastMiss=null,holdRun=0,longestHold=0,maxSpeed=0,blocked=0;const times=[],fast=[],slowTimes=[],rejections={};
 for(const lift of [0,.001,.002,.003,.004]){const q=commonCorrection(base,0,0,lift);if(supportCheck(world,state,q,foot,B).ok&&memory.build(q)){pose=q;correction=lift;break;}}
 const initMs=performance.now()-start;
 const current=()=>pose?{...state,p:pose.t,n:pose.r.slice(3,6),f:pose.r.slice(6,9),pose,guidePosition:state.p,drive,held:holdRun>0}:null;
 function prepare(){return pose?memory.build(pose):null;}
 function step(input,{offlineOracle=false}={}){
  const t=performance.now();if(!pose)return {committed:false,reason:'no-qualified-spawn'};attempts++;
  if(input.assist||input.ollie||input.flightToggle||input.land)return {committed:false,reason:'flight-outside-ground-domain'};
  const snap=sim.checkpoint(),ks=kin.checkpoint(),old=pose;let usedOracle=false;
  sim.advance(DT,{...input,push:(input.push||0)*drive,brake:Math.max(input.brake||0,1-drive)});const nextState=sim.researchState(),next=commonCorrection(kin.update(nextState,boardMatrix(nextState),DT,{hover:.00035}),0,0,correction),support=supportCheck(world,nextState,next,foot,B);let reason=null,cell=null;
  if(!support.ok)reason='support';else{cell=memory.cover(old,next);if(!cell&&offlineOracle){usedOracle=true;slow++;const c=memory.build(old);if(c&&memory.contains(c,old,next))cell=c;else if(!oracle.articulatedSweep(old,next,{depth,maxSub:2}).clear)reason='sweep-unresolved';}else if(!cell)reason='cell-miss';}
  if(reason){sim.restore(snap);kin.restore(ks);holds++;holdRun++;longestHold=Math.max(longestHold,holdRun);drive=Math.max(0,drive-.08);rejections[reason]=(rejections[reason]||0)+1;lastMiss=reason;
   // Explicit stationary recovery at a previously admitted configuration.
   // This is an emergency discontinuity, not a smooth braking success.
   if(holdRun===8&&Math.hypot(...snap.v)>1e-8){snap.v=[0,0,0];snap.s.v=[0,0,0];sim.restore(snap);state=sim.researchState();hardStops++;}
  }else{pose=next;state=nextState;committed++;holdRun=0;drive=Math.min(1,drive+.02);distance+=dist(old.t,next.t);maxSpeed=Math.max(maxSpeed,Math.hypot(...state.v));blocked+=Number(state.edgeBlocked);lastMiss=null;}
  const ms=performance.now()-t;times.push(ms);(usedOracle?slowTimes:fast).push(ms);return {committed:!reason,reason,usedOracle,cell:cell?.id??null,cpuMs:ms,support,state:current()};
 }
 return {memory,prepare,step,current,ready:!!pose,report:()=>({ready:!!pose,initMs,attempts,committed,holds,hardStops,longestHold,slow,distance,maxSpeed,blocked,lastMiss,rejections,cache:memory.report(),cpu:{p95:pct(times,.95),worst:times.length?Math.max(...times):null,fastP95:pct(fast,.95),slowP95:pct(slowTimes,.95)},liveAuthorized:false})};
}
