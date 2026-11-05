import {test,expect} from '@playwright/test';
/* V14 #41: intelligent mobile touch selection - behaviour tests with REAL, unforced input.
 *
 * Targets are located with the READ-ONLY touchPlanAt()/hitTestAt()/touchCandidatesAt() (no selection, render, URL or
 * camera side effects), then exercised with page.touchscreen.tap() / page.mouse.click() at integer CSS pixels - the
 * same path a finger takes. Synthetic emulated viewports: this is NOT real-iPhone validation (issue #41 stays open). */
const MOBILE=[[390,844],[375,667],[320,568],[844,390],[667,375]];
const DESKTOP=[[1440,900]];
const KNEE=['anterior-cruciate-ligament','posterior-cruciate-ligament','medial-collateral-ligament','lateral-collateral-ligament','medial-meniscus','lateral-meniscus','patellar-ligament','quadriceps-tendon'];
const CHROME='.topbar,#connective-guides,#connective-mobile-nav,#connective-left,#connective-right,.stage-meta';
const TOUCH={pointerType:'touch',contact:0};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120)))));
const projectViewports=info=>info.project.name==='desktop-chromium'?DESKTOP:MOBILE;
async function enter(page,w,h){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:w,height:h});
 await page.goto('/atlas/?studio=connective',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#connective-left')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
 await frames(page);await frames(page);
 return errors;
}
// Selection oracle = the atlas's own selection (covers bones/muscles too); the Studio snapshot only tracks connective ids.
const selectedId=page=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.selected);
const cameraKey=page=>page.evaluate(()=>{const c=window.__BODY_ATLAS__.getState().camera;return JSON.stringify([c.yaw,c.pitch,c.zoom,c.target]);});
// The orbit handler treats two taps <325 ms and <28 px apart as a double-tap (recentre), exactly as in production; space taps out.
const tapXY=async(page,x,y)=>{await page.waitForTimeout(380);await page.touchscreen.tap(x,y);};
const tap=async(page,info,p)=>{await page.waitForTimeout(380);return info.project.use.hasTouch?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);};
const mouseClick=async(page,p)=>{await page.waitForTimeout(380);return page.mouse.click(p.x,p.y);};

/* Read-only survey of the knee on an integer CSS-pixel grid (page coordinates). Returns the best, most robust
 * example of every behaviour class. A point is "robust" if its four axis neighbours at 1 and 2 px agree, so the
 * integer snapping of touch coordinates cannot flip the outcome. */
