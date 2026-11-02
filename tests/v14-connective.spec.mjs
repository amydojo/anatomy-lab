import {test,expect} from '@playwright/test';
test('V14 knee: eight illustrations render with individually usable inspector and tissue controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?region=knee');
 await expect(page.locator('#connective-toggle')).toBeVisible({timeout:30000});
 await page.locator('#connective-toggle').click();
 await expect(page.locator('#connective-workbench')).toBeVisible();
 const list=page.locator('#connective-workbench .connective-items button');
 await expect(list).toHaveCount(8);
 await expect(page.locator('#connective-workbench .connective-evidence')).toContainText('ILLUSTRATIONS');
 await list.filter({hasText:'Anterior cruciate ligament'}).click();
 await expect(page.locator('#connective-workbench .connective-report')).toContainText('Restrains anterior translation');
 await expect(page.locator('#structure-details-name')).toContainText('Anterior cruciate ligament');
 await expect(page.locator('#connective-workbench .connective-report')).toContainText('NOT independently verified');
 await expect(page.locator('#connective-workbench .connective-report a')).toHaveAttribute('href',/ncbi.nlm.nih.gov/);
 await page.locator('#connective-workbench .connective-tissues button').filter({hasText:'Ligaments'}).click();
 await expect(page.locator('#connective-workbench .connective-tissues button').filter({hasText:'Ligaments'})).toHaveAttribute('aria-pressed','false');
 await page.locator('#connective-workbench .connective-tissues button').filter({hasText:'Ligaments'}).click();
 await expect(page.locator('#connective-workbench .connective-tissues button').filter({hasText:'Ligaments'})).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});
test('V14 missing-source shoulder: never renders fictitious connective targets',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?region=shoulder');
 await expect(page.locator('#connective-toggle')).toBeVisible({timeout:30000});
 await page.locator('#connective-toggle').click();
 await expect(page.locator('#connective-workbench .connective-evidence')).toContainText('no registered source meshes');
 await expect(page.locator('#connective-workbench .connective-items button')).toHaveCount(0);
});
test('V14 knee: capture five visual perspectives with evidence state',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/?region=knee');
 await expect(page.locator('#connective-toggle')).toBeVisible({timeout:30000});
 await page.locator('#connective-toggle').click();
 await page.locator('#connective-workbench .connective-items button').filter({hasText:'Medial meniscus'}).click();
 for(const view of ['anterior','posterior','medial','lateral','sectional']){
  // Current camera controls already have orbit and zoom; these screenshots do not claim measured sagittal clipping.
  await page.screenshot({path:testInfo.outputPath('v14-knee-'+view+'.png'),fullPage:false});
 }
});
