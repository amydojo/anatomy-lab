/* BODY / LIVE V6.9 · Right hip / knee attachment-guided teaching rig.
 * Sourced reference-pose meshes stay unchanged. Every attachment point is
 * inferred from source surface proximity, not independently validated.
 * Hip: origin on pelvis/sacrum, insertion on right femur.
 * Knee: fixed proximal femur, inferred insertion on patella/tibia/fibula.
 * Anatomy and kinematics are educational, not diagnostic.
 */
(function(){'use strict';
 const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const RULES={
  hip:{
   maximus:['hipBone','femur'],medius:['hipBone','femur'],
   minimus:['hipBone','femur'],piriformis:['sacrum','femur'],
   obturator:['hipBone','femur'],gemellusSuperior:['hipBone','femur'],
   gemellusInferior:['hipBone','femur'],quadratus:['hipBone','femur']
  },
  knee:{
   vastusMedialis:['femur','patella'],
   vastusLateralis:['femur','patella'],
   vastusIntermedius:['femur','patella'],
   popliteus:['femur','tibia'],
   bicepsShort:['femur','fibula']
  }
 };
 const PIVOTS={hip:[-.057*5,(.895-.9)*5,-.045*5],
 knee:[-.09092915*5,(.4491462+.08/7.5-.9)*5,-.01654605*5]};
 const dist2=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
 const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const sample=vertices=>{
  const skip=Math.max(1,Math.ceil(vertices.length/450)),points=[];
  for(let i=0;i<vertices.length;i+=skip)points.push(vertices[i]);
  return points;
 };
 const closest=(point,points)=>{
  let d=Infinity;for(const p of points)d=Math.min(d,dist2(point,p));return d;
 };
 function createSkin(region,id,vertices,parts){
  const [fixedId,targetId]=RULES[region]?.[id]||[];
  if(!fixedId||!targetId||!parts[fixedId]?.vertices||!parts[targetId]?.vertices)
   throw Error('Missing verified lower-limb attachment bones: '+region+'/'+id);
  if(vertices.length<35)throw Error('Incomplete sourced muscle: '+id);
  const fixed=sample(parts[fixedId].vertices),mobile=sample(parts[targetId].vertices);
  const pairs=vertices.map(p=>({p,a:closest(p,fixed),b:closest(p,mobile)}));
  const count=Math.max(5,Math.ceil(pairs.length*.08));
  const origin=[...pairs].sort((a,b)=>a.a-b.a).slice(0,count).sort((a,b)=>b.b-a.b)[0].p;
  const insertion=[...pairs].sort((a,b)=>a.b-b.b).slice(0,count).sort((a,b)=>b.a-a.a)[0].p;
  const axis=subtract(insertion,origin),length=dot(axis,axis);
  if(length<1e-6)throw Error('Indeterminate lower-limb attachment span: '+id);
  const smooth=t=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
  const weights=vertices.map(p=>smooth(dot(subtract(p,origin),axis)/length));
  if(Math.min(...weights)>.01||Math.max(...weights)<.99)throw Error('Incomplete muscle attachment gradient: '+id);
  return {id,region,fixedId,targetId,weights,origin:[...origin],insertion:[...insertion],
   method:'surface-proximity-inferred',validated:false};
 }
 function rotateX(pivot,degrees){
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const t=I(),px=pivot[0],py=pivot[1],pz=pivot[2];
  t[5]=c;t[6]=s;t[9]=-s;t[10]=c;
  t[13]=py-(c*py-s*pz);t[14]=pz-(s*py+c*pz);
  t[12]=0*px;
  return t;
 }
 function pose(region,degrees){
  if(!RULES[region])throw Error('Unknown lower limb: '+region);
  const angle=clamp(Number(degrees)||0,0,region==='hip'?65:105);
  const moving=rotateX(PIVOTS[region],angle);
  const matrices=region==='hip'?{hipBone:I(),sacrum:I(),femur:moving}:
   {femur:I(),tibia:moving,fibula:moving,patella:moving};
  return {region,angle,matrices,validated:false};
 }
 function transform(m,p){return [
  m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
  m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
  m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]
 ];}
 function deformPoint(v,originMatrix,targetMatrix,weight){
  const a=transform(originMatrix,v),b=transform(targetMatrix,v),w=clamp(weight,0,1);
  return a.map((n,i)=>n*(1-w)+b[i]*w);
 }
 window.BodyLowerLimbRig=Object.freeze({createSkin,pose,transform,deformPoint,
  rules:RULES,pivots:PIVOTS,identity:I});
})();