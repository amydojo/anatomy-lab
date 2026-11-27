/* COCKPIT 001: semantic touch adapter, no physics or camera engine. */
(function cockpitModule(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),finite=x=>Number.isFinite(x)?x:0;
function create(options={}){
 const settings={size:1,sensitivity:1,opacity:.65,hand:'right',single:false,mono:false,reference:'vehicle',deadzone:.08,curve:1.45,...options},contacts=new Map();let peak=0,observed=0,cancels=0,look=[0,0],last={};
 function config(o={}){reset();settings.size=clamp(finite(o.size??settings.size),.75,1.4);settings.sensitivity=clamp(finite(o.sensitivity??settings.sensitivity),.5,1.6);settings.opacity=clamp(finite(o.opacity??settings.opacity),.3,1);settings.hand=(o.hand??settings.hand)==='left'?'left':'right';settings.single=!!(o.single??settings.single);settings.mono=!!(o.mono??settings.mono);settings.reference=(o.reference??settings.reference)==='camera'?'camera':'vehicle';settings.deadzone=clamp(finite(o.deadzone??settings.deadzone),.02,.22);settings.curve=clamp(finite(o.curve??settings.curve),1,2.4);return {...settings};}
 function down(id,role,x,y,r=55,type='touch'){
  if(!['steer','pedal','action','look'].includes(role)||contacts.has(id)||[...contacts.values()].some(q=>q.role===role))return false;
  if(settings.single&&contacts.size)return false;
  contacts.set(id,{role,x:finite(x),y:finite(y),originX:finite(x),originY:finite(y),r:Math.max(10,finite(r)),type});peak=Math.max(peak,contacts.size);observed=Math.max(observed,[...contacts.values()].filter(q=>q.type==='touch').length);return true;
 }
 function move(id,x,y){const q=contacts.get(id);if(!q)return false;x=finite(x);y=finite(y);if(q.role==='look'){look[0]=clamp(look[0]+x-q.x,-160,160);look[1]=clamp(look[1]+y-q.y,-160,160);}q.x=x;q.y=y;return true;}
 function up(id,cancel=false){const q=contacts.get(id);if(!q)return false;contacts.delete(id);if(cancel){cancels++;look=[0,0];}return true;}
 function reset(){contacts.clear();look=[0,0];last={};}
 function vector(q){const x=(q.x-q.originX)/q.r,y=(q.y-q.originY)/q.r,n=Math.hypot(x,y);if(n<=.06)return [0,0];const v=Math.pow(clamp((n-.06)/.94*settings.sensitivity,0,1),1.2);return [x/n*v,y/n*v];}
 function axis(v){const a=Math.abs(v);return a<=settings.deadzone?0:Math.sign(v)*Math.pow(clamp((a-settings.deadzone)/(1-settings.deadzone)*settings.sensitivity,0,1),settings.curve);}
 function read(state={}){
  let x=0,y=0,push=0,brake=0,assist=false,land=false,descend=false,grind=false,drive=false,action=null,mono=null,displacement=null;
  for(const q of contacts.values()){
   if(q.role==='steer'){drive=true;if(settings.single&&settings.mono){const dx=q.x-q.originX,dy=q.y-q.originY;x=axis(dx/q.r);y=axis(dy/q.r);push=Math.max(0,-y);brake=Math.max(0,y);mono={steer:x,reference:settings.reference};displacement={x:dx,y:dy,travel:q.r};}else{[x,y]=vector(q);if(settings.single)push=Math.hypot(x,y);}}
   if(q.role==='pedal'){const v=clamp((q.originY-q.y)/q.r*settings.sensitivity,-1,1);push=Math.max(push,Math.max(0,v));brake=Math.max(0,-v);drive=true;}
   if(q.role==='action'){action=q.action;assist=action==='lift';land=action==='land'&&!!state.glide;descend=land;grind=action==='grind'&&!!state.ground;}
  }
  last={x,y,push,brake,assist,land,descend,grind,drive,action,mono,displacement,active:contacts.size>0};return {...last};
 }
 function setAction(id,action){const q=contacts.get(id);if(q?.role==='action'&&['lift','land','grind'].includes(action))q.action=action;}
 function takeLook(){const q=look;look=[0,0];return q;}
 return {config,down,move,up,reset,read,setAction,takeLook,settings:()=>({...settings}),report:()=>({active:contacts.size,peak,observedTouchPoints:observed,cancels,reportedTouchPoints:Number(root.navigator?.maxTouchPoints)||0,settings:{...settings},intent:contacts.size?{...last}:{x:0,y:0,push:0,brake:0,assist:false,land:false,descend:false,grind:false,active:false}})};
}
// Separate the analog steering vector from throttle; keyboard/gamepad values remain intact.
function merge(base,t){
 if(!t?.active)return base;
 if(t.mono)return {...base,stick:[0,0],direction:null,mono:t.mono,push:Math.max(base.push,t.push),brake:Math.max(base.brake,t.brake),assist:base.assist||t.assist,land:base.land||t.land,descend:base.descend||t.descend,grind:base.grind||t.grind};
 const steering=Math.hypot(t.x,t.y)>.001,stick=steering?[t.x,t.y]:base.stick;
 return {...base,stick,direction:steering?null:base.direction,push:Math.max(base.push,t.push),brake:Math.max(base.brake,t.brake),assist:base.assist||t.assist,land:base.land||t.land,descend:base.descend||t.descend,grind:base.grind||t.grind};
}
function mount(panel,{state,onReset=()=>{},onLook=()=>{}}={}){
 const doc=panel.ownerDocument,win=doc.defaultView,params=new URLSearchParams(win.location.search);
 const monoVersion=params.get('cockpitVersion')!=='1';const c=create({mono:monoVersion,single:params.get('touch')==='single'||(params.get('touch')!=='dual'&&Number(win.navigator.maxTouchPoints)<=1)});let stored={};try{stored=JSON.parse(win.localStorage.getItem('marrow-cockpit-v1')||'{}');}catch{}if(stored&&typeof stored==='object'){const explicit=params.has('touch');c.config({...stored,mono:monoVersion,...(explicit?{single:params.get('touch')==='single'}:{}),...(params.has('steering')?{reference:params.get('steering')}:{})});}
 if(params.has('steering'))c.config({reference:params.get('steering')});
 const node=doc.createElement('div');node.className='cockpit';node.innerHTML='<div class="cockpit-look" data-role="look" aria-label="Drag to look"></div><div class="cockpit-steer" data-role="steer" aria-label="Floating steering joystick"><span class="cockpit-label">STEER</span><span class="mono-up">▲ DRIVE</span><span class="mono-down">▼ BRAKE</span><span class="mono-left">◀</span><span class="mono-right">▶</span><div class="cockpit-ring"><i></i></div></div><div class="cockpit-pedal" data-role="pedal" aria-label="Analog throttle and brake"><span>▲ THROTTLE</span><i></i><span>▼ BRAKE</span></div><div class="cockpit-actions"><button data-role="action" data-action="lift">LIFT</button><button data-role="action" data-action="land">LAND</button><button data-role="action" data-action="grind">GRIND</button></div>';
 panel.prepend(node);panel.classList.add('cockpit-enabled');
 const settings=doc.createElement('details');settings.className='cockpit-settings';settings.innerHTML='<summary>COCKPIT</summary><div><label>One-finger drive <input type="checkbox" data-setting="single"></label><label>Steering reference <select data-setting="reference"><option value="vehicle">Vehicle</option><option value="camera">Camera</option></select></label><label>Dead zone <input type="range" min=".02" max=".22" step=".01" data-setting="deadzone"></label><label>Curve <input type="range" min="1" max="2.4" step=".05" data-setting="curve"></label><label>Left-handed <input type="checkbox" data-setting="left"></label><label>Size <input type="range" min=".75" max="1.4" step=".05" data-setting="size"></label><label>Sensitivity <input type="range" min=".5" max="1.6" step=".05" data-setting="sensitivity"></label><label>Opacity <input type="range" min=".3" max="1" step=".05" data-setting="opacity"></label><output aria-live="polite"></output><small>Drag from center to accelerate/brake. Release to coast. Parked play only.</small></div>';panel.append(settings);
 const by=k=>settings.querySelector('[data-setting='+k+']'),output=settings.querySelector('output');
 const owners=new Map();let paused=false,captureFailures=0,fallbackMoves=0,moves=0,nativeMoves=0;
 function repaint(){const s=c.settings();node.dataset.hand=s.hand;node.dataset.single=String(s.single);node.dataset.mono=String(s.single&&s.mono);node.querySelector('.cockpit-label').textContent=s.single&&s.mono?'MONO':'STEER';by('reference').value=s.reference;node.style.setProperty('--cockpit-size',s.size);node.style.setProperty('--cockpit-opacity',s.opacity);by('single').checked=s.single;by('left').checked=s.hand==='left';for(const k of ['size','sensitivity','opacity','deadzone','curve'])by(k).value=s[k];}
 function clear(){const all=[...owners];owners.clear();c.reset();for(const [id,q] of all)try{if(q.el.hasPointerCapture(id))q.el.releasePointerCapture(id);}catch{}node.querySelector('.cockpit-ring').style.left='';node.querySelector('.cockpit-ring').style.top='';node.querySelector('.cockpit-ring').style.transform='';node.querySelector('.cockpit-ring i').style.transform='';node.querySelector('.cockpit-pedal i').style.transform='';onReset();}
 settings.onchange=()=>{clear();const s=c.config({single:by('single').checked,hand:by('left').checked?'left':'right',size:Number(by('size').value),sensitivity:Number(by('sensitivity').value),opacity:Number(by('opacity').value),reference:by('reference').value,deadzone:Number(by('deadzone').value),curve:Number(by('curve').value)});try{win.localStorage.setItem('marrow-cockpit-v1',JSON.stringify(s));}catch{}repaint();};
 settings.ontoggle=()=>{clear();};repaint();
 function down(e){const el=e.currentTarget,role=el.dataset.role;if(paused||settings.open||panel.querySelector('.cockpit-research')?.open||e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();e.stopPropagation();const rect=el.getBoundingClientRect(),r=role==='pedal'?Math.max(22,rect.height*.36):Math.max(28,Math.min(rect.width,rect.height)*(c.settings().single&&c.settings().mono?.46:.36));
  if(!c.down(e.pointerId,role,e.clientX,e.clientY,r,e.pointerType))return;owners.set(e.pointerId,{el,role,x:e.clientX,y:e.clientY,r});if(role==='action')c.setAction(e.pointerId,el.dataset.action);if(role==='steer'){const ring=el.querySelector('.cockpit-ring');ring.style.left=(e.clientX-rect.left)+'px';ring.style.top=(e.clientY-rect.top)+'px';}try{el.setPointerCapture(e.pointerId);if(!el.hasPointerCapture(e.pointerId))captureFailures++;}catch{captureFailures++;} }
 function move(e){const q=owners.get(e.pointerId);if(!q)return;if(e.pointerType==='mouse'&&e.buttons===0){up(e);return;}moves++;if(e.isTrusted)nativeMoves++;if(!q.el.contains(e.target))fallbackMoves++;e.preventDefault();e.stopPropagation();c.move(e.pointerId,e.clientX,e.clientY);if(q.role==='steer'){const x=e.clientX-q.x,y=e.clientY-q.y,d=Math.max(1,Math.hypot(x,y)/q.r);q.el.querySelector('i').style.transform='translate('+x/d+'px,'+y/d+'px)';}if(q.role==='pedal')q.el.querySelector('i').style.transform='translateY('+clamp(e.clientY-q.y,-q.r,q.r)+'px)';}
 function up(e){const q=owners.get(e.pointerId);if(!q)return;owners.delete(e.pointerId);c.up(e.pointerId,e.type!=='pointerup');if(q.role==='steer'){const ring=q.el.querySelector('.cockpit-ring');ring.style.left='';ring.style.top='';ring.querySelector('i').style.transform='';}if(q.role==='pedal')q.el.querySelector('i').style.transform='';}
 for(const el of node.querySelectorAll('[data-role]')){el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);}
 // Single capture-phase route processes each movement once, including failed pointer capture.
 win.addEventListener('pointermove',move,{capture:true,passive:false});
 win.addEventListener('pointerup',up,true);win.addEventListener('pointercancel',up,true);
 const neutral=()=>clear(),visibility=()=>{if(doc.hidden)clear();};win.addEventListener('blur',neutral);win.addEventListener('pagehide',neutral);win.addEventListener('resize',neutral);win.addEventListener('orientationchange',neutral);doc.addEventListener('visibilitychange',visibility);
 const stop=e=>e.preventDefault();node.addEventListener('contextmenu',stop);node.addEventListener('selectstart',stop);
 return {sample(s){const t=c.read(s);const d=c.takeLook();if(d[0]||d[1])onLook(d);node.dataset.air=String(!!s.glide);const q=c.report();if(settings.open)output.textContent='Touch points: '+q.reportedTouchPoints+' advertised / '+q.observedTouchPoints+' observed · '+q.active+' active';return t;},reset:clear,pause(v){if(paused!==!!v){clear();paused=!!v;node.hidden=paused;}},report:()=>({...c.report(),delivery:{moves,nativeMoves,fallbackMoves,captureFailures}}),destroy(){clear();win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',up,true);win.removeEventListener('pointercancel',up,true);win.removeEventListener('blur',neutral);win.removeEventListener('pagehide',neutral);win.removeEventListener('resize',neutral);win.removeEventListener('orientationchange',neutral);doc.removeEventListener('visibilitychange',visibility);node.remove();settings.remove();}};
}
root.BodyCockpit=Object.freeze({create,merge,mount,version:2});
})(globalThis);