const survey=(page)=>page.evaluate(([ids,touch])=>{
 const A=window.__BODY_ATLAS__,c=document.getElementById('atlas-canvas').getBoundingClientRect();
 const all=A.touchCandidatesAt(c.width/2,c.height/2,5000)||[];
 let X0=1e9,Y0=1e9,X1=-1e9,Y1=-1e9;
 for(const k of all)if(ids.includes(k.id)){const f=k.footprint;X0=Math.min(X0,f.x);Y0=Math.min(Y0,f.y);X1=Math.max(X1,f.x+f.w);Y1=Math.max(Y1,f.y+f.h);}
 const M=28,x0=Math.max(Math.ceil(c.x),Math.floor(c.x+X0-M)),x1=Math.min(Math.floor(c.right),Math.ceil(c.x+X1+M));
 const y0=Math.max(Math.ceil(c.y),Math.floor(c.y+Y0-M)),y1=Math.min(Math.floor(c.bottom),Math.ceil(c.y+Y1+M));
 const plan=(x,y)=>A.touchPlanAt(x-c.x,y-c.y,touch);
 const sig=p=>!p?'null':p.kind==='exact'||p.kind==='select'?p.kind+':'+p.id:p.kind==='choose'?'choose:'+p.options.map(o=>o.id).sort().join('+'):'none';
 const robust=(x,y,s)=>{let r=0;for(const R of [1,2,3]){if(![[R,0],[-R,0],[0,R],[0,-R]].every(([a,b])=>sig(plan(x+a,y+b))===s))break;r=R;}return r;};
 const out={exact:{},select:[],choose:[],none:[],canvas:{x:c.x,y:c.y,w:c.width,h:c.height},scanned:0};
 const T0=performance.now();
 for(let y=y0;y<=y1;y+=2)for(let x=x0;x<=x1;x+=2){
  const p=plan(x,y);out.scanned++;if(!p)continue;const s=sig(p);
  const el=document.elementFromPoint(x,y);if((el?.id||'')!=='atlas-canvas')continue;       // must be a canvas tap, not a control
  if(p.kind==='exact'&&ids.includes(p.id)){const r=robust(x,y,s);const e=out.exact[p.id];if(!e||r>e.r)out.exact[p.id]={x,y,r,id:p.id};}
  else if(p.kind==='select'){
   const d=p.candidate.distance;if(d<4)continue;                                  // a real offset, not a near-miss of the edge
   const r=robust(x,y,s);if(r<1)continue;
   out.select.push({x,y,r,id:p.id,d,alt:p.alternatives.map(a=>a.id),R:p.radius,cands:p.candidates.map(k=>k.id)});
  }else if(p.kind==='choose'){
   const r=robust(x,y,s);if(r<1)continue;
   out.choose.push({x,y,r,options:p.options.map(o=>o.id),R:p.radius});
  }else if(p.kind==='none'){
   const far=(A.touchCandidatesAt(x-c.x,y-c.y,44)||[]).length===0;                  // nothing at all within 44 px
   if(far)out.none.push({x,y});
  }
 }
 if(!out.none.length){
  // Nothing in the knee neighbourhood is far from anatomy; sample the whole canvas for genuinely empty space.
  for(let y=Math.ceil(c.y)+6;y<=Math.floor(c.bottom)-6;y+=14)for(let x=Math.ceil(c.x)+6;x<=Math.floor(c.right)-6;x+=14){
   const p=plan(x,y);if(!p||p.kind!=='none')continue;
   if((A.touchCandidatesAt(x-c.x,y-c.y,44)||[]).length===0&&(document.elementFromPoint(x,y)?.id||'')==='atlas-canvas')out.none.push({x,y});
  }
 }
 out.ms=performance.now()-T0;
 const kneeFirst=o=>ids.includes(o.id)?1:0;
 out.select.sort((a,b)=>kneeFirst(b)-kneeFirst(a)||b.r-a.r||b.d-a.d);out.choose.sort((a,b)=>b.r-a.r);
 return out;
},[KNEE,TOUCH]);


/* Enough in the CI log to tell "pointer type/size differed" from "plan differed" from "UI never opened". */
const installTapLog=page=>page.evaluate(()=>{const log=window.__tapLog=[];const cv=document.getElementById('atlas-canvas');
 for(const t of ['pointerdown','pointerup','pointercancel','click'])cv.addEventListener(t,e=>log.push({t,x:e.clientX,y:e.clientY,pt:e.pointerType,w:e.width,h:e.height}),true);});
const tapDiag=(page,x,y,touch)=>page.evaluate(([x,y,touch])=>{const c=document.getElementById('atlas-canvas').getBoundingClientRect(),A=window.__BODY_ATLAS__,p=A.touchPlanAt(x-c.x,y-c.y,touch);
 return {events:(window.__tapLog||[]).slice(-8),planNow:p&&{kind:p.kind,id:p.id,R:p.radius,options:p.options?.map(o=>o.id),cands:p.candidates?.map(k=>[k.id,+k.distance.toFixed(1),k.occludedBy,Math.round(Math.min(k.footprint.w,k.footprint.h))])},
  selected:A.getState().unified.selected,chooserHidden:document.getElementById('touch-pick')?.hidden??null,canvas:{x:c.x,y:c.y}};},[x,y,touch]);
