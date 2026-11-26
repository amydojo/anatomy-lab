// Bounded, source-qualified session records. No cross-origin camera transfer.
export const AXIS_HASH='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7';
export const AXIS_SPACE='bonehub-vhf-axis-display-v1';
export const profiles=Object.freeze(['explorer','microsurgeon','cinematographer']);
export const profile=v=>profiles.includes(v)?v:'explorer';
export const namedRegion=i=>['hip','thorax','neck','skull'][i]||null;
export const somaticKey=region=>({hip:'0',thorax:'1',neck:'2',skull:'3',knee:'knee'})[region]??null;
export function validAxis(s){
 if(s?.version!==2||s.space!==AXIS_SPACE||s.manifestHash!==AXIS_HASH)return null;
 const c=s.camera;if(!c||!Number.isFinite(c.yaw)||Math.abs(c.yaw)>1e4||!Number.isFinite(c.pitch)||Math.abs(c.pitch)>.851||!Number.isFinite(c.zoom)||c.zoom<.7||c.zoom>14||!Number.isFinite(c.frameSpan)||c.frameSpan<.2||c.frameSpan>100||!['x','y','z'].every(k=>Number.isFinite(c.target?.[k])&&Math.abs(c.target[k])<100))return null;
 const region=['hip','thorax','neck','skull'].includes(s.region)?s.region:null;
 const id=typeof s.selection==='string'&&s.selection.length<=200?s.selection:null;
 return {version:2,space:AXIS_SPACE,manifestHash:AXIS_HASH,region,selection:id,camera:{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,frameSpan:c.frameSpan,target:{x:c.target.x,y:c.target.y,z:c.target.z},anchorX:.5,anchorY:.5},category:['All','Bone','Cartilage','Ligament','Muscle'].includes(s.category)?s.category:'All',savedAt:Number.isFinite(s.savedAt)?s.savedAt:0,thumbnail:typeof s.thumbnail==='string'&&s.thumbnail.length<70000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.thumbnail)?s.thumbnail:null};
}
export function validReturn(value,origin){try{const u=new URL(value);return u.origin===origin&&u.pathname==='/nexus/'&&!u.username&&!u.password?u.origin+'/nexus/':null;}catch{return null;}}
export function axisURL(p='explorer',resume=false){return '/atlas/?source=axis&expedition=1&nexus=1&gravity=1&gravityProfile='+profile(p)+(resume?'&resume=1':'');}
export function atlasURL(p='explorer',region=null){return '/atlas/?nexus=1&expedition=1&gravity=1&gravityProfile='+profile(p)+(['hip','thorax','neck','skull','knee','shoulder','elbow','wrist','ankle'].includes(region)?'&region='+region:'');}
export function navigationGate(state){if(!state||state.version!==1)return {allow:false,reason:'Creative state unavailable'};if(state.recording||state.replaying||state.videoRecording)return {allow:false,reason:'Stop recording or replay first'};if(state.unsavedTake||state.unsavedVideo||state.unsavedComposition||state.audioActive)return {allow:false,reason:'Save or export creative work and stop audio before leaving'};return {allow:true,reason:null};}
