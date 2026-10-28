/* V6.3: no renderer handoff for source-matched Hip and Knee.
 * Source bones and detail layers remain in the same WebGL coordinate frame. */
(function(){'use strict';
function create({state,model,loader,render,updateURL,resize,setExpanded,reduce,centerPoint,shortestYaw,enableControls,NOTE,LABEL}){
 const $=id=>document.getElementById(id);
 let region=null,reveal=0,animation=0,token=0,returning=false,pending=false;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const snapshot=()=>({region,reveal,returning,pending});
 const isActive=()=>!!region||pending;
 const getRegion=()=>region;
 const getReveal=()=>reveal;
 const easing=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const setStatus=text=>{$('scene-status').textContent=text;};
 function travel(to,ms,progress,done){
  cancelAnimationFrame(animation);
  const camera=state.data.camera;
  const from={yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,frameSpan:camera.frameSpan,target:{...camera.target}};
  const start=performance.now();
  const tick=now=>{
   const u=ms===0?1:clamp((now-start)/ms,0,1),v=easing(u);
   for(const key of ['yaw','pitch','zoom','frameSpan'])camera[key]=from[key]+(to[key]-from[key])*v;
   camera.target={x:from.target.x+(to.target.x-from.target.x)*v,y:from.target.y+(to.target.y-from.target.y)*v,z:from.target.z+(to.target.z-from.target.z)*v};
   progress(v);render();
   if(u<1)animation=requestAnimationFrame(tick);else{animation=0;done();}
  };
  if(ms===0)tick(performance.now());else animation=requestAnimationFrame(tick);
 }
 function headline(name){
  $('sidebar-short').textContent=LABEL[name];
  $('panel-title').textContent=name==='hip'?'Inside the right hip.':'Explore the right knee.';
  $('panel-description').textContent=NOTE[name];
  $('panel-kicker').textContent='SAME SOURCE / '+LABEL[name];
  $('stage-title').textContent=LABEL[name]+' · SPATIAL APPROACH';
  $('stage-caveat').textContent=NOTE[name];
  $('context-note').textContent='Bones share the pinned BodyParts3D source frame. Tissue peeling is illustrative, not independently anatomist-approved.';
  $('enter-region').disabled=true;$('enter-region').textContent='Exploring '+LABEL[name];
  $('back-body').hidden=false;$('top-enter-region').hidden=true;
  $('hotspots').hidden=true;$('portal').hidden=true;
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===name)));
  if(window.innerWidth<=850)setExpanded(false);
 }
 async function choose(name){
  if(!['hip','knee'].includes(name)||state.data.view==='detail')return;
  const id=++token;cancelAnimationFrame(animation);returning=false;pending=true;
  if(!state.select(name))return;
  headline(name);$('atlas-app').dataset.mode='approach';
  setStatus('LOADING LICENSED SOURCE GEOMETRY');
  updateURL();render();
  try{
   if(!model.hasDetail(name)){
    const data=await loader.load(name==='hip'?'hipGeometry':'kneeGeometry');
    if(id!==token)return;
    model.loadDetail(name,data);
   }
   if(id!==token)return;
   region=name;reveal=0;pending=false;
   setStatus('TRAVELING IN ONE ANATOMICAL SCENE');
   const c=state.data.camera;
   const to={yaw:shortestYaw(c.yaw,name==='hip'?Math.PI+.28:.47),
     pitch:-.11,zoom:name==='hip'?1.05:1.10,frameSpan:name==='hip'?3.4:3.2,target:centerPoint(name)};
   travel(to,reduce()?0:1150,v=>{reveal=clamp((v-.46)/.54,0,1);},()=>{
    if(id!==token)return;
    state.enter();state.data.frameReady=true;reveal=1;
    $('atlas-app').dataset.mode='immersive';
    $('stage-title').textContent=LABEL[name]+' · IN PLACE';
    setStatus('ONE SCENE · SOURCE GEOMETRY UNREVIEWED');
    enableControls(name);syncControls(name);$('back-body').hidden=false;
    $('top-continue-knee').hidden=name!=='hip';
    updateURL();render();
   });
  }catch(error){
   if(id!==token)return;
   pending=false;region=null;reveal=0;
   setStatus('SOURCED DETAIL UNAVAILABLE · OVERVIEW RETAINED');
   $('context-note').textContent='The additional source geometry could not be verified: '+error.message;
   $('enter-region').disabled=false;$('enter-region').textContent='Open standalone lab ↗';
   $('top-enter-region').hidden=false;$('top-enter-region').textContent='Open separate lab ↗';
   render();
  }
 }
 function back(){
  const id=++token;cancelAnimationFrame(animation);pending=false;
  const c=state.data.camera;
  const from={yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{...c.target}};
  const departingLayer=state.data.layer;
  state.body();state.data.layer=departingLayer;
  const home={...state.data.camera,target:{...state.data.camera.target},yaw:from.yaw,pitch:from.pitch};
  Object.assign(c,from);
  returning=true;$('atlas-app').dataset.mode='overview';
  $('hotspots').hidden=true;$('back-body').hidden=true;
  $('top-enter-region').hidden=true;$('top-continue-knee').hidden=true;
  $('seam').hidden=true;
  $('sidebar-short').textContent='Explore the body';
  $('panel-title').textContent='The body, connected.';
  $('panel-kicker').textContent='SOURCE-DERIVED REFERENCE';
  $('panel-description').textContent='Explore anatomy within one spatial reference. Structures and relationships are educational and not patient-specific.';
  $('stage-title').textContent='ONE BODY · MANY SYSTEMS';
  $('stage-caveat').textContent='BodyParts3D 4.0 · CC BY 4.0 · expert review pending';
  $('context-note').textContent='Source-derived skeleton. Nerve registration and biomechanics remain unverified.';
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed','false'));
  enableControls(null);$('mode-trace').disabled=false;$('mode-peel').textContent='Peel';if(window.innerWidth<=850)setExpanded(false);
  setStatus('RETURNING THROUGH THE BODY');updateURL();
  travel(home,reduce()?0:850,v=>{reveal=1-v;},()=>{
   if(id!==token)return;
   region=null;reveal=0;returning=false;state.data.layer=0;
   $('hotspots').hidden=false;setStatus('SOURCED SKELETON · 78 STRUCTURES');
   render();
  });
 }
 function travelKnee(){
  if(!state.completeTransfer())return false;
  const saved={...state.data.camera,target:{...state.data.camera.target}};
  $('seam').hidden=true;
  state.body();Object.assign(state.data.camera,saved);
  choose('knee');return true;
 }
 function syncControls(name){
  const trace=$('mode-trace'),peel=$('mode-peel'),output=$('layer-output');
  trace.disabled=true;
  trace.title='A continuous nerve path is not verified in this source-derived scene';
  peel.textContent=name==='knee'?'Isolate':'Peel';
  $('layer-slider').max='3';
  $('layer-slider').disabled=false;
  output.textContent=name==='hip'?'Surface':'Complete joint';
 }
 function depthChange(value){
  state.setDepth(value);
  const v=state.data.layer;
  $('layer-output').textContent=region==='hip'?['Surface','Stabilizers','Deep rotators','Skeleton'][v]:['Complete joint','Femur focus','Tibia / fibula','Patella focus'][Math.min(v,3)];
  if(v>0){
   state.mode('peel');
   document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-peel')));
  }
  render();
 }
 function setMode(mode){
  if(mode==='trace')return;
  if(!state.mode(mode))return;
  document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-'+mode)));
  $('context-note').textContent=mode==='trace'?'Sciatic nerve geometry comes from a separately registered atlas. Open the labeled Sciatic lab from the body overview; no continuous pathway is invented here.':mode==='peel'?'Peel through sourced hip muscles (or use the knee standalone lab for illustrative tissues). This is not a biomechanics simulation.':NOTE[region]||'Source-derived skeletal geometry.';
  render();
 }
 function reset(){
  if(!region)return;
  state.setDepth(0);$('layer-slider').value='0';
  $('layer-output').textContent=region==='hip'?'Surface':'Complete joint';
  state.mode('explore');
  document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-explore')));
  const c=state.data.camera;
  const home={yaw:shortestYaw(c.yaw,region==='hip'?Math.PI+.28:.47),pitch:-.11,
   zoom:region==='hip'?1.05:1.10,frameSpan:region==='hip'?3.4:3.2,target:centerPoint(region)};
  const id=++token;
  travel(home,reduce()?0:480,()=>{},()=>{if(id===token)render();});
 }
 return Object.freeze({choose,back,travelKnee,isActive,getRegion,getReveal,snapshot,depthChange,setMode,reset});
}
window.BodyAtlasUnified=Object.freeze({create});
})();