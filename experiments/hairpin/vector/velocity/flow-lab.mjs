import {footprint,measure,createTerrainInterpreter} from './osteodynamics.mjs';
import {createFlowSupport} from './flow-support.mjs';
import {createSlipstreamManifold,createContactAudit} from './slipstream-manifold.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,0,-1])=>len(a)>1e-9?mul(a,1/len(a)):f.slice(),plane=(a,n)=>sub(a,mul(n,dot(a,n))),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function flowRoute(world,seed,parts,B,S,boardMatrix,{mode='legacy',approach='parallel',push=1,steps=240,schedule='straight',auditContact=false,sampleEvery=12}={}){
 const h=seed.hit,n=h.normal,axis=unit(plane(seed.ridge||h.forward,n),h.forward),side=unit(cross(n,axis)),a=approach==='perpendicular'?Math.PI*.5:approach==='diagonal'?Math.PI*.25:0,forward=unit(add(mul(axis,Math.cos(a)),mul(side,Math.sin(a))));
 const support=['compliant','constraint'].includes(mode)?createFlowSupport(world,parts,B,boardMatrix,{model:mode}):null;
 const manifold=['slipstream','slipstream-strict'].includes(mode)?createSlipstreamManifold(world,parts,{variant:mode==='slipstream-strict'?'strict':'continuous'}):null,contactAudit=auditContact&&mode==='legacy'?createContactAudit():null;
 const sim=S.create(world,{...h,forward},{...(support?{support}:{}),...(manifold?{manifold}:{}),...(contactAudit?{contactAudit}:{})}),motion=createKinetic(B),adaptive=mode==='adaptive'?createTerrainInterpreter(world,B,{deterministic:true}):null,foot=footprint(parts),rows=[];
 let lastP=null,lastV=null,lastA=null,lastN=null,lastOmega=null,stepSpeeds=[],jerks=[],longestBlock=0,blockRun=0,maxSpeed=0,maxAcceleration=0,maxJerk=0,maxAngular=0,maxAngularAcceleration=0,maxAnchorEnergyError=0,groundSpeedSum=0,groundSpeedN=0,blocked=0,energySum=0;
 for(let i=0;i<steps;i++){
  const steer=schedule==='carve'?.45*Math.sin(i*Math.PI/60):0,input={stick:[steer,-1],controlYaw:0,push};
  if(schedule==='flight'){if(i>=120&&i<160){input.assist=true;input.push=0;input.stick=[0,0];}else if(i>=160){input.land=true;input.push=0;input.stick=[0,0];}}
  sim.advance(1/120,input);const state=sim.visual(),base=boardMatrix(state),q=motion.update(state,base,1/120,{hover:.00035}),pose=adaptive?adaptive.update(state,q,parts,1/120,true,true):q;
  const speed=len(state.v);if(state.ground){groundSpeedSum+=speed;groundSpeedN++;}blocked+=Number(state.edgeBlocked);blockRun=state.edgeBlocked?blockRun+1:0;longestBlock=Math.max(longestBlock,blockRun);stepSpeeds.push(speed);energySum+=.5*speed*speed/120;
  if(lastP){const velocity=mul(sub(state.p,lastP),120);maxSpeed=Math.max(maxSpeed,len(velocity));if(lastV){const acceleration=mul(sub(velocity,lastV),120);maxAcceleration=Math.max(maxAcceleration,len(acceleration));if(lastA){const jerk=len(sub(acceleration,lastA))*120;maxJerk=Math.max(maxJerk,jerk);jerks.push(jerk);}lastA=acceleration;}lastV=velocity;}
  if(lastN){const omega=Math.acos(clamp(dot(unit(lastN),unit(state.n)),-1,1))*120;maxAngular=Math.max(maxAngular,omega);if(lastOmega!==null)maxAngularAcceleration=Math.max(maxAngularAcceleration,Math.abs(omega-lastOmega)*120);lastOmega=omega;}
  lastP=state.p.slice();lastN=state.n.slice();
  if((i+1)%sampleEvery===0||i===steps-1){const m=measure(world,state,pose,foot,B);rows.push({step:state.steps,p:state.p,n:state.n,contactNormal:state.contactNormal,f:state.f,frame:state.frame,v:state.v,id:state.id,ground:state.ground,glide:state.glide,pose,gap:m.minGap,negative:m.negativeSamples,support:m.supportRatio,normalDeviation:m.normalDeviation,supportState:support?.report()||null});}
 }
 const trajectory=sim.report(),valid=rows.filter(q=>q.gap!==null),pct=(a,k)=>a.length?a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*k))]:null;
 return {mode,approach,push,schedule,steps,summary:{negativeSamples:rows.reduce((s,q)=>s+q.negative,0),minimumGap:valid.length?Math.min(...valid.map(q=>q.gap)):null,meanGroundSpeed:groundSpeedN?groundSpeedSum/groundSpeedN:0,blockedSteps:blocked,longestBlockSeconds:longestBlock/120,p95ChassisJerk:pct(jerks,.95),medianSpeed:pct(stepSpeeds,.5),energyIntegral:energySum,maxChassisSpeed:maxSpeed,maxChassisAcceleration:maxAcceleration,maxChassisJerk:maxJerk,maxAngular,maxAngularAcceleration,rideDistance:trajectory.rideDistance,contactLosses:trajectory.contactLosses,flights:trajectory.glideEntries,landings:trajectory.landings,remounts:trajectory.remounts,ground:trajectory.ground},trajectory,rows};
}
