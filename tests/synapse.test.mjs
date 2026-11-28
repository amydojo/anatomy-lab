import test from 'node:test';import assert from 'node:assert/strict';
import {createSpatialMemory} from '../experiments/hairpin/vector/velocity/synapse-cells.mjs';
import {mechanicalPose} from '../experiments/hairpin/vector/velocity/kinesis-oracle.mjs';
const I={sourceSHA:'fixture-source',vehicleSHA:'fixture-vehicle',coordinateFrame:'identity',sourceID:'fixture',solver:'fixture'};
const parts=[{id:'joint',positions:Float64Array.from([-.01,0,0,.01,0,0,0,.01,0])}],B={transform:(id,q)=>q};
const pose=(x=0,a=0,twist=0)=>mechanicalPose({t:[x,0,0],r:[Math.cos(a),Math.sin(a),0,-Math.sin(a),Math.cos(a),0,0,0,1]},{twist,compression:0,deploy:0});
test('SYNAPSE clearance cell covers continuous path, rejects outside displacement and rotation',()=>{
 let calls=0;const o={pose:()=>{calls++;return {clear:true};}},m=createSpatialMemory(o,parts,B,I,{margins:[.004]});
 const cell=m.build(pose());assert.ok(cell);assert.ok(m.lookup(pose(.001),pose(.002)));assert.equal(calls,1);assert.equal(m.lookup(pose(.001),pose(.006)),null);assert.equal(m.lookup(pose(),pose(0,.7)),null);assert.equal(m.lookup(pose(),pose(0,0,.2)),null);
 assert.equal(m.report().hits,1);assert.equal(m.report().misses,2);
});
test('SYNAPSE failed preparation is memoized, never becomes positive clearance',()=>{
 let n=0;const m=createSpatialMemory({pose:()=>{n++;return {clear:false};}},parts,B,I,{margins:[.004,.002]});assert.equal(m.build(pose()),null);assert.equal(m.build(pose()),null);assert.equal(n,2);assert.equal(m.lookup(pose(),pose()),null);assert.equal(m.report().failedReuse,1);
});
test('SYNAPSE refuses stale identity, nonrigid transform and out-of-range articulation',()=>{
 const m=createSpatialMemory({pose:()=>({clear:true})},parts,B,I),q=m.build(pose());const changed=createSpatialMemory({pose:()=>({clear:true})},parts,B,{...I,solver:'new'});assert.equal(changed.contains(q,pose(),pose()),false);const fake={...pose(),r:[2,0,0,0,1,0,0,0,1]};assert.equal(m.lookup(fake,pose()),null);assert.equal(m.build(pose(0,0,.3)),null);
});

test('SYNAPSE connected-cell coverage admits only fully covered subintervals',()=>{
 const m=createSpatialMemory({pose:()=>({clear:true})},parts,B,I,{margins:[.002]});
 const a=m.build(pose(0)),b=m.build(pose(.003));
 assert.equal(m.lookup(pose(),pose(.003)),null);assert.ok(m.cover(pose(),pose(.003),2));
 assert.equal(m.cover(pose(),pose(.008),2),null);assert.equal(m.contains({...a,margin:1},pose(),pose(.008)),false);assert.ok(Object.isFrozen(a.pose.r));assert.ok(b);
});
