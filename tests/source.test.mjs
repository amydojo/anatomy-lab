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

test('spatial core preserves pairwise length during rigid knee rotations',()=>{
 const host={};
 new Function('window',read('assets/spatial-core.js'))(host);
 const rotate=host.BodySpatialCore.rotateAboutX;
 const pivot={x:0,y:0.08,z:0};
 const first={x:0.15,y:-0.11,z:0.05};
 const second={x:-0.17,y:-0.41,z:-0.13};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const degrees of [0,30,65,90,110]){
   const theta=degrees*Math.PI/180;
   const a=rotate(first,pivot,theta),b=rotate(second,pivot,theta);
   assert.ok(Math.abs(dist(a,b)-dist(first,second))<1e-10,'rigid distance '+degrees);
   const inverse=rotate(a,pivot,-theta);
   assert.ok(dist(inverse,first)<1e-10,'rotation reversibility '+degrees);
 }
});

test('V5.2 sourced landmarks snap to bone vertices and remain attached at all flexion poses',()=>{
 const host={};
 new Function('window',read('knee/spatial/attachment-graph.js'))(host);
 const model=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const meshes=Object.fromEntries(Object.entries(model.bone_meshes).map(([bone,d])=>[
   bone,{verts:d.vertices.map(([x,y,z])=>({x,y,z}))}
 ]));
 const graph=host.KneeAttachmentGraph.create(meshes);
 assert.equal(Object.keys(graph.anchors).length,14);
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const anchor of Object.values(graph.anchors)){
   const source=meshes[anchor.bone].verts[anchor.sourceIndex];
   assert.ok(dist(anchor.base,source)<1e-12,anchor.id+' lost source correspondence');
   assert.equal(anchor.status,'estimated/unreviewed');
 }
 for(const angle of [0,30,60,90,110]){
   for(const a of Object.values(graph.anchors)){
     const current=graph.at(a.id,angle);
     const boneWorld=graph.transform(a.bone,meshes[a.bone].verts[a.sourceIndex],angle);
     assert.ok(dist(current,boneWorld)<1e-10,'detached '+a.id+' at '+angle);
   }
   for(const [id,link] of Object.entries(graph.links)){
     const line=graph.guide(id,angle);
     assert.ok(dist(line.from,graph.at(link.from,angle))<1e-10,id+' start detached');
     assert.ok(dist(line.to,graph.at(link.to,angle))<1e-10,id+' end detached');
     assert.ok(line.vertices.every(v=>[v.x,v.y,v.z].every(Number.isFinite)));
   }
 }
 const femur='acl.femur',tibia='acl.tibia';
 assert.ok(dist(graph.at(femur,0),graph.at(femur,110))<1e-10,'static femur moved');
 assert.ok(dist(graph.at(tibia,0),graph.at(tibia,110))>.04,'moving tibia did not move');
 for(const bone of ['tibia','fibula','patella']){
   const a=meshes[bone].verts[0],b=meshes[bone].verts[Math.min(55,meshes[bone].verts.length-1)];
   const baseline=dist(a,b);
   for(const angle of [0,45,90,110])
     assert.ok(Math.abs(dist(graph.transform(bone,a,angle),graph.transform(bone,b,angle))-baseline)<1e-8,'bone warped '+bone);
 }
});
test('V5.2 attachment graph and inspector are included in the published knee route',()=>{
 const page=read('knee/spatial/index.html'),logic=read('knee/spatial/spatial.js');
 assert.ok(page.includes('/knee/spatial/attachment-graph.js'));
 assert.ok(page.includes('id="follow"'));
 assert.ok(page.includes('id="attachment-info"'));
 assert.ok(logic.includes('attachmentGraph.transform(bone,p,state.flex)'));
 assert.ok(logic.includes('attachmentGraph.guide(edge,state.flex)'));
 assert.ok(logic.includes('estimated')||read('knee/spatial/attachment-graph.js').includes('estimated/unreviewed'));
});

test('V5.3 hip route is real, reuses the spatial core, and preserves the original dissection',()=>{
 for(const path of ['hip/spatial/index.html','hip/spatial/hip.css','hip/spatial/hip.js',
   'hip/spatial/sources/index.html','hip/spatial/assets/hip-source.json','hip/spatial/assets/provenance.json']){
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 const html=read('hip/spatial/index.html');
 assert.ok(html.includes('/assets/spatial-core.js'));
 assert.ok(html.includes('/hip/spatial/hip.js'));
 assert.ok(html.includes('/hip/dissection/'));
 assert.ok(read('hip/index.html').includes('/hip/spatial/'));
 assert.doesNotThrow(()=>new Function(read('hip/spatial/hip.js')));
 const scene=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const proof=JSON.parse(read('hip/spatial/assets/provenance.json'));
 assert.equal(Object.keys(scene.parts).length,11);
 assert.equal(scene.license,'CC BY 4.0');
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.biomechanics_validated,false);
 assert.ok(read('hip/spatial/sources/index.html').toLowerCase().includes('z-anatomy'));
});
test('V5.3 hip motion models are intentionally schematic, not clinical simulations',()=>{
 const s=read('hip/spatial/hip.js');
 for(const v of ['flexion','abduction','rotation','SCIATIC PATH','piriformis','gluteus medius','sourceLoaded'])
  assert.ok(s.toLowerCase().includes(v.toLowerCase()),v);
 assert.ok(s.includes('NOT validated joint kinematics'));
 assert.ok(s.includes("data.parts")||s.includes("d.parts"));
});