const chooser=page=>page.locator('#touch-pick.choose');
async function expectChooserSafe(page){
 const box=await page.locator('#touch-pick').boundingBox();
 const canvas=await page.locator('#atlas-canvas').boundingBox();
 expect(box,'chooser has a box').toBeTruthy();
 expect(box.x).toBeGreaterThanOrEqual(canvas.x-1);expect(box.y).toBeGreaterThanOrEqual(canvas.y-1);
 expect(box.x+box.width).toBeLessThanOrEqual(canvas.x+canvas.width+1);expect(box.y+box.height).toBeLessThanOrEqual(canvas.y+canvas.height+1);
 // never over the bottom sheet / panels / top bar
 const rects=await page.evaluate(sel=>[...document.querySelectorAll(sel)].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {n:e.id||e.className,x:r.x,y:r.y,r:r.right,b:r.bottom};}),CHROME);
 for(const r of rects){
  const ov=Math.max(0,Math.min(box.x+box.width,r.r)-Math.max(box.x,r.x))*Math.max(0,Math.min(box.y+box.height,r.b)-Math.max(box.y,r.y));
  expect(ov,'chooser overlaps '+r.n).toBe(0);
 }
}

for(const [w,h] of [...MOBILE,...DESKTOP]){
 test('touch selection '+w+'x'+h+': precise, offset, crowded, empty and hidden behave correctly',async({page},info)=>{
  test.setTimeout(300000);
  test.skip(!projectViewports(info).some(v=>v[0]===w&&v[1]===h),'viewport belongs to another project');
  const touch=!!info.project.use.hasTouch;
  const errors=await enter(page,w,h);
  const S=await survey(page);
  info.annotations.push({type:'survey',description:JSON.stringify({scanned:S.scanned,ms:Math.round(S.ms),exact:Object.keys(S.exact).length,select:S.select.length,choose:S.choose.length,none:S.none.length})});
  expect(await selectedId(page),'nothing selected before any tap').toBeNull();
  await installTapLog(page);
  const cam0=await cameraKey(page);

  if(!touch){
   // ---- 6. Desktop mouse behaviour is unchanged: exact only, no tolerance, no chooser -----------------------
   const ids=Object.keys(S.exact);expect(ids.length,'desktop has exact targets').toBeGreaterThan(0);
   const t=S.exact[ids[0]];
   await mouseClick(page,t);
   await expect.poll(()=>selectedId(page)).toBe(t.id);
   await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
   expect(await selectedId(page)).toBeNull();
   // A point a touch would snap, clicked with a mouse, selects nothing and opens nothing.
   const near=S.select[0];expect(near,'a snap-able point exists for the mouse comparison').toBeTruthy();
   await mouseClick(page,near);await frames(page);
   expect(await selectedId(page),'mouse click on a near-miss must not snap').toBeNull();
   await expect(page.locator('#touch-pick')).toBeHidden();
   expect(await cameraKey(page)).toBe(cam0);
   expect(errors).toEqual([]);
   return;
  }

  // ---- 1. Precise taps still select the same structure (unforced) -----------------------------------------
  const precise=Object.values(S.exact);
  expect(precise.length,'at least three structures have an exact, robust tap point').toBeGreaterThanOrEqual(3);
  for(const t of precise.slice(0,3)){
   await tapXY(page,t.x,t.y);
   await expect.poll(()=>selectedId(page),'precise tap on '+t.id).toBe(t.id);
   await expect(page.locator('#touch-pick')).toBeHidden();                 // an exact hit never opens UI
   await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
  }

  // ---- 2. Offset touch tap selects the unambiguous nearby structure ---------------------------------------
  const off=S.select[0];
  expect(off,'a robust unambiguous offset-tap point exists: '+JSON.stringify({sel:S.select.length,ch:S.choose.length})).toBeTruthy();
  expect(await page.evaluate(([x,y])=>window.__BODY_ATLAS__.hitTestAt(x-document.getElementById('atlas-canvas').getBoundingClientRect().x,y-document.getElementById('atlas-canvas').getBoundingClientRect().y),[off.x,off.y]),'the offset point truly misses every triangle').toBeNull();
  await tapXY(page,off.x,off.y);
  try{await expect.poll(()=>selectedId(page),{message:'offset tap at '+off.d.toFixed(1)+' px from '+off.id,timeout:4000}).toBe(off.id);}
  catch(e){throw new Error(e.message+'\nOFFSET DIAGNOSTICS '+JSON.stringify({off,...await tapDiag(page,off.x,off.y,TOUCH)}));}
  await expect(page.locator('#touch-pick.choose')).toBeHidden();
  expect(await cameraKey(page),'a tap never moves the camera').toBe(cam0);
  info.annotations.push({type:'offset-tap',description:JSON.stringify({id:off.id,distancePx:+off.d.toFixed(1),radius:off.R})});

  // ---- 2b. A snapped selection can be corrected ("Not it?" -> nearby structures) --------------------------
  const withAlt=S.select.find(s=>s.alt.length>0);
  if(withAlt){
   await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
   await tapXY(page,withAlt.x,withAlt.y);
   await expect.poll(()=>selectedId(page)).toBe(withAlt.id);
   const other=page.locator('#touch-pick [data-touch-other]');
   await expect(other).toBeVisible();await page.waitForTimeout(420);
   await other.tap();
   await expect(chooser(page)).toBeVisible();
   const labels=await chooser(page).locator('button').count();
   expect(labels).toBeGreaterThanOrEqual(2);
   const alt=chooser(page).locator('button[data-touch-id="'+withAlt.alt[0]+'"]');
   await expect(alt).toBeVisible();await page.waitForTimeout(420);await alt.tap();
   await expect.poll(()=>selectedId(page),'correction picks the alternative').toBe(withAlt.alt[0]);
   await expect(page.locator('#touch-pick')).toBeHidden();
  }

  // ---- 3. Crowded joint tap opens disambiguation instead of guessing --------------------------------------
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
  const crowd=S.choose[0];
  expect(crowd,'a robust crowded point exists').toBeTruthy();
  await page.evaluate(()=>{const log=window.__tapLog=[];const cv=document.getElementById('atlas-canvas');
   for(const t of ['pointerdown','pointerup','pointercancel'])cv.addEventListener(t,e=>log.push({t,x:e.clientX,y:e.clientY,pt:e.pointerType,w:e.width,h:e.height}),true);});
  await tapXY(page,crowd.x,crowd.y);
  try{await expect(chooser(page),'crowded tap opens the chooser').toBeVisible({timeout:4000});}
  catch(e){
   const d=await page.evaluate(([x,y,touch])=>{const c=document.getElementById('atlas-canvas').getBoundingClientRect(),A=window.__BODY_ATLAS__,p=A.touchPlanAt(x-c.x,y-c.y,touch);
    return {events:window.__tapLog,plan:p&&{kind:p.kind,id:p.id,R:p.radius,options:p.options?.map(o=>o.id),cands:p.candidates?.map(k=>[k.id,+k.distance.toFixed(1),k.occludedBy])},selected:A.getState().unified.selected,camera:JSON.stringify(A.getState().camera),
     touchPick:document.getElementById('touch-pick')?.outerHTML?.slice(0,200)||null,canvas:{x:c.x,y:c.y}};},[crowd.x,crowd.y,TOUCH]);
   throw new Error(e.message+'\nCROWD DIAGNOSTICS '+JSON.stringify({crowd,cam0,...d}));
  }
  expect(await selectedId(page),'the chooser must not pre-select anything').toBeNull();
  const shown=await chooser(page).locator('button').evaluateAll(b=>b.map(x=>x.dataset.touchId));
  expect(shown.slice().sort(),'chooser lists exactly the plausible candidates').toEqual(crowd.options.slice().sort());
  await expectChooserSafe(page);
  expect(await cameraKey(page)).toBe(cam0);
  // choosing works with one more tap and dismisses the chooser
  const pick=shown[shown.length-1];
  await page.waitForTimeout(420);
  await chooser(page).locator('button[data-touch-id="'+pick+'"]').tap();
  await expect.poll(()=>selectedId(page)).toBe(pick);
  await expect(page.locator('#touch-pick')).toBeHidden();
  // Escape / tapping elsewhere dismisses an open chooser without choosing
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
  await tapXY(page,crowd.x,crowd.y);await expect(chooser(page)).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#touch-pick')).toBeHidden();
  expect(await selectedId(page)).toBeNull();

  // ---- 4. Empty-space taps stay empty (and still clear an existing selection) -----------------------------
  const empty=S.none[0];expect(empty,'an empty-space point exists').toBeTruthy();
  await tapXY(page,empty.x,empty.y);await frames(page);
  expect(await selectedId(page)).toBeNull();await expect(page.locator('#touch-pick')).toBeHidden();
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveSelect('medial-collateral-ligament'));
  expect(await selectedId(page)).toBe('medial-collateral-ligament');
  await tapXY(page,empty.x,empty.y);
  await expect.poll(()=>selectedId(page),'an empty tap still clears the selection, as before').toBeNull();

  // ---- 5. Hidden / filtered / isolated-out structures are never selected ----------------------------------
  const target=off;
  const hiddenIds=KNEE;
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveFilter({bones:false,muscles:false,ligaments:false,tendons:false,fibrocartilage:false},[],false));
  await frames(page);
  const leak=await page.evaluate(([x,y,ids,touch])=>{
   const A=window.__BODY_ATLAS__,c=document.getElementById('atlas-canvas').getBoundingClientRect(),bad=[];
   for(let dy=-30;dy<=30;dy+=3)for(let dx=-30;dx<=30;dx+=3){
    const p=A.touchPlanAt(x+dx-c.x,y+dy-c.y,touch);if(!p)continue;
    if((p.kind==='exact'||p.kind==='select')&&ids.includes(p.id))bad.push([dx,dy,p.kind,p.id]);
    if(p.kind==='choose'&&p.options.some(o=>ids.includes(o.id)))bad.push([dx,dy,'choose']);
    if((p.candidates||[]).some(k=>ids.includes(k.id)))bad.push([dx,dy,'candidate']);
   }
   return bad;
  },[target.x,target.y,hiddenIds,TOUCH]);
  expect(leak,'hidden connective structures must not appear as exact, select, choose or candidate').toEqual([]);
  await tapXY(page,target.x,target.y);await frames(page);
  expect(hiddenIds.includes(await selectedId(page)),'tapping where a hidden structure was never selects it').toBe(false);
  // isolation: only one structure is selectable
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveFilter({bones:true,muscles:true,ligaments:true,tendons:true,fibrocartilage:true},['lateral-meniscus'],false));
  await frames(page);
  const iso=await page.evaluate(([x,y,touch])=>{
   const A=window.__BODY_ATLAS__,c=document.getElementById('atlas-canvas').getBoundingClientRect(),seen=new Set();
   for(let dy=-34;dy<=34;dy+=2)for(let dx=-34;dx<=34;dx+=2){const p=A.touchPlanAt(x+dx-c.x,y+dy-c.y,touch);if(!p)continue;
    if(p.id&&p.kind!=='choose')seen.add(p.id);(p.options||[]).forEach(o=>seen.add(o.id));(p.candidates||[]).forEach(k=>seen.add(k.id));}
   return [...seen].filter(i=>i!=='lateral-meniscus');
  },[target.x,target.y,TOUCH]);
  expect(iso.filter(i=>KNEE.includes(i)),'isolating one structure removes every other connective structure from picking').toEqual([]);

  expect(errors).toEqual([]);
 });
}

