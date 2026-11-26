import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyDirected} from './nanite_c_surface.mjs';
import {certifyMapping,lodTopology} from './nanite_c_correspondence.mjs';
const mesh=(p,i)=>({positions:new Float32Array(p),indices:new Uint16Array(i),min:[0,0,0],max:[1,1,1]});
const a=mesh([0,0,0,1,0,0,0,1,0],[0,1,2]);
test('convex triangle witness covers identical and translated surfaces',()=>{
 const b=mesh([0,0,.01,1,0,.01,0,1,.01],[0,1,2]);
 assert.ok(certifyDirected(a,a,.001).passed);
 const x=certifyDirected(a,b,.011);assert.ok(x.passed);assert.ok(x.maxUpper>=.00999&&x.maxUpper<=.011);
 assert.equal(certifyDirected(a,b,.005).reason,'observed-surface-error');
});
test('orientation and budget failure cannot be converted to a pass',()=>{
 const rev=mesh([...a.positions],[0,2,1]);
 assert.equal(certifyDirected(a,rev,.001,{maxDepth:1}).passed,false);
 assert.equal(certifyDirected(a,a,.001,{maxCells:0}).passed,false);
});
test('all-area certificate catches an unsampled omitted component',()=>{
 const b=mesh([0,0,0,1,0,0,0,1,0,4,0,0,5,0,0,4,1,0],[0,1,2,3,4,5]);
 assert.equal(certifyDirected(b,a,.1).passed,false);
});
test('mapping gate rejects collapsed support and reversed orientation',()=>{
 const topo=lodTopology(a.indices,3);
 const b=certifyMapping(a,a.positions,new Uint32Array([0,2,1]),1,topo);assert.ok(b.normalReversals>0);assert.equal(b.passed,false);
});
