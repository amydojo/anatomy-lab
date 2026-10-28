/* BODY / LIVE V7.0 · Strictly sourced whole-body detail regions.
 * All source geometry is pinned BodyParts3D 4.0, CC BY 4.0, rest pose.
 * The 3 illustrative hinges are NOT measured biomechanical motion.
 */
(function(){'use strict';
const IDS=['skull','neck','thorax','elbow','wrist','ankle'];
const REGIONS={
 skull:{title:'Skull & Jaw',summary:'14 sourced bones · cranium and face',
   labels:['All source bones','Cranial vault','Facial bones','Mandible only'],
   anchor:'frontal-bone',yaw:.2,zoom:1.22,span:2.55,delta:[0,-.12,0],group:'head'},
 neck:{title:'Cervical Spine',summary:'Atlas · axis · C3–C7 · hyoid',
   labels:['All neck bones','Atlas / axis','C3 through C7','Hyoid'],
   anchor:'atlas',yaw:.35,zoom:1.3,span:1.85,delta:[0,-.31,0],group:'spine'},
 thorax:{title:'Ribs & Thorax',summary:'24 ribs · sternum · thoracic spine',
   labels:['All thoracic bones','24 ribs','Sternum parts','Thoracic vertebrae'],
   anchor:'body-of-sternum',yaw:-.18,zoom:1.08,span:4.5,delta:[0,-.03,0],group:'thorax'},
 elbow:{title:'Right Elbow',summary:'Humerus · radius · ulna',
   labels:['All elbow bones','Humerus','Radius / ulna','Articulating bones'],
   anchor:'right-ulna',anchorMode:'proximal',yaw:.55,zoom:1.1,span:2.55,delta:[0,-.17,0],group:'upper',
   motion:{label:'Elbow flexion',max:130,axis:'x',sign:1}},
 wrist:{title:'Right Wrist',summary:'8 carpals · 5 metacarpals · forearm',
   labels:['All wrist bones','Eight carpals','Metacarpals','Radius / ulna'],
   anchor:'right-radius',anchorMode:'distal',yaw:.42,zoom:1.14,span:1.66,delta:[0,-.09,0],group:'upper',
   motion:{label:'Wrist flexion',max:65,axis:'x',sign:-1}},
 ankle:{title:'Right Ankle',summary:'Talus · heel · tarsals · metatarsals',
   labels:['All ankle/foot bones','Talus / heel','Midfoot / metatarsals','Tibia / fibula'],
   anchor:'right-tibia',anchorMode:'distal',yaw:.5,zoom:1.10,span:2.25,delta:[0,-.10,0],group:'lower',
   motion:{label:'Ankle dorsiflexion',max:30,axis:'x',sign:-1}}
};
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const clamp=(a,b,c)=>Math.min(c,Math.max(b,a));
const mean=points=>[0,1,2].map(i=>points.reduce((n,p)=>n+p[i],0)/points.length);
function hingeOrigin(region,parts){
 const conf=REGIONS[region],vertices=parts;
 const proximal=(ps,d)=>{const ys=ps.map(v=>v[1]),boundary=d==='high'?Math.max(...ys):Math.min(...ys);
  const subset=ps.filter(p=>Math.abs(p[1]-boundary)<.15);return mean(subset.length>5?subset:ps);};
 if(region==='elbow'){
  const u=proximal(vertices['right-ulna'].vertices,'high');
  const r=proximal(vertices['right-radius'].vertices,'high');
  return mean([u,r]);
 }
 if(region==='wrist'){
  const radius=proximal(vertices['right-radius'].vertices,'low');
  const ulna=proximal(vertices['right-ulna'].vertices,'low');
  return mean([radius,ulna]);
 }
 if(region==='ankle'){
  const tibia=proximal(vertices['right-tibia'].vertices,'low');
  const fibula=proximal(vertices['right-fibula'].vertices,'low');
  const talus=proximal(vertices['right-talus'].vertices,'high');
  return mean([tibia,fibula,talus]);
 }
 return null;
}
function moving(region,id){
 if(region==='elbow')return id==='right-radius'||id==='right-ulna';
 if(region==='wrist')return /^(right-(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)|right-(first|second|third|fourth|fifth)-metacarpal-bone)$/.test(id);
 if(region==='ankle')return !['right-tibia','right-fibula'].includes(id);
 return false;
}
function layers(region,ids,layer){
 if(layer<=0)return true;
 if(region==='skull')return layer===1? /^(frontal-bone|occipital-bone|sphenoid-bone|.*parietal-bone|.*temporal-bone)$/.test(ids):
   layer===2?/^(mandible|.*maxilla|.*nasal-bone|.*zygomatic-bone)$/.test(ids):ids==='mandible';
 if(region==='neck')return layer===1?['atlas','axis'].includes(ids):
  layer===2?/cervical-vertebra/.test(ids):ids==='hyoid-bone';
 if(region==='thorax')return layer===1?/rib$/.test(ids):layer===2?
  ['manubrium','body-of-sternum','xiphoid-process'].includes(ids):/thoracic-vertebra/.test(ids);
 if(region==='elbow')return layer===1?ids==='right-humerus':
  layer===2?['right-radius','right-ulna'].includes(ids):true;
 if(region==='wrist')return layer===1?/^(right-(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate))$/.test(ids):
  layer===2?/metacarpal-bone/.test(ids):['right-radius','right-ulna'].includes(ids);
 if(region==='ankle')return layer===1?['right-talus','right-calcaneus'].includes(ids):
  layer===2?!['right-tibia','right-fibula','right-talus','right-calcaneus'].includes(ids):
  ['right-tibia','right-fibula'].includes(ids);
 return true;
}
function rotate(axis,pivot,angle){
 const m=I(),c=Math.cos(angle),s=Math.sin(angle);
 if(axis==='x'){m[5]=c;m[6]=s;m[9]=-s;m[10]=c;
  m[13]=pivot[1]*(1-c)+pivot[2]*s;m[14]=pivot[2]*(1-c)-pivot[1]*s;}
 else if(axis==='z'){m[0]=c;m[1]=s;m[4]=-s;m[5]=c;
  m[12]=pivot[0]*(1-c)+pivot[1]*s;m[13]=pivot[1]*(1-c)-pivot[0]*s;}
 return m;
}
const transform=(m,p)=>[
 m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
 m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function createPose(region,asset,flex){
 const spec=REGIONS[region];if(!spec)throw Error('Unknown anatomy region: '+region);
 const degrees=clamp(Number(flex)||0,0,spec.motion?.max||0);
 const pivot=spec.motion?hingeOrigin(region,asset.parts):null;
 const hinged=spec.motion?rotate(spec.motion.axis,pivot,spec.motion.sign*degrees*Math.PI/180):I();
 const matrices=Object.fromEntries(Object.keys(asset.parts).map(id=>[id,moving(region,id)?hinged:I()]));
 return {degrees,pivot,matrices,validated:false,method:'illustrative-unmeasured-joint-hinge'};
}
const has=name=>IDS.includes(name);
window.BodyExtendedRegions=Object.freeze({ids:IDS,config:REGIONS,has,createPose,layers,moving,identity:I,transform});
})();