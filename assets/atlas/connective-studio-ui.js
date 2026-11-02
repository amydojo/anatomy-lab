/* BODY / LIVE V14 — Connective Interaction Studio.
 * Mounts into V13 without replacing its region/gesture/workbench architecture.
 */
(function(){
 'use strict';
 const atlas=window.__BODY_ATLAS__,domain=window.BodyConnectiveStudio,app=document.getElementById('atlas-app');
 if(!atlas||!domain||!app)return;
 const $=id=>document.getElementById(id);
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const typeNames={bones:'Bones',muscles:'Muscles',ligaments:'Ligaments',tendons:'Tendons',fibrocartilage:'Fibrocartilage'};
 const regionNames={knee:'Knee',shoulder:'Shoulder',hip:'Hip',ankle:'Ankle',wrist:'Wrist',spine:'Spine'};
 let opened=false,mobilePanel='structures',expanded=false,previousFocus=null,statusMessage='',isChangingRegion=false,regionTicket=0;
 const renderProvider=()=>window.BodyConnectiveGeometryProvider||null;
 const provider={
  listStructures(){
   const supplied=renderProvider()?.listStructures?.()||[];
   // V13 has no named knee ligament or meniscus meshes. Only exact source IDs count.
   const native=domain.seedRecords.map(r=>{
    const part=atlas.connectiveStructure?.(r.region,r.id);
    return part?{...r,geometryStatus:'source-derived',selectable:true,source:{label:'Registered V13 source geometry · anatomical validation not independently established',verified:false},visible:true}:null;
   }).filter(Boolean);
   return [...native,...(Array.isArray(supplied)?supplied:[])];
  },
  selectStructure(id){return renderProvider()?.selectStructure?.(id)??atlas.connectiveSelect?.(id)??false;},
  focusStructure(id){return renderProvider()?.focusStructure?.(id)??atlas.connectiveFocus?.(id)??false;},
  setTissueVisibility(){refreshRenderer();},
  isolateStructure(){refreshRenderer();},
  compareStructures(){refreshRenderer();},
  showAll(){refreshRenderer();},
  setContext(){refreshRenderer();},
  setCameraOrientation(camera){atlas.connectiveOrientation?.(camera.yaw,camera.pitch);},
  resetView(){atlas.connectiveReset?.();refreshRenderer();}
 };
 const studio=domain.create({provider});
 window.__BODY_CONNECTIVE_STUDIO__=studio;
 function refreshRenderer(){
  if(!opened)return;
  const s=studio.snapshot();
  const ids=s.mode==='isolate'&&s.isolateId?[s.isolateId]:s.mode==='compare'?s.comparison:[];
  // The baseline renderer can filter existing meshes, not fabricate missing ones.
  atlas.connectiveFilter?.(s.visibility,ids,s.ghost&&(s.mode==='isolate'||s.mode==='compare'));
 }
 // Avoid entering a detail scene before the base atlas source has initialized.
 function chooseWhenReady(id){
  const ticket=++regionTicket;
  const check=()=>{
   if(!opened||ticket!==regionTicket)return;
   if(!atlas.getState().assetsLoaded){requestAnimationFrame(check);return;}
   atlas.choose(id);
  };
  check();
 }
 function regionNav(id){
  if(!studio.setRegion(id))return;
  expanded=false;statusMessage='';
  if(id==='spine'){statusMessage='Spine connective mesh integration pending. Thorax is shown as regional context.';chooseWhenReady('thorax');}
  else chooseWhenReady(id);
  isChangingRegion=true;
  refreshRenderer();render();
 }
 function openStudio(){
  if(opened)return;
  opened=true;previousFocus=document.activeElement;
  app.dataset.connectiveStudio='true';
  $('connective-entry').setAttribute('aria-pressed','true');
  $('connective-entry').textContent='← Return to atlas';
  mobilePanel='structures';studio.setRegion('knee');
  atlas.setMobileFrame?.(window.innerWidth<=850);
  chooseWhenReady('knee');
  refreshRenderer();render();
 }
 function closeStudio(){
  if(!opened)return;
  opened=false;regionTicket++;app.dataset.connectiveStudio='false';
  $('connective-entry').setAttribute('aria-pressed','false');
  $('connective-entry').textContent='Connective Studio';
  atlas.connectiveFilter?.(null,null,false);
  atlas.setMobileFrame?.(false);
  atlas.setInspectorFrame?.(false,true);
  $('connective-left').hidden=true;$('connective-right').hidden=true;
  $('connective-guides').hidden=true;$('connective-mobile-nav').hidden=true;
  if(previousFocus&&previousFocus.isConnected&&previousFocus!==$('connective-entry'))previousFocus.focus();
 }
 const topButton=document.createElement('button');
 topButton.type='button';topButton.className='text-btn connective-entry';topButton.id='connective-entry';
 topButton.textContent='Connective Studio';topButton.setAttribute('aria-pressed','false');
 topButton.setAttribute('aria-controls','connective-left connective-right');
 app.querySelector('.topactions').prepend(topButton);
 const workspace=$('workspace');
 const left=document.createElement('aside');left.id='connective-left';left.className='connective-explorer';left.hidden=true;
 left.setAttribute('aria-label','Connective structure explorer');workspace.prepend(left);
 const right=document.createElement('aside');right.id='connective-right';right.className='connective-inspector';right.hidden=true;
 right.setAttribute('aria-label','Connective structure inspector');workspace.append(right);
 const guides=document.createElement('nav');guides.id='connective-guides';guides.className='connective-guides';guides.hidden=true;
 guides.setAttribute('aria-label','Knee exploration perspectives');
 $('atlas-stage').append(guides);
 const mobile=document.createElement('nav');mobile.id='connective-mobile-nav';mobile.className='connective-mobile-nav';mobile.hidden=true;
 mobile.setAttribute('aria-label','Connective Studio tools');workspace.append(mobile);
 const types=()=>domain.types.map(t=>'<button type="button" data-cs-tissue="'+t+'" aria-pressed="'+studio.snapshot().visibility[t]+'" class="connective-tissue"><span>'+typeNames[t]+'</span><span aria-hidden="true">'+(studio.snapshot().visibility[t]?'●':'○')+'</span></button>').join('');
 function regionSelector(){
  const s=studio.snapshot();
  return '<label class="connective-region-label" for="connective-region">ANATOMICAL REGION</label><select id="connective-region" aria-label="Choose anatomical region">'+domain.regions.map(r=>'<option value="'+r+'"'+(s.region===r?' selected':'')+'>'+regionNames[r]+'</option>').join('')+'</select>';
 }
 function groupList(){
  const list=studio.filtered();
  return '<div class="connective-list" id="connective-structure-list" role="list">'+
   (list.length?domain.types.map(type=>{
    const subset=list.filter(x=>x.tissueType===type);if(!subset.length)return '';
    return '<section class="connective-group"><h3>'+typeNames[type]+' <span>'+subset.length+'</span></h3>'+
     subset.map(x=>'<button type="button" role="listitem" data-cs-select="'+esc(x.id)+'" aria-current="'+(studio.snapshot().selectedId===x.id)+'"><span class="connective-list-name">'+esc(x.name)+'</span><span class="connective-item-state">'+(x.selectable?'3D READY':'NO REGISTERED MESH')+'</span></button>').join('')+'</section>';
   }).join(''):'<p class="connective-empty">No structures match this search. Try another tissue or region.</p>')+
   '</div>';
 }
 function inspector(){
  const s=studio.snapshot(),item=studio.getStructure(s.selectedId);
  if(!item)return '<div class="connective-inspector-empty"><span class="cs-overline">03 / INSPECT</span><h2>Look closer.</h2><p>Select a structure to understand its location, function, relationships and evidence status.</p><p class="cs-muted">Only registered meshes can be focused or isolated in 3D.</p></div>';
  const related=(item.relationships||[]).map(id=>studio.getStructure(id)).filter(Boolean);
  const source=item.source;
  const comparables=related.filter(x=>x.selectable&&x.visible);
  const comparisonEnabled=item.selectable&&item.visible&&comparables.length>=1;
  const status=item.geometryStatus==='verified'?'Geometry labelled verified by registered provider — inspect its provenance':item.geometryStatus==='source-derived'?'Source-derived mesh · expert validation not established':item.geometryStatus==='illustrative'?'Illustrative geometry · not anatomically verified':'No registered 3D geometry';
  return '<header><span class="cs-overline">03 / STRUCTURE INSPECTOR</span><h2>'+esc(item.name)+'</h2><p class="cs-subtitle">'+esc(typeNames[item.tissueType])+' / '+esc(regionNames[item.region])+'</p></header>'+
   '<div class="connective-status" role="status">'+esc(status)+'</div>'+
   '<section class="cs-inspector-primary"><h3>WHERE IT IS</h3><p>'+esc(item.location||'Location not documented.')+'</p><h3>WHY IT MATTERS</h3><p>'+esc(item.significance||'Function not yet documented.')+'</p></section>'+
   '<div class="cs-inspector-actions"><button type="button" data-cs-action="focus" '+(!item.selectable?'disabled title="Requires registered geometry"':'')+'>Focus in 3D</button><button type="button" data-cs-action="isolate" '+(!item.selectable?'disabled title="Requires registered geometry"':'')+'>Isolate</button><button type="button" data-cs-action="compare" '+(!comparisonEnabled?'disabled title="Requires at least two registered related meshes"':'')+'>Compare related</button><button type="button" data-cs-action="all">Show all</button></div><button type="button" class="cs-ghost" data-cs-action="ghost" aria-pressed="'+s.ghost+'">Surrounding context '+(s.ghost?'visible as ghost':'hidden when isolating')+'</button>'+
   '<button type="button" class="cs-disclosure" data-cs-action="details" aria-expanded="'+expanded+'">'+(expanded?'Hide scientific details −':'Attachments, relationships & evidence +')+'</button>'+
   (expanded?'<section class="cs-inspector-depth"><h3>ATTACHMENTS & RELATIONSHIPS</h3><p>'+esc(item.attachments||'Attachment data unavailable.')+'</p><h3>RELATED STRUCTURES</h3><div class="cs-related">'+(related.length?related.map(x=>'<button type="button" data-cs-select="'+esc(x.id)+'">'+esc(x.name)+'</button>').join(''):'<span>Not yet mapped</span>')+'</div><h3>PROVENANCE</h3><p>'+esc(source?.label||'No citable source registered.')+'</p>'+(source?.url?'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">Open reference ↗</a>':'')+'<p class="cs-evidence-note">'+(source?.verified?'Source record reports text verified. Geometry validation is a separate claim.':'Textbook overview; individual assertions have not been passage-audited.')+'</p><h3>GEOMETRY STATUS</h3><p>'+esc(item.geometryStatus||'unavailable')+' · '+(item.selectable?'Mesh registered':'Not selectable in 3D')+'</p></section>':'');
 }
 function renderGuides(){
  const s=studio.snapshot();
  guides.hidden=!opened||s.region!=='knee';
  guides.innerHTML='<span class="cs-overline">KNEE / THREE PERSPECTIVES</span><div class="cs-guide-buttons">'+domain.guides.map(g=>'<button type="button" data-cs-guide="'+g.id+'" aria-pressed="'+(s.guideId===g.id)+'">'+esc(g.title)+'</button>').join('')+'</div>'+
   (s.guideId?(()=>{
    const guide=domain.guides.find(g=>g.id===s.guideId),items=guide.ids.map(id=>studio.getStructure(id)).filter(x=>x?.selectable&&x.visible);
    return '<p>'+esc(guide.description)+'</p><button type="button" class="cs-isolate-perspective" data-cs-action="isolate-guide" '+(!items.length?'disabled title="Registered anatomy required"':'')+'>Isolate available group'+(items.length?' · '+items.length+' meshes':' · geometry pending')+'</button>';
   })():'');
 }
 function render(){
  if(!opened)return;
  const s=studio.snapshot();
  left.hidden=false;right.hidden=false;mobile.hidden=false;
  left.innerHTML='<header class="cs-panel-header"><span class="cs-overline">BODY / LIVE · V14</span><h2>Connective Studio</h2><p>Explore what holds the body together.</p></header>'+
   regionSelector()+
   '<section class="cs-tissue-section"><div class="cs-section-title">01 / VISIBLE TISSUES</div><div class="connective-tissue-grid" role="group" aria-label="Independently toggle visible tissues">'+types()+'</div><button type="button" class="cs-all-btn" data-cs-action="all-tissues">All tissues visible</button></section>'+
   '<section class="cs-structure-section"><div class="cs-section-title">02 / STRUCTURE EXPLORER</div><label for="connective-search" class="cs-visually-hidden">Search structures</label><input id="connective-search" type="search" placeholder="Find a structure…" value="'+esc(s.query)+'" autocomplete="off"/>'+groupList()+'</section>'+
   '<footer class="cs-panel-footer">Structure information does not imply an available or anatomically verified mesh.</footer>';
  right.innerHTML=inspector();
  renderGuides();
  mobile.innerHTML='<button type="button" data-cs-panel="structures" aria-pressed="'+(mobilePanel==='structures')+'">Structures</button><button type="button" data-cs-panel="inspector" aria-pressed="'+(mobilePanel==='inspector')+'">Inspect'+(s.selectedId?' · 1':'')+'</button><button type="button" data-cs-action="reset">Reset</button><button type="button" data-cs-action="close">Exit</button>';
  app.dataset.connectivePanel=mobilePanel;
  const hasGeometry=s.records.some(r=>r.region===s.region&&r.selectable);
  const status=hasGeometry?'Registered geometry available for some structures':'No registered connective meshes in this region yet';
  const stage=$('scene-status');
  if(stage)stage.textContent=statusMessage||status.toUpperCase();
  if(window.innerWidth>850)atlas.setInspectorFrame?.(false,true);
 }
 function select(id){
  const record=studio.selectStructure(id);if(!record)return;
  expanded=false;mobilePanel='inspector';
  if(record.selectable)studio.focusStructure(id);
  render();
 }
 function perform(action){
  const s=studio.snapshot();
  if(action==='close'){closeStudio();return;}
  if(action==='details'){expanded=!expanded;render();return;}
  if(action==='reset'){studio.resetView();atlas.recenter?.();render();return;}
  if(action==='focus'){if(s.selectedId)studio.focusStructure(s.selectedId);return;}
  if(action==='isolate'){if(s.selectedId)studio.isolateStructure(s.selectedId);return;}
  if(action==='context'){studio.revealContext();return;}
  if(action==='ghost'){studio.setGhost(!s.ghost);return;}
  if(action==='all'){studio.showAll();return;}
  if(action==='compare'){
   const item=studio.getStructure(s.selectedId);
   if(item)studio.compareStructures([item.id,...item.relationships]);return;
  }
  if(action==='isolate-guide'){
   const guide=domain.guides.find(x=>x.id===s.guideId);
   const available=(guide?.ids||[]).filter(id=>studio.getStructure(id)?.selectable&&studio.getStructure(id)?.visible);
   if(available.length>=2)studio.compareStructures(available);
   else if(available.length===1)studio.isolateStructure(available[0]);
   return;
  }
  if(action==='all-tissues'){for(const t of domain.types)studio.setTissueVisibility(t,true);return;}
 }
 workspace.addEventListener('click',e=>{
  if(!opened)return;
  const btn=e.target.closest('button');if(!btn||!workspace.contains(btn))return;
  if(btn.dataset.csSelect){select(btn.dataset.csSelect);return;}
  if(btn.dataset.csTissue){const s=studio.snapshot();studio.setTissueVisibility(btn.dataset.csTissue,!s.visibility[btn.dataset.csTissue]);return;}
  if(btn.dataset.csGuide){studio.chooseGuide(btn.dataset.csGuide);return;}
  if(btn.dataset.csPanel){mobilePanel=btn.dataset.csPanel;render();return;}
  if(btn.dataset.csAction)perform(btn.dataset.csAction);
 });
 workspace.addEventListener('change',e=>{if(opened&&e.target.id==='connective-region')regionNav(e.target.value);});
 workspace.addEventListener('input',e=>{
  if(!opened||e.target.id!=='connective-search')return;
  studio.setQuery(e.target.value);
  const list=$('connective-structure-list'),replacement=document.createElement('div');
  replacement.innerHTML=groupList();
  if(list)list.replaceWith(replacement.firstChild);
 });
 topButton.addEventListener('click',()=>opened?closeStudio():openStudio());
 document.addEventListener('keydown',e=>{
  if(!opened||e.altKey||e.ctrlKey||e.metaKey)return;
  const target=e.target;
  if(e.key==='Escape'){if(mobilePanel==='inspector'){mobilePanel='structures';render();}else closeStudio();e.stopImmediatePropagation();e.preventDefault();return;}
  if(target?.matches?.('input,textarea,select,[contenteditable]'))return;
  if(e.key==='/'&&!e.shiftKey){e.preventDefault();$('connective-search')?.focus();}
 },true);
 window.addEventListener('body:region-ready',()=>{if(opened){isChangingRegion=false;statusMessage='';refreshRenderer();render();}});
 window.addEventListener('body:connective-geometry-ready',()=>{if(opened){refreshRenderer();render();}});
 window.addEventListener('resize',()=>{if(opened){atlas.setMobileFrame?.(window.innerWidth<=850);render();}},{passive:true});
 studio.subscribe(()=>{if(opened){refreshRenderer();render();}});
 // Public entrypoint for integrations and automated tests; no action is taken on import.
 window.BodyConnectiveUI=Object.freeze({open:openStudio,close:closeStudio,isOpen:()=>opened,select,region:regionNav,panel:()=>mobilePanel,refresh:render});
 if(new URLSearchParams(location.search).get('studio')==='connective')openStudio();
})();
