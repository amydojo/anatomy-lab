/* MARROW I — exact 3D magnetic surface traversal. No heightfield as movement domain.
 * Fictional adhesion; source triangles are immutable and every contact is a ray hit.
 */
(function(root){'use strict';
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=(a,f=[0,1,0])=>len(a)>1e-8?mul(a,1/len(a)):f.slice(),plane=(a,n)=>sub(a,mul(n,dot(a,n))),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>add(mul(a,1-t),mul(b,t)),damp=(r,t)=>1-Math.exp(-r*t),STEP=1/120,H=.011;
function tangent(n,f){let a=plane(f,n);if(len(a)<1e-6)a=plane(Math.abs(n[0])<.8?[1,0,0]:[0,0,1],n);return unit(a);}
function transport(v,a,b){const axis=cross(a,b),c=clamp(dot(a,b),-1,1),s=len(axis);if(s<1e-7)return c>0?v.slice():mul(v,-1);const k=mul(axis,1/s);return add(add(mul(v,c),mul(cross(k,v),s)),mul(k,dot(k,v)*(1-c)));}
function approachNormal(a,b,dt,rate=10,maxRate=6){const theta=Math.acos(clamp(dot(a,b),-1,1));if(theta<1e-7)return b.slice();const axis=cross(a,b);if(len(axis)<1e-7)return unit(mix(a,b,Math.min(.45,damp(rate,dt))),a);return unit(rotate(a,unit(axis),Math.min(theta*damp(rate,dt),maxRate*dt)),a);}
function rotate(v,n,a){return add(add(mul(v,Math.cos(a)),mul(cross(n,v),Math.sin(a))),mul(n,dot(n,v)*(1-Math.cos(a))));}
function contact(w,p,n,f,id,travel){const r=unit(cross(f,n)),dirs=[n,unit(add(n,mul(f,.65))),unit(sub(n,mul(f,.65))),unit(add(n,mul(r,.65))),unit(sub(n,mul(r,.65))),unit(add(n,mul(f,1.6))),unit(sub(n,mul(f,1.6)))];let best=null,score=Infinity;
 for(const d of dirs){const h=w.ray(add(p,mul(d,.019)),mul(d,-1),.046);if(!h||dot(h.normal,n)<.06)continue;const q=add(h.point,mul(h.normal,H)),gap=len(sub(q,p));if(gap>.021)continue;if(travel){const delta=sub(q,travel.old),surfaceDelta=sub(h.point,sub(travel.old,mul(n,H)));if(dot(surfaceDelta,travel.dir)<travel.length*.18||travel.desired&&dot(surfaceDelta,travel.desired)<travel.length*.12||len(delta)>Math.max(travel.length*2.7,.0018))continue;}const rank=gap+(1-dot(n,h.normal))*.009+(h.id!==id?.006:0);if(rank<score){score=rank;best={...h,q};}if(gap<.003&&dot(n,h.normal)>.85&&h.id===id)break;}
 return best;}
function create(world,hit,opts={}){const home={...hit,point:hit.point.slice(),normal:hit.normal.slice()},bounds=opts.bounds||{min:[-10,-10,-10],max:[10,10,10]};let n=unit(hit.normal),frame=tangent(n,hit.forward||[0,0,-1]),p=add(hit.point,mul(n,H)),v=[0,0,0],acc=0,prev=null,lock=false,liftGrace=0,capture=0,jump=false,toggle=false,landPending=false,blocked=false,air=0,flightUp=n.slice(),landing=null,stall=0,escapeSide=0,visualForward=frame.slice(),viewFrame=frame.slice(),prevVisual=frame.slice();
 const s={p:p.slice(),n:n.slice(),f:frame.slice(),frame:frame.slice(),v:v.slice(),id:hit.id,name:hit.name,ground:true,glide:false,flightState:'ride',mode:'magnetic',steps:0,groundSteps:0,glideSteps:0,glideEntries:0,air:0,maxAir:0,distance:0,rideDistance:0,glideDistance:0,landings:0,falls:0,remounts:0,transfers:0,edgeSaves:0,edgeBlocked:false,grind:false,grindDistance:0,grindEntries:0,grindSource:null,collisions:0,routeSpan:0,uniqueCells:0,bank:0,capture:0,landingGap:null,landingSource:null,touchdownSpeed:0,touchdownCarry:0,touchdownNormalSpeed:0,impact:0,minNormalY:n[1],maxNormalTurn:0,contactLosses:0,explicitFlights:0,blockedSteps:0,longestBlock:0,recoveries:0,contactCorrectionMax:0,rawNormalTurnMax:0,visualNormalTurnMax:0};const start=p.slice(),cells=new Set(),pose=()=>({p:s.p.slice(),n:s.n.slice(),f:s.f.slice(),frame:s.frame.slice()});prev=pose();
 function reset(){n=unit(home.normal);frame=tangent(n,home.forward||[0,0,-1]);p=add(home.point,mul(n,H));v=[0,0,0];lock=false;capture=liftGrace=air=acc=0;jump=toggle=landPending=false;landing=null;blocked=false;stall=0;escapeSide=0;visualForward=frame.slice();viewFrame=frame.slice();prevVisual=frame.slice();Object.assign(s,{p:p.slice(),n:n.slice(),f:frame.slice(),frame:frame.slice(),v:v.slice(),id:home.id,name:home.name,ground:true,glide:false,flightState:'ride',edgeBlocked:false,grind:false,grindSource:null,air:0,capture:0,landingGap:null,landingSource:null});s.remounts++;prev=pose();}
 function setContact(h){const old=n;n=unit(h.normal);s.rawNormalTurnMax=Math.max(s.rawNormalTurnMax,Math.acos(clamp(dot(old,n),-1,1)));frame=tangent(n,transport(frame,old,n));v=transport(v,old,n);s.f=tangent(n,transport(s.f,old,n));if(s.id!==h.id)s.transfers++;s.id=h.id;s.name=h.name;p=h.q||add(h.point,mul(n,H));s.minNormalY=Math.min(s.minNormalY,n[1]);s.maxNormalTurn=Math.max(s.maxNormalTurn,Math.acos(clamp(dot(home.normal,n),-1,1)));cells.add(h.id+':'+h.point.map(x=>Math.round(x/.012)).join(','));}
 function launch(manual){s.ground=false;s.glide=true;s.glideEntries++;if(manual)s.explicitFlights++;s.flightState='glide';flightUp=n.slice();v=add(v,mul(n,.065));air=0;capture=0;landing=null;liftGrace=.24;s.edgeBlocked=false;s.grind=false;}
 function findLanding(up,dir){const right=unit(cross(frame,up)),dirs=[mul(up,-1),unit(add(mul(up,-1),mul(dir,.55))),unit(sub(mul(up,-1),mul(dir,.55))),unit(add(mul(up,-1),mul(right,.8))),unit(sub(mul(up,-1),mul(right,.8))),[0,-1,0]];let best=null,score=Infinity;for(const d of dirs){const h=world.ray(p,d,.38);if(!h)continue;const q=add(h.point,mul(h.normal,H)),gap=len(sub(q,p));if(gap>.35||dot(h.normal,d)>-.25)continue;const rank=gap+(1-dot(h.normal,up))*.025+(h.id===s.id?0:.01);if(rank<score){score=rank;best={...h,q,gap};}}return best;}
 function step(i){s.steps++;const old=p.slice(),oldVisualNormal=s.n.slice(),brake=clamp(i.brake||0,0,1),throttle=clamp(i.push||0,0,1),base=.18+.13*(i.boost||0),wantedSpeed=base*throttle*(1-brake),lift=!!i.assist;
  if(i.flightToggle){if(s.ground){lock=true;launch(true);}else lock=!lock;}
  if(i.land){lock=false;landPending=true;}if(lift){lock=false;landPending=false;liftGrace=.24;}else liftGrace=Math.max(0,liftGrace-STEP);
  const up=s.ground?n:flightUp,forward=tangent(up,frame),right=unit(cross(forward,up)),input=i.stick;
  let desired=input&&Math.hypot(...input)>.001?unit(add(mul(right,input[0]),mul(forward,-input[1]))):i.direction?tangent(up,i.direction):s.f;
  if(Number.isFinite(i.controlYaw)&&input&&Math.hypot(...input)>.001){const cf=rotate(forward,up,i.controlYaw),cr=unit(cross(cf,up));desired=unit(add(mul(cr,input[0]),mul(cf,-input[1])));}
  else if(i.cameraForward&&input&&Math.hypot(...input)>.001){const projected=plane(i.cameraForward,up),cf=len(projected)>.25?unit(projected):forward,cr=unit(cross(cf,up));desired=unit(add(mul(cr,input[0]),mul(cf,-input[1])));}
  if(s.ground&&(lift||jump)){launch(true);if(jump){v=add(v,mul(n,.14));lock=false;}jump=false;}
  if(s.ground){
   const speed=len(v),goal=mul(desired,wantedSpeed);v=mix(plane(v,n),goal,damp(brake?18:throttle?9:5,STEP));const d=len(v)*STEP;
   if(d>1e-7){let h=null;const dir=unit(v),pred=add(p,mul(dir,d));h=contact(world,pred,n,dir,s.id,{old:p,dir,length:d,desired});
    const qualifies=h=>h&&len(sub(h.q,p))<=Math.max(d*2.7,.0018)&&dot(sub(h.point,sub(p,mul(n,H))),desired)>d*.12;if(!qualifies(h))h=null;
    if(!h){const side=escapeSide||1;for(const a of [.35*side,-.35*side,.7*side,-.7*side,1.05*side,-1.05*side]){const alt=rotate(dir,n,a),q=add(p,mul(alt,d));const c=contact(world,q,n,alt,s.id,{old:p,dir:alt,length:d,desired});if(qualifies(c)&&dot(alt,desired)>.1){h=c;escapeSide=Math.sign(a);break;}}}
    if(!h){for(const fraction of [.65,.35,.15]){const short=d*fraction;for(const alt of [desired,rotate(desired,n,.35),rotate(desired,n,-.35)]){const c=contact(world,add(p,mul(alt,short)),n,alt,s.id,{old:p,dir:alt,length:short,desired});if(c){h=c;break;}}if(h)break;}}
    if(h){if(blocked)s.recoveries++;stall=0;const correction=len(sub(h.q,pred));s.contactCorrectionMax=Math.max(s.contactCorrectionMax,correction);const actual=sub(h.point,sub(p,mul(n,H)));const travelDir=len(plane(actual,n))>1e-6?tangent(n,actual):dir;setContact(h);v=mul(tangent(n,transport(unit(mix(dir,travelDir,.24),dir),up,n)),len(v));s.edgeBlocked=false;blocked=false;}
    if(!h){stall+=STEP;s.blockedSteps++;s.longestBlock=Math.max(s.longestBlock,stall);v=mul(v,Math.exp(-STEP*20));if(!blocked){s.edgeSaves++;s.contactLosses++;}blocked=true;s.edgeBlocked=true;}
   }else{s.edgeBlocked=false;blocked=false;stall=0;escapeSide=0;}
   s.f=tangent(n,mix(s.f,tangent(n,len(v)>.012?v:desired),damp(13,STEP)));s.groundSteps++;s.flightState='ride';s.capture=0;const wasGrinding=s.grind;s.grind=false;s.grindSource=null;
   // A ridge must have a convex cross-section and actual continuation on the same bone.
   if(i.grind&&len(v)>.018){const f=tangent(n,v),r=unit(cross(f,n)),h1=contact(world,add(p,mul(r,.016)),n,f,s.id),h2=contact(world,sub(p,mul(r,.016)),n,f,s.id),ahead=contact(world,add(p,mul(f,.022)),n,f,s.id);if(h1&&h2&&ahead&&[h1,h2,ahead].every(h=>h.id===s.id)&&dot(sub(p,h1.q),n)>.0005&&dot(sub(p,h2.q),n)>.0005){if(!wasGrinding)s.grindEntries++;s.grind=true;s.grindSource=s.id;s.flightState='grind';s.grindDistance+=len(sub(p,old));}}
   s.rideDistance+=len(sub(p,old));
  }else{
   air+=STEP;s.maxAir=Math.max(s.maxAir,air);s.glideSteps++;const can=!lift&&!lock&&liftGrace<=0;
   landing=can?findLanding(flightUp,desired):null;const near=landing&&landing.gap<.34;capture=mix([capture],[near?clamp(1-landing.gap/.34,0,1):0],damp(10,STEP))[0];s.capture=capture;s.landingGap=landing?.gap??null;s.landingSource=landing?.id??null;
   let goal=mul(desired,wantedSpeed);if(lift)goal=add(goal,mul(flightUp,.23));else if(near){const toward=sub(landing.q,p),normal=landing.normal;goal=add(plane(goal,normal),mul(normal,clamp(dot(toward,normal)*4,-.20,.10)));if(!throttle)goal=add(goal,mul(plane(toward,normal),2.4));}else if(i.descend||landPending)goal=add(goal,mul(flightUp,-.18));
   v=mix(v,goal,damp(brake?16:8,STEP));let delta=mul(v,STEP);
   const d=len(delta);if(d>1e-8){const h=world.ray(p,delta,d+.004);if(h&&dot(v,h.normal)<0){s.collisions++;delta=plane(delta,h.normal);v=plane(v,h.normal);}}
   p=add(p,delta).map((x,k)=>clamp(x,bounds.min[k]-.45,bounds.max[k]+.45));
   if(can&&landing&&air>.14&&len(sub(p,landing.q))<.013&&dot(v,landing.normal)<.045){const tangential=plane(v,landing.normal),before=len(tangential);n=flightUp;setContact(landing);v=plane(tangential,n);s.touchdownSpeed=before;s.touchdownCarry=len(v);s.touchdownNormalSpeed=Math.abs(dot(goal,n));s.impact=s.touchdownNormalSpeed;s.landings++;s.ground=true;s.glide=false;s.flightState='ride';s.capture=0;s.landingGap=0;landPending=lock=false;air=0;flightUp=n.slice();}
   else{s.glide=true;s.flightState=near?'landing':lock?'flight':'glide';const desiredNormal=near?unit(mix(flightUp,landing.normal,capture),flightUp):flightUp;s.n=unit(mix(s.n,desiredNormal,damp(10,STEP)),desiredNormal);s.f=tangent(s.n,mix(s.f,desired,damp(10,STEP)));}s.glideDistance+=len(sub(p,old));
  }
  if(s.ground)s.n=approachNormal(s.n,n,STEP,22,7);s.visualNormalTurnMax=Math.max(s.visualNormalTurnMax,Math.acos(clamp(dot(oldVisualNormal,s.n),-1,1)));const carriedVisual=transport(visualForward,oldVisualNormal,s.n);visualForward=tangent(s.n,mix(tangent(s.n,carriedVisual),tangent(s.n,s.f),damp(16,STEP)));viewFrame=tangent(s.n,transport(viewFrame,oldVisualNormal,s.n));s.p=p.slice();s.v=v.slice();s.frame=frame.slice();s.air=air;s.distance+=len(sub(p,old));s.routeSpan=Math.max(s.routeSpan,len(sub(p,start)));s.uniqueCells=cells.size;s.bank+=(clamp(dot(v,unit(cross(visualForward,s.n)))*.7,-.16,.16)-s.bank)*damp(9,STEP);
 }
 function advance(dt,i){if(i.ollie)jump=true;if(i.flightToggle)toggle=true;acc+=clamp(dt,0,.25)*(i.slow?.35:1);while(acc>=STEP){prev=pose();step({...i,flightToggle:toggle});toggle=false;acc-=STEP;}return s;}
 return {s,advance,reset,gravity:()=>{s.mode='magnetic';},terrain:()=>null,visual:()=>{const a=clamp(acc/STEP,0,1);return {...s,p:mix(prev.p,s.p,a),n:unit(mix(prev.n,s.n,a),s.n),f:visualForward.slice(),frame:viewFrame.slice()};},report:()=>({...s,p:s.p.slice(),n:s.n.slice(),v:s.v.slice(),f:s.f.slice(),speed:len(v),flightCollision:world.stats(),terrain:{id:s.id,kind:'exact-3d-triangle-contact'}})};
}
// Board-centric local-up orbit. Same basis is used by renderer and input.
function legacyRig(s,world){let orbit=0,pitch=.87,distance=.32,up=s.n.slice(),forward=tangent(up,s.frame),center=false,mode=0,look=[0,0],assistPitch=0,assistYaw=0;return {yaw:()=>orbit,forward:()=>rotate(forward,up,orbit+assistYaw),toggle:()=>{mode=1-mode;},recenter:()=>{center=true;},step(s,i,dt,_unused,c){
 dt=clamp(dt,0,.25);const old=up;up=approachNormal(up,s.n,dt,12,4.5);forward=tangent(up,transport(forward,old,up));look=mix(look,[i.x||0,i.y||0],damp(24,dt));if(Math.abs(i.x||0)+Math.abs(i.y||0)>.001){orbit+=look[0]*1.9*dt;pitch=clamp(pitch+look[1]*1.15*dt,.48,1.32);center=false;}else if(center){orbit*=Math.exp(-dt*7);if(Math.abs(orbit)<.01)center=false;}
 const target=add(s.p,mul(up,.009)),want=mode?.22:.30+(s.glide?.07:0)+len(s.v)*.16;
 function candidate(yo,po){const f=tangent(up,rotate(forward,up,orbit+yo)),right=unit(cross(f,up)),a=clamp(pitch+po,.42,1.48),back=unit(add(mul(f,-Math.cos(a)),mul(up,Math.sin(a)))),vertical=unit(cross(back,right)),ob=world.ray(target,back,want+.008),safe=ob?Math.max(.018,ob.distance-.012):want;return {f,right,vertical,back,safe,ob,a,yo,po};}
 let chosen=candidate(assistYaw,assistPitch);if(chosen.safe<want*.80){let best=chosen,bestScore=chosen.safe-.035*(Math.abs(assistYaw)+Math.abs(assistPitch));for(const [yo,po] of [[0,.20],[0,.40],[.30,.16],[-.30,.16],[.55,.28],[-.55,.28]]){const q=candidate(yo,po),score=q.safe-.035*(Math.abs(yo)+Math.abs(po));if(score>bestScore+.012){best=q;bestScore=score;}}assistYaw+=(best.yo-assistYaw)*damp(9,dt);assistPitch+=(best.po-assistPitch)*damp(12,dt);chosen=candidate(assistYaw,assistPitch);}else if(Math.abs(assistYaw)+Math.abs(assistPitch)>.01){const yo=assistYaw*Math.exp(-dt*3),po=assistPitch*Math.exp(-dt*4),q=candidate(yo,po);if(q.safe>want*.78){assistYaw=yo;assistPitch=po;chosen=q;}}
 const {f,right,vertical,back,safe,ob}=chosen;distance=safe<distance?safe:distance+(safe-distance)*damp(5,dt);const span=Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan));let lens=Math.min(c.width,c.height)*.69;
 c.marrowBasis=[...right,...vertical,...back];c.target={x:target[0],y:target[1],z:target[2]};c.marrowDistance=distance;c.anchorX=.5;c.anchorY=.53;c.yaw=Math.atan2(f[0],-f[2]);c.pitch=chosen.a;
 const offsets=[];for(const x of [-.018,.018])for(const y of [-.009,.012])for(const z of [-.038,.038]){const q=sub(add(s.p,add(mul(unit(cross(s.f,s.n)),x),add(mul(s.n,y),mul(s.f,z)))),target);offsets.push({x:dot(q,right),y:dot(q,vertical),depth:distance-dot(q,back)});}
 // Perspective framing: reduce focal length in tight spaces without zooming
 // through a surface. Do not claim success if a deck corner is behind near plane.
 for(const q of offsets){if(q.depth<=.004)continue;if(Math.abs(q.x)>1e-8)lens=Math.min(lens,c.width*.43*q.depth/Math.abs(q.x));if(Math.abs(q.y)>1e-8)lens=Math.min(lens,c.height*.37*q.depth/Math.abs(q.y));}c.zoom=lens/(distance*span);
 const framed=offsets.every(q=>q.depth>.004&&Math.abs(q.x*lens/q.depth)<c.width*.47&&Math.abs(q.y*lens/q.depth)<c.height*.43);
 return {yaw:c.yaw,pitch:chosen.a,distance,target,framed,obstructed:!!ob,basis:c.marrowBasis,assistYaw,assistPitch};
 }};}
