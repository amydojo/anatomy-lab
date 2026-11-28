/* VELOCITY embedded PNG adapter. Legacy scalar import remains unchanged.
 * Strict subset: glTF 2, one BIN, triangle primitives, UV0, opaque PBR,
 * no external data, no compressed/unsupported extensions. */
import {decodeVectorGLB} from '../glb-adapter.mjs';
const MAX=32*1024*1024, GROUPS=['front','rear','joint','front_pod','rear_pod'];
const fail=m=>{throw Error('VELOCITY GLB: '+m)};
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
function parse(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<28||buffer.byteLength>MAX)fail('size outside contract');
 const d=new DataView(buffer);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)fail('invalid header');
 let j,bin;for(let o=12;o<buffer.byteLength;){if(o+8>buffer.byteLength)fail('truncated chunk');const n=d.getUint32(o,true),k=d.getUint32(o+4,true);o+=8;if(n%4||o+n>buffer.byteLength)fail('chunk boundary');if(k===0x4e4f534a&&!j&&!bin)j=JSON.parse(new TextDecoder().decode(buffer.slice(o,o+n)));else if(k===0x004e4942&&j&&!bin)bin=buffer.slice(o,o+n);else fail('unexpected or duplicate chunk');o+=n;}
 if(!j||!bin||j.asset?.version!=='2.0'||j.buffers?.length!==1||j.buffers[0].uri||!integer(j.buffers[0].byteLength,1,bin.byteLength)||bin.byteLength-j.buffers[0].byteLength>3)fail('invalid buffer');
 for(const x of [...(j.extensionsUsed||[]),...(j.extensionsRequired||[])])if(x!=='KHR_materials_emissive_strength')fail('unsupported extension '+x);
 if(j.extensions||j.skins?.length||j.animations?.length||j.cameras?.length)fail('unsupported scene data');
 for(const v of j.bufferViews||[]){if(v.buffer!==0||v.extensions||!integer(v.byteOffset??0,0,bin.byteLength)||!integer(v.byteLength,1,bin.byteLength-(v.byteOffset??0)))fail('bufferView range');}
 for(const a of j.accessors||[]){const v=j.bufferViews?.[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];if(!v||!n||!size||a.sparse||a.normalized||!integer(a.count,1,300000)||!integer(a.byteOffset??0,0,v.byteLength))fail('unsupported accessor');const stride=v.byteStride??n*size;if(!integer(stride,n*size,252)||(a.byteOffset??0)+(a.count-1)*stride+n*size>v.byteLength)fail('accessor range');}
 if(!j.images?.length||j.images.length>16||!j.textures?.length||j.textures.length>16)fail('expected embedded maps');
 for(const t of j.textures){if(t.extensions||!integer(t.source,0,j.images.length-1))fail('texture source');const s=t.sampler===undefined?{}:j.samplers?.[t.sampler];if(!s||![undefined,9729,9987].includes(s.minFilter)||![undefined,9729].includes(s.magFilter)||s.wrapS!==33071||s.wrapT!==33071)fail('unsupported sampler');}
 const mats=j.materials||[];if(!mats.length||mats.length>16)fail('material count');
 function map(t){if(!t||!integer(t.index,0,j.textures.length-1)||(t.texCoord??0)!==0||t.extensions)fail('expected UV0 texture');return j.textures[t.index].source;}
 const bindings=mats.map(m=>{const p=m.pbrMetallicRoughness||{};if((m.alphaMode??'OPAQUE')!=='OPAQUE'||Object.keys(m.extensions||{}).some(k=>k!=='KHR_materials_emissive_strength'))fail('unsupported material');const base=p.baseColorFactor??[1,1,1,1],em=m.emissiveFactor??[0,0,0],metal=p.metallicFactor??1,rough=p.roughnessFactor??1,strength=m.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1,scale=m.normalTexture?.scale??1;if(!finite(base,4)||base[3]!==1||base.some(x=>x<0||x>1)||!finite(em,3)||em.some(x=>x<0||x>1)||![metal,rough].every(x=>Number.isFinite(x)&&x>=0&&x<=1)||!Number.isFinite(strength)||strength<0||strength>8||!Number.isFinite(scale)||scale<0||scale>2)fail('invalid PBR factors');if(m.occlusionTexture&&(!Number.isFinite(m.occlusionTexture.strength??1)||(m.occlusionTexture.strength??1)<0||(m.occlusionTexture.strength??1)>1))fail('AO strength');if(m.occlusionTexture&&map(m.occlusionTexture)!==map(p.metallicRoughnessTexture))fail('separate AO map unsupported');return {maps:[map(p.baseColorTexture),map(p.metallicRoughnessTexture),map(m.normalTexture),map(m.emissiveTexture)],base:base.slice(0,3),metal,rough,em,strength,normalScale:scale,ao:m.occlusionTexture?.strength??0};});
 const seen=new Set(),ids=new Map();
 function walk(i,depth){if(depth>16||!integer(i,0,(j.nodes?.length??0)-1)||seen.has(i))fail('invalid node graph');seen.add(i);const n=j.nodes[i];if(n.extensions||n.skin!==undefined||n.weights||n.matrix&&!finite(n.matrix,16)||n.translation&&!finite(n.translation,3)||n.rotation&&!finite(n.rotation,4)||n.scale&&!finite(n.scale,3))fail('invalid node transform');if(n.mesh!==undefined){if(!GROUPS.includes(n.extras?.assembly)||!n.name?.startsWith('__marrow_')||!integer(n.mesh,0,j.meshes.length-1))fail('unknown assembly');for(const [k,p] of j.meshes[n.mesh].primitives.entries()){if(p.extensions||p.targets||p.mode!==undefined&&p.mode!==4||!integer(p.material,0,mats.length-1))fail('primitive contract');const a=p.attributes||{},pos=j.accessors[a.POSITION],norm=j.accessors[a.NORMAL],uv=j.accessors[a.TEXCOORD_0],ix=j.accessors[p.indices];if(pos?.type!=='VEC3'||pos.componentType!==5126||norm?.type!=='VEC3'||norm.componentType!==5126||norm.count!==pos.count||uv?.type!=='VEC2'||uv.componentType!==5126||uv.count!==pos.count||ix?.type!=='SCALAR'||![5121,5123,5125].includes(ix.componentType)||ix.count%3)fail('required position/normal/UV/index accessor');const id=n.name+'_'+k;if(ids.has(id))fail('duplicate part');ids.set(id,bindings[p.material]);}}
 for(const c of n.children||[])walk(c,depth+1);}
 const scene=j.scenes?.[j.scene??0];if(!scene?.nodes?.length)fail('missing scene');for(const n of scene.nodes)walk(n,0);
 if(!ids.size||ids.size>128)fail('primitive count');
 return {j,bin,ids};
}
function scalarCopy(j,bin){
 // All material metadata has already been validated above. Reuse original
 // geometry decoder on a separately constructed scalar representation;
 // the historical rejection of original textured files remains intact.
 const copy=structuredClone(j);delete copy.images;delete copy.textures;delete copy.samplers;
 for(const m of copy.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
 const bytes=new TextEncoder().encode(JSON.stringify(copy)),n=(bytes.length+3)&~3,out=new ArrayBuffer(28+n+bin.byteLength),d=new DataView(out),u=new Uint8Array(out);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,out.byteLength,true);d.setUint32(12,n,true);d.setUint32(16,0x4e4f534a,true);u.fill(32,20,20+n);u.set(bytes,20);d.setUint32(20+n,bin.byteLength,true);d.setUint32(24+n,0x004e4942,true);u.set(new Uint8Array(bin),28+n);return out;
}
export async function decodeVelocityGLB(buffer){
 const {j,bin,ids}=parse(buffer),parts=decodeVectorGLB(scalarCopy(j,bin));
 if(parts.length!==ids.size||new Set(parts.map(p=>p.assembly)).size!==5||parts.some(p=>!p.uv.every(Number.isFinite)||!p.normals))fail('incomplete assemblies/UVs');
 const decoded=[];let decodedBytes=0;
 try{for(const im of j.images){
  if(im.uri||im.mimeType!=='image/png'||im.extensions||!integer(im.bufferView,0,j.bufferViews.length-1))fail('only embedded PNG supported');
  const v=j.bufferViews[im.bufferView],data=bin.slice(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),d=new DataView(data);
  if(data.byteLength<33||d.getUint32(0)!==0x89504e47||d.getUint32(4)!==0x0d0a1a0a||d.getUint32(12)!==0x49484452||!integer(d.getUint32(16),1,2048)||!integer(d.getUint32(20),1,2048))fail('PNG dimensions/signature');
  decodedBytes+=d.getUint32(16)*d.getUint32(20)*4;if(decodedBytes>64*1024*1024)fail('decoded image budget');
  const bitmap=await createImageBitmap(new Blob([data],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  if(bitmap.width!==d.getUint32(16)||bitmap.height!==d.getUint32(20)){bitmap.close();fail('decoded dimensions');}decoded.push(bitmap);
 }
 for(const p of parts){const m=ids.get(p.id);if(!m)fail('material mapping');p.velocity={...m,key:m.maps.join('/'),images:m.maps.map(i=>decoded[i])};}
 return parts;
 }catch(e){for(const im of decoded)im.close();throw e;}
}
export function closeVelocity(parts){for(const im of new Set(parts.flatMap(p=>p.velocity?.images||[])))im.close();}
export const inspectVelocity=buffer=>{const {j,ids}=parse(buffer);return {images:j.images.length,parts:ids.size};};
