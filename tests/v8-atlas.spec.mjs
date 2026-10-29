import {test,expect} from '@playwright/test';
async function ready(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded===true),{timeout:35000}).toBe(true);
 return errors;
}
test('V8 overview renders 137 canonical bones and 149 muscles with three working global systems',async({page})=>{
 const errors=await ready(page);
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.webgl).toBe(true);
 expect(state.renderer.partCount).toBe(78);
 expect(state.renderer.overviewBones).toBe(59);
 expect(state.renderer.overviewMuscles).toBe(149);
 expect(state.renderer.registry.bones).toBe(137);
 expect(state.renderer.registry.muscles).toBe(149);
 expect(state.renderer.registry.duplicateIds).toBe(0);
 expect(state.renderer.overviewSystem).toBe('combined');
 await expect(page.locator('#overview-coverage')).toContainText('137 BONES');
 await expect(page.locator('#overview-coverage')).toContainText('149 MUSCLES');
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
test('V8 source coverage and ten destinations remain accessible in compact mobile tools',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await ready(page);
 await expect(page.locator('.region-dock')).toBeHidden();
 await expect(page.locator('#overview-system-switch')).toBeHidden();
 await page.locator('[data-mobile-tool="layers"]').click();
 await page.locator('[data-mobile-tissue="muscles"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('muscles');
 await page.locator('#mobile-region').click();
 await expect(page.locator('[data-mobile-region]')).toHaveCount(10);
 const before=await page.evaluate(()=>({
  width:document.querySelector('#atlas-canvas').clientWidth,
  canvasCount:document.querySelectorAll('#atlas-canvas').length,
  overflow:document.documentElement.scrollWidth,
  screen:document.documentElement.clientWidth
 }));
 await page.locator('[data-mobile-region="wrist"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('wrist');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 await page.locator('#mobile-home').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('overview');
 const after=await page.evaluate(()=>({
  width:document.querySelector('#atlas-canvas').clientWidth,
  canvasCount:document.querySelectorAll('#atlas-canvas').length,
  system:window.__BODY_ATLAS__.getState().renderer.overviewSystem
 }));
 expect(before.width).toBe(after.width);
 expect(before.canvasCount).toBe(1);
 expect(after.canvasCount).toBe(1);
 expect(before.overflow).toBeLessThanOrEqual(before.screen+2);
 expect(after.system).toBe('muscles');
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
