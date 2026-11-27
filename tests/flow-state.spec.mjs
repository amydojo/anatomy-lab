import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
test('FLOW STATE actual C1 synchronized research review in chase and side orientations',async({page},info)=>{
 test.setTimeout(240000);
 const errors=[],samples={};page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto&flow=review');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());
 await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const initial=await read();expect(initial.terrain.mode).toBe('legacy');
 await page.locator('[data-flow-lab]').click();await expect.poll(async()=> (await read()).terrain.review?.flow,{timeout:30000}).toBe(true);
 const start=await read(),canvas=page.locator('#atlas-canvas');
 for(const view of ['chase','side'])for(const mode of ['legacy','adaptive','constraint','compliant']){
  await page.evaluate(({view,mode})=>{window.__MARROW__.setReviewView(view);window.__MARROW__.setReviewMode(mode);},{view,mode});
  await expect.poll(async()=>{const q=(await read()).terrain.review;return q?.mode===mode&&q.view===view&&q.index>=9;},{timeout:30000}).toBe(true);
  const sample=await read();samples[view+'-'+mode]=sample;fs.writeFileSync(info.outputPath('flow-review.json'),JSON.stringify({samples,errors,project:info.project.name},null,2));
  expect(sample.simulation.steps).toBe(start.simulation.steps);expect(sample.simulation.p).toEqual(start.simulation.p);expect(sample.terrain.mode).toBe('legacy');
  const clip=await canvas.boundingBox();if(!clip)throw Error('Canvas unavailable');await page.screenshot({path:info.outputPath(view+'-'+mode+'.png'),clip});
 }
 await page.keyboard.press('Escape');await expect.poll(async()=> (await read()).terrain.review).toBeNull();expect((await read()).terrain.mode).toBe('legacy');expect(errors).toEqual([]);
});
