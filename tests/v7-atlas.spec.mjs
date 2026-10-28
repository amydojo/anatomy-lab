import {test,expect} from '@playwright/test';
const regions={
 skull:{parts:14,animated:false},
 neck:{parts:8,animated:false},
 thorax:{parts:30,animated:false},
 elbow:{parts:3,animated:true},
 wrist:{parts:15,animated:true},
 ankle:{parts:14,animated:true}
};
async function open(page,region){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false),{timeout:25000}).toBe(true);
 await page.evaluate(r=>window.__BODY_ATLAS__.choose(r),region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 return errors;
}
for(const [region,expected] of Object.entries(regions)){
 test('V7 real '+region+' anatomy enters the original 3D canvas and isolates verified bones',async({page})=>{
  const errors=await open(page,region);
  const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
  expect(state.renderer.webgl).toBe(true);
  expect(state.unified.region).toBe(region);
  expect(state.renderer.expandedRegions).toContain(region);
  expect(state.renderer.expandedMeshes).toBeGreaterThanOrEqual(expected.parts);
  expect(await page.locator('#region-frame').getAttribute('src')).toBe(null);
  await expect(page.locator('#layer-output')).toHaveText(/All/);
  if(!expected.animated)await expect(page.locator('#joint-motion')).toBeHidden();
  await page.locator('#layer-slider').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(1);
  await page.locator('#layer-slider').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(2);
  await page.locator('#layer-slider').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  if(expected.animated){
   await expect(page.locator('#joint-motion')).toBeVisible();
   const rest=await page.locator('#atlas-canvas').screenshot();
   const expectedMotion=Math.min(40,Number(await page.locator('#joint-motion-slider').getAttribute('max')));
   await page.locator('#joint-motion-slider').evaluate(el=>{el.value=String(Math.min(Number(el.max),40));el.dispatchEvent(new Event('input',{bubbles:true}));});
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(expectedMotion);
   const bent=await page.locator('#atlas-canvas').screenshot();
   expect(bent.equals(rest)).toBe(false);
  }else await expect(page.locator('#joint-motion')).toBeHidden();
  if(['skull','neck','thorax','wrist','ankle','elbow'].includes(region))
   await page.screenshot({path:'artifacts/v7-'+region+'-'+test.info().project.name+'.png',fullPage:true});
  await page.locator('#reset-view').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
  await page.locator('#back-body').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:7000}).toBe('overview');
  expect(errors).toEqual([]);
 });
}
test('V7 wrist and skull are reachable from mobile sidebar and return on same 3D canvas',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false)).toBe(true);
 await page.locator('#sidebar-toggle').click();
 await expect(page.locator('#region-list [data-region="wrist"]')).toBeVisible();
 await page.locator('#region-list [data-region="wrist"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('skull'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('skull');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 const metrics=await page.evaluate(()=>({canvases:document.querySelectorAll('#atlas-canvas').length,screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(metrics.canvases).toBe(1);expect(metrics.scroll).toBeLessThanOrEqual(metrics.screen+2);
 expect(errors).toEqual([]);
});
test('V7 rejects corrupted skull source hash while retaining original atlas',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/atlas/regions/skull.json',async route=>{
  const response=await route.fetch();const body=(await response.text()).replace('Frontal bone','Tampered frontal bone');
  await route.fulfill({response,body});
 });
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false)).toBe(true);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('skull'));
 await expect(page.locator('#scene-status')).toContainText('UNAVAILABLE',{timeout:20000});
 expect((await page.evaluate(()=>window.__BODY_ATLAS__.getState()).then(s=>s.unified.region))).toBe(null);
 await expect(page.locator('#atlas-canvas')).toBeVisible();
});
