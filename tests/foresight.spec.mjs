import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
test('FORESIGHT evidence review: adverse C1 stop and actual imported completed cranium route, no live mutation',async({page},info)=>{
 test.setTimeout(240000);const errors=[],samples={};page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto&flow=foresight');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const canvas=page.locator('#atlas-canvas');
 async function capture(label,expectedSource,views,modes){const start=await read(),q=start.terrain.review;expect(q.sourceLabel).toBe(expectedSource);expect(start.terrain.mode).toBe('legacy');
  for(const view of views)for(const mode of modes){await page.evaluate(({view,mode})=>{window.__MARROW__.setReviewView(view);window.__MARROW__.setReviewMode(mode);},{view,mode});
   const target=mode==='foresight'?Math.min(9,q.foresightFrames-1):9;await expect.poll(async()=>{const x=(await read()).terrain.review;return x?.mode===mode&&x.view===view&&x.index>=target;},{timeout:30000}).toBe(true);
   const z=await read();expect(z.simulation.steps).toBe(start.simulation.steps);expect(z.simulation.p).toEqual(start.simulation.p);expect(z.terrain.mode).toBe('legacy');samples[label+'-'+view+'-'+mode]=z;
   const clip=await canvas.boundingBox();if(!clip)throw Error('Canvas unavailable');await page.screenshot({path:info.outputPath(label+'-'+view+'-'+mode+'.png'),clip});
  }
  fs.writeFileSync(info.outputPath('foresight-review.json'),JSON.stringify({samples,errors,liveAuthorized:false},null,2));
 }
 await page.locator('[data-flow-lab]').click();await expect.poll(async()=> (await read()).terrain.review?.foresight,{timeout:60000}).toBe(true);expect((await read()).terrain.review.foresightFrames).toBe(1);expect((await read()).terrain.review.foresightStop.reason).toBe('no-qualified-horizon');
 await capture('adverse','C1',['chase','side'],['slipstream','foresight']);
 await page.keyboard.press('Escape');await expect.poll(async()=> (await read()).terrain.review).toBeNull();
 await page.locator('[data-foresight-import]').setInputFiles('foresight-review-input/foresight-SKULL_CRANIAL_MAXILLA.json');await expect.poll(async()=> (await read()).terrain.review?.sourceLabel,{timeout:60000}).toBe('CRANIUM');expect((await read()).terrain.review.foresightFrames).toBe(21);
 await capture('completed','CRANIUM',['chase','side'],['legacy','slipstream','foresight']);await page.keyboard.press('Escape');await expect.poll(async()=> (await read()).terrain.review).toBeNull();expect(errors).toEqual([]);
});
