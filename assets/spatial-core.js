/* BODY / LIVE Spatial Core v0.1.
 * Reusable perspective projection and unified pointer camera for anatomy scenes.
 * No clinical assumptions or geometry in this module.
 */
(function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 // All moving bones use a distance-preserving rigid transform. The choice of
 // hinge axis / origin is a teaching approximation, not measured biomechanics.
 function rotateAboutX(point, pivot, radians){
   const dy=point.y-pivot.y,dz=point.z-pivot.z,c=Math.cos(radians),s=Math.sin(radians);
   return {x:point.x,y:pivot.y+dy*c-dz*s,z:pivot.z+dy*s+dz*c};
 }
 function project(point,camera){
   const yaw=camera.yaw||0,pitch=camera.pitch||0;
   const yc=Math.cos(yaw),ys=Math.sin(yaw),xc=Math.cos(pitch),xs=Math.sin(pitch);
   const pivot=camera.target||{x:0,y:0,z:0};
   const dx=point.x-pivot.x,dy=point.y-pivot.y,dz=point.z-pivot.z;
   const x=dx*yc+dz*ys;
   const z=dz*yc-dx*ys;
   const y2=dy*xc-z*xs;
   const z2=dy*xs+z*xc;
   const view={x,y:y2,z:z2};
   const perspective=7.4/(7.4-z2);
   const scale=Math.min(camera.width/3.25,camera.height/(camera.frameSpan||6.65))*camera.zoom;
   return {x:camera.width*.50+x*scale*perspective,
     y:camera.height*(Number.isFinite(camera.anchorY)?camera.anchorY:.50)-(y2-.04)*scale*perspective,z:z2,world:view};
 }
 function attachOrbit(canvas,{state,render,pick,onInteract=()=>{},minZoom=.7,maxZoom=2.5}){
   const pointers=new Map();let origin=null,travel=false;
   const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
   function start(e){
     onInteract();
     pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     travel=false;
     if(pointers.size===1)origin={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch};
     else if(pointers.size===2)origin={distance:distance(),zoom:state.zoom};
     try{canvas.setPointerCapture(e.pointerId)}catch{}
   }
   function move(e){
     if(!pointers.has(e.pointerId))return;
     pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(pointers.size===2 && origin?.distance){
       state.zoom=clamp(origin.zoom*distance()/Math.max(1,origin.distance),minZoom,maxZoom);
       travel=true;render();
     } else if(pointers.size===1 && origin?.yaw!==undefined){
       const dx=e.clientX-origin.x,dy=e.clientY-origin.y;
       if(Math.abs(dx)+Math.abs(dy)>5)travel=true;
       if(travel){
         state.yaw=origin.yaw+dx*.0085;
         state.pitch=clamp(origin.pitch+dy*.005,-.65,.65);
         render();
       }
     }
   }
   function up(e){
     const tap=pointers.size===1 && !travel;
     pointers.delete(e.pointerId);
     if(tap){
       const bounds=canvas.getBoundingClientRect();
       pick(e.clientX-bounds.left,e.clientY-bounds.top);
     }
     if(pointers.size===1){
       const v=[...pointers.values()][0];
       origin={x:v.x,y:v.y,yaw:state.yaw,pitch:state.pitch};
     }else if(!pointers.size)origin=null;
   }
   function cancel(e){pointers.delete(e.pointerId);origin=null}
   function wheel(e){
     if(e.ctrlKey||e.shiftKey){
       onInteract();e.preventDefault();state.zoom=clamp(state.zoom*(e.deltaY<0?1.09:.91),minZoom,maxZoom);render();
     }
   }
   canvas.addEventListener('pointerdown',start);
   canvas.addEventListener('pointermove',move);
   canvas.addEventListener('pointerup',up);
   canvas.addEventListener('pointercancel',cancel);
   canvas.addEventListener('wheel',wheel,{passive:false});
   return ()=>{
     canvas.removeEventListener('pointerdown',start);
     canvas.removeEventListener('pointermove',move);
     canvas.removeEventListener('pointerup',up);
     canvas.removeEventListener('pointercancel',cancel);
     canvas.removeEventListener('wheel',wheel);
   };
 }
 window.BodySpatialCore=Object.freeze({version:'0.2',project,attachOrbit,rotateAboutX,clamp});
})();