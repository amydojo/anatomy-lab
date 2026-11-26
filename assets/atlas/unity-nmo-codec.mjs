// Research-only NMO1 decoder contract. Does not change existing scene activation.
export const NMO_SCHEMA='nanite-c-meshopt-overview-research-1';
export const NMQ_SCHEMA='nanite-c-hybrid-quant-research-1';
export const NMO_PROVIDER_VERSION='1.2.1-research';
const require=(x,m)=>{if(!x)throw Error(m);};
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const positive=n=>Number.isSafeInteger(n)&&n>0;
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export function validateNmoManifest(manifest,source,sourceHash){
 require(hash(sourceHash)&&[NMO_SCHEMA,NMQ_SCHEMA].includes(manifest.schema)&&manifest.sourceManifestSha256===sourceHash,'source binding');
 require(source.schema==='body-live-unity-source-1'&&source.structures.length===143&&manifest.structures.length===143,'coverage');
 const by=new Map(source.structures.map(e=>[e.id,e])),ids=new Set();
 require(by.size===143,'duplicate source labels');
 for(const e of manifest.structures){
  const s=by.get(e.id);require(s&&!ids.has(e.id)&&/^bonehub-vhf-[a-z0-9_]+$/.test(e.id),'source id');ids.add(e.id);
  require(e.sourceHash===s.sha256&&e.exact.sha256===s.sha256&&e.exact.file===s.file&&e.exact.bytes===s.bytes&&e.exact.vertices===s.vertices&&e.exact.triangles===s.triangles,'exact identity');
  require(e.file===e.id+(e.codec==='NMQ1'?'.nmq.gz':'.nmo.gz')&&[e.sha256,e.encodedSha256,e.vertexSha256,e.indexSha256].every(hash),'payload identity');
  require([e.bytes,e.meshoptBytes,e.decodedBytes,e.vertices,e.triangles].every(positive)&&[2,4].includes(e.indexWidth)&&e.vertices<=s.vertices&&e.triangles<=s.triangles,'counts');
  require(e.decodedBytes===12*e.vertices+3*e.triangles*e.indexWidth&&e.gpuBytes===16*e.vertices+3*e.triangles*e.indexWidth,'allocation');
  require(Number.isFinite(e.error)&&e.error>=0&&Number.isFinite(e.limit)&&e.error<=e.limit,'error bound');
  const d=Math.hypot(...e.max.map((v,i)=>v-e.min[i]));require(Number.isFinite(d)&&e.limit<=d*(e.level==='regional'?.004:.012)+1e-9,'tolerance');
  if(e.codec==='NMQ1')require(Number.isSafeInteger(e.quantization?.exactOverrides)&&e.quantization.exactOverrides>=0&&e.quantization.exactOverrides<=e.vertices,'quantization overrides');
  if(e.level==='guarded-overview')require(e.certificate?.method==='source-map-verified'&&hash(e.certificate.mapSha256),'map evidence');
 }
 if(manifest.overviewPack)require(manifest.overviewPack.file==='overview.pack'&&hash(manifest.overviewPack.sha256)&&manifest.overviewPack.bytes===manifest.structures.reduce((n,e)=>n+e.bytes,0)&&manifest.overviewPack.order==='manifest structures order','overview pack identity');
 return manifest;
}
export function nmoPreflight(manifest,{sourceManifestBytes,derivativeManifestBytes,decoderTransferBytes=0,budget=32*1024*1024,headroom=4*1024*1024}){
 const gpuBytes=manifest.structures.reduce((n,e)=>n+e.gpuBytes,0),geometryTransferBytes=manifest.structures.reduce((n,e)=>n+e.bytes,0);
 const transferBytes=geometryTransferBytes+sourceManifestBytes+derivativeManifestBytes+decoderTransferBytes;
 return {labels:manifest.structures.length,gpuBytes,geometryTransferBytes,transferBytes,budget,headroom,steadyFits:gpuBytes<=budget-headroom,payloadFits:transferBytes<5000000};
}
// Input is decompressed NMO1; verify both encoded bytes and decoded arrays.
export async function decodeNmo(encoded,record,decoder,digest=sha256){
 const raw=encoded instanceof Uint8Array?encoded:new Uint8Array(encoded);require(raw.byteLength===record.meshoptBytes&&await digest(raw)===record.encodedSha256,'encoded integrity');
 require(raw.byteLength>=24,'NMO1 header');const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 require(dv.getUint32(0,true)===0x314f4d4e,'NMO1 magic');
 const n=dv.getUint32(4,true),k=dv.getUint32(8,true),w=dv.getUint32(12,true),vb=dv.getUint32(16,true),ib=dv.getUint32(20,true);
 require(n===record.vertices&&k===record.triangles*3&&w===record.indexWidth&&[2,4].includes(w)&&n*12+k*w===record.decodedBytes&&vb>0&&ib>0&&24+vb+ib===raw.length,'NMO1 counts');
 await decoder.ready;
 const v=new Uint8Array(n*12),i=new Uint8Array(k*w);decoder.decodeVertexBuffer(v,n,12,raw.subarray(24,24+vb));decoder.decodeIndexSequence(i,k,w,raw.subarray(24+vb));
 require(await digest(v)===record.vertexSha256&&await digest(i)===record.indexSha256,'decoded integrity');
 const positions=new Float32Array(v.buffer),indices=w===2?new Uint16Array(i.buffer):new Uint32Array(i.buffer);
 for(const x of positions)require(Number.isFinite(x),'nonfinite coordinate');for(const x of indices)require(x<n,'index bounds');return {positions,indices};
}
export async function decodeCompressedMember(compressed,record,decoder,{signal,digest=sha256}={}){
 require(compressed.byteLength===record.bytes&&await digest(compressed)===record.sha256,'compressed integrity');
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),output=new Uint8Array(record.meshoptBytes);let offset=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;require(offset+value.length<=output.length,'decompression overflow');output.set(value,offset);offset+=value.length;}}finally{await reader.cancel();}
 require(offset===output.length&&!signal?.aborted,'incomplete or canceled NMO');return record.codec==='NMQ1'?decodeNmq(output,record,decoder,digest):decodeNmo(output,record,decoder,digest);
}
// Caller must provide two reviewed independent SHA-256 pins; no runtime self-pinning.
export async function openNmoResearch({sourceUrl,manifestUrl,sourceHash,manifestHash,fetcher=fetch,digest=sha256,signal,decoderTransferBytes=0}){
 require(hash(sourceHash)&&hash(manifestHash),'independent pins');
 const read=async(url,pin)=>{const r=await fetcher(url,{signal});require(r.ok,'manifest unavailable');const b=await r.arrayBuffer();require(await digest(b)===pin,'manifest digest mismatch');return {data:JSON.parse(new TextDecoder().decode(b)),bytes:b.byteLength};};
 const [s,m]=await Promise.all([read(sourceUrl,sourceHash),read(manifestUrl,manifestHash)]);validateNmoManifest(m.data,s.data,sourceHash);
 return Object.freeze({version:NMO_PROVIDER_VERSION,source:s.data,manifest:m.data,pins:{sourceHash,manifestHash},preflight:nmoPreflight(m.data,{sourceManifestBytes:s.bytes,derivativeManifestBytes:m.bytes,decoderTransferBytes}),releaseEligible:false});
}

