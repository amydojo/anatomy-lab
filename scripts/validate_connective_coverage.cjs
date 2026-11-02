/* Evidence gate: no connective structure is labeled verified without licensed, registered source geometry. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../atlas/assets/connective-coverage.json'),'utf8'));
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
  }else if(p.mesh_id||p.sha256||p.registration_error_mm!==null)throw Error('Unverified geometry masquerades as imported: '+p.id);
  if(p.attachment_coordinates_validated&&!p.geometry_verified)throw Error('Attachment validation without verified geometry: '+p.id);
  if(p.kinematics_validated&&!p.attachment_coordinates_validated)throw Error('Motion validation without attachments: '+p.id);
 }
}
if(Object.keys(manifest.regions).length!==Object.keys(expected).length)throw Error('Unexpected region');
console.log('Connective coverage validated: '+ids.size+' structures; '+manifest.regions.knee.structures.filter(p=>p.illustrative).length+' knee illustrations; ZERO newly source-verified meshes.');
