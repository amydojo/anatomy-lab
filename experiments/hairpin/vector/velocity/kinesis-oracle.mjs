/* KINESIS offline configuration-space oracle. No live physics authorization.
 * All boxes contain their assigned indexed triangles by convexity. SAT checks
 * actual source triangles; outside parity is conditional on a valid closed solid.
 * Conservative envelope clearance is NOT full solid/real trajectory certification.
 */
const EPS=1e-8,add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>mul(a,1/Math.max(1e-30,len(a))),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),axis=[[1,0,0],[0,1,0],[0,0,1]],rays=[[.376,.831,.409],[-.643,.281,.713],[.763,-.517,.386]].map(unit);
const apply=(q,v)=>[0,1,2].map(k=>q.t[k]+q.r[k]*v[0]+q.r[k+3]*v[1]+q.r[k+6]*v[2]);
const inverse=(q,v)=>axis.map((_,k)=>dot(sub(v,q.t),q.r.slice(k*3,k*3+3)));
const tri=(p,i)=>[0,1,2].map(k=>Array.from(p.positions.slice(p.indices[i*3+k]*3,p.indices[i*3+k]*3+3)));
const box=t=>({lo:axis.map((_,k)=>Math.min(...t.map(v=>v[k]))),hi:axis.map((_,k)=>Math.max(...t.map(v=>v[k])))});
function merge(items){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const t of items)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],t.lo[k]);hi[k]=Math.max(hi[k],t.hi[k]);}return {lo,hi};}
const overlap=(a,b)=>axis.every((_,k)=>a.lo[k]<=b.hi[k]+EPS&&a.hi[k]>=b.lo[k]-EPS);
function tree(items,depth=Infinity,level=0){const q=merge(items);if(items.length<=12||level>=depth)return {...q,items,level};const spans=sub(q.hi,q.lo),k=spans.indexOf(Math.max(...spans));items.sort((a,b)=>a.lo[k]+a.hi[k]-b.lo[k]-b.hi[k]);const m=items.length>>1;return {...q,level,left:tree(items.slice(0,m),depth,level+1),right:tree(items.slice(m),depth,level+1)};}
export function triangleBox(t,h){
 for(let k=0;k<3;k++)if(Math.min(...t.map(v=>v[k]))>h[k]+EPS||Math.max(...t.map(v=>v[k]))<-h[k]-EPS)return false;
 const e=[sub(t[1],t[0]),sub(t[2],t[1]),sub(t[0],t[2])],axes=[cross(e[0],e[1]),...e.flatMap(v=>axis.map(a=>cross(v,a)))];
 for(const a of axes){const l=len(a);if(l<1e-14)continue;const r=dot(a.map(Math.abs),h)+EPS*l,v=t.map(p=>dot(a,p));if(Math.min(...v)>r||Math.max(...v)<-r)return false;}
 return true;
}
function rayBox(o,d,b){let a=0,z=Infinity;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-14){if(o[k]<b.lo[k]-EPS||o[k]>b.hi[k]+EPS)return false;continue;}let x=(b.lo[k]-o[k])/d[k],y=(b.hi[k]-o[k])/d[k];a=Math.max(a,Math.min(x,y));z=Math.min(z,Math.max(x,y));if(a>z)return false;}return true;}
function rayTri(o,d,t){const e=sub(t[1],t[0]),f=sub(t[2],t[0]),h=cross(d,f),det=dot(e,h);if(Math.abs(det)<1e-13)return null;const p=sub(o,t[0]),u=dot(p,h)/det;if(u< -1e-9||u>1+1e-9)return null;const q=cross(p,e),v=dot(d,q)/det;if(v< -1e-9||u+v>1+1e-9)return null;const z=dot(f,q)/det;if(z<=EPS)return null;return {ambiguous:Math.min(u,v,1-u-v)<EPS};}
function outside(root,o){for(const d of rays){let hits=0;const stack=[root];while(stack.length){const n=stack.pop();if(!rayBox(o,d,n))continue;if(n.left){stack.push(n.left,n.right);continue;}for(const x of n.items){const h=rayTri(o,d,x.t);if(h?.ambiguous)return false;if(h)hits++;}}if(hits%2)return false;}return true;}
function solidTopology(p){const ids=new Map(),map=new Int32Array(p.positions.length/3),edges=new Map();let next=0,degenerate=0;const parent=[],vertices=[];const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};const join=(x,y)=>{const a=find(x),b=find(y);if(a!==b)parent[b]=a;};
 for(let i=0;i<map.length;i++){const key=Array.from(p.positions.slice(i*3,i*3+3)).join(',');if(!ids.has(key)){ids.set(key,next);parent.push(next++);vertices.push(Array.from(p.positions.slice(i*3,i*3+3)));}map[i]=ids.get(key);}
 for(let i=0;i<p.indices.length;i+=3){const a=[map[p.indices[i]],map[p.indices[i+1]],map[p.indices[i+2]]];if(new Set(a).size!==3){degenerate++;continue;}join(a[0],a[1]);join(a[1],a[2]);for(let k=0;k<3;k++){const x=a[k],y=a[(k+1)%3],key=x<y?x+':'+y:y+':'+x,old=edges.get(key)||[0,0];old[0]++;old[1]+=x<y?1:-1;edges.set(key,old);}}
 let boundary=0,nonmanifold=0,inconsistent=0;for(const [n,s] of edges.values()){if(n===1)boundary++;else if(n!==2)nonmanifold++;else if(s!==0)inconsistent++;}
 const components=new Map();for(let k=0;k<next;k++){const q=find(k);if(!components.has(q))components.set(q,vertices[k]);}return {vertices:next,edges:edges.size,boundary,nonmanifold,inconsistent,degenerate,components:[...components.values()],closed:boundary+nonmanifold+inconsistent+degenerate===0};
}
function localTree(part){return tree(Array.from({length:part.indices.length/3},(_,i)=>{const t=tri(part,i);return {...box(t),t};}),5);}
function validPose(q){if(!q||q.r?.length!==9||q.t?.length!==3||![...q.r,...q.t].every(Number.isFinite))return false;const a=q.r.slice(0,3),b=q.r.slice(3,6),c=q.r.slice(6,9);return Math.abs(dot(a,cross(b,c))-1)<1e-6&&[a,b,c].every(v=>Math.abs(len(v)-1)<1e-6)&&Math.max(Math.abs(dot(a,b)),Math.abs(dot(a,c)),Math.abs(dot(b,c)))<1e-6;}
function rotationMid(a,b){const aa=[0,3,6].map(k=>a.r.slice(k,k+3)),bb=[0,3,6].map(k=>b.r.slice(k,k+3)),theta=Math.acos(clamp((aa.reduce((s,v,k)=>s+dot(v,bb[k]),0)-1)/2,-1,1)),w=aa.reduce((s,v,k)=>add(s,cross(v,bb[k])),[0,0,0]);if(theta>Math.PI-1e-5)return null;const k=unit(w),angle=theta/2,rot=v=>theta<1e-8?v.slice():add(add(mul(v,Math.cos(angle)),mul(cross(k,v),Math.sin(angle))),mul(k,dot(k,v)*(1-Math.cos(angle))));return {r:aa.flatMap(rot),t:mul(add(a.t,b.t),.5),theta};}
export function createConfigurationOracle(anatomy,parts,B){
 const topology=solidTopology(anatomy),root=tree(Array.from({length:anatomy.indices.length/3},(_,i)=>{const t=tri(anatomy,i);return {...box(t),t};})),local=parts.map(p=>({id:p.id,tree:localTree(p),topology:solidTopology(p),radius:Array.from({length:p.positions.length/3},(_,i)=>Math.hypot(...p.positions.slice(i*3,i*3+3))).reduce((a,b)=>Math.max(a,b),0)}));
 function check(entries,depth,inflate){let boxes=0,triangleTests=0;const start=performance.now();function result(clear,reason){return {clear,reason,boxes,triangleTests,cpuMs:performance.now()-start};}
  if(!topology.closed)return result(false,'source-topology-unqualified');if(local.some(p=>!p.topology.closed))return result(false,'vehicle-topology-unqualified');
  for(let i=0;i<local.length;i++){const q=entries[i];if(!validPose(q))return result(false,'invalid-transform');const stack=[local[i].tree];while(stack.length){const n=stack.pop(),mid=mul(add(n.lo,n.hi),.5),c=apply(q,mid),h=mul(sub(n.hi,n.lo),.5).map(x=>x+inflate[i]+1e-10),ext=axis.map((_,k)=>Math.abs(q.r[k])*h[0]+Math.abs(q.r[k+3])*h[1]+Math.abs(q.r[k+6])*h[2]),a={lo:sub(c,ext),hi:add(c,ext)},work=[root];let hit=false;boxes++;
    while(work.length&&!hit){const z=work.pop();if(!overlap(a,z))continue;if(z.left){work.push(z.left,z.right);continue;}for(const x of z.items){if(!overlap(a,x))continue;triangleTests++;if(triangleBox(x.t.map(v=>inverse({r:q.r,t:c},v)),h)){hit=true;break;}}}
    if(!hit){if(!outside(root,c))return result(false,'inside-or-ambiguous');continue;}
    if(!n.left||n.level>=depth)return result(false,'envelope-contact');
    stack.push(n.left,n.right);
   }
   // Reverse containment: a connected source component can lie entirely inside
   // a closed vehicle assembly without crossing its shell. When shell envelopes
   // are disjoint, a representative per exact-welded component is sufficient
   // under the conditional closed, non-self-intersecting solid assumption.
   for(const point of topology.components){const v=inverse(q,point),b=local[i].tree;if(axis.every((_,k)=>v[k]>=b.lo[k]-EPS&&v[k]<=b.hi[k]+EPS)&&!outside(b,v))return result(false,'reverse-containment-or-ambiguous');}
  }
  return result(true,'conditional-envelope-clear');
 }
 const entries=pose=>local.map(p=>B.transform(p.id,pose));
 return {topology,vehicleTopology:local.map(p=>({id:p.id,...p.topology})),pose(pose,depth=5,margin=0){return check(entries(pose),depth,local.map(()=>margin));},sweep(a,b,{depth=5,maxSub=3}={}){
  let intervals=0,unresolved=0,boxes=0,triangleTests=0,maxInflation=0;
  function visit(A,C,level){intervals++;const mid=[],inflate=[];for(let k=0;k<A.length;k++){if(!validPose(A[k])||!validPose(C[k])){unresolved++;return false;}const m=rotationMid(A[k],C[k]);if(!m){unresolved++;return false;}mid.push(m);const bound=len(sub(A[k].t,C[k].t))/2+2*local[k].radius*Math.sin(m.theta/4);inflate.push(bound);maxInflation=Math.max(maxInflation,bound);}
   const q=check(mid,depth,inflate);boxes+=q.boxes;triangleTests+=q.triangleTests;if(q.clear)return true;if(level>=maxSub){unresolved++;return false;}const first=visit(A,mid,level+1),second=visit(mid,C,level+1);return first&&second;
  }
  const clear=visit(entries(a),entries(b),0);return {clear,intervals,unresolved,boxes,triangleTests,maxInflation,contract:'independent assembly shortest rotation + linear translation only'};
 }};
}
export function commonCorrection(pose,pitch,roll,lift){
 const r=pose.r.slice(0,3),n=pose.r.slice(3,6),f=pose.r.slice(6,9),w=add(mul(r,pitch),mul(f,roll)),a=len(w),k=unit(w),rot=v=>a<1e-12?v.slice():add(add(mul(v,Math.cos(a)),mul(cross(k,v),Math.sin(a))),mul(k,dot(k,v)*(1-Math.cos(a)))),center=pose.t,shift=q=>({...q,r:[0,3,6].flatMap(i=>rot(q.r.slice(i,i+3))),t:add(add(center,rot(sub(q.t,center))),mul(n,lift))});
 const out=shift(pose);for(const key of ['front','rear','frontPod','rearPod'])if(pose[key])out[key]=shift(pose[key]);return out;
}
