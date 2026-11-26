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
 // Opt-in local measurements; bounded rolling samples.
 function series(capacity=1800){
  const values=new Float64Array(capacity);let count=0,next=0,total=0;
  return {push(value){if(!Number.isFinite(value)||value<0)return;values[next]=value;next=(next+1)%capacity;count=Math.min(count+1,capacity);total++;},
   summary(){const sorted=Array.from(values.subarray(0,count)).sort((a,b)=>a-b);
    const q=p=>count?sorted[Math.max(0,Math.ceil(p*count)-1)]:null;
    return {samples:count,totalSamples:total,median:q(.5),p95:q(.95),p99:q(.99),max:q(1),estimatedMissed60HzSlots:sorted.reduce((n,v)=>n+Math.max(0,Math.round(v/(1000/60))-1),0)};}};
 }
 function diagnostics(clock=()=>performance.now()){
  const start=clock(),samples={activeFrameIntervalMs:series(),pollIntervalMs:series(),pollCpuMs:series(),renderCpuMs:series(),inputToRenderSubmissionMs:series(),selectionCpuMs:series(),longTaskMs:series()};
  const events=[];let activeAt=null,pollAt=null,longTasksSupported=false;
  const event=(type,detail)=>{events.push({elapsedMs:clock()-start,type,detail});if(events.length>120)events.shift();};
  return {sample:(key,v)=>samples[key]?.push(v),event,
   poll(now){if(pollAt!==null)samples.pollIntervalMs.push(now-pollAt);pollAt=now;},
   active(now){if(activeAt!==null)samples.activeFrameIntervalMs.push(now-activeAt);activeAt=now;},
   idle(){activeAt=null;},suspend(){activeAt=pollAt=null;},
   setLongTasksSupported(v){longTasksSupported=!!v;},
   report(){const metrics=Object.fromEntries(Object.entries(samples).map(([k,v])=>{const s=v.summary();if(!k.endsWith('IntervalMs'))delete s.estimatedMissed60HzSlots;return [k,s];}));
    if(!longTasksSupported)metrics.longTaskMs=null;
    return {schema:'body-live-expedition-diagnostics-1',elapsedMs:clock()-start,rollingCapacity:1800,metrics,events:events.slice(),unsupported:{gpuFrameTimeMs:'unavailable',airplayEncoding:'unavailable',physicalInputLatencyMs:'unavailable'},notes:['Frame intervals measure successive active controller callbacks, not display presentation. Missed slots assume nominal 60 Hz, not measured dropped frames. CPU render duration measures submission, not GPU completion.']};}};
 }
 function mount({camera,bounds,maxZoom,canMove,begin,end,render,command,status,diagnostic=null,navigate=advance,readInput=read,hasMotion=()=>false,resetMotion=()=>{},onSelection=()=>{},onOpticalTick=()=>{},onOpticalSuspend=()=>{},getPads=()=>navigator.getGamepads?.()||[]}){
  let enabled=false,frame=0,last=0,active=false,padIndex=null,armed=false,prior=[];
  const finish=()=>{if(active){active=false;end();}};
  const reset=()=>{resetMotion();diagnostic?.suspend();onOpticalSuspend();finish();padIndex=null;armed=false;prior=[];last=0;};
  function tick(now){
   if(!enabled)return;frame=requestAnimationFrame(tick);
   if(document.hidden||!canMove()){reset();return;}
   const pollStart=diagnostic?performance.now():0;diagnostic?.poll(now);
   let pads;try{pads=Array.from(getPads()).filter(p=>p?.connected&&p.mapping==='standard');}catch{status('Controller access unavailable');reset();return;}
   if(diagnostic)diagnostic.sample('pollCpuMs',performance.now()-pollStart);
   const pad=pads.find(p=>p.index===padIndex)||pads[0];
   if(!pad){reset();status('Press any controller button to connect');return;}
   if(padIndex!==pad.index){reset();padIndex=pad.index;diagnostic?.event('controller-connected',{index:pad.index,mapping:pad.mapping});}
   const input=readInput(pad),dt=last?(now-last)/1000:0;last=now;
   if(!armed){if(!moving(input)&&!input.buttons.some(Boolean))armed=true;status(armed?'Controller ready':'Release controls to begin');return;}
   status('Controller ready');
   const edges=input.buttons.map((b,i)=>b&&!prior[i]);prior=input.buttons;
   // Discrete actions take priority over continuous navigation in the same frame.
   const action=[9,0,1,2,3,11,12,13,14,15,4,5].find(i=>edges[i]);
   if(action!==undefined){resetMotion();onOpticalSuspend();diagnostic?.idle();finish();const start=diagnostic?performance.now():0;const result=command(action);if(action===0&&result===true)onSelection(pad);if(diagnostic&&action===0)diagnostic.sample('selectionCpuMs',performance.now()-start);return;}
   const isMoving=moving(input)||hasMotion();const qualityChanged=onOpticalTick(now,isMoving);
   if(isMoving){
    if(!active){active=true;begin();}
    if(navigate(camera(),input,dt,bounds(),maxZoom())){diagnostic?.active(now);render();if(diagnostic)diagnostic.sample('inputToRenderSubmissionMs',performance.now()-pollStart);}else{diagnostic?.idle();if(qualityChanged)render();}
   }else{diagnostic?.idle();finish();if(qualityChanged)render();}
  }
  function setEnabled(next){enabled=!!next;cancelAnimationFrame(frame);frame=0;reset();if(enabled)frame=requestAnimationFrame(tick);}
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  window.addEventListener('pagehide',()=>setEnabled(false));
  return Object.freeze({setEnabled,interrupt:reset});
 }
 root.BodyExpedition=Object.freeze({stick,read,moving,advance,mount,series,diagnostics});
})(globalThis);
