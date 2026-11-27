/* OSTEODYNAMICS 007 / opt-in presentation research. Atlas units.
 * Exact triangle queries through the existing MARROW collision world only.
 * Signed directional gaps are sparse probes, NOT a continuous collision test.
 * No change to trajectory, contact height, forces, steering or relative hinges.
 */
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,1,0])=>len(a)>1e-8?mul(a,1/len(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const UP=[0,1,0],LIFT_MAX=.008,LIFT_RATE=.045,PROBE_START=.027,PROBE_LIMIT=.075;
const apply=(t,v)=>[0,1,2].map(k=>t.t[k]+t.r[k]*v[0]+t.r[k+3]*v[1]+t.r[k+6]*v[2]);
const assembly=id=>id.includes('_front_pod')?'frontPod':id.includes('_rear_pod')?'rearPod':id.includes('_front_')?'front':id.includes('_rear_')?'rear':'joint';
// Actual mesh vertices, not assumed rectangle. One underside witness per
// structural assembly, three lateral lanes per pod, and two lateral witnesses.
export function footprint(parts){
 const groups={front:[],rear:[],joint:[],frontPod:[],rearPod:[]};
 for(const p of parts){const a=assembly(p.id),v=p.positions;for(let i=0;i<v.length;i+=3)groups[a].push({id:p.id,local:[v[i],v[i+1],v[i+2]]});}
 const lowest=a=>a.reduce((best,v)=>!best||v.local[1]<best.local[1]?v:best,null);
 const highest=a=>a.reduce((best,v)=>!best||v.local[1]>best.local[1]?v:best,null);
 const probes=[],top=[];
 for(const [name,a] of Object.entries(groups)){if(!a.length)continue;
  top.push({...highest(a),label:name+'-top'});
  if(name.endsWith('Pod')){const width=Math.max(...a.map(v=>Math.abs(v.local[0])));for(const [lane,filter] of [['left',v=>v.local[0]<-width*.3],['center',v=>Math.abs(v.local[0])<=width*.3],['right',v=>v.local[0]>width*.3]]){const q=lowest(a.filter(filter));if(q)probes.push({...q,label:name+'-'+lane});}}
  else {probes.push({...lowest(a),label:name+'-underside'});if(name!=='joint'){const side=name==='front'?1:-1,max=Math.max(...a.map(v=>side*v.local[0]));const q=lowest(a.filter(v=>side*v.local[0]>max*.72));if(q)probes.push({...q,label:name+'-lateral'});}}
 }
 return {probes,top};
}
function rayGap(world,point,n,id,label){
 const hit=world.ray(add(point,mul(n,PROBE_START)),mul(n,-1),PROBE_LIMIT);
 if(!hit)return {label,point,valid:false,reason:'no-hit'};
 const gap=hit.distance-PROBE_START,alignment=dot(hit.normal,n),same=hit.id===id;
 return {label,point,hit:hit.point,normal:hit.normal,id:hit.id,gap,alignment,valid:same&&alignment>=.35,reason:!same?'other-structure':alignment<.35?'oblique':'support'};
}
export function measure(world,state,pose,foot,boardAPI){
 const n=unit(state.contactNormal||state.n),f=unit(sub(state.f,mul(n,dot(state.f,n))),[0,0,1]),r=unit(cross(n,f),[1,0,0]);
 const probes=foot.probes.map(q=>rayGap(world,apply(boardAPI.transform(q.id,pose),q.local),n,state.id,q.label));
 const center=rayGap(world,state.p,n,state.id,'central-contact');
 const speed=len(state.v||[0,0,0]),ahead=clamp(.036+speed*.12,.036,.070),direction=speed>.012?unit(sub(state.v,mul(n,dot(state.v,n))),f):f;
 const prediction=[.5,1].map(k=>rayGap(world,add(state.p,mul(direction,ahead*k)),n,state.id,'ahead-'+k));
 const valid=probes.filter(q=>q.valid),supported=valid.length,ratio=supported/Math.max(1,probes.length);
 const min=valid.length?Math.min(...valid.map(q=>q.gap)):null;
 const max=valid.length?Math.max(...valid.map(q=>q.gap)):null;
 const pods={};for(const name of ['frontPod','rearPod']){const p=valid.filter(q=>q.label.startsWith(name));pods[name]={support:p.length,minGap:p.length?Math.min(...p.map(q=>q.gap)):null};}
 // Fit d(normal)/d(tangent position), positive curvature = outward convexity.
 // Local linear estimate only; suppress unreliable values on discontinuities.
 let xx=0,xz=0,zz=0,xu=0,zu=0,xv=0,zv=0,normalCoherence=0,fit=[];
 if(center.valid){for(const q of valid){const d=sub(q.hit,center.hit),x=dot(d,r),z=dot(d,f),dn=sub(q.normal,center.normal),u=dot(dn,r),v=dot(dn,f);if(len(d)>.045||dot(q.normal,center.normal)<.70)continue;fit.push({x,z,u,v});xx+=x*x;xz+=x*z;zz+=z*z;xu+=x*u;zu+=z*u;xv+=x*v;zv+=z*v;normalCoherence+=dot(q.normal,center.normal);}}
 const determinant=xx*zz-xz*xz;let principal=null,residual=null,ridgeDirection=null,confidence=0;
 if(fit.length>=5&&determinant>1e-8){
  const a=(zz*xu-xz*zu)/determinant,b=(xx*zu-xz*xu)/determinant,c=(zz*xv-xz*zv)/determinant,d=(xx*zv-xz*xv)/determinant,k=(b+c)*.5;
  residual=Math.sqrt(fit.reduce((sum,q)=>sum+(a*q.x+k*q.z-q.u)**2+(k*q.x+d*q.z-q.v)**2,0)/fit.length);
  confidence=clamp(ratio*(normalCoherence/fit.length)*Math.max(0,1-residual/.20),0,1);
  if(confidence>=.60&&Math.abs(b-c)<30){const mid=(a+d)*.5,delta=Math.hypot((a-d)*.5,k),hi=mid+delta,lo=mid-delta;principal=[hi,lo];const angle=.5*Math.atan2(2*k,a-d);ridgeDirection=unit(add(mul(r,-Math.sin(angle)),mul(f,Math.cos(angle))),f);}
 }
 const gradient=valid.length?Math.max(...valid.map(q=>Math.acos(clamp(dot(q.normal,n),-1,1)))):null;
 const nextNormal=prediction.filter(q=>q.valid).at(-1)?.normal;
 return {probes,center,prediction,pods,supportRatio:ratio,minGap:min,maxGap:max,negativeSamples:valid.filter(q=>q.gap<0).length,clearanceVariation:min===null?null:max-min,normalGradient:gradient,normalDeviation:Math.acos(clamp(dot(n,unit(state.n)),-1,1)),principalCurvature:principal,ridgeDirection,curvatureConfidence:confidence,fitResidual:residual,shape:principal?(principal[0]>.5&&principal[1]>.5?'convex':principal[0]<-.5&&principal[1]<-.5?'concave':principal[0]*principal[1]<0?'saddle':'low-curvature'):'unknown',edgeProximity:1-ratio,lookAhead:ahead,predictedNormalTurn:nextNormal?Math.acos(clamp(dot(n,nextNormal),-1,1)):null,normal:n,speed};
}
export function translatePose(pose,axis,lift){
 const delta=mul(axis,lift),shift=q=>({...q,t:add(q.t,delta)});
 const out=shift(pose);for(const name of ['front','rear','frontPod','rearPod'])if(pose[name])out[name]=shift(pose[name]);return out;
}
// Common rigid-body correction: preserves every qualified relative assembly
// transform exactly. This is NOT a new hinge or an authoritative force.
const TILT_MAX=.12,TILT_RATE=.50;
const rotate=(v,w)=>{const a=len(w);if(a<1e-9)return v.slice();const k=mul(w,1/a);return add(add(mul(v,Math.cos(a)),mul(cross(k,v),Math.sin(a))),mul(k,dot(k,v)*(1-Math.cos(a))));};
const approach=(a,b,max)=>{const d=sub(b,a),m=len(d);return m<=max?b.slice():add(a,mul(d,max/m));};
export function alignPose(pose,rotation,offset){
 const pivot=pose.t,shift=q=>({...q,t:add(add(pivot,rotate(sub(q.t,pivot),rotation)),offset),r:[0,3,6].flatMap(k=>rotate(q.r.slice(k,k+3),rotation))});
 const out=shift(pose);for(const name of ['front','rear','frontPod','rearPod'])if(pose[name])out[name]=shift(pose[name]);return out;
}
function podImbalance(m){const a=m.pods.frontPod.minGap,b=m.pods.rearPod.minGap;return a===null||b===null?null:Math.abs(a-b);}
function desiredTilt(m,pose){
 const find=label=>m.probes.find(q=>q.label===label&&q.valid),front=find('frontPod-center'),rear=find('rearPod-center');
 if(!front||!rear||!m.center.valid||m.supportRatio<.80)return [0,0,0];
 const r=pose.r.slice(0,3),f=pose.r.slice(6,9),dz=dot(sub(front.point,rear.point),f);
 let pitch=Math.abs(dz)>.015?clamp((front.gap-rear.gap)/dz,-.10,.10):0;
 const roll=[];
 for(const side of ['frontPod','rearPod']){const a=find(side+'-left'),b=find(side+'-right');if(!a||!b)continue;const dx=dot(sub(b.point,a.point),r);if(Math.abs(dx)>.004)roll.push(clamp(-(b.gap-a.gap)/dx,-.08,.08));}
 const bank=roll.length?roll.reduce((a,b)=>a+b,0)/roll.length:0,w=add(mul(r,pitch),mul(f,bank)),l=len(w);
 return l>TILT_MAX?mul(w,TILT_MAX/l):w;
}
export function createTerrainInterpreter(world,boardAPI){
 let cachedParts=null,foot=null,elapsed=1,offset=[0,0,0],rotation=[0,0,0],targetOffset=[0,0,0],targetRotation=[0,0,0],last=null,cpu=[],samples=0,rayCount=0,previous=null,acceleration=null,jerk=null,appliedLift=0,appliedTilt=0;
 return {reset(){cachedParts=null;foot=null;elapsed=1;offset=rotation=targetOffset=targetRotation=[0,0,0];last=null;cpu=[];samples=rayCount=0;previous=null;acceleration=jerk=null;appliedLift=appliedTilt=0;},update(state,pose,parts,dt,adaptive=false,enabled=true){
  if(!enabled)return pose;
  dt=clamp(dt,0,.1);if(parts!==cachedParts){cachedParts=parts;foot=footprint(parts);elapsed=1;offset=rotation=targetOffset=targetRotation=[0,0,0];last=null;}
  const speed=len(state.v||[0,0,0]);elapsed+=dt;
  // 8–20 Hz sample clock, with a bounded number of probes. Reuse the same BVH.
  const interval=(cpu.at(-1)||0)>3?.125:speed>.08?1/20:1/12;
  if(state.glide||!state.ground){targetOffset=targetRotation=[0,0,0];last=null;elapsed=1;}
  else if(elapsed>=interval){const start=performance.now(),before=world.stats?.().calls||0;elapsed=0;
   const m=measure(world,state,pose,foot,boardAPI),axis=m.normal;
   let tilt=adaptive?desiredTilt(m,pose):[0,0,0],candidate=pose,trial=m,reason='no-correction';
   if(len(tilt)>1e-5){candidate=alignPose(pose,tilt,[0,0,0]);trial=measure(world,state,candidate,foot,boardAPI);
    const beforeGap=podImbalance(m),afterGap=podImbalance(trial);
    // Reject changes that lose measured support, worsen penetration, or do not
    // improve the measured differential support. Sparse probe proxy only.
    if(trial.supportRatio<m.supportRatio||trial.minGap===null||trial.minGap<Math.min(.0012,m.minGap??.0012)||beforeGap===null||afterGap===null||afterGap>=beforeGap-.00005){tilt=[0,0,0];candidate=pose;trial=m;reason='tilt-rejected';}else reason='tilt-qualified-samples';
   }
   const requested=trial.center.valid&&trial.supportRatio>=.55&&trial.minGap!==null?clamp(.0012-trial.minGap,0,LIFT_MAX):0;
   let ceiling=requested,blocked=false;
   if(requested>0||len(tilt)>1e-5)for(const q of foot.top){
    const original=apply(boardAPI.transform(q.id,pose),q.local),point=apply(boardAPI.transform(q.id,candidate),q.local),delta=sub(point,original),d=len(delta);
    if(d>1e-6&&world.ray(original,unit(delta),d+.0005)){blocked=true;break;}
    if(requested>0){const hit=world.ray(add(point,mul(axis,.0003)),axis,requested+.0013);if(hit)ceiling=Math.min(ceiling,Math.max(0,hit.distance-.001));}
   }
   if(blocked){tilt=[0,0,0];ceiling=0;trial=m;reason='overhead-motion-blocked';}
   targetOffset=mul(axis,ceiling);targetRotation=tilt;
   last={...m,requestedLift:requested,allowedLift:ceiling,requestedTilt:len(tilt),trialMinGap:trial.minGap,trialPodImbalance:podImbalance(trial),baselinePodImbalance:podImbalance(m),correctionReason:reason,probeCount:foot.probes.length,overheadLimited:blocked||ceiling+1e-9<requested,step:state.steps??null};samples++;rayCount+=(world.stats?.().calls||0)-before;
   cpu.push(performance.now()-start);if(cpu.length>240)cpu.shift();
  }
  if(previous&&dt>0){const a=mul(sub(state.v||[0,0,0],previous),1/dt);jerk=acceleration?len(sub(a,acceleration))/dt:null;acceleration=a;}previous=(state.v||[0,0,0]).slice();
  // Rate-limited world-space corrections, never change authoritative state.
  // Legacy is exact; flight does not use terrain-derived offset.
  if(!adaptive||state.glide||!state.ground){offset=rotation=[0,0,0];}
  else{offset=approach(offset,targetOffset,LIFT_RATE*dt);rotation=approach(rotation,targetRotation,TILT_RATE*dt);}
  appliedLift=len(offset);appliedTilt=len(rotation);
  return appliedLift>1e-9||appliedTilt>1e-9?alignPose(pose,rotation,offset):pose;
 },report(){const a=cpu.slice().sort((x,y)=>x-y);return {samples,rayCount,cpuMs:{median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null},lift:appliedLift,tilt:appliedTilt,target:len(targetOffset),targetTilt:len(targetRotation),acceleration:acceleration?len(acceleration):null,jerk,last};}};
}
