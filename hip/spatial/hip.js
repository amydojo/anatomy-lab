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
 sciatic:{name:'Sciatic nerve path',class:'Illustrative nerve guide',summary:'An approximate line through the deep gluteal region into the posterior thigh. The nerve typically passes inferior to piriformis.',fact:'Sciatic nerve anatomy varies. The pathway here cannot identify the source of pain or numbness.'}
};
const BONES=['hipBone','femur','sacrum'];
const DEEP=['piriformis','obturator','gemellusSuperior','gemellusInferior','quadratus'];
const SYSTEMS=[...BONES,'maximus','medius','minimus',...DEEP,'sciatic'];
const COLOR={hipBone:'#dbccb2',femur:'#e6d9bd',sacrum:'#c7b598',maximus:'#ae635c',medius:'#d18b78',
 minimus:'#c98779',piriformis:'#ed9b7e',obturator:'#ba8274',gemellusSuperior:'#c18d78',
 gemellusInferior:'#c88d76',quadratus:'#b67f6d',sciatic:'#f0d68d'};
const state={yaw:Math.PI+.28,pitch:-.11,zoom:1.08,frameSpan:4.5,width:0,height:0,dpr:1,depth:0,focus:'joint',
 axis:'flexion',pose:{flexion:0,abduction:0,rotation:0},selected:null,isolate:false,trace:false,
 expanded:false,playing:false,frame:0,prev:0,dir:1,sourceLoaded:false,sourceLabel:'LOADING'};
