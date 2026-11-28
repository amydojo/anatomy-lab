import test from 'node:test';import assert from 'node:assert/strict';
import '../assets/atlas/marrow-surface.js';import '../assets/atlas/marrow-board.js';import '../assets/atlas/marrow.js';
import {createSlipstreamManifold,createContactAudit} from '../experiments/hairpin/vector/velocity/slipstream-manifold.mjs';
const S=globalThis.BodyMarrowSurface,B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow;
function plane(id,minX,maxX){return {id,name:id,category:'Bone',positions:Float32Array.from([minX,0,-1,maxX,0,-1,maxX,0,1,minX,0,1]),indices:Uint16Array.from([0,2,1,0,3,2]),min:[minX,0,-1],max:[maxX,0,1]};}
test('SLIPSTREAM preserves deterministic rider-directed transport on floor and inverted plane',()=>{
 for(const sign of [1,-1])for(const variant of ['continuous','strict']){
  const w=M.collision([plane('floor',-1,1)],null,true),hit=w.ray([0,.2*sign,0],[0,-sign,0],.4),home={...hit,forward:[0,0,-1]},parts=B.geometry(),a=S.create(w,home,{manifold:createSlipstreamManifold(w,parts,{variant})}),b=S.create(w,home,{manifold:createSlipstreamManifold(w,parts,{variant})});
  for(let i=0;i<240;i++){const input={stick:[.3*Math.sin(i/30),-1],controlYaw:0,push:.7};a.advance(1/120,input);b.advance(1/120,input);assert.deepEqual(a.s.p,b.s.p);assert.deepEqual(a.s.v,b.s.v);assert.equal(a.s.ground,true);assert.ok(Math.abs(a.s.p[1]-.011*sign)<1e-8);}
  const q=a.report();assert.equal(q.remounts,0);assert.equal(q.glideEntries,0);assert.equal(q.blockedSteps,0);assert.ok(q.rideDistance>.1);assert.ok(q.manifold.transportEnergyError<1e-8);assert.ok(q.manifold.maxGuideTurn<=7.800001);
 }
});
test('SLIPSTREAM cannot cross an unsupported gap or jump to an unrelated source',()=>{
 const w=M.collision([plane('first',-.2,0),plane('second',.012,.25)],null,true),hit=w.ray([-.02,.2,0],[0,-1,0],.4),s=S.create(w,{...hit,forward:[1,0,0]},{manifold:createSlipstreamManifold(w,B.geometry())});
 for(let i=0;i<360;i++)s.advance(1/120,{stick:[0,-1],controlYaw:0,push:1});
 const q=s.report();assert.equal(q.id,'first');assert.ok(q.manifold.anchor[0]<=1e-8);assert.equal(q.ground,true);assert.equal(q.glideEntries,0);assert.ok(q.blockedSteps>0);
});
test('SLIPSTREAM flight stays explicit; exact capture and ground support resume',()=>{
 const w=M.collision([plane('floor',-1,1)],null,true),hit=w.ray([0,.2,0],[0,-1,0],.4),s=S.create(w,{...hit,forward:[0,0,-1]},{manifold:createSlipstreamManifold(w,B.geometry())});
 for(let i=0;i<120;i++)s.advance(1/120,{stick:[0,-1],push:.35});
 for(let i=0;i<40;i++)s.advance(1/120,{assist:true});
 assert.equal(s.s.glide,true);assert.equal(s.s.explicitFlights,1);
 for(let i=0;i<1200&&!s.s.ground;i++)s.advance(1/120,{land:true});
 assert.equal(s.s.ground,true);assert.equal(s.s.landings,1);assert.equal(s.s.remounts,0);
});
test('SLIPSTREAM contact rejection instrumentation is observational and separates offset-dominated cases',()=>{
 const audit=createContactAudit();audit.begin(1);audit.reject('offset-distance',{surfaceDistance:.001,centerDistance:.004,offsetJump:.003,limit:.002});audit.reject('offset-distance',{surfaceDistance:.004,centerDistance:.004,offsetJump:.001,limit:.002});audit.end(false);assert.equal(audit.report().blockedCounts['offset-distance'],2);assert.deepEqual(audit.report().blockedOffset,{anchorWithinLimit:1,offsetDominant:1});
 const w=M.collision([plane('floor',-1,1)],null,true),hit=w.ray([0,.2,0],[0,-1,0],.4),a=S.create(w,hit),b=S.create(w,hit,{contactAudit:createContactAudit()});for(let i=0;i<240;i++){const input={stick:[0,-1],push:.5};a.advance(1/120,input);b.advance(1/120,input);assert.deepEqual(a.s,b.s);}
});
