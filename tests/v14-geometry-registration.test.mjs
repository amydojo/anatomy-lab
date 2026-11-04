import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {sha256,fitRigidPairs,registerMesh,evaluateVerification,validateRigidMatrix,candidateDigest,meshSha256,REGISTRATION_POLICY} from '../scripts/geometry/registration.mjs';
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
 laterality:'right',target_laterality:'right',target_frame:'right-knee-source-bone-test',target_units:'m',
 bone_reference_ids:['right-femur','right-tibia'],
 landmarks:{fit:points.slice(0,4),holdout:points.slice(4)}
};
const known=['right-femur','right-tibia'];
const reviewDoc=Buffer.from('synthetic review document for tests only');
const ctx={expectedLaterality:'right',knownBoneReferenceIds:known,qualifiedReviewers:[],reviewRecordBytes:reviewDoc};
const goodCandidate=()=>registerMesh({mesh:m,provenance:p,rawBytes:raw});
const review=c=>({anatomist_approved:true,reviewer_name:'Test Reviewer',reviewer_id:'rev-1',review_date:'2026-01-01',
 review_record_uri:'https://example.org/review/123',review_record_sha256:sha256(reviewDoc),reviewed_candidate_sha256:candidateDigest(c),
 geometry_and_attachments_reviewed:true,orientation_and_clearance_reviewed:true,review_protocol_id:'example-protocol'});
