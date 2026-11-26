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
  let now=0,renderCount=0,firstMotion=null,start=null,prev=null;
  const periods=[],costs=[];
  const tick=()=>new Promise(r=>requestAnimationFrame(t=>{now=t;r(t);}));
  const mount=E.mount({camera:()=>c,bounds:()=>bounds,maxZoom:()=>14,canMove:()=>true,begin(){},end(){},
    render(){renderCount++;if(firstMotion===null)firstMotion=performance.now()-start;if(prev!==null)periods.push(performance.now()-prev);prev=performance.now();},
    command(){},status(){},getPads:()=>[{connected:true,index:0,mapping:'standard',buttons,axes}],
    navigate:(camera,i,dt,b,m)=>{const t=performance.now();const changed=G.advance(E.advance,camera,i,dt,b,m,null);costs.push(performance.now()-t);return changed;}
  });
  const quantile=(xs,p)=>{const a=xs.slice().sort((x,y)=>x-y);return a.length?a[Math.ceil(a.length*p)-1]:null;};
  try{
   mount.setEnabled(true);for(let i=0;i<5;i++)await tick();
   start=performance.now();axes[2]=.8;let yaw=c.yaw,t=now;for(let i=0;i<24;i++)await tick();
   const regular=(c.yaw-yaw)/(now-t);axes[2]=0;await tick();await tick();prev=null;
   buttons[10]={pressed:true,value:1};axes[2]=.8;yaw=c.yaw;t=now;for(let i=0;i<24;i++)await tick();
   const precision=(c.yaw-yaw)/(now-t);
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
