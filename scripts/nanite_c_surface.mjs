// Independent covering certificate, not meshoptimizer's error estimate.
const p3=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const sub=(a,b)=>a.map((x,k)=>x-b[k]),add=(a,b)=>a.map((x,k)=>x+b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0),d2=(a,b)=>dot(sub(a,b),sub(a,b));
// Independent exact point-to-triangle closest point (Voronoi-region tests).
function distance2(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2a=dot(ac,ap);
 const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 if(dot(cross,cross)<1e-28){const segment=(x,y)=>{const v=sub(y,x),n=dot(v,v),t=n?Math.max(0,Math.min(1,dot(sub(p,x),v)/n)):0;return d2(p,add(x,mul(v,t)));};return Math.min(segment(a,b),segment(b,c),segment(c,a));}
 if(d1<=0&&d2a<=0)return d2(p,a);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return d2(p,b);
 const vc=d1*d4-d3*d2a;if(vc<=0&&d1>=0&&d3<=0)return d2(p,add(a,mul(ab,d1/(d1-d3))));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return d2(p,c);
 const vb=d5*d2a-d1*d6;if(vb<=0&&d2a>=0&&d6<=0)return d2(p,add(a,mul(ac,d2a/(d2a-d6))));
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return d2(p,add(b,mul(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)))));
 const denom=va+vb+vc;if(!denom)return Math.min(d2(p,a),d2(p,b),d2(p,c));
 return d2(p,add(a,add(mul(ab,vb/denom),mul(ac,vc/denom))));
}
function tree(mesh){
 const {positions:p,indices:i}=mesh,n=i.length/3,lo=new Float32Array(n*3),hi=new Float32Array(n*3),center=new Float32Array(n*3);
 for(let f=0;f<n;f++)for(let k=0;k<3;k++){const a=p[i[f*3]*3+k],b=p[i[f*3+1]*3+k],c=p[i[f*3+2]*3+k];lo[f*3+k]=Math.min(a,b,c);hi[f*3+k]=Math.max(a,b,c);center[f*3+k]=(lo[f*3+k]+hi[f*3+k])/2;}
 function node(ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const f of ids)for(let k=0;k<3;k++){min[k]=Math.min(min[k],lo[f*3+k]);max[k]=Math.max(max[k],hi[f*3+k]);}
  if(ids.length<=12)return {min,max,ids};let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;
  ids.sort((a,b)=>center[a*3+axis]-center[b*3+axis]);const mid=ids.length>>1;return {min,max,left:node(ids.slice(0,mid)),right:node(ids.slice(mid))};
 }
 return node(Array.from({length:n},(_,i)=>i));
}
function nearestWitness(mesh,root,point){
 const box=n=>point.reduce((s,v,k)=>s+(v<n.min[k]?(n.min[k]-v)**2:v>n.max[k]?(v-n.max[k])**2:0),0);
 let best=Infinity,witness=-1;const visit=n=>{if(box(n)>best)return;if(n.ids){for(const f of n.ids){const i=mesh.indices,p=mesh.positions;const dist=distance2(point,p3(p,i[f*3]),p3(p,i[f*3+1]),p3(p,i[f*3+2]));if(dist<best){best=dist;witness=f;}}return;}
  const first=box(n.left)<=box(n.right)?n.left:n.right,second=first===n.left?n.right:n.left;visit(first);visit(second);};
 visit(root);return {distance:Math.sqrt(best),witness};
}
// Deterministic area-weighted triangle surface samples plus extreme vertices.
function samples(mesh,count=256){
 const p=mesh.positions,i=mesh.indices,cdf=new Float64Array(i.length/3);let area=0;
 for(let f=0;f<cdf.length;f++){const a=p3(p,i[f*3]),b=p3(p,i[f*3+1]),c=p3(p,i[f*3+2]),u=sub(b,a),v=sub(c,a);area+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;cdf[f]=area;}
 let seed=0x8c91cafe;const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 const points=[];
 for(let j=0;j<count;j++){const target=(j+rnd())/count*area;let lo=0,hi=cdf.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<target)lo=m+1;else hi=m;}const a=p3(p,i[lo*3]),b=p3(p,i[lo*3+1]),c=p3(p,i[lo*3+2]),u=Math.sqrt(rnd()),v=rnd();points.push(a.map((x,k)=>(1-u)*x+u*(1-v)*b[k]+u*v*c[k]));}
 for(let k=0;k<3;k++)for(const sign of [-1,1]){let best=0;for(let v=1;v<p.length/3;v++)if(sign*p[v*3+k]>sign*p[best*3+k])best=v;points.push(p3(p,best));}
 return points;
}
const summarize=a=>{if(!a.length||a.some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid independent distance measurement');a.sort((x,y)=>x-y);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))],maximum:a[a.length-1]};};

export {tree,samples,summarize};
export const nearest=(mesh,root,p)=>nearestWitness(mesh,root,p).distance;
// A convex target triangle contains the projections of all three corners.
// Distance to a convex set is convex: max corner distance bounds the entire
// source subtriangle. Subdivision covers ALL area, unlike sparse sampling.
// Normal orientation is independently required for every accepted witness.
export function certifyDirected(source,target,limit,{maxCells=2500000,maxDepth=9,targetTree=tree(target)}={}){
 let cells=0,leaves=0,maxUpper=0,maxObserved=0,depthReached=0,reason=null;
 const cross=(a,b,c)=>{const u=sub(b,a),v=sub(c,a);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
 const midpoint=(a,b)=>mul(add(a,b),.5);
 const t=target.indices,p=target.positions,s=source.indices,q=source.positions;
 // IEEE754 conservative engineering margin; not interval-arithmetic proof.
 const margin=1e-9*Math.max(1,limit,Math.abs(source.min?.[0]||0),Math.abs(source.max?.[0]||0));
 function visit(a,b,c,n,depth){
  if(++cells>maxCells){reason='cell-budget-exhausted';return false;}depthReached=Math.max(depthReached,depth);
  const center=mul(add(add(a,b),c),1/3),hit=nearestWitness(target,targetTree,center);maxObserved=Math.max(maxObserved,hit.distance);
  if(!Number.isFinite(hit.distance)||hit.witness<0){reason='numerical-defect';return false;}
  if(hit.distance>limit+margin){reason='observed-surface-error';return false;}
  const j=hit.witness*3,x=p3(p,t[j]),y=p3(p,t[j+1]),z=p3(p,t[j+2]),nn=cross(x,y,z);
  const upper=Math.sqrt(Math.max(distance2(a,x,y,z),distance2(b,x,y,z),distance2(c,x,y,z)))+margin;
  if(upper<=limit&&dot(n,nn)>0){leaves++;maxUpper=Math.max(maxUpper,upper);return true;}
  if(depth>=maxDepth){reason='unresolved-surface-or-orientation-bound';return false;}
  const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
  return visit(a,ab,ca,n,depth+1)&&visit(ab,b,bc,n,depth+1)&&visit(ca,bc,c,n,depth+1)&&visit(ab,bc,ca,n,depth+1);
 }
 for(let j=0;j<s.length;j+=3){const a=p3(q,s[j]),b=p3(q,s[j+1]),c=p3(q,s[j+2]),n=cross(a,b,c);if(!Math.hypot(...n)){reason='zero-source-normal';break;}if(!visit(a,b,c,n,0))break;}
 return {passed:!reason,cells,leaves,maxUpper:reason?null:maxUpper,maxObserved,depthReached,reason,margin};
}
