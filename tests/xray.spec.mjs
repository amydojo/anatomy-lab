import {test,expect} from '@playwright/test';
// Synthetic video/landmarks only: these tests are NOT physical iPhone verification.
const moduleStub="export const FilesetResolver={forVisionTasks:async()=>({})};export const PoseLandmarker={createFromOptions:async()=>({detectForVideo:()=>({landmarks:globalThis.__testPose?[globalThis.__testPose]:[]}),close(){}})};";
async function mockCamera(page){
 await page.route('**/vision_bundle.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:moduleStub}));
 await page.addInitScript(()=>{
  globalThis.__testPose=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
  [[12,.52,.23],[14,.52,.51],[16,.73,.51]].forEach(([i,x,y])=>{globalThis.__testPose[i]={x,y,visibility:.96,presence:1};});
  globalThis.__tracks=[];
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,get(){return this.__mockSource||null;},set(value){this.__mockSource=value;}});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
   const track={readyState:'live',stop(){this.readyState='ended';},addEventListener(){}};
   globalThis.__tracks.push(track);
   return {getTracks:()=>[track],getVideoTracks:()=>[track]};
  }}});
  for(const [key,value] of [['videoWidth',640],['videoHeight',480]])
   Object.defineProperty(HTMLVideoElement.prototype,key,{configurable:true,get(){return this.srcObject?value:0;}});
  Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get:()=>4});
  Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get:()=>performance.now()/1000});
  HTMLMediaElement.prototype.play=async function(){};
  HTMLMediaElement.prototype.pause=function(){};
  CanvasRenderingContext2D.prototype.drawImage=function(){};
  // Deterministic camera texture, so the real close-up matcher is exercised
  // without uploading personal footage or relying on hardware in CI.
  CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h){
   const data=new Uint8ClampedArray(w*h*4);
   for(let row=0;row<h;row++)for(let col=0;col<w;col++){
    const hash=Math.sin(col*12.9898+row*78.233)*43758.5453;
    const v=Math.round((hash-Math.floor(hash))*255),i=(row*w+col)*4;
    data[i]=v;data[i+1]=v;data[i+2]=v;data[i+3]=255;
   }
   return {data,width:w,height:h};
  };
 });
}
test('standalone route discloses model approximation',async({page})=>{
 await page.goto('/experiments/xray/');
 await expect(page.locator('#launch')).toBeVisible();
 await expect(page.locator('.disclaimer')).toContainText('NOT A MEDICAL SCAN');
 await expect(page.locator('[data-layer]')).toHaveCount(3);
});
test('mock landmarks drive overlay, selection, tracking loss and camera release',async({page})=>{
 await mockCamera(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/experiments/xray/');await page.locator('#launch').click();await page.locator('#open-settings').click();await page.locator('[data-mode="auto"]').click();
 await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 await expect(page.locator('[data-id="biceps"]')).toBeVisible();
 await page.evaluate(()=>{globalThis.__testPose[16]={x:.52,y:.83,visibility:.96,presence:1};});
 await expect.poll(async()=>Number((await page.locator('#angle').textContent()).replace('°',''))).toBeLessThan(25);
 await page.locator('[data-id="biceps"]').click();
 await expect(page.locator('#structure-name')).toHaveText('Biceps brachii');
 await page.locator('#open-settings').click();
 await page.locator('[data-layer="bone"]').click();
 await page.locator('#close-settings').click();
 await page.locator('[data-id="humerus"]').click();
 await expect(page.locator('#atlas-link')).toHaveAttribute('href',/right-humerus/);
 await page.evaluate(()=>{globalThis.__testPose[14].visibility=.1;});
 await expect(page.locator('#status')).toHaveText('TRACKING LOST');
 await expect(page.locator('[data-id]')).toHaveCount(0);
 await page.locator('#stop').click();
 expect(await page.evaluate(()=>globalThis.__tracks.at(-1).readyState)).toBe('ended');
 expect(errors).toEqual([]);
});
test('pause releases mock camera and resumes with a new stream',async({page})=>{
 await mockCamera(page);await page.goto('/experiments/xray/');
 await page.locator('#launch').click();await page.locator('#open-settings').click();await page.locator('[data-mode="auto"]').click();
 await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 const beforePause=await page.evaluate(()=>globalThis.__tracks.length);
 await page.locator('#pause').click();await expect(page.locator('#status')).toHaveText('FRAME PAUSED');
 expect(await page.evaluate(i=>globalThis.__tracks[i].readyState,beforePause-1)).toBe('ended');
 await expect(page.locator('[data-id="biceps"]')).toBeVisible();
 await page.locator('#open-settings').click();
 await page.locator('.calibration summary').click();
 await page.locator('#scale').fill('120');
 await page.locator('#close-settings').click();
 await expect(page.locator('[data-id="biceps"]')).toBeVisible();
 await page.locator('[data-id="biceps"]').click();
 await expect(page.locator('#structure-name')).toHaveText('Biceps brachii');
 await page.locator('#resume').click();await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 expect(await page.evaluate(()=>globalThis.__tracks.length)).toBe(beforePause+1);
 expect(await page.evaluate(()=>globalThis.__tracks.at(-1).readyState)).toBe('live');
});
test('permission denial has visible retry affordance',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
 await page.goto('/experiments/xray/');await page.locator('#launch').click();
 await expect(page.locator('#message')).toContainText('Camera permission denied');
 await expect(page.locator('#launch')).toBeEnabled();
});
test('close-up two-tap calibration tracks illustrative forearm, without false elbow angles',async({page})=>{
 await mockCamera(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/experiments/xray/');
 await expect(page.locator('[data-mode="closeup"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#launch').click();
 await expect(page.locator('#status')).toHaveText('FREEZE TO CALIBRATE');
 await page.locator('#pause').click();
 await expect(page.locator('#status')).toHaveText('FRAME PAUSED');
 expect(await page.evaluate(()=>globalThis.__tracks.at(-1).readyState)).toBe('ended');
 const vp=page.locator('#viewport'),rect=await vp.boundingBox();
 await vp.click({position:{x:rect.width*.27,y:rect.height*.41}});
 await expect(page.locator('#status')).toHaveText('TAP WRIST');
 await vp.click({position:{x:rect.width*.72,y:rect.height*.61}});
 await expect(page.locator('#status')).toHaveText('FRAME CALIBRATED');
 await expect(page.locator('[data-id="flexors"]')).toBeVisible();
 await expect(page.locator('[data-id="biceps"]')).toHaveCount(0);
 await expect(page.locator('#angle')).toHaveText('N/A');
 await expect.poll(async()=>page.evaluate(()=>window.__XRAY_EXPERIMENT__.getState().anchorReady)).toBe(true);
 await page.locator('#resume').click();
 await expect(page.locator('#status')).toHaveText('ANCHORS TRACKING',{timeout:12000});
 await expect(page.locator('[data-id="flexors"]')).toBeVisible();
 await page.locator('#pause').click();
 await expect(page.locator('#status')).toHaveText('FRAME PAUSED');
 await expect(page.locator('#anchor-reset')).toBeDisabled();
 await expect(page.locator('[data-id]')).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(()=>window.__XRAY_EXPERIMENT__.getState().anchorReady)).toBe(false);
 expect(await page.evaluate(()=>globalThis.__tracks.at(-1).readyState)).toBe('ended');
 expect(errors).toEqual([]);
});
test('close-up camera engine starts without external pose-model download',async({page})=>{
 await mockCamera(page);let loadedModel=false;
 page.on('request',r=>{if(r.url().includes('vision_bundle.mjs'))loadedModel=true;});
 await page.goto('/experiments/xray/');await page.locator('#launch').click();
 await expect(page.locator('#status')).toHaveText('FREEZE TO CALIBRATE');
 expect(loadedModel).toBe(false);
 await page.locator('#stop').click();
 expect(await page.evaluate(()=>window.__XRAY_EXPERIMENT__.getState().liveTracks)).toBe(0);
});

test('P0 mobile live viewport is nearly full height, controls never replace camera',async({page})=>{
 await mockCamera(page);
 await page.goto('/experiments/xray/');
 await page.locator('#launch').click();
 await expect(page.locator('#app')).toHaveAttribute('data-phase','live');
 await expect(page.locator('#settings-sheet')).toBeHidden();
 const l=await page.evaluate(()=>{
  const get=id=>document.getElementById(id).getBoundingClientRect();
  const camera=get('viewport'),dock=get('camera-dock'),status=get('status'),screen={w:window.innerWidth,h:window.innerHeight};
  const center=document.elementFromPoint(screen.w/2,screen.h*.48);
  return {cameraH:camera.height,screenH:screen.h,dockH:dock.height,
    dockBottom:Math.abs(dock.bottom-camera.bottom),statusTop:status.top,
    middleElement:center?.id||center?.tagName,phase:document.getElementById('app').dataset.phase};
 });
 expect(l.cameraH/l.screenH).toBeGreaterThan(.95);
 expect(l.dockH/l.screenH).toBeLessThan(.25);
 expect(l.dockBottom).toBeLessThan(1);
 expect(l.middleElement).not.toBe('console');
 await page.locator('#open-settings').click();
 await expect(page.locator('#settings-sheet')).toBeVisible();
 await expect(page.locator('#app')).toHaveAttribute('data-phase','live');
 await page.locator('#close-settings').click();
 await expect(page.locator('#settings-sheet')).toBeHidden();
});
test('P0 frozen frame allows calibration without a live stream and sheet remains dismissible',async({page})=>{
 await mockCamera(page);const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('/experiments/xray/');await page.locator('#launch').click();
 await page.locator('#pause').click();
 await expect(page.locator('#app')).toHaveAttribute('data-phase','paused');
 expect(await page.evaluate(()=>window.__XRAY_EXPERIMENT__.getState().liveTracks)).toBe(0);
 const vp=page.locator('#viewport'),rect=await vp.boundingBox();
 const centerHit=await page.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight*.5)?.id||'');
 expect(centerHit).not.toBe('camera-dock');
 await vp.click({position:{x:rect.width*.2,y:rect.height*.4}});
 await expect(page.locator('.calibration-point')).toHaveCount(1);
 await vp.click({position:{x:rect.width*.75,y:rect.height*.59}});
 await expect(page.locator('.calibration-point')).toHaveCount(2);
 await page.locator('#open-settings').click();
 await expect(page.locator('#settings-sheet')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#settings-sheet')).toBeHidden();
 expect(errors).toEqual([]);
});
