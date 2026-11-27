/* Offline only: exact source triangles, fixed synchronized poses.
 * Strict transverse triangle surface crossings, not solid containment or
 * continuous swept collision. Near-coplanar/touching candidates are separate.
 * Sum of intersection segment lengths is a tessellation-dependent severity proxy.
 */
const EPS=1e-8,PARALLEL=1e-7;
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),mul=(a,s)=>a.map(v=>v*s);
const bounds=t=>({lo:[0,1,2].map(k=>Math.min(t[0][k],t[1][k],t[2][k])),hi:[0,1,2].map(k=>Math.max(t[0][k],t[1][k],t[2][k]))});
const overlap=(a,b)=>a.lo[0]<=b.hi[0]+EPS&&a.hi[0]>=b.lo[0]-EPS&&a.lo[1]<=b.hi[1]+EPS&&a.hi[1]>=b.lo[1]-EPS&&a.lo[2]<=b.hi[2]+EPS&&a.hi[2]>=b.lo[2]-EPS;
const straddle=d=>Math.min(...d)<-EPS&&Math.max(...d)>EPS;
const separated=d=>Math.min(...d)>EPS||Math.max(...d)<-EPS;
function interval(t,d,axis){let lo=Infinity,hi=-Infinity;for(let i=0;i<3;i++){const j=(i+1)%3;if(Math.abs(d[i])<=EPS){const s=dot(t[i],axis);lo=Math.min(lo,s);hi=Math.max(hi,s);}if(d[i]*d[j]<0){const u=d[i]/(d[i]-d[j]),s=dot(t[i],axis)*(1-u)+dot(t[j],axis)*u;lo=Math.min(lo,s);hi=Math.max(hi,s);}}return [lo,hi];}
export function crossing(a,b,na0=null,nb0=null){
 const na=na0||cross(sub(a[1],a[0]),sub(a[2],a[0])),nb=nb0||cross(sub(b[1],b[0]),sub(b[2],b[0])),la=len(na),lb=len(nb);
 if(la<1e-15||lb<1e-15)return {length:0,kind:'degenerate'};
 const x=mul(na,1/la),y=mul(nb,1/lb),da=a.map(v=>dot(sub(v,b[0]),y)),db=b.map(v=>dot(sub(v,a[0]),x));
 if(separated(da)||separated(db))return {length:0,kind:'disjoint'};
 const q=cross(x,y),l=len(q);
 if(l<PARALLEL)return {length:0,kind:'near-coplanar'};
 if(!straddle(da)||!straddle(db))return {length:0,kind:'boundary-candidate'};
 const axis=mul(q,1/l),aa=interval(a,da,axis),bb=interval(b,db,axis),length=Math.max(0,Math.min(aa[1],bb[1])-Math.max(aa[0],bb[0]));
 return {length:length>EPS?length:0,kind:length>EPS?'crossing':'disjoint'};
}
const triangle=(v,i,k)=>[0,1,2].map(j=>{const p=i[k*3+j]*3;return [v[p],v[p+1],v[p+2]];});
function tree(items){
 const box={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};
 for(const q of items)for(let k=0;k<3;k++){box.lo[k]=Math.min(box.lo[k],q.box.lo[k]);box.hi[k]=Math.max(box.hi[k],q.box.hi[k]);}
 if(items.length<=12)return {...box,items};
 const span=box.hi.map((v,k)=>v-box.lo[k]),axis=span.indexOf(Math.max(...span));items.sort((a,b)=>(a.box.lo[axis]+a.box.hi[axis])-(b.box.lo[axis]+b.box.hi[axis]));const mid=items.length>>1;
 return {...box,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
}
export function createIntersectionAudit(anatomy,parts,B){
 const items=Array.from({length:anatomy.indices.length/3},(_,k)=>{const t=triangle(anatomy.positions,anatomy.indices,k);return {t,box:bounds(t),n:cross(sub(t[1],t[0]),sub(t[2],t[0]))};}),root=tree(items);
 return {measure(pose){
  let pairs=0,segmentLength=0,maxSegment=0,nearCoplanar=0,boundaryCandidates=0,vehicleTriangles=0,candidates=0;const assemblies={};
  for(const part of parts){const q=B.transform(part.id,pose),v=new Float64Array(part.positions.length),p=part.positions,r=q.r,t=q.t;
   for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++)v[i+k]=t[k]+r[k]*p[i]+r[k+3]*p[i+1]+r[k+6]*p[i+2];
   const group={pairs:0,segmentLength:0,vehicleTriangles:0};
   for(let i=0;i<part.indices.length/3;i++){const a=triangle(v,part.indices,i),box=bounds(a);if(!overlap(box,root))continue;const na=cross(sub(a[1],a[0]),sub(a[2],a[0]));let touched=false;const stack=[root];
    while(stack.length){const n=stack.pop();if(!overlap(box,n))continue;if(n.left){stack.push(n.left,n.right);continue;}
     for(const b of n.items){if(!overlap(box,b.box))continue;candidates++;const q=crossing(a,b.t,na,b.n);if(q.kind==='near-coplanar')nearCoplanar++;if(q.kind==='boundary-candidate')boundaryCandidates++;if(q.length>0){pairs++;group.pairs++;segmentLength+=q.length;group.segmentLength+=q.length;maxSegment=Math.max(maxSegment,q.length);touched=true;}}
    }
    if(touched){vehicleTriangles++;group.vehicleTriangles++;}
   }assemblies[part.id]=group;
  }
  return {pairs,segmentLength,maxSegment,nearCoplanar,boundaryCandidates,vehicleTriangles,candidates,assemblies};
 }};
}
export function summarizeIntersections(rows){let run=0,longest=0;for(const x of rows){run=x.pairs>0?run+1:0;longest=Math.max(run,longest);}return {poses:rows.length,intersectingPoses:rows.filter(x=>x.pairs>0).length,sampledExposureSeconds:rows.filter(x=>x.pairs>0).length*.1,longestSampleRunSeconds:longest*.1,totalPairs:rows.reduce((s,x)=>s+x.pairs,0),maxPairs:Math.max(0,...rows.map(x=>x.pairs)),maxSegmentLength:Math.max(0,...rows.map(x=>x.segmentLength)),maxSingleSegment:Math.max(0,...rows.map(x=>x.maxSegment)),nearCoplanar:rows.reduce((s,x)=>s+x.nearCoplanar,0),boundaryCandidates:rows.reduce((s,x)=>s+x.boundaryCandidates,0)};}
