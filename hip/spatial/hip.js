/* BODY / LIVE V5.3 — HIP / SPATIAL
 * Sourced BodyParts3D 4.0 muscles and bones are reference-pose geometry.
 * Hip motion uses an estimated fixed pivot, NOT validated joint kinematics.
 * Sciatic nerve is an illustrative schematic route, NOT an imported mesh.
 * Shared projection and touch orbit from /assets/spatial-core.js.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('hip-canvas'),ctx=canvas.getContext('2d',{alpha:true});
const core=window.BodySpatialCore;
if(!ctx||!core){$('asset-status').textContent='RENDERER UNAVAILABLE';return;}
const V=(x=0,y=0,z=0)=>({x,y,z}), lerp=(a,b,t)=>V(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return V(a.x/n,a.y/n,a.z/n)};
const clamp=core.clamp;
const DATA={
 hipBone:{name:'Right hip bone',class:'Sourced bone',summary:'The fused ilium, ischium and pubis form the right acetabulum, a deep socket for the femoral head.',fact:'A socket increases joint stability while still allowing movement in multiple planes.'},
 femur:{name:'Right femur',class:'Sourced bone',summary:'The femoral head articulates with the acetabulum. Its neck and shaft transmit load from the hip into the leg.',fact:'The model rotates around an estimated ball-and-socket centre, not a measured joint centre.'},
 sacrum:{name:'Sacrum',class:'Sourced bone',summary:'The sacrum anchors the posterior pelvic ring between the hip bones.',fact:'The sacroiliac joints help transmit forces between the spine and pelvis.'},
 maximus:{name:'Gluteus maximus',class:'Sourced muscle',summary:'A broad superficial muscle that powers hip extension and helps control the femur and trunk.',fact:'Its breadth is why peeling this muscle reveals much of the deep gluteal region.'},
 medius:{name:'Gluteus medius',class:'Sourced muscle',summary:'A lateral gluteal muscle that abducts the hip and helps steady the pelvis during single-leg stance.',fact:'When standing on one leg, the stance-side abductors help oppose pelvic drop on the unsupported side.'},
 minimus:{name:'Gluteus minimus',class:'Sourced muscle',summary:'The deepest major gluteal abductor, close to the outer surface of the ilium.',fact:'Its deep position lets it contribute to hip stability alongside gluteus medius.'},
 piriformis:{name:'Piriformis',class:'Sourced muscle',summary:'A small deep rotator running from the anterior sacrum toward the greater trochanter.',fact:'The sciatic nerve most commonly travels inferior to piriformis, but anatomical variations exist.'},
 obturator:{name:'Obturator internus',class:'Sourced muscle',summary:'A deep external rotator whose tendon turns around the lesser sciatic notch toward the greater trochanter.',fact:'Deep rotators help maintain femoral-head positioning rather than acting as simple hinge motors.'},
 gemellusSuperior:{name:'Superior gemellus',class:'Sourced muscle',summary:'A small deep muscle adjacent to obturator internus and associated with hip external rotation.',fact:'Its compact location is easier to understand when the more superficial gluteals are peeled away.'},
 gemellusInferior:{name:'Inferior gemellus',class:'Sourced muscle',summary:'A small deep rotator below obturator internus.',fact:'Together these closely placed muscles help control the hip in multiple positions.'},
 quadratus:{name:'Quadratus femoris',class:'Sourced muscle',summary:'A deep, flat muscle between the ischial region and upper femur.',fact:'Its short orientation gives an intuitive picture of a deep hip rotator.'},
 sciatic:{name:'Sciatic nerve',class:'Atlas nerve surface',summary:'Source-derived right sciatic nerve registered to a separately sourced pelvis. Mixed-reference composite, NOT patient imaging.',fact:'The atlas-derived sciatic surface continues into named tibial and common fibular branches; the registration is unreviewed.'},
 tibial:{name:'Tibial nerve',class:'Atlas branch',summary:'Source-derived right tibial continuation. Position is a registered mixed-source composite.',fact:'Anatomical branch paths vary between individuals.'},
 commonFibular:{name:'Common fibular nerve',class:'Atlas branch',summary:'Source-derived right common fibular continuation, not patient imaging.',fact:'The atlas depicts typical anatomy, not validated placement against this pelvis.'}
};
const BONES=['hipBone','femur','sacrum'];
const DEEP=['piriformis','obturator','gemellusSuperior','gemellusInferior','quadratus'];
const NERVES=['sciatic','tibial','commonFibular'];
const SYSTEMS=[...BONES,'maximus','medius','minimus',...DEEP,...NERVES];
const COLOR={hipBone:'#dbccb2',femur:'#e6d9bd',sacrum:'#c7b598',maximus:'#ae635c',medius:'#d18b78',
 minimus:'#c98779',piriformis:'#ed9b7e',obturator:'#ba8274',gemellusSuperior:'#c18d78',
 gemellusInferior:'#c88d76',quadratus:'#b67f6d',sciatic:'#f0d68d',tibial:'#dbbb75',commonFibular:'#f4ce95'};
const state={yaw:Math.PI+.28,pitch:-.11,zoom:1.08,frameSpan:4.5,width:0,height:0,dpr:1,depth:0,focus:'joint',
 axis:'flexion',pose:{flexion:0,abduction:0,rotation:0},selected:null,isolate:false,trace:false,
 expanded:false,playing:false,frame:0,prev:0,dir:1,sourceLoaded:false,sourceLabel:'LOADING'};
const lesson={phase:'idle',guess:null,oldDepth:0,oldAxis:'flexion'};
let meshes=null,nerveMeshes=[],nerveTruth=null,nerveGraph=null,nerveAssetError='',nerveEvidenceOpen=false,rendering=false,hits=[];
let hipSourceData=null,bridgeEvidence=null;
let atlasTravelMix=1; // source-frame travel: bones first, then sourced muscles and nerve overlays
const follow={active:false,branch:'sciatic',progress:0,frame:'composite',savedZoom:1.08,raf:0};
function toLocal(x,y,z){const o=[-.057,.895,-.045],s=10;return V((x-o[0])*s,(y-o[1])*s,(z-o[2])*s);}
const routeSource=[[-.039,.949,-.088],[-.066,.918,-.091],[-.082,.891,-.099],[-.098,.843,-.104],[-.108,.792,-.097],[-.114,.733,-.084]];
const nervePoints=routeSource.map(p=>toLocal(...p));
function transformFemur(p){
 // Sequential educational Euler axes around estimated femoral head; source geometry is rigid.
 // X flexion, Z abduction, Y axial rotation. No contact or collision simulation.
 const f=state.pose.flexion*Math.PI/180,a=state.pose.abduction*Math.PI/180,r=state.pose.rotation*Math.PI/180;
 const cf=Math.cos(f),sf=Math.sin(f),ca=Math.cos(a),sa=Math.sin(a),cr=Math.cos(r),sr=Math.sin(r);
 const y=p.y*cf-p.z*sf,z=p.y*sf+p.z*cf;
 const x2=p.x*ca-y*sa,y2=p.x*sa+y*ca;
 return V(x2*cr+z*sr,y2,-x2*sr+z*cr);
}
const GUIDE_TUBE_SEGMENTS=7;
function tube(id,points,radius=.026){
 const verts=[],faces=[];if(points.length<2)return null;
 for(let i=0;i<points.length;i++){
  const t=norm(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]));
  const side=norm(cross(t,Math.abs(t.y)<.9?V(0,1,0):V(1,0,0)));
  const up=norm(cross(t,side));
  for(let k=0;k<GUIDE_TUBE_SEGMENTS;k++){
   const th=k/GUIDE_TUBE_SEGMENTS*2*Math.PI;
   verts.push(V(points[i].x+radius*(side.x*Math.cos(th)+up.x*Math.sin(th)),
     points[i].y+radius*(side.y*Math.cos(th)+up.y*Math.sin(th)),
     points[i].z+radius*(side.z*Math.cos(th)+up.z*Math.sin(th))));
  }
 }
 for(let i=0;i<points.length-1;i++)for(let k=0;k<GUIDE_TUBE_SEGMENTS;k++){
  const a=i*GUIDE_TUBE_SEGMENTS+k,b=i*GUIDE_TUBE_SEGMENTS+(k+1)%GUIDE_TUBE_SEGMENTS;
  faces.push([a,a+GUIDE_TUBE_SEGMENTS,b],[b,a+GUIDE_TUBE_SEGMENTS,b+GUIDE_TUBE_SEGMENTS]);
 }
 return {id,verts,faces};
}
function fallback(){
 // Clear, original geometry only while source loading fails. Not represented as sourced.
 const ellipse=(id,c,rx,ry,rz)=>{
  const verts=[],faces=[],lat=12,lon=15;
  for(let j=0;j<=lat;j++)for(let i=0;i<=lon;i++){
   const t=j*Math.PI/lat,ph=i*2*Math.PI/lon;
   verts.push(V(c.x+rx*Math.sin(t)*Math.cos(ph),c.y+ry*Math.cos(t),c.z+rz*Math.sin(t)*Math.sin(ph)));
  }
  for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){const a=j*(lon+1)+i,b=a+lon+1;faces.push([a,a+1,b],[a+1,b+1,b]);}
  return {id,verts,faces};
 };
 return [ellipse('hipBone',V(-.2,.25,0),.85,1.1,.68),ellipse('femur',V(-.40,-1.3,.10),.3,1.6,.28),
   ellipse('sacrum',V(0,.2,-.22),.30,.7,.25),ellipse('maximus',V(-.45,-.05,-.35),.55,.8,.25)];
}
function alphaFor(id){
 if(follow.frame==='atlas'&&nerveTruth&&!NERVES.includes(id))return 0;
 const layer=state.depth;
 const visible={
   hipBone:true,femur:true,sacrum:true,
   maximus:layer===0,
   medius:layer<=1,
   minimus:layer<=2&&layer>=1,
   piriformis:layer>=2&&layer<=3,
   obturator:layer>=2&&layer<=3,
   gemellusSuperior:layer>=2&&layer<=3,
   gemellusInferior:layer>=2&&layer<=3,
   quadratus:layer>=2&&layer<=3,
   sciatic:layer===3||state.trace,
   tibial:layer===3||state.trace,
   commonFibular:layer===3||state.trace
 };
 if(!visible[id])return 0;
 let opacity=BONES.includes(id)?(layer===4?.95:.4):NERVES.includes(id)?1:.92;
 if(id==='maximus'&&layer===0)opacity=.75;
 if(id==='medius'&&layer===1)opacity=.9;
 if(layer===2&&id==='minimus')opacity=.24;
 // Reference-pose muscle geometry is NOT deformed with femur motion.
 const moving=Object.values(state.pose).some(x=>Math.abs(x)>2);
 if(moving&&!BONES.includes(id)&&!NERVES.includes(id))opacity*=.4;
 if(state.selected&&state.selected!==id)opacity*=state.isolate?.12:.45;
 if(state.selected===id)opacity=Math.min(1,opacity+.07);
 if(state.trace&&NERVES.includes(id))opacity=1;
 if(atlasTravelMix<1){
  opacity=BONES.includes(id)?opacity*atlasTravelMix+.95*(1-atlasTravelMix):opacity*atlasTravelMix;
 }
 if(follow.active&&!NERVES.includes(id))opacity*=id==='piriformis'?.35:BONES.includes(id)?.23:.12;
 return opacity;
}
function shade(hex,b){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return 'rgb('+rgb.map(v=>Math.round(clamp(v*b,0,255))).join(',')+')';}
function inTriangle(x,y,c){
 const [a,b,d]=c;
 const den=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);
 if(Math.abs(den)<.00001)return false;
 const u=((b.y-d.y)*(x-d.x)+(d.x-b.x)*(y-d.y))/den;
 const v=((d.y-a.y)*(x-d.x)+(a.x-d.x)*(y-d.y))/den;
 return u>=0&&v>=0&&(u+v)<=1;
}
let cachedGuide=null;
function getGuide(){return cachedGuide||(cachedGuide=tube('sciatic',nervePoints,.030));}
function protectFollowMarker(){
 // Adaptive mobile camera anchor: short WebKit viewports can put the tracked
 // marker underneath the on-stage Follow card. Read real geometry, not guessed
 // viewport percentages, and leave large-screen compositions unchanged.
 if(!follow.active||window.innerWidth>850)return;
 const panel=$('follow-stage'),stage=canvas.getBoundingClientRect();
 if(panel.hidden||stage.height<1)return;
 const safeTop=panel.getBoundingClientRect().top-stage.top-34;
 if(!Number.isFinite(safeTop)||safeTop<0)return;
 state.anchorY=Math.min(.29,Math.max(.065,safeTop/stage.height));
}
function draw(){
 if(rendering)return;
 rendering=true;
 try{
 const w=state.width,h=state.height;if(!w||!h)return;
 protectFollowMarker();
 ctx.clearRect(0,0,w,h);
 const candidates=[];
 const source=(follow.frame==='atlas'&&nerveTruth?[]:(meshes||fallback()))
   .concat(follow.frame==='atlas'&&nerveTruth?nerveMeshes.map(m=>({...m,verts:m.verts.map(unregisterPoint)})):nerveMeshes);
 for(const m of source){
  if(m.id==='sciatic'&&!nerveTruth)continue;
  const a=alphaFor(m.id);if(a<=0)continue;
  const verts=m.id==='femur'?m.verts.map(transformFemur):m.verts;
  const pp=verts.map(v=>core.project(v,state));
  for(const face of m.faces){
   const v=[pp[face[0]],pp[face[1]],pp[face[2]]];
   if(v.some(x=>!x))continue;
   const n=norm(cross(sub(v[1].world,v[0].world),sub(v[2].world,v[0].world)));
   const light=.59+.37*Math.abs(dot(n,norm(V(.32,.62,1))));
   candidates.push({id:m.id,pts:v,opacity:a,depth:(v[0].z+v[1].z+v[2].z)/3,color:shade(COLOR[m.id],light)});
  }
 }
 if((state.depth===3 || state.trace)&&!nerveTruth){
  const g=getGuide();
  const pts=g.verts.map(v=>core.project(v,state));
  for(const f of g.faces){const v=[pts[f[0]],pts[f[1]],pts[f[2]]];
   candidates.push({id:'sciatic',pts:v,opacity:alphaFor('sciatic')||.85,depth:(v[0].z+v[1].z+v[2].z)/3,color:COLOR.sciatic});
  }
 }
 candidates.sort((a,b)=>a.depth-b.depth);
 const selections=[];
 for(const c of candidates){
  ctx.beginPath();ctx.moveTo(c.pts[0].x,c.pts[0].y);ctx.lineTo(c.pts[1].x,c.pts[1].y);ctx.lineTo(c.pts[2].x,c.pts[2].y);ctx.closePath();
  ctx.fillStyle=c.color;ctx.globalAlpha=c.opacity;ctx.fill();
  if(state.selected===c.id){ctx.lineWidth=.5;ctx.strokeStyle='#ffeac7';ctx.globalAlpha=.35;ctx.stroke();}
  selections.push(c);
 }
 ctx.globalAlpha=1;hits=selections;
 if(state.trace){
  ctx.lineWidth=2.5;ctx.strokeStyle='#f0d283';ctx.globalAlpha=.95;
  const sourceTrace=nerveTruth?.segments?.[state.selected]||nerveTruth?.segments?.sciatic;
  const pts=nerveGraph?nerveGraph.branches[(NERVES.includes(state.selected)?state.selected:'sciatic')].points.map(p=>V(...toDisplayPoint(p)))
   :nerveTruth?sourceTrace.tracePoints_derived_not_measured.map(p=>V(...p)):nervePoints;
  ctx.beginPath();pts.map(p=>core.project(p,state)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  ctx.globalAlpha=1;
 }
 if(follow.active&&nerveGraph){
  const p=toDisplayPoint(nerveGraph.sample(follow.branch,follow.progress));
  const pt=core.project(V(...p),state);
  ctx.save();ctx.globalAlpha=1;ctx.lineWidth=2.2;ctx.strokeStyle='#ffdaa1';
  ctx.fillStyle='#261a13';ctx.beginPath();ctx.arc(pt.x,pt.y,8,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f9e2b4';ctx.beginPath();ctx.arc(pt.x,pt.y,3.1,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 }finally{rendering=false;}
}
function setExpanded(v){
 state.expanded=!!v;const panel=$('hip-inspector');
 panel.dataset.expanded=String(v);$('inspector-toggle').setAttribute('aria-expanded',String(v));
 $('inspector-toggle').querySelector('.grab-icon').textContent=v?'⌄':'⌃';
 requestAnimationFrame(resize);
}


function unregisterPoint(p){
 if(!nerveTruth)return p;
 const R=nerveTruth.registration.rotation,t=nerveTruth.registration.translation;
 const q=[p.x-t[0],p.y-t[1],p.z-t[2]];
 return V(
  q[0]*R[0][0]+q[1]*R[0][1]+q[2]*R[0][2],
  q[0]*R[1][0]+q[1]*R[1][1]+q[2]*R[1][2],
  q[0]*R[2][0]+q[1]*R[2][1]+q[2]*R[2][2]
 );
}
function toDisplayPoint(p){
 const point=Array.isArray(p)?V(...p):p;
 const q=follow.frame==='atlas'?unregisterPoint(point):point;
 return [q.x,q.y,q.z];
}
function renderFollow(){
 const panel=$('follow-stage');panel.hidden=!follow.active;
 if(!follow.active||!nerveGraph)return;
 $('follow-branch').value=follow.branch;
 $('follow-mode-label').textContent=follow.frame==='atlas'?'ATLAS SOURCE':'REGISTERED COMPOSITE';
 const route=nerveGraph.branches[follow.branch];
 $('follow-progress').value=Math.round(follow.progress*100);
 $('follow-distance').textContent='≈'+Math.round(route.length*follow.progress*100)+' mm';
 $('follow-percent').textContent=Math.round(follow.progress*100)+'%';
 const join=nerveGraph.junctions[follow.branch];
 $('follow-path-note').textContent=join
  ?'UNVERIFIED branch junction gap ≈'+(join.sourceGap*100).toFixed(0)+' mm · no source connecting surface'
  :'Surface-sampled visual centreline, not MRI';
}
function moveFollowCamera(smooth){
 if(!follow.active||!nerveGraph)return;
 const dest=V(...toDisplayPoint(nerveGraph.sample(follow.branch,follow.progress)));
 if(follow.raf)cancelAnimationFrame(follow.raf);
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(!smooth||reduced||!state.target){state.target=dest;draw();return;}
 const start=V(state.target.x,state.target.y,state.target.z);
 let first=null;
 const frame=time=>{
  if(!follow.active)return;
  if(first===null)first=time;
  const u=Math.min(1,(time-first)/220),e=u*u*(3-2*u);
  state.target=V(start.x+(dest.x-start.x)*e,start.y+(dest.y-start.y)*e,start.z+(dest.z-start.z)*e);
  draw();
  if(u<1)follow.raf=requestAnimationFrame(frame);else follow.raf=0;
 };
 follow.raf=requestAnimationFrame(frame);
}
function setFollowProgress(next){
 if(!follow.active||!nerveGraph)return;
 follow.progress=clamp(Number(next)/100,0,1);
 renderFollow();moveFollowCamera(false);
}
function startFollow(id='sciatic'){
 if(!nerveGraph||!NERVES.includes(id))return false;
 if(!follow.active)follow.savedZoom=state.zoom;
 follow.active=true;follow.branch=id;follow.progress=0;
 state.selected=id;state.trace=true;state.depth=3;
 state.zoom=window.innerWidth<=850?1.25:1.4;
 state.anchorY=window.innerWidth<=850?.29:.42;
 state.frameSpan=window.innerWidth<=850?3.35:4.5;
 syncDepth();renderFollow();moveFollowCamera(false);
 if(window.innerWidth<=850)setExpanded(false);
 inspector();draw();return true;
}
function stopFollow(){
 follow.active=false;if(follow.raf)cancelAnimationFrame(follow.raf);follow.raf=0;
 state.target=follow.frame==='atlas'&&nerveGraph?V(...toDisplayPoint(nerveGraph.sample(follow.branch,.35))):null;
 state.zoom=follow.savedZoom;state.anchorY=.5;renderFollow();inspector();draw();
}
function setNerveFrame(frame){
 if(!nerveTruth||!['atlas','composite'].includes(frame))return;
 follow.frame=frame;
 if(follow.active)moveFollowCamera(false);
 else state.target=frame==='atlas'&&nerveGraph?V(...toDisplayPoint(nerveGraph.sample(NERVES.includes(state.selected)?state.selected:'sciatic',.35))):null;
 renderFollow();inspector();draw();
}
async function checkBridge(){
 if(!hipSourceData||!window.BodyHipKneeBridge)return;
 try{
  const r=await fetch('/knee/spatial/assets/bp3d-right-knee-4.0.json',{cache:'force-cache'});
  if(!r.ok)throw Error('Knee source unavailable');
  bridgeEvidence=window.BodyHipKneeBridge.verify(hipSourceData,await r.json());
  if(!bridgeEvidence.verifiedWithinSourceRounding)throw Error('Hip/Knee correspondence beyond source rounding');
  if(nerveEvidenceOpen)renderNerveEvidence();
 }catch(err){
  bridgeEvidence=null;
  console.warn('Hip/Knee source bridge:',err.message);
  if(nerveEvidenceOpen)renderNerveEvidence();
 }
}

function renderNerveEvidence(){
 const panel=$('nerve-evidence'),btn=$('nerve-evidence-toggle');
 if(!panel||!btn)return;
 btn.hidden=!nerveTruth&&!NERVES.includes(state.selected);
 btn.setAttribute('aria-expanded',String(nerveEvidenceOpen));
 if(!nerveEvidenceOpen){panel.hidden=true;panel.replaceChildren();return;}
 panel.hidden=false;
 const f=nerveTruth?.registration?.fit;
 const metrics=f
  ?'<div class="nerve-measures"><div><strong>'+(f.median_scene_units*100).toFixed(1)+' mm</strong><small>Femur fit · median</small></div><div><strong>'+(f.p95_scene_units*100).toFixed(1)+' mm</strong><small>Femur fit · 95th percentile</small></div></div>'
  :'<p>Source unavailable. Schematic fallback active.</p>';
 panel.innerHTML='<div class="eyebrow">PROVENANCE / UNCERTAINTY</div><h2>Registered composite, not patient imaging.</h2>'+
  '<p>Atlas nerve: Z-Anatomy (CC BY-SA 4.0). Surrounding hip: BodyParts3D 4.0 (CC BY 4.0). Source releases or donors are not established as identical.</p>'+
  metrics+
  '<p>These geometric discrepancies are from the <strong>femur surface</strong> alignment; they are NOT errors measured against a verified nerve, nor accuracy guarantees.</p>'+
  '<p>Medical imaging and 2026 sciatic micro-CT microstructure are not included. Expert registration and anatomical placement review remain pending.</p>'+
  '<p class="bridge-check">'+(bridgeEvidence?.verifiedWithinSourceRounding
   ?'HIP ↔ KNEE FRAME VERIFIED: '+bridgeEvidence.matchedVertices+' matching femoral vertices after shared-source transform, within rounding. This does not validate the nerve. '
   :'Hip ↔ Knee frame correspondence is not verified; do not infer nerve continuation into Knee. ')+
   '<a href="/knee/spatial/">Open knee skeleton (nerve not reconstructed there) ↗</a></p>'+
  '<a href="/hip/spatial/sources/">Detailed source audit ↗</a> · <a href="/hip/spatial/assets/sciatic-provenance.json">Machine-readable registration evidence ↗</a>';
}
async function loadNerveTruth(){
 try{
  const res=await fetch('/hip/spatial/assets/sciatic-source.json',{cache:'force-cache'});
  if(!res.ok)throw Error('Nerve source unavailable ('+res.status+')');
  const d=await res.json();
  if(d.schema!=='body-live/nerve-truth-atlas-v1'||d.geometry_license!=='CC BY-SA 4.0'||d.clinical_reviewed!==false||d.not_patient_specific!==true)
   throw Error('Unexpected source schema, license or review flag');
  if(!NERVES.every(id=>d.segments?.[id]))throw Error('Missing sciatic nerve segment');
  const next=[];
  for(const id of NERVES){
   const m=d.segments[id];
   if(m.vertices.length<100||m.faces.length<40)throw Error('Incomplete nerve mesh '+id);
   const verts=m.vertices.map(p=>V(p[0],p[1],p[2]));
   if(verts.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('Nonfinite vertices');
   if(m.faces.some(f=>f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=verts.length)))throw Error('Invalid faces');
   next.push({id,verts,faces:m.faces});
  }
  nerveGraph=window.BodyNerveFollow.create(d);
  nerveMeshes=next;nerveTruth=d;
  checkBridge();
  $('asset-status').textContent='SOURCED BONES + MUSCLES · REGISTERED NERVE COMPOSITE';
  document.querySelectorAll('[data-part]').forEach(b=>{
   if(NERVES.includes(b.dataset.part))b.querySelector('.structure-status').textContent='Z-ATLAS';
  });
  inspector();draw();
 }catch(e){
  nerveMeshes=[];nerveTruth=null;nerveGraph=null;nerveAssetError=e.message;
  document.querySelectorAll('[data-part]').forEach(b=>{
   if(NERVES.includes(b.dataset.part))b.querySelector('.structure-status').textContent='SCHEMATIC';
  });
  inspector();draw();
  console.warn('HIP / NERVE TRUTH:',e.message);
 }
}

function inspector(){
 const obj=state.selected?DATA[state.selected]:null;
 $('selected-short').textContent=obj?obj.name:'Inside the right hip';
 $('inspector-title').textContent=obj?obj.name:'A ball-and-socket laboratory.';
 $('structure-intro').textContent=obj?obj.summary:'Peel the gluteal layers to see how the pelvis, femur, and deep rotators occupy the same space. Move the femur in three axes.';
 $('structure-type').textContent=obj?(NERVES.includes(state.selected)
 ?(nerveTruth?'Z-ANATOMY SOURCE SURFACE · REGISTERED COMPOSITE':'SCHEMATIC NERVE · SOURCE UNAVAILABLE')
 :(state.sourceLoaded?'BODYPARTS3D 4.0 · REFERENCE POSE':'SCHEMATIC · NOT SOURCED')):'SOURCED STRUCTURES · SIMPLIFIED MOTION';
 $('anatomy-fact').querySelector('p').textContent=obj?obj.fact:'The femoral head moves within the acetabulum. This educational model uses a fixed estimated pivot, not personalized joint mechanics.';
 $('isolate').disabled=!obj;$('isolate').setAttribute('aria-pressed',String(state.isolate));
 $('nerve-follow').hidden=!NERVES.includes(state.selected)&&state.depth!==3;
 $('nerve-follow').setAttribute('aria-pressed',String(follow.active));
 $('nerve-follow').textContent=follow.active?'Exit Follow':'Follow nerve';
 $('nerve-follow').disabled=!!nerveTruth&&!nerveGraph;
 $('nerve-frames').hidden=!nerveTruth||(!state.trace&&!follow.active);
 document.querySelectorAll('[data-nerve-frame]').forEach(b=>b.setAttribute('aria-pressed',String(follow.frame===b.dataset.nerveFrame)));
 $('nerve-frame-note').textContent=follow.frame==='atlas'
  ?'Unregistered Z-Anatomy nerve surface alone. Hip structures are hidden because they are a different reference.'
  :'Source nerve transformed onto BodyParts3D hip. Mixed-source composite; not verified in situ.';
 $('nerve-info').hidden=!state.trace;
 if(state.trace)$('nerve-info').innerHTML=nerveTruth
 ?'<div class="eyebrow">Z-ANATOMY · SOURCE-DERIVED SURFACE</div><p>The imported nerve is a separate atlas source. The gold line is estimated from surface slices, NOT an MRI centreline.</p><div class="nerve-actions"><button data-nerve="sciatic">Sciatic trunk</button><button data-nerve="tibial">Tibial</button><button data-nerve="commonFibular">Common fibular</button></div><p>Mixed-reference alignment is unreviewed. A source surface is not a verified patient reconstruction.</p>'
 :'<div class="eyebrow">SCHEMATIC NERVE PATH</div><p>Source geometry could not load; a manually authored approximate guide is shown. No imaging or clinical accuracy is implied.</p>';
 renderNerveEvidence();
 document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===state.selected)));
}
function select(id){
 if(!DATA[id])return;
 if(follow.active){
  if(NERVES.includes(id)){follow.branch=id;follow.progress=0;moveFollowCamera(false);renderFollow();}
  else stopFollow();
 }
 if(state.selected!==id)state.isolate=false;
 state.selected=id;
 if(NERVES.includes(id)){state.depth=3;state.trace=true;syncDepth();}
 inspector();draw();if(window.innerWidth<=850)setExpanded(true);
 $('inspector-scroll').scrollTop=0;
}
function syncDepth(){
 $('depth').value=state.depth;
 $('depth-output').textContent=['SURFACE','STABILIZERS','DEEP ROTATORS','SCIATIC PATH','SKELETON'][state.depth];
 $('view-caption').textContent='RIGHT HIP · '+['POSTERIOR','SIDE STABILIZERS','DEEP ROTATORS','NERVE RELATIONSHIP','SKELETAL FRAME'][state.depth];
}
function depth(v){if(follow.active&&Number(v)!==3)stopFollow();state.depth=clamp(Number(v),0,4);if(state.depth!==3)state.trace=false;syncDepth();inspector();draw();}
function pose(v){state.pose[state.axis]=Number(v);$('motion-output').textContent=Math.round(Number(v))+'°';
 if(lesson.phase==='move'&&state.axis==='abduction'&&state.pose.abduction>=20){lesson.phase='reveal';stop();renderLesson();}
 draw();}
const AXES={flexion:[-25,90],abduction:[-25,45],rotation:[-40,40]};
function axis(which){
 if(!AXES[which])return;
 stop();state.axis=which;
 const [min,max]=AXES[which],input=$('motion');input.min=min;input.max=max;input.value=state.pose[which];
 input.setAttribute('aria-label','Illustrative hip '+which+' angle');
 $('motion-output').textContent=Math.round(state.pose[which])+'°';
 document.querySelectorAll('[data-axis]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.axis===which)));
}
function focus(){
 state.focus=state.focus==='joint'?'whole':'joint';
 state.frameSpan=state.focus==='joint'?(window.innerWidth<=850?3.35:4.5):7.5;
 state.zoom=state.focus==='joint'?1.09:1;
 $('focus-toggle').textContent=state.focus==='joint'?'Whole bones':'Joint focus';
 $('focus-toggle').setAttribute('aria-pressed',String(state.focus==='whole'));
 draw();
}
function stop(){state.playing=false;cancelAnimationFrame(state.frame);state.prev=0;
 $('play').innerHTML='▶ <span>Play</span>';$('play').setAttribute('aria-pressed','false');}
function tick(t){
 if(!state.playing)return;
 const delta=Math.min(50,t-(state.prev||t));state.prev=t;
 const [min,max]=AXES[state.axis],next=state.pose[state.axis]+delta*.033*state.dir;
 if(next>=max){state.dir=-1;pose(max);}else if(next<=min){state.dir=1;pose(min);}else pose(next);
 $('motion').value=state.pose[state.axis];
 if(state.playing)state.frame=requestAnimationFrame(tick);
}
function play(){
 if(state.playing){stop();return;}
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 state.playing=true;state.dir=1;state.prev=0;$('play').innerHTML='Ⅱ <span>Pause</span>';$('play').setAttribute('aria-pressed','true');
 state.frame=requestAnimationFrame(tick);
}
function reset(){
 if(follow.active)stopFollow();
 stop();state.yaw=Math.PI+.28;state.pitch=-.11;state.zoom=1.09;
 state.focus='joint';state.frameSpan=window.innerWidth<=850?3.35:4.5;
 state.selected=null;state.isolate=false;state.trace=false;
 state.pose={flexion:0,abduction:0,rotation:0};
 state.axis='flexion';state.depth=0;lesson.phase='idle';renderLesson();
 $('focus-toggle').textContent='Whole bones';$('focus-toggle').setAttribute('aria-pressed','false');
 axis('flexion');syncDepth();inspector();draw();
}
function renderLesson(){
 const panel=$('lesson-panel');
 panel.hidden=lesson.phase==='idle';
 if(panel.hidden)return;
 if(lesson.phase==='predict'){
  panel.innerHTML='<div class="eyebrow">01 / PREDICT</div><h2>What keeps the pelvis level?</h2><p>Imagine standing on your right leg. Which right-hip muscles help limit pelvic drop?</p>'+
  '<button class="experiment-choice" data-guess="medius">Gluteus medius and minimus</button><button class="experiment-choice" data-guess="piriformis">Piriformis alone</button><button class="experiment-choice" data-guess="sciatic">The sciatic nerve</button>'+
  '<button class="experiment-choice" data-lesson="exit">Close</button>';
 } else if(lesson.phase==='move'){
  panel.innerHTML='<div class="eyebrow">02 / MANIPULATE</div><h2>Explore the abductor action.</h2>'+
   '<p>Move the <strong>ABDUCT</strong> control beyond 20° to see the femur change orientation near gluteus medius.</p>'+
   '<p class="layer-status">This is NOT a single-leg stance simulation; pelvic forces, muscle shortening and balance are not calculated.</p>'+
   '<button class="experiment-choice" data-lesson="exit">Close</button>';
 } else {
  panel.innerHTML='<div class="eyebrow">03 / REVEAL</div><h2>The side stabilizer.</h2><p>Gluteus medius and minimus abduct the hip and help stabilize the pelvis when weight is supported on one leg.</p>'+
   '<p class="layer-status">The muscle meshes remain in the source reference pose; only the femur moves illustratively. '+(lesson.guess==='medius'?'Your prediction matched the anatomy.':'The model lets you revisit the relationship without diagnosing anything.')+'</p>'+
   '<button class="experiment-choice" data-lesson="replay">↺ Replay</button><button class="experiment-choice" data-lesson="exit">Return to exploring</button>';
 }
}
function beginLesson(){
 stop();
 if(lesson.phase==='idle')lesson.oldDepth=state.depth;
 lesson.phase='predict';lesson.guess=null;state.depth=1;syncDepth();
 state.selected='medius';state.isolate=false;state.pose={flexion:0,abduction:0,rotation:0};axis('abduction');$('motion').value=0;
 setExpanded(true);inspector();renderLesson();draw();
}
function endLesson(){lesson.phase='idle';state.depth=lesson.oldDepth;syncDepth();renderLesson();inspector();draw();}
function resize(){
 state.frameSpan=state.focus==='joint'?(window.innerWidth<=850?3.35:4.5):7.5;
 if(follow.active)state.anchorY=window.innerWidth<=850?.29:.42;
 const rect=canvas.getBoundingClientRect();state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);
 state.dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.ceil(state.width*state.dpr);canvas.height=Math.ceil(state.height*state.dpr);
 ctx.setTransform(state.dpr,0,0,state.dpr,0,0);draw();
}
async function load(){
 try{
  const result=await fetch('/hip/spatial/assets/hip-source.json',{cache:'force-cache'});
  if(!result.ok)throw Error('Sourced hip meshes unavailable ('+result.status+')');
  const d=await result.json();
  if(d.schema!=='body-live/hip-sourced-v1'||d.license!=='CC BY 4.0')throw Error('Unexpected source provenance');
  const expected=SYSTEMS.filter(x=>!NERVES.includes(x));
  const obj={};
  for(const id of expected){
   const part=d.parts?.[id];
   if(!part||part.vertices.length<250||part.faces.length<200)throw Error('Missing source mesh '+id);
   const verts=part.vertices.map(([x,y,z])=>V(x,y,z)),faces=part.faces;
   if(!verts.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)))throw Error('Nonfinite mesh');
   if(!faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<verts.length)))throw Error('Invalid topology '+id);
   obj[id]={id,verts,faces};
  }
  hipSourceData=d;
  meshes=Object.values(obj);state.sourceLoaded=true;
  checkBridge();state.sourceLabel='BODYPARTS3D 4.0 · CC BY 4.0';
  $('asset-status').textContent='SOURCED BONES + MUSCLES';
  $('asset-status').title='BodyParts3D 4.0 reference-pose geometry; illustrative movement';
  document.querySelectorAll('[data-part]').forEach(b=>{const tag=b.querySelector('.structure-status');if(tag&&!NERVES.includes(b.dataset.part))tag.textContent='SOURCE';});
  inspector();draw();
 }catch(e){
  meshes=null;state.sourceLoaded=false;state.sourceLabel='SCHEMATIC FALLBACK';
  $('asset-status').textContent='SCHEMATIC FALLBACK';
  document.querySelectorAll('[data-part]').forEach(b=>{const tag=b.querySelector('.structure-status');if(tag)tag.textContent=NERVES.includes(b.dataset.part)?'SCHEMATIC':'ILLUSTRATIVE';});
  console.warn('HIP / SPATIAL:',e.message);inspector();draw();
 }
}
for(const id of SYSTEMS){
 const b=document.createElement('button');b.type='button';b.dataset.part=id;b.textContent=DATA[id].name;
 const tag=document.createElement('span');tag.className='structure-status'+(id==='sciatic'?' guide':'');
 tag.textContent=NERVES.includes(id)?'LOADING':'SOURCE';b.appendChild(tag);
 b.addEventListener('click',()=>select(id));$('structure-list').appendChild(b);
}
$('depth').addEventListener('input',e=>depth(e.target.value));
$('motion').addEventListener('input',e=>{stop();pose(e.target.value);});
document.querySelectorAll('[data-axis]').forEach(b=>b.addEventListener('click',()=>axis(b.dataset.axis)));
$('play').addEventListener('click',play);
$('posterior').addEventListener('click',()=>{state.yaw=Math.PI+.28;state.pitch=-.1;draw();});
$('lateral').addEventListener('click',()=>{state.yaw=Math.PI/2;state.pitch=-.1;draw();});
$('focus-toggle').addEventListener('click',focus);
$('reset').addEventListener('click',reset);
$('inspector-toggle').addEventListener('click',()=>setExpanded(!state.expanded));
$('isolate').addEventListener('click',()=>{if(!state.selected)return;state.isolate=!state.isolate;inspector();draw();});
$('show-all').addEventListener('click',()=>{if(follow.active)stopFollow();state.selected=null;state.isolate=false;state.trace=false;state.depth=0;syncDepth();inspector();draw();});
$('follow-progress').addEventListener('input',e=>setFollowProgress(e.target.value));
$('follow-branch').addEventListener('change',e=>{
 const id=e.target.value;if(!NERVES.includes(id))return;
 follow.branch=id;follow.progress=0;state.selected=id;
 inspector();renderFollow();moveFollowCamera(true);
});
$('follow-exit').addEventListener('click',stopFollow);
document.querySelectorAll('[data-nerve-frame]').forEach(b=>b.addEventListener('click',()=>setNerveFrame(b.dataset.nerveFrame)));
$('nerve-evidence-toggle').addEventListener('click',()=>{nerveEvidenceOpen=!nerveEvidenceOpen;renderNerveEvidence();});
$('nerve-info').addEventListener('click',e=>{const b=e.target.closest('[data-nerve]');if(b)select(b.dataset.nerve);});
$('nerve-follow').addEventListener('click',()=>{
 if(!nerveTruth||!nerveGraph){state.trace=!state.trace;if(state.trace){state.depth=3;syncDepth();}inspector();draw();return;}
 if(follow.active)stopFollow();else startFollow(NERVES.includes(state.selected)?state.selected:'sciatic');
});
$('lesson-start').addEventListener('click',()=>lesson.phase==='idle'?beginLesson():endLesson());
$('lesson-panel').addEventListener('click',e=>{
 const b=e.target.closest('[data-guess]');if(b&&lesson.phase==='predict'){
  lesson.guess=b.dataset.guess;lesson.phase='move';renderLesson();return;
 }
 const cmd=e.target.closest('[data-lesson]');if(!cmd)return;
 if(cmd.dataset.lesson==='replay')beginLesson();else if(cmd.dataset.lesson==='exit')endLesson();
});
core.attachOrbit(canvas,{state,render:draw,pick(x,y){
 for(let i=hits.length-1;i>=0;i--){const c=hits[i];if(c.opacity<.28)continue;
  if(inTriangle(x,y,c.pts)){select(c.id);return;}
 }
}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
window.addEventListener('resize',resize,{passive:true});
if('ResizeObserver' in window)new ResizeObserver(resize).observe(document.querySelector('.stage'));
// The Atlas passes in a source-frame camera. This is a visual alignment bridge,
// NOT evidence that separately sourced nerves align to this pelvis.
function prepareAtlasEntry(camera){
 if(!state.sourceLoaded||!camera||!Number.isFinite(camera.zoom)||camera.zoom<=0)return false;
 if(follow.active)stopFollow();
 stop();state.pose={flexion:0,abduction:0,rotation:0};state.depth=0;state.trace=false;
 state.selected=null;state.isolate=false;state.focus='joint';
 state.target=null;state.anchorY=.5;
 state.yaw=camera.yaw;state.pitch=camera.pitch;state.zoom=camera.zoom;
 state.frameSpan=camera.frameSpan||3.35;atlasTravelMix=0;
 syncDepth();inspector();draw();return true;
}
function setAtlasEntryMix(value){
 atlasTravelMix=clamp(Number(value)||0,0,1);draw();
}
window.__HIP_SPATIAL__={
 prepareAtlasEntry,setAtlasEntryMix,
 getState:()=>({depth:state.depth,pose:{...state.pose},axis:state.axis,selected:state.selected,trace:state.trace,
  followActive:follow.active,followBranch:follow.branch,followProgress:follow.progress,displaySourceFrame:follow.frame,
  cameraTarget:state.target?{...state.target}:null,cameraAnchorY:state.anchorY??.5,graphTopology:nerveGraph?.topology||null,
  junctionGapScene:nerveGraph?.junctions?.[follow.branch]?.sourceGap||null,
  kneeBridgeVerified:bridgeEvidence?.verifiedWithinSourceRounding||false,
  sourceLoaded:state.sourceLoaded,sourceLabel:state.sourceLabel,sourceCount:meshes?.length||0,nerveSourceLoaded:!!nerveTruth,nerveSegments:nerveMeshes.length,nerveEvidenceOpen,compositeFitMedian:nerveTruth?.registration?.fit?.median_scene_units||null,lesson:lesson.phase,
  yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,viewport:{w:state.width,h:state.height},hitCount:hits.length}),
 transformFemur,select,depth,pose,axis,reset,startFollow,setFollowProgress,setNerveFrame
};
syncDepth();inspector();resize();load().then(loadNerveTruth);
})();