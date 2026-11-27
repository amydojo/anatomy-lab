import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../../../../assets/atlas/marrow-board.js';
import '../../../../assets/atlas/marrow-ride.js';
import '../../../../assets/atlas/marrow-surface.js';
import '../../../../assets/atlas/marrow.js';
import {BASE,DURATION,scriptedState,createKinetic} from './kinetic-motion.mjs';
const B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow,S=globalThis.BodyMarrowSurface,dt=1/120,fps=12;
function sphere(r=.25){const p=[],ix=[],N=64,K=96;for(let j=0;j<=N;j++){const a=Math.PI*j/N;for(let k=0;k<=K;k++){const b=2*Math.PI*k/K;p.push(r*Math.sin(a)*Math.cos(b),r*Math.cos(a),r*Math.sin(a)*Math.sin(b));}}for(let j=0;j<N;j++)for(let k=0;k<K;k++){const a=j*(K+1)+k,b=a+K+1;ix.push(a,b,a+1,a+1,b,b+1);}return {id:'fixture',name:'synthetic triangle sphere',positions:Float32Array.from(p),indices:Uint32Array.from(ix),min:[-r,-r,-r],max:[r,r,r]};}
const k=createKinetic(B),original=B.motion(),frames=[],all=[];
for(let i=0;i<=DURATION*120;i++){const t=i*dt,s=scriptedState(t),p=k.update(s,BASE,dt),o=original.update(s,BASE,dt);for(const g of ['front','rear','frontPod','rearPod']){assert.deepEqual(p[g].r,o[g].r);assert.ok(p[g].t.every((v,j)=>Math.abs(v-o[g].t[j]-BASE.r[3+j]*p.vehicle.hoverOffset)<1e-12));}assert.ok(p.vehicle.hoverOffset>=0&&p.vehicle.hoverOffset<=.00035);assert.ok(Math.abs(p.vehicle.twist)<=.14&&p.vehicle.compression<=.0016&&p.vehicle.deploy<=1);all.push({t,state:s,pose:p});if(i%10===0)frames.push(all.at(-1));}
const world=M.collision([sphere()],null,true),hit=world.ray([0,.4,0],[0,-1,0],.4),sim=S.create(world,{...hit,forward:[0,0,-1]}),kin=createKinetic(B),contact=[],flight=[];
for(let i=0;i<1320;i++){sim.advance(dt,{stick:[0,-1],push:1,controlYaw:0});const s=sim.visual(),base=M.boardMatrix(s),p=kin.update(s,base,dt);assert.ok(s.ground&&!s.glide);const diff=p.t.map((v,j)=>v-base.t[j]);assert.ok(diff.every((v,j)=>Math.abs(v-base.r[3+j]*p.vehicle.hoverOffset)<1e-12));if(i%10===0)contact.push({t:i*dt,state:s,pose:p});}
const minY=Math.min(...contact.map(x=>x.state.n[1]));assert.ok(minY<-.8,'ceiling must be reached');
const ride=sim.report();for(let i=0;i<60;i++){sim.advance(dt,{stick:[0,-1],push:.3,assist:true});const s=sim.visual();flight.push({t:i*dt,state:s,pose:kin.update(s,M.boardMatrix(s),dt)});}
for(let i=0;i<1000&&!sim.s.ground;i++){sim.advance(dt,{stick:[0,-1],push:.3});const s=sim.visual();flight.push({t:(i+60)*dt,state:s,pose:kin.update(s,M.boardMatrix(s),dt)});}
assert.ok(sim.s.ground&&sim.s.landings===1);assert.ok(sim.s.touchdownSpeed>.02);
const report={schema:'vector-kinetic-v1',fps,frames,all,contact,flight:flight.filter((_,i)=>i%10===0||i===flight.length-1),qualification:{scriptedSamples:all.length,syntheticContactSamples:contact.length,minimumNormalY:minY,rideDistance:ride.rideDistance,explicitFlights:sim.s.explicitFlights,landings:sim.s.landings,touchdownSpeed:sim.s.touchdownSpeed,touchdownCarry:sim.s.touchdownCarry,fixture:'synthetic triangle sphere, not anatomy',note:'Scripted input-state motion study, plus independent actual solver fixture replay; no gameplay performance claim.'}};
fs.mkdirSync(process.argv[2]||'kinetic-output',{recursive:true});fs.writeFileSync((process.argv[2]||'kinetic-output')+'/kinetic-replay.json',JSON.stringify(report));console.log('KINETIC_REPLAY',JSON.stringify(report.qualification));
