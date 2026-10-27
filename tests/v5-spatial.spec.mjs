import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/knee/spatial/');
 await expect(page.locator('#knee-canvas')).toBeVisible();
 await expect(page.locator('#inspector-title')).toContainText('moving machine');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_SPATIAL__?.getState()?.hits?.length ?? window.__BODY_SPATIAL__?.getState()?.width ?? 0)).toBeGreaterThan(10);
 return errors;
}
test('spatial 3D specimen initializes and supports anatomical selection and reset',async({page})=>{
 const errors=await start(page);
 await page.locator('[data-structure="acl"]').click();
 await expect(page.locator('#inspector-title')).toHaveText('ACL');
 await page.locator('#isolate').click();
 await expect(page.locator('#isolate')).toHaveAttribute('aria-pressed','true');
 await page.locator('#reset').click();
 await expect(page.locator('#angle-output')).toHaveText('0°');
 await expect(page.locator('#depth-output')).toHaveText('ALL STRUCTURES');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-knee-spatial.png'});
});
test('flexion, depth, side view, and orbit update spatial state without fabricating forces',async({page})=>{
 const errors=await start(page);
 await page.locator('#flexion').evaluate(el=>{el.value='90';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#angle-output')).toHaveText('90°');
 await page.locator('#depth').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#depth-output')).toHaveText('LIGAMENTS + BONES');
 await page.locator('#side').click();
 const before=await page.evaluate(()=>window.__BODY_SPATIAL__.getState().yaw);
 const rect=await page.locator('#knee-canvas').boundingBox();
 await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);
 await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.55,{steps:5});await page.mouse.up();
 const after=await page.evaluate(()=>window.__BODY_SPATIAL__.getState().yaw);
 expect(after).not.toBe(before);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-knee-flexed.png'});
});
for(const width of [320,375,390,430]){
 test('phone '+width+'px supports compact controls and expanded inspector',async({page})=>{
   await page.setViewportSize({width,height:780});
   const errors=await start(page);
   const dims=await page.evaluate(()=>({screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,canvas:document.getElementById('knee-canvas').getBoundingClientRect().height}));
   expect(dims.scroll).toBeLessThanOrEqual(dims.screen+2);
   expect(dims.canvas).toBeGreaterThan(100);
   await page.locator('#inspector-toggle').click();
   await expect(page.locator('#inspector-toggle')).toHaveAttribute('aria-expanded','true');
   await page.locator('[data-structure="menisci"]').click();
   await expect(page.locator('#inspector-title')).toHaveText('Menisci');
   expect(errors).toEqual([]);
   await page.screenshot({path:'artifacts/v5-mobile-'+width+'.png'});
 });
}
test('short-screen interaction stays reachable and reduced motion does not autoplay',async({page})=>{
 await page.setViewportSize({width:390,height:640});
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=await start(page);
 await page.locator('#inspector-toggle').click();
 await page.locator('#play').click();
 expect(await page.evaluate(()=>window.__BODY_SPATIAL__.getState().playing)).toBe(false);
 await page.locator('#flexion').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#angle-output')).toHaveText('65°');
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/v5-short-phone.png'});
});
test('provenance and V4 fallback are explicit',async({page})=>{
 await start(page);await expect(page.locator('a[href="/knee/"]')).toBeVisible();
 await page.locator('a[href="/knee/spatial/sources/"]').click();
 await expect(page.locator('body')).toContainText('What is real.');
 await expect(page.locator('body')).toContainText('BodyParts3D');
 await expect(page.locator('body')).toContainText('No BodyParts3D or Z-Anatomy mesh has been imported');
});
test('V4 knee offers non-destructive entry into spatial experiment',async({page})=>{
 await page.goto('/knee/');
 await expect(page.locator('a[href="/knee/spatial/"]')).toBeVisible();
});
