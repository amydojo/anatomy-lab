/* Evidence gate: no connective structure is labeled verified without licensed, registered source geometry. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const coverageArg=process.argv.indexOf('--coverage');
const manifest=JSON.parse(fs.readFileSync(coverageArg>=0?path.resolve(process.argv[coverageArg+1]):path.join(__dirname,'../atlas/assets/connective-coverage.json'),'utf8'));
const verifiedClaims=[];
const expected={knee:8,shoulder:4,hip:3,ankle:4,wrist:3,spine:4};
const ids=new Set();
if(manifest.schema!=='body-live/connective-coverage-v1')throw Error('Unexpected connective coverage schema');
for(const [region,count] of Object.entries(expected)){
 const data=manifest.regions[region];
 if(!data||data.structures.length!==count)throw Error('Incomplete '+region+' inventory');
 for(const p of data.structures){
  if(!p.id||!p.name||!Array.isArray(p.relationships)||p.relationships.length<1||ids.has(p.id))throw Error('Invalid/duplicate connective identity: '+p.id);
  ids.add(p.id);
  if(p.illustrative){
   if(p.geometry_verified||p.attachment_coordinates_validated||p.kinematics_validated||p.illustrative_morphology_validated!==false||p.illustrative_geometry_id!==p.id||p.registration_error_mm!==null)throw Error('Illustrative geometry improperly certified: '+p.id);
  }else if(p.illustrative_geometry_id)throw Error('Unexpected illustrative mesh identity: '+p.id);
  if(p.geometry_verified){
   if(!p.mesh_id||!p.source_uri||!p.license||!(/^[a-f0-9]{64}$/i.test(p.sha256||''))||!Number.isFinite(p.registration_error_mm))throw Error('Unsupported geometry verification: '+p.id);
   verifiedClaims.push(p);
  }else if(p.mesh_id||p.sha256||p.registration_error_mm!==null)throw Error('Unverified geometry masquerades as imported: '+p.id);
  if(p.attachment_coordinates_validated&&!p.geometry_verified)throw Error('Attachment validation without verified geometry: '+p.id);
  if(p.kinematics_validated&&!p.attachment_coordinates_validated)throw Error('Motion validation without attachments: '+p.id);
 }
}
if(Object.keys(manifest.regions).length!==Object.keys(expected).length)throw Error('Unexpected region');
// Verification gate: a geometry_verified claim is only accepted when it points at a retained registration
// record that passes the SAME software checks as the registration pipeline (rigid matrix, recomputed residuals,
// laterality, independent holdouts, hashed originals, rostered + candidate-bound review). Metadata fields alone
// (mesh_id, sha256, registration_error_mm, reviewer names) can never satisfy it. Even a passing record only
// proves software eligibility; this validator never creates a verified status itself.
async function verifyClaims(){
 const {evaluateVerification}=await import('./geometry/registration.mjs');
 const root=path.join(__dirname,'..');
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'atlas/assets/v14-knee-geometry-evidence.json'),'utf8'));
 const roster=JSON.parse(fs.readFileSync(path.join(root,'atlas/assets/qualified-reviewers.json'),'utf8')).reviewers||[];
 const known=(evidence.source_reference?.bone_references||[]).map(x=>x.id).concat((evidence.source_reference?.bone_references||[]).map(x=>x.name&&'right-'+x.name.toLowerCase()).filter(Boolean));
 for(const claim of verifiedClaims){
  if(!claim.registration_record)throw Error('Unsupported geometry verification (no registration_record; verification gate requires retained evidence): '+claim.id);
  const file=path.resolve(path.join(root,'atlas/assets'),claim.registration_record);
  let record;try{record=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){throw Error('Unreadable registration_record for '+claim.id+': '+e.message+' (verification gate)');}
  let reviewRecordBytes=null;
  if(record.review?.review_record_path){try{reviewRecordBytes=fs.readFileSync(path.resolve(path.dirname(file),record.review.review_record_path));}catch{}}
  const verdict=evaluateVerification(record,{expectedLaterality:evidence.expected_laterality,knownBoneReferenceIds:known,qualifiedReviewers:roster,reviewRecordBytes});
  if(!verdict.eligible)throw Error('Verification gate rejected geometry_verified claim for '+claim.id+': '+verdict.errors.join('; '));
  if(record.source?.asset_id&&claim.mesh_id&&claim.sha256!==record.source.original_sha256)throw Error('Verification gate: coverage sha256 differs from the registration record original hash for '+claim.id);
 }
}
const finish=()=>console.log('Connective coverage validated: '+ids.size+' structures; '+manifest.regions.knee.structures.filter(p=>p.illustrative).length+' knee illustrations; ZERO newly source-verified meshes.');
if(verifiedClaims.length)verifyClaims().then(finish).catch(e=>{console.error(e.message);process.exit(1);});else finish();
