import {test,expect} from '@playwright/test';

async function start(page){
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/hip/spatial/');
 await expect(page.locator('#hip-canvas')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__HIP_SPATIAL__?.getState().sourceCount||0),{timeout:15000}).toBe(11);
 await expect(page.locator('#asset-status')).toContainText('SOURCED BONES + MUSCLES');
 return errors;
}
async function openSheet(page){
 if((await page.viewportSize()).width<=850){
  await page.locator('#inspector-toggle').click();
  await expect(page.locator('#inspector-toggle')).toHaveAttribute('aria-expanded','true');
 }
}
async function slide(page,id,value){
 await page.locator(id).evaluate((el,num)=>{el.value=String(num);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
test('sourced hip peel, structure isolation and reset',async({page})=>{
 const errors=await start(page);
 await slide(page,'#depth',2);
 await expect(page.locator('#depth-output')).toHaveText('DEEP ROTATORS');
 await openSheet(page);
 await page.locator('[data-part="piriformis"]').click();
 await expect(page.locator('#inspector-title')).toHaveText('Piriformis');
 await page.locator('#isolate').click();
 await expect(page.locator('#isolate')).toHaveAttribute('aria-pressed','true');
 await page.locator('#reset').click();
 await expect(page.locator('#depth-output')).toHaveText('SURFACE');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-hip-main.png'});
});
test('3 axes update the femur without distorting rigid geometry',async({page})=>{
 const errors=await start(page);
 const point={x:.25,y:-.7,z:.12};
 const initialPosition=await page.evaluate(p=>window.__HIP_SPATIAL__.transformFemur(p),point);
 await slide(page,'#motion',65);
 await page.locator('[data-axis="abduction"]').click();
 await slide(page,'#motion',28);
 await page.locator('[data-axis="rotation"]').click();
 await slide(page,'#motion',-22);
 const state=await page.evaluate(()=>window.__HIP_SPATIAL__.getState());
 expect(state.pose).toEqual({flexion:65,abduction:28,rotation:-22});
 const moved=await page.evaluate(p=>window.__HIP_SPATIAL__.transformFemur(p),point);
 expect(moved).not.toEqual(initialPosition);
 await page.locator('#reset').click();
 const restored=await page.evaluate(p=>window.__HIP_SPATIAL__.transformFemur(p),point);
 for(const k of ['x','y','z'])expect(Math.abs(restored[k]-initialPosition[k])).toBeLessThan(1e-9);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-hip-motion.png'});
});
test('sciatic nerve is conspicuously labeled schematic and traced',async({page})=>{
 const errors=await start(page);
 await openSheet(page);
 await page.locator('[data-part="sciatic"]').click();
 await expect(page.locator('#depth-output')).toHaveText('SCIATIC PATH');
 await expect(page.locator('#nerve-info')).toContainText('SCHEMATIC NERVE PATH');
 await expect(page.locator('#structure-type')).toContainText('SCHEMATIC');
 expect((await page.evaluate(()=>window.__HIP_SPATIAL__.getState())).trace).toBe(true);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-hip-nerve.png'});
});
test('gluteus medius lesson predicts, manipulates and explains',async({page})=>{
 const errors=await start(page);
 await openSheet(page);
 await page.locator('#lesson-start').click();
 await expect(page.locator('#lesson-panel')).toContainText('What keeps the pelvis level?');
 await page.locator('[data-guess="medius"]').click();
 await expect(page.locator('#lesson-panel')).toContainText('Explore the abductor action');
 await slide(page,'#motion',25);
 await expect(page.locator('#lesson-panel')).toContainText('The side stabilizer');
 await expect(page.locator('#lesson-panel')).toContainText('Your prediction matched');
 await page.locator('[data-lesson="replay"]').click();
 await expect(page.locator('#lesson-panel')).toContainText('What keeps the pelvis level?');
 await page.locator('[data-lesson="exit"]').click();
 await expect(page.locator('#lesson-panel')).toBeHidden();
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-hip-lesson.png'});
});
for(const width of [320,375,390,430]){
 test('mobile '+width+'px retains functional inspector and controls',async({page})=>{
  await page.setViewportSize({width,height:780});
  const errors=await start(page);
  await openSheet(page);
  await page.locator('[data-part="medius"]').click();
  await expect(page.locator('#inspector-title')).toHaveText('Gluteus medius');
  await slide(page,'#depth',1);
  await page.locator('[data-axis="abduction"]').click();
  await slide(page,'#motion',20);
  const dims=await page.evaluate(()=>({screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,stage:document.querySelector('.stage').getBoundingClientRect().height,band:document.querySelector('.controls').getBoundingClientRect().height}));
  expect(dims.scroll).toBeLessThanOrEqual(dims.screen+2);
  expect(dims.stage).toBeGreaterThan(100);
  expect(dims.band).toBeLessThan(175);
  expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/v53-mobile-'+width+'.png'});
 });
}
test('short mobile, camera presets and motion remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:650});
 const errors=await start(page);
 await openSheet(page);
 await page.locator('[data-part="piriformis"]').click();
 await page.locator('[data-axis="rotation"]').click();
 await slide(page,'#motion',28);
 await expect(page.locator('#motion-output')).toHaveText('28°');
 await page.locator('#lateral').click();
 const first=await page.evaluate(()=>window.__HIP_SPATIAL__.getState().yaw);
 await page.locator('#posterior').click();
 const second=await page.evaluate(()=>window.__HIP_SPATIAL__.getState().yaw);
 expect(first).not.toBe(second);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-hip-short.png'});
});
test('dissection route and source dossier remain accessible',async({page})=>{
 const errors=await start(page);
 await expect(page.locator('a[href="/hip/dissection/"]')).toHaveCount(1);
 await expect(page.locator('a[href="/hip/spatial/sources/"]')).toHaveCount(1);
 await page.goto('/hip/spatial/sources/');
 await expect(page.locator('body')).toContainText('BodyParts3D 4.0');
 await expect(page.locator('body')).toContainText('Sciatic');
 await page.goto('/hip/dissection/');
 await expect(page.locator('svg').first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('legacy hip route links to new HIP / SPATIAL',async({page})=>{
 await page.goto('/hip/');
 await expect(page.locator('a[href="/hip/spatial/"]')).toBeVisible();
});
test('reduced-motion preference prevents autoplay',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await start(page);
 await page.locator('#play').click();
 await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
});

test('mobile selected structure returns inspector to its explanation and enlarges stage',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await start(page);
 await openSheet(page);
 await page.locator('[data-part="gemellusInferior"]').click();
 await expect(page.locator('#inspector-title')).toHaveText('Inferior gemellus');
 const sizes=await page.evaluate(()=>({top:document.querySelector('#inspector-scroll').scrollTop,
  stage:document.querySelector('.stage').getBoundingClientRect().height,
  visible:document.querySelector('#inspector-title').getBoundingClientRect().top}));
 expect(sizes.top).toBeLessThan(5);
 expect(sizes.stage).toBeGreaterThan(280);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v53-mobile-refined.png'});
});
