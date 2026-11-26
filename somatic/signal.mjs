import {clamp} from './core.mjs';
export const silence=()=>({rms:0,peak:0,energy:0,bass:0,mid:0,high:0,onset:0,transient:0,flux:0,bpm:null,confidence:0,phase:0,active:false});
export function bandEnergy(db,rate,fft,lo,hi){let sum=0;const a=Math.max(1,Math.ceil(lo*fft/rate)),b=Math.min(db.length-1,Math.floor(hi*fft/rate));for(let i=a;i<=b;i++)if(Number.isFinite(db[i]))sum+=10**(db[i]/10);return Math.min(1,Math.sqrt(sum));}
export function envelope(old,target,dt,attack=.045,release=.24){return old+(target-old)*(1-Math.exp(-Math.max(0,dt)/(target>old?attack:release)));}
export function tempoEstimate(times){const gaps=[];for(let i=1;i<times.length;i++){const d=times[i]-times[i-1];if(d>=.27&&d<=1.2)gaps.push(d);}if(gaps.length<4)return {bpm:null,confidence:0};const sorted=[...gaps].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],agree=gaps.filter(x=>Math.abs(x-median)<median*.12).length/gaps.length,confidence=agree*Math.min(1,gaps.length/7);return confidence>=.65?{bpm:Math.round(60/median),confidence}:{bpm:null,confidence};}
export class Signal{
 constructor(){this.reset();}
 reset(){this.value=silence();this.prev=null;this.level=.12;this.noise=.002;this.last=-Infinity;this.lastBroad=-Infinity;this.events=[];this.at=null;this.bassRaw=0;this.tapTimes=[];}
 tap(t){this.tapTimes.push(t);if(this.tapTimes.length>8)this.tapTimes.shift();return tempoEstimate(this.tapTimes);}
 sample(time,db,pcm,rate,fft,sensitivity=1,noiseFloor=.006){const dt=this.at===null?.033:clamp(time-this.at,.005,.2);this.at=time;let sq=0,peak=0;for(const x of pcm){sq+=x*x;peak=Math.max(peak,Math.abs(x));}const rms=Math.sqrt(sq/Math.max(1,pcm.length)),floor=Math.max(noiseFloor,this.noise*2);if(rms<floor){this.noise=envelope(this.noise,Math.min(rms,.01),dt,.5,2);this.prev=null;this.bassRaw=0;this.value={...silence(),rms,peak};return this.value;}
 this.level=envelope(this.level,Math.max(.04,rms),dt,.12,3);const gain=clamp(.38/Math.max(.04,this.level)*sensitivity,.25,8),raw=[bandEnergy(db,rate,fft,35,180),bandEnergy(db,rate,fft,180,1800),bandEnergy(db,rate,fft,1800,8000)];let flux=0;if(!this.prev||this.prev.length!==db.length)this.prev=new Float32Array(db.length);for(let i=1;i<db.length;i++){const x=Number.isFinite(db[i])?10**(db[i]/20):0;flux+=Math.max(0,x-this.prev[i]);this.prev[i]=x;}flux=clamp(flux*.3*gain);const bassRise=Math.max(0,raw[0]-this.bassRaw);this.bassRaw=raw[0];let onset=false,transient=false;if(bassRise*gain>.11&&time-this.last>.22){onset=true;this.last=time;this.events.push(time);if(this.events.length>12)this.events.shift();}if(flux>.16&&time-this.lastBroad>.16){transient=true;this.lastBroad=time;}
 const tempo=tempoEstimate(this.events.filter(t=>time-t<12)),v=this.value;this.value={rms,peak,energy:envelope(v.energy,clamp(rms*gain*1.8),dt),bass:envelope(v.bass,clamp(raw[0]*gain),dt),mid:envelope(v.mid,clamp(raw[1]*gain),dt),high:envelope(v.high,clamp(raw[2]*gain),dt),onset:onset?1:Math.exp(-dt/.17)*v.onset,transient:transient?1:Math.exp(-dt/.15)*v.transient,flux,bpm:tempo.bpm,confidence:tempo.confidence,phase:tempo.bpm?((time-this.last)*tempo.bpm/60)%1:0,active:true};return this.value;}
}
const route=(source,dest,amount,attack=.05,release=.23)=>({source,dest,amount,attack,release,min:0,max:1,invert:false,curve:1,mode:'add',enabled:true});
// One route graph for global and tissue parameters. Toward routes interpolate from the immutable base.
const toward=(source,dest,target,attack=.045,release=.24)=>({...route(source,dest,target,attack,release),mode:'toward',min:.04,max:.64,curve:.65});
const crossfade=()=>[toward('impact','tissue:Muscle:opacity',.12),toward('impact','tissue:Bone:opacity',1)];
const vesselRoutes=()=>[toward('impact','tissue:Artery:opacity',1),toward('impact','tissue:Vein:opacity',1),route('mid','tissue:Artery:hue',.23),route('high','tissue:Vein:hue',.32),toward('impact','tissue:Artery:light',.92),toward('impact','tissue:Vein:light',.88)];
export const reactionNames=['OFF','SUBTLE','EXPRESSIVE','EXTREME'];
export const reactionGains=[0,.42,1.25,1.75];
export const patches=[
 {name:'IRON HEART',description:'Bass pressure / depth and restrained key light',routes:[route('bass','reveal',-.62),route('onset','light',.22,.045,.25),route('bass','rim',.28),...crossfade()]},
 {name:'GHOST SIGNAL',description:'Anatomical echoes / high-frequency texture',routes:[route('bass','trail',.38),route('high','grain',.5),route('energy','opacity',-.2)]},
 {name:'VISCERAL',description:'Complementary muscle / bone crossfade · vascular color',routes:[...crossfade(),route('mid','tissue:Artery:hue',.18),route('mid','tissue:Vein:hue',.22)]},
 {name:'GLYPH TRANSMISSION',description:'Typography breath / transient scale',routes:[route('mid','type',.8),route('transient','typeScale',.4),route('mid','typeY',.12)]},
 {name:'SUBSTRUCTURE',description:'Bass-driven reveal / persistence',routes:[route('bass','reveal',-.8),route('bass','trail',.24),...crossfade()]},
 {name:'MACHINE BODY',description:'Rhythmic accents / restrained spatial movement',routes:[route('beat','rim',.35),route('onset','reveal',-.45),route('energy','drift',.026)]},
 {name:'STILL LIFE',description:'Slow sculptural envelopes',routes:[route('energy','light',.10,.6,1.1),route('bass','rim',.10,.6,1.1)]},
 {name:'LEGACY',description:'Existing Director audio faders',routes:[]},
 {name:'DISSECTION',description:'Rhythmic muscle-to-bone transitions · stationary or moving',routes:crossfade()},
 {name:'PULSE',description:'Vascular material accents · visible vessel layers required',routes:[...vesselRoutes(),route('impact','tissue:Muscle:hue',.15),route('onset','rim',.12)]},
 {name:'GHOST FLESH',description:'Fading muscle and persistent skeletal echoes',routes:[...crossfade(),route('bass','trail',.32,.08,.6)]},
 {name:'METAMORPHOSIS',description:'Complementary transitions across visible tissue systems',routes:[...crossfade(),toward('mid','tissue:Connective:opacity',.18),toward('high','tissue:Nerve:opacity',1),toward('mid','tissue:Cartilage:opacity',.3),route('mid','tissue:Tendon:hue',.3)]},
 {name:'CHROMATIC ANATOMY',description:'Separate color responses on actual visible tissues',routes:[route('bass','tissue:Bone:hue',.24),route('mid','tissue:Muscle:hue',.42),route('high','tissue:Artery:hue',.28),route('mid','tissue:Vein:hue',.38),route('transient','tissue:Nerve:hue',.3),route('energy','tissue:Connective:hue',.2)]},
 {name:'RESONANT BODY',description:'Layer reveal, controlled light, glyph and temporal echoes',routes:[...crossfade(),route('onset','light',.16),route('mid','type',.35),route('bass','trail',.23),route('mid','tissue:Artery:hue',.2)]}
];
export const modes=['BREATHE','PULSE','FLOW','SEQUENCE','MANUAL'];
export function patchValues(base,signal,routes,intensity,reduced=false,bypass=false,env=[],dt=.033,mode='FLOW',manual=0,tapBpm=null,now=0,tissue={gain:1.25,attack:1,release:1}){
 const out={...base,drift:0};if(reduced||bypass)return {out:{...out,trail:reduced?0:out.trail},env:[]};
 const confidence=signal.confidence>=.65,beat=tapBpm?Math.exp(-((now*tapBpm/60)%1)*5):confidence?Math.exp(-signal.phase*5):signal.bass;
 // Bass envelope backs up short onsets when a slow render misses the transient.
 const impact=Math.max(signal.onset||0,(signal.bass||0)*.85);
 const sources={...signal,impact,beat,manual,lfo:(1+Math.sin(now*2*Math.PI*.25))/2},sums={},next=[];
 for(let i=0;i<routes.length;i++){const r=routes[i],k=r.dest,isTissue=k.startsWith('tissue:');
  if(!r.enabled||!(k in out)||typeof out[k]!=='number'||isTissue&&tissue.gain===0){next.push(0);continue;}
  let x=mode==='MANUAL'?manual:mode==='SEQUENCE'?beat:mode==='PULSE'?(r.source==='impact'?impact:r.source==='bass'?Math.max(signal.onset,signal.bass*.2):Math.max(signal.transient,(sources[r.source]||0)*.25)):sources[r.source]||0;
  if(!signal.active&&manual<.002&&!(tapBpm&&mode==='SEQUENCE'))x=0;
  if(r.invert&&x>0)x=1-x;x=x>0?clamp((x-r.min)/Math.max(.001,r.max-r.min))**clamp(r.curve,.25,4):0;
  const attack=Math.max(.03,r.attack*(isTissue?tissue.attack:1)),release=Math.max(.08,r.release*(isTissue?tissue.release:1));let y=envelope(env[i]||0,x,dt,mode==='BREATHE'?Math.max(.5,attack):attack,mode==='BREATHE'?Math.max(.9,release):release);if(x===0&&y<.004)y=0;next.push(y);
  const strength=clamp(clamp(intensity)*y*(isTissue?tissue.gain:1));
  const delta=r.mode==='toward'?(clamp(r.amount)-base[k])*strength:clamp(r.amount,-.8,.8)*strength*(r.mode==='multiply'?base[k]:1);
  sums[k]=(sums[k]||0)+delta;
 }
 for(const [k,v] of Object.entries(sums)){const lo=k==='opacity'?.12:k==='drift'?-.035:0,hi=k==='trail'?.65:k==='drift'?.035:1;out[k]=clamp(out[k]+clamp(v,-1,1),lo,hi);}return {out,env:next};
}

export const routeSources=['impact','energy','bass','mid','high','onset','transient','flux','beat','manual','lfo'];
export const routeDestinations=['hue','saturation','backgroundHue','light','rim','contrast','opacity','reveal','trail','type','typeScale','typeX','typeY','grain','drift'];
export function validateRoutes(input){if(!Array.isArray(input)||input.length>12)return null;const out=[];for(const r of input){if(!r||!routeSources.includes(r.source)||!(routeDestinations.includes(r.dest)||/^tissue:[A-Z][a-z]{1,25}:(opacity|hue|light)$/.test(r.dest))||!['add','multiply','toward'].includes(r.mode)||typeof r.enabled!=='boolean'||typeof r.invert!=='boolean')return null;for(const [k,lo,hi] of [['amount',r.mode==='toward'?0:-.8,r.mode==='toward'?1:.8],['attack',.03,2],['release',.08,3],['min',0,1],['max',0,1],['curve',.25,4]])if(!Number.isFinite(r[k])||r[k]<lo||r[k]>hi)return null;if(r.min>r.max)return null;out.push({...r});}return out;}
