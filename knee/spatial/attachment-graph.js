/* BODY / LIVE — Knee attachment and landmark graph V5.2
   Sourced bone geometry, UNREVIEWED approximate landmark placements.
   All tissue paths are educational guide geometry, not digitized entheses.
   No force, tissue strain, cartilage contact or diagnostic calculations.
*/
(function(){
'use strict';
const vec=(x,y,z)=>({x,y,z});
const midpoint=(a,b,t=.5)=>vec(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
const boneToPhase={femur:'static',tibia:'tibiofemoral',fibula:'tibiofemoral',patella:'patellar-guide'};
const points=[
{id:'acl.femur',bone:'femur',uvw:[.56,.025,.43],description:'ACL femoral footprint — estimated region'},
{id:'acl.tibia',bone:'tibia',uvw:[.51,.97,.73],description:'ACL tibial footprint — estimated region'},
{id:'pcl.femur',bone:'femur',uvw:[.43,.035,.59],description:'PCL femoral footprint — estimated region'},
{id:'pcl.tibia',bone:'tibia',uvw:[.48,.96,.30],description:'PCL tibial footprint — estimated region'},
{id:'mcl.femur',bone:'femur',uvw:[.96,.075,.49],description:'Medial distal femoral region — estimated'},
{id:'mcl.tibia',bone:'tibia',uvw:[.92,.85,.52],description:'Medial proximal tibial region — estimated'},
{id:'lcl.femur',bone:'femur',uvw:[.10,.065,.46],description:'Lateral distal femoral region — estimated'},
{id:'lcl.fibula',bone:'fibula',uvw:[.45,.98,.48],description:'Fibular head region — estimated'},
{id:'patella.superior',bone:'patella',uvw:[.48,.90,.75],description:'Superior patellar region — estimated'},
{id:'patella.inferior',bone:'patella',uvw:[.49,.08,.75],description:'Inferior patellar region — estimated'},
{id:'quadriceps.guide',bone:'femur',uvw:[.50,.23,.93],description:'Upper extensor-path visual guide, NOT quadriceps origin'},
{id:'tuberosity.tibia',bone:'tibia',uvw:[.51,.83,.99],description:'Tibial tuberosity region — estimated'},
{id:'meniscus.lateral',bone:'tibia',uvw:[.30,.995,.52],description:'Lateral meniscus display centre — illustrative'},
{id:'meniscus.medial',bone:'tibia',uvw:[.74,.995,.52],description:'Medial meniscus display centre — illustrative'}
];
const links={
 acl:{id:'acl',label:'ACL',from:'acl.femur',to:'acl.tibia',kind:'ligament',radius:.018,description:'Femoral and tibial insertion regions (estimated).'},
 pcl:{id:'pcl',label:'PCL',from:'pcl.femur',to:'pcl.tibia',kind:'ligament',radius:.023,description:'Crossing femoral–tibial relationship (estimated).'},
 mcl:{id:'mcl',label:'Medial collateral ligament',from:'mcl.femur',to:'mcl.tibia',kind:'ligament',radius:.018,description:'Medial side stabilizing connection (estimated).'},
 lcl:{id:'lcl',label:'Lateral collateral ligament',from:'lcl.femur',to:'lcl.fibula',kind:'ligament',radius:.018,description:'Lateral femoral-to-fibular connection (estimated).'},
 quadriceps:{id:'quadriceps',label:'Quadriceps tendon guide',from:'quadriceps.guide',to:'patella.superior',kind:'tendon',radius:.029,description:'Schematic extensor path; femoral guide is NOT a quadriceps muscle origin.'},
 patellar:{id:'patellar',label:'Patellar ligament',from:'patella.inferior',to:'tuberosity.tibia',kind:'tendon',radius:.027,description:'Patellar–tibial relationship (estimated).'}
};
function check(meshes){
 for(const bone of Object.keys(boneToPhase)){
  if(!meshes?.[bone]?.verts?.length)throw Error('Missing bone: '+bone);
  if(!meshes[bone].verts.every(v=>[v.x,v.y,v.z].every(Number.isFinite)))throw Error('Non-finite source bone: '+bone);
 }
}
function bounds(verts){
 const lo=vec(Infinity,Infinity,Infinity),hi=vec(-Infinity,-Infinity,-Infinity);
 for(const p of verts){for(const axis of ['x','y','z']){lo[axis]=Math.min(lo[axis],p[axis]);hi[axis]=Math.max(hi[axis],p[axis]);}}
 return {lo,hi};
}
function make(meshes){
 check(meshes);
 const bb=Object.fromEntries(Object.entries(meshes).map(([k,m])=>[k,bounds(m.verts)]));
 const anchors={};
 for(const spec of points){
  const b=bb[spec.bone];
  const x=vec(...['x','y','z'].map((axis,i)=>b.lo[axis]+(b.hi[axis]-b.lo[axis])*spec.uvw[i]));
  let closest=null,d=Infinity,index=-1;
  meshes[spec.bone].verts.forEach((point,i)=>{
   const sq=(point.x-x.x)**2+(point.y-x.y)**2+(point.z-x.z)**2;
   if(sq<d){d=sq;closest=point;index=i;}
  });
  anchors[spec.id]={
   ...spec,base:vec(closest.x,closest.y,closest.z),sourceIndex:index,
   surfaceDistance:Math.sqrt(d),status:'estimated/unreviewed',
   method:'nearest-vertex-to-normalized-region'
  };
 }
 const relation=id=>links[id]||null;
 const attachedTo=bone=>Object.values(links).filter(l=>anchors[l.from].bone===bone||anchors[l.to].bone===bone);
 function transform(bone,p,angle){
  if(!boneToPhase[bone])throw Error('Unknown bone '+bone);
  if(boneToPhase[bone]==='tibiofemoral'){
   const theta=angle*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
   const dy=p.y-.08;return vec(p.x,.08+dy*c-p.z*s,dy*s+p.z*c);
  }
  if(boneToPhase[bone]==='patellar-guide'){
   const t=angle*Math.PI/180;
   return vec(p.x,p.y+.11*Math.sin(t),p.z+.04*Math.sin(t));
  }
  return vec(p.x,p.y,p.z);
 }
 function at(id,angle){
  const anchor=anchors[id];if(!anchor)throw Error('Unknown landmark '+id);
  return transform(anchor.bone,anchor.base,angle);
 }
 function guide(id,angle){
  const l=relation(id);if(!l)throw Error('Unknown tissue '+id);
  const a=at(l.from,angle),b=at(l.to,angle);
  const c=midpoint(a,b,.5);
  // Slight bend for a readable ligament tube, not anatomical fiber tracking.
  if(id==='acl')c.z+=.025;
  if(id==='pcl')c.z-=.025;
  return {id,from:a,to:b,vertices:[a,c,b],radius:l.radius,link:l};
 }
 return {bounds:bb,anchors,links,at,transform,guide,attachedTo};
}
window.KneeAttachmentGraph=Object.freeze({
 version:'5.2',landmarkDefinitions:points,connections:links,boneToPhase,
 create:make
});
})();