import {test,expect} from '@playwright/test';
import {PNG} from 'pngjs';
import {writeFileSync} from 'node:fs';
function painted(buffer){const image=PNG.sync.read(buffer);let pixels=0;for(let i=0;i<image.data.length;i+=4){const [r,g,b]=image.data.subarray(i,i+3);if(r>60&&g>40&&b>35)pixels++;}return pixels;}
test('source-native tissue draws real geometry and controls work',async({page},info)=>{
 test.setTimeout(90000);const requests=[],errors=[];page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/atlas/strata/');await expect(page.locator('#status')).toContainText('Manifest verified');expect(requests).toHaveLength(0);
 await page.locator('#layer').selectOption('left-ligament');await page.locator('#load').click();await expect(page.locator('#status')).toContainText('4 structures · 13754 triangles',{timeout:30000});
 const canvas=page.locator('#view');const full=await canvas.screenshot({path:info.outputPath('strata-ligament.png')});expect(painted(full)).toBeGreaterThan(100);
 const opts=await page.locator('#isolate option').allTextContents();expect(opts).toHaveLength(5);await page.locator('#isolate').selectOption({index:1});await expect.poll(async()=>painted(await canvas.screenshot())).toBeLessThan(painted(full));
 await page.locator('#query').fill('no-such-structure');await expect.poll(async()=>painted(await canvas.screenshot())).toBe(0);
 await page.locator('#query').fill('');await page.locator('#layer').selectOption('left-muscle');await page.locator('#load').click();await expect(page.locator('#status')).toContainText('38 structures · 642156 triangles',{timeout:45000});
 const muscle=await canvas.screenshot({path:info.outputPath('strata-muscle.png')});expect(painted(muscle)).toBeGreaterThan(100);expect(requests).toHaveLength(2);expect(errors).toEqual([]);
 const report={browser:info.project.name,geometryRequests:requests.length,paintedLigamentPixels:painted(full),paintedMusclePixels:painted(muscle),muscleTiming:await page.locator('#status').textContent()};writeFileSync(info.outputPath('strata-measurements.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await expect(page.locator('#history')).toContainText('sacrum_coccyx');await expect(page.locator('#history')).toContainText('median, centroidDelta');
});
test('corrupt tissue response is rejected before drawing',async({page})=>{
 await page.route('**/vhf-left-ligament.glb',route=>route.fulfill({status:200,body:'invalid'}));await page.goto('/atlas/strata/');await expect(page.locator('#status')).toContainText('Manifest verified');await page.locator('#layer').selectOption('left-ligament');await page.locator('#load').click();await expect(page.locator('#status')).toContainText('Bundle integrity failure');expect(painted(await page.locator('#view').screenshot())).toBe(0);
});