test('V5.4 sciatic geometry imported separately from medical imaging',()=>{
 const asset=JSON.parse(read('hip/spatial/assets/sciatic-source.json'));
 const proof=JSON.parse(read('hip/spatial/assets/sciatic-provenance.json'));
 assert.equal(asset.geometry_license,'CC BY-SA 4.0');
 assert.equal(asset.not_patient_specific,true);
 assert.equal(asset.clinical_reviewed,false);
 assert.deepEqual(Object.keys(asset.segments).sort(),['commonFibular','sciatic','tibial']);
 assert.equal(proof.status.imaging_derived,false);
 assert.equal(proof.micro_ct_2026.imported,false);
 assert.ok(read('hip/spatial/hip.js').includes('loadNerveTruth'));
 assert.ok(read('hip/spatial/index.html').includes('id="nerve-evidence"'));
 assert.ok(read('hip/spatial/sources/index.html').includes('Mixed-source registration'));
});

test('V5.5 nerve graph: anatomical hierarchy separated from unverified source surface seams',()=>{
 const host={};
 new Function('window',read('hip/spatial/nerve-follow.js'))(host);
 const d=JSON.parse(read('hip/spatial/assets/sciatic-source.json'));
 const g=host.BodyNerveFollow.create(d);
 assert.deepEqual(g.segments,['sciatic','tibial','commonFibular']);
 assert.equal(g.parents.sciatic,null);
 for(const id of ['sciatic','tibial','commonFibular']){
   assert.ok(g.branches[id].length>.2);
   assert.ok(g.topology[id].count>=1);
   const curve=g.branches[id];
   assert.ok(curve.proximal[1]>curve.distal[1],id+' path should travel inferiorly');
   let prev=null;
   for(let step=0;step<=100;step++){
     const p=g.sample(id,step/100);
     assert.ok(p.every(Number.isFinite));
     if(prev)assert.ok(host.BodyNerveFollow.dist(p,prev)<=curve.length/100*1.15,'arc-length jump '+id);
     prev=p;
   }
 }
 for(const id of ['tibial','commonFibular']){
   assert.equal(g.parents[id],'sciatic');
   assert.equal(g.junctions[id].displayedAsContinuousSource,false);
   assert.ok(g.junctions[id].sourceGap>0);
   assert.ok(g.junctions[id].guidance.length>30);
 }
 assert.equal(g.imagingDerived,false);
 assert.equal(g.anatomistReviewed,false);
});
test('V5.5 Hip/Knee source-frame conversion matches 480 corresponding femur vertices',()=>{
 const host={};
 new Function('window',read('assets/hip-knee-bridge.js'))(host);
 const hip=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const knee=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const b=host.BodyHipKneeBridge;
 const result=b.verify(hip,knee);
 assert.equal(result.matchedVertices,480);
 assert.ok(result.verifiedWithinSourceRounding);
 assert.ok(result.maximumSceneUnits<.00005);
 assert.equal(result.establishesNervePlacement,false);
 for(const p of [[1,2,3],[-.5,0,1]]){
   const roundTrip=b.hipToKnee(b.kneeToHip(p));
   assert.ok(Math.hypot(...roundTrip.map((v,i)=>v-p[i]))<1e-9);
 }
 const source=read('assets/spatial-core.js');
 assert.ok(source.includes('camera.target||{x:0,y:0,z:0}'));
});
test('V5.5 mobile Follow controls and source mode do not claim patient images',()=>{
 const hip=read('hip/spatial/index.html'),js=read('hip/spatial/hip.js'),css=read('hip/spatial/hip.css');
 for(const path of ['hip/spatial/nerve-follow.js','assets/hip-knee-bridge.js'])assert.ok(existsSync(new URL('../'+path,import.meta.url)));
 for(const phrase of ['id="follow-stage"','id="follow-progress"','id="follow-branch"','data-nerve-frame="atlas"','data-nerve-frame="composite"'])
   assert.ok(hip.includes(phrase),phrase);
 assert.ok(js.includes('startFollow'));
 assert.ok(js.includes('stopFollow'));
 assert.ok(js.includes('sourceTrace'));
 assert.ok(js.includes('HIP ↔ KNEE FRAME VERIFIED'));
 assert.ok(css.includes('.nerve-follow-stage'));
 assert.ok(js.includes('if(!nerveTruth)'));
});

test('V6 whole-body Atlas has evidence-safe source assets and interactive navigation',()=>{
 for(const path of ['atlas/index.html','atlas/atlas.css','atlas/sources/index.html','atlas/assets/body-skeleton.json','atlas/assets/provenance.json','assets/atlas/atlas-state.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-evidence.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js']){
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 const asset=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const proof=JSON.parse(read('atlas/assets/provenance.json'));
 assert.equal(asset.schema,'body-live/atlas-skeleton-v1');
 assert.equal(asset.parts.length,78);assert.equal(proof.part_count,78);
 assert.equal(proof.anatomist_reviewed,false);assert.equal(asset.license,'CC BY 4.0');
 assert.ok(read('assets/atlas/atlas-controller.js').includes('not reconstructed continuously'));
 for(const path of ['assets/atlas/atlas-state.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-evidence.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js']){
  assert.doesNotThrow(()=>new Function(read(path)));
 }
});
