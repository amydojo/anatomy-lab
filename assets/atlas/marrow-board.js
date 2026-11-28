/* BONE ACID 002 — procedural vehicle, visual-only. Local metres are atlas display units.
 * No physics dependency, no source anatomy mutation. Geometry stays in the existing deck envelope.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,damp=(r,dt)=>1-Math.exp(-r*dt);
const palettes=Object.freeze({
 'bone-acid':{shell:[.36,.28,.48],grip:[.062,.045,.083],metal:[.53,.56,.64],accent:[.69,.94,.045],stripe:[.77,.075,.40],ink:[.75,.65,.88]},
 'gato-loco':{shell:[.38,.12,.045],grip:[.065,.035,.025],metal:[.57,.51,.43],accent:[1,.48,.08],stripe:[.16,.85,.69],ink:[1,.85,.29]},
 'phantom':{shell:[.27,.32,.40],grip:[.045,.055,.065],metal:[.57,.65,.76],accent:[.53,.88,1],stripe:[.52,.40,.92],ink:[.85,.94,1]},
 'neon-doll':{shell:[.48,.12,.31],grip:[.08,.025,.08],metal:[.72,.50,.72],accent:[1,.30,.71],stripe:[.39,.87,1],ink:[1,.83,.95]}
});
// roughness, specular, metallic, emission, detail mode. Linearized in shader.
const materials=Object.freeze({composite:[.34,.72,.18,0,1],rubber:[.86,.22,0,0,2],alloy:[.28,.82,.92,0,3],lens:[.20,.90,.08,.22,4],marking:[.53,.38,.03,0,0],accent:[.40,.50,.08,.04,0]});
const glyph={M:['101','111','111','101','101'],A:['010','101','111','101','101'],P:['110','101','110','100','100'],O:['111','101','101','101','111'],D:['110','101','101','101','110'],F:['111','100','110','100','100'],U:['101','101','101','101','111']};
const cache=new Map();
function builder(){const p=[],ix=[];function ring(rings,cap=true){const count=rings[0].length,base=p.length/3;for(const r of rings)for(const v of r)p.push(...v);for(let j=0;j<rings.length-1;j++)for(let k=0;k<count;k++){const a=base+j*count+k,b=base+j*count+(k+1)%count;ix.push(a,b,a+count,b,b+count,a+count);}if(cap)for(let k=1;k<count-1;k++){ix.push(base,base+k+1,base+k);const a=base+(rings.length-1)*count;ix.push(a,a+k,a+k+1);}}
function oval(x,y,z,rx,rz,half,steps=16){ring([y-half,y+half].map(h=>Array.from({length:steps},(_,i)=>{const a=-2*Math.PI*i/steps;return [x+rx*Math.cos(a),h,z+rz*Math.sin(a)];})));}
// Ordered concentric ring sections with beveled edges, no cap overlapping a ring bore.
function collar(x,z,sections,steps=16){ring(sections.map(([radius,h])=>Array.from({length:steps},(_,i)=>{const a=-2*Math.PI*i/steps;return [x+radius*Math.cos(a),h,z+radius*Math.sin(a)];})),false);}
function box(x,y,z,a,b,c){ring([y-b,y+b].map(h=>[[x-a,h,z-c],[x-a,h,z+c],[x+a,h,z+c],[x+a,h,z-c]]));}
function tile(x,y,z,a,c){const k=p.length/3;p.push(x-a,y,z-c,x+a,y,z-c,x+a,y,z+c,x-a,y,z+c);ix.push(k,k+2,k+1,k,k+3,k+2);}
const profile=[[-.006,-.013],[-.009,-.011],[-.011,-.007],[-.0118,0],[-.0108,.008],[-.008,.013],[-.004,.016],[.004,.016],[.008,.013],[.0108,.008],[.0118,0],[.011,-.007],[.009,-.011],[.006,-.013]];
function deck(sign,kind){const layers=kind==='grip'?[[.79,.00445],[.79,.00475],[.75,.0050]]:[[.81,.00065],[.94,.00125],[1,.00235],[1,.00335],[.93,.00465],[.86,.00525],[.80,.00435],[.77,.00435]];let rings=layers.map(([scale,h])=>profile.map(([x,z])=>[x*scale,h+(kind==='grip'?0:Math.max(0,z*scale-.008)*.17),sign*(.020+z*scale)]));if(sign<0)rings=rings.map(r=>r.slice().reverse());ring(rings);}
return {ring,oval,collar,box,tile,deck,finish:()=>({positions:Float32Array.from(p),indices:Uint16Array.from(ix)})};}
function geometry(skin='bone-acid'){if(cache.has(skin))return cache.get(skin);const c=palettes[skin]||palettes['bone-acid'],out=[];function part(id,color,material,make){const b=builder();make(b);out.push({id:'__marrow_'+id,color:color.slice(),material:materials[material].slice(),...b.finish()});}
part('joint',c.metal,'alloy',b=>{b.box(0,.001,0,.0034,.0018,.012);b.collar(0,0,[[.0048,-.001],[.006,.0002],[.006,.0036],[.0048,.0047],[.0038,.0047],[.0038,-.001],[.0048,-.001]]);b.oval(0,.0044,0,.0035,.0035,.0008,12);for(const z of [-.008,.008])b.box(0,.003,z,.0042,.0007,.0015);});
for(const [side,sign,word] of [['front',1,'MAPO'],['rear',-1,'DOFU']]){
part(side+'_shell',c.shell,'composite',b=>b.deck(sign,'shell'));
part(side+'_grip',c.grip,'rubber',b=>b.deck(sign,'grip'));
part(side+'_graphic',c.ink,'marking',b=>{for(let l=0;l<4;l++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(glyph[word[l]][y][x]==='1')b.tile((l*4+x-7)*.00094,.00512,sign*(.020+(y-2)*.0012),.00043,.00053);for(const x of [-.003,-.0015,0,.0015,.003])b.tile(x,.00514,sign*.0145,.00032,.00038);b.tile(-.0045,.00514,sign*.0255,.00045,.00045);b.tile(-.0036,.00514,sign*.0264,.00045,.00045);});
part(side+'_hardware',c.metal,'alloy',b=>{for(const x of [-.007,.007])for(const z of [.012,.027])b.oval(x,.0052,sign*z,.00085,.00085,.00030,6);b.collar(0,sign*.022,[[.005,-.0033],[.008,-.0024],[.008,.0002],[.0065,.001],[.005,.001],[.005,-.0033]]);for(const x of [-.005,.005])b.box(x,-.0023,sign*.016,.0013,.0016,.004);b.box(0,-.004,sign*.012,.0058,.001,.0024);b.box(0,-.0048,sign*.012,.0048,.00035,.0016);});
part(side+'_stripe',c.stripe,'accent',b=>{for(const x of [-.0088,.0088])b.tile(x,.0054,sign*.021,.00032,.0034);b.tile(0,.00525,sign*.027,.003,.00055);});
part(side+'_pod',c.accent,'lens',b=>{b.collar(0,sign*.022,[[.004,-.0064],[.0059,-.0064],[.0068,-.0055],[.0068,-.0041],[.0058,-.0035],[.004,-.0035],[.004,-.0064]],20);b.oval(0,-.00615,sign*.022,.0038,.0038,.00055,20); // integrated top readiness light is on the same pod articulation
b.tile(0,.0060,sign*.024,.0023,.00042);});
}
cache.set(skin,out);return out;}
function motion(){let twist=0,deploy=0,compression=0,lastLanding=0,lastRemount=0,energy=0,grind=0,capture=0;function reset(){twist=deploy=compression=energy=grind=capture=0;lastLanding=lastRemount=0;}
function update(state,base,dt){dt=clamp(dt,0,.10);if((state.remounts||0)!==lastRemount){lastRemount=state.remounts||0;compression=0;lastLanding=state.landings||0;}if((state.landings||0)>lastLanding){lastLanding=state.landings;compression=clamp(.0006+(state.impact||0)*.003,.0006,.0016);}
compression*=Math.exp(-dt*14);twist=mix(twist,clamp((state.bank||0)*.85,-.14,.14),damp(12,dt));deploy=mix(deploy,state.glide?1-.72*(state.capture||0):0,damp(11,dt));energy=mix(energy,clamp(Math.hypot(...(state.v||[0,0,0]))/.31,0,1),damp(10,dt));grind=mix(grind,state.grind?1:0,damp(22,dt));capture=mix(capture,clamp(state.capture||0,0,1),damp(14,dt));
const pose=(b,a,offset=0)=>{const r=b.r.slice(),u=r.slice(3,6),x=r.slice(0,3),f=r.slice(6,9),right=x.map((v,k)=>v*Math.cos(a)-u[k]*Math.sin(a)),up=u.map((v,k)=>v*Math.cos(a)+x[k]*Math.sin(a));return {r:[...right,...up,...f],t:b.t.map((v,k)=>v+u[k]*offset)};};
const front=pose(base,twist, -compression),rear=pose(base,-twist,-compression);
return {...base,front,rear,frontPod:pose(front,-twist*.65,-.0006*deploy+compression*.65),rearPod:pose(rear,twist*.65,-.0006*deploy+compression*.65),vehicle:{skin:'bone-acid',deploy,compression,twist,energy,grind:!!state.grind,grindLevel:grind,capture}};
}return {update,reset,checkpoint:()=>({twist,deploy,compression,lastLanding,lastRemount,energy,grind,capture}),restore:q=>{({twist,deploy,compression,lastLanding,lastRemount,energy,grind,capture}=q);}};}
function transform(id,board){if(id.includes('_front_pod'))return board.frontPod||board.front||board;if(id.includes('_rear_pod'))return board.rearPod||board.rear||board;if(id.includes('_front_'))return board.front||board;if(id.includes('_rear_'))return board.rear||board;return board;}
function intensity(id,board){const s=board.vehicle;if(!s)return 1;if(id.endsWith('_pod'))return .84+.34*s.energy+.22*s.deploy+.25*s.capture;if(id.endsWith('_hardware'))return 1+.08*(s.grindLevel||0);return 1;}
// Inspection is a pure camera presentation of the actual current vehicle.
function inspectionCamera(board,c,view={}){const yaw=view.yaw??.55,pitch=clamp(view.pitch??.60,-1.45,1.45),zoom=clamp(view.zoom??1,.65,2.2),r=board.r.slice(0,3),u=board.r.slice(3,6),f=board.r.slice(6,9),combine=(x,y,z)=>r.map((v,k)=>v*x+u[k]*y+f[k]*z),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),right=combine(-cy,0,-sy),vertical=combine(-sy*sp,cp,cy*sp),back=combine(sy*cp,sp,-cy*cp),D=.16/zoom,span=Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan)),lens=Math.min(c.width,c.height)*.88;
return {...c,target:{x:board.t[0],y:board.t[1],z:board.t[2]},marrowBasis:[...right,...vertical,...back],marrowDistance:D,anchorX:.5,anchorY:.48,zoom:lens/(D*span)};}
root.BodyMarrowBoard=Object.freeze({geometry,motion,transform,intensity,palettes,materials,inspectionCamera});
})(globalThis);
