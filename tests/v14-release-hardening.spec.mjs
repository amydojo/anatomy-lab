import {test,expect} from '@playwright/test';
// Independent release-hardening acceptance. Safe against the hosted preview via BASE_URL.
const knee=[
 'anterior-cruciate-ligament','posterior-cruciate-ligament',
 'medial-collateral-ligament','lateral-collateral-ligament',
 'medial-meniscus','lateral-meniscus','patellar-ligament','quadriceps-tendon'
];
async function enter(page){
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/atlas/?studio=connective',{waitUntil:'domcontentloaded'});
 if(page.viewportSize().width<=850)await expect(page.locator('#connective-peek')).toBeVisible();else await expect(page.locator('#connective-left')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_INTELLIGENCE__?.()?.getStructuresByRegion('knee')?.length)).toBe(8);
 return errors;
}
for(const width of [320,375,390,430]){
 test('V14 hardening hosted '+width+'px: all eight selections, safe camera, no overflow',async({page},info)=>{
  test.skip(info.project.name!=='chromium-mobile','Full 3-browser CI exercises separate browser variants');
  await page.setViewportSize({width,height:844});
  const errors=await enter(page);
  const layout=await page.evaluate(()=>{
   const rect=selector=>{const r=document.querySelector(selector)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null};
   return {documentWidth:document.documentElement.scrollWidth,innerWidth,stage:rect('#atlas-stage'),sheet:rect('#connective-peek'),dock:rect('#connective-mobile-nav')};
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(width+2);
  expect(layout.stage.height).toBeGreaterThan(230);
  expect(layout.stage.bottom).toBeLessThanOrEqual(layout.sheet.y+2);
  expect(layout.dock.bottom).toBeLessThanOrEqual(846);
  await page.screenshot({path:'artifacts/v14-hardening-'+width+'-camera.png',fullPage:true});
  await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
  for(const id of knee){
   await page.locator('#connective-left [data-cs-select="'+id+'"]').click();
   await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe(id);
   await expect(page.locator('#connective-peek')).toBeVisible();
   await page.locator('#connective-mobile-nav [data-cs-panel="inspector"]').click();
   await expect(page.locator('#connective-right')).toBeVisible();
   await expect(page.locator('#connective-right .connective-status')).toContainText('ILLUSTRATIVE');
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
   await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
  }
  await page.screenshot({path:'artifacts/v14-hardening-'+width+'-structures.png',fullPage:true});
  expect(errors).toEqual([]);
 });
}
test('V14 hardening: focus, isolate, ghost, compare, hide/show, reset and V13 exit',async({page},info)=>{
 test.skip(info.project.name!=='chromium-mobile','Covered on mobile Chromium; normal V13 regression covers desktop');
 await page.setViewportSize({width:390,height:844});
 const errors=await enter(page);
 await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
 const initialZoom=await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom);
 await page.locator('#connective-left [data-cs-select="anterior-cruciate-ligament"]').click();
 await page.locator('#connective-mobile-nav [data-cs-panel="inspector"]').click();
 // Selection preserves the camera; magnification requires an explicit Focus.
 expect(await page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeCloseTo(initialZoom,3);
 await page.locator('#connective-right [data-cs-action="focus"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeGreaterThan(initialZoom*1.3);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 await page.locator('#connective-right [data-cs-action="isolate"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().mode)).toBe('isolate');
 await page.locator('#connective-right [data-cs-action="ghost"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().ghost)).toBe(false);
 await page.locator('#connective-right [data-cs-action="compare"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().comparison.length)).toBe(2);
 await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
 await page.locator('#connective-left [data-cs-tissue="ligaments"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().visibility.ligaments)).toBe(false);
 await page.locator('#connective-left [data-cs-tissue="ligaments"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().visibility.ligaments)).toBe(true);
 await page.locator('#connective-mobile-nav [data-cs-action="reset"]').click();
 const state=await page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot());
 expect(state.selectedId).toBe(null);expect(state.mode).toBe('all');expect(state.ghost).toBe(true);expect(state.comparison).toEqual([]);
 await page.locator('#connective-mobile-nav [data-cs-action="close"]').click();
 await expect(page.locator('#connective-left')).toBeHidden();
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(false);
 await page.locator('#connective-entry').click();
 await expect(page.locator('#connective-peek')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 expect(errors).toEqual([]);
});
test('V14 hardening: non-knee unregistered surfaces fail closed',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium');
 await page.setViewportSize({width:1440,height:900});
 const errors=await enter(page);
 for(const region of ['shoulder','hip','ankle','wrist','spine']){
  await page.locator('#connective-region').selectOption(region);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().region)).toBe(region);
  const records=await page.evaluate(()=>{
   const state=window.__BODY_CONNECTIVE_STUDIO__.snapshot();
   return state.records.filter(x=>x.region===state.region).map(x=>({id:x.id,status:x.geometryStatus,selectable:x.selectable}));
  });
  expect(records.length).toBeGreaterThan(0);
  expect(records.every(x=>x.status==='unavailable'&&!x.selectable)).toBe(true);
  await page.locator('#connective-left [data-cs-select]').first().click();
  await expect(page.locator('#connective-right [data-cs-action="focus"]')).toBeDisabled();
  await expect(page.locator('#connective-right')).toContainText('NO REGISTERED 3D GEOMETRY');
 }
 await page.locator('#connective-region').selectOption('knee');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveMeshes)).toBe(8);
 await page.screenshot({path:'artifacts/v14-hardening-desktop-knee.png',fullPage:true});
 expect(errors).toEqual([]);
});
