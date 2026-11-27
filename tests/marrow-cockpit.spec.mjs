import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('COCKPIT real MARROW surface: dual touch, recovery, lift and magnetic landing',async({page},info)=>{
 test.setTimeout(180000);
 await page.goto('/play/?mode=marrow&cockpit=1&touch=dual');await page.bringToFront();
 await expect(page.locator('.cockpit')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report());
 await expect.poll(async()=>!!(await read()).camera?.framed,{timeout:30000}).toBe(true);
 const point=async selector=>{await expect(page.locator(selector)).toBeVisible();const b=await page.locator(selector).boundingBox();return {x:b.x+b.width*.5,y:b.y+b.height*.55,w:b.width,h:b.height};};
 const fire=async(selector,type,id,x,y)=>page.locator(selector).dispatchEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true});
 const s=await point('.cockpit-steer'),p=await point('.cockpit-pedal'),before=await read();
 await fire('.cockpit-steer','pointerdown',1,s.x,s.y);await fire('.cockpit-pedal','pointerdown',2,p.x,p.y);
 await fire('.cockpit-steer','pointermove',1,s.x+s.w*.12,s.y-s.h*.22);await fire('.cockpit-pedal','pointermove',2,p.x,p.y-p.h*.36);
 await expect.poll(async()=>{const q=(await read()).cockpit;return q.active===2&&q.intent.push>.8&&q.intent.x>0;}).toBe(true);
 await expect.poll(async()=> (await read()).simulation.rideDistance-before.simulation.rideDistance,{timeout:30000}).toBeGreaterThan(.025);
 const riding=await read();await page.screenshot({path:info.outputPath('cockpit-dual.png')});
 await fire('.cockpit-steer','pointercancel',1,s.x,s.y);await expect.poll(async()=> (await read()).cockpit.active).toBe(1);
 await fire('.cockpit-pedal','pointerup',2,p.x,p.y);await expect.poll(async()=> (await read()).cockpit.intent.push).toBe(0);
 const l=await point('[data-action=lift]');await fire('[data-action=lift]','pointerdown',3,l.x,l.y);
 await expect.poll(async()=>!!(await read()).simulation.glide,{timeout:30000}).toBe(true);const flying=await read();
 const land=await point('[data-action=land]');
 // Atomic release and explicit landing request: do not race auto-descent/render latency.
 await page.evaluate(({l,land})=>{const f=(selector,type,id,xy)=>document.querySelector(selector).dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:xy.x,clientY:xy.y,bubbles:true,cancelable:true}));f('[data-action=lift]','pointerup',3,l);f('[data-action=land]','pointerdown',4,land);},{l,land});
 try{await expect.poll(async()=> (await read()).simulation.landings-flying.simulation.landings,{timeout:45000}).toBeGreaterThan(0);}finally{await fire('[data-action=land]','pointerup',4,land.x,land.y).catch(()=>{});}
 const landed=await read();
 await fire('.cockpit-pedal','pointerdown',5,p.x,p.y);await fire('.cockpit-pedal','pointermove',5,p.x,p.y-p.h*.36);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect.poll(async()=> (await read()).cockpit.active).toBe(0);
 expect((await read()).cockpit.intent.push).toBe(0);
 await fire('.cockpit-pedal','pointerdown',6,p.x,p.y);await page.setViewportSize({width:844,height:390});
 await expect.poll(async()=> (await read()).cockpit.active).toBe(0);
 await page.screenshot({path:info.outputPath('cockpit-landscape.png')});
 writeFileSync(info.outputPath('cockpit-runtime.json'),JSON.stringify({before,riding,flying,landed,final:await read()},null,2));
 expect(landed.simulation.landings).toBeGreaterThan(flying.simulation.landings);
 expect(riding.cockpit.observedTouchPoints).toBe(2);
});
test('COCKPIT one-finger fallback and control layout',async({page},info)=>{
 test.setTimeout(150000);await page.setViewportSize({width:390,height:844});
 await page.goto('/play/?mode=marrow&cockpit=1&touch=single&cockpitVersion=1');await page.bringToFront();await expect(page.locator('.cockpit')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report()),b=await page.locator('.cockpit-steer').boundingBox(),x=b.x+b.width/2,y=b.y+b.height*.55;
 const fire=(type,dy)=>page.locator('.cockpit-steer').dispatchEvent(type,{pointerId:1,pointerType:'touch',button:0,buttons:1,clientX:x,clientY:y+dy,bubbles:true,cancelable:true});
 await fire('pointerdown',0);await fire('pointermove',-b.height*.26);await expect.poll(async()=> (await read()).cockpit.intent.push).toBeGreaterThan(.25);
 await fire('pointercancel',0);await expect.poll(async()=> (await read()).cockpit.intent.push).toBe(0);
 await page.locator('.cockpit-settings summary').click();await page.locator('[data-setting=left]').check();await expect(page.locator('.cockpit')).toHaveAttribute('data-hand','left');
 await page.locator('.cockpit-settings summary').click();await page.screenshot({path:info.outputPath('cockpit-portrait.png')});
 for(const [width,height] of [[1920,1080],[1024,768],[844,390],[390,844]]){await page.setViewportSize({width,height});for(const sel of ['.cockpit-steer','.cockpit-pedal','.cockpit-actions']){const q=await page.locator(sel).boundingBox();expect(q.x).toBeGreaterThanOrEqual(0);expect(q.y).toBeGreaterThanOrEqual(0);expect(q.x+q.width).toBeLessThanOrEqual(width+1);expect(q.y+q.height).toBeLessThanOrEqual(height+1);}}
});
