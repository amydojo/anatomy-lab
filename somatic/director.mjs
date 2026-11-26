// Controller-native menu model; no DOM or geometry mutations.
export const specimens=Object.freeze([
 {id:'3',name:'Cranium',region:'01 / CRANIAL',source:'BoneHub · female CT',tissues:'Bone',count:4},
 {id:'2',name:'Cervical spine',region:'02 / CERVICAL',source:'BoneHub · female CT',tissues:'Bone',count:8},
 {id:'1',name:'Thoracic cage',region:'03 / THORACIC',source:'BoneHub · female CT',tissues:'Bone',count:43},
 {id:'0',name:'Lumbar spine / pelvis',region:'04 / LUMBAR',source:'BoneHub · female CT',tissues:'Bone',count:10},
 {id:'knee',name:'Right knee',region:'05 / DENVER',source:'Denver · VHF reconstruction',tissues:'Bone · muscle · cartilage · ligament',count:17},
 {id:'world',name:'Lower body',region:'06 / DENVER',source:'Denver · VHF reconstruction',tissues:'Bone · muscle · cartilage · ligament',count:128}
]);
export const wrap=(i,n)=>((i%n)+n)%n;
export function repeatButtons(){let held=new Map();return {reset(){held.clear();},read(buttons,now,allowed=[12,13,14,15]){const hits=[];for(const n of allowed){if(!buttons[n]){held.delete(n);continue;}if(!held.has(n)){hits.push(n);held.set(n,now+350);}else if(now>=held.get(n)){hits.push(n);held.set(n,now+125);}}return hits;}};}
export function shapeInput(i,sensitivity=1,dead=.0){const shape=v=>Math.sign(v)*Math.max(0,Math.abs(v)-dead)/(1-dead)*sensitivity;return {...i,panX:shape(i.panX),panY:shape(i.panY),orbitX:shape(i.orbitX),orbitY:shape(i.orbitY),zoom:i.zoom*sensitivity};}
export function menuInput(buttons,previous,repeat){const edge=n=>buttons[n]&&!previous[n];if(edge(1)||edge(9)||edge(8)||edge(10))return 'cancel';if(edge(0))return 'confirm';if(repeat.includes(12))return 'up';if(repeat.includes(13))return 'down';if(repeat.includes(14))return 'left';if(repeat.includes(15))return 'right';return null;}
export function validateLook(v,base){if(!v||typeof v!=='object'||typeof v.name!=='string'||v.name.length>60)return null;const out={...base,name:v.name};for(const k of Object.keys(base)){if(typeof base[k]==='number'){if(!Number.isFinite(v[k])||v[k]<0||v[k]>1)return null;out[k]=v[k];}else if(Array.isArray(base[k])){if(!Array.isArray(v[k])||v[k].length!==3||!v[k].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return null;out[k]=[...v[k]];}}return out;}
