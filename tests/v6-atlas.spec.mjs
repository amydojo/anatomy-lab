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
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:10000}).toBe('detail');
 await expect(page.locator('#portal')).toBeVisible();
}
test('Atlas loads original pinned skeleton and a functioning semantic region list',async({page})=>{
 const errors=await atlas(page);
 const st=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(st.pins).toBe(4);
 expect(st.renderer.partCount===78 || st.renderer.webgl===false).toBe(true);
 await expect(page.locator('#hotspots button[data-region="hip"]')).toBeVisible();
 await expect(page.locator('#region-list button[data-region="hip"]')).toHaveCount(1);
 await expect(page.locator('#atlas-sidebar a[href="/atlas/sources/"]')).toHaveCount(1);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v6-atlas-overview.png'});
});
test('Mapped bones accept direct taps while empty canvas does not invent a region',async({page})=>{
 const errors=await atlas(page);
 const hit=await page.evaluate(()=>{
  const empty=window.__BODY_ATLAS__.pickAt(3,3);
  const pin=document.querySelector('#hotspots [data-region="hip"]');
  const x=parseFloat(pin.style.left)+Math.min(22,document.querySelector('#atlas-canvas').clientWidth*.055);
  const y=parseFloat(pin.style.top)-12;
  const selected=window.__BODY_ATLAS__.pickAt(x,y);
  return {empty,selected};
 });
 expect(hit.empty).toBe(null);
 expect(hit.selected).toBe('hip');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('detail');
 expect(new URL(page.url()).pathname).toBe('/atlas/');
 expect(errors).toEqual([]);
});
test('Region selection travels through source geometry before revealing its preloaded detail',async({page})=>{
 const errors=await atlas(page);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('hip'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.frameSpan),{timeout:4000}).toBeLessThan(10.8);
 const during=await page.evaluate(()=>({
  view:window.__BODY_ATLAS__.getState().view,
  phase:document.querySelector('#portal').dataset.phase,
  path:location.pathname,
  opacity:getComputedStyle(document.querySelector('#portal')).opacity,
  frameUrl:document.querySelector('#region-frame').getAttribute('src')
 }));
 expect(during.view).toBe('focused');
 expect(during.phase).toBe('preload');
 expect(Number(during.opacity)).toBe(0);
 expect(during.path).toBe('/atlas/');
 expect(during.frameUrl).toBe('/hip/spatial/');
 await expect.poll(()=>windowGetView(page),{timeout:15000}).toBe('detail');
 await expect(page.locator('#portal')).toHaveAttribute('data-phase','active');
 const arrived=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(arrived.camera.frameSpan).toBeLessThan(3);
 expect(arrived.frameReady).toBe(true);
 expect(new URL(page.url()).pathname).toBe('/atlas/');
 expect(errors).toEqual([]);
});
async function windowGetView(page){return page.evaluate(()=>window.__BODY_ATLAS__.getState().view);}
test('Back to Body reverses spatial travel without changing the document',async({page})=>{
 const errors=await atlas(page);await choose(page,'knee');
 await page.locator('#back-body').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.frameSpan),{timeout:3500}).toBeGreaterThan(10);
 await expect(page.locator('#portal')).toBeHidden();
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.view).toBe('overview');
 expect(state.region).toBe(null);
 // The same camera object must still be wired to canvas gestures after reset.
 const yawDelta=await page.evaluate(()=>{
  const canvas=document.querySelector('#atlas-canvas');
  const before=window.__BODY_ATLAS__.getState().camera.yaw;
  const evt=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:41,clientX:x,clientY:220}));
  evt('pointerdown',90);evt('pointermove',200);evt('pointerup',200);
  return window.__BODY_ATLAS__.getState().camera.yaw-before;
 });
 expect(yawDelta).toBeGreaterThan(.5);
 expect(new URL(page.url()).pathname).toBe('/atlas/');
 expect(errors).toEqual([]);
});
test('Hip laboratory opens inside shared Atlas, universal peeling controls work',async({page})=>{
 const errors=await atlas(page);await choose(page,'hip');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#region-frame').contentWindow.__HIP_SPATIAL__?.getState().sourceLoaded||false),{timeout:16000}).toBe(true);
 await page.locator('#layer-slider').evaluate(e=>{e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#region-frame').contentWindow.__HIP_SPATIAL__?.getState().depth)).toBe(2);
 await page.locator('#back-body').click();
 await expect(page.locator('#portal')).toBeHidden();
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).region).toBe(null);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v6-atlas-return.png'});
});
test('Nerve Follow and Knee reference change have explicit discontinuity dialog',async({page})=>{
 const errors=await atlas(page);await choose(page,'nerve');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#region-frame').contentWindow.__HIP_SPATIAL__?.getState().followActive||false),{timeout:20000}).toBe(true);
 await expect(page.locator('#top-continue-knee')).toBeVisible();
 await page.locator('#top-continue-knee').click();
 await expect(page.locator('#seam')).toBeVisible();
 await expect(page.locator('#seam')).toContainText('not reconstructed continuously');
 await page.locator('#seam-continue').click();
 await expect(page.locator('#seam')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().region)).toBe('knee');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#region-frame').contentWindow.__BODY_SPATIAL__?.getState().sourcedBoneCount||0),{timeout:16000}).toBeGreaterThanOrEqual(4);
 await expect(page.locator('#stage-caveat')).toContainText('not reconstructed continuously');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v6-atlas-knee-transition.png'});
});
test('Evidence Lens distinguishes source, composite and anatomy review',async({page})=>{
 const errors=await atlas(page);await choose(page,'nerve');
 await page.locator('#evidence-toggle').click();
 await expect(page.locator('#evidence-sheet')).toBeVisible();
 await expect(page.locator('#evidence-records')).toContainText('Registered nerve');
 await expect(page.locator('#evidence-records')).toContainText('FEMUR surface residuals');
 await page.locator('[data-evidence="evidence"]').click();
 await expect(page.locator('[data-evidence="evidence"]')).toHaveAttribute('aria-pressed','true');
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState())).evidenceMode).toBe('evidence');
 await page.locator('#evidence-close').click();
 await expect(page.locator('#evidence-sheet')).toBeHidden();
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v6-atlas-evidence.png'});
});
for(const width of [320,375,390,430]){
 test('mobile viewport '+width+' preserves controls, canvas and route navigation',async({page})=>{
  await page.setViewportSize({width,height:780});
  const errors=await atlas(page);
  const a=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,h:document.querySelector('.stage').getBoundingClientRect().height}));
  expect(a.scroll).toBeLessThanOrEqual(a.w+2);expect(a.h).toBeGreaterThan(350);
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('#sidebar-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#region-list button[data-region="hip"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:10000}).toBe('detail');
  await page.locator('#back-body').click();
  await expect(page.locator('#portal')).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/v6-mobile-'+width+'.png'});
 });
}
test('short mobile layout keeps evidence and navigation reachable',async({page})=>{
 await page.setViewportSize({width:390,height:650});const errs=await atlas(page);
 await page.locator('#evidence-toggle').click();await expect(page.locator('#evidence-sheet')).toBeVisible();
 await expect(page.locator('#evidence-records')).toContainText('BodyParts3D 4.0');
 await page.locator('#evidence-close').click();await page.locator('#sidebar-toggle').click();
 await page.locator('#region-list button[data-region="knee"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view)).toBe('detail');
 expect(errs).toEqual([]);await page.screenshot({path:'artifacts/v6-mobile-short.png'});
});
test('reduced motion has immediate accessible region entry',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const errs=await atlas(page);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('hip'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view)).toBe('detail');
 expect(errs).toEqual([]);
});
test('missing source mesh fails closed with semantic fallback, not invented sourced geometry',async({page})=>{
 await page.route('**/atlas/assets/body-skeleton.json',r=>r.fulfill({status:404,body:'not found'}));
 await page.goto('/atlas/');
 await expect(page.locator('#canvas-fallback')).toBeVisible();
 await expect(page.locator('#scene-status')).toContainText('SEMANTIC FALLBACK');
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('knee'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().region)).toBe('knee');
});
test('dedicated source notes are readable and link to independent cited manifests',async({page})=>{
 await page.goto('/atlas/sources/');
 await expect(page.locator('body')).toContainText('BodyParts3D 4.0');
 await expect(page.locator('body')).toContainText('Z-Anatomy');
 await expect(page.locator('body')).toContainText('not a medical-grade');
 await expect(page.locator('a[href="/atlas/assets/provenance.json"]')).toHaveCount(1);
});

