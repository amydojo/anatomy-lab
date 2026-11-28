/* OSTEOSURF reduced-order fictional field. Atlas units, normalized mass=1.
 * No real magnetic property, clinical claim, new mechanical joint or collision authority.
 * Every returned command/configuration is only a proposal. */
import {measure} from './osteodynamics.mjs';
import {commonCorrection} from './kinesis-oracle.mjs';
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,0,1])=>len(a)>1e-9?mul(a,1/len(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),plane=(a,n)=>sub(a,mul(n,dot(a,n)));
export const DT=1/120,FIELD=Object.freeze({gap:.006,spring:100,damping:18,forceLimit:1.2,attachment:1.1,pitchInertia:.00055,rollInertia:.00008,angularDamping:14,angleSpring:36,maxLift:.004,maxAngle:.12,maxLiftRate:.02,maxAngularRate:1.2,drive:.9,drag:2.4});
export function terrainDescriptor(world,state,pose,foot,B){
 const m=measure(world,{...state,p:pose.t,n:pose.r.slice(3,6)},pose,foot,B),n=m.normal,r=pose.r.slice(0,3),f=pose.r.slice(6,9),direction=unit(plane(state.v||f,n),f);let xx=0,xz=0,zz=0,xu=0,zu=0,xv=0,zv=0,used=0;
 // Directional normal derivative fit on actual accepted source witnesses.
 if(m.center.valid)for(const q of m.probes){if(!q.valid||dot(q.normal,m.center.normal)<.7)continue;const d=sub(q.hit,m.center.hit);if(len(d)>.045)continue;const x=dot(d,r),z=dot(d,f),dn=sub(q.normal,m.center.normal),u=dot(dn,r),v=dot(dn,f);xx+=x*x;xz+=x*z;zz+=z*z;xu+=x*u;zu+=z*u;xv+=x*v;zv+=z*v;used++;}
 const det=xx*zz-xz*xz;let directional=null,tensor=null;if(m.principalCurvature&&used>=5&&det>1e-8){const a=(zz*xu-xz*zu)/det,b=(xx*zu-xz*xu)/det,c=(zz*xv-xz*zv)/det,d=(xx*zv-xz*xv)/det,k=(b+c)/2,x=dot(direction,r),z=dot(direction,f);tensor=[a,k,d];directional=a*x*x+2*k*x*z+d*z*z;}
 const support=m.center.valid&&m.center.gap>=0&&m.center.gap<=.017&&m.supportRatio>=.55&&m.pods.frontPod.support>0&&m.pods.rearPod.support>0&&m.negativeSamples===0;
 return {...m,directional,tensor,qualifiedSupport:support,nearDiscontinuity:m.prediction.some(q=>!q.valid)||(m.predictedNormalTurn??0)>.65,narrow:m.supportRatio<.82};
}
export function initialSuspension(lift=.002){return {lift,pitch:0,roll:0,vl:0,wp:0,wr:0,previous:{}};}
export function forceProposal(s,terrain,pose,velocity,input,{dt=DT,propulsion=false}={}){
 if(dt!==DT)throw Error('fixed step required');const P=FIELD,n=pose.r.slice(3,6),r=pose.r.slice(0,3),f=pose.r.slice(6,9),speed=len(velocity),forces=[],previous={},N=terrain.probes.length||1;let normalForce=0,tau=[0,0,0];
 for(const q of terrain.probes){if(!q.valid)continue;const arm=sub(q.point,pose.t),gapRate=s.previous[q.label]===undefined?0:clamp((q.gap-s.previous[q.label])/dt,-.1,.1);previous[q.label]=q.gap;const scalar=clamp(P.spring*(P.gap-q.gap)-P.damping*gapRate,-P.forceLimit,P.forceLimit)/N,F=mul(q.normal,scalar);normalForce+=dot(F,n);tau=add(tau,cross(arm,F));forces.push({label:q.label,point:q.point,gap:q.gap,scalar,force:F});}
 const curvature=terrain.directional??0,demand=speed*speed*curvature,authority=P.attachment*terrain.supportRatio,steer=clamp(input.stick?.[0]||0,-1,1),bank=clamp(-steer*speed*.65,-.08,.08);
 // Curvature is signed; convex curvature requires inward attachment. It never adds drive energy.
 const load=Math.max(0,demand),capacity=clamp(1-Math.max(0,load-authority*.65)/Math.max(.1,authority),0,1),push=clamp(input.push||0,0,1),brake=clamp(input.brake||0,0,1);
 // The existing guide's velocity servo is driven by bounded fictional propulsion/drag.
 const accel=P.drive*push*capacity-P.drag*speed-1.6*brake*speed,target=clamp(speed+accel*dt,0,.18),damp=1-Math.exp(-9*dt),goal=clamp((target-(1-damp)*speed)/damp,0,.18),effectivePush=goal/.18;
 const al=clamp(normalForce-8*s.vl-.8*demand,-1.5,1.5),ap=clamp(dot(tau,r)/P.pitchInertia-P.angularDamping*s.wp-P.angleSpring*s.pitch,-30,30),ar=clamp(dot(tau,f)/P.rollInertia-P.angularDamping*s.wr-P.angleSpring*(s.roll-bank),-30,30);
 let vl=clamp(s.vl+al*dt,-P.maxLiftRate,P.maxLiftRate),wp=clamp(s.wp+ap*dt,-P.maxAngularRate,P.maxAngularRate),wr=clamp(s.wr+ar*dt,-P.maxAngularRate,P.maxAngularRate),lift=clamp(s.lift+vl*dt,0,P.maxLift),pitch=clamp(s.pitch+wp*dt,-P.maxAngle,P.maxAngle),roll=clamp(s.roll+wr*dt,-P.maxAngle,P.maxAngle);const a=Math.hypot(pitch,roll);if(a>P.maxAngle){pitch*=P.maxAngle/a;roll*=P.maxAngle/a;const outward=(wp*pitch+wr*roll)/(P.maxAngle*P.maxAngle);if(outward>0){wp-=outward*pitch;wr-=outward*roll;}}if(lift===0&&vl<0||lift===P.maxLift&&vl>0)vl=0;
 return {suspension:{lift,pitch,roll,vl,wp,wr,previous},input:propulsion?{...input,push:effectivePush,brake:0}:input,forces,normalForce,torque:tau,authority,demand,capacity,accel,bank,energy:.5*(vl*vl+P.pitchInertia*wp*wp+P.rollInertia*wr*wr),contract:'bounded reduced-order suspension + existing tangential guide; field is fictional',propulsion};
}
export const corrected=(pose,s)=>commonCorrection(pose,s.pitch,s.roll,s.lift);
// Separate normal-axis propulsion/capture experiment. Does not choose a route.
export function fieldTransition(s,{intent,descent,gap,support,alignment=1,dt=DT}){if(dt!==DT)throw Error('fixed step required');const lift=clamp(intent,0,1),request=lift>.72,unload=clamp(s.unload+(request?2.8:-3.8)*dt,0,1),authority=FIELD.attachment*support*alignment*(1-unload),outward=request?1.8*(lift-.72)/.28:0;let phase=s.phase,v=s.v,height=s.height,landed=false;if(phase==='attached'&&request&&unload>.8&&outward>authority)phase='flight';if(phase!=='attached'){const capture=descent&&gap<.035&&support>=.55&&alignment>.75;phase=capture?'capture':'flight';const accel=capture?clamp(-30*gap-12*v,-1.8,1.8):outward-.8*v;v=clamp(v+accel*dt,-.055,.065);height+=v*dt;if(capture&&gap<=.0004&&Math.abs(v)<.012){phase='attached';landed=true;v=0;}}return {phase,v,height,unload,authority,outward,landed};}
