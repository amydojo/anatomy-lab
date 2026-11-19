import {test,expect} from '@playwright/test';
import fs from 'node:fs';
/* V14 #41 touch-zone measurement. Read-only: only hitTestAt()/touchCandidatesAt()/touchPlanAt() are used, so nothing
 * is selected, rendered, written to history or moved. Slow (it rasterises the knee at 1-2 px), so it only runs
 * with MEASURE=1; the numbers it prints/writes are what the #41 report quotes.
 *   BEFORE = exact-triangle zone (hitTestAt, identical to the old picker)
 *   AFTER  = what a finger can select now (exact OR tolerance-select), per candidate radius 12/16/20/24 px.
 * Synthetic viewports; this is not real-finger evidence. */
const MOBILE=[[390,844],[375,667],[320,568],[844,390],[667,375]];
const DESKTOP=[[1440,900]];
const KNEE=['anterior-cruciate-ligament','posterior-cruciate-ligament','medial-collateral-ligament','lateral-collateral-ligament','medial-meniscus','lateral-meniscus','patellar-ligament','quadriceps-tendon'];
const RADII=[12,16,20,24];
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120)))));
const LIG={bones:true,muscles:false,ligaments:true,tendons:true,fibrocartilage:true};
// isolated-* = the Studio "isolate" action, the only way to see the cruciates (fully behind femur/patella in the front view).
const SCENARIOS={'all-layers':[null,null],'ligament-view':[LIG,null],'isolated-acl':[LIG,['anterior-cruciate-ligament']],'isolated-pcl':[LIG,['posterior-cruciate-ligament']]};
const only=process.env.MEASURE_VIEWPORTS?process.env.MEASURE_VIEWPORTS.split(',').map(v=>v.split('x').map(Number)):null;
for(const [w,h] of [...MOBILE,...DESKTOP]){
 for(const [scn,[vis,iso]] of Object.entries(SCENARIOS))
 test('measure touch zones '+w+'x'+h+' '+scn,async({page},info)=>{
  test.skip(!process.env.MEASURE,'measurement run only (MEASURE=1)');
  test.skip((info.project.name==='desktop-chromium')!==(w===1440),'viewport belongs to another project');
  test.skip(!!only&&!only.some(v=>v[0]===w&&v[1]===h),'not selected');
  test.setTimeout(1200000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:w,height:h});
  await page.goto('/atlas/?studio=connective',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#connective-left')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__BODY_ATLAS__?.getState()?.renderer?.connectiveMeshes)).toBe(8);
  await frames(page);await frames(page);
  if(vis){await page.evaluate(([v,i])=>window.__BODY_ATLAS__.connectiveFilter(v,i||[],false),[vis,iso]);await frames(page);}
  const result=await page.evaluate(([ids,radii])=>{
   const A=window.__BODY_ATLAS__,TP=window.BodyTouchPick,cv=document.getElementById('atlas-canvas'),W=cv.clientWidth,H=cv.clientHeight;
   const all=A.touchCandidatesAt(W/2,H/2,5000)||[];
   const foot={};for(const c of all)if(ids.includes(c.id))foot[c.id]=c.footprint;
   let X0=1e9,Y0=1e9,X1=-1e9,Y1=-1e9;
   for(const f of Object.values(foot)){X0=Math.min(X0,f.x);Y0=Math.min(Y0,f.y);X1=Math.max(X1,f.x+f.w);Y1=Math.max(Y1,f.y+f.h);}
   const clampX=v=>Math.max(0,Math.min(W-1,v)),clampY=v=>Math.max(0,Math.min(H-1,v));
   const bx0=Math.floor(clampX(X0)),by0=Math.floor(clampY(Y0)),bx1=Math.ceil(clampX(X1)),by1=Math.ceil(clampY(Y1));
   // 1) exact zones at 1 px
   const zone={},owner=new Map(),scene={};let t0=performance.now(),calls=0;
   for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    const id=A.hitTestAt(x,y);calls++;if(!id)continue;
    owner.set(x+','+y,id);scene[id]=(scene[id]||0)+1;
    if(ids.includes(id))(zone[id]=zone[id]||[]).push([x,y]);
   }
   const exactMs=(performance.now()-t0)/calls;
   const exact={};
   for(const id of ids){
    const pts=zone[id]||[];let robust=0,x0=1e9,y0=1e9,x1=-1,y1=-1;
    for(const [x,y] of pts){
     if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
     let r=0;while(r<6){const n=r+1;let ok=true;for(let dy=-n;dy<=n&&ok;dy++)for(let dx=-n;dx<=n;dx++)if(owner.get((x+dx)+','+(y+dy))!==id){ok=false;break;}if(!ok)break;r=n;}
     if(r>robust)robust=r;
    }
    exact[id]={area:pts.length,robustRadius:robust,zoneW:pts.length?x1-x0+1:0,zoneH:pts.length?y1-y0+1:0,footprint:foot[id]||null};
   }
   // 2) tolerance + candidates on a 2 px grid over the group bbox + 24 px
   const M=24,gx0=Math.max(0,Math.floor(bx0-M)),gy0=Math.max(0,Math.floor(by0-M)),gx1=Math.min(W-1,Math.ceil(bx1+M)),gy1=Math.min(H-1,Math.ceil(by1+M));
   const after={};for(const R of radii)after[R]={byId:Object.fromEntries(ids.map(i=>[i,{select:0,exact:0,choose:0}])),none:0,otherExact:0,chooseTotal:0,selectTotal:0,samples:0};
   const gap={},occl={};for(const id of ids)occl[id]={near:0,occluded:0,by:{}};
   const crowd={};let samples=0;t0=performance.now();calls=0;
   const nbr=[...ids,'femur','tibia','fibula','patella'];
   for(let y=gy0;y<=gy1;y+=2)for(let x=gx0;x<=gx1;x+=2){
    const ex=A.hitTestAt(x,y);const cands=A.touchCandidatesAt(x,y,24)||[];calls++;samples++;
    for(const c of cands){
     if(ids.includes(c.id)&&c.distance>0){const o=occl[c.id];o.near++;if(c.occludedBy){o.occluded++;o.by[c.occludedBy]=(o.by[c.occludedBy]||0)+1;}}
    }
    for(let i=0;i<cands.length;i++)for(let j=i+1;j<cands.length;j++){
     const a=cands[i],b=cands[j];if(!nbr.includes(a.id)||!nbr.includes(b.id))continue;
     const k=[a.id,b.id].sort().join(' | '),v=a.distance+b.distance;
     if(gap[k]===undefined||v<gap[k])gap[k]=v;
    }
    for(const R of radii){
     const T=after[R];T.samples++;
     if(ex){if(ids.includes(ex)){T.byId[ex].exact++;T.byId[ex].select++;T.selectTotal++;}else T.otherExact++;continue;}
     const d=TP.decide(cands,R);
     if(d.kind==='select'&&ids.includes(d.id)){T.byId[d.id].select++;T.selectTotal++;}
     else if(d.kind==='select')T.otherExact++;
     else if(d.kind==='choose'){T.chooseTotal++;for(const o of d.options)if(ids.includes(o.id))T.byId[o.id].choose++;
      const key=d.options.map(o=>o.id).sort().join(' + ');if(R===16)crowd[key]=(crowd[key]||0)+1;}
     else T.none++;
    }
   }
   const tolMs=(performance.now()-t0)/calls;
   return {viewport:[innerWidth,innerHeight],canvas:[W,H],bbox:[bx0,by0,bx1,by1],exact,after,gap,occl,crowd,sceneOwner:scene,samples,
    timing:{exactHitMs:exactMs,candidatesAndExactMs:tolMs}};
  },[KNEE,RADII]);
  const out='test-results/touch-measure-'+w+'x'+h+'-'+scn+'.json';fs.mkdirSync('test-results',{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,1));
  await info.attach('touch-measure',{body:JSON.stringify(result),contentType:'application/json'});
  console.log('MEASURED '+w+'x'+h+' '+scn+' -> '+out);
  expect(Object.keys(result.exact).length).toBe(8);
 });
}
