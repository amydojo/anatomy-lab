/* BODY / LIVE V5.5 — source-matched Hip/Knee coordinate bridge.
   This establishes frame correspondence ONLY, not verified sciatic nerve
   position or clinically validated anatomy. Source is BodyParts3D 4.0.
*/
(function(){
'use strict';
const H={origin:[-.057,.895,-.045],scale:10};
const K={origin:[-.09092915,.4491462,-.01654605],scale:7.5};
const map=(p,a,b)=>p.map((v,i)=>((v/a.scale)+a.origin[i]-b.origin[i])*b.scale);
const kneeToHip=p=>map(p,K,H);
const hipToKnee=p=>map(p,H,K);
function verify(hipSource,kneeSource){
 if(hipSource?.source_commit!==kneeSource?.upstream_commit)throw Error('Hip/Knee source release mismatch');
 const a=hipSource.parts?.femur?.vertices,b=kneeSource.bone_meshes?.femur?.vertices;
 if(!a||!b||a.length!==b.length||a.length<250)throw Error('No corresponding femoral mesh');
 let sq=0,max=0;
 for(let i=0;i<a.length;i++){
  const mapped=kneeToHip(b[i]);
  const e=Math.hypot(...mapped.map((x,j)=>x-a[i][j]));
  sq+=e*e;max=Math.max(max,e);
 }
 return {matchedVertices:a.length,rmsSceneUnits:Math.sqrt(sq/a.length),maximumSceneUnits:max,
  verifiedWithinSourceRounding:max<.00005,
  nature:'Shared BodyParts3D 4.0 femur vertices, independent scene translations/scales',
  establishesNervePlacement:false,anatomistReviewed:false};
}
window.BodyHipKneeBridge=Object.freeze({hipFrame:H,kneeFrame:K,kneeToHip,hipToKnee,verify});
})();