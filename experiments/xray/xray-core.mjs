/* BODY / LIVE X-RAY experiment. This is illustrative 2D anatomy, not a scan. */
export const ARM = Object.freeze({left:[11,13,15],right:[12,14,16]});
export const STRUCTURES = Object.freeze({
  biceps:{name:'Biceps brachii',group:'muscle',description:'Flexes the elbow and helps supinate the forearm. The drawn belly is a teaching approximation.'},
  brachialis:{name:'Brachialis',group:'muscle',description:'A primary elbow flexor beneath biceps brachii. Its illustrated contour is not an individualized attachment map.'},
  brachioradialis:{name:'Brachioradialis',group:'muscle',description:'Assists elbow flexion, especially with the forearm in a neutral position.'},
  triceps:{name:'Triceps brachii',group:'muscle',description:'Extends the elbow. Posterior placement here is inferred, not measured by the camera.'},
  flexors:{name:'Forearm flexor group',group:'muscle',description:'A simplified forearm muscle group; the camera does not identify individual muscles.'},
  extensors:{name:'Forearm extensor group',group:'muscle',description:'A schematic extensor region, not a measured muscle boundary.'},
  humerus:{name:'Humerus',group:'bone',source:'right-humerus',description:'Upper-arm bone forming the proximal part of the elbow joint.'},
  radius:{name:'Radius',group:'bone',source:'right-radius',description:'Forearm bone on the thumb side. Rotation about the ulna is not captured by this 2D rig.'},
  ulna:{name:'Ulna',group:'bone',source:'right-ulna',description:'Forearm bone that forms the primary hinge articulation with the humerus.'},
  tendon:{name:'Distal biceps tendon',group:'connective',description:'Connects biceps brachii to the radius. This simplified line does not identify an actual tendon.'},
  ligament:{name:'Elbow collateral ligaments',group:'connective',description:'Medial and lateral stabilizing ligament complexes. Placement and tension are schematic.'}
});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function angleDegrees(a,b,c){
  const v=[a.x-b.x,a.y-b.y],w=[c.x-b.x,c.y-b.y];
  const l1=Math.hypot(...v),l2=Math.hypot(...w);
  if(l1<1e-6||l2<1e-6)return null;
  return Math.acos(clamp((v[0]*w[0]+v[1]*w[1])/(l1*l2),-1,1))*180/Math.PI;
}
export function readArm(result,side='right',minimum=.52){
  const ids=ARM[side];if(!ids)throw Error('Unknown arm side');
  const lm=result?.landmarks?.[0];
  if(!lm)return {ok:false,reason:'No body in frame. Include shoulder, elbow and wrist.'};
  const trio=ids.map(i=>lm[i]);
  if(trio.some(p=>!point(p)))return {ok:false,reason:'Arm landmarks unavailable.'};
  if(trio.some(p=>p.x<0||p.x>1||p.y<0||p.y>1))return {ok:false,reason:'Keep shoulder, elbow and wrist inside the camera view.'};
  const quality=Math.min(...trio.map(p=>Math.min(p.visibility??0,p.presence??1)));
  if(quality<minimum)return {ok:false,confidence:quality,reason:'Arm partially hidden. Move back or improve lighting.'};
  const [shoulder,elbow,wrist]=trio.map(p=>({x:p.x,y:p.y}));
  const upper=Math.hypot(shoulder.x-elbow.x,shoulder.y-elbow.y);
  const lower=Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y);
  // Severely foreshortened limbs cannot produce a credible elbow axis in 2D.
  if(upper<.055||lower<.055)return {ok:false,confidence:quality,reason:'Arm is foreshortened. Turn sideways to the camera.'};
  const angle=angleDegrees(shoulder,elbow,wrist);
  return {ok:true,shoulder,elbow,wrist,confidence:quality,angle,flexion:180-angle,side};
}
export function createSmoother(halfLifeMs=65){
  let previous=null,at=null;
  return {
    update(sample,time){
      if(!sample?.ok){previous=null;at=null;return sample;}
      if(!previous){previous=sample;at=time;return sample;}
      const dt=clamp(time-at,1,180),mix=1-Math.pow(.5,dt/halfLifeMs);
      const smoothed={...sample};
      for(const k of ['shoulder','elbow','wrist'])
        smoothed[k]={x:previous[k].x+(sample[k].x-previous[k].x)*mix,y:previous[k].y+(sample[k].y-previous[k].y)*mix};
      smoothed.angle=angleDegrees(smoothed.shoulder,smoothed.elbow,smoothed.wrist);
      smoothed.flexion=180-smoothed.angle;
      previous=smoothed;at=time;return smoothed;
    },
    reset(){previous=null;at=null;}
  };
}
export function createTrackingState(){
  let status='idle';
  return {
    event(event){
      if(event==='stop')status='idle';
      else if(event==='start'&&(status==='idle'||status==='lost'||status==='paused'))status='acquiring';
      else if(event==='found'&&['acquiring','tracking','lost'].includes(status))status='tracking';
      else if(event==='missing'&&['acquiring','tracking','lost'].includes(status))status='lost';
      else if(event==='pause'&&['acquiring','tracking','lost'].includes(status))status='paused';
      return status;
    },
    get status(){return status;}
  };
}
export function coverPoint(p,videoWidth,videoHeight,width,height){
  const factor=Math.max(width/videoWidth,height/videoHeight);
  const left=(width-videoWidth*factor)/2,top=(height-videoHeight*factor)/2;
  return {x:left+p.x*videoWidth*factor,y:top+p.y*videoHeight*factor};
}
const add=(p,v,n=1)=>({x:p.x+v.x*n,y:p.y+v.y*n});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a,b,t)=>add(a,sub(b,a),t);
const unit=p=>{const n=Math.hypot(p.x,p.y)||1;return {x:p.x/n,y:p.y/n};};
const normal=v=>({x:-v.y,y:v.x});
const fmt=p=>p.x.toFixed(2)+' '+p.y.toFixed(2);
export function bonePath(a,b,width){
 const n=normal(unit(sub(b,a)));
 const a1=add(a,n,width),a2=add(a,n,-width),b1=add(b,n,width*.75),b2=add(b,n,-width*.75);
 return 'M '+fmt(a1)+' L '+fmt(b1)+' Q '+fmt(add(b,unit(sub(b,a)),width*.7))+' '+fmt(b2)+' L '+fmt(a2)+' Q '+fmt(add(a,unit(sub(a,b)),width*.7))+' '+fmt(a1)+' Z';
}
export function musclePath(a,b,width,offset=0){
 const n=normal(unit(sub(b,a))), start=add(a,n,offset),end=add(b,n,offset);
 const p1=mul(start,end,.28),p2=mul(start,end,.72);
 return 'M '+fmt(start)+' C '+fmt(add(p1,n,width*.72))+' '+fmt(add(p2,n,width))+' '+fmt(end)+' C '+fmt(add(p2,n,-width))+' '+fmt(add(p1,n,-width*.72))+' '+fmt(start)+' Z';
}
export function rigGeometry(pose,videoSize,viewport,calibration={}){
 if(!pose?.ok)return [];
 const scale=clamp(Number(calibration.scale)||1,.65,1.5);
 const rot=(Number(calibration.rotation)||0)*Math.PI/180;
 const x=(Number(calibration.x)||0),y=(Number(calibration.y)||0);
 const coordinates=['shoulder','elbow','wrist'].map(k=>coverPoint(pose[k],videoSize.width,videoSize.height,viewport.width,viewport.height));
 const [rawS,rawE,rawW]=coordinates;
 const transform=p=>{const dx=p.x-rawE.x,dy=p.y-rawE.y;return {x:rawE.x+x+scale*(dx*Math.cos(rot)-dy*Math.sin(rot)),y:rawE.y+y+scale*(dx*Math.sin(rot)+dy*Math.cos(rot))};};
 const [s,e,w]=coordinates.map(transform);
 const u=unit(sub(e,s)),v=unit(sub(w,e));
 const n=normal(u),m=normal(v);
 const upper=Math.hypot(e.x-s.x,e.y-s.y),lower=Math.hypot(w.x-e.x,w.y-e.y);
 const thickness=clamp(Math.min(upper,lower)*.14,5,25);
 const bones=[
 {id:'humerus',d:bonePath(mul(s,e,.10),mul(s,e,1.02),thickness*.43)},
 {id:'radius',d:bonePath(add(mul(e,w,.08),m,thickness*.29),add(mul(e,w,.94),m,thickness*.26),thickness*.25)},
 {id:'ulna',d:bonePath(add(mul(e,w,.02),m,-thickness*.31),add(mul(e,w,.98),m,-thickness*.29),thickness*.26)}
 ];
 const muscles=[
 {id:'brachialis',d:musclePath(mul(s,e,.30),mul(s,e,.95),thickness*.55,-thickness*.10)},
 {id:'biceps',d:musclePath(mul(s,e,.13),mul(s,e,.81),thickness*.96,thickness*.53)},
 {id:'triceps',d:musclePath(mul(s,e,.08),mul(s,e,.93),thickness*.72,-thickness*.83)},
 {id:'brachioradialis',d:musclePath(mul(e,w,.06),mul(e,w,.76),thickness*.53,thickness*.62)}
 ];
 const connective=[
 {id:'tendon',d:bonePath(add(mul(s,e,.83),n,thickness*.5),add(mul(e,w,.24),m,thickness*.35),thickness*.12)},
 {id:'ligament',d:bonePath(add(mul(s,e,.89),n,-thickness*.54),add(mul(e,w,.20),m,-thickness*.49),thickness*.15)}
 ];
 return [...bones,...muscles,...connective].map(shape=>({...shape,group:STRUCTURES[shape.id].group}));
}
/* V2 pose lock: visibility alone is not anatomical confidence. The lock requires
   plausible dimensions and multiple spatially consistent frames. */