const lesson={phase:'idle',guess:null,oldDepth:0,oldAxis:'flexion'};
let meshes=null,rendering=false,hits=[];
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
   sciatic:layer===3
 };
 if(!visible[id])return 0;
 let opacity=BONES.includes(id)?(layer===4?.95:.4):id==='sciatic'?1:.92;
 if(id==='maximus'&&layer===0)opacity=.75;
 if(id==='medius'&&layer===1)opacity=.9;
 if(layer===2&&id==='minimus')opacity=.24;
 // Reference-pose muscle geometry is NOT deformed with femur motion.
 const moving=Object.values(state.pose).some(x=>Math.abs(x)>2);
 if(moving&&!BONES.includes(id)&&id!=='sciatic')opacity*=.4;
 if(state.selected&&state.selected!==id)opacity*=state.isolate?.12:.45;
 if(state.selected===id)opacity=Math.min(1,opacity+.07);
 if(state.trace&&id==='sciatic')opacity=1;
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
function draw(){
 if(rendering)return;
 rendering=true;
 try{
 const w=state.width,h=state.height;if(!w||!h)return;
 ctx.clearRect(0,0,w,h);
 const candidates=[];
 const source=meshes||fallback();
 for(const m of source){
  if(m.id==='sciatic')continue;
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
 if(state.depth===3 || state.trace){
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
  ctx.beginPath();nervePoints.map(p=>core.project(p,state)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  ctx.globalAlpha=1;
 }
 }finally{rendering=false;}
}
function setExpanded(v){
 state.expanded=!!v;const panel=$('hip-inspector');
 panel.dataset.expanded=String(v);$('inspector-toggle').setAttribute('aria-expanded',String(v));
 $('inspector-toggle').querySelector('.grab-icon').textContent=v?'⌄':'⌃';
 requestAnimationFrame(resize);
}
function inspector(){
 const obj=state.selected?DATA[state.selected]:null;
 $('selected-short').textContent=obj?obj.name:'Inside the right hip';
 $('inspector-title').textContent=obj?obj.name:'A ball-and-socket laboratory.';
 $('structure-intro').textContent=obj?obj.summary:'Peel the gluteal layers to see how the pelvis, femur, and deep rotators occupy the same space. Move the femur in three axes.';
 $('structure-type').textContent=obj?(state.sourceLoaded&&state.selected!=='sciatic'?'BODYPARTS3D 4.0 · REFERENCE POSE':'SCHEMATIC · NOT SOURCED'):'SOURCED STRUCTURES · SIMPLIFIED MOTION';
 $('anatomy-fact').querySelector('p').textContent=obj?obj.fact:'The femoral head moves within the acetabulum. This educational model uses a fixed estimated pivot, not personalized joint mechanics.';
 $('isolate').disabled=!obj;$('isolate').setAttribute('aria-pressed',String(state.isolate));
 $('nerve-follow').hidden=state.selected!=='sciatic'&&state.depth!==3;
 $('nerve-follow').setAttribute('aria-pressed',String(state.trace));
 $('nerve-follow').textContent=state.trace?'Hide nerve pathway':'Follow sciatic path';
 $('nerve-info').hidden=!state.trace;
 if(state.trace)$('nerve-info').innerHTML='<div class="eyebrow">SCHEMATIC NERVE PATH</div><p>This gold guide approximates the deep-gluteal sciatic route. It is not an imported nerve mesh, a precise sensory map, or a diagnosis. Anatomy varies between individuals.</p><p>Peel back to Deep Rotators to locate piriformis, then return to Sciatic Path to follow the illustrative nerve through the posterior thigh.</p>';
 document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===state.selected)));
}
function select(id){
 if(!DATA[id])return;
 if(state.selected!==id)state.isolate=false;
 state.selected=id;
 if(id==='sciatic'){state.depth=3;state.trace=true;syncDepth();}
 inspector();draw();if(window.innerWidth<=850)setExpanded(true);
}
function syncDepth(){
 $('depth').value=state.depth;
 $('depth-output').textContent=['SURFACE','STABILIZERS','DEEP ROTATORS','SCIATIC PATH','SKELETON'][state.depth];
 $('view-caption').textContent='RIGHT HIP · '+['POSTERIOR','SIDE STABILIZERS','DEEP ROTATORS','NERVE RELATIONSHIP','SKELETAL FRAME'][state.depth];
}
function depth(v){state.depth=clamp(Number(v),0,4);if(state.depth!==3)state.trace=false;syncDepth();inspector();draw();}
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
 state.frameSpan=state.focus==='joint'?3.65:7.5;
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
 stop();state.yaw=Math.PI+.28;state.pitch=-.11;state.zoom=1.09;
 state.focus='joint';state.frameSpan=3.65;
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
  const expected=SYSTEMS.filter(x=>x!=='sciatic');
  const obj={};
  for(const id of expected){
   const part=d.parts?.[id];
   if(!part||part.vertices.length<250||part.faces.length<200)throw Error('Missing source mesh '+id);
   const verts=part.vertices.map(([x,y,z])=>V(x,y,z)),faces=part.faces;
   if(!verts.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)))throw Error('Nonfinite mesh');
   if(!faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<verts.length)))throw Error('Invalid topology '+id);
   obj[id]={id,verts,faces};
  }
  meshes=Object.values(obj);state.sourceLoaded=true;state.sourceLabel='BODYPARTS3D 4.0 · CC BY 4.0';
  $('asset-status').textContent='SOURCED BONES + MUSCLES';
  $('asset-status').title='BodyParts3D 4.0 reference-pose geometry; illustrative movement';
  document.querySelectorAll('[data-part]').forEach(b=>{const tag=b.querySelector('.structure-status');if(tag&&b.dataset.part!=='sciatic')tag.textContent='SOURCE';});
  inspector();draw();
 }catch(e){
  meshes=null;state.sourceLoaded=false;state.sourceLabel='SCHEMATIC FALLBACK';
  $('asset-status').textContent='SCHEMATIC FALLBACK';
  document.querySelectorAll('[data-part]').forEach(b=>{const tag=b.querySelector('.structure-status');if(tag)tag.textContent='ILLUSTRATIVE';});
  console.warn('HIP / SPATIAL:',e.message);inspector();draw();
 }
}
for(const id of SYSTEMS){
 const b=document.createElement('button');b.type='button';b.dataset.part=id;b.textContent=DATA[id].name;
 const tag=document.createElement('span');tag.className='structure-status'+(id==='sciatic'?' guide':'');
 tag.textContent=id==='sciatic'?'SCHEMATIC':'SOURCE';b.appendChild(tag);
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
$('show-all').addEventListener('click',()=>{state.selected=null;state.isolate=false;state.trace=false;state.depth=0;syncDepth();inspector();draw();});
$('nerve-follow').addEventListener('click',()=>{state.trace=!state.trace;if(state.trace){state.depth=3;syncDepth();}inspector();draw();});
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
window.__HIP_SPATIAL__={
 getState:()=>({depth:state.depth,pose:{...state.pose},axis:state.axis,selected:state.selected,trace:state.trace,
  sourceLoaded:state.sourceLoaded,sourceLabel:state.sourceLabel,sourceCount:meshes?.length||0,lesson:lesson.phase,
  yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,viewport:{w:state.width,h:state.height},hitCount:hits.length}),
 transformFemur,select,depth,pose,axis,reset
};
syncDepth();inspector();resize();load();
})();