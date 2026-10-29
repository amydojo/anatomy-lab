import {test,expect} from '@playwright/test';
test.beforeEach(async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','V8.4 specimen studio is desktop-only');
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.__studioErrors=errors;
 await page.setViewportSize({width:1440,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded),{timeout:30000}).toBe(true);
 await expect(page.locator('#desktop-studio')).toBeVisible();
});
async function enter(page,region){
 await page.locator('#studio-current').click();
 await page.locator('[data-studio-region="'+region+'"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:30000}).toBe(region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
}
test('Desktop anatomy occupies one full-width canvas with no persistent sidebar or footer',async({page})=>{
 const result=await page.evaluate(()=>{
  const c=document.querySelector('#atlas-canvas').getBoundingClientRect();
  const stage=document.querySelector('#atlas-stage').getBoundingClientRect();
  return {canvasWidth:c.width,canvasHeight:c.height,stageWidth:stage.width,stageHeight:stage.height,
   innerWidth,scrollWidth:document.documentElement.scrollWidth,canvasCount:document.querySelectorAll('#atlas-canvas').length};
 });
 expect(result.canvasWidth).toBe(result.innerWidth);
 expect(result.stageWidth).toBe(result.canvasWidth);
 expect(result.stageHeight).toBe(result.canvasHeight);
 expect(result.canvasCount).toBe(1);
 expect(result.scrollWidth).toBeLessThanOrEqual(result.innerWidth+2);
 for(const id of ['#atlas-sidebar','#controlbar','#overview-system-switch','.region-dock','#joint-motion','#structure-chip']){
  await expect(page.locator(id)).toBeHidden();
 }
 await expect(page.locator('.studio-rail [data-studio-tool]')).toHaveCount(4);
 await expect(page.locator('#studio-tray')).toBeHidden();
 expect(page.__studioErrors).toEqual([]);
});
test('Desktop anatomical command index supports keyboard, filtering, Escape, and all ten regions',async({page})=>{
 await page.keyboard.press('g');
 await expect(page.locator('#studio-region-sheet')).toBeVisible();
 await expect(page.locator('[data-studio-region]')).toHaveCount(10);
 await expect(page.locator('#studio-region-search')).toBeFocused();
 await page.locator('#studio-region-search').fill('cervical');
 await expect(page.locator('[data-studio-region="neck"]')).toBeVisible();
 await expect(page.locator('[data-studio-region="knee"]')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect(page.locator('#studio-region-sheet')).toBeHidden();
 await page.keyboard.press('l');
 await expect(page.locator('#studio-layers')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#studio-tray')).toBeHidden();
 expect(page.__studioErrors).toEqual([]);
});
test('Desktop tissue and regional-depth panels control the existing source engine',async({page})=>{
 await page.locator('[data-studio-tool="layers"]').click();
 await page.locator('[data-studio-tissue="bones"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('bones');
 await page.locator('[data-studio-tissue="muscles"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('muscles');
 await page.locator('[data-studio-tissue="combined"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('combined');
 await enter(page,'elbow');
 await page.locator('[data-studio-tool="layers"]').click();
 await expect(page.locator('#studio-region-layers')).toBeVisible();
 await page.locator('[data-studio-layer-mode="trace"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(4);
 await page.locator('[data-studio-layer-mode="explore"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(0);
 expect(page.__studioErrors).toEqual([]);
});
test('Desktop dual-axis motion mirrors rig state and Neutral without replacing source geometry',async({page})=>{
 await enter(page,'elbow');
 const stable=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 await page.keyboard.press('m');
 await expect(page.locator('#studio-motion')).toBeVisible();
 await expect(page.locator('#studio-secondary-wrap')).toBeVisible();
 await page.locator('#studio-motion-slider').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#studio-secondary-slider').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(65);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(25);
 await expect(page.locator('#studio-motion-degree')).toHaveText('65°');
 await page.locator('#studio-neutral').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
 const current=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(current.renderer.detailMeshes).toBe(stable.renderer.detailMeshes);
 expect(page.__studioErrors).toEqual([]);
});
test('Selecting real source anatomy opens inspector immediately and shifts camera without corrupting picking',async({page})=>{
 await enter(page,'knee');
 const selected=await page.evaluate(()=>{
  const atlas=window.__BODY_ATLAS__,canvas=document.querySelector('#atlas-canvas');
  for(let y=2;y<=9;y++)for(let x=2;x<=8;x++){
   const hit=atlas.pickAt(canvas.clientWidth*x/10,canvas.clientHeight*y/11);
   if(hit)return hit;
  }
  return null;
 });
 expect(selected).not.toBeNull();
 await expect(page.locator('#studio-inspector')).toBeVisible();
 await expect(page.locator('#studio-inspector-name')).not.toHaveText('Select a structure.');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.anchorX)).toBeLessThan(.47);
 const renderer=await page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer);
 expect(renderer.webgl).toBe(true);
 await page.locator('#studio-inspector-close').click();
 await expect(page.locator('#studio-inspector')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.anchorX)).toBeCloseTo(.5,3);
 expect(page.__studioErrors).toEqual([]);
});
test('Region travel stays in one source canvas without returning to full body',async({page})=>{
 await enter(page,'shoulder');
 const previous=await page.locator('#atlas-canvas').boundingBox();
 await page.locator('#studio-current').click();
 await page.locator('[data-studio-region="elbow"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:30000}).toBe('elbow');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
 const current=await page.locator('#atlas-canvas').boundingBox();
 expect(current).toEqual(previous);
 const snapshot=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(snapshot.unified.transitionFrom).toBeNull();
 expect(snapshot.unified.motion).toBe(0);
 expect(snapshot.unified.secondary).toBe(0);
 expect(await page.locator('#atlas-canvas').count()).toBe(1);
 expect(page.__studioErrors).toEqual([]);
});
test('Sciatic nerve remains an explicitly separate source with an entry action',async({page})=>{
 await page.locator('#studio-current').click();
 await page.locator('[data-studio-region="nerve"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('focused');
 await expect(page.locator('#studio-open-nerve')).toBeVisible();
 await expect(page.locator('[data-studio-tool="move"]')).toBeDisabled();
 await page.locator('#studio-body').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('overview');
 expect(page.__studioErrors).toEqual([]);
});
