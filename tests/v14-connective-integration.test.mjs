import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../assets/atlas/connective-intelligence.js');
const knowledge=JSON.parse(fs.readFileSync('atlas/assets/v14-connective-knowledge.json','utf8'));
const coverage=JSON.parse(fs.readFileSync('atlas/assets/connective-coverage.json','utf8'));
const engine=C.create(knowledge,coverage);
const context={window:{},console};
vm.runInNewContext(fs.readFileSync('assets/atlas/atlas-connective.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('assets/atlas/connective-studio-core.js','utf8'),context);
const A=context.window.BodyConnectiveMode, B=context.window.BodyConnectiveStudio;
const make=(cx,cy,cz,w,h,d)=>({vertices:[[cx-w,cy-h,cz-d],[cx+w,cy+h,cz+d],[cx-w,cy+h,cz+d],[cx+w,cy-h,cz-d]]});
const bones={femur:make(0,1,0,.28,.6,.25),tibia:make(0,-.3,0,.22,.6,.22),fibula:make(.30,-.3,0,.06,.57,.10),patella:make(0,.3,.31,.1,.12,.1)};
const meshes=A.buildKnee(bones);
const knee=engine.getStructuresByRegion('knee');
const provider={listStructures:()=>knee.map(r=>({
 id:r.id,region:r.region,name:r.name,
 tissueType:r.tissueClass==='tendon'?'tendons':r.tissueClass==='ligament'?'ligaments':'fibrocartilage',
 geometryStatus:meshes[r.id]?.illustrative?'illustrative':'unavailable',
 selectable:!!meshes[r.id],scientific:engine.getAdapter(r.id)
})),selectStructure:()=>true,focusStructure:()=>true};
test('real A mesh IDs join exactly to C registry for all eight knees',()=>{
 assert.equal(knee.length,8);
 assert.deepEqual(Object.keys(meshes).sort(),knee.map(r=>r.canonicalCoverageId).sort());
 for(const r of knee){const cov=coverage.regions.knee.structures.find(x=>x.id===r.id);
  assert.equal(cov.illustrative_geometry_id,meshes[r.id].id);
  assert.equal(engine.getAdapter(r.id).record.canonicalCoverageId,meshes[r.id].id);
  assert.equal(engine.getGeometryStatus(r.id).geometryVerified,false);
 }
});
test('B selection/isolation/compare/reset exercise actual C records and A mesh IDs',()=>{
 const studio=B.create({provider});
 assert.equal(studio.filtered().length,8);
 const acl='anterior-cruciate-ligament',pcl='posterior-cruciate-ligament';
 assert.equal(studio.selectStructure(acl).id,acl);
 assert.equal(studio.isolateStructure(acl),true);
 assert.equal(studio.snapshot().isolateId,acl);
 assert.equal(studio.compareStructures([acl,pcl]),true);
 assert.deepEqual(studio.snapshot().comparison,[acl,pcl]);
 studio.setTissueVisibility('tendons',false);
 assert.equal(studio.getStructure('quadriceps-tendon').visible,false);
 studio.resetView();
 assert.equal(studio.snapshot().mode,'all');
 assert.equal(studio.snapshot().selectedId,null);
 assert.ok(Object.values(studio.snapshot().visibility).every(Boolean));
 assert.notEqual(engine.getAdapter(acl).record.primaryFunction,engine.getAdapter(pcl).record.primaryFunction);
});
test('missing geometry and knowledge cannot be falsely marked verified',()=>{
 const absent=B.create({provider:{listStructures:()=>[{id:'missing',name:'Missing',region:'knee',tissueType:'ligaments',geometryStatus:'unavailable',selectable:false}]}});
 assert.equal(absent.selectStructure('missing').selectable,false);
 assert.equal(absent.isolateStructure('missing'),false);
 for(const m of coverage.regions.knee.structures)assert.equal(m.geometry_verified,false);
 assert.equal(engine.validate().length,0);
});
test('guided modes resolve C content and all members',()=>{
 for(const id of ['stability','movement','load-distribution']){
  const g=engine.getExploration(id);assert.ok(g?.overview);
  for(const str of g.structureIds)assert.ok(meshes[str]);
 }
});
