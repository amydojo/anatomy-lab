import test from 'node:test';
import assert from 'node:assert/strict';
import {gpuBytes,projectedError,chooseLevel,decodeBLD,packCompact,Residency,partitionExact,validateManifest} from '../assets/atlas/unity-geometry.mjs';
const mesh={positions:new Float32Array([0,0,0,1,0,0,1,1,0,0,1,0]),indices:new Uint16Array([0,1,2,0,2,3])};
const bounds={min:[0,0,0],max:[1,1,1]};
const camera={width:320,height:640,frameSpan:8,zoom:1,yaw:0,pitch:0,target:{x:0,y:0,z:0}};
test('projection accounts for viewport and depth, not zoom alone',()=>{
 const a=projectedError(bounds,.01,camera);
 assert.ok(a>0);assert.ok(projectedError(bounds,.01,{...camera,width:640,height:1280})>a);
 assert.ok(projectedError(bounds,.01,{...camera,target:{x:0,y:0,z:-3}})>a);
 assert.equal(projectedError(bounds,.01,{...camera,target:{x:0,y:0,z:-7}}),Infinity);
});
test('screen error hysteresis and explicit exact selection',()=>{
 const e={...bounds,exact:{file:'exact.glb'},levels:[{level:'overview',gpuBytes:80,error:.01},{level:'regional',gpuBytes:100,error:.004},{level:'exact-display',gpuBytes:120,error:0}]};
 assert.equal(chooseLevel(e,camera,null).level,'overview');
 assert.equal(chooseLevel(e,{...camera,zoom:2.5},'overview').level,'regional');
 assert.equal(chooseLevel(e,{...camera,zoom:5},'overview').level,'exact-display');
 assert.equal(chooseLevel(e,camera,null,true).level,'exact');
});
test('compact GPU representation preserves float32 positions and uses 16-byte stride',()=>{
 const p=packCompact(mesh);assert.equal(p.bytes,76);assert.equal(p.bytes,gpuBytes(4,6,2));
 const v=new DataView(p.vertices.buffer);assert.equal(v.getFloat32(16,true),1);assert.equal(v.getInt8(14),127);
});
test('budget includes staged replacement and refuses to evict its parent',()=>{
 const r=new Residency(100),d=[];const dispose=h=>d.push(h);
 const a=r.reserve('a','overview',40,0);r.commit(a,'old',40,0,dispose);
 assert.equal(r.reserve('a','exact',61,6000,new Set(),dispose),null);assert.equal(r.resident.get('a').handle,'old');
 const b=r.reserve('a','regional',60,6000,new Set(),dispose);assert.equal(r.bytes,100);
 assert.equal(r.resident.get('a').handle,'old');r.commit(b,'new',60,6001,dispose);
 assert.deepEqual(d,['old']);assert.equal(r.bytes,60);assert.equal(r.peak,100);
});
test('failed and stale uploads do not replace visible parent',()=>{
 const r=new Residency(100);const a=r.reserve('a','overview',40,0);r.commit(a,'old',40,0);
 const b=r.reserve('a','detail',60,1);assert.throws(()=>r.commit(b,'bad',59,1));r.cancel(b);
 assert.throws(()=>r.commit(b,'stale',60,2));assert.equal(r.resident.get('a').handle,'old');assert.equal(r.bytes,40);
});
test('coverage before upgrades, protected IDs and dwell before eviction',()=>{
 const r=new Residency(100);let a=r.reserve('a','overview',60,0);r.commit(a,'a',60,0);
 assert.equal(r.queue([{id:'a',level:'detail'},{id:'b',level:'overview'}],'a')[0].id,'b');
 assert.equal(r.reserve('b','overview',60,6000,new Set(['a'])),null);
 assert.equal(r.reserve('b','overview',60,4999),null);
 const evicted=[];assert.ok(r.reserve('b','overview',60,5000,new Set(),h=>evicted.push(h)));assert.deepEqual(evicted,['a']);
});
test('exact partition preserves every source face and shared seam coordinates',()=>{
 const clusters=partitionExact(mesh,1);assert.equal(clusters.length,2);assert.equal(clusters.reduce((n,c)=>n+c.indices.length/3,0),2);
 for(const c of clusters)for(let j=0;j<c.indices.length;j++)assert.deepEqual([...c.positions.slice(c.indices[j]*3,c.indices[j]*3+3)],[...mesh.positions.slice(mesh.indices[c.sourceFaces[0]*3+j]*3,mesh.indices[c.sourceFaces[0]*3+j]*3+3)]);
});
test('decoder rejects corrupt indices and preserves exact float32 data',()=>{
 const b=new ArrayBuffer(76),v=new DataView(b);v.setUint32(0,0x31444c42,true);v.setUint32(4,4,true);v.setUint32(8,6,true);v.setUint32(12,2,true);
 mesh.positions.forEach((x,i)=>v.setFloat32(16+i*4,x,true));mesh.indices.forEach((x,i)=>v.setUint16(64+i*2,x,true));
 const rec={decodedBytes:76,vertices:4,triangles:2,indexWidth:2};assert.deepEqual(decodeBLD(b,rec),mesh);v.setUint16(64,4,true);assert.throws(()=>decodeBLD(b,rec));
});
test('manifest requires full qualified inventory, rejects omissions',()=>{
 assert.throws(()=>validateManifest({schema:'body-live-unity-geometry-1',sourceManifestSha256:'a'.repeat(64),sourceRevision:'p',structures:[]},{schema:'body-live-unity-source-1',revision:'p',structures:[]}));
});
