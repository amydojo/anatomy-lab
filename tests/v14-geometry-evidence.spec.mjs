import {test,expect} from '@playwright/test';
test('Operator C: ACL evidence reports source blocker, hashes and measured error as unavailable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/atlas/?studio=connective');
 await expect(page.locator('[data-cs-select="anterior-cruciate-ligament"]')).toBeVisible({timeout:30000});
 await page.locator('[data-cs-select="anterior-cruciate-ligament"]').click();
 await expect(page.locator('#connective-right [data-geometry-proof="unverified"]')).toContainText('NOT ACQUIRED',{timeout:15000});
 await expect(page.locator('#connective-right')).toContainText('ILLUSTRATIVE');
 await page.locator('#connective-right [data-cs-action="details"]').click();
 await expect(page.locator('#connective-right')).toContainText('ORIGINAL ASSET AND REGISTRATION');
 await expect(page.locator('#connective-right')).toContainText('Landmark RMS: NOT MEASURED');
 await expect(page.locator('#connective-right')).toContainText('FJ3365');
 await expect(page.locator('#connective-right')).toContainText('FJ3387');
 await expect(page.locator('#connective-right')).toContainText('No verified attachment coordinates or kinematics');
 const data=await page.evaluate(()=>window.__BODY_GEOMETRY_EVIDENCE__?.());
 expect(data.source_reference.license).toBe('CC BY 4.0');
 expect(data.connective_targets).toHaveLength(8);
 expect(data.connective_targets.every(s=>s.geometry_verified===false&&s.original_asset_sha256===null)).toBe(true);
 expect(errors).toEqual([]);
});
test('Operator C: five auditable orbit screenshots preserve illustrative status (not a sectional validation)',async({page},info)=>{
 await page.setViewportSize({width:1440,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?studio=connective');
 await expect(page.locator('[data-cs-select="posterior-cruciate-ligament"]')).toBeVisible({timeout:30000});
 await page.locator('[data-cs-select="posterior-cruciate-ligament"]').click();
 await expect(page.locator('#connective-right [data-geometry-proof="unverified"]')).toContainText('NOT ACQUIRED');
 const canvas=page.locator('#atlas-canvas'),r=await canvas.boundingBox();
 expect(r?.height).toBeGreaterThan(200);
 // These are camera-orbit samples. The scene has no independently reviewed
 // anatomical yaw calibration or sagittal clipping plane; do NOT mislabel images.
 for(let i=0;i<5;i++){
  await page.screenshot({path:info.outputPath('knee-illustrative-orbit-'+i+'.png'),fullPage:false});
  if(i===4)break;
  const x=r.x+r.width*.48,y=r.y+r.height*.52;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+Math.min(r.width*.18,110),y+(i===3?Math.min(r.height*.1,40):0),{steps:10});
  await page.mouse.up();
  await page.waitForTimeout(90);
 }
 await expect(page.locator('#connective-right')).toContainText('ILLUSTRATIVE');
});
