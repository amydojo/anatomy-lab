/* BODY / LIVE V15: standard gamepad input, no network or device-specific dependency. */
(function(root){'use strict';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function stick(x,y,dead=.18){
  x=Number.isFinite(x)?clamp(x,-1,1):0;y=Number.isFinite(y)?clamp(y,-1,1):0;
  const mag=Math.hypot(x,y);if(mag<=dead)return [0,0];
  const strength=Math.pow(clamp((mag-dead)/(1-dead),0,1),1.6);
  return [x/mag*strength,y/mag*strength];
 }
 function read(pad){
  const axes=pad.axes||[],buttons=pad.buttons||[];
  const value=i=>clamp(Number(buttons[i]?.value)||0,0,1);
  const [panX,panY]=stick(axes[0],axes[1]),[orbitX,orbitY]=stick(axes[2],axes[3]);
  const trigger=v=>v<.06?0:(v-.06)/.94;
  return {panX,panY,orbitX,orbitY,zoom:trigger(value(7))-trigger(value(6)),
   buttons:Array.from({length:17},(_,i)=>!!buttons[i]?.pressed||value(i)>.6)};
 }
 const moving=i=>Math.abs(i.panX)+Math.abs(i.panY)+Math.abs(i.orbitX)+Math.abs(i.orbitY)+Math.abs(i.zoom)>0;
 function advance(c,input,seconds,bounds,maxZoom){
  const dt=clamp(Number(seconds)||0,0,.05);
  if(!dt||!moving(input))return false;
  const old=[c.yaw,c.pitch,c.zoom,c.target.x,c.target.y,c.target.z];
  c.yaw+=input.orbitX*1.6*dt;
  c.pitch=clamp(c.pitch+input.orbitY*1.15*dt,-.85,.85);
  if(input.zoom)c.zoom=clamp(c.zoom*Math.exp(input.zoom*1.65*dt),.7,Math.max(.7,maxZoom));
  const scale=Math.max(.001,Math.min(c.width/3.25,c.height/Math.max(.2,c.frameSpan))*c.zoom);
  const rate=Math.min(c.width,c.height)*.55/scale;
  const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  const right=[cy,0,sy],up=[sy*sp,cp,-cy*sp];
  if(bounds?.min&&bounds?.max&&(input.panX||input.panY))for(let i=0;i<3;i++){
   const k=['x','y','z'][i],span=Math.max(.35,bounds.max[i]-bounds.min[i]),margin=Math.max(.18,span*.18);
   c.target[k]=clamp(c.target[k]+(right[i]*input.panX-up[i]*input.panY)*rate*dt,bounds.min[i]-margin,bounds.max[i]+margin);
  }
  return old.some((v,i)=>v!==[c.yaw,c.pitch,c.zoom,c.target.x,c.target.y,c.target.z][i]);
 }
 function mount({camera,bounds,maxZoom,canMove,begin,end,render,command,status,getPads=()=>navigator.getGamepads?.()||[]}){
  let enabled=false,frame=0,last=0,active=false,padIndex=null,armed=false,prior=[];
  const finish=()=>{if(active){active=false;end();}};
  const reset=()=>{finish();padIndex=null;armed=false;prior=[];last=0;};
  function tick(now){
   if(!enabled)return;frame=requestAnimationFrame(tick);
   if(document.hidden||!canMove()){reset();return;}
   let pads;try{pads=Array.from(getPads()).filter(p=>p?.connected&&p.mapping==='standard');}catch{status('Controller access unavailable');reset();return;}
   const pad=pads.find(p=>p.index===padIndex)||pads[0];
   if(!pad){reset();status('Press any controller button to connect');return;}
   if(padIndex!==pad.index){reset();padIndex=pad.index;}
   const input=read(pad),dt=last?(now-last)/1000:0;last=now;
   if(!armed){if(!moving(input)&&!input.buttons.some(Boolean))armed=true;status(armed?'Controller ready':'Release controls to begin');return;}
   status('Controller ready');
   const edges=input.buttons.map((b,i)=>b&&!prior[i]);prior=input.buttons;
   // Discrete actions take priority over continuous navigation in the same frame.
   const action=[9,0,1,2,3,11,12,13,14,15].find(i=>edges[i]);
   if(action!==undefined){finish();command(action);return;}
   if(moving(input)){
    if(!active){active=true;begin();}
    if(advance(camera(),input,dt,bounds(),maxZoom()))render();
   }else finish();
  }
  function setEnabled(next){enabled=!!next;cancelAnimationFrame(frame);frame=0;reset();if(enabled)frame=requestAnimationFrame(tick);}
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  window.addEventListener('pagehide',()=>setEnabled(false));
  return Object.freeze({setEnabled,interrupt:reset});
 }
 root.BodyExpedition=Object.freeze({stick,read,moving,advance,mount});
})(globalThis);
