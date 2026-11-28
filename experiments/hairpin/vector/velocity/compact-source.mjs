/* Indexed exact source triangles. Only acceleration storage changes; no quantization
 * of source vertices. Float64 bounds enclose the original indexed coordinates. */
export function compactSource(part){
 const P=part.positions,I=part.indices,N=I.length/3,ids=Uint32Array.from({length:N},(_,i)=>i),bounds=new Float64Array(N*6),centers=new Float64Array(N*3);
 for(let i=0;i<N;i++)for(let k=0;k<3;k++){const a=P[I[i*3]*3+k],b=P[I[i*3+1]*3+k],c=P[I[i*3+2]*3+k],lo=Math.min(a,b,c),hi=Math.max(a,b,c);bounds[i*6+k]=lo;bounds[i*6+k+3]=hi;centers[i*3+k]=lo+hi;}
 const capacity=2*Math.ceil(N/6)+1,boxes=new Float64Array(capacity*6),links=new Int32Array(capacity*4);let count=0;
 function build(a,b){const j=count++;if(j>=capacity)throw Error('compact BVH capacity');const o=j*6,l=j*4;for(let k=0;k<3;k++){boxes[o+k]=Infinity;boxes[o+k+3]=-Infinity;}for(let i=a;i<b;i++){const t=ids[i]*6;for(let k=0;k<3;k++){boxes[o+k]=Math.min(boxes[o+k],bounds[t+k]);boxes[o+k+3]=Math.max(boxes[o+k+3],bounds[t+k+3]);}}links[l+2]=a;links[l+3]=b;links[l]=links[l+1]=-1;if(b-a<=12)return j;let axis=0;for(let k=1;k<3;k++)if(boxes[o+k+3]-boxes[o+k]>boxes[o+axis+3]-boxes[o+axis])axis=k;const m=(a+b)>>1;let low=a,high=b-1;while(low<high){const pivot=centers[ids[(low+high)>>1]*3+axis];let x=low,y=high;while(x<=y){while(centers[ids[x]*3+axis]<pivot)x++;while(centers[ids[y]*3+axis]>pivot)y--;if(x<=y){const q=ids[x];ids[x++]=ids[y];ids[y--]=q;}}if(m<=y)high=y;else if(m>=x)low=x;else break;}links[l]=build(a,m);links[l+1]=build(m,b);return j;}
 build(0,N);
 const tri=i=>[0,1,2].map(k=>{const j=I[i*3+k]*3;return [P[j],P[j+1],P[j+2]];});
 const overlap=(a,b,o)=>a.lo[0]<=b[o+3]+1e-8&&a.hi[0]>=b[o]-1e-8&&a.lo[1]<=b[o+4]+1e-8&&a.hi[1]>=b[o+1]-1e-8&&a.lo[2]<=b[o+5]+1e-8&&a.hi[2]>=b[o+2]-1e-8;
 function rayBounds(o,d,b,j,limit=Infinity){let a=0,z=limit;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-14){if(o[k]<b[j+k]-1e-8||o[k]>b[j+k+3]+1e-8)return false;continue;}let x=(b[j+k]-o[k])/d[k],y=(b[j+k+3]-o[k])/d[k];a=Math.max(a,Math.min(x,y));z=Math.min(z,Math.max(x,y));if(a>z)return false;}return true;}
 // Nearest-hit query for the same immutable, single-source coordinate frame.
 // At equal-distance facets normals are ambiguous: report ambiguity and use
 // the original MARROW query in the consumer rather than choose a new normal.
 function nearest(o,d,limit){const stack=[0];let best=null,t=limit,ambiguous=false;
  const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  while(stack.length){const j=stack.pop(),l=j*4;if(!rayBounds(o,d,boxes,j*6,t+1e-10))continue;if(links[l]>=0){stack.push(links[l],links[l+1]);continue;}for(let k=links[l+2];k<links[l+3];k++){const i=ids[k];if(!rayBounds(o,d,bounds,i*6,t+1e-10))continue;const [a,b,c]=tri(i),e=sub(b,a),f=sub(c,a),h=cross(d,f),det=dot(e,h);if(Math.abs(det)<1e-12)continue;const s=sub(o,a),u=dot(s,h)/det;if(u<0||u>1)continue;const q=cross(s,e),v=dot(d,q)/det;if(v<0||u+v>1)continue;const x=dot(f,q)/det;if(x<1e-7||x>limit||x>t+1e-10)continue;let n=cross(e,f),len=Math.hypot(...n);n=len>1e-9?n.map(v=>v*(1/len)):[0,1,0];if(dot(n,d)>0)n=n.map(v=>-v);if(best&&Math.abs(x-t)<=1e-10){ambiguous=true;if(x>=t)continue;}else ambiguous=false;t=x;best={distance:x,normal:n};}}
  return {hit:best,ambiguous};}
 return {nearest,nodes:count,bytes:ids.byteLength+bounds.byteLength+boxes.byteLength+links.byteLength,
  any(a,test){const stack=[0];while(stack.length){const j=stack.pop(),l=j*4;if(!overlap(a,boxes,j*6))continue;if(links[l]>=0){stack.push(links[l],links[l+1]);continue;}for(let k=links[l+2];k<links[l+3];k++){const i=ids[k];if(overlap(a,bounds,i*6)&&test(tri(i)))return true;}}return false;},
  outside(o,rays,rayTri){for(const d of rays){let hits=0;const stack=[0];while(stack.length){const j=stack.pop(),l=j*4;if(!rayBounds(o,d,boxes,j*6))continue;if(links[l]>=0){stack.push(links[l],links[l+1]);continue;}for(let k=links[l+2];k<links[l+3];k++){const h=rayTri(o,d,tri(ids[k]));if(h?.ambiguous)return false;if(h)hits++;}}if(hits%2)return false;}return true;}};
}
