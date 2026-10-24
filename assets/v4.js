/* BODY / LIVE V4 — The Invisible Interface
 * One user-facing state model; existing SVG engines are retained as rendering adapters.
 * Illustrative educational anatomy; never a patient-specific diagnostic model.
 */
(() => {
  'use strict';
  const all = window.BODYLIVE_DATA;
  const region = location.pathname.startsWith('/hip/') ? 'hip' : location.pathname.startsWith('/shoulder/') ? 'shoulder' : 'knee';
  const data = all?.regions?.[region];
  if (!data) return;
  const el = id => document.getElementById(id);
  const query = (s, root = document) => root.querySelector(s);
  const queryAll = (s, root = document) => [...root.querySelectorAll(s)];
  const html = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const read = (key, fallback) => { try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;} };
  const store = (key, value) => { try {localStorage.setItem(key, JSON.stringify(value));} catch {} };
  const structure = key => data.structures.find(s => s.key === key);
  const lessons = all.lessons[region];
  const legacyScene = el(region === 'hip' ? 'anatomy' : 'scene');
  const legacyViewport = region === 'hip' ? query('.visual') : query('.viewport');
  if (!legacyScene || !legacyViewport) return;
  const oldInfo = region === 'hip' ? el('degrees') : el('angle-number');
  const state = {
    selected: data.structures[0].key,
    depth: 0, angle: 0, view: 'info', panel: 'compact', control: 'depth',
    zoom: 1, panX: 0, panY: 0, nerve: false, ghost: false,
    currentLesson: null, phase: 'predict', prediction: -1, menu: null,
    playing: false, direction: 1, previousFrame: 0, frame: 0,
    progress: read('bodylive-v4-progress', read('bodylive-v3-lessons', {}))
  };
  let lastFocused = null;
  let strokeObserverPaused = false;
  let ignorePanelClick = false;

  // The native anatomy renderers are isolated behind one deliberate interface.
  // V4 owns selection, depth, angle, and inspector state. Legacy scripts only draw SVG.
  const renderer = {
    depth(level) {
      const next = Math.max(0, Math.min(data.layers.length - 1, Math.round(level)));
      state.depth = next;
      if (region === 'hip') {
        if (typeof window.layer === 'function') window.layer(next);
      } else if (typeof window.setDepth === 'function') {
        window.setDepth(next);
      }
    },
    focus(key) {
      const part = structure(key); if (!part) return;
      state.selected = key;
      if (region === 'hip') {
        this.depth(part.layer ?? 0);
      } else if (typeof window.showPart === 'function') {
        window.showPart(key);
        if (typeof DATA !== 'undefined' && DATA.parts?.[key]) state.depth = DATA.parts[key].depth;
      }
      queryAll('.v4-selected', legacyScene).forEach(node => node.classList.remove('v4-selected'));
      if (region === 'hip') {
        const map = {max:'maxi',med:'medi',min:'mini',pir:'deep',nerve:'theNerve'};
        el(map[key])?.classList.add('v4-selected');
      } else {
        queryAll('[data-part]',legacyScene).filter(node => node.dataset.part === key).forEach(node => node.classList.add('v4-selected'));
      }
    },
    angle(value) {
      const number = Math.round(Math.max(0, Math.min(data.max, Number(value)||0)));
      state.angle = number;
      strokeObserverPaused = true;
      if (region === 'hip') {
        const nativeSlider = el('angle');
        if (nativeSlider) {
          nativeSlider.value = number;
          nativeSlider.dispatchEvent(new Event('input', {bubbles: true}));
        }
      } else if (typeof window.updateAngle === 'function') window.updateAngle(number);
      strokeObserverPaused = false;
      const angleLabel = el('v4-angle-label'); if (angleLabel) angleLabel.textContent = number + '°';
      const angleInput = el('v4-angle-input'); if (angleInput && document.activeElement !== angleInput) angleInput.value = number;
    },
    ghost(enabled) {
      state.ghost = enabled;
      if(region !== 'hip'){
        const xray = el('xray');
        if(xray){xray.checked=enabled;xray.dispatchEvent(new Event('change', {bubbles:true}));}
      } else {
        el('maxi')?.setAttribute('opacity',enabled?'0.18': (state.depth===0?'1':'0'));
      }
    },
    nerve(on) {
      state.nerve=on;
      const group = region==='hip' ? el('theNerve') : (el(region==='knee'?'knee-nerves':'shoulder-nerve') || query('[data-part="' + data.traces[0].key + '"]', legacyScene));
      if (group) {
        group.style.filter=on?'drop-shadow(0 0 13px rgba(251,210,111,.95))':'';
        if(on)group.classList.add('v4-traced');else group.classList.remove('v4-traced');
      }
      if(on)this.focus(data.traces[0].key);
    }
  };

  const root = document.createElement('div');
  root.id = 'v4-root';
  root.innerHTML = '<header class="v4-header">'+
    '<a class="v4-brand" href="/">BODY <span>/</span> LIVE</a>'+
    '<button class="v4-region-button" data-action="regions" aria-label="Change anatomical region">'+html(data.name)+' <span aria-hidden="true">⌄</span></button>'+
    '<div class="v4-header-tools"><button class="v4-square" data-action="search" aria-label="Find anatomical structures">⌕</button>'+
    '<button class="v4-square" data-action="reset" aria-label="Reset anatomy position and selection">↺</button></div>'+
    '</header>'+
    '<main class="v4-main" aria-label="'+html(data.name)+' interactive anatomy laboratory">'+
      '<section class="v4-stage" aria-label="Interactive anatomical illustration">'+
        '<div class="v4-scene" id="v4-scene"></div>'+
        '<div class="v4-scene-top"><span class="v4-kicker">'+html(data.axis)+'</span><span id="v4-focus-tag" class="v4-kicker v4-current"></span></div>'+
        '<div class="v4-scene-tools"><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="home" aria-label="Reset zoom and pan">⌖</button></div>'+
        '<p class="v4-safety">ILLUSTRATIVE MODEL · NOT TO SCALE</p>'+
      '</section>'+
      '<aside id="v4-inspector" data-panel="compact" class="v4-inspector" aria-label="Selected anatomy structure information">'+
        '<button id="v4-grab" class="v4-grab" data-action="panel" aria-expanded="false" aria-controls="v4-inspector-body"><span id="v4-mini-name"></span><span id="v4-mini-meta"></span><span class="v4-grab-arrow" aria-hidden="true">⌃</span></button>'+
        '<div class="v4-inspector-body" id="v4-inspector-body" tabindex="-1" aria-live="polite"></div>'+
      '</aside>'+
    '</main>'+
    '<div class="v4-control-band" aria-label="Anatomy interaction controls"><div id="v4-controls"></div></div>';
  document.body.appendChild(root);
  el('v4-scene').appendChild(legacyViewport);
  document.body.classList.add('v3-ready','v4-ready');

  const modal = document.createElement('div');
  modal.className = 'v4-modal'; modal.id = 'v4-modal';
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Anatomy navigation');
  modal.innerHTML = '<section class="v4-modal-card"><div class="v4-modal-head"><p id="v4-modal-title">Explore anatomy</p><button data-action="close-modal" aria-label="Close">✕</button></div><div id="v4-modal-content"></div></section>';
  document.body.appendChild(modal);

  function setPanel(panel) {
    state.panel = panel;
    const target = el('v4-inspector');
    target.dataset.panel = panel;
    el('v4-grab').setAttribute('aria-expanded', String(panel === 'expanded'));
    el('v4-grab').querySelector('.v4-grab-arrow').textContent = panel === 'expanded' ? '⌄' : '⌃';
  }
  function renderControl(){
    const area=el('v4-controls');
    if(state.control==='move'){
      area.innerHTML='<button class="v4-mini-control" data-action="control-depth" aria-label="Return to anatomical layers">‹ Layers</button>'+
        '<label class="v4-range-group"><span>MOVE</span><input id="v4-angle-input" type="range" min="0" max="'+data.max+'" step="1" value="'+state.angle+'" aria-label="'+html(data.motion)+' virtual angle"></label>'+
        '<strong id="v4-angle-label">'+state.angle+'°</strong><button class="v4-mini-control" data-action="play" aria-pressed="'+state.playing+'">'+(state.playing?'Ⅱ Pause':'▶ Play')+'</button>';
    }else{
      area.innerHTML='<span class="v4-layer-icon" aria-hidden="true">≋</span><label class="v4-range-group"><span>DEPTH</span>'+
        '<input id="v4-depth-input" type="range" min="0" max="'+(data.layers.length-1)+'" step="1" value="'+state.depth+'" aria-label="Peel through anatomical layers"></label>'+
        '<span id="v4-depth-name">'+html(data.layers[state.depth])+'</span>'+
        '<button class="v4-mini-control" data-action="control-move" aria-label="Move the '+html(data.name)+' joint">↝ Move</button>';
    }
  }
  function inspector(){
    const body=el('v4-inspector-body');
    const item=structure(state.selected) || data.structures[0];
    el('v4-mini-name').textContent= state.view==='lesson'?'ANATOMY EXPERIMENT':(state.view==='nerve'?'NERVE PATHWAY':item.name);
    el('v4-mini-meta').textContent=state.view==='lesson'?'Learn by doing':state.view==='nerve'?'Follow the signal':data.layers[state.depth];
    if(state.view==='lesson'){renderLesson();return;}
    if(state.view==='nerve'){
      const n=data.traces[0];
      body.innerHTML='<div class="v4-eyebrow">FOLLOW THE SIGNAL</div><h2>'+html(n.name)+'</h2>'+
        '<p>'+html(n.path)+'</p><div class="v4-neural-card">'+html(n.territory)+'</div><p class="v4-small">'+html(n.note)+' Sensory maps cannot determine a diagnosis.</p>'+
        '<div class="v4-context-actions"><button data-action="back-info">← Back to anatomy</button>'+
        (region==='hip'?'<a href="/knee/?focus=fibularNerve&trace=1">Follow toward the knee ↗</a>':'<a href="/hip/?focus=nerve&trace=1">Explore sciatic origins ↗</a>')+'</div>';
      return;
    }
    const maybeNative=region==='hip'?null:(typeof DATA!=='undefined'?DATA.parts?.[item.key]:null);
    const intro=maybeNative?.detail || item.fact;
    const connected=(item.related || []).map(key=>structure(key)).filter(Boolean);
    const learning=lessons.find(l=>l.key===item.key) || lessons[0];
    body.innerHTML='<div class="v4-eyebrow">'+html(item.system)+' / '+html(data.name)+'</div>'+
      '<h2>'+html(item.name)+'</h2><p>'+html(intro)+'</p>'+
      '<div class="v4-insight"><span>'+ (intro===item.fact?'THE CONNECTION':'WHY IT MATTERS') +'</span><p>'+html(intro===item.fact ? ((item.related||[]).length ? 'Explore how this structure relates to '+(item.related||[]).map(key=>structure(key)?.name).filter(Boolean).join(' and ')+'.' : 'Peel through the layers to see the neighboring structures.') : item.fact)+'</p></div>'+
      '<div class="v4-context-actions">'+
        (item.nerve?'<button data-action="trace">⌁ Trace nerve</button>':'<button data-action="control-move">↝ See it move</button>')+
        '<button data-action="lesson" data-lesson="'+html(learning.id)+'">✧ Why?</button>'+
        '<button data-action="related">◎ Related</button>'+
      '</div>'+
      (connected.length?'<section class="v4-detail-section"><h3>Connected anatomy</h3><div class="v4-chips">'+connected.map(s=>'<button data-structure="'+html(s.key)+'">'+html(s.name)+'</button>').join('')+'</div></section>':'')+
      '<section class="v4-detail-section"><h3>Structures in this joint</h3><div class="v4-chips">'+data.structures.map(s=>'<button data-structure="'+html(s.key)+'" aria-pressed="'+(item.key===s.key)+'">'+html(s.name)+'</button>').join('')+'</div></section>'+
      '<section class="v4-detail-section"><h3>Feel the anatomy · Optional</h3><p>'+html(data.feel)+'</p><p class="v4-small">Stop if pain, tingling, or numbness increases. This is body awareness, not an examination.</p></section>'+
      '<a class="v4-source-link" href="/references/">References, methodology and limits ↗</a>';
  }
  function choosePart(key,open=false){
    if(!structure(key))return;
    stop();
    state.view='info';
    renderer.nerve(false);
    renderer.focus(key);
    renderControl();inspector();updateTag();
    store('bodylive-v3-last',{region,key});
    if(open)setPanel('expanded');
    checkLesson('select');
  }
  function changeDepth(value,manual=true){
    stop();renderer.depth(value);
    if(manual){
      const key = region==='hip'?['max','med','pir','nerve'][state.depth] : (typeof DATA!=='undefined' ? DATA.levels?.[state.depth]?.focus : null);
      if(key && structure(key))state.selected=key;
    }
    const label=el('v4-depth-name');if(label)label.textContent=data.layers[state.depth];
    el('v4-depth-input') && (el('v4-depth-input').value=state.depth);
    inspector();updateTag();checkLesson('depth');
  }
  function changeAngle(value){
    renderer.angle(value);checkLesson('angle');
  }
  function updateTag(){el('v4-focus-tag').textContent=structure(state.selected)?.name ?? data.name;}
  function setControl(name){state.control=name;stop();renderControl();}
  function stop(){
    state.playing=false;cancelAnimationFrame(state.frame);state.previousFrame=0;
    const btn=query('[data-action="play"]',root);if(btn){btn.textContent='▶ Play';btn.setAttribute('aria-pressed','false');}
  }
  function tick(now){
    if(!state.playing)return;
    const dt=Math.min(38,now-(state.previousFrame || now));state.previousFrame=now;
    const value=state.angle+state.direction*dt*.045;
    if(value>=data.max){state.direction=-1;changeAngle(data.max);}
    else if(value<=0){state.direction=1;changeAngle(0);}
    else changeAngle(value);
    state.frame=requestAnimationFrame(tick);
  }
  function play(){
    if(state.playing){stop();return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    setControl('move');state.playing=true;state.direction=1;state.frame=requestAnimationFrame(tick);
    const btn=query('[data-action="play"]',root);if(btn){btn.textContent='Ⅱ Pause';btn.setAttribute('aria-pressed','true');}
  }
  function trace(){
    stop();state.view='nerve';state.selected=data.traces[0].key;
    renderer.nerve(true);inspector();updateTag();setPanel('expanded');renderControl();checkLesson('trace');
  }
  function pickLesson(id){
    const l=lessons.find(x=>x.id===id);if(!l)return;
    stop();state.currentLesson=id;state.phase='predict';state.prediction=-1;state.view='lesson';state.nerve=false;
    setControl('depth');inspector();setPanel('expanded');
  }
  function lesson(){return lessons.find(l=>l.id===state.currentLesson);}
  function learnProgress(){return lessons.filter(l=>state.progress[l.id]).length;}
  function renderLesson(){
    const box=el('v4-inspector-body'),l=lesson();
    if(!l){box.innerHTML='<div class="v4-eyebrow">DISCOVERY LAB</div><h2>Small experiments. Big discoveries.</h2><p>Predict, operate the anatomical model, and reveal how the mechanism works.</p>'+
      '<p class="v4-small">'+learnProgress()+' of 4 experiments completed on this device.</p>'+
      '<div class="v4-lesson-list">'+lessons.map((x,i)=>'<button data-lesson="'+x.id+'">'+(state.progress[x.id]?'✓ ':'0'+(i+1)+'  ')+html(x.title)+'</button>').join('')+'</div>'+
      '<button class="v4-dismiss" data-action="back-info">← Back to the body</button>';
      return;
    }
    let v='<div class="v4-eyebrow">INTERACTIVE EXPERIMENT · '+html(data.name)+'</div>'+
      '<h2>'+html(l.title)+'</h2><p>'+html(l.prompt)+'</p>';
    if(state.phase==='predict'){
      v+='<div class="v4-choices">'+l.options.map((opt,i)=>'<button data-predict="'+i+'"><span>'+String.fromCharCode(65+i)+'</span>'+html(opt)+'</button>').join('')+'</div>';
    } else if(state.phase==='operate'){
      v+='<div class="v4-experiment"><strong>Now test your idea.</strong><p>'+html(l.instruction)+'</p></div><div class="v4-context-actions">'+
      (l.target.type==='angle'?'<button data-action="control-move">↝ Open movement control</button>':'')+
      (l.target.type==='depth'?'<button data-action="show-depth">≋ Show anatomy layers</button>':'')+
      (l.target.type==='select'?'<button data-action="related">◎ Find the structure</button>':'')+
      (l.target.type==='trace'?'<button data-action="trace-lesson">⌁ Follow the nerve</button>':'')+
      '</div><p class="v4-small">Interact with the illustration or the relevant control to unlock the explanation.</p>';
    } else {
      v+='<div class="v4-experiment revealed"><strong>Discovered ✓</strong><p>'+html(l.answer)+'</p></div><p class="v4-small">'+(state.prediction===l.correct?'Your prediction matched.':'The result differed from your prediction—that’s the point of experimenting.')+'</p>'+
        '<div class="v4-context-actions"><button data-action="replay">↺ Replay</button><button data-action="next">Next discovery →</button></div>';
    }
    v+='<section class="v4-detail-section"><h3>More experiments</h3><div class="v4-lesson-list">'+lessons.map((x,i)=>'<button data-lesson="'+x.id+'" aria-pressed="'+(x.id===l.id)+'">'+(state.progress[x.id]?'✓ ':'0'+(i+1)+' ')+html(x.title)+'</button>').join('')+'</div></section>'+
       '<button class="v4-dismiss" data-action="back-info">← Return to anatomy</button>';
    box.innerHTML=v;
  }
  function predict(index){
    if(state.phase!=='predict')return;
    state.prediction=index;state.phase='operate';inspector();
  }
  function checkLesson(action){
    const l=lesson();if(state.view!=='lesson'||!l||state.phase!=='operate')return;
    const t=l.target;
    const done=(
      (t.type==='angle'&&action==='angle'&&state.angle>=t.min) ||
      (t.type==='depth'&&action==='depth'&&state.depth>=t.min) ||
      (t.type==='select'&&action==='select'&&state.selected===t.key) ||
      (t.type==='trace'&&action==='trace'&&state.nerve)
    );
    if(done){
      state.phase='reveal';state.progress[l.id]=true;store('bodylive-v4-progress',state.progress);
      inspector();setPanel('expanded');
    }
  }
  function search(text){
    const term=text.trim().toLowerCase();
    const collection=Object.entries(all.regions).flatMap(([r,d])=>d.structures.map(s=>({...s,region:r})));
    return collection.filter(s=>!term||[s.name,s.syn,s.system,s.region].join(' ').toLowerCase().includes(term)).slice(0,35);
  }
  function showModal(kind){
    lastFocused=document.activeElement;state.menu=kind;modal.classList.add('open');
    el('v4-modal-title').textContent=kind==='regions'?'Choose a joint':kind==='search'?'Find a structure':kind==='lessons'?'Experiments':'Connected anatomy';
    if(kind==='regions'){
      el('v4-modal-content').innerHTML='<div class="v4-menu-list">'+
        [['Atlas','/','Whole-body view'],['Hip / Live','/hip/','The body’s main motors'],['Hip / Exposed','/hip/dissection/','Five-step virtual dissection'],['Knee / Live','/knee/','The constrained hinge'],['Shoulder / Live','/shoulder/','The suspended socket']].map(([name,route,sub])=>'<a href="'+route+'">'+html(name)+'<small>'+html(sub)+'</small></a>').join('')+'</div>';
    }else if(kind==='search'){
      el('v4-modal-content').innerHTML='<input class="v4-search-input" id="v4-search" type="search" placeholder="Try ACL, piriformis, sciatic…" aria-label="Search anatomy">'+
        '<div class="v4-menu-list" id="v4-search-results"></div>';
      updateSearch('');el('v4-search').focus();
    }else if(kind==='lessons'){
      el('v4-modal-content').innerHTML='<div class="v4-menu-list">'+lessons.map((l,i)=>'<button data-lesson="'+l.id+'">'+(state.progress[l.id]?'✓ ':'0'+(i+1)+'  ')+html(l.title)+'</button>').join('')+'</div>';
    }else{
      const s=structure(state.selected);const connected=(s.related||[]).map(key=>structure(key)).filter(Boolean);
      el('v4-modal-content').innerHTML='<p class="v4-modal-help">Select a connected structure, or explore the complete library.</p><div class="v4-menu-list">'+
        (connected.length?connected:data.structures).map(x=>'<button data-structure="'+html(x.key)+'">'+html(x.name)+'<small>'+html(x.system)+'</small></button>').join('')+
        '<button data-action="search">Search the full body ↗</button></div>';
    }
    const first=query('a,button,input',el('v4-modal-content'));if(kind!=='search')first?.focus();
  }
  function updateSearch(value){
    const result=el('v4-search-results');if(!result)return;
    const found=search(value);
    result.innerHTML=found.length?found.map(s=>'<button data-result="'+s.region+':'+s.key+'">'+html(s.name)+'<small>'+html(all.regions[s.region].name)+' · '+html(s.system)+'</small></button>').join(''):'<p class="v4-small">No matching structures. Try another term.</p>';
  }
  function closeModal(){
    state.menu=null;modal.classList.remove('open');lastFocused?.focus?.();
  }
  function zoomApply(){legacyScene.style.transform='translate('+state.panX+'px,'+state.panY+'px) scale('+state.zoom+')';}
  function zoom(factor){
    state.zoom=Math.max(1,Math.min(3.3,state.zoom*factor));
    if(state.zoom===1){state.panX=0;state.panY=0;}
    zoomApply();
  }
  function resetView(){
    state.zoom=1;state.panX=0;state.panY=0;zoomApply();stop();renderer.angle(0);
    renderer.ghost(false);renderer.nerve(false);state.view='info';state.currentLesson=null;state.control='depth';
    renderer.depth(0);choosePart(data.structures[0].key);setPanel('compact');renderControl();
  }

  // All UI commands are routed through one event delegation path.
  root.addEventListener('input',e=>{
    if(e.target.id==='v4-depth-input'){changeDepth(Number(e.target.value));}
    if(e.target.id==='v4-angle-input'){stop();changeAngle(Number(e.target.value));}
  });
  root.addEventListener('click',e=>{
    const part=e.target.closest('[data-structure]');
    if(part){if(state.view==='lesson'){renderer.focus(part.dataset.structure);checkLesson('select');renderControl();}
      else choosePart(part.dataset.structure,true);closeModal();return;}
    const lessonButton=e.target.closest('[data-lesson]');
    if(lessonButton){closeModal();pickLesson(lessonButton.dataset.lesson);return;}
    const guess=e.target.closest('[data-predict]');
    if(guess){predict(Number(guess.dataset.predict));return;}
    const button=e.target.closest('[data-action]');if(!button)return;
    switch(button.dataset.action){
      case 'panel':if(ignorePanelClick){ignorePanelClick=false;break;}setPanel(state.panel==='compact'?'expanded':'compact');break;
      case 'search':showModal('search');break;
      case 'regions':showModal('regions');break;
      case 'related':showModal('related');break;
      case 'lessons':showModal('lessons');break;
      case 'close-modal':closeModal();break;
      case 'control-move':setControl('move');break;
      case 'control-depth':case 'show-depth':setControl('depth');break;
      case 'trace':trace();break;
      case 'back-info':state.view='info';state.currentLesson=null;renderer.nerve(false);inspector();break;
      case 'lesson':pickLesson(button.dataset.lesson || (lessons.find(l=>l.key===state.selected)||lessons[0]).id);break;
      case 'trace-lesson':renderer.nerve(true);checkLesson('trace');break;
      case 'replay':pickLesson(state.currentLesson);break;
      case 'next':{const n=lessons.findIndex(l=>l.id===state.currentLesson);pickLesson(lessons[(n+1)%lessons.length].id);break;}
      case 'play':play();break;
      case 'zoom-in':zoom(1.2);break;
      case 'zoom-out':zoom(0.83);break;
      case 'home':state.panX=0;state.panY=0;state.zoom=1;zoomApply();break;
      case 'reset':resetView();break;
    }
  });
  modal.addEventListener('click',e=>{
    if(e.target===modal){closeModal();return;}
    const result=e.target.closest('[data-result]');
    if(result){
      const [r,key]=result.dataset.result.split(':');
      if(r!==region)location.assign('/'+r+'/?focus='+encodeURIComponent(key));
      else{closeModal();choosePart(key,true);}
      return;
    }
    const b=e.target.closest('[data-action]');
    if(b){if(b.dataset.action==='close-modal')closeModal();if(b.dataset.action==='search')showModal('search');return;}
    const link=e.target.closest('[data-structure]');
    if(link){closeModal();if(state.view==='lesson'){renderer.focus(link.dataset.structure);checkLesson('select');renderControl();}else choosePart(link.dataset.structure,true);return;}
    const l=e.target.closest('[data-lesson]');if(l){closeModal();pickLesson(l.dataset.lesson);}
  });
  modal.addEventListener('input',e=>{if(e.target.id==='v4-search')updateSearch(e.target.value);});
  document.addEventListener('keydown',e=>{
    if(state.menu && e.key==='Tab'){
      const focusable=queryAll('button:not([disabled]), a[href], input',modal).filter(node=>node.getClientRects().length);
      if(focusable.length){const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
    if(e.key==='Escape'&&state.menu){closeModal();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showModal('search');}
  });

  // SVG pointer handling: original drag handles own motion; viewport owns two-finger pinch / zoomed pan.
  const points=new Map();let gesture=null;
  const scene=el('v4-scene');
  const gap=()=>{const [a,b]=[...points.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  scene.addEventListener('pointerdown',e=>{
    if(e.target.closest('#drag-handle')){setControl('move');return;}
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===1)gesture={x:e.clientX,y:e.clientY,panX:state.panX,panY:state.panY};
    else if(points.size===2)gesture={distance:gap(),zoom:state.zoom};
    if(points.size===2 || state.zoom>1){try{scene.setPointerCapture(e.pointerId);}catch{}}
  });
  scene.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId))return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===2&&gesture?.distance){
      state.zoom=Math.min(3.3,Math.max(1,gesture.zoom*gap()/Math.max(1,gesture.distance)));zoomApply();
    }else if(points.size===1&&state.zoom>1&&gesture?.panX!==undefined){
      state.panX=Math.max(-260,Math.min(260,gesture.panX+e.clientX-gesture.x));
      state.panY=Math.max(-310,Math.min(310,gesture.panY+e.clientY-gesture.y));zoomApply();
    }
  });
  const end=e=>{
    points.delete(e.pointerId);
    const p=points.values().next().value;
    gesture=points.size===1?{x:p.x,y:p.y,panX:state.panX,panY:state.panY}:null;
  };
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>scene.addEventListener(name,end));
  scene.addEventListener('wheel',e=>{if(e.ctrlKey||state.zoom>1){e.preventDefault();zoom(e.deltaY<0?1.1:0.9);}},{passive:false});
  // Hip abduction: manipulate the existing virtual femur directly, not just the slider.
  if(region==='hip' && el('leg')){
    const leg=el('leg');let bonePointer=null,boneX=0,boneAngle=0;
    leg.style.cursor='grab';leg.style.touchAction='none';
    leg.addEventListener('pointerdown',e=>{bonePointer=e.pointerId;boneX=e.clientX;boneAngle=state.angle;setControl('move');stop();e.stopPropagation();try{leg.setPointerCapture(e.pointerId);}catch{}});
    leg.addEventListener('pointermove',e=>{if(e.pointerId!==bonePointer)return;changeAngle(Math.min(data.max,Math.max(0,boneAngle + (e.clientX-boneX)*.22)));});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>leg.addEventListener(type,e=>{if(e.pointerId===bonePointer)bonePointer=null;}));
  }
  legacyScene.addEventListener('click',e=>{
    const p=e.target.closest('[data-part]');
    if(p&&structure(p.dataset.part)){
      if(state.view==='lesson'){renderer.focus(p.dataset.part);checkLesson('select');}else choosePart(p.dataset.part,true);
      return;
    }
    if(region==='hip'){
      const part=e.target.closest('#maxi,#medi,#mini,#deep,#theNerve');
      const map={maxi:'max',medi:'med',mini:'min',deep:'pir',theNerve:'nerve'};
      if(part&&map[part.id]){if(state.view==='lesson'){renderer.focus(map[part.id]);checkLesson('select');}else choosePart(map[part.id],true);}
    }
  });
  // Selected SVG groups can also be reached without precise touch.
  queryAll('[data-part]',legacyScene).forEach(node=>{
    if(!structure(node.dataset.part))return;
    node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Inspect '+structure(node.dataset.part).name);
    node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(state.view==='lesson'){renderer.focus(node.dataset.part);checkLesson('select');}else choosePart(node.dataset.part,true);}});
  });
  // Synchronize drag-handle changes from original geometry into the single V4 state.
  if(oldInfo){
    new MutationObserver(()=>{
      if(strokeObserverPaused)return;
      const angle=Number((oldInfo.textContent||'').match(/[0-9]+/)?.[0]);
      if(Number.isFinite(angle)&&angle!==state.angle){
        state.angle=angle;
        const label=el('v4-angle-label');if(label)label.textContent=angle+'°';
        const slider=el('v4-angle-input');if(slider&&document.activeElement!==slider)slider.value=angle;
        checkLesson('angle');
      }
    }).observe(oldInfo,{childList:true,subtree:true,characterData:true});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  // Basic mobile sheet gesture; explicit button always available as keyboard fallback.
  let startY=null,dragged=false;
  el('v4-grab').addEventListener('pointerdown',e=>{startY=e.clientY;dragged=false;});
  el('v4-grab').addEventListener('pointermove',e=>{if(startY!=null&&Math.abs(e.clientY-startY)>23)dragged=true;});
  el('v4-grab').addEventListener('pointerup',e=>{if(startY!=null&&dragged){setPanel(e.clientY<startY?'expanded':'compact');ignorePanelClick=true;}startY=null;});

  const qs=new URLSearchParams(location.search);
  renderer.depth(0);renderer.angle(0);
  const deep=qs.get('focus');
  renderer.focus(deep&&structure(deep)?deep:state.selected);
  if(qs.get('trace')==='1'){trace();}
  else if(qs.get('mode')==='learn'){state.view='lesson';inspector();setPanel('expanded');}
  else inspector();
  renderControl();updateTag();
  store('bodylive-v4-last',{region,key:state.selected});
})();
