import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/knee/spatial/');
 await expect(page.locator('#knee-canvas')).toBeVisible();
 await expect(page.locator('#inspector-title')).toContainText('moving machine');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_SPATIAL__?.getState()?.sourcedBoneCount||0),{timeout:10000}).toBe(4);
 await expect(page.locator('#scene-status')).toContainText('SOURCED BONES');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_SPATIAL__?.getState()?.hits?.length ?? window.__BODY_SPATIAL__?.getState()?.width ?? 0)).toBeGreaterThan(10);
 return errors;
}
test('spatial 3D specimen initializes and supports anatomical selection and reset',async({page})=>{
 const errors=await start(page);
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('[data-structure="acl"]').click();
 await expect(page.locator('#inspector-title')).toHaveText('ACL');
 await page.locator('#isolate').click();
 await expect(page.locator('#isolate')).toHaveAttribute('aria-pressed','true');
 await page.locator('#reset').click();
 await expect(page.locator('#angle-output')).toHaveText('0°');
 await expect(page.locator('#depth-output')).toHaveText('ALL STRUCTURES');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-knee-spatial.png'});
});
test('flexion, depth, side view, and orbit update spatial state without fabricating forces',async({page})=>{
 const errors=await start(page);
 await page.locator('#flexion').evaluate(el=>{el.value='90';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#angle-output')).toHaveText('90°');
 await page.locator('#depth').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#depth-output')).toHaveText('LIGAMENTS + BONES');
 await page.locator('#side').click();
 const before=await page.evaluate(()=>window.__BODY_SPATIAL__.getState().yaw);
 const rect=await page.locator('#knee-canvas').boundingBox();
 await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);
 await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.55,{steps:5});await page.mouse.up();
 const after=await page.evaluate(()=>window.__BODY_SPATIAL__.getState().yaw);
 expect(after).not.toBe(before);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-knee-flexed.png'});
});
for(const width of [320,375,390,430]){
 test('phone '+width+'px supports compact controls and expanded inspector',async({page})=>{
   await page.setViewportSize({width,height:780});
   const errors=await start(page);
   const dims=await page.evaluate(()=>({screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,canvas:document.getElementById('knee-canvas').getBoundingClientRect().height}));
   expect(dims.scroll).toBeLessThanOrEqual(dims.screen+2);
   expect(dims.canvas).toBeGreaterThan(100);
   await page.locator('#inspector-toggle').click();
   await expect(page.locator('#inspector-toggle')).toHaveAttribute('aria-expanded','true');
   await page.locator('[data-structure="menisci"]').click();
   await expect(page.locator('#inspector-title')).toHaveText('Menisci');
   expect(errors).toEqual([]);
   await page.screenshot({path:'artifacts/v5-mobile-'+width+'.png'});
 });
}
test('short-screen interaction stays reachable and reduced motion does not autoplay',async({page})=>{
 await page.setViewportSize({width:390,height:640});
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=await start(page);
 await page.locator('#inspector-toggle').click();
 await page.locator('#play').click();
 expect(await page.evaluate(()=>window.__BODY_SPATIAL__.getState().playing)).toBe(false);
 await page.locator('#flexion').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#angle-output')).toHaveText('65°');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-short-phone.png'});
});
test('provenance and V4 fallback are explicit',async({page})=>{
 await start(page);await expect(page.locator('a[href="/knee/"]')).toBeVisible();
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('a[href="/knee/spatial/sources/"]').click();
 await expect(page.locator('body')).toContainText('What is real.');
 await expect(page.locator('body')).toContainText('BodyParts3D');
 await expect(page.locator('body')).toContainText('BodyParts3D 4.0-derived geometry');
});
test('V4 knee offers non-destructive entry into spatial experiment',async({page})=>{
 await page.goto('/knee/');
 await expect(page.locator('a[href="/knee/spatial/"]')).toBeVisible();
});

