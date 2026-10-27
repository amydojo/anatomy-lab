import {test,expect} from '@playwright/test';
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/hip/spatial/');
 await expect.poll(()=>page.evaluate(()=>window.__HIP_SPATIAL__?.getState()?.nerveSourceLoaded||false),{timeout:15000}).toBe(true);
 return errors;
}
async function expand(page){if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();}
test('sourced sciatic, tibial and common fibular surfaces render with ancestry',async({page})=>{
 const errors=await open(page);
 const state=await page.evaluate(()=>window.__HIP_SPATIAL__.getState());
 expect(state.nerveSegments).toBe(3);
 expect(state.sourceCount).toBe(11);
 await page.locator('#depth').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await expand(page);
 await page.locator('[data-part="sciatic"]').click();
 await expect(page.locator('#structure-type')).toContainText('REGISTERED COMPOSITE');
 await expect(page.locator('#nerve-info')).toContainText('SOURCE-DERIVED SURFACE');
 await page.locator('[data-nerve="tibial"]').click();
 await expect(page.locator('#inspector-title')).toContainText('Tibial nerve');
 await page.locator('[data-nerve="commonFibular"]').click();
 await expect(page.locator('#inspector-title')).toContainText('Common fibular nerve');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v54-nerve-branches.png'});
});
test('registration uncertainty and source licensing are visibly inspectable',async({page})=>{
 const errors=await open(page);await expand(page);
 await page.locator('[data-part="sciatic"]').click();
 await page.locator('#nerve-evidence-toggle').click();
 await expect(page.locator('#nerve-evidence')).toBeVisible();
 await expect(page.locator('#nerve-evidence')).toContainText('femur surface');
 await expect(page.locator('#nerve-evidence')).toContainText('NOT errors');
 await expect(page.locator('#nerve-evidence')).toContainText('Z-Anatomy');
 await expect(page.locator('#nerve-evidence')).toContainText('medical imaging');
 const fit=await page.evaluate(()=>window.__HIP_SPATIAL__.getState().compositeFitMedian);
 expect(fit).toBeGreaterThan(0);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v54-nerve-source-uncertainty.png'});
});
for(const width of [320,390,430]){
 test('sourced nerve Trace and source inspector remain accessible on '+width+'px phone',async({page})=>{
  await page.setViewportSize({width,height:780});
  const errors=await open(page);await expand(page);
  await page.locator('[data-part="sciatic"]').click();
  await expect(page.locator('#inspector-title')).toHaveText('Sciatic nerve');
  await page.locator('#nerve-evidence-toggle').click();
  await expect(page.locator('#nerve-evidence')).toBeVisible();
  await page.locator('[data-nerve="tibial"]').click();
  const dims=await page.evaluate(()=>({x:document.documentElement.scrollWidth,w:document.documentElement.clientWidth}));
  expect(dims.x).toBeLessThanOrEqual(dims.w+2);
  expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/v54-nerve-mobile-'+width+'.png'});
 });
}
test('source notes identify nerve as not MRI and preserve legacy Hip and Knee',async({page})=>{
 await open(page);
 await page.goto('/hip/spatial/sources/');
 await expect(page.locator('body')).toContainText('Z-Anatomy');
 await expect(page.locator('body')).toContainText('micro-CT');
 await expect(page.locator('body')).toContainText('does not contain a whole sciatic nerve');
 await page.goto('/knee/spatial/');
 await expect(page.locator('canvas').first()).toBeVisible();
 await page.goto('/hip/dissection/');
 await expect(page.locator('svg').first()).toBeVisible();
});