// NMQ1: 16-bit per-axis coordinates reconstructed into Float32; exact feature
// overrides remain Float32. No quantized GPU shader or clinical claim.
export async function decodeNmq(encoded,record,decoder,digest=sha256){
 const raw=encoded instanceof Uint8Array?encoded:new Uint8Array(encoded);
 require(raw.byteLength===record.meshoptBytes&&await digest(raw)===record.encodedSha256&&raw.byteLength>=80,'encoded integrity');
 const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);require(d.getUint32(0,true)===0x31514d4e,'NMQ1 magic');
 const [n,k,w,vb,ib,mb,ob]=Array.from({length:7},(_,j)=>d.getUint32(4+j*4,true));
 require(n===record.vertices&&k===record.triangles*3&&w===record.indexWidth&&[2,4].includes(w)&&n*12+k*w===record.decodedBytes&&vb>0&&ib>0&&mb===Math.ceil(n/8)&&80+vb+ib+mb+ob===raw.length,'NMQ1 counts');
 const lo=Array.from({length:3},(_,j)=>d.getFloat64(32+j*8,true)),step=Array.from({length:3},(_,j)=>d.getFloat64(56+j*8,true));require(lo.every(Number.isFinite)&&step.every(x=>Number.isFinite(x)&&x>=0),'quantization transform');
 const mask=raw.subarray(80+vb+ib,80+vb+ib+mb);let overrides=0;for(let j=0;j<mb*8;j++)if(mask[j>>3]&(1<<(j&7))){require(j<n,'mask tail');overrides++;}
 require(overrides===record.quantization.exactOverrides&&((overrides>0)===(ob>0)),'override count');
 await decoder.ready;const q=new Uint8Array(n*8),ix=new Uint8Array(k*w),ov=new Uint8Array(overrides*12);decoder.decodeVertexBuffer(q,n,8,raw.subarray(80,80+vb));decoder.decodeIndexSequence(ix,k,w,raw.subarray(80+vb,80+vb+ib));if(ob)decoder.decodeVertexBuffer(ov,overrides,12,raw.subarray(80+vb+ib+mb));
 const qv=new Uint16Array(q.buffer),exact=new Float32Array(ov.buffer),positions=new Float32Array(n*3),indices=w===2?new Uint16Array(ix.buffer):new Uint32Array(ix.buffer);let at=0;
 for(let j=0;j<n;j++)for(let s=0;s<3;s++)positions[j*3+s]=(mask[j>>3]&(1<<(j&7)))?exact[at++]:lo[s]+qv[j*4+s]*step[s];
 require(at===exact.length&&await digest(new Uint8Array(positions.buffer))===record.vertexSha256&&await digest(ix)===record.indexSha256,'decoded integrity');
 for(const x of positions)require(Number.isFinite(x),'nonfinite coordinate');for(const x of indices)require(x<n,'index bounds');return {positions,indices};
}
export async function loadNmo(root,record,decoder,{signal,fetcher=fetch,digest=sha256}={}){
 const r=await fetcher(new URL(record.file,root),{signal});require(r.ok,'NMO unavailable');return decodeCompressedMember(await r.arrayBuffer(),record,decoder,{signal,digest});
}
export async function loadOverviewPack(root,manifest,{signal,fetcher=fetch,digest=sha256}={}){
 const p=manifest.overviewPack;require(p&&p.order==='manifest structures order','pack unavailable');const r=await fetcher(new URL(p.file,root),{signal});require(r.ok,'pack unavailable');
 const b=new Uint8Array(await r.arrayBuffer());require(b.byteLength===p.bytes&&await digest(b)===p.sha256,'pack integrity');
 let offset=0;const members=new Map();for(const record of manifest.structures){const end=offset+record.bytes;require(end<=b.length,'pack bounds');members.set(record.id,b.subarray(offset,end));offset=end;}require(offset===b.length,'pack length');
 return {decode:(id,decoder,options={})=>{const record=manifest.structures.find(e=>e.id===id);require(record&&members.has(id),'unknown member');return decodeCompressedMember(members.get(id),record,decoder,{...options,digest});},release:()=>members.clear()};
}
