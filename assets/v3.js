/* BODY / LIVE V3 — shared mobile interaction runtime, progressive enhancement.
 * Preserves the original anatomy renderers; never substitutes diagnostic inference. */
(function(){
 'use strict';
 const D=window.BODYLIVE_DATA;
 const region=location.pathname.startsWith('/hip/')?'hip':location.pathname.startsWith('/shoulder/')?'shoulder':'knee';
 const cfg=D?.regions?.[region];if(!cfg)return;
 const $=id=>document.getElementById(id), qs=(s,r=document)=>r.querySelector(s);
 const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const getSaved=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
 const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
 const lessons=D.lessons[region];
 const current={
  mode:'explore',depth:0,selected:null,angle:0,sheet:'half',scale:1,x:0,y:0,
  playing:false,frame:0,lastTime:0,dir:1,lesson:null,phase:'prediction',answer:-1,
  completed:getSaved('bodylive-v3-lessons',{}),territories:false
 };
 const base=(region==='hip'?qs('.visual'):qs('.viewport'));
 const svg=region==='hip'?$('anatomy'):$('scene');
 if(!base||!svg)return;
 const maxAngle=cfg.max;
 const count=cfg.layers.length;
 let lastFocus=null;
 const structure=key=>cfg.structures.find(s=>s.key===key)||null;
 const byLesson=id=>lessons.find(x=>x.id===id);
 const resource='/references/';
 function nativeDepth(n){
  n=Math.min(count-1,Math.max(0,Math.round(n)));
  current.depth=n;
  if(region==='hip'){if(typeof layer==='function')layer(n);}
  else if(typeof window.setDepth==='function')window.setDepth(n);
 }
 function nativePart(key){
  const s=structure(key);if(!s)return;
  if(region==='hip'){nativeDepth(s.layer||0);}
  else if(typeof showPart==='function'){showPart(key);if(typeof DATA!=='undefined' && DATA.parts?.[key])current.depth=DATA.parts[key].depth;}
  qsa('.v3-selected',svg).forEach(e=>e.classList.remove('v3-selected'));
  if(region==='hip'){
   const map={max:'maxi',med:'medi',min:'mini',pir:'deep',nerve:'theNerve'};
   $(map[key])?.classList.add('v3-selected');
  }else qsa('[data-part]',svg).filter(x=>x.dataset.part===key).forEach(x=>x.classList.add('v3-selected'));
 }
 function nativeAngle(a){
  current.angle=Math.max(0,Math.min(maxAngle,Number(a)||0));
  if(region==='hip'){
   const input=$('angle');if(input){input.value=current.angle;input.dispatchEvent(new Event('input',{bubbles:true}));}
  }else if(typeof updateAngle==='function')updateAngle(current.angle);
  const angleLabel=qs('[data-v3-angle]');if(angleLabel)angleLabel.textContent=Math.round(current.angle)+'°';
  const range=qs('[data-v3-range]');if(range && document.activeElement!==range)range.value=current.angle;
  checkLesson('angle');
 }
 function stopMotion(){
  current.playing=false;cancelAnimationFrame(current.frame);
  const b=qs('[data-v3-action="play"]');if(b){b.textContent='▶ Play';b.setAttribute('aria-pressed','false')}
 }
 function tick(ts){
  if(!current.playing)return;
  if(!current.lastTime)current.lastTime=ts;
  const dt=Math.min(44,ts-current.lastTime);current.lastTime=ts;
  const next=current.angle+dt*.055*current.dir;
  if(next>=maxAngle){current.dir=-1;nativeAngle(maxAngle)}
  else if(next<=0){current.dir=1;nativeAngle(0)}else nativeAngle(next);
  current.frame=requestAnimationFrame(tick);
 }
 function toggleMotion(){
  if(current.playing){stopMotion();return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  current.playing=true;current.lastTime=0;current.dir=1;current.frame=requestAnimationFrame(tick);
  const b=qs('[data-v3-action="play"]');if(b){b.textContent='Ⅱ Pause';b.setAttribute('aria-pressed','true')}
 }
 function setDepth(n){
  stopMotion();nativeDepth(n);current.selected=region==='hip'?(['max','med','pir','nerve'][current.depth]):((typeof DATA!=='undefined')?DATA.levels[current.depth]?.focus:current.selected);renderToolbar();if(current.mode!=='learn')renderInspector();checkLesson('depth');
 }
 function select(key){
  const s=structure(key);if(!s)return;
  current.selected=key;nativePart(key);if(current.mode!=='learn')renderInspector();
  renderToolbar();checkLesson('select');save('bodylive-v3-last',{region,key});updateFocusTag();
 }
 function setMode(mode){
  if(!['explore','move','trace','learn'].includes(mode))return;
  stopMotion();current.mode=mode;current.territories=false;
  qsa('[data-v3-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v3Mode===mode)));
  if(mode==='trace'){const n=cfg.traces[0];if(n){current.selected=n.key;nativePart(n.key);}}
  else if(mode==='explore' && current.selected)nativePart(current.selected);
  else if(mode==='move' && region==='hip'){nativeDepth(1)}
  setTraceDecoration(mode==='trace');
  renderToolbar();renderInspector();updateFocusTag();
 }
 function setTraceDecoration(enabled){
  const elem=region==='hip' ? $('theNerve') : $(region==='knee'?'knee-nerves':'shoulder-nerve');
  if(!elem)return;
  elem.style.filter=enabled?'drop-shadow(0 0 12px rgba(247,205,109,.95))':'';
  if(region==='hip'&&enabled)nativeDepth(3);
  if(region!=='hip'&&enabled)nativeDepth(4);
 }
 function updateFocusTag(){
  const label=qs('#v3-focus');
  if(label)label.textContent=current.mode==='trace'?'NEURAL PATHWAY':current.mode==='learn'?'INTERACTIVE EXPERIMENT':(current.selected?structure(current.selected)?.name:cfg.axis)||cfg.name;
 }
 const root=document.createElement('div');
 root.id='v3-root';
 root.innerHTML='<header class="v3-header">'+
  '<a class="v3-brand" href="/">BODY <span>/</span> LIVE</a>'+
  '<button class="v3-iconbtn v3-region" data-v3-action="regions" aria-label="Switch anatomical region">'+safe(cfg.name)+'⌄</button>'+
  '<div class="v3-header-actions"><button class="v3-iconbtn" data-v3-action="search" aria-label="Search anatomy">⌕</button><button class="v3-iconbtn" data-v3-action="reset" aria-label="Reset anatomy view">↺</button></div></header>'+
  '<main class="v3-core" aria-label="'+safe(cfg.name)+' interactive anatomy laboratory">'+
   '<section class="v3-stage" aria-label="Interactive anatomy illustration">'+
    '<div class="v3-stage-top"><span class="v3-pill">'+safe(cfg.axis)+'</span><span class="v3-pill" id="v3-focus">ANATOMY</span></div>'+
    '<div class="v3-viewport" id="v3-viewport"></div>'+
    '<div class="v3-stage-tools"><button class="v3-float" data-v3-action="zoom-in" aria-label="Zoom in">+</button><button class="v3-float" data-v3-action="zoom-out" aria-label="Zoom out">−</button><button class="v3-float" data-v3-action="home" aria-label="Reset zoom and pan">⌖</button></div>'+
    '<span class="v3-education"><b>ILLUSTRATIVE ANATOMY</b><br>Not a diagnostic or clinically precise biomechanics model.</span>'+
   '</section>'+
   '<aside class="v3-inspector" id="v3-inspector" data-sheet="half" aria-label="Anatomy information inspector">'+
    '<button class="v3-grab" data-v3-action="sheet" aria-label="Expand or collapse anatomy details"><span class="v3-small">DISCOVER MORE</span><span aria-hidden="true">⌃</span></button>'+
    '<div class="v3-inspector-scroll" id="v3-inspector-scroll"></div>'+
   '</aside>'+
  '</main>'+
  '<div class="v3-toolbar" id="v3-toolbar" aria-label="Anatomy controls"></div>'+
  '<nav class="v3-dock" aria-label="Learning modes">'+
  [['explore','◎','Explore'],['move','↝','Move'],['trace','⌁','Trace'],['learn','✧','Learn']].map(([id,icon,label])=>'<button class="v3-mode" data-v3-mode="'+id+'" aria-selected="'+(id==='explore')+'" aria-label="'+label+' mode"><span class="symbol" aria-hidden="true">'+icon+'</span><span>'+label+'</span></button>').join('')+
  '</nav>';
 document.body.appendChild(root);
 qs('#v3-viewport').appendChild(base);
 document.body.classList.add('v3-ready');
 const modal=document.createElement('div');
 modal.className='v3-search';modal.id='v3-search';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Search anatomical structures');
 modal.innerHTML='<div class="v3-search-panel"><div class="v3-search-head"><span aria-hidden="true">⌕</span><input id="v3-search-input" type="search" placeholder="Search muscles, nerves, ligaments…" aria-label="Search anatomy"><button class="v3-iconbtn" data-v3-action="close-search" aria-label="Close search">✕</button></div><div class="v3-search-results" id="v3-search-results"></div></div>';
 document.body.appendChild(modal);
 const regionModal=document.createElement('div');regionModal.className='v3-region-menu';regionModal.id='v3-region-menu';regionModal.setAttribute('role','dialog');regionModal.setAttribute('aria-modal','true');
 regionModal.innerHTML='<div class="v3-region-panel"><div class="v3-insp-key">SELECT A LAB</div><h2 style="font:400 30px Georgia,serif;margin:10px 0">Move through the body.</h2>'+
 [['Atlas','/'],['Hip / Live','/hip/'],['Hip / Exposed','/hip/dissection/'],['Knee / Live','/knee/'],['Shoulder / Live','/shoulder/']].map(([label,path])=>'<a href="'+path+'">'+label+' <span>↗</span></a>').join('')+
 '<button class="v3-insp-cta" data-v3-action="close-regions" style="margin-top:16px">Close</button></div>';
 document.body.appendChild(regionModal);
 const searchInput=qs('#v3-search-input');
 const allStructures=Object.entries(D.regions).flatMap(([r,v])=>v.structures.map(s=>({region:r,...s})));
 function search(q){
  const term=q.toLowerCase().trim();
  let matches=allStructures.filter(s=>!term||[s.name,s.syn,s.system,s.region].join(' ').toLowerCase().includes(term));
  if(term && !matches.length)matches=allStructures.filter(s=>{let words=s.name.toLowerCase().split(' ');return words.some(w=>w.startsWith(term.slice(0,Math.max(2,term.length-1))))});
  qs('#v3-search-results').innerHTML=matches.slice(0,28).map(s=>'<button data-result="'+safe(s.region)+':'+safe(s.key)+'"><strong>'+safe(s.name)+'</strong><small>'+safe(D.regions[s.region].name)+' · '+safe(s.system)+'</small></button>').join('')||'<p style="padding:18px;color:#b9a698">No matching structures. Try another name.</p>';
 }
 function openSearch(){
  modal.classList.add('open');search('');searchInput.value='';searchInput.focus();
 }
 function closeSearch(){modal.classList.remove('open');}
 searchInput.addEventListener('input',()=>search(searchInput.value));
 modal.addEventListener('click',e=>{if(e.target===modal)closeSearch();const b=e.target.closest('[data-result]');if(!b)return;const [r,key]=b.dataset.result.split(':');if(r!==region)location.href='/'+r+'/?focus='+encodeURIComponent(key);else{closeSearch();setMode('explore');select(key);}});
 regionModal.addEventListener('click',e=>{if(e.target===regionModal)regionModal.classList.remove('open')});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSearch();regionModal.classList.remove('open')}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}});
 function depthButtons(){
  return cfg.layers.map((name,i)=>'<button class="v3-chip" data-v3-depth="'+i+'" aria-pressed="'+(current.depth===i)+'">'+safe(name)+'</button>').join('');
 }
 function movementControls(){
  return '<span class="v3-tool-label">'+safe(cfg.motion)+'</span><input class="v3-range" data-v3-range type="range" min="0" max="'+maxAngle+'" step="1" value="'+Math.round(current.angle)+'" aria-label="'+safe(cfg.motion)+' angle">'+
   '<span class="v3-angle" data-v3-angle>'+Math.round(current.angle)+'°</span><button class="v3-chip" data-v3-action="play" aria-pressed="'+current.playing+'">'+(current.playing?'Ⅱ Pause':'▶ Play')+'</button><button class="v3-chip" data-v3-action="neutral">Reset</button>';
 }
 function renderToolbar(){
  let contents='';
  if(current.mode==='move')contents=movementControls();
  else if(current.mode==='trace')contents='<span class="v3-tool-label">TRACE · '+safe(cfg.name)+'</span><button class="v3-chip" data-v3-action="trace-focus" aria-pressed="true">'+safe(cfg.traces[0]?.name)+'</button><button class="v3-chip" data-v3-action="territories" aria-pressed="'+current.territories+'">Sensory territory</button>';
  else contents='<span class="v3-tool-label">'+(current.mode==='learn'?'PEEL / MOVE':'PEEL BACK')+'</span><input class="v3-range" data-v3-layer-range type="range" min="0" max="'+(count-1)+'" step="1" value="'+current.depth+'" aria-label="Anatomical layer depth"><span class="v3-tool-label" data-v3-layer-text>'+safe(cfg.layers[current.depth])+'</span><div class="v3-toolgroup">'+
  (current.mode==='learn'?'<button class="v3-chip" data-v3-action="lesson-move">Move joint</button>':'<button class="v3-chip" data-v3-action="search">Find structure</button>')+'</div>';
  qs('#v3-toolbar').innerHTML=contents;
 }
 function footerReferences(){
  return '<section class="v3-insp-section"><h3>Scientific context</h3><p class="v3-insp-note">Simplified illustrations. Structure positions, range of motion, and nerve territories vary between people. This is not a diagnostic exam.</p><a class="v3-insp-cta" href="'+resource+'">Read anatomy sources ↗</a></section>';
 }
 function listStructures(){return '<div class="v3-structure-list">'+cfg.structures.map(s=>'<button data-v3-structure="'+s.key+'" aria-pressed="'+(current.selected===s.key)+'">'+safe(s.name)+'</button>').join('')+'</div>';}
 function renderInspector(){
  const box=qs('#v3-inspector-scroll');if(!box)return;
  if(current.mode==='explore'){
   const s=structure(current.selected) || cfg.structures[0];
   const nativeRec=region==='hip'?null:(typeof DATA!=='undefined'?DATA.parts[s.key]:null);
   box.innerHTML='<div class="v3-insp-key">'+safe(s.system)+' · '+safe(cfg.name)+'</div><h2 class="v3-insp-title">'+safe(s.name)+'</h2>'+
    '<p class="v3-insp-copy">'+safe(nativeRec?.detail || s.fact)+'</p>'+
    '<p class="v3-insp-note"><span class="v3-highlight">THE MECHANISM</span> '+safe(s.fact)+'</p>'+
    (s.related.length?'<section class="v3-insp-section"><h3>Connected structures</h3><div class="v3-structure-list">'+s.related.map(key=>structure(key)).filter(Boolean).map(x=>'<button data-v3-structure="'+x.key+'">'+safe(x.name)+' ↗</button>').join('')+'</div></section>':'')+
    '<section class="v3-insp-section"><h3>Explore the layers</h3><div class="v3-structure-list">'+depthButtons()+'</div></section>'+
    '<section class="v3-insp-section"><h3>Structure library</h3>'+listStructures()+'</section>'+
    '<section class="v3-insp-section"><h3>Feel it · optional</h3><p class="v3-insp-copy">'+safe(cfg.feel)+'</p><p class="v3-insp-note">Stop if painful or if symptoms worsen. Not a diagnostic or treatment exercise.</p></section>'+footerReferences();
  } else if(current.mode==='move'){
   box.innerHTML='<div class="v3-insp-key">BIOMECHANICS · '+safe(cfg.name)+'</div><h2 class="v3-insp-title">Move the machine.</h2><p class="v3-insp-copy">'+safe(cfg.motion)+'. Drag the anatomy handle or use the angle control. Watch the bones and soft tissue relationships.</p>'+
   '<p class="v3-insp-note">'+safe(cfg.motionNote)+'</p><section class="v3-insp-section"><h3>What is moving?</h3><p class="v3-insp-copy">'+safe(cfg.intro)+'</p></section>'+
   '<section class="v3-insp-section"><h3>How to explore</h3><p class="v3-insp-copy">Play in slow cycles, pause at a position, isolate structures in Explore mode, then return here. The joint illustration is schematic.</p></section>'+footerReferences();
  } else if(current.mode==='trace'){
   const n=cfg.traces[0];const here=structure(n.key);
   box.innerHTML='<div class="v3-insp-key">NEURAL ROUTES · '+safe(cfg.name)+'</div><h2 class="v3-insp-title">'+safe(n.name)+'</h2>'+
   '<p class="v3-insp-copy">'+safe(here?.fact)+'</p>'+
   '<div class="v3-trace">'+safe(n.path)+'</div>'+
   '<section class="v3-insp-section"><h3>Where does the signal go?</h3><p class="v3-insp-copy">'+safe(n.territory)+'</p><p class="v3-insp-note">'+safe(n.note)+'</p></section>'+
   '<section class="v3-insp-section"><h3>Continue tracing</h3><div class="v3-structure-list"><button data-v3-action="trace-focus">Highlight nerve</button>'+
   (region==='hip'?'<a class="v3-insp-cta" href="/knee/?mode=trace">Continue toward the knee ↗</a>':'<a class="v3-insp-cta" href="/hip/?mode=trace">Explore the sciatic pathway ↗</a>')+
   '</div></section>'+footerReferences();
  }else renderLearn(box);
  if(window.innerWidth<=800 && current.sheet==='collapsed')qs('.v3-grab .v3-small').textContent= current.mode==='learn'?'TAP FOR LESSON':'TAP FOR DETAILS';
  else qs('.v3-grab .v3-small').textContent='ANATOMY · '+current.mode.toUpperCase();
  if(lastFocus&&current.mode!=='learn'){const h=qs('.v3-insp-title',box);if(h){h.tabIndex=-1;}}
 }
 function lessonProgress(){return lessons.filter(l=>current.completed[l.id]).length}
 function renderLearn(box){
  const allDone=lessonProgress();
  const intro='<div class="v3-insp-key">LEARN BY OPERATING</div><h2 class="v3-insp-title">The anatomy experiments.</h2><p class="v3-insp-copy">Predict what happens, manipulate the model, and reveal why.</p>'+
   '<div class="v3-progress" aria-label="'+allDone+' of 4 lessons complete"><span style="width:'+(allDone/4*100)+'%"></span></div><p class="v3-insp-note">'+allDone+' / 4 complete on this device</p>';
  const list='<section class="v3-insp-section"><h3>Choose an experiment</h3><div class="v3-structure-list">'+lessons.map((l,i)=>'<button data-v3-lesson="'+l.id+'" aria-pressed="'+(current.lesson===l.id)+'">'+(current.completed[l.id]?'✓ ':'0'+(i+1)+' / ')+safe(l.title)+'</button>').join('')+'</div></section>';
  if(!current.lesson){box.innerHTML=intro+list+footerReferences();return;}
  const l=byLesson(current.lesson);if(!l){current.lesson=null;box.innerHTML=intro+list;return}
  let body='<section class="v3-insp-section v3-quiz"><div class="v3-insp-key">ACTIVE EXPERIMENT</div><h3>'+safe(l.title)+'</h3>'+
    '<p class="v3-insp-copy">'+safe(l.prompt)+'</p>';
  if(current.phase==='prediction'){
   body+=l.options.map((o,i)=>'<button class="v3-answer" data-v3-choice="'+i+'"><span class="v3-letter">'+String.fromCharCode(65+i)+'</span><span>'+safe(o)+'</span></button>').join('');
   body+='<p class="v3-insp-note">Choose a hypothesis. You will test it in the actual illustration.</p>';
  }else if(current.phase==='action'){
   body+='<div class="v3-experiment"><strong>Now test it · '+safe(l.task)+'</strong>'+safe(l.instruction)+'</div>'+
    '<div class="v3-inline-actions">'+(l.target.type==='select'?'<button class="v3-insp-cta" data-v3-action="search">Find '+safe(structure(l.target.key)?.name||'structure')+'</button>':'')+
    (l.target.type==='angle'?'<span class="v3-insp-note">Use Move joint in the control strip.</span>':'')+
    (l.target.type==='trace'?'<button class="v3-insp-cta" data-v3-action="trace-focus">Trace nerve</button>':'')+
    (l.target.type==='depth'?'<button class="v3-insp-cta" data-v3-depth="'+l.target.min+'">Reveal target layer</button>':'')+'</div>'+
    '<p class="v3-insp-note">The answer unlocks after the specified anatomy interaction. You can use the controls without leaving Learn mode.</p>';
  }else{
   body+='<div class="v3-experiment"><strong>Revealed ✓</strong>'+safe(l.answer)+'</div>'+
   '<p class="v3-insp-note">'+(current.answer===l.correct?'Your prediction matched.':'Your initial prediction was different. That is exactly why we experiment.')+'</p>'+
   '<div class="v3-inline-actions"><button class="v3-insp-cta" data-v3-action="replay">↺ Replay</button><button class="v3-insp-cta" data-v3-action="next-lesson">Next experiment →</button></div>';
  }
  body+='</section>';
  box.innerHTML=intro+body+list+footerReferences();
 }
 function pickLesson(id){
  stopMotion();current.mode='learn';qsa('[data-v3-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v3Mode==='learn')));
  current.lesson=id;current.phase='prediction';current.answer=-1;renderInspector();renderToolbar();current.sheet='expanded';qs('#v3-inspector').dataset.sheet='expanded';
 }
 function setChoice(i){
  if(current.phase!=='prediction')return;current.answer=i;current.phase='action';renderInspector();
 }
 function checkLesson(type){
  if(!current.lesson||current.phase!=='action')return;
  const l=byLesson(current.lesson),t=l.target;
  const success=t.type==='angle'&&type==='angle'&&current.angle>=t.min ||
   t.type==='depth'&&type==='depth'&&current.depth>=t.min ||
   t.type==='select'&&type==='select'&&current.selected===t.key ||
   t.type==='trace'&&type==='trace';
  if(success){
   current.phase='revealed';current.completed[l.id]=true;save('bodylive-v3-lessons',current.completed);
   current.mode='learn';qsa('[data-v3-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v3Mode==='learn')));
   renderToolbar();renderInspector();
  }
 }
 function nextLesson(){
  const i=lessons.findIndex(l=>l.id===current.lesson);
  pickLesson(lessons[(i+1)%lessons.length].id);
 }
 function setSheet(state){
  current.sheet=state;qs('#v3-inspector').dataset.sheet=state;
  qs('.v3-grab').setAttribute('aria-expanded',state!=='collapsed');
 }
 let sheetPointer=0,sheetY=0;
 const grab=qs('.v3-grab');
 grab.addEventListener('pointerdown',e=>{sheetPointer=e.pointerId;sheetY=e.clientY;});
 grab.addEventListener('pointerup',e=>{if(e.pointerId!==sheetPointer)return;const delta=e.clientY-sheetY;if(Math.abs(delta)>25){setSheet(delta<0?'expanded':'collapsed');sheetPointer=0}});
 function zoomApply(){svg.style.transform='translate('+current.x+'px,'+current.y+'px) scale('+current.scale+')'}
 function zoom(delta){current.scale=Math.min(3.5,Math.max(1,current.scale*delta));if(current.scale===1){current.x=0;current.y=0}zoomApply()}
 function resetZoom(){current.scale=1;current.x=0;current.y=0;zoomApply();}
 const points=new Map();let gestureStart=null;
 function distance(){const arr=[...points.values()];return Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y)}
 const viewport=qs('#v3-viewport');
 viewport.addEventListener('pointerdown',e=>{
  if(e.target.closest('#drag-handle'))return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(points.size===1)gestureStart={x:e.clientX,y:e.clientY,ox:current.x,oy:current.y};
  else if(points.size===2)gestureStart={distance:distance(),scale:current.scale,x:current.x,y:current.y};
  try{viewport.setPointerCapture(e.pointerId)}catch{}
 });
 viewport.addEventListener('pointermove',e=>{
  if(!points.has(e.pointerId))return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(points.size===2 && gestureStart?.distance){
   current.scale=Math.max(1,Math.min(3.5,gestureStart.scale*distance()/Math.max(1,gestureStart.distance)));zoomApply();
  }else if(points.size===1 && current.scale>1 && gestureStart?.ox!==undefined){
   current.x=Math.max(-250,Math.min(250,gestureStart.ox+e.clientX-gestureStart.x));
   current.y=Math.max(-300,Math.min(300,gestureStart.oy+e.clientY-gestureStart.y));zoomApply();
  }
 });
 function endPointer(e){points.delete(e.pointerId);if(points.size===0)gestureStart=null;else if(points.size===1){const p=[...points.values()][0];gestureStart={x:p.x,y:p.y,ox:current.x,oy:current.y}}}
 ['pointerup','pointercancel','lostpointercapture'].forEach(type=>viewport.addEventListener(type,endPointer));
 viewport.addEventListener('wheel',e=>{if(e.ctrlKey||current.scale>1){e.preventDefault();zoom(e.deltaY<0?1.08:.93)}},{passive:false});
 // Tap the original SVG structures; the native anatomy engine still owns geometry.
 svg.addEventListener('click',e=>{
  const part=e.target.closest('[data-part]');if(part&&structure(part.dataset.part)){select(part.dataset.part);return;}
  if(region==='hip'){
   const shape=e.target.closest('#maxi,#medi,#mini,#deep,#theNerve');
   const key=({maxi:'max',medi:'med',mini:'min',deep:'pir',theNerve:'nerve'})[shape?.id];
   if(key)select(key);
  }
 });
 root.addEventListener('input',e=>{
  if(e.target.matches('[data-v3-range]')){stopMotion();nativeAngle(e.target.value);}
  if(e.target.matches('[data-v3-layer-range]')){stopMotion();nativeDepth(Number(e.target.value));const t=qs('[data-v3-layer-text]');if(t)t.textContent=cfg.layers[current.depth];current.selected=region==='hip'?(['max','med','pir','nerve'][current.depth]):((typeof DATA!=='undefined')?DATA.levels[current.depth]?.focus:current.selected);checkLesson('depth');if(current.mode!=='learn')renderInspector();}
 });
 root.addEventListener('change',e=>{if(e.target.matches('[data-v3-layer-range]'))renderToolbar()});
 root.addEventListener('click',e=>{
  const m=e.target.closest('[data-v3-mode]');if(m){setMode(m.dataset.v3Mode);return}
  const depth=e.target.closest('[data-v3-depth]');if(depth){setDepth(Number(depth.dataset.v3Depth));return;}
  const p=e.target.closest('[data-v3-structure]');if(p){select(p.dataset.v3Structure);return;}
  const l=e.target.closest('[data-v3-lesson]');if(l){pickLesson(l.dataset.v3Lesson);return;}
  const c=e.target.closest('[data-v3-choice]');if(c){setChoice(Number(c.dataset.v3Choice));return;}
  const a=e.target.closest('[data-v3-action]');if(!a)return;
  switch(a.dataset.v3Action){
   case 'search':openSearch();break;
   case 'close-search':closeSearch();break;
   case 'regions':regionModal.classList.add('open');break;
   case 'close-regions':regionModal.classList.remove('open');break;
   case 'zoom-in':zoom(1.2);break;
   case 'zoom-out':zoom(.83);break;
   case 'home':resetZoom();break;
   case 'play':toggleMotion();break;
   case 'neutral':stopMotion();nativeAngle(0);break;
   case 'reset':stopMotion();resetZoom();nativeAngle(0);current.selected=null;setMode('explore');nativeDepth(0);renderToolbar();renderInspector();break;
   case 'sheet':setSheet(current.sheet==='collapsed'?'half':current.sheet==='half'?'expanded':'collapsed');break;
   case 'trace-focus':if(current.mode!=='learn')setMode('trace');else{nativePart(cfg.traces[0].key);setTraceDecoration(true);checkLesson('trace')}break;
   case 'territories':current.territories=!current.territories;renderToolbar();if(current.territories){setSheet('expanded');renderInspector();}break;
   case 'lesson-move':{
    const b=qs('#v3-toolbar');if(b){b.innerHTML=movementControls()+'<button class="v3-chip" data-v3-action="lesson-depth">Layers</button>'}
    setSheet('half');break;}
   case 'lesson-depth':renderToolbar();break;
   case 'replay':pickLesson(current.lesson);break;
   case 'next-lesson':nextLesson();break;
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion()});
 window.addEventListener('pagehide',stopMotion);
 window.addEventListener('resize',()=>{if(window.innerWidth>800)setSheet('half')});
 // Preserve query-driven cross-region focus and deep linking.
 const query=new URLSearchParams(location.search);
 current.selected=cfg.structures[0].key;
 if(query.get('mode')==='trace')current.mode='trace';
 const focus=query.get('focus');
 if(focus&&structure(focus))current.selected=focus;
 nativeDepth(0);
 nativeAngle(0);
 renderToolbar();
 renderInspector();
 if(current.mode==='trace')setMode('trace');else select(current.selected);
 qsa('[data-v3-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v3Mode===current.mode)));
 updateFocusTag();
})();
