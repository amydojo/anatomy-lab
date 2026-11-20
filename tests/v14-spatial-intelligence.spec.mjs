import {test,expect} from '@playwright/test';
// V14.3 cross-browser mobile interaction acceptance. No simulated medical assertions.
for(const [width,height] of [[390,844],[874,402]]){
 test('V14.3 progressive Dive and recenter '+width+'x'+height,async({page},info)=>{
  test.skip(info.project.name==='desktop-chromium','Phone viewport behavior');
  test.setTimeout(120000);
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/atlas/?studio=connective');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().renderer.connectiveMeshes)).toBe(8);
  await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
  await page.locator('#connective-left [data-cs-select="medial-meniscus"]').click();
  await page.locator('#connective-peek [data-cs-action="locate"]').click();
  const state=()=>page.evaluate(()=>{
   const a=window.__BODY_ATLAS__,s=a.getState(),nav=a.connectiveNavState('medial-meniscus');
   return {camera:s.camera,projection:nav.selectedProjection,step:nav.progressiveDiveStep,
    selected:window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId,viewport:s.viewport};
  });
  const located=await state();
  await page.locator('#connective-peek [data-cs-action="focus"]').click();
  const first=await state();
  expect(first.step).toBe(1);
  expect(first.camera.zoom).toBeGreaterThan(located.camera.zoom);
  expect(first.camera.zoom).toBeLessThanOrEqual(located.camera.zoom*1.851);
  expect(first.selected).toBe('medial-meniscus');
  // The first Dive must be a bounded incremental approach, not the full 12x jump.
  await page.locator('#connective-peek [data-cs-action="focus"]').click();
  const second=await state();
  expect(second.step).toBe(2);
  expect(second.camera.zoom).toBeGreaterThan(first.camera.zoom);
  expect(second.camera.zoom).toBeLessThanOrEqual(first.camera.zoom*1.721);
  expect(second.camera.zoom).toBeLessThanOrEqual(14);
  await page.locator('#connective-spatial-hud [data-cs-action="back-view"]').click();
  const back=await state();
  expect(back.camera.zoom).toBeCloseTo(first.camera.zoom,5);
  expect(back.selected).toBe('medial-meniscus');
  await page.locator('#connective-peek [data-cs-action="locate"]').click();
  const near=await state();
  const ok=await page.evaluate(()=>window.__BODY_ATLAS__.connectiveNavAction('recenter','medial-meniscus'));
  expect(ok).toBe(true);
  const recovered=await state();
  expect(recovered.camera.zoom).toBeCloseTo(near.camera.zoom,5);
  expect(recovered.camera.yaw).toBeCloseTo(near.camera.yaw,5);
  expect(recovered.camera.pitch).toBeCloseTo(near.camera.pitch,5);
  expect(recovered.camera.target).toEqual({
   x:expect.any(Number),y:expect.any(Number),z:expect.any(Number)
  });
  const rect=recovered.projection;
  expect(rect.x).toBeGreaterThan(0);
  expect(rect.x).toBeLessThan(width);
  expect(rect.y).toBeGreaterThan(0);
  expect(rect.y).toBeLessThan(height);
  await expect(page.locator('#connective-spatial-hud .cs-orbit-angle')).toContainText('VIEW');
  await expect(page.locator('#connective-spatial-hud .cs-orbit-angle')).not.toContainText('°');
  await expect(page.locator('#connective-spatial-hud .cs-overview-locator')).toBeVisible();
 });
}
