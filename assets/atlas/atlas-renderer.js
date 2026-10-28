/* V6 source-derived skeletal context WebGL2; source coordinates unchanged. */
(function(){'use strict';
const COLORS={head:[.89,.78,.66],thorax:[.83,.69,.55],spine:[.72,.60,.49],upper:[.76,.63,.53],lower:[.90,.78,.66]};
function create(canvas,onContextLost=()=>{}){
 let gl=null,program=null,buffers=[],status='loading',model=null;
 const cleanup=()=>{if(gl){for(const item of buffers)gl.deleteBuffer(item.buffer);if(program)gl.deleteProgram(program);}buffers=[];program=null;};
 function compile(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
 function setup(){
  gl=canvas.getContext('webgl2',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl){status='fallback';return false;}
  const vert=[
 '#version 300 es','precision highp float;','in vec3 aPosition;','in vec3 aNormal;',
 'uniform vec2 uViewport;','uniform float uYaw;','uniform float uPitch;','uniform float uFrameSpan;','uniform float uZoom;','uniform vec3 uTarget;','out vec3 vNormal;',
 'void main(){','vec3 p=aPosition-uTarget;','float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);',
 'float x=p.x*cy+p.z*sy;','float z=p.z*cy-p.x*sy;','float y=p.y*cp-z*sp;','float z2=p.y*sp+z*cp;',
 'float scale=min(uViewport.x/3.25,uViewport.y/uFrameSpan)*uZoom;',
 'float w=max(.10,(7.4-z2)/7.4);',
 'gl_Position=vec4(x*scale/(uViewport.x*.5),y*scale/(uViewport.y*.5),-z2/15.0,w);',
 'vNormal=aNormal;','}'
 ].join('\n');
 const frag=['#version 300 es','precision mediump float;','in vec3 vNormal;','uniform vec3 uColor;','uniform float uDim;','out vec4 outColor;',
 'void main(){','float light=.60+.40*abs(dot(normalize(vNormal),normalize(vec3(.42,.70,.65))));',
 'outColor=vec4(uColor*light*uDim,1.0);','}'].join('\n');
  const vs=compile(gl.VERTEX_SHADER,vert),fs=compile(gl.FRAGMENT_SHADER,frag);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  return true;
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status='fallback';onContextLost('WebGL context lost');});
 canvas.addEventListener('webglcontextrestored',()=>{cleanup();try{setup();if(model)load(model);}catch(e){status='fallback';onContextLost(e.message)}});
 try{setup()}catch(e){status='fallback';onContextLost(e.message);}
 function load(asset){
  if(asset.schema!=='body-live/atlas-skeleton-v1')throw Error('Unexpected skeleton schema');
  model=asset;
  if(!gl||status==='fallback')return false;
  cleanup();setup();
  for(const part of asset.parts){
    const flat=new Float32Array(part.faces.length*3*6);let cursor=0;
    for(const tri of part.faces){
      const a=part.vertices[tri[0]],b=part.vertices[tri[1]],c=part.vertices[tri[2]];
      const v=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      let n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
      const ln=Math.hypot(...n)||1;n=n.map(x=>x/ln);
      for(const p of [a,b,c]){flat.set([p[0],p[1],p[2],...n],cursor);cursor+=6;}
    }
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,flat,gl.STATIC_DRAW);
    buffers.push({id:part.id,group:part.group,buffer,count:part.faces.length*3});
  }
  status='ready';return true;
 }
 function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,canvas.getBoundingClientRect().width),h=Math.max(1,canvas.getBoundingClientRect().height);
  const width=Math.ceil(w*dpr),height=Math.ceil(h*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  return {width:w,height:h,dpr};
 }
 function render(camera,selected,mode='clean'){
  const size=resize();if(!gl||status!=='ready')return size;
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);const uni=name=>gl.getUniformLocation(program,name);
  gl.uniform2f(uni('uViewport'),size.width,size.height);
  gl.uniform1f(uni('uYaw'),camera.yaw);gl.uniform1f(uni('uPitch'),camera.pitch);
  gl.uniform1f(uni('uZoom'),camera.zoom);gl.uniform1f(uni('uFrameSpan'),camera.frameSpan);
  gl.uniform3f(uni('uTarget'),camera.target.x,camera.target.y,camera.target.z);
  const locP=gl.getAttribLocation(program,'aPosition'),locN=gl.getAttribLocation(program,'aNormal');
  for(const item of buffers){
    let dim=1;
    if(selected){const target=['hip','knee','nerve'].includes(selected)?'lower':selected==='shoulder'?'upper':selected==='thorax'?'thorax':null;dim=item.group===target?1:.31;}
    if(mode==='evidence'&&selected)dim=item.group==='lower'?.96:.37;
    gl.uniform3fv(uni('uColor'),COLORS[item.group]||COLORS.spine);gl.uniform1f(uni('uDim'),dim);
    gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
    gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locP,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(locN);gl.vertexAttribPointer(locN,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,item.count);
  }return size;
 }
 function dispose(){cleanup();model=null;}
 return Object.freeze({load,render,resize,getStatus:()=>status,dispose,stats:()=>({partCount:buffers.length,triangles:buffers.reduce((n,b)=>n+b.count/3,0),webgl:status==='ready'})});
}
window.BodyAtlasRenderer=Object.freeze({create});
})();