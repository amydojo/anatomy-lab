/* BODY / LIVE V8.3: mobile-first interaction layer.
 * Preserves canonical geometry, U state, and verified joint motion APIs.
 * A single contextual tray; all actions route to existing source controllers.
 */
(function(){'use strict';
const $=id=>document.getElementById(id);
const atlas=window.__BODY_ATLAS__;
if(!atlas||!$('mobile-workbench'))return;
const labels={skull:'SKULL & JAW',neck:'NECK',thorax:'RIBS & THORAX',
 shoulder:'SHOULDER',elbow:'ELBOW',wrist:'WRIST & HAND',hip:'HIP',knee:'KNEE',
 ankle:'ANKLE & FOOT',nerve:'SCIATIC NERVE'};
const tools=['explore','layers','move','inspect'];let activeTool='explore',lastRegion=null,lastSelection=null,focusBefore=null,modalOpen=false,inspectExpanded=false;
const isMobile=()=>matchMedia('(max-width:850px)').matches;
const press=(id)=>$(id)?.click();
function snapshot(){return atlas.getState();}
function regionOf(s){return s.view==='overview'?null:(s.unified?.region||s.region||null);}
function stateIsDetail(s){return s.view==='detail'&&!!regionOf(s);}
function eligibleMove(s){const r=regionOf(s);return stateIsDetail(s)&&!!window.BodyRegionMotion?.profile(r);}
function moveHint(){
 const picker=$('mobile-region');
 if(!picker)return;
 picker.focus();
 picker.click();
}
function setPanel(tool){
 if(!tools.includes(tool))return false;
 const s=snapshot();
 if(tool==='move'&&!eligibleMove(s)){moveHint();return false;}
 activeTool=tool;
 renderState(s);
 return true;
}
function setInput(id,value){
 const input=$(id);if(!input)return;
 input.value=String(value);
 input.dispatchEvent(new Event('input',{bubbles:true}));
}
function openPicker(){
 if(!isMobile()||modalOpen)return;
 focusBefore=document.activeElement;
 modalOpen=true;
 const sheet=$('mobile-region-sheet');sheet.hidden=false;
 sync();
 $('mobile-region-close').focus();
}
function closePicker({restore=true}={}){
 if(!modalOpen)return;
 modalOpen=false;$('mobile-region-sheet').hidden=true;
 if(restore)(focusBefore?.isConnected?focusBefore:$('mobile-region')).focus();
 focusBefore=null;
}
function renderState(s){
 const region=regionOf(s),detail=stateIsDetail(s),motion=window.BodyRegionMotion?.profile(region);
 if(activeTool==='move'&&s.view==='overview')activeTool='explore';
 $('mobile-motion-slider').disabled=!eligibleMove(s);
 $('mobile-secondary-slider').disabled=!eligibleMove(s);
 $('mobile-neutral').disabled=!eligibleMove(s);
 $('mobile-region-name').textContent=region?labels[region]:'FULL BODY';
 $('mobile-home').hidden=!region;
 $('mobile-source').hidden=!(region==='nerve'&&s.view==='focused');
 $('mobile-frame').hidden=region==='nerve'&&s.view==='focused';
 $('mobile-region').setAttribute('aria-label',region?'Current region '+labels[region]+'. Choose a different region':'Choose an anatomical region');
 $('mobile-workbench').dataset.tool=activeTool;
 atlas.setMobileFrame?.(isMobile()&&activeTool!=='explore');
 for(const b of document.querySelectorAll('[data-mobile-tool]')){
  b.setAttribute('aria-pressed',String(b.dataset.mobileTool===activeTool));
  if(b.dataset.mobileTool==='move'){
   // Keep Move actionable: tapping it on the overview opens the region picker.
   b.disabled=false;
   b.setAttribute('aria-disabled',String(!eligibleMove(s)));
   b.title=!eligibleMove(s)?'Choose a joint region to enable motion':'Move the joint';
  }
 }
 $('mobile-panel').hidden=activeTool==='explore';
 $('mobile-layers').hidden=activeTool!=='layers';
 $('mobile-move').hidden=activeTool!=='move';
 $('mobile-inspect').hidden=activeTool!=='inspect';
 $('mobile-overview-tissues').hidden=detail;
 $('mobile-region-layers').hidden=!detail;
 if(activeTool==='layers'){
  if(!detail){
   const system=s.renderer?.overviewSystem||'combined';
   $('mobile-layer-value').textContent=system==='combined'?'Both':system==='connective'?'Connective · partial':system[0].toUpperCase()+system.slice(1);
   document.querySelectorAll('[data-mobile-tissue]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileTissue===system)));
  }else{
   $('mobile-layer-value').textContent=$('layer-output').textContent;
   $('mobile-layer-output').textContent=$('layer-output').textContent;
   $('mobile-layer-slider').max=$('layer-slider').max;
   $('mobile-layer-slider').value=String(s.layer);
   document.querySelectorAll('[data-mobile-layer-mode]').forEach(b=>{
    const original=$('mode-'+b.dataset.mobileLayerMode);
    b.disabled=!!original?.disabled;
    b.setAttribute('aria-pressed',original?.getAttribute('aria-pressed')||'false');
   });
  }
 }
 if(isMobile()&&region==='shoulder'&&activeTool==='move'){
  const rig=$('shoulder-rig-tools');
  if(rig.parentElement!==$('mobile-move'))$('mobile-move').append(rig);
 }
 if(motion){
  $('mobile-motion-label').textContent=motion.label;
  $('mobile-motion-slider').max=String(motion.max);
  $('mobile-motion-slider').value=String(s.unified?.motion||0);
  $('mobile-motion-value').textContent=(s.unified?.motion||0)+'°';
  const secondary=$('mobile-secondary-row');
  secondary.hidden=!motion.other;
  if(motion.other){
   $('mobile-secondary-label').textContent=motion.other;
   $('mobile-secondary-slider').min=String(motion.minSecondary);
   $('mobile-secondary-slider').max=String(motion.maxSecondary);
   $('mobile-secondary-slider').value=String(s.unified?.secondary||0);
   $('mobile-secondary-value').textContent=(s.unified?.secondary||0)+'°';
  }
 }
 const selected=s.unified?.selected;
 $('mobile-inspect-name').textContent=selected?$('structure-details-name').textContent:'Tap a structure to inspect';
 $('mobile-inspect-description').textContent=selected?$('structure-details-description').textContent:
  'Pinch in to examine smaller structures, then tap a bone or muscle.';
 $('mobile-inspect-clear').hidden=!selected;
 $('mobile-inspect-expand').hidden=!selected;
 $('mobile-inspect-expand').setAttribute('aria-expanded',String(inspectExpanded));
 $('mobile-inspect-expand').textContent=inspectExpanded?'Less anatomy ▴':'More anatomy ▾';
 $('mobile-inspect-details').hidden=!selected||!inspectExpanded;
 if(selected){
  const title=$('structure-details-name').textContent||String(selected);
  const description=$('structure-details-description').textContent||'';
  const kind='Anatomical structure';
  const info=window.BodyAnatomyInfo?.lookup(selected);
  $('mobile-inspect-type').textContent=(info?.type||kind)+' · '+(labels[region]||'Whole body');
  $('mobile-inspect-context').textContent=info?info.summary+' Related: '+info.relations+'. Reference: '+info.source+'.':(description||'Additional verified anatomical relationships are not yet available for this structure.');
  $('mobile-anatomy-source').hidden=!info;
  if(info)$('mobile-anatomy-source').href=info.sourceUrl;
  $('mobile-inspect-motion').hidden=!eligibleMove(s);
  $('mobile-inspect-motion').textContent='Explore '+(labels[region]||'region').toLowerCase()+' teaching motion';
 }
 document.querySelectorAll('[data-mobile-region]').forEach(b=>
  b.setAttribute('aria-pressed',String(b.dataset.mobileRegion===region)));
 lastRegion=region;lastSelection=selected;
}
function sync(){renderState(snapshot());}
for(const b of document.querySelectorAll('[data-mobile-tool]'))b.addEventListener('click',()=>{
 const next=b.dataset.mobileTool;
 if(next===activeTool&&next!=='explore')setPanel('explore');else setPanel(next);
});
$('mobile-region').addEventListener('click',openPicker);
$('mobile-region-close').addEventListener('click',()=>closePicker());
$('mobile-region-sheet').querySelector('[data-mobile-close]').addEventListener('click',()=>closePicker());
$('mobile-region-sheet').addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();return;}
 if(e.key!=='Tab')return;
 const focusable=[...document.querySelectorAll('#mobile-region-sheet .mobile-region-card button:not([disabled])')];
 if(!focusable.length)return;
 const first=focusable[0],last=focusable[focusable.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
for(const b of document.querySelectorAll('[data-mobile-region]'))b.addEventListener('click',()=>{
 const name=b.dataset.mobileRegion;
 closePicker({restore:false});
 setPanel('explore');
 atlas.choose(name);
 $('mobile-region').focus({preventScroll:true});
 requestAnimationFrame(sync);
});
$('mobile-home').addEventListener('click',()=>{
 closePicker({restore:false});setPanel('explore');atlas.body();requestAnimationFrame(sync);
});
$('mobile-source').addEventListener('click',()=>{atlas.enter();requestAnimationFrame(sync);});
$('mobile-frame').addEventListener('click',()=>{atlas.recenter?.();requestAnimationFrame(sync)});
document.querySelectorAll('[data-mobile-tissue]').forEach(b=>b.addEventListener('click',()=>{
 const original=document.querySelector('[data-overview-system="'+b.dataset.mobileTissue+'"]');
 original?.click();sync();
}));
document.querySelectorAll('[data-mobile-layer-mode]').forEach(b=>b.addEventListener('click',()=>{
 if(b.disabled)return;
 press('mode-'+b.dataset.mobileLayerMode);sync();
}));
$('mobile-layer-slider').addEventListener('input',e=>{setInput('layer-slider',e.target.value);sync();});
// Direct manipulation: horizontal drags across the anatomical stage adjust the
// selected joint's primary angle. Only intercept gestures in Move mode; preserve
// ordinary orbit/pan/pinch in Explore and multi-touch gestures everywhere.
const stage=$('atlas-canvas');
let jointDrag=null;
const jointTouches=new Set();
if(stage){
 stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'){
   jointTouches.add(e.pointerId);
   if(jointTouches.size>1){jointDrag=null;return;}
  }
  if(!isMobile()||activeTool!=='move'||!eligibleMove(snapshot())||!e.isPrimary||e.pointerType==='mouse')return;
  const slider=$('mobile-motion-slider');
  jointDrag={id:e.pointerId,x:e.clientX,angle:Number(slider.value),min:Number(slider.min||0),max:Number(slider.max||90)};
  stage.setPointerCapture?.(e.pointerId);
 },{capture:true});
 stage.addEventListener('pointermove',e=>{
  if(!jointDrag||e.pointerId!==jointDrag.id||!e.isPrimary)return;
  if(!isMobile()||activeTool!=='move'||!eligibleMove(snapshot())){jointDrag=null;return;}
  const next=Math.max(jointDrag.min,Math.min(jointDrag.max,Math.round(jointDrag.angle+(e.clientX-jointDrag.x)*.45)));
  setInput('joint-motion-slider',next);
  $('mobile-motion-slider').value=String(next);
  $('mobile-motion-value').textContent=next+'°';
  // Camera input still records the pointer position for a seamless second-finger
  // handoff, but defaultPrevented keeps it from orbiting during joint motion.
  e.preventDefault();
 },{capture:true,passive:false});
 const stop=e=>{
  jointTouches.delete(e.pointerId);
  if(jointDrag?.id===e.pointerId){e.preventDefault();jointDrag=null;sync();}
 };
 stage.addEventListener('lostpointercapture',stop,{capture:true});
 stage.addEventListener('pointerup',stop,{capture:true});
 stage.addEventListener('pointercancel',stop,{capture:true});
}
$('mobile-motion-slider').addEventListener('input',e=>{setInput('joint-motion-slider',e.target.value);sync();});
$('mobile-secondary-slider').addEventListener('input',e=>{setInput('joint-secondary-slider',e.target.value);sync();});
$('mobile-neutral').addEventListener('click',()=>{press('joint-rest');sync();});
$('mobile-inspect-clear').addEventListener('click',()=>{inspectExpanded=false;press('structure-chip-close');sync();});
$('mobile-inspect-expand').addEventListener('click',()=>{inspectExpanded=!inspectExpanded;sync();});
$('mobile-inspect-motion').addEventListener('click',()=>setPanel('move'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen){closePicker();}});
const observer=new MutationObserver(()=>{
 if(!isMobile())return;
 const s=snapshot(),r=regionOf(s),id=s.unified?.selected;
 if(r!==lastRegion||id!==lastSelection||$('atlas-app').dataset.mode!==$('mobile-workbench').dataset.mode){
  // Direct structure taps must produce immediate visible feedback. The old
  // inspector chip is intentionally hidden on phones, so open the one-pane
  // inspector when a new source surface is selected.
  if(id&&id!==lastSelection){activeTool='inspect';inspectExpanded=false;}
  $('mobile-workbench').dataset.mode=$('atlas-app').dataset.mode;
  sync();
 }
});
observer.observe($('atlas-app'),{attributes:true,attributeFilter:['data-mode']});
observer.observe($('structure-chip'),{attributes:true,attributeFilter:['hidden']});
observer.observe($('structure-chip-name'),{childList:true,characterData:true,subtree:true});
window.addEventListener('popstate',sync);
window.addEventListener('resize',()=>{if(!isMobile())closePicker({restore:false});sync()},{passive:true});
$('mobile-workbench').dataset.mode=$('atlas-app').dataset.mode;
sync();
window.BodyMobileWorkbench=Object.freeze({sync,setPanel,openPicker,closePicker,snapshot:()=>({
 tool:activeTool,region:lastRegion,selected:lastSelection,pickerOpen:modalOpen,
 visible:isMobile(),motionEnabled:!document.querySelector('[data-mobile-tool="move"]')?.disabled
})});
})();
