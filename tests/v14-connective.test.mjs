import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../assets/atlas/atlas-connective.js',import.meta.url),'utf8'),context,{filename:'atlas-connective.js'});
const api=context.window.BodyConnectiveMode;
const make=(cx,cy,cz,w,h,d)=>({vertices:[[cx-w,cy-h,cz-d],[cx+w,cy+h,cz+d],[cx-w,cy+h,cz+d],[cx+w,cy-h,cz-d]]});
const bones={femur:make(0,1,0,.28,.6,.25),tibia:make(0,-.3,0,.22,.6,.22),fibula:make(.30,-.3,0,.06,.57,.10),patella:make(0,.3,.31,.1,.12,.1)};
test('V14: knee build creates exactly eight independent, finite illustrative meshes',()=>{
 const parts=api.buildKnee(bones),ids=api.records().map(p=>p.id);
 assert.equal(ids.length,8);
 assert.equal(Object.keys(parts).sort().join('|'),ids.slice().sort().join('|'));
 for(const id of ids){
  const p=parts[id];assert.equal(p.illustrative,true);
  assert.ok(p.vertices.length>=50&&p.faces.length>=50,id);
  assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)),id+' finite');
  assert.ok(p.faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length)),id+' topology');
  const info=api.info(id);assert.ok(info.verification.includes('NOT independently verified'));assert.ok(info.source.startsWith('https://'));
 }
});
test('V14: missing bone source refuses geometry rather than fabricating provenance',()=>{
 assert.throws(()=>api.buildKnee({tibia:bones.tibia}),/registered femur source bone/);
 assert.equal(api.info('imaginary-meniscus'),null);
});
test('V14: coverage manifest must never call the eight illustrations source verified',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../atlas/assets/connective-coverage.json',import.meta.url),'utf8'));
 const ids=api.records().map(p=>p.id);
 assert.equal(c.regions.knee.structures.map(p=>p.id).sort().join('|'),ids.sort().join('|'));
 for(const p of c.regions.knee.structures){assert.equal(p.geometry_verified,false);assert.equal(p.illustrative,true);assert.equal(p.attachment_coordinates_validated,false);assert.equal(p.kinematics_validated,false);assert.equal(p.registration_error_mm,null);assert.equal(p.mesh_id,null);}
 for(const [region,d] of Object.entries(c.regions))if(region!=='knee')for(const p of d.structures)assert.equal(p.illustrative,false);
});
