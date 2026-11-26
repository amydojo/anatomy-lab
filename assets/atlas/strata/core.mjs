export function inventory(manifest,contract){
 if(manifest.schema!=="body-live-vhf-lower-body-1"||manifest.structures.length!==128||manifest.bundles.length!==8||manifest.archive_sha256!==contract.denver.archiveSha256)throw Error("Unexpected Denver inventory");
 const ids=new Set(),layers=new Map();
 for(const b of contract.layers){
  const mb=manifest.bundles.find(x=>x.file===b.file);
  if(!mb||["sha256","bytes","triangles","vertices","side","tissue","structures"].some(k=>mb[k]!==b[k])||b.space!=="denver-bundle-native"||b.qualification!=="source-native-only"||layers.has(b.id))throw Error("Layer mismatch "+b.id);
  const entries=manifest.structures.filter(x=>x.side===b.side&&x.tissue===b.tissue);
  if(entries.length!==b.structures||entries.reduce((n,x)=>n+x.triangles,0)!==b.triangles||entries.reduce((n,x)=>n+x.vertices,0)!==b.vertices)throw Error("Structure totals mismatch");
  for(const e of entries){if(ids.has(e.id)||! /^[a-f0-9]{64}$/.test(e.source_sha256))throw Error("Structure identity mismatch");ids.add(e.id);}
  layers.set(b.id,{...b,entries});
 }
 if(ids.size!==manifest.structures.length)throw Error("Incomplete tissue inventory");
 return layers;
}

export function rigid(matrix){
 if(!Array.isArray(matrix)||matrix.length!==4||matrix.some(r=>!Array.isArray(r)||r.length!==4||!r.every(Number.isFinite)))throw Error("Expected finite 4x4 matrix");
 const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),R=matrix.slice(0,3).map(r=>r.slice(0,3));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(dot(R[i],R[j])-+(i===j))>1e-6)throw Error("Non-rigid matrix");
 const [a,b,c]=R,det=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
 if(Math.abs(det-1)>1e-6||matrix[3].some((x,i)=>Math.abs(x-+(i===3))>1e-6))throw Error("Improper rigid matrix");
 return matrix;
}

export function apply(matrix,p){return matrix.slice(0,3).map(r=>r[0]*p[0]+r[1]*p[1]+r[2]*p[2]+r[3]);}

export function compareCandidates(candidates,fit,holdout){
 const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 const all=[...fit,...holdout];if(fit.length<4||holdout.length<2||all.some(p=>typeof p.id!=="string"||!p.id||!point(p.source)||!point(p.target))||new Set(all.map(p=>p.id)).size!==all.length)throw Error("Need distinct fit and held-out landmark coordinates");
 for(const k of ["source","target"])if(new Set(all.map(p=>JSON.stringify(p[k]))).size!==all.length)throw Error("Duplicate landmark coordinates");
 const score=(matrix,points)=>{const residuals=points.map(p=>({id:p.id,error:Math.hypot(...apply(matrix,p.source).map((v,i)=>v-p.target[i]))}));return {residuals,rms:Math.sqrt(residuals.reduce((n,p)=>n+p.error**2,0)/points.length),max:Math.max(...residuals.map(p=>p.error))};};
 return candidates.map(c=>({id:c.id,fit:score(rigid(c.matrix),fit),heldOut:score(c.matrix,holdout),units:"source units; not verified mm",qualification:"experimental-only",canonicalAllowed:false}));
}

export function historicalScreen(record){return Object.entries(record.metrics).map(([id,values])=>({id,role:id.startsWith("femur")?"fit":"held-out",values,failures:record.metricOrder.filter((k,i)=>values[i]>record.thresholds[k])}));}

export function selection(entries,view){const q=(view.query||"").trim().toLowerCase();return entries.filter(e=>(!view.tissue||view.tissue===e.tissue)&&(!view.side||view.side===e.side)&&(!view.isolated||view.isolated===e.id)&&(!q||[e.id,e.source_name,e.tissue,e.side].join(" ").toLowerCase().includes(q)));}

export function streamRequest(layer,{world="denver-native",maxBytes=16*1024*1024,signal}={}){
 if(world!=="denver-native"||layer.space!=="denver-bundle-native"||layer.qualification!=="source-native-only")throw Error("Canonical tissue admission blocked");
 if(!Number.isSafeInteger(layer.bytes)||layer.bytes<=0||layer.bytes>maxBytes||!/^vhf-(left|right)-(bone|cartilage|ligament|muscle)\.glb$/.test(layer.file)||! /^[a-f0-9]{64}$/.test(layer.sha256))throw Error("Invalid or over-budget geometry request");
 return {url:"/assets/atlas/vhf/world/"+layer.file,bytes:layer.bytes,sha256:layer.sha256,level:"exact",space:layer.space,signal};
}
