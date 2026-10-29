import {test,expect} from '@playwright/test';
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
  }else await expect(page.locator('#joint-motion')).toBeVisible();
  await expect(page.locator('#motion-description')).toContainText('UNVALIDATED');
  await expect(page.locator('#joint-motion-slider')).toHaveAttribute('max',String(max));
  const rest=await page.locator('#atlas-canvas').screenshot();
  const primary=Math.min(max,20);
  await page.locator('#joint-motion-slider').evaluate((el,value)=>{
   el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
  },primary);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(primary);
  const moved=await page.locator('#atlas-canvas').screenshot();
  expect(rest.equals(moved)).toBe(false);
  if(hasSecondary){
   if((await page.viewportSize()).width<=850){
    if(!(await page.locator('#mobile-move').isVisible()))await page.locator('[data-mobile-tool="move"]').click();
    await expect(page.locator('#mobile-secondary-row')).toBeVisible();
   }else await expect(page.locator('#joint-secondary-control')).toBeVisible();
   const maxSecondary=Number(await page.locator('#joint-secondary-slider').getAttribute('max'));
   const value=Math.min(15,maxSecondary);
   await page.locator('#joint-secondary-slider').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(value);
   const both=await page.locator('#atlas-canvas').screenshot();
   expect(moved.equals(both)).toBe(false);
  }else await expect(page.locator('#joint-secondary-control')).toBeHidden();
  await page.locator('#joint-rest').evaluate(el=>el.click());
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(0);
  const restored=await page.locator('#atlas-canvas').screenshot();
  expect(restored.equals(rest)).toBe(true);
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
   }else await expect(page.locator('#joint-secondary-control')).toBeVisible();
 await page.locator('#joint-secondary-slider').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.secondary)).toBe(25);
 await page.evaluate(()=>window.__BODY_ATLAS__.choose('ankle'));
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:25000}).toBe('ankle');
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
