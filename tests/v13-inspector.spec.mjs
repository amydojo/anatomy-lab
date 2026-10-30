import {test,expect} from '@playwright/test';

test('V13: anatomy annotations expose only explicitly sourced entries',async({page})=>{
 await page.goto('/atlas/');
 await expect.poll(()=>page.evaluate(()=>!!window.BodyAnatomyInfo)).toBe(true);
 const facts=await page.evaluate(()=>({patella:window.BodyAnatomyInfo.lookup('patella'),unknown:window.BodyAnatomyInfo.lookup('unmapped-structure')}));
 expect(facts.patella.type).toBe('Sesamoid bone');
 expect(facts.patella.source).toContain('OpenStax');
 expect(facts.unknown).toBeNull();
});

test('V13: selecting a structure reveals a progressive mobile inspector',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/atlas/?region=knee&layer=3&tool=peel&structure=patella');
 await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().unified.selected),{timeout:30000}).toBe('patella');
 await page.locator('[data-mobile-tool="inspect"]').click();
 await expect(page.locator('#mobile-inspect-name')).toContainText('patella',{ignoreCase:true});
 await expect(page.locator('#mobile-inspect-details')).toBeHidden();
 await page.locator('#mobile-inspect-expand').click();
 await expect(page.locator('#mobile-inspect-details')).toBeVisible();
 await expect(page.locator('#mobile-inspect-context')).toContainText('quadriceps');
 await page.locator('#mobile-inspect-expand').click();
 await expect(page.locator('#mobile-inspect-details')).toBeHidden();
 await page.locator('#mobile-inspect-clear').click();
 await expect(page.locator('#mobile-inspect-expand')).toBeHidden();
});
