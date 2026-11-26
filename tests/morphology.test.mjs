import test from 'node:test';import assert from 'node:assert/strict';import {validatePart,TISSUES} from '../assets/atlas/morphology/provider.mjs';
test('compact SOMATIC part shape and immutable source',()=>{const p=validatePart('x','bone','bone',new Float32Array([0,0,0,1,0,0,0,1,0]),new Uint32Array([0,1,2]),{license:'test'});assert.equal(p.category,'Bone');assert.equal(p.indices.BYTES_PER_ELEMENT,2);assert.deepEqual(p.max,[1,1,0]);assert.equal(p.source.license,'test');});
test('reject malformed geometry and unsupported tissue',()=>{const p=new Float32Array([0,0,0,1,0,0,0,1,0]);assert.throws(()=>validatePart('x','x','bone',p,new Uint32Array([0,1,9]),{}));assert.throws(()=>validatePart('x','x','invented',p,new Uint32Array([0,1,2]),{}));p[0]=NaN;assert.throws(()=>validatePart('x','x','bone',p,new Uint32Array([0,1,2]),{}));assert.equal(Object.keys(TISSUES).length,11);});

import fs from 'node:fs';import {createHash} from 'node:crypto';
test('published acquired catalog: hashes, coordinates, indices and corrected tissue taxonomy',()=>{
 const root=new URL('../assets/atlas/morphology/acquired/',import.meta.url),cat=JSON.parse(fs.readFileSync(new URL('catalog.json',root))),hash=b=>createHash('sha256').update(b).digest('hex');
 const seen=new Set();let total=0,triangles=0,bytes=0;
 for(const [key,pack] of Object.entries(cat.packs)){
  const data=fs.readFileSync(new URL(key+'.bin',root));assert.equal(hash(data),pack.sha256);assert.equal(data.length,pack.bytes);bytes+=data.length;
  for(const p of pack.parts){assert.ok(!seen.has(p.id));seen.add(p.id);assert.ok(TISSUES[p.tissue]);assert.equal(p.indexCount%3,0);const pos=data.subarray(p.positions,p.positions+p.vertexCount*12),ix=data.subarray(p.indices,p.indices+p.indexCount*4);assert.equal(pos.length,p.vertexCount*12);assert.equal(ix.length,p.indexCount*4);assert.equal(hash(Buffer.concat([pos,ix])),p.geometrySha256);const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<pos.length;i+=4){const value=pos.readFloatLE(i),k=(i/4)%3;assert.ok(Number.isFinite(value));lo[k]=Math.min(lo[k],value);hi[k]=Math.max(hi[k],value);}assert.deepEqual(lo,p.bounds[0]);assert.deepEqual(hi,p.bounds[1]);for(let i=0;i<ix.length;i+=4)assert.ok(ix.readUInt32LE(i)<p.vertexCount);if(/subscapularis|levator scapulae/i.test(p.name))assert.equal(p.tissue,'muscle');if(/intervertebral dis[ck]|tentorium cerebelli|retinaculum/i.test(p.name))assert.equal(p.tissue,'connective');assert.ok(!/extensor digitorum longus|flexor digitorum (longus|brevis)/i.test(p.name));if(key.includes('arms-hands'))assert.ok(lo[1]>=.60);if(key.includes('head-neck'))assert.ok(lo[1]>=1.10);if(key.includes('thorax-shoulder'))assert.ok(lo[1]>=.85);total++;triangles+=p.indexCount/3;
  }
 }
 assert.equal(total,545);assert.equal(triangles,702506);assert.equal(bytes,15156804);console.log(JSON.stringify({total,triangles,bytes,packs:Object.keys(cat.packs).length}));
});
