import {test,expect} from '@playwright/test';
async function atlas(page){
 const errs=[];page.on('pageerror',e=>errs.push(String(e)));
 await page.goto('/atlas/');
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false),{timeout:18000}).toBe(true);
 return errs;
}
async function choose(page,region){
 await page.evaluate(r=>window.__BODY_ATLAS__.choose(r),region);
 if(region==='nerve'||region==='shoulder'){
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:12000}).toBe('focused');
  await expect(page.locator('#portal')).toBeHidden();
  await expect(page.locator('#top-enter-region')).toBeVisible();
  await page.locator('#top-enter-region').click();
 }
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:20000}).toBe('detail');
}
test('Pinned 78-part sourced skeleton loads in one WebGL canvas',async({page})=>{
 const errors=await atlas(page);
 const st=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(st.renderer.partCount).toBe(78);
 expect(st.renderer.webgl).toBe(true);
 expect(st.pins).toBe(4);
 await expect(page.locator('#hotspots [data-region="hip"]')).toBeVisible();
 await expect(page.locator('a[href="/atlas/sources/"]')).toHaveCount(2);
 expect(errors).toEqual([]);
});
for(const region of ['hip','knee']){
 test(region+' enters and exits without changing page, renderer or camera DOM',async({page})=>{
  await page.setViewportSize({width:390,height:780});
  const errors=await atlas(page);
  const before=await page.locator('#atlas-canvas').boundingBox();
  await choose(page,region);
  const during=await page.evaluate(()=>({
    mode:document.querySelector('#atlas-app').dataset.mode,
    path:location.pathname,
    canvasCount:document.querySelectorAll('#atlas-canvas').length,
    frameSrc:document.querySelector('#region-frame').getAttribute('src'),
    portalHidden:document.querySelector('#portal').hidden,
    state:window.__BODY_ATLAS__.getState()
  }));
  expect(during.mode).toBe('immersive');
  expect(during.path).toBe('/atlas/');
  expect(during.canvasCount).toBe(1);
  expect(during.frameSrc).toBe(null);
  expect(during.portalHidden).toBe(true);
  expect(during.state.unified.region).toBe(region);
  expect(during.state.unified.reveal).toBe(1);
  expect(during.state.renderer.detailRegions).toContain(region);
  expect(during.state.renderer.detailMeshes).toBeGreaterThanOrEqual(region==='hip'?11:4);
  const closeBox=await page.locator('#atlas-canvas').boundingBox();
  expect(Math.abs(closeBox.width-before.width)).toBeLessThan(2);
  expect(Math.abs(closeBox.height-before.height)).toBeLessThan(2);
  await page.locator('#back-body').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:5000}).toBe(null);
  const after=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
  expect(after.view).toBe('overview');expect(after.region).toBe(null);
  expect(after.camera.frameSpan).toBeCloseTo(10.8,2);
  expect(new URL(page.url()).pathname).toBe('/atlas/');
  expect(errors).toEqual([]);
 });
}
test('Hip layer peel runs on the same canvas and never creates an iframe',async({page})=>{
 const errors=await atlas(page);await choose(page,'hip');
 await page.locator('#layer-slider').evaluate(e=>{e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(2);
 await expect(page.locator('#layer-output')).toContainText('Deep rotators');
 expect(await page.locator('#region-frame').getAttribute('src')).toBe(null);
 await page.locator('#reset-view').click();
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).layer).toBe(0);
 expect(errors).toEqual([]);
});
test('One camera path uses bounded frame changes and does not snap on detail entry',async({page})=>{
 const errors=await atlas(page);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('hip'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:10000}).toBe('hip');
 const sampled=await page.evaluate(async()=>{
  const frames=[];
  const start=performance.now();
  while(performance.now()-start<1500){
   const s=window.__BODY_ATLAS__.getState();
   frames.push({t:performance.now(),z:s.camera.frameSpan,yaw:s.camera.yaw,view:s.view});
   await new Promise(r=>setTimeout(r,35));
  }
  return frames;
 });
 expect(sampled.some(x=>x.view==='detail')).toBe(true);
 expect(Math.min(...sampled.map(x=>x.z))).toBeLessThan(2);
 for(let i=1;i<sampled.length;i++){
  // Software WebGL can stall the sampling loop on mobile CI. Bound actual
  // camera movement by elapsed time, not by a fixed amount per stale sample.
  const dt=sampled[i].t-sampled[i-1].t;
  expect(Math.abs(sampled[i].z-sampled[i-1].z)).toBeLessThan(.03*dt+.35);
  expect(Math.abs(sampled[i].yaw-sampled[i-1].yaw)).toBeLessThan(.012*dt+.25);
 }
 expect(errors).toEqual([]);
});
test('Focused knee can isolate sourced femur, tibia/fibula and patella, not pretend to show ligaments',async({page})=>{
 const errors=await atlas(page);await choose(page,'knee');
 await expect(page.locator('#mode-peel')).toContainText('Isolate');
 await expect(page.locator('#mode-trace')).toBeDisabled();
 for(const [value,label] of [['1','Femur focus'],['2','Tibia / fibula'],['3','Patella focus']]){
  await page.locator('#layer-slider').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await expect(page.locator('#layer-output')).toContainText(label);
  expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).layer).toBe(Number(value));
 }
 await page.locator('#reset-view').click();
 await expect(page.locator('#layer-output')).toHaveText('Complete joint');
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).layer).toBe(0);
 expect(errors).toEqual([]);
});
test('Reset view restores the selected anatomical region, not just the slider',async({page})=>{
 const errors=await atlas(page);await choose(page,'hip');
 await page.evaluate(()=>{
  const canvas=document.querySelector('#atlas-canvas');
  const evt=(name,x)=>canvas.dispatchEvent(new PointerEvent(name,{bubbles:true,pointerId:77,clientX:x,clientY:220}));
  evt('pointerdown',95);evt('pointermove',230);evt('pointerup',230);
 });
 const yawBefore=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.yaw);
 await page.locator('#reset-view').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.yaw),{timeout:3000}).toBeGreaterThan(yawBefore+.25);
 await expect(page.locator('#layer-output')).toHaveText('Surface');
 expect(errors).toEqual([]);
});
test('Direct mapped-bone tap moves toward the anatomy; empty canvas does not invent selection',async({page})=>{
 const errors=await atlas(page);
 const tap=await page.evaluate(()=>{
  const atlas=window.__BODY_ATLAS__,canvas=document.querySelector('#atlas-canvas');
  const pin=document.querySelector('#hotspots [data-region="hip"]');
  const x=parseFloat(pin.style.left)+Math.min(22,canvas.clientWidth*.055);
  const y=parseFloat(pin.style.top)-12;
  return {empty:atlas.pickAt(3,3),selected:atlas.pickAt(x,y)};
 });
 expect(tap.empty).toBe(null);expect(tap.selected).toBe('hip');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:10000}).toBe('hip');
 expect(errors).toEqual([]);
});
test('Hip to Knee preserves required nerve source-discontinuity disclosure',async({page})=>{
 const errors=await atlas(page);await choose(page,'hip');
 await page.locator('#top-continue-knee').click();
 await expect(page.locator('#seam')).toBeVisible();
 await expect(page.locator('#seam')).toContainText('not reconstructed continuously');
 await page.locator('#seam-continue').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:15000}).toBe('knee');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('detail');
 expect(await page.locator('#region-frame').getAttribute('src')).toBe(null);
 expect(errors).toEqual([]);
});
test('Different-source nerve and illustrative shoulder require explicit separate lab entry',async({page})=>{
 const errors=await atlas(page);
 for(const region of ['nerve','shoulder']){
  await page.evaluate(r=>window.__BODY_ATLAS__.choose(r),region);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.frameSpan),{timeout:6000}).toBeLessThan(3);
  expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).view).toBe('focused');
  await expect(page.locator('#top-enter-region')).toBeVisible();
  await expect(page.locator('#portal')).toBeHidden();
  await page.locator('#back-body').click();
  await expect(page.locator('#portal')).toBeHidden();
 }
 expect(errors).toEqual([]);
});
test('Nerve source viewer retains explicit provenance and a gap before Knee',async({page})=>{
 const errors=await atlas(page);await choose(page,'nerve');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#region-frame').contentWindow.__HIP_SPATIAL__?.getState().followActive||false),{timeout:20000}).toBe(true);
 await page.locator('#top-continue-knee').click();
 await expect(page.locator('#seam')).toContainText('not reconstructed continuously');
 await page.locator('#seam-cancel').click();
 await expect(page.locator('#seam')).toBeHidden();
 expect(errors).toEqual([]);
});
test('Evidence inspector separates sourced geometry and unreviewed claims',async({page})=>{
 const errors=await atlas(page);await choose(page,'hip');
 await page.locator('#evidence-toggle').click();
 await expect(page.locator('#evidence-records')).toContainText('Hip source geometry');
 await page.locator('[data-evidence="evidence"]').click();
 await expect(page.locator('[data-evidence="evidence"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#evidence-close').click();
 await expect(page.locator('#evidence-sheet')).toBeHidden();
 expect(errors).toEqual([]);
});
for(const width of [320,375,390,430]){
 test('mobile '+width+' keeps canvas, overlay controls and Body return usable',async({page})=>{
  await page.setViewportSize({width,height:780});
  const errors=await atlas(page);
  const info=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(info.scroll).toBeLessThanOrEqual(info.width+2);
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('#sidebar-body')).toBeVisible();
  await page.locator('#region-list [data-region="hip"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:20000}).toBe('detail');
  await expect(page.locator('#atlas-canvas')).toBeVisible();
  await expect(page.locator('#controlbar')).toBeVisible();
  await page.locator('#back-body').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:5000}).toBe(null);
  expect(errors).toEqual([]);
 });
}
test('Reduced motion enters without animation and still uses original source canvas',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=await atlas(page);await choose(page,'knee');
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).unified.region).toBe('knee');
 expect(await page.locator('#region-frame').getAttribute('src')).toBe(null);
 expect(errors).toEqual([]);
});
test('Unavailable regional source fails closed and leaves Atlas usable',async({page})=>{
 await page.route('**/hip/spatial/assets/hip-source.json',r=>r.fulfill({status:404,body:'missing'}));
 const errors=await atlas(page);await page.evaluate(()=>window.__BODY_ATLAS__.choose('hip'));
 await expect(page.locator('#scene-status')).toContainText('UNAVAILABLE',{timeout:10000});
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).unified.region).toBe(null);
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 expect(errors).toEqual([]);
});
test('Original skeleton SHA mismatch remains rejected',async({page})=>{
 await page.route('**/atlas/assets/body-skeleton.json',async route=>{
  const original=await route.fetch();const body=(await original.text()).replace('BodyParts3D 4.0','BodyParts3D 4.0 TAMPERED');
  await route.fulfill({response:original,body});
 });
 await page.goto('/atlas/');
 await expect(page.locator('#canvas-fallback')).toBeVisible();
 await expect(page.locator('#canvas-fallback')).toContainText('SHA-256 mismatch');
});
test('Documented science boundary and accessibility dialog are reachable',async({page})=>{
 await page.goto('/atlas/sources/');
 await expect(page.locator('body')).toContainText('BodyParts3D 4.0');
 await expect(page.locator('body')).toContainText('Z-Anatomy');
 await expect(page.locator('body')).toContainText('not a medical-grade');
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded),{timeout:18000}).toBe(true);
 await page.locator('#evidence-toggle').click();
 await expect(page.locator('#evidence-sheet')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#evidence-sheet')).toBeHidden();
});
