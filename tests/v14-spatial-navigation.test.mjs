import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root={};vm.runInNewContext(readFileSync('assets/atlas/v14-spatial-navigation.js','utf8'),{globalThis:root});
const make=()=>{let camera={yaw:.47,pitch:-.11,zoom:1.7,frameSpan:2.55,anchorX:.5,anchorY:.5,target:{x:0,y:1,z:0}};
 const nav=root.BodyV14SpatialNavigation.create({capture:()=>camera,apply:c=>{camera=c},limit:3});
 return {nav,camera:()=>camera,mutate:fn=>fn(camera)};};
test('V14.2: camera-only undo does not record duplicate or incomplete gesture frames',()=>{
 const t=make(),home=structuredClone(t.camera());
 t.nav.begin();for(let i=0;i<30;i++)t.mutate(c=>{c.yaw+=.01});t.nav.end();
 assert.equal(t.nav.state().depth,1);
 assert.equal(t.nav.back(),true);assert.deepEqual(JSON.parse(JSON.stringify(t.camera())),home);
 assert.equal(t.nav.back(),false);assert.equal(t.nav.state().depth,0);
});
test('V14.2: intentional transitions are reversible and bounded without recursive history',()=>{
 const t=make();
 for(let i=0;i<9;i++)t.nav.move({...t.camera(),zoom:t.camera().zoom+1});
 assert.equal(t.nav.state().depth,3);
 const z=t.camera().zoom;t.nav.back();assert.ok(t.camera().zoom<z);
 assert.equal(t.nav.state().depth,2);
});
test('V14.2: duplicate view, insignificant jitter and aborted gesture do not add history',()=>{
 const t=make(),home=structuredClone(t.camera());
 assert.equal(t.nav.move({...home,target:{...home.target}}),false);
 t.nav.begin();t.mutate(c=>{c.yaw+=.001});t.nav.end();
 assert.equal(t.nav.state().depth,0);
});
test('V14.2: snapshot deep copies target and preserves anchors',()=>{
 const t=make();t.nav.move({...t.camera(),target:{x:1,y:2,z:3},anchorX:.37,anchorY:.46});
 assert.equal(t.nav.back(),true);
 assert.equal(t.camera().anchorX,.5);assert.equal(t.camera().anchorY,.5);
 assert.deepEqual(JSON.parse(JSON.stringify(t.camera().target)),{x:0,y:1,z:0});
});
