/* BODY / LIVE V8.2 · regional teaching kinematics.
 * Source geometry remains unchanged; each transform is an illustration.
 * No motion curve, muscle attachment or rotation center has clinical signoff.
 */
(function(){'use strict';
const X=window.BodyExtendedRegions;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:0));
const rad=Math.PI/180;
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function translation(v){const m=I();m[12]=v[0];m[13]=v[1];m[14]=v[2];return m;}
function spin(axis,degrees){const t=clamp(degrees,-180,180)*rad,c=Math.cos(t),s=Math.sin(t),m=I();
 if(axis==='x'){m[5]=c;m[6]=s;m[9]=-s;m[10]=c;}
 else if(axis==='y'){m[0]=c;m[2]=-s;m[8]=s;m[10]=c;}
 else if(axis==='z'){m[0]=c;m[1]=s;m[4]=-s;m[5]=c;}
 else throw Error('Unrecognized rotation axis');
 return m;
}
function about(p,axis,angle){return mult(mult(translation(p),spin(axis,angle)),translation(p.map(v=>-v)));}
const mean=vs=>[0,1,2].map(i=>vs.reduce((n,v)=>n+v[i],0)/vs.length);
const centroid=(parts,id)=>{const verts=parts[id]?.vertices;if(!verts?.length)throw Error('Source pivot bone missing '+id);
 const stride=Math.max(1,Math.ceil(verts.length/200));return mean(verts.filter((_,i)=>i%stride===0));};
const upper=(parts,id)=>{const ps=parts[id]?.vertices;if(!ps?.length)throw Error('Source hinge bone missing '+id);
 const top=Math.max(...ps.map(v=>v[1]));return mean(ps.filter(v=>v[1]>top-.11));};
const BOUNDS=Object.freeze({
 hip:{label:'Hip flexion',max:65,other:'Hip abduction / adduction',minSecondary:-25,maxSecondary:30},
 knee:{label:'Knee flexion',max:105,other:'Tibial rotation',minSecondary:-10,maxSecondary:10},
 shoulder:{label:'Shoulder elevation',max:110,other:'Humeral external / internal rotation',minSecondary:-35,maxSecondary:40},
 skull:{label:'Mandible opening',max:22},
 neck:{label:'Cervical flexion',max:22,other:'Cervical rotation',minSecondary:-25,maxSecondary:25},
 thorax:{label:'Inspiratory rib lift',max:9},
 elbow:{label:'Elbow flexion',max:130,other:'Forearm pronation / supination',minSecondary:-70,maxSecondary:70},
 wrist:{label:'Wrist flexion',max:65,other:'Radial / ulnar deviation',minSecondary:-20,maxSecondary:20},
 ankle:{label:'Ankle dorsiflexion',max:30,other:'Subtalar inversion / eversion',minSecondary:-18,maxSecondary:18},
 nerve:null
});
function profile(region){return BOUNDS[region]||null;}
function safe(region,primary,secondary){const p=profile(region);if(!p)return {primary:0,secondary:0};
 return {primary:clamp(primary,0,p.max),secondary:p.other?clamp(secondary,p.minSecondary,p.maxSecondary):0};}
