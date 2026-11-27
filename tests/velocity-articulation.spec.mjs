import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('IGNITION actual exported assembly and dynamic world transform parity',async({page},info)=>{
 test.setTimeout(120000);
 const file=process.env.VELOCITY_CANDIDATE,native=process.env.VELOCITY_NATIVE,replay=process.env.VELOCITY_REPLAY;
 test.skip(!file||!native||!replay,'Requires pinned actual baked asset, native reference and KINETIC replay');
 const ref=JSON.parse(fs.readFileSync(native)),record=JSON.parse(fs.readFileSync(replay));
 const peak=record.all.reduce((a,b)=>a.pose.vehicle.compression>b.pose.vehicle.compression?a:b);
 const rows=[...record.frames,peak].sort((a,b)=>a.t-b.t);
 await page.goto('/experiments/hairpin/?edition=velocity');
 const data=Array.from(fs.readFileSync(file));
 const evidence=await page.evaluate(async({data,ref,rows})=>{
  const {decodeVelocityGLB,closeVelocity}=await import('/experiments/hairpin/vector/velocity/glb-material.mjs');
  const parts=await decodeVelocityGLB(Uint8Array.from(data).buffer);
  const keys={front:'front',rear:'rear',joint:null,front_pod:'frontPod',rear_pod:'rearPod'};
  const tol=1e-7,grid=1e-6;
  const apply=(q,p)=>[0,1,2].map(k=>q.r[k]*p[0]+q.r[k+3]*p[1]+q.r[k+6]*p[2]+q.t[k]);
  const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
  const worldFrames=[{r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]},{r:[0,1,0,-1,0,0,0,0,1],t:[.17,-.24,.31]},{r:[1,0,0,0,-1,0,0,0,-1],t:[-.3,.12,.06]}];
  const compose=(base,q)=>({r:[0,3,6].flatMap(i=>apply({...base,t:[0,0,0]},q.r.slice(i,i+3))),t:apply(base,q.t)});
  const result={groups:{},samples:rows.length,worldFrames:worldFrames.length,phases:[...new Set(rows.map(r=>r.pose.vehicle.phase))],maxRestError:0,maxWorldError:0};
  try{
   if(parts.length!==5||new Set(parts.map(p=>p.assembly)).size!==5)throw Error('Five independent assemblies required');
   for(const p of parts){
    const group=p.assembly,tri=ref[group],lookup=new Map(),points=[],counts=new Map();
    const cell=v=>v.map(x=>Math.floor(x/grid));
    const key=v=>v.join(',');
    function find(v,insert=false){const a=cell(v);let best=-1,error=Infinity;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){for(const id of lookup.get(key([a[0]+x,a[1]+y,a[2]+z]))||[]){const e=dist(points[id],v);if(e<error){best=id;error=e;}}}if(error<=tol)return [best,error];if(!insert)throw Error('Unmatched native vertex '+group+' '+error);const id=points.length;points.push(v);const k=key(a);lookup.set(k,[...(lookup.get(k)||[]),id]);return [id,0];}
    const face=ids=>ids.slice().sort((a,b)=>a-b).join(':');
    for(const t of tri){const k=face(t.map(v=>find(v,true)[0]));counts.set(k,(counts.get(k)||0)+1);}
    const map=[];for(let i=0;i<p.positions.length;i+=3){const v=Array.from(p.positions.slice(i,i+3)),[id,e]=find(v);map.push(id);result.maxRestError=Math.max(result.maxRestError,e);}
    for(let i=0;i<p.indices.length;i+=3){const k=face(Array.from(p.indices.slice(i,i+3),j=>map[j]));const n=counts.get(k)||0;if(!n)throw Error('Triangle mismatch '+group);counts.set(k,n-1);}
    if([...counts.values()].some(n=>n!==0))throw Error('Missing native faces '+group);
    let max=0,checks=0;
    for(const row of rows)for(const world of worldFrames){
      const pose=row.pose,board={...pose,...compose(world,pose)};
      for(const k of ['front','rear','frontPod','rearPod'])board[k]=compose(world,pose[k]);
      const selected=window.BodyMarrowBoard.transform(p.id,board),expected=keys[group]?pose[keys[group]]:pose;
      for(let i=0;i<map.length;i++){
       const v=Array.from(p.positions.slice(i*3,i*3+3));
       const error=dist(apply(selected,v),apply(world,apply(expected,points[map[i]])));
       max=Math.max(max,error);checks++;
      }
    }
    result.groups[group]={triangles:p.indices.length/3,vertices:map.length,checks,maxWorldError:max};
    result.maxWorldError=Math.max(result.maxWorldError,max);
   }
   return result;
  }finally{closeVelocity(parts);}
 },{data,ref,rows});
 fs.writeFileSync(info.outputPath('exported-articulation.json'),JSON.stringify(evidence,null,2));
 console.log('IGNITION_ARTICULATION',JSON.stringify(evidence));
 expect(evidence.samples).toBe(110);expect(Object.keys(evidence.groups)).toHaveLength(5);
 expect(Object.values(evidence.groups).reduce((s,g)=>s+g.triangles,0)).toBe(19986);
 expect(evidence.maxRestError).toBeLessThan(1e-7);expect(evidence.maxWorldError).toBeLessThan(1e-7);
});
