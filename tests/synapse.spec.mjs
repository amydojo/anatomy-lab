import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
test('SYNAPSE loopback-only actual renderer and cache-only 120Hz qualification',async({page},info)=>{
 test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const training=JSON.parse(fs.readFileSync('synapse-results/synapse-restricted-results.json')),samples={};
 for(const variation of ['same','unseen']){
  const before=await read();const result=await page.evaluate(({training,variation})=>window.__MARROW__.qualifySynapse(training,{variation,steps:1440}),{training,variation});
  samples[variation]={result,before,after:await read()};fs.writeFileSync(info.outputPath('synapse-browser.json'),JSON.stringify({samples,errors,project:info.project.name,liveAuthorized:false},null,2));
  expect(result.liveAuthorized).toBe(false);expect(result.oracleCallsDuringSteps).toBe(0);expect(result.session.attempts).toBe(result.processed);expect(result.session.committed+result.session.holds).toBe(result.processed);expect(result.processed+result.unprocessed).toBe(1440);
  // A qualification experiment can fail its motion gate. Preserve the result,
  // never turn a hold or unprocessed step into a successful ride.
  expect(result.session.committed).toBeGreaterThan(0);expect(result.frameMs.samples).toBeGreaterThan(0);expect(result.session.cache.invalid).toBe(0);
 }
 expect(errors).toEqual([]);
});
