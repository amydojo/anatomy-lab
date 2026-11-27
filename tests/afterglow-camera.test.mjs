import test from 'node:test';import assert from 'node:assert/strict';import '../assets/atlas/marrow-ride.js';import '../assets/atlas/marrow-surface.js';import '../assets/atlas/marrow.js';
const S=globalThis.BodyMarrowSurface,M=globalThis.BodyMarrow;
function sphere(r=.25){const p=[],ix=[],N=64,K=96;for(let j=0;j<=N;j++)for(let k=0;k<=K;k++){const a=Math.PI*j/N,b=2*Math.PI*k/K;p.push(r*Math.sin(a)*Math.cos(b),r*Math.cos(a),r*Math.sin(a)*Math.sin(b));}for(let j=0;j<N;j++)for(let k=0;k<K;k++){const a=j*(K+1)+k,b=a+K+1;ix.push(a,b,a+1,a+1,b,b+1);}return {id:'shell',name:'exact triangle sphere',category:'Bone',positions:Float32Array.from(p),indices:Uint32Array.from(ix),min:[-r,-r,-r],max:[r,r,r]};}
test('AFTERGLOW exterior and interior: full projection, positive depth, bounded transition, unchanged ride',()=>{
 const world=M.collision([sphere()],null,true);
 for(const [width,height] of [[1440,900],[390,664]])for(const inside of [false,true]){
  const hit=world.ray(inside?[0,0,0]:[0,.4,0],inside?[0,1,0]:[0,-1,0],.4),sim=S.create(world,{...hit,forward:[0,0,-1]}),rig=S.rig(sim.s,world),c={width,height,frameSpan:3.25};let framed=0,minDistance=Infinity,minDepth=Infinity,maxAngular=0,maxProjected=0;
  for(let i=0;i<1320;i++){sim.advance(1/120,{stick:[0,-1],cameraForward:rig.forward(),push:1});const q=rig.step(sim.visual(),{},1/120,null,c);framed+=Number(q.framed);minDistance=Math.min(minDistance,q.distance);minDepth=Math.min(minDepth,q.projection.depth);maxAngular=Math.max(maxAngular,q.angularVelocity);maxProjected=Math.max(maxProjected,q.projection.x*2/width,q.projection.y*2/height);assert.ok(sim.s.ground&&!sim.s.glide);assert.equal(q.fovDegrees,52);assert.equal(rig.controlYaw(),0);}
  const result=sim.report();console.log('AFTERGLOW_CIRCUIT',JSON.stringify({width,height,inside,framed,minDistance,minDepth,maxAngular,maxProjected,rideDistance:result.rideDistance,contactLosses:result.contactLosses}));
  assert.ok(framed/1320>.95);assert.ok(minDepth>.006);assert.ok(maxAngular<=1.70001);assert.ok(result.rideDistance>1.6);assert.equal(result.contactLosses,0);assert.equal(result.remounts,0);assert.equal(result.glideEntries,0);
 }
});
