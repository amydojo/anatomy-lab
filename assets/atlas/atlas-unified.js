/* V6.3: no renderer handoff for source-matched Hip and Knee.
 * Source bones and detail layers remain in the same WebGL coordinate frame. */
(function(){'use strict';
function create({state,model,loader,render,updateURL,resize,setExpanded,reduce,centerPoint,shortestYaw,enableControls,NOTE,LABEL,navigate}){
 const $=id=>document.getElementById(id);
 let region=null,reveal=0,animation=0,token=0,returning=false,pending=false,motion=0,secondary=0,selected=null,navigation=null,transitionFrom=null;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const LAYERS={
  hip:['Surface','Stabilizers','Deep rotators','Skeleton'],
  knee:['Complete joint','Femur focus','Tibia / fibula','Patella focus'],
  shoulder:['Surface · partial','Rotator cuff','Cuff only','Bones only'],
  ...Object.fromEntries(Object.entries(window.BodyExtendedRegions.config).map(([id,c])=>[id,c.labels]))
 };
 const layerText=()=>LAYERS[region]?.[Math.min(window.BodyExtendedRegions.has(region)?4:3,state.data.layer)]||'Surface';
 const snapshot=()=>({region,reveal,returning,pending,motion,secondary,selected:selected?.id||null,transitionFrom});
 const isActive=()=>!!region||pending;
 const getRegion=()=>region;
 const getReveal=()=>reveal;
 const getMotion=()=>motion;
 const getSecondaryMotion=()=>secondary;
 const getSelected=()=>selected?.id||null;
 const getTransitionFrom=()=>transitionFrom;
 const easing=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const setStatus=text=>{$('scene-status').textContent=text;};
 function travel(to,ms,progress,done){
  cancelAnimationFrame(animation);
  const camera=state.data.camera;
  const from={yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,frameSpan:camera.frameSpan,target:{...camera.target}};
  const canvas=$('atlas-canvas'),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const base=span=>Math.min(w/3.25,h/Math.max(.2,span));
  // WebGL uses min(width-bound,height-bound). Naive frameSpan lerp hits that
  // threshold and visibly stalls/accelerates the perceived camera distance.
  // Interpolate projected scale continuously instead of interpolating zoom alone.
  const aScale=Math.max(.001,base(from.frameSpan)*from.zoom);
  const bScale=Math.max(.001,base(to.frameSpan)*to.zoom);
  const start=performance.now();
  const tick=now=>{
   const u=ms===0?1:clamp((now-start)/ms,0,1),v=easing(u);
   for(const key of ['yaw','pitch','frameSpan'])camera[key]=from[key]+(to[key]-from[key])*v;
   camera.zoom=Math.exp(Math.log(aScale)+(Math.log(bScale)-Math.log(aScale))*v)/base(camera.frameSpan);
   camera.target={x:from.target.x+(to.target.x-from.target.x)*v,y:from.target.y+(to.target.y-from.target.y)*v,z:from.target.z+(to.target.z-from.target.z)*v};
   progress(v);render();
   if(u<1)animation=requestAnimationFrame(tick);else{animation=0;done();}
  };
  if(ms===0)tick(performance.now());else animation=requestAnimationFrame(tick);
 }
 const INFORMATION={
  hipBone:['Right hip bone','Sourced pelvis bone forming the acetabulum, or hip socket.'],
  femur:['Right femur','The thigh bone transfers load between the hip and knee; movement shown here uses a simplified teaching pivot.'],
  sacrum:['Sacrum','Source-derived fused vertebral bone at the base of the spine.'],
  maximus:['Gluteus maximus','Sourced hip extensor muscle. Reference surface now deforms between estimated pelvic attachment and moving femoral insertion; attachments and muscle mechanics are not independently validated.'],
  medius:['Gluteus medius','Sourced hip abductor with anchored pelvis origin and inferred femoral insertion. Tendon mechanics are not validated.'],
  minimus:['Gluteus minimus','Deep hip abductor beneath gluteus medius.'],
  piriformis:['Piriformis','Deep posterior hip rotator. Sciatic nerve position is not verified in this model.'],
  obturator:['Obturator internus','Deep hip rotator with a tendon curving around the lesser sciatic notch.'],
  gemellusSuperior:['Superior gemellus','Small deep external rotator near obturator internus.'],
  gemellusInferior:['Inferior gemellus','Small deep external rotator below obturator internus.'],
  quadratus:['Quadratus femoris','Deep posterior hip muscle associated with rotation.'],
  clavicle:['Right clavicle','Source-derived collarbone linking the shoulder girdle to the thorax. An estimated sternoclavicular pivot drives bounded elevation; real joint mechanics are not validated.'],
  scapula:['Right scapula','The shoulder blade supports the glenoid socket and rotator-cuff origins. It now moves with the clavicle and humerus using an approximate educational motion curve, not measured scapular kinematics.'],
  humerus:['Right humerus','The upper-arm bone follows an estimated glenoid center during abduction, while the scapula and clavicle move along bounded illustrative curves. Muscle attachment weights and tissue mechanics are not validated.'],
  supraspinatus:['Supraspinatus','Rotator-cuff muscle passing above the scapular spine toward the greater tubercle. Mesh deformation is attachment-guided, not anatomist-validated.'],
  infraspinatus:['Infraspinatus','Posterior rotator-cuff muscle on the infraspinous fossa. Its mesh now bends toward the moving humerus using inferred attachments; not a validated tendon simulation.'],
  subscapularis:['Subscapularis','Anterior rotator-cuff muscle from the subscapular fossa toward the lesser tubercle.'],
  teresMinor:['Teres minor','Posterior rotator-cuff muscle contributing to external rotation and joint stability.'],
  teresMajor:['Teres major','Posterior shoulder muscle participating in adduction and internal rotation, not a rotator-cuff muscle.'],
  coracobrachialis:['Coracobrachialis','Shoulder flexor/adductor running from coracoid process to humerus.'],
  deltoidClavicular:['Deltoid · anterior','Clavicular deltoid portion. Only displayed if present in the verified source.'],
  deltoidAcromial:['Deltoid · middle','Acromial deltoid portion. Only displayed if present in the verified source.'],
  deltoidSpinal:['Deltoid · posterior','Scapular-spine deltoid portion, positioned on the same pinned source reference pose.'],
  bicepsLong:['Biceps brachii · long head','Long head originates at the supraglenoid region; its tendon and dynamic glenoid-labrum relationship are not independently reconstructed here.'],

  pectoralisClavicular:['Pectoralis major · clavicular','Clavicular part of pectoralis major, a shoulder flexor/adductor. The displayed muscle shape bends between inferred clavicular and humeral attachments, not a validated shortening simulation.'],

  popliteus:['Popliteus','Deep posterior knee muscle from lateral femur to posterior tibia. Its source mesh bends through inferred attachment weights; not a validated tendon model.'],
  vastusMedialis:['Vastus medialis','Medial quadriceps muscle from femur toward the patella. Moves with the simplified patellar geometry, not verified quadriceps tendon mechanics.'],
  vastusLateralis:['Vastus lateralis','Lateral quadriceps muscle from femur toward the patella. Inferred attachment weights are not independently anatomist-reviewed.'],
  vastusIntermedius:['Vastus intermedius','Deep quadriceps muscle between femoral origin and extensor insertion. Displayed deformation is not modeled contraction.'],
  bicepsShort:['Biceps femoris · short head','Hamstring short head arising on the femur and attaching near the fibular head. Moves with the illustrative knee hinge.'],
  tibia:['Right tibia','Primary weight-bearing shin bone; its movement is a schematic fixed-axis demonstration.'],
  fibula:['Right fibula','Lateral lower-leg bone.'],
  patella:['Right patella','Kneecap located anterior to the distal femur. Its tracking here is an approximation.']
 };
 function clearSelection(){
  selected=null;$('structure-chip').hidden=true;$('structure-details').hidden=true;
 }
 function pickAt(x,y){
  if(state.data.view!=='detail'||!region||returning)return null;
  const hit=model.hitTest(state.data.camera,region,state.data.layer,motion,x,y,secondary);
  // A miss must not redraw the full WebGL scene unless it clears an existing
  // highlight. Repeated empty taps (including mobile hit probing) otherwise
  // force synchronous GPU work and can stall the inspector interaction.
  if(!hit){
   if(selected){clearSelection();render();}
   return null;
  }
  return applySelection(hit);
 }
 function applySelection(hit){
  selected=hit;
  const regionalInfo=hit.id==='bicepsShort'&&hit.region==='shoulder'
    ? ['Biceps brachii · short head','Source-derived shoulder muscle surface. Attachment and motion validation remain pending.'] : null;
  const [name,desc]=regionalInfo||INFORMATION[hit.id]||(window.BodyExtendedRegions.has(hit.region)?
    [hit.name||hit.id.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),
     hit.tissue?'Licensed BodyParts3D 4.0 muscle surface. Where joints move, inferred proximity-to-bone attachment weights are illustrative, not verified physiology.':
     'Real BodyParts3D 4.0 bone surface in a registered reference pose. Selection and any illustrative motion are not an expert-verified diagnosis or biomechanical model.']:
    [hit.id,'Sourced anatomical reference, not clinically validated.']);
  $('structure-chip-name').textContent=name;
  $('structure-chip').hidden=false;
  $('structure-details-name').textContent=name;
  $('structure-details-description').textContent=desc;
  $('structure-details').hidden=false;
  render();updateURL({replace:true});return hit.id;
 }
 function selectById(id){
  if(!region||state.data.view!=='detail')return false;
  const hit=model.getStructure(region,id);
  return hit?!!applySelection(hit):false;
 }
 function showSelected(){
  if(!selected)return;
  setExpanded(true);
  $('structure-details').scrollIntoView({block:'nearest',behavior:reduce()?'auto':'smooth'});
 }
 function setMotion(value){
  if(!region||state.data.view!=='detail'||!window.BodyRegionMotion.profile(region))return;
  const max=window.BodyRegionMotion.profile(region).max;
  motion=clamp(Math.round(Number(value)||0),0,max);
  $('joint-motion-value').textContent=motion+'°';
  render();
 }
 function setSecondaryMotion(value){
  if(!region||state.data.view!=='detail')return;
  const conf=window.BodyRegionMotion.profile(region);if(!conf?.other)return;
  secondary=window.BodyRegionMotion.safe(region,motion,Number(value)).secondary;
  $('joint-secondary-slider').value=String(secondary);
  $('joint-secondary-value').textContent=secondary+'°';
  render();
 }
 function neutral(){
  motion=0;secondary=0;
  $('joint-motion-slider').value='0';$('joint-motion-value').textContent='0°';
  $('joint-secondary-slider').value='0';$('joint-secondary-value').textContent='0°';
  clearSelection();render();
 }
 function interrupt(){
  if(!isActive())return;
  cancelAnimationFrame(animation);animation=0;
  if(returning){
   region=null;reveal=0;returning=false;pending=false;motion=0;secondary=0;navigation=null;transitionFrom=null;
   state.data.layer=0;$('atlas-app').dataset.mode='overview';
   $('hotspots').hidden=false;
   setStatus((model.stats().overviewBones?'SOURCE-ALIGNED BONES + MUSCLES · V8':'SOURCED SKELETON · 78 STRUCTURES'));
   render();return;
  }
  if(pending)return;
  if(region&&state.data.view==='focused'){
   state.enter();state.data.frameReady=true;
   reveal=1;$('atlas-app').dataset.mode='immersive';
   transitionFrom=null;enableControls(region);syncControls(region);
   $('joint-motion').hidden=!window.BodyRegionMotion.profile(region);$('back-body').hidden=false;
   $('hotspots').hidden=true;updateURL();render();
  }
 }
 function nextRegion(name){
  if(!['hip','knee','nerve','shoulder',...window.BodyExtendedRegions.ids].includes(name))return false;
  if(!isActive())return choose(name);
  if(region===name)return false;
  if(name!=='nerve')return choose(name);
  navigation=name;
  back();
  return true;
 }
 function headline(name){
  $('sidebar-short').textContent=LABEL[name];
  $('panel-title').textContent=window.BodyExtendedRegions.has(name)?'Explore the '+window.BodyExtendedRegions.config[name].title.toLowerCase()+'.':name==='hip'?'Inside the right hip.':name==='shoulder'?'Inside the right shoulder.':'Explore the right knee.';
  $('panel-description').textContent=NOTE[name];
  $('panel-kicker').textContent='SAME SOURCE / '+LABEL[name];
  $('stage-title').textContent=LABEL[name]+' · SPATIAL APPROACH';
  $('stage-caveat').textContent=NOTE[name];
  $('context-note').textContent='Licensed bone and muscle surfaces share a pinned reference. Joint pivots and muscle attachments are inferred teaching approximations, not anatomist-validated biomechanics.';
  $('enter-region').disabled=true;$('enter-region').textContent='Exploring '+LABEL[name];
  $('back-body').hidden=false;$('top-enter-region').hidden=true;
  $('hotspots').hidden=true;$('portal').hidden=true;
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===name)));
  if(window.innerWidth<=850)setExpanded(false);
 }
 async function choose(name){
  if(!['hip','knee','shoulder',...window.BodyExtendedRegions.ids].includes(name))return;
  const direct=!!region&&state.data.view==='detail';
  if(isActive()&&state.data.view==='detail'&&!direct)return nextRegion(name);
  if(direct&&region===name)return false;
  const departing=direct?region:null;
  const id=++token;cancelAnimationFrame(animation);returning=false;pending=true;
  if(departing)model.touchDetail?.(departing);
  motion=0;secondary=0;clearSelection();
  if(!state.select(name))return;
  headline(name);$('atlas-app').dataset.mode='approach';
  setStatus('LOADING LICENSED SOURCE GEOMETRY');
  updateURL();render();
  try{
   if(!model.hasDetail(name)){
    const data=await loader.load(window.BodyExtendedRegions.has(name)?name+'Region':name==='hip'?'hipGeometry':name==='shoulder'?'shoulderGeometry':'kneeGeometry');
    if(id!==token)return;
    let complete=data;
    if(window.BodyExtendedRegions.has(name)){
      const provenance=await loader.load('extendedProof');
      if(id!==token)return;
      loader.verifyExtended(name,data,provenance);
    }
    if(name==='knee'){
     const muscles=await loader.load('kneeMuscles');
     const provenance=await loader.load('kneeMuscleProof');
     if(id!==token)return;
     loader.verifyKneeMuscles(muscles,provenance);
     complete={...data,muscle_meshes:muscles.parts};
    }
    if(name==='shoulder'){
     const provenance=await loader.load('shoulderProof');
     if(id!==token)return;
     loader.verifyShoulder(data,provenance);
    }
    model.loadDetail(name,complete);
   }
   if(id!==token)return;
   region=name;reveal=0;pending=false;transitionFrom=departing;
   setStatus(direct?'TRAVELING DIRECTLY BETWEEN REGIONS':'TRAVELING IN ONE ANATOMICAL SCENE');
   const c=state.data.camera;
   const extra=window.BodyExtendedRegions.config[name];
   const to={yaw:shortestYaw(c.yaw,extra?extra.yaw:name==='hip'?Math.PI+.28:name==='shoulder'?.48:.47),
     pitch:-.11,zoom:extra?extra.zoom:name==='hip'?1.05:name==='shoulder'?1.00:1.10,
     frameSpan:extra?extra.span:name==='hip'?3.4:name==='shoulder'?3.15:3.2,target:centerPoint(name)};
   travel(to,reduce()?0:(direct?620:900),v=>{reveal=direct?v:clamp((v-.35)/.65,0,1);},()=>{
    if(id!==token)return;
    state.enter();state.data.frameReady=true;reveal=1;transitionFrom=null;
    $('atlas-app').dataset.mode='immersive';
    $('stage-title').textContent=LABEL[name]+' · IN PLACE';
    setStatus('ONE SCENE · SOURCE GEOMETRY UNREVIEWED');
    enableControls(name);syncControls(name);$('back-body').hidden=false;
    $('joint-motion').hidden=!window.BodyRegionMotion.profile(name);
    $('top-continue-knee').hidden=name!=='hip';
    updateURL();render();window.BodyMobileWorkbench?.sync();window.BodyDesktopStudio?.sync();
    window.dispatchEvent(new CustomEvent('body:region-ready',{detail:{region:name}}));
   });
  }catch(error){
   if(id!==token)return;
   pending=false;region=departing;reveal=departing?1:0;transitionFrom=null;
   if(departing){state.select(departing);state.enter();$('atlas-app').dataset.mode='immersive';}
   else{state.body();$('atlas-app').dataset.mode='overview';}
   setStatus('SOURCED DETAIL UNAVAILABLE · OVERVIEW RETAINED');
   $('context-note').textContent='The additional source geometry could not be verified: '+error.message;
   $('enter-region').disabled=false;$('enter-region').textContent='Open standalone lab ↗';
   $('top-enter-region').hidden=false;$('top-enter-region').textContent='Open separate lab ↗';
   render();
  }
 }
 function back(){
  const id=++token;cancelAnimationFrame(animation);pending=false;transitionFrom=null;
  $('joint-motion').hidden=true;clearSelection();
  $('mode-trace').textContent='Trace';
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
  // An internal stop during a direct region transfer is not user navigation.
  setStatus('RETURNING THROUGH THE BODY');if(!navigation)updateURL();
  travel(home,reduce()?0:850,v=>{reveal=1-v;},()=>{
   if(id!==token)return;
   region=null;reveal=0;returning=false;state.data.layer=0;motion=0;secondary=0;
   $('hotspots').hidden=false;setStatus((model.stats().overviewBones?'SOURCE-ALIGNED BONES + MUSCLES · V8':'SOURCED SKELETON · 78 STRUCTURES'));
   render();window.BodyDesktopStudio?.sync();window.BodyMobileWorkbench?.sync();
   if(navigation){const to=navigation;navigation=null;navigate(to);}
  });
 }
 function travelKnee(){
  if(!state.completeTransfer())return false;
  $('seam').hidden=true;
  if(region==='hip'){
   navigation='knee';back();return true;
  }
  return nextRegion('knee');
 }
 function syncControls(name){
  const trace=$('mode-trace'),peel=$('mode-peel'),output=$('layer-output');
  const motionSpec=window.BodyRegionMotion.profile(name);
  const extended=window.BodyExtendedRegions.has(name);
  trace.disabled=false;
  trace.textContent='Muscles';
  trace.title='Show existing source muscle meshes with faint bone context; missing anatomy is not synthesized';
  peel.textContent=window.BodyExtendedRegions.has(name)?'Isolate':name==='knee'?'Isolate':name==='shoulder'?'Layers':'Peel';
  $('joint-motion-label').textContent=motionSpec?.label||'Teaching motion';
  $('motion-description').textContent='REGIONAL KINEMATICS · UNVALIDATED';
  $('joint-motion-slider').max=String(motionSpec?.max||0);
  $('joint-motion-slider').setAttribute('aria-label',motionSpec?.label||'Primary teaching motion');
  const sec=$('joint-secondary-control');sec.hidden=!motionSpec?.other;
  $('joint-secondary-label').textContent=motionSpec?.other||'Secondary motion';
  $('joint-secondary-slider').min=String(motionSpec?.minSecondary||0);
  $('joint-secondary-slider').max=String(motionSpec?.maxSecondary||0);
  $('joint-secondary-slider').setAttribute('aria-label',motionSpec?.other||'Secondary illustrative movement');
  $('joint-secondary-slider').value='0';$('joint-secondary-value').textContent='0°';
  $('joint-motion-slider').value='0';$('joint-motion-value').textContent='0°';
  $('layer-slider').max=extended?'4':'3';
  $('layer-slider').disabled=false;
  output.textContent=LAYERS[name][0];
 }
 function depthChange(value){
  state.setDepth(value);
  const v=state.data.layer;clearSelection();
  $('layer-output').textContent=layerText();
  state.mode(v>0?'peel':'explore');
  const displayed=v===4&&window.BodyExtendedRegions.has(region)?'trace':v>0?'peel':'explore';
  document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-'+displayed)));
  render();updateURL({replace:true});
 }
 function setMode(mode){
  if(mode==='trace'){
   if(window.BodyExtendedRegions.has(region)&&state.data.view==='detail'){depthChange(4);return;}
   if(!region||state.data.view!=='detail')return;
   state.mode('trace');state.setDepth(0);clearSelection();
   $('layer-slider').value='0';$('layer-output').textContent='Source muscles';
   document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-trace')));
   $('context-note').textContent='Visible muscle surfaces are sourced; missing tendons and connective tissues are not reconstructed.';
   render();updateURL({replace:true});return;
  }
  if(!state.mode(mode))return;
  // Mode buttons are actions, not mere labels. Explore restores all available
  // sourced surfaces; Peel/Isolate enters a meaningful first depth stage.
  if(mode==='peel'&&state.data.layer===0)state.setDepth(1);
  if(mode==='explore')state.setDepth(0);
  $('layer-slider').value=String(state.data.layer);
  $('layer-output').textContent=layerText();
  clearSelection();
  document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-'+mode)));
  $('context-note').textContent=mode==='peel'&&region==='shoulder'
   ?'Four rotator-cuff muscle surfaces from the same pinned source. Deltoid, labrum, ligaments and nerve geometry are not yet verified in this layer.'
   :mode==='peel'?'Selected layers come from their attributed sources. Motion remains an illustrative pivot, not clinical biomechanics.'
   :NOTE[region]||'Source-derived skeletal geometry.';
  render();updateURL({replace:true});
 }
 function reset(){
  if(!region)return;
  state.setDepth(0);motion=0;secondary=0;transitionFrom=null;clearSelection();$('joint-motion-slider').value='0';$('joint-motion-value').textContent='0°';$('joint-secondary-slider').value='0';$('joint-secondary-value').textContent='0°';$('layer-slider').value='0';
  $('layer-output').textContent=LAYERS[region][0];
  state.mode('explore');
  document.querySelectorAll('.seg-control button').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='mode-explore')));
  const c=state.data.camera;
  const extra=window.BodyExtendedRegions.config[region];
  const home={yaw:shortestYaw(c.yaw,extra?extra.yaw:region==='hip'?Math.PI+.28:region==='shoulder'?.48:.47),pitch:-.11,
   zoom:extra?extra.zoom:region==='hip'?1.05:region==='shoulder'?1.00:1.10,
   frameSpan:extra?extra.span:region==='hip'?3.4:region==='shoulder'?3.15:3.2,target:centerPoint(region)};
  const id=++token;
  travel(home,reduce()?0:480,()=>{},()=>{if(id===token)render();});
 }
 function recenter(){
  if(!region||state.data.view!=='detail')return false;
  const c=state.data.camera,extra=window.BodyExtendedRegions.config[region];
  const target={yaw:shortestYaw(c.yaw,extra?extra.yaw:region==='hip'?Math.PI+.28:region==='shoulder'?.48:.47),
   pitch:-.11,zoom:extra?extra.zoom:region==='hip'?1.05:region==='shoulder'?1:1.1,
   frameSpan:extra?extra.span:region==='hip'?3.4:region==='shoulder'?3.15:3.2,target:centerPoint(region)};
  travel(target,reduce()?0:300,()=>{},()=>render());
  return true;
 }
 return Object.freeze({choose,back,travelKnee,isActive,getRegion,getReveal,getMotion,getSecondaryMotion,getSelected,getTransitionFrom,
  snapshot,depthChange,setMode,reset,recenter,neutral,setMotion,setSecondaryMotion,pickAt,selectById,clearSelection,showSelected,nextRegion,interrupt});
}
window.BodyAtlasUnified=Object.freeze({create});
})();