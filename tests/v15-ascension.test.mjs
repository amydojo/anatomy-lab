import test from 'node:test';import assert from 'node:assert/strict';import '../assets/atlas/vhf-source.js';const V=globalThis.BodyVHF;
test('shared axial display transform preserves relative positions and handedness',()=>{const a=V.compact(new Float32Array([240,235,1000,241,235,1000,240,236,1000]),new Uint32Array([0,1,2]),true);assert.equal(a.positions[0],0);assert.ok(Math.abs(a.positions[3]+.005)<1e-8);assert.ok(Math.abs(a.positions[8]-.005)<1e-8);});
test('axial regional inventory preserves L6 and excludes overlapping femurs',()=>{assert.ok(V.axisIncludes({source_name:'VERTEBRA_L6'},0));assert.ok(V.axisIncludes({source_name:'VERTEBRA_T12'},0));assert.ok(V.axisIncludes({source_name:'VERTEBRA_T12'},1));assert.equal(V.axisIncludes({source_name:'FEMUR_LEFT'},0),false);});

import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../assets/atlas/vhf/axis/v1/manifest.json',import.meta.url),'utf8'));
test('CONTINUUM world uses all 59 source structures and fixed shared bounds',()=>{const w=V.axisWorldLayout(manifest);assert.equal(w.entries.length,59);assert.equal(new Set(w.entries.map(s=>s.id)).size,59);assert.equal(w.entries.filter(s=>s.source_name.startsWith('RIB_')).length,24);assert.equal(w.entries.filter(s=>s.region==='SKULL').length,2);assert.equal(w.entries.filter(s=>s.source_name.startsWith('VERTEBRA_')).length,25);assert.ok(w.entries.every(s=>!s.source_name.startsWith('FEMUR_')));assert.equal(w.entries.reduce((n,s)=>n+s.triangles,0),3915232);assert.ok(w.landmarks.every((p,i)=>i===0||p.point[1]>w.landmarks[i-1].point[1]));for(const b of w.boxes)for(let k=0;k<3;k++){assert.ok(w.bounds.min[k]<=b.min[k]);assert.ok(w.bounds.max[k]>=b.max[k]);}});
test('CONTINUUM location depends on camera target, not ownership or loading',()=>{const w=V.axisWorldLayout(manifest);for(const [i,p] of w.landmarks.entries()){const c={zoom:3,target:{x:p.point[0],y:p.point[1],z:p.point[2]}};assert.equal(V.axisLocation(w.landmarks,c,null),i);assert.equal(V.axisLocation(w.landmarks,{...c,zoom:1},null),'AXIAL WORLD');}});

import vm from 'node:vm';
test('VELOCITY worker transfers exact positions, topology and packed normals',()=>{const entry=manifest.structures.find(s=>s.source_name==='VERTEBRA_C1');const bytes=readFileSync(new URL('../assets/atlas/vhf/axis/v1/'+entry.file,import.meta.url));const raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);const direct=V.parse(raw,{structures:[{...entry,tissue:'Bone'}]},true,true)[0];let message,transfers;const worker={BodyVHF:V,postMessage:(data,list)=>{message=data;transfers=list;}};vm.runInNewContext(readFileSync(new URL('../assets/atlas/vhf-geometry-worker.js',import.meta.url),'utf8'),{self:worker,importScripts:()=>{},performance});worker.onmessage({data:{id:1,buffer:raw,structure:entry}});assert.equal(message.id,1);assert.equal(message.part.id,direct.id);assert.deepEqual(message.part.positions,direct.positions);assert.deepEqual(message.part.indices,direct.indices);assert.deepEqual(message.part.packed,V.packVertices(direct.positions,direct.indices));assert.equal(transfers.length,3);});

test('RESIDENCY conservative overview framing contains every source AABB in initial portrait and landscape view',()=>{
 const world=V.axisWorldLayout(manifest),b=world.bounds,target={x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2,z:(b.min[2]+b.max[2])/2};
 for(const [width,height] of [[390,844],[1280,720],[844,390]]){
  const c={width,height,target,yaw:0,pitch:0,zoom:1,anchorX:.5,anchorY:.5,frameSpan:V.overviewFrameSpan(b)};
  assert.ok(world.boxes.every(p=>V.inView(p,c)),`Initial overview clipped in ${width}x${height}`);
 }
});
test('RESIDENCY LOD candidates preserve source identity and use bounded correspondence; exact is retained on rejection',()=>{
 const entry=manifest.structures.find(s=>s.source_name==='VERTEBRA_C1'),bytes=readFileSync(new URL('../assets/atlas/vhf/axis/v1/'+entry.file,import.meta.url));
 const part=V.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{structures:[{...entry,tissue:'Bone'}]},true,true)[0];
 part.lods=V.buildLods(part);
 for(const p of part.lods){assert.equal(p.id,part.id);assert.ok(p.indices.length<part.indices.length);assert.ok(p.certificate.maxSurfaceDistanceUpperBound<=p.certificate.limit);assert.ok(p.certificate.relativeBound<=(p.lodLevel==='overview'?.012:.004));assert.ok(p.indices.every(i=>i<p.positions.length/3));}
 assert.equal(V.chooseLod(part,{zoom:8},null),part);assert.equal(V.chooseLod(part,{zoom:1},part.id),part);
 const chosen=V.chooseLod(part,{zoom:1},null);assert.ok(chosen===part||part.lods.includes(chosen));
});

test('RESIDENCY demonstrates non-vacuous reduction on pinned C1 and rib geometry',()=>{
 for(const [name,level] of [['VERTEBRA_C1','overview'],['RIB_12_LEFT','regional']]){
  const e=manifest.structures.find(s=>s.source_name===name),b=readFileSync(new URL('../assets/atlas/vhf/axis/v1/'+e.file,import.meta.url));
  const p=V.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{structures:[{...e,tissue:'Bone'}]},true,true)[0],lod=V.buildLods(p).find(x=>x.lodLevel===level);
  assert.ok(lod,`${name}: no useful ${level} LOD`);assert.ok(lod.indices.length<p.indices.length*.95);assert.ok(lod.certificate.relativeBound<=(level==='overview'?.012:.004));
 }
});
