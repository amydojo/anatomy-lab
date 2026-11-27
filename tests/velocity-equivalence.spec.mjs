import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('FIRST RIDE equivalent-condition performance and bottleneck isolation',async({page},info)=>{
 test.setTimeout(150000);
 const baseline=process.env.KINETIC_BASELINE,candidate=process.env.VELOCITY_CANDIDATE;
 test.skip(!baseline||!candidate,'Requires verified actual assets');
 const result={project:info.project.name,measurements:{},limitations:'Same runner/page, CSS area, hover/replay controls; callback and CPU submission timing, not GPU timer or hardware certification.'};
 async function measure(label,ms=4000){
  await page.evaluate(()=>window.__ATELIER__.benchmark());
  await page.waitForTimeout(ms);
  const r=await page.evaluate(()=>window.__ATELIER__.report());
  expect(r.ready).toBe(true);expect(r.renderer.glError).toBe(0);expect(r.frameMs.samples).toBeGreaterThan(10);
  return {label,...r};
 }
 for(const [edition,file] of [['kinetic',baseline],['velocity',candidate]]){
  await page.goto('/experiments/hairpin/?edition='+edition);
  await page.locator('#vector-file').setInputFiles(file);
  await expect.poll(()=>page.evaluate(()=>window.__ATELIER__?.report().ready),{timeout:30000}).toBe(true);
  await page.evaluate(()=>{window.__ATELIER__.view('hero');window.__ATELIER__.state('hover');});
  const rows=[await measure('full-shaded-hover')];
  await page.locator('#kinetic-play').click();
  rows.push(await measure('full-shaded-replay',6000));
  await page.locator('#kinetic-play').click();
  await page.evaluate(()=>window.__ATELIER__.state('hover'));
  await page.evaluate(()=>window.__ATELIER__.form(1));
  rows.push(await measure('full-silhouette-hover'));
  await page.evaluate(()=>{window.__ATELIER__.form(0);const s=document.querySelector('.stage'),r=s.getBoundingClientRect();s.style.width=(r.width*.5)+'px';s.style.height=(r.height*.5)+'px';});
  rows.push(await measure('half-width-height-shaded-hover'));
  result.measurements[edition]=rows;
  await page.evaluate(()=>window.__ATELIER__.dispose());
  fs.writeFileSync(info.outputPath('equivalent-performance.json'),JSON.stringify(result,null,2));
 }
});
