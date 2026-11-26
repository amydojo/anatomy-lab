/* GRAVITY II semantic camera input v1; display-space only. */
(function adaptiveModule(root){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),fields=['panX','panY','orbitX','orbitY','zoom'],zero=()=>Object.fromEntries(fields.map(k=>[k,0]));
 const profiles=Object.freeze({explorer:Object.freeze({response:1,precision:1,inertia:.085,acceleration:.055,curve:1.6}),microsurgeon:Object.freeze({response:.7,precision:.55,inertia:.025,acceleration:.045,curve:2.05}),cinematographer:Object.freeze({response:.85,precision:.8,inertia:.22,acceleration:.16,curve:1.55})});
 function shape(x,y,dead=.18,curve=1.6){x=clamp(Number(x)||0,-1,1);y=clamp(Number(y)||0,-1,1);const m=Math.hypot(x,y);if(m<=dead)return [0,0];const v=Math.pow(clamp((m-dead)/(1-dead),0,1),curve);return [x/m*v,y/m*v];}
 function intent(i){return {version:1,...Object.fromEntries(fields.map(k=>[k,clamp(Number(i[k])||0,-1,1)])),precision:!!(i.precision||i.buttons?.[10])};}
 function matrixUnits(matrix,width,height,z){if(!matrix||matrix.length!==16||!matrix.every(Number.isFinite)||!(width>0&&height>0)||[1,3,4,7].some(i=>Math.abs(matrix[i])>1e-9))return null;const w=matrix[11]*z+matrix[15];if(!(w>0)||!matrix[0]||!matrix[5])return null;return {x:2*w/(width*Math.abs(matrix[0])),y:2*w/(height*Math.abs(matrix[5]))};}
 // Atlas uses a fixed virtual eye at z=7.4 and scales the projection, not the eye.
 function units(c,p){const base=Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom;if(!(base>0))return null;const z=p?root.BodyGravity.project(c,p).z:0;if(!Number.isFinite(z)||z>=6.4||z< -20)return null;const u=(7.4-z)/(7.4*base);return {x:u,y:u};}
 function create(profile='explorer',overrides={}){
  let config,v=zero(),filtered=1,lastCamera=null,precisionState=false;
  function reset(){v=zero();filtered=1;lastCamera=null;precisionState=false;}
  function configure(name,over={}){config={...profiles[name]||profiles.explorer};for(const [k,lo,hi] of [['response',.2,2],['precision',.15,1.5],['inertia',.01,.4]])if(over[k]!=null&&Number.isFinite(Number(over[k])))config[k]=clamp(Number(over[k]),lo,hi);reset();}
  configure(profile,overrides);
  function active(){return fields.some(k=>Math.abs(v[k])>0);}
  function read(pad,base){const i=base(pad),a=pad.axes||[];[i.panX,i.panY]=shape(a[0],a[1],.18,config.curve);[i.orbitX,i.orbitY]=shape(a[2],a[3],.18,config.curve);return i;}
  function step(base,c,raw,seconds,b,maxZoom,world){
   if(c!==lastCamera){reset();lastCamera=c;}
   if(!Number.isFinite(seconds)||seconds<=0)return false;
   if(seconds>.15){reset();lastCamera=c;return false;}
   const dt=Math.min(.05,seconds),i=intent(raw),G=root.BodyGravity;
   let p=null;try{p=world?.inspectionPoint?.(c)||null;}catch{}
   if(p){const q=G.project(c,p);if(!(q.z<6.4&&q.z> -20&&q.x>=0&&q.x<=c.width&&q.y>=0&&q.y<=c.height))p=null;}
   const u=units(c,p),nominal=units(c,null),ratio=u&&nominal?clamp(u.x/nominal.x,.2,3.5):1;
   filtered+=(ratio-filtered)*(-Math.expm1(-dt/.12));
   if(i.precision!==precisionState){v=zero();precisionState=i.precision;}
   const macro=clamp((c.zoom-2)/12,0,1),prox=p?G.proximity(c,p):1,gain=config.response*(i.precision?.25*config.precision:1),motion=zero();
   for(const k of fields){
    const desired=i[k]*gain*(k.startsWith('pan')?filtered*prox:1);
    const tau=Math.max(.008,desired===0?config.inertia*(1-.75*macro)*(i.precision?.4:1):config.acceleration);
    // Integrate only until exact release threshold crossing, independent of frame boundaries.
    const end=desired===0?Math.min(dt,Math.max(0,tau*Math.log(Math.abs(v[k])/.002))):dt;
    const decay=Math.exp(-end/tau);
    motion[k]=(desired*end+(v[k]-desired)*(-Math.expm1(-end/tau))*tau)/dt;
    v[k]=desired===0&&end<dt?0:desired+(v[k]-desired)*decay;
    if(desired===0&&Math.abs(v[k])<=.00200000000001)v[k]=0;
   }
   const pan=Math.abs(motion.panX)+Math.abs(motion.panY)>0,anchorPoint=!pan?(p||(motion.zoom?{...c.target}:null)):null,old=anchorPoint?G.project(c,anchorPoint):null;
   const changed=base(c,motion,dt,b,maxZoom);if(changed&&old)G.anchor(c,anchorPoint,old,b);return changed;
  }
  return Object.freeze({read,step,active,reset,configure,settings:()=>({...config}),velocity:()=>({...v})});
 }
 function wheelPixels(e,height){return clamp((Number(e.deltaY)||0)*(e.deltaMode===1?16:e.deltaMode===2?height:1),-240,240);}
 function pointAtPixel(c,x,y,depth=0){const u=units(c,null)?.x*(7.4-depth)/7.4;if(!(u>0))return null;const a=(x-c.width*(Number.isFinite(c.anchorX)?c.anchorX:.5))*u,b=.04-(y-c.height*(Number.isFinite(c.anchorY)?c.anchorY:.5))*u,cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),h=depth*cp-b*sp;return {x:c.target.x+a*cy-h*sy,y:c.target.y+b*cp+depth*sp,z:c.target.z+a*sy+h*cy};}
 function snapshot(c,t,spaceId){return {version:1,t,spaceId,yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,target:{...c.target},frameSpan:c.frameSpan,anchorX:c.anchorX??.5,anchorY:c.anchorY??.5};}
 root.BodyGravityAdaptive=Object.freeze({version:1,profiles,shape,intent,matrixUnits,units,create,wheelPixels,pointAtPixel,snapshot});
})(globalThis);
