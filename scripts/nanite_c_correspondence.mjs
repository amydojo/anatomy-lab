// Reproduced from pinned RESIDENCY baseline 6d51fc0; experimental only, legacy renderer untouched.
 function lodTopology(indices,n){
  const parent=new Int32Array(n),used=new Uint8Array(n),edges=new Map();
  parent.fill(-1);
  const root=(a)=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  const use=a=>{if(!used[a]){used[a]=1;parent[a]=a;}};
  const join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a;};
  const key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];use(a);use(b);use(c);join(a,b);join(b,c);for(const [u,v] of [[a,b],[b,c],[c,a]]){const k=key(u,v);edges.set(k,(edges.get(k)||0)+1);}}
  const components=new Set();let vertices=0;for(let i=0;i<n;i++)if(used[i]){vertices++;components.add(root(i));}
  const degree=new Uint32Array(n),badVertex=new Uint8Array(n),boundaryParent=new Int32Array(n);boundaryParent.fill(-1);let nonmanifold=0;
  const br=a=>{while(boundaryParent[a]!==a){boundaryParent[a]=boundaryParent[boundaryParent[a]];a=boundaryParent[a];}return a;};
  for(const [k,count] of edges){const a=Math.floor(k/n),b=k%n;if(count>2){nonmanifold++;badVertex[a]=badVertex[b]=1;}if(count!==1)continue;for(const v of [a,b]){degree[v]++;if(boundaryParent[v]<0)boundaryParent[v]=v;}const x=br(a),y=br(b);if(x!==y)boundaryParent[y]=x;}
  const boundaries=new Set();let irregularBoundary=0;for(let i=0;i<n;i++)if(degree[i]){boundaries.add(br(i));if(degree[i]!==2)irregularBoundary++;}
  return {used,edges,key,degree,badVertex,signature:{components:components.size,euler:vertices-edges.size+indices.length/3,boundaries:boundaries.size,irregularBoundary,nonmanifold}};
 }

 // Independent manifold edge collapses with a one-ring exclusion per pass.
 // The exact source coordinates of surviving vertices are retained.
 function collapseRound(pos,idx,radii,limit,top,stats={}){
  const hit=k=>stats[k]=(stats[k]||0)+1;
  const n=pos.length/3,counts=new Uint32Array(n),offsets=new Uint32Array(n+1);
  for(const v of idx)counts[v]++;for(let i=0;i<n;i++)offsets[i+1]=offsets[i]+counts[i];
  const cursor=offsets.slice(),incident=new Uint32Array(idx.length);
  for(let i=0;i<idx.length;i++)incident[cursor[idx[i]]++]=Math.floor(i/3)*3;
  const neighbors=v=>{const set=new Set();for(let k=offsets[v];k<offsets[v+1];k++){const f=incident[k];for(let j=0;j<3;j++)if(idx[f+j]!==v)set.add(idx[f+j]);}return set;};
  const normal=(a,b,c)=>{a*=3;b*=3;c*=3;const x=pos[b]-pos[a],y=pos[b+1]-pos[a+1],z=pos[b+2]-pos[a+2],u=pos[c]-pos[a],v=pos[c+1]-pos[a+1],w=pos[c+2]-pos[a+2];return [y*w-z*v,z*u-x*w,x*v-y*u];};
  const safe=(from,to,dist)=>{if(radii[from]+dist>limit){hit('accumulatedDisplacement');return false;}const faceKeys=new Set();
   for(const v of [from,to])for(let k=offsets[v];k<offsets[v+1];k++){const f=incident[k],old=[idx[f],idx[f+1],idx[f+2]];if(old.includes(from)&&old.includes(to))continue;const next=old.map(x=>x===from?to:x);const key=[...next].sort((a,b)=>a-b).join(',');if(faceKeys.has(key)){hit('localDuplicateFace');return false;}faceKeys.add(key);if(v===from){const a=normal(...old),b=normal(...next),dot=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=Math.hypot(...a)*Math.hypot(...b);if(!len||dot<len*.5){hit(!len?'localZeroNormal':'localNormalRotation');return false;}}}
   return true;};
  const blocked=new Uint8Array(n),representative=Uint32Array.from({length:n},(_,i)=>i);let removed=0;
  for(const [k,edgeFaces] of top.edges){if(edgeFaces>2){hit('nonmanifold');continue;}let a=Math.floor(k/n),b=k%n;if(blocked[a]||blocked[b]){hit('oneRingExcluded');continue;}if(top.badVertex[a]||top.badVertex[b]){hit('nonmanifold');continue;}
   const ba=top.degree[a],bb=top.degree[b];if((ba||bb)&&(edgeFaces!==1||ba!==2||bb!==2)){hit('boundary');continue;}
   const dist=Math.hypot(pos[a*3]-pos[b*3],pos[a*3+1]-pos[b*3+1],pos[a*3+2]-pos[b*3+2]);if(!dist){hit('zeroLengthEdge');continue;}if(Math.min(radii[a],radii[b])+dist>limit){hit('accumulatedDisplacement');continue;}
   const na=neighbors(a),nb=neighbors(b);let common=0;for(const x of na)if(nb.has(x))common++;if(common!==edgeFaces){hit('linkCondition');continue;}
   // A surviving link must contain exactly the edge's opposite vertices.
   const opposite=new Set();for(let j=offsets[a];j<offsets[a+1];j++){const f=incident[j],tri=[idx[f],idx[f+1],idx[f+2]];if(tri.includes(b))for(const x of tri)if(x!==a&&x!==b)opposite.add(x);}
   if(opposite.size!==edgeFaces||[...opposite].some(x=>!na.has(x)||!nb.has(x))){hit('oppositeLink');continue;}
   if(!safe(b,a,dist)){if(!safe(a,b,dist))continue;[a,b]=[b,a];}
   representative[b]=a;radii[a]=Math.max(radii[a],radii[b]+dist);blocked[a]=blocked[b]=1;for(const x of na)blocked[x]=1;for(const x of nb)blocked[x]=1;removed++;
  }
  if(!removed)return null;
  const remap=new Uint32Array(n),index=new Int32Array(n);index.fill(-1);const coords=[],outRadii=[];
  for(let i=0;i<n;i++){const j=representative[i];if(index[j]<0){index[j]=coords.length/3;coords.push(pos[j*3],pos[j*3+1],pos[j*3+2]);outRadii.push(radii[j]);}remap[i]=index[j];}
  const faces=[];for(let i=0;i<idx.length;i+=3){const a=remap[idx[i]],b=remap[idx[i+1]],c=remap[idx[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
  return {positions:new Float32Array(coords),indices:new Uint32Array(faces),radii:new Float64Array(outRadii),remap,removed};
 }

export {lodTopology};
export function certifyMapping(part,coords,mapped,limit,sourceTopology=lodTopology(part.indices,part.positions.length/3)){
 const pos=part.positions,idx=part.indices,n=pos.length/3,faces=[],unique=new Map(),collapsed=[];let error=0,normalReversals=0,zeroNormals=0,oppositeDuplicates=0;
 const normal=(p,a,b,c)=>{a*=3;b*=3;c*=3;const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],u=p[c]-p[a],v=p[c+1]-p[a+1],w=p[c+2]-p[a+2];return [y*w-z*v,z*u-x*w,x*v-y*u];};
 for(let i=0;i<n;i++){const j=mapped[i];error=Math.max(error,Math.hypot(pos[i*3]-coords[j*3],pos[i*3+1]-coords[j*3+1],pos[i*3+2]-coords[j*3+2]));}
 for(let i=0;i<idx.length;i+=3){const a=mapped[idx[i]],b=mapped[idx[i+1]],c=mapped[idx[i+2]];if(a===b||b===c||c===a){collapsed.push(a,b,c);continue;}
  const old=normal(pos,idx[i],idx[i+1],idx[i+2]),next=normal(coords,a,b,c);if(old[0]*next[0]+old[1]*next[1]+old[2]*next[2]<=0){if(!Math.hypot(...old)||!Math.hypot(...next))zeroNormals++;else normalReversals++;}
  const sorted=[a,b,c].sort((x,y)=>x-y),key=sorted.join(','),orientation=(a===sorted[0]&&b===sorted[1])||(b===sorted[0]&&c===sorted[1])||(c===sorted[0]&&a===sorted[1]);if(unique.has(key)){if(unique.get(key)!==orientation)oppositeDuplicates++;continue;}unique.set(key,orientation);faces.push(a,b,c);
 }
 const count=coords.length/3,top=lodTopology(faces,count);let lostSupport=0;
 for(let i=0;i<collapsed.length;i+=3){const distinct=[...new Set(collapsed.slice(i,i+3))];if(distinct.some(v=>!top.used[v])||(distinct.length===2&&!top.edges.has(top.key(...distinct))))lostSupport++;}
 const topologyChanged=JSON.stringify(top.signature)!==JSON.stringify(sourceTopology.signature),insufficientReduction=faces.length>=idx.length*.95||coords.length>=pos.length*.95||faces.length<3;
 const passed=Number.isFinite(error)&&error<=limit&&!normalReversals&&!zeroNormals&&!oppositeDuplicates&&!lostSupport&&!topologyChanged&&!insufficientReduction;
 return {passed,error,limit,normalReversals,zeroNormals,oppositeDuplicates,lostSupport,topologyChanged,insufficientReduction,signature:top.signature,triangles:faces.length/3,vertices:count,positions:coords,indices:count<=65536?new Uint16Array(faces):new Uint32Array(faces),map:mapped.slice()};
}
export function prefixTrials(part,fraction=.012,maxRounds=12){
 const source=part.positions,idx=part.indices,n=source.length/3,sourceTopology=lodTopology(idx,n),limit=Math.hypot(...part.max.map((v,k)=>v-part.min[k]))*fraction;
 let pos=source,cur=idx,radii=new Float64Array(n),mapped=Uint32Array.from({length:n},(_,i)=>i),top=sourceTopology;
 const trials=[];let best=null;
 for(let pass=1;pass<=maxRounds;pass++){
  const stats={},round=collapseRound(pos,cur,radii,limit,top,stats);if(!round){trials.push({pass,stats,stop:'no collapse'});break;}
  const next=lodTopology(round.indices,round.positions.length/3);if(JSON.stringify(next.signature)!==JSON.stringify(sourceTopology.signature)){trials.push({pass,stats,stop:'intermediate topology change',signature:next.signature});break;}
  for(let i=0;i<n;i++)mapped[i]=round.remap[mapped[i]];pos=round.positions;cur=round.indices;radii=round.radii;top=next;
  const result=certifyMapping(part,pos,mapped,limit,sourceTopology),{positions,indices,map,...summary}=result;
  trials.push({pass,stats,...summary});if(result.passed&&(!best||result.triangles<best.triangles))best={...result,pass};
  if(cur.length<idx.length*.45)break;
 }
 return {trials,best,sourceTopology:sourceTopology.signature,limit};
}
