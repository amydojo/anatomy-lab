import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('FLOW TOUCH rendered anatomical ride: cruise carve coast brake flight land',async({browser,browserName},info)=>{
 test.setTimeout(240000);
 const context=await browser.newContext({baseURL:info.project.use.baseURL,hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:1});
 const page=await context.newPage(),cdp=browserName==='chromium'?await context.newCDPSession(page):null;
 try{
  await page.goto('/play/?mode=marrow&cockpit=1&touch=flow&vehicle=vector');await page.bringToFront();
  await expect(page.locator('.cockpit[data-flow=true]')).toBeVisible({timeout:120000});
  const read=()=>page.evaluate(()=>window.__MARROW__.report());
  await expect.poll(async()=>!!(await read()).camera?.framed,{timeout:30000}).toBe(true);
  const point=async sel=>{await expect(page.locator(sel)).toBeVisible();const b=await page.locator(sel).boundingBox();return {x:Math.round(b.x+b.width*.65),y:Math.round(b.y+b.height*.57)};};
  let id=0,owner=null;
  async function send(type,xy,selector){if(type==='down'){id++;owner=selector;}
   if(cdp){const map={down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'};await cdp.send('Input.dispatchTouchEvent',{type:map[type],touchPoints:['up','cancel'].includes(type)?[]:[{x:Math.round(xy.x),y:Math.round(xy.y),id:1}]});}
   else{await page.locator(owner).dispatchEvent('pointer'+type,{pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:['up','cancel'].includes(type)?0:1,clientX:xy.x,clientY:xy.y,bubbles:true,cancelable:true});}
  }
  const s=await point('.cockpit-steer'),start=await read(),evidence={start};
  await send('down',s,'.cockpit-steer');await send('move',{x:s.x,y:s.y-18});
  await expect.poll(async()=> (await read()).cockpit.intent.push,{timeout:15000}).toBeGreaterThan(.4);
  const activated=await read();evidence.activated=activated;
  await expect.poll(async()=> (await read()).simulation.rideDistance-start.simulation.rideDistance,{timeout:30000}).toBeGreaterThan(.015);
  await send('move',{x:s.x+18,y:s.y-18});
  await expect.poll(async()=> (await read()).cockpit.intent.mono?.steer||0).toBeGreaterThan(.05);
  await expect.poll(async()=>Math.abs((await read()).simulation.monoSteering?.actualRate||0),{timeout:15000}).toBeGreaterThan(.005);
  const carve=await read();evidence.carve=carve;expect(carve.cockpit.intent.push).toBe(activated.cockpit.intent.push);
  await page.screenshot({path:info.outputPath('flow-carve-390.png')});
  const coastY=s.y-18+40;await send('move',{x:s.x+18,y:coastY});
  await expect.poll(async()=> (await read()).cockpit.intent.push).toBe(0);evidence.coast=await read();
  await send('move',{x:s.x+18,y:coastY+30});await expect.poll(async()=> (await read()).cockpit.intent.brake).toBeGreaterThan(.2);evidence.brake=await read();
  await send('up',s);await expect.poll(async()=> (await read()).cockpit.active).toBe(0);
  const l=await point('[data-action=lift]');await send('down',l,'[data-action=lift]');
  await expect.poll(async()=>!!(await read()).simulation.glide,{timeout:30000}).toBe(true);
  await expect.poll(async()=> (await read()).simulation.air,{timeout:30000}).toBeGreaterThan(.15);
  const flight=await read();evidence.flight=flight;await page.screenshot({path:info.outputPath('flow-flight.png')});
  const land=await point('[data-action=land]');await send('up',l);
  // If automatic capture finishes between physical-style touches, it is valid; otherwise explicitly request land.
  if((await read()).simulation.glide){if(cdp){await send('down',land,'[data-action=land]');}else await send('down',land,'[data-action=land]');}
  await expect.poll(async()=> (await read()).simulation.landings-flight.simulation.landings,{timeout:45000}).toBeGreaterThan(0);
  if((await read()).cockpit.active)await send('up',land);
  evidence.landed=await read();expect(evidence.landed.simulation.remounts).toBe(start.simulation.remounts);
  await page.locator('.flow-menu summary').click();const paused=await read();await page.waitForTimeout(600);expect((await read()).simulation.steps).toBe(paused.simulation.steps);await page.locator('.flow-menu summary').click();
  if(cdp)expect(evidence.carve.cockpit.delivery.nativeMoves).toBeGreaterThan(0);
  for(const [width,height] of [[390,844],[402,874],[844,390],[874,402]]){await page.setViewportSize({width,height});const box=await page.locator('.cockpit-steer').boundingBox(),action=await page.locator('.cockpit-actions').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y+box.height).toBeLessThanOrEqual(height+1);expect(action.y).toBeGreaterThanOrEqual(0);expect(action.y+action.height).toBeLessThanOrEqual(box.y+1);if(height>width)expect(box.width).toBeGreaterThan(width*.8);await page.screenshot({path:info.outputPath('flow-'+width+'x'+height+'.png')});}
  evidence.final=await read();writeFileSync(info.outputPath('flow-touch-rendered.json'),JSON.stringify(evidence,null,2));
 }finally{await context.close();}
});
