import {test,expect} from '@playwright/test';

const load=async(page,path='/atlas/')=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(path);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().assetsLoaded===true),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().renderer.webgl),{timeout:30000}).toBe(true);
 return errors;
};
const region=page=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.region);
const enter=async(page,name)=>{
 await page.evaluate(name=>window.__BODY_ATLAS__.choose(name),name);
 await expect.poll(()=>region(page),{timeout:30000}).toBe(name);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
};

test('V12 D1: resize repeatedly while WebGL source geometry remains alive',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 const errors=await load(page);
 for(const [width,height] of [[390,844],[375,667],[800,600],[1920,1080],[390,844],[1280,800]]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.webgl)).toBe(true);
  const state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
  expect(state.viewport.width).toBeGreaterThan(200);
  expect(state.renderer.partCount).toBe(78);
 }
 expect(errors.filter(message=>/getUniformLocation|WebGLProgram|uncaught/i.test(message))).toEqual([]);
});

test('V12 D4/S1/S6: Back, Forward and return to whole-body synchronize canvas and label',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const errors=await load(page);
 await enter(page,'knee');
 await expect(page).toHaveURL(/region=knee/);
 await enter(page,'hip');
 await expect(page).toHaveURL(/region=hip/);
 await page.evaluate(()=>history.back());
 await expect.poll(()=>region(page),{timeout:30000}).toBe('knee');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
 await expect(page.locator('#studio-current-label')).toHaveText('RIGHT KNEE');
 await page.evaluate(()=>history.forward());
 await expect.poll(()=>region(page),{timeout:30000}).toBe('hip');
 await page.locator('#studio-body').click();
 await expect(page.locator('#studio-current-label')).toHaveText('WHOLE BODY');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.webgl)).toBe(true);
 expect(errors).toEqual([]);
});

test('V12 D3: bounds-aware wheel zoom and focal pan stay finite and recenter remains usable',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 const errors=await load(page);
 await enter(page,'knee');
 const bounds=page.locator('#atlas-canvas');
 const rect=await bounds.boundingBox();
 const x=rect.x+rect.width*.72,y=rect.y+rect.height*.59;
 await page.mouse.move(x,y);
 if(test.info().project.name.includes('webkit-mobile'))test.skip(true,'Mouse wheel is not a supported mobile WebKit gesture; covered by separate touch tests');
 for(let i=0;i<16;i++)await page.mouse.wheel(0,-400);
 let state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.camera.zoom).toBeLessThanOrEqual(2.35);
 expect(Object.values(state.camera.target).every(Number.isFinite)).toBe(true);
 for(let i=0;i<16;i++)await page.mouse.wheel(0,400);
 await page.locator('#studio-recenter').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().camera.zoom)).toBeGreaterThan(.6);
 state=await page.evaluate(()=>window.__BODY_ATLAS__.getState());
 expect(state.renderer.webgl).toBe(true);
 expect(errors).toEqual([]);
});

test('V12 D10: reloading source-backed layer and structure deep link restores inspector',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const errors=await load(page,'/atlas/?region=knee&layer=3&tool=peel&structure=patella');
 await expect.poll(()=>region(page),{timeout:30000}).toBe('knee');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().unified.selected),{timeout:30000}).toBe('patella');
 expect(await page.evaluate(()=>window.__BODY_ATLAS__.getState().layer)).toBe(3);
 await expect(page.locator('#structure-details-name')).toContainText('patella',{ignoreCase:true});
 expect(errors).toEqual([]);
});

test('V12 D5/D11: short-screen picker exposes all ten anatomical destinations',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 const errors=await load(page);
 await page.locator('#mobile-region').click();
 await expect(page.locator('[data-mobile-region]')).toHaveCount(10);
 await page.locator('[data-mobile-region="ankle"]').scrollIntoViewIfNeeded();
 await expect(page.locator('[data-mobile-region="ankle"]')).toBeInViewport();
 await page.locator('[data-mobile-region="ankle"]').click();
 await expect.poll(()=>region(page),{timeout:30000}).toBe('ankle');
 await expect(page.locator('#mobile-region-name')).toContainText('ANKLE');
 expect(errors).toEqual([]);
});

test('V12 D2: separately registered sciatic reference arrives with visible follow state',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await load(page,'/atlas/?region=nerve');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().view),{timeout:30000}).toBe('detail');
 const iframe=page.frameLocator('#region-frame');
 await expect.poll(()=>iframe.locator('#follow-stage').evaluate(el=>!el.hidden),{timeout:35000}).toBe(true);
 const source=await iframe.locator('#follow-stage').evaluate(()=>window.__HIP_SPATIAL__?.getState());
 expect(source.nerveSourceLoaded).toBe(true);
 expect(source.followActive).toBe(true);
 expect(source.followProgress).toBeGreaterThan(.15);
 expect(source.zoom).toBeLessThan(1.3);
 expect(errors).toEqual([]);
});

test('V12 S2: knee muscle layer is an actual visible rendering mode',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 const errors=await load(page);
 await enter(page,'knee');
 const before=await page.locator('#atlas-canvas').screenshot();
 await page.locator('[data-studio-tool="layers"]').click();
 await expect(page.locator('[data-studio-layer-mode="trace"]')).toBeEnabled();
 await page.locator('[data-studio-layer-mode="trace"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().mode)).toBe('trace');
 const after=await page.locator('#atlas-canvas').screenshot();
 expect(before.equals(after)).toBe(false);
 expect(errors).toEqual([]);
});

test('V12 D8: legacy ribs URL resolves to thorax and invalid routes communicate fallback',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const errors=await load(page,'/atlas/?region=ribs');
 await expect.poll(()=>region(page),{timeout:30000}).toBe('thorax');
 await expect(page).toHaveURL(/region=thorax/);
 await page.goto('/atlas/?region=not-a-region');
 await expect(page.locator('#context-note')).toContainText('Unknown region');
 expect(errors).toEqual([]);
});
