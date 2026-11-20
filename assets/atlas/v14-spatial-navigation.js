/* BODY / LIVE V14.2: camera-only history. No browser, selection or visibility state. */
(function(root){
 'use strict';
 const copy=c=>c&&({yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,
  anchorX:Number.isFinite(c.anchorX)?c.anchorX:.5,anchorY:Number.isFinite(c.anchorY)?c.anchorY:.5,
  target:{x:c.target.x,y:c.target.y,z:c.target.z}});
 const near=(a,b,e)=>Math.abs(a-b)<=e;
 function meaningful(a,b){
  if(!a||!b)return true;
  if(!near(a.yaw,b.yaw,.008)||!near(a.pitch,b.pitch,.008))return true;
  if(!near(a.zoom,b.zoom,Math.max(.012,a.zoom*.008))||!near(a.frameSpan,b.frameSpan,.012))return true;
  if(!near(a.anchorX,b.anchorX,.004)||!near(a.anchorY,b.anchorY,.004))return true;
  return ['x','y','z'].some(k=>!near(a.target[k],b.target[k],.008));
 }
 function create({capture,apply,limit=24}){
  const history=[];let origin=null;
  const snapshot=()=>copy(capture());
  const push=s=>{
   if(!s||history.length&&!meaningful(history[history.length-1],s))return false;
   history.push(copy(s));
   if(history.length>limit)history.shift();
   return true;
  };
  const begin=()=>{if(!origin)origin=snapshot();};
  const end=()=>{if(origin){if(meaningful(origin,snapshot()))push(origin);origin=null;}};
  const move=destination=>{
   end();const current=snapshot();
   if(!meaningful(current,destination))return false;
   push(current);apply(copy(destination));return true;
  };
  const back=()=>{
   end();const current=snapshot();
   while(history.length){
    const prior=history.pop();
    if(meaningful(prior,current)){apply(prior);return true;}
   }
   return false;
  };
  return Object.freeze({begin,end,move,back,clear(){history.length=0;origin=null;},
   state(){return {canBack:history.length>0,depth:history.length,camera:snapshot()};}});
 }
 // Conservative projected footprint: transform the eight corners of the real
 // mesh AABB. These are source-coordinates, not invented anatomical geometry.
 // An AABB may overestimate visible surface area, which is safe for a first Dive.
 function projectedBounds(bounds,camera,project){
  if(!bounds||!camera||typeof project!=='function')return null;
  const c=bounds.center;
  if(!c)return null;
  const lo=Array.isArray(bounds.min)?bounds.min:[c.x-bounds.radius,c.y-bounds.radius,c.z-bounds.radius];
  const hi=Array.isArray(bounds.max)?bounds.max:[c.x+bounds.radius,c.y+bounds.radius,c.z+bounds.radius];
  const vertices=[];
  for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]]){
   const p=project({x,y,z},camera);
   if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))vertices.push(p);
  }
  const point=project(c,camera);
  if(!vertices.length||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return null;
  const minX=Math.min(...vertices.map(v=>v.x)),maxX=Math.max(...vertices.map(v=>v.x));
  const minY=Math.min(...vertices.map(v=>v.y)),maxY=Math.max(...vertices.map(v=>v.y));
  return {x:point.x,y:point.y,minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY};
 }
 // Deliberate staged approach; unlike the legacy radius calculation it neither
 // forces 2.5x zoom nor jumps directly to 12x for a narrow meniscus mesh.
 function diveFrame({camera,bounds,step=0,project}){
  const footprint=projectedBounds(bounds,camera,project);
  if(!footprint)return null;
  const size=Math.max(1,footprint.width,footprint.height);
  const viewport=Math.max(1,Math.min(camera.width,camera.height));
  const ratio=viewport*(step===0?.26:.44)/size;
  const factor=step===0?Math.max(1,Math.min(1.85,ratio)):Math.max(1.22,Math.min(1.72,ratio));
  const zoom=Math.min(14,Math.max(.7,camera.zoom*factor));
  const weight=step===0?.78:1;
  return {...copy(camera),zoom,anchorX:.5,anchorY:.5,
   target:{x:camera.target.x+(bounds.center.x-camera.target.x)*weight,
    y:camera.target.y+(bounds.center.y-camera.target.y)*weight,
    z:camera.target.z+(bounds.center.z-camera.target.z)*weight}};
 }
 // Hysteresis stops the recover cue blinking on/off near screen edges.
 function needsRecovery(footprint,width,height,alreadyVisible=false){
  if(!footprint||!width||!height)return false;
  const inset=alreadyVisible?.18:.10;
  const x=footprint.x,y=footprint.y;
  return x<width*inset||x>width*(1-inset)||y<height*inset||y>height*(1-inset);
 }
 root.BodyV14SpatialNavigation=Object.freeze({create,meaningful,copy,projectedBounds,diveFrame,needsRecovery});
})(typeof window!=='undefined'?window:globalThis);
