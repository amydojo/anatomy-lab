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
 let intelligence=null,knowledgeError='Loading anatomical references…';
 let geometryEvidence=null,geometryEvidenceError='Geometry provenance loading…',geometryEvidenceRequested=false;
 window.__BODY_GEOMETRY_EVIDENCE__=()=>geometryEvidence;
 function loadGeometryEvidence(){
  if(geometryEvidenceRequested)return;
  geometryEvidenceRequested=true;
  fetch('assets/v14-knee-geometry-evidence.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{
   if(data.schema!=='body-live/v14-knee-geometry-evidence-v1'||!Array.isArray(data.connective_targets)||data.connective_targets.length!==8)throw Error('Invalid provenance schema');
   geometryEvidence=data;render();
  }).catch(err=>{geometryEvidenceError='Provenance unavailable: '+err.message+'; NOT VERIFIED';render();});
 }
 let opened=false,mobilePanel='structures',mobileSheet='peek',expanded=false,previousFocus=null,statusMessage='',isChangingRegion=false,regionTicket=0;
 const renderProvider=()=>window.BodyConnectiveGeometryProvider||null;
 function knowledgeRows(){
 if(!intelligence)return window.BodyConnectiveMode?.records?.().map(r=>{
  const mesh=atlas.connectiveStructure?.('knee',r.id);
  return {id:r.id,name:r.name,region:'knee',tissueType:r.tissue==='ligament'?'ligaments':r.tissue==='tendon'?'tendons':'fibrocartilage',
   location:'Anatomical registry unavailable; illustrative model only.',attachments:'Evidence unavailable.',
   significance:'Scientific record unavailable.',geometryStatus:mesh?.illustrative?'illustrative':'unavailable',
   selectable:!!mesh?.illustrative,source:null,relationships:[],knowledgeMissing:true};
 })||[];
 return domain.regions.flatMap(region=>intelligence.getStructuresByRegion(region).map(rec=>{
  const data=intelligence.getAdapter(rec.id),mesh=atlas.connectiveStructure?.(region,rec.canonicalCoverageId);
  const refs=data?.evidence?.references||[];
  const type=/cartilage/.test(rec.tissueClass)?'fibrocartilage':/tendon/.test(rec.tissueClass)?'tendons':'ligaments';
  return {id:rec.id,name:rec.name,region:rec.region,tissueType:type,
   location:rec.explanation?.overview||'Scientific description unavailable.',
   attachments:[rec.attachments?.proximal,rec.attachments?.distal].filter(Boolean).join(' → '),
   significance:rec.primaryFunction,relationships:(data?.relationships||[]).map(x=>x.structure?.id).filter(Boolean),
   source:refs.length?{label:refs[0].title,url:refs[0].url,verified:false}:null,
   geometryStatus:mesh?.illustrative?'illustrative':mesh?'source-derived':'unavailable',
   selectable:!!mesh,visible:true,scientific:data,meshId:mesh?.id||null};
 }));
}
const provider={
 listStructures:knowledgeRows,
 selectStructure(id){return atlas.connectiveSelect?.(id)??false;},
 focusStructure(id){return atlas.connectiveFocus?.(id)??false;},
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
  if(s.region==='knee')atlas.connectiveEnable?.(true);
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
  expanded=false;statusMessage='';mobileSheet='peek';
  if(id==='spine'){statusMessage='Spine connective mesh integration pending. Thorax is shown as regional context.';chooseWhenReady('thorax');}
  else chooseWhenReady(id);
  isChangingRegion=true;
  refreshRenderer();render();
 }
 function openStudio(){
  if(opened)return;
  opened=true;previousFocus=document.activeElement;loadGeometryEvidence();
  app.dataset.connectiveStudio='true';
  $('connective-entry').setAttribute('aria-pressed','true');
  $('connective-entry').textContent='← Return to atlas';
  mobilePanel='structures';mobileSheet='peek';studio.setRegion('knee');
  atlas.setFrameOwner?.('studio');atlas.setMobileFrame?.(false,'studio');
  window.dispatchEvent(new CustomEvent('body:connective-studio-open'));
  chooseWhenReady('knee');
  refreshRenderer();render();
 }
 function closeStudio(){
  if(!opened)return;
  opened=false;regionTicket++;app.dataset.connectiveStudio='false';
  $('connective-entry').setAttribute('aria-pressed','false');
  $('connective-entry').textContent='Connective Studio';
  atlas.connectiveFilter?.(null,null,false);
  atlas.connectiveEnable?.(false);
  atlas.setFrameOwner?.(null);atlas.setMobileFrame?.(false);
  atlas.setInspectorFrame?.(false,true);
  $('connective-left').hidden=true;$('connective-right').hidden=true;
  $('connective-guides').hidden=true;$('connective-mobile-nav').hidden=true;$('connective-peek').hidden=true;
  window.dispatchEvent(new CustomEvent('body:connective-studio-closed'));
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
 workspace.append(guides); // sibling of the stage so a mobile band can sit outside the model rectangle
 const mobile=document.createElement('nav');mobile.id='connective-mobile-nav';mobile.className='connective-mobile-nav';mobile.hidden=true;
 mobile.setAttribute('aria-label','Connective Studio tools');workspace.append(mobile);
 const peek=document.createElement('div');peek.id='connective-peek';peek.className='connective-peek';peek.hidden=true;peek.setAttribute('role','group');peek.setAttribute('aria-label','Current anatomy selection');workspace.append(peek);
 const locationLabel=document.createElement('span');locationLabel.id='cs-mobile-location';locationLabel.className='cs-mobile-location';app.querySelector('.topactions').prepend(locationLabel);
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
     subset.map(x=>'<button type="button" role="listitem" data-cs-select="'+esc(x.id)+'" aria-current="'+(studio.snapshot().selectedId===x.id)+'"><span class="connective-list-name">'+esc(x.name)+'</span><span class="connective-item-state">'+(x.geometryStatus==='illustrative'?'ILLUSTRATIVE 3D':x.selectable?'SOURCE SURFACE · UNREVIEWED':'NO REGISTERED MESH')+'</span></button>').join('')+'</section>';
   }).join(''):'<p class="connective-empty">No structures match this search. Try another tissue or region.</p>')+
   '</div>';
 }
 function inspector(){
  const s=studio.snapshot(),item=studio.getStructure(s.selectedId);
  if(!item)return '<div class="connective-inspector-empty"><span class="cs-overline">03 / INSPECT</span><h2>Look closer.</h2><p>Select a structure to understand its location, function, relationships and evidence status.</p><p class="cs-muted">Only registered meshes can be focused or isolated in 3D.</p></div>';
  const adapter=item.scientific,rec=adapter?.record;
 const related=(adapter?.relationships||[]).map(x=>x.structure).filter(Boolean);
 const refs=adapter?.evidence?.references||[];
 const geometryEntry=geometryEvidence?.connective_targets?.find(x=>x.id===item.id);
 const boneProof=geometryEvidence?.source_reference;
 const geometryDisclosure=geometryEntry?'Original connective mesh: NOT ACQUIRED. '+geometryEntry.blocker:'Provenance: '+geometryEvidenceError;
 const status=item.geometryStatus==='illustrative'?'ILLUSTRATIVE 3D — not anatomist-reviewed or clinically verified':
  item.geometryStatus==='source-derived'?'SOURCE-DERIVED SURFACE — independent anatomical review pending':
  item.geometryStatus==='verified'?'Geometry verification reported; inspect full source chain':'NO REGISTERED 3D GEOMETRY';
 const evidenceStatus=rec?.knowledgeEvidence?.status==='reference-supported'?'Reference-supported anatomy; no anatomist sign-off':'Anatomical reference not currently available';
 const pair=['anterior-cruciate-ligament','posterior-cruciate-ligament'];
 const compareReady=pair.includes(item.id)&&pair.every(id=>studio.getStructure(id)?.selectable);
 const comparison=s.mode==='compare'&&s.comparison.length===2?'<section class="cs-compare" aria-label="ACL versus PCL comparison"><h3>ACL / PCL — DIFFERENT DIRECTIONS</h3>'+
   s.comparison.map(id=>{const r=intelligence?.getAdapter(id)?.record;
    return '<article><strong>'+esc(r?.name||id)+'</strong><p>'+esc(r?.primaryFunction||'Scientific description unavailable.')+'</p></article>';
   }).join('')+'</section>':'';
 return '<header><span class="cs-overline">03 / ANATOMICAL INSPECTOR</span><h2>'+esc(item.name)+'</h2><p class="cs-subtitle">'+esc(typeNames[item.tissueType])+' / '+esc(regionNames[item.region])+'</p></header>'+
 '<div class="connective-status" role="status">'+esc(status)+'</div><p class="cs-evidence-note">'+esc(evidenceStatus)+'</p><p class="cs-evidence-note" data-geometry-proof="unverified">'+esc(geometryDisclosure)+'</p>'+comparison+
 '<section class="cs-inspector-primary"><h3>PRIMARY FUNCTION</h3><p>'+esc(rec?.primaryFunction||item.significance||'Scientific record unavailable.')+'</p>'+
 '<h3>RELEVANT MOVEMENTS</h3><p>'+esc(rec?.movements?.join(' · ')||'Not documented.')+'</p></section>'+
 '<div class="cs-inspector-actions"><button type="button" data-cs-action="focus" '+(!item.selectable?'disabled':'')+'>Focus</button>'+
 '<button type="button" data-cs-action="isolate" '+(!item.selectable?'disabled':'')+'>Isolate</button>'+
 (compareReady?'<button type="button" data-cs-action="compare">Compare ACL / PCL</button>':'')+
 '<button type="button" data-cs-action="context">Context</button></div><button type="button" class="cs-ghost" data-cs-action="ghost" aria-pressed="'+s.ghost+'">Surrounding anatomy '+(s.ghost?'ghosted':'hidden')+'</button>'+
 '<button type="button" class="cs-disclosure" data-cs-action="details" aria-expanded="'+expanded+'">'+(expanded?'Hide scientific details −':'Attachments, relationships & evidence +')+'</button>'+
 (expanded?'<section class="cs-inspector-depth"><h3>ATTACHMENTS</h3><p>'+esc(rec?[rec.attachments?.proximal,rec.attachments?.distal,rec.attachments?.notes].filter(Boolean).join(' → '):'Knowledge unavailable')+'</p>'+
 '<h3>RELATED BONES</h3><p>'+esc(rec?.relatedBones?.join(', ')||'Not documented')+'</p>'+
 '<h3>RELATED MUSCLES</h3><p>'+esc(rec?.relatedMuscles?.join(', ')||'Not documented')+'</p>'+
 '<h3>RELATED CONNECTIVE TISSUES</h3><div class="cs-related">'+(related.length?related.map(x=>'<button type="button" data-cs-select="'+esc(x.id)+'">'+esc(x.name)+'</button>').join(''):'Not mapped')+'</div>'+
 '<h3>EVIDENCE SOURCES</h3>'+(refs.length?refs.map(x=>'<p>'+esc(x.title+' — '+x.section)+'</p><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">Read source</a>').join(''):'<p>Reference unavailable.</p>')+
 '<h3>UNRESOLVED SCIENTIFIC CLAIMS</h3><p>'+esc(rec?.unresolved?.join(' ')||'Scientific review pending.')+'</p>'+
 '<h3>GEOMETRY VERIFICATION</h3><p>'+esc(status)+'</p><p>'+esc('Geometry verification: '+(adapter?.geometry?.geometryVerified===true?'reported verified':'NOT VERIFIED')+'. No verified attachment coordinates or kinematics.')+'</p>'+
 '<h3>ORIGINAL ASSET AND REGISTRATION</h3><p>'+esc(geometryDisclosure)+'</p><p>'+esc(geometryEntry?'Hash: unavailable · Matrix: unavailable · Landmark RMS: NOT MEASURED · Holdout RMS: NOT MEASURED · Laterality: right-hand illustrative template':'Source provenance still loading or unavailable')+'</p>'+
 '<h3>SHARED BONE REFERENCE</h3><p>'+esc(boneProof?boneProof.dataset+' · '+boneProof.bone_references.map(x=>x.name+' ('+x.id+')').join(', ')+'. Shared scale '+boneProof.transform.scale_to_scene+'. Bone transform-fidelity is NOT ligament registration.':'Bone provenance pending')+'</p>'+
 (boneProof?'<a href="'+esc(boneProof.license_uri)+'" target="_blank" rel="noopener noreferrer">Official source license and attribution</a>':'')+'</section>':'');

 }
 // The perspective lesson is shown in the guides band on desktop and inside the structure sheet on
 // mobile, where the band is a fixed-height strip that must never cover the model.
 function guideLesson(s,withAction=true){
  if(!s.guideId)return '';
  const lesson=intelligence?.getExploration(s.guideId),available=(lesson?.structureIds||[]).filter(id=>studio.getStructure(id)?.selectable);
  return '<p>'+esc(lesson?.overview||'Lesson unavailable.')+'</p>'+(withAction?'<button type="button" class="cs-isolate-perspective" data-cs-action="isolate-guide" '+(available.length?'':'disabled')+'>Show available group · '+available.length+' structures</button>':'');
 }
 function renderGuides(){
  const s=studio.snapshot();
  const showDesktopGuides=opened&&s.region==='knee'&&window.innerWidth>850;
  guides.hidden=!showDesktopGuides;
  if(!showDesktopGuides){guides.innerHTML='';return;}
  guides.innerHTML='<span class="cs-overline">KNEE / THREE PERSPECTIVES</span><div class="cs-guide-buttons">'+domain.guides.map(g=>'<button type="button" data-cs-guide="'+g.id+'" aria-pressed="'+(s.guideId===g.id)+'">'+esc(g.title)+'</button>').join('')+'</div>'+guideLesson(s,window.innerWidth>850);
 }
 function render(){
  if(!opened)return;
  const search=document.getElementById('connective-search');
  const priorAdvanced=left.querySelector('.cs-advanced')?.open;
  const priorLeftScroll=left.scrollTop,priorRightScroll=right.scrollTop;
  const restoreSearch=search&&document.activeElement===search;
  const caret=restoreSearch?search.selectionStart:null;
  const s=studio.snapshot();
  left.hidden=false;right.hidden=false;mobile.hidden=false;
  const mobileScreen=window.innerWidth<=850;
  app.dataset.connectiveSheet=mobileScreen?mobileSheet:'open';
  const desktopExplorer='<header class="cs-panel-header"><span class="cs-overline">BODY / LIVE · V14</span><h2>Connective Studio</h2><p>Explore what holds the body together.</p></header>'+
   regionSelector()+'<section class="cs-tissue-section"><div class="cs-section-title">01 / VISIBLE TISSUES</div><div class="connective-tissue-grid" role="group" aria-label="Independently toggle visible tissues">'+types()+'</div><button type="button" class="cs-all-btn" data-cs-action="all-tissues">All tissues visible</button><div class="cs-view-actions"><button type="button" data-cs-action="all">Show all</button><button type="button" data-cs-action="reset">Reset view</button></div></section>'+
   '<section class="cs-structure-section"><div class="cs-section-title">02 / STRUCTURE EXPLORER</div><label for="connective-search" class="cs-visually-hidden">Search structures</label><input id="connective-search" type="search" placeholder="Find a structure…" value="'+esc(s.query)+'" autocomplete="off"/>'+groupList()+'</section>'+
   '<footer class="cs-panel-footer">Structure information does not imply an available or anatomically verified mesh.</footer>';
  const mobileGuideContent=s.region==='knee'?'<section class="cs-mobile-guides"><span class="cs-overline">EXPLORE BY FUNCTION</span><div class="cs-guide-buttons">'+domain.guides.map(g=>'<button type="button" data-cs-guide="'+g.id+'" aria-pressed="'+(s.guideId===g.id)+'">'+esc(g.title)+'</button>').join('')+'</div>'+guideLesson(s)+'</section>':'';
  const phoneExplorer='<header class="cs-mobile-sheet-heading"><div><span class="cs-overline">'+esc(regionNames[s.region])+' / EXPLORE</span><h2>Find a structure</h2></div><button type="button" class="cs-sheet-done" data-cs-action="collapse">Done ↓</button></header>'+
    '<label for="connective-search" class="cs-visually-hidden">Search structures</label><input id="connective-search" type="search" placeholder="Search the anatomy…" value="'+esc(s.query)+'" autocomplete="off"/>'+groupList()+
    '<details class="cs-advanced"><summary>Layers, perspectives & other regions</summary><section class="cs-tissue-section"><div class="cs-section-title">VISIBLE TISSUES</div><div class="connective-tissue-grid" role="group" aria-label="Independently toggle visible tissues">'+types()+'</div><button type="button" class="cs-all-btn" data-cs-action="all-tissues">All tissues visible</button><div class="cs-view-actions"><button type="button" data-cs-action="all">Show all</button></div></section>'+
    mobileGuideContent+'<section class="cs-other-regions">'+regionSelector()+'<p class="cs-muted">Other regions are reference-only until their connective meshes are available.</p></section></details>'+
    '<footer class="cs-panel-footer">Knee connective surfaces are illustrative, not clinically verified.</footer>';
  left.innerHTML=mobileScreen?phoneExplorer:desktopExplorer;
  if(priorAdvanced&&mobileScreen&&left.querySelector('.cs-advanced'))left.querySelector('.cs-advanced').open=true;
  right.innerHTML=inspector();
  left.scrollTop=priorLeftScroll;right.scrollTop=priorRightScroll;
  if(mobileScreen){const primary=right.querySelector('.cs-inspector-primary'),actions=right.querySelector('.cs-inspector-actions'),status=right.querySelector('.connective-status');if(primary&&actions&&status)status.before(primary,actions);}
  if(restoreSearch){
    const next=document.getElementById('connective-search');
    next?.focus({preventScroll:true});
    if(caret!=null)next?.setSelectionRange(Math.min(caret,next.value.length),Math.min(caret,next.value.length));
  }
  renderGuides();
  const chosen=s.selectedId?studio.getStructure(s.selectedId):null;
  locationLabel.textContent=(regionNames[s.region]||s.region).toUpperCase()+' / CONNECTIVE';
  peek.hidden=!mobileScreen;
  if(mobileScreen&&mobileSheet==='peek'){
   peek.innerHTML='<div class="cs-peek-copy"><span class="cs-overline">'+esc(regionNames[s.region])+(chosen?' / SELECTED':' / EXPLORE')+'</span><strong>'+esc(chosen?.name||'Explore the anatomy')+'</strong><span class="cs-peek-note">'+(chosen?(chosen.geometryStatus==='illustrative'?'Illustrative 3D · educational':'Reference information only'):'Tap a structure, or browse the list')+'</span></div>'+
    (chosen?.selectable?'<button type="button" data-cs-action="focus" aria-label="Focus selected anatomy">Focus</button>':'')+
    '<button type="button" class="cs-peek-primary" data-cs-action="'+(chosen?'peek-details':'peek-browse')+'">'+(chosen?'Details':'Browse')+'</button>';
  }
  if(mobileScreen&&mobileSheet!=='peek')peek.innerHTML='';
  mobile.innerHTML='<button type="button" data-cs-panel="structures" aria-pressed="'+(mobileSheet==='open'&&mobilePanel==='structures')+'" aria-expanded="'+(mobileSheet==='open'&&mobilePanel==='structures')+'" aria-controls="connective-left">Explore</button><button type="button" data-cs-panel="inspector" aria-pressed="'+(mobileSheet==='open'&&mobilePanel==='inspector')+'" aria-expanded="'+(mobileSheet==='open'&&mobilePanel==='inspector')+'" aria-controls="connective-right" '+(s.selectedId?'':'disabled')+'>Details</button><button type="button" data-cs-action="reset">Reset</button><button type="button" data-cs-action="close">Exit</button>';
  app.dataset.connectivePanel=mobilePanel;
  const hasGeometry=s.records.some(r=>r.region===s.region&&r.selectable);
  const status=!intelligence?knowledgeError:(hasGeometry?'Connective geometry shown for education; geometry verification pending':'No registered connective geometry in this region');
  const stage=$('scene-status');
  if(stage)stage.textContent=statusMessage||status.toUpperCase();
  if(window.innerWidth>850)atlas.setInspectorFrame?.(false,true);
 }
 function select(id){
  const onPhone=window.innerWidth<=850;
  if(onPhone)mobileSheet='peek'; // settle the sheet BEFORE the selection subscription renders
  const record=studio.selectStructure(id);if(!record)return;
  expanded=false;
  if(!onPhone){mobilePanel='inspector';if(record.selectable)studio.focusStructure(id);}
  render();
 }
 function perform(action){
  const s=studio.snapshot();
  if(action==='close'){closeStudio();return;}
  if(action==='collapse'){mobileSheet='peek';render();return;}
  if(action==='peek-browse'){mobilePanel='structures';mobileSheet='open';render();return;}
  if(action==='peek-details'){mobilePanel='inspector';mobileSheet='open';render();return;}
  if(action==='details'){expanded=!expanded;render();return;}
  if(action==='reset'){mobileSheet='peek';mobilePanel='structures';studio.resetView();render();return;}
  if(action==='focus'){if(s.selectedId)studio.focusStructure(s.selectedId);return;}
  if(action==='isolate'){if(s.selectedId)studio.isolateStructure(s.selectedId);return;}
  if(action==='compare'){studio.compareStructures(['anterior-cruciate-ligament','posterior-cruciate-ligament']);return;}
  if(action==='ghost'){studio.setGhost(!s.ghost);return;}
  if(action==='all'){studio.showAll();return;}
  if(action==='isolate-guide'){
   const ids=(intelligence?.getExploration(s.guideId)?.structureIds||[]).filter(id=>studio.getStructure(id)?.selectable);
   if(ids.length>=2)studio.compareStructures(ids);else if(ids.length===1)studio.isolateStructure(ids[0]);
   return;
  }
  if(action==='context'){studio.revealContext();return;}
  if(action==='all-tissues'){for(const t of domain.types)studio.setTissueVisibility(t,true);return;}
 }
 workspace.addEventListener('click',e=>{
  if(!opened)return;
  const btn=e.target.closest('button');if(!btn||!workspace.contains(btn))return;
  if(btn.dataset.csSelect){select(btn.dataset.csSelect);return;}
  if(btn.dataset.csTissue){const s=studio.snapshot();studio.setTissueVisibility(btn.dataset.csTissue,!s.visibility[btn.dataset.csTissue]);return;}
  if(btn.dataset.csGuide){studio.chooseGuide(btn.dataset.csGuide);return;}
  if(btn.dataset.csPanel){if(window.innerWidth<=850)mobileSheet=mobileSheet==='open'&&mobilePanel===btn.dataset.csPanel?'peek':'open';mobilePanel=btn.dataset.csPanel;render();return;}
  if(btn.dataset.csAction)perform(btn.dataset.csAction);
 });
 workspace.addEventListener('change',e=>{if(opened&&e.target.id==='connective-region')regionNav(e.target.value);});
 workspace.addEventListener('input',e=>{
  if(!opened||e.target.id!=='connective-search')return;
  studio.setQuery(e.target.value);
 });
 topButton.addEventListener('click',()=>opened?closeStudio():openStudio());
 document.addEventListener('keydown',e=>{
  if(!opened||e.altKey||e.ctrlKey||e.metaKey)return;
  const target=e.target;
  if(e.key==='Escape'){if(window.innerWidth<=850&&mobileSheet==='open'){mobileSheet='peek';render();}else if(mobilePanel==='inspector'&&window.innerWidth>850){mobilePanel='structures';render();}else closeStudio();e.stopImmediatePropagation();e.preventDefault();return;}
  if(target?.matches?.('input,textarea,select,[contenteditable]'))return;
  if(e.key==='/'&&!e.shiftKey){e.preventDefault();$('connective-search')?.focus();}
 },true);
 window.addEventListener('body:structure-selected',event=>{
  if(!opened)return;
  const id=event.detail?.id;
  if(id&&studio.snapshot().selectedId!==id&&studio.getStructure(id)){
   if(window.innerWidth<=850)mobileSheet='peek';else mobilePanel='inspector';
   studio.selectStructure(id,{syncRenderer:false});expanded=false;render();
  }
 });
 window.addEventListener('body:region-ready',()=>{if(opened){isChangingRegion=false;statusMessage='';refreshRenderer();render();}});
 window.addEventListener('body:connective-geometry-ready',()=>{if(opened){refreshRenderer();render();}});
 window.addEventListener('resize',()=>{if(opened){atlas.setMobileFrame?.(false,'studio');render();}},{passive:true});
 // Avoid WebGL redraws and replacing the search field on every keystroke.
 let lastGeometryKey=null,lastQuery=null;
 studio.subscribe(s=>{
  if(!opened)return;
  const geometryKey=JSON.stringify([s.region,s.mode,s.isolateId,s.comparison,s.ghost,s.visibility]);
  const changedGeometry=geometryKey!==lastGeometryKey,queryOnly=!changedGeometry&&s.query!==lastQuery;
  lastGeometryKey=geometryKey;lastQuery=s.query;
  if(queryOnly&&document.activeElement?.id==='connective-search'){
   const list=$('connective-structure-list'),temp=document.createElement('div');temp.innerHTML=groupList();
   if(list)list.replaceWith(temp.firstChild);
   return;
  }
  if(changedGeometry)refreshRenderer();
  render();
 });
if(window.BodyConnectiveIntelligence){
 window.BodyConnectiveIntelligence.load({knowledgeUrl:'/atlas/assets/v14-connective-knowledge.json',coverageUrl:'/atlas/assets/connective-coverage.json'})
 .then(engine=>{intelligence=engine;knowledgeError='';studio.setProvider(provider);if(opened){refreshRenderer();render();}})
 .catch(error=>{knowledgeError='Anatomical knowledge unavailable: '+error.message;studio.setProvider(provider);if(opened)render();});
}else knowledgeError='Anatomical intelligence module missing.';
window.__BODY_CONNECTIVE_INTELLIGENCE__=()=>intelligence;
 // Public entrypoint for integrations and automated tests; no action is taken on import.
 window.BodyConnectiveUI=Object.freeze({open:openStudio,close:closeStudio,isOpen:()=>opened,select,region:regionNav,panel:()=>mobilePanel,sheet:()=>mobileSheet,refresh:render});
 if(new URLSearchParams(location.search).get('studio')==='connective')openStudio();
})();
