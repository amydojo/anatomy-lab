/* V6.7 · Attachment-guided, exploratory shoulder muscle skinning.
 * The 3D surfaces come from pinned BodyParts3D, but the attachment
 * correspondence is inferred from surface proximity, NOT anatomist-approved
 * tendon landmarks or a biomechanical simulation. Fixed origins stay attached
 * to the source scapula/clavicle; insertion-side vertices follow humeral
 * abduction through a smooth bounded rotation gradient. No synthetic tissue.
 */
(function(){'use strict';
 const SOURCE_BONES=Object.freeze({
  supraspinatus:'scapula',infraspinatus:'scapula',subscapularis:'scapula',
  teresMinor:'scapula',teresMajor:'scapula',
  deltoidClavicular:'clavicle',deltoidSpinal:'scapula',
  bicepsLong:'scapula',bicepsShort:'scapula',
  coracobrachialis:'scapula',pectoralisClavicular:'clavicle'
 });
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const smooth=t=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
 const dist2=(p,q)=>{const x=p[0]-q[0],y=p[1]-q[1],z=p[2]-q[2];return x*x+y*y+z*z;};
 const sub=(p,q)=>p.map((v,i)=>v-q[i]);
 const dot=(p,q)=>p.reduce((sum,v,i)=>sum+v*q[i],0);
 const sample=verts=>{
  const step=Math.max(1,Math.ceil(verts.length/420)),out=[];
  for(let i=0;i<verts.length;i+=step)out.push(verts[i]);
  return out;
 };
 const nearestSq=(p,points)=>{
  let best=Infinity;
  for(let i=0;i<points.length;i++){const d=dist2(p,points[i]);if(d<best)best=d;}
  return best;
 };
 function anchors(verts,fixed,moving){
  if(!verts.length||!fixed.length||!moving.length)throw Error('Incomplete muscle rig source');
  const fv=sample(fixed),mv=sample(moving);
  const distances=verts.map(p=>({p,f:nearestSq(p,fv),m:nearestSq(p,mv)}));
  const count=Math.max(6,Math.ceil(verts.length*.08));
  // Choose an origin close to its named bone *and* remote from the other
  // bone, so overlapping shoulder joint surfaces cannot collapse the rig.
  const origin=[...distances].sort((a,b)=>a.f-b.f).slice(0,count).sort((a,b)=>b.m-a.m)[0].p;
  const insertion=[...distances].sort((a,b)=>a.m-b.m).slice(0,count).sort((a,b)=>b.f-a.f)[0].p;
  const axis=sub(insertion,origin),extent=dot(axis,axis);
  if(!(extent>1e-5))throw Error('Degenerate shoulder inferred attachments');
  return {origin:[...origin],insertion:[...insertion],extent};
 }
 function createSkin(muscleId,verts,parts){
  const fixedId=SOURCE_BONES[muscleId];
  if(!fixedId)throw Error('Unknown source shoulder muscle '+muscleId);
  const info=anchors(verts,parts[fixedId].vertices,parts.humerus.vertices);
  const axis=sub(info.insertion,info.origin);
  // Endpoint-preserving smooth quaternion-style weighted rotation. This avoids
  // linear-blend bone collapse but is *not* a volume-preserving muscle solver.
  const weights=verts.map(p=>smooth(dot(sub(p,info.origin),axis)/info.extent));
  if(weights.some(w=>!Number.isFinite(w)||w<0||w>1))throw Error('Unbounded attachment weights');
  if(Math.max(...weights)<.98||Math.min(...weights)>.02)throw Error('Rig did not span both anatomical attachments');
  return {muscleId,fixedId,origin:info.origin,insertion:info.insertion,weights,method:'proximity-inferred-attachment-gradient',validated:false};
 }
 function deformVertex(point,weight,pivot,degrees){
  const a=-Number(degrees)*Math.PI/180*clamp(Number(weight)||0,0,1),c=Math.cos(a),s=Math.sin(a);
  const x=point[0]-pivot[0],y=point[1]-pivot[1];
  return [pivot[0]+x*c-y*s,pivot[1]+x*s+y*c,point[2]];
 }
 window.BodyShoulderRig=Object.freeze({createSkin,deformVertex,sourceBones:SOURCE_BONES});
})();