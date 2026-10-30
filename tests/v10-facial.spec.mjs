import {test,expect} from '@playwright/test';
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().osteologyLoaded===true),{timeout:40000}).toBe(true);
 return errors;
}
test('V10 loads 47 registered licensed facial muscles without substituting existing geometry',async({page})=>{
 const errors=await open(page);
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.webgl).toBe(true);
 expect(state.renderer.registry.bones).toBe(208);
 expect(state.renderer.registry.muscles).toBe(433);
 expect(state.renderer.facialMuscles).toBe(47);
 expect(state.renderer.registry.duplicateIds).toBe(0);
 await expect(page.locator('#overview-coverage')).toContainText('433 MUSCLE MESHES');
 await expect(page.locator('#stage-caveat')).toContainText('CC BY-SA 2.1 Japan');
 const assets=await page.evaluate(async()=>{
  const [a,p]=await Promise.all([
   fetch('/atlas/assets/v10-facial-reference.json').then(r=>r.json()),
   fetch('/atlas/assets/v10-facial-provenance.json').then(r=>r.json())
  ]);
  return {data:a,proof:p};
 });
 expect(Object.keys(assets.data.parts)).toHaveLength(47);
 expect(assets.proof.anatomist_reviewed).toBe(false);
 expect(assets.proof.jaw_dynamics_validated).toBe(false);
 expect(assets.data.license).toBe('CC-BY-SA-2.1-JP');
 const faces=Object.values(assets.data.parts).map(x=>x.name.toLowerCase());
 for(const q of ['masseter','temporalis','pterygoid','orbicularis','zygomaticus'])
  expect(faces.some(x=>x.includes(q))).toBe(true);
 expect(errors).toEqual([]);
});
test('V10 facial surfaces render with muscles and remain selectable source identities in skull lab',async({page})=>{
 const errors=await open(page);
 const canvas=page.locator('#atlas-canvas');
 const before=await canvas.screenshot();
 if((await page.viewportSize()).width<=850){
  await page.locator('[data-mobile-tool="layers"]').click();
  await page.locator('[data-mobile-tissue="muscles"]').click();
 }else{
  await page.locator('[data-studio-tool="layers"]').click();
  await page.locator('[data-studio-tissue="muscles"]').click();
 }
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('muscles');
 expect((await canvas.screenshot()).equals(before)).toBe(false);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('skull'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:35000}).toBe('skull');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.registry.muscles).toBe(433);
 expect(state.renderer.facialDetailMeshes).toBe(47);
 expect(state.unified.motion).toBe(0);
 expect(errors).toEqual([]);
});
test('V10 invalid downloaded facial geometry fails closed and leaves V9 atlas available',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/atlas/assets/v10-facial-reference.json',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text()).replace('body-live/v10-facial-source-v1','unsafe-facial-data')});
 });
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().expansionLoaded===true),{timeout:35000}).toBe(true);
 await expect(page.locator('#context-note')).toContainText('Optional facial source not loaded',{timeout:25000});
 const s=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(s.facialLoaded).toBe(false);
 expect(s.renderer.registry.muscles).toBe(386);
 expect(s.renderer.facialMuscles).toBe(0);
 expect(s.renderer.webgl).toBe(true);
 expect(errors).toEqual([]);
});
