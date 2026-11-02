import {STRUCTURES,readArm,createSmoother,createTrackingState,createPoseLock,rigGeometry,closeupGeometry} from './xray-core.mjs';
import {grayImage,makeCloseupTracker} from './xray-tracker.mjs';

// A deliberately independent prototype: do not couple camera state to V13 Atlas globals.
// Camera pixels are never sent to an application endpoint, saved or recorded.
const $=id=>document.getElementById(id);
const video=$('camera'),frozen=$('frozen'),viewport=$('viewport'),svg=$('overlay');
const poseState=createTrackingState(),smoother=createSmoother(),poseLock=createPoseLock(),tracker=makeCloseupTracker();
const NS='http://www.w3.org/2000/svg';
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0';
const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let landmarker=null,stream=null,side='right',layer='muscle',opacity=.84,mode='closeup',anchorStep='elbow';
const sampleCanvas=document.createElement('canvas'),sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
let sampleSize={width:0,height:0};
let selected=null,lastPose=null,raf=0,lastFrameTime=-1,lastInferTime=0,frames=0,fpsStart=0,session=0,running=false;
let calibration={scale:1,rotation:0,x:0,y:0};
let lastVideoSize={width:0,height:0};
const ui={start:$('launch'),stop:$('stop'),pause:$('pause'),resume:$('resume'),empty:$('empty'),message:$('message'),notice:$('tracking-notice')};
const setText=(id,text)=>{$(id).textContent=text;};
function message(text){ui.message.textContent=text;}
function notice(text){ui.notice.hidden=!text;ui.notice.textContent=text||'';}
function status(code,label){
  setText('status',label);
  $('status-dot').dataset.status=code;
}
function clearOverlay(){svg.replaceChildren();}
function resetMetrics(){setText('angle','—°');setText('confidence','—');setText('fps','— FPS');}
function clearPoseMetrics(){setText('angle','—°');setText('confidence','—');}
function updateAnchorHints(){
  const a=tracker.anchors,ready=tracker.ready;
  $('anchor-help').textContent=ready?'Anchors set · tap Reset to recalibrate':
    a.elbow?'Tap the visible wrist (use an edge or texture).':'Tap your elbow (choose a well-lit edge or texture).';
  $('anchor-reset').disabled=!a.elbow&&!a.wrist;
  $('anchor-hud').hidden=mode!=='closeup';
  $('angle-caption').textContent=mode==='closeup'?'ELBOW / NOT MEASURED':'ELBOW / FLEXION';
  $('confidence-caption').textContent=mode==='closeup'?'ANCHOR MATCH*':'LANDMARK VISIBILITY';
}
function resetSelection(){
  selected=null;setText('structure-name','Tap an illustrated structure');
  setText('structure-info','Select a visible muscle, bone or connective structure to learn its function.');
  $('atlas-link').hidden=true;
}
function choose(id){
  const info=STRUCTURES[id];
  if(!info||info.group!==layer)return;
  selected=id;setText('structure-name',info.name);setText('structure-info',info.description);
  const link=$('atlas-link');
  if(info.source){
    link.href='/atlas/?region=elbow&structure='+encodeURIComponent(info.source);
    link.textContent='View sourced '+info.name+' in the Atlas ↗';
    link.hidden=false;
  }else link.hidden=true;
  render();
}
function makeNode(tag,attributes){
  const el=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));
  return el;
}
function render(){
  if(!lastPose?.ok||(mode==='auto'&&(!lastVideoSize.width||!lastVideoSize.height))){clearOverlay();return;}
  const bounds=viewport.getBoundingClientRect(),width=bounds.width,height=bounds.height;
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  const armElbow={x:lastPose.elbow.x*width+calibration.x,y:lastPose.elbow.y*height+calibration.y};
  const baseWrist={x:lastPose.wrist.x*width,y:lastPose.wrist.y*height};
  const rotation=calibration.rotation*Math.PI/180;
  const dx=baseWrist.x-lastPose.elbow.x*width,dy=baseWrist.y-lastPose.elbow.y*height;
  const closeWrist={x:armElbow.x+calibration.scale*(dx*Math.cos(rotation)-dy*Math.sin(rotation)),
    y:armElbow.y+calibration.scale*(dx*Math.sin(rotation)+dy*Math.cos(rotation))};
  const shapes=mode==='closeup'?closeupGeometry(armElbow,closeWrist):rigGeometry(lastPose,lastVideoSize,{width,height},calibration);
  const visible=new Set();
  // Keep hit targets stable across inference frames. Replacing elements every
  // frame causes touch/click gestures to detach before Safari can dispatch them.
  for(const item of shapes){
    if(item.group!==layer)continue;
    visible.add(item.id);
    let shape=svg.querySelector('[data-id="'+item.id+'"]');
    if(!shape){
      shape=makeNode('path',{'data-id':item.id,'data-group':item.group,
        class:'shape',role:'button',tabindex:'0',
        'aria-label':'Inspect '+STRUCTURES[item.id].name});
      const title=makeNode('title',{});title.textContent=STRUCTURES[item.id].name;
      shape.appendChild(title);svg.appendChild(shape);
    }
    shape.setAttribute('d',item.d);
    shape.setAttribute('fill-opacity',String(selected===item.id?Math.min(1,opacity+.14):opacity));
    shape.setAttribute('stroke-opacity',String(opacity));
    shape.classList.toggle('selected',selected===item.id);
  }
  for(const old of svg.querySelectorAll('.shape'))
    if(!visible.has(old.dataset.id))old.remove();
  const e=lastPose.elbow;
  const scale=mode==='auto'?Math.max(width/lastVideoSize.width,height/lastVideoSize.height):1;
  const ex=mode==='closeup'?e.x*width+calibration.x:(width-lastVideoSize.width*scale)/2+e.x*lastVideoSize.width*scale+calibration.x;
  const ey=mode==='closeup'?e.y*height+calibration.y:(height-lastVideoSize.height*scale)/2+e.y*lastVideoSize.height*scale+calibration.y;
  let ring=svg.querySelector('.joint-ring');
  if(!ring){ring=makeNode('circle',{class:'joint-ring'});svg.appendChild(ring);}
  ring.setAttribute('cx',String(ex));ring.setAttribute('cy',String(ey));
  ring.setAttribute('r',String(Math.max(12,width*.024)));
  let center=svg.querySelector('.joint-marker');
  if(!center){center=makeNode('circle',{class:'joint-marker',r:2.5});svg.appendChild(center);}
  center.setAttribute('cx',String(ex));center.setAttribute('cy',String(ey));
}
svg.addEventListener('click',e=>{const id=e.target.closest?.('[data-id]')?.dataset.id;if(id)choose(id);});
svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const id=e.target.closest?.('[data-id]')?.dataset.id;if(id){e.preventDefault();choose(id);}}});
function updateTracking(sample,time){
  if(!sample.ok){
    smoother.reset();lastPose=null;clearOverlay();clearPoseMetrics();
    poseState.event('missing');status('lost','TRACKING LOST');notice(sample.reason);
    message(sample.reason+' Anatomy is hidden until tracking returns.');
    return;
  }
  const wasTracking=poseState.status==='tracking';
  lastPose=smoother.update(sample,time);
  poseState.event('found');status('tracking','TRACKING ARM');notice('');
  setText('angle',Math.round(Math.max(0,Math.min(180,lastPose.flexion)))+'°');
  setText('confidence',Math.round(sample.confidence*100)+'%');
  message('Tracking '+side+' elbow. Bend your arm and tap a '+layer+' to inspect it. Angle is estimated in 2D.');
  if(!wasTracking&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const sweep=$('scanline');sweep.classList.remove('active');void sweep.offsetWidth;sweep.classList.add('active');
  }
  render();
}
function snapshotFrame(){
  const source=!frozen.hidden?frozen:video;
  const videoW=source===video?video.videoWidth:frozen.width;
  const videoH=source===video?video.videoHeight:frozen.height;
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(!videoW||!videoH||!w||!h)return null;
  const targetW=Math.min(260,Math.max(120,Math.round(w*.7)));
  const targetH=Math.round(targetW*h/w);
  if(sampleCanvas.width!==targetW||sampleCanvas.height!==targetH){sampleCanvas.width=targetW;sampleCanvas.height=targetH;}
  const k=Math.max(targetW/videoW,targetH/videoH);
  sampleContext.drawImage(source,(targetW-videoW*k)/2,(targetH-videoH*k)/2,videoW*k,videoH*k);
  sampleSize={width:targetW,height:targetH};
  return grayImage(sampleContext.getImageData(0,0,targetW,targetH));
}
function closeupPose(sample){
  const e=sample.elbow,w=sample.wrist;
  const pose={ok:true,elbow:{x:e.x/sampleSize.width,y:e.y/sampleSize.height},
    wrist:{x:w.x/sampleSize.width,y:w.y/sampleSize.height},confidence:sample.confidence,mode:'closeup'};
  lastPose=pose;poseState.event('found');status('tracking','ANCHORS TRACKING');notice('');
  setText('angle','N/A');setText('confidence',Math.round(sample.confidence*100)+'%*');
  message('Tracking image features near your anchors. Not a measured joint angle or anatomical segmentation.');
  render();
}
function updateCloseup(){
  const frame=snapshotFrame();if(!frame)return;
  if(!tracker.ready){
    lastPose=null;clearOverlay();clearPoseMetrics();
    status('acquiring','SET TWO ANCHORS');notice('Tap elbow, then wrist in the camera image.');return;
  }
  const sample=tracker.update(frame);
  if(!sample.ok){
    lastPose=null;clearOverlay();clearPoseMetrics();poseState.event('missing');
    status('lost','RECALIBRATE');notice(sample.reason+' Tap Reset anchors.');
    message('Image-feature lock lost. Anatomy hidden until both anchors are reset.');return;
  }
  closeupPose(sample);
}
function tick(now){
  if(!running)return;
  raf=requestAnimationFrame(tick);
  // Inference may synchronously block the UI; bound it independently of display refresh.
  if(video.readyState<2||!video.videoWidth||video.currentTime===lastFrameTime||now-lastInferTime<(mode==='closeup'?90:34))return;
  lastFrameTime=video.currentTime;lastInferTime=now;
  lastVideoSize={width:video.videoWidth,height:video.videoHeight};
  try{
    if(mode==='closeup'){updateCloseup();}
    else{
      const result=landmarker.detectForVideo(video,now);
      const candidate=readArm(result,side);
      const gate=poseLock.update(candidate);
      if(!gate.ok)updateTracking({ok:false,reason:gate.reason},now);
      else if(!gate.locked)updateTracking({ok:false,reason:gate.reason},now);
      else updateTracking(candidate,now);
    }
    frames++;
    if(now-fpsStart>=1100){
      setText('fps',(frames*1000/(now-fpsStart)).toFixed(0)+' FPS');
      frames=0;fpsStart=now;
    }
  }catch(error){
    stop({reason:'Tracking engine stopped: '+error.message});
  }
}
async function buildLandmarker(){
  const {FilesetResolver,PoseLandmarker}=await import(CDN+'/vision_bundle.mjs');
  const fileset=await FilesetResolver.forVisionTasks(CDN+'/wasm');
  const options={baseOptions:{modelAssetPath:MODEL,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,
    minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.52};
  try{return await PoseLandmarker.createFromOptions(fileset,options);}
  catch{return PoseLandmarker.createFromOptions(fileset,{...options,baseOptions:{modelAssetPath:MODEL,delegate:'CPU'}});}
}
function releaseStream(){
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  video.pause();video.srcObject=null;
}
function halt(){
  running=false;cancelAnimationFrame(raf);raf=0;releaseStream();
  video.hidden=true;lastFrameTime=-1;
}
async function start(){
  if(running||stream)return;
  const ticket=++session;
  smoother.reset();poseLock.reset();lastPose=null;clearOverlay();resetMetrics();
  poseState.event('start');status('acquiring','INITIALIZING');notice('Requesting camera…');
  message('Camera initializes locally. Allow permission when your browser asks.');
  ui.start.disabled=true;ui.resume.disabled=true;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    failure('An HTTPS connection and a browser supporting camera access are required.',ticket);return;
  }
  try{
    const granted=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
    if(ticket!==session){granted.getTracks().forEach(t=>t.stop());return;}
    stream=granted;video.srcObject=granted;
    granted.getVideoTracks()[0]?.addEventListener('ended',()=>{if(ticket===session)stop({reason:'Camera disconnected. Activate again to retry.'});},{once:true});
    await video.play();
    if(ticket!==session)return;
    status('acquiring',mode==='auto'?'LOADING POSE MODEL':'READY TO CALIBRATE');
    notice(mode==='auto'?'Loading on-device landmark detection…':'Preparing close-up image tracker…');
    if(mode==='auto'&&!landmarker){
      const engine=await buildLandmarker();
      if(ticket!==session){engine.close();return;}
      landmarker=engine;
    }
    ui.empty.hidden=true;video.hidden=false;frozen.hidden=true;
    const context=frozen.getContext('2d');context?.clearRect(0,0,frozen.width,frozen.height);
    running=true;ui.start.disabled=false;ui.stop.disabled=false;ui.pause.disabled=false;
    ui.resume.hidden=true;ui.pause.hidden=false;
    fpsStart=performance.now();frames=0;lastInferTime=0;
    status('acquiring',mode==='closeup'?'SET TWO ANCHORS':'FINDING ARM');
    notice(mode==='closeup'?'Tap your elbow, then wrist in the camera preview.':'Keep shoulder, elbow and wrist visible');
    message(mode==='closeup'?'Calibrate two visual anchors. Tracking is illustrative and may lose lock on smooth skin.':'Include the whole arm for automatic pose tracking.');
    updateAnchorHints();
    raf=requestAnimationFrame(tick);
  }catch(error){
    if(ticket!==session)return;
    const denied=error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError';
    const reason=denied?'Camera permission denied. Allow camera access in Safari settings and try again.':
      error?.name==='NotFoundError'?'No camera found on this device.':'Camera or pose model unavailable: '+(error?.message||'Unknown error');
    failure(reason,ticket);
  }
}
function failure(reason,ticket){
  if(ticket!==session)return;
  halt();smoother.reset();lastPose=null;clearOverlay();poseState.event('stop');
  status('lost','UNAVAILABLE');notice(reason);message(reason);
  ui.empty.hidden=false;ui.start.disabled=false;ui.stop.disabled=true;ui.pause.disabled=true;ui.resume.hidden=true;ui.pause.hidden=false;
}
function stop({reason='Camera stopped. Activate X-RAY to begin again.'}={}){
  session++;halt();lastVideoSize={width:0,height:0};poseLock.reset();
  if(landmarker){landmarker.close();landmarker=null;}
  smoother.reset();lastPose=null;poseState.event('stop');clearOverlay();resetMetrics();resetSelection();
  const context=frozen.getContext('2d');context?.clearRect(0,0,frozen.width,frozen.height);
  frozen.hidden=true;ui.empty.hidden=false;ui.start.disabled=false;ui.stop.disabled=true;
  ui.pause.disabled=true;ui.pause.hidden=false;ui.resume.hidden=true;
  status('idle','CAMERA OFF');notice('');message(reason);
}
function pause(){
  if(!running)return;
  const w=viewport.clientWidth,h=viewport.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
  frozen.width=Math.round(w*dpr);frozen.height=Math.round(h*dpr);
  const ctx=frozen.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  const sourceW=video.videoWidth,sourceH=video.videoHeight,k=Math.max(w/sourceW,h/sourceH);
  ctx.drawImage(video,(w-sourceW*k)/2,(h-sourceH*k)/2,sourceW*k,sourceH*k);
  poseState.event('pause');halt();frozen.hidden=false;
  ui.pause.hidden=true;ui.resume.hidden=false;ui.resume.disabled=false;
  status('paused','FRAME PAUSED');notice('Camera hardware released · current frame held in memory');
  message(mode==='closeup'?'Camera off. You can set or reset anchors on the frozen frame.':'Camera off. Adjust alignment, or resume to reacquire tracking.');
  render();
}
ui.start.addEventListener('click',start);ui.stop.addEventListener('click',()=>stop());
document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
  if(mode===btn.dataset.mode)return;
  const wasActive=running||!!stream;
  if(wasActive||!frozen.hidden)stop({reason:'Switching tracking mode.'});
  mode=btn.dataset.mode;tracker.reset();poseLock.reset();anchorStep='elbow';lastPose=null;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  updateAnchorHints();resetSelection();clearOverlay();
  message(mode==='closeup'?'Close-up lens: tap elbow and wrist after activating the camera.':'Full arm: show shoulder, elbow and wrist for automatic pose tracking.');
  if(wasActive)start();
}));
$('anchor-reset').addEventListener('click',()=>{
  tracker.reset();anchorStep='elbow';lastPose=null;clearOverlay();clearPoseMetrics();updateAnchorHints();
  status('acquiring','SET TWO ANCHORS');notice('Tap your elbow, then your wrist.');
});
viewport.addEventListener('pointerup',event=>{
  if(mode!=='closeup'||(!running&&frozen.hidden)||tracker.ready&&!tracker.lost)return;
  if(event.target.closest?.('button,a'))return;
  const rect=viewport.getBoundingClientRect();
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  // Retap elbow then wrist after a tracker loss, avoiding stale anchors.
  if(tracker.lost){tracker.reset();anchorStep='elbow';}
  const frame=snapshotFrame();if(!frame)return;
  const result=tracker.setAnchor(anchorStep,frame,x/rect.width*frame.width,y/rect.height*frame.height);
  if(!result.ok){notice(result.reason);return;}
  anchorStep=anchorStep==='elbow'?'wrist':'elbow';updateAnchorHints();
  if(tracker.ready){const a=tracker.anchors;closeupPose({ok:true,elbow:a.elbow,wrist:a.wrist,confidence:1});}
  else {status('acquiring','SET WRIST ANCHOR');notice('Elbow set. Tap your wrist.');}
});
ui.pause.addEventListener('click',pause);ui.resume.addEventListener('click',start);
document.querySelectorAll('[data-side]').forEach(btn=>btn.addEventListener('click',()=>{
  side=btn.dataset.side;
  document.querySelectorAll('[data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  smoother.reset();poseLock.reset();lastPose=null;clearOverlay();resetSelection();
  if(running&&mode==='auto'){poseState.event('missing');status('acquiring','FINDING ARM');notice('Finding '+side+' arm…');}
}));
document.querySelectorAll('[data-layer]').forEach(btn=>btn.addEventListener('click',()=>{
  layer=btn.dataset.layer;
  document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  resetSelection();render();
}));
$('opacity').addEventListener('input',e=>{opacity=Number(e.target.value)/100;setText('opacity-value',e.target.value+'%');render();});
const calibrations=[['scale',v=>v/100,v=>v+'%'],['rotation',v=>v,v=>v+'°'],['shift-x',v=>v,v=>String(v)],['shift-y',v=>v,v=>String(v)]];
for(const [id,convert,format] of calibrations){
 $(id).addEventListener('input',e=>{
   const v=Number(e.target.value),key=id==='shift-x'?'x':id==='shift-y'?'y':id;
   calibration[key]=convert(v);setText(id+'-value',format(v));render();
 });
}
$('reset').addEventListener('click',()=>{
 calibration={scale:1,rotation:0,x:0,y:0};
 for(const [id,,format] of calibrations){
   $(id).value=id==='scale'?100:0;setText(id+'-value',format(Number($(id).value)));
 }
 render();
});
window.addEventListener('resize',()=>{if(poseState.status==='paused')message('Paused frame may be cropped after resizing. Resume live tracking to recalibrate.');render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||running))stop({reason:'Camera automatically stopped when the page was hidden.'});});
window.addEventListener('pagehide',()=>stop());
updateAnchorHints();
window.__XRAY_EXPERIMENT__=Object.freeze({getState:()=>({status:poseState.status,mode,side,layer,selected,running,anchors:tracker.anchors,anchorReady:tracker.ready,liveTracks:stream?.getTracks().filter(t=>t.readyState==='live').length||0,hasPose:!!lastPose})});