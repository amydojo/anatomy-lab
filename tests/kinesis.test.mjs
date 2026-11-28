import test from 'node:test';import assert from 'node:assert/strict';
import {triangleBox,createConfigurationOracle,commonCorrection} from '../experiments/hairpin/vector/velocity/kinesis-oracle.mjs';
const B={transform:(id,pose)=>pose[id]||pose};
const I=[1,0,0,0,1,0,0,0,1],pose=(t=[0,0,0],a=0)=>({t,r:[Math.cos(a),Math.sin(a),0,-Math.sin(a),Math.cos(a),0,0,0,1]});
function cube(id,c,h,subdiv=1){
 const positions=[],indices=[];const faces=[[0,-1,2,1],[0,1,1,2],[1,-1,0,2],[1,1,2,0],[2,-1,1,0],[2,1,0,1]];
 for(const [k,s,u,v] of faces)for(let a=0;a<subdiv;a++)for(let b=0;b<subdiv;b++){
  const base=positions.length/3;for(const [du,dv] of [[0,0],[1,0],[1,1],[0,1]]){const p=c.slice();p[k]+=s*h[k];p[u]+=h[u]*(-1+2*(a+du)/subdiv);p[v]+=h[v]*(-1+2*(b+dv)/subdiv);positions.push(...p);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 return {id,positions:Float64Array.from(positions),indices:Uint32Array.from(indices)};
}
test('KINESIS triangle SAT rejects separated and retains touching triangles',()=>{
 assert.equal(triangleBox([[0,0,0],[2,0,0],[0,2,0]],[1,1,1]),true);
 assert.equal(triangleBox([[2,2,0],[2,3,0],[3,2,0]],[1,1,1]),false);
 assert.equal(triangleBox([[1,0,0],[1,2,0],[1,0,2]],[1,1,1]),true);
});
test('KINESIS pose oracle rejects both containment directions and open source topology',()=>{
 const anatomy=cube('source',[0,0,0],[1,1,1]),vehicle=cube('joint',[0,0,0],[.1,.1,.1]),o=createConfigurationOracle(anatomy,[vehicle],B);
 assert.equal(o.topology.closed,true);assert.equal(o.vehicleTopology[0].closed,true);
 assert.equal(o.pose(pose([2,0,0])).clear,true);assert.equal(o.pose(pose()).clear,false);assert.equal(o.pose(pose([1,0,0])).clear,false);
 const reverse=createConfigurationOracle(cube('inner',[0,0,0],[.02,.02,.02]),[cube('joint',[0,0,0],[1,1,1],4)],B);
 assert.equal(reverse.pose(pose()).clear,false);
 const open={...anatomy,indices:anatomy.indices.slice(0,-3)};assert.equal(createConfigurationOracle(open,[vehicle],B).pose(pose([2,0,0])).reason,'source-topology-unqualified');
});
test('KINESIS translation and rotation sweeps reject clear endpoints with unresolved intermediate geometry',()=>{
 const o=createConfigurationOracle(cube('source',[0,0,0],[.1,.1,.1]),[cube('joint',[0,0,0],[.1,.1,.1])],B);
 const a=pose([-1,0,0]),b=pose([1,0,0]);assert.equal(o.pose(a).clear,true);assert.equal(o.pose(b).clear,true);assert.equal(o.sweep(a,b).clear,false);
 assert.equal(o.sweep(pose([-1,0,0]),pose([-1,.1,0])).clear,true);
 const rot=createConfigurationOracle(cube('source',[.65,.65,0],[.08,.08,.08]),[cube('joint',[0,0,0],[1,.04,.04])],B);
 assert.equal(rot.pose(pose()).clear,true);assert.equal(rot.pose(pose([0,0,0],Math.PI/2)).clear,true);assert.equal(rot.sweep(pose(),pose([0,0,0],Math.PI/2)).clear,false);
});
test('KINESIS common correction preserves qualified relative rigid transforms',()=>{
 const a={...pose(),front:pose([.1,0,0],.07),rear:pose([-.1,0,0],-.07),frontPod:pose([.1,-.02,0],.03),rearPod:pose([-.1,-.02,0],-.03)},b=commonCorrection(a,.08,-.06,.004),keys=['front','rear','frontPod','rearPod'];
 const dist=(p,q)=>Math.hypot(...p.t.map((v,k)=>v-q.t[k])),dot=(x,y)=>x.reduce((s,v,k)=>s+v*y[k],0);
 for(const x of keys)for(const y of keys){assert.ok(Math.abs(dist(a[x],a[y])-dist(b[x],b[y]))<1e-12);for(let i=0;i<9;i+=3)for(let j=0;j<9;j+=3)assert.ok(Math.abs(dot(a[x].r.slice(i,i+3),a[y].r.slice(j,j+3))-dot(b[x].r.slice(i,i+3),b[y].r.slice(j,j+3)))<1e-12);}
});
