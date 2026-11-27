/* Two small deterministic deck texture sets. UV is planar across the standing
 * surface, height converted to a tangent-space normal, roughness/AO packed.
 * Metalness remains component material data, emissive pod segments are geometry.
 */
const SIZE=512;
const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=SIZE;return c;};
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function path(ctx,pts,fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function rotor(ctx,x,y,r){ctx.save();ctx.translate(x,y);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);path(ctx,[[.12*r,0],[.82*r,-.22*r],[r,.12*r],[.44*r,.56*r]],'#d2ff18');}ctx.restore();}
const glyph={
 M:[[0,1],[0,0],[.24,0],[.50,.37],[.76,0],[1,0],[1,1],[.75,1],[.75,.41],[.50,.76],[.25,.41],[.25,1]],
 A:[[0,1],[.27,0],[.73,0],[1,1],[.73,1],[.63,.65],[.37,.65],[.27,1]],
 P:[[0,1],[0,0],[.82,0],[1,.18],[1,.55],[.82,.72],[.27,.72],[.27,1]],
 O:[[.16,0],[.84,0],[1,.16],[1,.84],[.84,1],[.16,1],[0,.84],[0,.16]],
 D:[[0,0],[.72,0],[1,.24],[1,.76],[.72,1],[0,1]],
 F:[[0,0],[1,0],[1,.24],[.27,.24],[.27,.43],[.81,.43],[.81,.67],[.27,.67],[.27,1],[0,1]],
 U:[[0,0],[.27,0],[.27,.76],[.73,.76],[.73,0],[1,0],[1,.84],[.83,1],[.17,1],[0,.84]]
};
const holes={A:[[.44,.40],[.56,.40],[.61,.53],[.39,.53]],P:[[.27,.24],[.72,.24],[.73,.48],[.27,.48]],O:[[.27,.24],[.73,.24],[.73,.76],[.27,.76]],D:[[.27,.24],[.61,.24],[.73,.35],[.73,.65],[.61,.76],[.27,.76]]};
function word(ctx,text){ctx.save();ctx.translate(256,254);ctx.rotate(-Math.PI/2);const h=112,w=68,step=78,total=step*4-10;ctx.translate(-total/2,-h/2);for(let i=0;i<text.length;i++){const g=text[i],tr=([x,y])=>[i*step+w*x+(1-y)*15,h*y];ctx.beginPath();for(const poly of [glyph[g],holes[g]].filter(Boolean)){poly.map(tr).forEach(([x,y],k)=>k?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.fillStyle='#e3cce9';ctx.fill('evenodd');}ctx.restore();}
export function bakeDeck(side){const base=canvas(),height=canvas(),b=base.getContext('2d'),h=height.getContext('2d',{willReadFrequently:true}),random=rng(side==='front'?344:911);b.fillStyle='#24182e';b.fillRect(0,0,SIZE,SIZE);h.fillStyle='#777';h.fillRect(0,0,SIZE,SIZE);
 // Molded swept channels run around the central flat branding zone.
 for(const sign of [-1,1])for(let k=0;k<13;k++){const x=256+sign*(45+k*10),y=68+k*7;for(const [ctx,col] of [[h,'#454545'],[b,'#1c1324']]){ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+sign*30,y+42,x+sign*12,y+79,x+sign*51,y+112);ctx.strokeStyle=col;ctx.lineWidth=4.8;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.moveTo(x,512-y);ctx.bezierCurveTo(x+sign*30,470-y,x+sign*12,433-y,x+sign*51,400-y);ctx.stroke();}}
 for(let i=0;i<340;i++){const x=45+random()*422,y=32+random()*448;if(Math.abs(x-256)<48&&y>95&&y<417)continue;const r=1.4+random()*2.5;h.beginPath();h.arc(x,y,r,0,Math.PI*2);h.fillStyle='#a5a5a5';h.fill();b.beginPath();b.arc(x,y,r,0,Math.PI*2);b.fillStyle='#2e2037';b.fill();}
 // Large filled wordmark and directional bolt, integrated into UV surface.
 word(b,side==='front'?'MAPO':'DOFU');rotor(b,side==='front'?160:352,side==='front'?350:150,31);
 path(b,[[340,370],[410,324],[381,370],[419,363],[335,428],[362,381]],'#d2ff18');
 const src=h.getImageData(0,0,SIZE,SIZE).data,surface=canvas(),s=surface.getContext('2d'),out=s.createImageData(SIZE,SIZE),sample=(x,y)=>src[(Math.max(0,Math.min(SIZE-1,y))*SIZE+Math.max(0,Math.min(SIZE-1,x)))*4]/255;
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const i=(y*SIZE+x)*4,dx=(sample(x+1,y)-sample(x-1,y))*1.6,dy=(sample(x,y+1)-sample(x,y-1))*1.6,n=Math.hypot(dx,dy,1);out.data[i]=Math.round(127.5*(1-dx/n));out.data[i+1]=Math.round(127.5*(1+dy/n));out.data[i+2]=Math.round(210+random()*14);out.data[i+3]=Math.round(190+65*sample(x,y));}s.putImageData(out,0,0);
 return {base,surface,size:SIZE,bytes:Math.ceil(2*SIZE*SIZE*4*4/3)};}
