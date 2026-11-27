import test from 'node:test';import assert from 'node:assert/strict';import '../assets/atlas/marrow-surface.js';import '../assets/atlas/marrow.js';
test('EUPHORIA land pulse survives substep and is consumed by authoritative simulation',()=>{
 const part={id:'floor',name:'floor',category:'Bone',positions:Float32Array.from([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),indices:Uint16Array.from([0,2,1,0,3,2]),min:[-1,0,-1],max:[1,0,1]};
 const w=globalThis.BodyMarrow.collision([part]),h=w.ray([0,.2,0],[0,-1,0],.4),s=globalThis.BodyMarrowSurface.create(w,{...h,forward:[0,0,-1]});
 for(let k=0;k<90;k++)s.advance(1/120,{assist:true});
 assert.equal(s.s.glide,true);const before=s.report().landingDiagnostics.landRequests;
 s.advance(.001,{land:true});assert.equal(s.report().landingDiagnostics.queuedLand,true);
 s.advance(1/120,{});assert.ok(s.report().landingDiagnostics.landRequests>before);
 for(let k=0;k<1200&&!s.s.ground;k++)s.advance(1/120,{});
 assert.equal(s.s.ground,true);assert.equal(s.s.landings,1);assert.equal(s.s.remounts,0);
});
