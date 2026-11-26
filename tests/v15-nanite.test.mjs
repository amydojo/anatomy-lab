import test from 'node:test';
import assert from 'node:assert/strict';
import {gpuBytes,projectedError,chooseLevel,decodeBLD,packCompact,Residency,partitionExact,validateManifest,clusterBoundaryAudit} from '../assets/atlas/unity-geometry.mjs';
import {overviewPreflight,UnityGeometrySession,uploadGeometry} from '../assets/atlas/unity-residency.mjs';
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

test('reserved headroom enables atomic upgrade without losing coverage',()=>{
 const r=new Residency(100,20),gone=[],d=h=>gone.push(h);
 for(const [id,n] of [['a',10],['b',60]]){const t=r.reserve(id,'overview',n,0);assert.ok(t);r.commit(t,id,n,0,d);}
 const upgrade=r.reserve('a','detail',20,1,new Set(['a','b']),d);
 assert.ok(upgrade);assert.equal(r.diagnostics().stagedBytes,20);assert.equal(r.bytes,90);assert.equal(r.resident.get('a').handle,'a');
 r.commit(upgrade,'detail',20,2,d);assert.equal(r.bytes,80);assert.deepEqual(gone,['a']);assert.equal(r.resident.size,2);
 assert.equal(r.reserve('c','overview',1,3,new Set(['a','b']),d),null);
});
test('impossible upgrade does not evict unrelated meshes; cancellation recovers headroom',()=>{
 const r=new Residency(100,20),gone=[],d=h=>gone.push(h);
 for(const [id,n] of [['a',10],['b',30],['c',30]]){const t=r.reserve(id,'overview',n,0);r.commit(t,id,n,0,d);}
 assert.equal(r.reserve('a','detail',90,6000,new Set(['c']),d),null);assert.deepEqual(gone,[]);assert.equal(r.bytes,70);
 const t=r.reserve('a','detail',20,6000,new Set(['b','c']),d);assert.ok(t);r.cancel(t);assert.equal(r.bytes,70);
 assert.throws(()=>r.commit(t,'stale',20,6001,d));assert.equal(r.resident.get('a').handle,'a');
 const retry=r.reserve('a','detail',20,6001,new Set(['b','c']),d);assert.ok(retry);r.commit(retry,'new',20,6002,d);assert.equal(r.bytes,80);
});
test('eviction restores headroom and stale tokens cannot cancel new reservations',()=>{
 const r=new Residency(100,20),gone=[],d=h=>gone.push(h);
 for(const [id,n] of [['a',20],['b',50]]){const t=r.reserve(id,'overview',n,0);r.commit(t,id,n,0,d);}
 const t=r.reserve('a','detail',40,6000,new Set(),d);assert.ok(t);assert.deepEqual(gone,['b']);r.cancel(t);
 const next=r.reserve('a','detail',40,6001,new Set(),d);assert.ok(next);r.cancel(t);assert.equal(r.diagnostics().pendingCount,1);r.commit(next,'new',40,6002,d);assert.equal(r.bytes,40);
});
const hashA='a'.repeat(64),hashB='b'.repeat(64);
function fixture(){
 const source={schema:'body-live-unity-source-1',revision:'fixture',structures:Array.from({length:143},(_,i)=>({id:'bonehub-vhf-fixture_'+i,file:'bonehub-vhf-fixture_'+i+'.glb',sha256:hashA,bytes:100,vertices:4,triangles:2}))};
 const manifest={schema:'body-live-unity-geometry-1',sourceManifestSha256:hashB,sourceRevision:'fixture',structures:source.structures.map(s=>({id:s.id,sourceHash:s.sha256,exact:{...s},min:[0,0,0],max:[1,1,1],overviewLevel:'exact-display',levels:[{level:'exact-display',file:s.id+'.exact-display.bld.gz',sha256:hashA,decodedSha256:hashB,bytes:50,decodedBytes:76,vertices:4,triangles:2,indexWidth:2,gpuBytes:76,error:0,limit:0}]}))};
 return {source,manifest};
}
test('manifest requires external source hash and matches exact file identity',()=>{
 const {source,manifest}=fixture();assert.equal(validateManifest(manifest,source,hashB),manifest);
 assert.throws(()=>validateManifest(manifest,source,hashA));assert.throws(()=>validateManifest(manifest,source));
 manifest.structures[0].exact.sha256=hashB;assert.throws(()=>validateManifest(manifest,source,hashB));
 manifest.structures[0].exact.sha256=hashA;manifest.structures[0].overviewLevel='overview';assert.throws(()=>validateManifest(manifest,source,hashB));
});

test('cluster seam vertices are locked by exact source index',()=>{
 const clusters=partitionExact(mesh,1),audit=clusterBoundaryAudit(mesh,clusters);
 assert.equal(audit.seamEdges,1);assert.equal(audit.sourceBoundaryEdges,4);assert.equal(audit.nonmanifoldEdges,0);
 assert.deepEqual(audit.clusters.map(c=>c.lockedSourceVertices),[[0,1,2],[0,2,3]]);
 assert.equal(audit.mixedResolutionValidated,false);
});
test('coverage preflight refuses incomplete whole-world residency by default',()=>{
 const {source,manifest}=fixture(),budget=10000,headroom=1000;
 const p=overviewPreflight(manifest,budget,headroom);
 assert.equal(p.overviewGpuBytes,143*76);assert.equal(p.coverageFits,false);
 const args={gl:{},manifest,source,sourceHash:hashB,prepare:()=>{},budget,headroom};
 assert.throws(()=>new UnityGeometrySession(args));
 const diagnostic=new UnityGeometrySession({...args,allowPartialDiagnostic:true});
 assert.equal(diagnostic.diagnostics().preflight.coverageFits,false);diagnostic.dispose();
});
function fakeGL(){
 let serial=0;const sizes=new Map(),bindings=new Map(),deleted=[];
 return {ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,BUFFER_SIZE:4,UNSIGNED_SHORT:5,UNSIGNED_INT:6,NO_ERROR:0,deleted,sizes,
 createBuffer(){return ++serial;},deleteBuffer(h){deleted.push(h);sizes.delete(h);},
 bindBuffer(t,h){bindings.set(t,h);},bufferData(t,n){sizes.set(bindings.get(t),n);},
 getBufferParameter(t){return sizes.get(bindings.get(t));},bufferSubData(t,o,data){assert.ok(o+data.byteLength<=sizes.get(bindings.get(t)));},
 getError(){return 0;},isContextLost(){return false;}};
}
test('chunked upload validates real allocation API and cancellation deletes staged handles',async()=>{
 const gl=fakeGL(),packed=packCompact(mesh);let yields=0;
 const h=await uploadGeometry(gl,packed,{chunkBytes:16,yieldFrame:async()=>{yields++;}});
 assert.equal(h.bytes,76);assert.equal(gl.sizes.size,2);assert.ok(yields>0);
 const abort=new AbortController(),other=fakeGL();
 await assert.rejects(uploadGeometry(other,packed,{chunkBytes:16,signal:abort.signal,yieldFrame:async()=>abort.abort()}));
 assert.equal(other.sizes.size,0);assert.equal(other.deleted.length,2);
});
