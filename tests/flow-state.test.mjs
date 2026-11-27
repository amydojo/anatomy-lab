import test from 'node:test';import assert from 'node:assert/strict';
import '../assets/atlas/marrow-surface.js';import '../assets/atlas/marrow-board.js';import '../assets/atlas/marrow.js';
import {createFlowSupport} from '../experiments/hairpin/vector/velocity/flow-support.mjs';
import {crossing,createIntersectionAudit} from '../experiments/hairpin/vector/velocity/flow-intersection.mjs';
const S=globalThis.BodyMarrowSurface,B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow;
const floor={id:'floor',name:'floor',category:'Bone',positions:Float32Array.from([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),indices:Uint16Array.from([0,2,1,0,3,2]),min:[-1,0,-1],max:[1,0,1]};
test('FLOW strict triangle crossing, disjoint, near-coplanar and tangency classes',()=>{
 const a=[[-1,-1,0],[1,-1,0],[0,1,0]],b=[[0,-.5,-1],[0,-.5,1],[0,.5,0]];
 assert.ok(Math.abs(crossing(a,b).length-1)<1e-9);
 assert.equal(crossing(a,b.map(v=>[v[0]+3,v[1],v[2]])).length,0);
 assert.equal(crossing(a,a).kind,'near-coplanar');
 assert.equal(crossing(a,[[0,0,0],[0,0,1],[0,1,1]]).length,0);
 const anatomy={positions:Float32Array.from(a.flat()),indices:Uint16Array.from([0,1,2])},parts=[{id:'joint',positions:Float32Array.from(b.flat()),indices:Uint16Array.from([0,1,2])}],audit=createIntersectionAudit(anatomy,parts,B);
 const q=audit.measure({r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]});assert.equal(q.pairs,1);assert.ok(Math.abs(q.segmentLength-1)<1e-9);
});
test('FLOW support research is deterministic, bounded, and never changes the central guide on planar floor or ceiling',()=>{
 for(const sign of [1,-1])for(const model of ['constraint','compliant']){
  const world=M.collision([floor],null,true),hit=world.ray([0,.2*sign,0],[0,-sign,0],.4),home={...hit,forward:[0,0,-1]},a=S.create(world,home),support=createFlowSupport(world,B.geometry(),B,M.boardMatrix,{model}),b=S.create(world,home,{support}),c=S.create(world,home,{support:createFlowSupport(world,B.geometry(),B,M.boardMatrix,{model})});
  for(let i=0;i<240;i++){const input={stick:[.3*Math.sin(i/30),-1],controlYaw:0,push:.7};a.advance(1/120,input);b.advance(1/120,input);c.advance(1/120,input);assert.deepEqual(b.s.p,c.s.p);assert.deepEqual(b.s.v,c.s.v);const q=b.report();assert.deepEqual(q.support.anchor,a.s.p);assert.deepEqual(b.s.v,a.s.v);assert.ok(q.support.maxLift<=.02400001);assert.ok(q.support.transportEnergyError<1e-8);assert.equal(b.s.ground,true);assert.equal(b.s.glideEntries,0);}
  assert.equal(b.s.remounts,0);assert.equal(b.report().support.last.coherent,true);
 }
});
test('FLOW intentional launch transfers chassis position and captures using the existing solver',()=>{
 const w=M.collision([floor]),hit=w.ray([0,.2,0],[0,-1,0],.4),model=createFlowSupport(w,B.geometry(),B,M.boardMatrix),s=S.create(w,{...hit,forward:[0,0,-1]},{support:model});
 for(let i=0;i<120;i++)s.advance(1/120,{stick:[0,-1],push:.35});
 const old=s.s.p.slice();s.advance(1/120,{assist:true});assert.equal(s.s.glide,true);assert.equal(s.s.explicitFlights,1);assert.ok(Math.hypot(...s.s.p.map((v,k)=>v-old[k]))<.01);
 for(let i=0;i<40;i++)s.advance(1/120,{assist:true});for(let i=0;i<1200&&!s.s.ground;i++)s.advance(1/120,{land:true});
 assert.equal(s.s.ground,true);assert.equal(s.s.landings,1);assert.equal(s.s.remounts,0);
});
