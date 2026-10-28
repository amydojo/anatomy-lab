/* BODY / LIVE V6.3 — ONE WebGL scene for Atlas, Hip and Knee.
 * Stable world/camera coordinates, evidence-scoped visual detail. */
(function(){'use strict';
const COLORS={head:[.89,.78,.66],thorax:[.83,.69,.55],spine:[.72,.60,.49],upper:[.76,.63,.53],lower:[.90,.78,.66]};
const HIP_COLORS={maximus:[.68,.39,.36],medius:[.82,.54,.47],minimus:[.78,.52,.46],piriformis:[.91,.59,.48],obturator:[.73,.49,.43],gemellusSuperior:[.78,.56,.47],gemellusInferior:[.78,.53,.46],quadratus:[.72,.48,.42]};
const HIP_HIDDEN={hipBone:'right-hip-bone',femur:'right-femur',sacrum:'sacrum'};
const KNEE_HIDDEN={femur:'right-femur',tibia:'right-tibia',fibula:'right-fibula',patella:'right-patella'};
const SHOULDER_HIDDEN={clavicle:'right-clavicle',scapula:'right-scapula',humerus:'right-humerus'};
const SHOULDER_COLORS={supraspinatus:[.85,.52,.40],infraspinatus:[.73,.40,.34],subscapularis:[.86,.57,.43],teresMinor:[.91,.63,.48],teresMajor:[.69,.39,.32],coracobrachialis:[.78,.51,.43],deltoidClavicular:[.81,.45,.38],deltoidAcromial:[.78,.41,.36],deltoidSpinal:[.72,.38,.35],bicepsLong:[.73,.49,.41],bicepsShort:[.73,.49,.41],pectoralisClavicular:[.80,.47,.38]};
const EXTENDED_MUSCLE_COLORS={skull:[.82,.53,.44],neck:[.77,.43,.38],thorax:[.79,.47,.37],elbow:[.84,.44,.36],wrist:[.86,.45,.34],ankle:[.85,.43,.37]};
const KNEE_COLORS={popliteus:[.80,.47,.39],vastusMedialis:[.87,.58,.48],vastusLateralis:[.74,.40,.36],vastusIntermedius:[.82,.53,.43],bicepsShort:[.67,.42,.37]};
const KNEE_MUSCLE_LAYERS={
 0:{popliteus:.74,vastusMedialis:.85,vastusLateralis:.85,vastusIntermedius:.60,bicepsShort:.80},
 1:{vastusMedialis:.54,vastusLateralis:.50,vastusIntermedius:.43},
 2:{popliteus:.90,bicepsShort:.84},
 3:{}
};
const SHOULDER_LAYERS={
 0:{teresMajor:.88,coracobrachialis:.75,deltoidClavicular:.9,deltoidAcromial:.9,deltoidSpinal:.9,pectoralisClavicular:.6,bicepsLong:.7,bicepsShort:.7},
 1:{supraspinatus:.88,infraspinatus:.90,subscapularis:.85,teresMinor:.95,teresMajor:.24},
 2:{supraspinatus:.88,infraspinatus:.9,subscapularis:.9,teresMinor:.96}
};
const DEPTH_HIP={
  0:{maximus:.79,medius:.24},
  1:{medius:.88,minimus:.48},
  2:{minimus:.16,piriformis:.90,obturator:.86,gemellusSuperior:.88,gemellusInferior:.88,quadratus:.86},
  3:{}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function create(canvas,onContextLost=()=>{}){
 let gl=null,program=null,buffers=[],status='loading',model=null;
 const detail=new Map(),detailData=new Map();let shoulderPivot=[-1.1,1.9,0],shoulderGraph=null;
 function cleanup(){if(gl){for(const item of [...buffers,...[...detail.values()].flat()])gl.deleteBuffer(item.buffer);if(program)gl.deleteProgram(program);}buffers=[];detail.clear();program=null;}
 function compile(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
 function setup(){
  gl=canvas.getContext('webgl2',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl){status='fallback';return false;}
  const vert=[
   '#version 300 es','precision highp float;','in vec3 aPosition;','in vec3 aNormal;','in float aSkinWeight;',
   'uniform vec2 uViewport;','uniform float uYaw;','uniform float uPitch;','uniform float uFrameSpan;','uniform float uZoom;','uniform vec3 uTarget;','uniform float uMotion;','uniform float uFlex;','uniform vec3 uPivot;','uniform float uMotionAxis;','uniform float uSoftSkin;','uniform float uJointGraph;','uniform mat4 uOriginPose;','uniform mat4 uInsertionPose;','out vec3 vNormal;',
   'void main(){','vec3 bone=aPosition;','vec3 n=aNormal;','float influence=uMotion>.5?1.:(uSoftSkin>.5?aSkinWeight:0.);','if(uJointGraph>.5){vec4 pt=vec4(aPosition,1.);bone=mix((uOriginPose*pt).xyz,(uInsertionPose*pt).xyz,aSkinWeight);n=normalize(mix(mat3(uOriginPose)*n,mat3(uInsertionPose)*n,aSkinWeight));}else if(influence>.00001){vec3 d=bone-uPivot;float ca=cos(uFlex*influence),sa=sin(uFlex*influence);bone=uPivot+(uMotionAxis>.5?vec3(d.x*ca-d.y*sa,d.x*sa+d.y*ca,d.z):vec3(d.x,d.y*ca-d.z*sa,d.y*sa+d.z*ca));n=uMotionAxis>.5?vec3(n.x*ca-n.y*sa,n.x*sa+n.y*ca,n.z):vec3(n.x,n.y*ca-n.z*sa,n.y*sa+n.z*ca);}','vec3 p=bone-uTarget;','float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);',
   'float x=p.x*cy+p.z*sy;','float z=p.z*cy-p.x*sy;','float y=p.y*cp-z*sp;','float z2=p.y*sp+z*cp;',
   'float scale=min(uViewport.x/3.25,uViewport.y/uFrameSpan)*uZoom;',
   'float w=max(.10,(7.4-z2)/7.4);',
   'gl_Position=vec4(x*scale/(uViewport.x*.5),y*scale/(uViewport.y*.5),-z2/15.0,w);',
   'vNormal=n;','}'
  ].join('\n');
  const frag=['#version 300 es','precision mediump float;','in vec3 vNormal;','uniform vec3 uColor;','uniform float uDim;','uniform float uAlpha;','out vec4 outColor;',
    'void main(){','float light=.60+.40*abs(dot(normalize(vNormal),normalize(vec3(.42,.70,.65))));',
    'outColor=vec4(uColor*light*uDim,uAlpha);','}'].join('\n');
  const vs=compile(gl.VERTEX_SHADER,vert),fs=compile(gl.FRAGMENT_SHADER,frag);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  return true;
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status='fallback';onContextLost('WebGL context lost');});
 canvas.addEventListener('webglcontextrestored',()=>{cleanup();try{setup();if(model)load(model);for(const [region,asset] of detailData)loadDetail(region,asset);}catch(e){status='fallback';onContextLost(e.message);}});
 try{setup();}catch(e){status='fallback';onContextLost(e.message);}
 function makeBuffer(part,id,group,color,tissue=false){
  if(!Array.isArray(part.vertices)||!Array.isArray(part.faces)||part.vertices.length<50||part.faces.length<50)throw Error('Incomplete sourced mesh: '+id);
  const vs=part.vertices,normal=new Float32Array(vs.length*3);
  for(const tri of part.faces){
   if(tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=vs.length))throw Error('Invalid sourced triangle: '+id);
   const [ia,ib,ic]=tri,a=vs[ia],b=vs[ib],c=vs[ic];
   if([a,b,c].some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Nonfinite coordinate: '+id);
   const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
   // Area-weighted shared-vertex normals: render polish only; original source
   // positions/topology and anatomical correspondence are never modified.
   const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   for(const index of tri)for(let j=0;j<3;j++)normal[index*3+j]+=n[j];
  }
  for(let i=0;i<vs.length;i++){
   const off=i*3,l=Math.hypot(normal[off],normal[off+1],normal[off+2])||1;
   for(let j=0;j<3;j++)normal[off+j]/=l;
  }
  const weights=part.skinWeights||null;
  if(weights&&(weights.length!==vs.length||weights.some(w=>!Number.isFinite(w)||w<0||w>1)))throw Error('Invalid anatomical skin weights: '+id);
  const flat=new Float32Array(part.faces.length*21);let cursor=0;
  for(const tri of part.faces){
   for(const i of tri){
    flat.set(vs[i],cursor);
    flat.set(normal.subarray(i*3,i*3+3),cursor+3);
    flat[cursor+6]=weights?weights[i]:0;
    cursor+=7;
   }
  }
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,flat,gl.STATIC_DRAW);
  return {id,group,color,tissue,buffer,verts:part.vertices,faces:part.faces,skinWeights:weights,rig:part.rig||null,count:part.faces.length*3};
 }
 function load(asset){
  if(asset.schema!=='body-live/atlas-skeleton-v1')throw Error('Unexpected skeleton schema');
  model=asset;if(!gl||status==='fallback')return false;
  cleanup();setup();
  buffers=asset.parts.map(part=>makeBuffer(part,part.id,part.group,COLORS[part.group]||COLORS.spine));
  status='ready';
  for(const [region,d] of detailData)loadDetail(region,d);
  return true;
 }
 function loadDetail(region,asset){
  if(!['hip','knee','shoulder'].includes(region)&&!window.BodyExtendedRegions?.has(region)||!model||(asset.source_commit!==model.source_commit&&asset.upstream_commit!==model.source_commit))throw Error('Detail reference does not match pinned Atlas release');
  const hip=region==='hip',shoulder=region==='shoulder',knee=region==='knee',extended=window.BodyExtendedRegions?.has(region);
  const allowed=extended?Object.fromEntries(Object.keys(asset.parts||{}).map(id=>[id,id])):shoulder?SHOULDER_HIDDEN:hip?HIP_HIDDEN:KNEE_HIDDEN;
  if(hip&&(asset.schema!=='body-live/hip-sourced-v1'||asset.license!=='CC BY 4.0'))throw Error('Invalid hip source license/schema');
  if(knee&&(asset.schema!=='body-live/sourced-knee-geometry-v1'||asset.license!=='CC BY 4.0'))throw Error('Invalid knee source license/schema');
  if(shoulder&&(asset.schema!=='body-live/shoulder-sourced-v1'||asset.license!=='CC BY 4.0'))throw Error('Invalid licensed shoulder source');
  const origin=shoulder||extended?[0,.9,0]:hip?[-.057,.895,-.045]:[-.09092915,.4491462,-.01654605];
  const factor=shoulder||extended?5:hip?10:7.5;
  const transform=shoulder||extended?asset.source_frame:hip?asset.shared_transform:asset.aligned_shared_transform;
  if(!transform)throw Error('Missing detail source transform');
  const actualOrigin=transform.origin_metres;
  const actualFactor=transform.scale||transform.scale_to_scene;
  if(!Array.isArray(actualOrigin)||actualOrigin.some((n,i)=>Math.abs(n-origin[i])>1e-6)||Math.abs(actualFactor-factor)>1e-6)throw Error('Detail model frame not matched to Atlas');
  if(!gl||status!=='ready')return false;
  const next=[];
  const entries=extended?[...Object.entries(asset.parts),...Object.entries(asset.muscle_parts||{})]:
   hip||shoulder?Object.entries(asset.parts):
    [...Object.entries(asset.bone_meshes),...Object.entries(asset.muscle_meshes||{})];
  const toWorld=part=>part.vertices.map(p=>p.map((v,i)=>(v/factor+origin[i]-[0,.9,0][i])*5));
  const worldParts=hip?Object.fromEntries(Object.entries(asset.parts).map(([id,p])=>[id,{vertices:toWorld(p)}])):
   knee?Object.fromEntries(entries.map(([id,p])=>[id,{vertices:toWorld(p)}])):null;
  if(knee&&Object.keys(asset.muscle_meshes||{}).length!==5)throw Error('Sourced knee muscles unavailable');
  try{
   for(const [id,part] of entries){
    const tissue=(hip||shoulder)&&!Object.hasOwn(allowed,id)||knee&&Object.hasOwn(asset.muscle_meshes||{},id)||extended&&Object.hasOwn(asset.muscle_parts||{},id);
    if(!tissue&&!Object.hasOwn(allowed,id))continue;
    const converted={vertices:toWorld(part),faces:part.faces};
    const color=tissue?(extended?EXTENDED_MUSCLE_COLORS[region]:shoulder?SHOULDER_COLORS[id]:hip?HIP_COLORS[id]:KNEE_COLORS[id]):(extended?COLORS[window.BodyExtendedRegions.config[region].group]:(shoulder?COLORS.upper:COLORS.lower));
    if(!color)throw Error('Unidentified tissue geometry: '+id);
    if((hip||knee)&&tissue){
      if(!window.BodyLowerLimbRig)throw Error('Lower limb rig unavailable');
      const rig=window.BodyLowerLimbRig.createSkin(region,id,converted.vertices,worldParts);
      converted.skinWeights=rig.weights;converted.rig=rig;
    }
    if(extended&&tissue){
     const rig=window.BodyExtendedRegions.createSkin(region,id,converted.vertices,asset.parts);
     if(rig){converted.skinWeights=rig.weights;converted.rig=rig;}
    }
    if(shoulder&&tissue){
      if(!window.BodyShoulderRig)throw Error('Shoulder attachment engine unavailable');
      const rig=window.BodyShoulderRig.createSkin(id,converted.vertices,asset.parts);
      converted.skinWeights=rig.weights;converted.rig=rig;
    }
    next.push(makeBuffer(converted,id,tissue?'tissue':extended?window.BodyExtendedRegions.config[region].group:'lower',color,tissue));
   }
   if(next.filter(p=>!p.tissue).length!==(extended?Object.keys(asset.parts).length:hip||shoulder?3:4))throw Error('Incomplete detailed bone registration');
  }catch(error){for(const p of next)gl.deleteBuffer(p.buffer);throw error;}
  for(const old of detail.get(region)||[])gl.deleteBuffer(old.buffer);
  if(shoulder){
    if(!window.BodyShoulderKinematics)throw Error('Shoulder kinematic graph missing');
    shoulderGraph=window.BodyShoulderKinematics.create(asset.parts);
    const vs=next.find(p=>p.id==='humerus')?.verts||[];
    if(vs.length<50)throw Error('Sourced humeral pivot unavailable');
    const high=Math.max(...vs.map(p=>p[1])),proximal=vs.filter(p=>p[1]>=high-.26);
    shoulderPivot=[0,1,2].map(i=>proximal.reduce((n,p)=>n+p[i],0)/proximal.length);
  }
  detail.set(region,next);detailData.set(region,asset);
  return true;
 }
 function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,canvas.getBoundingClientRect().width),h=Math.max(1,canvas.getBoundingClientRect().height);
  const width=Math.ceil(w*dpr),height=Math.ceil(h*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  return {width:w,height:h,dpr};
 }
 function render(camera,selected,mode='clean',layer=0,reveal=0,flex=0,highlight=null){
  const size=resize();if(!gl||status!=='ready')return size;
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);const uni=name=>gl.getUniformLocation(program,name);
  gl.uniform2f(uni('uViewport'),size.width,size.height);
  gl.uniform1f(uni('uYaw'),camera.yaw);gl.uniform1f(uni('uPitch'),camera.pitch);
  gl.uniform1f(uni('uZoom'),camera.zoom);gl.uniform1f(uni('uFrameSpan'),camera.frameSpan);
  gl.uniform3f(uni('uTarget'),camera.target.x,camera.target.y,camera.target.z);
  const locP=gl.getAttribLocation(program,'aPosition'),locN=gl.getAttribLocation(program,'aNormal'),locW=gl.getAttribLocation(program,'aSkinWeight');
  const shoulderPose=selected==='shoulder'&&shoulderGraph?shoulderGraph.pose(flex):null;
  const lowerPose=(selected==='hip'||selected==='knee')&&detail.has(selected)?window.BodyLowerLimbRig.pose(selected,flex):null;
  const extendedPose=window.BodyExtendedRegions?.has(selected)&&detailData.has(selected)
   ?window.BodyExtendedRegions.createPose(selected,detailData.get(selected),flex):null;
  const jointPose=shoulderPose||lowerPose||extendedPose;
  const draw=(item,dim=1,alpha=1)=>{
   const moving=(selected==='hip'&&item.id==='femur')||(selected==='knee'&&['tibia','fibula','patella'].includes(item.id))||(selected==='shoulder'&&item.id==='humerus');
   const pivot=selected==='hip'?[-.057*5,(.895-.9)*5,-.045*5]:selected==='shoulder'?shoulderPivot:[-.09092915*5,(.4491462+.08/7.5-.9)*5,-.01654605*5];
   if(jointPose){
    const kin=shoulderPose?window.BodyShoulderKinematics:extendedPose?window.BodyExtendedRegions:window.BodyLowerLimbRig;
    const root=item.rig?.fixedId||item.id;
    const origin=jointPose.matrices[root]||kin.identity();
    const insert=item.rig?(jointPose.matrices[item.rig.targetId||'humerus']||kin.identity()):origin;
    gl.uniform1f(uni('uJointGraph'),1);
    gl.uniformMatrix4fv(uni('uOriginPose'),false,origin);
    gl.uniformMatrix4fv(uni('uInsertionPose'),false,insert);
   }else gl.uniform1f(uni('uJointGraph'),0);
   gl.uniform1f(uni('uMotion'),moving?1:0);gl.uniform1f(uni('uSoftSkin'),item.skinWeights?1:0);gl.uniform1f(uni('uMotionAxis'),selected==='shoulder'?1:0);
   gl.uniform1f(uni('uFlex'),(selected==='shoulder'?-1:1)*Number(flex)*Math.PI/180);
   gl.uniform3fv(uni('uPivot'),pivot);
   gl.uniform3fv(uni('uColor'),item.id===highlight?[1,.81,.48]:item.color);gl.uniform1f(uni('uDim'),dim);gl.uniform1f(uni('uAlpha'),alpha);
   gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
   gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locP,3,gl.FLOAT,false,28,0);
   gl.enableVertexAttribArray(locN);gl.vertexAttribPointer(locN,3,gl.FLOAT,false,28,12);
   gl.enableVertexAttribArray(locW);gl.vertexAttribPointer(locW,1,gl.FLOAT,false,28,24);
   gl.drawArrays(gl.TRIANGLES,0,item.count);
  };
  const region=detail.has(selected)?selected:null;
  const r=clamp(Number(reveal)||0,0,1);
  const replaced=region?new Set(window.BodyExtendedRegions?.has(region)?detail.get(region).map(m=>m.id):Object.values(region==='shoulder'?SHOULDER_HIDDEN:region==='hip'?HIP_HIDDEN:KNEE_HIDDEN)):new Set();
  const showFocus=region&&r>.001;
  // Context is only an orientation cue; do not paint an entire second knee
  // over the selected right knee or occlude its sourced surfaces.
  for(const item of buffers){
   let opacity=1;
   if(region){
    if(replaced.has(item.id))opacity=1-r;
    else if((region==='hip'&&item.id==='left-hip-bone')||(region==='shoulder'&&item.id==='left-scapula'))opacity=1-r*.90;
    else opacity=1-r;
   }else if(selected){
    const group=['hip','knee','nerve'].includes(selected)?'lower':selected==='shoulder'?'upper':null;
    opacity=1;const dim=item.group===group?1:1-.7*r;
    if(mode==='evidence')draw(item,item.group==='lower'?.95:.37,1);
    else draw(item,dim,1);
    continue;
   }
   if(opacity<.015)continue;
   gl.depthMask(opacity>.98);
   draw(item,1,opacity);
  }
  gl.depthMask(true);
  if(showFocus){
   const meshes=detail.get(region);
   const bones=meshes.filter(p=>!p.tissue);
   // Meaningful knee depth states: isolate actual sourced components. Menisci
   // and ligaments are NOT silently fabricated just because a slider moved.
   const chosen=region==='knee'?(layer===1?new Set(['femur']):layer===2?new Set(['tibia','fibula']):layer===3?new Set(['patella']):null):null;
   for(const bone of bones){
    let a=r;
    if(region==='knee'&&chosen&&!chosen.has(bone.id))a*=.12;
    if(window.BodyExtendedRegions?.has(region)&&(layer===4||!window.BodyExtendedRegions.layers(region,bone.id,layer)))a*=layer===4?.14:.10;
    if(a<.02)continue;
    gl.depthMask(a>.98);
    draw(bone,(highlight&&highlight!==bone.id)?0.52:1,a);
   }
   gl.depthMask(true);
   if((region==='hip'||region==='shoulder'||region==='knee')&&r>0&&layer<3 || window.BodyExtendedRegions?.has(region)&&r>0&&(layer===0||layer===4)){
    const levels=window.BodyExtendedRegions?.has(region)?null:(region==='shoulder'?SHOULDER_LAYERS:region==='knee'?KNEE_MUSCLE_LAYERS:DEPTH_HIP)[clamp(Number(layer)||0,0,3)]||{};
    gl.depthMask(false);
    for(const mesh of meshes.filter(p=>p.tissue)){
     const a=(levels?levels[mesh.id]||0:layer===4?.93:.46)*r;
     if(a>.002)draw(mesh,(highlight&&highlight!==mesh.id)?0.48:1,a);
    }
    gl.depthMask(true);
   }
  }
  return size;
 }
 function hitTest(camera,region,layer,flex,x,y){
  if(!detail.has(region)||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return null;
  const core=window.BodySpatialCore;if(!core)return null;
  const pieces=detail.get(region),pivot=region==='hip'?[-.057*5,(.895-.9)*5,-.045*5]:region==='shoulder'?shoulderPivot:[-.09092915*5,(.4491462+.08/7.5-.9)*5,-.01654605*5];
  const moveIds=region==='hip'?new Set(['femur']):region==='shoulder'?new Set(['humerus']):new Set(['tibia','fibula','patella']);
  const chosen=region==='knee'?(layer===1?new Set(['femur']):layer===2?new Set(['tibia','fibula']):layer===3?new Set(['patella']):null):null;
  const hipLayers=(region==='shoulder'?SHOULDER_LAYERS:region==='knee'?KNEE_MUSCLE_LAYERS:DEPTH_HIP)[clamp(Number(layer)||0,0,3)]||{};
  const angle=Number(flex)*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
  const shoulderPose=region==='shoulder'&&shoulderGraph?shoulderGraph.pose(flex):null;
  const lowerPose=(region==='hip'||region==='knee')?window.BodyLowerLimbRig.pose(region,flex):null;
  const extendedPose=window.BodyExtendedRegions?.has(region)&&detailData.has(region)
   ?window.BodyExtendedRegions.createPose(region,detailData.get(region),flex):null;
  const jointPose=shoulderPose||lowerPose||extendedPose;
  let nearest=null,front=-Infinity;
  const projection={...camera,width,height};
  const within=(a,b,c)=>{
   const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
   if(Math.abs(den)<1e-8)return false;
   const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
   const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
   return u>=-.0001&&v>=-.0001&&u+v<=1.0001;
  };
  for(const mesh of pieces){
   if(mesh.tissue){
    if(extendedPose){if(layer!==0&&layer!==4)continue;}
    else if(!['hip','shoulder','knee'].includes(region)||layer>=3||!(hipLayers[mesh.id]>.15))continue;
   }else if(chosen&&!chosen.has(mesh.id))continue;
   else if(extendedPose&&(layer===4||!window.BodyExtendedRegions.layers(region,mesh.id,layer)))continue;
   const mapped=mesh.verts.map((v,index)=>{
    let p={x:v[0],y:v[1],z:v[2]};
    if(jointPose){
      const kin=shoulderPose?window.BodyShoulderKinematics:extendedPose?window.BodyExtendedRegions:window.BodyLowerLimbRig;
      const root=jointPose.matrices[mesh.rig?.fixedId||mesh.id]||kin.identity();
      const insert=mesh.rig?jointPose.matrices[mesh.rig.targetId||'humerus']||kin.identity():root;
      return core.project(kin.deformPoint(v,root,insert,mesh.skinWeights?.[index]||0),projection);
    }
    if(moveIds.has(mesh.id)&&Math.abs(angle)>.0001){
     const dy=p.y-pivot[1],dz=p.z-pivot[2];
     p=region==='shoulder'?{x:pivot[0]+(p.x-pivot[0])*ca+dy*sa,y:pivot[1]-(p.x-pivot[0])*sa+dy*ca,z:p.z}:{x:p.x,y:pivot[1]+dy*ca-dz*sa,z:pivot[2]+dy*sa+dz*ca};
    }
    return core.project(p,projection);
   });
   for(const face of mesh.faces){
    const a=mapped[face[0]],b=mapped[face[1]],c=mapped[face[2]];
    if(!a||!b||!c||!within(a,b,c))continue;
    const d=(a.z+b.z+c.z)/3;
    if(d>front){front=d;nearest={id:mesh.id,tissue:mesh.tissue,region};}
   }
  }
  return nearest;
 }
 function shoulderDiagnostics(flex=0){
  if(!shoulderGraph||!detail.has('shoulder'))return null;
  const pose=shoulderGraph.pose(flex),kin=window.BodyShoulderKinematics;
  const attachments={};
  for(const mesh of detail.get('shoulder')){
   if(!mesh.rig)continue;
   attachments[mesh.id]={
    origin:kin.transform(pose.matrices[mesh.rig.fixedId],mesh.rig.origin),
    insertion:kin.transform(pose.matrices.humerus,mesh.rig.insertion),
    inferred:true
   };
  }
  return {markers:pose.markers,rest:pose.rest,degrees:pose.degrees,
   elevation:pose.elevation,attachments,validated:false};
 }
 function dispose(){cleanup();model=null;shoulderGraph=null;detailData.clear();}
 return Object.freeze({load,loadDetail,hasDetail:region=>detail.has(region),render,hitTest,shoulderDiagnostics,resize,getStatus:()=>status,dispose,stats:()=>({partCount:buffers.length,triangles:buffers.reduce((n,b)=>n+b.count/3,0),webgl:status==='ready',detailRegions:[...detail.keys()],detailMeshes:[...detail.values()].reduce((n,items)=>n+items.length,0),riggedShoulderMuscles:(detail.get('shoulder')||[]).filter(p=>p.skinWeights).length,riggedHipMuscles:(detail.get('hip')||[]).filter(p=>p.skinWeights).length,riggedKneeMuscles:(detail.get('knee')||[]).filter(p=>p.skinWeights).length,coordinatedShoulder:!!shoulderGraph,expandedRegions:[...detail.keys()].filter(id=>window.BodyExtendedRegions?.has(id)),expandedMeshes:[...detail.entries()].filter(([id])=>window.BodyExtendedRegions?.has(id)).reduce((n,[,meshes])=>n+meshes.filter(x=>!x.tissue).length,0),expandedMuscles:[...detail.entries()].filter(([id])=>window.BodyExtendedRegions?.has(id)).reduce((n,[,meshes])=>n+meshes.filter(x=>x.tissue).length,0)})});
}
window.BodyAtlasRenderer=Object.freeze({create});
})();