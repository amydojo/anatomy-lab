/* V10: immutable BodyParts3D 3.0 facial-muscle reference validation.
 * Original geometry remains separately attributed under CC BY-SA 2.1 Japan.
 * Static educational overlay only; not jaw-muscle biomechanics.
 */
(function(){'use strict';
function verify(asset,proof,skeleton,v8,v9){
 if(asset?.schema!=='body-live/v10-facial-source-v1'||
    proof?.schema!=='body-live/v10-facial-provenance-v1'||
    asset.source_commit!==proof.pinned_omf_commit||
    asset.base_source_commit!==skeleton.source_commit||
    skeleton.source_commit!==v8.source_commit||v8.source_commit!==v9.source_commit)
   throw Error('V10 facial source identity mismatch');
 if(asset.license!=='CC-BY-SA-2.1-JP'||proof.license!==asset.license||
    proof.pinned_omf_commit!=='c835665a9ade09ee0b993cee6eee1b25b7f7311b'||
    proof.facial_bin_git_blob!=='0332821585e1b03ac4258d891b3ec220ab3ff30a')
   throw Error('V10 mixed or unpinned facial source');
 if(window.BodyAtlasLoader.digest('facialV10')!==proof.asset_sha256)
   throw Error('V10 facial geometry SHA mismatch');
 if(asset.source_frame?.scale!==5||JSON.stringify(asset.source_frame?.origin_metres)!=='[0,0.9,0]')
   throw Error('V10 canonical skull transform mismatch');
 if(proof.anatomist_reviewed!==false||proof.jaw_dynamics_validated!==false||
    proof.clinical_use_approved!==false||proof.source_alignment_independently_recomputed!==false)
   throw Error('V10 review/registration caveat missing');
 const prior=[...skeleton.parts,...Object.values(v8.bones),...Object.values(v8.muscles),
  ...Object.values(v9.bones),...Object.values(v9.muscles),...Object.values(v9.connective)];
 const ids=new Set([...skeleton.parts.map(p=>p.id),...Object.keys(v8.bones),...Object.keys(v8.muscles),
   ...Object.keys(v9.bones),...Object.keys(v9.muscles),...Object.keys(v9.connective)]);
 const fmas=new Set(prior.map(p=>p.fma));
 const current=Object.entries(asset.parts||{});
 if(current.length!==47||proof.unique_facial_muscles!==47||proof.total_muscle_meshes!==433)
  throw Error('V10 facial inventory incomplete');
 for(const [id,p] of current){
  if(ids.has(id)||fmas.has(p.fma)||!/^facial-v3-fma\d+$/.test(id)||
    p.system!=='muscle'||p.source_version!=='BodyParts3D 3.0'||p.group!=='head'||
    p.vertices?.length<25||p.faces?.length<25||
    p.vertices.some(v=>v.length!==3||v.some(n=>!Number.isFinite(n)))||
    p.faces.some(f=>f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=p.vertices.length)))
   throw Error('Duplicate/invalid facial source '+id);
  ids.add(id);fmas.add(p.fma);
  if(!proof.original_obj_sha256?.[id])throw Error('Missing original OBJ SHA '+id);
 }
 const reg=proof.upstream_registration;
 if(reg.heldOutBone!=='FMA53650'||reg.heldOutSourceToTargetSurfaceRmsMm>.5||
    reg.heldOutTargetToSourceSurfaceRmsMm>.5||
    reg.trainingBones?.length!==3)
  throw Error('V10 facial source lacks upstream held-out-bone evidence');
 return true;
}
window.BodyV10Facial=Object.freeze({verify});
})();
