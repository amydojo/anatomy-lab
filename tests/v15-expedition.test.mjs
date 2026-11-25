import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/atlas/expedition.js';
const E=globalThis.BodyExpedition;
const cam=()=>({yaw:0,pitch:0,zoom:1,width:800,height:600,frameSpan:3,target:{x:0,y:0,z:0}});
const b={min:[-2,-2,-2],max:[2,2,2]};
const input=(over={})=>({panX:0,panY:0,orbitX:0,orbitY:0,zoom:0,...over});
test('radial deadzone suppresses drift; diagonal magnitude is bounded',()=>{assert.deepEqual(E.stick(.1,.1),[0,0]);assert.ok(Math.abs(Math.hypot(...E.stick(1,1))-1)<1e-9);});
test('trigger direction and standard button reads',()=>{const buttons=Array.from({length:17},()=>({value:0,pressed:false}));buttons[7].value=.8;buttons[0].pressed=true;const v=E.read({axes:[0,0,0,0],buttons});assert.ok(v.zoom>0);assert.equal(v.buttons[0],true);});
test('neutral input does not render or change camera',()=>{const c=cam();assert.equal(E.advance(c,input(),.016,b,14),false);assert.deepEqual(c,cam());});
test('navigation is frame-rate independent for fixed yaw and zoom',()=>{const a=cam(),c=cam();for(let i=0;i<60;i++)E.advance(a,input({orbitX:1,zoom:.5}),1/60,b,14);for(let i=0;i<120;i++)E.advance(c,input({orbitX:1,zoom:.5}),1/120,b,14);assert.ok(Math.abs(a.yaw-c.yaw)<1e-8);assert.ok(Math.abs(a.zoom-c.zoom)<1e-8);});
test('bounded panning, pitch and studio zoom; dt capped after stall',()=>{const c=cam();E.advance(c,input({orbitX:1}),10,b,14);assert.ok(c.yaw<=.081);for(let i=0;i<500;i++)E.advance(c,input({panX:1,panY:1,orbitY:1,zoom:1}),.05,b,14);assert.equal(c.zoom,14);assert.equal(c.pitch,.85);for(const v of Object.values(c.target))assert.ok(Math.abs(v)<=2.72+1e-9);});
test('normal zoom cap and zoom-out floor',()=>{const c=cam();for(let i=0;i<100;i++)E.advance(c,input({zoom:1}),.05,b,1.95);assert.equal(c.zoom,1.95);for(let i=0;i<100;i++)E.advance(c,input({zoom:-1}),.05,b,1.95);assert.equal(c.zoom,.7);});

test('diagnostics ring stays bounded and uses nearest-rank percentiles',()=>{const s=E.series(3);[1,2,3,100].forEach(x=>s.push(x));assert.deepEqual(s.summary(),{samples:3,totalSamples:4,median:3,p95:100,p99:100,max:100,estimatedMissed60HzSlots:5});});
test('diagnostics separates active intervals from idle and suspended time',()=>{const d=E.diagnostics(()=>0);d.active(0);d.active(16);d.idle();d.active(900);d.active(916);d.poll(0);d.poll(16);d.suspend();d.poll(8000);const r=d.report();assert.equal(r.metrics.activeFrameIntervalMs.samples,2);assert.equal(r.metrics.activeFrameIntervalMs.p99,16);assert.equal(r.metrics.pollIntervalMs.samples,1);assert.equal(r.metrics.longTaskMs,null);assert.equal(r.metrics.renderCpuMs.median,null);});
