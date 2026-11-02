/* Close-up camera tracker: conservative local patch tracking, never a body-pose claim. */
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function grayImage(image){
  const {width,height,data}=image;
  const gray=new Float32Array(width*height);
  for(let i=0,j=0;i<data.length;i+=4,j++)gray[j]=(.299*data[i]+.587*data[i+1]+.114*data[i+2])/255;
  return {width,height,gray};
}
export function makePatch(frame,x,y,radius=6){
  const cx=Math.round(x),cy=Math.round(y),w=frame.width,h=frame.height;
  if(cx-radius<0||cy-radius<0||cx+radius>=w||cy+radius>=h)return null;
  const data=new Float32Array((radius*2+1)**2);
  let min=1,max=0,mean=0,n=0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const v=frame.gray[(cy+dy)*w+cx+dx];data[n++]=v;mean+=v;min=Math.min(min,v);max=Math.max(max,v);
  }
  mean/=n;let variance=0;
  for(const v of data)variance+=(v-mean)**2;
  variance/=n;
  return {data,radius,x:cx,y:cy,variance,contrast:max-min};
}
function patchDifference(frame,template,x,y){
  const r=template.radius,w=frame.width,h=frame.height;
  if(x-r<0||y-r<0||x+r>=w||y+r>=h)return Infinity;
  let sum=0,i=0;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const d=frame.gray[(y+dy)*w+x+dx]-template.data[i++];
    sum+=Math.abs(d);
  }
  return sum/i;
}
export function matchPatch(frame,template,x,y,search=14){
  if(!template||template.variance<0.00024||template.contrast<.085)
    return {ok:false,reason:'Low-contrast anchor. Tap a visible contour or texture near the joint.'};
  let best={cost:Infinity,x:0,y:0},second=Infinity;
  const cx=Math.round(x),cy=Math.round(y);
  for(let dy=-search;dy<=search;dy+=2)for(let dx=-search;dx<=search;dx+=2){
    const atX=cx+dx,atY=cy+dy;
    const cost=patchDifference(frame,template,atX,atY);
    if(cost<best.cost){second=best.cost;best={cost,x:atX,y:atY};}
    else if(cost<second)second=cost;
  }
  // Refine in a small area without relying on a browser camera permission in tests.
  const coarse=best;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const atX=coarse.x+dx,atY=coarse.y+dy;
    const cost=patchDifference(frame,template,atX,atY);
    if(cost<best.cost)best={cost,x:atX,y:atY};
  }
  if(!Number.isFinite(best.cost)||best.cost>.115)
    return {ok:false,reason:'Image changed too much to locate this anchor.'};
  if(best.x<2||best.y<2||best.x>frame.width-3||best.y>frame.height-3)
    return {ok:false,reason:'Anchor reached the edge of the camera.'};
  return {ok:true,x:best.x,y:best.y,cost:best.cost,quality:clamp(1-best.cost/.115,0,1)};
}
export function makeCloseupTracker(){
  let anchors={},initialDistance=null,lost=false;
  return {
    reset(){anchors={};initialDistance=null;lost=false;},
    setAnchor(name,frame,x,y){
      if(!['elbow','wrist'].includes(name))throw Error('Unknown anchor');
      const patch=makePatch(frame,x,y);
      if(!patch||patch.variance<.00024||patch.contrast<.085)return {ok:false,reason:'Tap a well-lit edge or textured area beside the joint.'};
      anchors[name]={patch,x:patch.x,y:patch.y};
      initialDistance=anchors.elbow&&anchors.wrist?Math.hypot(anchors.elbow.x-anchors.wrist.x,anchors.elbow.y-anchors.wrist.y):null;
      lost=false;
      return {ok:true,ready:!!initialDistance};
    },
    get anchors(){return {elbow:anchors.elbow&&{x:anchors.elbow.x,y:anchors.elbow.y},wrist:anchors.wrist&&{x:anchors.wrist.x,y:anchors.wrist.y}};},
    get ready(){return !!initialDistance&&initialDistance>=18;},
    get lost(){return lost;},
    update(frame){
      if(!this.ready)return {ok:false,reason:'Tap your elbow, then wrist to set two anchors.'};
      const next={};
      for(const key of ['elbow','wrist']){
        const a=anchors[key],match=matchPatch(frame,a.patch,a.x,a.y);
        if(!match.ok){lost=true;return {ok:false,reason:match.reason};}
        next[key]=match;
      }
      const distance=Math.hypot(next.elbow.x-next.wrist.x,next.elbow.y-next.wrist.y);
      if(distance<18||Math.abs(distance-initialDistance)>Math.max(16,initialDistance*.3)){
        lost=true;return {ok:false,reason:'Arm alignment changed. Reset anchors and recalibrate.'};
      }
      for(const key of ['elbow','wrist']){anchors[key].x=next[key].x;anchors[key].y=next[key].y;}
      lost=false;
      return {ok:true,elbow:next.elbow,wrist:next.wrist,confidence:Math.min(next.elbow.quality,next.wrist.quality)};
    }
  };
}
