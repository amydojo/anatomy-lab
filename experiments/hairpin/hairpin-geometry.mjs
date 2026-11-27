/* HAIRPIN 001 — isolated, visual-only geometry candidate. */
function buildHairpin(polished=false){
 const colors={lilac:[.58,.37,.76],rubber:[.065,.045,.095],metal:[.66,.66,.73],dark:[.095,.075,.135],acid:[.78,1,.025],pink:[.89,.035,.32],ink:[.88,.77,.98]};
 const materials={lilac:[.27,.85,.48,0,1],rubber:[.83,.20,0,0,2],metal:[.23,.88,.94,0,3],dark:[.48,.48,.32,0,0],acid:[.18,.90,.08,.30,4],pink:[.31,.68,.12,.02,0],ink:[.48,.42,.03,0,0]};
 if(polished){colors.lilac=[.63,.49,.78];colors.metal=[.73,.74,.79];colors.dark=[.075,.062,.103];materials.lilac=[.29,.85,.62,0,1];materials.metal=[.21,.92,.96,0,3];materials.acid=[.22,.88,.06,.20,4];}
 const parts=[];
 function part(id,key,fn){
  const p=[],ix=[];
  function loft(rings,cap=true){
   const n=rings[0].length,o=p.length/3;
   for(const ring of rings)for(const v of ring)p.push(...v);
   for(let j=0;j<rings.length-1;j++)for(let k=0;k<n;k++){const a=o+j*n+k,b=o+j*n+(k+1)%n;ix.push(a,b,b+n,a,b+n,a+n);}
   if(cap)for(let k=1;k<n-1;k++){ix.push(o,o+k+1,o+k);const a=o+(rings.length-1)*n;ix.push(a,a+k,a+k+1);}
  }
  function profile(poly,levels,cx=0,cz=0,s=1){loft(levels.map(([sx,sz,y])=>{const r=poly.map(([x,z])=>[cx+x*sx,y,cz+s*z*sz]);return s===1?r:r.reverse();}));}
  function disc(x,z,sections,n=16,cap=true){loft(sections.map(([r,y])=>Array.from({length:n},(_,i)=>{const a=-2*Math.PI*i/n;return [x+r*Math.cos(a),y,z+r*Math.sin(a)];})),cap);}
  function box(x,y,z,a,b,c){profile([[-a,-c],[-a,c],[a,c],[a,-c]],[[1,1,y-b],[1,1,y+b]],x,z);}
  function quad(points,y,s=1){let q=points.map(([x,z])=>[x,y,z*s]);let a=0;for(let i=0;i<q.length;i++){const u=q[i],v=q[(i+1)%q.length];a+=u[0]*v[2]-v[0]*u[2];}if(a>0)q.reverse();const o=p.length/3;for(const v of q)p.push(...v);for(let i=1;i<q.length-1;i++)ix.push(o,o+i,o+i+1);}
  function stroke(x,z,X,Z,w,y,s=1){const d=Math.hypot(X-x,Z-z),a=-(Z-z)*w/2/d,b=(X-x)*w/2/d;quad([[x+a,z+b],[X+a,Z+b],[X-a,Z-b],[x-a,z-b]],y,s);}
  function rotor(x,z,r,y,s=1){for(let i=0;i<4;i++){const a=i*Math.PI/2;quad([[.1,0],[.85,-.22],[1,.10],[.40,.55]].map(([u,v])=>[x+r*(u*Math.cos(a)-v*Math.sin(a)),z+r*(u*Math.sin(a)+v*Math.cos(a))]),y,s);}}
  fn({profile,disc,box,quad,stroke,rotor});
  parts.push({id:'__marrow_'+id,color:colors[key].slice(),material:materials[key].slice(),positions:Float32Array.from(p.map((v,i)=>polished&&i%3===0?v*.985:v)),indices:Uint16Array.from(ix)});
 }
 const front=[[-.0045,-.013],[-.0085,-.009],[-.0115,-.003],[-.0114,.006],[-.008,.012],[-.0035,.016],[.0035,.016],[.008,.012],[.0114,.006],[.0115,-.003],[.0085,-.009],[.0045,-.013]];
 const rear=[[-.0045,-.013],[-.009,-.009],[-.012,-.002],[-.012,.006],[-.009,.013],[-.004,.015],[.004,.015],[.009,.013],[.012,.006],[.012,-.002],[.009,-.009],[.0045,-.013]];
 part('joint','metal',b=>{b.box(0,.0002,0,.0031,.0015,.0108);b.disc(0,0,[[.0044,-.0025],[.0059,-.001],[.0059,.0025],[.0049,.0038]],20);for(const z of [-.008,.008])b.box(0,.0018,z,.0044,.0016,.0012);});
 part('joint_inset','dark',b=>b.disc(0,0,[[.0038,.00381],[.0033,.0045]],20));
 part('joint_emblem','acid',b=>b.rotor(0,0,.0029,.00457));
 function softened(poly){return polished?poly.flatMap((v,k)=>{const a=poly[(k+poly.length-1)%poly.length],b=poly[(k+1)%poly.length];return [a.map((x,i)=>v[i]+(x-v[i])*.17),b.map((x,i)=>v[i]+(x-v[i])*.17)];}):poly;}
 const glyph={M:[[0,0,0,1],[0,1,.5,.46],[.5,.46,1,1],[1,1,1,0]],A:[[0,0,.5,1],[.5,1,1,0],[.22,.43,.78,.43]],P:[[0,0,0,1],[0,1,.88,1],[.88,1,1,.58],[1,.58,0,.58]],O:[[0,0,0,1],[0,1,1,1],[1,1,1,0],[1,0,0,0]],D:[[0,0,0,1],[0,1,.73,1],[.73,1,1,.73],[1,.73,1,.27],[1,.27,.73,0],[.73,0,0,0]],F:[[0,0,0,1],[0,1,1,1],[0,.55,.76,.55]],U:[[0,1,0,.15],[0,.15,.17,0],[.17,0,.83,0],[.83,0,1,.15],[1,.15,1,1]]};
 for(const [side,s,word,outline] of [['front',1,'MAPO',front],['rear',-1,'DOFU',rear]]){
  part(side+'_shell','lilac',b=>b.profile(softened(outline),[[.82,.84,.00045],[.95,.96,.00115],[1,1,.00205],[.99,1,.00305],[.91,.94,.0046],[.86,.90,.00505],[.80,.84,.00435]],0,s*.020,s));
  part(side+'_grip','rubber',b=>b.profile(softened(outline),[[.78,.82,.00437],[.78,.82,.0047],[.75,.79,.00495]],0,s*.020,s));
  part(side+'_graphic','ink',b=>{for(let i=0;i<word.length;i++)for(const [x,z,X,Z] of glyph[word[i]]){const tr=(u,v)=>[(polished?s:1)*((i-1.5)*.0037+(u-.5)*.00285+(v-.5)*.0007),.020+(v-.5)*.0038];const [a,c]=tr(x,z),[d,e]=tr(X,Z);b.stroke(a,c,d,e,polished?.00057:.00049,.00504,s);}for(let i=0;i<3;i++)b.stroke(-.0025+i*.0015,.0128,-.0017+i*.0015,.0128,.00028,.00504,s);});
  part(side+'_hardware','metal',b=>{for(const x of [-.0066,.0066])for(const z of [.014,.027])b.disc(x,s*z,[[.00076,.00486],[.00063,.00529]],6);for(const x of [-.006,.006]){b.box(x,-.0014,s*.017,.00115,.0013,.0055);b.box(x,-.0031,s*.013,.0018,.00065,.0027);}b.box(0,-.0036,s*.0115,.0049,.0008,.0019);});
  part(side+'_stripe','pink',b=>{for(const x of [-1,1])b.quad([[x*.0091,.020],[x*.0094,.0248],[x*.0087,.0264],[x*.0085,.021]],.00472,s);b.quad([[-.0035,.029],[.001,.029],[.002,.0301],[-.0027,.0301]],.00504,s);});
  part(side+'_signature','acid',b=>{b.rotor(0,.027,.0021,.00505,s);b.quad([[-.004,.0148],[.0036,.0148],[.0047,.01565],[-.003,.01565]],.00505,s);});
  part(side+'_pod_housing','metal',b=>{b.disc(0,s*.022,[[.0066,-.0069],[.008,-.0053],[.008,-.0025],[.0067,-.0012],[.0056,-.0012],[.0056,-.0069],[.0066,-.0069]],20,false);for(let i=0;i<4;i++){const a=i*Math.PI/2;b.box(Math.cos(a)*.0071,-.0028,s*.022+Math.sin(a)*.0071,.00075,.0009,.00075);}});
  part(side+'_pod_recess','dark',b=>{b.disc(0,s*.022,[[.0044,-.00672],[.0065,-.00672],[.0065,-.0051],[.0044,-.0051],[.0044,-.00672]],20,false);b.disc(0,s*.022,[[.0022,-.0071],[.0022,-.0055]],12);});
  part(side+'_pod','acid',b=>{b.disc(0,s*.022,[[.0025,-.0070],[.0044,-.0070],[.0050,-.0064],[.0047,-.0059],[.0025,-.0059],[.0025,-.0070]],20,false);for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*.00565,z=s*.022+Math.sin(a)*.00565;b.box(x,-.00675,z,.00030,.00016,.00030);}b.disc(0,s*.022,[[.0013,-.00716],[.00155,-.0068]],12);});
 }
 return parts;
}
let cached;
export function geometry(){return cached??=buildHairpin();}
let polishedCache;
export function polishedGeometry(){return polishedCache??=buildHairpin(true);}
export const edition='hairpin-001';