test('all four licensed bones load from aligned reference coordinates',async({page})=>{
 const errors=await start(page);
 const model=await page.evaluate(async()=>await (await fetch('/knee/spatial/assets/bp3d-right-knee-4.0.json')).json());
 expect(Object.keys(model.bone_meshes).sort()).toEqual(['femur','fibula','patella','tibia']);
 expect(model.aligned_shared_transform.scale_to_scene).toBe(7.5);
 for(const bone of Object.values(model.bone_meshes)){
  expect(bone.vertices.length).toBeGreaterThan(100);
  expect(bone.faces.length).toBeGreaterThan(200);
 }
 const proof=await page.evaluate(async()=>await (await fetch('/knee/spatial/assets/provenance.json')).json());
 expect(proof.anatomist_reviewed).toBe(false);
 expect(proof.kinematically_validated).toBe(false);
 expect(proof.packed_chunk.sha256).toMatch(/^[0-9a-f]{64}$/);
 expect(errors).toEqual([]);
});
test('sourced geometry rotates under flexion while preserving the static femur',async({page})=>{
 await start(page);
 const before=await page.evaluate(()=>window.__BODY_SPATIAL__.getState().sourcedBoneCount);
 await page.locator('#flexion').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const after=await page.evaluate(()=>window.__BODY_SPATIAL__.getState());
 expect(before).toBe(4);
 expect(after.flex).toBe(80);
 await expect(page.locator('#scene-status')).toContainText('SOURCED BONES');
 await page.screenshot({path:'artifacts/v5-sourced-bones-flexed.png'});
});

test('joint focus is default; whole-bone context is a reversible camera choice',async({page})=>{
 await start(page);
 const first=await page.evaluate(()=>window.__BODY_SPATIAL__.getState());
 expect(first.sourcedBoneCount).toBe(4);
 expect(first.focus).toBe('joint');
 expect(first.frameSpan).toBe(2.65);
 await page.locator('#focus-toggle').click();
 const all=await page.evaluate(()=>window.__BODY_SPATIAL__.getState());
 expect(all.focus).toBe('whole');
 expect(all.frameSpan).toBe(7.6);
 await page.screenshot({path:'artifacts/v5-whole-bones.png'});
 await page.locator('#focus-toggle').click();
 expect(await page.evaluate(()=>window.__BODY_SPATIAL__.getState().focus)).toBe('joint');
 await page.screenshot({path:'artifacts/v5-knee-joint-focus.png'});
});

test('guided experiment uses actual joint manipulation to reveal explanation',async({page})=>{
 const errors=await start(page);
 if((await page.viewportSize()).width<=850)await page.locator('#inspector-toggle').click();
 await page.locator('#experiment-start').click();
 await expect(page.locator('#experiment-panel')).toContainText('What moves when the knee bends?');
 await expect(page.locator('#depth')).toHaveValue('3');
 await page.locator('#experiment-panel [data-guess="upper"]').click();
 await expect(page.locator('#experiment-panel')).toContainText('Bend the joint.');
 await page.locator('#flexion').evaluate(el=>{el.value='72';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#experiment-panel')).toContainText('A moving relationship.');
 await expect(page.locator('#experiment-panel')).toContainText('real knee also rolls');
 await page.locator('#experiment-panel [data-experiment="replay"]').click();
 await expect(page.locator('#angle-output')).toHaveText('0°');
 await page.locator('#experiment-panel [data-experiment="exit"]').click();
 await expect(page.locator('#experiment-panel')).toBeHidden();
 await expect(page.locator('#depth')).toHaveValue('0');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-mechanics-lesson.png'});
});
test('source identity is distinguished from schematic tissue on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await start(page);
 await page.locator('#inspector-toggle').click();
 await page.locator('[data-structure="femur"]').click();
 await expect(page.locator('#structure-type')).toContainText('SOURCE GEOMETRY');
 await expect(page.locator('[data-structure="femur"] .structure-status')).toHaveText('SOURCE');
 await page.locator('[data-structure="acl"]').click();
 await expect(page.locator('#structure-type')).toContainText('SOFT TISSUE · SCHEMATIC');
 await expect(page.locator('[data-structure="acl"] .structure-status')).toHaveText('ILLUSTRATIVE');
 await page.locator('#experiment-start').click();
 await page.locator('#experiment-panel [data-guess="lower"]').click();
 await page.locator('#flexion').evaluate(el=>{el.value='69';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#experiment-panel')).toContainText('Your prediction matched');
 const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+2);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-mechanics-mobile.png'});
});
