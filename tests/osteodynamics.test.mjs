import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/atlas/marrow-board.js';
import '../assets/atlas/marrow-surface.js';
import '../assets/atlas/marrow.js';
import {footprint,measure,alignPose,createTerrainInterpreter} from '../experiments/hairpin/vector/velocity/osteodynamics.mjs';
const M=globalThis.BodyMarrow,B=globalThis.BodyMarrowBoard,S=globalThis.BodyMarrowSurface;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const part={id:'plane',category:'Bone',positions:Float32Array.from([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),indices:Uint16Array.from([0,2,1,0,3,2]),min:[-1,0,-1],max:[1,0,1]};
test('OSTEO common-body rigid alignment preserves all relative assembly transforms',()=>{
 const s={p:[.1,.011,.2],n:[0,1,0],f:[0,0,-1],v:[0,0,.1],bank:.12,ground:true,glide:false},pose=B.motion().update(s,M.boardMatrix(s),.1),q=alignPose(pose,[.08,.02,-.04],[.001,.004,0]);
 for(const a of [null,'front','rear','frontPod','rearPod'])for(const b of [null,'front','rear','frontPod','rearPod']){
  const x=a?pose[a]:pose,y=b?pose[b]:pose,u=a?q[a]:q,v=b?q[b]:q;assert.ok(Math.abs(dist(x.t,y.t)-dist(u.t,v.t))<1e-12);
  for(let i=0;i<9;i+=3)for(let j=0;j<9;j+=3)assert.ok(Math.abs(dot(x.r.slice(i,i+3),y.r.slice(j,j+3))-dot(u.r.slice(i,i+3),v.r.slice(j,j+3)))<1e-12);
 }
});
test('OSTEO exact plane distributed support, no fabricated curvature on missing source, legacy identity',()=>{
 const world=M.collision([part],null,true),hit=world.ray([0,.2,0],[0,-1,0],.4),sim=S.create(world,{...hit,forward:[0,0,-1]}),parts=B.geometry(),foot=footprint(parts),motion=B.motion(),interpreter=createTerrainInterpreter(world,B,{deterministic:true});
 assert.equal(foot.probes.length,11);assert.equal(foot.top.length,5);
 for(let i=0;i<120;i++){sim.advance(1/120,{stick:[0,-1],push:1});const state=sim.visual(),pose=motion.update(state,M.boardMatrix(state),1/120),legacy=interpreter.update(state,pose,parts,1/120,false,true);assert.equal(legacy,pose);}
 const state=sim.visual(),pose=motion.update(state,M.boardMatrix(state),1/120),q=measure(world,state,pose,foot,B);assert.equal(q.supportRatio,1);assert.ok(q.minGap>0);assert.ok(q.curvatureConfidence>=.6);assert.ok(q.principalCurvature.every(x=>Math.abs(x)<1e-6));assert.equal(q.ridgeDirection,null);
 const invalid=measure(world,{...state,id:'wrong'},pose,foot,B);assert.equal(invalid.supportRatio,0);assert.equal(invalid.principalCurvature,null);
});
test('OSTEO arbitrary orientation and bounded pose correction does not change authoritative simulation',()=>{
 const world=M.collision([part],null,true),hit=world.ray([0,-.2,0],[0,1,0],.4),sim=S.create(world,{...hit,forward:[0,0,-1]}),parts=B.geometry(),motion=B.motion(),interpreter=createTerrainInterpreter(world,B,{deterministic:true});
 for(let i=0;i<240;i++){sim.advance(1/120,{stick:[0,-1],push:.4});const state=sim.visual(),before=structuredClone(sim.report()),pose=motion.update(state,M.boardMatrix(state),1/120);interpreter.update(state,pose,parts,1/120,true,true);const after=sim.report();delete after.flightCollision;delete before.flightCollision;assert.deepEqual(after,before);const d=interpreter.report();assert.ok(d.lift<=.00800001&&d.tilt<=.12000001);}
 assert.equal(sim.s.ground,true);assert.equal(sim.s.glideEntries,0);assert.equal(sim.s.remounts,0);
});
