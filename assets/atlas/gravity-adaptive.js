/* GRAVITY II semantic camera input v1; display-space only. */
(function adaptiveModule(root){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),fields=['panX','panY','orbitX','orbitY','zoom'],zero=()=>Object.fromEntries(fields.map(k=>[k,0]));
 const profiles=Object.freeze({explorer:Object.freeze({response:1,precision:1,inertia:.085,acceleration:.055,curve:1.6}),microsurgeon:Object.freeze({response:.7,precision:.55,inertia:.025,acceleration:.045,curve:2.05}),cinematographer:Object.freeze({response:.85,precision:.8,inertia:.22,acceleration:.16,curve:1.55})});
 function shape(x,y,dead=.18,curve=1.6){x=clamp(Number(x)||0,-1,1);y=clamp(Number(y)||0,-1,1);const m=Math.hypot(x,y);if(m<=dead)return [0,0];const v=Math.pow(clamp((m-dead)/(1-dead),0,1),curve);return [x/m*v,y/m*v];}
 function intent(i){return {version:1,...Object.fromEntries(fields.map(k=>[k,clamp(Number(i[k])||0,-1,1)])),precision:!!(i.precision||i.buttons?.[10]),boost:!!i.boost,glide:!!i.glide};}
 function matrixUnits(matrix,width,height,z){if(!matrix||matrix.length!==16||!matrix.every(Number.isFinite)||!(width>0&&height>0)||[1,3,4,7].some(i=>Math.abs(matrix[i])>1e-9))return null;const w=matrix[11]*z+matrix[15];if(!(w>0)||!matrix[0]||!matrix[5])return null;return {x:2*w/(width*Math.abs(matrix[0])),y:2*w/(height*Math.abs(matrix[5]))};}
 // Atlas uses a fixed virtual eye at z=7.4 and scales the projection, not the eye.
 function units(c,p){const base=Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom;if(!(base>0))return null;const z=p?root.BodyGravity.project(c,p).z:0;if(!Number.isFinite(z)||z>=6.4||z< -20)return null;const u=(7.4-z)/(7.4*base);return {x:u,y:u};}

 const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 const xyz=['x','y','z'];
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
 const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
 function basis(c){
  const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  return {right:{x:cy,y:0,z:sy},up:{x:sy*sp,y:cp,z:-cy*sp},back:{x:-sy*cp,y:sp,z:cy*cp}};
 }
 function fromView(c,v){const {right,up,back}=basis(c);return Object.fromEntries(xyz.map(k=>[k,right[k]*v.x+up[k]*v.y+back[k]*v.z]));}
 function toView(c,v){const {right,up,back}=basis(c),dot=b=>xyz.reduce((s,k)=>s+b[k]*v[k],0);return {x:dot(right),y:dot(up),z:dot(back)};}
 function eye(c){return c.flight?{...c.target}:add(c.target,fromView(c,{x:0,y:.04,z:7.4}));}
 // Selected surface is immutable in source/display-native coordinates, not a drifting AABB center.
 // Transform is column-major rigid (the exact PLAYGROUND convention).
 function pivotCapture(id,spaceId,hit,transform){
  if(!id||!spaceId||!finite(hit))return null;
  const m=transform||{r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};
  if(!rigid(m))return null;
  const q=xyz.map((k,i)=>hit[k]-m.t[i]),r=m.r;
  return Object.freeze({version:1,id,spaceId,local:Object.freeze([r[0]*q[0]+r[1]*q[1]+r[2]*q[2],r[3]*q[0]+r[4]*q[1]+r[5]*q[2],r[6]*q[0]+r[7]*q[1]+r[8]*q[2]])});
 }
 function rigid(m){if(!m||m.r?.length!==9||m.t?.length!==3||!Array.from(m.r).every(Number.isFinite)||!Array.from(m.t).every(Number.isFinite))return false;const r=m.r;for(let a=0;a<3;a++)for(let b=0;b<3;b++){let d=0;for(let k=0;k<3;k++)d+=r[a*3+k]*r[b*3+k];if(Math.abs(d-(a===b?1:0))>1e-6)return false;}return Math.abs(r[0]*(r[4]*r[8]-r[5]*r[7])-r[3]*(r[1]*r[8]-r[2]*r[7])+r[6]*(r[1]*r[5]-r[2]*r[4])-1)<1e-6;}
 function pivotResolve(ref,id,spaceId,transform){
  if(!ref||ref.version!==1||ref.id!==id||ref.spaceId!==spaceId||ref.local?.length!==3||!ref.local.every(Number.isFinite))return null;
  const m=transform||{r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};if(!rigid(m))return null;
  const [x,y,z]=ref.local,r=m.r;return {x:r[0]*x+r[3]*y+r[6]*z+m.t[0],y:r[1]*x+r[4]*y+r[7]*z+m.t[1],z:r[2]*x+r[5]*y+r[8]*z+m.t[2]};
 }
 // No bounds correction on rotation: changing view direction is not translation.
 // Bound translation of virtual eye in roam, and reference origin in inspection.
 // If already outside a limit, allow inward motion only, never snap to the boundary.
 function boundedDelta(origin,delta,b,roam){
  if(!b?.min||!b?.max)return delta;
  const out={};for(let i=0;i<3;i++){const k=xyz[i],lo=b.min[i],hi=b.max[i];if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi){out[k]=0;continue;}
   const margin=Math.max(.18,Math.max(.35,hi-lo)*.18)+(roam?Math.hypot(.04,7.4):0);
   const lower=Math.min(origin[k],lo-margin),upper=Math.max(origin[k],hi+margin);
   out[k]=clamp(origin[k]+delta[k],lower,upper)-origin[k];
  }return out;
 }
 // Unified orbit supports continuous yaw and pitch. Preserve the camera-local
 // right/up basis through the poles, with no automatic upright correction.
 const WIDE_PITCH=1e4; // serialization guard, not a motion limit
 function travelEnvelope(b,c,roam=false){
  if(!b?.min||!b?.max||!b.min.every(Number.isFinite)||!b.max.every(Number.isFinite))return null;
  const center=Object.fromEntries(xyz.map((k,i)=>[k,(b.min[i]+b.max[i])/2]));
  const span=Math.max(...b.max.map((x,i)=>x-b.min[i]));
  return {center,radius:Math.max(4,span*3,Math.min(20,c.frameSpan||3.25)*3)+(roam?Math.hypot(.04,7.4):0)};
 }
 // Radial limit, rather than independent world-axis clamps. Keep the direction
 // of a requested displacement and allow recovery from an existing outside pose.
 function radialDelta(origin,delta,b,c,roam=false){
  const envelope=travelEnvelope(b,c,roam);if(!envelope)return delta;
  const q=sub(origin,envelope.center),d2=xyz.reduce((n,k)=>n+delta[k]*delta[k],0);
  if(!d2)return delta;
  const distance=Math.hypot(q.x,q.y,q.z),radius=Math.max(envelope.radius,distance);
  const dot=xyz.reduce((n,k)=>n+q[k]*delta[k],0);
  const limit=Math.max(0,(-dot+Math.sqrt(Math.max(0,dot*dot+d2*(radius*radius-distance*distance))))/d2);
  const t=Math.min(1,limit);
  return Object.fromEntries(xyz.map(k=>[k,delta[k]*t]));
 }
 // Perspective flight: target is the actual eye position in this versioned pose.
 // Lens is fixed; movement changes depth and parallax, not projection magnification.
 const FLIGHT_NEAR=.0015,FLIGHT_FAR=250;
 function flightFit(c,b){const center=Object.fromEntries(xyz.map((k,i)=>[k,(b.min[i]+b.max[i])/2])),radius=Math.hypot(...b.max.map((x,i)=>(x-b.min[i])/2));Object.assign(c,{flight:true,yaw:0,pitch:0,zoom:1,frameSpan:3.25,anchorX:.5,anchorY:.5,target:{...center,z:center.z+Math.max(1.2,radius*6)}});return c;}
 function flightClearance(c,boxes){const e=eye(c);let d=Infinity;for(const b of boxes||[]){if(!b?.min||!b?.max)continue;d=Math.min(d,Math.hypot(...xyz.map((k,i)=>Math.max(b.min[i]-e[k],0,e[k]-b.max[i]))));}return Number.isFinite(d)?d:2;}
 function flightSpeed(clearance){return clamp(.10+.95*Math.pow(Math.max(0,clearance),.85),.10,8);}
 function flightTau(k,desired,velocity,config){const angular=k.startsWith('orbit');if(!desired)return angular?.075:.11;if(velocity*desired<0)return .075;return angular?.075:(k==='zoom'?.24:.16);}
  // Hold-to-boost is a velocity modifier, never a lens change or a separate mode.
 function boostFactor(clearance,blend){const t=clamp((clearance-.35)/2.15,0,1);return 1+.8*clamp(blend,0,1)*t*t*(3-2*t);}
  // Only damp motion directed into the sampled surface. No repulsion,
 // steering injection, hard barrier, or movement when the controls are neutral.
 function surfaceSlide(eye,shift,probe,amount){
  if(!probe?.sampled||!finite(probe.point)||!(amount>0))return shift;
  const d=sub(eye,probe.point),len=Math.hypot(d.x,d.y,d.z);if(!(len>1e-8&&len<.20))return shift;
  const normal=Object.fromEntries(xyz.map(k=>[k,d[k]/len])),inward=xyz.reduce((s,k)=>s+normal[k]*shift[k],0);if(inward>=0)return shift;
  const t=clamp((.20-len)/.17,0,1),weight=.88*clamp(amount,0,1)*t*t*(3-2*t);
  return Object.fromEntries(xyz.map(k=>[k,shift[k]-normal[k]*inward*weight]));
 }
 function flightStep(c,motion,dt,b,p,boxes,selected=false,boost=0,surface=null,glide=0){
  if(!finite(c.target)||!Number.isFinite(dt)||dt<=0)return false;
  dt=Math.min(.05,dt);const start={...c,target:{...c.target}},local=finite(p)?toView(start,sub(p,start.target)):null,orbit=local&&-local.z>FLIGHT_NEAR;
  c.yaw+=motion.orbitX*1.6*dt;c.pitch+=motion.orbitY*1.15*dt;
  if(orbit&&(motion.orbitX||motion.orbitY))c.target=sub(p,fromView(c,local));
  const clearance=flightClearance(c,boxes?.length?boxes:[b]),speed=flightSpeed(clearance)*boostFactor(clearance,selected?0:boost);
  let shift=fromView(c,{x:motion.panX*speed*dt,y:-motion.panY*speed*dt,z:0});
  if(motion.zoom){
   const throttle=Math.sign(motion.zoom)*Math.pow(Math.min(1,Math.abs(motion.zoom)),1.25);
   if(orbit&&selected){const delta=sub(p,c.target),d=Math.hypot(delta.x,delta.y,delta.z),limit=Math.max(0,d-.025),travel=throttle>0?Math.min(speed*dt*throttle,limit):speed*dt*throttle; if(d>1e-8)shift=add(shift,Object.fromEntries(xyz.map(k=>[k,delta[k]/d*travel])));}
   else shift=add(shift,fromView(c,{x:0,y:0,z:-speed*dt*throttle}));
  }
  if(!selected)shift=surfaceSlide(c.target,shift,surface,glide);
  c.target=add(c.target,radialDelta(c.target,shift,b,c,true));c.zoom=1;
  return c.yaw!==start.yaw||c.pitch!==start.pitch||xyz.some(k=>c.target[k]!==start.target[k]);
 }
 function spatialStep(base,c,motion,dt,b,maxZoom,p,orthographic=false,wide=false){
  if(!finite(c.target)||!Number.isFinite(c.zoom)||c.zoom<=0)return false;
  const start={...c,target:{...c.target}},previousEye=eye(start);
  const local=finite(p)?toView(start,sub(p,start.target)):null;
  // Keep explicit pivot even off screen; unsafe projection depth falls back to free look.
  const inspection=local&&(orthographic||(local.z<6.4&&local.z> -20));
  const angular=Math.min(1,Math.min(c.width,c.height)*.55/(Math.max(.001,Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom)*7.4));
  base(c,{...motion,panX:0,panY:0,orbitX:motion.orbitX*(inspection?1:angular),orbitY:motion.orbitY*(inspection?1:angular)},dt,b,maxZoom);
  if(wide)c.pitch=start.pitch+motion.orbitY*(inspection?1:angular)*1.15*dt;
  const rotated=c.yaw!==start.yaw||c.pitch!==start.pitch,zoomed=c.zoom!==start.zoom;
  if(inspection&&(rotated||zoomed)){
   // Orbit about the same world point; zoom preserves its pixel, at constant depth.
   const ratio=start.zoom/c.zoom;
   c.target=sub(p,fromView(c,{x:local.x*ratio,y:orthographic?local.y*ratio:.04+(local.y-.04)*ratio,z:local.z}));
  }else if(!inspection&&rotated)c.target=sub(previousEye,fromView(c,{x:0,y:.04,z:7.4}));
  if(motion.panX||motion.panY){
   const scale=Math.max(.001,Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom);
   const rate=Math.min(c.width,c.height)*.55/scale;
   const shift=fromView(c,{x:motion.panX*rate*dt,y:-motion.panY*rate*dt,z:0});
   const origin=inspection?c.target:eye(c);c.target=add(c.target,wide?radialDelta(origin,shift,b,c,!inspection):boundedDelta(origin,shift,b,!inspection));
  }
  return rotated||zoomed||xyz.some(k=>start.target[k]!==c.target[k]);
 }

 function create(profile='explorer',overrides={}){
  let config,v=zero(),filtered=1,lastCamera=null,precisionState=false,lastMode=null,lastPivotKey=null,boostBlend=0,glideBlend=0,surface=null,probeAge=0;
  function reset(){v=zero();filtered=1;lastCamera=null;precisionState=false;lastMode=null;lastPivotKey=null;boostBlend=0;glideBlend=0;surface=null;probeAge=0;}
  function configure(name,over={}){config={...profiles[name]||profiles.explorer};for(const [k,lo,hi] of [['response',.2,2],['precision',.15,1.5],['inertia',.01,.4]])if(over[k]!=null&&Number.isFinite(Number(over[k])))config[k]=clamp(Number(over[k]),lo,hi);reset();}
  configure(profile,overrides);
  function active(){return boostBlend>0||fields.some(k=>Math.abs(v[k])>0);}
  function read(pad,base){const i=base(pad),a=pad.axes||[];[i.panX,i.panY]=shape(a[0],a[1],.18,config.curve);[i.orbitX,i.orbitY]=shape(a[2],a[3],.18,config.curve);return i;}
  function step(base,c,raw,seconds,b,maxZoom,world){
   if(c!==lastCamera){reset();lastCamera=c;}
   if(!Number.isFinite(seconds)||seconds<=0)return false;
   if(seconds>(c.flight?.5:.15)){reset();lastCamera=c;return false;}
   const dt=Math.min(c.flight?.12:.05,seconds),i=intent(raw),G=root.BodyGravity;
   const legacy=world?.legacyOrbit===true;
   let p=null,pivotKey=null,selected=false;try{if(world?.orbitPivot&&!legacy){const ref=world.orbitPivot(c);p=ref?.point||null;pivotKey=ref?.key||null;selected=ref?.kind==='surface';}else p=world?.inspectionPoint?.(c)||null;}catch{}
   if(p&&!c.flight&&!world?.orthographic){const q=G.project(c,p);if(!(q.z<6.4&&q.z> -20&&(!legacy||(q.x>=0&&q.x<=c.width&&q.y>=0&&q.y<=c.height))))p=null;}
   const mode=p?'inspection':'roam';
   if(lastMode!==null&&(mode!==lastMode||pivotKey!==lastPivotKey)){v=zero();filtered=1;boostBlend=0;glideBlend=0;surface=null;probeAge=0;}
   lastMode=mode;lastPivotKey=pivotKey;
   const u=c.flight||world?.orthographic?null:units(c,p),nominal=c.flight||world?.orthographic?null:units(c,null),ratio=u&&nominal?clamp(u.x/nominal.x,.2,3.5):1;
   filtered+=(ratio-filtered)*(-Math.expm1(-dt/.12));
   if(i.precision!==precisionState){v=zero();precisionState=i.precision;}
   const macro=clamp((c.zoom-2)/12,0,1),prox=p&&!c.flight&&!world?.orthographic?G.proximity(c,p):1,gain=config.response*(i.precision?.25*config.precision:1),motion=zero();
   for(const k of fields){
    const desired=i[k]*gain*(k.startsWith('pan')?filtered*prox:1);
    const tau=Math.max(.008,c.flight?flightTau(k,desired,v[k],config)*(i.precision?.6:1):desired===0?config.inertia*(1-.75*macro)*(i.precision?.4:1):config.acceleration);
    // Integrate only until exact release threshold crossing, independent of frame boundaries.
    const end=desired===0?Math.min(dt,Math.max(0,tau*Math.log(Math.abs(v[k])/.002))):dt;
    const decay=Math.exp(-end/tau);
    motion[k]=(desired*end+(v[k]-desired)*(-Math.expm1(-end/tau))*tau)/dt;
    v[k]=desired===0&&end<dt?0:desired+(v[k]-desired)*decay;
    if(desired===0&&Math.abs(v[k])<=.00200000000001)v[k]=0;
   }
   if(c.flight){const wantedGlide=i.glide&&!i.precision&&!selected?1:0;glideBlend=i.precision||selected?0:wantedGlide+(glideBlend-wantedGlide)*Math.exp(-dt/(wantedGlide?.12:.08));if(glideBlend<.002&&!wantedGlide)glideBlend=0;
   probeAge+=dt;const near=flightClearance(c,world?.flightBoxes?.()||[b]);if(near>.24){surface=null;probeAge=.1;}else if(probeAge>=.09){surface=world?.flightSurface?.(c)||null;probeAge=0;}
   const desiredBoost=i.boost&&!i.precision&&!selected&&(i.zoom>0||Math.abs(i.panX)+Math.abs(i.panY)>0)?1:0;const oldBoost=boostBlend;boostBlend=i.precision||selected?0:desiredBoost+(boostBlend-desiredBoost)*Math.exp(-dt/(desiredBoost?.4:.18));if(!desiredBoost&&boostBlend<.002)boostBlend=0;let changed=false;const boxes=world?.flightBoxes?.(),n=Math.max(1,Math.ceil(dt/.025));for(let j=0;j<n;j++)changed=flightStep(c,motion,dt/n,b,p,boxes,selected,i.precision||selected?0:oldBoost+(boostBlend-oldBoost)*(j+1)/n,surface,glideBlend)||changed;return changed;}
   if(!legacy)return spatialStep(base,c,motion,dt,b,maxZoom,p,world?.orthographic===true,world?.wideMobility===true);
   const pan=Math.abs(motion.panX)+Math.abs(motion.panY)>0,anchorPoint=!pan?(p||(motion.zoom?{...c.target}:null)):null,old=anchorPoint?G.project(c,anchorPoint):null;
   const changed=base(c,motion,dt,b,maxZoom);if(changed&&old)G.anchor(c,anchorPoint,old,b);return changed;
  }
  return Object.freeze({read,step,active,reset,configure,settings:()=>({...config}),velocity:()=>({...v}),boost:()=>boostBlend,flightFeedback:()=>({glide:glideBlend,surface:surface?{id:surface.id,distance:surface.distance,sampled:true}:null})});
 }
 function wheelPixels(e,height){return clamp((Number(e.deltaY)||0)*(e.deltaMode===1?16:e.deltaMode===2?height:1),-240,240);}
 function pointAtPixel(c,x,y,depth=0){const u=units(c,null)?.x*(7.4-depth)/7.4;if(!(u>0))return null;const a=(x-c.width*(Number.isFinite(c.anchorX)?c.anchorX:.5))*u,b=.04-(y-c.height*(Number.isFinite(c.anchorY)?c.anchorY:.5))*u,cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),h=depth*cp-b*sp;return {x:c.target.x+a*cy-h*sy,y:c.target.y+b*cp+depth*sp,z:c.target.z+a*sy+h*cy};}
 function snapshot(c,t,spaceId){return {version:1,t,spaceId,yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,target:{...c.target},frameSpan:c.frameSpan,anchorX:c.anchorX??.5,anchorY:c.anchorY??.5};}
 root.BodyGravityAdaptive=Object.freeze({version:1,spatialVersion:2,profiles,shape,intent,matrixUnits,units,create,wheelPixels,pointAtPixel,snapshot,eye,basis,toView,fromView,pivotCapture,pivotResolve,spatialStep,travelEnvelope,radialDelta,WIDE_PITCH,flightFit,flightStep,flightClearance,flightSpeed,flightTau,boostFactor,surfaceSlide,FLIGHT_NEAR,FLIGHT_FAR});
})(globalThis);
