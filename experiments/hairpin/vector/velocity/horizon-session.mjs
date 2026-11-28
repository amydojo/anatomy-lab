import {B,M,S} from './horizon-assets.mjs';
import {createSlipstreamManifold} from './slipstream-manifold.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
import {footprint} from './osteodynamics.mjs';
import {commonCorrection} from './kinesis-oracle.mjs';
import {initialConfiguration} from './kinesis-path.mjs';
import {supportCheck} from './foresight-planner.mjs';
const DT=1/120,wait=ms=>new Promise(r=>setTimeout(r,ms)),dist=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k])),stat=a=>{const x=a.slice().sort((a,b)=>a-b);return {n:x.length,p95:x[Math.floor((x.length-1)*.95)]??null,p99:x[Math.floor((x.length-1)*.99)]??null,worst:x.at(-1)??null};};
export async function createHorizonSession(client,seed,{approach='diagonal',stride=4}={}){
 const {part,parts}=client,world=M.collision([part],null,true),init=initialConfiguration(world,seed,B,S,M.boardMatrix,approach),sim=S.create(world,{...seed.hit,forward:init.f},{manifold:createSlipstreamManifold(world,parts),researchCheckpoint:true}),kin=createKinetic(B),foot=footprint(parts),base=kin.update(sim.researchState(),M.boardMatrix(sim.researchState()),0,{hover:.00035});
 let state=sim.researchState(),pose=null,lift=0,drive=1,attempts=0,committed=0,holds=0,holdRun=0,longestHold=0,emergency=0,recoveries=0,braked=0,distance=0,guideBlocked=0,misses=0,proposal=null;const timing={step:[],checkpoint:[],proposal:[],support:[],lookup:[],restore:[],prepare:[]},rejections={};const start=performance.now();
 for(const l of [0,.001,.002,.003,.004]){const p=commonCorrection(base,0,0,l);if(!supportCheck(world,state,p,foot,B).ok)continue;client.request(p,null,[0,0,0],[0,-1]);while(client.busy())await wait(5);if(client.point(p)){pose=p;lift=l;break;}}
 const spawnMs=performance.now()-start;const current=()=>pose?{...state,p:pose.t,n:pose.r.slice(3,6),f:pose.r.slice(6,9),pose,guidePosition:state.p,held:holdRun>0,drive}:null;
 function step(input){const t=performance.now();if(!pose)return {committed:false,reason:'no-qualified-spawn'};if(input.assist||input.ollie||input.flightToggle||input.land)return {committed:false,reason:'flight-outside-ground-domain'};attempts++;const old=pose;let tic=performance.now(),snap=sim.checkpoint(),ks=kin.checkpoint();timing.checkpoint.push(performance.now()-tic);
 function restore(){const s=performance.now();sim.restore(snap);kin.restore(ks);timing.restore.push(performance.now()-s);}
 function trial(brake,scale){let a=performance.now();sim.advance(DT,{...input,push:(input.push||0)*scale,brake:Math.max(input.brake||0,brake)});const q=sim.researchState(),p=commonCorrection(kin.update(q,M.boardMatrix(q),DT,{hover:.00035}),0,0,lift);timing.proposal.push(performance.now()-a);a=performance.now();const support=supportCheck(world,q,p,foot,B);timing.support.push(performance.now()-a);if(!support.ok)return {reason:'support',q,p};a=performance.now();const cell=client.cover(old,p);timing.lookup.push(performance.now()-a);return {reason:cell?null:'coverage',q,p,cell};}
 // Clearance margin is a heuristic, not a directional braking certificate.
 tic=performance.now();const cell=client.point(old),speed=Math.hypot(...state.v),slack=cell?client.remaining(cell,old):0,braking=speed*speed/1.4+speed*.04;timing.lookup.push(performance.now()-tic);
 if(slack<braking+.0005&&speed>.025)drive=Math.max(.2,drive-.06);else drive=Math.min(1,drive+.03);
 let q=trial(1-drive,drive);proposal=q.reason==='coverage'?q.p:null;if(q.reason==='coverage'){misses++;restore();const slow=trial(1,0);if(!slow.reason){q=slow;braked++;}}
 if(q.reason){restore();holds++;holdRun++;longestHold=Math.max(longestHold,holdRun);drive=Math.max(0,drive-.08);rejections[q.reason]=(rejections[q.reason]||0)+1;if(holdRun===8&&Math.hypot(...snap.v)>1e-8){snap.v=[0,0,0];snap.s.v=[0,0,0];sim.restore(snap);state=sim.researchState();emergency++;}}
 else{if(holdRun)recoveries++;holdRun=0;pose=q.p;state=q.q;committed++;distance+=dist(old.t,pose.t);guideBlocked+=Number(state.edgeBlocked);}
 tic=performance.now();if(!client.busy()&&(proposal||attempts%stride===0)){
  // Current-command lookahead only; never inspect future evaluation input.
  let look=proposal;if(!look){const x=sim.checkpoint(),k=kin.checkpoint();for(let j=0;j<4;j++){sim.advance(DT,{...input,push:(input.push||0)*drive,brake:Math.max(input.brake||0,1-drive)});const z=sim.researchState();look=commonCorrection(kin.update(z,M.boardMatrix(z),DT,{hover:.00035}),0,0,lift);}sim.restore(x);kin.restore(k);}
  client.request(pose,look,state.v,input.stick||[0,-1],!!proposal);}timing.prepare.push(performance.now()-tic);timing.step.push(performance.now()-t);return {committed:!q.reason,reason:q.reason,state:current(),previous:old,coverageMiss:!!proposal};
 }
 return {ready:!!pose,current,step,report:()=>({spawnMs,attempts,committed,holds,longestHold,emergency,recoveries,braked,misses,distance,guideBlocked,rejections,cpu:Object.fromEntries(Object.entries(timing).map(([k,v])=>[k,stat(v)])),liveAuthorized:false})};
}
