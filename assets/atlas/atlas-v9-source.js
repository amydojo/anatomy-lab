/* V9: independently verified extension. Source geometry is static. */
(function(){'use strict';
const verify=(asset,proof,base,v8)=>{
 const src='1c38bf35c254a891200d3cedecfd57abebe83d8d';
 if(asset?.schema!=='body-live/v9-source-expansion-v1'||
    proof?.schema!=='body-live/v9-source-provenance-v1'||
    asset.source_commit!==src||proof.source_commit!==src||
    base.source_commit!==src||v8.source_commit!==src)
   throw Error('V9 source identity mismatch');
 if(window.BodyAtlasLoader.digest('expansionV9')!==proof.asset_sha256)
   throw Error('V9 source SHA256 mismatch');
 const entries=[...base.parts,...Object.values(v8.bones),...Object.values(v8.muscles)];
 const ids=new Set([...base.parts.map(p=>p.id),...Object.keys(v8.bones),...Object.keys(v8.muscles)]);
 const fmas=new Set(entries.map(x=>x.fma));
 for(const [kind,system]of [['bones','bone'],['muscles','muscle'],['connective','connective']]){
  if(Object.keys(asset[kind]||{}).length!==proof.counts?.[kind])throw Error('V9 count '+kind);
  for(const [id,p]of Object.entries(asset[kind])){
   if(ids.has(id)||fmas.has(p.fma)||p.system!==system)
    throw Error('Duplicate pinned source structure '+id);
   ids.add(id);fmas.add(p.fma);
  }
 }
 if(proof.counts.bones!==64||proof.conventional_skeleton?.total_rendered_standard_bones!==199||
    proof.conventional_skeleton?.unavailable_in_pinned_atlas?.length!==7)
    throw Error('Conventional bone claim not supported');
 if(proof.anatomist_reviewed!==false||proof.kinematics_validated!==false||
   proof.clinical_use_approved!==false)throw Error('Source disclaimers missing');
 for(const r of asset.relationships||[]){
  if(!ids.has(r.structure)||!r.related.every(x=>ids.has(x))||
     r.motion_validated!==false||r.attachment_coordinates_validated!==false)
   throw Error('Unsupported source relationship');
 }
 return true;
};
window.BodyV9Source=Object.freeze({verify});
})();
