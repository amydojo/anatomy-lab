import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {decodeNmo,decodeNmq,nmoPreflight} from '../assets/atlas/unity-nmo-codec.mjs';
const req=createRequire(import.meta.url),E=req('./vendor/meshoptimizer-0.22/meshopt_encoder.cjs'),D=req('./vendor/meshoptimizer-0.22/meshopt_decoder.cjs');await Promise.all([E.ready,D.ready]);const sha=async b=>createHash('sha256').update(b).digest('hex');
const p=new Float32Array([0,0,0,1,0,0,0,1,0]),i=new Uint16Array([0,1,2]);
const v=E.encodeVertexBuffer(new Uint8Array(p.buffer),3,12),idx=E.encodeIndexSequence(new Uint8Array(i.buffer),3,2),h=Buffer.alloc(24);h.write('NMO1');[3,3,2,v.length,idx.length].forEach((x,k)=>h.writeUInt32LE(x,4+k*4));const bytes=Buffer.concat([h,v,idx]),rec={meshoptBytes:bytes.length,encodedSha256:await sha(bytes),vertexSha256:await sha(new Uint8Array(p.buffer)),indexSha256:await sha(new Uint8Array(i.buffer)),vertices:3,triangles:1,indexWidth:2,decodedBytes:42};
test('actual pinned meshoptimizer round-trip preserves vertex and index bytes',async()=>{const x=await decodeNmo(bytes,rec,D,sha);assert.deepEqual(x.positions,p);assert.deepEqual(x.indices,i);});
test('NMO decoder refuses altered encoded and decoded hashes',async()=>{const changed=Buffer.from(bytes);changed[changed.length-1]^=1;await assert.rejects(decodeNmo(changed,rec,D,sha));await assert.rejects(decodeNmo(bytes,{...rec,indexSha256:'0'.repeat(64)},D,sha));});
test('preflight counts both required manifests and decoder transfer separately',()=>{const m={structures:[{bytes:4900000,gpuBytes:1000}]};const p=nmoPreflight(m,{sourceManifestBytes:60000,derivativeManifestBytes:40000,decoderTransferBytes:1});assert.equal(p.transferBytes,5000001);assert.equal(p.payloadFits,false);assert.equal(p.steadyFits,true);});

test('NMQ1 reconstructs quantized positions with exact feature override',async()=>{
 const q=new Uint16Array([0,0,0,0,65535,0,0,0,0,65535,0,0]),exact=new Float32Array([0.1234567,0,0]),mask=new Uint8Array([1]);
 const qv=E.encodeVertexBuffer(new Uint8Array(q.buffer),3,8),ov=E.encodeVertexBuffer(new Uint8Array(exact.buffer),1,12),h=Buffer.alloc(80);h.write('NMQ1');[3,3,2,qv.length,idx.length,1,ov.length].forEach((x,k)=>h.writeUInt32LE(x,4+k*4));[0,0,0,1/65535,1/65535,0].forEach((x,k)=>h.writeDoubleLE(x,32+k*8));
 const b=Buffer.concat([h,qv,idx,mask,ov]),positions=new Float32Array([exact[0],0,0,1,0,0,0,1,0]);const record={...rec,meshoptBytes:b.length,encodedSha256:await sha(b),vertexSha256:await sha(new Uint8Array(positions.buffer)),quantization:{exactOverrides:1}};
 const actual=await decodeNmq(b,record,D,sha);assert.deepEqual(actual.positions,positions);assert.deepEqual(actual.indices,i);
 await assert.rejects(decodeNmq(b,{...record,quantization:{exactOverrides:0}},D,sha));
});
