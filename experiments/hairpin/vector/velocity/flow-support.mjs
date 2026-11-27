/* FLOW STATE — research-only chassis support for the existing exact contact solver.
 * The central triangle contact remains the guide constraint. The chassis is a
 * separate authoritative position, with bounded normal displacement and attitude.
 * No autopilot, no tangential thrust, no new relative articulation. Fictional model.
 * All scheduling uses 120 Hz step counts, never wall-clock time.
 */
import {footprint,measure} from './osteodynamics.mjs';
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,1,0])=>len(a)>1e-9?mul(a,1/len(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),cap=(v,m)=>len(v)>m?mul(v,m/len(v)):v,plane=(a,n)=>sub(a,mul(n,dot(a,n)));
const MAX_LIFT=.024,MAX_SPEED=.105,MAX_ACCEL=2.4,OMEGA=22,MIN_GAP=.0018,MAX_TILT=.32,MAX_TURN=4.5;
const approach=(a,b,limit)=>add(a,cap(sub(b,a),limit));
function turn(a,b,max){const theta=Math.acos(clamp(dot(a,b),-1,1));if(theta<=max||theta<1e-8)return b.slice();const t=max/theta,sa=Math.sin(theta);return sa>1e-6?unit(add(mul(a,Math.sin((1-t)*theta)/sa),mul(b,Math.sin(t*theta)/sa)),a):unit(approach(a,b,max),a);}
const apply=(q,v)=>[0,1,2].map(k=>q.t[k]+q.r[k]*v[0]+q.r[k+3]*v[1]+q.r[k+6]*v[2]);
export function createFlowSupport(world,parts,boardAPI,boardMatrix,{model='compliant'}={}){
 if(!['constraint','compliant'].includes(model))throw Error('Unknown FLOW support model');
 const foot=footprint(parts),motion=boardAPI.motion();
 let offset=[0,0,0],velocity=[0,0,0],normal=null,goalNormal=null,target=[0,0,0],next=0,tick=0,last=null,cpu=[],rays=0,miss=0,maxLift=0,maxSpeed=0,maxAccel=0,maxTurn=0,unsupportedSteps=0,recoverySteps=0,work=0;
 function reset(){offset=velocity=target=[0,0,0];normal=goalNormal=null;next=0;tick=0;last=null;miss=0;motion.reset();}
 return {reset,update(state,dt){
  const n=unit(state.contactNormal),anchor=state.p,oldNormal=normal||unit(state.n,n);
  normal=oldNormal;goalNormal=goalNormal||n;
  // Pose used for measuring the current reference footprint includes the
  // qualified internal articulation. Root support displacement is measured separately.
  const refState={...state,p:anchor,n:normal,f:unit(plane(state.f,normal),state.f)},pose=motion.update(refState,boardMatrix(refState),dt);
  tick++;
  if(tick>=next){const start=performance.now(),before=world.stats?.().calls||0,speed=len(state.v),stride=speed>.10?6:10;next=tick+stride;
   const m=measure(world,refState,pose,foot,boardAPI),valid=m.probes.filter(q=>q.valid),front=valid.filter(q=>q.label.startsWith('frontPod')),rear=valid.filter(q=>q.label.startsWith('rearPod'));
   const coherent=m.center.valid&&valid.length>=6&&front.length>=1&&rear.length>=1;
   let demand=0,predict=0,clearanceCap=MAX_LIFT,supportNormal=n;
   if(coherent){
    miss=0;const sum=valid.reduce((v,q)=>add(v,mul(q.normal,Math.max(.1,q.alignment)**2)),mul(n,3));
    supportNormal=turn(n,unit(sum,n),MAX_TILT);
    // Only a current support solution may admit prediction. Ahead rays are
    // not contacts, and cannot select a heading or change the guide constraint.
    const ahead=m.prediction.filter(q=>q.valid&&dot(q.normal,n)>.75);
    if(m.curvatureConfidence>=.60&&ahead.length&&m.center.valid){predict=clamp(m.center.gap-Math.min(...ahead.map(q=>q.gap)),0,.004)*clamp(speed/.18,0,1);}
    demand=clamp(MIN_GAP-(m.minGap??MIN_GAP)+predict,0,MAX_LIFT);
    if(demand>0)for(const q of foot.top){const point=apply(boardAPI.transform(q.id,pose),q.local),h=world.ray(add(point,mul(supportNormal,.0003)),supportNormal,demand+.0013);if(h)clearanceCap=Math.min(clearanceCap,Math.max(0,h.distance-.001));}
    demand=Math.min(demand,clearanceCap);
    target=mul(supportNormal,demand);goalNormal=supportNormal;
   }else{
    miss++;if(miss>=2){target=[0,0,0];goalNormal=n;}
   }
   last={tick,coherent,available:valid.length,front:front.length,rear:rear.length,frontLoad:front.length&&rear.length?front.length/(front.length+rear.length):null,minGap:m.minGap,prediction:predict,requestedLift:demand,clearanceCap,normalGradient:m.normalGradient,confidence:m.curvatureConfidence,shape:m.shape,lookAhead:m.lookAhead,probeCount:(world.stats?.().calls||0)-before};
   rays+=last.probeCount;cpu.push(performance.now()-start);if(cpu.length>240)cpu.shift();
  }
  if(last&&!last.coherent)unsupportedSteps++;
  if(last?.coherent&&miss===0&&len(sub(target,offset))>.001)recoverySteps++;
  // Reference solution: rate-limited kinematic constraint. Primary candidate:
  // critically damped second-order displacement, bounded velocity/acceleration.
  const oldOffset=offset.slice(),oldVelocity=velocity.slice();
  if(model==='constraint'){const desired=cap(mul(sub(target,offset),OMEGA),MAX_SPEED);velocity=approach(velocity,desired,MAX_ACCEL*dt);}
  else {const acceleration=cap(sub(mul(sub(target,offset),OMEGA*OMEGA),mul(velocity,2*OMEGA)),MAX_ACCEL);velocity=cap(add(velocity,mul(acceleration,dt)),MAX_SPEED);}
  offset=add(offset,mul(velocity,dt));
  // No negative suspension displacement through the central contact plane.
  const inward=dot(offset,n);if(inward<0){offset=sub(offset,mul(n,inward));const d=dot(velocity,n);if(d<0)velocity=sub(velocity,mul(n,d));}
  if(len(offset)>MAX_LIFT){offset=cap(offset,MAX_LIFT);const out=unit(offset),d=dot(velocity,out);if(d>0)velocity=sub(velocity,mul(out,d));}
  normal=turn(oldNormal,goalNormal,MAX_TURN*dt);const a=len(sub(velocity,oldVelocity))/dt,angle=Math.acos(clamp(dot(oldNormal,normal),-1,1));
  maxLift=Math.max(maxLift,len(offset));maxSpeed=Math.max(maxSpeed,len(sub(offset,oldOffset))/dt);maxAccel=Math.max(maxAccel,a);maxTurn=Math.max(maxTurn,angle/dt);work+=Math.abs(dot(sub(velocity,oldVelocity),velocity));
  return {p:add(anchor,offset),n:normal.slice(),offset:offset.slice(),supportVelocity:velocity.slice(),coherent:!!last?.coherent};
 },report(){const a=cpu.slice().sort((x,y)=>x-y);return {model,steps:tick,rayCount:rays,samples:cpu.length,cpuMs:{median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null},lift:len(offset),maxLift,maxSupportSpeed:maxSpeed,maxSupportAcceleration:maxAccel,maxAngularRate:maxTurn,unsupportedSteps,recoverySteps,supportWorkProxy:work,last};}};
}
