import {test,expect} from '@playwright/test';
import {PNG} from 'pngjs';
// Element screenshots include HTML controls over the full-width canvas. Capture
// the actual specimen buffer instead, and verify the redraw changes no pose.
async function specimenImage(page){
 const capture=await page.evaluate(()=>{
  const api=window.__BODY_ATLAS__;
  const pose=()=>{const s=api.getState();return {camera:s.camera,region:s.unified.region,motion:s.unified.motion,secondary:s.unified.secondary,layer:s.layer};};
  const before=pose();
  // WebGL has preserveDrawingBuffer=false; draw and read in the same JS task.
  window.dispatchEvent(new Event('resize'));
  return {before,after:pose(),url:document.querySelector('#atlas-canvas').toDataURL('image/png')};
 });
 expect(capture.after,'Capturing the specimen must not reset or reframe its pose').toEqual(capture.before);
 const png=Buffer.from(capture.url.split(',')[1],'base64');
 const image=PNG.sync.read(png);
 expect(image.data.some((v,i)=>v!==image.data[i%4]),'Specimen capture must contain rendered geometry, not a cleared buffer').toBe(true);
 return {png,image};
}
function samePixels(a,b){return a.width===b.width&&a.height===b.height&&a.data.equals(b.data);}
const REGIONS=[
 ['skull',22,false],['neck',22,true],['thorax',9,false],
 ['hip',65,true],['knee',105,true],['shoulder',110,true],
 ['elbow',130,true],['wrist',65,true],['ankle',30,true]
];
async function open(page,region){
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded===true),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded===true),{timeout:35000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().osteologyLoaded===true&&window.__BODY_ATLAS__?.getState().facialLoaded===true),{timeout:30000}).toBe(true);
 await page.evaluate(r=>window.__BODY_ATLAS__.choose(r),region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
 return errors;
}
for(const [region,max,hasSecondary]of REGIONS){
 test('V8.2 '+region+' primary and secondary teaching motion stays registered and resets',async({page})=>{
  const errors=await open(page,region);
  if((await page.viewportSize()).width<=850){
   await page.locator('[data-mobile-tool="move"]').click();
   await expect(page.locator('#mobile-motion-slider')).toBeVisible();
  }else{
   await page.locator('[data-studio-tool="move"]').click();
   await expect(page.locator('#studio-motion')).toBeVisible();
  }
  await expect(page.locator('#motion-description')).toContainText('UNVALIDATED');
  await expect(page.locator('#joint-motion-slider')).toHaveAttribute('max',String(max));
  const restState=await page.evaluate(()=>({camera:window.__BODY_ATLAS__.getState().camera,ui:window.BodyDesktopStudio?.snapshot()}));
  const rest=await specimenImage(page);
  const primary=Math.min(max,20);
  await page.locator('#joint-motion-slider').evaluate((el,value)=>{
   el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
  },primary);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(primary);
  const moved=await specimenImage(page);
  expect(samePixels(rest.image,moved.image),'Primary motion must change rendered anatomy').toBe(false);
  if(hasSecondary){
   if((await page.viewportSize()).width<=850){
    if(!(await page.locator('#mobile-move').isVisible()))await page.locator('[data-mobile-tool="move"]').click();
    await expect(page.locator('#mobile-secondary-row')).toBeVisible();
   }else await expect(page.locator('#studio-secondary-wrap')).toBeVisible();
   const maxSecondary=Number(await page.locator('#joint-secondary-slider').getAttribute('max'));
   const value=Math.min(15,maxSecondary);
   await page.locator('#joint-secondary-slider').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(value);
   const both=await specimenImage(page);
   expect(samePixels(moved.image,both.image),'Secondary motion must change rendered anatomy').toBe(false);
  }else await expect(page.locator('#joint-secondary-control')).toBeHidden();
  await page.locator('#joint-rest').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
  const mobile=(await page.viewportSize()).width<=850;
  await expect(page.locator(mobile?'#mobile-motion-slider':'#studio-motion-slider')).toHaveValue('0');
  await expect(page.locator(mobile?'#mobile-motion-value':'#studio-motion-degree')).toHaveText('0°');
  if(hasSecondary){
   await expect(page.locator(mobile?'#mobile-secondary-slider':'#studio-secondary-slider')).toHaveValue('0');
   await expect(page.locator(mobile?'#mobile-secondary-value':'#studio-secondary-degree')).toHaveText('0°');
  }
  const restored=await specimenImage(page);
  const same=samePixels(rest.image,restored.image);
  if(!same){
   await test.info().attach('neutral-before',{body:rest.png,contentType:'image/png'});
   await test.info().attach('neutral-after',{body:restored.png,contentType:'image/png'});
   const afterState=await page.evaluate(()=>({camera:window.__BODY_ATLAS__.getState().camera,ui:window.BodyDesktopStudio?.snapshot()}));
   await test.info().attach('neutral-state',{body:JSON.stringify({region,before:restState,after:afterState}),contentType:'application/json'});
  }
  expect(same,'Neutral must reproduce every rendered pixel exactly').toBe(true);
  await page.evaluate(()=>window.__BODY_ATLAS__.body());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:15000}).toBe('overview');
  expect(errors).toEqual([]);
 });
}
test('V8.2 mobile switching resets both axes and never adds a second body viewport',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await open(page,'elbow');
 if((await page.viewportSize()).width<=850){
    if(!(await page.locator('#mobile-move').isVisible()))await page.locator('[data-mobile-tool="move"]').click();
    await expect(page.locator('#mobile-secondary-row')).toBeVisible();
   }else await expect(page.locator('#studio-secondary-wrap')).toBeVisible();
 await page.locator('#joint-secondary-slider').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(25);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('ankle'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('ankle');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 const s=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(s.unified.secondary).toBe(0);expect(s.unified.motion).toBe(0);
 const info=await page.evaluate(()=>({canvas:document.querySelectorAll('#atlas-canvas').length,
  viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  secondary:document.querySelector('#mobile-secondary-slider').getBoundingClientRect().width}));
 expect(info.canvas).toBe(1);expect(info.scroll).toBeLessThanOrEqual(info.viewport+2);
 expect(info.secondary).toBeGreaterThan(45);
 await page.locator('#joint-secondary-slider').evaluate(el=>{el.value='-12';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(-12);
 await page.locator('#reset-view').evaluate(el=>el.click());
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
 expect(errors).toEqual([]);
});
test('V8.2 nerve composite is source-separated; no invented physical joint motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 const profile=await page.evaluate(()=>window.BodyRegionMotion.profile('nerve'));
 expect(profile).toBe(null);
 await expect(page.locator('.region-dock [data-region="nerve"]')).toBeAttached();
});
