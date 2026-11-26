/* BONE ACID 002 — procedural vehicle, visual-only. Local metres are atlas display units.
 * No physics dependency, no source anatomy mutation. Geometry stays in the existing deck envelope.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,damp=(r,dt)=>1-Math.exp(-r*dt);
const palettes=Object.freeze({
 'bone-acid':{shell:[.09,.055,.16],grip:[.035,.026,.045],metal:[.43,.39,.52],accent:[.80,1,.06],stripe:[.86,.10,.54],ink:[.80,1,.06]},
 'gato-loco':{shell:[.18,.045,.025],grip:[.06,.035,.025],metal:[.57,.51,.43],accent:[1,.35,.08],stripe:[.16,.85,.69],ink:[1,.85,.29]},
 'phantom':{shell:[.17,.19,.23],grip:[.045,.055,.065],metal:[.57,.65,.76],accent:[.53,.88,1],stripe:[.52,.40,.92],ink:[.85,.94,1]},
 'neon-doll':{shell:[.27,.05,.17],grip:[.08,.025,.08],metal:[.72,.50,.72],accent:[1,.30,.71],stripe:[.39,.87,1],ink:[1,.83,.95]}
});
const glyph={M:['101','111','111','101','101'],A:['010','101','111','101','101'],P:['110','101','110','100','100'],O:['111','101','101','101','111'],D:['110','101','101','101','110'],F:['111','100','110','100','100'],U:['101','101','101','101','111']};
function builder(){const p=[],ix=[];function ring(rings){const count=rings[0].length,base=p.length/3;for(const r of rings)for(const v of r)p.push(...v);for(let j=0;j<rings.length-1;j++)for(let k=0;k<count;k++){const a=base+j*count+k,b=base+j*count+(k+1)%count;ix.push(a,b,a+count,b,b+count,a+count);}for(let k=1;k<count-1;k++){ix.push(base,base+k+1,base+k);const a=base+(rings.length-1)*count;ix.push(a,a+k,a+k+1);}}function oval(x,y,z,rx,rz,half,steps=12){ring([y-half,y+half].map(h=>Array.from({length:steps},(_,i)=>{const a=2*Math.PI*i/steps;return [x+rx*Math.cos(a),h,z+rz*Math.sin(a)];})));}function box(x,y,z,a,b,c){ring([y-b,y+b].map(h=>[[x-a,h,z-c],[x+a,h,z-c],[x+a,h,z+c],[x-a,h,z+c]]));}
function deck(sign,grip=false){const profile=[[-.009,-.012],[-.011,-.007],[-.012,0],[-.011,.009],[-.007,.015],[.007,.015],[.011,.009],[.012,0],[.011,-.007],[.009,-.012]];ring((grip?[[.85,.0053],[.82,.0058]]:[[.86,.0008],[1,.0022],[.95,.0047],[.88,.0053]]).map(([scale,h])=>profile.map(([x,z])=>[x*scale,h+Math.max(0,Math.abs(z)-.008)*.34,sign*(.020+z*scale)])));}
return {ring,oval,box,deck,finish:()=>({positions:Float32Array.from(p),indices:Uint16Array.from(ix)})};}
function geometry(skin='bone-acid'){const c=palettes[skin]||palettes['bone-acid'],out=[];function part(id,color,make){const b=builder();make(b);out.push({id:'__marrow_'+id,color:color.slice(),...b.finish()});}
part('joint',c.metal,b=>{b.box(0,.002,0,.0035,.002,.011);b.oval(0,.003,0,.006,.005,.002,12);b.oval(0,.005,0,.0035,.0035,.001,12);});
for(const [side,sign,word] of [['front',1,'MAPO'],['rear',-1,'DOFU']]){
part(side+'_shell',c.shell,b=>b.deck(sign));
part(side+'_grip',c.grip,b=>b.deck(sign,true));
part(side+'_graphic',c.ink,b=>{for(let l=0;l<4;l++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(glyph[word[l]][y][x]==='1')b.box((l*4+x-7)*.00132,.00605,sign*(.020+(y-2)*.002),.00060,.00024,.00088);});
part(side+'_hardware',c.metal,b=>{for(const x of [-.007,.007])for(const z of [.009,.029])b.oval(x,.0056,sign*z,.0011,.0011,.00045,6);b.oval(0,-.001,sign*.022,.008,.008,.0028,12);b.box(0,-.004,sign*.013,.006,.0015,.003);});
part(side+'_stripe',c.stripe,b=>{for(const z of [.027,.031])b.box(0,.0071,sign*z,.007,.00045,.0008);});
part(side+'_pod',c.accent,b=>{b.oval(0,-.0054,sign*.022,.0065,.0065,.0016,12);b.oval(0,-.0068,sign*.022,.0035,.0035,.00065,10);});
}
return out;}
function motion(){let twist=0,deploy=0,compression=0,lastLanding=0,lastRemount=0,energy=0;function reset(){twist=deploy=compression=energy=0;lastLanding=lastRemount=0;}
function update(state,base,dt){dt=clamp(dt,0,.10);if((state.remounts||0)!==lastRemount){lastRemount=state.remounts||0;compression=0;lastLanding=state.landings||0;}if((state.landings||0)>lastLanding){lastLanding=state.landings;compression=clamp(.0006+(state.impact||0)*.003,.0006,.0016);}
compression*=Math.exp(-dt*14);twist=mix(twist,clamp((state.bank||0)*.85,-.14,.14),damp(12,dt));deploy=mix(deploy,state.glide?1-.72*(state.capture||0):0,damp(11,dt));energy=mix(energy,clamp(Math.hypot(...(state.v||[0,0,0]))/.31,0,1),damp(10,dt));
const pose=(b,a,offset=0)=>{const r=b.r.slice(),u=r.slice(3,6),x=r.slice(0,3),f=r.slice(6,9),right=x.map((v,k)=>v*Math.cos(a)-u[k]*Math.sin(a)),up=u.map((v,k)=>v*Math.cos(a)+x[k]*Math.sin(a));return {r:[...right,...up,...f],t:b.t.map((v,k)=>v+u[k]*offset)};};
const front=pose(base,twist, -compression),rear=pose(base,-twist,-compression);
return {...base,front,rear,frontPod:pose(front,0,-.0008*deploy+compression*.65),rearPod:pose(rear,0,-.0008*deploy+compression*.65),vehicle:{skin:'bone-acid',deploy,compression,twist,energy,grind:!!state.grind,capture:state.capture||0}};
}return {update,reset};}
function transform(id,board){if(id.includes('_front_pod'))return board.frontPod||board.front||board;if(id.includes('_rear_pod'))return board.rearPod||board.rear||board;if(id.includes('_front_'))return board.front||board;if(id.includes('_rear_'))return board.rear||board;return board;}
function intensity(id,board){const s=board.vehicle;if(!s)return 1;if(id.endsWith('_pod'))return .86+.36*s.energy+.22*s.deploy+.15*s.capture;if(id.endsWith('_hardware')&&s.grind)return 1.16;return 1;}
// Inspection is a pure camera presentation of the actual current vehicle.
function inspectionCamera(board,c,view={}){const yaw=view.yaw??.55,pitch=clamp(view.pitch??.60,-1.45,1.45),zoom=clamp(view.zoom??1,.65,2.2),r=board.r.slice(0,3),u=board.r.slice(3,6),f=board.r.slice(6,9),combine=(x,y,z)=>r.map((v,k)=>v*x+u[k]*y+f[k]*z),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),right=combine(cy,0,sy),vertical=combine(-sy*sp,cp,cy*sp),back=combine(sy*cp,sp,-cy*cp),D=.16/zoom,span=Math.max(.001,Math.min(c.width/3.25,c.height/c.frameSpan)),lens=Math.min(c.width,c.height)*.88;
return {...c,target:{x:board.t[0],y:board.t[1],z:board.t[2]},marrowBasis:[...right,...vertical,...back],marrowDistance:D,anchorX:.5,anchorY:.48,zoom:lens/(D*span)};}
root.BodyMarrowBoard=Object.freeze({geometry,motion,transform,intensity,palettes,inspectionCamera});
})(globalThis);
