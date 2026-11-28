/* Normal-axis field experiment. No automatic launch from obstruction. No airborne
 * route selection or unrestricted flight. The returned state is uncommitted. */
import {DT,FIELD} from './magnetodynamics.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function captureProposal(s,{intent=0,descent=false,gap,support,alignment,pods,groundSupport=false,dt=DT}){
 if(dt!==DT||![intent,gap,support,alignment,s.height,s.v,s.unload,s.pitch,s.roll].every(Number.isFinite))throw Error('Invalid fixed-step field state');
 const request=intent>.72,unload=clamp(s.unload+(request?2.8:-3.8)*dt,0,1),authority=FIELD.attachment*support*Math.max(0,alignment)*(1-unload),thrust=request?1.8*clamp((intent-.72)/.28,0,1):0;let phase=s.phase,height=s.height,v=s.v,pitch=s.pitch,roll=s.roll,latched=false,impulse=0;
 if(phase==='attached'&&request&&unload>.8&&thrust>authority)phase='flight';
 if(phase==='attached')return {...s,unload,authority,thrust,latched:false,impulse:0};
 const entering=descent&&pods&&support>=.55&&alignment>=.75&&gap<.035,maintain=descent&&pods&&support>=.50&&alignment>=.70&&gap<.040,capture=!request&&(phase==='capture'?maintain:entering);phase=capture?'capture':'flight';
 // Force depends on measured approach gap and signed relative normal speed.
 // When capture loses alignment/support, cease attraction rather than snap.
 const a=capture?clamp(-45*gap-15*v,-1.5,1.5):clamp(thrust-authority*(request?.15:0)-.8*v,-1.5,1.8);v=clamp(v+a*dt,-.055,.065);height+=v*dt;
 if(capture){pitch*=Math.exp(-4*dt);roll*=Math.exp(-4*dt);if(groundSupport&&Math.abs(gap)<.00045&&Math.abs(v)<.002&&Math.hypot(pitch,roll)<.02){latched=true;phase='attached';impulse=Math.abs(v);v=0;}}
 return {phase,height,v,unload,pitch,roll,authority,thrust,latched,impulse};
}
// Undamped, unconstrained scalar limit of the semi-implicit suspension update;
// isolates integration energy error from active servo, damping and clamps.
export function oscillator(dt=DT,seconds=10){let x=.001,v=0;const k=FIELD.spring,e0=.5*k*x*x;let min=e0,max=e0;for(let i=0;i<Math.round(seconds/dt);i++){v-=k*x*dt;x+=v*dt;const e=.5*v*v+.5*k*x*x;min=Math.min(min,e);max=Math.max(max,e);}return {dt,seconds,relativeEndDrift:(.5*v*v+.5*k*x*x)/e0-1,relativeMin:min/e0-1,relativeMax:max/e0-1};}
