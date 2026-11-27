import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('MONO global movement fallback and no duplicate processing',async({page},info)=>{
 await page.goto('/atlas/');await page.evaluate(()=>{
  history.replaceState(null,'','?touch=single');const host=document.createElement('section');host.id='mono-fixture';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'999999',background:'#131319'});document.body.append(host);
  let look=[0,0];const c=BodyCockpit.mount(host,{onLook:d=>{look[0]+=d[0];look[1]+=d[1];}});window.__mono={c,look};
  for(const el of host.querySelectorAll('[data-role]'))el.setPointerCapture=()=>{throw Error('fixture capture unavailable');};
 });
 const result=await page.evaluate(()=>{
  const {c,look}=window.__mono,steer=document.querySelector('#mono-fixture .cockpit-steer'),rect=steer.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  const f=(target,type,id,x,y)=>target.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  f(steer,'pointerdown',1,x,y);f(document.body,'pointermove',1,x+25,y-40);const moved=c.sample({ground:true}),delivery=c.report().delivery;f(document.body,'pointercancel',1,x,y);const neutral=c.sample({ground:true});
  const area=document.querySelector('#mono-fixture .cockpit-look');f(area,'pointerdown',2,10,10);f(area,'pointermove',2,30,15);c.sample({ground:true});f(area,'pointerup',2,30,15);
  return {moved,delivery,neutral,look,final:c.report()};
 });
 expect(result.moved.push).toBeGreaterThan(0);expect(result.moved.mono.steer).toBeGreaterThan(0);expect(result.delivery.captureFailures).toBe(1);expect(result.delivery.fallbackMoves).toBe(1);expect(result.delivery.moves).toBe(1);expect(result.neutral.push).toBe(0);expect(result.neutral.mono).toBeNull();expect(result.look).toEqual([20,5]);expect(result.final.active).toBe(0);
 writeFileSync(info.outputPath('mono-fallback.json'),JSON.stringify(result,null,2));
});
test('MONO native Chromium touch input on live MARROW, diagonal drive and neutral recovery',async({browser,browserName},info)=>{
 test.skip(browserName!=='chromium','CDP browser-native touch injection is Chromium-only; WebKit uses synthetic fallback test and existing source gate');
 test.setTimeout(180000);const context=await browser.newContext({baseURL:info.project.use.baseURL,hasTouch:true,isMobile:true,viewport:{width:1024,height:600},deviceScaleFactor:1});const page=await context.newPage();const cdp=await context.newCDPSession(page);
 try{
  await page.goto('/play/?mode=marrow&cockpit=1&touch=single&steering=vehicle');await page.bringToFront();await expect(page.locator('.cockpit[data-mono=true]')).toBeVisible({timeout:120000});
  const read=()=>page.evaluate(()=>window.__MARROW__.report());await expect.poll(async()=>!!(await read()).camera?.framed,{timeout:30000}).toBe(true);
  const b=await page.locator('.cockpit-steer').boundingBox(),x=Math.round(b.x+b.width*.5),y=Math.round(b.y+b.height*.5),travel=Math.min(b.width,b.height)*.46;
  const start=await read(),send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({x:Math.round(x),y:Math.round(y),id:1}))});
  await send('touchStart',[[x,y]]);await send('touchMove',[[x+travel*.2,y-travel*.7]]);
  await expect.poll(async()=>{const q=await read();return !!(q.cockpit.intent.mono?.steer>0&&q.cockpit.intent.push>.4&&q.cockpit.delivery.nativeMoves>0);},{timeout:15000}).toBe(true);
  await expect.poll(async()=> (await read()).simulation.rideDistance-start.simulation.rideDistance,{timeout:30000}).toBeGreaterThan(.015);
  const small=await read();await send('touchMove',[[x+travel*.75,y-travel*.7]]);
  await expect.poll(async()=> (await read()).cockpit.intent.mono?.steer||0).toBeGreaterThan(small.cockpit.intent.mono.steer);
  const large=await read();expect(Math.abs(large.cockpit.intent.push-small.cockpit.intent.push)).toBeLessThan(.025);
  await page.screenshot({path:info.outputPath('mono-native-drive.png')});await send('touchEnd',[]);
  await expect.poll(async()=> (await read()).cockpit.active).toBe(0);const released=await read();expect(released.cockpit.intent.push).toBe(0);
  await send('touchStart',[[x,y]]);await send('touchMove',[[x,y-travel*.5]]);await send('touchCancel',[]);await expect.poll(async()=> (await read()).cockpit.active).toBe(0);
  await page.setViewportSize({width:600,height:1024});await page.screenshot({path:info.outputPath('mono-portrait.png')});
  writeFileSync(info.outputPath('mono-native.json'),JSON.stringify({start,small,large,released,final:await read()},null,2));
 }finally{await context.close();}
});
test('MONO reach zone and contextual controls at landscape and portrait sizes',async({page},info)=>{
 test.setTimeout(150000);await page.goto('/play/?mode=marrow&cockpit=1&touch=single');await expect(page.locator('.cockpit[data-mono=true]')).toBeVisible({timeout:120000});await expect(page.locator('.cockpit-pedal')).toBeHidden();
 const sizes=[];for(const [width,height] of [[1920,1080],[1024,600],[844,390],[390,844]]){await page.setViewportSize({width,height});const b=await page.locator('.cockpit-steer').boundingBox(),a=await page.locator('.cockpit-actions').boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width+1);expect(b.y+b.height).toBeLessThanOrEqual(height+1);expect(b.width).toBeGreaterThan(115);expect(a.x+a.width).toBeLessThan(b.x+1);sizes.push({width,height,steer:b,actions:a});}
 await page.locator('.cockpit-settings summary').click();await page.locator('[data-setting=left]').check();await expect(page.locator('.cockpit')).toHaveAttribute('data-hand','left');await page.locator('[data-setting=reference]').selectOption('camera');await page.locator('.cockpit-settings summary').click();
 await page.screenshot({path:info.outputPath('mono-left.png')});writeFileSync(info.outputPath('mono-layout.json'),JSON.stringify(sizes,null,2));
});
