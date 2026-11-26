/* V6 Atlas Portal — navigation, preview-only region adapters and Evidence Lens. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const state=window.BodyAtlasState.create();
const expeditionDiagnostic=new URLSearchParams(location.search).get('expeditionDiagnostics')==='1'?window.BodyExpedition.diagnostics():null;
let vhfView=null;
// The renderer and DOM gestures live outside setupExpedition. Only call its registered interface.
let expeditionBridge=null;const presenceRequested=new URLSearchParams(location.search).get('presence')==='1'&&new URLSearchParams(location.search).get('source')==='axis'&&new URLSearchParams(location.search).get('axisMode')==='regional';const sourceMode=new URLSearchParams(location.search).get('source'),axisRequested=sourceMode==='axis',continuumRequested=axisRequested&&new URLSearchParams(location.search).get('axisMode')!=='regional',worldRequested=sourceMode==='world',broadSource=worldRequested||axisRequested,boundedRequested=worldRequested&&new URLSearchParams(location.search).get('residency')==='bounded',vhfRequested=broadSource||sourceMode==='vhf';
const loader=window.BodyAtlasLoader,model=window.BodyAtlasRenderer.create($('atlas-canvas'),reason=>fallback(reason));
const E=window.BodyAtlasEvidence;let source=null,proof=null,hipProof=null,nerveProof=null,shoulderProof=null,kneeMuscleProof=null,extendedProof=null,overviewProof=null;
let osteologyAsset=null;let lastFocus=null,activeFrameRoute=null,motionFrame=0,travelMixFrame=0,frameTimeout=0,entryTimer=0,exitTimer=0,seq=0,previousFocus=null,pins=[],loaded=false,overviewLoaded=false,expansionLoaded=false,facialLoaded=false,osteologyLoaded=false,pendingEntry=null,sourceSeamPending=false;
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERE={hip:'/hip/spatial/',nerve:'/hip/spatial/',knee:'/knee/spatial/',shoulder:'/shoulder/'};
const LABEL={hip:'RIGHT HIP',nerve:'SCIATIC NERVE',knee:'RIGHT KNEE',shoulder:'SHOULDER',
 skull:'SKULL & JAW',neck:'NECK',thorax:'RIBS & THORAX',
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
let restoringHistory=false,restoringTarget=null,pendingDeepLink=null;
// Deliberate per-structure Dive staging; no changes to anatomical model state.
let studioDive={id:null,step:0};
function updateURL({replace=false}={}){
 const q=new URLSearchParams(location.search);
 if(state.data.region)q.set('region',state.data.region);else q.delete('region');
 if(state.data.region&&state.data.view==='detail'){
  if(state.data.layer)q.set('layer',String(state.data.layer));else q.delete('layer');
  const tool=state.data.layer===4&&window.BodyExtendedRegions?.has(state.data.region)?'trace':state.data.mode;
  if(['peel','trace'].includes(tool))q.set('tool',tool);else q.delete('tool');
  const id=U.getSelected();if(id)q.set('structure',id);else q.delete('structure');
 }else{q.delete('layer');q.delete('tool');q.delete('structure');}
 if(state.data.evidenceMode==='evidence')q.set('evidence','1');else q.delete('evidence');
 const suffix=q.toString(),url=location.pathname+(suffix?'?'+suffix:'');
 // During a browser Back transition we may briefly pass through Whole Body.
 // Intermediate camera states must not become new history entries.
 if(restoringTarget!==null){
  if((state.data.region||'')!==restoringTarget)return;
  restoringTarget=null;
 }
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
 if(vhfView?.active){if(document.hidden)return;const canvas=$('atlas-canvas'),c=vhfView.camera;c.width=canvas.clientWidth;c.height=canvas.clientHeight;const start=performance.now();model.render(c,'vhf','clean',0,1,0,vhfView.selected,0,null,false,vhfView);if(presenceRequested&&c.flight)expeditionBridge?.observeRecovery(vhfView);if(presenceRequested)window.dispatchEvent(new Event('bodylive:presence-render'));const p=vhfView.parts.find(p=>p.id===vhfView.selected);if(continuumRequested){const n=window.BodyVHF.axisLocation(vhfView.landmarks,c,vhfView.axisRegion);if(typeof n==='number')vhfView.axisRegion=n;vhfView.neighborhood=typeof n==='number'?window.BodyVHF.axisRegions[n]:n;}if(worldRequested)vhfView.neighborhood=window.BodyVHF.neighborhood(vhfView.landmarks||[],c,vhfView.neighborhood);const label=(p?p.name:(axisRequested?(continuumRequested?vhfView.neighborhood:window.BodyVHF.axisRegions[vhfView.axisRegion]):worldRequested?vhfView.neighborhood:'VISIBLE HUMAN · RIGHT KNEE'))+' · '+vhfView.category,loc=$('expedition-location'),ev=$('expedition-evidence');if(loc.textContent!==label)loc.textContent=label;const note=continuumRequested?('BoneHub · '+vhfView.parts.length+'/59 loaded'+(vhfView.stream?.failures.size?' · '+vhfView.stream.failures.size+' delayed/unavailable · R3 retry':'')+(model.frameStats().gpuFailedIds?.length?' · GPU upload failed · R3 retry':'')+' · separate specimen space'):axisRequested?(vhfView.traveling?'Loading next region · BoneHub':'BoneHub VHF · separate specimen space · D-pad ↑/↓ to travel'):'VHF · CC BY 4.0 · research geometry · review pending';if(ev.textContent!==note)ev.textContent=note;expeditionDiagnostic?.sample('renderCpuMs',performance.now()-start);return;}
 if($('atlas-app').dataset.expeditionClean==='true'){
  const id=U.getSelected(),region=U.getRegion()||state.data.region;
  const label=id?(model.getStructure(region,id)?.name||$('structure-chip-name').textContent||id):(LABEL[region]||'FULL BODY');
  const el=$('expedition-location');if(el&&el.textContent!==label)el.textContent=label;
 }
 if(document.hidden||(state.data.view==='detail'&&!U.isActive()))return;
 const renderStart=expeditionDiagnostic?performance.now():0;
 model.render(state.data.camera,U.getRegion()||state.data.region,state.data.evidenceMode,state.data.layer,U.getReveal(),U.getMotion(),U.getSelected(),U.getSecondaryMotion(),U.getTransitionFrom(),state.data.mode==='trace'&&!window.BodyExtendedRegions?.has(U.getRegion()||state.data.region));
 window.BodyShoulderDebug?.draw(state.data.camera,
  state.data.view==='detail'&&U.getRegion()==='shoulder'?model.shoulderDiagnostics(U.getMotion()):null);
 if(studioCameraActive())window.__BODY_V14_ORIENTATION_UPDATE__?.(state.data.camera);
 if(state.data.view==='overview'&&!U.isActive()&&$('atlas-app').dataset.expeditionClean!=='true')drawPins();
 if(expeditionDiagnostic)expeditionDiagnostic.sample('renderCpuMs',performance.now()-renderStart);
}
function fallback(reason){
 expeditionDiagnostic?.event('fallback',{reason:String(reason||'unavailable')});
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
function pickAt(x,y,opts){
 if(U.isActive()&&state.data.view==='detail')return U.pickAt(x,y,opts);
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
function studioCameraActive(){
 return $('atlas-app').dataset.connectiveStudio==='true'&&U.getRegion()==='knee'&&state.data.view==='detail';
}
function cameraScale(frameSpan){
 const rect=$('atlas-canvas').getBoundingClientRect();
 return Math.max(.001,Math.min(Math.max(1,rect.width)/3.25,Math.max(1,rect.height)/Math.max(.2,frameSpan)));
}
function animateCamera(destination,ms=530,done){
 cancelAnimationFrame(motionFrame);motionFrame=0;
 const cam=state.data.camera;const from={yaw:cam.yaw,pitch:cam.pitch,zoom:cam.zoom,frameSpan:cam.frameSpan,target:{...cam.target}};
 if(reduce()||ms===0){Object.assign(cam,destination);render();done?.();return;}
 const continuous=studioCameraActive(),startScale=cameraScale(from.frameSpan)*from.zoom,
  endScale=cameraScale(destination.frameSpan)*destination.zoom;
 const start=performance.now(),tick=t=>{
  const u=Math.min(1,(t-start)/ms),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
  for(const key of ['yaw','pitch','frameSpan'])cam[key]=from[key]+(destination[key]-from[key])*e;
  cam.zoom=continuous?Math.exp(Math.log(startScale)+(Math.log(endScale)-Math.log(startScale))*e)/cameraScale(cam.frameSpan):from.zoom+(destination.zoom-from.zoom)*e;
  if(continuous)for(const key of ['anchorX','anchorY'])if(Number.isFinite(destination[key]))
   cam[key]=(Number.isFinite(from[key])?from[key]:.5)+
      (destination[key]-(Number.isFinite(from[key])?from[key]:.5))*e;
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
let studioNavigation=null;
let studioFramingFrame=0;
function setInspectorFrame(visible,instant=false){
 const camera=state.data.camera;
 const width=Math.max(1,$('atlas-canvas').clientWidth);
 // A 355px inspector + 90px tool rail must not hide the specimen.
 const target=(visible&&$('atlas-app').dataset.expeditionClean!=='true'&&window.innerWidth>850)?Math.max(.30,.5-Math.min(152,Math.max(99,width*.101))/width):.5;
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
// Connective Studio is the sole authority over mobile camera framing while it is open; other
// controllers (the mobile workbench) may still request a frame, but are ignored until release.
let frameOwner=null;
function setFrameOwner(owner){frameOwner=owner||null;}
function setMobileFrame(visible,owner){
 if(frameOwner&&owner!==frameOwner)return;
 const c=state.data.camera,target=visible&&$('atlas-app').dataset.expeditionClean!=='true'?.39:.5;
 if(Math.abs((c.anchorY??.5)-target)<.001)return;
 c.anchorY=target;render();
}
function recenter(){
 if(U.isActive()&&state.data.view==='detail')return U.recenter();
 animateCamera({yaw:-.2,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}},reduce()?0:280);
 return true;
}
function setupExpedition(){
 const button=$('expedition-toggle'),hud=$('expedition-hud'),reticle=$('expedition-reticle'),status=$('expedition-status');
 if(!button||!window.BodyExpedition)return;
 let enabled=false,clean=false;const pointers=new Set();const app=$('atlas-app'),viewButton=$('expedition-view');
 const evidence=hud.querySelector('.expedition-evidence');evidence.id='expedition-evidence';
 const optical=window.BodyOptical.create(new URLSearchParams(location.search).get('optical')||'fixed');
 const visual=document.createElement('select');visual.id='expedition-visual';visual.setAttribute('aria-label','Specimen appearance');for(const name of ['atlas','specimen','cinema','legacy']){const option=document.createElement('option');option.value=name;option.textContent=name==='legacy'?'Original':name.toUpperCase();visual.append(option);}visual.value=['atlas','specimen','cinema','legacy'].includes(new URLSearchParams(location.search).get('visual'))?new URLSearchParams(location.search).get('visual'):'specimen';visual.hidden=true;viewButton.after(visual);visual.addEventListener('change',()=>{model.setVisualMode(enabled?visual.value:'legacy');expeditionDiagnostic?.event('visual-mode',{mode:visual.value});render();});
 const quality=$('expedition-quality');quality.value=optical.state().profile;
 function applyQuality(change){model.setOpticalDensity(enabled&&change.profile!=='fixed'?change.density:null);expeditionDiagnostic?.event('optical-quality',{...change});return true;}
 quality.addEventListener('change',()=>{applyQuality({...optical.set(quality.value,performance.now()),reason:'manual'});render();});
 function setClean(next){
  clean=!!next&&enabled;app.dataset.expeditionClean=String(clean);viewButton.setAttribute('aria-pressed',String(clean));viewButton.textContent=clean?'Show UI':'Hide UI';
  if(clean){cancelAnimationFrame(studioFramingFrame);studioFramingFrame=0;state.data.camera.anchorX=.5;state.data.camera.anchorY=.5;}
  resize();
 }
 const setStatus=message=>{if(status.textContent!==message)status.textContent=message;};
 const finish=()=>{if(vhfView?.active)return;if(studioCameraActive()){studioNavigation?.end();window.dispatchEvent(new Event('body:camera-transaction'));}};
 const categories=['All','Bone','Cartilage','Ligament','Muscle'];
 const flightRequested=axisRequested&&new URLSearchParams(location.search).get('flight')==='1'&&new URLSearchParams(location.search).get('unified')==='1';
 const fitSource=()=>{const b=vhfView.bounds;if(flightRequested){window.BodyGravityAdaptive.flightFit(vhfView.camera,b);return;}Object.assign(vhfView.camera,{yaw:0,pitch:0,zoom:broadSource?1:2.4,frameSpan:continuumRequested?window.BodyVHF.overviewFrameSpan(b):broadSource?Math.max(3.25,b.radius*2.3):2.55,target:broadSource?{x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2,z:(b.min[2]+b.max[2])/2}:{x:0,y:0,z:0},anchorX:.5,anchorY:.5});};
 let axisFlight=0,axisActivating=false,presenceError='',presenceProgress=null,presenceStarted=performance.now(),presenceReadyAt=null,presencePrevious=null,presenceRetryDirection=null;const progress=p=>{presenceProgress=p;if(presenceRequested)window.dispatchEvent(new Event('bodylive:presence-progress'));};const initialRegion=presenceRequested?Math.max(0,Math.min(3,Math.trunc(Number(new URLSearchParams(location.search).get('axisRegion')??2)||0))):0;
 const cancelAxisFlight=()=>{cancelAnimationFrame(axisFlight);axisFlight=0;};
 function streamAxis(v){if(!v?.stream||v.stream.running)return;const ac=new AbortController();v.travelAbort=ac;let frame=0;const changed=()=>{if(!v.active||frame)return;frame=requestAnimationFrame(()=>{frame=0;if(v.active){restoreSelection(v);render();}});};v.stream.stream(changed,ac.signal,()=>v.camera).catch(e=>expeditionDiagnostic?.event('axis-stream-failed',{reason:e.message})).finally(()=>{if(v.travelAbort===ac)v.travelAbort=null;changed();});}
 function continuumTravel(direction){const v=vhfView;if(!v?.active)return;cancelAxisFlight();const c=v.camera,i=window.BodyVHF.axisLocation(v.landmarks,{...c,zoom:2},v.axisRegion),next=Math.max(0,Math.min(3,i+direction)),p=v.landmarks[next].point,from={...c.target},started=performance.now();const tick=now=>{if(!v.active){axisFlight=0;return;}const t=Math.min(1,(now-started)/650),e=t*t*(3-2*t);for(let k=0;k<3;k++)c.target[['x','y','z'][k]]=from[['x','y','z'][k]]+(p[k]-from[['x','y','z'][k]])*e;render();if(t<1)axisFlight=requestAnimationFrame(tick);else{axisFlight=0;expeditionDiagnostic?.event('axis-landmark-travel',{region:next,elapsedMs:now-started});}};axisFlight=requestAnimationFrame(tick);}
 async function axisTravel(direction){if(continuumRequested){continuumTravel(direction);return;}const v=vhfView;if(!axisRequested||!v?.active||v.traveling)return;const next=Math.max(0,Math.min(3,v.axisRegion+direction));if(next===v.axisRegion)return;v.traveling=true;const ac=new AbortController();v.travelAbort=ac;render();try{presenceError='';presenceRetryDirection=null;const parts=await window.BodyVHF.loadAxis(next,v.parts,ac.signal,progress);if(ac.signal.aborted||!v.active)return;await model.loadVHF(parts,true);v.parts=parts;v.bounds=window.BodyVHF.bounds(parts);if(presenceRequested)v.playground=window.BodyPlayground.create(parts,v.bounds);v.axisRegion=next;presenceNavigation='orbit';presencePrevious=null;v.selected=null;v.surface=null;v.pivotRef=null;v.isolated=null;v.category='All';const b=v.bounds;Object.assign(v.camera,{target:{x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2,z:(b.min[2]+b.max[2])/2},frameSpan:Math.max(3.25,b.radius*2.3),zoom:1});if(flightRequested)window.BodyGravityAdaptive.flightFit(v.camera,b);expeditionDiagnostic?.event('axis-travel',{region:next,structures:parts.length});}catch(e){expeditionDiagnostic?.event('axis-travel-failed',{region:next,reason:e.message});setStatus('Region unavailable · current anatomy retained');presenceError='Region unavailable · current anatomy retained: '+e.message;presenceRetryDirection=direction;}finally{v.traveling=false;v.travelAbort=null;render();if(presenceRequested)window.dispatchEvent(new Event('bodylive:presence-ready'));}}
 // Gamepad playtest: default to stable specimen orbit, not eye-centred free look.
 let presenceNavigation='orbit';
 const pivotSpace=v=>`${v.parts.sourceInfo?.manifestHash||'unknown'}:${v.axisRegion}`;
 function capturePivot(v,hit){if(hit&&(presenceRequested||flightRequested))presenceNavigation='orbit';v.selected=hit?.id||null;v.surface=hit?.point||null;v.pivotRef=hit?window.BodyGravityAdaptive?.pivotCapture(hit.id,pivotSpace(v),hit.point,v.playground?.transform(hit.id)):null;}
 function resolvedPivot(v){return v?.selected&&v.pivotRef?window.BodyGravityAdaptive?.pivotResolve(v.pivotRef,v.selected,pivotSpace(v),v.playground?.transform(v.selected)):null;}
 function playChange(fn){const v=vhfView,p=v?.playground;if(!p||v.traveling)return false;const before=p.report();const ok=fn(p);if(ok===false)return false;v.surface=resolvedPivot(v);const after=p.report();if(before.mode!==after.mode||before.held!==after.held)motion?.reset();return true;}
 let playGesture=false;function playInput(c,i,dt){const p=vhfView?.playground;if(!p)return {i,changed:false};const s=p.report(),next={...i};let changed=false;const t=dt>0&&dt<=.15?Math.min(dt,.05):0;const active=s.mode==='deconstruct'?!!i.zoom:s.mode==='grasp'&&!!s.held&&!!(i.zoom||i.orbitX||i.orbitY);if(active&&!playGesture)p.checkpoint();playGesture=active;if(s.mode==='deconstruct'){next.zoom=0;if(i.zoom&&t)changed=playChange(x=>x.setAmount(s.amount+i.zoom*t*.85));}else if(s.mode==='grasp'&&s.held){next.zoom=next.orbitX=next.orbitY=0;const d=i.zoom*p.span*t*.65,cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);if(t&&(d||i.orbitX||i.orbitY))changed=playChange(x=>x.adjustGrab({shift:[-sy*cp*d,sp*d,cy*cp*d],yaw:i.orbitX*t*2,pitch:i.orbitY*t*2}));}return {i:next,changed};}
 const command=index=>{
  if(index!==8)pendingNexusSelection=null;
  if(index===8&&new URLSearchParams(location.search).get('nexus')==='1'){window.dispatchEvent(new Event(presenceRequested?'bodylive:playground-tools':'bodylive:nexus'));return;}
  if(vhfView?.active){cancelAxisFlight();const v=vhfView,c=v.camera;if(presenceRequested&&v.playground?.report().mode==='grasp'&&index===0&&v.playground.report().held){playChange(p=>p.release());render();return;}if(presenceRequested&&['grasp','deconstruct'].includes(v.playground?.report().mode)&&index===1){playChange(p=>p.undo());render();return;}if(axisRequested&&(index===12||index===13)){axisTravel(index===12?1:-1);return;}if(index===9){if(nexusParams.get('essence')==='1'){window.dispatchEvent(new Event('bodylive:essence-toggle'));return;}setClean(!clean);return;}if(index===0){const t=performance.now(),hit=window.BodyVHF.pickHit(v.parts,v,c,c.width/2,c.height/2);capturePivot(v,hit);expeditionDiagnostic?.sample('selectionCpuMs',performance.now()-t);if(presenceRequested){if(v.selected&&v.playground?.report().mode==='grasp')playChange(p=>p.grab(v.selected));window.dispatchEvent(new Event('bodylive:presence-selected'));}}if(index===1){if(presenceRequested&&presencePrevious){Object.assign(c,presencePrevious,{target:{...presencePrevious.target}});presencePrevious=null;}else{v.isolated=null;v.selected=null;v.surface=null;v.pivotRef=null;v.category='All';}}if(index===2&&v.selected){v.isolated=v.isolated?null:v.selected;}if(index===3&&v.selected){const previousEye={...c.target};if(presenceRequested&&!presencePrevious)presencePrevious={yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{...c.target}};const raw=v.parts.find(p=>p.id===v.selected),p=v.playground?.bounds(raw)||raw;c.target=v.surface?{...v.surface}:{x:(p.min[0]+p.max[0])/2,y:(p.min[1]+p.max[1])/2,z:(p.min[2]+p.max[2])/2};if(c.flight){const A=window.BodyGravityAdaptive,pivot=c.target,previous=previousEye,local=A.toView(c,{x:pivot.x-previous.x,y:pivot.y-previous.y,z:pivot.z-previous.z}),dist=Math.max(.035,Math.hypot(local.x,local.y,local.z)*.65),offset=A.fromView(c,{x:0,y:0,z:dist});c.target={x:pivot.x+offset.x,y:pivot.y+offset.y,z:pivot.z+offset.z};}else c.zoom=Math.min(14,c.zoom*1.5);}if(index===4||index===5){v.isolated=null;v.selected=null;v.surface=null;v.pivotRef=null;v.category=categories[(categories.indexOf(v.category)+(index===5?1:4))%5];}if(index===11){const recovery=presenceRequested&&c.flight?recoveryStatus(v):null;if(recovery&&(recovery.crowded||recovery.lost)&&recoverFlight(v))return;presencePrevious=null;presenceNavigation='orbit';playChange(p=>p.reset());if(presenceRequested){v.selected=null;v.surface=null;v.pivotRef=null;v.isolated=null;}fitSource();if(continuumRequested){model.retryVHF?.();streamAxis(v);}}render();return;}
  const selected=U.getSelected(),studio=studioCameraActive();
  if(index===9){if(nexusParams.get('essence')==='1'){window.dispatchEvent(new Event('bodylive:essence-toggle'));return;}setClean(!clean);return;}
  if(index===0){const c=$('atlas-canvas');pickAt(c.clientWidth/2,c.clientHeight/2,{pointerType:'mouse'});}
  if(index===1){if(studio&&connectiveNavAction('back'))return;if(selected){U.clearSelection();render();}else if(state.data.view==='detail')body();}
  if(index===2&&studio&&selected){const el=document.querySelector('[data-cs-action="isolate"]:not([disabled])');el?.click();}
  if(index===3&&studio&&selected){const el=document.querySelector('[data-cs-action="focus"]:not([disabled])');el?.click();}
  if(index===11){if(studio){if(selected)connectiveNavAction('recenter',selected);else connectiveNavAction('fit');}else recenter();}
  if(index===12||index===13){if(U.isActive()&&state.data.view==='detail'&&!studio){depthChange(Math.max(0,Math.min(4,state.data.layer+(index===13?1:-1))));}}
  if((index===14||index===15)&&state.data.view==='overview'){
   const regions=window.BodyAtlasState.regions.filter(r=>r!=='nerve');const n=regions.indexOf(state.data.region);
   choose(regions[(n+(index===15?1:-1)+regions.length)%regions.length]);
  }
 };
 const nexusParams=new URLSearchParams(location.search);
 const gravityActive=(nexusParams.get('nexus')==='1'||nexusParams.get('gravity')==='1')&&!!window.BodyGravityAdaptive&&!!window.BodyGravity;
 const motion=gravityActive?window.BodyGravityAdaptive.create(nexusParams.get('gravityProfile')||'explorer'):null;
 const nexusInput={reads:0,steps:0,changes:0,stalls:0,lastDt:null,lastZoom:0};
 const wideMobility=(presenceRequested||flightRequested)&&nexusParams.get('unified')==='1';
 let flightBoxCache=null;const flightBoxes=()=>{const v=vhfView;if(!v)return [];const revision=v.playground?.report().revision??0,key=[v.parts.length,revision,v.category,v.isolated].join('|');if(flightBoxCache?.parts===v.parts&&flightBoxCache.key===key)return flightBoxCache.boxes;const boxes=v.parts.filter(p=>window.BodyVHF.visible(p,v)).map(p=>v.playground?.bounds(p)||p);flightBoxCache={parts:v.parts,key,boxes};return boxes;};
 const recoveryKey=v=>[v.axisRegion,v.parts.sourceInfo?.manifestHash,v.parts.length,v.category,v.isolated,v.playground?.report().revision??0].join('|');
 // Optional recovery must never invalidate an otherwise valid anatomy frame.
 function recoveryFailure(v,error){if(v.recoveryDisabled)return;v.recoveryDisabled=true;v.recovery=null;console.warn('BODY / LIVE recovery disabled:',error.message);expeditionDiagnostic?.event('flight-recovery-disabled',{reason:error.message});}
 function observeFlightRecovery(v){if(!v?.camera.flight||v.traveling||v.recoveryDisabled)return;try{v.recovery??=window.BodyGravityAdaptive.createFlightRecovery();v.recovery.observe(v.camera,recoveryKey(v),window.BodyGravityAdaptive.flightClearance(v.camera,flightBoxes()),model.frameStats().drawnSourceIds?.length||0);}catch(error){recoveryFailure(v,error);}}
 function recoveryStatus(v){if(!v?.camera.flight)return null;const fallback={crowded:false,lost:false,available:false,degraded:true};if(v.recoveryDisabled)return fallback;try{const clearance=window.BodyGravityAdaptive.flightClearance(v.camera,flightBoxes()),drawn=model.frameStats().drawnSourceIds?.length||0;return {crowded:clearance<.12,lost:drawn===0,available:!!v.recovery?.available(recoveryKey(v))};}catch(error){recoveryFailure(v,error);return fallback;}}
 function recoverFlight(v){const status=recoveryStatus(v);if(!status?.available||v.playground?.report().mode!=='explore')return false;let pose;try{pose=v.recovery.recover(recoveryKey(v));}catch(error){recoveryFailure(v,error);return false;}if(!pose)return false;motion?.reset();Object.assign(v.camera,pose);presencePrevious=null;render();return true;}
 let surfaceProbeDisabled=false;
 const gravityWorld={wideMobility,flightBoxes,onFlightSurfaceError:error=>{if(surfaceProbeDisabled)return;surfaceProbeDisabled=true;console.warn('BODY / LIVE surface assistance disabled:',error.message);expeditionDiagnostic?.event('flight-surface-disabled',{reason:error.message});},flightSurface:c=>{const v=vhfView;return !surfaceProbeDisabled&&v?.active?window.BodyVHF.surfaceProbe(v.parts,v,c.target):null;},legacyOrbit:nexusParams.get('gravityVersion')==='2',inspectionPoint:()=>{const v=vhfView;if(!v?.active||!v.selected)return null;const p=v.parts.find(p=>p.id===v.selected);return p&&window.BodyVHF.visible(p,v)?resolvedPivot(v)||(!v.playground?v.surface:null):null;},orbitPivot:()=>{const v=vhfView;if(!v?.active)return null;const contextual=(presenceRequested||flightRequested)&&nexusParams.get('unified')==='1';if(contextual&&presenceNavigation==='free')return null;const p=v.parts.find(p=>p.id===v.selected),point=resolvedPivot(v);if(p&&point&&window.BodyVHF.visible(p,v))return {key:pivotSpace(v)+':'+v.selected,point,kind:'surface'};if(contextual&&v.bounds?.min&&v.bounds?.max)return {key:pivotSpace(v)+':specimen',point:Object.fromEntries(['x','y','z'].map((k,i)=>[k,(v.bounds.min[i]+v.bounds.max[i])/2])),kind:'specimen'};return null;}};
 if(motion){hud.querySelector('.expedition-help')?.append(document.createElement('br'),document.createTextNode('Hold L3 · Precision'));}
 let pendingNexusSelection=null;
 const axisHash='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7';
 const sameAxis=v=>!!(!flightRequested&&continuumRequested&&v?.active&&v?.ready&&v.parts.sourceInfo?.manifestHash===axisHash);
 function restoreSelection(v){if(!pendingNexusSelection||!sameAxis(v))return false;const p=v.parts.find(p=>p.id===pendingNexusSelection);if(!p)return false;v.selected=p.id;v.surface=null;v.pivotRef=null;pendingNexusSelection=null;return true;}
 if(presenceRequested)window.__PRESENCE__=Object.freeze({
 state:()=>{const v=vhfView;return {ready:!!(v?.active&&v.ready&&v.parts.length),region:v?.axisRegion??initialRegion,loading:!v?.ready||!!v.traveling,error:presenceError,progress:presenceProgress,manifest:v?.parts.sourceInfo?.manifestHash||null,selected:v?.parts.find(p=>p.id===v.selected)?{id:v.selected,name:v.parts.find(p=>p.id===v.selected).name,category:v.parts.find(p=>p.id===v.selected).category}:null,isolated:!!v?.isolated,previous:!!presencePrevious,category:v?.category||'All',camera:v?{...v.camera,target:{...v.camera.target}}:null,structures:v?.parts.length||0,rendered:model.frameStats().drawnSourceIds||[],firstReadyMs:presenceReadyAt===null?null:presenceReadyAt-presenceStarted,playground:v?.playground?.report()||null,gravity:motion&&v?{spatialVersion:window.BodyGravityAdaptive.spatialVersion,wideMobility,navigation:presenceNavigation,flight:v.camera.flight?{lensFixed:true,recovery:recoveryStatus(v),moving:!!motion?.active(),boost:motion?.boost()||0,feedback:motion?.flightFeedback()||null,boostFactor:window.BodyGravityAdaptive.boostFactor(window.BodyGravityAdaptive.flightClearance(v.camera,flightBoxes()),motion?.boost()||0),clearanceEstimate:window.BodyGravityAdaptive.flightClearance(v.camera,flightBoxes()),fullThrottleSpeed:window.BodyGravityAdaptive.flightSpeed(window.BodyGravityAdaptive.flightClearance(v.camera,flightBoxes()))}:null,eye:window.BodyGravityAdaptive.eye(v.camera),pivot:gravityWorld.orbitPivot(),localPivot:v.pivotRef||null}:null,gpuBytes:model.frameStats().estimatedSourceGpuBufferBytes||0,controller:{status:status.textContent,...nexusInput}};},
 target:(x,y)=>{const v=vhfView;if(!v?.active||!v.ready||v.traveling||!v.parts.length)return null;const c=v.camera,hit=window.BodyVHF.pickHit(v.parts,v,c,x??c.width/2,y??c.height/2);const p=hit&&v.parts.find(p=>p.id===hit.id);return p?{id:p.id,name:p.name,category:p.category,manifest:v.parts.sourceInfo.manifestHash,point:hit.point}:null;},
 selectAt:(x,y)=>{const v=vhfView;if(!v?.active||v.traveling)return false;const hit=window.BodyVHF.pickHit(v.parts,v,v.camera,x??v.camera.width/2,y??v.camera.height/2);capturePivot(v,hit);if(v.selected&&v.playground?.report().mode==='grasp')playChange(p=>p.grab(v.selected));controls.interrupt();render();window.dispatchEvent(new Event('bodylive:presence-selected'));return !!hit;},
 sourceFingerprint:async()=>{const v=vhfView;if(!v?.active||v.traveling)return null;const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');return Promise.all(v.parts.map(async p=>({id:p.id,vertices:await hash(p.positions),indices:await hash(p.indices)})));},
 play:(action,value)=>{const v=vhfView;if(!v?.active||v.traveling||!v.playground)return false;controls.interrupt();if(action==='recover-view')return recoverFlight(v);if(action==='navigation'){if(!['orbit','free'].includes(value)||v.playground.report().mode!=='explore')return false;presenceNavigation=value;motion?.reset();render();return true;}const ok=playChange(p=>{switch(action){case 'mode':return p.setMode(value);case 'amount':return p.setAmount(value);case 'pattern':return p.setPattern(value);case 'scope':return p.setScope(value?v.selected:null);case 'grasp':return p.grab(v.selected);case 'adjust':return p.adjustGrab(value||{});case 'lift':{const c=v.camera,d=Math.max(-1,Math.min(1,Number(value)||0))*p.span*.12;return p.adjustGrab({shift:[-Math.sin(c.yaw)*Math.cos(c.pitch)*d,Math.sin(c.pitch)*d,Math.cos(c.yaw)*Math.cos(c.pitch)*d]});}case 'release':return p.release();case 'undo':return p.undo();case 'checkpoint':return p.checkpoint();case 'reset':return p.reset();default:return false;}});if(ok)render();return ok;},
 action:index=>{if(!vhfView?.active||vhfView.traveling||![0,1,2,3,4,5,11,12,13].includes(index))return false;controls.interrupt();command(index);return true;},
 save:()=>{const v=vhfView;if(!v?.active||!v.ready||v.traveling||!v.parts.length||v.playground?.report().displaced)return null;return {version:1,manifest:v.parts.sourceInfo.manifestHash,space:'bonehub-vhf-axis-regional-display-v1',region:v.axisRegion,camera:{yaw:v.camera.yaw,pitch:v.camera.pitch,zoom:v.camera.zoom,frameSpan:v.camera.frameSpan,target:{...v.camera.target},...(v.camera.flight?{flight:true}:{})},selection:v.selected,isolation:v.isolated,navigation:presenceNavigation,pivot:v.pivotRef&&resolvedPivot(v)?v.pivotRef:null};},
 restore:s=>{const v=vhfView,c=s?.camera;if(!v?.active||!v.ready||s?.version!==1||s.manifest!==v.parts.sourceInfo.manifestHash||s.space!=='bonehub-vhf-axis-regional-display-v1'||s.region!==v.axisRegion||!c||!!c.flight!==flightRequested||c.flight&&c.zoom!==1||!Number.isFinite(c.yaw)||Math.abs(c.yaw)>1e4||!Number.isFinite(c.pitch)||Math.abs(c.pitch)>(wideMobility?window.BodyGravityAdaptive.WIDE_PITCH+1e-6:.851)||!Number.isFinite(c.zoom)||c.zoom<.7||c.zoom>14||!Number.isFinite(c.frameSpan)||c.frameSpan<.2||c.frameSpan>100)return false;for(const [i,k] of ['x','y','z'].entries()){const margin=wideMobility?window.BodyGravityAdaptive.travelEnvelope(v.bounds,c,true).radius+Math.hypot(.04,7.4)*2:Math.max(.18,Math.max(.35,v.bounds.max[i]-v.bounds.min[i])*.18)+Math.hypot(.04,7.4)*2;if(!Number.isFinite(c.target?.[k])||c.target[k]<v.bounds.min[i]-margin||c.target[k]>v.bounds.max[i]+margin)return false;}controls.interrupt();Object.assign(v.camera,{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{...c.target},anchorX:.5,anchorY:.5,flight:!!c.flight});v.selected=v.parts.some(p=>p.id===s.selection)?s.selection:null;v.isolated=v.selected&&s.isolation===v.selected?v.selected:null;presenceNavigation=s.navigation==='free'?'free':'orbit';v.surface=null;v.pivotRef=null;const part=v.parts.find(p=>p.id===v.selected),ref=s.pivot;if(part&&ref?.local?.length===3&&ref.local.every((x,i)=>Number.isFinite(x)&&x>=part.min[i]-1e-5&&x<=part.max[i]+1e-5)&&window.BodyGravityAdaptive?.pivotResolve(ref,v.selected,pivotSpace(v),v.playground?.transform(v.selected))){v.pivotRef=ref;v.surface=resolvedPivot(v);}render();return true;},
 retry:()=>{presenceError='';if(vhfView?.active){if(presenceRetryDirection!==null){axisTravel(presenceRetryDirection);return;}window.dispatchEvent(new Event('bodylive:presence-progress'));return;}activateSource();}
 });
 if(nexusParams.get('nexus')==='1')window.__NEXUS_ATLAS__=Object.freeze({
  presentation:mode=>{if(nexusParams.get('essence')!=='1')return false;if(mode==='studio')setClean(false);else if(clean)setClean(false);resize();return true;},
  action:index=>{if(nexusParams.get('essence')!=='1'||!Number.isInteger(index)||![0,1,2,3,4,5,11,12,13,14,15].includes(index))return false;controls.interrupt();command(index);return true;},
  profile:()=>motion?{active:true,version:1,settings:motion.settings()}: {active:false},
  inspect:()=>{const v=vhfView;if(!sameAxis(v))return null;return {camera:{...v.camera,target:{...v.camera.target}},selection:v.selected,structures:v.parts.length,region:v.neighborhood||null,streamRunning:!!v.stream?.running,streamFailed:v.stream?.failures.size||0,controller:{status:status.textContent,focused:document.hasFocus(),hidden:document.hidden,enabled,loaded,model:model.getStatus(),view:state.data.view,pointers:pointers.size,modal:!!document.getElementById('nexus-experience-menu')?.open,evidenceHidden:$('evidence-sheet').hidden,seamHidden:$('seam').hidden,activeFrame:!!activeFrameRoute,...nexusInput}};},
  capture:()=>{const v=vhfView;if(!sameAxis(v)||!v.parts.length)return null;cancelAxisFlight();motion?.reset();const c=v.camera;
   const idx=window.BodyVHF.axisLocation(v.landmarks,c,v.axisRegion);
   const region=typeof idx==='number'?['hip','thorax','neck','skull'][idx]:null;
   let thumbnail=null;try{render();const canvas=$('atlas-canvas'),out=document.createElement('canvas');out.width=320;out.height=180;const ctx=out.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#141310';ctx.fillRect(0,0,320,180);const ratio=Math.min(320/canvas.width,180/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;ctx.drawImage(canvas,(320-w)/2,(180-h)/2,w,h);const data=ctx.getImageData(0,0,320,180).data;let min=255,max=0;for(let i=0;i<data.length;i+=16){const l=(data[i]+data[i+1]+data[i+2])/3;min=Math.min(min,l);max=Math.max(max,l);}if(max-min>18){const jpeg=out.toDataURL('image/jpeg',.72);if(jpeg.length<70000)thumbnail=jpeg;}}catch{}
   return {version:2,space:'bonehub-vhf-axis-display-v1',manifestHash:axisHash,region,selection:v.selected||null,category:v.category,camera:{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{...c.target}},savedAt:Date.now(),thumbnail};},
  restore:s=>{const v=vhfView,c=s?.camera;if(!sameAxis(v)||s?.version!==2||s.space!=='bonehub-vhf-axis-display-v1'||s.manifestHash!==axisHash||!c||!Number.isFinite(c.yaw)||Math.abs(c.yaw)>1e4||!Number.isFinite(c.pitch)||Math.abs(c.pitch)>.851||!Number.isFinite(c.zoom)||c.zoom<.7||c.zoom>14||!Number.isFinite(c.frameSpan)||c.frameSpan<.2||c.frameSpan>100)return false;
   for(const [i,k] of ['x','y','z'].entries()){const n=c.target?.[k],span=Math.max(.35,v.bounds.max[i]-v.bounds.min[i]),margin=Math.max(.18,span*.18);if(!Number.isFinite(n)||n<v.bounds.min[i]-margin||n>v.bounds.max[i]+margin)return false;}
   cancelAxisFlight();motion?.reset();Object.assign(v.camera,{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{...c.target},anchorX:.5,anchorY:.5});v.category=categories.includes(s.category)?s.category:'All';v.selected=null;v.surface=null;v.pivotRef=null;v.isolated=null;pendingNexusSelection=typeof s.selection==='string'&&s.selection.length<=200?s.selection:null;restoreSelection(v);render();return true;}
 });
 const controls=window.BodyExpedition.mount({
  ...(motion?{navigate:(c,i,dt,b,m)=>{nexusInput.steps++;nexusInput.lastDt=dt;nexusInput.lastZoom=i.zoom;if(dt>.15)nexusInput.stalls++;const play=presenceRequested?playInput(c,i,dt):{i,changed:false};const changed=motion.step(window.BodyExpedition.advance,c,play.i,dt,b,m,gravityWorld)||play.changed;if(changed)nexusInput.changes++;return changed;},readInput:pad=>{nexusInput.reads++;const i=motion.read(pad,window.BodyExpedition.read),v=vhfView;if(v?.active&&v.camera.flight&&(!v.playground||v.playground.report().mode==='explore')){i.boost=!!i.buttons[5];i.glide=!!i.buttons[4];i.buttons[4]=i.buttons[5]=false;}return i;},hasMotion:motion.active,resetMotion:()=>{motion.reset();playGesture=false;}}:{}),
  camera:()=>vhfView?.active?vhfView.camera:state.data.camera,
  bounds:()=>vhfView?.active?(vhfView.playground?.displayBounds()||vhfView.bounds):model.getViewBounds(U.getRegion()||state.data.region),
  maxZoom:()=>{if(vhfView?.active)return 14;const radius=model.getViewBounds(U.getRegion()||state.data.region)?.radius;
   return studioCameraActive()?14:Math.min(4,!Number.isFinite(radius)?2.1:radius<.55?3.3:radius<1.1?2.35:1.95);},
  canMove:()=>!document.getElementById('nexus-experience-menu')?.open&&(document.getElementById('playground-wheel')?.hidden!==false)&&enabled&&loaded&&model.getStatus()==='ready'&&!document.hidden&&document.hasFocus()&&!pointers.size&&$('evidence-sheet').hidden&&$('seam').hidden&&(presenceRequested?!!(vhfView?.active&&vhfView.ready&&!vhfView.traveling):((vhfView?.active||!pendingEntry)&&state.data.view!=='focused'&&!activeFrameRoute)),
  begin:()=>{pendingNexusSelection=null;if(vhfView?.active){cancelAxisFlight();return;}cancelAnimationFrame(motionFrame);motionFrame=0;U.interrupt();if(studioCameraActive())studioNavigation?.begin();},
  end:finish,render,command,status:setStatus,diagnostic:expeditionDiagnostic,
  onOpticalTick:(now,moving)=>{const change=optical.tick(now,moving||!!motionFrame||!!travelMixFrame);return change?applyQuality(change):false;},
  onOpticalSuspend:()=>optical.reset(performance.now())
 });
 function toggle(next){if(!next){cancelAxisFlight();if(!continuumRequested)vhfView?.travelAbort?.abort();}enabled=next;if(vhfView)vhfView.active=next&&vhfView.ready;if(!next)evidence.textContent='Reference anatomy · not clinically validated';visual.hidden=!next;model.setVisualMode(next?visual.value:'legacy');expeditionDiagnostic?.event('visual-mode',{mode:next?visual.value:'legacy'});quality.hidden=!next;applyQuality({...optical.set(quality.value,performance.now()),reason:'controller-toggle'});button.setAttribute('aria-pressed',String(next));button.textContent=next?'Exit controller':'Controller mode';hud.hidden=reticle.hidden=viewButton.hidden=!next;controls.setEnabled(next);setClean(next&&!(new URLSearchParams(location.search).get('nexus')==='1'&&!broadSource));if(next){setStatus('Press any controller button to connect');if(continuumRequested&&vhfView?.ready)streamAxis(vhfView);}}
 if(expeditionDiagnostic){
  const canvas=$('atlas-canvas');
  const report=()=>({...expeditionDiagnostic.report(),canvas:{backingWidth:canvas.width,backingHeight:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,devicePixelRatio:window.devicePixelRatio,effectiveScale:canvas.clientWidth?canvas.width/canvas.clientWidth:null},renderer:model.frameStats(),controller:{enabled,status:status.textContent},gravity:motion?{mode:gravityWorld.orbitPivot()?'inspection':'roam',spatialVersion:window.BodyGravityAdaptive.spatialVersion,eye:window.BodyGravityAdaptive.eye(vhfView?.active?vhfView.camera:state.data.camera),pivot:gravityWorld.orbitPivot()}:null,source:vhfView?{active:vhfView.active,ready:vhfView.ready,...vhfView.parts.sourceInfo,activeLOD:vhfView.stream?'adaptive-display':'source-full',streaming:vhfView.stream?{running:vhfView.stream.running,loaded:vhfView.parts.length,failed:[...vhfView.stream.failures.entries()]}:null,neighborhood:vhfView.neighborhood,category:vhfView.category,selected:vhfView.selected,triangles:vhfView.parts.reduce((n,p)=>n+p.indices.length/3,0),cpuGeometryBytes:vhfView.parts.reduce((n,p)=>n+p.positions.byteLength+p.indices.byteLength+(p.lods||[]).reduce((a,l)=>a+l.positions.byteLength+l.indices.byteLength,0),0)}:null,camera:JSON.parse(JSON.stringify(vhfView?.active?vhfView.camera:state.data.camera)),contextStatus:model.getStatus(),region:U.getRegion()||state.data.region,selectedStructure:vhfView?.active?vhfView.selected:U.getSelected(),visibilityLayer:state.data.layer,visualMode:enabled?visual.value:'legacy',qualityMode:optical.state().profile,optical:optical.state(),assetReadiness:{loaded,overviewLoaded,expansionLoaded,facialLoaded,osteologyLoaded}});
  window.__BODY_EXPEDITION_DIAGNOSTICS__=Object.freeze({report});
  const exportButton=document.createElement('button');exportButton.type='button';exportButton.id='expedition-diagnostics-export';exportButton.textContent='Export diagnostics';
  exportButton.onclick=()=>{const blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='body-live-expedition-diagnostics.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  button.parentElement.append(exportButton);
  if(window.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){
   try{const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())expeditionDiagnostic.sample('longTaskMs',entry.duration);});observer.observe({type:'longtask',buffered:false});expeditionDiagnostic.setLongTasksSupported(true);}catch{}
  }
  canvas.addEventListener('webglcontextlost',()=>expeditionDiagnostic.event('webgl-context-lost'));
  canvas.addEventListener('webglcontextrestored',()=>expeditionDiagnostic.event('webgl-context-restored',{status:model.getStatus()}));
  document.addEventListener('visibilitychange',()=>expeditionDiagnostic.event('visibility',{hidden:document.hidden}));
  window.addEventListener('gamepaddisconnected',event=>expeditionDiagnostic.event('controller-disconnected',{index:event.gamepad.index}));
 }
 async function activateSource(){if(!vhfRequested||!loaded||!enabled||model.getStatus()!=='ready')return;if(continuumRequested){if(axisActivating)return;axisActivating=true;try{evidence.textContent='Opening verified axial world…';let v=vhfView;if(!v){const stream=await window.BodyVHF.openAxisWorld();v={parts:stream.parts,bounds:stream.bounds,camera:{width:1,height:1,frameSpan:2.55},category:'All',selected:null,isolated:null,axisRegion:0,bounded:true,landmarks:stream.landmarks,stream};vhfView=v;v.fit=fitSource;fitSource();}await model.loadVHF([]);v.ready=true;v.active=enabled;window.dispatchEvent(new Event('bodylive:nexus-axis-ready'));streamAxis(v);render();}catch(e){if(vhfView){vhfView.active=false;vhfView.ready=false;}evidence.textContent='Axial world unavailable · '+e.message;expeditionDiagnostic?.event('vhf-fallback',{reason:e.message});render();}finally{axisActivating=false;}return;}if(axisActivating)return;axisActivating=true;try{evidence.textContent='Loading verified VHF specimen…';const parts=vhfView?.parts||await (axisRequested?window.BodyVHF.loadAxis(initialRegion,[],undefined,progress):worldRequested?window.BodyVHF.loadWorld():window.BodyVHF.load());await model.loadVHF(parts);const existing=vhfView;vhfView=existing||{parts,bounds:window.BodyVHF.bounds(parts),camera:{width:1,height:1,frameSpan:2.55},category:'All',selected:null,isolated:null,axisRegion:initialRegion,bounded:boundedRequested,landmarks:worldRequested?window.BodyVHF.landmarks(parts):[]};vhfView.ready=true;vhfView.active=enabled;vhfView.fit=fitSource;if(presenceRequested&&!vhfView.playground)vhfView.playground=window.BodyPlayground.create(parts,vhfView.bounds);if(!existing)fitSource();if(presenceRequested){presenceReadyAt=performance.now();presenceError='';render();window.dispatchEvent(new Event('bodylive:presence-ready'));}expeditionDiagnostic?.event('vhf-ready',{triangles:parts.reduce((n,p)=>n+p.indices.length/3,0),structures:parts.length});render();}catch(e){if(vhfView){vhfView.active=false;vhfView.ready=false;}presenceError='Anatomy unavailable: '+e.message;evidence.textContent='VHF unavailable · original retained: '+e.message;if(presenceRequested)window.dispatchEvent(new Event('bodylive:presence-progress'));expeditionDiagnostic?.event('vhf-fallback',{reason:e.message});render();}finally{axisActivating=false;}}
 if(vhfRequested){document.addEventListener('visibilitychange',()=>{if(!document.hidden&&vhfView?.active)render();});window.addEventListener('body:vhf-residency-frame',()=>{if(vhfView?.active)render();});window.addEventListener('body:vhf-base-ready',activateSource);window.addEventListener('body:webgl-restored',()=>{if(vhfView)vhfView.active=false;activateSource();});}
 viewButton.addEventListener('click',()=>setClean(!clean));
 button.addEventListener('click',()=>toggle(!enabled));
 window.addEventListener('pointerdown',e=>{pendingNexusSelection=null;cancelAxisFlight();pointers.add(e.pointerId);controls.interrupt();},true);
 const release=e=>pointers.delete(e.pointerId);window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);
 window.addEventListener('blur',()=>pointers.clear());window.addEventListener('pagehide',()=>toggle(false));
 expeditionBridge=Object.freeze({observeRecovery:observeFlightRecovery,adaptiveWheel:()=>gravityActive,spatialTravel:(z,x,y)=>{const v=vhfView;if(!v?.active||!v.camera.flight)return false;const A=window.BodyGravityAdaptive;const n=Math.max(1,Math.ceil(Math.max(Math.abs(z),Math.abs(x),Math.abs(y))*6));for(let j=0;j<n;j++)A.flightStep(v.camera,{panX:x/n*8,panY:y/n*8,orbitX:0,orbitY:0,zoom:z/n*8},.05,v.playground?.displayBounds()||v.bounds,gravityWorld.orbitPivot()?.point,flightBoxes(),gravityWorld.orbitPivot()?.kind==='surface');return true;},wideMobility:()=>wideMobility&&!!vhfView?.active,spatialOrbit:(dx,dy)=>{if(!wideMobility||!vhfView?.active)return false;const v=vhfView,c=v.camera,A=window.BodyGravityAdaptive,input={panX:0,panY:0,orbitX:dx*.008/(1.6*.05),orbitY:dy*.005/(1.15*.05),zoom:0};if(c.flight)A.flightStep(c,input,.05,v.playground?.displayBounds()||v.bounds,gravityWorld.orbitPivot()?.point,flightBoxes());else A.spatialStep(window.BodyExpedition.advance,c,input,.05,v.playground?.displayBounds()||v.bounds,14,gravityWorld.orbitPivot()?.point,false,true);return true;},render,pick:(x,y,opts)=>{if((continuumRequested||presenceRequested)&&vhfView?.active){const v=vhfView,hit=window.BodyVHF.pickHit(v.parts,v,v.camera,x,y);capturePivot(v,hit);if(presenceRequested&&v.selected&&v.playground?.report().mode==='grasp')playChange(p=>p.grab(v.selected));render();if(presenceRequested)window.dispatchEvent(new Event('bodylive:presence-selected'));return;}return pickAt(x,y,opts);}});
 if(new URLSearchParams(location.search).get('expedition')==='1')toggle(true);
 window.addEventListener('pageshow',event=>{if(event.persisted&&new URLSearchParams(location.search).get('expedition')==='1')toggle(true);});
}

function setup(){
 const canvas=$('atlas-canvas');
 const axialCamera=()=>(continuumRequested||presenceRequested)&&vhfView?.active?vhfView.camera:state.data.camera;
 const orbitCamera=(continuumRequested||presenceRequested)?new Proxy({}, {get:(_,key)=>axialCamera()[key],set:(_,key,value)=>{axialCamera()[key]=value;return true;}}):state.data.camera;
 window.BodySpatialCore.attachOrbit(canvas,{state:orbitCamera,adaptiveWheel:()=>expeditionBridge?.adaptiveWheel()??false,spatialTravel:(...args)=>expeditionBridge?.spatialTravel(...args)??false,wideMobility:()=>expeditionBridge?.wideMobility()??false,spatialOrbit:(...args)=>expeditionBridge?.spatialOrbit(...args)??false,render,pick:(x,y,opts)=>expeditionBridge?expeditionBridge.pick(x,y,opts):pickAt(x,y,opts),getBounds:()=>(continuumRequested||presenceRequested)&&vhfView?.active?(vhfView.playground?.displayBounds()||vhfView.bounds):model.getViewBounds(U.getRegion()||state.data.region),maxZoom:4,
  deepZoomEnabled:()=>(continuumRequested||presenceRequested)&&vhfView?.active||$('atlas-app').dataset.connectiveStudio==='true'&&U.getRegion()==='knee'&&state.data.view==='detail',deepMaxZoom:14,
  onInteract:()=>{
   if((continuumRequested||presenceRequested)&&vhfView?.active)return;
   if(studioCameraActive()){cancelAnimationFrame(motionFrame);motionFrame=0;studioNavigation?.begin();}
   U.interrupt();
  },
  onGestureEnd:()=>{if((continuumRequested||presenceRequested)&&vhfView?.active)return;if(studioCameraActive()){studioNavigation?.end();window.dispatchEvent(new Event('body:camera-transaction'));}},
  onDoubleTap:()=>{if((continuumRequested||presenceRequested)&&vhfView?.active){vhfView.fit();render();return;}recenter();}});
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
 function applyRouteState(region){
  const saved=pendingDeepLink;
  if(!saved||saved.region!==region||state.data.view!=='detail')return;
  pendingDeepLink=null;
  if(saved.tool==='peel'||saved.tool==='trace')U.setMode(saved.tool);
  if(Number.isInteger(saved.layer)&&saved.layer>=0&&saved.layer<=4)U.depthChange(saved.layer);
  if(saved.structure&&!U.selectById(saved.structure)){
   $('context-note').textContent='Selected structure unavailable in this source layer.';
  }
  window.BodyDesktopStudio?.sync();window.BodyMobileWorkbench?.sync();
 }
 window.addEventListener('body:region-ready',event=>applyRouteState(event.detail.region));
 window.addEventListener('popstate',()=>{
  const q=new URLSearchParams(location.search),raw=q.get('region'),target=routeRegion(raw);
  pendingDeepLink=target?{region:target,layer:q.has('layer')?Number(q.get('layer')):null,tool:q.get('tool'),structure:q.get('structure')}:null;
  restoringTarget=target||'';restoringHistory=true;
  try{
   if(target){
    if(state.data.region!==target||state.data.view==='overview')choose(target);
    else applyRouteState(target);
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
   $('context-note').textContent=button.dataset.overviewSystem==='connective'?'Connective coverage is partial: only licensed costal cartilage and limited limb fragments are available. Missing structures are not modeled.':'Explore the licensed source anatomy; missing tissues are not implied.';
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
 $('structure-chip-close').onclick=()=>{U.clearSelection();updateURL({replace:true});render();};
 buildPins();resize();setupExpedition();
 Promise.all([loader.load('atlas'),loader.load('provenance')]).then(([asset,provenance])=>{
  loader.verifyAtlas(asset,provenance);
  source=asset;proof=provenance;loaded=true;
  model.load(asset);$('scene-status').textContent=model.getStatus()==='ready'?'SOURCED SKELETON · 78 STRUCTURES':'2D FALLBACK';
  if(model.getStatus()!=='ready')fallback('WebGL2 unavailable');
  resize();window.dispatchEvent(new Event('body:vhf-base-ready'));
  // Explicit world Expedition uses only the base atlas as a failure fallback. Optional legacy geometry is not requested.
  if(broadSource&&new URLSearchParams(location.search).get('expedition')==='1')return;
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
  if(route){
   if(rawRegion!==route){
    routeQuery.set('region',route);
    history.replaceState(history.state,'',location.pathname+'?'+routeQuery.toString());
   }
   pendingDeepLink={region:route,layer:routeQuery.has('layer')?Number(routeQuery.get('layer')):null,tool:routeQuery.get('tool'),structure:routeQuery.get('structure')};
   choose(route);
   // Separately sourced nerve scenes require an explicit focused -> detail handoff.
   // A deep link has no human Enter click, so complete that handoff once selected.
   if(route==='nerve'){
    let attempts=0;
    const openNerveRoute=()=>{
     if(state.data.region!=='nerve'||++attempts>100)return;
     if(state.data.view==='focused')enterUnmatchedRegion('nerve');
     else if(state.data.view!=='detail')setTimeout(openNerveRoute,120);
    };
    openNerveRoute();
   }
  }
  else if(rawRegion){$('context-note').textContent='Unknown region: '+rawRegion+'. Showing the full body.';}
  if(new URLSearchParams(location.search).get('evidence')==='1'){setEvidence('evidence');showEvidence();}
 }).catch(err=>fallback(err.message));
}
function connectiveEnable(enabled=true){
 if(!enabled){model.setConnectiveState({enabled:false});render();return true;}
 if(U.getRegion()!=='knee'||!model.hasDetail('knee'))return false;
 try{if(!model.loadConnectiveIllustrations('knee'))return false;}
 catch(err){console.warn('Illustrative knee geometry unavailable',err);return false;}
 model.setConnectiveState({enabled:true,visible:{bones:true,muscles:true,ligament:true,tendon:true,fibrocartilage:true}});
 render();return true;
}
// V14: minimal public renderer seam for standalone connective components.
function connectiveFilter(filter,ids,ghost,landmarks){model.setConnectiveFilter(filter,ids,ghost,landmarks);render();return true;}
function connectiveFocus(id){
 if(state.data.view!=='detail'||!U.getRegion())return false;
 const bounds=model.getStructureBounds(U.getRegion(),id);
 if(!bounds||(U.getSelected()!==id&&!U.selectById(id)))return false;
 const c=state.data.camera;
 const frameSpan=Math.max(.35,Math.min(3.2,bounds.radius*3.8));
 const canvas=$('atlas-canvas'),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
 // WebGL scales to min(width/3.25,height/frameSpan) * zoom. On phones the WIDTH usually wins,
 // so reducing frameSpan alone does not zoom in (the previous hard-coded 1.1 could even zoom OUT).
 // 'Dive in' on V14 frames the structure at roughly half the usable view, while pinch can
 // continue to 14x. V13/legacy selection keeps its conservative former camera behavior.
 const deep=$('atlas-app').dataset.connectiveStudio==='true'&&U.getRegion()==='knee';
 const pixelsPerZoom=Math.max(1,Math.min(w/3.25,h/frameSpan));
 const targetDiameter=Math.min(w,h)*(deep?.55:.22);
 const fitted=targetDiameter/(2*Math.max(.08,bounds.radius)*pixelsPerZoom);
 const zoom=deep?Math.min(14,Math.max(c.zoom,2.5,Math.min(12,fitted))):Math.min(4,Math.max(1.6,fitted));
 animateCamera({...c,target:bounds.center,frameSpan,zoom},reduce()?0:360);
 return true;
}
function connectiveOrientation(yaw,pitch){
 if(state.data.view!=='detail')return false;
 const c=state.data.camera;
 animateCamera({...c,yaw:shortestYaw(c.yaw,Number(yaw)||0),pitch:Math.max(-1.3,Math.min(1.3,Number(pitch)||0))},reduce()?0:340);
 return true;
}
function connectiveNavAction(action,id){
 if(!studioCameraActive()||!studioNavigation)return false;
 if(action==='back')return studioNavigation.back();
 const c=state.data.camera;
 const ref=model.getStructureBounds('knee','patella');
 const base=ref?.center||centerPoint('knee');
 const onPhone=window.matchMedia('(max-width:850px), (max-width:980px) and (max-height:520px) and (orientation:landscape)').matches;
 const home={...c,yaw:shortestYaw(c.yaw,.47),pitch:-.11,
  zoom:onPhone?1.7:1.1,frameSpan:onPhone?2.55:3.2,target:{...base},anchorX:.5,anchorY:.5};
 if(action==='fit'){studioDive={id:null,step:0};return studioNavigation.move(home);}
 const bounds=id?model.getStructureBounds('knee',id):null;
 if(!bounds)return false;
 if(action==='locate'){
  studioDive={id,step:0};
  const target={x:base.x*.65+bounds.center.x*.35,y:base.y*.65+bounds.center.y*.35,z:base.z*.65+bounds.center.z*.35};
  return studioNavigation.move({...home,target,zoom:onPhone?1.85:1.4});
 }
 if(action==='dive'){
  if(studioDive.id!==id)studioDive={id,step:0};
  const proposed=window.BodyV14SpatialNavigation.diveFrame({
   camera:c,bounds,step:studioDive.step,project:window.BodySpatialCore.project
  });
  if(!proposed)return false;
  const changed=studioNavigation.move(proposed);
  if(changed)studioDive.step++;
  return changed;
 }
 if(action==='recenter'){
  // Preserve yaw/pitch, zoom and frameSpan. Only shift the camera target.
  return studioNavigation.move({...c,target:{...bounds.center},anchorX:.5,anchorY:.5});
 }
 if(action==='fit-selected'){
  const rect=window.BodyV14SpatialNavigation.projectedBounds(bounds,c,window.BodySpatialCore.project);
  if(!rect)return false;
  const fraction=Math.min(c.width,c.height)*.50/Math.max(1,rect.width,rect.height);
  const zoom=Math.max(.7,Math.min(14,c.zoom*fraction));
  return studioNavigation.move({...c,target:{...bounds.center},zoom,anchorX:.5,anchorY:.5});
 }
 return false;
}
function connectiveNavState(id){
 const c=studioNavigation?.state();
 const bounds=id?model.getStructureBounds('knee',id):null;
 const knee=model.getViewBounds('knee');
 const projection=bounds?window.BodyV14SpatialNavigation.projectedBounds(
  bounds,state.data.camera,window.BodySpatialCore.project):null;
 return {...(c||{canBack:false,depth:0,camera:{...state.data.camera}}),selectedBounds:bounds,
  selectedProjection:projection,progressiveDiveStep:studioDive.id===id?studioDive.step:0,
  selectedOffscreen:window.BodyV14SpatialNavigation.needsRecovery(projection,state.data.camera.width,state.data.camera.height),
  jointBounds:knee,projectionScale:cameraScale(state.data.camera.frameSpan)*state.data.camera.zoom};
}
const U=window.BodyAtlasUnified.create({state,model,loader,render,updateURL,resize,setExpanded,reduce,centerPoint,shortestYaw,enableControls,NOTE,LABEL,navigate:region=>choose(region)});
studioNavigation=window.BodyV14SpatialNavigation.create({
 capture:()=>state.data.camera,
 apply:destination=>{U.interrupt();cancelAnimationFrame(motionFrame);motionFrame=0;animateCamera(destination,reduce()?0:330);}
});
window.addEventListener('body:connective-studio-open',()=>{studioNavigation.clear();studioDive={id:null,step:0};});
window.BodyConnectiveMode?.mount({model,render,U});
window.__BODY_ATLAS__={touchCandidatesAt:(x,y,r)=>U.isActive()&&state.data.view==='detail'?U.touchCandidatesAt(x,y,r):null,touchPlanAt:(x,y,o)=>U.isActive()&&state.data.view==='detail'?U.touchPlanAt(x,y,o):null,hitTestAt:(x,y)=>U.isActive()&&state.data.view==='detail'?U.hitTestAt(x,y):null,getState:()=>({...state.snapshot(),renderer:model.stats(),unified:U.snapshot(),assetsLoaded:loaded,overviewLoaded,expansionLoaded,facialLoaded,osteologyLoaded,journey:pendingEntry?{region:pendingEntry.region,ready:pendingEntry.ready,traveled:pendingEntry.traveled}:null,pins:pins.length,viewport:{width:$('atlas-canvas').clientWidth,height:$('atlas-canvas').clientHeight}}),choose,pickAt,enter,body,recenter,focusOsteology,clearOsteologyFocus,setInspectorFrame,setMobileFrame,setFrameOwner,toKnee,seam,connectiveNavAction,connectiveNavState,showEvidence,closeEvidence,setEvidence,setMode,connectiveFilter,connectiveEnable,connectiveFocus,connectiveOrientation,connectiveSelect:id=>U.selectById(id),connectiveClear:()=>{U.clearSelection();render();},connectiveStructure:(region,id)=>model.getStructure(region,id),connectiveReset:()=>{model.setConnectiveFilter(null,null,false);U.reset();}};
setup();
})();