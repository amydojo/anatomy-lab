import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function make(provider){
 const window={};
 runInNewContext(readFileSync(new URL('../assets/atlas/connective-studio-core.js',import.meta.url),'utf8'),{window});
 return window.BodyConnectiveStudio.create({provider});
}
test('V14: the eight named knee structures never invent geometry',()=>{
 const s=make();
 assert.equal(s.snapshot().records.length,8);
 assert.ok(s.snapshot().records.every(r=>r.geometryStatus==='unavailable'&&!r.selectable&&r.source.verified===false));
 assert.equal(s.isolateStructure('acl'),false);
 assert.equal(s.focusStructure('acl'),false);
 assert.equal(s.selectStructure('acl').name,'Anterior cruciate ligament · ACL');
});
test('V14: tissue filters are independent and reset restores combined view',()=>{
 const s=make();
 s.setTissueVisibility('ligaments',false);
 assert.equal(s.snapshot().visibility.ligaments,false);
 assert.equal(s.snapshot().visibility.fibrocartilage,true);
 assert.equal(s.getStructure('acl').visible,false);
 assert.equal(s.getStructure('medial-meniscus').visible,true);
 assert.equal(s.setTissueVisibility('invented',false),false);
 s.resetView();
 assert.ok(Object.values(s.snapshot().visibility).every(Boolean));
 assert.equal(s.snapshot().mode,'all');
});
test('V14: a registered mesh gains selection and isolation, not false source verification',()=>{
 const calls=[];
 const s=make({listStructures:()=>[{id:'acl',region:'knee',tissueType:'ligaments',name:'ACL',geometryStatus:'source-derived',selectable:true}],
   focusStructure:id=>{calls.push(['focus',id]);return true;},isolateStructure:id=>{calls.push(['isolate',id]);return true;}});
 assert.equal(s.selectStructure('acl').selectable,true);
 assert.equal(s.focusStructure('acl'),true);
 assert.equal(s.isolateStructure('acl'),true);
 assert.equal(s.snapshot().mode,'isolate');
 assert.equal(s.getStructure('acl').source.verified,false);
 assert.equal(calls.length,2);
 s.revealContext();assert.equal(s.snapshot().mode,'context');
 assert.equal(s.compareStructures(['acl','pcl']),false);
});
test('V14: invalid providers fail closed and search remains region-aware',()=>{
 const s=make({listStructures:()=>[{id:'bad',region:'mars',tissueType:'ligaments',geometryStatus:'verified',selectable:true},{id:'mcl',region:'knee',tissueType:'ligaments',geometryStatus:'unknown',selectable:true}]});
 assert.equal(s.getStructure('bad'),null);
 assert.equal(s.getStructure('mcl').selectable,false);
 s.setQuery('meniscus');assert.equal(s.filtered().length,2);
 s.chooseGuide('stability');assert.equal(s.snapshot().guideId,'stability');
 s.setRegion('wrist');assert.equal(s.filtered().length,0);
 assert.equal(s.setRegion('mars'),false);
});
