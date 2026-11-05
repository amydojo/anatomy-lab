// Read-only V14 audit of the pinned V9 source-derived connective meshes.
// A structurally usable mesh is NOT an anatomically validated registration.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const dataPath=path.join(root,'atlas/assets/v9-source-expansion.json');
const proofPath=path.join(root,'atlas/assets/v9-source-provenance.json');
const targetsPath=path.join(root,'atlas/assets/connective-coverage.json');
const buffer=fs.readFileSync(dataPath),asset=JSON.parse(buffer.toString('utf8'));
const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
const targets=JSON.parse(fs.readFileSync(targetsPath,'utf8'));
const sha=crypto.createHash('sha256').update(buffer).digest('hex');
const expected='1c38bf35c254a891200d3cedecfd57abebe83d8d';
if(asset.schema!=='body-live/v9-source-expansion-v1'||asset.license!=='CC BY 4.0'||asset.source_commit!==expected||proof.source_commit!==expected)throw Error('V9 pinned source provenance/schema mismatch');
if(sha!==proof.asset_sha256)throw Error('V9 source asset SHA-256 mismatch: '+sha);
if(asset.source_frame?.scale!==5||JSON.stringify(asset.source_frame?.origin_metres)!=='[0,0.9,0]')throw Error('V9 incompatible atlas coordinate frame');
const details=[];
for(const [id,p] of Object.entries(asset.connective||{})){
 const errors=[];
 if(!p.name||!p.fma||p.vertices?.length<25||p.faces?.length<25)errors.push('missing identity or incomplete surface');
 if(p.vertices?.some(v=>v.length!==3||v.some(n=>!Number.isFinite(n))))errors.push('nonfinite surface coordinate');
 if(p.faces?.some(t=>t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=p.vertices.length)))errors.push('invalid face indices');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const v of p.vertices||[])for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],v[i]);hi[i]=Math.max(hi[i],v[i]);}
 if(lo.some((v,i)=>!Number.isFinite(v)||hi[i]-v<1e-5))errors.push('non-spatial source surface');
 details.push({id,name:p.name,fma:p.fma,vertex_count:p.vertices?.length||0,face_count:p.faces?.length||0,bounds:{lo,hi},source_id_confirmed:true,topology_usable:errors.length===0,registered_attachment_coordinates:false,measured_registration_error_mm:null,errors});
}
const usable=details.filter(p=>p.topology_usable),bad=details.filter(p=>!p.topology_usable);
if(details.length!==proof.counts.connective)throw Error('V9 connective source count mismatch '+details.length);
const targetsFlat=Object.entries(targets.regions).flatMap(([region,r])=>r.structures.map(s=>({region,id:s.id})));
const candidates=targetsFlat.map(t=>({...t,candidate_source_meshes:details.filter(p=>p.id===t.id||p.id.endsWith('-'+t.id)||t.id==='achilles-tendon'&&p.id==='right-calcaneal-tendon').map(p=>p.id)}));
const result={
 schema:'body-live/v14-v9-connective-audit-v1',
 source:'BodyParts3D 4.0 via pinned V9 expansion',source_commit:asset.source_commit,sha256:sha,
 license:'CC BY 4.0',source_frame:asset.source_frame,
 all_mesh_count:details.length,topology_usable_mesh_count:usable.length,structurally_invalid_count:bad.length,
 matching_required_structure_candidates:candidates.filter(x=>x.candidate_source_meshes.length),
 unregistered_target_count:candidates.length,
 limitations:['Only topology and source frame checked','No anatomical insertion validation','No per-mesh transform or quantified landmark registration error','Not a clinical or biomechanical review'],
 parts:details
};
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/v14-connective-v9-source-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log('V14 V9 audit: '+usable.length+'/'+details.length+' topology-usable source connective meshes; '+bad.length+' corrupt; '+result.matching_required_structure_candidates.length+' named target candidates (NOT registered).');
if(bad.length)throw Error('Invalid sourced connective surfaces: '+bad.map(x=>x.id).join(', '));
