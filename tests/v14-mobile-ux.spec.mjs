import {test,expect} from '@playwright/test';
// Real mobile-flow acceptance (emulated mobile WebKit + Chromium; physical iPhone remains a separate gate).
for(const [width,height] of [[390,844],[320,568],[844,390]]){
 test('V14 anatomy-first flow '+width+'x'+height,async({page},info)=>{
  test.skip(info.project.name==='desktop-chromium','Mobile-only layout');
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/atlas/?studio=connective',{waitUntil:'domcontentloaded'});
  const app=page.locator('#atlas-app'),peek=page.locator('#connective-peek'),stage=page.locator('#atlas-stage');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
  await expect(peek).toBeVisible();
  await expect(app).toHaveAttribute('data-connective-sheet','peek');
  await expect(page.locator('#connective-left')).toBeHidden();
  await expect(page.locator('#connective-right')).toBeHidden();
  await expect(page.locator('#connective-guides')).toBeHidden();
  await expect(page.locator('#cs-mobile-location')).toHaveText('KNEE / CONNECTIVE');
  const initial=await stage.boundingBox(),summary=await peek.boundingBox();
  expect(initial?.height).toBeGreaterThan(175);
  expect(initial.y+initial.height).toBeLessThanOrEqual(summary.y+2);
  expect(initial.width*initial.height/(width*height)).toBeGreaterThan(.26);
  await page.screenshot({path:'artifacts/v14-ux-'+width+'x'+height+'-'+info.project.name+'-peek.png'});
  await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
  await expect(app).toHaveAttribute('data-connective-sheet','open');
  await expect(page.locator('#connective-left')).toBeVisible();
  await expect(page.locator('#connective-right')).toBeHidden();
  const fields=await page.evaluate(()=>({search:document.querySelector('#connective-search').getBoundingClientRect().top,
   first:document.querySelector('#connective-structure-list').getBoundingClientRect().top,
   font:parseFloat(getComputedStyle(document.querySelector('#connective-search')).fontSize),
   advanced:document.querySelector('.cs-advanced').open}));
  expect(fields.search).toBeLessThan(fields.first);
  expect(fields.font).toBeGreaterThanOrEqual(16); // No iOS Safari auto-zoom on focus.
  expect(fields.advanced).toBe(false);
  const cameraBefore=await page.evaluate(()=>{const c=window.__BODY_ATLAS__.getState().camera;return {yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,target:c.target};});
  await page.locator('#connective-left [data-cs-select="medial-meniscus"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe('medial-meniscus');
  await expect(app).toHaveAttribute('data-connective-sheet','peek');
  await expect(peek).toContainText('Medial meniscus');
  await expect(page.locator('#connective-right')).toBeHidden();
  const cameraAfter=await page.evaluate(()=>{const c=window.__BODY_ATLAS__.getState().camera;return {yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,target:c.target};});
  expect(cameraAfter,'choosing a name must not yank the camera').toEqual(cameraBefore);
  await page.locator('#connective-peek [data-cs-action="peek-details"]').click();
  await expect(page.locator('#connective-right')).toBeVisible();
  const hierarchy=await page.evaluate(()=>{
   const right=document.querySelector('#connective-right');
   return {primary:right.querySelector('.cs-inspector-primary').getBoundingClientRect().top,
     status:right.querySelector('.connective-status').getBoundingClientRect().top};
  });
  expect(hierarchy.primary).toBeLessThan(hierarchy.status);
  await page.screenshot({path:'artifacts/v14-ux-'+width+'x'+height+'-'+info.project.name+'-details.png'});
  await page.locator('#connective-mobile-nav [data-cs-panel="inspector"]').click();
  await expect(app).toHaveAttribute('data-connective-sheet','peek');
  const restored=await stage.boundingBox();
  expect(restored.height).toBeGreaterThan(initial.height-2);
  await page.locator('#connective-mobile-nav [data-cs-action="reset"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBeNull();
  await expect(peek).toContainText('Explore the anatomy');
  expect(errors).toEqual([]);
 });
}