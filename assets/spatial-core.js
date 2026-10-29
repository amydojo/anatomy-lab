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
   return {x:camera.width*(Number.isFinite(camera.anchorX)?camera.anchorX:.50)+x*scale*perspective,
     y:camera.height*(Number.isFinite(camera.anchorY)?camera.anchorY:.50)-(y2-.04)*scale*perspective,z:z2,world:view};
 }
 function attachOrbit(canvas,{state,render,pick,onInteract=()=>{},onDoubleTap=()=>{},minZoom=.7,maxZoom=2.5}){
   const pointers=new Map();
   let origin=null,travel=false,scheduled=0,lastTap=null,gestureStarted=false;
   const coords=()=>[...pointers.values()];
   const midpoint=()=>{const a=coords(),b=a[1]||a[0];return {x:(a[0].x+b.x)/2,y:(a[0].y+b.y)/2};};
   const distance=()=>{const [a,b]=coords();return Math.hypot(a.x-b.x,a.y-b.y)};
   const schedule=()=>{if(scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;render();})};
   function beginMove(){
     if(!gestureStarted){gestureStarted=true;onInteract();}
   }
   function dualOrigin(){
     origin={type:'dual',zoom:state.zoom,target:{...state.target},mid:midpoint(),distance:Math.max(1,distance()),yaw:state.yaw,pitch:state.pitch};
     travel=true;beginMove();
   }
   function start(e){
     pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(pointers.size===1){
       travel=false;gestureStarted=false;
       origin={type:'orbit',x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch};
     }else if(pointers.size===2)dualOrigin();
     try{canvas.setPointerCapture(e.pointerId)}catch{}
   }
   function move(e){
     if(!pointers.has(e.pointerId))return;
     pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(pointers.size>=2 && origin?.type==='dual'){
       const mid=midpoint();
       const zoom=clamp(origin.zoom*distance()/origin.distance,minZoom,maxZoom);
       // The camera target pans in the view plane, while zoom stays anchored
       // to the user's pinch centroid rather than jumping to canvas center.
       const bound=canvas.getBoundingClientRect();
       const units=Math.min(bound.width/3.25,bound.height/Math.max(.2,state.frameSpan));
       const oldScale=Math.max(.001,units*origin.zoom),newScale=Math.max(.001,units*zoom);
       const cy=Math.cos(origin.yaw),sy=Math.sin(origin.yaw),cp=Math.cos(origin.pitch),sp=Math.sin(origin.pitch);
       const right=[cy,0,sy],up=[sy*sp,cp,-cy*sp];
       const focalX=origin.mid.x-(bound.left+bound.width/2),focalY=origin.mid.y-(bound.top+bound.height/2);
       const difference=1/oldScale-1/newScale;
       const panX=(mid.x-origin.mid.x)/newScale,panY=(mid.y-origin.mid.y)/newScale;
       const shiftX=focalX*difference-panX,shiftY=-focalY*difference+panY;
       for(let i=0;i<3;i++)state.target[['x','y','z'][i]]=origin.target[['x','y','z'][i]]+
          right[i]*shiftX+up[i]*shiftY;
       state.zoom=zoom;travel=true;schedule();
     }else if(pointers.size===1 && origin?.type==='orbit'){
       const dx=e.clientX-origin.x,dy=e.clientY-origin.y;
       if(Math.abs(dx)+Math.abs(dy)>6){travel=true;beginMove();}
       if(travel){
         state.yaw=origin.yaw+dx*.008;
         state.pitch=clamp(origin.pitch+dy*.005,-.85,.85);
         schedule();
       }
     }
   }
   function up(e){
     if(!pointers.has(e.pointerId))return;
     const tap=pointers.size===1&&!travel&&origin?.type==='orbit';
     pointers.delete(e.pointerId);
     if(tap){
       const now=performance.now(),previous=lastTap;
       const double=previous&&now-previous.time<325&&
         Math.hypot(previous.x-e.clientX,previous.y-e.clientY)<28;
       if(double){lastTap=null;onDoubleTap(e);schedule();}
       else{
         lastTap={time:now,x:e.clientX,y:e.clientY};
         const bounds=canvas.getBoundingClientRect();
         pick(e.clientX-bounds.left,e.clientY-bounds.top);
       }
     }
     if(pointers.size===1){
       const v=coords()[0];
       origin={type:'orbit',x:v.x,y:v.y,yaw:state.yaw,pitch:state.pitch};
       travel=true;gestureStarted=true;
     }else if(!pointers.size){origin=null;gestureStarted=false;travel=false;}
   }
   function cancel(e){
     pointers.delete(e.pointerId);origin=null;travel=false;gestureStarted=false;
   }
   function wheel(e){
     if(!Number.isFinite(e.deltaY)||!e.deltaY)return;
     beginMove();e.preventDefault();
     state.zoom=clamp(state.zoom*(e.deltaY<0?1.09:.91),minZoom,maxZoom);
     schedule();
   }
   canvas.addEventListener('pointerdown',start);
   canvas.addEventListener('pointermove',move);
   canvas.addEventListener('pointerup',up);
   canvas.addEventListener('pointercancel',cancel);
   canvas.addEventListener('wheel',wheel,{passive:false});
   return ()=>{
     cancelAnimationFrame(scheduled);
     canvas.removeEventListener('pointerdown',start);
     canvas.removeEventListener('pointermove',move);
     canvas.removeEventListener('pointerup',up);
     canvas.removeEventListener('pointercancel',cancel);
     canvas.removeEventListener('wheel',wheel);
   };
 }
 window.BodySpatialCore=Object.freeze({version:'0.3',project,attachOrbit,rotateAboutX,clamp});
})();