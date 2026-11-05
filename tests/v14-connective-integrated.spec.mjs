import {test,expect} from '@playwright/test';
for(const width of [320,375,390,430]){
 test('V14 integrated real knee responsive width '+width,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/atlas/?studio=connective');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveMeshes)).toBe(8);
  await page.locator('[data-cs-select="anterior-cruciate-ligament"]').click();
  await expect(page.locator('#connective-right')).toContainText('ILLUSTRATIVE');
  const data=await page.evaluate(()=>{
    const canvas=document.querySelector('#atlas-canvas').getBoundingClientRect(),
      sheet=document.querySelector('#connective-right').getBoundingClientRect(),
      buttons=[...document.querySelectorAll('#connective-mobile-nav button')].map(n=>n.getBoundingClientRect());
    return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,canvas:canvas.height,
     sheet:sheet.height,targets:buttons.map(b=>({w:b.width,h:b.height}))};
  });
  expect(data.scroll).toBeLessThanOrEqual(data.viewport+2);
  expect(data.canvas).toBeGreaterThan(data.sheet);
  expect(data.targets.every(b=>b.w>=44&&b.h>=44)).toBe(true);
  await page.locator('[data-cs-action="reset"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe(null);
  expect(errors).toEqual([]);
 });
}
