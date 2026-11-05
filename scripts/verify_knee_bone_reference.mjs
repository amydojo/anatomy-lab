#!/usr/bin/env node
/* Reproduce knee bone reference-frame geometry checks without network access.
 * The residual is a BOUNDING-BOX TRANSFORM FIDELITY check, NOT a measured
 * anatomical landmark/ACL attachment registration error.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertMesh,sha256} from './geometry/registration.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const evidence=read('atlas/assets/v14-knee-geometry-evidence.json');
const provenance=read('knee/spatial/assets/provenance.json');
const asset=read('knee/spatial/assets/bp3d-right-knee-4.0.json');
const coverage=read('atlas/assets/connective-coverage.json');
function verify(){
 assert.equal(evidence.schema,'body-live/v14-knee-geometry-evidence-v1');
 assert.equal(evidence.expected_laterality,'right');
 assert.equal(evidence.source_reference.pin,provenance.upstream_commit);
 assert.equal(evidence.source_reference.chunk_source_sha256,provenance.packed_chunk.sha256);
 assert.equal(evidence.source_reference.atlas_source_sha256,provenance.atlas.sha256);
 assert.equal(evidence.source_reference.license,asset.license);
 assert.equal(evidence.source_reference.license, 'CC BY 4.0');
 assert.deepEqual(evidence.source_reference.transform.origin_metres,asset.aligned_shared_transform.origin_metres);
 assert.equal(evidence.source_reference.transform.scale_to_scene,asset.aligned_shared_transform.scale_to_scene);
 const origin=asset.aligned_shared_transform.origin_metres,s=asset.aligned_shared_transform.scale_to_scene;
 const traces=[];
 for(const ref of evidence.source_reference.bone_references){
  const src=provenance.meshes[ref.name],mesh=asset.bone_meshes[ref.name];
  assert.ok(src&&mesh,'Missing source bone '+ref.name);
  assert.equal(src.id,ref.id);assert.equal(src.fma,ref.fma);assert.equal(mesh.fma,ref.fma);
  assert.equal(src.original_name,'Right '+ref.name);assert.equal(ref.laterality,'right');
  assertMesh(mesh);
  assert.equal(mesh.vertices.length,src.source_vertex_count);
  assert.equal(mesh.faces.length,src.source_triangle_count);
  const min=[0,1,2].map(j=>Math.min(...mesh.vertices.map(v=>v[j])));
  const max=[0,1,2].map(j=>Math.max(...mesh.vertices.map(v=>v[j])));
  const residual_mm=Math.max(...[0,1,2].flatMap(j=>
   [Math.abs((min[j]/s+origin[j])-src.source_bounds_metres.min[j])*1000,
    Math.abs((max[j]/s+origin[j])-src.source_bounds_metres.max[j])*1000]));
  assert.ok(Number.isFinite(residual_mm)&&residual_mm<=0.02,'Unexpected shared transform/bbox discrepancy '+ref.name+': '+residual_mm+' mm');
  traces.push({bone:ref.name,original_asset_id:src.id,fma:ref.fma,source_vertices:src.source_vertex_count,
   source_triangles:src.source_triangle_count,bbox_transform_fidelity_error_mm:Number(residual_mm.toFixed(6)),
   landmark_registration_error_mm:null,reviewed:false});
 }
 const ids=new Set(evidence.connective_targets.map(x=>x.id));
 const knee=coverage.regions.knee.structures;
 assert.equal(ids.size,8);
 assert.deepEqual([...ids].sort(),knee.map(x=>x.id).sort());
 for(const r of evidence.connective_targets){
  const c=knee.find(x=>x.id===r.id);
  assert.equal(r.status,'illustrative-fallback');
  assert.equal(r.geometry_verified,false);
  assert.equal(c.geometry_verified,false);
  assert.equal(r.fit_rms_mm,null);assert.equal(r.holdout_rms_mm,null);
  assert.equal(r.original_asset_sha256,null);
  assert.equal(r.licensed_source_mesh_confirmed,false);
 }
 return {schema:'body-live/knee-source-reference-audit-v1',status:'passed-static-bone-reference-transforms',
  alignment_metric:'bounding-box transform fidelity, NOT anatomical landmark registration',
  local_export_sha256:sha256(fs.readFileSync(path.join(root,evidence.source_reference.local_asset))),
  source_chunk_sha256_in_manifest:provenance.packed_chunk.sha256,
  source_chunk_rehashed_live:false,
  meshes:traces,illustrative_connective_targets:ids.size,source_registered_connective_targets:0,
  geometry_verified_connective_targets:0,
  limitations:evidence.scientific_limitations};
}
const result=verify();
const out=process.argv.indexOf('--out');
if(out>=0){if(!process.argv[out+1])throw Error('--out path required');const dest=path.resolve(process.argv[out+1]);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
export {verify};
