import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/atlas/v14-spatial-navigation.js',import.meta.url),'utf8');
const sandbox={window:{}};
runInNewContext(source,sandbox);
const nav=sandbox.window.BodyV14SpatialNavigation;
const bounds={center:{x:1,y:2,z:0},radius:.25,min:[.75,1.9,-.1],max:[1.25,2.1,.1]};
const camera={yaw:0,pitch:0,zoom:1.4,frameSpan:2.55,width:390,height:844,anchorX:.5,anchorY:.5,target:{x:0,y:0,z:0}};
const project=(p,c)=>({x:c.width/2+(p.x-c.target.x)*50*c.zoom,y:c.height/2-(p.y-c.target.y)*50*c.zoom});
test('V14.3 projects the sourced 3D bounds rather than only using radius',()=>{
 const rect=nav.projectedBounds(bounds,camera,project);
 assert.ok(rect.width>30 && rect.height>0);
 assert.equal(rect.x,camera.width/2+camera.zoom*50);
 assert.equal(rect.minX,camera.width/2+.75*camera.zoom*50);
});
test('V14.3 first Dive preserves contextual framing and never imposes 2.5x',()=>{
 const first=nav.diveFrame({camera,bounds,step:0,project});
 assert.ok(first.zoom>camera.zoom);
 assert.ok(first.zoom<=camera.zoom*1.85+1e-6);
 assert.ok(first.zoom<2.5,'first Dive must not force an arbitrary 2.5x minimum');
 assert.equal(first.yaw,camera.yaw);
 assert.equal(first.pitch,camera.pitch);
 assert.ok(first.target.x>camera.target.x && first.target.x<bounds.center.x,'first Dive keeps joint context');
 const next=nav.diveFrame({camera:{...camera,...first,width:390,height:844},bounds,step:1,project});
 assert.ok(next.zoom>first.zoom);
 assert.ok(next.zoom<=first.zoom*1.72+1e-6);
 assert.equal(next.target.x,bounds.center.x);
});
test('V14.3 Dive stays bounded by 14x and remains deterministic',()=>{
 const deep={...camera,zoom:13.9};
 const first=nav.diveFrame({camera:deep,bounds,step:1,project});
 assert.equal(first.zoom,14);
 assert.equal(first.target.y,bounds.center.y);
});
test('V14.3 offscreen detector provides hysteresis',()=>{
 const off={x:25,y:420},near={x:195,y:420},edge={x:52,y:420};
 assert.equal(nav.needsRecovery(off,390,844,false),true);
 assert.equal(nav.needsRecovery(near,390,844,true),false);
 assert.equal(nav.needsRecovery(edge,390,844,false),false);
 assert.equal(nav.needsRecovery(edge,390,844,true),true);
});
