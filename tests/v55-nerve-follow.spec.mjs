import {test,expect} from '@playwright/test';
async function ready(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/hip/spatial/');
 await expect.poll(()=>page.evaluate(()=>window.__HIP_SPATIAL__?.getState().nerveSourceLoaded),{timeout:18000}).toBe(true);
 return errors;
}
async function startFollow(page){
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('[data-part="sciatic"]').click();
 await page.locator('#nerve-follow').click();
 await expect(page.locator('#follow-stage')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__HIP_SPATIAL__.getState().followActive)).toBe(true);
}
test('Follow scrubs source-derived sciatic arc length and camera position',async({page})=>{
 const errors=await ready(page);await startFollow(page);
 const zero=await page.evaluate(()=>window.__HIP_SPATIAL__.getState().cameraTarget);
 await page.locator('#follow-progress').evaluate(el=>{el.value='63';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#follow-percent')).toHaveText('63%');
 await expect(page.locator('#follow-path-note')).toContainText('Surface-sampled');
 const p=await page.evaluate(()=>window.__HIP_SPATIAL__.getState());
 expect(p.followProgress).toBeCloseTo(.63,3);
 expect(p.followBranch).toBe('sciatic');
 expect(Math.hypot(p.cameraTarget.x-zero.x,p.cameraTarget.y-zero.y,p.cameraTarget.z-zero.z)).toBeGreaterThan(.2);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v55-follow-sciatic.png'});
});
test('Branch navigation marks an unverified junction, never continuous source',async({page})=>{
 const errors=await ready(page);await startFollow(page);
 await page.locator('#follow-branch').selectOption('tibial');
 await expect(page.locator('#follow-path-note')).toContainText('UNVERIFIED branch junction gap');
 await expect(page.locator('#follow-distance')).toHaveText('≈0 mm');
 let s=await page.evaluate(()=>window.__HIP_SPATIAL__.getState());
 expect(s.followBranch).toBe('tibial');
 expect(s.junctionGapScene).toBeGreaterThan(.1);
 await page.locator('#follow-branch').selectOption('commonFibular');
 await expect(page.locator('#follow-path-note')).toContainText('no source connecting surface');
 await page.locator('#follow-progress').evaluate(el=>{el.value='84';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#follow-percent')).toHaveText('84%');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v55-branch-junction.png'});
});
test('Atlas source view hides unrelated donor hip and restores composite',async({page})=>{
 const errors=await ready(page);
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('[data-part="sciatic"]').click();
 await page.locator('[data-nerve-frame="atlas"]').click();
 expect((await page.evaluate(()=>window.__HIP_SPATIAL__.getState())).displaySourceFrame).toBe('atlas');
 await expect(page.locator('#nerve-frame-note')).toContainText('different reference');
 await page.locator('[data-nerve-frame="composite"]').click();
 expect((await page.evaluate(()=>window.__HIP_SPATIAL__.getState())).displaySourceFrame).toBe('composite');
 await expect(page.locator('#nerve-frame-note')).toContainText('Mixed-source composite');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v55-composite-evidence.png'});
});
test('Hip↔Knee shared femur correspondence shown separately from nerve validation',async({page})=>{
 const errors=await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.__HIP_SPATIAL__.getState().kneeBridgeVerified),{timeout:15000}).toBe(true);
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('[data-part="sciatic"]').click();
 await page.locator('#nerve-evidence-toggle').click();
 await expect(page.locator('#nerve-evidence')).toContainText('HIP ↔ KNEE FRAME VERIFIED');
 await expect(page.locator('#nerve-evidence')).toContainText('does not validate the nerve');
 await expect(page.locator('#nerve-evidence a[href="/knee/spatial/"]')).toContainText('nerve not reconstructed there');
 expect(errors).toEqual([]);
});
for(const width of [320,390,430]){
 test('mobile Safari-safe viewport follow controls remain visible at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:700});
  const errors=await ready(page);await startFollow(page);
  await page.locator('#follow-progress').evaluate(el=>{el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const metrics=await page.evaluate(()=>{
   const panel=document.querySelector('#follow-stage').getBoundingClientRect();
   const canvas=document.querySelector('#hip-canvas').getBoundingClientRect();
   return {pageWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
    stageWidth:canvas.width,stageHeight:canvas.height,panelLeft:panel.left,panelRight:panel.right,panelBottom:panel.bottom};
  });
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewport+2);
  expect(metrics.panelLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.panelRight).toBeLessThanOrEqual(width+1);
  expect(metrics.stageHeight).toBeGreaterThan(130);
  expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/v55-mobile-'+width+'.png'});
 });
}
test('reduced-motion setting avoids animated camera transitions',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=await ready(page);await startFollow(page);
 await page.locator('#follow-branch').selectOption('tibial');
 const s=await page.evaluate(()=>window.__HIP_SPATIAL__.getState());
 expect(s.followBranch).toBe('tibial');
 expect(s.cameraTarget).not.toBe(null);
 await page.locator('#follow-exit').click();
 await expect(page.locator('#follow-stage')).toBeHidden();
 expect(errors).toEqual([]);
});

test('on mobile the followed nerve marker sits above the viewport Follow card',async({page})=>{
 await page.setViewportSize({width:390,height:700});
 const errors=await ready(page);await startFollow(page);
 for(const progress of [8,50,92]){
  await page.locator('#follow-progress').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},progress);
  const placement=await page.evaluate(()=>{
   const s=window.__HIP_SPATIAL__.getState();
   const stage=document.querySelector('#hip-canvas').getBoundingClientRect();
   const panel=document.querySelector('#follow-stage').getBoundingClientRect();
   const point=window.BodySpatialCore.project(s.cameraTarget,{
    yaw:s.yaw,pitch:s.pitch,zoom:s.zoom,frameSpan:3.35,
    width:s.viewport.w,height:s.viewport.h,anchorY:s.cameraAnchorY});
   return {markerY:stage.top+point.y,panelTop:panel.top,anchor:s.cameraAnchorY};
  });
  expect(placement.anchor).toBeLessThan(.4);
  expect(placement.markerY+18).toBeLessThan(placement.panelTop);
 }
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v55-mobile-unoccluded-follow.png'});
});
