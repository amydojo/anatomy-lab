// In the browser main thread retain already mounted globals. A worker or Node
// initializes its own independent module scope.
if(!globalThis.BodyMarrowRide)await import('../../../../assets/atlas/marrow-ride.js');
if(!globalThis.BodyMarrowSurface)await import('../../../../assets/atlas/marrow-surface.js');
if(!globalThis.BodyMarrowBoard)await import('../../../../assets/atlas/marrow-board.js');
if(!globalThis.BodyMarrow)await import('../../../../assets/atlas/marrow.js');
if(!globalThis.BodyVHF)await import('../../../../assets/atlas/vhf-source.js');
export const SHA='e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66',SOURCE='9e7ce356a6d9a84b722eb0255b1748137e8e7c7b183c58adc712cb8a2e5412b0',MANIFEST='2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7';
export const identity=Object.freeze({sourceSHA:SOURCE,vehicleSHA:SHA,coordinateFrame:'VHF-axis-v1 (240-X,Z-1000,Y-235)*.005',solver:'HORIZON-1/2cf8fae',sourceID:'bonehub-vhf-skull_cranial_maxilla',mechanical:'root geodesic + linear qualified twist/compression/deploy; depth5 inflated OBB; conditional closed solid'});
export const B=globalThis.BodyMarrowBoard,M=globalThis.BodyMarrow,S=globalThis.BodyMarrowSurface;
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function decodeAssets({manifest,source,vehicle}){
 if(await hash(manifest)!==MANIFEST||await hash(source)!==SOURCE||await hash(vehicle)!==SHA)throw Error('HORIZON digest mismatch');
 const src=JSON.parse(new TextDecoder().decode(manifest)).structures.find(x=>x.id===identity.sourceID),[part]=globalThis.BodyVHF.parse(source,{structures:[{...src,tissue:'Bone'}]},true,true);if(part.indices.length/3!==829568)throw Error('Source triangle count');
 const d=new DataView(vehicle),l=d.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(vehicle.slice(20,20+l))),start=28+l;
 function access(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],n=a.type==='VEC3'?3:1,w=a.componentType===5123?2:a.componentType===5121?1:4,stride=v.byteStride||n*w,arr=a.componentType===5126?new Float32Array(a.count*n):new Uint32Array(a.count*n);for(let q=0;q<a.count;q++)for(let k=0;k<n;k++){const p=start+(v.byteOffset||0)+(a.byteOffset||0)+q*stride+k*w;arr[q*n+k]=a.componentType===5126?d.getFloat32(p,true):a.componentType===5123?d.getUint16(p,true):a.componentType===5121?d.getUint8(p):d.getUint32(p,true);}return arr;}
 const parts=[];for(const node of j.nodes){if(node.matrix||node.translation||node.rotation||node.scale||node.children)throw Error('Unexpected node transform');for(const [k,p] of j.meshes[node.mesh].primitives.entries())parts.push({id:node.name+'_'+k,assembly:node.extras.assembly,positions:access(p.attributes.POSITION),indices:access(p.indices)});}
 if(parts.length!==5||parts.reduce((n,p)=>n+p.indices.length/3,0)!==19986)throw Error('Vehicle contract');return {part,parts};
}
