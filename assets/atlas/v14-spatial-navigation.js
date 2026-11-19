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
 root.BodyV14SpatialNavigation=Object.freeze({create,meaningful,copy});
})(typeof window!=='undefined'?window:globalThis);
