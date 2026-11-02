import {test,expect} from '@playwright/test';
async function enter(page){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 await page.locator('#connective-entry').click();
 await expect(page.locator('#connective-left')).toBeVisible();
 return errors;
}
test('V14: knee explorer discloses missing meshes and progressive inspector',async({page})=>{
 const errors=await enter(page);
 await expect(page.locator('[data-cs-select]')).toHaveCount(8);
 await page.locator('[data-cs-select="acl"]').click();
 await expect(page.locator('#connective-right')).toContainText('Anterior cruciate ligament');
 await expect(page.locator('#connective-right')).toContainText('No registered 3D geometry');
 await expect(page.locator('[data-cs-action="focus"]')).toBeDisabled();
 await page.locator('[data-cs-action="details"]').click();
 await expect(page.locator('#connective-right')).toContainText('ATTACHMENTS & RELATIONSHIPS');
 expect(errors).toEqual([]);
});
test('V14: independent tissue toggles, search and guides',async({page})=>{
 const errors=await enter(page);
 await page.locator('[data-cs-tissue="ligaments"]').click();
 await expect(page.locator('[data-cs-tissue="ligaments"]')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('[data-cs-tissue="fibrocartilage"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#connective-search').fill('meniscus');
 await expect(page.locator('[data-cs-select]')).toHaveCount(2);
 await page.locator('[data-cs-guide="stability"]').click();
 await expect(page.locator('#connective-guides')).toContainText('front–back');
 await page.locator('[data-cs-action="reset"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__BODY_CONNECTIVE_STUDIO__.snapshot().guideId)).toBe(null);
 expect(errors).toEqual([]);
});
test('V14: mobile shell respects safe area and keeps one 3D canvas',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await enter(page);
 await expect(page.locator('#connective-mobile-nav')).toBeVisible();
 await page.locator('[data-cs-select="medial-meniscus"]').click();
 await expect(page.locator('#connective-right')).toBeVisible();
 await expect(page.locator('#connective-left')).toBeHidden();
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,dock:document.querySelector('.connective-mobile-nav button').getBoundingClientRect().height,canvases:document.querySelectorAll('#atlas-canvas').length}));
 expect(dims.scroll).toBeLessThanOrEqual(dims.viewport+2);
 expect(dims.dock).toBeGreaterThanOrEqual(44);
 expect(dims.canvases).toBe(1);
 await page.locator('[data-cs-panel="structures"]').click();
 await page.screenshot({path:'artifacts/v14-mobile-'+testInfo.project.name+'.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('V14: desktop panels frame the real WebGL viewport and exiting restores V13',async({page},testInfo)=>{
 await page.setViewportSize({width:1440,height:900});
 const errors=await enter(page);
 await page.locator('[data-cs-select="mcl"]').click();
 const dims=await page.evaluate(()=>['connective-left','atlas-stage','connective-right'].map(id=>{
  const b=document.getElementById(id).getBoundingClientRect();return {left:b.left,right:b.right,width:b.width};
 }));
 expect(dims[0].right).toBeLessThanOrEqual(dims[1].left+1);
 expect(dims[1].right).toBeLessThanOrEqual(dims[2].left+1);
 expect(dims[1].width).toBeGreaterThan(500);
 await page.screenshot({path:'artifacts/v14-desktop-'+testInfo.project.name+'.png',fullPage:true});
 await page.locator('#connective-entry').click();
 await expect(page.locator('#atlas-sidebar')).toBeVisible();
 expect(errors).toEqual([]);
});