/* ---- 7. Correct selection after camera movement, zoom and rotation -------------------------------------- */
for(const [w,h] of [[390,844],[844,390],[1440,900]]){
 test('touch selection stays correct after rotate and zoom '+w+'x'+h,async({page},info)=>{
  test.setTimeout(300000);
  test.skip(!projectViewports(info).some(v=>v[0]===w&&v[1]===h),'viewport belongs to another project');
  const touch=!!info.project.use.hasTouch;
  const errors=await enter(page,w,h);
  const box=await page.locator('#atlas-canvas').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
  const c0=await cameraKey(page);
  // rotate (drag) then zoom (wheel): real pointer gestures through the same orbit handler
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+34,cy+12,{steps:6});await page.mouse.move(cx+58,cy+18,{steps:6});await page.mouse.up();await frames(page);
  try{for(let i=0;i<6;i++)await page.mouse.wheel(0,-120);}
  catch(e){
   // Playwright cannot send a wheel in mobile WebKit ("Mouse wheel is not supported in mobile WebKit"). Fall back to a
   // WheelEvent dispatched on the canvas: it drives the SAME wheel handler, but is synthetic and is labelled as such.
   if(!/not supported in mobile WebKit/.test(e.message))throw e;
   info.annotations.push({type:'zoom-input',description:'synthetic WheelEvent on #atlas-canvas (mobile WebKit has no mouse.wheel)'});
   await page.evaluate(([x,y])=>{const cv=document.getElementById('atlas-canvas');for(let i=0;i<6;i++)cv.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:x,clientY:y,bubbles:true,cancelable:true}));},[cx,cy]);
  }
  await frames(page);
  expect(await cameraKey(page),'camera really moved').not.toBe(c0);
  expect(await selectedId(page),'camera gestures select nothing').toBeNull();
  const cam1=await cameraKey(page);
  const S=await survey(page);
  expect(Object.keys(S.exact).length,'visible exact targets after camera move').toBeGreaterThan(0);
  const t=Object.values(S.exact)[0];
  await tap(page,info,t);
  await expect.poll(()=>selectedId(page),'precise tap after rotate+zoom').toBe(t.id);
  await page.evaluate(()=>window.__BODY_ATLAS__.connectiveClear());
  if(touch){
   const off=S.select[0];
   if(off){
    await tapXY(page,off.x,off.y);
    await expect.poll(()=>selectedId(page),'offset tap after rotate+zoom').toBe(off.id);
   }else{
    const crowd=S.choose[0];expect(crowd,'after the camera move there is an offset or crowded tap point').toBeTruthy();
    await tapXY(page,crowd.x,crowd.y);await expect(chooser(page)).toBeVisible();
    expect(await selectedId(page)).toBeNull();
   }
  }else{
   const near=S.select[0];
   if(near){await mouseClick(page,near);await frames(page);expect(await selectedId(page),'mouse never snaps, even after camera moves').toBeNull();}
  }
  expect(await cameraKey(page),'taps do not move the camera').toBe(cam1);
  expect(errors).toEqual([]);
 });
}

