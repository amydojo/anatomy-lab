/* V15.3 optical density policy; callback cadence is not GPU or display FPS. */
globalThis.BodyOptical=(function opticalPolicy(){
 const profiles=Object.freeze({fixed:[2,2,2],performance:[1.5,1.5,1.5],balanced:[2,1.5,2.5],precision:[2,1.5,3]});
 const valid=name=>Object.hasOwn(profiles,name)?name:'fixed';
 function dimensions(w,h,native,requested,maxW=4096,maxH=4096,budget=4000000){
  w=Math.max(1,w);h=Math.max(1,h);
  const scale=Math.min(requested,native||1,maxW/w,maxH/h,Math.sqrt(budget/(w*h)));
  const width=Math.max(1,Math.min(maxW,Math.floor(w*scale))),height=Math.max(1,Math.min(maxH,Math.floor(h*scale)));
  return {width,height,scale:Math.min(width/w,height/h)};
 }
 function create(name='fixed'){
  let profile=valid(name),density=profiles[profile][0],changed=0,previous=null,idleSince=null,slow=0,fast=0;
  const state=()=>({profile,density});
  function reset(now){previous=null;idleSince=null;slow=fast=0;changed=now;}
  function set(name,now){profile=valid(name);density=profiles[profile][0];reset(now);return state();}
  function tick(now,moving){
   const [,lo,hi]=profiles[profile];if(lo===hi)return null;
   if(!moving){
    previous=null;slow=fast=0;if(idleSince===null)idleSince=now;
    if(now-idleSince>=2500&&now-changed>=2500&&density<hi){density=Math.min(hi,density+.25);changed=now;return {...state(),reason:'stationary-probe'};}
    return null;
   }
   idleSince=null;const dt=previous===null?0:now-previous;previous=now;
   if(dt<=0)return null;
   if(dt>24){slow++;fast=0;}else if(dt<=19){fast++;slow=Math.max(0,slow-1);}else{fast=0;slow=Math.max(0,slow-1);}
   if(now-changed<2500)return null;
   if(slow>=12&&density>lo){density=Math.max(lo,density-.25);changed=now;slow=fast=0;return {...state(),reason:'callback-pressure'};}
   // Never raise moving quality solely because JS callbacks look healthy.
   return null;
  }
  return {state,set,reset,tick};
 }
 return Object.freeze({profiles,valid,dimensions,create});
})();
