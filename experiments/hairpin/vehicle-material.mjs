/* ATELIER shared vehicle material contract, version 1.
 * Asset data is independent of illumination. Packed surface RG=normal XY,
 * B=roughness, A=AO; metallic and emission are scalar component properties.
 * Byte totals describe specified texture formats, not driver residency.
 */
export const CONTRACT='hairpin-material-v1';
export const LIGHTS=Object.freeze({
 studio:Object.freeze({key:[-.55,.65,.60],fill:[.83,.12,.54],keyColor:[1.2,1.12,1.26],fillColor:[.6,.8,1.1],ambient:.12,keyPower:.82,fillPower:.36,reflection:1,exposure:1}),
 game:Object.freeze({key:[-.55,.72,.56],fill:[.78,-.25,.56],keyColor:[1.08,1.02,.94],fillColor:[.65,.71,.86],ambient:.26,keyPower:.72,fillPower:.26,reflection:.68,exposure:1})
});
export const MAP_LAYOUT=Object.freeze({base:Object.freeze({size:512,channels:3,format:'RGB8',colorSpace:'srgb'}),surface:Object.freeze({size:256,channels:4,format:'RGBA8',colorSpace:'linear',packing:'normalXY/roughness/AO'})});
export function mipBytes(size,channels){let n=0;for(let s=size;s>=1;s=Math.floor(s/2))n+=s*s*channels;return n;}
export function materialFor(part){const m=part.material;if(!m||m.length!==5||!m.every(Number.isFinite))throw Error('Invalid vehicle material: '+part.id);if(!part.color||part.color.length!==3||!part.color.every(Number.isFinite))throw Error('Invalid base color');if(part.texture&&(!part.uv||part.uv.length!==part.positions.length/3*2||!part.uv.every(Number.isFinite)))throw Error('Missing UVs: '+part.id);return {baseColor:part.color,roughness:m[0],specular:m[1],metallic:m[2],emissive:m[3],detail:m[4],mapKey:part.texture||null,packed:m.slice(0,4)};}
export function textureBudget(keys){return new Set(keys.filter(Boolean)).size*(mipBytes(MAP_LAYOUT.base.size,MAP_LAYOUT.base.channels)+mipBytes(MAP_LAYOUT.surface.size,MAP_LAYOUT.surface.channels));}
