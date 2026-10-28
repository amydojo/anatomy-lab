/* V6 evidence categories are independent of graphical rendering. */
(function(){'use strict';
const INTRO={overview:{title:'Sourced overview',origin:'Source-derived skeletal context',note:'One BodyParts3D 4.0 reference release. Simplified bone surfaces; not a patient scan, complete anatomy or anatomist-reviewed reconstruction.'},hip:{title:'Right Hip',origin:'Sourced bones and muscles',note:'BodyParts3D 4.0 meshes use one reference frame. Joint pivot, muscle responses and movement remain illustrative and unreviewed.'},nerve:{title:'Sciatic nerve',origin:'Registered atlas composite',note:'Z-Anatomy source-derived nerve surface registered against a different BodyParts3D femur. Not medical imaging, not same validated donor, and not an independently validated nerve course.'},knee:{title:'Right Knee',origin:'Sourced reference bones',note:'Hip and Knee femur reference frames correspond, but ligaments, insertions and movement approximations require qualified review. The nerve is not reconstructed continuously into the Knee scene.'},shoulder:{title:'Right Shoulder',origin:'Sourced bones and four rotator-cuff muscles',note:'Scapula, clavicle, humerus and rotator-cuff meshes use the same pinned BodyParts3D source coordinates. Deltoid, tendon, labrum, ligament and nerves are not comprehensively reconstructed. Movement uses an estimated pivot and is not anatomist-reviewed.'}};
function records(region,manifest,hip,nerve,shoulder){
 const item=INTRO[region]||INTRO.overview;
 const output=[{title:item.title,label:item.origin,content:item.note,tag:'UNREVIEWED'}];
 if(!region||region==='overview'){
  output.push({title:'Original skeletal dataset',label:'BodyParts3D 4.0 · CC BY 4.0',
   content:manifest?manifest.part_count+' sourced LOD skeletal components; '+manifest.lod_triangle_count.toLocaleString()+' triangles. Source release pinned; missing hands/feet and some anatomy acknowledged.':'Skeletal overview data unavailable. Semantic region navigation remains usable.',tag:'SOURCE REFERENCE'});
 }
 if(region==='hip'||region==='nerve'){
  output.push({title:'Hip source geometry',label:'BodyParts3D 4.0 · CC BY 4.0',
   content:hip?'Anatomist reviewed: '+(hip.anatomist_reviewed?'yes':'NO')+'. Uniform source coordinates and multiple tissue reference surfaces.':'Original Hip source manifest is loading or unavailable.',tag:'SOURCE GEOMETRY'});
 }
 if(region==='nerve'){
  const fit=nerve?.registration?.fit;
  output.push({title:'Registered nerve',label:'Z-Anatomy derivative · CC BY-SA 4.0',
   content:fit?'Automated right-femur fit: median '+(fit.median_scene_units*100).toFixed(1)+' mm, P95 '+(fit.p95_scene_units*100).toFixed(1)+' mm. These are FEMUR surface residuals, NOT measured nerve-position errors.':'Nerve source information unavailable.',tag:'COMPOSITE / NOT SAME DONOR'});
  output.push({title:'Derived nerve path',label:'Source-derived visual estimate',
   content:'The Follow line is ordered from surface samples with arc-length interpolation, not MRI-derived nerve centerlines. The branch junctions have measured sample gaps. Unverified portions are not biological continuity.',tag:'SAMPLED PATH'});
 }
 if(region==='shoulder'){
  const models=shoulder?.models||{};
  const found=['scapula','clavicle','humerus','supraspinatus','infraspinatus','subscapularis','teresMinor'].filter(k=>!!models[k]);
  output.push({title:'Sourced shoulder mesh set',label:'BodyParts3D 4.0 · CC BY 4.0',
   content:found.length===7?'Three real shoulder bones and all four rotator-cuff muscles have source-model records. Additional muscles appear only when present in the pinned source.':'Detailed provenance not available. The shoulder remains educational and must not be treated as verified.',tag:'SOURCE / UNREVIEWED'});
  output.push({title:'Missing structures',label:'No invented anatomy',
   content:'Unverified deltoid coverage, shoulder capsule/ligaments, glenoid labrum, long-head biceps tendon, brachial plexus and axillary/suprascapular nerves are not displayed as sourced anatomy.',tag:'UNAVAILABLE'});
  output.push({title:'Illustrative abduction',label:'Educational single pivot',
   content:'A humerus movement demonstrates an approximate axis. The scapula and source-pose muscles do not undergo validated scapulohumeral rhythm or tissue deformation.',tag:'NOT CLINICALLY VALIDATED'});
 }
 if(region==='knee')output.push({title:'Frame correspondence',label:'BodyParts3D 4.0 source frame',content:'480 corresponding femur vertices align under the fixed Hip/Knee coordinate transform within rounding. This validates skeletal coordinates only, not sciatic positioning or nerve continuity.',tag:'SHARED REFERENCE'});
 return output;
}
const visual=kind=>({'sourced-surface':'solid','registered-composite':'offset-seam','source-derived-estimate':'dashed','illustrative':'faint','unavailable':'hidden'}[kind]||'hidden');
window.BodyAtlasEvidence=Object.freeze({records,originVisual:visual,INTRO});
})();