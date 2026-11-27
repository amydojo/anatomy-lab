import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('FIRST RIDE equivalent-condition performance and bottleneck isolation',async({page},info)=>{
 test.setTimeout(240000);
 const baseline=process.env.KINETIC_BASELINE,candidate=process.env.VELOCITY_CANDIDATE;
 test.skip(!baseline||!candidate,'Requires verified actual assets');
 const result={project:info.project.name,measurements:{},limitations:'Same runner/page, CSS area, hover/replay controls; submitted-frame and CPU submission timing; asynchronous disjoint timer when supported. CI renderer is not physical-device certification.'};
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
  expect(rows[0].renderer.cssWidth).toBeGreaterThan(0);expect(rows[0].renderer.gpuTimeMs).toHaveProperty('supported');
  await page.locator('#vehicle').screenshot({path:info.outputPath(edition+'-fit.png')});
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
  if(edition==='velocity'){
   for(const [label,query] of [['scalar-same-geometry','material=scalar'],['normal-disabled','material=no-normal'],['half-backing-resolution','resolution=.5']]){
    await page.goto('/experiments/hairpin/?edition=velocity&'+query);
    await page.locator('#vector-file').setInputFiles(file);
    await expect.poll(()=>page.evaluate(()=>window.__ATELIER__?.report().ready),{timeout:30000}).toBe(true);
    await page.evaluate(()=>{window.__ATELIER__.view('hero');window.__ATELIER__.state('hover');});
    const row=await measure(label);expect(row.triangles).toBe(rows[0].triangles);expect(row.renderer.cssWidth).toBe(rows[0].renderer.cssWidth);expect(row.renderer.cssHeight).toBe(rows[0].renderer.cssHeight);
    if(label==='half-backing-resolution'){expect(row.renderer.backingWidth).toBeLessThan(rows[0].renderer.backingWidth);expect(row.renderer.backingHeight).toBeLessThan(rows[0].renderer.backingHeight);}
    rows.push(row);await page.evaluate(()=>window.__ATELIER__.dispose());
   }
  }
  fs.writeFileSync(info.outputPath('equivalent-performance.json'),JSON.stringify(result,null,2));
 }
});
