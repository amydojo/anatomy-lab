/* V6 Atlas Portal — navigation, preview-only region adapters and Evidence Lens. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const state=window.BodyAtlasState.create();
const loader=window.BodyAtlasLoader,model=window.BodyAtlasRenderer.create($('atlas-canvas'),reason=>fallback(reason));
const E=window.BodyAtlasEvidence;let source=null,proof=null,hipProof=null,nerveProof=null;
let lastFocus=null,activeFrameRoute=null,motionFrame=0,frameTimeout=0,seq=0,previousFocus=null,pins=[],loaded=false;
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERE={hip:'/hip/spatial/',nerve:'/hip/spatial/',knee:'/knee/spatial/',shoulder:'/shoulder/'};
const LABEL={hip:'RIGHT HIP',nerve:'SCIATIC NERVE',knee:'RIGHT KNEE',shoulder:'SHOULDER'};
const NOTE={
hip:'Source hip bones and muscles; muscle layer and joint movement remain illustrative, pending expert review.',
nerve:'Atlas-derived nerve registered to a separate skeletal source; nerve continuity is not independently imaged or reviewed.',
knee:'Source-matched right knee bones and illustrative soft tissues. Sciatic nerve does not continue through this scene.',
shoulder:'Legacy instructional anatomy; not source-reconstructed in the V6 spatial system.'};
const MODE_TEXT={explore:'Explore',peel:'Peel',trace:'Trace'};
function updateURL(){
 const q=new URLSearchParams(location.search);
 if(state.data.region)q.set('region',state.data.region);else q.delete('region');
 if(state.data.evidenceMode==='evidence')q.set('evidence','1');else q.delete('evidence');
 const suffix=q.toString();
 history.replaceState(null,'',location.pathname+(suffix?'?'+suffix:''));
}
function getFrameApi(){
 try{const win=$('region-frame').contentWindow;return state.data.region==='knee'?win.__BODY_SPATIAL__:win.__HIP_SPATIAL__;}
 catch{return null;}
}
function resize(){
 const rect=$('atlas-canvas').getBoundingClientRect();state.data.camera.width=rect.width;state.data.camera.height=rect.height;
 render();
}
function render(){if(document.hidden||state.data.view==='detail')return;
 model.render(state.data.camera,state.data.region,state.data.evidenceMode);
 drawPins();}
function fallback(reason){
 $('canvas-fallback').hidden=false;$('scene-status').textContent='SEMANTIC FALLBACK';
 $('canvas-fallback').querySelector('p').textContent=(reason||'3D unavailable')+'. Choose a region using the accessible list.';
 if(window.innerWidth<=850)setExpanded(true);
}
function sourceAnchor(id,kind='mean'){
 const part=source?.parts?.find(p=>p.id===id);
 if(!part)return null;
 const vs=part.vertices;
 if(kind==='proximal')return vs.reduce((a,p)=>p[1]>a[1]?p:a,vs[0]).map(Number);
 const stride=Math.max(1,Math.floor(vs.length/300)),sum=[0,0,0];let n=0;
 for(let i=0;i<vs.length;i+=stride){for(let j=0;j<3;j++)sum[j]+=vs[i][j];n++;}
 return sum.map(v=>v/n);
}
function centerPoint(region){
 let a=sourceAnchor(region==='knee'?'right-tibia':region==='shoulder'?'right-humerus':region==='thorax'?'body-of-sternum':'right-hip-bone',region==='knee'?'proximal':'mean');
 if(!a)a={hip:[-.7,-.6,0],nerve:[-.8,-1,0],knee:[-.8,-2.4,0],shoulder:[-1,2.2,0]}[region]||[0,0,0];
 if(region==='nerve')a=[a[0]-.10,a[1]-.25,a[2]-.17];
 return {x:a[0],y:a[1],z:a[2]};
}
function drawPins(){
 const canvas=$('atlas-canvas'),w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h||state.data.view==='detail')return;
 for(const el of pins){
  const point=centerPoint(el.dataset.region);const q=window.BodySpatialCore.project(point,{...state.data.camera,width:w,height:h});
  // Keep semantic region list available when the model is outside the viewport.
  let px=q.x,py=q.y;
  if(el.dataset.region==='nerve'){px+=Math.min(96,w*.23);py-=18;}
  if(el.dataset.region==='hip'){px-=Math.min(22,w*.055);py+=12;}
  el.style.left=Math.max(65,Math.min(w-65,px))+'px';
  el.style.top=Math.max(74,Math.min(h-120,py))+'px';
  el.setAttribute('aria-pressed',String(el.dataset.region===state.data.region));
 }
}
function buildPins(){
 const targets=[['shoulder','Shoulder'],['hip','Hip'],['nerve','Sciatic'],['knee','Knee']];
 $('hotspots').replaceChildren();pins=[];
 for(const [region,title] of targets){
  const b=document.createElement('button');b.type='button';b.className='hotspot';b.dataset.region=region;
  b.textContent=title;b.setAttribute('aria-label','Explore '+title+' reference anatomy');
  b.addEventListener('click',()=>choose(region));$('hotspots').appendChild(b);pins.push(b);
 }drawPins();
}
function animateCamera(destination,ms=530,done){
 cancelAnimationFrame(motionFrame);motionFrame=0;
 const cam=state.data.camera;const from={yaw:cam.yaw,pitch:cam.pitch,zoom:cam.zoom,frameSpan:cam.frameSpan,target:{...cam.target}};
 if(reduce()||ms===0){Object.assign(cam,destination);render();done?.();return;}
 const start=performance.now(),tick=t=>{
  const u=Math.min(1,(t-start)/ms),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
  for(const key of ['yaw','pitch','zoom','frameSpan'])cam[key]=from[key]+(destination[key]-from[key])*e;
  cam.target={x:from.target.x+(destination.target.x-from.target.x)*e,
   y:from.target.y+(destination.target.y-from.target.y)*e,z:from.target.z+(destination.target.z-from.target.z)*e};
  render();if(u<1&&!document.hidden)motionFrame=requestAnimationFrame(tick);else{motionFrame=0;done?.();}
 };
 motionFrame=requestAnimationFrame(tick);
}
function setExpanded(next){
 const e=!!next;$('atlas-sidebar').dataset.expanded=String(e);$('sidebar-toggle').setAttribute('aria-expanded',String(e));
 $('sidebar-icon').textContent=e?'⌄':'⌃';
 requestAnimationFrame(resize);
}
function choose(region){
 if(!state.select(region))return;const token=++seq;
 state.data.previous=lastFocus;lastFocus=region;
 $('panel-title').textContent=region==='nerve'?'Follow a living network.':region==='hip'?'Into the deep hip.':region==='knee'?'Inside the knee.':'The shoulder.';
 $('panel-description').textContent=NOTE[region];
 $('panel-kicker').textContent='REGION / '+LABEL[region]+' · EDUCATIONAL PREVIEW';
 $('sidebar-short').textContent=LABEL[region];
 $('stage-title').textContent=LABEL[region]+' · SOURCE FRAME';
 $('stage-caveat').textContent=NOTE[region];
 $('enter-region').disabled=false;$('enter-region').textContent='Enter '+LABEL[region]+' →';
 document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===region)));
 if(window.innerWidth<=850)setExpanded(false);
 updateURL();render();
 const q=centerPoint(region);const camera={yaw:region==='nerve'?Math.PI+.24:-.2,pitch:-.07,zoom:region==='nerve'?1.28:1.07,frameSpan:region==='shoulder'?5.3:region==='knee'?4.4:region==='nerve'?4.6:4.7,target:q};
 animateCamera(camera,reduce()?0:480,()=>{if(seq!==token)return;enter(region);});
}
function adaptEmbeddedFrame(frame,region){
 if(region==='shoulder')return;
 try{
  const doc=frame.contentDocument;
  if(!doc||doc.getElementById('atlas-embed-style'))return;
  const style=doc.createElement('style');style.id='atlas-embed-style';
  style.textContent='header.topbar{display:none!important}html,body,#app{height:100%!important}';
  doc.head.appendChild(style);
 }catch(err){console.warn('Atlas lab presentation:',err.message);}
}
function enableControls(region){
 const detail=state.data.view==='detail';
 $('layer-slider').disabled=!detail||region==='shoulder';
 $('layer-slider').max=region==='knee'?'3':'4';$('layer-slider').value='0';$('layer-output').textContent='Surface';
 $('open-original').hidden=!detail;$('continue-knee').hidden=!detail||!['nerve','hip'].includes(region);
 $('enter-region').disabled=true;$('enter-region').textContent=detail?'Inside '+LABEL[region]:'Choose a region';
 document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-explore')));
 $('back-body').hidden=!detail;
 $('top-continue-knee').hidden=!detail||!['hip','nerve'].includes(region);
}
function enter(region=state.data.region){
 if(!state.enter())return;const route=HERE[region];if(!route)return;
 const frame=$('region-frame');
 $('atlas-app').dataset.mode='detail';
 $('portal').hidden=false;$('hotspots').hidden=true;$('canvas-fallback').hidden=true;
 frame.title=LABEL[region]+' detailed anatomy demonstration';
 $('stage-title').textContent=LABEL[region]+' · DETAIL';
 $('scene-status').textContent='DETAIL / SOURCE WARNINGS APPLY';
 $('panel-kicker').textContent='EDUCATIONAL VIEW · NOT CLINICALLY VALIDATED';
 $('context-note').textContent=region==='nerve'?'Sciatic-to-knee continuity is NOT anatomically reconstructed. Use Continue toward Knee to view the explicit seam.':NOTE[region];
 enableControls(region);updateURL();
 activeFrameRoute=route;const token=++seq;
 const onLoad=()=>{
  if(seq!==token||state.data.view!=='detail')return;
  state.data.frameReady=true;adaptEmbeddedFrame(frame,region);$('portal-mask').hidden=true;
  if(region==='nerve')initNerve(token);
 };
 frame.onload=onLoad;
 $('portal-mask').hidden=false;
 frame.src=route;
}
function initNerve(token,attempt=0){
 if(token!==seq||state.data.view!=='detail'||state.data.region!=='nerve')return;
 const api=getFrameApi();
 if(api&&api.getState?.().nerveSourceLoaded){api.startFollow('sciatic');if(state.data.evidenceMode==='evidence')api.setNerveFrame('atlas');return;}
 if(attempt<65)frameTimeout=setTimeout(()=>initNerve(token,attempt+1),180);
 else $('scene-status').textContent='NERVE ASSET UNAVAILABLE · VIEW MAY BE SCHEMATIC';
}
function body(){
 ++seq;clearTimeout(frameTimeout);cancelAnimationFrame(motionFrame);motionFrame=0;
 const old=state.data.region;state.body();
 $('atlas-app').dataset.mode='overview';$('portal').hidden=true;$('portal-mask').hidden=true;
 $('region-frame').removeAttribute('src');$('region-frame').onload=null;
 $('hotspots').hidden=false;$('back-body').hidden=true;$('seam').hidden=true;
 $('panel-kicker').textContent='SOURCE-DERIVED REFERENCE';$('panel-title').textContent='The body, connected.';
 $('panel-description').textContent='Choose a region to inspect bones, muscles and nerves in spatial context. Reference anatomy is not one patient scan or a clinically validated reconstruction.';
 $('sidebar-short').textContent='Explore the body';$('stage-title').textContent='ONE BODY · MANY SYSTEMS';
 $('stage-caveat').textContent='BodyParts3D 4.0 · skeletal reference · CC BY 4.0 · unreviewed';
 $('scene-status').textContent=model.getStatus()==='ready'?'SOURCED SKELETON · 78 STRUCTURES':'2D FALLBACK';
 $('context-note').textContent='Some regions and relationships are estimated or not yet reconstructed. Evidence is accessible in one tap.';
 document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed','false'));
 enableControls(null);if(window.innerWidth<=850)setExpanded(false);updateURL();
 if(model.getStatus()!=='ready')$('canvas-fallback').hidden=false;
 render();
 if(old)lastFocus=old;
}
function seam(){
 if(!state.transfer())return;previousFocus=document.activeElement;$('seam').hidden=false;$('seam-cancel').focus();
}
function toKnee(){
 if(!state.completeTransfer())return;
 $('seam').hidden=true;state.data.region='knee';lastFocus='knee';
 $('panel-title').textContent='Inside the knee.';$('panel-description').textContent=NOTE.knee;
 $('panel-kicker').textContent='REGION / RIGHT KNEE · EDUCATIONAL PREVIEW';
 $('sidebar-short').textContent='RIGHT KNEE';
 $('stage-caveat').textContent='Reference change · sciatic nerve not reconstructed continuously';
 $('stage-title').textContent='RIGHT KNEE · SOURCE CONTEXT';
 $('context-note').textContent='Hip and Knee bones correspond to the same source frame, but the nerve is not reconstructed through this transition.';
 document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region==='knee')));
 enableControls('knee');updateURL();const token=++seq;
 const frame=$('region-frame');$('portal-mask').hidden=false;
 frame.onload=()=>{if(token===seq){state.data.frameReady=true;adaptEmbeddedFrame(frame,'knee');$('portal-mask').hidden=true;}};
 frame.src=HERE.knee;
}
function setMode(mode){
 if(!state.mode(mode))return;
 document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-'+mode)));
 if(state.data.view!=='detail'){
  if(mode==='peel'||mode==='trace')$('context-note').textContent='Choose a region first. Peel and Trace operate on selected anatomical systems.';
  return;
 }
 const api=getFrameApi();if(!api)return;
 if(mode==='peel'){api.depth?.(state.data.layer||1);api.setDepth?.(state.data.layer||1);}
 if(mode==='trace'&&['hip','nerve'].includes(state.data.region)){
  api.startFollow?.('sciatic');state.data.mode='trace';$('layer-slider').value=3;$('layer-output').textContent='Nerve';
 }else if(mode==='trace')$('context-note').textContent='No sourced continuous sciatic nerve has been reconstructed in this region.';
}
function depthChange(value){
 state.setDepth(value);
 const v=state.data.layer;const region=state.data.region;
 $('layer-output').textContent=region==='hip'||region==='nerve'?['Surface','Stabilizers','Deep rotators','Nerve','Skeleton'][v]:['All','Deeper','Ligaments','Bone only'][Math.min(v,3)];
 const api=getFrameApi();if(region==='hip'||region==='nerve')api?.depth?.(v);else if(region==='knee')api?.setDepth?.(Math.min(v,3));
 if(state.data.view==='detail')setMode('peel');
}
function showEvidence(){
 previousFocus=document.activeElement;state.data.evidence=true;$('evidence-sheet').hidden=false;
 $('evidence-toggle').setAttribute('aria-expanded','true');renderEvidence();
 $('evidence-close').focus();
}
async function renderEvidence(){
 let names=['provenance'];if(['hip','nerve'].includes(state.data.region))names.push('hip');
 if(state.data.region==='nerve')names.push('nerve');
 const collected=await Promise.all(names.map(async key=>{try{return [key,await loader.load(key)];}catch{return [key,null];}}));
 for(const [name,obj] of collected){if(name==='provenance')proof=obj;if(name==='hip')hipProof=obj;if(name==='nerve')nerveProof=obj;}
 if(!state.data.evidence)return;
 $('evidence-intro').textContent='Origin and expert review are separate. Neither a licensed atlas nor a smooth camera transition is medical validation.';
 const list=E.records(state.data.region||'overview',proof,hipProof,nerveProof);
 $('evidence-records').replaceChildren();
 for(const entry of list){
  const box=document.createElement('article');box.className='evidence-record';
  const tag=document.createElement('span');tag.className='overline';tag.textContent=entry.tag;
  const title=document.createElement('strong');title.textContent=entry.title;
  const lab=document.createElement('div');lab.className='fact';lab.textContent=entry.label;
  const p=document.createElement('p');p.textContent=entry.content;
  box.append(tag,title,lab,p);$('evidence-records').appendChild(box);
 }
}
function closeEvidence(){state.data.evidence=false;$('evidence-sheet').hidden=true;$('evidence-toggle').setAttribute('aria-expanded','false');previousFocus?.focus?.();}
function setEvidence(mode){
 if(!state.setEvidence(mode))return;
 document.querySelectorAll('[data-evidence]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.evidence===mode)));
 const api=getFrameApi();if((state.data.region==='hip'||state.data.region==='nerve')&&api?.setNerveFrame)api.setNerveFrame(mode==='evidence'?'atlas':'composite');
 updateURL();render();
}
function reset(){
 if(state.data.view==='detail'){getFrameApi()?.reset?.();$('layer-slider').value=0;state.setDepth(0);$('layer-output').textContent='Surface';return;}
 animateCamera({yaw:-.2,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}},reduce()?0:320);
}
function setup(){
 const canvas=$('atlas-canvas');
 window.BodySpatialCore.attachOrbit(canvas,{state:state.data.camera,render,pick:()=>{}});
 window.addEventListener('resize',resize,{passive:true});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('atlas-stage'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(motionFrame);motionFrame=0;clearTimeout(frameTimeout);}else render();});
 window.addEventListener('pagehide',()=>{loader.cancel();model.dispose();clearTimeout(frameTimeout);cancelAnimationFrame(motionFrame);});
 $('sidebar-toggle').onclick=()=>setExpanded($('atlas-sidebar').dataset.expanded!=='true');
 document.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.region)));
 $('enter-region').onclick=()=>enter();
 $('continue-knee').onclick=seam;
 $('top-continue-knee').onclick=seam;
 $('seam-cancel').onclick=()=>{state.closeSeam();$('seam').hidden=true;previousFocus?.focus?.();};
 $('seam-continue').onclick=toKnee;
 $('back-body').onclick=body;
 $('reset-view').onclick=reset;
 $('open-original').onclick=()=>{const route=HERE[state.data.region];if(route)window.open(route,'_blank','noopener,noreferrer');};
 $('evidence-toggle').onclick=showEvidence;$('evidence-close').onclick=closeEvidence;
 $('evidence-sheet').addEventListener('click',e=>{if(e.target===$('evidence-sheet'))closeEvidence();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('seam').hidden){state.closeSeam();$('seam').hidden=true;}else if(!$('evidence-sheet').hidden)closeEvidence();else if(state.data.view==='detail')body();}});
 document.querySelectorAll('[data-evidence]').forEach(b=>b.onclick=()=>setEvidence(b.dataset.evidence));
 document.querySelectorAll('.seg-control button').forEach(b=>b.onclick=()=>setMode(b.id.replace('mode-','')));
 $('layer-slider').oninput=e=>depthChange(e.target.value);
 buildPins();resize();
 Promise.all([loader.load('atlas'),loader.load('provenance')]).then(([asset,provenance])=>{
  source=asset;proof=provenance;loaded=true;
  if(provenance.part_count!==asset.parts.length||provenance.pinned_commit!==asset.source_commit)throw Error('Atlas model manifest mismatch');
  model.load(asset);$('scene-status').textContent=model.getStatus()==='ready'?'SOURCED SKELETON · 78 STRUCTURES':'2D FALLBACK';
  if(model.getStatus()!=='ready')fallback('WebGL2 unavailable');
  resize();
  const route=new URLSearchParams(location.search).get('region');if(route&&window.BodyAtlasState.regions.includes(route))choose(route);
  if(new URLSearchParams(location.search).get('evidence')==='1'){setEvidence('evidence');showEvidence();}
 }).catch(err=>fallback(err.message));
}
window.__BODY_ATLAS__={getState:()=>({...state.snapshot(),renderer:model.stats(),assetsLoaded:loaded,pins:pins.length,viewport:{width:$('atlas-canvas').clientWidth,height:$('atlas-canvas').clientHeight}}),choose,enter,body,toKnee,seam,showEvidence,closeEvidence,setEvidence,setMode};
setup();
})();