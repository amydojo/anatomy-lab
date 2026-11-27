/* SLIPSTREAM 007.2 — experimental local contact chart for MARROW.
 * The anchor is an actual ray hit. The chart normal is a locomotion
 * representation, not an anatomical normal or replacement geometry.
 * No steering fan, no new forces, no extrapolated support over gaps.
 */
import {footprint} from './osteodynamics.mjs';
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,1,0])=>len(a)>1e-10?mul(a,1/len(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),plane=(a,n)=>sub(a,mul(n,dot(a,n)));
const H=.011,STEP=1/120;
function turn(a,b,max){const theta=Math.acos(clamp(dot(a,b),-1,1));if(theta<=max||theta<1e-8)return b.slice();const q=Math.sin(theta),t=max/theta;return q>1e-7?unit(add(mul(a,Math.sin((1-t)*theta)/q),mul(b,Math.sin(t*theta)/q)),a):a.slice();}
export function createContactAudit(){
 let counts={},blockedCounts={},examples=[],step=0,current={},rejected=[],offset={anchorWithinLimit:0,offsetDominant:0},blockedOffset={anchorWithinLimit:0,offsetDominant:0},currentOffset={};
 return {begin(i){step=i;current={};rejected=[];currentOffset={anchorWithinLimit:0,offsetDominant:0};},reject(reason,detail){counts[reason]=(counts[reason]||0)+1;current[reason]=(current[reason]||0)+1;if(detail&&reason==='offset-distance'){if(detail.surfaceDistance<=detail.limit){offset.anchorWithinLimit++;currentOffset.anchorWithinLimit++;if(detail.offsetJump>detail.surfaceDistance){offset.offsetDominant++;currentOffset.offsetDominant++;}}if(rejected.length<5)rejected.push(detail);}},end(ok){if(!ok){for(const [k,v] of Object.entries(current))blockedCounts[k]=(blockedCounts[k]||0)+v;for(const [k,v] of Object.entries(currentOffset))blockedOffset[k]+=v;if(rejected.length&&examples.length<48)examples.push({step,counts:{...current},offsetExamples:rejected});}},report(){return {counts:{...counts},blockedCounts:{...blockedCounts},offset:{...offset},blockedOffset:{...blockedOffset},examples:examples.slice()};}};
}
export function createSlipstreamManifold(world,parts,{variant='continuous'}={}){
 if(!['continuous','strict'].includes(variant))throw Error('unknown manifold variant');
 const witnesses=footprint(parts).probes.filter(q=>q.label.includes('Pod'));
 let cache=null,stats={},calls=0,accepted=0,blocked=0,chartSamples=0,maxGuideStep=0,maxNormalLag=0,maxIntentDeviation=0,maxOffsetStep=0,maxGuideTurn=0,supportUnavailable=0,confidenceSum=0,timings=[],last=null;
 const count=k=>stats[k]=(stats[k]||0)+1;
 const ray=(p,n,reach)=>{calls++;return world.ray(add(p,mul(n,reach)),mul(n,-1),reach*2);};
 function chart(hit,n,f,step){
  const u=unit(plane(f,n),f),right=unit(cross(n,u),[1,0,0]),samples=[],local=[];
  // Tangent estimate samples the actual small neighborhood, rather than
  // treating a single triangle normal as the complete locomotion frame.
  for(const t of [u,mul(u,-1),right,mul(right,-1)]){
   const p=add(hit.point,mul(t,.0025)),q=ray(p,hit.normal,.005);
   if(q&&q.id===hit.id&&dot(q.normal,hit.normal)>.65&&len(sub(q.point,p))<.0025)local.push(q.normal);
  }
  const estimate=unit(local.reduce((a,v)=>add(a,v),mul(hit.normal,2)),hit.normal);
  let front=0,rear=0;
  // Rest footprint witnesses are extracted from the exact qualified geometry.
  // These are coarse support checks, NOT clearance or full intersection tests.
  for(const w of witnesses){const p=add(hit.point,add(mul(right,w.local[0]),mul(u,w.local[2]))),q=ray(p,estimate,.028);if(!q||q.id!==hit.id||dot(q.normal,estimate)<.45||len(sub(q.point,p))>.022)continue;samples.push(q);if(w.label.startsWith('frontPod'))front++;else rear++;}
  const confidence=(local.length/4)*(samples.length/Math.max(1,witnesses.length)),coherent=front>0&&rear>0&&local.length>=2;
  chartSamples++;confidenceSum+=confidence;if(!coherent)supportUnavailable++;
  return {point:hit.point.slice(),normal:estimate,rawNormal:hit.normal.slice(),id:hit.id,step,confidence,coherent,front,rear,forward:u};
 }
 return {reset(){cache=null;},select({anchor,p,n,dir,desired,length:d,id,forward,velocity,step}){
  const start=performance.now();let selected=null;const old=anchor.point,raw=unit(anchor.normal,n),pred=add(old,mul(dir,d));
  // A bounded fan changes ray orientation, NOT intended travel direction.
  // All rays aim at the same rider-directed point.
  const dirs=[raw,n,unit(add(raw,mul(dir,.35)))];
  const reach=clamp(.0025+d*2,.0025,.009),seen=[];
  for(const axis of dirs){if(seen.some(q=>dot(q,axis)>.9999))continue;seen.push(axis);const h=ray(pred,axis,reach);
   if(!h){count('no-hit');continue;}if(h.id!==id){count('different-source');continue;}if(dot(h.normal,raw)<.35){count('raw-normal-turn');continue;}
   const delta=sub(h.point,old),progress=dot(delta,dir),intent=dot(delta,desired),travel=len(delta);
   if(progress<d*.18||intent<d*.10){count('forward-intent');continue;}
   if(travel>Math.max(d*2.0,.00022)){count('anchor-distance');continue;}
   const lateral=len(sub(plane(delta,n),mul(dir,progress)));if(lateral>Math.max(d*.80,.00008)){count('lateral');continue;}
   // Actual midpoint hit prevents advancing over a missing/disconnected gap.
   const middle=mul(add(old,h.point),.5),axisMid=unit(add(raw,h.normal),raw),m=ray(middle,axisMid,Math.max(.0006,d));
   if(!m||m.id!==id||dot(m.normal,axisMid)<.45||len(sub(m.point,middle))>Math.max(.00007,d*.30)){count('midpoint-continuity');continue;}
   let local=cache;
   if(!local||local.id!==id||step-local.step>=6||len(sub(local.point,h.point))>.003||dot(local.rawNormal,h.normal)<.94||dot(local.forward,forward)<.96){local=chart(h,n,forward,step);cache=local;}
   if(variant==='strict'&&!local.coherent){count('insufficient-footprint');continue;}
   // Confidence only permits stronger neighborhood influence. The exact raw
   // normal always constrains the accepted chart; no global smoothing.
   const target=local.coherent?unit(add(mul(h.normal,1.5),mul(local.normal,local.confidence)),h.normal):h.normal;
   const next=turn(n,target,Math.min(.065,Math.max(.001,d*.8/H)));
   if(dot(next,h.normal)<.58){count('chart-normal-lag');continue;}
   const q=add(h.point,mul(next,H)),stepDelta=sub(q,p),stepLen=len(stepDelta);
   if(stepLen>Math.max(d*2.35,.00030)||dot(stepDelta,dir)<d*.04){count('guide-displacement');continue;}
   // Central chassis sweep is an additional necessary, not sufficient, test.
   // No mesh-wide or continuous collision guarantee is claimed.
   if(stepLen>1e-8){calls++;const sweep=world.ray(p,stepDelta,stepLen);if(sweep&&sweep.distance<stepLen-1e-7){count('central-sweep');continue;}}
   selected={...h,rawNormal:h.normal.slice(),normal:next,q};const angle=Math.acos(clamp(dot(n,next),-1,1)),lag=Math.acos(clamp(dot(next,h.normal),-1,1));
   maxGuideStep=Math.max(maxGuideStep,stepLen);maxNormalLag=Math.max(maxNormalLag,lag);maxGuideTurn=Math.max(maxGuideTurn,angle/STEP);maxOffsetStep=Math.max(maxOffsetStep,len(mul(sub(next,n),H)));maxIntentDeviation=Math.max(maxIntentDeviation,Math.acos(clamp(dot(unit(plane(delta,n),dir),desired),-1,1)));
   last={step,anchor:h.point,raw:h.normal,guide:next,progress,travel,confidence:local.confidence,front:local.front,rear:local.rear,coherent:local.coherent};break;
  }
  if(selected)accepted++;else blocked++;
  timings.push(performance.now()-start);if(timings.length>600)timings.shift();
  return selected;
 },report(){const a=timings.slice().sort((x,y)=>x-y);return {variant,accepted,blocked,rejections:{...stats},rays:calls,chartSamples,supportUnavailable,meanConfidence:chartSamples?confidenceSum/chartSamples:null,maxGuideStep,maxNormalLag,maxGuideTurn,maxOffsetStep,maxIntentDeviation,cpuMs:{median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null},last};}};
}
