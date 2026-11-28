import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('LEVITATION uninterrupted actual cranial ride and analog recapture',async({browser,browserName},info)=>{
 test.setTimeout(300000);
 const context=await browser.newContext({baseURL:info.project.use.baseURL,hasTouch:true,isMobile:true,viewport:{width:402,height:874},deviceScaleFactor:1}),page=await context.newPage(),cdp=browserName==='chromium'?await context.newCDPSession(page):null;
 const evidence={project:browserName,delivery:cdp?'native injected touch':'synthetic pointer'};
 try{
  await page.goto('/play/?mode=marrow&cockpit=1&touch=levitation&vehicle=vector');await page.bringToFront();await expect(page.locator('.cockpit[data-levitation=true]')).toBeVisible({timeout:120000});
  const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=>!!(await read()).camera?.framed,{timeout:30000}).toBe(true);await expect(page.locator('.cockpit-actions')).toBeHidden();
  const b=await page.locator('.cockpit-steer').boundingBox(),x=Math.round(b.x+b.width*.55),y=Math.round(b.y+b.height*.65);let id=0;
  const send=async(type,dx=0,dy=0)=>{if(type==='down')id++;const px=x+dx,py=y+dy;if(cdp){const map={down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'};await cdp.send('Input.dispatchTouchEvent',{type:map[type],touchPoints:['up','cancel'].includes(type)?[]:[{x:px,y:py,id:1}]});}else await page.locator('.cockpit-steer').dispatchEvent('pointer'+type,{pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:['up','cancel'].includes(type)?0:1,clientX:px,clientY:py,bubbles:true,cancelable:true});};
  evidence.start=await read();
  await send('down');await send('move',0,-18);await expect.poll(async()=> (await read()).cockpit.intent.push).toBeGreaterThan(.4);
  await expect.poll(async()=> (await read()).simulation.rideDistance-evidence.start.simulation.rideDistance,{timeout:30000}).toBeGreaterThan(.015);
  await send('move',18,-18);await expect.poll(async()=> (await read()).cockpit.intent.mono?.steer||0).toBeGreaterThan(.05);
  evidence.cruise=await read();await send('move',18,-65);await expect.poll(async()=> (await read()).cockpit.intent.push).toBeGreaterThan(.98);
  await send('move',18,-105);await page.waitForTimeout(500);evidence.normalOvershoot=await read();expect(evidence.normalOvershoot.simulation.explicitFlights).toBe(evidence.start.simulation.explicitFlights);expect(evidence.normalOvershoot.cockpit.intent.propulsion.lift).toBe(0);
  await send('move',30,-105);await send('move',30,-137);await expect.poll(async()=> (await read()).cockpit.intent.propulsion?.lift||0).toBeGreaterThan(.15);
  await expect.poll(async()=>!!(await read()).simulation.glide,{timeout:30000}).toBe(true);evidence.lowLift=await read();
  await send('move',30,-154);await expect.poll(async()=> (await read()).cockpit.intent.propulsion?.lift||0).toBeGreaterThan(evidence.lowLift.cockpit.intent.propulsion.lift);
  await send('move',12,-154);await expect.poll(async()=> (await read()).simulation.air,{timeout:30000}).toBeGreaterThan(.15);evidence.flight=await read();await page.screenshot({path:info.outputPath('lev-flight.png')});
  await send('move',12,-94);await expect.poll(async()=> (await read()).cockpit.intent.propulsion?.lift||0).toBe(0);await expect.poll(async()=> (await read()).simulation.landings-evidence.start.simulation.landings,{timeout:60000}).toBeGreaterThan(0);
  evidence.landed=await read();expect(evidence.landed.cockpit.active).toBe(1);expect(evidence.landed.simulation.explicitFlights).toBe(evidence.start.simulation.explicitFlights+1);expect(evidence.landed.simulation.remounts).toBe(evidence.start.simulation.remounts);await page.screenshot({path:info.outputPath('lev-recapture.png')});
  await send('up');await expect.poll(async()=> (await read()).cockpit.active).toBe(0);expect((await read()).cockpit.intent.push).toBe(0);
  await send('down');await send('move',0,-18);await send('cancel');await expect.poll(async()=> (await read()).cockpit.active).toBe(0);
  await send('down');await send('move',0,-18);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect.poll(async()=> (await read()).cockpit.active).toBe(0);if(cdp)await send('up');
  await page.locator('.flow-menu > summary').click();const paused=await read();await page.waitForTimeout(600);expect((await read()).simulation.steps).toBe(paused.simulation.steps);expect(paused.cockpit.active).toBe(0);await page.locator('.flow-menu > summary').click();await expect.poll(async()=> (await read()).simulation.steps,{timeout:15000}).toBeGreaterThan(paused.simulation.steps);
  evidence.final=await read();if(cdp)expect(evidence.flight.cockpit.delivery.nativeMoves).toBeGreaterThan(0);
 }finally{writeFileSync(info.outputPath('levitation-rendered.json'),JSON.stringify(evidence,null,2));await context.close();}
});
test('LEVITATION actual cranial blocked-contact investigation and rider-directed recovery',async({page},info)=>{
 test.setTimeout(300000);await page.goto('/play/?mode=marrow&cockpit=1&touch=levitation&vehicle=vector');await page.bringToFront();await expect(page.locator('.cockpit[data-levitation=true]')).toBeVisible({timeout:120000});
 const read=()=>page.evaluate(()=>window.__MARROW__.report()),b=await page.locator('.cockpit-steer').boundingBox(),x=b.x+b.width*.5,y=b.y+b.height*.65;
 const send=(type,dx=0,dy=0)=>page.locator('.cockpit-steer').dispatchEvent('pointer'+type,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,buttons:type==='up'?0:1,clientX:x+dx,clientY:y+dy,bubbles:true,cancelable:true});
 const evidence={start:await read(),attempts:[]};
 try{
  await send('down');await send('move',0,-18);await send('move',0,-65);
  // Sustained straight or explicitly rider-directed turn; no artificial position injection.
  for(const dx of [0,35,-35,0]){await send('move',dx,-65);const before=await read();const until=Date.now()+20000;let latest=before;while(Date.now()<until){latest=await read();if(latest.simulation.edgeBlocked&&latest.simulation.levitation.blockedSeconds>.1)break;await page.waitForTimeout(300);}evidence.attempts.push({before,latest});if(latest.simulation.edgeBlocked&&latest.simulation.levitation.blockedSeconds>.1){evidence.blocked=latest;break;}}
  expect(evidence.blocked,'No sustained blocked state was reproduced; not a recovery pass').toBeTruthy();
  await page.screenshot({path:info.outputPath('lev-blocked.png')});
  // Brake to zero, steer deliberately in place, then throttle in new direction.
  const blocked=evidence.blocked;await send('move',0,55);await send('move',44,55);
  await expect.poll(async()=> (await read()).simulation.levitation.stationaryTurns,{timeout:30000}).toBeGreaterThan(blocked.simulation.levitation.stationaryTurns+60);
  evidence.pivot=await read();await send('move',0,55);await send('move',0,-125);
  const beforeRecovery=await read();try{await expect.poll(async()=> (await read()).simulation.rideDistance-beforeRecovery.simulation.rideDistance,{timeout:20000}).toBeGreaterThan(.02);evidence.recovery='pivot-retreat';}catch{
   // Deliberate lift-assisted disengagement, not automatic launch.
   await expect.poll(async()=> (await read()).cockpit.intent.push).toBeGreaterThan(.98);await send('move',12,-125);await send('move',12,-165);await expect.poll(async()=>!!(await read()).simulation.glide,{timeout:30000}).toBe(true);await send('move',-12,-165);await send('move',-12,-95);await expect.poll(async()=> (await read()).simulation.landings,{timeout:60000}).toBeGreaterThan(blocked.simulation.landings);evidence.recovery='rider-lift';
  }
  evidence.recovered=await read();expect(evidence.recovered.simulation.remounts).toBe(blocked.simulation.remounts);await page.screenshot({path:info.outputPath('lev-recovered.png')});
 }finally{await send('up').catch(()=>{});evidence.final=await read().catch(()=>null);writeFileSync(info.outputPath('levitation-blocked-source.json'),JSON.stringify(evidence,null,2));}
});
