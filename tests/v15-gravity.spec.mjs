import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('GRAVITY remains opt-in and uses the existing projection',async({page})=>{
 await page.goto('/atlas/?expedition=1');
 await expect(page.locator('.expedition-help')).not.toContainText('Hold L3');
 await page.goto('/atlas/?expedition=1&gravity=1');
 await expect(page.locator('.expedition-help')).toContainText('Hold L3');
 const drift=await page.evaluate(()=>{
  const c={yaw:.3,pitch:.2,zoom:4,width:390,height:844,frameSpan:3,target:{x:.1,y:0,z:0},anchorX:.47,anchorY:.53},p={x:.15,y:.2,z:.35};
  const a=BodySpatialCore.project(p,c),b=BodyGravity.project(c,p);
  return Math.hypot(a.x-b.x,a.y-b.y);
 });
 expect(drift).toBeLessThan(1e-9);
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-expedition-clean','true');
 await page.locator('#expedition-view').click();
 await expect(page.locator('#atlas-app')).toHaveAttribute('data-expedition-clean','false');
});

test('browser RAF with simulated standard pad: precision, response, neutral recovery',async({page},info)=>{
 await page.goto('/atlas/');
 const metrics=await page.evaluate(async()=>{
  const E=BodyExpedition,G=BodyGravity;
  const c={yaw:0,pitch:0,zoom:4,width:800,height:600,frameSpan:3,target:{x:0,y:0,z:0}};
  const bounds={min:[-5,-5,-5],max:[5,5,5]},buttons=Array.from({length:17},()=>({pressed:false,value:0})),axes=[0,0,0,0];
  let now=0,renderCount=0,firstMotion=null,start=null,prev=null,integrated=0;
  const periods=[],costs=[];
  const tick=()=>new Promise(r=>requestAnimationFrame(t=>{now=t;r(t);}));
  const mount=E.mount({camera:()=>c,bounds:()=>bounds,maxZoom:()=>14,canMove:()=>true,begin(){},end(){},
    render(){renderCount++;if(firstMotion===null)firstMotion=performance.now()-start;if(prev!==null)periods.push(performance.now()-prev);prev=performance.now();},
    command(){},status(){},getPads:()=>[{connected:true,index:0,mapping:'standard',buttons,axes}],
    navigate:(camera,i,dt,b,m)=>{const t=performance.now();if(i.orbitX)integrated+=Math.min(.05,dt);const changed=G.advance(E.advance,camera,i,dt,b,m,null);costs.push(performance.now()-t);return changed;}
  });
  const quantile=(xs,p)=>{const a=xs.slice().sort((x,y)=>x-y);return a.length?a[Math.ceil(a.length*p)-1]:null;};
  try{
   mount.setEnabled(true);for(let i=0;i<5;i++)await tick();
   start=performance.now();axes[2]=.8;let yaw=c.yaw,t=integrated;for(let i=0;i<24;i++)await tick();
   const regular=(c.yaw-yaw)/(integrated-t);axes[2]=0;await tick();await tick();prev=null;
   buttons[10]={pressed:true,value:1};axes[2]=.8;yaw=c.yaw;t=integrated;for(let i=0;i<24;i++)await tick();
   const precision=(c.yaw-yaw)/(integrated-t);
   axes[2]=0;buttons[10]={pressed:false,value:0};await tick();await tick();const before=c.yaw,count=renderCount;
   for(let i=0;i<8;i++)await tick();
   return {ratio:precision/regular,regular,firstMotionMs:firstMotion,activeCallbacks:periods.length,p95CallbackIntervalMs:quantile(periods,.95),p95NavigationCpuMs:quantile(costs,.95),renderCount,neutralStable:c.yaw===before&&renderCount===count};
  }finally{mount.setEnabled(false);}
 });
 writeFileSync(info.outputPath('gravity-simulated-controller.json'),JSON.stringify(metrics,null,2));
 expect(metrics.regular).toBeGreaterThan(0);
 expect(metrics.ratio).toBeGreaterThan(.10);
 expect(metrics.ratio).toBeLessThan(.45);
 expect(metrics.activeCallbacks).toBeGreaterThan(20);
 expect(metrics.neutralStable).toBe(true);
});

