import test from 'node:test';
import assert from 'node:assert/strict';
import {fidelityGeometry} from '../experiments/hairpin/fidelity-geometry.mjs';
import {silhouetteGeometry} from '../experiments/hairpin/silhouette-geometry.mjs';
import '../assets/atlas/marrow-board.js';
function validate(old,parts,B){
 const assert=(v,m)=>{if(!v)throw Error(m);},base={r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};
 let triangles=0,minArea=Infinity,low=0;const max=[0,0,0],staticMax=[0,0,0],oldMax=[0,0,0];
 const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 for(let k=0;k<parts.length;k++){
  const p=parts[k],o=old[k];assert(p.id===o.id&&p.texture===o.texture&&equal(p.indices,o.indices)&&equal(p.uv,o.uv)&&equal(p.color,o.color)&&equal(p.material,o.material),'asset contract '+p.id);
  triangles+=p.indices.length/3;
  for(let i=0;i<p.positions.length;i++){assert(Number.isFinite(p.positions[i]),'finite');staticMax[i%3]=Math.max(staticMax[i%3],Math.abs(p.positions[i]));oldMax[i%3]=Math.max(oldMax[i%3],Math.abs(o.positions[i]));}
  for(let i=0;i<p.indices.length;i+=3){const [a,b,c]=[0,1,2].map(j=>p.positions.slice(p.indices[i+j]*3,p.indices[i+j]*3+3)),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);minArea=Math.min(minArea,Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]));}
 }
 for(const bank of [-.4,0,.4])for(const glide of [false,true])for(const capture of [0,.85]){
  const m=B.motion(),state={bank,v:[.3,0,0],glide,capture,landings:0};let pose;
  for(let i=0;i<180;i++)pose=m.update(state,base,1/120);
  for(let i=0;i<120;i++){pose=m.update({...state,landings:1,impact:.33},base,1/120);
   for(const p of parts){const q=B.transform(p.id,pose);for(let j=0;j<p.positions.length;j+=3){for(let k=0;k<3;k++){const v=q.t[k]+q.r[k]*p.positions[j]+q.r[k+3]*p.positions[j+1]+q.r[k+6]*p.positions[j+2];max[k]=Math.max(max[k],Math.abs(v));if(k===1)low=Math.min(low,v);}}}
  }
 }
 assert(triangles===3484&&parts.length===20&&minArea>1e-11,'topology');
 assert(staticMax[0]<oldMax[0]*.85&&staticMax[1]<oldMax[1]*.85&&Math.abs(staticMax[2]-oldMax[2])<1e-7,'silhouette');
 assert(max[0]<=.0121&&max[1]<=.009&&max[2]<=.038&&low>-.011,'dynamic envelope');
 return {triangles,batches:parts.length,staticMax,oldMax,max,low,minArea};
}
test('HAIRPIN 003 silhouette, material identity and original animated envelope',()=>{assert.equal(silhouetteGeometry(),silhouetteGeometry());console.log('HAIRPIN_003',JSON.stringify(validate(fidelityGeometry(),silhouetteGeometry(),globalThis.BodyMarrowBoard)));});
