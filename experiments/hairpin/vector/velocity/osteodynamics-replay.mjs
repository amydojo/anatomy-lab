import {footprint,measure,createTerrainInterpreter} from './osteodynamics.mjs';
import {createKinetic} from '../kinetic/kinetic-motion.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,0,-1])=>len(a)>1e-8?mul(a,1/len(a)):f.slice(),plane=(a,n)=>sub(a,mul(n,dot(a,n)));
const compact=m=>({minGap:m.minGap,maxGap:m.maxGap,negativeSamples:m.negativeSamples,supportRatio:m.supportRatio,pods:m.pods,clearanceVariation:m.clearanceVariation,normalGradient:m.normalGradient,normalDeviation:m.normalDeviation,principalCurvature:m.principalCurvature,curvatureConfidence:m.curvatureConfidence,shape:m.shape,edgeProximity:m.edgeProximity,predictedNormalTurn:m.predictedNormalTurn});
export function seedRoutes(world,part,vectorParts,boardAPI,boardMatrix){
 const foot=footprint(vectorParts),center=part.min.map((v,k)=>(v+part.max[k])*.5),span=sub(part.max,part.min),seeds=[];
 for(const x of [-.32,-.16,0,.16,.32])for(const z of [-.32,-.16,0,.16,.32]){
  const origin=[center[0]+x*span[0],part.max[1]+.04,center[2]+z*span[2]],hit=world.ray(origin,[0,-1,0],span[1]+.08);
  if(!hit||hit.id!==part.id||hit.normal[1]<.4)continue;
  const f=unit(plane([0,0,-1],hit.normal),unit(plane([1,0,0],hit.normal))),state={p:add(hit.point,mul(hit.normal,.011)),n:hit.normal,contactNormal:hit.normal,f,v:[0,0,0],id:part.id,ground:true,glide:false};
  const pose=createKinetic(boardAPI).update(state,boardMatrix(state),0,{hover:.00035}),m=measure(world,state,pose,foot,boardAPI);
  seeds.push({hit:{...hit,forward:f},supportRatio:m.supportRatio,clearance:m.minGap,confidence:m.curvatureConfidence,principal:m.principalCurvature,ridge:m.ridgeDirection,shape:m.shape,score:m.supportRatio+.2*m.curvatureConfidence});
 }
 const usable=seeds.filter(s=>s.supportRatio>=.55).sort((a,b)=>b.score-a.score);
 return {candidateCount:seeds.length,suitableCount:usable.length,selected:usable[0]||null,seeds};
}
// A single authoritative trajectory, three contemporaneous presentations.
// No wall-clock scheduling variance, no synthetic replacement of source geometry.
export function replayRoute(world,seed,vectorParts,boardAPI,surfaceAPI,boardMatrix,{approach='parallel',push=1,steps=360}={}){
 const h=seed.hit,n=h.normal,reference=seed.ridge||h.forward,axis=unit(plane(reference,n),h.forward),side=unit(cross(n,axis)),a=approach==='perpendicular'?Math.PI*.5:approach==='diagonal'?Math.PI*.25:0,forward=unit(add(mul(axis,Math.cos(a)),mul(side,Math.sin(a))));
 const sim=surfaceAPI.create(world,{...h,forward}),oldMotion=boardAPI.motion(),kinetic=createKinetic(boardAPI),terrain=createTerrainInterpreter(world,boardAPI),originalParts=boardAPI.geometry('bone-acid'),vf=footprint(vectorParts),of=footprint(originalParts),rows=[];
 let maxLift=0,maxTilt=0,lastV=null,lastA=null,maxAcceleration=0,maxJerk=0,prevPose=null,maxPresentationSpeed=0,maxNormalDeviation=0;
 for(let i=0;i<steps;i++){
  sim.advance(1/120,{stick:[0,-1],controlYaw:0,push});const state=sim.visual(),base=boardMatrix(state),legacy=kinetic.update(state,base,1/120,{hover:.00035}),original=oldMotion.update(state,base,1/120),adaptive=terrain.update(state,legacy,vectorParts,1/120,true,true),diag=terrain.report();
  maxLift=Math.max(maxLift,diag.lift);maxTilt=Math.max(maxTilt,diag.tilt);
  if(prevPose)maxPresentationSpeed=Math.max(maxPresentationSpeed,len(sub(adaptive.t,prevPose))*120);prevPose=adaptive.t;
  if(lastV){const acc=mul(sub(state.v,lastV),120);maxAcceleration=Math.max(maxAcceleration,len(acc));if(lastA)maxJerk=Math.max(maxJerk,len(sub(acc,lastA))*120);lastA=acc;}lastV=state.v.slice();
  if((i+1)%12===0||i===steps-1){
   const l=measure(world,state,legacy,vf,boardAPI),v=measure(world,state,adaptive,vf,boardAPI),o=measure(world,state,original,of,boardAPI);maxNormalDeviation=Math.max(maxNormalDeviation,l.normalDeviation);
   rows.push({step:state.steps,p:state.p,n:state.n,contactNormal:state.contactNormal,f:state.f,frame:state.frame,v:state.v,id:state.id,ground:state.ground,glide:state.glide,legacy:compact(l),adaptive:compact(v),original:compact(o),correction:{lift:diag.lift,tilt:diag.tilt,reason:diag.last?.correctionReason},poses:{legacy,adaptive,original}});
  }
 }
 const summary=mode=>{const p=rows.map(r=>r[mode]),valid=p.filter(q=>q.minGap!==null),pairs=p.filter(q=>q.pods.frontPod.minGap!==null&&q.pods.rearPod.minGap!==null);return {minimumGap:valid.length?Math.min(...valid.map(q=>q.minGap)):null,negativeSamples:p.reduce((a,q)=>a+q.negativeSamples,0),supportMean:p.reduce((a,q)=>a+q.supportRatio,0)/p.length,podImbalanceMean:pairs.length?pairs.reduce((a,q)=>a+Math.abs(q.pods.frontPod.minGap-q.pods.rearPod.minGap),0)/pairs.length:null,highConfidenceSamples:p.filter(q=>q.curvatureConfidence>=.6&&q.principalCurvature!==null).length};};
 const trajectory=sim.report();return {approach,approachBasis:seed.ridge?'measured-low-curvature-axis':'geometric-tangent-fallback',push,steps,seed:{point:h.point,normal:h.normal,source:h.id,confidence:seed.confidence,principal:seed.principal,shape:seed.shape},summary:{legacy:summary('legacy'),adaptive:summary('adaptive'),original:summary('original')},motion:{maxLift,maxTilt,maxAcceleration,maxJerk,maxPresentationSpeed,maxNormalDeviation},terrain:terrain.report(),trajectory,rows};
}