export function plausibleFullArm(sample){
  if(!sample?.ok)return {ok:false,reason:sample?.reason||'Pose not detected'};
  const a=sample.shoulder,b=sample.elbow,c=sample.wrist;
  const upper=Math.hypot(a.x-b.x,a.y-b.y);
  const lower=Math.hypot(c.x-b.x,c.y-b.y);
  const span=Math.hypot(a.x-c.x,a.y-c.y);
  if(upper<.115||lower<.115||upper>.85||lower>.85)
    return {ok:false,reason:'Need a clear, full arm. Move back until shoulder, elbow and wrist are visible.'};
  const ratio=upper/lower;
  if(ratio<.42||ratio>2.4||sample.angle<22||sample.angle>180||span<.09)
    return {ok:false,reason:'Implausible joint geometry; reposition the camera.'};
  if((sample.confidence??0)<.62)
    return {ok:false,reason:'Landmark visibility too low for a stable lock.'};
  return {ok:true};
}
export function createPoseLock(required=5){
  let count=0,previous=null,locked=false;
  return {
    update(sample){
      const validity=plausibleFullArm(sample);
      if(!validity.ok){count=0;previous=null;locked=false;return {ok:false,locked:false,reason:validity.reason};}
      if(previous){
        const delta=Math.max(...['shoulder','elbow','wrist'].map(k=>Math.hypot(sample[k].x-previous[k].x,sample[k].y-previous[k].y)));
        const angleDelta=Math.abs(sample.angle-previous.angle);
        if(delta>.075||angleDelta>28){count=0;locked=false;}
      }
      count++;previous=sample;
      locked=count>=required;
      return {ok:true,locked,count,required,reason:locked?'':'Hold your full arm steadily for tracking lock.'};
    },
    reset(){count=0;previous=null;locked=false;},
    get locked(){return locked;}
  };
}
/* No fabricated shoulder for a close-up. Only draw structures between the two
   user-calibrated anchors, and do not report an elbow flexion angle. */
