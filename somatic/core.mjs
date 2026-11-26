export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(x)?x:a));
export const presets=Object.freeze([
 {name:'01 / Archive',ink:[.88,.81,.68],bg:[.055,.049,.042],light:.55,opacity:1,reveal:1,trail:0,grain:0,type:0},
 {name:'02 / Ossuary',ink:[.98,.94,.83],bg:[.015,.018,.018],light:.85,opacity:1,reveal:1,trail:0,grain:.12,type:1},
 {name:'03 / Iron lung',ink:[.70,.34,.24],bg:[.045,.025,.022],light:.38,opacity:.82,reveal:1,trail:.45,grain:.18,type:1},
 {name:'04 / Radiograph',ink:[.65,.77,.76],bg:[.026,.038,.041],light:.65,opacity:.65,reveal:.75,trail:.16,grain:.08,type:1},
 {name:'05 / Obsidian',ink:[.20,.23,.25],bg:[.018,.019,.021],light:.9,opacity:1,reveal:1,trail:0,grain:.06,type:0,rim:.9},
 {name:'06 / Porcelain',ink:[.99,.97,.92],bg:[.15,.14,.13],light:.6,opacity:1,reveal:1,trail:0,grain:0,type:1},
 {name:'07 / Hematic',ink:[.68,.18,.24],bg:[.04,.015,.025],light:.48,opacity:1,reveal:1,trail:.18,grain:.12,type:0},
 {name:'08 / Chromatic',ink:[.83,.48,.23],bg:[.045,.10,.13],light:.72,opacity:1,reveal:1,trail:.12,grain:.08,type:1}
].map(p=>Object.freeze({hue:0,saturation:.5,backgroundHue:0,contrast:.5,rim:.5,typeScale:.5,typeDepth:.5,typeRotation:.5,phrase:0,...p,ink:Object.freeze(p.ink),bg:Object.freeze(p.bg)})));
export const keys=['light','opacity','reveal','trail','grain','type','reactivity'];
export function neutral(){return {...presets[0],ink:[...presets[0].ink],bg:[...presets[0].bg],reactivity:0};}
export function applyPreset(i,reactivity=0){const p=presets[(i%presets.length+presets.length)%presets.length];return {...p,ink:[...p.ink],bg:[...p.bg],reactivity:clamp(reactivity)};}
export function effective(p,bands,reduced=false){const r=reduced?0:clamp(p.reactivity);return {...p,light:clamp(p.light+(clamp(bands[0])-.5)*.18*r),opacity:clamp(p.opacity-(clamp(bands[1])*.12*r),.12,1),grain:clamp(p.grain+clamp(bands[2])*.12*r),trail:reduced?0:clamp(p.trail,0,.65),drift:reduced?0:(clamp(bands[0])-.5)*.035*r};}
export function bandsFromBins(bins,sampleRate,fftSize){return [[35,180],[180,1800],[1800,8000]].map(([a,b])=>{const lo=Math.max(1,Math.ceil(a*fftSize/sampleRate)),hi=Math.min(bins.length-1,Math.floor(b*fftSize/sampleRate));let sum=0;for(let i=lo;i<=hi;i++)sum+=(bins[i]/255)**2;return hi>=lo?Math.sqrt(sum/(hi-lo+1)):0;});}
export function easeBands(old,next,dt){const k=1-Math.exp(-clamp(dt,0,.1)/.65);return old.map((x,i)=>clamp(x+(clamp(next[i])-x)*k));}
export const MAX_FRAMES=6000;
export function sampleSession(frames,t){if(!frames.length)return null;let lo=0,hi=frames.length-1;while(lo<hi){const m=Math.floor((lo+hi+1)/2);if(frames[m].t<=t)lo=m;else hi=m-1;}return frames[lo];}
export function percentile(values,q){if(!values.length)return null;const v=[...values].sort((a,b)=>a-b);return v[Math.max(0,Math.ceil(v.length*q)-1)];}
