import {test,expect} from '@playwright/test';
/* V14 mobile layout contract.
 * These assertions measure REAL layout rectangles and REAL rendered anatomy pixels in the area that
 * controls do not cover. They deliberately avoid "canvas is non-blank" checks: the anatomy footprint is the
 * pixel difference between the studio view with all Studio tissue layers shown and the identical view with
 * every layer hidden, captured with the control chrome made invisible (layout unchanged). The footprint is
 * then compared with the real rectangles of every control. Interaction uses real taps, never force.
 * Synthetic/emulated viewports only: this is NOT real-device (iPhone Safari) validation. */
const MOBILE=[[390,844],[375,667],[320,568],[844,390],[667,375]];
const DESKTOP=[[1440,900]];
const KNEE=['anterior-cruciate-ligament','posterior-cruciate-ligament','medial-collateral-ligament','lateral-collateral-ligament','medial-meniscus','lateral-meniscus','patellar-ligament','quadriceps-tendon'];
const CHROME='.topbar,#connective-guides,#connective-mobile-nav,#connective-left,#connective-right,.stage-meta';
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120)))));
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
const rects=page=>page.evaluate(sel=>{
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom};};
 const shown=e=>{if(!e||e.hidden)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>0;};
 const controls={};
 for(const s of sel.split(','))for(const [i,e] of [...document.querySelectorAll(s)].entries())if(shown(e))controls[s+(i?'#'+i:'')]=box(e);
 return {stage:box(document.getElementById('atlas-stage')),controls,vw:innerWidth,vh:innerHeight};
},CHROME);
const overlap=(a,b)=>Math.max(0,Math.min(a.r,b.r)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.y,b.y));
/* Anatomy footprint in CSS pixels, independent of whatever controls cover it. */
async function footprint(page){
 const hide=await page.addStyleTag({content:CHROME+'{visibility:hidden!important}'});
 await frames(page);
 const shown=await page.screenshot({scale:'css',animations:'disabled'});
 await page.evaluate(()=>window.__BODY_ATLAS__.connectiveFilter({bones:false,muscles:false,ligaments:false,tendons:false,fibrocartilage:false},[],false));
 await frames(page);
 const hidden=await page.screenshot({scale:'css',animations:'disabled'});
 await page.evaluate(()=>{const s=window.__BODY_CONNECTIVE_STUDIO__.snapshot();window.__BODY_ATLAS__.connectiveFilter(s.visibility,[],false);});
 await hide.evaluate(n=>n.remove());await frames(page);
 return page.evaluate(async([a,b])=>{
  const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src='data:image/png;base64,'+src;});
  const px=async src=>{const i=await load(src),c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height);};
  const A=await px(a),B=await px(b);
  let x0=1e9,y0=1e9,x1=-1,y1=-1,count=0;
  for(let y=0;y<A.height;y++)for(let x=0;x<A.width;x++){
   const k=(y*A.width+x)*4,d=Math.abs(A.data[k]-B.data[k])+Math.abs(A.data[k+1]-B.data[k+1])+Math.abs(A.data[k+2]-B.data[k+2]);
   if(d>36){count++;if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;}
  }
  return {count,x:x0,y:y0,r:x1+1,b:y1+1,w:x1+1-x0,h:y1+1-y0};
 },[shown.toString('base64'),hidden.toString('base64')]);
}
const projectViewports=info=>info.project.name==='desktop-chromium'?DESKTOP:MOBILE;
for(const [w,h] of [...MOBILE,...DESKTOP]){
 test('layout contract '+w+'x'+h+': stage never overlaps controls and wastes no space',async({page},info)=>{
  test.skip(!projectViewports(info).some(v=>v[0]===w&&v[1]===h),'viewport belongs to another project');
  const errors=await enter(page,w,h);
  const L=await rects(page);
  const mobileLayout=w<=850;
  for(const [name,c] of Object.entries(L.controls)){
   if(name==='.topbar'||!mobileLayout&&name!=='.topbar')continue;
   expect(overlap(L.stage,c),name+' covers '+Math.round(overlap(L.stage,c))+'px² of the model stage').toBeLessThan(4);
  }
  expect(L.stage.x).toBeGreaterThanOrEqual(-1);expect(L.stage.r).toBeLessThanOrEqual(L.vw+1);expect(L.stage.b).toBeLessThanOrEqual(L.vh+1);
  const area=L.stage.w*L.stage.h;
  expect(area/(L.vw*L.vh),'usable model area share of viewport').toBeGreaterThan(mobileLayout?.22:.3);
  if(mobileLayout){
   const sheet=L.controls['#connective-left']||L.controls['#connective-right'];
   expect(sheet,'a structure/inspector sheet is visible').toBeTruthy();
   const landscape=sheet.h>L.vh*.6;
   // No dead band between stage and sheet: the contract has a single source of truth.
   if(landscape)expect(sheet.x-L.stage.r).toBeLessThanOrEqual(2);
   else expect(sheet.y-L.stage.b).toBeLessThanOrEqual(2);
   expect(L.stage.h).toBeGreaterThan(landscape?190:170);
  }
  expect(errors).toEqual([]);
 });
 test('anatomy footprint '+w+'x'+h+': visible, centred and unobstructed',async({page},info)=>{
  test.skip(!projectViewports(info).some(v=>v[0]===w&&v[1]===h),'viewport belongs to another project');
  const errors=await enter(page,w,h);
  const L=await rects(page),fp=await footprint(page);
  expect(fp.count,'anatomy pixels that disappear when Studio layers are hidden').toBeGreaterThan(80);
  expect(fp.w).toBeGreaterThan(14);expect(fp.h).toBeGreaterThan(8);
  const f={x:fp.x,y:fp.y,r:fp.r,b:fp.b};
  expect(f.x).toBeGreaterThanOrEqual(L.stage.x-1);expect(f.r).toBeLessThanOrEqual(L.stage.r+1);
  expect(f.y).toBeGreaterThanOrEqual(L.stage.y-1);expect(f.b).toBeLessThanOrEqual(L.stage.b+1);
  // Desktop keeps the pre-existing floating perspective strip over the top of the stage (documented
  // limitation, not changed by this repair); on mobile every control must be clear of the anatomy.
  for(const [name,c] of Object.entries(L.controls))
   if(w<=850||name!=='#connective-guides')expect(overlap(f,c),'anatomy footprint hidden under '+name).toBe(0);
  const cy=(f.y+f.b)/2,sy=L.stage.y+L.stage.h/2;
  expect(Math.abs(cy-sy),'anatomy is centred in the usable stage').toBeLessThan(L.stage.h*.3);
  expect(errors).toEqual([]);
 });
 test('real tap '+w+'x'+h+': visible anatomy is selectable without force',async({page},info)=>{
  test.setTimeout(180000);
  test.skip(!projectViewports(info).some(v=>v[0]===w&&v[1]===h),'viewport belongs to another project');
  const errors=await enter(page,w,h);
  const fp=await footprint(page);
  // Read-only search: hitTestAt() is the same raycast pickAt() uses but never selects, renders, writes
  // history or touches the camera, so thousands of probes leave application state untouched.
  const target=await page.evaluate(([fp,ids])=>{
   const A=window.__BODY_ATLAS__,c=document.getElementById('atlas-canvas').getBoundingClientRect();
   const hit=(x,y)=>A.hitTestAt(x-c.x,y-c.y);
   const x0=Math.max(Math.floor(fp.x),Math.ceil(c.x)),x1=Math.min(Math.ceil(fp.r),Math.floor(c.right));
   const y0=Math.max(Math.floor(fp.y),Math.ceil(c.y)),y1=Math.min(Math.ceil(fp.b),Math.floor(c.bottom));
   const mx=c.x+c.width/2,my=c.y+c.height/2,cands=[];
   for(let y=y0;y<=y1;y+=2)for(let x=x0;x<=x1;x+=2){const id=hit(x,y);if(ids.includes(id))cands.push({id,x,y});}
   // Robustness of a candidate = the largest radius R (px) for which all eight neighbours at distance R
   // pick the same structure. Taps use integer CSS pixels because touch coordinates are integer-snapped.
   const radius=({id,x,y})=>{
    let best=-1;
    for(const R of [1,2,3,4,5,6]){
     const ok=[[-R,-R],[0,-R],[R,-R],[-R,0],[R,0],[-R,R],[0,R],[R,R]].every(([ox,oy])=>hit(x+ox,y+oy)===id);
     if(!ok)break;best=R;
    }
    return best;
   };
   let best=null;
   for(const cand of cands){
    const r=radius(cand),d=Math.hypot(cand.x-mx,cand.y-my);
    if(!best||r>best.r||(r===best.r&&d<best.d))best={...cand,r,d};
   }
   const zones={};for(const k of cands)zones[k.id]=(zones[k.id]||0)+1;
   if(!best)return {none:true,candidates:cands.length,zones};
   const el=document.elementFromPoint(best.x,best.y);
   return {id:best.id,x:best.x,y:best.y,zoneRadius:best.r,top:el?.id||el?.tagName,candidates:cands.length,zones};
  },[fp,KNEE]);
  expect(target.none?JSON.stringify(target):'found','a connective structure can be hit at a visible position').toBe('found');
  expect(target.top,'the tap point is the model canvas, not a control').toBe('atlas-canvas');
  // A tap must land on a zone that survives +/-1 px of coordinate rounding.
  expect(target.zoneRadius,'hit zone must tolerate 1 px of touch-coordinate rounding: '+JSON.stringify(target)).toBeGreaterThanOrEqual(1);
  info.annotations.push({type:'tap-target',description:JSON.stringify(target)});
  // Nothing was selected by the probe, so no cleanup is needed and the coordinates cannot be stale.
  expect(await page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId),'nothing selected before the real tap').toBeNull();
  await page.evaluate(()=>{
   const log=window.__tapLog=[];const cv=document.getElementById('atlas-canvas');
   for(const t of ['pointerdown','pointerup','pointercancel','click','touchstart','touchend'])
    cv.addEventListener(t,e=>log.push({t,x:e.clientX??e.changedTouches?.[0]?.clientX,y:e.clientY??e.changedTouches?.[0]?.clientY,pt:e.pointerType,dp:e.defaultPrevented}),true);
   window.addEventListener('body:structure-selected',e=>log.push({t:'structure-selected',id:e.detail?.id}));
  });
  if(info.project.use.hasTouch)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
  try{
   await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe(target.id);
  }catch(e){
   // Enough in the CI log to tell "tap never reached the canvas" from "reached it but selected nothing".
   const d=await page.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y),vv=window.visualViewport,r=document.getElementById('atlas-canvas').getBoundingClientRect();
    return {events:window.__tapLog,topAtTap:el?.id||el?.tagName,hitNow:window.__BODY_ATLAS__.hitTestAt(x-r.x,y-r.y),
     camera:window.__BODY_ATLAS__.getState().camera,
     visualViewport:vv?{scale:vv.scale,offsetLeft:vv.offsetLeft,offsetTop:vv.offsetTop,w:vv.width,h:vv.height}:null};},[target.x,target.y]);
   throw new Error(e.message+'\nTAP DIAGNOSTICS '+JSON.stringify({target,...d}));
  }
  expect(errors).toEqual([]);
 });
}
test('Studio owns mobile camera framing while open and releases it on exit',async({page},info)=>{
 test.skip(info.project.name==='desktop-chromium','mobile framing');
 const errors=await enter(page,390,844);
 const anchor=()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.anchorY??.5);
 expect(await anchor()).toBeCloseTo(.5,2);
 // A competing mobile workbench sync must not move the Studio camera.
 await page.evaluate(()=>window.__BODY_ATLAS__.setMobileFrame(true));
 await frames(page);
 expect(await anchor()).toBeCloseTo(.5,2);
 await page.locator('#connective-entry').click();
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
 await page.evaluate(()=>window.__BODY_ATLAS__.setMobileFrame(true));
 expect(await anchor()).toBeCloseTo(.39,2);
 expect(errors).toEqual([]);
});
test('legacy connective controller is coherent after Studio exit and reentry',async({page},info)=>{
 test.skip(info.project.name==='desktop-chromium','mobile controller lifecycle');
 const errors=await enter(page,390,844);
 const legacy=()=>page.evaluate(()=>({pressed:document.getElementById('connective-toggle')?.getAttribute('aria-pressed'),
  panelHidden:document.getElementById('connective-workbench')?.hidden,enabled:window.__BODY_ATLAS__.getState().renderer.connectiveEnabled}));
 await page.locator('#connective-entry').click();                       // exit Studio
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
 await page.locator('#connective-toggle').click();                      // activate legacy workbench
 await expect.poll(async()=>(await legacy()).enabled).toBe(true);
 await page.locator('#connective-entry').click();                       // re-enter Studio with legacy active
 await expect(page.locator('#connective-left')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 await page.locator('#connective-left [data-cs-select="anterior-cruciate-ligament"]').click();
 await page.locator('#connective-entry').click();                       // exit again
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
 const after=await legacy();
 expect(after.enabled,'renderer state matches legacy UI').toBe(after.pressed==='true');
 expect(after.pressed).toBe('false');expect(after.panelHidden).toBe(true);
 await page.locator('#connective-toggle').click();                      // legacy still works after exit
 await expect.poll(async()=>(await legacy()).enabled).toBe(true);
 await expect(page.locator('#connective-workbench')).toBeVisible();
 expect(errors).toEqual([]);
});
