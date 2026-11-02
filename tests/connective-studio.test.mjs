import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const intel=require('../assets/atlas/connective-intelligence.js');
const data=JSON.parse(readFileSync(new URL('../atlas/assets/v14-connective-knowledge.json',import.meta.url),'utf8'));
const coverage=JSON.parse(readFileSync(new URL('../atlas/assets/connective-coverage.json',import.meta.url),'utf8'));
const engine=intel.create(data,coverage);
const canonical=engine.getStructuresByRegion('knee');
function make(extra={}) {
 const window={};
 runInNewContext(readFileSync(new URL('../assets/atlas/connective-studio-core.js',import.meta.url),'utf8'),{window});
 const provider={listStructures:()=>canonical.map(r=>({
  id:r.id,region:r.region,tissueType:r.tissueClass==='tendon'?'tendons':r.tissueClass==='ligament'?'ligaments':'fibrocartilage',
  name:r.name,significance:r.primaryFunction,source:{label:'reference supported',verified:false},
  geometryStatus:'illustrative',selectable:true})),...extra};
 return window.BodyConnectiveStudio.create({provider});
}
test('V14: eight canonical knee structures correspond to explicitly illustrative geometry',()=>{
 const s=make();
 assert.equal(s.snapshot().records.length,8);
 assert.ok(s.snapshot().records.every(r=>r.geometryStatus==='illustrative'&&r.selectable&&r.source.verified===false));
 assert.equal(s.selectStructure('anterior-cruciate-ligament').name,'Anterior cruciate ligament');
 assert.equal(s.getStructure('acl'),null);
});
test('V14: tissue toggles remain independent and reset restores all',()=>{
 const s=make();
 s.setTissueVisibility('ligaments',false);
 assert.equal(s.snapshot().visibility.ligaments,false);
 assert.equal(s.snapshot().visibility.fibrocartilage,true);
 assert.equal(s.getStructure('anterior-cruciate-ligament').visible,false);
 assert.equal(s.getStructure('medial-meniscus').visible,true);
 assert.equal(s.setTissueVisibility('imaginary',false),false);
 s.resetView();
 assert.ok(Object.values(s.snapshot().visibility).every(Boolean));
 assert.equal(s.snapshot().mode,'all');
});
test('V14: real canonical provider enables focus, isolation and ACL/PCL comparison',()=>{
 const calls=[];
 const s=make({focusStructure:id=>{calls.push(['focus',id]);return true;},isolateStructure:id=>{calls.push(['isolate',id]);return true;}});
 const a='anterior-cruciate-ligament',p='posterior-cruciate-ligament';
 assert.equal(s.selectStructure(a).selectable,true);
 assert.equal(s.focusStructure(a),true);
 assert.equal(s.isolateStructure(a),true);
 assert.equal(s.compareStructures([a,p]),true);
 assert.equal(s.snapshot().mode,'compare');
 assert.equal(s.snapshot().comparison.length,2);
 assert.equal(s.getStructure(a).source.verified,false);
 assert.deepEqual(calls,[['focus',a],['isolate',a]]);
 s.revealContext();assert.equal(s.snapshot().mode,'context');
});
test('V14: invalid or unavailable geometry fails closed, search stays region-aware',()=>{
 const s=make({listStructures:()=>[
  {id:'bad',region:'mars',tissueType:'ligaments',geometryStatus:'verified',selectable:true},
  {id:'medial-meniscus',region:'knee',tissueType:'fibrocartilage',geometryStatus:'unavailable',selectable:true}
 ]});
 assert.equal(s.getStructure('bad'),null);
 assert.equal(s.getStructure('medial-meniscus').selectable,false);
 assert.equal(s.isolateStructure('medial-meniscus'),false);
 s.setQuery('meniscus');assert.equal(s.filtered().length,1);
 s.chooseGuide('stability');assert.equal(s.snapshot().guideId,'stability');
 s.setRegion('wrist');assert.equal(s.filtered().length,0);
 assert.equal(s.setRegion('mars'),false);
});
