/* GRAVITY: opt-in interaction policy; no geometry or registration mutation. */
(function gravityModule(root) {
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 const keys=['x','y','z'];
 const scale=c=>Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom;
 function view(c,p){
  const x=p.x-c.target.x,y=p.y-c.target.y,z=p.z-c.target.z,cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  const h=z*cy-x*sy;
  return {x:x*cy+z*sy,y:y*cp-h*sp,z:y*sp+h*cp};
 }
 function inverse(c,v){
  const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),h=v.z*cp-v.y*sp;
  return {x:v.x*cy-h*sy,y:v.y*cp+v.z*sp,z:v.x*sy+h*cy};
 }
 function project(c,p){
  const v=view(c,p),s=scale(c)*7.4/(7.4-v.z);
  return {x:c.width*(Number.isFinite(c.anchorX)?c.anchorX:.5)+v.x*s,y:c.height*(Number.isFinite(c.anchorY)?c.anchorY:.5)-(v.y-.04)*s,z:v.z};
 }
 function usable(c,p){
  if(!finitePoint(p)||!(scale(c)>0))return false;
  const q=project(c,p);
  return q.z<6.4&&q.z>-20&&q.x>=0&&q.x<=c.width&&q.y>=0&&q.y<=c.height;
 }
 function inside(p,b){
  return b?.min?.length===3&&b?.max?.length===3&&keys.every((k,i)=>{
   const lo=b.min[i],hi=b.max[i],margin=Math.max(.18,Math.max(.35,hi-lo)*.18);
   return Number.isFinite(lo)&&Number.isFinite(hi)&&lo<=hi&&p[k]>=lo-margin&&p[k]<=hi+margin;
  });
 }
 // Restore the inspected point's previous projection after an explicit orbit/zoom.
 // Preserve its view depth; reject the entire correction if it exceeds navigation bounds.
 function anchor(c,p,old,b){
  const s=scale(c)*7.4/(7.4-old.z);
  if(!Number.isFinite(s)||s<=0)return false;
  const ax=c.width*(Number.isFinite(c.anchorX)?c.anchorX:.5),ay=c.height*(Number.isFinite(c.anchorY)?c.anchorY:.5);
  const d=inverse(c,{x:(old.x-ax)/s,y:.04-(old.y-ay)/s,z:old.z});
  const t={x:p.x-d.x,y:p.y-d.y,z:p.z-d.z};
  if(!inside(t,b))return false;
  Object.assign(c.target,t);return true;
 }
 // Orthographic-looking zoom is a projection scale, not a physical dolly.
 // Proximity is a bounded display-space target/selected-point heuristic, not clearance.
 function proximity(c,p){
  if(!usable(c,p))return 1;
  const distance=Math.hypot(p.x-c.target.x,p.y-c.target.y,p.z-c.target.z);
  const focus=clamp(1-distance/Math.max(.12,c.frameSpan*.25),0,1);
  const zoom=clamp((c.zoom-2)/6,0,1);
  return 1-.55*focus*zoom;
 }
 function advance(base,c,input,dt,b,maxZoom,world){
  const precision=!!input.buttons?.[10];
  let p=null;
  if(world?.inspectionPoint){try{p=world.inspectionPoint(c);}catch{}}
  const selected=usable(c,p);
  const rate=(precision?.25:1)*proximity(c,p);
  const adjusted=rate===1?input:{...input,panX:input.panX*rate,panY:input.panY*rate,orbitX:input.orbitX*(precision?.25:1),orbitY:input.orbitY*(precision?.25:1),zoom:input.zoom*(precision?.25:1)};
  const lock=selected&&!input.panX&&!input.panY&&(input.zoom||input.orbitX||input.orbitY);
  const old=lock?project(c,p):null;
  const changed=base(c,adjusted,dt,b,maxZoom);
  if(changed&&old)anchor(c,p,old,b);
  return changed;
 }
 // No polling, no activation requests. Only call from an explicitly enabled action.
 function pulse(pad){
  try{
   const actuator=pad?.vibrationActuator;
   if(typeof actuator?.playEffect!=='function')return false;
   Promise.resolve(actuator.playEffect('dual-rumble',{duration:35,startDelay:0,weakMagnitude:.18,strongMagnitude:0})).catch(()=>{});
   return true;
  }catch{return false;}
 }
 root.BodyGravity=Object.freeze({advance,project,proximity,anchor,pulse});
})(globalThis);
