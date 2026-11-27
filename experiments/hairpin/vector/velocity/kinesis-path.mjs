/* Offline bounded feasibility-prefix experiment, not a new trajectory solver.
 * The user-selected heading and recorded time schedule never change. A prefix
 * ends at the first rejected configuration; no teleporting or skipping.
 */
import {commonCorrection} from './kinesis-oracle.mjs';
import {footprint,measure} from './osteodynamics.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
const add=(a,b)=>a.map((x,k)=>x+b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=(a,f=[0,0,-1])=>Math.hypot(...a)>1e-10?mul(a,1/Math.hypot(...a)):f.slice();
const choices=[];for(const lift of [0,.001,.002,.004])for(const [pitch,roll] of [[0,0],[.06,0],[-.06,0],[0,.06],[0,-.06],[.12,0],[-.12,0],[0,.12],[0,-.12]])choices.push({pitch,roll,lift});
choices.sort((a,b)=>(a.lift/.004+Math.hypot(a.pitch,a.roll)/.12)-(b.lift/.004+Math.hypot(b.pitch,b.roll)/.12)||a.lift-b.lift||Math.hypot(a.pitch,a.roll)-Math.hypot(b.pitch,b.roll));
export function initialConfiguration(world,seed,B,S,boardMatrix,approach){
 const h=seed.hit,n=unit(h.normal),axis=unit(add(seed.ridge||h.forward,mul(n,-dot(seed.ridge||h.forward,n)))),side=unit(cross(n,axis)),a=approach==='perpendicular'?Math.PI/2:approach==='diagonal'?Math.PI/4:0,forward=unit(add(mul(axis,Math.cos(a)),mul(side,Math.sin(a)))),sim=S.create(world,{...h,forward}),state=sim.visual(),pose=createKinetic(B).update(state,boardMatrix(state),0,{hover:.00035});
 return {...state,step:0,pose};
}
export function feasibilityPrefix(oracle,world,parts,B,start,rows,{maxSub=3,requireSupport=true}={}){
 const foot=footprint(parts),accepted=[],rejected={},queryMs=[],initial=oracle.pose(start.pose),startTime=performance.now();let prev=null,previousCorrection=null,queries=0,sweepCalls=0,stop=null;
 const reason=k=>rejected[k]=(rejected[k]||0)+1;
 for(const row of [start,...rows]){
  if(!row.ground){stop={step:row.step,reason:'flight-not-qualified-by-ground-oracle'};break;}
  const dt=prev?(row.step-prev.step)/120:0;let found=null;
  for(const c of choices){
   if(prev&&(Math.abs(c.lift-previousCorrection.lift)>.02*dt+1e-9||Math.hypot(c.pitch-previousCorrection.pitch,c.roll-previousCorrection.roll)>1.2*dt+1e-9))continue;
   const pose=commonCorrection(row.pose,c.pitch,c.roll,c.lift),check=oracle.pose(pose);queries++;queryMs.push(check.cpuMs);
   if(!check.clear){reason(check.reason);continue;}
   const state={...row,p:pose.t,n:pose.r.slice(3,6),f:pose.r.slice(6,9)},support=measure(world,state,pose,foot,B),supported=support.center.valid&&support.center.gap>=0&&support.center.gap<=.017&&support.supportRatio>=.55&&support.pods.frontPod.support>0&&support.pods.rearPod.support>0;
   if(requireSupport&&!supported){reason('insufficient-magnetic-proximity');continue;}
   let sweep=null;if(prev){sweepCalls++;sweep=oracle.sweep(prev.pose,pose,{maxSub});if(!sweep.clear){reason('sweep-unresolved');continue;}}
   found={step:row.step,correction:c,pose,p:pose.t,n:pose.r.slice(3,6),f:pose.r.slice(6,9),frame:row.frame,v:row.v,id:row.id,ground:row.ground,glide:row.glide,support:{supported,centerGap:support.center.gap??null,ratio:support.supportRatio,minGap:support.minGap,front:support.pods.frontPod.support,rear:support.pods.rearPod.support},sweep};break;
  }
  if(!found){stop={step:row.step,reason:prev?'no-admitted-transition':'no-admitted-start-placement'};break;}
  prev=found;previousCorrection=found.correction;accepted.push(found);
 }
 const q=queryMs.slice().sort((a,b)=>a-b);return {initial,accepted,acceptedIntervals:Math.max(0,accepted.length-1),totalRecordedIntervals:rows.length,stop,queries,sweepCalls,rejected,cpuMs:{total:performance.now()-startTime,poseMedian:q[Math.floor(q.length*.5)]??null,poseP95:q[Math.floor(q.length*.95)]??null},qualified:false,contract:'Offline prefix only. Corrected initial placement is not a certified motion out of an overlapping spawn. Independent assembly interpolation not a real articulated trajectory. No live activation.'};
}
export function classifyRecorded(oracle,start,rows,{maxSub=2}={}){
 const states=[start,...rows],poses=states.map(s=>({step:s.step,...oracle.pose(s.pose)})),intervals=[];
 for(let i=1;i<states.length;i++){
  const a=poses[i-1],b=poses[i],kind=a.clear?(b.clear?'clear-endpoints':'new-envelope-rejection'):(b.clear?'separation-from-rejected':'persistent-envelope-rejection');
  const sweep=a.clear&&b.clear?oracle.sweep(states[i-1].pose,states[i].pose,{maxSub}):null;intervals.push({from:a.step,to:b.step,kind,sweep});
 }
 return {initial:poses[0],poses,intervals,clearPoses:poses.filter(q=>q.clear).length,clearEnvelopes:intervals.filter(q=>q.sweep?.clear).length,unresolvedClearEndpoints:intervals.filter(q=>q.sweep&&!q.sweep.clear).length};
}
