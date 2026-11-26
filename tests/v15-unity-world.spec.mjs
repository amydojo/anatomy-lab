import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('UNITY persistent world draws every label and travels without resetting orientation',async({page},info)=>{
 test.setTimeout(360000);
 await page.addInitScript(()=>{window.padButtons=Array(17).fill(false);window.padAxes=[0,0,0,0];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,mapping:'standard',index:0,axes:window.padAxes,buttons:window.padButtons.map(pressed=>({pressed,value:pressed?1:0}))}]});});
 await page.goto('/atlas/?source=unity&expedition=1&optical=tv&expeditionDiagnostics=1');
 await page.bringToFront();
 const report=()=>page.evaluate(()=>window.__BODY_EXPEDITION_DIAGNOSTICS__?.report());
 await expect.poll(async()=>{const r=await report();return r?.source?.streaming?.running===false?r.source.streaming.loaded:0;},{timeout:240000}).toBe(143);
 await expect.poll(async()=> (await report())?.renderer?.drawnSourceIds?.length,{timeout:90000}).toBe(143);
 const start=await report();expect(start.source.coverage).toBe('UNITY WORLD');expect(start.source.coordinateStatus).toBe('provisional-native-display');expect(start.source.physicalUnits).toBeNull();expect(start.source.streaming.failed).toEqual([]);expect(start.renderer.gpuFailedIds).toEqual([]);expect(start.source.availableTriangles).toBe(6070400);expect(new Set(start.renderer.drawnSourceIds).size).toBe(143);
 await page.screenshot({path:info.outputPath('unity-overview.png')});writeFileSync(info.outputPath('unity-overview.json'),JSON.stringify(start,null,2));
 await expect.poll(async()=> (await report())?.controller?.status,{timeout:15000}).toBe('Controller ready');
 await page.evaluate(()=>window.padAxes=[0,0,.5,0]);await page.waitForTimeout(500);await page.evaluate(()=>window.padAxes=[0,0,0,0]);const rotated=await report();expect(rotated.camera.yaw).not.toBe(start.camera.yaw);
 await page.evaluate(()=>window.padButtons[12]=true);await page.waitForTimeout(200);await page.evaluate(()=>window.padButtons[12]=false);await page.waitForTimeout(850);const traveled=await report();expect(traveled.camera.target).not.toEqual(rotated.camera.target);expect(traveled.camera.yaw).toBeCloseTo(rotated.camera.yaw,6);expect(traveled.camera.zoom).toBe(rotated.camera.zoom);expect(traveled.source.streaming.loaded).toBe(143);
 await page.screenshot({path:info.outputPath('unity-travel.png')});writeFileSync(info.outputPath('unity-travel.json'),JSON.stringify(traveled,null,2));
});
test('UNITY asset failure retains other source labels and explicit retry recovers',async({page},info)=>{
 test.setTimeout(360000);
 await page.addInitScript(()=>{window.padButtons=Array(17).fill(false);Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,mapping:'standard',index:0,axes:[0,0,0,0],buttons:window.padButtons.map(pressed=>({pressed,value:pressed?1:0}))}]});});
 const pattern='**/bonehub-vhf-capitate_left.glb';await page.route(pattern,r=>r.abort());await page.goto('/atlas/?source=unity&expedition=1&expeditionDiagnostics=1');await page.bringToFront();
 const report=()=>page.evaluate(()=>window.__BODY_EXPEDITION_DIAGNOSTICS__?.report());await expect.poll(async()=>{const r=await report();return r?.source?.streaming?.running===false?r.source.streaming.loaded:0;},{timeout:240000}).toBe(142);
 const partial=await report();expect(partial.source.streaming.failed.map(x=>x[0])).toEqual(['bonehub-vhf-capitate_left']);expect(partial.renderer.drawCalls).toBeGreaterThan(0);await page.unroute(pattern);await expect.poll(async()=> (await report())?.controller?.status,{timeout:15000}).toBe('Controller ready');await page.evaluate(()=>window.padButtons[11]=true);await page.waitForTimeout(200);await page.evaluate(()=>window.padButtons[11]=false);
 await expect.poll(async()=> (await report())?.renderer?.drawnSourceIds?.length,{timeout:90000}).toBe(143);const recovered=await report();expect(recovered.source.streaming.failed).toEqual([]);writeFileSync(info.outputPath('unity-recovery.json'),JSON.stringify(recovered,null,2));await page.screenshot({path:info.outputPath('unity-recovered.png')});
});
