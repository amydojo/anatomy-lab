/* BODY / LIVE V8 · source-identity registry shared by home and detailed labs.
 * Exactly one identity per semantic anatomical surface, no synthesized parts. */
(function(){'use strict';
function create(){
 const models=new Map();
 function accept(id,part,kind,region,isDetail){
  if(!id||!part?.fma||!part?.name)throw Error('Anatomical registry requires source identity '+id);
  const previous=models.get(id);
  if(previous){
   if(previous.fma!==part.fma||previous.kind!==kind)throw Error('Conflicting source structure '+id);
   if(region)previous.regions.add(region);
   if(isDetail)previous.hasDetail=true;
   return previous;
  }
  const model={id,name:part.name,fma:part.fma,kind,regions:new Set(region?[region]:[]),
   overview:true,hasDetail:!!isDetail,source:part.source_version||'BodyParts3D 4.0',license:part.source_version==='BodyParts3D 3.0'?'CC BY-SA 2.1 Japan':'CC BY 4.0',reviewed:false};
  models.set(id,model);return model;
 }
 function base(asset){
  for(const part of asset.parts||[])accept(part.id,part,'bone',null,false);
 }
 function overview(asset){
  for(const [id,part] of Object.entries(asset.bones||{}))accept(id,part,'bone',part.region,false);
  for(const [id,part] of Object.entries(asset.muscles||{}))accept(id,part,'muscle',part.region,false);
 }
 function expansion(asset){
  for(const [name,kind] of [['bones','bone'],['muscles','muscle'],['connective','connective']])
   for(const [id,part] of Object.entries(asset[name]||{}))
    accept(id,part,kind,part.subgroup||'source-extension',false);
 }
 function facial(asset){
  for(const [id,part] of Object.entries(asset.parts||{}))
   accept(id,part,'muscle','skull',true);
 }
 function detail(region,asset){
  const bones=asset.parts||asset.bone_meshes||{};
  const tissue=asset.muscle_parts||asset.muscle_meshes||{};
  for(const [id,part] of Object.entries(bones))if(part.fma)accept(id,part,part.system==='muscle'?'muscle':'bone',region,true);
  for(const [id,part] of Object.entries(tissue))if(part.fma)accept(id,part,'muscle',region,true);
 }
 return Object.freeze({base,overview,expansion,facial,detail,get:id=>models.get(id)||null,
  all:()=>[...models.values()].map(x=>({...x,regions:[...x.regions]})),
  stats:()=>({bones:[...models.values()].filter(x=>x.kind==='bone').length,
   muscles:[...models.values()].filter(x=>x.kind==='muscle').length,
   connective:[...models.values()].filter(x=>x.kind==='connective').length,
   total:models.size,duplicateIds:0})});
}
window.BodyAtlasRegistry=Object.freeze({create});
})();
