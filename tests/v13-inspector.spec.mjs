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

for(const [region,expected] of [['shoulder','Biceps brachii'],['knee','Biceps femoris']]){
 test(`V13: ${region} biceps short head retains its regional identity`,async({page})=>{
  await page.goto(`/atlas/?region=${region}&layer=3&structure=bicepsShort`);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().unified.selected),{timeout:30000}).toBe('bicepsShort');
  await expect(page.locator('#structure-details-name')).toContainText(expected);
 });
}

 test('V13 desktop inspector expands anatomical facts within its existing panel',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/atlas/?region=knee&layer=3&structure=patella');
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().unified.selected),{timeout:30000}).toBe('patella');
  await expect(page.locator('#studio-inspector')).toBeVisible();
  await expect(page.locator('#studio-anatomy-details')).toBeHidden();
  await page.locator('#studio-anatomy-expand').click();
  await expect(page.locator('#studio-anatomy-details')).toBeVisible();
  await expect(page.locator('#studio-anatomy-context')).toContainText('quadriceps');
  await page.locator('#studio-anatomy-expand').click();
  await expect(page.locator('#studio-anatomy-details')).toBeHidden();
  await page.locator('#studio-inspector-clear').click();
  await expect(page.locator('#studio-anatomy-expand')).toBeHidden();
 });

const verifiedStructures=[
 ['knee','patella',3,'Sesamoid bone','quadriceps','8-4-bones-of-the-lower-limb'],
 ['knee','femur',1,'Bone','thigh','8-4-bones-of-the-lower-limb'],
 ['knee','tibia',2,'Bone','weight-bearing','8-4-bones-of-the-lower-limb'],
 ['shoulder','scapula',3,'Bone','glenoid','8-2-bones-of-the-upper-limb'],
 ['shoulder','humerus',3,'Bone','upper arm','8-2-bones-of-the-upper-limb'],
 ['shoulder','supraspinatus',1,'Skeletal muscle','abduction','11-5-muscles-of-the-pectoral-girdle-and-upper-limbs'],
 ['ankle','medial-head-of-right-gastrocnemius',4,'Skeletal muscle','soleus','11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs']
];
for(const [region,id,layer,type,fact,section] of verifiedStructures){
 test(`Verified anatomy: ${id} selection, facts and source stay aligned`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`/atlas/?region=${region}&layer=${layer}&structure=${id}`);
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState().unified.selected),{timeout:30000}).toBe(id);
  const mobile=(await page.viewportSize()).width<=850;
  const panel=page.locator(mobile?'#mobile-inspect':'#studio-inspector');
  if(!(await panel.isVisible()))await page.locator(mobile?'[data-mobile-tool="inspect"]':'[data-studio-tool="inspect"]').click();
  await expect(panel).toBeVisible();
  await page.locator(mobile?'#mobile-inspect-expand':'#studio-anatomy-expand').click();
  await expect(page.locator(mobile?'#mobile-inspect-type':'#studio-anatomy-type')).toContainText(type);
  await expect(page.locator(mobile?'#mobile-inspect-context':'#studio-anatomy-context')).toContainText(fact);
  await expect(page.locator(mobile?'#mobile-anatomy-source':'#studio-anatomy-source')).toHaveAttribute('href','https://openstax.org/books/anatomy-and-physiology-2e/pages/'+section);
  expect(errors).toEqual([]);
 });
}
