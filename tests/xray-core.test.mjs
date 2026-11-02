import test from 'node:test';
import assert from 'node:assert/strict';
import {ARM,STRUCTURES,angleDegrees,readArm,createSmoother,createTrackingState,coverPoint,rigGeometry} from '../experiments/xray/xray-core.mjs';

function landmarks({wrist={x:.72,y:.48},visibility=.94,side='right'}={}){
  const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
  const ids=ARM[side];
  [pose[ids[0]],pose[ids[1]],pose[ids[2]]]=[
    {x:.52,y:.2,visibility,presence:1},
    {x:.52,y:.48,visibility,presence:1},
    {...wrist,visibility,presence:1}];
  return {landmarks:[pose]};
}
test('right and left MediaPipe indices are distinct and stable',()=>{
  assert.deepEqual(ARM.right,[12,14,16]);assert.deepEqual(ARM.left,[11,13,15]);
  assert.equal(readArm(landmarks(), 'left').ok,false);
  assert.equal(readArm(landmarks({side:'left'}),'left').ok,true);
});
test('estimated elbow flexion responds to landmark movement',()=>{
  const flex=readArm(landmarks());assert.equal(flex.ok,true);
  assert.ok(flex.flexion>80&&flex.flexion<100);
  const straight=readArm(landmarks({wrist:{x:.52,y:.76}}));
  assert.ok(Math.abs(straight.flexion)<.01);
  assert.equal(Math.round(angleDegrees(flex.shoulder,flex.elbow,flex.wrist)),90);
});
test('low visibility, occlusion, out of frame and foreshortening hide pose',()=>{
  assert.equal(readArm({landmarks:[]}).ok,false);
  assert.equal(readArm(landmarks({visibility:.3})).ok,false);
  assert.match(readArm(landmarks({wrist:{x:1.1,y:.5}})).reason,/inside/i);
  assert.match(readArm(landmarks({wrist:{x:.52,y:.48}})).reason,/foreshortened/i);
});
test('EMA smoothing follows pose without snapping and resets after loss',()=>{
  const filter=createSmoother(70),a=readArm(landmarks()),b=readArm(landmarks({wrist:{x:.52,y:.76}}));
  filter.update(a,0);
  const midway=filter.update(b,70);
  assert.ok(midway.wrist.x<a.wrist.x&&midway.wrist.x>b.wrist.x);
  filter.update({ok:false},100);
  assert.equal(filter.update(b,110).wrist.x,b.wrist.x);
});
test('tracking transitions never treat missing landmarks as tracked',()=>{
  const sm=createTrackingState();
  assert.equal(sm.status,'idle');
  assert.equal(sm.event('found'),'idle');
  assert.equal(sm.event('start'),'acquiring');
  assert.equal(sm.event('missing'),'lost');
  assert.equal(sm.event('found'),'tracking');
  assert.equal(sm.event('pause'),'paused');
  assert.equal(sm.event('missing'),'paused');
  assert.equal(sm.event('start'),'acquiring');
  assert.equal(sm.event('stop'),'idle');
});
test('object-fit cover coordinates match portrait viewport crop',()=>{
  const p=coverPoint({x:.5,y:.5},640,480,360,640);
  assert.equal(p.x,180);assert.equal(p.y,320);
  const left=coverPoint({x:0,y:.5},640,480,360,640);
  assert.ok(left.x<0);
});
test('anatomical segments pivot with wrist and calibration',()=>{
  const a=readArm(landmarks()),b=readArm(landmarks({wrist:{x:.52,y:.76}}));
  const size={width:1280,height:720},view={width:390,height:660};
  const original=rigGeometry(a,size,view),extended=rigGeometry(b,size,view);
  assert.equal(original.length,9);
  assert.equal(new Set(original.map(v=>v.id)).size,9);
  assert.ok(original.every(v=>STRUCTURES[v.id]?.group===v.group));
  assert.notEqual(original.find(v=>v.id==='radius').d,extended.find(v=>v.id==='radius').d);
  const shifted=rigGeometry(a,size,view,{scale:1.3,rotation:20,x:40,y:0});
  assert.notEqual(shifted.find(v=>v.id==='biceps').d,original.find(v=>v.id==='biceps').d);
  assert.deepEqual(rigGeometry({ok:false},size,view),[]);
});
test('source links belong only to genuine atlas bone mappings',()=>{
  assert.equal(STRUCTURES.biceps.source,undefined);
  assert.equal(STRUCTURES.humerus.source,'right-humerus');
  assert.equal(STRUCTURES.radius.group,'bone');
});