/* ---- performance: tolerance search cost per decision (read-only) ------------------------------------------ */
test('touch decision latency is small',async({page},info)=>{
 test.skip(info.project.name==='desktop-chromium','touch decision latency');
 const errors=await enter(page,390,844);
 const t=await page.evaluate(([touch])=>{
  const A=window.__BODY_ATLAS__,c=document.getElementById('atlas-canvas').getBoundingClientRect();
  const pts=[];for(let i=0;i<40;i++)pts.push([c.width*(.35+.3*((i*37)%100)/100),c.height*(.3+.4*((i*61)%100)/100)]);
  const time=fn=>{const t0=performance.now();for(const [x,y] of pts)fn(x,y);return (performance.now()-t0)/pts.length;};
  return {exactMs:time((x,y)=>A.hitTestAt(x,y)),planMs:time((x,y)=>A.touchPlanAt(x,y,touch))};
 },[TOUCH]);
 info.annotations.push({type:'latency-ms',description:JSON.stringify({exact:+t.exactMs.toFixed(2),touchPlan:+t.planMs.toFixed(2)})});
 // One tap pays this once. 50 ms is far under a perceptible-lag budget but loose enough for shared CI runners.
 expect(t.planMs,'touch decision (miss path) latency per tap').toBeLessThan(50);
 expect(errors).toEqual([]);
});
