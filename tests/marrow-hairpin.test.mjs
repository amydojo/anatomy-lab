import test from 'node:test';import assert from 'node:assert/strict';import {geometry} from '../experiments/hairpin/hairpin-geometry.mjs';
function validate(parts){
 const assert=(v,m)=>{if(!v)throw Error(m);};const ids=new Set(),bounds=[0,0,0];let triangles=0,vertices=0,minArea=Infinity;
 assert(parts.length===21,'part count');
 for(const p of parts){assert(!ids.has(p.id),'duplicate id');ids.add(p.id);assert(p.positions.length%3===0&&p.indices.length%3===0,'shape');assert(p.material.length===5&&p.material.every(Number.isFinite),'material');vertices+=p.positions.length/3;triangles+=p.indices.length/3;
 for(let i=0;i<p.positions.length;i++){const v=p.positions[i];assert(Number.isFinite(v),'nonfinite');bounds[i%3]=Math.max(bounds[i%3],Math.abs(v));}
 for(let i=0;i<p.indices.length;i+=3){const [a,b,c]=[p.indices[i],p.indices[i+1],p.indices[i+2]].map(k=>{assert(k<p.positions.length/3,'index');return p.positions.slice(k*3,k*3+3);});const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);minArea=Math.min(minArea,area);assert(area>1e-11,'degenerate '+p.id);}
 }
 assert(bounds[0]<=.0121&&bounds[1]<=.009&&bounds[2]<=.038,'envelope');assert(triangles<3500,'triangle budget: '+triangles);for(const s of ['front','rear'])for(const k of ['shell','grip','graphic','hardware','stripe','signature','pod_housing','pod_recess','pod'])assert(ids.has('__marrow_'+s+'_'+k),'missing component');
 return {parts:parts.length,triangles,vertices,maxAbs:bounds,minDoubleTriangleArea:minArea};
}
test('HAIRPIN static geometry budget, envelope, indices and materials',()=>{const p=geometry();assert.equal(geometry(),p);console.log('HAIRPIN_GEOMETRY',JSON.stringify(validate(p)));});
test('HAIRPIN distinct decks and material response',()=>{const p=geometry();assert.notDeepEqual(p.find(x=>x.id==='__marrow_front_shell').positions,p.find(x=>x.id==='__marrow_rear_shell').positions);assert.ok(p.find(x=>x.id==='__marrow_front_pod').material[3]>0);assert.ok(p.find(x=>x.id==='__marrow_joint').material[2]>.8);});
