/* MARROW D — fictional top-envelope terrain, immutable anatomical source.
   No live mesh raycasts in the riding loop. Heightfield is local to one source bone. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,damp=(n,t)=>1-Math.exp(-n*t),len=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),unit=(a,f=[0,1,0])=>len(a)>1e-8?a.map(v=>v/len(a)):f.slice(),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const STEP=1/120,H=.011,HALF_W=.012,HALF_L=.031;
function terrain(part){
 const started=performance.now(),[minX,minY,minZ]=part.min,[maxX,maxY,maxZ]=part.max,spanX=maxX-minX,spanZ=maxZ-minZ;
 if(spanX<.075||spanZ<.075)return null;
 const cell=Math.max(.003,Math.max(spanX,spanZ)/160),nx=Math.ceil(spanX/cell)+1,nz=Math.ceil(spanZ/cell)+1,N=nx*nz;
 const raw=new Float32Array(N);raw.fill(-Infinity);const p=part.positions,ix=part.indices;
 // Rasterize original triangle heights at regularly spaced XZ vertices. Upper envelope only.
 for(let t=0;t<ix.length;t+=3){
  const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3,ax=(p[a]-minX)/cell,az=(p[a+2]-minZ)/cell,bx=(p[b]-minX)/cell,bz=(p[b+2]-minZ)/cell,cx=(p[c]-minX)/cell,cz=(p[c+2]-minZ)/cell,den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  if(Math.abs(den)<1e-10)continue;
  const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-1e-6)),x1=Math.min(nx-1,Math.floor(Math.max(ax,bx,cx)+1e-6)),z0=Math.max(0,Math.ceil(Math.min(az,bz,cz)-1e-6)),z1=Math.min(nz-1,Math.floor(Math.max(az,bz,cz)+1e-6));
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,w=1-u-v;if(u< -1e-5||v< -1e-5||w< -1e-5)continue;const y=u*p[a+1]+v*p[b+1]+w*p[c+1],k=z*nx+x;if(y>raw[k])raw[k]=y;}
 }
 // No invented support across holes. Keep only continuous moderate-gradient quads.
 const qx=nx-1,qz=nz-1,Q=qx*qz,mask=new Uint8Array(Q);
 for(let z=0;z<qz;z++)for(let x=0;x<qx;x++){const k=z*nx+x,h=[raw[k],raw[k+1],raw[k+nx],raw[k+nx+1]];if(h.every(Number.isFinite)&&Math.max(...h)-Math.min(...h)<cell*1.65)mask[z*qx+x]=1;}
 const seen=new Uint8Array(Q),queue=new Int32Array(Q);let biggest=[];
 const neighbors=(k,fn)=>{const x=k%qx,z=Math.floor(k/qx);if(x>0)fn(k-1);if(x<qx-1)fn(k+1);if(z>0)fn(k-qx);if(z<qz-1)fn(k+qx);};
 for(let k=0;k<Q;k++){if(!mask[k]||seen[k])continue;let n=1,j=0;queue[0]=k;seen[k]=1;while(j<n){neighbors(queue[j++],v=>{if(mask[v]&&!seen[v]){seen[v]=1;queue[n++]=v;}});}if(n>biggest.length)biggest=Array.from(queue.subarray(0,n));}
 if(biggest.length<16)return null;mask.fill(0);for(const k of biggest)mask[k]=1;
 // Distance to edge: bounded Manhattan grid clearance, then spawn at maximum interior clearance.
 const clearance=new Uint16Array(Q);clearance.fill(65535);let tail=0,head=0;
 for(const k of biggest){const x=k%qx,z=Math.floor(k/qx);if(x===0||z===0||x===qx-1||z===qz-1||!mask[k-1]||!mask[k+1]||!mask[k-qx]||!mask[k+qx]){clearance[k]=0;queue[tail++]=k;}}
 while(head<tail){const k=queue[head++];neighbors(k,v=>{if(mask[v]&&clearance[v]===65535){clearance[v]=clearance[k]+1;queue[tail++]=v;}});}
 let best=biggest[0];for(const k of biggest)if(clearance[k]>clearance[best])best=k;
 const center=[minX+(best%qx+.5)*cell,minZ+(Math.floor(best/qx)+.5)*cell],radius=clearance[best]*cell/Math.SQRT2;
 if(radius<.040)return null;
 // Smooth normals on supported samples only; original top heights remain available for clearance.
 let smooth=raw.slice();for(let pass=0;pass<2;pass++){const next=smooth.slice();for(let z=1;z<nz-1;z++)for(let x=1;x<nx-1;x++){const k=z*nx+x;if(!Number.isFinite(raw[k]))continue;let sum=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const v=smooth[k+j*nx+i];if(Number.isFinite(v)&&Math.abs(v-raw[k])<cell*2){sum+=v;n++;}}if(n)next[k]=sum/n;}smooth=next;}
 function sample(x,z,strict=true){const gx=(x-minX)/cell,gz=(z-minZ)/cell,i=Math.floor(gx),j=Math.floor(gz);if(i<0||j<0||i>=qx||j>=qz)return null;const q=j*qx+i,k=j*nx+i;if(strict&&!mask[q])return null;const a=gx-i,b=gz-j,interp=h=>mix(mix(h[k],h[k+1],a),mix(h[k+nx],h[k+nx+1],a),b);if(![raw[k],raw[k+1],raw[k+nx],raw[k+nx+1]].every(Number.isFinite))return null;const height=interp(raw),dyx=mix(smooth[k+1]-smooth[k],smooth[k+nx+1]-smooth[k+nx],b)/cell,dyz=mix(smooth[k+nx]-smooth[k],smooth[k+nx+1]-smooth[k+1],a)/cell;return {height,normal:unit([-dyx,1,-dyz]),clearance:clearance[q]*cell,cell:q};}
 function support(x,z,yaw){const sx=Math.sin(yaw),sz=-Math.cos(yaw),rx=Math.cos(yaw),rz=Math.sin(yaw),mid=sample(x,z);if(!mid)return null;let sum=mid.normal.slice(),top=mid.height;const samples=[mid];for(const l of [-HALF_L,HALF_L])for(const w of [-HALF_W,HALF_W]){const h=sample(x+sx*l+rx*w,z+sz*l+rz*w);if(!h)return null;samples.push(h);sum=add(sum,h.normal);}const normal=unit(sum);for(let i=1;i<samples.length;i++){const l=i<=2?-HALF_L:HALF_L,w=i%2?-HALF_W:HALF_W,dx=sx*l+rx*w,dz=sz*l+rz*w;top=Math.max(top,samples[i].height+(normal[0]*dx+normal[2]*dz)/Math.max(.4,normal[1]));}return {height:top,normal,clearance:mid.clearance};}
 const initial=support(center[0],center[1],0);if(!initial)return null;
 return {id:part.id,name:part.name,center,radius,cell,area:biggest.length*cell*cell,grid:[nx,nz],sample,support,stats:{buildMs:performance.now()-started,sourceTriangles:ix.length/3,rideCells:biggest.length,bytes:raw.byteLength+smooth.byteLength+mask.byteLength+clearance.byteLength},initial};
}
function select(parts,preferred){const candidates=parts.filter(p=>p.category==='Bone'&&p.indices?.length).sort((a,b)=>Number(/skull_cranial/i.test(b.id))-Number(/skull_cranial/i.test(a.id))||Number(b.id===preferred)-Number(a.id===preferred)||((b.max[0]-b.min[0])*(b.max[2]-b.min[2])-(a.max[0]-a.min[0])*(a.max[2]-a.min[2])));for(const p of candidates.slice(0,5)){const t=terrain(p);if(t)return t;}return null;}
function create(t){let yaw=0,x=t.center[0],z=t.center[1],h=t.initial,vertical=0,air=0,lift=0,acc=0,jump=false,prev=null,mode='magnetic';const s={p:[x,h.height+H,z],v:[0,0,0],n:h.normal.slice(),f:[0,0,-1],ground:true,mode,id:t.id,name:t.name,air:0,distance:0,landings:0,impact:0,steps:0,grind:false,edgeSaves:0,falls:0,remounts:0,groundSteps:0,maxAir:0,edgeBlocked:false,routeSpan:0,uniqueCells:0};const cells=new Set();let lastEdge=false;const pose=()=>({p:s.p.slice(),n:s.n.slice(),f:s.f.slice()});prev=pose();const start=s.p.slice();
 function reset(){x=t.center[0];z=t.center[1];yaw=0;h=t.initial;vertical=air=lift=0;acc=0;jump=false;lastEdge=false;Object.assign(s,{p:[x,h.height+H,z],v:[0,0,0],n:h.normal.slice(),f:[0,0,-1],ground:true,air:0,edgeBlocked:false});s.remounts++;prev=pose();}
 function step(i){const dt=STEP;s.steps++;const old=s.p.slice(),input=i.direction,brake=clamp(i.brake||0,0,1),throttle=clamp(i.push||0,0,1);let aim=input?Math.atan2(input[0],-input[2]):yaw;
  if(!input&&i.steer)aim=yaw+(i.steer||0)*.6;
  const oldYaw=yaw,turn=clamp(angle(yaw,aim),-5.5*dt,5.5*dt);yaw+=turn;
  const forward=[Math.sin(yaw),0,-Math.cos(yaw)],speed=Math.hypot(s.v[0],s.v[2]),base=clamp(t.radius*.8,.055,.21),desired=base*throttle*(1-brake);
  // Intent is independent of board pose: approach target velocity with bounded acceleration.
  const target=input?unit([input[0],0,input[2]],[0,0,-1]):forward,rate=brake?15:throttle?5:1.7;
  let vx=mix(s.v[0],target[0]*desired,damp(rate,dt)),vz=mix(s.v[2],target[2]*desired,damp(rate,dt));
  if(brake>.8){vx*=Math.exp(-12*dt);vz*=Math.exp(-12*dt);}
  if(!throttle&&Math.hypot(vx,vz)<.001)vx=vz=0;
  // Four wheel supports plus center; slide along valid tangents at the boundary, never reverse.
  let nx=x+vx*dt,nz=z+vz*dt,next=t.support(nx,nz,yaw),blocked=false;
  if(!next){const candidates=[[nx,z],[x,nz]].map(([a,b])=>({a,b,h:t.support(a,b,yaw)})).filter(q=>q.h&&Math.hypot(q.a-x,q.b-z)>1e-8).sort((a,b)=>Math.hypot(b.a-x,b.b-z)-Math.hypot(a.a-x,a.b-z));if(candidates.length){const q=candidates[0];nx=q.a;nz=q.b;next=q.h;}else{nx=x;nz=z;next=t.support(x,z,yaw);if(!next){yaw=oldYaw;next=h;}blocked=Math.hypot(vx,vz)>.001;}}
  if(blocked&&!lastEdge)s.edgeSaves++;lastEdge=blocked;s.edgeBlocked=blocked;
  vx=(nx-x)/dt;vz=(nz-z)/dt;x=nx;z=nz;h=next;
  if(jump&&s.ground){s.ground=false;vertical=.19;air=lift=0;}jump=false;
  if(!s.ground){air+=dt;vertical-=(mode==='zero'?.32:1.3)*dt;lift=Math.max(0,lift+vertical*dt);s.maxAir=Math.max(s.maxAir,air);if(lift<=0&&vertical<0){s.ground=true;s.landings++;s.impact=-vertical;vertical=0;air=lift=0;}s.air=air;}else{s.groundSteps++;s.air=0;}
  const n=unit(add(mul(s.n,1-damp(16,dt)),mul(h.normal,damp(16,dt))));s.n=n;const boardForward=[Math.sin(yaw),0,-Math.cos(yaw)];s.f=unit(sub(boardForward,mul(n,dot(boardForward,n))),boardForward);s.p=[x,h.height+H+lift,z];s.v=[vx,vertical,vz];s.distance+=Math.hypot(x-old[0],z-old[2]);s.routeSpan=Math.max(s.routeSpan,Math.hypot(x-start[0],z-start[2]));const cell=t.sample(x,z)?.cell;if(cell!==undefined)cells.add(cell);s.uniqueCells=cells.size;
 }
 function advance(dt,i){if(i.ollie)jump=true;acc+=clamp(dt,0,.25)*(i.slow?.35:1);while(acc>=STEP){prev=pose();step(i);acc-=STEP;}return s;}
 return {s,advance,reset,gravity:()=>{mode=mode==='magnetic'?'zero':'magnetic';s.mode=mode;},visual:()=>{const a=clamp(acc/STEP,0,1);return {...s,p:s.p.map((v,k)=>mix(prev.p[k],v,a)),n:unit(s.n.map((v,k)=>mix(prev.n[k],v,a))),f:unit(s.f.map((v,k)=>mix(prev.f[k],v,a)),s.f)};},report:()=>({...s,p:s.p.slice(),n:s.n.slice(),f:s.f.slice(),v:s.v.slice(),speed:Math.hypot(s.v[0],s.v[2]),terrain:{id:t.id,area:t.area,radius:t.radius,grid:t.grid,...t.stats}})};
}
function project(p,c){const q=sub(p,[c.target.x,c.target.y,c.target.z]),cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),x=q[0]*cy+q[2]*sy,z=q[2]*cy-q[0]*sy,y=q[1]*cp-z*sp,depth=c.marrowDistance-(q[1]*sp+z*cp),scale=Math.min(c.width/3.25,c.height/c.frameSpan)*c.zoom;return {x:c.width*c.anchorX+x*scale*c.marrowDistance/depth,y:c.height*c.anchorY-y*scale*c.marrowDistance/depth,depth};}
function framing(s,c){const r=unit(cross(s.n,s.f),[1,0,0]),corners=[];for(const x of [-.018,.018])for(const y of [-.009,.012])for(const z of [-.038,.038])corners.push(project(add(s.p,add(mul(r,x),add(mul(s.n,y),mul(s.f,z)))),c));return corners.every(p=>p.depth>.004&&p.x>=c.width*.04&&p.x<=c.width*.96&&p.y>=c.height*.08&&p.y<=c.height*.88);}
function cameraRig(s,t){let yaw=Math.atan2(s.f[0],-s.f[2]),pitch=.92,mode=0,center=false,lookAge=0,distance=.31;return {yaw:()=>yaw,toggle:()=>{mode=1-mode;},recenter:()=>{center=true;},step(s,input,dt,_world,c){const lx=input.x||0,ly=input.y||0;if(Math.abs(lx)+Math.abs(ly)>.001){center=false;lookAge=0;yaw+=lx*1.65*dt;pitch=clamp(pitch+ly*1.15*dt,.68,1.38);}else{lookAge+=dt;if(center&&!input.steering){const goal=Math.atan2(s.f[0],-s.f[2]);yaw+=clamp(angle(yaw,goal),-1.6*dt,1.6*dt);pitch=mix(pitch,.92,damp(8,dt));if(Math.abs(angle(yaw,goal))<.025)center=false;}}
 // Board is the target, not a point ahead of it. Hard minimum framing distance.
 const desired=mode?.22:.34+Math.hypot(s.v[0],s.v[2])*.2;distance=mix(distance,desired,damp(7,dt));let chosen=pitch;const back=[-Math.sin(yaw),Math.cos(yaw)];for(let k=0;k<5;k++){const test=chosen+k*.10;if(test>1.49)break;let clear=true;for(const a of [.22,.45,.7,1]){const h=t.sample(s.p[0]+back[0]*distance*Math.cos(test)*a,s.p[2]+back[1]*distance*Math.cos(test)*a,false);if(h&&h.height+.025>s.p[1]+.025+distance*Math.sin(test)*a){clear=false;break;}}if(clear){chosen=test;break;}chosen=Math.min(1.49,test+.1);}
 c.yaw=yaw;c.pitch=chosen;c.target={x:s.p[0],y:s.p[1]+.014,z:s.p[2]};c.marrowDistance=distance;c.anchorX=.5;c.anchorY=.54;const scale=Math.min(c.width,c.height)*.76;c.zoom=(scale/distance)/Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan));let visible=framing(s,c);if(!visible){c.marrowDistance=Math.max(distance,.46);c.zoom=(scale/c.marrowDistance)/Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan));visible=framing(s,c);}return {yaw,pitch:chosen,distance:c.marrowDistance,target:[c.target.x,c.target.y,c.target.z],framed:visible,boardCenter:project(s.p,c),obstructed:chosen>pitch+.01};}};}
root.BodyMarrowRide=Object.freeze({terrain,select,create,cameraRig,project,framing,STEP});
})(globalThis);
