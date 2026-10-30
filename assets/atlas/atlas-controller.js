/* V6 Atlas Portal — navigation, preview-only region adapters and Evidence Lens. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const state=window.BodyAtlasState.create();
const loader=window.BodyAtlasLoader,model=window.BodyAtlasRenderer.create($('atlas-canvas'),reason=>fallback(reason));
const E=window.BodyAtlasEvidence;let source=null,proof=null,hipProof=null,nerveProof=null,shoulderProof=null,kneeMuscleProof=null,extendedProof=null,overviewProof=null;
let osteologyAsset=null;let lastFocus=null,activeFrameRoute=null,motionFrame=0,travelMixFrame=0,frameTimeout=0,entryTimer=0,exitTimer=0,seq=0,previousFocus=null,pins=[],loaded=false,overviewLoaded=false,expansionLoaded=false,facialLoaded=false,osteologyLoaded=false,pendingEntry=null,sourceSeamPending=false;
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERE={hip:'/hip/spatial/',nerve:'/hip/spatial/',knee:'/knee/spatial/',shoulder:'/shoulder/'};
const LABEL={hip:'RIGHT HIP',nerve:'SCIATIC NERVE',knee:'RIGHT KNEE',shoulder:'SHOULDER',
 skull:'SKULL & JAW',neck:'CERVICAL SPINE',thorax:'RIBS & THORAX',
 elbow:'RIGHT ELBOW',wrist:'RIGHT WRIST',ankle:'RIGHT ANKLE'};
const NOTE={
hip:'Source hip bones and muscles; muscle layer and joint movement remain illustrative, pending expert review.',
nerve:'Atlas-derived nerve registered to a separate skeletal source; nerve continuity is not independently imaged or reviewed.',
knee:'Source-matched right knee bones and five real imported muscle surfaces with inferred attachment-guided flexion. Missing ligaments, menisci and nerve geometry are not fabricated.',
shoulder:'Source-matched scapula, clavicle and humerus with four sourced rotator-cuff muscle surfaces. Deltoid/ligament/labrum/nerve coverage is incomplete; abduction is illustrative.',
 skull:'Fourteen real cranial and facial bones. Sutures, teeth, cartilage and temporomandibular disc mechanics are not reconstructed.',
 neck:'Atlas, axis, C3–C7 and hyoid. Cervical ligaments, discs and measured neck motion are not yet reconstructed.',
 thorax:'Twenty-four sourced ribs, sternum parts and thoracic spinal landmarks. Costal cartilage and respiratory mechanics are not modeled.',
 elbow:'Three real elbow bones with a simple teaching flexion hinge; no ligaments or validated radioulnar rotation.',
 wrist:'Eight sourced carpals, five metacarpals and forearm bones. The illustrative wrist hinge is not validated intercarpal kinematics.',
 ankle:'Talus, calcaneus and other real foot/tarsal bones plus the right tibia/fibula. Dorsiflexion is illustrative, without ligament or tendon mechanics.'};
const MODE_TEXT={explore:'Explore',peel:'Peel',trace:'Trace'};
const REGION_ALIAS={ribs:'thorax',cervical:'neck',sciatic:'nerve',foot:'ankle',hand:'wrist'};
const routeRegion=raw=>{const normalized=REGION_ALIAS[raw]||raw;return window.BodyAtlasState.regions.includes(normalized)?normalized:null;};
let restoringHistory=false;
function updateURL({replace=false}={}){
 const q=new URLSearchParams(location.search);
 if(state.data.region)q.set('region',state.data.region);else q.delete('region');
 if(state.data.region&&state.data.view==='detail'){
  if(state.data.layer)q.set('layer',String(state.data.layer));else q.delete('layer');
  if(['peel','trace'].includes(state.data.mode))q.set('tool',state.data.mode);else q.delete('tool');
  const id=U.getSelected();if(id)q.set('structure',id);else q.delete('structure');
 }else{q.delete('layer');q.delete('tool');q.delete('structure');}
 if(state.data.evidenceMode==='evidence')q.set('evidence','1');else q.delete('evidence');
 const suffix=q.toString(),url=location.pathname+(suffix?'?'+suffix:'');
 if(url===location.pathname+location.search||restoringHistory)return;
 const changedRegion=new URLSearchParams(location.search).get('region')!==state.data.region;
 history[replace||!changedRegion?'replaceState':'pushState']({atlas:true},'',url);
}
function getFrameApi(){
 try{const win=$('region-frame').contentWindow;return state.data.region==='knee'?win.__BODY_SPATIAL__:win.__HIP_SPATIAL__;}
 catch{return null;}
}
function resize(){
 const rect=$('atlas-canvas').getBoundingClientRect();state.data.camera.width=rect.width;state.data.camera.height=rect.height;
 render();
}
function refreshOsteologyCoverage(){
 const st=model.stats();
 const bones=st.partCount+st.overviewBones+st.expansionBones+st.osteologyBones;
 const muscles=st.overviewMuscles+st.expansionMuscles+st.facialMuscles;
 $('overview-coverage').textContent=bones+' BONE MESHES · '+muscles+' MUSCLE MESHES';
 $('stage-caveat').textContent=(osteologyLoaded?'206/206':'199/206')+
  ' conventional bones · BP3D 4.0 CC BY 4.0 · BP3D 3.0 facial CC BY-SA 2.1 Japan · Z-Anatomy CC BY-SA 4.0 · expert review pending';
}
function render(){
 if(document.hidden||(state.data.view==='detail'&&!U.isActive()))return;
 model.render(state.data.camera,U.getRegion()||state.data.region,state.data.evidenceMode,state.data.layer,U.getReveal(),U.getMotion(),U.getSelected(),U.getSecondaryMotion(),U.getTransitionFrom());
 window.BodyShoulderDebug?.draw(state.data.camera,
  state.data.view==='detail'&&U.getRegion()==='shoulder'?model.shoulderDiagnostics(U.getMotion()):null);
 if(state.data.view==='overview'&&!U.isActive())drawPins();
}
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
 if(kind==='distal')return vs.reduce((a,p)=>p[1]<a[1]?p:a,vs[0]).map(Number);
 const stride=Math.max(1,Math.floor(vs.length/300)),sum=[0,0,0];let n=0;
 for(let i=0;i<vs.length;i+=stride){for(let j=0;j<3;j++)sum[j]+=vs[i][j];n++;}
 return sum.map(v=>v/n);
}
// Both skeletal lab datasets come from the same pinned BodyParts3D 4.0 frame.
// Their display origins are different; these anchors are exact source-frame
// conversions, NOT estimated screen-space positions or nerve registration.
const SOURCE_PIVOT={
 hip:{x:-.057*5,y:(.895-.9)*5,z:-.045*5},
 knee:{x:-.09092915*5,y:(.4491462-.9)*5,z:-.01654605*5}
};
function centerPoint(region){
 const expanded=window.BodyExtendedRegions?.config[region];
 if(expanded){
  const p=sourceAnchor(expanded.anchor,expanded.anchorMode)||[0,0,0];
  return {x:p[0]+expanded.delta[0],y:p[1]+expanded.delta[1],z:p[2]+expanded.delta[2]};
 }
 if(region==='hip'||region==='knee')return {...SOURCE_PIVOT[region]};
 if(region==='nerve')return {...SOURCE_PIVOT.hip};
 if(region==='shoulder'){
  const a=sourceAnchor('right-humerus','proximal')||[-1.2,2.1,0];
  return {x:a[0]-.13,y:a[1]-.80,z:a[2]};
 }
 let a=sourceAnchor('body-of-sternum','mean');
 if(!a)a={shoulder:[-1,2.2,0],thorax:[0,1.3,0]}[region]||[0,0,0];
 return {x:a[0],y:a[1],z:a[2]};
}
function shortestYaw(from,to){
 return from+Math.atan2(Math.sin(to-from),Math.cos(to-from));
}
function isSourceAligned(region){return region==='hip'||region==='knee'||region==='shoulder'||!!window.BodyExtendedRegions?.has(region);}
function labAPI(region){
 const w=$('region-frame').contentWindow;
 try{return region==='knee'?w.__BODY_SPATIAL__:w.__HIP_SPATIAL__;}catch{return null;}
}
function sourceCameraFor(region){
 const parent=$('atlas-canvas'),child=$('region-frame').contentDocument;
 const specimen=child?.getElementById(region==='knee'?'knee-canvas':'hip-canvas');
 const aw=parent.clientWidth,ah=parent.clientHeight;
 const dw=specimen?.clientWidth||0,dh=specimen?.clientHeight||0;
 if(!aw||!ah||!dw||!dh)return null;
 const cam=state.data.camera;
 const frameSpan=region==='hip'?(window.innerWidth<=850?3.35:4.5):2.65;
 const atlasPx=Math.min(aw/3.25,ah/cam.frameSpan)*cam.zoom;
 const labPx=Math.min(dw/3.25,dh/frameSpan);
 // Parent coordinates are (metres - [0,.9,0])*5. Detail coordinates
 // are (metres - regionSourceOrigin)*10 (Hip) or *7.5 (Knee).
 const units=region==='hip'?10:7.5;
 const zoom=atlasPx*(5/units)/labPx;
 if(!Number.isFinite(zoom)||zoom<=0)return null;
 return {yaw:cam.yaw,pitch:cam.pitch,zoom,frameSpan,anchorY:.5-(.04*labPx*zoom)/dh,sourceOrigin:region};
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
// Tapping the actual source-backed skeleton should work like tapping a hotspot,
 // without claiming we have reconstructed unlabeled or missing anatomy.
function pickAt(x,y){
 if(U.isActive()&&state.data.view==='detail')return U.pickAt(x,y);
 if(state.data.view!=='overview'||!source||model.getStatus()!=='ready')return null;
 const canvas=$('atlas-canvas'),w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return null;
 const c={...state.data.camera,width:w,height:h};
 let best=null,distance=Infinity;
 for(const region of ['hip','knee','shoulder','skull','neck','thorax','elbow','wrist','ankle']){
  const p=window.BodySpatialCore.project(centerPoint(region),c);
  const d=Math.hypot(x-p.x,y-p.y);
  if(d<distance){distance=d;best=region;}
 }
 const radius=Math.max(45,Math.min(82,w*.18));
 if(distance>radius)return null;
 choose(best);return best;
}
function buildPins(){
 const targets=[['shoulder','Shoulder'],['hip','Hip'],['nerve','Sciatic'],['knee','Knee'],
  ['skull','Skull'],['neck','Neck'],['thorax','Ribs'],['elbow','Elbow'],['wrist','Wrist'],['ankle','Ankle']];
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
// A region selection is a camera journey. The destination lab preloads invisibly;
 // no iframe or loading screen may replace the atlas until travel and load finish.
// One continuous world-space travel. The matched lab never shows its own
// default camera; the hip/knee source-frame pose is sent before revealing it.
function choose(region){
 if(osteologyLoaded)model.setOsteologyFocus(null);
 if(isSourceAligned(region)&&model.getStatus()!=='ready'){
  // WebGL is a prerequisite for spatial continuity. Preserve functional
  // semantic navigation rather than silently ignoring region taps.
  if(HERE[region])location.assign(HERE[region]);
  else fallback('This region requires an available WebGL source viewer');
  return;
 }
 if(isSourceAligned(region))return U.choose(region);
 if(U.isActive())return U.nextRegion(region);
 if(state.data.view==='detail'||!window.BodyAtlasState.regions.includes(region))return;
 ++seq;const token=seq;
 clearTimeout(frameTimeout);clearTimeout(entryTimer);clearTimeout(exitTimer);
 cancelAnimationFrame(motionFrame);cancelAnimationFrame(travelMixFrame);
 motionFrame=travelMixFrame=0;pendingEntry=null;
 if(!state.select(region))return;
 state.data.previous=lastFocus;lastFocus=region;
 $('panel-title').textContent=region==='nerve'?'Follow a separately registered nerve.':region==='hip'?'Into the deep hip.':region==='knee'?'Inside the knee.':'The shoulder.';
 $('panel-description').textContent=NOTE[region];
 $('panel-kicker').textContent='REGION / '+LABEL[region]+' · EDUCATIONAL PREVIEW';
 $('sidebar-short').textContent=LABEL[region];
 $('stage-title').textContent=LABEL[region]+' · APPROACH';
 $('stage-caveat').textContent=region==='knee'&&sourceSeamPending?'Reference change · sciatic nerve not reconstructed continuously':NOTE[region];
 sourceSeamPending=false;
 $('scene-status').textContent='TRAVELING INTO '+LABEL[region];
 $('enter-region').disabled=true;$('enter-region').textContent='Entering '+LABEL[region]+'…';
 $('back-body').hidden=false;$('top-enter-region').hidden=true;
 document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===region)));
 if(window.innerWidth<=850)setExpanded(false);
 $('atlas-app').dataset.mode=isSourceAligned(region)?'overview':'focus';
 $('hotspots').hidden=true;updateURL();render();
 const aligned=isSourceAligned(region);
 const portal=$('portal'),frame=$('region-frame');
 portal.hidden=!aligned;portal.dataset.phase='preload';
 portal.setAttribute('inert','');portal.setAttribute('aria-hidden','true');
 $('portal-mask').hidden=true;
 pendingEntry={region,token,ready:false,traveled:false,matched:aligned};
 if(aligned){
  frame.title=LABEL[region]+' detailed anatomy demonstration';
  frame.onload=()=>{
   if(seq!==token||pendingEntry?.region!==region)return;
   try{if(frame.contentWindow.location.pathname!==HERE[region])return;}catch{return;}
   adaptEmbeddedFrame(frame,region);
   checkSourceReady(token);
  };
  frame.src=HERE[region];
  entryTimer=setTimeout(()=>{
   if(token!==seq||pendingEntry?.ready)return;
   $('scene-status').textContent='SOURCE VIEW UNAVAILABLE · REMAINING IN ATLAS';
   $('enter-region').disabled=false;
   $('enter-region').textContent='Try detail again ↗';
   $('top-enter-region').hidden=false;
   $('top-enter-region').textContent='Try detail ↗';
  },15000);
 }else{
  // This branch has no camera-compatible 3D model. Never pretend the
  // independent nerve composite or 2D shoulder is continuous source geometry.
  frame.onload=null;frame.removeAttribute('src');
 }
 const toYaw=region==='hip'||region==='nerve'?Math.PI+.28:region==='knee'?.47:Math.PI+.32;
 const close={yaw:shortestYaw(state.data.camera.yaw,toYaw),pitch:-.11,
  zoom:1.36,frameSpan:region==='knee'?1.65:region==='shoulder'?2.15:1.85,
  target:centerPoint(region)};
 animateCamera(close,reduce()?0:1150,()=>{
  if(seq!==token||!pendingEntry)return;
  pendingEntry.traveled=true;
  $('stage-title').textContent=LABEL[region]+' · CLOSE VIEW';
  if(aligned){
   if(!pendingEntry.ready)$('scene-status').textContent='ALIGNING SOURCE CAMERA';
   finishEntry(token);
  }else{
   $('scene-status').textContent=region==='nerve'?'SEPARATE REGISTERED NERVE REFERENCE':'ILLUSTRATIVE SHOULDER REFERENCE';
   $('enter-region').disabled=false;
   $('enter-region').textContent=region==='nerve'?'Open nerve source viewer ↗':'Open shoulder lab ↗';
   $('top-enter-region').textContent=region==='nerve'?'Follow nerve ↗':'Open shoulder ↗';
   $('top-enter-region').hidden=false;
  }
 });
}
function checkSourceReady(token,tries=0){
 const task=pendingEntry;
 if(!task||token!==seq||!task.matched)return;
 const api=labAPI(task.region),st=api?.getState?.();
 const loaded=task.region==='hip'?st?.sourceLoaded:st?.sourcedBoneCount>=4;
 if(loaded){
  // Do not lock the child camera while the parent is still traveling.
  // The final source-camera position is computed exactly at reveal time.
  task.ready=true;clearTimeout(entryTimer);finishEntry(token);return;
 }
 if(tries<150)frameTimeout=setTimeout(()=>checkSourceReady(token,tries+1),90);
 else $('scene-status').textContent='COULD NOT ALIGN SOURCE VIEW · STAYING IN ATLAS';
}
function finishEntry(token){
 const task=pendingEntry;
 if(!task||task.token!==seq||!task.matched||!task.ready||!task.traveled)return;
 // The model is now at its FINAL end pose, and both viewports have
 // their permanent dimensions. Calibrate once, just before cross-dissolve.
 const match=sourceCameraFor(task.region);
 if(!match||!labAPI(task.region)?.prepareAtlasEntry?.(match)){
  $('scene-status').textContent='SOURCE CAMERA UNAVAILABLE · KEEPING ATLAS VIEW';
  $('enter-region').disabled=false;$('enter-region').textContent='Retry close view ↗';
  return;
 }
 if(!state.enter())return;
 const region=task.region,portal=$('portal');
 state.data.frameReady=true;
 $('atlas-app').dataset.mode='detail';
 $('stage-title').textContent=LABEL[region]+' · DETAIL';
 $('scene-status').textContent='SOURCE-FRAME MATCH · ANATOMY UNREVIEWED';
 $('panel-kicker').textContent='EDUCATIONAL VIEW · NOT CLINICALLY VALIDATED';
 $('context-note').textContent=NOTE[region];
 $('portal-mask').hidden=true;
 portal.removeAttribute('inert');portal.setAttribute('aria-hidden','false');
 portal.dataset.phase='entering';activeFrameRoute=HERE[region];
 enableControls(region);updateURL();
 const api=labAPI(region);
 // First the identical source-frame bones, then the new muscle/schematic
 // tissue overlays. They must never appear by snapping to a new camera.
 if(reduce()){api?.setAtlasEntryMix?.(1);}
 else{
  const begin=performance.now();
  function step(now){
   if(token!==seq)return;
   const t=Math.min(1,(now-begin)/850);
   const eased=t*t*(3-2*t);
   api?.setAtlasEntryMix?.(eased);
   if(t<1)travelMixFrame=requestAnimationFrame(step);
  }
  travelMixFrame=requestAnimationFrame(step);
 }
 requestAnimationFrame(()=>{if(seq===token)portal.dataset.phase='active';});
}
function enterUnmatchedRegion(region,force=false){
 if(state.data.view!=='focused'||(!force&&isSourceAligned(region))||region!==state.data.region)return;
 if(!state.enter())return;
 ++seq;clearTimeout(frameTimeout);cancelAnimationFrame(motionFrame);
 const frame=$('region-frame'),portal=$('portal'),token=seq;
 frame.title=LABEL[region]+' separate educational laboratory';
 portal.hidden=false;portal.dataset.phase='preload';
 portal.setAttribute('aria-hidden','true');portal.setAttribute('inert','');
 $('atlas-app').dataset.mode='detail';
 $('hotspots').hidden=true;$('top-enter-region').hidden=true;
 $('scene-status').textContent='OPENING SEPARATELY SOURCED REFERENCE';
 $('context-note').textContent=NOTE[region];
 enableControls(region);updateURL();
 frame.onload=()=>{
  if(seq!==token)return;
  adaptEmbeddedFrame(frame,region);
  state.data.frameReady=true;
  portal.removeAttribute('inert');portal.setAttribute('aria-hidden','false');
  portal.dataset.phase='entering';
  if(region==='nerve')initNerve(token);
  requestAnimationFrame(()=>{if(seq===token)portal.dataset.phase='active';});
 };
 frame.src=HERE[region];
}
function adaptEmbeddedFrame(frame,region){
 try{
  const doc=frame.contentDocument;
  if(!doc||doc.getElementById('atlas-embed-style'))return;
  const style=doc.createElement('style');style.id='atlas-embed-style';
  // On the child page the inspector was a layout column/row, which reduced
  // canvas dimensions on handoff. Put it above the canvas instead so matching
  // source bones stay on the exact same screen pixels before/after reveal.
  style.textContent=[
   'header.topbar{display:none!important}',
   'html,body,#app{height:100%!important;min-height:0!important;overflow:hidden!important}',
   '#app>.workspace,.workspace{display:block!important;position:relative!important;height:100%!important;min-height:0!important}',
   '.workspace>.stage,.stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important}',
   '.workspace>.inspector,.inspector{position:absolute!important;z-index:5!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;height:100%!important}',
   '@media(max-width:850px){.workspace>.inspector,.inspector{top:auto!important;bottom:0!important;right:0!important;left:0!important;width:100%!important;height:124px!important}}',
   '@media(max-width:850px) and (max-height:680px){.workspace>.inspector,.inspector{height:90px!important}}'
  ].join('');
  doc.head.appendChild(style);
  // Children need their final viewport before the parent computes the
  // source-frame camera; ResizeObserver will be followed by the readiness poll.
 }catch(err){console.warn('Atlas lab presentation:',err.message);}
}
function enableControls(region){
 const detail=state.data.view==='detail';
 const unified=detail&&U.isActive()&&isSourceAligned(region);
 $('layer-slider').disabled=!detail||region==='shoulder';
 $('layer-slider').max=region==='knee'?'3':'4';$('layer-slider').value='0';$('layer-output').textContent='Surface';
 $('open-original').hidden=!detail||!!window.BodyExtendedRegions?.has(region);$('continue-knee').hidden=!detail||!['nerve','hip'].includes(region);
 $('enter-region').disabled=true;$('enter-region').textContent=detail?'Inside '+LABEL[region]:'Choose a region';
 document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-explore')));
 $('back-body').hidden=!detail;
 $('top-enter-region').hidden=true;
 $('top-continue-knee').hidden=!detail||!['hip','nerve'].includes(region);
 if(unified){$('layer-slider').disabled=false;$('layer-slider').max=region==='hip'?'4':'3';}
}
function enter(region=state.data.region){
 if(!region||state.data.view==='detail')return;
 if(isSourceAligned(region)&&!U.isActive()){enterUnmatchedRegion(region,true);return;}
 if(U.isActive())return;
 if(!isSourceAligned(region)){enterUnmatchedRegion(region);return;}
 if(pendingEntry?.region===region){
  if(pendingEntry.ready&&pendingEntry.traveled)finishEntry(pendingEntry.token);
  else if(!pendingEntry.ready)choose(region);
 }else choose(region);
}
function initNerve(token,attempt=0){
 if(token!==seq||state.data.view!=='detail'||state.data.region!=='nerve')return;
 const api=getFrameApi();
 if(api&&api.getState?.().nerveSourceLoaded){api.startFollow('sciatic');if(state.data.evidenceMode==='evidence')api.setNerveFrame('atlas');return;}
 if(attempt<65)frameTimeout=setTimeout(()=>initNerve(token,attempt+1),180);
 else $('scene-status').textContent='NERVE ASSET UNAVAILABLE · VIEW MAY BE SCHEMATIC';
}
function body(){
 if(U.isActive())return U.back();
 ++seq;clearTimeout(frameTimeout);clearTimeout(entryTimer);clearTimeout(exitTimer);
 cancelAnimationFrame(motionFrame);cancelAnimationFrame(travelMixFrame);motionFrame=travelMixFrame=0;pendingEntry=null;
 const old=state.data.region;
 const cam=state.data.camera;
 const from={yaw:cam.yaw,pitch:cam.pitch,zoom:cam.zoom,frameSpan:cam.frameSpan,target:{...cam.target}};
 state.body();
 const home={...state.data.camera,target:{...state.data.camera.target}};
 // Return along the same viewing direction; flipping to a default front view
 // mid-flight would break the user's sense of where they are in the body.
 home.yaw=from.yaw;home.pitch=from.pitch;
 Object.assign(state.data.camera,from);
 // Preserve the destination viewport until it has faded; resizing an active
 // embedded lab would look like another page jump on mobile.
 const portal=$('portal');portal.dataset.phase='leaving';
 portal.setAttribute('inert','');portal.setAttribute('aria-hidden','true');
 $('portal-mask').hidden=true;
 $('hotspots').hidden=false;$('back-body').hidden=true;$('top-enter-region').hidden=true;$('seam').hidden=true;
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
 const token=seq;
 animateCamera(home,reduce()?0:740,()=>{if(seq===token)render();});
 exitTimer=setTimeout(()=>{
  if(seq!==token)return;
  $('atlas-app').dataset.mode='overview';
  portal.hidden=true;portal.dataset.phase='preload';
  $('region-frame').onload=null;$('region-frame').removeAttribute('src');
 },reduce()?0:490);
 if(old)lastFocus=old;
}

function seam(){
 if(!state.transfer())return;previousFocus=document.activeElement;$('seam').hidden=false;$('seam-cancel').focus();
}
function toKnee(){
 if(U.isActive()&&U.getRegion()==='hip')return U.travelKnee();
 if(!state.completeTransfer())return;
 sourceSeamPending=true;
 $('seam').hidden=true;
 // First dissolve back onto the actual shared-frame bones. Then travel from hip
 // to knee, preserving the explicit nerve reference-boundary disclosure.
 const token=++seq,portal=$('portal');
 clearTimeout(frameTimeout);clearTimeout(entryTimer);clearTimeout(exitTimer);
 portal.dataset.phase='leaving';portal.setAttribute('inert','');portal.setAttribute('aria-hidden','true');
 $('portal-mask').hidden=true;
 state.select('knee');$('hotspots').hidden=true;render();
 exitTimer=setTimeout(()=>{
  if(seq!==token)return;
  portal.hidden=true;
  $('atlas-app').dataset.mode='overview';
  $('region-frame').onload=null;$('region-frame').removeAttribute('src');
  choose('knee');
 },reduce()?0:420);
}

function setMode(mode){
 if(U.isActive())return U.setMode(mode);
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
 if(U.isActive())return U.depthChange(value);
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
 if(state.data.region==='shoulder')names.push('shoulderProof');
 if(state.data.region==='knee')names.push('kneeMuscleProof');
 if(window.BodyExtendedRegions?.has(state.data.region))names.push('extendedProof');
 const collected=await Promise.all(names.map(async key=>{try{return [key,await loader.load(key)];}catch{return [key,null];}}));
 for(const [name,obj] of collected){if(name==='provenance')proof=obj;if(name==='hip')hipProof=obj;if(name==='nerve')nerveProof=obj;if(name==='shoulderProof')shoulderProof=obj;if(name==='kneeMuscleProof')kneeMuscleProof=obj;if(name==='extendedProof')extendedProof=obj;}
 if(!state.data.evidence)return;
 $('evidence-intro').textContent='Origin and expert review are separate. Neither a licensed atlas nor a smooth camera transition is medical validation.';
 const list=E.records(state.data.region||'overview',proof,hipProof,nerveProof,shoulderProof,kneeMuscleProof,extendedProof,overviewProof);
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
 if(U.isActive())return U.reset();
 if(state.data.view==='detail'){getFrameApi()?.reset?.();$('layer-slider').value=0;state.setDepth(0);$('layer-output').textContent='Surface';return;}
 animateCamera({yaw:-.2,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}},reduce()?0:320);
}
let studioFramingFrame=0;
function setInspectorFrame(visible,instant=false){
 const camera=state.data.camera;
 const width=Math.max(1,$('atlas-canvas').clientWidth);
 // A 355px inspector + 90px tool rail must not hide the specimen.
 const target=(visible&&window.innerWidth>850)?Math.max(.30,.5-Math.min(152,Math.max(99,width*.101))/width):.5;
 const start=Number.isFinite(camera.anchorX)?camera.anchorX:.5;
 cancelAnimationFrame(studioFramingFrame);studioFramingFrame=0;
 if(Math.abs(target-start)<.0002)return target;
 if(instant||reduce()){camera.anchorX=target;render();return target;}
 const at=performance.now(),length=270;
 function step(now){
  const u=Math.min(1,(now-at)/length),ease=1-Math.pow(1-u,3);
  camera.anchorX=start+(target-start)*ease;
  render();
  if(u<1)studioFramingFrame=requestAnimationFrame(step);else studioFramingFrame=0;
 }
 studioFramingFrame=requestAnimationFrame(step);
 return target;
}
function focusOsteology(kind){
 if(!osteologyAsset||!osteologyLoaded||!['left-ear','right-ear','coccyx'].includes(kind))return false;
 const region=U.getRegion();
 if(kind==='coccyx'?region!=='hip':region!=='skull')return false;
 const ids=kind==='coccyx'?['z-v11-coccyx']:
  ['malleus','incus','stapes'].map(name=>'z-v11-'+kind.split('-')[0]+'-'+name);
 const parts=ids.map(id=>osteologyAsset.bones[id]);
 if(parts.some(p=>!p))return false;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const p of parts)for(const v of p.vertices)for(let i=0;i<3;i++){
  min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);
 }
 const center={x:(min[0]+max[0])/2,y:(min[1]+max[1])/2,z:(min[2]+max[2])/2};
 model.setOsteologyFocus(kind);
 animateCamera({yaw:kind==='coccyx'?-.18:-.46,pitch:kind==='coccyx'?-.07:.06,
  zoom:1.0,frameSpan:kind==='coccyx'?.48:.19,target:center},reduce()?0:460);
 return true;
}
function clearOsteologyFocus(){
 model.setOsteologyFocus(null);
 if(U.getRegion()&&state.data.view==='detail')U.recenter();
 render();return true;
}
function recenter(){
 if(U.isActive()&&state.data.view==='detail')return U.recenter();
 animateCamera({yaw:-.2,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}},reduce()?0:280);
 return true;
}
function setup(){
 const canvas=$('atlas-canvas');
 window.BodySpatialCore.attachOrbit(canvas,{state:state.data.camera,render,pick:pickAt,getBounds:()=>model.getViewBounds(U.getRegion()||state.data.region),maxZoom:4,onInteract:()=>U.interrupt(),onDoubleTap:recenter});
 window.addEventListener('resize',resize,{passive:true});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('atlas-stage'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(motionFrame);motionFrame=0;clearTimeout(frameTimeout);}else render();});
 // A BFCache navigation keeps the document and renderer alive. Disposing on
 // pagehide permanently blanked the restored canvas and stranded shader state.
 window.addEventListener('pagehide',event=>{
  clearTimeout(frameTimeout);clearTimeout(entryTimer);clearTimeout(exitTimer);
  cancelAnimationFrame(motionFrame);cancelAnimationFrame(travelMixFrame);
  if(!event.persisted){loader.cancel();model.dispose();}
 });
 window.addEventListener('pageshow',event=>{if(event.persisted){
  if(model.getStatus()!=='ready')model.restore();
  resize();window.BodyDesktopStudio?.sync();window.BodyMobileWorkbench?.sync();
 }});
 window.addEventListener('body:webgl-restored',()=>{$('canvas-fallback').hidden=true;resize();});
 window.addEventListener('popstate',()=>{
  const q=new URLSearchParams(location.search),raw=q.get('region'),target=routeRegion(raw);
  restoringHistory=true;
  try{
   if(target){
    if(state.data.region!==target||state.data.view==='overview')choose(target);
   }else if(state.data.region||U.isActive())body();
   window.BodyDesktopStudio?.sync();window.BodyMobileWorkbench?.sync();
  }finally{queueMicrotask(()=>{restoringHistory=false;});}
 });
 $('sidebar-toggle').onclick=()=>setExpanded($('atlas-sidebar').dataset.expanded!=='true');
 document.querySelectorAll('[data-overview-system]').forEach(button=>{
  button.addEventListener('click',()=>{
   if(!model.setOverviewSystem(button.dataset.overviewSystem))return;
   document.querySelectorAll('[data-overview-system]').forEach(el=>{
    el.setAttribute('aria-pressed',String(el===button));
   });
   render();
  });
 });
 document.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.region)));
 $('enter-region').onclick=()=>enter();
 $('top-enter-region').onclick=()=>enter();
 $('continue-knee').onclick=seam;
 $('top-continue-knee').onclick=seam;
 $('seam-cancel').onclick=()=>{state.closeSeam();$('seam').hidden=true;previousFocus?.focus?.();};
 $('seam-continue').onclick=toKnee;
 $('back-body').onclick=body;
 $('reset-view').onclick=reset;
 $('shoulder-rig-toggle').onclick=()=>{window.BodyShoulderDebug.toggle();render();};
 $('open-original').onclick=()=>{const route=HERE[state.data.region];if(route)window.open(route,'_blank','noopener,noreferrer');};
 $('evidence-toggle').onclick=showEvidence;$('evidence-close').onclick=closeEvidence;

 function trapFocus(event){
  if(event.key!=='Tab')return;
  const open=!$('seam').hidden?$('seam'):!$('evidence-sheet').hidden?$('evidence-sheet'):null;
  if(!open)return;
  const focusables=[...open.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(x=>x.getClientRects().length>0);
  if(!focusables.length){event.preventDefault();return;}
  const first=focusables[0],last=focusables[focusables.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!open.contains(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!open.contains(active))){event.preventDefault();first.focus();}
 }
 document.addEventListener('keydown',trapFocus);

 $('evidence-sheet').addEventListener('click',e=>{if(e.target===$('evidence-sheet'))closeEvidence();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('seam').hidden){state.closeSeam();$('seam').hidden=true;previousFocus?.focus?.();}else if(!$('evidence-sheet').hidden)closeEvidence();else if(U.getSelected()){U.clearSelection();render();}else if(state.data.view==='detail')body();}});
 document.querySelectorAll('[data-evidence]').forEach(b=>b.onclick=()=>setEvidence(b.dataset.evidence));
 document.querySelectorAll('.seg-control button').forEach(b=>b.onclick=()=>setMode(b.id.replace('mode-','')));
 $('layer-slider').oninput=e=>depthChange(e.target.value);
 $('joint-motion-slider').oninput=e=>U.setMotion(e.target.value);
 $('joint-secondary-slider').oninput=e=>U.setSecondaryMotion(e.target.value);
 $('joint-rest').onclick=()=>U.neutral();
 $('structure-chip-more').onclick=()=>U.showSelected();
 $('structure-chip-close').onclick=()=>{U.clearSelection();render();};
 buildPins();resize();
 Promise.all([loader.load('atlas'),loader.load('provenance')]).then(([asset,provenance])=>{
  loader.verifyAtlas(asset,provenance);
  source=asset;proof=provenance;loaded=true;
  model.load(asset);$('scene-status').textContent=model.getStatus()==='ready'?'SOURCED SKELETON · 78 STRUCTURES':'2D FALLBACK';
  if(model.getStatus()!=='ready')fallback('WebGL2 unavailable');
  resize();
  // V8 overview is a separate hashed, mobile LOD. Detailed labs still load only
  // when entered, avoiding 10MB+ of source meshes on initial mobile view.
  Promise.all([loader.load('overviewV8'),loader.load('overviewV8Proof')])
   .then(([asset,manifest])=>{
    loader.verifyOverview(asset,manifest,source);
    model.loadOverview(asset);overviewProof=manifest;overviewLoaded=true;
    Promise.all([loader.load('expansionV9'),loader.load('expansionV9Proof')])
     .then(([addition,record])=>{
      window.BodyV9Source.verify(addition,record,source,asset);
      model.loadExpansion(addition);expansionLoaded=true;
      Promise.all([loader.load('facialV10'),loader.load('facialV10Proof')])
       .then(([facial,facialProof])=>{
        window.BodyV10Facial.verify(facial,facialProof,source,asset,addition);
        if(!model.loadFacial(facial))throw Error('Facial renderer unavailable');
        facialLoaded=true;
        refreshOsteologyCoverage();
        render();
       })
       .catch(err=>{
        $('context-note').textContent='Optional facial source not loaded: '+err.message;
       });
      // V11 source-aligned osteology is optional and independently verified.
      Promise.all([loader.load('osteologyV11'),loader.load('osteologyV11Proof')])
       .then(([newBones,boneProof])=>{
        window.BodyV11Source.verify(newBones,boneProof,source,asset,addition,null);
        if(!model.loadOsteology(newBones))throw Error('Osteology renderer unavailable');
        osteologyAsset=newBones;osteologyLoaded=true;
        refreshOsteologyCoverage();
        window.dispatchEvent(new Event('body:osteology-ready'));
        render();
       })
       .catch(err=>{
        $('context-note').textContent='Optional sacrum/temporal osteology unavailable: '+err.message;
       });
      window.BodyV9Source.mount(addition);
      refreshOsteologyCoverage();
      render();
     })
     .catch(err=>{
      $('context-note').textContent='Optional V9 source expansion unavailable: '+err.message;
     });
    const counts=model.stats();
    $('overview-coverage').textContent=(counts.partCount+counts.overviewBones)+' BONES · '+counts.overviewMuscles+' MUSCLES';
    if(state.data.view==='overview'&&!U.isActive())
     $('scene-status').textContent='SOURCE-ALIGNED BONES + MUSCLES · V8';
    $('stage-caveat').textContent='BodyParts3D 4.0 · source-aligned bone + muscle atlas · CC BY 4.0 · unreviewed';
    render();
   }).catch(err=>{
    $('overview-coverage').textContent='SOURCE LAYER UNAVAILABLE';
    $('context-note').textContent='The detailed V8 overview layer could not be verified: '+err.message;
    if(state.data.view==='overview')$('scene-status').textContent='LEGACY 78-BONE FALLBACK · V8 UNAVAILABLE';
   });
  const routeQuery=new URLSearchParams(location.search),rawRegion=routeQuery.get('region');
  const route=routeRegion(rawRegion);
  if(route)choose(route);
  else if(rawRegion){$('context-note').textContent='Unknown region: '+rawRegion+'. Showing the full body.';}
  if(new URLSearchParams(location.search).get('evidence')==='1'){setEvidence('evidence');showEvidence();}
 }).catch(err=>fallback(err.message));
}
const U=window.BodyAtlasUnified.create({state,model,loader,render,updateURL,resize,setExpanded,reduce,centerPoint,shortestYaw,enableControls,NOTE,LABEL,navigate:region=>choose(region)});
window.__BODY_ATLAS__={getState:()=>({...state.snapshot(),renderer:model.stats(),unified:U.snapshot(),assetsLoaded:loaded,overviewLoaded,expansionLoaded,facialLoaded,osteologyLoaded,journey:pendingEntry?{region:pendingEntry.region,ready:pendingEntry.ready,traveled:pendingEntry.traveled}:null,pins:pins.length,viewport:{width:$('atlas-canvas').clientWidth,height:$('atlas-canvas').clientHeight}}),choose,pickAt,enter,body,recenter,focusOsteology,clearOsteologyFocus,setInspectorFrame,toKnee,seam,showEvidence,closeEvidence,setEvidence,setMode};
setup();
})();