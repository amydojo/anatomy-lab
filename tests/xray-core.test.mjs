import test from 'node:test';
import assert from 'node:assert/strict';
import {makePatch,grayImage,matchPatch,makeCloseupTracker} from '../experiments/xray/xray-tracker.mjs';
import {ARM,STRUCTURES,angleDegrees,readArm,createSmoother,createTrackingState,coverPoint,rigGeometry,plausibleFullArm,createPoseLock,closeupGeometry,coverTransform} from '../experiments/xray/xray-core.mjs';

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
test('full-arm gate rejects palm-sized hallucinated limbs and requires five stable samples',()=>{
  const lock=createPoseLock(5);
  const tiny=readArm(landmarks({wrist:{x:.56,y:.50}}));
  const fake={...tiny,shoulder:{x:.5,y:.45},elbow:{x:.53,y:.48},wrist:{x:.57,y:.5},angle:130,confidence:.93,ok:true};
  assert.equal(plausibleFullArm(fake).ok,false);
  const good=readArm(landmarks());
  assert.equal(plausibleFullArm(good).ok,true);
  for(let i=0;i<4;i++)assert.equal(lock.update(good).locked,false);
  assert.equal(lock.update(good).locked,true);
  assert.equal(lock.update({ok:false,reason:'lost'}).locked,false);
  assert.equal(lock.update(good).locked,false);
});
test('close-up geometry only exposes structures within the calibrated forearm',()=>{
  const shapes=closeupGeometry({x:40,y:80},{x:230,y:100});
  assert.equal(shapes.length,6);
  assert.ok(shapes.some(p=>p.id==='radius'));
  assert.ok(shapes.some(p=>p.id==='flexors'));
  assert.equal(shapes.some(p=>p.id==='humerus'||p.id==='biceps'),false);
  assert.deepEqual(closeupGeometry({x:5,y:5},{x:12,y:10}),[]);
});
function syntheticFrame(shift=0,blank=false){
 const width=180,height=100,gray=new Float32Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const a=x-shift;
  const hash=Math.sin(a*12.9898+y*78.233)*43758.5453;
  gray[y*width+x]=blank?.5:hash-Math.floor(hash);
 }
 return {width,height,gray};
}
test('texture tracker locates translated image features without fabricating a pose',()=>{
 const t=makeCloseupTracker(),f=syntheticFrame(0);
 assert.equal(t.setAnchor('elbow',f,40,45).ok,true);
 assert.equal(t.ready,false);
 assert.equal(t.setAnchor('wrist',f,125,58).ok,true);
 assert.equal(t.ready,true);
 const result=t.update(syntheticFrame(6));
 assert.equal(result.ok,true);
 assert.ok(Math.abs(result.elbow.x-46)<=1);
 assert.ok(Math.abs(result.wrist.x-131)<=1);
 assert.equal(t.lost,false);
 const lost=t.update(syntheticFrame(45));
 assert.equal(lost.ok,false);
 assert.equal(t.lost,true);
 t.reset();assert.equal(t.ready,false);
});
test('blank skin allows frozen illustrated placement but never false live tracking',()=>{
 const blank=syntheticFrame(0,true),t=makeCloseupTracker();
 assert.equal(t.setAnchor('elbow',blank,40,40).ok,true);
 assert.equal(t.anchors.elbow.trackable,false);
 assert.equal(t.setAnchor('wrist',blank,130,55).ok,true);
 assert.equal(t.ready,true);assert.equal(t.trackable,false);
 assert.match(t.update(blank).reason,/texture/i);
 assert.equal(t.update(blank).ok,false);
 assert.equal(makePatch(blank,1,1),null);
 assert.equal(matchPatch(blank,{data:new Float32Array(169),radius:6,x:40,y:40,variance:0,contrast:0},40,40).ok,false);
});
test('invalid and overly close anchors request a retap without erasing elbow',()=>{
 const t=makeCloseupTracker(),f=syntheticFrame();
 assert.equal(t.setAnchor('elbow',f,-1,30).ok,false);
 assert.equal(t.setAnchor('elbow',f,55,45).ok,true);
 assert.equal(t.setAnchor('wrist',f,60,48).ok,false);
 assert.ok(t.anchors.elbow);assert.equal(t.anchors.wrist,undefined);
 assert.equal(t.setAnchor('wrist',f,140,55).ok,true);
});
test('cover mapping round-trips portrait crop, quarter rotations and mirror',()=>{
 for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
   const t=coverTransform(640,480,390,844,{rotation,mirror});
   for(const p of [{x:.10,y:.12},{x:.76,y:.66}]){
     const projected=t.toViewport(p),restored=t.toSource(projected);
     assert.ok(Math.abs(p.x-restored.x)<1e-10);
     assert.ok(Math.abs(p.y-restored.y)<1e-10);
   }
 }
 assert.ok(coverTransform(1280,720,390,844).offsetX<0);
 assert.equal(coverTransform(360,780,390,844).offsetX,0);
});

/* V3 integrity: calibration may never push the illustration outside the camera area the user can see. */
import {pathBounds,usableArea,visibleRatio,constrainCalibration,CALIBRATION_LIMITS} from '../experiments/xray/xray-core.mjs';
test('pathBounds reads every coordinate of generated bone and muscle paths',()=>{
  const b=pathBounds(closeupGeometry({x:100,y:100},{x:300,y:260}).find(s=>s.id==='flexors').d);
  assert.ok(b.minX<300&&b.maxX>100&&b.minY<260&&b.maxY>100);
  assert.ok(Number.isFinite(b.minX+b.maxX+b.minY+b.maxY));
  assert.equal(pathBounds('M 0 0 Z').maxX,0);assert.equal(pathBounds(''),null);
});
test('usableArea subtracts head and dock bands and never returns a negative box',()=>{
  const a=usableArea({width:390,height:844},{headBottom:60,dockTop:700});
  assert.deepEqual(a,{left:0,top:60,right:390,bottom:700});
  const squeezed=usableArea({width:390,height:300},{headBottom:200,dockTop:150});
  assert.ok(squeezed.bottom>=squeezed.top);
});
test('visibleRatio is the fraction of a shape box inside the usable area',()=>{
  const area={left:0,top:60,right:390,bottom:700};
  assert.equal(visibleRatio({minX:10,minY:100,maxX:50,maxY:140},area),1);
  assert.equal(visibleRatio({minX:10,minY:720,maxX:50,maxY:760},area),0);
  assert.ok(Math.abs(visibleRatio({minX:10,minY:680,maxX:50,maxY:720},area)-.5)<1e-9);
});
test('constrainCalibration keeps the elbow anchor inside the usable area with a margin',()=>{
  const area={left:0,top:60,right:390,bottom:700};
  const out=constrainCalibration({scale:1,rotation:0,x:100,y:100},{x:380,y:690},area);
  assert.equal(out.clamped,true);
  assert.ok(380+out.calibration.x<=390-CALIBRATION_LIMITS.edgeMarginPx);
  assert.ok(690+out.calibration.y<=700-CALIBRATION_LIMITS.edgeMarginPx);
  const ok=constrainCalibration({scale:1,rotation:0,x:10,y:-10},{x:200,y:300},area);
  assert.equal(ok.clamped,false);assert.equal(ok.calibration.x,10);
  const bad=constrainCalibration({scale:9,rotation:200,x:NaN,y:Infinity},{x:200,y:300},area);
  assert.ok(bad.calibration.scale<=1.5&&Math.abs(bad.calibration.rotation)<=45);
  assert.ok(Number.isFinite(bad.calibration.x)&&Number.isFinite(bad.calibration.y));
});