function poseExtended(region,asset,primary=0,secondary=0){
 const data=safe(region,primary,secondary),parts=asset.parts||{};
 if(!X.has(region))throw Error('Unknown extended region');
 const base=X.createPose(region,asset,data.primary);
 const matrices={...base.matrices},m=data.primary,s=data.secondary;
 if(region==='skull'){
  // Condyles are high on the mandible; pivot is an estimated hinge line.
  matrices.mandible=about(upper(parts,'mandible'),'x',-m);
 }else if(region==='neck'){
  const pivot=centroid(parts,'seventh-cervical-vertebra');
  const weights={atlas:1,axis:.93,'third-cervical-vertebra':.83,'fourth-cervical-vertebra':.68,
   'fifth-cervical-vertebra':.49,'sixth-cervical-vertebra':.26,'seventh-cervical-vertebra':.06,'hyoid-bone':.66};
  for(const [id,w]of Object.entries(weights))if(parts[id]){
   matrices[id]=mult(about(pivot,'y',s*w),about(pivot,'x',m*w));
  }
 }else if(region==='thorax'){
  // Rib raising is a small bilateral rotation around near-spinal surface
  // landmarks. Cartilage, diaphragm mechanics and breathing volume are NOT modeled.
  for(const [id,p]of Object.entries(parts)){
   if(!/rib$/.test(id))continue;
   const side=id.startsWith('left-')?-1:1;
   const ps=p.vertices,ordered=[...ps].sort((a,b)=>Math.abs(a[0])-Math.abs(b[0]));
   const pivot=mean(ordered.slice(0,Math.max(5,Math.floor(ps.length*.06))));
   matrices[id]=about(pivot,'z',side*m*.65);
  }
 }else if(region==='elbow'&&s){
  const pivot=upper(parts,'right-radius');
  matrices['right-radius']=mult(matrices['right-radius'],about(pivot,'y',s));
 }else if(region==='wrist'&&s){
  const pivot=centroid(parts,'right-lunate');
  for(const id of Object.keys(parts))if(X.moving(region,id))
   matrices[id]=mult(matrices[id],about(pivot,'z',s));
 }else if(region==='ankle'&&s){
  const pivot=centroid(parts,'right-calcaneus');
  for(const id of Object.keys(parts))if(X.moving(region,id)&&id!=='right-talus')
   matrices[id]=mult(matrices[id],about(pivot,'z',s));
 }
 for(const [id,mat]of Object.entries(matrices))if(mat.length!==16||[...mat].some(n=>!Number.isFinite(n)))throw Error('Invalid teaching pose '+region+'/'+id);
 return {degrees:m,secondaryDegrees:s,matrices,validated:false,method:'regional-illustrative-unmeasured-kinematics'};
}
function poseLegacy(region,sourcePose,secondary=0){
 if(!['hip','knee','shoulder'].includes(region)||!sourcePose)return sourcePose;
 const s=safe(region,0,secondary).secondary;
 if(!s)return sourcePose;
 const matrices={...sourcePose.matrices};
 if(region==='hip'){
  const p=[-.057*5,(.895-.9)*5,-.045*5];
  matrices.femur=mult(about(p,'z',s),matrices.femur);
 }else if(region==='knee'){
  const p=[-.09092915*5,(.4491462+.08/7.5-.9)*5,-.01654605*5];
  for(const id of ['tibia','fibula','patella'])matrices[id]=mult(about(p,'y',s),matrices[id]);
 }else{
  const p=sourcePose.rest?.glenohumeral;
  if(!p)throw Error('No source shoulder GH marker');
  matrices.humerus=mult(matrices.humerus,about(p,'y',s));
 }
 return {...sourcePose,matrices,secondaryDegrees:s,validated:false};
}
function skin(region,id,vertices,parts){
 // These are inferred proximity weights, never anatomical insertion landmarks.
 // The source does not split its diaphragm/intercostal atlas into independently
 // verified rib-specific units; those surfaces remain in the reference pose.
 if(region==='thorax'&&/diaphragm|intercostal/.test(id))return null;
 const sample=a=>a.filter((_,i)=>i%Math.max(1,Math.ceil(a.length/100))===0);
 const center=mean(sample(vertices));
 let pair=null;
 if(region==='skull'){
  if(!/mylohyoid|geniohyoid/.test(id))return null;
  pair=['sphenoid-bone','mandible'];
 }else if(region==='neck')pair=['seventh-cervical-vertebra','atlas'];
 else if(region==='elbow'){
  // Pronator and supinator tissue acts at the radius; triceps/brachialis
  // approach the ulna. Muscle landmarks are inferred and NOT verified.
  pair=['right-humerus',/triceps|brachialis$/.test(id)?'right-ulna':'right-radius'];
 }else if(region==='wrist'){
  pair=[/flexor-carpi-ulnaris/.test(id)?'right-ulna':'right-radius',
   /pollicis|opponens|palmaris/.test(id)?'right-first-metacarpal-bone':'right-third-metacarpal-bone'];
 }else if(region==='ankle'){
  const distal=/fibularis/.test(id)?'right-fifth-metatarsal-bone':
   /tibialis-posterior/.test(id)?'navicular-bone-of-right-foot':
   /tibialis-anterior/.test(id)?'right-first-metatarsal-bone':
   /digitorum-brevis/.test(id)?'right-calcaneus':
   /hallucis|digitorum/.test(id)?'right-second-metatarsal-bone':
   'right-calcaneus';
  pair=[/fibularis/.test(id)?'right-fibula':'right-tibia',distal];
 }else if(region==='thorax'){
  const ribs=Object.entries(parts).filter(([k])=>/rib$/.test(k));
  ribs.sort((a,b)=>Math.hypot(...mean(sample(a[1].vertices)).map((v,i)=>v-center[i]))
                      -Math.hypot(...mean(sample(b[1].vertices)).map((v,i)=>v-center[i])));
  const rib=ribs[0]?.[0];
  const closestVertebra=Object.entries(parts).filter(([k])=>/thoracic-vertebra/.test(k))
   .sort((a,b)=>Math.abs(mean(sample(a[1].vertices))[1]-center[1])-
                 Math.abs(mean(sample(b[1].vertices))[1]-center[1]))[0]?.[0];
  if(!rib||!closestVertebra)return null;
  pair=[closestVertebra,rib];
 }else return null;
 const [fixedId,targetId]=pair;
 const fixed=parts[fixedId]?.vertices,moving=parts[targetId]?.vertices;
 if(!fixed?.length||!moving?.length)return null;
 const f=sample(fixed),t=sample(moving);
 const nearestSq=(p,vs)=>{let best=Infinity;for(const q of vs){
  const d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;
  if(d<best)best=d;
 }return best;};
 const weights=vertices.map(p=>{const a=Math.sqrt(nearestSq(p,f)),b=Math.sqrt(nearestSq(p,t)),
  v=clamp(a/Math.max(.00001,a+b),0,1);return v*v*(3-2*v);});
 return {fixedId,targetId,weights,method:'source-surface-proximity-inferred',validated:false};
}
window.BodyRegionMotion=Object.freeze({profile,safe,poseExtended,poseLegacy,skin,identity:I,about,multiply:mult,transform:X.transform});
})();