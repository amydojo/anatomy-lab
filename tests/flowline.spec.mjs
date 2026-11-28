import {test,expect} from '@playwright/test';import fs from 'node:fs';
test.use({video:'on'});
for(const region of [0,1])for(const policy of ['C','D','E'])test('FLOWLINE committed-state actual atlas renderer '+policy+' region '+region,async({page},info)=>{
 test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const result=await page.evaluate(async({region,policy})=>{const before=window.__MARROW__.report(),result=await window.__MARROW__.qualifyHorizon({region,steps:720,preferredLift:.002,coverageFirst:true,compact:true,sharedSupport:true,flowline:policy!=='C',directional:policy==='E'});return {before,result,after:window.__MARROW__.report()};},{region,policy});
 fs.writeFileSync(info.outputPath('flowline-browser.json'),JSON.stringify({...result,errors,project:info.project.name,policy},null,2));
 const q=result.result;expect(q.liveAuthorized).toBe(false);expect(q.processed+q.unprocessed).toBe(720);expect(q.session.attempts).toBe(q.processed);expect(q.session.committed+q.session.holds).toBe(q.processed);expect(q.worker.stale).toBe(0);expect(q.worker.failed).toBeNull();expect(q.worker.accepted).toBeGreaterThan(0);expect(q.frameMs.samples).toBeGreaterThan(0);expect(q.session.committed).toBeGreaterThan(0);if(policy!=='C')expect(q.session.rollbackMismatch).toBe(0);expect(result.after.simulation.steps).toBe(result.before.simulation.steps);expect(result.after.simulation.p).toEqual(result.before.simulation.p);expect(result.after.terrain.mode).toBe('legacy');expect(errors).toEqual([]);
 // Execution assertions do not waive the continuity or timing acceptance gates.
});
