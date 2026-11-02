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
   Object.defineProperty(HTMLVideoElement.prototype,key,{configurable:true,get:()=>value});
  Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get:()=>4});
  Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get:()=>performance.now()/1000});
  HTMLMediaElement.prototype.play=async function(){};
  HTMLMediaElement.prototype.pause=function(){};
  CanvasRenderingContext2D.prototype.drawImage=function(){};
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
 await page.goto('/experiments/xray/');await page.locator('#launch').click();
 await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 await expect(page.locator('[data-id="biceps"]')).toBeVisible();
 await page.evaluate(()=>{globalThis.__testPose[16]={x:.52,y:.83,visibility:.96,presence:1};});
 await expect.poll(async()=>Number((await page.locator('#angle').textContent()).replace('°',''))).toBeLessThan(25);
 await page.locator('[data-id="biceps"]').click();
 await expect(page.locator('#structure-name')).toHaveText('Biceps brachii');
 await page.locator('[data-layer="bone"]').click();
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
 await page.locator('#launch').click();
 await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 await page.locator('#pause').click();await expect(page.locator('#status')).toHaveText('FRAME PAUSED');
 expect(await page.evaluate(()=>globalThis.__tracks[0].readyState)).toBe('ended');
 await page.locator('#resume').click();await expect(page.locator('#status')).toHaveText('TRACKING ARM',{timeout:12000});
 expect(await page.evaluate(()=>globalThis.__tracks.length)).toBe(2);
});
test('permission denial has visible retry affordance',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
 await page.goto('/experiments/xray/');await page.locator('#launch').click();
 await expect(page.locator('#message')).toContainText('Camera permission denied');
 await expect(page.locator('#launch')).toBeEnabled();
});