import {test,expect} from '@playwright/test';
/* V14 deep inspection acceptance: an emulated two-contact PointerEvent pinch exercises the
 * real orbit handler in mobile browsers. This is NOT a substitute for a physical iPhone pinch. */
for(const [w,h] of [[390,844],[844,390]]){
 test('V14 pinch can dive beyond the old whole-knee cap and safely return '+w+'x'+h,async({page},info)=>{
  test.skip(info.project.name==='desktop-chromium','Mobile zoom path');
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:w,height:h});
  await page.goto('/atlas/?studio=connective',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
  const baseline=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom);
  expect(baseline).toBeGreaterThan(1.5);
  const result=await page.evaluate(()=>{
   const canvas=document.getElementById('atlas-canvas'),r=canvas.getBoundingClientRect();
   const cx=r.left+r.width/2,cy=r.top+r.height/2;
   const send=(type,id,x)=>canvas.dispatchEvent(new PointerEvent(type,{
    bubbles:true,pointerId:id,pointerType:'touch',isPrimary:id===11,clientX:x,clientY:cy,
    width:12,height:12,buttons:type==='pointerup'?0:1
   }));
   send('pointerdown',11,cx-20);send('pointerdown',12,cx+20);
   send('pointermove',11,cx-110);send('pointermove',12,cx+110);
   send('pointermove',11,cx-170);send('pointermove',12,cx+170);
   const v=window.__BODY_ATLAS__.getState().camera.zoom;
   send('pointerup',11,cx-170);send('pointerup',12,cx+170);
   return v;
  });
  expect(result,'pinch must exceed both the prior 1.95x limit and 4x focus ceiling').toBeGreaterThan(7);
  expect(result,'guarded max remains finite').toBeLessThanOrEqual(14);
  await expect(page.locator('#connective-peek')).toBeVisible();
  await page.locator('#connective-mobile-nav [data-cs-action="reset"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeCloseTo(1.7,1);
  await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
  await page.locator('#connective-left [data-cs-select="anterior-cruciate-ligament"]').click();
  await expect(page.locator('#connective-peek')).toContainText('Anterior cruciate ligament');
  const beforeFocus=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom);
  await page.locator('#connective-peek [data-cs-action="focus"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeGreaterThan(beforeFocus*1.3);
  const focused=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom);
  expect(focused).toBeLessThanOrEqual(14);
  await page.locator('#connective-mobile-nav [data-cs-action="close"]').click();
  await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeLessThanOrEqual(2.1);
  expect(errors).toEqual([]);
 });
}