test('adaptive browser wheel uses continuous delta and preserves pointer projection',async({page},info)=>{
 await page.goto('/atlas/?expedition=1&gravity=1&gravityProfile=microsurgeon');
 await page.locator('#expedition-view').click();
 await expect(page.locator('#gravity-profile')).toHaveValue('microsurgeon');
 await page.locator('#gravity-profile').selectOption('cinematographer');
 await page.evaluate(()=>{
  const c=document.createElement('canvas');c.id='gravity-wheel-fixture';c.width=600;c.height=300;
  Object.assign(c.style,{position:'fixed',left:'0',top:'0',width:'300px',height:'200px',zIndex:'999999',background:'#16181b'});
  document.body.append(c);
  const state={yaw:.2,pitch:.1,zoom:2,frameSpan:3,width:300,height:200,target:{x:0,y:0,z:0}};
  const p=BodyGravityAdaptive.pointAtPixel(state,160,90);
  window.__gravityWheel={state,p};
  BodySpatialCore.attachOrbit(c,{state,render(){},pick(){},adaptiveWheel:()=>true,getBounds:()=>({min:[-20,-20,-20],max:[20,20,20],radius:.4}),deepZoomEnabled:()=>true});
 });
 if(info.project.name==='desktop-chromium'){await page.mouse.move(160,90);await page.mouse.wheel(0,-40);}else await page.locator('#gravity-wheel-fixture').dispatchEvent('wheel',{deltaY:-40,deltaMode:0,clientX:160,clientY:90,cancelable:true});
 await expect.poll(()=>page.evaluate(()=>window.__gravityWheel.state.zoom)).toBeGreaterThan(2);
 const result=await page.evaluate(()=>{const {state,p}=window.__gravityWheel,q=BodyGravity.project(state,p);return {zoom:state.zoom,drift:Math.hypot(q.x-160,q.y-90)};});
 expect(result.zoom).toBeCloseTo(2*Math.exp(.1),8);expect(result.drift).toBeLessThan(1e-8);
 await page.locator('#gravity-wheel-fixture').dispatchEvent('wheel',{deltaY:-40,deltaMode:0,clientX:160,clientY:90,ctrlKey:true,cancelable:true});
 expect(await page.evaluate(()=>window.__gravityWheel.state.zoom)).toBe(result.zoom);
 writeFileSync(info.outputPath('gravity-wheel.json'),JSON.stringify(result,null,2));
});

test('adaptive simulated standard gamepad coasts then settles; renders comparison fixture',async({page},info)=>{
 await page.goto('/atlas/');
 const m=await page.evaluate(async()=>{
  const E=BodyExpedition,A=BodyGravityAdaptive,G=BodyGravity,policy=A.create('microsurgeon');
  const c={yaw:0,pitch:0,zoom:14,width:800,height:600,frameSpan:3,target:{x:0,y:0,z:0}},b={min:[-100,-100,-100],max:[100,100,100]};
  const axes=[0,0,0,0],buttons=Array.from({length:17},()=>({pressed:false,value:0}));
  let renders=0,first=null,started=0;
  const mount=E.mount({camera:()=>c,bounds:()=>b,maxZoom:()=>14,canMove:()=>true,begin(){},end(){},render(){renders++;if(first===null)first=performance.now()-started;},command(){},status(){},getPads:()=>[{connected:true,index:0,mapping:'standard',buttons,axes}],readInput:p=>policy.read(p,E.read),navigate:(c,i,d,b,m)=>policy.step(E.advance,c,i,d,b,m,null),hasMotion:policy.active,resetMotion:policy.reset});
  const frame=()=>new Promise(r=>requestAnimationFrame(r));
  try{mount.setEnabled(true);for(let j=0;j<5;j++)await frame();started=performance.now();axes[0]=.8;for(let j=0;j<30;j++)await frame();const moved=c.target.x;axes[0]=0;for(let j=0;j<30;j++)await frame();const released=c.target.x,count=renders;for(let j=0;j<5;j++)await frame();return {moved,released,firstMotionMs:first,renders,settled:!policy.active()&&released===c.target.x&&count===renders};}finally{mount.setEnabled(false);}
 });
 expect(m.moved).toBeGreaterThan(0);expect(m.released).toBeGreaterThanOrEqual(m.moved);expect(m.settled).toBe(true);
 writeFileSync(info.outputPath('gravity-adaptive-controller.json'),JSON.stringify(m,null,2));
 // Synthetic geometric fixture, not anatomical evidence: draw projected world-space grid/feature for identical recorded input.
 await page.evaluate(()=>{
  const E=BodyExpedition,A=BodyGravityAdaptive,G=BodyGravity,wrap=document.createElement('div');
  Object.assign(wrap.style,{position:'fixed',inset:'0',background:'#16181b',zIndex:'999999',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',font:'14px sans-serif'});
  const title=document.createElement('div');title.textContent='Controlled projection fixture — identical input, 4× zoom';wrap.append(title);
  for(const adaptive of [false,true]){
   const row=document.createElement('div');row.textContent=adaptive?'ADAPTIVE · depth compensation + acceleration':'BASELINE · existing target-plane compensation';
   const canvas=document.createElement('canvas');canvas.width=300;canvas.height=160;canvas.style.display='block';row.append(canvas);wrap.append(row);
   const c={yaw:0,pitch:0,zoom:4,width:300,height:160,frameSpan:3,target:{x:0,y:0,z:0}},p={x:0,y:0,z:2},b={min:[-100,-100,-100],max:[100,100,100]},policy=A.create(),input={panX:.15,panY:0,orbitX:0,orbitY:0,zoom:0};
   const start=G.project(c,p);
   for(let j=0;j<60;j++)adaptive?policy.step(E.advance,c,input,1/60,b,14,{inspectionPoint:()=>p}):E.advance(c,input,1/60,b,14);
   const end=G.project(c,p),ctx=canvas.getContext('2d');ctx.fillStyle='#24282c';ctx.fillRect(0,0,300,160);
   ctx.strokeStyle='#555';for(let x=0;x<300;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,160);ctx.stroke();}
   ctx.strokeStyle='#eee';ctx.beginPath();ctx.arc(start.x,start.y,7,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#72cbb5';ctx.beginPath();ctx.arc(end.x,end.y,7,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#eee';ctx.fillText(Math.abs(end.x-start.x).toFixed(2)+' px',8,150);
  }document.body.append(wrap);
 });
 await page.screenshot({path:info.outputPath('gravity-projection-comparison.png')});
});
