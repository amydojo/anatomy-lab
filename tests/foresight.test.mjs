import test from 'node:test';import assert from 'node:assert/strict';
import '../assets/atlas/marrow-surface.js';import '../assets/atlas/marrow-board.js';import '../assets/atlas/marrow.js';
import {createSlipstreamManifold} from '../experiments/hairpin/vector/velocity/slipstream-manifold.mjs';
import {createKinetic} from '../experiments/hairpin/vector/kinetic/kinetic-motion.mjs';
import {createConfigurationOracle,mechanicalPose,commonCorrection} from '../experiments/hairpin/vector/velocity/kinesis-oracle.mjs';
import {foresightRoute} from '../experiments/hairpin/vector/velocity/foresight-planner.mjs';
const B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow,S=globalThis.BodyMarrowSurface;
function cube(id,c,h){const positions=[],indices=[],faces=[[0,-1,2,1],[0,1,1,2],[1,-1,0,2],[1,1,2,0],[2,-1,1,0],[2,1,0,1]];for(const [k,s,u,v] of faces){const base=positions.length/3;for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=c.slice();p[k]+=s*h[k];p[u]+=a*h[u];p[v]+=b*h[v];positions.push(...p);}indices.push(base,base+1,base+2,base,base+2,base+3);}return {id,name:id,category:'Bone',positions:Float64Array.from(positions),indices:Uint32Array.from(indices),min:c.map((v,k)=>v-h[k]),max:c.map((v,k)=>v+h[k])};}
const anatomy=cube('floor',[0,-.1,0],[1,.1,1]),parts=[cube('__marrow_joint_0',[0,0,0],[.004,.002,.005]),cube('__marrow_front_0',[0,.001,.02],[.009,.002,.012]),cube('__marrow_rear_0',[0,.001,-.02],[.009,.002,.012]),cube('__marrow_front_pod_0',[0,-.003,.02],[.006,.002,.006]),cube('__marrow_rear_pod_0',[0,-.003,-.02],[.006,.002,.006])];
const world=()=>M.collision([anatomy],null,true),seed=w=>({hit:{...w.ray([0,.2,0],[0,-1,0],.4),forward:[0,0,-1]},ridge:[0,0,-1]});
test('FORESIGHT checkpoint restores exact fixed-step state and mechanical history after counterfactual trials',()=>{
 const w=world(),h=seed(w).hit,m=createSlipstreamManifold(w,parts),s=S.create(w,h,{manifold:m,researchCheckpoint:true}),k=createKinetic(B),step=i=>{s.advance(1/120,i);const q=s.researchState();return k.update(q,M.boardMatrix(q),1/120,{hover:.00035});};
 for(let i=0;i<20;i++)step({stick:[0,-1],push:.6,controlYaw:0});const snap=s.checkpoint(),motion=k.checkpoint(),a=step({stick:[.3,-1],push:.6,controlYaw:0}),state=s.researchState();
 for(let i=0;i<12;i++)step({stick:[-.7,-1],push:1,controlYaw:0});s.restore(snap);k.restore(motion);const b=step({stick:[.3,-1],push:.6,controlYaw:0});assert.deepEqual(a,b);assert.deepEqual(state,s.researchState());assert.equal(s.s.steps,21);
});
test('FORESIGHT reconstructed articulated sweep matches all existing qualified assembly endpoint transforms and rejects tampering',()=>{
 const w=world(),s=S.create(w,seed(w).hit),k=createKinetic(B);s.advance(1/120,{stick:[.4,-1],push:1});const a=k.update({...s.s,bank:.1},M.boardMatrix(s.s),1/120),b=commonCorrection(a,.03,-.02,.001),rebuilt=mechanicalPose(b,b.vehicle);
 for(const p of parts){const x=B.transform(p.id,b),y=B.transform(p.id,rebuilt);assert.ok([...x.r,...x.t].every((v,i)=>Math.abs(v-[...y.r,...y.t][i])<1e-10));}
 const o=createConfigurationOracle(anatomy,parts,B,{maxDepth:7});assert.equal(o.articulatedSweep(a,b).clear,true);const fake={...b,front:{...b.front,t:[9,9,9]}};assert.equal(o.articulatedSweep(a,fake).reason,'unqualified-articulation-endpoint');
});
test('FORESIGHT independent plane trajectory commits admitted states and respects deterministic budget',()=>{
 const w=world(),o=createConfigurationOracle(anatomy,parts,B,{maxDepth:7}),q=foresightRoute(w,seed(w),parts,B,S,M.boardMatrix,o,{steps:32,horizon:4,maxCandidates:3,sampleEvery:4});
 assert.equal(q.committed,32);assert.equal(q.stop,null);assert.ok(q.summary.intentProgress>.004);assert.equal(q.summary.blockedSteps,0);assert.equal(q.liveAuthorized,false);assert.ok(q.rows.every(x=>o.pose(x.pose).clear));assert.ok(q.rows.every(x=>x.support.ok));assert.ok(q.summary.maxIntentDeviation<.01);
 const tiny=foresightRoute(w,seed(w),parts,B,S,M.boardMatrix,o,{steps:32,horizon:4,maxCandidates:3,queryBudget:5});assert.equal(tiny.committed,0);assert.equal(tiny.stop.reason,'deterministic-query-budget');
});
test('FORESIGHT changed rider command replans; explicit flight request cannot masquerade as qualified ground movement',()=>{
 const w=world(),o=createConfigurationOracle(anatomy,parts,B,{maxDepth:7}),q=foresightRoute(w,seed(w),parts,B,S,M.boardMatrix,o,{steps:40,horizon:4,maxCandidates:3,schedule:'reverse',sampleEvery:1});assert.equal(q.committed,40);assert.ok(Math.abs(q.rows.at(-1).p[0]-q.rows[20].p[0])>.001);assert.equal(q.liveAuthorized,false);
 const flight=foresightRoute(w,seed(w),parts,B,S,M.boardMatrix,o,{steps:132,horizon:4,maxCandidates:3,schedule:'flight',sampleEvery:12});assert.equal(flight.committed,120);assert.equal(flight.stop.reason,'explicit-flight-request-outside-ground-oracle');
});
