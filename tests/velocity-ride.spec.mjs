import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
test('IGNITION pinned VECTOR on existing MARROW contact, control, flight and fallback',async({page},info)=>{
 test.setTimeout(240000);
 const file=process.env.VELOCITY_CANDIDATE;
 test.skip(!file,'Requires actual pinned asset');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__marrowPad={axes:[0,0,0,0],buttons:Array(17).fill(0)};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,mapping:'standard',index:0,axes:window.__marrowPad.axes,buttons:window.__marrowPad.buttons.map(value=>({value,pressed:value>.5}))}]});});
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report()),canvas=page.locator('#atlas-canvas'),samples={};
 async function capture(name){samples[name]=await read();await canvas.screenshot({path:info.outputPath(name+'.png')});}
 await expect.poll(async()=> (await read()).frames).toBeGreaterThan(0);
 await capture('original-idle');expect(samples['original-idle'].simulation.ground).toBe(true);
 const input=page.getByLabel('Import qualified VECTOR GLB');
 await expect(input).toBeEnabled({timeout:10000});
 await input.setInputFiles({name:'wrong.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid')});
 await expect.poll(async()=> (await read()).vector?.error||'').toContain('digest mismatch');
 expect((await read()).renderer.vehicleAsset).toBe('bone-acid');
 await input.setInputFiles(file);
 await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 await capture('vector-idle');expect(samples['vector-idle'].renderer.vehicleTriangles).toBe(19986);expect(samples['vector-idle'].renderer.marrowVehicleDrawCalls).toBe(5);expect(samples['vector-idle'].renderer.vectorTextureBytes).toBeGreaterThan(0);
 await page.locator('[data-vector-quality]').click();await expect.poll(async()=> (await read()).renderer.vehicleMaterialQuality).toBe('performance');
 await capture('vector-performance');
 for(const [name,x,y] of [['carve-left',-.7,-.55],['carve-right',.7,-.55]]){
  await page.evaluate(([x,y])=>{window.__marrowPad.axes[0]=x;window.__marrowPad.axes[1]=y;},[x,y]);try{await page.waitForTimeout(3500);}finally{await page.evaluate(()=>{window.__marrowPad.axes[0]=0;window.__marrowPad.axes[1]=0;});}
  await capture(name);
 }
 expect(samples['carve-right'].simulation.rideDistance-samples['vector-idle'].simulation.rideDistance).toBeGreaterThan(.025);
 expect(samples['carve-right'].simulation.falls).toBe(samples['vector-idle'].simulation.falls);
 await page.keyboard.down('e');try{await expect.poll(async()=> (await read()).simulation.glide,{timeout:30000}).toBe(true);await page.waitForTimeout(1200);}finally{await page.keyboard.up('e');}
 await capture('vector-flight');await page.keyboard.press('l');
 await expect.poll(async()=> (await read()).simulation.ground,{timeout:45000}).toBe(true);
 await capture('vector-landing');expect(samples['vector-landing'].simulation.landings).toBeGreaterThan(samples['vector-idle'].simulation.landings);
 expect(samples['vector-landing'].simulation.remounts).toBe(samples['vector-idle'].simulation.remounts);
 await page.locator('[data-vector-toggle]').click();await expect.poll(async()=> (await read()).renderer.vehicleAsset).toBe('bone-acid');await capture('original-restored');
 expect(samples['original-restored'].renderer.vehicleTriangles).toBe(samples['original-idle'].renderer.vehicleTriangles);
 expect(samples['original-restored'].renderer.vectorTextureBytes).toBe(0);
 await page.locator('[data-vector-toggle]').click();await expect.poll(async()=> (await read()).renderer.vehicleAsset).toBe('vector');
 await page.keyboard.press('Escape');await expect(page.locator('#marrow-hud')).toHaveCount(0);
 expect((await read()).active).toBe(false);expect(errors).toEqual([]);
 fs.writeFileSync(info.outputPath('ignition-ride.json'),JSON.stringify({samples,errors,project:info.project.name,limitations:'Automated controller/keyboard; physical device performance and unrestricted wall/ceiling traversal not established.'},null,2));
 // Local cache is per-origin and must revalidate the pinned digest after reload.
 await page.reload();await page.bringToFront();await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');expect((await read()).vector.origin).toBe('cache');await capture('cached-vector-reload');
 fs.writeFileSync(info.outputPath('afterglow-ride.json'),JSON.stringify({samples,errors,project:info.project.name,limitations:'Automated controls only; frame timings are CI, not physical device measurements.'},null,2));
});
