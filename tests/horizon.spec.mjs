import {test,expect} from '@playwright/test';import fs from 'node:fs';
test.use({video:'on'});
for(const region of [0,1])test('HORIZON actual atlas worker qualification region '+region,async({page},info)=>{
 test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const result=await page.evaluate(async region=>{const before=window.__MARROW__.report(),result=await window.__MARROW__.qualifyHorizon({region,steps:1440,preferredLift:.002,coverageFirst:true});return {before,result,after:window.__MARROW__.report()};},region);
 fs.writeFileSync(info.outputPath('horizon-browser.json'),JSON.stringify({...result,errors,project:info.project.name},null,2));
 const q=result.result;expect(q.liveAuthorized).toBe(false);expect(q.processed+q.unprocessed).toBe(1440);expect(q.session.attempts).toBe(q.processed);expect(q.session.committed+q.session.holds).toBe(q.processed);expect(q.worker.stale).toBe(0);expect(q.worker.failed).toBeNull();expect(q.worker.accepted).toBeGreaterThan(0);expect(q.frameMs.samples).toBeGreaterThan(0);expect(q.session.committed).toBeGreaterThan(0);expect(result.after.simulation.steps).toBe(result.before.simulation.steps);expect(result.after.simulation.p).toEqual(result.before.simulation.p);expect(result.after.terrain.mode).toBe('legacy');expect(errors).toEqual([]);
 // Execution is not a motion gate. Holds and missed deadlines stay in evidence.
});
