import {test,expect} from '@playwright/test';
async function openLab(page,region){
 await page.goto('/'+region+'/');
 await expect(page.locator('#v3-root')).toBeVisible();
 await expect(page.locator('#v3-viewport svg')).toBeVisible();
 await expect(page.locator('[data-v3-mode]')).toHaveCount(4);
 await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth',0);
}
test('Atlas is navigable, searchable and orientation-aware',async({page})=>{
 await page.goto('/');await expect(page.locator('#bodyfigure')).toBeVisible();
 await page.locator('#posterior').click();await expect(page.locator('#posterior')).toHaveAttribute('aria-pressed','true');
 await page.locator('#search-open').click();await page.locator('#home-query').fill('sciatic');
 await expect(page.locator('#home-results a').first()).toHaveAttribute('href',/hip/);
 await page.locator('#search-close').click();await page.screenshot({path:'artifacts/atlas.png',fullPage:true});
});
for(const region of ['hip','knee','shoulder']){
 test(region+' — explore layers, move and trace',async({page})=>{
  await openLab(page,region);
  await page.locator('[data-v3-mode="explore"]').click();
  await expect(page.locator('[data-v3-layer-range]')).toBeVisible();
  await page.locator('[data-v3-layer-range]').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await expect(page.locator('[data-v3-layer-text]')).not.toHaveText('');
  await page.locator('[data-v3-mode="move"]').click();
  await page.locator('[data-v3-range]').evaluate(el=>{el.value=String(Number(el.max)/2);el.dispatchEvent(new Event('input',{bubbles:true}))});
  await expect(page.locator('[data-v3-angle]')).not.toHaveText('0°');
  await page.locator('[data-v3-mode="trace"]').click();
  await expect(page.locator('#v3-inspector-scroll')).toContainText('nerve');
  await page.locator('[data-v3-action="home"]').click();
  await page.screenshot({path:'artifacts/'+region+'-trace.png'});
 });
 test(region+' — guided experiment requires a real model action',async({page})=>{
  await openLab(page,region);await page.locator('[data-v3-mode="learn"]').click();
  const chosen=region==='knee'?'k-patella':region==='shoulder'?'s-mobility':'h-hidden';
  await page.locator('[data-v3-lesson="'+chosen+'"]').click();
  const correct=region==='knee'?1:region==='shoulder'?1:1;
  await page.locator('[data-v3-choice="'+correct+'"]').click();
  await expect(page.locator('#v3-inspector-scroll')).toContainText('Now test it');
  if(region==='hip'){await page.locator('[data-v3-depth="2"]').first().click();}
  else {
   await page.locator('[data-v3-action="lesson-move"]').click();
   await page.locator('[data-v3-range]').evaluate(el=>{el.value='110';el.dispatchEvent(new Event('input',{bubbles:true}))});
  }
  await expect(page.locator('#v3-inspector-scroll')).toContainText('Revealed');
  await page.reload();await page.locator('[data-v3-mode="learn"]').click();
  await expect(page.locator('#v3-inspector-scroll')).toContainText('1 / 4 complete');
 });
}
test('Mobile controls do not introduce horizontal document overflow',async({page})=>{
 await openLab(page,'knee');
 const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
 expect(result.scroll).toBeLessThanOrEqual(result.width+2);
 await page.locator('.v3-grab').click();await expect(page.locator('#v3-inspector')).toHaveAttribute('data-sheet','expanded');
 await page.screenshot({path:'artifacts/mobile-inspector.png'});
});
