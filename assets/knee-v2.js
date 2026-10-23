/* BODY / LIVE V2 — mobile-first layer for the existing Knee engine */
(() => {
  'use strict';
  const root = document.body;
  root.classList.add('knee-v2');
  const app = document.querySelector('.app');
  const viewport = document.querySelector('#viewport');
  const scene = document.querySelector('#scene');
  if (!app || !viewport || !scene || typeof DATA === 'undefined') return;
  const $v = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MODES = [ ['explore','◎','Explore'], ['move','↗','Move'], ['trace','⌁','Trace'], ['learn','✧','Learn'] ];
  let mode = 'explore';
  let expanded = matchMedia('(min-width:851px)').matches;
  let zoom = 1;
  let questionIndex = 0;
  let answer = null;
  const quizzes = [
    {question:'What helps stop the shinbone sliding too far forward?',options:['ACL','Meniscus','Patella'],correct:0,explain:'The ACL resists excessive anterior translation of the tibia relative to the femur. It also contributes to rotational stability.',part:'acl'},
    {question:'What spreads contact force between the two large knee bones?',options:['Patellar tendon','Menisci','Fibular nerve'],correct:1,explain:'The medial and lateral menisci distribute joint load and improve congruence. They are not simply cushions.',part:'meniscus'},
    {question:'Which structure carries signals around the outside of the knee?',options:['Common fibular nerve','PCL','Quadriceps tendon'],correct:0,explain:'The common fibular (peroneal) nerve wraps around the fibular neck. Its branches contribute to sensation in the outer lower leg and top of the foot.',part:'fibularNerve'}
  ];
  const modeTabs = () => MODES.map(([key, icon, title]) => `<button type="button" data-v2-mode="${key}" role="tab" aria-selected="${key===mode}"><b aria-hidden="true">${icon}</b>${title}</button>`).join('');
  const wrap = document.createElement('aside');
  wrap.className = 'v2-inspector';
  wrap.id = 'v2-inspector';
  wrap.setAttribute('aria-label','Anatomy inspector');
  wrap.dataset.expanded = String(expanded);
  wrap.innerHTML = `<button class="v2-sheet-grab" id="v2-grab" aria-label="Expand or collapse anatomy inspector" type="button"></button><div class="v2-inspector-head"><div><div class="v2-kicker">BODY / LIVE · INTERACTION LAB</div><h2 id="v2-panel-title">Discover the knee</h2></div><button class="v2-chevron" id="v2-expand" type="button" aria-expanded="${expanded}" aria-controls="v2-content">⌃</button></div><div class="v2-tabs" role="tablist" aria-label="Learning modes">${modeTabs()}</div><div class="v2-content" id="v2-content" aria-live="polite"></div>`;
  app.append(wrap);
  viewport.insertAdjacentHTML('beforeend',`<div class="v2-viewport-tools"><div class="v2-depth"><label for="v2-depth">PEEL</label><input id="v2-depth" type="range" min="0" max="4" step="1" value="0" aria-label="Anatomy depth: surface through nerve"><output id="v2-depth-out">1 / 5</output></div><div class="v2-toolbar"><button id="v2-ghost" class="v2-tool" type="button" title="Ghost tissue" aria-label="Toggle transparent surface tissue" aria-pressed="false">◈</button><button id="v2-zoom" class="v2-tool" type="button" aria-label="Zoom in" title="Zoom in">＋</button><button id="v2-reset" class="v2-tool" type="button" title="Reset view" aria-label="Reset movement and zoom">↺</button></div></div><div class="v2-motion-caption" aria-live="off"><b id="v2-caption-type">DISCOVER</b><span id="v2-caption">Tap a structure to discover what it does.</span></div>`);
  const dock = document.createElement('nav'); dock.className='v2-mobile-dock';dock.setAttribute('aria-label','Lab mode');dock.innerHTML = MODES.map(([key, icon, title])=>`<button type="button" data-v2-mode="${key}" aria-selected="${key===mode}"><span aria-hidden="true">${icon}</span>${title}</button>`).join('');document.body.append(dock);
  const setExpanded = value => {expanded=!!value;wrap.dataset.expanded=String(expanded);$v('v2-expand').setAttribute('aria-expanded',String(expanded));$v('v2-expand').textContent=expanded?'⌄':'⌃';};
  const info = () => {
    const part = state.mode==='symptoms' && state.zone ? DATA.zones[state.zone] : DATA.parts[state.part] || DATA.levels[state.depth];
    return {title:part?.name||part?.title||'Under the surface',subtitle:part?.tag||part?.category||'STRUCTURE',body:part?.detail||part?.copy||'Choose a structure to learn what it does.',fact:part?.fact||part?.engineering||'Everything is connected, but the simulation is intentionally simplified.'};
  };
  const structureCards = keys => keys.map(key=>{
    const d=DATA.parts[key];if(!d)return '';
    return `<button type="button" class="v2-chip" data-v2-part="${key}" aria-pressed="${state.part===key}">${esc(d.name)}</button>`;
  }).join('');
  const focusCard = () => {let d=info();return `<article class="v2-info"><span class="v2-eyebrow">${esc(d.subtitle)}</span><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p><div class="v2-engineer"><strong>WHY IT MATTERS</strong><div>${esc(d.fact)}</div></div></article>`;};
  const render = () => {
    $v('v2-panel-title').textContent={explore:'Under the surface',move:'Move the machine',trace:'Follow a signal',learn:'Anatomy experiments'}[mode];
    document.querySelectorAll('[data-v2-mode]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.v2Mode===mode)));
    $v('v2-depth').value=state.depth;$v('v2-depth-out').textContent=`${state.depth+1} / 5`;
    $v('v2-ghost').setAttribute('aria-pressed',String(state.xray));
    $v('v2-caption-type').textContent={explore:'DISCOVER',move:'MOVEMENT',trace:'SIGNAL PATH',learn:'EXPERIMENT'}[mode];
    $v('v2-caption').textContent={explore:'Tap any highlighted structure.',move:`Knee flexion · ${Math.round(state.angle)}°`,trace:'Follow the common fibular nerve.',learn:'Predict, touch, then reveal.'}[mode];
    const content=$v('v2-content');
    if(mode==='explore'){
      content.innerHTML = `<h3 class="v2-heading">Tap into the layers.</h3><p class="v2-description">Peel from skin to nerves, or choose any structure. The model isolates its neighborhood while the card explains the engineering.</p><input class="v2-search" id="v2-search" type="search" placeholder="Find a muscle, ligament, bone…" aria-label="Search knee structures" autocomplete="off"><div class="v2-system" id="v2-chips">${structureCards(['femur','tibia','patella','quads','hamstrings','acl','pcl','collaterals','meniscus','cartilage','fibularNerve','tibialNerve'])}</div>${focusCard()}<button class="v2-button" type="button" data-v2-action="pain">Explore symptom locations ↗</button><p class="v2-note">The highlighted pain patterns are educational, not a diagnosis. Distinct sensory loss warrants medical assessment.</p>`;
    } else if(mode==='move'){
      content.innerHTML = `<div class="v2-stat"><div class="v2-angle" id="v2-angle-number">${Math.round(state.angle)}°</div><small>FLEXION ANGLE<br>illustrative model</small></div><input class="v2-range" id="v2-angle" type="range" min="0" max="125" step="1" value="${Math.round(state.angle)}" aria-label="Knee bend angle"><div class="v2-range-labels"><span>0° · extension</span><span>125° · flexion</span></div><div class="v2-actions"><button type="button" class="v2-button primary" id="v2-play">${state.playing?'Ⅱ Pause motion':'▶ Play motion'}</button><button type="button" class="v2-button" id="v2-zero">Reset to 0°</button></div><h3 class="v2-heading">The hinge that isn't just a hinge.</h3><p class="v2-description" id="v2-motion-note">${esc($v('angle-summary').textContent)}</p><div class="v2-info"><span class="v2-eyebrow">Try this</span><h3>Move the joint yourself.</h3><p>Drag the glowing circle on the diagram to bend the tibia. Watch the joint position change. Ligaments shown here are schematic, not calculated elastic deformation.</p></div>`;
    } else if(mode==='trace'){
      content.innerHTML=`<h3 class="v2-heading">A signal's journey.</h3><p class="v2-description">The sciatic nerve divides into branches near the knee. Follow a branch to discover why knee anatomy can matter to sensation farther down your leg.</p><div class="v2-system"><button type="button" class="v2-chip" data-v2-part="fibularNerve" aria-pressed="${state.part==='fibularNerve'}">Common fibular nerve</button><button type="button" class="v2-chip" data-v2-part="tibialNerve" aria-pressed="${state.part==='tibialNerve'}">Tibial nerve</button></div>${focusCard()}<div class="v2-disclaimer">Nerve territories overlap. A foot sensation does not identify the location of a nerve problem; this model cannot distinguish spinal root from peripheral nerve causes.</div>`;
    } else {
      const q=quizzes[questionIndex];
      content.innerHTML=`<div class="v2-section-label">EXPERIMENT ${questionIndex+1} / ${quizzes.length}</div><div class="v2-question"><span class="v2-eyebrow">MAKE A PREDICTION</span><strong>${esc(q.question)}</strong>${q.options.map((o,i)=>`<button type="button" class="v2-option" data-v2-answer="${i}" ${answer!==null?'disabled':''} ${answer!==null&&i===q.correct?'data-answer="correct"':answer===i&&i!==q.correct?'data-answer="wrong"':''}>${esc(o)}</button>`).join('')}<div class="v2-feedback" id="v2-feedback">${answer===null?'Choose an answer to reveal the structure.':esc((answer===q.correct?'Exactly. ':'Not quite. ')+q.explain)}</div></div><div class="v2-actions"><button type="button" class="v2-button primary" id="v2-next">${questionIndex===quizzes.length-1?'Repeat experiments':'Next experiment →'}</button><button type="button" class="v2-button" id="v2-find">Reveal in model</button></div><div class="v2-info"><span class="v2-eyebrow">FEEL THE MACHINERY</span><h3>${esc(DATA.cues[questionIndex].title)}</h3><p>${esc(DATA.cues[questionIndex].copy)}</p></div><p class="v2-note">Body-awareness prompts are optional. Never force a painful movement or use this as a nerve function test.</p>`;
    }
    content.scrollTop=0;
  };
  const zoomTo = value => {zoom=Math.max(1,Math.min(1.8,value));scene.style.transform=`scale(${zoom})`;$v('v2-zoom').textContent=zoom>=1.8?'−':'＋';$v('v2-zoom').setAttribute('aria-label',zoom>=1.8?'Zoom out':'Zoom in');};
  const modeTo = next => {
    mode=next;stop();
    if(next==='trace'){setDepth(4);showPart('fibularNerve');}
    else if(state.mode==='symptoms')setMode('anatomy');
    if(next==='move' && state.depth===0)setDepth(2);
    render();if(matchMedia('(max-width:850px)').matches)setExpanded(false);
  };
  const updateReadout=()=>{
    const angle=$v('v2-angle'); if(angle)angle.value=Math.round(state.angle);
    const value=$v('v2-angle-number');if(value)value.textContent=Math.round(state.angle)+'°';
    const note=$v('v2-motion-note');if(note)note.textContent=$v('angle-summary').textContent;
    if(mode==='move')$v('v2-caption').textContent=`Knee flexion · ${Math.round(state.angle)}°`;
  };
  function monitorMotion(){updateReadout();const play=$v('v2-play');if(play)play.textContent=state.playing?'Ⅱ Pause motion':'▶ Play motion';if(state.playing)requestAnimationFrame(monitorMotion);}
  wrap.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    if(b.id==='v2-grab'||b.id==='v2-expand'){setExpanded(!expanded);return;}
    if(b.dataset.v2Mode){modeTo(b.dataset.v2Mode);return;}
    if(b.dataset.v2Part){showPart(b.dataset.v2Part);render();return;}
    if(b.dataset.v2Action==='pain'){setMode('symptoms');render();setExpanded(true);return;}
    if(b.id==='v2-play'){document.getElementById('play').click();monitorMotion();return;}
    if(b.id==='v2-zero'){stop();updateAngle(0);render();return;}
    if(b.dataset.v2Answer!==undefined){answer=Number(b.dataset.v2Answer);if(answer===quizzes[questionIndex].correct){showPart(quizzes[questionIndex].part);}render();return;}
    if(b.id==='v2-next'){questionIndex=(questionIndex+1)%quizzes.length;answer=null;render();return;}
    if(b.id==='v2-find'){showPart(quizzes[questionIndex].part);render();return;}
  });
  dock.addEventListener('click',ev=>{const b=ev.target.closest('[data-v2-mode]');if(b)modeTo(b.dataset.v2Mode)});
  wrap.addEventListener('input',ev=>{
    if(ev.target.id==='v2-angle'){stop();updateAngle(ev.target.value);updateReadout();return;}
    if(ev.target.id==='v2-search'){
      const q=ev.target.value.toLowerCase().trim();wrap.querySelectorAll('[data-v2-part]').forEach(el=>{el.hidden=!el.textContent.toLowerCase().includes(q)});
    }
  });
  $v('v2-depth').addEventListener('input',ev=>{stop();if(mode==='trace')mode='explore';setDepth(Number(ev.target.value));render();});
  $v('v2-ghost').addEventListener('click',()=>{const x=$v('xray');x.checked=!x.checked;x.dispatchEvent(new Event('change',{bubbles:true}));$v('v2-ghost').setAttribute('aria-pressed',String(x.checked));});
  $v('v2-zoom').addEventListener('click',()=>zoomTo(zoom>=1.8?1:zoom+.2));
  $v('v2-reset').addEventListener('click',()=>{stop();updateAngle(0);zoomTo(1);setDepth(0);if(mode==='trace')mode='explore';render();});
  scene.addEventListener('click',ev=>{if(ev.target.closest('[data-part],[data-zone]'))setTimeout(render,0);});
  $v('drag-handle').addEventListener('pointermove',()=>{if(mode==='move')requestAnimationFrame(updateReadout)});
  let pinch=null;
  scene.addEventListener('touchstart',ev=>{if(ev.touches.length===2){const [a,b]=ev.touches;pinch={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),startZoom:zoom};}},{passive:true});
  scene.addEventListener('touchmove',ev=>{if(ev.touches.length===2&&pinch){ev.preventDefault();const [a,b]=ev.touches;zoomTo(pinch.startZoom*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/Math.max(1,pinch.distance));}},{passive:false});
  scene.addEventListener('touchend',ev=>{if(ev.touches.length<2)pinch=null;},{passive:true});
  // Nonintrusive keyboard navigation for inspectors.
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&matchMedia('(max-width:850px)').matches)setExpanded(false);});
  let touchY=null;
  $v('v2-grab').addEventListener('touchstart',ev=>{touchY=ev.touches[0].clientY},{passive:true});
  $v('v2-grab').addEventListener('touchend',ev=>{if(touchY===null)return;const delta=ev.changedTouches[0].clientY-touchY;if(Math.abs(delta)>25)setExpanded(delta<0);touchY=null;},{passive:true});
  render();
})();
