import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const knowledge=JSON.parse(file('atlas/assets/v14-connective-knowledge.json'));
const ctx={window:{},URL};
vm.runInNewContext(file('assets/atlas/connective-intelligence.js'),ctx);
const {create,validateKnowledge}=ctx.window.BodyConnectiveIntelligence;
const engine=create(knowledge);
const invalid=(change,expected)=>{
 const copy=structuredClone(knowledge);change(copy);
 const errors=validateKnowledge(copy);
 assert.ok(errors.some(x=>x.code===expected),expected+' not detected: '+JSON.stringify(errors));
};
const record=(id)=>knowledge.structures.find(x=>x.id===id);
test('V14 registry provides 26 unique canonical IDs across all six regions',()=>{
 assert.equal(engine.getCoverageReport().total,26);
 assert.deepEqual(Object.fromEntries(Object.entries(engine.getCoverageReport().byRegion).map(([k,v])=>[k,v.records])),{
  knee:8,shoulder:4,hip:3,ankle:4,wrist:3,spine:4});
 assert.equal(new Set(knowledge.structures.map(x=>x.id)).size,26);
 assert.deepEqual(Array.from(engine.validate()),[]);
 assert.equal(engine.getStructure('missing'),null);
 assert.equal(engine.getEvidence('missing'),null);
 assert.equal(engine.getGeometryStatus('missing'),null);
 assert.equal(engine.getAdapter('missing'),null);
});
test('Knee identity is anatomically distinct and queryable',()=>{
 const acl=engine.getStructure('anterior-cruciate-ligament');
 const pcl=engine.getStructure('posterior-cruciate-ligament');
 assert.match(acl.attachments.distal,/lateral femoral condyle/i);
 assert.match(pcl.attachments.distal,/medial femoral condyle/i);
 assert.match(engine.getStructure('lateral-collateral-ligament').attachments.distal,/fibular head/i);
 assert.match(engine.getStructure('patellar-ligament').attachments.distal,/tibial tuberosity/i);
 assert.equal(engine.getStructuresByRegion('knee').length,8);
 assert.equal(engine.getStructuresByFunction('knee-stability').length,4);
 assert.equal(engine.getStructuresByFunction('knee-extensor-mechanism').length,2);
 assert.equal(engine.getStructuresByFunction('knee-load-distribution').length,2);
});
test('Relationships are typed, symmetric as appropriate and incoming directed edges are discoverable',()=>{
 const mcl=engine.getRelatedStructures('medial-collateral-ligament');
 assert.ok(mcl.some(x=>x.structure.id==='medial-meniscus'&&x.type==='deep-fibers-attach-to'&&x.direction==='outgoing'));
 const incoming=engine.getRelatedStructures('medial-meniscus');
 assert.ok(incoming.some(x=>x.structure.id==='medial-collateral-ligament'&&x.direction==='incoming'));
 const lcl=engine.getRelatedStructures('lateral-collateral-ligament');
 assert.ok(!lcl.some(x=>x.structure.id==='lateral-meniscus'&&/attach/i.test(x.type)));
 const acl=engine.getRelatedStructures('anterior-cruciate-ligament');
 const pcl=engine.getRelatedStructures('posterior-cruciate-ligament');
 assert.ok(acl.some(x=>x.structure.id==='posterior-cruciate-ligament'&&x.direction==='bidirectional'));
 assert.ok(pcl.some(x=>x.structure.id==='anterior-cruciate-ligament'&&x.direction==='bidirectional'));
 assert.ok(engine.listGraphEdges().every(x=>x.sourceRefs.length>0));
});
test('Evidence distinguishes scientific description from unverified geometry',()=>{
 for(const r of knowledge.structures){
  const e=engine.getEvidence(r.id);
  assert.ok(e.references.every(x=>x.url.startsWith('https://www.ncbi.nlm.nih.gov/')));
  assert.equal(e.geometry.geometryVerified,false);
  assert.equal(e.knowledge.anatomistReviewed,false);
  assert.equal(engine.getAdapter(r.id).record.id,r.id);
 }
 assert.equal(engine.getCoverageReport().unverifiedGeometry,26);
});
test('Three knee lessons have ordered, verified anatomy targets',()=>{
 assert.deepEqual(Array.from(engine.listExplorations().map(x=>x.id)),['stability','movement','load-distribution']);
 for(const module of engine.listExplorations()){
  assert.ok(module.overview.length>35&&module.detail.length>45);
  assert.ok(module.structureIds.every(x=>engine.getStructure(x)));
 }
});
test('Validator catches duplicates, missing sources, bad laterality, contradictory anatomy, invalid edges',()=>{
 invalid(x=>x.structures[1].id=x.structures[0].id,'DUPLICATE');
 invalid(x=>x.structures[0].sourceRefs=['fake-source'],'UNKNOWN_SOURCE');
 invalid(x=>x.sources.knee.url='http://not-a-medical-source.test','CITATION');
 invalid(x=>x.structures[0].laterality='wrong','LATERALITY');
 invalid(x=>x.structures[0].attachments.distal='','ATTACHMENTS');
 invalid(x=>x.structures[0].anatomicalRelationships.push({targetId:'bad',type:'other',direction:'directed',sourceRefs:['knee']}),'RELATION_TARGET');
 invalid(x=>x.structures.find(r=>r.id==='lateral-collateral-ligament').attachments.distal='tibial plateau','COLLATERAL_CONTRADICTION');
 invalid(x=>x.structures.find(r=>r.id==='anterior-cruciate-ligament').attachments.distal='medial femoral condyle','CRUCIATE_CONTRADICTION');
 invalid(x=>x.structures.find(r=>r.id==='medial-collateral-ligament').anatomicalRelationships=x.structures.find(r=>r.id==='medial-collateral-ligament').anatomicalRelationships.filter(y=>y.targetId!=='medial-meniscus'),'MCL_MENISCUS');
});
test('Validator enforces symmetric reciprocity and source consistency',()=>{
 invalid(x=>x.structures.find(r=>r.id==='posterior-cruciate-ligament').anatomicalRelationships=[],'ASYMMETRIC_EDGE');
 invalid(x=>x.structures.find(r=>r.id==='posterior-cruciate-ligament').anatomicalRelationships[0].sourceRefs=['disc'],'EVIDENCE_MISMATCH');
});
test('Geometry cannot become verified based on a citation or a partial inventory alone',()=>{
 invalid(x=>{const g=x.structures[0].geometry;g.status='verified';g.geometryVerified=true},'UNSUPPORTED_GEOMETRY');
 invalid(x=>x.structures[0].geometry.attachmentCoordinatesValidated=true,'UNSUPPORTED_ATTACHMENT');
 invalid(x=>x.structures[0].geometry.kinematicsValidated=true,'UNSUPPORTED_KINEMATICS');
 const inventory={regions:{knee:{structures:[{id:'quadriceps-tendon',mesh_id:'mesh123',source_uri:'https://example.com',sha256:'abcdef',license:'CC BY 4.0',geometry_verified:true}]}}};
 // A truncated/non-hex hash is not a source link at all (runtime hash check mirrors the offline gate).
 assert.equal(create(knowledge,inventory,{allowInvalid:true}).getGeometryStatus('quadriceps-tendon').status,'unverified');
 inventory.regions.knee.structures[0].sha256='a'.repeat(64);
 const withPartial=create(knowledge,inventory,{allowInvalid:true});
 assert.equal(withPartial.getGeometryStatus('quadriceps-tendon').status,'source-linked-unverified');
 assert.equal(withPartial.getGeometryStatus('quadriceps-tendon').geometryVerified,false);
});
test('Returned structures and evidence do not mutate canonical state',()=>{
 const first=engine.getStructure('medial-meniscus');
 first.explanation.overview='tampered';
 first.geometry.geometryVerified=true;
 const evidence=engine.getEvidence('medial-meniscus');
 evidence.references[0].title='tampered';
 assert.notEqual(engine.getStructure('medial-meniscus').explanation.overview,'tampered');
 assert.notEqual(engine.getEvidence('medial-meniscus').references[0].title,'tampered');
});

test('Cross-branch coverage claims are checked rather than trusted',()=>{
 const coverage={regions:{}};
 for(const r of knowledge.structures)(coverage.regions[r.region]??={structures:[]}).structures.push({
  id:r.id,mesh_id:null,geometry_verified:false,attachment_coordinates_validated:false,kinematics_validated:false
 });
 assert.equal(validateKnowledge(knowledge,coverage).length,0);
 coverage.regions.knee.structures[0].geometry_verified=true;
 assert.ok(validateKnowledge(knowledge,coverage).some(x=>x.code==='UNSUPPORTED_COVERAGE_GEOMETRY'));
 coverage.regions.knee.structures[0].geometry_verified=false;
 coverage.regions.knee.structures[0].kinematics_validated=true;
 assert.ok(validateKnowledge(knowledge,coverage).some(x=>x.code==='UNSUPPORTED_COVERAGE_KINEMATICS'));
 coverage.regions.knee.structures[0].kinematics_validated=false;
 coverage.regions.knee.structures[0].registration_error_mm=-3;
 assert.ok(validateKnowledge(knowledge,coverage).some(x=>x.code==='REGISTRATION_ERROR'));
});
