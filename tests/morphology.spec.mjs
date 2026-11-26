import {test,expect} from '@playwright/test';
import {PNG} from 'pngjs';
test('actual anatomy, tissue isolation, controller and provider',async({page},info)=>{
 test.setTimeout(90000);await page.addInitScript(()=>{window.__mPad={axes:[0,0,0,0],buttons:Array(17).fill(false)};Object.defineProperty(navigator,'getGamepads',{value:()=>[{connected:true,mapping:'standard',axes:window.__mPad.axes,buttons:window.__mPad.buttons.map(x=>({pressed:x,value:x?1:0}))}]});});
 await page.goto('/atlas/morphology/');const report=()=>page.evaluate(()=>window.__MORPHOLOGY__?.report());await expect.poll(async()=> (await report())?.structures||0,{timeout:45000}).toBeGreaterThan(20);await page.locator('#specimen').selectOption('bp4-head-neck');await page.locator('#load').click();await expect.poll(async()=> (await report()).active,{timeout:45000}).toBe('bp4-head-neck');let r=await report();expect(r.tissues).toContain('bone');expect(r.tissues).toContain('muscle');await expect.poll(async()=> (await report()).draws).toBeGreaterThan(0);
 const shot=await page.locator('#view').screenshot({path:info.outputPath('morphology-face.png')});const png=PNG.sync.read(shot);let n=0;for(let i=0;i<png.data.length;i+=4)if(png.data[i]>70)n++;expect(n).toBeGreaterThan(100);
 await page.evaluate(()=>window.__mPad.buttons[12]=true);await expect.poll(async()=> (await report()).visible.length).toBe(1);await page.evaluate(()=>window.__mPad.buttons[12]=false);await page.evaluate(()=>window.__mPad.axes=[0,0,.8,0]);await expect.poll(async()=> (await report()).camera.yaw).not.toBe(r.camera.yaw);await page.evaluate(()=>window.__mPad.axes=[0,0,0,0]);
 const adapter=await page.evaluate(async()=>{const p=await import('/assets/atlas/morphology/provider.mjs');const a=await p.createProvider();const parts=await a.loadSomatic('bp4-head-neck');return {n:parts.length,source:parts.sourceInfo,typed:parts[0].positions instanceof Float32Array};});expect(adapter.n).toBeGreaterThan(20);expect(adapter.typed).toBe(true);expect(adapter.source.manifestHash).toHaveLength(64);
 console.log('MORPHOLOGY_RUNTIME '+JSON.stringify(await report()));
});
test('failed load preserves prior specimen',async({page})=>{await page.goto('/atlas/morphology/');const report=()=>page.evaluate(()=>window.__MORPHOLOGY__?.report());await expect.poll(async()=> (await report())?.structures||0,{timeout:45000}).toBeGreaterThan(20);const old=await report();await page.route('**/atlas/regions/thorax.json',r=>r.fulfill({status:200,body:'invalid'}));await page.locator('#specimen').selectOption('bp4-thorax');await page.locator('#load').click();await expect.poll(async()=> (await report()).error).toContain('integrity');expect((await report()).active).toBe(old.active);expect((await report()).structures).toBe(old.structures);});

test('acquired source packs render each qualified region with native tissue switching',async({page},info)=>{
 test.setTimeout(150000);await page.goto('/atlas/morphology/');const report=()=>page.evaluate(()=>window.__MORPHOLOGY__?.report());
 await expect.poll(async()=> (await report())?.active,{timeout:60000}).toBe('exact-head-neck');
 const results=[];const readPixels=()=>page.evaluate(()=>{const c=document.getElementById('view'),g=c.getContext('webgl2'),pixels=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,pixels);let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>45||pixels[i+1]>45||pixels[i+2]>45)n++;return n;});
 for(const id of ['exact-head-neck','exact-head-face-extension','exact-thorax-shoulder','exact-arms-hands']){
  if((await report()).active!==id){await page.locator('#specimen').selectOption(id);await page.locator('#load').click();await expect.poll(async()=> (await report()).active,{timeout:60000}).toBe(id);}
  await expect.poll(async()=> (await report()).draws).toBeGreaterThan(20);
  const r=await report();expect(r.tissues).toContain('muscle');expect(r.tissues).toContain('bone');expect(r.estimatedGpuBufferBytes).toBeLessThan(96*1024*1024);expect(await readPixels()).toBeGreaterThan(100);
  await page.locator('#view').screenshot({path:info.outputPath(id+'.png')});
  for(const t of r.tissues)if(t!=='muscle')await page.locator('[data-tissue="'+t+'"]').uncheck();
  await expect.poll(async()=> (await report()).visible).toEqual(['muscle']);await expect.poll(readPixels).toBeGreaterThan(100);await page.locator('#view').screenshot({path:info.outputPath(id+'-muscle.png')});
  results.push({id,structures:r.structures,tissues:r.tissues,estimatedGpuBufferBytes:r.estimatedGpuBufferBytes,loadMetrics:r.loadMetrics,draws:r.draws,triangles:r.triangles,renderCpuMs:r.renderCpuMs,pixels:await readPixels()});
 }
 console.log('MORPHOLOGY_ACQUIRED_RUNTIME '+JSON.stringify(results));
});
