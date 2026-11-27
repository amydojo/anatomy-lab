/* HAIRPIN 003 — silhouette only; inherited FIDELITY UV/material contract. */
import {fidelityGeometry} from './fidelity-geometry.mjs';
function refine(parts){
 const mix=(a,b,t)=>a+(b-a)*t;
 // Longitudinal stations run from inner neck to outer nose. Piecewise-linear
 // width factors retain crisp planar facets rather than adding rounded vertices.
 const front=[[.006,.62],[.011,.69],[.016,.79],[.022,.79],[.027,.68],[.032,.52],[.036,.31]];
 const rear=[[.006,.64],[.011,.73],[.016,.83],[.022,.82],[.027,.75],[.032,.61],[.036,.43]];
 function width(z,stations){for(let i=1;i<stations.length;i++){const [a,u]=stations[i-1],[b,v]=stations[i];if(z<=b)return mix(u,v,Math.max(0,(z-a)/(b-a)));}return stations.at(-1)[1];}
 return parts.map(p=>{
  const pos=p.positions.slice(),id=p.id,frontSide=id.includes('_front_'),rearSide=id.includes('_rear_'),deck=frontSide||rearSide,s=frontSide?1:-1,pod=id.includes('_pod'),joint=!deck;
  for(let i=0;i<pos.length;i+=3){
   const x=pos[i],y=pos[i+1],z=pos[i+2],a=Math.abs(z);
   if(joint){
    // Keep axial connection points; reduce the visible bearing diameter.
    const blend=Math.min(1,Math.max(0,(a-.0055)/.0045));
    pos[i]=x*mix(.69,.76,blend);pos[i+2]=z*mix(.74,1,blend);pos[i+1]=y*.80;
   }else if(pod){
    // Circular rotors remain circular; move entire assembly into the shell.
    pos[i]=x*.74;pos[i+2]=s*.022+(z-s*.022)*.74;pos[i+1]=-.001+(y+.001)*.76;
   }else{
    pos[i]=x*width(a,frontSide?front:rear);
    // Maintain the deck length while thinning the perimeter and grip together.
    pos[i+1]=y>=0?y*.77:y*.82;
   }
  }
  // Preserve artwork's parameterization: all mapped points move with their UVs.
  // Keep identical part IDs, topology and material inputs. No decorative geometry.
  return {...p,positions:pos,indices:p.indices.slice(),uv:p.uv.slice(),color:p.color.slice(),material:p.material.slice()};
 });
}
let cached;
export const silhouetteGeometry=()=>cached??=refine(fidelityGeometry());
