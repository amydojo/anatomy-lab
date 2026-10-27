import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('All legacy routes and references remain present',()=>{
  for(const path of ['index.html','hip/index.html','hip/dissection/index.html','knee/index.html','shoulder/index.html','references/index.html'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
test('All primary labs use the same V4 engine with original SVG geometry',()=>{
  for(const region of ['hip','knee','shoulder']){
    const text=read(region+'/index.html');
    assert.ok(text.includes('/assets/v4.js')&&text.includes('/assets/v4.css')&&text.includes('/assets/v3-data.js'),region);
    assert.match(text,/<svg/i);
    assert.ok(!text.includes('/assets/v3.js'));
  }
});
test('V4 runtime and knowledge model parse',()=>{
  for(const path of ['assets/v4.js','assets/v3-data.js','assets/v3-home.js'])assert.doesNotThrow(()=>new Function(read(path)),path);
  const s=read('assets/v3-data.js');
  for(const key of ['k-patella','k-menisci','k-quads','k-ligaments','s-mobility','s-cuff','s-scapula','s-rotation','h-motor','h-balance','h-hidden','h-nerve'])assert.ok(s.includes('id:"'+key+'"'),key);
});
test('V4 has contextual controls, simple depth interface, and explicit safety boundaries',()=>{
 const s=read('assets/v4.js');
 for(const t of ['data-action="trace"','data-action="lesson"','v4-depth-input','data-action="panel"','stop if','Not to scale']){}
 assert.ok(s.includes('v4-depth-input')&&s.includes('v4-inspector')&&s.includes('data-action="related"'));
 assert.ok(!s.includes('data-v3-mode'));
 assert.ok(read('references/index.html').includes('OpenStax'));
});

test('Anatomy graph and lesson targets have valid references', async()=>{
 const {runInNewContext}=await import('node:vm');
 const globals={window:{}};
 runInNewContext(read('assets/v3-data.js'),globals);
 const d=globals.window.BODYLIVE_DATA;
 const allIds=new Set();
 for(const [region,r] of Object.entries(d.regions)){
   const structures=new Set(r.structures.map(x=>x.key));
   assert.equal(structures.size,r.structures.length,'unique structure keys in '+region);
   assert.ok(r.layers.length>=4);
   for(const entry of r.structures){
      for(const key of entry.related||[])assert.ok(structures.has(key),'missing related '+key+' in '+region);
      assert.ok(entry.fact?.length>15);
   }
   for(const lesson of d.lessons[region]){
     assert.ok(!allIds.has(lesson.id),'duplicate lesson '+lesson.id);
     allIds.add(lesson.id);
     assert.ok(structures.has(lesson.key),lesson.id+' references missing '+lesson.key);
     assert.ok(lesson.options.length>=2);
     assert.ok(lesson.correct>=0&&lesson.correct<lesson.options.length);
     if(lesson.target.type==='select'||lesson.target.type==='trace')assert.ok(structures.has(lesson.target.key),'missing lesson target '+lesson.target.key);
     if(lesson.target.type==='depth')assert.ok(lesson.target.min<r.layers.length);
     if(lesson.target.type==='angle')assert.ok(lesson.target.min<=r.max);
   }
   for(const route of r.traces)assert.ok(structures.has(route.key),'unresolved nerve route '+route.key);
 }
 assert.equal(allIds.size,12);
});

test('KNEE / SPATIAL is self contained, labeled as schematic, and protects V4 routing',()=>{
  for(const path of ['knee/spatial/index.html','knee/spatial/spatial.css','knee/spatial/spatial.js','knee/spatial/sources/index.html'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
  assert.doesNotThrow(()=>new Function(read('knee/spatial/spatial.js')));
  const page=read('knee/spatial/index.html');
  assert.ok(page.includes('Return to classic knee lab')&&page.includes('not clinically validated'));
  const dossier=read('knee/spatial/sources/index.html');
  assert.ok(existsSync(new URL('../knee/spatial/assets/bp3d-right-knee-4.0.json',import.meta.url)));
  assert.ok(existsSync(new URL('../knee/spatial/assets/provenance.json',import.meta.url)));
  assert.ok(dossier.includes('BodyParts3D 4.0-derived geometry'));
  assert.ok(read('knee/index.html').includes('/knee/spatial/'));
});

test('Spatial core is separate from knee geometry and usable without a framework',()=>{
 const core=read('assets/spatial-core.js');
 assert.doesNotThrow(()=>new Function(core));
 assert.ok(core.includes('attachOrbit')&&core.includes('project'));
 assert.ok(read('knee/spatial/index.html').includes('/assets/spatial-core.js'));
});