// GYROSCOPE: physics transports the steering frame. Only explicit look input
// changes its yaw offset; the presentation camera can never write to it.
const WORLD_UP=[0,1,0],MODES=['STEADY','CHASE','IMMERSIVE'],FOV=52*Math.PI/180;
function spring(p,v,goal,dt,omega){const e=Math.exp(-omega*dt),d=sub(p,goal),j=add(v,mul(d,omega));return [add(goal,mul(add(d,mul(j,dt)),e)),mul(sub(v,mul(j,omega*dt)),e)];}
function basis(f,up,pitch,roll=0){const right=unit(cross(f,up),[1,0,0]),back=unit(add(mul(f,-Math.cos(pitch)),mul(up,Math.sin(pitch)))),vertical=unit(cross(back,right));return [rotate(right,back,roll),rotate(vertical,back,roll),back];}
function rotationAngle(a,b){return Math.acos(clamp((dot(a[0],b[0])+dot(a[1],b[1])+dot(a[2],b[2])-1)*.5,-1,1));}
function blendBasis(a,b,t,maxAngle){const theta=rotationAngle(a,b);if(theta<1e-7)return b.map(v=>v.slice());let axis=add(add(cross(a[0],b[0]),cross(a[1],b[1])),cross(a[2],b[2]));if(len(axis)<1e-6){const v=add(a[0],b[0]),w=add(a[1],b[1]),z=add(a[2],b[2]);axis=[v,w,z].sort((x,y)=>len(y)-len(x))[0];if(len(axis)<1e-7)axis=a[0];}const angle=Math.min(theta*t,maxAngle);return a.map(v=>unit(rotate(v,unit(axis),angle),v));}
function rig(s,world){let mode=0,yaw=0,pitch=.72,sensitivity=1,close=false,recenter=false,look=[0,0],physical=s,worldForward=tangent(WORLD_UP,s.frame||s.f),orient=basis(worldForward,WORLD_UP,pitch),target=s.p.slice(),targetV=[0,0,0],distance=.36,distanceV=0,angular=0,transition=false,blockedFor=0,obstructedLast=false,recovery=0,lastMode='STEADY',recoveringView=false,initializedView=false;
 const api={yaw:()=>yaw,controlYaw:()=>yaw,forward:()=>rotate(tangent(physical.n,physical.frame||physical.f),physical.n,yaw),mode:()=>MODES[mode],setMode:m=>{const next=MODES.indexOf(m);if(next>=0&&next!==mode){mode=next;transition=true;}return MODES[mode];},cycle:()=>api.setMode(MODES[(mode+1)%3]),toggle:()=>{close=!close;},sensitivity:()=>sensitivity,setSensitivity:v=>{if(Number.isFinite(v))sensitivity=clamp(v,.35,1.8);return sensitivity;},recenter:()=>{recenter=true;},step(s,i,dt,_unused,c){
 physical=s;const rawDt=Math.max(0,dt),h=clamp(rawDt,0,.05),trackDt=clamp(rawDt,0,.10),old=orient.map(v=>v.slice()),oldAngular=angular;
 look=mix(look,[clamp(i.x||0,-1,1),clamp(i.y||0,-1,1)],damp(18,h));if(Math.abs(i.x||0)+Math.abs(i.y||0)>.001){yaw+=look[0]*1.45*sensitivity*h;pitch=clamp(pitch+look[1]*1.05*sensitivity*h,.22,1.22);recenter=false;}else{look=[0,0];if(recenter){yaw*=Math.exp(-h*5);pitch+= (.72-pitch)*damp(5,h);if(Math.abs(yaw)<.005&&Math.abs(pitch-.72)<.005){yaw=0;pitch=.72;recenter=false;}}}
 const f=rotate(worldForward,WORLD_UP,yaw),speed=len(s.v||[0,0,0]),localUp=s.n,localF=rotate(tangent(localUp,s.frame||s.f),localUp,yaw),roll=mode===1?clamp(dot(s.v||[0,0,0],unit(cross(f,WORLD_UP)))*.25,-.055,.055):0;
 const desired=mode===2?basis(localF,localUp,pitch):basis(f,WORLD_UP,pitch,roll);
 // Keep the control frame independent of presentation recovery.
 const ahead=mode===1?mul(s.v||[0,0,0],.10):[0,0,0],goal=add(s.p,ahead);
 [target,targetV]=spring(target,targetV,goal,trackDt,13);
 const lag=sub(target,s.p);if(len(lag)>.035){target=add(s.p,mul(unit(lag),.035));targetV=[0,0,0];}
 const aspect=c.width/Math.max(1,c.height),want=(close?.17:.225)+(aspect<.85?.045:0)+Math.min(.04,speed*.13);
 const lens=c.height*.5/Math.tan(FOV*.5),span=Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan));
 const boardRight=unit(cross(s.n,s.f)),corners=[];
 for(const x of [-.018,.018])for(const y of [-.009,.012])for(const z of [-.038,.038])corners.push(add(mul(boardRight,x),add(mul(s.n,y),mul(s.f,z))));
 const extent=(b,d,off=[0,0,0])=>{let x=0,y=0,depth=Infinity;for(const v of corners){const q=sub(v,off),z=d-dot(q,b[2]);depth=Math.min(depth,z);x=Math.max(x,Math.abs(dot(q,b[0])*lens/Math.max(.0001,z)));y=Math.max(y,Math.abs(dot(q,b[1])*lens/Math.max(.0001,z)));}return {depth,x,y,framed:depth>.006&&x<c.width*.47&&y<c.height*.43};};
 const sight=b=>{const hit=world.ray(s.p,b[2],want+.012),safe=hit?Math.max(0,hit.distance-.012):want;return {hit,safe};};
 const aligned=back=>{const r=unit(plane(desired[0],back),unit(cross(WORLD_UP,back),orient[0]));return [r,unit(cross(back,r)),back];};
 let requested=sight(desired),chosen=desired,alternate=false;
 const contactProbe=world.ray(s.p,mul(localUp,-1),.024),onSurface=!!contactProbe&&contactProbe.distance<=.024;
 const acceptable=(b,q)=>q.safe>=want*.76&&extent(b,q.safe).framed&&(!onSurface||dot(b[2],localUp)>=.24);
 const need=requested.safe<want*.90||(onSurface&&dot(desired[2],localUp)<.32);
 if(need){let best=-Infinity;const dirs=[orient[2],localUp];for(const t of [.12,.24,.4,.6,.8,1,1.5,2,3])for(const shift of [0,.3,-.3,.65,-.65]){dirs.push(unit(add(orient[2],add(mul(localUp,t),mul(localF,shift))),localUp));dirs.push(unit(add(desired[2],add(mul(localUp,t),mul(localF,shift))),localUp));}for(const back of dirs){const b=aligned(back),q=sight(b);if(!acceptable(b,q))continue;const score=dot(back,desired[2])*.22+dot(back,orient[2])*.78;if(score>best){best=score;chosen=b;alternate=true;}}}
 let next;
 if(!initializedView){next=chosen;initializedView=true;}
 else if(mode===2||transition||alternate||recoveringView)next=blendBasis(orient,chosen,damp(12,h),1.7*h);
 else next=chosen;
 recoveringView=alternate||rotationAngle(next,desired)>.004;
 let clear=sight(next),emergency=false;
  orient=next;if(rotationAngle(orient,desired)<.004)transition=false;
 const [right,vertical,back]=orient;
 const hit=clear.hit,safe=Math.max(.007,clear.safe);
 if(hit){blockedFor+=rawDt;recovery=0;}else{if(obstructedLast)recovery=0;else recovery+=rawDt;blockedFor=0;}
 [distance,distanceV]=spring([distance],[distanceV],[safe],trackDt,9).map(v=>v[0]);if(distance>safe){distance=safe;distanceV=0;}distance=Math.max(.007,distance);obstructedLast=!!hit;
 const viewTarget=s.p.slice();
 c.marrowBasis=[...right,...vertical,...back];c.target={x:viewTarget[0],y:viewTarget[1],z:viewTarget[2]};c.marrowDistance=distance;c.anchorX=.5;c.anchorY=.53;c.zoom=lens/(distance*span);c.yaw=Math.atan2(-back[0],-back[2]);c.pitch=Math.asin(clamp(back[1],-1,1));
 const projection=extent(orient,distance),framed=projection.framed;
  angular=h>0?rotationAngle(old,orient)/h:0;const angularAcceleration=h>0?Math.abs(angular-oldAngular)/h:0;lastMode=MODES[mode];
 return {mode:lastMode,yaw:c.yaw,pitch:c.pitch,distance,target:viewTarget.slice(),framed,obstructed:!!hit,basis:c.marrowBasis.slice(),fovDegrees:52,controlYaw:yaw,angularVelocity:angular,angularAcceleration,trackingError:len(sub(target,s.p)),horizonRoll:Math.asin(clamp(right[1],-1,1)),projection,recoveryView:alternate,emergency,blockedSeconds:blockedFor,recoverySeconds:recovery,cameraDt:h,transition};
 }};return api;}
root.BodyMarrowSurface=Object.freeze({create,rig,legacyRig,contact,transport,STEP});
})(globalThis);
