/* KINETIC: presentation-only contract. Actual MARROW visual articulation
 * remains authoritative. No new forces, contact, steering or camera solver.
 * Atlas units (one authoring unit = .001 atlas units).
 */
export const BASE=Object.freeze({r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export const DURATION=9;
export function scriptedState(t){
 t=clamp(t,0,DURATION);let speed=0,bank=0,glide=false,capture=0,landings=0,impact=0,phase='REST';
 if(t>=.8&&t<1.8){phase='HOVER';speed=.025*smooth((t-.8));}
 if(t>=1.8&&t<3){phase='BOOST';speed=.025+.285*smooth((t-1.8)/1.2);}
 if(t>=3&&t<5){phase='CARVE';speed=.24;bank=.16*Math.sin((t-3)*Math.PI);}
 if(t>=5&&t<6.6){phase='FLIGHT';speed=.22;glide=true;bank=.07*Math.sin((t-5)*Math.PI);}
 if(t>=6.6&&t<7.6){phase='CAPTURE';speed=.16*(1-.4*smooth(t-6.6));glide=true;capture=smooth(t-6.6);}
 if(t>=7.6){phase=t<8.35?'LANDING':'HOVER';landings=1;impact=.20;speed=.096*(1-smooth((t-7.6)/1.4));}
 return {phase,bank,v:[0,0,speed],glide,capture,landings,impact,remounts:0,grind:false,ground:!glide,flightState:glide?(capture?'landing':'flight'):'ride'};
}
export function createKinetic(boardAPI){
 const motion=boardAPI.motion();let time=0,pulse=0,lastLandings=0,level=0;
 return {reset(){motion.reset();time=pulse=lastLandings=level=0;},update(state,base,dt,options={}){
 dt=clamp(dt,0,.1);time+=dt;
 if((state.landings||0)>lastLandings)pulse=1;
 lastLandings=state.landings||0;pulse*=Math.exp(-dt*12);
 // Positive clearance only, relative to the local normal. No force or
 // independent root motion. Default inspection hover is deliberately tiny.
 const speed=Math.hypot(...(state.v||[0,0,0])),ground=!state.glide,
 lift=ground?clamp(options.hover??.00018,0,.00035)*(.65+.35*Math.sin(time*Math.PI*1.4))*(1-clamp(speed/.12,0,1))*(1-pulse):0;
 const offset=base.r.slice(3,6).map(n=>n*lift);
 const shifted={...base,t:base.t.map((x,i)=>x+offset[i])};
 const pose=motion.update(state,shifted,dt),v=pose.vehicle;
 // Independent front/rear light emphasis, not physical differential travel.
 const target=clamp(.55+2.55*v.deploy+1.2*v.capture+.95*v.energy+3.65*pulse,.55,4.2);
 level+=(target-level)*(1-Math.exp(-dt*16));const asym=clamp(v.twist/.14,-1,1)*.13;
 return {...pose,vehicle:{...v,kinetic:true,hoverOffset:lift,landingPulse:pulse,emission:clamp(level*(options.emission??1),0,4.2),frontEmission:clamp(level*(1+asym)*(options.emission??1),0,4.2),rearEmission:clamp(level*(1-asym)*(options.emission??1),0,4.2),phase:state.phase??state.flightState,authoritativeContactHeight:.011}};
 }};}
