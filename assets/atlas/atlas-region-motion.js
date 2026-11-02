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
const cached=new WeakMap();
function prepared(region,asset){
 if(cached.has(asset))return cached.get(asset);
 const parts=asset.parts||{},data={};
 if(region==='skull'){
  const jaw=parts.mandible?.vertices;
  if(!jaw)throw Error('Mandible source unavailable');
  const samples=vs=>vs.filter((_,i)=>i%Math.max(1,Math.ceil(vs.length/250))===0);
  const mandible=samples(jaw);
  const nearest=(id)=>{
   const temporal=samples(parts[id]?.vertices||[]);
   if(!temporal.length)throw Error('Temporal contact surface missing '+id);
   let best=Infinity,at=mandible[0];
   for(const j of mandible)for(const p of temporal){
    const d=(j[0]-p[0])**2+(j[1]-p[1])**2+(j[2]-p[2])**2;
    if(d<best){best=d;at=j;}
   }
   return at;
  };
  data.jawPivot=mean([nearest('left-temporal-bone'),nearest('right-temporal-bone')]);
 }else if(region==='neck'){
  const ids=['seventh-cervical-vertebra','sixth-cervical-vertebra','fifth-cervical-vertebra',
   'fourth-cervical-vertebra','third-cervical-vertebra','axis','atlas'];
  data.segments=ids.map(id=>({id,center:centroid(parts,id)}));
 }else if(region==='thorax'){
  data.ribs=Object.entries(parts).filter(([id])=>/rib$/.test(id)).map(([id,p])=>{
   const ps=p.vertices,ordered=[...ps].sort((a,b)=>Math.abs(a[0])-Math.abs(b[0]));
   return {id,side:id.startsWith('left-')?-1:1,
    pivot:mean(ordered.slice(0,Math.max(5,Math.floor(ps.length*.06))))};
  });
 }else if(region==='elbow')data.radiusPivot=upper(parts,'right-radius');
 else if(region==='wrist')data.wristPivot=centroid(parts,'right-lunate');
 else if(region==='ankle')data.heelPivot=centroid(parts,'right-calcaneus');
 cached.set(asset,data);return data;
}

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
 const geometry=prepared(region,asset);
 if(region==='skull'){
  // Bilateral estimated TMJ contact on the actual source temporal surfaces.
  // No source disc/sliding is present, therefore this is hinge-only.
  matrices.mandible=about(geometry.jawPivot,'x',-m);
 }else if(region==='neck'){
  // Hierarchical intervertebral rotation: upper bones follow the cumulative
  // transform of each lower neighbor, rather than orbiting a single C7 pivot.
  // Discs, muscle forces, vertebral contact and actual coupling remain unknown.
  let chain=I(),previous=geometry.segments[0];
  matrices[previous.id]=I();
  for(const current of geometry.segments.slice(1)){
   const pivot=mean([previous.center,current.center]);
   chain=mult(chain,mult(about(pivot,'y',s/6),about(pivot,'x',m/6)));
   matrices[current.id]=chain;
   previous=current;
  }
  if(parts['hyoid-bone'])matrices['hyoid-bone']=matrices['third-cervical-vertebra'];
 }else if(region==='thorax'){
  // Small, symmetric rib lift. Original source surfaces and sternum remain
  // unchanged; missing costal cartilage is not invented or stretched.
  for(const {id,side,pivot}of geometry.ribs)
   matrices[id]=about(pivot,'z',side*m*.65);
 }else if(region==='elbow'&&s){
  matrices['right-radius']=mult(matrices['right-radius'],about(geometry.radiusPivot,'y',s));
 }else if(region==='wrist'&&s){
  for(const id of Object.keys(parts))if(X.moving(region,id))
   matrices[id]=mult(matrices[id],about(geometry.wristPivot,'z',s));
 }else if(region==='ankle'&&s){
  for(const id of Object.keys(parts))if(X.moving(region,id)&&id!=='right-talus')
   matrices[id]=mult(matrices[id],about(geometry.heelPivot,'z',s));
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