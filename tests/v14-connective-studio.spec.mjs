import {test,expect} from '@playwright/test';
async function enter(page){
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?studio=connective');
 if(page.viewportSize().width<=850)await expect(page.locator('#connective-peek')).toBeVisible();else await expect(page.locator('#connective-left')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_INTELLIGENCE__?.()?.getStructuresByRegion('knee').length)).toBe(8);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveMeshes)).toBe(8);
 return errors;
}
async function explore(page){if(page.viewportSize().width<=850&&await page.locator('#connective-left').isHidden())await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();}
async function details(page){if(page.viewportSize().width<=850&&await page.locator('#connective-right').isHidden())await page.locator('#connective-mobile-nav [data-cs-panel="inspector"]').click();}
async function exitStudio(page){if(page.viewportSize().width<=850)await page.locator('#connective-mobile-nav [data-cs-action="close"]').click();else await page.locator('#connective-entry').click();}
test('V14: all eight real illustrative knee meshes and source-backed inspector',async({page})=>{
 const errors=await enter(page);await explore(page);
 await expect(page.locator('#connective-left [data-cs-select]')).toHaveCount(8);
 await page.locator('[data-cs-select="anterior-cruciate-ligament"]').click();await details(page);
 await expect(page.locator('#connective-right')).toContainText('Anterior cruciate ligament');
 await expect(page.locator('#connective-right')).toContainText('ILLUSTRATIVE');
 await expect(page.locator('[data-cs-action="focus"]')).toBeEnabled();
 await page.locator('[data-cs-action="details"]').click();
 await expect(page.locator('#connective-right')).toContainText('ATTACHMENTS');
 await expect(page.locator('#connective-right')).toContainText('EVIDENCE SOURCES');
 await expect(page.locator('#connective-right')).toContainText('NOT VERIFIED');
 await page.locator('[data-cs-action="isolate"]').click();
 await page.locator('[data-cs-action="ghost"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().ghost)).toBe(false);
 await page.locator('[data-cs-action="ghost"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().isolateId)).toBe('anterior-cruciate-ligament');
 await page.locator('[data-cs-action="compare"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().comparison.length)).toBe(2);
 // The mobile inspector intentionally hides the structure explorer. Use the
 // visible related-structure control instead of targeting a hidden desktop list.
 await page.locator('#connective-right [data-cs-select="posterior-cruciate-ligament"]').click();await details(page);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe('posterior-cruciate-ligament');
 await expect(page.locator('#connective-right header h2')).toHaveText('Posterior cruciate ligament');
 await expect(page.locator('#connective-right')).toContainText('Primarily restrains posterior translation');
 if(page.viewportSize().width<=850){
   await expect(page.locator('#connective-right')).toBeVisible();
   await page.locator('#connective-mobile-nav [data-cs-panel="structures"]').click();
   await expect(page.locator('#connective-left')).toBeVisible();
   await expect(page.locator('#connective-right')).toBeHidden();
   await page.locator('#connective-left [data-cs-select="anterior-cruciate-ligament"]').click();
   await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().selectedId)).toBe('anterior-cruciate-ligament');
   await expect(page.locator('#connective-peek')).toBeVisible();await expect(page.locator('#connective-right')).toBeHidden();
 }
 expect(errors).toEqual([]);
});
test('V14: independent filters, guided evidence and reset',async({page})=>{
 const errors=await enter(page);await explore(page);
 if(page.viewportSize().width<=850)await page.locator('.cs-advanced summary').click();
 await page.locator('[data-cs-tissue="ligaments"]').click();
 await expect(page.locator('[data-cs-tissue="ligaments"]')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('[data-cs-tissue="fibrocartilage"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#connective-search').fill('meniscus');
 await expect(page.locator('[data-cs-select]')).toHaveCount(2);
 await page.locator('[data-cs-guide="stability"]').click();
 await expect(page.locator(page.viewportSize().width<=850?'.cs-mobile-guides':'#connective-guides')).toContainText('cruciate');
 await page.locator('[data-cs-action="isolate-guide"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().comparison.length)).toBe(4);
 await page.locator('[data-cs-guide="movement"]').click();
 await expect(page.locator(page.viewportSize().width<=850?'.cs-mobile-guides':'#connective-guides')).toContainText('quadriceps');
 await page.locator('[data-cs-guide="load-distribution"]').click();
 await expect(page.locator(page.viewportSize().width<=850?'.cs-mobile-guides':'#connective-guides')).toContainText('menisci');
 await page.locator(page.viewportSize().width>850?'#connective-left [data-cs-action="reset"]':'#connective-mobile-nav [data-cs-action="reset"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().guideId)).toBe(null);
 expect(errors).toEqual([]);
});
test('V14: mobile inspector, gestures and actual canvas',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await enter(page);
 await expect(page.locator('#connective-mobile-nav')).toBeVisible();await explore(page);
 await page.locator('[data-cs-select="medial-meniscus"]').click();
 await expect(page.locator('#connective-peek')).toBeVisible();await expect(page.locator('#connective-right')).toBeHidden();
 await details(page);await expect(page.locator('#connective-right')).toBeVisible();
 await expect(page.locator('#connective-left')).toBeHidden();
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,dock:document.querySelector('.connective-mobile-nav button').getBoundingClientRect().height,canvases:document.querySelectorAll('#atlas-canvas').length}));
 expect(dims.scroll).toBeLessThanOrEqual(dims.viewport+2);
 expect(dims.dock).toBeGreaterThanOrEqual(44);
 expect(dims.canvases).toBe(1);
 await page.locator('[data-cs-panel="structures"]').click();
 await page.screenshot({path:'artifacts/v14-integrated-mobile-'+info.project.name+'.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('V14: desktop layout preserves V13 exit and inspector',async({page},info)=>{
 await page.setViewportSize({width:1440,height:900});
 const errors=await enter(page);
 await page.locator('[data-cs-select="medial-collateral-ligament"]').click();
 const dimensions=await page.evaluate(()=>['connective-left','atlas-stage','connective-right'].map(id=>{
  const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};
 }));
 expect(dimensions[0].right).toBeLessThanOrEqual(dimensions[1].left+1);
 expect(dimensions[1].right).toBeLessThanOrEqual(dimensions[2].left+1);
 expect(dimensions[1].width).toBeGreaterThan(500);
 await page.screenshot({path:'artifacts/v14-integrated-desktop-'+info.project.name+'.png',fullPage:true});
 await page.locator('#connective-entry').click();
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-connective-studio','false');
 await expect(page.locator('#desktop-studio')).toBeVisible();
 await expect(page.locator('#connective-left')).toBeHidden();
 expect(errors).toEqual([]);
});

test('V14 hardening: mobile model viewport remains uncovered and focus preserves overlay',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await enter(page);
 const stage=await page.locator('#atlas-stage').boundingBox();
 const sheet=await page.locator('#connective-peek').boundingBox();
 expect(stage).toBeTruthy();expect(sheet).toBeTruthy();
 expect(stage.y+stage.height).toBeLessThanOrEqual(sheet.y+2);
 expect(stage.height).toBeGreaterThan(230);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 await page.screenshot({path:'artifacts/v14-hardening-unobstructed-'+info.project.name+'.png',fullPage:true});
 await explore(page);await page.locator('#connective-left [data-cs-select="anterior-cruciate-ligament"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 await details(page);await page.locator('#connective-right [data-cs-action="focus"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 await page.screenshot({path:'artifacts/v14-hardening-focused-'+info.project.name+'.png',fullPage:true});
 await exitStudio(page);
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(false);
 await page.locator('#connective-entry').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__.getState().renderer.connectiveEnabled)).toBe(true);
 expect(errors).toEqual([]);
});
