import {clamp} from './core.mjs';
export const expandedIds=['exact-head-neck','exact-head-face-extension','exact-thorax-shoulder','exact-arms-hands'];
export function categories(parts){return [...new Set(parts.map(p=>p.category))].sort();}
export function defaults(cats){return Object.fromEntries(cats.map(k=>[k,{visible:true,opacity:1,hue:0}]));}
export function validateLayers(input,cats){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==cats.length)return null;const out=defaults(cats);for(const k of cats){const v=input[k];if(!v||typeof v.visible!=='boolean'||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||!Number.isFinite(v.hue)||v.hue<0||v.hue>1)return null;out[k]={visible:v.visible,opacity:v.opacity,hue:v.hue};}return out;}
export const compositions=[
 {name:'VISCERAL PORTRAIT',specimen:'exact-head-face-extension',focus:['Muscle'],context:['Bone'],opacity:.2,ink:[.65,.20,.24],type:1},
 {name:'TENSION',specimen:'exact-head-neck',focus:['Muscle','Tendon','Bone'],context:[],opacity:0,ink:[.88,.79,.66],type:0},
 {name:'THORACIC MACHINE',specimen:'exact-thorax-shoulder',focus:['Bone','Muscle'],context:['Cartilage'],opacity:.45,ink:[.68,.34,.24],type:0},
 {name:'NEURAL GHOST',specimen:'exact-head-neck',focus:['Nerve'],context:['Bone','Muscle'],opacity:.13,ink:[.69,.78,.73],type:0},
 {name:'THE INSTRUMENT',specimen:'exact-arms-hands',focus:['Bone','Muscle','Connective'],context:['Artery','Vein'],opacity:.35,ink:[.84,.78,.66],type:1}
];
export function compositionLayers(cats,c){const out=defaults(cats);for(const k of cats){out[k].visible=c.focus.includes(k)||c.context.includes(k);out[k].opacity=c.context.includes(k)?c.opacity:1;}return out;}


export function layerParameters(base){return Object.fromEntries(Object.entries(base).flatMap(([k,v])=>[['tissue:'+k+':opacity',v.opacity],['tissue:'+k+':hue',v.hue]]));}
export function applyLayerParameters(base,values){const out=structuredClone(base);for(const [k,v] of Object.entries(out)){for(const prop of ['opacity','hue']){const n=values?.['tissue:'+k+':'+prop];if(Number.isFinite(n))v[prop]=clamp(n);}}return out;}
