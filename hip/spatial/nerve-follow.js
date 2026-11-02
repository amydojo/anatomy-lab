/* BODY / LIVE V5.5 — nerve-follow graph
   Source: the pinned Z-Anatomy-derived THREE isolated peripheral nerve meshes
   in sciatic-source.json. Traces are surface-sampled VISUAL estimates (not
   MR neurography or fascicle centerlines). Branch ancestry comes from source
   names, not proven physical continuity between atlas exports. License of
   DERIVED MODEL DATA: CC BY-SA 4.0, attributed in NERVE-ASSET-LICENSE.txt.
*/
(function(){
'use strict';
const SEGMENTS=['sciatic','tibial','commonFibular'];
const EPS=1e-9;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sortedPath(points,id){
 if(!Array.isArray(points)||points.length<6)throw Error('Insufficient sampled surface path: '+id);
 const pts=points.map(p=>{
  if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Invalid nerve path coordinate '+id);
  return p.slice();
 }).sort((a,b)=>b[1]-a[1]); // proximal to distal for a Y-up reference frame.
 const result=[pts[0]],cumulative=[0];
 for(let i=1;i<pts.length;i++){
  const delta=dist(pts[i],result.at(-1));
  if(delta<EPS)continue;
  cumulative.push(cumulative.at(-1)+delta);
  result.push(pts[i]);
 }
 const length=cumulative.at(-1);
 if(result.length<6||length<.25)throw Error('Degenerate nerve path '+id);
 // Ensures each interpolated coordinate remains on the piecewise source-derived
 // path. We do not smooth outside this approximate surface-sampled centre.
 const at=u=>{
  const s=clamp(Number(u)||0,0,1)*length;
  let low=0,hi=cumulative.length-1;
  while(hi-low>1){let mid=(low+hi)>>1;if(cumulative[mid]<s)low=mid;else hi=mid;}
  const gap=cumulative[hi]-cumulative[low],f=gap<EPS?0:(s-cumulative[low])/gap;
  const a=result[low],b=result[hi];
  return a.map((v,j)=>v+(b[j]-v)*f);
 };
 return {id,points:result,cumulative,length,at,proximal:result[0],distal:result.at(-1)};
}
function components(mesh){
 const n=mesh.vertices.length;
 if(!n||n>250000||mesh.faces.length>600000)throw Error('Unexpected nerve topology size');
 const adjacency=Array.from({length:n},()=>[]);
 const referenced=new Uint8Array(n);
 for(const tri of mesh.faces){
  if(!Array.isArray(tri)||tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=n))throw Error('Invalid mesh indices');
  for(let j=0;j<3;j++){
   const a=tri[j],b=tri[(j+1)%3];adjacency[a].push(b);adjacency[b].push(a);referenced[a]=1;referenced[b]=1;
  }
 }
 const visited=new Uint8Array(n),sizes=[];
 for(let i=0;i<n;i++){
  if(!referenced[i]||visited[i])continue;
  const queue=[i];visited[i]=1;let count=0;
  for(let pos=0;pos<queue.length;pos++){
   const v=queue[pos];count++;
   for(const nb of adjacency[v])if(!visited[nb]){visited[nb]=1;queue.push(nb);}
  }
  sizes.push(count);
 }
 if(!sizes.length)throw Error('Unconnected nerve surface');
 return {count:sizes.length,sizes:sizes.sort((a,b)=>b-a),unreferenced:n-referenced.reduce((a,b)=>a+b,0)};
}
function create(source){
 if(source?.schema!=='body-live/nerve-truth-atlas-v1'||source.geometry_license!=='CC BY-SA 4.0')throw Error('Invalid nerve source');
 if(!source.not_patient_specific||source.clinical_reviewed!==false)throw Error('Misleading clinical source');
 const parents={sciatic:null,tibial:'sciatic',commonFibular:'sciatic'};
 const branches={},topology={};
 for(const id of SEGMENTS){
  const m=source.segments?.[id];
  if(!m||!Array.isArray(m.vertices)||!Array.isArray(m.faces))throw Error('Missing source geometry '+id);
  branches[id]=sortedPath(m.tracePoints_derived_not_measured,id);
  topology[id]=components(m);
 }
 const junctions={};
 for(const id of ['tibial','commonFibular']){
  const parent=branches.sciatic,child=branches[id];
  const gap=dist(parent.distal,child.proximal);
  const hasGap=gap>.1; // .1 hip scene unit = approx. 1 cm.
  junctions[id]={from:'sciatic',to:id,sourceGap:gap,
   kind:hasGap?'unverified-gap':'closely-aligned-estimate',
   fromPoint:parent.distal,toPoint:child.proximal,
   displayedAsContinuousSource:false,
   guidance:hasGap?'The atlas surfaces do not meet at this sampled junction. The transition is inferred, not imaged.':'Sampled endpoints are close; continuity is not anatomically reviewed.'};
 }
 function sample(id,progress){if(!branches[id])throw Error('Unknown branch '+id);return branches[id].at(progress);}
 return Object.freeze({
  version:'5.5',kind:'source-derived-surface-sampled-spatial-graph',
  segments:SEGMENTS.slice(),parents,topology,junctions,branches,
  sample,graphStructureVerified:true,
  origin:'Z-Anatomy atlas surfaces; registered to BodyParts3D 4.0; distinct reference models',
  geometryValidated:false,anatomistReviewed:false,imagingDerived:false
 });
}
window.BodyNerveFollow=Object.freeze({create,sortedPath,components,dist});
})();