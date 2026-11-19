import {test,expect} from '@playwright/test';
const dims=[[320,568],[390,844],[430,932],[844,390],[874,402],[932,430]];
const sample=()=>{const a=window.__BODY_ATLAS__,state=a.getState(),v=a.connectiveNavState('medial-meniscus');
 const c=state.camera,b=v.selectedBounds;
 const xy=window.BodySpatialCore.project(b.center,{...c,width:state.viewport.width,height:state.viewport.height});
 return {camera:{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:c.target},
  viewport:state.viewport,projectionScale:v.projectionScale,point:{x:xy.x,y:xy.y},
  selected:window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId};};
for(const [width,height] of dims){
 test('V14.2 stable panel projection '+width+'x'+height,async({page},info)=>{
  test.skip(info.project.name==='desktop-chromium','Mobile layout check');
  test.setTimeout(120000);
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/atlas/?studio=connective');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
  await page.locator('#connective-mobile-nav [data-cs-panel=structures]').click();
  await page.locator('#connective-left [data-cs-select="medial-meniscus"]').click();
  const initial=await page.evaluate(sample);
  await page.locator('#connective-peek [data-cs-action=peek-details]').click();
  const open=await page.evaluate(sample);
  expect(open.camera).toEqual(initial.camera);
  expect(open.projectionScale).toBeCloseTo(initial.projectionScale,4);
  expect(open.point.x).toBeCloseTo(initial.point.x,3);
  expect(open.point.y).toBeCloseTo(initial.point.y,3);
  expect(open.viewport).toEqual(initial.viewport);
  await page.locator('#connective-right [data-cs-action=collapse]').count().then(async n=>{
   if(n)await page.locator('#connective-right [data-cs-action=collapse]').click();
   else await page.locator('#connective-mobile-nav [data-cs-panel=inspector]').click();
  });
  const close=await page.evaluate(sample);
  expect(close.projectionScale).toBeCloseTo(initial.projectionScale,4);
  expect(close.point.x).toBeCloseTo(initial.point.x,3);
  expect(close.selected).toBe('medial-meniscus');
 });
}
test('V14.2 Locate, Dive, Back and Fit are camera-only',async({page},info)=>{
 test.skip(info.project.name==='desktop-chromium','One-thumb mobile flow');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?studio=connective');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
 await page.locator('#connective-mobile-nav [data-cs-panel=structures]').click();
 await page.locator('#connective-left [data-cs-select="medial-meniscus"]').click();
 const selected=await page.evaluate(sample);
 await page.locator('#connective-peek [data-cs-action=locate]').click();
 const locate=await page.evaluate(sample);
 await page.locator('#connective-peek [data-cs-action=focus]').click();
 const dive=await page.evaluate(sample);
 expect(dive.projectionScale).toBeGreaterThan(locate.projectionScale);
 await page.locator('#connective-spatial-hud [data-cs-action=back-view]').click();
 const previous=await page.evaluate(sample);
 expect(previous.camera).toEqual(locate.camera);
 await page.locator('#connective-spatial-hud [data-cs-action=fit-joint]').click();
 const fit=await page.evaluate(sample);
 expect(fit.camera.zoom).toBeGreaterThan(1);
 expect(fit.selected).toBe(selected.selected);
 await page.locator('#connective-peek [data-cs-action=peek-details]').click();
 await page.locator('#connective-right [data-cs-action=isolate]').click();
 const isolated=await page.evaluate(()=>({studio:window.__BODY_CONNECTIVE_STUDIO__.snapshot(),renderer:window.__BODY_ATLAS__.getState().renderer}));
 expect(isolated.studio.mode).toBe('isolate');
 expect(isolated.renderer.connectiveContextLandmarks).toContain('femur');
 expect(isolated.renderer.connectiveContextLandmarks).toContain('tibia');
 await page.locator('#connective-peek [data-cs-action=peek-details]').click();
 await page.locator('#connective-right [data-cs-action=ghost]').click();
 expect(await page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveGhosted)).toBe(false);
 await page.locator('#connective-spatial-hud [data-cs-action=fit-joint]').click();
 expect(await page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe('medial-meniscus');
});
