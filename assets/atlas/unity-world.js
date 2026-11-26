/* UNITY WORLD: source identity and layout, not a physical registration or rendering engine. */
(function(root){
 'use strict';
 const manifestHash='e8c22674b3f29c3db3671632cb4ba0ccfcf7168a319dc9f77fb3c3773f09273f';
 const revision='53bd62452ae3fc34ba0fa6188517cd8ca9bf4a10';
 const regionCounts={SKULL:2,SPINAL_COLUMN:26,THORAX:25,UPPER_EXTREMITY_LEFT:5,UPPER_EXTREMITY_RIGHT:5,LOWER_EXTREMITY_LEFT:5,LOWER_EXTREMITY_RIGHT:5,HAND_LEFT:18,HAND_RIGHT:18,FOOT_LEFT:17,FOOT_RIGHT:17};
 const limitations=Object.freeze(['143 source labels, not 206 independent bones','Grouped phalanges, skull, sacrum+coccyx, sternum','Elbow CT gaps; hyoid, most sesamoids and costal cartilage unavailable','Fixed specimen pose; physical units and motion unvalidated','No Denver fusion']);
 const coordinates=Object.freeze({id:'bonehub-native-display-v1',status:'provisional-native-display',physicalUnits:null,box:s=>({id:s.id,min:[(240-s.max[0])*.005,(s.min[2]-1000)*.005,(s.min[1]-235)*.005],max:[(240-s.min[0])*.005,(s.max[2]-1000)*.005,(s.max[1]-235)*.005]})});
 const anchors=[['LEFT TOES','PHALANGE_FOOT_1_LEFT'],['LEFT FOOT','TALUS_LEFT'],['RIGHT TOES','PHALANGE_FOOT_1_RIGHT'],['RIGHT FOOT','TALUS_RIGHT'],['LEFT KNEE','PATELLA_LEFT'],['RIGHT KNEE','PATELLA_RIGHT'],['PELVIS','SACRUM'],['LEFT FINGERTIPS','PHALANGE_HAND_3_LEFT'],['LEFT WRIST','CAPITATE_LEFT'],['LEFT ARM','HUMERUS_LEFT'],['RIGHT FINGERTIPS','PHALANGE_HAND_3_RIGHT'],['RIGHT WRIST','CAPITATE_RIGHT'],['RIGHT ARM','HUMERUS_RIGHT'],['THORAX','STERNUM'],['NECK','VERTEBRA_C1'],['SKULL','SKULL_CRANIAL_MAXILLA']];
 const group=s=>s.source_name.startsWith('HIP_')||s.source_name==='SACRUM'?'PELVIS':s.region;
 const center=b=>b.min.map((v,k)=>(v+b.max[k])/2);
 function registry(m,coordinateProvider=coordinates){
  if(m.schema!=='body-live-unity-source-1'||m.revision!==revision||m.structureCount!==143||m.structures.length!==143)throw Error('UNITY inventory mismatch');
  const entries=m.structures,ids=new Set(),hashes=new Set(),counts={},entities=new Map(),boxes=[];
  for(const s of entries){
   if(s.id!=='bonehub-vhf-'+s.source_name.toLowerCase()||s.file!==s.id+'.glb'||ids.has(s.id)||hashes.has(s.source_sha256)||!regionCounts[s.region]||!/^([a-f0-9]{64})$/.test(s.sha256)||!/^([a-f0-9]{64})$/.test(s.source_sha256)||!s.source_url.includes('/resolve/'+revision+'/')||!Number.isSafeInteger(s.triangles)||s.triangles<1||s.min.length!==3||s.max.length!==3||s.min.some((v,k)=>!Number.isFinite(v)||!Number.isFinite(s.max[k])||v>s.max[k]))throw Error('UNITY invalid entity '+s.id);
   ids.add(s.id);hashes.add(s.source_sha256);counts[s.region]=(counts[s.region]||0)+1;
   const box=coordinateProvider.box(s);boxes.push(box);entities.set(s.id,Object.freeze({source:s,box,group:group(s),side:s.region.endsWith('_LEFT')?'left':s.region.endsWith('_RIGHT')?'right':null,grouped:/^PHALANGE_|^SKULL_CRANIAL|^SACRUM$|^STERNUM$/.test(s.source_name)}));
  }
  if(Object.keys(regionCounts).some(k=>counts[k]!==regionCounts[k])||entries.reduce((a,s)=>a+s.triangles,0)!==6070400||entries.filter(s=>s.reused).length!==61)throw Error('UNITY source coverage mismatch');
  const min=[0,1,2].map(k=>Math.min(...boxes.map(b=>b.min[k]))),max=[0,1,2].map(k=>Math.max(...boxes.map(b=>b.max[k]))),bounds={min,max,radius:Math.hypot(...max.map((v,k)=>v-min[k]))/2,center:{x:(min[0]+max[0])/2,y:(min[1]+max[1])/2,z:(min[2]+max[2])/2}};
  const landmarks=anchors.map(([label,...names])=>{const entity=names.map(n=>entities.get('bonehub-vhf-'+n.toLowerCase())).find(Boolean);if(!entity)throw Error('Missing landmark '+label);return {label,id:entity.source.id,point:center(entity.box)};});
  const index=Object.freeze({get:id=>entities.get(id),query:(min,max)=>boxes.filter(b=>b.min.every((v,k)=>v<=max[k]&&b.max[k]>=min[k])).map(b=>b.id),size:entities.size});
  return {entries,boxes,bounds,landmarks,index,coordinateProvider,limitations};
 }
 function location(points,c,previous){if(c.zoom<1.5)return 'UNITY WORLD';const ranked=points.map((p,i)=>({i,d:Math.hypot(p.point[0]-c.target.x,p.point[1]-c.target.y,p.point[2]-c.target.z)})).sort((a,b)=>a.d-b.d);const old=ranked.find(x=>x.i===previous);return old&&old.d<=ranked[0].d+.12?old.i:ranked[0].i;}
 // Navigation-provider boundary: replace with qualified GRAVITY adapter at integration, not another camera engine.
 const navigation=Object.freeze({location,next:(points,c,previous,direction)=>Math.max(0,Math.min(points.length-1,location(points,{...c,zoom:2},previous)+direction))});
 // Geometry-provider boundary: exact pinned bytes; NANITE can supply qualified levels without changing source IDs.
 const geometry=Object.freeze({id:'unity-exact-source-v1',url:(root,s)=>s.reused?root+'axis/v1/'+s.file:root+'unity/v1/'+s.file,integrity:s=>({bytes:s.bytes,sha256:s.sha256})});
 root.BodyUnity=Object.freeze({manifestHash,revision,regionCounts,coordinates,geometry,navigation,registry,limitations});
})(globalThis);
