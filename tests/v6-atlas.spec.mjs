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
 await expect(page.locator('#region-list button[data-region="hip"]')).toBeVisible();
 await expect(page.locator('#atlas-sidebar a[href="/atlas/sources/"]')).toHaveCount(1);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v6-atlas-overview.png'});
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
