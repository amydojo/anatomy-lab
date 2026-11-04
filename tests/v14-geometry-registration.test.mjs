import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,fitRigidPairs,registerMesh,evaluateVerification} from '../scripts/geometry/registration.mjs';
import fs from 'node:fs';
const m={vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],faces:[[0,1,2],[0,1,3],[0,2,3],[1,2,3]]};
const raw=Buffer.from(JSON.stringify(m));
const rot=([x,y,z])=>[-y+1,x+2,z+3];
const points=[
 {id:'source-A',source:[0,0,0]}, {id:'source-B',source:[1,0,0]},
 {id:'source-C',source:[0,1,0]}, {id:'source-D',source:[0,0,1]},
 {id:'holdout-E',source:[1,1,0]}, {id:'holdout-F',source:[1,0,1]}
].map(p=>({...p,target:rot(p.source)}));
const p={
 source_uri:'https://example.org/doi/source-mesh',source_asset_id:'right-acl-original-123',
 license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',
 attribution:'Original source creator — synthetic test',original_sha256:sha256(raw),
 source_coordinate_system:'Y-up, right-handed synthetic test',source_units:'m',
 laterality:'right',target_frame:'right-knee-source-bone-test',target_units:'m',
 bone_reference_ids:['right-femur','right-tibia'],
 landmarks:{fit:points.slice(0,4),holdout:points.slice(4)}
};
test('known proper rigid rotation/translation fits source with held-out landmarks',()=>{
 const fit=fitRigidPairs(points.slice(0,4));
 assert.ok(fit.rms_mm<1e-4,'fit residual '+fit.rms_mm);
 assert.ok(Math.abs(fit.determinant-1)<1e-8);
 for(const pt of points)for(let j=0;j<3;j++)assert.ok(Math.abs(fit.transform(pt.source)[j]-pt.target[j])<1e-6);
 const result=registerMesh({mesh:m,provenance:p,rawBytes:raw});
 assert.equal(result.status,'source-registered-unreviewed');
 assert.equal(result.geometry_verified,false);
 assert.ok(result.registration.fit_rms_mm<1e-4);
 assert.ok(result.registration.holdout_rms_mm<1e-4);
 assert.equal(result.mesh.vertices.length,m.vertices.length);
 assert.deepEqual(evaluateVerification(result).eligible,false);
});
test('source SHA, missing source identity or license fails closed',()=>{
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,original_sha256:'0'.repeat(64)},rawBytes:raw}),/SHA-256 mismatch/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,license:null},rawBytes:raw}),/Missing source identity/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,laterality:'unknown'},rawBytes:raw}),/laterality unresolved/);
});
test('unmatched, collinear or reused landmark evidence fails',()=>{
 const bad={...p,landmarks:{fit:points.slice(0,2),holdout:points.slice(4)}};
 assert.throws(()=>registerMesh({mesh:m,provenance:bad,rawBytes:raw}),/three fit/);
 const repeated={...p,landmarks:{fit:points.slice(0,4),holdout:[points[0],points[5]]}};
 assert.throws(()=>registerMesh({mesh:m,provenance:repeated,rawBytes:raw}),/overlap/);
 assert.throws(()=>fitRigidPairs([
 {id:'a',source:[0,0,0],target:[0,0,0]},
 {id:'b',source:[1,0,0],target:[1,0,0]},
 {id:'c',source:[2,0,0],target:[2,0,0]}]),/collinear/);
});
test('verification gate cannot be bypassed with citation text or invented review boolean',()=>{
 const candidate=registerMesh({mesh:m,provenance:p,rawBytes:raw});
 const mutated={...candidate,geometry_verified:true,review:{anatomist_approved:true}};
 const verdict=evaluateVerification(mutated);
 assert.equal(verdict.eligible,false);
 assert.ok(verdict.errors.some(x=>x.includes('review')));
 const evidence=JSON.parse(fs.readFileSync(new URL('../atlas/assets/v14-knee-geometry-evidence.json',import.meta.url)));
 for(const target of evidence.connective_targets){
  assert.equal(target.geometry_verified,false);
  assert.equal(target.source_asset_id,null);
  assert.equal(target.fit_rms_mm,null);
  assert.equal(target.holdout_rms_mm,null);
 }
});
test('geometry verified requires independent review metadata and registration evidence',()=>{
 const candidate=registerMesh({mesh:m,provenance:p,rawBytes:raw});
 const withReview={...candidate,review:{anatomist_approved:true,reviewer_name:'Example reviewer',
  review_date:'2026-01-01',review_record_uri:'https://example.org/review/123',
  geometry_and_attachments_reviewed:true,orientation_and_clearance_reviewed:true,review_protocol_id:'example-protocol'}};
 assert.equal(evaluateVerification(withReview).eligible,true);
 const withoutHoldouts=structuredClone(withReview);
 withoutHoldouts.registration.holdout_landmark_ids=[];
 assert.equal(evaluateVerification(withoutHoldouts).eligible,false);
});
