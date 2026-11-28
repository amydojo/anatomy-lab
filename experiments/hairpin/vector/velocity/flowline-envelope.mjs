/* ENVELOPE candidate hints only. Rate intervals are outer bounds, not certified reachable sets. Every candidate requires the unchanged private worker certificate. */
export function axisInterval(x,v,a,rate,lo,hi,dt,steps){
 const clamp=(n,l,h)=>Math.max(l,Math.min(h,n));let low=x,high=x,vl=v,vh=v;
 for(let j=0;j<steps;j++){vl=clamp(vl-a*dt,-rate,rate);vh=clamp(vh+a*dt,-rate,rate);low=clamp(low+vl*dt,lo,hi);high=clamp(high+vh*dt,lo,hi);}
 return [low,high];
}
export function suspensionNeighbors(s,nominal,F,dt,steps,turn){
 const bounds=[axisInterval(s.lift,s.vl,1.5,F.maxLiftRate,0,F.maxLift,dt,steps),axisInterval(s.pitch,s.wp,30,F.maxAngularRate,-F.maxAngle,F.maxAngle,dt,steps),axisInterval(s.roll,s.wr,30,F.maxAngularRate,-F.maxAngle,F.maxAngle,dt,steps)];
 const names=['lift','pitch','roll'], out=[];
 for(let j=0;j<3;j++){const k=(j+turn)%3,sign=(turn+j)%2,z={...nominal,[names[k]]:bounds[k][sign]};if(Math.hypot(z.pitch,z.roll)>F.maxAngle+1e-12)continue;if(Math.abs(z[names[k]]-nominal[names[k]])<1e-8)continue;out.push({kind:'envelope-'+names[k],suspension:z});}
 return out;
}
export function commandAt(i,index,schedule){
 const cycle=i%360,phase=cycle%180,sign=index?-.8:1;
 if(schedule==='established')return {stick:[(phase<45?.48:phase<90?-.52:phase<130?.32:-.25)*sign,cycle<180?-1:1],push:phase<65?.24:phase<105?.13:phase<130?0:phase<150?.22:0,brake:phase>=150?.8:0,controlYaw:0};
 if(schedule!=='challenge')throw Error('unknown schedule');
 const p=i%240,carve=Math.floor(p/12)%2?-.85:.85;
 return {stick:[(p<72?carve:p<132?.12:p<168?-.2:0)*sign,p<48?-1:p<72?1:p<132?-1:p<168?.4:-1],push:p<72?.22:p<104?0:p<132?.07:p<168?0:p<196?.18:0,brake:p>=132&&p<168||p>=196?1:0,controlYaw:0};
}
