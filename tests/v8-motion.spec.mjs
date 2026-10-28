import {test,expect} from '@playwright/test';
const regions=['skull','neck','thorax','elbow','wrist','ankle','hip','knee','shoulder'];
async function enter(page,region){
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded===true),{timeout:30000}).toBe(true);
 await page.evaluate(region=>window.__BODY_ATLAS__.choose(region),region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region),{timeout:30000}).toBe(region);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
 return errors;
}
for(const region of regions){
 test('V8.2 '+region+' motion variants render sourced transforms, reset and keep one canvas',async({page})=>{
  const errors=await enter(page,region);
  await expect(page.locator('#joint-motion')).toBeVisible();
  const choices=page.locator('#joint-motion-kind option');
  await expect(choices).toHaveCount(region==='hip'||region==='shoulder'?3:2);
  for(const choice of await choices.evaluateAll(nodes=>nodes.map(n=>n.value))){
   await page.locator('#joint-motion-kind').selectOption(choice);
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motionMode)).toBe(choice);
   const rest=await page.locator('#atlas-canvas').screenshot();
   const slider=page.locator('#joint-motion-slider');
   const max=Number(await slider.getAttribute('max'));
   const bend=Math.min(max,region==='thorax'?75:40);
   await slider.evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},bend);
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(bend);
   const moved=await page.locator('#atlas-canvas').screenshot();
   expect(moved.equals(rest),region+'/'+choice+' did not change anatomy').toBe(false);
   await page.locator('#reset-view').click();
   await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(0);
   await expect(page.locator('#joint-motion-value')).toHaveText('0'+(region==='thorax'&&choice==='breath-in'?'%':region==='skull'&&choice==='jaw-glide'?'mm':'°'));
  }
  const stat=await page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer);
  expect(stat.webgl).toBe(true);
  expect(await page.locator('#atlas-canvas').count()).toBe(1);
  await page.locator('#back-body').click();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:8000}).toBe('overview');
  expect(errors).toEqual([]);
 });
}
test('V8.2 sciatic tracing remains sourced; no fictitious joint animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded===true),{timeout:25000}).toBe(true);
 const modes=await page.evaluate(()=>window.BodyRegionalMotion.config('nerve'));
 expect(modes).toEqual([]);
 await expect(page.locator('.region-dock-grid [data-region="nerve"]')).toBeVisible();
});
test('V8.2 mobile motion dropdown changes anatomical action without canvas resize',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const errors=await enter(page,'neck');
 const before=await page.locator('#atlas-canvas').boundingBox();
 await page.locator('#joint-motion-kind').selectOption('neck-rotate');
 await page.locator('#joint-motion-slider').evaluate(el=>{el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.motion)).toBe(24);
 const after=await page.locator('#atlas-canvas').boundingBox();
 expect(after.width).toBeCloseTo(before.width,1);expect(after.height).toBeCloseTo(before.height,1);
 const width=await page.evaluate(()=>[document.documentElement.clientWidth,document.documentElement.scrollWidth]);
 expect(width[1]).toBeLessThanOrEqual(width[0]+2);
 await expect(page.locator('#motion-description')).toContainText('upper-cervical');
 expect(errors).toEqual([]);
});