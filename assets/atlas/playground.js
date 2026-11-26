/* PLAYGROUND: immutable source geometry, rigid display transforms only. */
(function(root){'use strict';
const I=Object.freeze([1,0,0,0,1,0,0,0,1]),Z=Object.freeze([0,0,0]),identity=Object.freeze({r:I,t:Z});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),center=p=>p.min.map((v,i)=>(v+p.max[i])/2);
const mul=(r,v)=>[r[0]*v[0]+r[3]*v[1]+r[6]*v[2],r[1]*v[0]+r[4]*v[1]+r[7]*v[2],r[2]*v[0]+r[5]*v[1]+r[8]*v[2]];
const inverse=(r,v)=>[r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]];
const point=(m,v)=>mul(m.r,v).map((x,i)=>x+m.t[i]);
const ray=(m,o,d)=>({o:inverse(m.r,o.map((x,i)=>x-m.t[i])),d:inverse(m.r,d)});
function box(p,m){if(!m||m===identity)return p;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<8;i++){const q=point(m,[i&1?p.max[0]:p.min[0],i&2?p.max[1]:p.min[1],i&4?p.max[2]:p.min[2]]);for(let k=0;k<3;k++){min[k]=Math.min(min[k],q[k]);max[k]=Math.max(max[k],q[k]);}}return {min,max};}
function rotation(yaw,pitch){const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);return [c,0,-s,s*b,a,c*b,s*a,-b,c*a];}
function create(parts,bounds){let amount=0,pattern='radial',mode='explore',scope=null,held=null,grasp=new Map(),transforms=new Map(),boxes=new Map(),history=[],revision=0,displayBounds=bounds;
const origin=bounds.min.map((v,i)=>(v+bounds.max[i])/2),span=Math.max(.15,...bounds.max.map((v,i)=>v-bounds.min[i])),ids=new Set(parts.map(p=>p.id)),ordered=[...parts].sort((a,b)=>center(a)[1]-center(b)[1]||a.id.localeCompare(b.id)),rank=new Map(ordered.map((p,i)=>[p.id,i]));
const snapshot=()=>({amount,pattern,scope,held,grasp:[...grasp].map(([id,g])=>[id,{...g,shift:[...g.shift]}])});
function checkpoint(){history.push(snapshot());if(history.length>24)history.shift();}
function rebuild(){transforms=new Map();boxes=new Map();for(const p of parts){const c=center(p),d=c.map((v,i)=>v-origin[i]);let t=[0,0,0];if(amount>0&&(!scope||scope===p.id)){const len=Math.hypot(...d),sign=d[0]<0?-1:1;const dir=pattern==='axial'?[0,(rank.get(p.id)-(parts.length-1)/2)/Math.max(1,(parts.length-1)/2),0]:pattern==='bilateral'?[sign,0,0]:len>1e-8?d.map(x=>x/len):[0,1,0];t=dir.map(x=>x*span*.65*amount);}
const g=grasp.get(p.id);if(g){const r=rotation(g.yaw,g.pitch),rc=mul(r,c);t=t.map((x,i)=>x+g.shift[i]+c[i]-rc[i]);transforms.set(p.id,{r,t});}else if(t.some(Boolean))transforms.set(p.id,{r:I,t});if(transforms.has(p.id))boxes.set(p.id,box(p,transforms.get(p.id)));}displayBounds={...bounds,min:[...bounds.min],max:[...bounds.max]};for(const b of boxes.values())for(let i=0;i<3;i++){displayBounds.min[i]=Math.min(displayBounds.min[i],b.min[i]);displayBounds.max[i]=Math.max(displayBounds.max[i],b.max[i]);}revision++;}
function setAmount(v){if(!Number.isFinite(v))return false;const n=clamp(v,0,1);if(n===amount)return false;amount=n;rebuild();return true;}
function setMode(v){if(!['explore','deconstruct','grasp'].includes(v))return false;if(mode!==v){checkpoint();mode=v;if(v!=='grasp')held=null;revision++;}return true;}
function setPattern(v){if(!['radial','axial','bilateral'].includes(v))return false;checkpoint();pattern=v;rebuild();return true;}
function setScope(id){if(id&&!ids.has(id))return false;checkpoint();scope=id||null;rebuild();return true;}
function grab(id){if(!ids.has(id))return false;checkpoint();mode='grasp';held=id;if(!grasp.has(id))grasp.set(id,{shift:[0,0,0],yaw:0,pitch:0});rebuild();return true;}
function adjustGrab(delta){if(!held||!grasp.has(held))return false;const g=grasp.get(held);let change=false;for(let i=0;i<3;i++){const v=delta.shift?.[i];if(Number.isFinite(v)&&v){g.shift[i]=clamp(g.shift[i]+v,-span*1.5,span*1.5);change=true;}}for(const k of ['yaw','pitch'])if(Number.isFinite(delta[k])&&delta[k]){g[k]=(g[k]+delta[k])%(Math.PI*2);change=true;}if(change)rebuild();return change;}
function release(){held=null;revision++;}
function reset(){amount=0;scope=null;held=null;grasp.clear();mode='explore';history=[];rebuild();}
function undo(){const s=history.pop();if(!s)return false;amount=s.amount;pattern=s.pattern;scope=s.scope;held=s.held;grasp=new Map(s.grasp);rebuild();return true;}
return Object.freeze({setMode,setAmount,setPattern,setScope,grab,adjustGrab,release,reset,undo,checkpoint,transform:id=>transforms.get(id)||identity,bounds:p=>boxes.get(p.id)||p,displayBounds:()=>displayBounds,span,report:()=>({amount,pattern,mode,scope,held,displaced:transforms.size,revision,history:history.length,transforms:[...transforms].map(([id,m])=>({id,r:[...m.r],t:[...m.t]}))})});}
root.BodyPlayground=Object.freeze({identity,point,ray,box,create});
})(globalThis);