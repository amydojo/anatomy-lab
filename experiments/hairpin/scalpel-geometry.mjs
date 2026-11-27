/* SCALPEL 004 — three independently authored longitudinal section studies.
 * Dimensions in millimetres below, converted to atlas display units.
 * Existing front/rear transforms remain the sole articulation interface.
 * No geometry from earlier HAIRPIN editions is reused.
 */
export const STUDIES=Object.freeze({
 lancet:{label:'A / LANCET',description:'Asymmetric surgical blade; long swept nose and offset cutting-edge-inspired rail.',front:[[5.8,-4.2,4.2,2.0,-1.5],[10,-6,5.8,2.8,-2],[17,-8.7,7.0,3.7,-2.7],[24,-8.2,7.4,3.2,-2.7],[30,-5.4,5.5,2.3,-1.8],[35,-2.2,3,1.1,-.7],[37,.5,1.4,.4,-.25]],rear:[[-35,-3.9,4.7,.7,-.6],[-31,-7.9,8.8,2,-1.6],[-25,-9.6,9.4,3,-2.8],[-17,-8.5,8,3.5,-2.7],[-10,-5.8,5.8,2.6,-2],[-5.8,-4.2,4.2,2,-1.5]],pods:[21,-23],radius:5.2},
 mantis:{label:'B / MANTIS',description:'Swept micro-starfighter; angular shoulders, clipped rear wings and arrowhead nose.',front:[[5.8,-4.8,4.8,2.2,-1.5],[11,-7.0,7,3.0,-2],[15,-10.9,10.9,3.8,-2.7],[19,-8.4,8.4,3.6,-2.8],[26,-6.8,6.8,2.8,-2.1],[32,-3.2,3.2,1.6,-1],[37,-.65,.65,.5,-.3]],rear:[[-35,-7.4,7.4,1.4,-.8],[-30,-10.6,10.6,2.3,-1.9],[-24,-8.5,8.5,3.2,-2.8],[-18,-7,7,3.4,-2.7],[-11,-6,6,2.6,-1.8],[-5.8,-4.8,4.8,2.2,-1.5]],pods:[20,-24],radius:5.5},
 stiletto:{label:'C / STILETTO',description:'Slender couture chassis; restrained continuous line and recessed magnetic cores.',front:[[5.8,-4.0,4,1.8,-1.2],[11,-5.5,5.5,2.5,-1.7],[18,-7.1,7.1,3.1,-2.3],[24,-6.7,6.7,2.8,-2.3],[30,-4.8,4.8,1.9,-1.4],[36,-1.5,1.5,.6,-.4]],rear:[[-35,-3.2,3.2,.65,-.4],[-29,-6.8,6.8,2,-1.7],[-22,-7.6,7.6,2.9,-2.4],[-16,-7,7,3,-2.3],[-10,-5.1,5.1,2.3,-1.7],[-5.8,-4,4,1.8,-1.2]],pods:[20,-23],radius:4.7}
});
const C={shell:[.66,.43,.81],grip:[.115,.075,.145],metal:[.67,.65,.70],dark:[.085,.065,.11],pink:[.95,.04,.40],energy:[.80,.99,.035]};
const M={shell:[.25,.9,.64,0,1],grip:[.83,.20,0,0,2],metal:[.23,.88,.92,0,3],dark:[.47,.5,.45,0,0],pink:[.27,.8,.12,.015,0],energy:[.19,.9,.08,.32,4]};
function build(name){const d=STUDIES[name];if(!d)throw Error('Unknown study '+name);const parts=[];
 function part(id,key,fn,texture=null){const pos=[],idx=[];function face(v){const start=pos.length/3;for(const p of v)pos.push(...p.map(n=>n*.001));for(let j=1;j<v.length-1;j++)idx.push(start,start+j,start+j+1);}
 function loft(rows,cap=true){let n=rows[0].length;for(let i=1;i<rows.length;i++)for(let j=0;j<n;j++)face([rows[i-1][j],rows[i-1][(j+1)%n],rows[i][(j+1)%n],rows[i][j]]);if(cap){face(rows[0].slice().reverse());face(rows.at(-1));}}
 function section(rows){loft(rows.map(([z,l,r,t,b])=>{const w=r-l,c=Math.min(w*.19,.95),ch=Math.min((t-b)*.24,.65);return [[l+c,b,z],[r-c,b,z],[r,b+ch,z],[r,t-ch,z],[r-c,t,z],[l+c,t,z],[l,t-ch,z],[l,b+ch,z]];}));}
 function ring(z,levels,n=20,cap=false){loft(levels.map(([r,y])=>Array.from({length:n},(_,k)=>{const a=-2*Math.PI*k/n;return [r*Math.cos(a),y,z+r*Math.sin(a)];})),cap);}
 function beam(a,b,w,h,y){const dx=b[0]-a[0],dz=b[1]-a[1],q=Math.hypot(dx,dz),x=-dz*w/2/q,z=dx*w/2/q;loft([y-h/2,y+h/2].map(v=>[[a[0]+x,v,a[1]+z],[b[0]+x,v,b[1]+z],[b[0]-x,v,b[1]-z],[a[0]-x,v,a[1]-z]]));}
 function wedge(z,r0,r1,a,b,y0,y1){loft([y0,y1].map(y=>[[r0*Math.cos(a),y,z+r0*Math.sin(a)],[r1*Math.cos(a),y,z+r1*Math.sin(a)],[r1*Math.cos(b),y,z+r1*Math.sin(b)],[r0*Math.cos(b),y,z+r0*Math.sin(b)]]));}
 fn({face,loft,section,ring,beam,wedge});const positions=Float32Array.from(pos),uv=new Float32Array(pos.length/3*2);for(let i=0;i<pos.length/3;i++){uv[2*i]=positions[3*i]/.024+.5;uv[2*i+1]=id.startsWith('rear')?(positions[3*i+2]+.036)/.032:(positions[3*i+2]-.004)/.032;}parts.push({id:'__marrow_'+id,color:C[key].slice(),material:M[key].slice(),positions,indices:Uint16Array.from(idx),uv,texture});}
 // A low, elongated central coupling. Its two end tongues are deliberate
 // bearing overlaps; moving chassis sections never cross the central gap.
 const neck=name==='mantis'?4.6:name==='lancet'?4.0:3.8;
 part('joint','metal',b=>{b.section([[-8,-neck*.72,neck*.72,.25,-1.1],[-5.5,-neck,neck,1.25,-1.7],[-2,-neck*.89,neck*.89,1.75,-1.8],[2,-neck*.89,neck*.89,1.75,-1.8],[5.5,-neck,neck,1.25,-1.7],[8,-neck*.72,neck*.72,.25,-1.1]]);});
 part('joint_inset','dark',b=>b.section([[-4.9,-2.7,2.7,1.6,.5],[-2.6,-3.2,3.2,2.3,.6],[2.6,-3.2,3.2,2.3,.6],[4.9,-2.7,2.7,1.6,.5]]));
 part('joint_energy','energy',b=>{for(const x of [-2.8,2.8])b.beam([x,-2.3],[x,2.3],.46,.24,2.35);});
 for(const [side,rows,pod] of [['front',d.front,d.pods[0]],['rear',d.rear,d.pods[1]]]){
 const s=side==='front'?1:-1;
 part(side+'_shell','shell',b=>b.section(rows));
 // The standing zone is a thin longitudinal inlay; no closed raised border.
 // It follows the primary chassis top profile, not a separate oval platform.
 const inset=rows.filter(r=>Math.abs(r[0])>=10&&Math.abs(r[0])<=32).map(([z,l,r,t])=>{const c=(l+r)/2,w=(r-l)*.34;return [z,c-w,c+w,t+.18,t+.035];});
 part(side+'_grip','grip',b=>b.section(inset),side);
 // Split structural rails define the underside, rather than a solid wheel block.
 part(side+'_hardware','metal',b=>{const a=Math.abs(pod);for(const x of [-1,1]){b.beam([x*3.5,s*(a-6)],[x*4.4,s*(a+4)],1.25,1.0,-2.3);b.beam([x*4.4,s*(a+4)],[x*2,s*(a+7)],1.1,1.0,-2.1);}b.beam([-4.3,s*(a-5)],[4.3,s*(a-5)],1.35,.9,-2.7);});
 // Interrupted accents are longitudinal and follow a single panel.
 part(side+'_stripe','pink',b=>{const row=rows.find(r=>Math.abs(r[0])>=16&&Math.abs(r[0])<=25);const [z,l,r,t]=row;const x=r*.76;b.beam([x,z-s*1.7],[x*.92,z+s*1.7],.60,.20,t+.10);});
 const R=d.radius;
 part(side+'_pod_housing','metal',b=>b.ring(pod,[[R*.77,-5.9],[R,-5.25],[R+0.35,-3.8],[R*.9,-2.15],[R*.7,-1.8],[R*.68,-5.9],[R*.77,-5.9]],20));
 part(side+'_pod_recess','dark',b=>{b.ring(pod,[[R*.28,-6.05],[R*.73,-6.05],[R*.77,-4.9],[R*.28,-4.9],[R*.28,-6.05]],20);b.ring(pod,[[R*.22,-6.2],[R*.22,-4.8]],12,true);});
 part(side+'_pod','energy',b=>{for(let k=0;k<14;k++){const a=k*Math.PI/7;b.wedge(pod,R*.32,R*.72,a+.05,a+.37,-6.12,-5.55);}});
 }
 return parts;
}
const cache=new Map();export function scalpelGeometry(name){if(!cache.has(name))cache.set(name,build(name));return cache.get(name);}