const roster=[{id:'rev-1',name:'Test Reviewer',qualified:true}];
const withRealReview=()=>{const c=goodCandidate();return {...c,review:review(c)};};
const verdict=(rec,over={})=>evaluateVerification(rec,{...ctx,qualifiedReviewers:roster,...over});
const mutate=(fn)=>{const c=structuredClone(withRealReview());fn(c);return c;};
// Anything that edits a candidate must re-bind the review digest, otherwise the review-binding check (correctly) fires too.
const rebound=(fn)=>{const c=structuredClone(goodCandidate());fn(c);c.review=review(c);return c;};
test('known proper rigid rotation/translation fits source with held-out landmarks',()=>{
 const fit=fitRigidPairs(points.slice(0,4));
 assert.ok(fit.rms_mm<1e-4,'fit residual '+fit.rms_mm);
 assert.ok(Math.abs(fit.determinant-1)<1e-8);
 for(const pt of points)for(let j=0;j<3;j++)assert.ok(Math.abs(fit.transform(pt.source)[j]-pt.target[j])<1e-6);
 const result=goodCandidate();
 assert.equal(result.status,'source-registered-unreviewed');
 assert.equal(result.geometry_verified,false);
 assert.ok(result.registration.fit_rms_mm<1e-4);
 assert.ok(result.registration.holdout_rms_mm<1e-4);
 assert.equal(result.mesh.vertices.length,m.vertices.length);
 assert.equal(result.mesh_sha256,meshSha256(result.mesh));
 assert.deepEqual(validateRigidMatrix(result.registration.transform_matrix_metres),[]);
 assert.equal(evaluateVerification(result,ctx).eligible,false);
});
test('source SHA, missing source identity or license fails closed',()=>{
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,original_sha256:'0'.repeat(64)},rawBytes:raw}),/SHA-256 mismatch/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,license:null},rawBytes:raw}),/Missing source identity/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,laterality:'unknown'},rawBytes:raw}),/laterality unresolved/);
});
test('unmatched, collinear or reused landmark evidence fails',()=>{
 const bad={...p,landmarks:{fit:points.slice(0,2),holdout:points.slice(4)}};
 assert.throws(()=>registerMesh({mesh:m,provenance:bad,rawBytes:raw}),/non-coplanar fit and 2 independently/);
 const repeated={...p,landmarks:{fit:points.slice(0,4),holdout:[points[0],points[5]]}};
 assert.throws(()=>registerMesh({mesh:m,provenance:repeated,rawBytes:raw}),/overlap/);
 assert.throws(()=>fitRigidPairs([
 {id:'a',source:[0,0,0],target:[0,0,0]},
 {id:'b',source:[1,0,0],target:[1,0,0]},
 {id:'c',source:[2,0,0],target:[2,0,0]}]),/collinear/);
});
// ---- Negative tests reproducing the bypasses demonstrated in the independent audit -------------------------
test('BYPASS 1 (audit probe 2): mirrored landmark sets are rejected, not returned as candidates',()=>{
 const mirror=l=>l.map(x=>({...x,target:[-x.target[0],x.target[1],x.target[2]]}));
 const planar=[points[0],points[1],points[2],{id:'planar-4',source:[1,1,0],target:rot([1,1,0])}];
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:mirror(planar),holdout:mirror(points.slice(4))}},rawBytes:raw}),/coplanar/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:mirror(points.slice(0,4)),holdout:mirror(points.slice(4))}},rawBytes:raw}),/exceeds screening policy/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:points.slice(0,4),holdout:mirror(points.slice(4))}},rawBytes:raw}),/holdout RMS/);
});
test('BYPASS 2 (audit probe 3): holdout landmarks that duplicate fit coordinates are not independent',()=>{
 const dup=[{...points[0],id:'dupA'},{...points[1],id:'dupB'}];
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:points.slice(0,4),holdout:dup}},rawBytes:raw}),/not independent/);
 const nearly=[{id:'nearA',source:[0.001,0,0],target:rot([0.001,0,0])},points[5]];
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:points.slice(0,4),holdout:nearly}},rawBytes:raw}),/not independent/);
 const twins=[points[4],{...points[4],id:'twin'}];
 assert.throws(()=>registerMesh({mesh:m,provenance:{...p,landmarks:{fit:points.slice(0,4),holdout:twins}},rawBytes:raw}),/not distinct/);
});
test('BYPASS 3 (audit probe 5): fabricated review + non-rigid matrix + wrong laterality + self-reported RMS cannot pass',()=>{
 assert.equal(verdict(withRealReview()).eligible,true,'control: a fully evidenced, rostered, bound review is eligible (never verified)');
 const scaled=mutate(c=>{c.registration.transform_matrix_metres=[2,0,0,0,0,2,0,0,0,0,2,0,0,0,0,1];});
 assert.ok(verdict(scaled).errors.some(e=>/orthonormal|determinant/.test(e)));
 const lefty=mutate(c=>{c.source.laterality='left';c.registration.target_laterality='left';});
 assert.ok(verdict(lefty).errors.some(e=>/does not match expected right/.test(e)));
 const fakeRms=mutate(c=>{c.registration.fit_rms_mm=0;c.registration.holdout_rms_mm=0;c.registration.landmark_evidence.holdout[0].target_m=[9,9,9];});
 assert.ok(verdict(fakeRms).errors.some(e=>/recomputed/.test(e)));
 const noEvidence=mutate(c=>{delete c.registration.landmark_evidence;});
 assert.ok(verdict(noEvidence).errors.some(e=>/cannot be recomputed/.test(e)));
 const hugeButSelfReportedFine=mutate(c=>{
  c.registration.transform_matrix_metres[3]+=0.2; // 200 mm translation error, RMS fields untouched
 });
 assert.ok(verdict(hugeButSelfReportedFine).errors.some(e=>/exceeds screening policy|does not match RMS/.test(e)));
 const badBones=mutate(c=>{c.registration.bone_reference_ids=['made-up-id'];});
 assert.ok(verdict(badBones).errors.some(e=>/Bone reference/.test(e)));
});
test('BYPASS 4: review metadata alone (the audit-demonstrated fake review) never confers eligibility',()=>{
 const c=goodCandidate();
 const fake={...c,geometry_verified:true,review:{anatomist_approved:true,reviewer_name:'Anyone',reviewer_id:'x',review_date:'2026-01-01',
  review_record_uri:'https://example.com/fake',geometry_and_attachments_reviewed:true,orientation_and_clearance_reviewed:true,review_protocol_id:'p'}};
 const v=evaluateVerification(fake,{...ctx,qualifiedReviewers:roster});
 assert.equal(v.eligible,false);assert.equal(v.verified,false);
 assert.ok(v.errors.some(e=>/roster/.test(e)));assert.ok(v.errors.some(e=>/review_record_sha256/.test(e)));assert.ok(v.errors.some(e=>/bound/.test(e)));
 assert.equal(evaluateVerification({...c,review:review(c)},{...ctx,qualifiedReviewers:[]}).eligible,false,'empty roster (the shipped default) can never verify');
 assert.equal(verdict({...c,review:{...review(c),reviewed_candidate_sha256:'0'.repeat(64)}}).eligible,false,'review of a different candidate is not reusable');
 assert.equal(verdict(withRealReview(),{reviewRecordBytes:Buffer.from('other document')}).eligible,false,'review document hash must match');
 assert.equal(verdict(rebound(c=>{c.mesh.vertices[0][0]+=0.5;})).eligible,false,'post-registration mesh tampering is detected by mesh_sha256');
});
test('verification is software eligibility only: verified is never true',()=>{
 const ok=verdict(withRealReview());
 assert.equal(ok.eligible,true);assert.equal(ok.verified,false);assert.equal(ok.status,'eligible-for-human-promotion');
 const bad=verdict(mutate(c=>{c.geometry_verified=true;}));
 assert.equal(bad.verified,false);
 assert.equal(verdict(mutate(c=>{c.kinematics_validated=true;})).eligible,false);
 assert.equal(verdict(mutate(c=>{c.attachment_coordinates_validated=true;})).eligible,false);
});
test('original source file hash is preserved separately from the converted mesh hash',()=>{
 const original=Buffer.from('OBJ-like upstream original bytes');
 const conv={...p,original_sha256:sha256(original),converted_mesh_sha256:sha256(raw),conversion:{tool:'obj2json',version:'test',description:'synthetic converter'}};
 const unverifiedOriginal=registerMesh({mesh:m,provenance:conv,rawBytes:raw});
 assert.equal(unverifiedOriginal.source.original_sha256,sha256(original));
 assert.equal(unverifiedOriginal.source.converted_mesh_sha256,sha256(raw));
 assert.notEqual(unverifiedOriginal.source.original_sha256,unverifiedOriginal.source.converted_mesh_sha256);
 assert.equal(unverifiedOriginal.source.original_bytes_verified,false);
 const u=evaluateVerification({...unverifiedOriginal,review:review(unverifiedOriginal)},{...ctx,qualifiedReviewers:roster});
 assert.ok(u.errors.some(e=>/Original source file hash was not verified/.test(e)));
 const verifiedOriginal=registerMesh({mesh:m,provenance:conv,rawBytes:raw,originalBytes:original});
 assert.equal(verifiedOriginal.source.original_bytes_verified,true);
 assert.throws(()=>registerMesh({mesh:m,provenance:conv,rawBytes:raw,originalBytes:Buffer.from('different')}),/Original source bytes SHA-256 mismatch/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...conv,converted_mesh_sha256:undefined},rawBytes:raw}),/Converted mesh SHA-256 required/);
 assert.throws(()=>registerMesh({mesh:m,provenance:{...conv,converted_mesh_sha256:'1'.repeat(64)},rawBytes:raw}),/Working mesh bytes SHA-256 mismatch/);
});
test('registration policy is explicit, frozen and states it is not clinically validated',()=>{
 assert.equal(REGISTRATION_POLICY.clinically_validated,false);
 assert.equal(REGISTRATION_POLICY.status,'provisional-engineering-screen');
 assert.ok(Object.isFrozen(REGISTRATION_POLICY));
 assert.ok(REGISTRATION_POLICY.min_fit_landmarks>=4);
 assert.ok(/NOT clinically validated|not clinically validated/i.test(fs.readFileSync(new URL('../docs/V14_KNEE_GEOMETRY_PROVENANCE.md',import.meta.url),'utf8')));
});
test('shipped evidence still carries no verified connective geometry and an empty reviewer roster',()=>{
 const evidence=JSON.parse(fs.readFileSync(new URL('../atlas/assets/v14-knee-geometry-evidence.json',import.meta.url)));
 for(const target of evidence.connective_targets){
  assert.equal(target.geometry_verified,false);assert.equal(target.source_asset_id,null);
  assert.equal(target.fit_rms_mm,null);assert.equal(target.holdout_rms_mm,null);
 }
 const roster=JSON.parse(fs.readFileSync(new URL('../atlas/assets/qualified-reviewers.json',import.meta.url)));
 assert.deepEqual(roster.reviewers,[]);
});
test('coverage validator rejects a fabricated geometry_verified claim and passes the shipped manifest',()=>{
 const root=new URL('..',import.meta.url).pathname;
 const run=file=>spawnSync(process.execPath,['scripts/validate_connective_coverage.cjs',...(file?['--coverage',file]:[])],{cwd:root,encoding:'utf8'});
 const base=run();
 assert.equal(base.status,0,base.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'atlas/assets/connective-coverage.json'),'utf8'));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cov-'));
 const write=(name,fn)=>{const c=structuredClone(manifest);fn(c.regions.knee.structures[0]);const f=path.join(tmp,name);fs.writeFileSync(f,JSON.stringify(c));return f;};
 const fabricated=write('fabricated.json',s=>{Object.assign(s,{illustrative:false,illustrative_geometry_id:undefined,illustrative_morphology_validated:undefined,
  geometry_verified:true,mesh_id:'mesh-1',source_uri:'https://example.org/m',license:'CC BY 4.0',sha256:'a'.repeat(64),registration_error_mm:0.1});});
 const r1=run(fabricated);
 assert.notEqual(r1.status,0);assert.match(r1.stderr+r1.stdout,/registration_record|erification gate|Unsupported geometry verification/);
 const c=goodCandidate();const recPath=path.join(tmp,'candidate.json');fs.writeFileSync(recPath,JSON.stringify({...c,review:review(c)}));
 const fake=write('fake-review.json',s=>{Object.assign(s,{illustrative:false,illustrative_geometry_id:undefined,illustrative_morphology_validated:undefined,
  geometry_verified:true,mesh_id:'mesh-1',source_uri:'https://example.org/m',license:'CC BY 4.0',sha256:'a'.repeat(64),registration_error_mm:0.1,registration_record:recPath});});
 const r2=run(fake);
 assert.notEqual(r2.status,0);assert.match(r2.stderr+r2.stdout,/erification gate rejected/);
});
