import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
/* Pure policy tests for the #41 touch picker (no browser, no geometry). */
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/atlas/touch-pick.js','utf8'),ctx,{filename:'touch-pick.js'});
const TP=ctx.window.BodyTouchPick;
const small={w:8,h:30},big={w:160,h:200};
const cand=(id,distance,o={})=>({id,distance,depth:o.depth??0,occludedBy:o.occludedBy??null,footprint:o.footprint??small});

test('mouse and pen never receive tolerance (desktop precision is preserved)',()=>{
 assert.equal(TP.radiusFor({pointerType:'mouse',contact:40}),0);
 assert.equal(TP.radiusFor({pointerType:'pen',contact:6}),0);
 assert.equal(TP.radiusFor(undefined),0);
 assert.equal(JSON.stringify(TP.decide([cand('a',3)],0)),JSON.stringify({kind:'none',reason:'no-tolerance'}));
});
test('touch radius is adaptive and clamped to 12-24 CSS px',()=>{
 assert.equal(TP.radiusFor({pointerType:'touch'}),16,'unknown contact (iOS Safari) uses the default');
 assert.equal(TP.radiusFor({pointerType:'touch',contact:1}),16);
 assert.equal(TP.radiusFor({pointerType:'touch',contact:2}),12,'tiny contact clamps up to the minimum');
 assert.equal(TP.radiusFor({pointerType:'touch',contact:20}),20);
 assert.equal(TP.radiusFor({pointerType:'touch',contact:80}),24,'large contact clamps to the maximum');
});
test('one small candidate within the radius is selected, with the others offered as alternatives',()=>{
 const d=TP.decide([cand('mcl',6),cand('tibia',22,{footprint:big})],16);
 assert.equal(d.kind,'select');assert.equal(d.id,'mcl');
 assert.equal(d.alternatives.length,0);              // tibia is beyond the 16 px radius
 const e=TP.decide([cand('mcl',3),cand('lcl',15)],16);
 assert.equal(e.kind,'select');assert.equal(e.alternatives.map(c=>c.id).join(),'lcl');
});
test('candidates beyond the radius are ignored',()=>{
 assert.equal(TP.decide([cand('mcl',17)],16).kind,'none');
 assert.equal(TP.decide([],16).kind,'none');
});
test('two plausible candidates too close to distinguish open a chooser and NEVER auto-select',()=>{
 for(const [a,b] of [[5,7],[6,12],[2,3],[10,16],[9,9]]){
  const d=TP.decide([cand('mm',a),cand('mcl',b)],24);
  assert.equal(d.kind,'choose',`distances ${a} vs ${b} must be ambiguous`);
  assert.equal(d.options.map(o=>o.id).join(),'mm,mcl');
 }
});
test('a clearly nearer candidate wins (margin >= 8 px AND >= 1.75x)',()=>{
 assert.equal(TP.decide([cand('mm',3),cand('mcl',14)],24).kind,'select');
 assert.equal(TP.decide([cand('mm',3),cand('mcl',10)],24).kind,'choose','7 px margin is not enough');
 assert.equal(TP.decide([cand('mm',12),cand('mcl',20.5)],24).kind,'choose','8.5 px margin but under 1.75x');
 assert.equal(TP.decide([cand('mm',12),cand('mcl',21)],24).kind,'select','exactly 1.75x with a 9 px margin is confident');
});
test('hidden behind another structure is never a candidate',()=>{
 const d=TP.decide([cand('acl',2,{occludedBy:'femur'}),cand('lcl',11)],16);
 assert.equal(d.kind,'select');assert.equal(d.id,'lcl');
 assert.equal(TP.decide([cand('acl',2,{occludedBy:'femur'})],16).kind,'none');
});
test('large structures get no tolerance: grazing a bone is an empty tap, not a selection or a popup',()=>{
 assert.equal(TP.decide([cand('femur',4,{footprint:big})],16).kind,'none');
 assert.equal(TP.decide([cand('femur',4,{footprint:big}),cand('tibia',6,{footprint:big})],16).kind,'none');
 // ...but a small structure next to a bone is still offered, with the bone as the other option
 const d=TP.decide([cand('femur',4,{footprint:big}),cand('lcl',6)],16);
 assert.equal(d.kind,'choose');assert.equal(d.options.map(o=>o.id).join(),'femur,lcl');
});
test('chooser is capped at four options, nearest first',()=>{
 const d=TP.decide([1,2,3,4,5,6].map(i=>cand('s'+i,4+i*.5)),24);
 assert.equal(d.kind,'choose');assert.equal(d.options.length,4);
 assert.equal(d.options.map(o=>o.id).join(),'s1,s2,s3,s4');
});
test('policy constants are the documented ones',()=>{
 assert.equal(TP.POLICY.radiusMin,12);assert.equal(TP.POLICY.radiusMax,24);assert.equal(TP.POLICY.smallTarget,44);
});
