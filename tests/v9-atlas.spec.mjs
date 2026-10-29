import {test,expect} from '@playwright/test';
async function ready(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().expansionLoaded===true),{timeout:40000}).toBe(true);
 return errors;
}
test('V9 renders sourced 199-bone convention, 386 muscle meshes and opt-in connective system',async({page})=>{
 const errors=await ready(page);
 const st=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(st.renderer.webgl).toBe(true);
 expect(st.renderer.registry.bones).toBe(201);
 expect(st.renderer.registry.muscles).toBe(386);
 expect(st.renderer.registry.connective).toBe(48);
 expect(st.renderer.expansionBones).toBe(64);
 expect(st.renderer.expansionMuscles).toBe(237);
 expect(st.renderer.expansionConnective).toBe(48);
 await expect(page.locator('#overview-coverage')).toContainText('201 BONE MESHES');
 await expect(page.locator('#overview-coverage')).toContainText('386 MUSCLE MESHES');
 await expect(page.locator('#stage-caveat')).toContainText('199/206 conventional bones');
 const original=await page.locator('#atlas-canvas').screenshot();
 if((await page.viewportSize()).width<=850){
  await page.locator('[data-mobile-tool="layers"]').click();
  await page.locator('[data-mobile-tissue="connective"]').click();
 }else{
  await page.locator('[data-studio-tool="layers"]').click();
  await page.locator('[data-studio-tissue="connective"]').click();
 }
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.overviewSystem)).toBe('connective');
 const changed=await page.locator('#atlas-canvas').screenshot();
 expect(changed.equals(original)).toBe(false);
 const asset=await page.evaluate(async()=>await(await fetch('/atlas/assets/v9-source-expansion.json')).json());
 expect(Object.keys(asset.bones).length).toBe(64);
 expect(Object.keys(asset.muscles).length).toBe(237);
 expect(Object.keys(asset.connective).length).toBe(48);
 expect(asset.relationships.length).toBe(6);
 expect(asset.relationships.every(x=>x.motion_validated===false)).toBe(true);
 expect(errors).toEqual([]);
});
test('V9 source additions do not block region navigation, real wrist/ankle rigs or reset',async({page})=>{
 const errors=await ready(page);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('wrist'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region)).toBe('wrist');
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('ankle'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('ankle');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.registry.bones).toBe(201);
 expect(state.renderer.registry.muscles).toBe(386);
 expect(state.unified.motion).toBe(0);
 expect(state.unified.secondary).toBe(0);
 expect(errors).toEqual([]);
});
test('V9 invalid SHA cannot replace already verified V8 anatomy',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/atlas/assets/v9-source-expansion.json',async route=>{
  const response=await route.fetch();
  const content=(await response.text()).replace('body-live/v9-source-expansion-v1','fake-v9-sourced-v1');
  await route.fulfill({response,body:content});
 });
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded===true),{timeout:35000}).toBe(true);
 await expect(page.locator('#context-note')).toContainText('Optional V9 source expansion unavailable',{timeout:30000});
 const st=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(st.expansionLoaded).toBe(false);
 expect(st.renderer.overviewBones).toBe(59);
 expect(st.renderer.overviewMuscles).toBe(149);
 expect(st.renderer.expansionBones).toBe(0);
 expect(st.renderer.webgl).toBe(true);
 expect(errors).toEqual([]);
});
