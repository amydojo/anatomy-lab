import {test,expect} from '@playwright/test';

async function lab(page,region,query=''){
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/'+region+'/'+query);
  await expect(page.locator('#v4-root')).toBeVisible();
  await expect(page.locator('#v4-scene svg')).toBeVisible();
  await expect(page.locator('[data-action="panel"]')).toHaveCount(1);
  await expect(page.locator('#v4-depth-input')).toBeVisible();
  await expect(page.locator('.v3-dock')).toHaveCount(0);
  return errors;
}
function setRange(locator,value){
  return locator.evaluate((node,next)=>{node.value=String(next);node.dispatchEvent(new Event('input',{bubbles:true}));},value);
}

test('Atlas remains searchable and the body orientation works',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#bodyfigure')).toBeVisible();
  await page.locator('#posterior').click();
  await expect(page.locator('#posterior')).toHaveAttribute('aria-pressed','true');
  await page.locator('#search-open').click();
  await page.locator('#home-query').fill('sciatic');
  await expect(page.locator('#home-results a').first()).toHaveAttribute('href',/hip/);
  await page.screenshot({path:'artifacts/v4-atlas.png',fullPage:true});
});
for(const region of ['hip','knee','shoulder']){
  test(region+' scene first: peel, select, move, zoom and reset',async({page})=>{
    const errors=await lab(page,region);
    await setRange(page.locator('#v4-depth-input'),2);
    await expect(page.locator('#v4-depth-name')).not.toHaveText('');
    await page.locator('#v4-controls [data-action="control-move"]').click();
    await expect(page.locator('#v4-angle-input')).toBeVisible();
    await setRange(page.locator('#v4-angle-input'),Math.round(region==='hip'?20:75));
    await expect(page.locator('#v4-angle-label')).not.toHaveText('0°');
    await page.locator('[data-action="zoom-in"]').click();
    await expect(page.locator('#v4-scene svg')).toHaveAttribute('style',/scale/);
    await page.locator('.v4-header [data-action="reset"]').click();
    await expect(page.locator('#v4-angle-input')).toHaveCount(0);
    await expect(page.locator('#v4-depth-input')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({path:'artifacts/v4-'+region+'-main.png'});
  });
  test(region+' contextual learning and persisted progress',async({page})=>{
    const errors=await lab(page,region,'?mode=learn');
    await expect(page.locator('#v4-inspector-body')).toContainText('experiments');
    const key=region==='hip'?'h-hidden':region==='knee'?'k-patella':'s-mobility';
    await page.locator('[data-lesson="'+key+'"]').first().click();
    await expect(page.locator('.v4-choices')).toBeVisible();
    await page.locator('[data-predict="1"]').click();
    await expect(page.locator('#v4-inspector-body')).toContainText('Now test');
    if(region==='hip')await setRange(page.locator('#v4-depth-input'),2);
    else{
      await page.locator('#v4-inspector-body [data-action="control-move"]').click();
      await setRange(page.locator('#v4-angle-input'),region==='knee'?85:115);
    }
    await expect(page.locator('#v4-inspector-body')).toContainText('Discovered');
    await page.reload();
    await expect(page.locator('#v4-root')).toBeVisible();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bodylive-v4-progress')||'{}'));
    expect(saved[key]).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('Contextual nerve tracing works without permanent mode switching',async({page})=>{
  const errors=await lab(page,'knee','?focus=fibularNerve');
  if((await page.viewportSize()).width<=800){
    await page.locator('[data-action="panel"]').click();
    await expect(page.locator('#v4-inspector')).toHaveAttribute('data-panel','expanded');
  }
  await page.locator('#v4-inspector-body [data-action="trace"]').click();
  await expect(page.locator('#v4-inspector-body')).toContainText('FOLLOW THE SIGNAL');
  await expect(page.locator('#v4-inspector-body')).toContainText('Common fibular nerve');
  expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/v4-nerve.png'});
});
test('Structure search supports cross-region and keyboard dismiss',async({page})=>{
  await lab(page,'hip');
  await page.locator('[data-action="search"]').first().click();
  await page.locator('#v4-search').fill('labrum');
  await expect(page.locator('#v4-search-results [data-result="shoulder:labrum"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#v4-modal')).not.toHaveClass(/open/);
});
for(const width of [320,375,390,430]){
  test('Mobile '+width+'px: no horizontal overflow and inspector stays controllable',async({page})=>{
    await page.setViewportSize({width,height:760});
    await lab(page,'shoulder');
    const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,stage:document.querySelector('.v4-stage')?.getBoundingClientRect().height,controls:document.querySelector('.v4-control-band')?.getBoundingClientRect().height}));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+2);
    expect(metrics.stage).toBeGreaterThan(130);
    await page.locator('[data-action="panel"]').click();
    await expect(page.locator('#v4-inspector')).toHaveAttribute('data-panel','expanded');
    await page.locator('#v4-controls [data-action="control-move"]').click();
    await expect(page.locator('#v4-angle-input')).toBeVisible();
    await page.screenshot({path:'artifacts/v4-mobile-'+width+'.png'});
  });
}
test('Short phone screen preserves movement control and collapsible sheet',async({page})=>{
  await page.setViewportSize({width:390,height:650});
  await lab(page,'knee','?mode=learn');
  await page.locator('[data-lesson="k-patella"]').first().click();
  await page.locator('[data-predict="1"]').click();
  await page.locator('#v4-inspector-body [data-action="control-move"]').click();
  await expect(page.locator('#v4-angle-input')).toBeVisible();
  await setRange(page.locator('#v4-angle-input'),85);
  await expect(page.locator('#v4-inspector-body')).toContainText('Discovered');
  await page.screenshot({path:'artifacts/v4-short-phone.png'});
});
test('Desktop has usable side inspector and anatomically linked controls',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await lab(page,'hip','?focus=pir');
  const inspector=page.locator('#v4-inspector');
  await expect(inspector).toBeVisible();
  await expect(page.locator('#v4-inspector-body')).toContainText('Piriformis');
  await page.screenshot({path:'artifacts/v4-desktop.png'});
});
