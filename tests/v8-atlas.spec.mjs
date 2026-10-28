import {test,expect} from '@playwright/test';
async function ready(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded===true),{timeout:35000}).toBe(true);
 return errors;
}
test('V8 overview renders 112 canonical bones and 73 muscles with three working global systems',async({page})=>{
 const errors=await ready(page);
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.webgl).toBe(true);
 expect(state.renderer.partCount).toBe(78);
 expect(state.renderer.overviewBones).toBe(34);
 expect(state.renderer.overviewMuscles).toBe(73);
 expect(state.renderer.registry.bones).toBe(112);
 expect(state.renderer.registry.muscles).toBe(73);
 expect(state.renderer.registry.duplicateIds).toBe(0);
 expect(state.renderer.overviewSystem).toBe('combined');
 await expect(page.locator('#overview-coverage')).toContainText('112 BONES');
 await expect(page.locator('#overview-coverage')).toContainText('73 MUSCLES');
 const before=await page.locator('#atlas-canvas').screenshot();
 await page.locator('[data-overview-system="bones"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('bones');
 const bones=await page.locator('#atlas-canvas').screenshot();
 expect(before.equals(bones)).toBe(false);
 await page.locator('[data-overview-system="muscles"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('muscles');
 const muscles=await page.locator('#atlas-canvas').screenshot();
 expect(bones.equals(muscles)).toBe(false);
 await page.locator('[data-overview-system="combined"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('combined');
 await expect(page.locator('[data-overview-system="combined"]')).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});
test('V8 persistent mobile anatomy modes and ten places do not cover or resize specimen',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await ready(page);
 await expect(page.locator('.region-dock-grid [data-region]')).toHaveCount(10);
 await expect(page.locator('#overview-system-switch')).toBeVisible();
 const layout=await page.evaluate(()=>{
  const nav=document.querySelector('#overview-system-switch').getBoundingClientRect();
  const stage=document.querySelector('#atlas-stage').getBoundingClientRect();
  return {bottom:nav.bottom,top:stage.top,canvasWidth:document.querySelector('#atlas-canvas').clientWidth,
    width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
    canvasCount:document.querySelectorAll('#atlas-canvas').length};
 });
 expect(layout.bottom).toBeLessThanOrEqual(layout.top+2);
 expect(layout.scroll).toBeLessThanOrEqual(layout.width+2);
 expect(layout.canvasCount).toBe(1);
 await page.locator('[data-overview-system="muscles"]').click();
 await page.locator('.region-dock-grid [data-region="wrist"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('wrist');
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 await page.locator('#back-body').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('overview');
 const after=await page.evaluate(()=>({width:document.querySelector('#atlas-canvas').clientWidth,
  mode:window.__BODY_ATLAS__.getState().renderer.overviewSystem}));
 expect(after.width).toBe(layout.canvasWidth);
 expect(after.mode).toBe('muscles');
 expect(errors).toEqual([]);
});
test('V8 fails closed on corrupted overview tissue while preserving original skeletal navigation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/atlas/assets/v8-overview-detail.json',async route=>{
  const response=await route.fetch();
  const body=(await response.text()).replace('body-live/overview-v8-v1','tampered/overview-v8-v1');
  await route.fulfill({response,body});
 });
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded),{timeout:20000}).toBe(true);
 await expect(page.locator('#overview-coverage')).toContainText('UNAVAILABLE',{timeout:25000});
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.partCount).toBe(78);
 expect(state.renderer.overviewBones).toBe(0);
 expect(state.renderer.overviewMuscles).toBe(0);
 expect(state.renderer.webgl).toBe(true);
 await expect(page.locator('#region-list [data-region="neck"]')).toBeAttached();
 expect(errors).toEqual([]);
});