export function closeupGeometry(elbow,wrist){
  const vec=sub(wrist,elbow),length=Math.hypot(vec.x,vec.y);
  if(length<30)return [];
  const n=normal(unit(vec)),thickness=clamp(length*.095,7,24);
  const shape=[
    {id:'radius',d:bonePath(add(mul(elbow,wrist,.06),n,thickness*.34),add(mul(elbow,wrist,.96),n,thickness*.27),thickness*.30)},
    {id:'ulna',d:bonePath(add(mul(elbow,wrist,.02),n,-thickness*.35),add(mul(elbow,wrist,.98),n,-thickness*.28),thickness*.29)},
    {id:'brachioradialis',d:musclePath(mul(elbow,wrist,.03),mul(elbow,wrist,.77),thickness*.68,thickness*.78)},
    {id:'flexors',d:musclePath(mul(elbow,wrist,.07),mul(elbow,wrist,.82),thickness*.92,-thickness*.66)},
    {id:'extensors',d:musclePath(mul(elbow,wrist,.10),mul(elbow,wrist,.80),thickness*.67,thickness*.22)},
    {id:'ligament',d:bonePath(add(elbow,n,-thickness*.65),add(mul(elbow,wrist,.18),n,-thickness*.38),thickness*.16)}
  ];
  return shape.map(p=>({...p,group:STRUCTURES[p.id].group}));
}
