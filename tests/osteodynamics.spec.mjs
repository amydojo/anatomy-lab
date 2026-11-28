import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({video:'on'});
test('OSTEODYNAMICS actual source laboratories, equivalent trajectories and rendered review',async({page},info)=>{
 test.setTimeout(420000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/play/?mode=marrow&vehicle=vector&resolution=auto');await page.bringToFront();
 await expect(page.locator('#marrow-hud')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report()),canvas=page.locator('#atlas-canvas');
 await expect.poll(async()=> (await read()).renderer?.vehicleAsset,{timeout:30000}).toBe('vector');
 const result={project:info.project.name,labs:[],limitations:'Source-derived exact triangles, single-authoritative fixed-step replay. Sparse signed ray gaps, not full collision certification. Low-confidence morphology uses geometric tangent directions.'};
 const sources=['FEMUR_LEFT','SCAPULA_LEFT','VERTEBRA_C1','SKULL_CRANIAL_MAXILLA','RIB_1_LEFT'];
 for(const source of sources){
  const lab=await page.evaluate(async source=>{
   const {seedRoutes,replayRoute}=await import('/experiments/hairpin/vector/velocity/osteodynamics-replay.mjs');
   const base='/assets/atlas/vhf/axis/v1/',digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
   const mr=await fetch(base+'manifest.json');if(!mr.ok)throw Error('Source manifest HTTP '+mr.status);const mb=await mr.arrayBuffer();if(await digest(mb)!=='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7')throw Error('Source manifest hash mismatch');
   const manifest=JSON.parse(new TextDecoder().decode(mb)),s=manifest.structures.find(x=>x.source_name===source);if(!s)return {source,status:'manifest-missing',routes:[]};
   const response=await fetch(base+s.file);if(!response.ok)return {source,status:'asset-http-'+response.status,routes:[]};
   const data=await response.arrayBuffer(),hash=await digest(data);if(data.byteLength!==s.bytes||hash!==s.sha256)throw Error('Source integrity '+source);
   const [part]=window.BodyVHF.parse(data,{structures:[{...s,tissue:'Bone'}]},true,true);
   if(part.indices.length/3!==s.triangles)throw Error('Source triangle mismatch '+source);
   const M=window.BodyMarrow,B=window.BodyMarrowBoard,S=window.BodyMarrowSurface,parts=window.BodyVectorRide.parts,w=M.collision([part],null,true);
   const seeds=seedRoutes(w,part,parts,B,M.boardMatrix),routes=[];
   if(seeds.selected)for(const push of [.35,1])for(const approach of ['parallel','diagonal','perpendicular'])routes.push(replayRoute(w,seeds.selected,parts,B,S,M.boardMatrix,{approach,push,steps:240}));
   return {source,id:s.id,sha256:hash,triangles:s.triangles,bytes:s.bytes,status:seeds.selected?'sampled':'no-qualified-seed',seeds,routes};
  },source);
  result.labs.push(lab);fs.writeFileSync(info.outputPath('osteodynamics-labs.json'),JSON.stringify(result,null,2));
  console.log('OSTEO_LAB',JSON.stringify({source:lab.source,status:lab.status,triangles:lab.triangles,seed:lab.seeds?.selected,routes:lab.routes.map(q=>({approach:q.approach,push:q.push,summary:q.summary,motion:q.motion,distance:q.trajectory.rideDistance,losses:q.trajectory.contactLosses,terrainCpu:q.terrain.cpuMs}))}));
 }
 const actual=result.labs.filter(l=>l.status==='sampled');expect(actual.some(l=>l.source==='SKULL_CRANIAL_MAXILLA')).toBe(true);expect(actual.length).toBeGreaterThanOrEqual(2);
 const rows=actual.flatMap(l=>l.routes),negative=mode=>rows.reduce((sum,q)=>sum+q.summary[mode].negativeSamples,0);result.totals={routes:rows.length,negative:{original:negative('original'),legacy:negative('legacy'),adaptive:negative('adaptive')}};
 for(const q of rows){expect(q.motion.maxLift).toBeLessThanOrEqual(.00800001);expect(q.motion.maxTilt).toBeLessThanOrEqual(.12000001);expect(q.rows.length).toBeGreaterThan(0);expect(q.trajectory.remounts).toBe(0);expect(q.trajectory.glideEntries).toBe(0);}
 // Render one exact same-position source route twice in the existing live renderer.
 const cranial=actual.find(l=>l.source==='SKULL_CRANIAL_MAXILLA'),route=cranial.routes.slice().sort((a,b)=>b.summary.legacy.negativeSamples-a.summary.legacy.negativeSamples)[0];
 for(const mode of ['legacy','adaptive']){
  const started=await page.evaluate(({rows,mode})=>window.__MARROW__.beginTerrainReview(rows,mode),{rows:route.rows,mode});expect(started).toBe(true);
  await page.waitForTimeout(2000);await canvas.screenshot({path:info.outputPath('cranial-'+mode+'-mid.png')});
  await page.waitForTimeout(2400);await canvas.screenshot({path:info.outputPath('cranial-'+mode+'-end.png')});await page.evaluate(()=>window.__MARROW__.endTerrainReview());
 }
 // Exercise live research UI separately; no replay or telemetry affects trajectory.
 await page.locator('[data-terrain-mode]').click();await page.locator('[data-terrain-overlay]').click();
 await expect.poll(async()=> (await read()).terrain?.diagnostics?.samples||0,{timeout:15000}).toBeGreaterThan(0);
 const before=await read();await page.keyboard.down('ArrowUp');try{await page.waitForTimeout(4000);}finally{await page.keyboard.up('ArrowUp');}
 result.live={before,after:await read()};await page.screenshot({path:info.outputPath('adaptive-live-probes.png')});
 expect(result.live.after.terrain.mode).toBe('adaptive');expect(result.live.after.terrain.diagnostics.samples).toBeGreaterThan(before.terrain.diagnostics.samples);expect(result.live.after.terrain.history).toBeGreaterThan(1);
 await page.locator('[data-terrain-review]').click();await expect.poll(async()=>!!(await read()).terrain.review).toBe(true);await page.waitForTimeout(500);await page.locator('[data-terrain-mode]').click();await expect.poll(async()=> (await read()).terrain.review?.mode).toBe('legacy');await page.keyboard.press('Escape');await expect.poll(async()=> (await read()).terrain.review).toBeNull();
 await page.locator('[data-terrain-mode]').click();expect((await read()).terrain.mode).toBe('legacy');expect(errors).toEqual([]);
 fs.writeFileSync(info.outputPath('osteodynamics-labs.json'),JSON.stringify(result,null,2));
 // Research candidate must reduce the aggregate sampled deficits; all individual failures remain in the artifact.
 expect(result.totals.negative.adaptive).toBeLessThanOrEqual(result.totals.negative.legacy);
});
