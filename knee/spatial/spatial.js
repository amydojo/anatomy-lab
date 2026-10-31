/* KNEE / SPATIAL v0.1 — dependency-free perspective mesh engine.
  NOT sourced anatomical geometry. This is a spatial teaching proxy.
  Coordinates and endpoints are deliberately schematic, not measured bone positions.
*/
(() => {
'use strict';
const canvas=document.getElementById('knee-canvas');
const ctx=canvas.getContext('2d',{alpha:true});
if(!ctx || !window.BodySpatialCore)return;
const $=id=>document.getElementById(id);
const DATA={
  femur:{name:'Femur',kind:'Bone · stationary frame',color:'#e0ceb2',description:'The distal thigh bone forms two rounded condyles that articulate with the tibial plateau.',insight:'The contact geometry is more complicated than a simple hinge. Actual knee movement combines rolling, gliding and rotation.'},
  tibia:{name:'Tibia',kind:'Bone · moving lever',color:'#e3d0ae',description:'The main weight-bearing lower-leg bone moves relative to the femur during knee flexion.',insight:'This model pivots the tibia about a fixed teaching axis; it does not reproduce the real migrating instantaneous knee axis.'},
  fibula:{name:'Fibula',kind:'Bone · lateral landmark',color:'#cdb99b',description:'A slender lateral bone connected to the tibia just below the knee joint.',insight:'The fibula does not form the main tibiofemoral articulation.'},
  patella:{name:'Patella',kind:'Bone · extensor lever',color:'#f1dfbe',description:'The kneecap lies anterior to the distal femur within the quadriceps extensor mechanism.',insight:'Its changing position helps the extensor mechanism work efficiently. The path shown here is deliberately approximate.'},
  menisci:{name:'Menisci',kind:'Fibrocartilage · schematic',color:'#95b9ad',description:'Two fibrocartilage wedges sit between the femoral condyles and tibia and help distribute joint loads.',insight:'The green horseshoe-like pieces are teaching proxies, not validated meniscal meshes or actual deformation.'},
  acl:{name:'ACL',kind:'Ligament · schematic',color:'#edc97d',description:'The anterior cruciate ligament connects the femur to the tibia and contributes to anterior translation and rotational restraint.',insight:'The attachment markers and ligament path are illustrative, not measured or suitable for calculating tension.'},
  pcl:{name:'PCL',kind:'Ligament · schematic',color:'#d6a670',description:'The posterior cruciate ligament crosses the ACL and helps resist posterior displacement of the tibia.',insight:'Flex the knee and observe changing spatial relationships; no mechanical force or tissue-strain values are simulated.'},
  collateral:{name:'Collateral ligaments',kind:'Ligaments · schematic',color:'#d8c69d',description:'Medial and lateral collateral structures help stabilize the sides of the knee.',insight:'These are simplified attachment-to-attachment tubes without anatomical fiber bundles.'},
  tendon:{name:'Extensor mechanism',kind:'Tendon · schematic',color:'#d18c75',description:'Quadriceps tendon, patella and patellar ligament transfer muscle force to the tibia.',insight:'Observe the anterior relationship as the knee bends. The schematic tendon does not calculate muscle length or tension.'}
};
const DISPLAY_ORDER=['femur','tibia','fibula','patella','menisci','acl','pcl','collateral','tendon'];
const PALETTES={femur:DATA.femur.color,tibia:DATA.tibia.color,fibula:DATA.fibula.color,patella:DATA.patella.color,menisci:DATA.menisci.color,acl:DATA.acl.color,pcl:DATA.pcl.color,collateral:DATA.collateral.color,tendon:DATA.tendon.color};
let sourcedMeshes=null;
let atlasTravelMix=1; // keep sourced bones visible as illustrative tissues are introduced
let attachmentGraph=null;
let sourceStatus='Schematic geometry · source loading';
const study={stage:'idle',guess:null,originalDepth:0};
const state={focus:'joint',frameSpan:6.65,yaw:0.47,pitch:-0.11,zoom:1,flex:0,depth:0,selected:null,isolate:false,follow:false,playing:false,frame:0,prev:0,dir:1,expanded:false,width:0,height:0,dpr:1,hits:[],gestures:new Map(),touchStart:null};
const V=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>V(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const unit=a=>mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
function clamp(n,a,b){return Math.min(b,Math.max(a,n));}
function rotateLower(p){
 return window.BodySpatialCore.rotateAboutX(p,V(0,0.08,0),state.flex*Math.PI/180);
}
function makeMesh(id,verts,faces,{lower=false,color=PALETTES[id]}={}){
 return {id,verts:lower?verts.map(rotateLower):verts,faces,color};
}
function loft(id,rings,seg=16,lower=false){
 const verts=[];
 for(const [y,cx,cz,rx,rz] of rings)for(let i=0;i<seg;i++){
  const a=i*2*Math.PI/seg;
  verts.push(V(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz));
 }
 const f=[];
 for(let n=0;n<rings.length-1;n++)for(let i=0;i<seg;i++){
  const a=n*seg+i,b=n*seg+(i+1)%seg,c=(n+1)*seg+i,d=(n+1)*seg+(i+1)%seg;
  f.push([a,c,b],[b,c,d]);
 }
 for(let i=1;i<seg-1;i++){f.push([0,i+1,i]);const end=(rings.length-1)*seg;f.push([end,end+i,end+i+1]);}
 return makeMesh(id,verts,f,{lower});
}
function ellipsoid(id,center,rx,ry,rz,lat=10,lon=16,lower=false){
 const verts=[],faces=[];
 for(let j=0;j<=lat;j++){
  const b=j*Math.PI/lat;
  for(let i=0;i<=lon;i++){
   const a=i*2*Math.PI/lon;
   verts.push(V(center.x+rx*Math.sin(b)*Math.cos(a),center.y+ry*Math.cos(b),center.z+rz*Math.sin(b)*Math.sin(a)));
  }
 }
 for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){
  const a=j*(lon+1)+i,b=a+lon+1;
  faces.push([a,a+1,b],[a+1,b+1,b]);
 }
 return makeMesh(id,verts,faces,{lower});
}
function tube(id,path,radius=0.035,segments=7,lower=false){
 if(path.length<2)return null;
 const vertices=[],faces=[];
 for(let n=0;n<path.length;n++){
  const tangent=unit(sub(path[Math.min(n+1,path.length-1)],path[Math.max(n-1,0)]));
  const ref=Math.abs(tangent.y)<0.88?V(0,1,0):V(1,0,0);
  const a=unit(cross(tangent,ref)),b=unit(cross(tangent,a));
  for(let k=0;k<segments;k++){
   const t=k/segments*Math.PI*2;
   vertices.push(add(path[n],add(mul(a,radius*Math.cos(t)),mul(b,radius*Math.sin(t)))));
  }
 }
 for(let n=0;n<path.length-1;n++)for(let k=0;k<segments;k++){
  const i=n*segments+k,j=n*segments+(k+1)%segments;
  faces.push([i,i+segments,j],[j,i+segments,j+segments]);
 }
 return makeMesh(id,vertices,faces,{lower});
}
const rings={
 femur:[[3.12,-.07,-.04,.23,.20],[2.15,-.05,-.03,.23,.23],[1.35,-.02,-.02,.27,.26],[.76,0,0,.33,.30],[.48,0,.01,.49,.31],[.29,0,.02,.45,.32]],
 tibia:[[-.12,0,0,.52,.36],[-.28,0,-.03,.45,.28],[-.58,0,-.05,.26,.24],[-1.55,.02,-.08,.19,.17],[-2.72,.03,-.08,.18,.14]],
 fibula:[[-.31,.50,-.05,.14,.13],[-.47,.52,-.06,.14,.14],[-1.2,.40,-.08,.10,.10],[-2.74,.33,-.09,.095,.09]]
};
function worldMeshes(){
 const pieces=[];
 if(sourcedMeshes&&attachmentGraph){
  // Every bone and the insertion markers resolve through the SAME transform hierarchy.
  for(const bone of ['femur','tibia','fibula','patella']){
   const reference=sourcedMeshes[bone];
   pieces.push({id:bone,
     verts:reference.verts.map(p=>attachmentGraph.transform(bone,p,state.flex)),
     faces:reference.faces,color:PALETTES[bone]});
  }
  // Menisci are schematic crescent guides fixed in tibial local space.
  // Their exact morphology, roots and contact regions have not been reviewed.
  for(const landmark of ['meniscus.lateral','meniscus.medial']){
   const centre=attachmentGraph.anchors[landmark].base;
   const path=[];
   for(let i=0;i<=16;i++){
    const theta=(-.8+1.7*i/16)*Math.PI;
    const local=V(centre.x+.085*Math.cos(theta),centre.y+.016,centre.z+.08*Math.sin(theta));
    path.push(attachmentGraph.transform('tibia',local,state.flex));
   }
   pieces.push(tube('menisci',path,.023,7));
  }
  const outputs={acl:'acl',pcl:'pcl',mcl:'collateral',lcl:'collateral',quadriceps:'tendon',patellar:'tendon'};
  for(const [edge,id] of Object.entries(outputs)){
   const path=attachmentGraph.guide(edge,state.flex);
   pieces.push(tube(id,path.vertices,path.radius,8));
  }
 }else{
  // Offline / unavailable sourced-asset fallback remains the original schematic.
  pieces.push(loft('femur',rings.femur,18));
  for(const side of [-1,1])pieces.push(ellipsoid('femur',V(side*.265,.29,.08),.28,.265,.325,12,18));
  pieces.push(loft('tibia',rings.tibia,18,true));
  pieces.push(ellipsoid('tibia',V(0,-.13,.01),.49,.12,.34,9,18,true));
  pieces.push(loft('fibula',rings.fibula,12,true));
  const a=state.flex*Math.PI/180;
  const patella=V(0,.285+.12*Math.sin(a),.49+.025*Math.cos(a));
  pieces.push(ellipsoid('patella',patella,.23,.32,.14,10,18));
  for(const side of [-1,1]){
   const path=[];
   for(let i=0;i<=15;i++){
    const theta=(-.90+2.05*i/15)*Math.PI;
    path.push(V(side*.26+Math.cos(theta)*.19,-.096,Math.sin(theta)*.20));
   }
   pieces.push(tube('menisci',path,.072,7,true));
  }
  const lowerACL=rotateLower(V(-.09,-.14,.12)),lowerPCL=rotateLower(V(.09,-.17,-.13));
  pieces.push(tube('acl',[V(.19,.47,-.13),V(.04,.23,.01),lowerACL],.043,9));
  pieces.push(tube('pcl',[V(-.20,.46,.13),V(-.04,.20,.01),lowerPCL],.055,9));
  for(const side of [-1,1])
   pieces.push(tube('collateral',[V(side*.43,.55,.015),V(side*.49,.10,.04),rotateLower(V(side*.47,-.40,.025))],.043,8));
  const tuberosity=rotateLower(V(0,-.60,.245));
  pieces.push(tube('tendon',[V(0,1.25,.34),V(0,.61,.38),patella],.080,10));
  pieces.push(tube('tendon',[patella,mix(patella,tuberosity,.44),tuberosity],.092,10));
 }
 return pieces.filter(Boolean);
}

function hexRGB(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function rgbLit(hex,lit){return 'rgb('+hexRGB(hex).map(n=>Math.round(clamp(n*lit,0,255))).join(',')+')';}
const projected=(point)=>window.BodySpatialCore.project(point,state);
function polygonContains(x,y,pts){
 let inside=false;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[i],b=pts[j];
  if((a.y>y)!=(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function visible(id){
 if(state.depth===3)return ['femur','tibia','fibula','patella'].includes(id);
 if(state.depth===2)return !['tendon','menisci'].includes(id);
 if(state.depth===1)return id!=='tendon';
 return true;
}
function alpha(id){
 if(!visible(id))return 0;
 let a=(id==='femur'||id==='tibia'||id==='fibula'||id==='patella')?.97:.9;
 if(state.selected&&state.selected!==id)a=state.isolate?.12:.49;
 if(state.isolate&&state.selected===id)a=1;
 if(atlasTravelMix<1&&!['femur','tibia','fibula','patella'].includes(id))a*=atlasTravelMix;
 return a;
}
function render(){
 const w=state.width,h=state.height;if(!w||!h)return;
 ctx.clearRect(0,0,w,h);
 const triangles=[];
 for(const mesh of worldMeshes()){
  const opacity=alpha(mesh.id);if(!opacity)continue;
  const p=mesh.verts.map(projected);
  for(const face of mesh.faces){
   const a=p[face[0]],b=p[face[1]],c=p[face[2]];
   if(!a||!b||!c)continue;
   const n=unit(cross(sub(b.world,a.world),sub(c.world,a.world)));
   const light=Math.abs(dot(n,unit(V(.35,.65,1))))*.47+.55;
   triangles.push({id:mesh.id,coords:[a,b,c],color:mesh.color,opacity,light,depth:(a.z+b.z+c.z)/3});
  }
 }
 triangles.sort((a,b)=>a.depth-b.depth);
 const hits=[];
 for(const poly of triangles){
  const pts=poly.coords;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);ctx.lineTo(pts[1].x,pts[1].y);ctx.lineTo(pts[2].x,pts[2].y);ctx.closePath();
  ctx.globalAlpha=poly.opacity;ctx.fillStyle=rgbLit(poly.color,poly.light);ctx.fill();
  // Slightly translucent silhouette treatment; not a wireframe.
  if(state.selected===poly.id){
   ctx.globalAlpha=Math.min(.20,poly.opacity*.2);ctx.strokeStyle='#fff0d0';ctx.lineWidth=.5;ctx.stroke();
  }
  hits.push({id:poly.id,coords:pts,opacity:poly.opacity});
 }
 ctx.globalAlpha=1;
 state.hits=hits;
 drawAttachments();
}

function selectedConnections(){
 if(!attachmentGraph||!state.selected)return [];
 const map={acl:['acl'],pcl:['pcl'],collateral:['mcl','lcl'],tendon:['quadriceps','patellar']};
 if(map[state.selected])return map[state.selected];
 if(['femur','tibia','fibula','patella'].includes(state.selected))
  return attachmentGraph.attachedTo(state.selected).map(l=>l.id);
 return [];
}
function drawAttachments(){
 if(!state.follow||!attachmentGraph)return;
 const connected=selectedConnections();
 ctx.save();
 ctx.lineWidth=2.3;ctx.lineCap='round';ctx.strokeStyle='#ffe0a0';
 ctx.fillStyle='#ffe8b8';ctx.font='600 11px -apple-system, sans-serif';
 for(const id of connected){
  const guide=attachmentGraph.guide(id,state.flex),a=projected(guide.from),b=projected(guide.to);
  ctx.beginPath();ctx.moveTo(a.x,a.y);
  for(const vertex of guide.vertices.slice(1)){const pt=projected(vertex);ctx.lineTo(pt.x,pt.y);}
  ctx.stroke();
  for(const [pt,side] of [[a,'A'],[b,'B']]){
   ctx.beginPath();ctx.fillStyle='#ffe3a5';ctx.arc(pt.x,pt.y,5,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#342116';ctx.fillText(side,pt.x+9,pt.y-9);
  }
 }
 ctx.restore();
}
function renderAttachmentInfo(){
 const node=$('attachment-info'),btn=$('follow');
 if(!node||!btn)return;
 const ids=selectedConnections();
 const available=!!attachmentGraph&&ids.length>0;
 btn.disabled=!available;
 btn.hidden=!available;
 if(!available||!state.follow){
  node.hidden=true;node.replaceChildren();
  btn.setAttribute('aria-pressed','false');btn.textContent='◎ Follow attachments';
  return;
 }
 btn.setAttribute('aria-pressed','true');btn.textContent='✕ Hide attachments';
 const rows=ids.map(id=>{
  const c=attachmentGraph.links[id];
  const start=attachmentGraph.anchors[c.from],end=attachmentGraph.anchors[c.to];
  return '<div class="attachment-row"><strong>'+c.label+'</strong><span>'+
    start.bone+' → '+end.bone+'</span><small>'+c.description+'</small></div>';
 }).join('');
 node.hidden=false;
 node.innerHTML='<div class="eyebrow">CONNECTED ANATOMY · APPROXIMATE</div>'+
  '<p class="attachment-note">Markers are snapped to source-bone surfaces from estimated regions, not anatomist-verified insertion sites. They follow their parent bones during flexion.</p>'+
  rows+'<a href="/knee/spatial/sources/">Landmark methodology and review status ↗</a>';
}
function toggleAttachments(){
 if(!attachmentGraph||!selectedConnections().length)return;
 state.follow=!state.follow;
 if(state.follow)setDepth(0);
 renderAttachmentInfo();render();
}

function updateStatusBadges(){
 document.querySelectorAll('#structure-list [data-structure]').forEach(btn=>{
  const bone=['femur','tibia','fibula','patella'].includes(btn.dataset.structure);
  const badge=btn.querySelector('.structure-status');
  if(badge)badge.textContent=bone?(sourcedMeshes?'SOURCE':'BONE'):'ILLUSTRATIVE';
 });
}
function updateInspector(){
 const d=state.selected?DATA[state.selected]:null;
 $('structure-type').textContent=d
 ?((sourcedMeshes&&['femur','tibia','fibula','patella'].includes(state.selected))?'SOURCE GEOMETRY · BODYPARTS3D 4.0':(state.selected&&['femur','tibia','fibula','patella'].includes(state.selected))?'FALLBACK GEOMETRY · ILLUSTRATIVE':'SOFT TISSUE · SCHEMATIC')
 :'THE JOINT · REVEALED';
 $('inspector-title').textContent=d?d.name:'A moving machine.';
 $('selected-short').textContent=d?d.name:'Explore the knee';
 $('structure-intro').textContent=d?d.description:'A spatial study of the knee’s skeletal frame and selected soft-tissue relationships. Rotate the specimen and peel through the layers to uncover how it works.';
 $('anatomy-fact').querySelector('p').textContent=d?d.insight:'Watch the lower leg rotate around an illustrative knee axis. Real knees roll, glide, and rotate—the model deliberately simplifies this movement.';
 $('isolate').disabled=!d;
 $('isolate').setAttribute('aria-pressed',String(state.isolate));
 document.querySelectorAll('[data-structure]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.structure===state.selected)));
 renderAttachmentInfo();
}
function select(id){
 if(!DATA[id])return;
 if(state.selected!==id)state.follow=false;
 if(state.selected===id&&state.isolate){state.isolate=false;}else{state.selected=id;state.isolate=false;}
 updateInspector();render();
}
function setDepth(value){
 state.depth=clamp(Number(value),0,3);
 $('depth').value=state.depth;
 $('depth-output').textContent=['ALL STRUCTURES','DEEP RELATIONSHIPS','LIGAMENTS + BONES','BONES ONLY'][state.depth];
 render();
}
function setFlex(value){
 state.flex=clamp(Number(value),0,110);
 $('flexion').value=Math.round(state.flex);
 $('angle-output').textContent=Math.round(state.flex)+'°';
 if(study.stage==='operate'&&state.flex>=65){
   study.stage='reveal';stop();renderExperiment();
 }
 render();
}

async function loadSourceGeometry(){
 try{
   const response=await fetch('/knee/spatial/assets/bp3d-right-knee-4.0.json',{cache:'force-cache'});
   if(!response.ok)throw new Error('Sourced bone asset unavailable: '+response.status);
   const payload=await response.json();
   if(payload.schema!=='body-live/sourced-knee-geometry-v1')throw new Error('Unexpected anatomy asset schema');
   if(payload.source_release!=='4.0 99%-reduced IS-A tree')throw new Error('Unreviewed anatomy release');
   const names=['femur','tibia','fibula','patella'];
   const decoded={};
   for(const bone of names){
     const source=payload.bone_meshes?.[bone];
     if(!source || !Array.isArray(source.vertices)||!Array.isArray(source.faces))throw new Error('Missing '+bone+' mesh');
     if(source.vertices.length<50 || source.faces.length<50)throw new Error('Incomplete '+bone+' mesh');
     const verts=source.vertices.map(p=>{
       if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)))throw new Error('Invalid vertex');
       return V(p[0],p[1],p[2]);
     });
     const faces=source.faces.map(f=>{
       if(!Array.isArray(f)||f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=verts.length))throw new Error('Invalid triangle');
       return f;
     });
     decoded[bone]={verts,faces};
   }
   // Surface landmarks are derived once, before movement. No per-bone recentering.
   if(!window.KneeAttachmentGraph)throw new Error('Landmark graph unavailable');
   const resolved=window.KneeAttachmentGraph.create(decoded);
   attachmentGraph=resolved;
   sourcedMeshes=decoded;
   updateStatusBadges();
   state.focus='joint';
   state.frameSpan=2.65;
   state.zoom=1.13;
   updateFocusButton();
   sourceStatus='BODYPARTS3D 4.0 · REAL BONE MESHES';
   $('scene-status').textContent='SOURCED BONES · SCHEMATIC TISSUES';
   document.querySelector('.disclaimer').textContent='Four aligned static right-knee bone meshes are sourced from BodyParts3D 4.0 (DBCLS, CC BY 4.0), transformed together from the same original frame. Ligaments, cartilage, patellar tracking and flexion remain illustrative and unreviewed.';
   updateInspector();render();
 }catch(error){
   attachmentGraph=null;sourcedMeshes=null;state.follow=false;
   sourceStatus='Schematic fallback — source geometry unavailable';
   $('scene-status').textContent='SCHEMATIC FALLBACK';
   console.warn('BODY / LIVE:',sourceStatus,error.message);
   render();
 }
}

function resize(){
 const rect=canvas.getBoundingClientRect();
 state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);
 state.dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.ceil(state.width*state.dpr);canvas.height=Math.ceil(state.height*state.dpr);
 ctx.setTransform(state.dpr,0,0,state.dpr,0,0);render();
}
function setExpanded(v){
 state.expanded=!!v;
 document.querySelector('.inspector').dataset.expanded=String(state.expanded);
 $('inspector-toggle').setAttribute('aria-expanded',String(state.expanded));
 $('inspector-toggle').querySelector('.grab-icon').textContent=state.expanded?'⌄':'⌃';
 requestAnimationFrame(resize);
}
function stop(){
 state.playing=false;cancelAnimationFrame(state.frame);state.prev=0;
 $('play').innerHTML='▶ <span>Play</span>';$('play').setAttribute('aria-pressed','false');
}
function animate(now){
 if(!state.playing)return;
 const dt=Math.min(42,now-(state.prev||now));state.prev=now;
 const next=state.flex+dt*.045*state.dir;
 if(next>=110){state.dir=-1;setFlex(110)}
 else if(next<=0){state.dir=1;setFlex(0)}
 else setFlex(next);
 state.frame=requestAnimationFrame(animate);
}
function play(){
 if(state.playing){stop();return;}
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 state.playing=true;state.dir=1;state.prev=0;
 $('play').innerHTML='Ⅱ <span>Pause</span>';$('play').setAttribute('aria-pressed','true');
 state.frame=requestAnimationFrame(animate);
}
function updateFocusButton(){
 const b=$('focus-toggle');if(!b)return;
 b.textContent=state.focus==='joint'?'Whole bones':'Joint focus';
 b.setAttribute('aria-pressed',String(state.focus==='whole'));
 b.setAttribute('aria-label',state.focus==='joint'?'Show whole bones':'Return to knee joint close-up');
}
function toggleFocus(){
 if(!sourcedMeshes)return;
 state.focus=state.focus==='joint'?'whole':'joint';
 state.frameSpan=state.focus==='joint'?2.65:7.6;
 state.zoom=state.focus==='joint'?1.13:1;
 updateFocusButton();render();
}

function renderExperiment(){
 const panel=$('experiment-panel');if(!panel)return;
 panel.hidden=study.stage==='idle';
 $('experiment-start').setAttribute('aria-expanded',String(study.stage!=='idle'));
 if(study.stage==='predict'){
   panel.innerHTML='<div class="eyebrow">01 / PREDICT</div><h2>What moves when the knee bends?</h2>'+
     '<p>Choose what you expect to move relative to the femur.</p>'+
     '<div class="experiment-choices">'+
     '<button data-guess="lower">Tibia and fibula</button>'+
     '<button data-guess="upper">Femur only</button>'+
     '<button data-guess="nothing">Everything stays fixed</button></div>'+
     '<button class="experiment-dismiss" data-experiment="exit">Close experiment</button>';
 }else if(study.stage==='operate'){
   panel.innerHTML='<div class="eyebrow">02 / TEST IT</div><h2>Bend the joint.</h2>'+
     '<p>Use the <strong>FLEXION</strong> slider below or Play to bend the model beyond 65°.</p>'+
     '<p class="experiment-hint">The white bone surfaces are sourced; the single-axis movement is a teaching approximation.</p>'+
     '<button class="experiment-dismiss" data-experiment="exit">Close experiment</button>';
 }else if(study.stage==='reveal'){
   panel.innerHTML='<div class="eyebrow">03 / REVEAL</div><h2>A moving relationship.</h2>'+
     '<p>In this model the tibia and fibula move together relative to the fixed femur. The patella follows an <em>approximate</em> path.</p>'+
     '<p class="experiment-hint">A real knee also rolls, glides and rotates. This is not a mechanically validated simulation.'+
     (study.guess==='lower'?' Your prediction matched the model.':' The visible result may differ from your prediction.')+'</p>'+
     '<div class="experiment-choices"><button data-experiment="replay">↺ Try again</button>'+
     '<button data-experiment="exit">Return to exploring</button></div>';
 }
}
function beginExperiment(){
 stop();if(study.stage==='idle')study.originalDepth=state.depth;
 study.stage='predict';study.guess=null;
 setFlex(0);setDepth(3);setExpanded(true);renderExperiment();
}
function endExperiment(){
 study.stage='idle';study.guess=null;setDepth(study.originalDepth);renderExperiment();
}

function reset(){
 if(study.stage!=='idle')endExperiment();
 stop();state.follow=false;state.yaw=.47;state.pitch=-.11;state.focus='joint';state.zoom=sourcedMeshes?1.13:1;state.frameSpan=sourcedMeshes?2.65:6.65;updateFocusButton();state.selected=null;state.isolate=false;setFlex(0);setDepth(0);updateInspector();render();
}
const choices=$('structure-list');
for(const id of DISPLAY_ORDER){
 const b=document.createElement('button');b.type='button';b.dataset.structure=id;b.textContent=DATA[id].name;
 const tag=document.createElement('span');tag.className='structure-status';
 tag.textContent=['femur','tibia','fibula','patella'].includes(id)?'BONE':'ILLUSTRATIVE';
 b.appendChild(tag);
 b.addEventListener('click',()=>{select(id);if(window.innerWidth<=850)setExpanded(true);});
 choices.appendChild(b);
}
$('depth').addEventListener('input',e=>setDepth(e.target.value));
$('flexion').addEventListener('input',e=>{stop();setFlex(e.target.value)});
$('play').addEventListener('click',play);
$('focus-toggle').addEventListener('click',toggleFocus);
$('front').addEventListener('click',()=>{state.yaw=0;state.pitch=0;render()});
$('side').addEventListener('click',()=>{state.yaw=1.55;state.pitch=0;render()});
$('reset').addEventListener('click',reset);
$('show-all').addEventListener('click',()=>{state.selected=null;state.isolate=false;state.follow=false;setDepth(0);updateInspector();render()});
$('follow').addEventListener('click',toggleAttachments);
$('isolate').addEventListener('click',()=>{if(!state.selected)return;state.isolate=!state.isolate;updateInspector();render()});
$('inspector-toggle').addEventListener('click',()=>setExpanded(!state.expanded));
$('experiment-start').addEventListener('click',()=>study.stage==='idle'?beginExperiment():endExperiment());
$('experiment-panel').addEventListener('click',e=>{
 const guess=e.target.closest('[data-guess]');
 if(guess&&study.stage==='predict'){
   study.guess=guess.dataset.guess;study.stage='operate';renderExperiment();return;
 }
 const cmd=e.target.closest('[data-experiment]');if(!cmd)return;
 if(cmd.dataset.experiment==='replay')beginExperiment();
 if(cmd.dataset.experiment==='exit')endExperiment();
});
window.BodySpatialCore.attachOrbit(canvas,{state,render,pick(x,y){
 for(let i=state.hits.length-1;i>=0;i--){
  const p=state.hits[i];if(p.opacity<.23)continue;
  if(polygonContains(x,y,p.coords)){
    select(p.id);
    if(window.innerWidth<=850)setExpanded(true);
    break;
  }
 }
}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
window.addEventListener('pagehide',stop);
window.addEventListener('resize',resize,{passive:true});
if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(document.querySelector('.stage'));
updateInspector();setDepth(0);resize();
loadSourceGeometry();
// Camera contract: shared BodyParts3D reference orientation, measured in the
// knee's own uniform display units. Do not change bones' source transforms.
function prepareAtlasEntry(camera){
 if(!sourcedMeshes||!camera||!Number.isFinite(camera.zoom)||camera.zoom<=0)return false;
 stop();state.flex=0;state.depth=0;state.selected=null;state.isolate=false;
 state.focus='joint';state.follow=false;
 state.anchorY=Number.isFinite(camera.anchorY)?camera.anchorY:.5;
 state.yaw=camera.yaw;state.pitch=camera.pitch;state.zoom=camera.zoom;
 state.frameSpan=camera.frameSpan||2.65;atlasTravelMix=0;
 updateFocusButton();updateInspector();render();return true;
}
function setAtlasEntryMix(value){
 atlasTravelMix=clamp(Number(value)||0,0,1);render();
}
window.__BODY_SPATIAL__={prepareAtlasEntry,setAtlasEntryMix,getState:()=>({...state,landmarkCount:attachmentGraph?Object.keys(attachmentGraph.anchors).length:0,attachedEdges:attachmentGraph?selectedConnections():[],studyStage:study.stage,studyGuess:study.guess,sourceStatus,sourcedBoneCount:sourcedMeshes?Object.keys(sourcedMeshes).length:0,gestures:undefined,hits:undefined,frame:undefined}),select,setFlex,setDepth,reset};
})();