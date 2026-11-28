import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
for(const approach of ['parallel','diagonal'])test('KINESIS '+approach+' actual C1 offline review and live isolation',async({page},info)=>{
 test.setTimeout(240000);const errors=[],samples={};page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto&flow=kinesis&kinesisRoute='+approach);await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 await page.locator('[data-flow-lab]').click();await expect.poll(async()=> (await read()).terrain.review?.kinesis,{timeout:60000}).toBe(true);
 const start=await read(),q=start.terrain.review,canvas=page.locator('#atlas-canvas');
 expect(q.kinesisApproach).toBe(approach);expect(start.terrain.mode).toBe('legacy');expect(q.kinesisFrames).toBeGreaterThanOrEqual(0);expect(q.kinesisFrames).toBeLessThanOrEqual(q.frames);
 if(q.kinesisFrames===0)expect(q.kinesisStop?.step).toBe(0);
 if(q.kinesisFrames<q.frames)expect(q.kinesisStop).not.toBeNull();
 for(const view of ['chase','side'])for(const mode of ['legacy','slipstream',...(q.kinesisFrames>0?['kinesis']:[])]){
  await page.evaluate(({view,mode})=>{window.__MARROW__.setReviewView(view);window.__MARROW__.setReviewMode(mode);},{view,mode});
  const target=mode==='kinesis'?Math.min(9,q.kinesisFrames-1):9;
  await expect.poll(async()=>{const x=(await read()).terrain.review;return x?.mode===mode&&x.view===view&&x.index>=target;},{timeout:30000}).toBe(true);
  const sample=await read();samples[view+'-'+mode]=sample;expect(sample.simulation.steps).toBe(start.simulation.steps);expect(sample.simulation.p).toEqual(start.simulation.p);expect(sample.terrain.mode).toBe('legacy');
  if(mode==='kinesis')expect(sample.terrain.review.index).toBeLessThan(q.kinesisFrames);
  const clip=await canvas.boundingBox();if(!clip)throw Error('Canvas unavailable');await page.screenshot({path:info.outputPath(view+'-'+mode+'.png'),clip});
  fs.writeFileSync(info.outputPath('kinesis-review.json'),JSON.stringify({approach,initial:q,samples,errors,project:info.project.name,liveAuthorized:false},null,2));
 }
 await page.keyboard.press('Escape');await expect.poll(async()=> (await read()).terrain.review).toBeNull();expect((await read()).terrain.mode).toBe('legacy');expect(errors).toEqual([]);
});
