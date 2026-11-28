/* FORESIGHT offline receding-horizon experiment. Existing MARROW 120Hz solver
 * is the rollout engine; transactional state is restored after every rejected
 * trial. The committed guide, mechanical history and chassis are independent
 * of all historical trajectories. No live mode or controller interception.
 */
import {createSlipstreamManifold} from './slipstream-manifold.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
import {footprint,measure} from './osteodynamics.mjs';
import {commonCorrection} from './kinesis-oracle.mjs';
import {initialConfiguration} from './kinesis-path.mjs';
const DT=1/120,add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,0,-1])=>len(a)>1e-10?mul(a,1/len(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),plane=(a,n)=>sub(a,mul(n,dot(a,n))),toward=(a,b,step)=>a+clamp(b-a,-step,step);
const pct=(a,k)=>a.length?a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*k))]:null;
const correction=(pitch=0,roll=0,lift=0)=>({pitch,roll,lift});
const ZERO=correction(),liftRate=.02,angleRate=1.2;
function slew(a,b){const delta=[b.pitch-a.pitch,b.roll-a.roll],m=Math.hypot(...delta),k=m>angleRate*DT?angleRate*DT/m:1;return correction(a.pitch+delta[0]*k,a.roll+delta[1]*k,toward(a.lift,b.lift,liftRate*DT));}
export function supportCheck(world,state,pose,foot,B){const m=measure(world,{...state,p:pose.t,n:pose.r.slice(3,6),f:pose.r.slice(6,9)},pose,foot,B);return {ok:m.center.valid&&m.center.gap>=0&&m.center.gap<=.017&&m.supportRatio>=.55&&m.pods.frontPod.support>0&&m.pods.rearPod.support>0&&m.negativeSamples===0,ratio:m.supportRatio,centerGap:m.center.gap??null,minGap:m.minGap,negative:m.negativeSamples,front:m.pods.frontPod.support,rear:m.pods.rearPod.support,curvature:m.curvatureConfidence>=.6?m.principalCurvature:null,confidence:m.curvatureConfidence};}
export function classifyPlacement(oracle,world,parts,B,state,pose,{refine=true,foot:cachedFoot=null}={}){
 const foot=cachedFoot||footprint(parts),coarse=oracle.pose(pose,5),fine=coarse.clear||!refine?coarse:oracle.pose(pose,oracle.maxDepth);
 const support=fine.clear?supportCheck(world,state,pose,foot,B):null;
 return {coarse,fine,support,classification:!fine.clear?fine.reason:support?.ok?'conditional-admission':'insufficient-magnetic-proximity'};
}
export function foresightRoute(world,seed,parts,B,S,boardMatrix,oracle,{approach='parallel',push=.35,steps=240,schedule='straight',horizon=8,adaptiveHorizon=false,depth=5,maxSub=2,queryBudget=18000,maxCandidates=7,sampleEvery=12,replanStride=4}={}){
 if(![4,8,16].includes(horizon)||![1,2,4].includes(replanStride)||maxCandidates<1||maxCandidates>9)throw Error('Unsupported bounded research configuration');
 const init=initialConfiguration(world,seed,B,S,boardMatrix,approach),manifold=createSlipstreamManifold(world,parts),sim=S.create(world,{...seed.hit,forward:init.f},{manifold,researchCheckpoint:true}),kinetic=createKinetic(B),foot=footprint(parts),startState=sim.researchState(),startPose=kinetic.update(startState,boardMatrix(startState),0,{hover:.00035});
 const span=Math.max(...parts.map(p=>{let lo=Infinity,hi=-Infinity;for(let i=2;i<p.positions.length;i+=3){lo=Math.min(lo,p.positions[i]);hi=Math.max(hi,p.positions[i]);}return hi-lo;})),allZ=parts.flatMap(p=>{let a=Infinity,b=-Infinity;for(let i=2;i<p.positions.length;i+=3){a=Math.min(a,p.positions[i]);b=Math.max(b,p.positions[i]);}return [a,b];}),vehicleLength=Math.max(...allZ)-Math.min(...allZ);
 const counts={},rows=[],stepsCpu=[],queryCpu=[],searchCpu=[],queries={pose:0,sweep:0,support:0},horizons={},actions={},start=performance.now();let stop=null,committed=0,blocked=0,run=0,longestBlock=0,progress=0,energy=0,maxIntentDeviation=0,dirDeviation=0,jerks=[],angularAcceleration=[],speeds=[],lastVel=null,lastAcc=null,lastOmega=null,lastPose=null,plan=null,inputKey=null,initial=null,budgetExhausted=false,forecastDistances=[],emergencyPlans=0,maxLift=0,maxTilt=0;
 const bump=(o,k)=>o[k]=(o[k]||0)+1;
 const budget=()=>!budgetExhausted&&queries.pose+queries.sweep+queries.support<queryBudget;
 const check=(state,pose,prev)=>{if(!budget()||queries.pose+queries.sweep+queries.support+(prev?3:2)>queryBudget){budgetExhausted=true;return {ok:false,reason:'deterministic-query-budget'};}
  const q=oracle.pose(pose,depth);queries.pose++;queryCpu.push(q.cpuMs);if(!q.clear)return {ok:false,reason:q.reason};
  const m=supportCheck(world,state,pose,foot,B);queries.support++;if(!m.ok)return {ok:false,reason:'insufficient-magnetic-proximity',support:m};
  if(prev){const sw=oracle.articulatedSweep(prev,pose,{depth,maxSub});queries.sweep++;queryCpu.push(sw.cpuMs);if(!sw.clear)return {ok:false,reason:sw.reason,support:m,sweep:sw};return {ok:true,support:m,sweep:sw};}
  return {ok:true,support:m};
 };
 const initialChoices=[ZERO,...[.001,.002,.004].map(x=>correction(0,0,x)),...[.06,-.06,.12,-.12].flatMap(a=>[correction(a,0,0),correction(0,a,0),correction(a,0,.002),correction(0,a,.002)])];
 for(const c of initialChoices){const pose=commonCorrection(startPose,c.pitch,c.roll,c.lift),q=check(startState,pose,null);if(q.ok){initial={state:startState,pose,correction:c,support:q.support,step:0};break;}bump(counts,'spawn:'+q.reason);}
 if(!initial)return {mode:'foresight',approach,push,schedule,horizon,steps,committed,stop:{step:0,reason:budgetExhausted?'deterministic-query-budget':'no-admitted-start'},queries,rejections:counts,rows,liveAuthorized:false,summary:{distance:0,blockedSteps:0}};
 let cur={...initial,sim:sim.checkpoint(),kin:kinetic.checkpoint(),action:{speedScale:1,brake:0,target:initial.correction}};lastPose=cur.pose;
 const toRow=q=>({...q.state,step:q.step,p:q.pose.t,n:q.pose.r.slice(3,6),f:q.pose.r.slice(6,9),pose:q.pose,guidePosition:q.state.p,correction:q.correction,support:q.support,action:q.action});
 rows.push(toRow(cur));
 function rider(i){const steer=schedule==='carve'?.45*Math.sin(i*Math.PI/60):schedule==='reverse'&&i>=Math.floor(steps/2)?-.8:0;return {stick:[steer,-1],controlYaw:0,push:schedule==='coast'&&i>=steps/2?0:push};}
 function options(q){const c=q.correction,base=[{speedScale:1,brake:0,target:c},{speedScale:1,brake:0,target:correction(c.pitch,c.roll,.004)},{speedScale:1,brake:0,target:correction(.12,0,c.lift)},{speedScale:1,brake:0,target:correction(-.12,0,c.lift)},{speedScale:1,brake:0,target:correction(0,.12,c.lift)},{speedScale:1,brake:0,target:correction(0,-.12,c.lift)},{speedScale:.35,brake:.25,target:c},{speedScale:0,brake:.75,target:c},{speedScale:1,brake:0,target:ZERO}];
  // Include braking in every reduced budget. No candidate alters steering.
  if(maxCandidates<9){if(maxCandidates===7)return [...base.slice(0,6),base[7]];return [...base.slice(0,Math.max(1,maxCandidates-2)),...base.slice(6,8)].slice(0,maxCandidates);}
  return base;
 }
 function rollout(q,policy,H,input){
  sim.restore(q.sim);kinetic.restore(q.kin);let prev=q,score=0,advance=0,lowSupport=1,path=[],failure=null,priorVelocity=q.chassisVelocity||[0,0,0],priorAcceleration=q.chassisAcceleration||[0,0,0];
  for(let j=0;j<H;j++){
   const speedScale=toward(prev.action.speedScale,policy.speedScale,5*DT),brake=toward(prev.action.brake,policy.brake,5*DT),c=slew(prev.correction,policy.target);
   // Reuse the current actual rider command throughout prediction, never future
   // scripted input. A changed command invalidates the remaining plan.
   sim.advance(DT,{...input,push:input.push*speedScale,brake});const state=sim.researchState(),base=kinetic.update(state,boardMatrix(state),DT,{hover:.00035}),pose=commonCorrection(base,c.pitch,c.roll,c.lift);
   const qcheck=check(state,pose,prev.pose);if(!qcheck.ok){failure=qcheck.reason;bump(counts,'trial:'+failure);break;}
   const desired=unit(add(mul(prev.state.frame,-input.stick[1]),mul(unit(cross(prev.state.frame,prev.state.n)),input.stick[0])),prev.state.f),delta=sub(state.p,prev.state.p),tangential=plane(delta,prev.state.n),along=dot(tangential,desired);
   // Do not reward a lift or tangential detour as useful progress.
   if(len(tangential)>1e-7&&along< -1e-8){failure='backward-intent';bump(counts,'trial:'+failure);break;}
   advance+=Math.max(0,along);lowSupport=Math.min(lowSupport,qcheck.support.ratio);
   const chassisVelocity=mul(sub(pose.t,prev.pose.t),120),chassisAcceleration=mul(sub(chassisVelocity,priorVelocity),120),jerk=len(sub(chassisAcceleration,priorAcceleration))*120;priorVelocity=chassisVelocity;priorAcceleration=chassisAcceleration;
   score+=along-.08*len(sub(tangential,mul(desired,along)))-.03*Math.abs(c.lift-prev.correction.lift)-.00001*brake-Math.min(.00003,jerk*1e-9)-.000003*(1-qcheck.support.ratio);
   const next={step:prev.step+1,state,pose,correction:c,support:qcheck.support,sweep:qcheck.sweep,sim:sim.checkpoint(),kin:kinetic.checkpoint(),action:{...policy,speedScale,brake},chassisVelocity,chassisAcceleration,along,intentDeviation:len(tangential)>1e-7?Math.acos(clamp(dot(unit(tangential),desired),-1,1)):0};
   path.push(next);prev=next;
  }
  return {path,score,advance,lowSupport,failure,complete:path.length===H};
 }
 for(let i=0;i<steps;i++){
  const tic=performance.now(),input=rider(i),key=JSON.stringify(input);
  if(schedule==='flight'&&i===120){stop={step:i,reason:'explicit-flight-request-outside-ground-oracle'};break;}
  if(!plan||!plan.length||key!==inputKey||i%replanStride===0){
   const t=performance.now(),speed=len(cur.state.v),braking=speed*speed/(2*.7),curvature=cur.support.curvature?Math.max(...cur.support.curvature.map(Math.abs)):0;
   const H=adaptiveHorizon?(cur.support.ratio<.73||curvature*vehicleLength>.3||braking>vehicleLength*.12?16:speed>.08?8:4):horizon;
   bump(horizons,H);let best=null;
   for(const policy of options(cur)){if(!budget())break;const trial=rollout(cur,policy,H,input);if(trial.complete&&(!best||trial.score>best.score+1e-12))best=trial;}
   sim.restore(cur.sim);kinetic.restore(cur.kin);
   searchCpu.push(performance.now()-t);inputKey=key;
   if(!best&&budget()&&len(cur.state.v)>.004){const slow=rollout(cur,{speedScale:0,brake:1,target:cur.correction},1,input);sim.restore(cur.sim);kinetic.restore(cur.kin);if(slow.complete&&len(slow.path[0].state.v)<len(cur.state.v)){best=slow;emergencyPlans++;}}
   if(!best){stop={step:i,reason:budget()?'no-qualified-horizon':'deterministic-query-budget'};break;}
   forecastDistances.push(best.advance);plan=best.path;
  }
  const next=plan.shift();sim.restore(next.sim);kinetic.restore(next.kin);
  const velocity=mul(sub(next.pose.t,cur.pose.t),120);if(lastVel){const acceleration=mul(sub(velocity,lastVel),120);if(lastAcc)jerks.push(len(sub(acceleration,lastAcc))*120);lastAcc=acceleration;}lastVel=velocity;
  const theta=Math.acos(clamp(([0,3,6].reduce((n,k)=>n+dot(lastPose.r.slice(k,k+3),next.pose.r.slice(k,k+3)),0)-1)/2,-1,1)),omega=theta*120;if(lastOmega!==null)angularAcceleration.push(Math.abs(omega-lastOmega)*120);lastOmega=omega;lastPose=next.pose;
  progress+=next.along;dirDeviation+=next.intentDeviation;maxIntentDeviation=Math.max(maxIntentDeviation,next.intentDeviation);const speed=len(next.state.v);speeds.push(speed);energy+=.5*speed*speed*DT;
  blocked+=Number(next.state.edgeBlocked);run=next.state.edgeBlocked?run+1:0;longestBlock=Math.max(run,longestBlock);bump(actions,next.action.brake>.001?'braking':next.action.speedScale<.999?'reduced-drive':'full-drive');
  committed++;cur=next;maxLift=Math.max(maxLift,cur.correction.lift);maxTilt=Math.max(maxTilt,Math.hypot(cur.correction.pitch,cur.correction.roll));stepsCpu.push(performance.now()-tic);if(committed%sampleEvery===0||committed===steps)rows.push(toRow(cur));
 }
 if(rows.at(-1).step!==cur.step)rows.push(toRow(cur));
 return {mode:'foresight',approach,push,schedule,horizon,adaptiveHorizon,steps,committed,stop,initial:{pose:initial.pose,correction:initial.correction,support:initial.support},vehicleLength,span,horizons,actions,emergencyPlans,maxLift,maxTilt,forecastAdvance:{mean:forecastDistances.length?forecastDistances.reduce((a,b)=>a+b,0)/forecastDistances.length:0,max:forecastDistances.length?Math.max(...forecastDistances):0},queries,rejections:counts,rows,liveAuthorized:false,summary:{distance:sim.s.rideDistance,chassisDistance:rows.slice(1).reduce((n,q,i)=>n+len(sub(q.p,rows[i].p)),0),intentProgress:progress,meanGroundSpeed:speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0,medianSpeed:pct(speeds,.5),blockedSteps:blocked,longestBlockSeconds:longestBlock*DT,contactLosses:sim.s.contactLosses,p95ChassisJerk:pct(jerks,.95),maxJerk:jerks.length?Math.max(...jerks):null,p95AngularAcceleration:pct(angularAcceleration,.95),maxIntentDeviation,meanIntentDeviation:committed?dirDeviation/committed:0,energyIntegral:energy,uncommittedSteps:steps-committed},cpuMs:{total:performance.now()-start,perCommittedStepP95:pct(stepsCpu,.95),searchP95:pct(searchCpu,.95),searchWorst:searchCpu.length?Math.max(...searchCpu):null,oracleP95:pct(queryCpu,.95)},contract:'Independent offline fixed-step MARROW guide + common-body corrected chassis state. Each committed endpoint and declared mechanically coupled interpolation passes conditional oracle and directional support. Flight requests stop the ground experiment. No self-intersection proof, live or runtime authorization.'};
}
