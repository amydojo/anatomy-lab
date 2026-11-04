/* BODY / LIVE V14 · standalone browser/Node-compatible connective anatomical intelligence.
 * Uses the V14 knowledge file and (optionally) Operator A coverage inventory.
 * Evidence never implies valid anatomical meshes, motion, or clinical review. */
(function(root){
'use strict';
const SCHEMA='body-live/connective-knowledge-v1';
const REGIONS=['knee','shoulder','hip','ankle','wrist','spine'];
const LATERALITY=['bilateral-template','axial-segmental','left','right','midline'];
const TISSUES=['tendon','ligament','ligament-complex','fibrocartilage','fibrocartilage-complex','retinaculum','elastic-ligament'];
const isText=x=>typeof x==='string'&&x.trim().length>0;
const isList=x=>Array.isArray(x);
const ids=x=>new Set(x.map(v=>v.id));
const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
function safeSource(src){
 if(!src||!isText(src.title)||!isText(src.section)||!isText(src.url))return false;
 try{const u=new URL(src.url);return u.protocol==='https:'&&['www.ncbi.nlm.nih.gov','ncbi.nlm.nih.gov','openstax.org','www.openstax.org','pmc.ncbi.nlm.nih.gov'].includes(u.hostname)}catch(_){return false}
}
function validateKnowledge(data,coverage){
 const errors=[],fail=(code,path,message)=>errors.push({code,path,message});
 if(!data||data.schema!==SCHEMA){fail('SCHEMA','schema','Expected '+SCHEMA);return errors}
 const items=isList(data.structures)?data.structures:[],sources=data.sources||{},set=ids(items);
 if(items.length!==26)fail('COVERAGE','structures','Expected 26 inventory-targeted records; found '+items.length);
 if(set.size!==items.length)fail('DUPLICATE','structures','Duplicate structure ID found');
 if(data.targetCount!==26)fail('TARGET_COUNT','targetCount','Target count must remain 26');
 for(const [ref,src] of Object.entries(sources))if(!safeSource(src))fail('CITATION','sources.'+ref,'Source needs HTTPS trusted URL, title and section');
 const checkRefs=(refs,path)=>{
  if(!isList(refs)||!refs.length){fail('SOURCE_REQUIRED',path,'At least one source reference required');return}
  for(const ref of refs)if(!Object.prototype.hasOwnProperty.call(sources,ref)||!safeSource(sources[ref]))fail('UNKNOWN_SOURCE',path,'Unknown or malformed source: '+ref);
 };
 const relKey=(id,target,type)=>id+'|'+target+'|'+type;
 const index=new Set();
 for(const [i,r] of items.entries()){
  const p='structures['+i+']';
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id||''))fail('ID',p+'.id','Expected canonical kebab-case structure ID');
  if(!isText(r.name)||!isList(r.synonyms))fail('IDENTITY',p,'Name and synonyms required');
  if(r.canonicalCoverageId!==r.id)fail('COVERAGE_ID',p+'.canonicalCoverageId','Must exactly match canonical structure ID');
  if(!REGIONS.includes(r.region))fail('REGION',p+'.region','Invalid region');
  if(!LATERALITY.includes(r.laterality))fail('LATERALITY',p+'.laterality','Unrecognized laterality');
  if(r.region==='spine'&&r.laterality!=='axial-segmental')fail('SPINE_LATERALITY',p,'Spinal records are axial-segmental templates');
  if(r.region!=='spine'&&r.laterality!=='bilateral-template')fail('LIMB_LATERALITY',p,'Limb records must use bilateral templates; this inventory is not side-specific');
  if(!TISSUES.includes(r.tissueClass))fail('TISSUE',p+'.tissueClass','Unknown tissue class');
  if(!r.attachments||!isText(r.attachments.proximal)||!isText(r.attachments.distal))fail('ATTACHMENTS',p+'.attachments','Attachment endpoints or appropriate ring/segmental equivalents required');
  if(!isText(r.primaryFunction)||!isList(r.functionIds)||!r.functionIds.length||!isList(r.movements))fail('FUNCTION',p,'Function, functionIds and movements required');
  if(!isList(r.relatedBones)||!r.relatedBones.length||!isList(r.relatedMuscles))fail('ANATOMICAL_TARGETS',p,'Related bones and muscles must be specified (empty muscle array allowed)');
  if(!isText(r.explanation?.overview)||!isText(r.explanation?.detail))fail('EXPLANATION',p,'Both overview and detailed explanation required');
  checkRefs(r.sourceRefs,p+'.sourceRefs');
  if(r.knowledgeEvidence?.status!=='reference-supported'||r.knowledgeEvidence?.anatomistReviewed!==false)fail('EVIDENCE_STATUS',p+'.knowledgeEvidence','Only source-supported, not anatomist-reviewed state is established');
  if(!isList(r.unresolved)||!isText(r.validationStatus))fail('VALIDATION_STATUS',p,'State unresolved questions and validation status explicitly');
  const g=r.geometry;
  if(!g||!['unverified','source-linked-unverified','verified'].includes(g.status))fail('GEOMETRY_STATE',p+'.geometry','Explicit geometry status required');
  else {
   if(g.geometryVerified||g.status==='verified'){
    if(!g.meshId||!g.sourceMeshId||!g.license||!g.provenanceHash||!g.coordinateFrameValidated||!g.anatomistReviewed)
     fail('UNSUPPORTED_GEOMETRY',p+'.geometry','Verified mesh requires ID, source ID, license, hash, shared-coordinate proof and anatomist review');
    if(!g.geometryVerified||g.status!=='verified')fail('GEOMETRY_CONTRADICTION',p+'.geometry','Verified boolean and status disagree');
   }
   if(g.attachmentCoordinatesValidated&&!g.geometryVerified)fail('UNSUPPORTED_ATTACHMENT',p+'.geometry','Attachment verification cannot precede geometry proof');
   if(g.kinematicsValidated&&!g.attachmentCoordinatesValidated)fail('UNSUPPORTED_KINEMATICS',p+'.geometry','Kinematics cannot be validated without verified attachment coordinates');
  }
  if(!isList(r.anatomicalRelationships))fail('RELATIONSHIPS',p,'Relationship array required');
  else for(const [j,rel] of r.anatomicalRelationships.entries()){
   const rp=p+'.anatomicalRelationships['+j+']';
   if(!set.has(rel.targetId))fail('RELATION_TARGET',rp,'Missing target '+rel.targetId);
   if(rel.targetId===r.id)fail('SELF_RELATION',rp,'Self links not permitted');
   if(!isText(rel.type)||!['symmetric','directed'].includes(rel.direction))fail('RELATION_TYPE',rp,'Typed/directed relation required');
   checkRefs(rel.sourceRefs,rp+'.sourceRefs');
   const k=relKey(r.id,rel.targetId,rel.type);
   if(index.has(k))fail('DUPLICATE_EDGE',rp,'Repeated relationship '+k);
   index.add(k);
  }
 }
 for(const r of items)for(const rel of r.anatomicalRelationships||[])
  if(rel.direction==='symmetric'){
   const target=items.find(x=>x.id===rel.targetId);
   const inverse=target?.anatomicalRelationships?.find(x=>x.targetId===r.id&&x.type===rel.type&&x.direction==='symmetric');
   if(!inverse)fail('ASYMMETRIC_EDGE',r.id,'Missing reciprocal '+rel.type+' from '+rel.targetId+' back to '+r.id);
   else if(JSON.stringify([...inverse.sourceRefs].sort())!==JSON.stringify([...rel.sourceRefs].sort()))fail('EVIDENCE_MISMATCH',r.id,'Reciprocal edge source refs disagree for '+rel.targetId);
  }
 for(const e of data.relationships||[]){
  if(!set.has(e.from)||!set.has(e.to))fail('GRAPH_TARGET','relationships','Invalid endpoint '+e.from+' -> '+e.to);
  checkRefs(e.sourceRefs,'relationships['+e.from+'=>'+e.to+'].sourceRefs');
  const a=items.find(x=>x.id===e.from),b=items.find(x=>x.id===e.to);
  if(!a?.anatomicalRelationships.some(x=>x.targetId===e.to&&x.type===e.type))fail('GRAPH_MISMATCH',e.from,'Edge not present in source record');
  if(e.direction==='symmetric'&&!b?.anatomicalRelationships.some(x=>x.targetId===e.from&&x.type===e.type))fail('GRAPH_RECIPROCITY',e.to,'Symmetric edge absent at target');
 }
 for(const m of data.explorations||[]){
  if(m.region!=='knee'||!isText(m.overview)||!isText(m.detail))fail('EXPLORATION',m.id||'unknown','Knee exploration needs first/deep text');
  for(const target of m.structureIds||[])if(!set.has(target))fail('EXPLORATION_TARGET',m.id,'Missing '+target);
  checkRefs(m.sourceRefs,'explorations.'+m.id+'.sourceRefs');
 }
 if((data.explorations||[]).length!==3)fail('EXPLORATIONS','explorations','Need stability, movement and load-distribution modules');
 const byId=Object.fromEntries(items.map(x=>[x.id,x]));
 const has=(id,s)=>JSON.stringify(byId[id]?.attachments||{}).toLowerCase().includes(s);
 if(!has('anterior-cruciate-ligament','lateral femoral condyle')||!has('posterior-cruciate-ligament','medial femoral condyle'))fail('CRUCIATE_CONTRADICTION','knee','ACL should attach to lateral femoral condyle and PCL to medial femoral condyle');
 if(!has('lateral-collateral-ligament','fibular head')||!has('medial-collateral-ligament','tibia'))fail('COLLATERAL_CONTRADICTION','knee','LCL must reach fibula; MCL must reach tibia');
 if(!has('patellar-ligament','tibial tuberosity'))fail('EXTENSOR_CHAIN','knee','Patellar ligament must attach to tibial tuberosity');
 if(!byId['medial-collateral-ligament']?.anatomicalRelationships.some(x=>x.targetId==='medial-meniscus'&&x.type==='deep-fibers-attach-to'))
  fail('MCL_MENISCUS','knee','Missing direct MCL–medial meniscus association');
 if(byId['lateral-collateral-ligament']?.anatomicalRelationships.some(x=>x.targetId==='lateral-meniscus'&&/attach/i.test(x.type)))
  fail('LCL_MENISCUS','knee','LCL must not be linked as a direct lateral meniscus attachment');
 if(coverage){
  const rows=Object.entries(coverage.regions||{}).flatMap(([region,entry])=>(entry.structures||[]).map(s=>({...s,region})));
  if(rows.length!==26)fail('INVENTORY_COUNT','coverage','Coverage inventory should list 26 targets');
  for(const s of rows){
   const rec=byId[s.id];
   if(!rec)fail('INVENTORY_MISSING',s.id,'Coverage ID has no knowledge entry');
   else if(rec.region!==s.region)fail('INVENTORY_REGION',s.id,'Region mismatch with geometry operator inventory');
   if(s.geometry_verified===true&&!(s.mesh_id&&s.source_uri&&s.license&&/^[a-f0-9]{64}$/i.test(s.sha256||'')&&s.registration_record&&s.shared_coordinate_frame_validated===true&&s.anatomist_reviewed===true))
     fail('UNSUPPORTED_COVERAGE_GEOMETRY',s.id,'Inventory asserts verified mesh without source, hash, shared frame and expert review');
   if(s.attachment_coordinates_validated===true&&s.geometry_verified!==true)
     fail('UNSUPPORTED_COVERAGE_ATTACHMENT',s.id,'Attachment claim requires geometry proof');
   if(s.kinematics_validated===true&&s.attachment_coordinates_validated!==true)
     fail('UNSUPPORTED_COVERAGE_KINEMATICS',s.id,'Kinematics claim requires attachment validation');
   if(s.registration_error_mm!=null&&(!Number.isFinite(s.registration_error_mm)||s.registration_error_mm<0))
     fail('REGISTRATION_ERROR',s.id,'Registration residual must be a nonnegative finite number or unresolved');
  }
  for(const rec of items)if(!rows.some(s=>s.id===rec.id))fail('KNOWLEDGE_ORPHAN',rec.id,'No matching canonical coverage entry');
 }
 return errors;
}
function geometryFor(record,coverage){
 const raw=coverage?.regions?.[record.region]?.structures?.find(x=>x.id===record.canonicalCoverageId);
 const out=clone(record.geometry);
 if(!raw)return {...out,inventoryMatch:false,availability:'not-reported'};
 const sourceReady=!!(raw.mesh_id&&raw.source_uri&&raw.license&&/^[a-f0-9]{64}$/i.test(raw.sha256||''));
 const proven=sourceReady&&raw.geometry_verified===true&&raw.attachment_coordinates_validated===true&&raw.kinematics_validated===true&&raw.anatomist_reviewed===true&&raw.shared_coordinate_frame_validated===true;
 return {...out,inventoryMatch:true,availability:sourceReady?'source-linked':'pending-source-mesh',
  status:proven?'verified':sourceReady?'source-linked-unverified':'unverified',
  meshId:sourceReady?raw.mesh_id:null,sourceMeshId:sourceReady?raw.source_mesh_id||raw.mesh_id:null,
  license:sourceReady?raw.license:null,provenanceHash:sourceReady?raw.sha256:null,
  geometryVerified:proven,attachmentCoordinatesValidated:proven,kinematicsValidated:proven,
  coordinateFrameValidated:proven,anatomistReviewed:proven};
}
function create(data,coverage,opts){
 const errors=validateKnowledge(data,coverage);
 if(errors.length&&opts?.allowInvalid!==true)throw new Error('Connective knowledge failed validation: '+errors.map(x=>x.code+' '+x.path+' '+x.message).slice(0,6).join('; '));
 const records=new Map((data.structures||[]).map(x=>[x.id,x]));
 const resultRecord=id=>{const r=records.get(id);return r?{...clone(r),geometry:geometryFor(r,coverage)}:null};
 const list=predicate=>(data.structures||[]).filter(predicate).map(x=>resultRecord(x.id));
 const api={
  schema:SCHEMA,version:data.version,
  getStructure:resultRecord,
  getStructuresByRegion:region=>list(x=>x.region===region),
  getStructuresByFunction:functionId=>list(x=>x.functionIds.includes(functionId)),
  getRelatedStructures(id){if(!records.has(id))return [];const output=[];
   for(const e of data.relationships||[]){
    if(e.from===id||e.to===id){
     if(e.from!==id&&e.direction!=='symmetric')output.push({structure:resultRecord(e.from),type:e.type,direction:'incoming',evidence:clone(e.sourceRefs)});
     else output.push({structure:resultRecord(e.from===id?e.to:e.from),type:e.type,direction:e.direction==='symmetric'?'bidirectional':'outgoing',evidence:clone(e.sourceRefs)});
    }
   }return output},
  getEvidence(id){const r=records.get(id);if(!r)return null;return {structureId:id,knowledge:clone(r.knowledgeEvidence),
   references:r.sourceRefs.map(ref=>({id:ref,...clone(data.sources[ref])})),
   relationships:clone(r.anatomicalRelationships.map(edge=>({...edge,sources:edge.sourceRefs.map(ref=>({id:ref,...clone(data.sources[ref])}))}))),
   geometry:geometryFor(r,coverage)}},
  getGeometryStatus:id=>{const r=records.get(id);return r?geometryFor(r,coverage):null},
  getExploration:id=>clone((data.explorations||[]).find(x=>x.id===id)||null),
  listExplorations:()=>clone(data.explorations||[]),
  listGraphEdges:()=>clone(data.relationships||[]),
  getCoverageReport(){const byRegion={};for(const region of REGIONS)byRegion[region]={records:api.getStructuresByRegion(region).length,verifiedGeometry:api.getStructuresByRegion(region).filter(x=>x.geometry.geometryVerified).length};return {total:records.size,byRegion,unverifiedGeometry:list(x=>!geometryFor(x,coverage).geometryVerified).length,errors:clone(errors)}},
  validate:()=>clone(errors),
  getAdapter:id=>{const record=resultRecord(id);return record?{structureId:id,record,relationships:api.getRelatedStructures(id),evidence:api.getEvidence(id),geometry:api.getGeometryStatus(id)}:null}
 };
 return Object.freeze(api);
}
async function load(options={}){
 if(typeof fetch!=='function')throw Error('Browser fetch is unavailable; use create(data, coverage) instead');
 const path=options.knowledgeUrl||'/atlas/assets/v14-connective-knowledge.json';
 const res=await fetch(path);
 if(!res.ok)throw Error('Connective knowledge unavailable: HTTP '+res.status+' '+path);
 const data=await res.json();
 let coverage=null;
 if(options.coverage!==undefined)coverage=options.coverage;
 else if(options.coverageUrl){
  const result=await fetch(options.coverageUrl);
  if(result.ok)coverage=await result.json();
 }
 return create(data,coverage);
}
const exposed=Object.freeze({SCHEMA,create,load,validateKnowledge});
root.BodyConnectiveIntelligence=exposed;
if(typeof module!=='undefined'&&module.exports)module.exports=exposed;
})(typeof window!=='undefined'?window:globalThis);
