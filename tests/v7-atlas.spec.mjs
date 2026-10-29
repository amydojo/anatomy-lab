import {test,expect} from '@playwright/test';
const regions={
 skull:{parts:14,muscles:16,animated:true},
 neck:{parts:8,muscles:14,animated:true},
 thorax:{parts:30,muscles:11,animated:true},
 elbow:{parts:3,muscles:10,animated:true},
 wrist:{parts:15,muscles:10,animated:true},
 ankle:{parts:14,muscles:12,animated:true}
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
  expect(state.renderer.expandedMuscles).toBeGreaterThanOrEqual(expected.muscles);
  await expect(page.locator('#mode-trace')).toHaveText('Muscles');
  await expect(page.locator('#mode-trace')).toBeEnabled();
  expect(await page.locator('#region-frame').getAttribute('src')).toBe(null);
  await expect(page.locator('#layer-output')).toHaveText(/All/);
  if(!expected.animated)await expect(page.locator('#joint-motion')).toBeHidden();
  await page.locator('#layer-slider').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(1);
  await page.locator('#layer-slider').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(2);
  await page.locator('#layer-slider').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#mode-trace').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(4);
  await expect(page.locator('#layer-output')).toContainText('Source muscles');
  await expect(page.locator('#mode-trace')).toHaveAttribute('aria-pressed','true');
  await page.locator('#mode-explore').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(0);
  if(expected.animated){
   if((await page.viewportSize()).width<=850){
    await expect(page.locator('#mobile-workbench')).toBeVisible();
    await page.locator('[data-mobile-tool="move"]').click();
    await expect(page.locator('#mobile-motion-slider')).toBeVisible();
   }else await expect(page.locator('#joint-motion')).toBeVisible();
   const rest=await page.locator('#atlas-canvas').screenshot();
   const expectedMotion=Math.min(40,Number(await page.locator('#joint-motion-slider').getAttribute('max')));
   await page.locator('#joint-motion-slider').evaluate(el=>{el.value=String(Math.min(Number(el.max),40));el.dispatchEvent(new Event('input',{bubbles:true}));});
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(expectedMotion);
   const bent=await page.locator('#atlas-canvas').screenshot();
   expect(bent.equals(rest)).toBe(false);
  }else await expect(page.locator('#joint-motion')).toBeHidden();
  if(['skull','neck','thorax','wrist','ankle','elbow'].includes(region))
   await page.screenshot({path:'artifacts/v7-'+region+'-'+test.info().project.name+'.png',fullPage:true});
  await page.locator('#reset-view').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
  await page.evaluate(()=>window.__BODY_ATLAS__.body());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:7000}).toBe('overview');
  expect(errors).toEqual([]);
 });
}
test('V7 wrist and skull remain reachable from mobile region picker on one canvas',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false)).toBe(true);
 await page.locator('#mobile-region').click();
 await expect(page.locator('[data-mobile-region="wrist"]')).toBeVisible();
 await page.locator('[data-mobile-region="wrist"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 await expect(page.locator('#atlas-canvas')).toBeVisible();
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="skull"]').click();
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

test('Mobile region picker exposes all 10 destinations without occupying canvas space',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect(page.locator('.region-dock')).toBeHidden();
 await page.locator('#mobile-region').click();
 const buttons=page.locator('[data-mobile-region]');
 await expect(buttons).toHaveCount(10);
 for(const name of ['hip','nerve','knee','shoulder','thorax','neck','skull','elbow','wrist','ankle'])
  await expect(page.locator('[data-mobile-region="'+name+'"]')).toBeVisible();
 const layout=await page.evaluate(()=>({
  screen:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth,
  canvas:document.querySelectorAll('#atlas-canvas').length
 }));
 expect(layout.scroll).toBeLessThanOrEqual(layout.screen+2);
 expect(layout.canvas).toBe(1);
 await page.locator('[data-mobile-region="neck"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('neck');
 await page.locator('#mobile-region').click();
 await page.locator('[data-mobile-region="thorax"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('thorax');
});
test('Elbow muscle layer identifies a sourced muscle from its projected triangle, not a fabricated label',async({page})=>{
 const errors=await open(page,'elbow');
 await page.locator('#mode-trace').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(4);
 const selected=await page.evaluate(async()=>{
  const asset=await (await fetch('/atlas/regions/elbow.json')).json();
  const state=window.__BODY_ATLAS__.getState();
  const canvas=document.querySelector('#atlas-canvas');
  const camera={...state.camera,width:canvas.clientWidth,height:canvas.clientHeight};
  const part=asset.muscle_parts['right-brachialis'];
  for(let i=0;i<part.faces.length;i+=4){
   const face=part.faces[i];
   const p=face.map(index=>part.vertices[index]);
   const c={x:(p[0][0]+p[1][0]+p[2][0])/3,
    y:(p[0][1]+p[1][1]+p[2][1])/3,z:(p[0][2]+p[1][2]+p[2][2])/3};
   const pos=window.BodySpatialCore.project(c,camera);
   if(pos.x<20||pos.y<20||pos.x>camera.width-20||pos.y>camera.height-20)continue;
   const hit=window.__BODY_ATLAS__.pickAt(pos.x,pos.y);
   if(hit&&window.__BODY_ATLAS__.getState().unified.selected)return hit;
  }
  return null;
 });
 expect(selected).not.toBe(null);
 await expect(page.locator('#structure-chip')).toBeVisible();
 await expect(page.locator('#structure-chip-name')).not.toHaveText('Structure');
 expect(errors).toEqual([]);
});