test('source-integrity gate rejects a well-formed but hash-altered skeletal asset',async({page})=>{
 await page.route('**/atlas/assets/body-skeleton.json',async route=>{
  const upstream=await route.fetch();
  const original=await upstream.text();
  expect(original).toContain('BodyParts3D 4.0');
  await route.fulfill({response:upstream,body:original.replace('BodyParts3D 4.0','BodyParts3D 4.0 TAMPERED')});
 });
 await page.goto('/atlas/');
 await expect(page.locator('#canvas-fallback')).toBeVisible();
 await expect(page.locator('#canvas-fallback')).toContainText('SHA-256 mismatch');
 expect(await page.evaluate(()=>window.__BODY_ATLAS__.getState().assetsLoaded)).toBe(false);
 await expect(page.locator('#region-list button[data-region="hip"]')).toBeVisible();
});
test('mobile collapsed inspector does not expose clipped scroll content',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await atlas(page);
 await expect(page.locator('#sidebar-toggle')).toBeVisible();
 await expect(page.locator('#sidebar-body')).toBeHidden();
 await page.locator('#sidebar-toggle').click();
 await expect(page.locator('#sidebar-body')).toBeVisible();
 await page.locator('#sidebar-toggle').click();
 await expect(page.locator('#sidebar-body')).toBeHidden();
});
test('Evidence Lens and source-boundary dialogs trap keyboard focus and restore it',async({page})=>{
 await atlas(page);
 await page.locator('#evidence-toggle').focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#evidence-sheet')).toBeVisible();
 await page.locator('#evidence-close').focus();
 await page.keyboard.press('Shift+Tab');
 const before=await page.evaluate(()=>document.activeElement.closest('#evidence-sheet')!==null);
 expect(before).toBe(true);
 await page.keyboard.press('Escape');
 await expect(page.locator('#evidence-sheet')).toBeHidden();
 await expect(page.locator('#evidence-toggle')).toBeFocused();
 await choose(page,'nerve');
 await page.locator('#top-continue-knee').focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#seam')).toBeVisible();
 await expect(page.locator('#seam-cancel')).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(page.locator('#seam-continue')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#seam')).toBeHidden();
 await expect(page.locator('#top-continue-knee')).toBeFocused();
});
