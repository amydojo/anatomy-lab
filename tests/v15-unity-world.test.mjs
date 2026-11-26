import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../assets/atlas/unity-world.js';
const U=globalThis.BodyUnity;
const path=new URL('../assets/atlas/vhf/unity/v1/manifest.json',import.meta.url);
const m=()=>JSON.parse(readFileSync(path));
test('native display coordinate mapping reverses bounds safely',()=>{const b=U.coordinates.box({id:'x',min:[0,0,0],max:[10,20,30]});for(const [i,v] of [1.15,-5,-1.175].entries())assert.ok(Math.abs(b.min[i]-v)<1e-9);for(const [i,v] of [1.2,-4.85,-1.075].entries())assert.ok(Math.abs(b.max[i]-v)<1e-9);});
test('qualified registry retains all source identities and spatial bounds',()=>{const r=U.registry(m());assert.equal(r.index.size,143);assert.equal(r.index.query(r.bounds.min,r.bounds.max).length,143);assert.equal(r.landmarks.length,16);assert.equal(r.coordinateProvider.physicalUnits,null);for(const l of r.landmarks)assert.ok(r.index.get(l.id));assert.equal(r.entries.filter(s=>s.source_name.startsWith('FEMUR_')).length,2);assert.equal(r.entries.filter(s=>s.source_name.startsWith('HIP_')).length,2);});
test('rejects duplicate and incomplete inventories',()=>{const a=m();a.structures[0]=a.structures[1];assert.throws(()=>U.registry(a));const b=m();b.structures.pop();assert.throws(()=>U.registry(b));});
test('navigation targets source landmarks without changing camera',()=>{const r=U.registry(m()),p=r.landmarks[0].point,c={zoom:2,target:{x:p[0],y:p[1],z:p[2]},yaw:.2};const before=JSON.stringify(c);assert.equal(U.navigation.next(r.landmarks,c,0,1),1);assert.equal(JSON.stringify(c),before);assert.equal(U.navigation.location(r.landmarks,{...c,zoom:1},0),'UNITY WORLD');});
test('geometry provider retains existing paths without duplicate publication',()=>{const r=U.registry(m());for(const s of r.entries)assert.equal(U.geometry.url('/a/',s),'/a/'+(s.reused?'axis/v1/':'unity/v1/')+s.file);});

test('UNITY overview is fitted to the native full-world bounds with a yaw envelope',()=>{const r=U.registry(m()),span=U.fitFrameSpan(r.bounds);assert.ok(span>10&&span<13);const b=r.bounds,h=b.max.map((v,k)=>(v-b.min[k])/2);assert.ok((h[1]+.04)/(span/2)/(1-Math.hypot(h[0],h[2])/7.4)<1);});
