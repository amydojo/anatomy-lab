import {test,expect} from '@playwright/test';

const movements={
 skull:{primary:15},
 neck:{primary:17,secondary:14},
 thorax:{primary:7},
 elbow:{primary:80,secondary:32},
 wrist:{primary:35,secondary:-12},
 ankle:{primary:20,secondary:10},
 hip:{primary:30,secondary:14},
 knee:{primary:45,secondary:8},
 shoulder:{primary:35,secondary:18}
};
async function enter(page,region){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false),{timeout:35000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().overviewLoaded===true),{timeout:35000}).toBe(true);
 await page.evaluate(x=>window.__BODY_ATLAS__.choose(x),region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:35000}).toBe('detail');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region)).toBe(region);
 return errors;
}
for(const [region,scenario] of Object.entries(movements)){
 test('V8.2 '+region+' has bounded motion, a distinct edited pose and deterministic neutral reset',async({page})=>{
  const errors=await enter(page,region);
  if((await page.viewportSize()).width<=850){
   await page.locator('[data-mobile-tool="move"]').click();
   await expect(page.locator('#mobile-motion-slider')).toBeVisible();
  }else{
   await page.locator('[data-studio-tool="move"]').click();
   await expect(page.locator('#studio-motion')).toBeVisible();
  }
  await expect(page.locator('#joint-motion-slider')).toBeEnabled();
  // Canvas locator screenshots include overlaid UI pixels. Hide studio chrome
  // for this GPU-only pose equality check; UI is verified separately in V8.4.
  if((await page.viewportSize()).width>850)
   await page.locator('#desktop-studio').evaluate(el=>{el.style.visibility='hidden';});
  // Read an explicitly rendered zero-pose frame on the same WebGL context.
  // A screenshot from the first compositing frame is not a stable baseline.
  await page.locator('#joint-motion-slider').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const neutral=await page.locator('#atlas-canvas').screenshot();
  await page.locator('#joint-motion-slider').evaluate((el,v)=>{
   el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
  },scenario.primary);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(scenario.primary);
  await expect(page.locator('#joint-motion-value')).toHaveText(scenario.primary+'°');
  const moved=await page.locator('#atlas-canvas').screenshot();
  expect(moved.equals(neutral)).toBe(false);
  if(Number.isFinite(scenario.secondary)){
   if((await page.viewportSize()).width<=850)await expect(page.locator('#mobile-secondary-row')).toBeVisible();
   else await expect(page.locator('#studio-secondary-wrap')).toBeVisible();
   await page.locator('#joint-secondary-slider').evaluate((el,v)=>{
    el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
   },scenario.secondary);
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(scenario.secondary);
   const combined=await page.locator('#atlas-canvas').screenshot();
   expect(combined.equals(moved)).toBe(false);
  }else await expect(page.locator('#joint-secondary-control')).toBeHidden();
  await page.locator('#joint-rest').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
  await expect(page.locator('#joint-motion-value')).toHaveText('0°');
  await expect(page.locator('#joint-secondary-value')).toHaveText('0°');
  // A second explicit zero-pose render verifies GPU pose restoration,
  // independent of browser compositing and unrelated inspector overlays.
  await page.locator('#joint-motion-slider').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const reset=await page.locator('#atlas-canvas').screenshot();
  expect(reset.equals(neutral)).toBe(true);
  await page.evaluate(()=>window.__BODY_ATLAS__.body());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view)).toBe('overview');
  expect(errors).toEqual([]);
 });
}
test('Sciatic nerve remains reference-static; user cannot animate an unverified path',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded||false),{timeout:35000}).toBe(true);
 const scope=await page.evaluate(()=>window.BodyRegionMotion.profile('nerve'));
 expect(scope).toBe(null);
 const motion=await page.evaluate(()=>window.BodyRegionMotion.safe('nerve',123,41));
 expect(motion).toEqual({primary:0,secondary:0});
 expect(errors).toEqual([]);
});
test('Mobile region motion retains a single 3D viewport and zeroes the secondary axis on transfer',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await enter(page,'elbow');
 await page.locator('#joint-secondary-slider').evaluate(el=>{el.value='32';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(32);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('ankle'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('ankle');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:25000}).toBe('detail');
 const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.unified.secondary).toBe(0);
 expect(state.unified.motion).toBe(0);
 expect(state.renderer.webgl).toBe(true);
 expect(await page.locator('#atlas-canvas').count()).toBe(1);
 const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+2);
 expect(errors).toEqual([]);
});
