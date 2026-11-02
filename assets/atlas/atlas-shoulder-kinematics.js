/* BODY / LIVE V6.8 — reference-frame shoulder kinematic graph.
   This is a bounded educational model, NOT measured clinical kinematics.
   Coordinate system: pinned BodyParts3D 4.0, right shoulder, scene Y-up.
   Three connected rigid-body transforms; source vertex positions never change.
*/
(function(){'use strict';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const d2=(a,b)=>a.reduce((s,x,i)=>s+(x-b[i])**2,0);
const average=vs=>[0,1,2].map(i=>vs.reduce((v,p)=>v+p[i],0)/vs.length);
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b){
 const c=new Float32Array(16);
 for(let col=0;col<4;col++)for(let row=0;row<4;row++)
  for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];
 return c;
}
function translate(p){const m=I();m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
function rot(axis,rad){
 const c=Math.cos(rad),s=Math.sin(rad),m=I();
 if(axis==='z'){m[0]=c;m[1]=s;m[4]=-s;m[5]=c;}
 else if(axis==='x'){m[5]=c;m[6]=s;m[9]=-s;m[10]=c;}
 else if(axis==='y'){m[0]=c;m[2]=-s;m[8]=s;m[10]=c;}
 else throw Error('Unknown shoulder rotation axis');
 return m;
}
const chain=(...ms)=>ms.reduce((a,b)=>multiply(a,b),I());
const about=(pivot,...ms)=>chain(translate(pivot),...ms,translate(pivot.map(v=>-v)));
const transform=(m,p)=>[
 m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
 m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]
];
function interpolate(keys,t){
 const x=clamp(t,0,110);
 for(let i=1;i<keys.length;i++){
  const a=keys[i-1],b=keys[i];if(x>b[0])continue;
  const u=(x-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);
  return a[1]+(b[1]-a[1])*s;
 }
 return keys.at(-1)[1];
}
const TRACKS=Object.freeze({
 clavicleElevation:[[0,0],[30,2],[60,7],[90,12],[110,17]],
 scapulaUpward:[[0,0],[30,3],[60,12],[90,24],[110,33]],
 scapulaTilt:[[0,0],[30,1],[60,4],[90,10],[110,14]],
 scapulaExternal:[[0,0],[30,0.8],[60,2],[90,4],[110,5]]
});
function landmarks(parts){
 const cl=parts.clavicle?.vertices,sc=parts.scapula?.vertices,hu=parts.humerus?.vertices;
 if(!cl?.length||!sc?.length||!hu?.length)throw Error('Missing source shoulder girdle');
 // The most medial clavicular vertex approximates the SC center.
 const scPivot=cl.reduce((a,b)=>a[0]>b[0]?a:b);
 const distalCl=cl.reduce((a,b)=>a[0]<b[0]?a:b);
 // Closest scapular point to the acromial clavicular end: AC correspondence.
 const acromion=sc.reduce((a,b)=>d2(a,distalCl)<d2(b,distalCl)?a:b);
 // Proximal humeral head region near the scapular glenoid, not whole-bone
 // center of mass. The geometric estimate is exposed as unverified.
 const maxY=Math.max(...hu.map(v=>v[1]));
 const proximal=hu.filter(p=>p[1]>maxY-.25);
 const subset=sc.filter((_,i)=>i%9===0);
 const near=proximal.map(v=>({p:v,d:subset.reduce((m,s)=>Math.min(m,d2(v,s)),Infinity)}))
  .sort((a,b)=>a.d-b.d).slice(0,Math.max(15,Math.floor(proximal.length*.25)));
 if(near.length<10)throw Error('No proximal humerus/glenoid candidates');
 const gh=average(near.map(x=>x.p));
 for(const p of [scPivot,acromion,gh])if(p.some(v=>!Number.isFinite(v)))throw Error('Nonfinite shoulder landmark');
 return {sternoclavicular:[...scPivot],acromioclavicular:[...acromion],glenohumeral:gh};
}
function create(parts){
 const rest=landmarks(parts),identity=I();
 function pose(degrees){
  const elevation=clamp(Number(degrees)||0,0,110);
  const clavicleElevation=interpolate(TRACKS.clavicleElevation,elevation);
  const scapulaUpward=interpolate(TRACKS.scapulaUpward,elevation);
  const scapulaTilt=interpolate(TRACKS.scapulaTilt,elevation);
  const scapulaExternal=interpolate(TRACKS.scapulaExternal,elevation);
  const rad=Math.PI/180;
  const clavicle=about(rest.sternoclavicular,rot('z',-clavicleElevation*rad));
  const acMoved=transform(clavicle,rest.acromioclavicular);
  const scapula=chain(translate(acMoved),rot('z',-scapulaUpward*rad),
   rot('x',scapulaTilt*rad),rot('y',scapulaExternal*rad),
   translate(rest.acromioclavicular.map(x=>-x)));
  const ghMoved=transform(scapula,rest.glenohumeral);
  // The humerus follows the moving glenoid; its displayed global elevation
  // is the slider angle. Relative GH elevation is approximated, not a
  // constant scapulohumeral 2:1 ratio.
  const humerus=chain(translate(ghMoved),rot('z',-elevation*rad),
   translate(rest.glenohumeral.map(x=>-x)));
  return {elevation,degrees:{clavicleElevation,scapulaUpward,scapulaTilt,scapulaExternal,
   relativeGlenohumeral:elevation-scapulaUpward},
   matrices:{clavicle,scapula,humerus},
   markers:{sternoclavicular:rest.sternoclavicular,
    acromioclavicular:acMoved,glenohumeral:ghMoved},
   rest};
 }
 return Object.freeze({pose,rest,method:'geometric-landmarks-and-bounded-motion-curves',validated:false});
}
function deformPoint(p,parent,child,weight){
 const w=clamp(Number(weight)||0,0,1),a=transform(parent,p),b=transform(child,p);
 return add(a.map(v=>v*(1-w)),b.map(v=>v*w));
}
function boneMatrixFor(id,pose){
 if(!pose)return I();
 return pose.matrices[id]||I();
}
window.BodyShoulderKinematics=Object.freeze({
 create,transform,deformPoint,boneMatrixFor,identity:I,landmarks,tracks:TRACKS
});
})();