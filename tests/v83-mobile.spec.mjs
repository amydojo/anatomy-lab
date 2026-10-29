import {test,expect} from '@playwright/test';
async function open(page,{width=390,height=780}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded),{timeout:35000}).toBe(true);
 return errors;
}
test('Mobile workbench keeps anatomy full-width and exposes four exclusive tools',async({page})=>{
 const errors=await open(page);
 await expect(page.locator('.region-dock')).toBeHidden();
 await expect(page.locator('#overview-system-switch')).toBeHidden();
 await expect(page.locator('#atlas-sidebar')).toBeHidden();
 await expect(page.locator('#controlbar')).toBeHidden();
 await expect(page.locator('[data-mobile-tool]')).toHaveCount(4);
 await expect(page.locator('#mobile-panel')).toBeHidden();
 const metrics=await page.evaluate(()=>{
  const c=document.querySelector('#atlas-canvas').getBoundingClientRect();
  const w=document.querySelector('#mobile-workbench .mobile-tool-dock').getBoundingClientRect();
  return {canvasWidth:c.width,viewportWidth:innerWidth,canvasHeight:c.height,
   chromeHeight:w.height,stageHeight:document.querySelector('#atlas-stage').clientHeight,
   scroll:document.documentElement.scrollWidth,canvasCount:document.querySelectorAll('#atlas-canvas').length};
 });
 expect(metrics.canvasWidth).toBe(metrics.viewportWidth);
 expect(metrics.canvasHeight).toBe(metrics.stageHeight);
 expect(metrics.chromeHeight).toBeLessThan(100);
 expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewportWidth+2);
 expect(metrics.canvasCount).toBe(1);
 await page.locator('[data-mobile-tool="layers"]').click();
 await expect(page.locator('#mobile-layers')).toBeVisible();
 await expect(page.locator('#mobile-overview-tissues')).toBeVisible();
 await page.locator('[data-mobile-tissue="muscles"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('muscles');
 await page.locator('[data-mobile-tool="layers"]').click();
 await expect(page.locator('#mobile-panel')).toBeHidden();
 expect(errors).toEqual([]);
});
test('Region sheet has 10 large destinations and enters source-backed shoulder without extra page',async({page})=>{
 const errors=await open(page);
 await page.locator('#mobile-region').click();
 await expect(page.locator('#mobile-region-sheet')).toBeVisible();
 const options=page.locator('[data-mobile-region]');
 await expect(options).toHaveCount(10);
 expect((await options.first().boundingBox()).height).toBeGreaterThanOrEqual(60);
 await page.keyboard.press('Escape');
 await expect(page.locator('#mobile-region-sheet')).toBeHidden();
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="shoulder"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:35000}).toBe('shoulder');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 await expect(page.locator('#mobile-region-name')).toHaveText('SHOULDER');
 await expect(page.locator('#mobile-home')).toBeVisible();
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 await expect(page.locator('#region-frame')).not.toHaveAttribute('src',/./);
 expect(errors).toEqual([]);
});
test('Mobile motion and layers call existing joint and tissue engines; Neutral restores both axes',async({page})=>{
 const errors=await open(page);
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="elbow"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 await page.locator('[data-mobile-tool="move"]').click();
 await expect(page.locator('#mobile-move')).toBeVisible();
 await expect(page.locator('#mobile-secondary-row')).toBeVisible();
 await page.locator('#mobile-motion-slider').evaluate(el=>{el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#mobile-secondary-slider').evaluate(el=>{el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(60);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(24);
 await expect(page.locator('#mobile-motion-value')).toHaveText('60°');
 await page.locator('#mobile-neutral').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
 await page.locator('[data-mobile-tool="layers"]').click();
 await page.locator('[data-mobile-layer-mode="trace"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(4);
 await expect(page.locator('#mobile-layer-output')).toContainText('muscles');
 await page.locator('[data-mobile-layer-mode="explore"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(0);
 expect(errors).toEqual([]);
});
test('Mobile shoulder to elbow travels directly, retaining a single canvas and previous source scene',async({page})=>{
 const errors=await open(page);
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="shoulder"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 const before=await page.locator('#atlas-canvas').boundingBox();
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="elbow"]').click();
 // No full-body intermediate state, and no old 850ms return-to-body camera.
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:35000}).toBe('elbow');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 const after=await page.locator('#atlas-canvas').boundingBox();
 expect(after).toEqual(before);
 expect(await page.locator('#atlas-canvas').count()).toBe(1);
 expect(page.url()).toContain('region=elbow');
 const s=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(s.unified.transitionFrom).toBe(null);
 expect(s.unified.motion).toBe(0);
 expect(errors).toEqual([]);
});
test('Pinch moves the camera target, zoom stays focal, and recenter restores region camera',async({page})=>{
 const errors=await open(page);
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="wrist"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 const start=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera);
 await page.evaluate(()=>{
  const canvas=document.querySelector('#atlas-canvas');const r=canvas.getBoundingClientRect();
  const emit=(type,id,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,
   pointerType:'touch',isPrimary:id===1,clientX:r.left+x,clientY:r.top+y,bubbles:true,cancelable:true}));
  emit('pointerdown',1,145,210);emit('pointerdown',2,245,210);
  emit('pointermove',1,125,234);emit('pointermove',2,275,240);
  emit('pointerup',2,275,240);emit('pointerup',1,125,234);
 });
 const moved=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera);
 expect(moved.zoom).toBeGreaterThan(start.zoom);
 expect(Math.hypot(moved.target.x-start.target.x,moved.target.y-start.target.y,moved.target.z-start.target.z)).toBeGreaterThan(.001);
 await page.locator('#mobile-frame').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeCloseTo(start.zoom,2);
 expect(errors).toEqual([]);
});
test('Short iPhone screens never horizontally scroll and the active tray stays in viewport',async({page})=>{
 const errors=await open(page,{width:360,height:620});
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="knee"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 await page.locator('[data-mobile-tool="move"]').click();
 const bounds=await page.evaluate(()=>{
  const panel=document.querySelector('#mobile-panel').getBoundingClientRect();
  const dock=document.querySelector('.mobile-tool-dock').getBoundingClientRect();
  return {panelTop:panel.top,panelBottom:panel.bottom,dockTop:dock.top,scrollWidth:document.documentElement.scrollWidth,innerWidth};
 });
 expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.innerWidth+2);
 expect(bounds.panelTop).toBeGreaterThan(35);
 expect(bounds.panelBottom).toBeLessThanOrEqual(bounds.dockTop+2);
 expect(errors).toEqual([]);
});
