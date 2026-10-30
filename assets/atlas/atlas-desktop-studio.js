/* BODY / LIVE V8.4 — Desktop specimen studio.
 * UI only. Source geometry, WebGL deformation, registry and kinematic engines
 * stay controlled by the existing Atlas APIs. Nothing is duplicated.
 */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const atlas=window.__BODY_ATLAS__;
 if(!atlas||!$('desktop-studio'))return;
 const labels={skull:'SKULL & JAW',neck:'CERVICAL SPINE',thorax:'RIBS & THORAX',
  shoulder:'SHOULDER',elbow:'ELBOW',wrist:'WRIST & HAND',hip:'RIGHT HIP',
  knee:'RIGHT KNEE',ankle:'ANKLE & FOOT',nerve:'SCIATIC NERVE'};
 const isDesktop=()=>matchMedia('(min-width:851px)').matches;
 const tools=['explore','layers','move','inspect'];
 let active='explore',selected=null,region=null,modalOpen=false,previousFocus=null;
 const state=()=>atlas.getState();
 const regionOf=s=>s.view==='overview'?null:(s.unified?.region||s.region||null);
 const detail=s=>s.view==='detail'&&!!regionOf(s);
 const motionFor=s=>detail(s)?window.BodyRegionMotion?.profile(regionOf(s)):null;
 const clickOriginal=id=>$(id)?.click();
 function putInput(id,value){
  const el=$(id);if(!el)return;
  el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
 }
 function setInspector(visible,{instant=false}={}){
  const on=!!visible;
  $('studio-inspector').hidden=!on;
  atlas.setInspectorFrame?.(on,instant);
 }
 function chooseTool(which){
  if(!tools.includes(which)||!isDesktop())return false;
  const s=state();
  if(which==='move'&&!motionFor(s))return false;
  if(which==='inspect'&&!detail(s))return false;
  active=which;
  sync(s);
  return true;
 }
 function openPicker(){
  if(!isDesktop()||modalOpen)return;
  previousFocus=document.activeElement;
  modalOpen=true;
  $('studio-region-sheet').hidden=false;
  $('studio-region-search').value='';
  filterRegions('');
  renderRegions();
  $('studio-region-search').focus();
 }
 function closePicker({restore=true}={}){
  if(!modalOpen)return;
  modalOpen=false;$('studio-region-sheet').hidden=true;
  if(restore){
   const fallback=$('studio-current');
   const prev=previousFocus;
   // A keyboard-opened dialog often begins from <body>, which is not
   // reliably focusable. Always restore to an actual interactive control.
   const usable=prev&&prev!==document.body&&prev.isConnected&&
     prev.matches('button,a[href],input,select,textarea,[tabindex]')&&
     prev.getClientRects().length>0;
   const el=usable?prev:fallback;
   el.focus({preventScroll:true});
  }
  previousFocus=null;
 }
 function filterRegions(raw){
  const query=String(raw||'').toLocaleLowerCase().trim();
  let count=0;
  document.querySelectorAll('[data-studio-region]').forEach(b=>{
   const hay=(b.innerText+' '+b.dataset.studioRegion).toLocaleLowerCase();
   const yes=!query||hay.includes(query);
   b.hidden=!yes;if(yes)count++;
  });
  $('studio-region-empty').hidden=count>0;
 }
 function renderRegions(){
  const r=regionOf(state());
  document.querySelectorAll('[data-studio-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioRegion===r)));
 }
 function sync(incoming){
  if(!isDesktop())return;
  const s=incoming||state(),r=regionOf(s),inside=detail(s),profile=motionFor(s);
  if((active==='move'&&!profile)||(active==='inspect'&&!inside))active='explore';
  if(selected&&selected!==s.unified?.selected&&s.unified?.selected){
   // Selection changed through the original engine; update the inspector
   // immediately rather than requiring a second click on the old chip.
   active='inspect';
  }
  selected=s.unified?.selected||null;
  region=r;
  $('studio-current-label').textContent=r?labels[r]:'WHOLE BODY';
  $('studio-body').disabled=!r;
  $('studio-source-note').textContent=r==='nerve'?'SEPARATE SOURCE REGISTRATION · SCIATIC NERVE':
    'BODYPARTS3D 4.0 · SOURCE REGISTERED';
  $('studio-open-nerve').hidden=!(r==='nerve'&&s.view==='focused');
  $('studio-context').textContent=inside?'DRAG TO ORBIT · SHIFT-DRAG TO PAN · SCROLL TO ZOOM · CLICK TO INSPECT':
    'DRAG TO ORBIT · SHIFT-DRAG TO PAN · SCROLL TO ZOOM · G TO SEARCH';
  for(const btn of document.querySelectorAll('[data-studio-tool]')){
   const which=btn.dataset.studioTool;
   btn.disabled=(which==='move'&&!profile)||(which==='inspect'&&!inside);
   btn.setAttribute('aria-pressed',String(active===which));
   btn.title=which==='move'&&!profile?'This region has no sourced teaching motion':which[0].toUpperCase()+which.slice(1);
  }
  $('studio-tray').hidden=active!=='layers'&&active!=='move';
  $('studio-layers').hidden=active!=='layers';
  $('studio-motion').hidden=active!=='move';
  if(active==='layers'){
   $('studio-tray-kicker').textContent='SPECIMEN / 02';
   $('studio-tray-title').textContent='Tissue & depth';
   $('studio-tissues').hidden=inside;
   $('studio-region-layers').hidden=!inside;
   const system=s.renderer.overviewSystem||'combined';
   document.querySelectorAll('[data-studio-tissue]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.studioTissue===system)));
   if(inside){
    $('studio-layer-slider').max=$('layer-slider').max;
    $('studio-layer-slider').value=String(s.layer);
    $('studio-layer-output').textContent=$('layer-output').textContent;
    document.querySelectorAll('[data-studio-layer-mode]').forEach(btn=>{
     const original=$('mode-'+btn.dataset.studioLayerMode);
     btn.disabled=!!original.disabled;
     btn.setAttribute('aria-pressed',original.getAttribute('aria-pressed')||'false');
    });
   }
  }
  if(profile){
   $('studio-motion-name').textContent=profile.label;
   $('studio-motion-slider').min='0';
   $('studio-motion-slider').max=String(profile.max);
   $('studio-motion-slider').value=String(s.unified.motion||0);
   $('studio-motion-degree').textContent=(s.unified.motion||0)+'°';
   $('studio-secondary-wrap').hidden=!profile.other;
   if(profile.other){
    $('studio-secondary-name').textContent=profile.other;
    $('studio-secondary-slider').min=String(profile.minSecondary);
    $('studio-secondary-slider').max=String(profile.maxSecondary);
    $('studio-secondary-slider').value=String(s.unified.secondary||0);
    $('studio-secondary-degree').textContent=(s.unified.secondary||0)+'°';
   }
   if(active==='move'){
    $('studio-tray-kicker').textContent='SPECIMEN / 03';
    $('studio-tray-title').textContent=profile.label;
   }
  }
  const inspectorOpen=active==='inspect'&&inside;
  if($('studio-inspector').hidden===inspectorOpen)setInspector(inspectorOpen);
  if(inspectorOpen){
   $('studio-inspector-region').textContent=labels[r]+' / '+(selected?'SELECTED STRUCTURE':'EXPLORE TO SELECT');
   $('studio-inspector-name').textContent=selected?$('structure-details-name').textContent:'Select a structure.';
   $('studio-inspector-description').textContent=selected?$('structure-details-description').textContent:
     'Click any source-derived bone or muscle in the specimen to see its anatomical identity and context.';
   $('studio-inspector-clear').disabled=!selected;
  }
  renderRegions();
 }
 for(const button of document.querySelectorAll('[data-studio-tool]')){
  button.addEventListener('click',()=>{
   const next=button.dataset.studioTool;
   chooseTool(active===next&&next!=='explore'?'explore':next);
  });
 }
 $('studio-tray-close').addEventListener('click',()=>chooseTool('explore'));
 $('studio-inspector-close').addEventListener('click',()=>chooseTool('explore'));
 $('studio-inspector-clear').addEventListener('click',()=>{clickOriginal('structure-chip-close');sync();});
 $('studio-inspector-evidence').addEventListener('click',()=>atlas.showEvidence());
 $('studio-recenter').addEventListener('click',()=>atlas.recenter());
 $('studio-body').addEventListener('click',()=>{
  if(!region)return;
  chooseTool('explore');atlas.body();requestAnimationFrame(()=>sync());
 });
 $('studio-open-nerve').addEventListener('click',()=>{atlas.enter();requestAnimationFrame(()=>sync())});
 $('studio-current').addEventListener('click',openPicker);
 $('studio-region-close').addEventListener('click',()=>closePicker());
 $('studio-region-sheet').querySelector('[data-studio-dismiss]').addEventListener('click',()=>closePicker());
 $('studio-region-search').addEventListener('input',e=>filterRegions(e.target.value));
 $('studio-region-search').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){
   const first=[...document.querySelectorAll('[data-studio-region]:not([hidden])')][0];
   if(first){e.preventDefault();first.focus();}
  }
  if(e.key==='Enter'){
   const first=[...document.querySelectorAll('[data-studio-region]:not([hidden])')][0];
   if(first){e.preventDefault();first.click();}
  }
 });
 $('studio-region-sheet').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();return;}
  if(e.key!=='Tab')return;
  const nodes=[...$('studio-region-sheet').querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled])')]
    .filter(el=>el.getClientRects().length);
  if(!nodes.length)return;
  const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 document.querySelectorAll('[data-studio-region]').forEach(b=>b.addEventListener('click',()=>{
  const to=b.dataset.studioRegion;
  closePicker({restore:false});
  chooseTool('explore');
  atlas.choose(to);
  $('studio-current').focus({preventScroll:true});
  requestAnimationFrame(()=>sync());
 }));
 document.querySelectorAll('[data-studio-tissue]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelector('[data-overview-system="'+b.dataset.studioTissue+'"]')?.click();sync();
 }));
 document.querySelectorAll('[data-studio-layer-mode]').forEach(b=>b.addEventListener('click',()=>{
  if(b.disabled)return;
  clickOriginal('mode-'+b.dataset.studioLayerMode);sync();
 }));
 $('studio-layer-slider').addEventListener('input',e=>{putInput('layer-slider',e.target.value);sync();});
 $('studio-motion-slider').addEventListener('input',e=>{putInput('joint-motion-slider',e.target.value);sync();});
 $('studio-secondary-slider').addEventListener('input',e=>{putInput('joint-secondary-slider',e.target.value);sync();});
 $('studio-neutral').addEventListener('click',()=>{clickOriginal('joint-rest');sync();});
 document.addEventListener('keydown',e=>{
  if(!isDesktop()||e.ctrlKey||e.metaKey||e.altKey)return;
  if(modalOpen){if(e.key==='Escape'){e.preventDefault();closePicker();}return;}
  if(!$('evidence-sheet').hidden||!$('seam').hidden)return;
  if(e.target?.closest('input,textarea,[contenteditable="true"],select'))return;
  const key=e.key.toLowerCase();
  if(key==='g'||key==='/'){e.preventDefault();openPicker();return;}
  if(key==='escape'&&active!=='explore'){e.preventDefault();chooseTool('explore');return;}
  const shortcuts={e:'explore',l:'layers',m:'move',i:'inspect'};
  if(shortcuts[key]&&!e.repeat){e.preventDefault();chooseTool(shortcuts[key]);}
 });
 // Observe the original source selector and region transitions. This does not
 // change or depend upon any component of the underlying anatomical model.
 const observe=new MutationObserver(()=>{
  if(!isDesktop())return;
  const s=state(),newSelection=s.unified?.selected||null;
  if(newSelection&&newSelection!==selected&&detail(s))active='inspect';
  sync(s);
 });
 observe.observe($('atlas-app'),{attributes:true,attributeFilter:['data-mode']});
 observe.observe($('structure-chip'),{attributes:true,attributeFilter:['hidden']});
 observe.observe($('structure-chip-name'),{childList:true,characterData:true,subtree:true});
 observe.observe($('layer-output'),{childList:true,characterData:true,subtree:true});
 observe.observe($('joint-motion-value'),{childList:true,characterData:true,subtree:true});
 observe.observe($('joint-secondary-value'),{childList:true,characterData:true,subtree:true});
 window.addEventListener('resize',()=>{
  if(!isDesktop()){
   closePicker({restore:false});
   atlas.setInspectorFrame?.(false,true);
  }else if(!$('studio-inspector').hidden)atlas.setInspectorFrame?.(true,true);
  sync();
 },{passive:true});
 window.addEventListener('popstate',()=>sync());
 sync();
 window.BodyDesktopStudio=Object.freeze({openPicker,closePicker,chooseTool,sync,snapshot:()=>({
  active,region,selected,modalOpen,inspectorOpen:!$('studio-inspector').hidden,
  controlsOpen:!$('studio-tray').hidden,visible:isDesktop()
 })});
})();
