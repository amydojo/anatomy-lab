/* V11 — hard source boundaries for cross-release coccyx + paired ossicles.
 * All seven objects originate in the pinned Z-Anatomy skeletal FBX.
 * Registration is educational/illustrative, not patient or clinical validation.
 */
(function(){'use strict';
const expected=['z-v11-coccyx','z-v11-left-malleus','z-v11-left-incus',
 'z-v11-left-stapes','z-v11-right-malleus','z-v11-right-incus','z-v11-right-stapes'];
function verify(asset,proof,base,v8,v9,v10){
 if(asset?.schema!=='body-live/v11-registered-osteology-v1'||
  proof?.schema!=='body-live/v11-source-provenance-v1'||
  asset.source_repo_commit!==proof.source_commit||
  asset.source_repo_commit!=='6c7f9016bd5899ac8edafd31b9900c151df42ed6'||
  asset.base_source_commit!==base.source_commit||
  base.source_commit!==v8.source_commit||base.source_commit!==v9.source_commit||
  (v10&&v10.base_source_commit!==base.source_commit))throw Error('V11 source identity mismatch');
 if(asset.license!=='CC BY-SA 4.0'||proof.license!==asset.license||
  proof.source_sha256!=='294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea')
  throw Error('V11 source license or SHA mismatch');
 if(window.BodyAtlasLoader.digest('osteologyV11')!==proof.asset_sha256)
  throw Error('V11 generated bone geometry checksum mismatch');
 if(asset.source_frame?.scale!==5||
  JSON.stringify(asset.source_frame?.origin_metres)!=='[0,0.9,0]')
  throw Error('V11 wrong source alignment frame');
 if(proof.canonical_count_conventional!==206||proof.previous_conventional_count!==199||
  proof.new_osteology_bone_count!==7)throw Error('V11 bone inventory mismatch');
 if(proof.human_anatomist_reviewed!==false||proof.ear_specialist_reviewed!==false||
  proof.biomechanics_validated!==false||proof.clinical_use_approved!==false)
  throw Error('V11 clinical review metadata is not truthful');
 const earlier=[...base.parts,...Object.values(v8.bones),...Object.values(v8.muscles),
  ...Object.values(v9.bones),...Object.values(v9.muscles),...Object.values(v9.connective),
  ...Object.values(v10?.parts||{})];
 const ids=new Set([...base.parts.map(x=>x.id),...Object.keys(v8.bones),...Object.keys(v8.muscles),
  ...Object.keys(v9.bones),...Object.keys(v9.muscles),...Object.keys(v9.connective),...Object.keys(v10?.parts||{})]);
 const fmas=new Set(earlier.map(x=>x.fma));
 if(Object.keys(asset.bones||{}).length!==7)throw Error('V11 missing one of seven bones');
 for(const id of expected){
  const p=asset.bones[id];
  if(!p||ids.has(id)||fmas.has(p.fma)||p.system!=='bone'||
   p.source_repo!=='LluisV/Z-Anatomy'||p.license!==asset.license||
   p.reference_pose_only!==true||p.vertices?.length<30||p.faces?.length<30)
   throw Error('V11 corrupt or duplicate actual bone '+id);
  for(const v of p.vertices)
   if(v.length!==3||v.some(x=>!Number.isFinite(x)))throw Error('V11 nonfinite bone '+id);
  for(const face of p.faces)
   if(face.length!==3||face.some(n=>!Number.isInteger(n)||n<0||n>=p.vertices.length))
    throw Error('V11 broken mesh topology '+id);
  ids.add(id);fmas.add(p.fma);
 }
 for(const q of Object.values(proof.registration||{})){
  if(!Number.isFinite(q.scale)||!q.control_rms||!Object.values(q.control_rms).every(n=>n>=0&&n<=.09))
   throw Error('V11 sacral or temporal controls not registered');
 }
 if(!Number.isFinite(proof.validation?.ear_heldout_frontal?.trimmed_rms_units)||
   proof.validation.ear_heldout_frontal.trimmed_rms_units>.18)
  throw Error('V11 skull held-out control not verified');
 return true;
}
window.BodyV11Source=Object.freeze({verify});
})();
