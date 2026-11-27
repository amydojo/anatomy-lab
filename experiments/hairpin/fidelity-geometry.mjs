/* HAIRPIN / FIDELITY — reference-driven, isolated procedural candidate.
 * Atlas display units; positive Z nose, negative Z tail. No physics changes.
 * Shells use actual stepped open perimeter geometry; visual texture maps are
 * generated separately. 640:198:72 concept proportions guide silhouette,
 * constrained by existing animated envelope.
 */
const C={armor:[.66,.43,.81],edge:[.43,.24,.57],rubber:[.115,.075,.145],metal:[.67,.65,.70],dark:[.085,.065,.11],pink:[.95,.04,.40],energy:[.80,.99,.035],ink:[.86,.73,.90]};
const M={armor:[.25,.9,.64,0,1],edge:[.35,.75,.5,0,1],rubber:[.83,.20,0,0,2],metal:[.23,.88,.92,0,3],dark:[.47,.5,.45,0,0],pink:[.27,.8,.12,.015,0],energy:[.19,.9,.08,.32,4],ink:[.46,.4,.02,0,0]};
const front=[[-.0056,-.0134],[-.0098,-.0096],[-.0109,-.004],[-.0109,.007],[-.0078,.013],[-.0032,.016],[.0032,.016],[.0078,.013],[.0109,.007],[.0109,-.004],[.0098,-.0096],[.0056,-.0134]];
const rear=[[-.0057,-.0134],[-.0097,-.010],[-.0111,-.004],[-.0111,.006],[-.0085,.012],[-.0038,.0155],[.0038,.0155],[.0085,.012],[.0111,.006],[.0111,-.004],[.0097,-.010],[.0057,-.0134]];
function build(){const parts=[];function part(id,key,fn,texture=false){const p=[],ix=[];function face(v){const o=p.length/3;v.forEach(a=>p.push(...a));for(let j=1;j<v.length-1;j++)ix.push(o,o+j,o+j+1);}
 function loft(rings,cap=true){const n=rings[0].length;for(let i=0;i<rings.length-1;i++)for(let k=0;k<n;k++)face([rings[i][k],rings[i][(k+1)%n],rings[i+1][(k+1)%n],rings[i+1][k]]);if(cap){face(rings[0].slice().reverse());face(rings.at(-1));}}
 function profile(poly,levels,z=0,s=1,cap=true){loft(levels.map(([xscale,zscale,y])=>{let a=poly.map(([x,w])=>[x*xscale,y,z+s*w*zscale]);return s===1?a:a.reverse();}),cap);}
 function ring(x,z,levels,n=20,cap=false){loft(levels.map(([r,y])=>Array.from({length:n},(_,k)=>[x+r*Math.cos(-k*2*Math.PI/n),y,z+r*Math.sin(-k*2*Math.PI/n)])),cap);}
 function beam(a,b,width,depth,y){const d=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])*width/2/d,nz=(b[0]-a[0])*width/2/d;loft([y-depth/2,y+depth/2].map(h=>[[a[0]+nx,h,a[1]+nz],[b[0]+nx,h,b[1]+nz],[b[0]-nx,h,b[1]-nz],[a[0]-nx,h,a[1]-nz]]));}
 function wedge(x,z,r0,r1,a,b,y0,y1){loft([y0,y1].map(y=>[[x+r0*Math.cos(a),y,z+r0*Math.sin(a)],[x+r1*Math.cos(a),y,z+r1*Math.sin(a)],[x+r1*Math.cos(b),y,z+r1*Math.sin(b)],[x+r0*Math.cos(b),y,z+r0*Math.sin(b)]]));}
 fn({face,loft,profile,ring,beam,wedge});const positions=Float32Array.from(p),uv=new Float32Array(p.length/3*2);for(let k=0;k<p.length/3;k++){uv[k*2]=p[k*3]/.024+.5;uv[k*2+1]=id.startsWith('rear_')?(p[k*3+2]+.036)/.032:(p[k*3+2]-.004)/.032;}parts.push({id:'__marrow_'+id,color:C[key],material:M[key],positions,indices:Uint16Array.from(ix),uv,texture:texture?id.split('_')[0]:null});}
 part('joint','metal',b=>{for(const s of [-1,1]){b.beam([-.0045,s*.004],[ -.0036,s*.011],.0024,.0024,.0007);b.beam([.0045,s*.004],[.0036,s*.011],.0024,.0024,.0007);b.beam([-.004,s*.008],[.004,s*.008],.002,.002,.0004);}b.ring(0,0,[[.0055,-.0028],[.0047,-.0019],[.0047,-.0008],[.0061,.0003],[.0055,.0032],[.0037,.004],[.0037,-.0028],[.0055,-.0028]],20);});
 part('joint_inset','dark',b=>{b.ring(0,0,[[.0041,.0039],[.0035,.0049]],20,true);b.ring(0,0,[[.0041,-.004],[.0048,-.003],[.0054,-.002],[.0054,-.001]],20);});
 part('joint_energy','energy',b=>{for(let k=0;k<12;k++){const a=k*Math.PI/6;b.wedge(0,0,.0048,.0056,a+.055,a+.41,-.0019,-.0008);}});part('joint_emblem','ink',b=>{for(let k=0;k<4;k++){const a=k*Math.PI/2,pts=[[.12,0],[.73,-.25],[1,.05],[.43,.56]].map(([x,z])=>[.0028*(x*Math.cos(a)-z*Math.sin(a)),.00495,.0028*(x*Math.sin(a)+z*Math.cos(a))]);b.face(pts);}});
 for(const [side,s,poly] of [['front',1,front],['rear',-1,rear]]){
 const z=s*.020;
 // Two separate armor layers, actual dark channel between them.
 part(side+'_shell','armor',b=>{b.profile(poly,[[.80,.84,-.0010],[.97,.98,-.0003],[1,1,.0012],[.98,1,.0020]],z,s);b.profile(poly,[[.96,.98,.0024],[1,1,.00325],[.97,.98,.00415],[.86,.90,.0053],[.79,.84,.00465]],z,s,false);});
 part(side+'_channel','dark',b=>b.profile(poly,[[.91,.95,.00175],[.92,.95,.0028]],z,s));
 part(side+'_grip','rubber',b=>b.profile(poly,[[.79,.84,.0042],[.79,.84,.00456],[.76,.81,.00485]],z,s),true);
 part(side+'_hardware','metal',b=>{for(const x of [-.0068,.0068])for(const t of [.011,.029]){b.ring(x,s*t,[[.00105,.0046],[.00088,.0054],[.00045,.00555]],8,true);}for(const x of [-1,1]){b.beam([x*.0082,s*.011],[x*.009,s*.027],.00175,.0021,-.00175);b.beam([x*.0082,s*.011],[x*.0025,s*.017],.0017,.0019,-.002);b.beam([x*.009,s*.027],[x*.003,s*.031],.00165,.0018,-.002);b.beam([x*.007,s*.024],[x*.002,s*.019],.0013,.0014,-.002);}b.beam([-.007,s*.012],[.007,s*.012],.003,.0018,-.0032);});
 part(side+'_stripe','pink',b=>{for(const x of [-1,1]){b.beam([x*.0098,s*.016],[x*.0097,s*.025],.00075,.00055,.0021);b.beam([x*.0076,s*.029],[x*.0045,s*.033],.0012,.0005,.0047);}});
 part(side+'_pod_housing','metal',b=>{b.ring(0,s*.022,[[.0057,-.0067],[.0073,-.0061],[.0081,-.0048],[.0081,-.003],[.0069,-.0016],[.0058,-.0016],[.0058,-.0067],[.0057,-.0067]],20);for(let k=0;k<4;k++){const a=k*Math.PI/2;b.beam([.0058*Math.cos(a),s*.022+.0058*Math.sin(a)],[.0089*Math.cos(a),s*.022+.0089*Math.sin(a)],.002,.0016,-.0021);}});
 part(side+'_pod_recess','dark',b=>{b.ring(0,s*.022,[[.0023,-.007],[.0059,-.007],[.0061,-.0052],[.0023,-.0052],[.0023,-.007]],20);b.ring(0,s*.022,[[.0019,-.0072],[.0019,-.0054]],16,true);});
 part(side+'_pod','energy',b=>{for(let k=0;k<14;k++){const a=k*Math.PI/7;b.wedge(0,s*.022,.0026,.00575,a+.035,a+.405,-.0071,-.0063);}b.ring(0,s*.022,[[.0013,-.0072],[.0013,-.0067]],12,true);});
 }
 return parts;
}
let cached;export const fidelityGeometry=()=>cached??=build();
