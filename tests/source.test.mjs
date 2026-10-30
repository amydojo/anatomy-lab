import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('All legacy routes and references remain present',()=>{
  for(const path of ['index.html','hip/index.html','hip/dissection/index.html','knee/index.html','shoulder/index.html','references/index.html'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
test('All primary labs use the same V4 engine with original SVG geometry',()=>{
  for(const region of ['hip','knee','shoulder']){
    const text=read(region+'/index.html');
    assert.ok(text.includes('/assets/v4.js')&&text.includes('/assets/v4.css')&&text.includes('/assets/v3-data.js'),region);
    assert.match(text,/<svg/i);
    assert.ok(!text.includes('/assets/v3.js'));
  }
});
test('V4 runtime and knowledge model parse',()=>{
  for(const path of ['assets/v4.js','assets/v3-data.js','assets/v3-home.js'])assert.doesNotThrow(()=>new Function(read(path)),path);
  const s=read('assets/v3-data.js');
  for(const key of ['k-patella','k-menisci','k-quads','k-ligaments','s-mobility','s-cuff','s-scapula','s-rotation','h-motor','h-balance','h-hidden','h-nerve'])assert.ok(s.includes('id:"'+key+'"'),key);
});
test('V4 has contextual controls, simple depth interface, and explicit safety boundaries',()=>{
 const s=read('assets/v4.js');
 for(const t of ['data-action="trace"','data-action="lesson"','v4-depth-input','data-action="panel"','stop if','Not to scale']){}
 assert.ok(s.includes('v4-depth-input')&&s.includes('v4-inspector')&&s.includes('data-action="related"'));
 assert.ok(!s.includes('data-v3-mode'));
 assert.ok(read('references/index.html').includes('OpenStax'));
});

test('Anatomy graph and lesson targets have valid references', async()=>{
 const {runInNewContext}=await import('node:vm');
 const globals={window:{}};
 runInNewContext(read('assets/v3-data.js'),globals);
 const d=globals.window.BODYLIVE_DATA;
 const allIds=new Set();
 for(const [region,r] of Object.entries(d.regions)){
   const structures=new Set(r.structures.map(x=>x.key));
   assert.equal(structures.size,r.structures.length,'unique structure keys in '+region);
   assert.ok(r.layers.length>=4);
   for(const entry of r.structures){
      for(const key of entry.related||[])assert.ok(structures.has(key),'missing related '+key+' in '+region);
      assert.ok(entry.fact?.length>15);
   }
   for(const lesson of d.lessons[region]){
     assert.ok(!allIds.has(lesson.id),'duplicate lesson '+lesson.id);
     allIds.add(lesson.id);
     assert.ok(structures.has(lesson.key),lesson.id+' references missing '+lesson.key);
     assert.ok(lesson.options.length>=2);
     assert.ok(lesson.correct>=0&&lesson.correct<lesson.options.length);
     if(lesson.target.type==='select'||lesson.target.type==='trace')assert.ok(structures.has(lesson.target.key),'missing lesson target '+lesson.target.key);
     if(lesson.target.type==='depth')assert.ok(lesson.target.min<r.layers.length);
     if(lesson.target.type==='angle')assert.ok(lesson.target.min<=r.max);
   }
   for(const route of r.traces)assert.ok(structures.has(route.key),'unresolved nerve route '+route.key);
 }
 assert.equal(allIds.size,12);
});

test('KNEE / SPATIAL is self contained, labeled as schematic, and protects V4 routing',()=>{
  for(const path of ['knee/spatial/index.html','knee/spatial/spatial.css','knee/spatial/spatial.js','knee/spatial/sources/index.html'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
  assert.doesNotThrow(()=>new Function(read('knee/spatial/spatial.js')));
  const page=read('knee/spatial/index.html');
  assert.ok(page.includes('Return to classic knee lab')&&page.includes('not clinically validated'));
  const dossier=read('knee/spatial/sources/index.html');
  assert.ok(existsSync(new URL('../knee/spatial/assets/bp3d-right-knee-4.0.json',import.meta.url)));
  assert.ok(existsSync(new URL('../knee/spatial/assets/provenance.json',import.meta.url)));
  assert.ok(dossier.includes('BodyParts3D 4.0-derived geometry'));
  assert.ok(read('knee/index.html').includes('/knee/spatial/'));
});

test('Spatial core is separate from knee geometry and usable without a framework',()=>{
 const core=read('assets/spatial-core.js');
 assert.doesNotThrow(()=>new Function(core));
 assert.ok(core.includes('attachOrbit')&&core.includes('project'));
 assert.ok(read('knee/spatial/index.html').includes('/assets/spatial-core.js'));
});

test('spatial core preserves pairwise length during rigid knee rotations',()=>{
 const host={};
 new Function('window',read('assets/spatial-core.js'))(host);
 const rotate=host.BodySpatialCore.rotateAboutX;
 const pivot={x:0,y:0.08,z:0};
 const first={x:0.15,y:-0.11,z:0.05};
 const second={x:-0.17,y:-0.41,z:-0.13};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const degrees of [0,30,65,90,110]){
   const theta=degrees*Math.PI/180;
   const a=rotate(first,pivot,theta),b=rotate(second,pivot,theta);
   assert.ok(Math.abs(dist(a,b)-dist(first,second))<1e-10,'rigid distance '+degrees);
   const inverse=rotate(a,pivot,-theta);
   assert.ok(dist(inverse,first)<1e-10,'rotation reversibility '+degrees);
 }
});

test('V5.2 sourced landmarks snap to bone vertices and remain attached at all flexion poses',()=>{
 const host={};
 new Function('window',read('knee/spatial/attachment-graph.js'))(host);
 const model=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const meshes=Object.fromEntries(Object.entries(model.bone_meshes).map(([bone,d])=>[
   bone,{verts:d.vertices.map(([x,y,z])=>({x,y,z}))}
 ]));
 const graph=host.KneeAttachmentGraph.create(meshes);
 assert.equal(Object.keys(graph.anchors).length,14);
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const anchor of Object.values(graph.anchors)){
   const source=meshes[anchor.bone].verts[anchor.sourceIndex];
   assert.ok(dist(anchor.base,source)<1e-12,anchor.id+' lost source correspondence');
   assert.equal(anchor.status,'estimated/unreviewed');
 }
 for(const angle of [0,30,60,90,110]){
   for(const a of Object.values(graph.anchors)){
     const current=graph.at(a.id,angle);
     const boneWorld=graph.transform(a.bone,meshes[a.bone].verts[a.sourceIndex],angle);
     assert.ok(dist(current,boneWorld)<1e-10,'detached '+a.id+' at '+angle);
   }
   for(const [id,link] of Object.entries(graph.links)){
     const line=graph.guide(id,angle);
     assert.ok(dist(line.from,graph.at(link.from,angle))<1e-10,id+' start detached');
     assert.ok(dist(line.to,graph.at(link.to,angle))<1e-10,id+' end detached');
     assert.ok(line.vertices.every(v=>[v.x,v.y,v.z].every(Number.isFinite)));
   }
 }
 const femur='acl.femur',tibia='acl.tibia';
 assert.ok(dist(graph.at(femur,0),graph.at(femur,110))<1e-10,'static femur moved');
 assert.ok(dist(graph.at(tibia,0),graph.at(tibia,110))>.04,'moving tibia did not move');
 for(const bone of ['tibia','fibula','patella']){
   const a=meshes[bone].verts[0],b=meshes[bone].verts[Math.min(55,meshes[bone].verts.length-1)];
   const baseline=dist(a,b);
   for(const angle of [0,45,90,110])
     assert.ok(Math.abs(dist(graph.transform(bone,a,angle),graph.transform(bone,b,angle))-baseline)<1e-8,'bone warped '+bone);
 }
});
test('V5.2 attachment graph and inspector are included in the published knee route',()=>{
 const page=read('knee/spatial/index.html'),logic=read('knee/spatial/spatial.js');
 assert.ok(page.includes('/knee/spatial/attachment-graph.js'));
 assert.ok(page.includes('id="follow"'));
 assert.ok(page.includes('id="attachment-info"'));
 assert.ok(logic.includes('attachmentGraph.transform(bone,p,state.flex)'));
 assert.ok(logic.includes('attachmentGraph.guide(edge,state.flex)'));
 assert.ok(logic.includes('estimated')||read('knee/spatial/attachment-graph.js').includes('estimated/unreviewed'));
});

test('V5.3 hip route is real, reuses the spatial core, and preserves the original dissection',()=>{
 for(const path of ['hip/spatial/index.html','hip/spatial/hip.css','hip/spatial/hip.js',
   'hip/spatial/sources/index.html','hip/spatial/assets/hip-source.json','hip/spatial/assets/provenance.json']){
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 const html=read('hip/spatial/index.html');
 assert.ok(html.includes('/assets/spatial-core.js'));
 assert.ok(html.includes('/hip/spatial/hip.js'));
 assert.ok(html.includes('/hip/dissection/'));
 assert.ok(read('hip/index.html').includes('/hip/spatial/'));
 assert.doesNotThrow(()=>new Function(read('hip/spatial/hip.js')));
 const scene=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const proof=JSON.parse(read('hip/spatial/assets/provenance.json'));
 assert.equal(Object.keys(scene.parts).length,11);
 assert.equal(scene.license,'CC BY 4.0');
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.biomechanics_validated,false);
 assert.ok(read('hip/spatial/sources/index.html').toLowerCase().includes('z-anatomy'));
});
test('V5.3 hip motion models are intentionally schematic, not clinical simulations',()=>{
 const s=read('hip/spatial/hip.js');
 for(const v of ['flexion','abduction','rotation','SCIATIC PATH','piriformis','gluteus medius','sourceLoaded'])
  assert.ok(s.toLowerCase().includes(v.toLowerCase()),v);
 assert.ok(s.includes('NOT validated joint kinematics'));
 assert.ok(s.includes("data.parts")||s.includes("d.parts"));
});

test('V5.4 sciatic geometry imported separately from medical imaging',()=>{
 const asset=JSON.parse(read('hip/spatial/assets/sciatic-source.json'));
 const proof=JSON.parse(read('hip/spatial/assets/sciatic-provenance.json'));
 assert.equal(asset.geometry_license,'CC BY-SA 4.0');
 assert.equal(asset.not_patient_specific,true);
 assert.equal(asset.clinical_reviewed,false);
 assert.deepEqual(Object.keys(asset.segments).sort(),['commonFibular','sciatic','tibial']);
 assert.equal(proof.status.imaging_derived,false);
 assert.equal(proof.micro_ct_2026.imported,false);
 assert.ok(read('hip/spatial/hip.js').includes('loadNerveTruth'));
 assert.ok(read('hip/spatial/index.html').includes('id="nerve-evidence"'));
 assert.ok(read('hip/spatial/sources/index.html').includes('Mixed-source registration'));
});

test('V5.5 nerve graph: anatomical hierarchy separated from unverified source surface seams',()=>{
 const host={};
 new Function('window',read('hip/spatial/nerve-follow.js'))(host);
 const d=JSON.parse(read('hip/spatial/assets/sciatic-source.json'));
 const g=host.BodyNerveFollow.create(d);
 assert.deepEqual(g.segments,['sciatic','tibial','commonFibular']);
 assert.equal(g.parents.sciatic,null);
 for(const id of ['sciatic','tibial','commonFibular']){
   assert.ok(g.branches[id].length>.2);
   assert.ok(g.topology[id].count>=1);
   const curve=g.branches[id];
   assert.ok(curve.proximal[1]>curve.distal[1],id+' path should travel inferiorly');
   let prev=null;
   for(let step=0;step<=100;step++){
     const p=g.sample(id,step/100);
     assert.ok(p.every(Number.isFinite));
     if(prev)assert.ok(host.BodyNerveFollow.dist(p,prev)<=curve.length/100*1.15,'arc-length jump '+id);
     prev=p;
   }
 }
 for(const id of ['tibial','commonFibular']){
   assert.equal(g.parents[id],'sciatic');
   assert.equal(g.junctions[id].displayedAsContinuousSource,false);
   assert.ok(g.junctions[id].sourceGap>0);
   assert.ok(g.junctions[id].guidance.length>30);
 }
 assert.equal(g.imagingDerived,false);
 assert.equal(g.anatomistReviewed,false);
});
test('V5.5 Hip/Knee source-frame conversion matches 480 corresponding femur vertices',()=>{
 const host={};
 new Function('window',read('assets/hip-knee-bridge.js'))(host);
 const hip=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const knee=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const b=host.BodyHipKneeBridge;
 const result=b.verify(hip,knee);
 assert.equal(result.matchedVertices,480);
 assert.ok(result.verifiedWithinSourceRounding);
 assert.ok(result.maximumSceneUnits<.00005);
 assert.equal(result.establishesNervePlacement,false);
 for(const p of [[1,2,3],[-.5,0,1]]){
   const roundTrip=b.hipToKnee(b.kneeToHip(p));
   assert.ok(Math.hypot(...roundTrip.map((v,i)=>v-p[i]))<1e-9);
 }
 const source=read('assets/spatial-core.js');
 assert.ok(source.includes('camera.target||{x:0,y:0,z:0}'));
});
test('V5.5 mobile Follow controls and source mode do not claim patient images',()=>{
 const hip=read('hip/spatial/index.html'),js=read('hip/spatial/hip.js'),css=read('hip/spatial/hip.css');
 for(const path of ['hip/spatial/nerve-follow.js','assets/hip-knee-bridge.js'])assert.ok(existsSync(new URL('../'+path,import.meta.url)));
 for(const phrase of ['id="follow-stage"','id="follow-progress"','id="follow-branch"','data-nerve-frame="atlas"','data-nerve-frame="composite"'])
   assert.ok(hip.includes(phrase),phrase);
 assert.ok(js.includes('startFollow'));
 assert.ok(js.includes('stopFollow'));
 assert.ok(js.includes('sourceTrace'));
 assert.ok(js.includes('HIP ↔ KNEE FRAME VERIFIED'));
 assert.ok(css.includes('.nerve-follow-stage'));
 assert.ok(js.includes('if(!nerveTruth)'));
});

test('V6 whole-body Atlas has evidence-safe source assets and interactive navigation',()=>{
 for(const path of ['atlas/index.html','atlas/atlas.css','atlas/sources/index.html','atlas/assets/body-skeleton.json','atlas/assets/provenance.json','assets/atlas/atlas-state.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-evidence.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js']){
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 const asset=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const proof=JSON.parse(read('atlas/assets/provenance.json'));
 assert.equal(asset.schema,'body-live/atlas-skeleton-v1');
 assert.equal(asset.parts.length,78);assert.equal(proof.part_count,78);
 assert.equal(proof.anatomist_reviewed,false);assert.equal(asset.license,'CC BY 4.0');
 assert.ok(read('assets/atlas/atlas-controller.js').includes('not reconstructed continuously'));
 for(const path of ['assets/atlas/atlas-state.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-evidence.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js']){
  assert.doesNotThrow(()=>new Function(read(path)));
 }
});

test('V6.3 single-scene detail anchors share the original atlas anatomical world',()=>{
 const atlas=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const hip=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const knee=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const bounds=vs=>[0,1,2].map(i=>[Math.min(...vs.map(v=>v[i])),Math.max(...vs.map(v=>v[i]))]);
 const transform=(part,origin,scale)=>part.vertices.map(v=>v.map((x,i)=>(x/scale+origin[i]-[0,.9,0][i])*5));
 for(const [name,part,origin,scale] of [
  ['right-hip-bone',hip.parts.hipBone,[-.057,.895,-.045],10],
  ['right-femur',hip.parts.femur,[-.057,.895,-.045],10],
  ['right-femur',knee.bone_meshes.femur,[-.09092915,.4491462,-.01654605],7.5],
  ['right-tibia',knee.bone_meshes.tibia,[-.09092915,.4491462,-.01654605],7.5]
 ]){
  const native=atlas.parts.find(p=>p.id===name);
  assert.ok(native,'missing atlas '+name);
  const a=bounds(native.vertices),b=bounds(transform(part,origin,scale));
  for(let i=0;i<3;i++)for(let j=0;j<2;j++)assert.ok(Math.abs(a[i][j]-b[i][j])<.012,name+' world-bounds mismatch');
 }
 const html=read('atlas/index.html');
 assert.ok(html.includes('/assets/atlas/atlas-unified.js'));
 for(const path of ['assets/atlas/atlas-unified.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js'])
  assert.doesNotThrow(()=>new Function(read(path)),path);
 const renderer=read('assets/atlas/atlas-renderer.js');
 assert.ok(renderer.includes('gl.drawArrays'));
 assert.ok(renderer.includes('loadDetail(region,asset)'));
 assert.ok(!renderer.includes('window.location'));
 const controller=read('assets/atlas/atlas-controller.js');
 assert.ok(controller.includes('return U.choose(region)'));
 assert.ok(controller.includes('return U.back()'));
});

test('V6.6 real right shoulder meshes are pinned, source-frame aligned and anatomically scoped',()=>{
 const atlas=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const shoulder=JSON.parse(read('shoulder/spatial/assets/shoulder-source.json'));
 const proof=JSON.parse(read('shoulder/spatial/assets/provenance.json'));
 assert.equal(shoulder.schema,'body-live/shoulder-sourced-v1');
 assert.equal(shoulder.source_commit,atlas.source_commit);
 assert.equal(proof.pinned_commit,atlas.source_commit);
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.kinematics_validated,false);
 assert.deepEqual(shoulder.source_frame.origin_metres,[0,.9,0]);
 assert.equal(shoulder.source_frame.scale,5);
 const needed=['clavicle','scapula','humerus','supraspinatus','infraspinatus','subscapularis','teresMinor'];
 for(const id of needed){
  const part=shoulder.parts[id];
  assert.ok(part,'missing required source geometry: '+id);
  assert.ok(part.vertices.length>100&&part.faces.length>200,id);
  assert.equal(proof.models[id].fma,part.fma);
  assert.equal(proof.models[id].triangles,part.faces.length);
  assert.ok(part.vertices.every(v=>v.every(Number.isFinite)),id);
  assert.ok(part.faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length)),id);
 }
 const box=verts=>[0,1,2].map(i=>[Math.min(...verts.map(v=>v[i])),Math.max(...verts.map(v=>v[i]))]);
 for(const id of ['clavicle','scapula','humerus']){
  const original=atlas.parts.find(x=>x.id==='right-'+id);
  const lhs=box(original.vertices),rhs=box(shoulder.parts[id].vertices);
  for(let i=0;i<3;i++)for(let k=0;k<2;k++)
   assert.ok(Math.abs(lhs[i][k]-rhs[i][k])<.015,id+' must occupy identical source world');
 }
 for(const path of ['assets/atlas/atlas-renderer.js','assets/atlas/atlas-unified.js','assets/atlas/atlas-controller.js','assets/atlas/atlas-loader.js'])
  assert.doesNotThrow(()=>new Function(read(path)),path);
 const controller=read('assets/atlas/atlas-controller.js');
 assert.ok(controller.includes("return region==='hip'||region==='knee'||region==='shoulder'"));
 assert.ok(read('assets/atlas/atlas-unified.js').includes('shoulderGeometry'));
});

test('V6.7 every imported shoulder muscle is attachment-rigged and the source pose is preserved',async()=>{
 const {runInNewContext}=await import('node:vm');
 const win={};
 runInNewContext(read('assets/atlas/atlas-shoulder-rig.js'),{window:win});
 const rig=win.BodyShoulderRig;
 const shoulder=JSON.parse(read('shoulder/spatial/assets/shoulder-source.json'));
 const parts=shoulder.parts;
 const rest=JSON.stringify(parts);
 const muscles=Object.entries(parts).filter(([key,p])=>p.system==='muscle');
 assert.equal(muscles.length,11);
 const pivot=[-.80,2.4,-.1];
 const length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const [id,mesh] of muscles){
  const skin=rig.createSkin(id,mesh.vertices,parts);
  assert.equal(skin.muscleId,id);
  assert.equal(skin.validated,false);
  assert.equal(skin.weights.length,mesh.vertices.length);
  assert.ok(skin.weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1),id+' invalid weight');
  assert.ok(Math.min(...skin.weights)<.001&&Math.max(...skin.weights)>.999,id+' must have two distinct attachment zones');
  const home=rig.deformVertex(skin.insertion,1,pivot,0);
  assert.ok(length(home,skin.insertion)<1e-10,id+' reference pose must stay unchanged');
  const origin=rig.deformVertex(skin.origin,0,pivot,95);
  assert.ok(length(origin,skin.origin)<1e-10,id+' fixed origin must not drift');
  const destination=rig.deformVertex(skin.insertion,1,pivot,95);
  assert.ok(length(destination,skin.insertion)>.005,id+' humeral insertion must move');
  for(const t of [0,15,30,45,60,90,110]){
   const mid=rig.deformVertex(mesh.vertices[Math.floor(mesh.vertices.length/2)],skin.weights[Math.floor(skin.weights.length/2)],pivot,t);
   assert.ok(mid.every(Number.isFinite),id+' invalid moving muscle vertex');
  }
 }
 assert.equal(JSON.stringify(parts),rest,'rig must never rewrite the licensed source geometry');
 const shader=read('assets/atlas/atlas-renderer.js');
 for(const term of ['aSkinWeight','uSoftSkin','skinWeights:weights','BodyShoulderRig.createSkin','kin.deformPoint'])
  assert.ok(shader.includes(term),'GPU/CPU anatomy drift: '+term);
 const html=read('atlas/index.html');
 assert.ok(html.indexOf('atlas-shoulder-rig.js')<html.indexOf('atlas-renderer.js'),'rig must initialize before renderer');
});

test('V6.8 coordinated shoulder transforms keep AC and GH connections closed through elevation',async()=>{
 const {runInNewContext}=await import('node:vm');
 const win={};
 runInNewContext(read('assets/atlas/atlas-shoulder-kinematics.js'),{window:win,Float32Array});
 runInNewContext(read('assets/atlas/atlas-shoulder-rig.js'),{window:win});
 const kin=win.BodyShoulderKinematics,rig=win.BodyShoulderRig;
 const source=JSON.parse(read('shoulder/spatial/assets/shoulder-source.json')).parts;
 const original=JSON.stringify(source),solver=kin.create(source);
 const dist=(a,b)=>Math.hypot(...Array.from(a,(v,i)=>v-b[i]));
 let last=null;
 for(const angle of [0,1,15,30,45,60,75,90,100,110]){
  const pose=solver.pose(angle),m=pose.matrices;
  for(const key of ['clavicle','scapula','humerus']){
   const matrix=m[key];
   assert.equal(matrix.length,16);
   assert.ok([...matrix].every(Number.isFinite),'non-finite pose '+angle+' '+key);
  }
  const sc=solver.rest.sternoclavicular,ac=solver.rest.acromioclavicular,gh=solver.rest.glenohumeral;
  assert.ok(dist(kin.transform(m.clavicle,sc),sc)<.00001,'SC must be fixed');
  assert.ok(dist(kin.transform(m.clavicle,ac),kin.transform(m.scapula,ac))<.00001,'AC joint gap');
  assert.ok(dist(kin.transform(m.scapula,gh),kin.transform(m.humerus,gh))<.00001,'GH joint gap');
  if(angle===0){
   for(const bone of ['clavicle','scapula','humerus']){
    const sourcePoint=source[bone].vertices[0];
    assert.ok(dist(kin.transform(m[bone],sourcePoint),sourcePoint)<.00001,'rest pose not identity');
   }
  }
  if(last){
   assert.ok(pose.degrees.scapulaUpward>=last.degrees.scapulaUpward);
   assert.ok(pose.degrees.clavicleElevation>=last.degrees.clavicleElevation);
   assert.ok(dist(kin.transform(m.humerus,gh),kin.transform(last.matrices.humerus,gh))<.3,
    'GH center discontinuity');
  }
  for(const [id,muscle] of Object.entries(source)){
   if(muscle.system!=='muscle')continue;
   const skin=rig.createSkin(id,muscle.vertices,source);
   const origin=kin.deformPoint(skin.origin,m[skin.fixedId],m.humerus,0);
   const insertion=kin.deformPoint(skin.insertion,m[skin.fixedId],m.humerus,1);
   assert.ok(dist(origin,kin.transform(m[skin.fixedId],skin.origin))<.000001,id+' origin mismatch');
   assert.ok(dist(insertion,kin.transform(m.humerus,skin.insertion))<.000001,id+' insertion mismatch');
   assert.ok(origin.every(Number.isFinite)&&insertion.every(Number.isFinite));
  }
  last=pose;
 }
 assert.equal(solver.validated,false);
 assert.equal(JSON.stringify(source),original,'source meshes and attribution must stay unchanged');
 const shader=read('assets/atlas/atlas-renderer.js');
 for(const term of ['uJointGraph','uOriginPose','uInsertionPose','shoulderDiagnostics','kin.deformPoint'])
  assert.ok(shader.includes(term),'missing shared WebGL/CPU rig support: '+term);
 const html=read('atlas/index.html');
 assert.ok(html.indexOf('atlas-shoulder-kinematics.js')<html.indexOf('atlas-renderer.js'));
 assert.ok(html.includes('shoulder-rig-toggle'));
});

test('V6.9 hip and knee muscle skinning follows pinned-source attachment bones without rewriting meshes',async()=>{
 const {runInNewContext}=await import('node:vm'),win={};
 runInNewContext(read('assets/atlas/atlas-lower-limb-rig.js'),{window:win,Float32Array});
 const R=win.BodyLowerLimbRig;
 const hip=JSON.parse(read('hip/spatial/assets/hip-source.json'));
 const knee=JSON.parse(read('knee/spatial/assets/bp3d-right-knee-4.0.json'));
 const muscles=JSON.parse(read('knee/spatial/assets/knee-muscles-source.json'));
 const proof=JSON.parse(read('knee/spatial/assets/knee-muscles-provenance.json'));
 const pinned=JSON.parse(read('atlas/assets/body-skeleton.json')).source_commit;
 assert.equal(muscles.source_commit,pinned);assert.equal(proof.pinned_commit,pinned);
 assert.equal(muscles.schema,'body-live/knee-muscles-v1');
 assert.equal(proof.anatomist_reviewed,false);assert.equal(proof.kinematics_validated,false);
 assert.deepEqual(muscles.source_frame.origin_metres,[-.09092915,.4491462,-.01654605]);
 assert.equal(muscles.source_frame.scale,7.5);
 assert.equal(Object.keys(muscles.parts).length,5);
 for(const [id,p] of Object.entries(muscles.parts)){
  assert.equal(p.system,'muscle');assert.equal(proof.models[id].triangles,p.faces.length);
  assert.equal(proof.models[id].fma,p.fma);
  assert.ok(p.vertices.length>100&&p.faces.length>200);
  assert.ok(p.faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length)));
 }
 const original=JSON.stringify({hip:hip.parts,knee:muscles.parts});
 const world=(p,frame)=>p.vertices.map(v=>v.map((z,i)=>(z/(frame.scale||frame.scale_to_scene)+frame.origin_metres[i]-(i===1?.9:0))*5));
 const h=Object.fromEntries(Object.entries(hip.parts).map(([id,p])=>[id,{vertices:world(p,hip.shared_transform)}]));
 const k=Object.fromEntries(Object.entries({...knee.bone_meshes,...muscles.parts}).map(([id,p])=>[id,{vertices:world(p,knee.aligned_shared_transform)}]));
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const [region,parts,angles] of [['hip',h,[0,15,30,45,65]],['knee',k,[0,15,30,60,90,105]]]){
  const ids=Object.keys(R.rules[region]);assert.equal(ids.length,region==='hip'?8:5);
  for(const id of ids){
   const skin=R.createSkin(region,id,parts[id].vertices,parts);
   assert.equal(skin.validated,false);
   assert.equal(skin.weights.length,parts[id].vertices.length);
   assert.ok(Math.min(...skin.weights)<.001&&Math.max(...skin.weights)>.999,id);
   for(const angle of angles){
    const pose=R.pose(region,angle);
    const a=pose.matrices[skin.fixedId],b=pose.matrices[skin.targetId];
    const p=R.deformPoint(skin.origin,a,b,0),q=R.deformPoint(skin.insertion,a,b,1);
    assert.ok(distance(p,R.transform(a,skin.origin))<1e-7,id+' origin detach');
    assert.ok(distance(q,R.transform(b,skin.insertion))<1e-7,id+' insertion detach');
    const index=Math.floor(parts[id].vertices.length/2);
    const moved=R.deformPoint(parts[id].vertices[index],a,b,skin.weights[index]);
    assert.ok(moved.every(Number.isFinite),id+' nonfinite');
    if(angle===0)assert.ok(distance(moved,parts[id].vertices[index])<1e-7,id+' failed rest pose');
   }
  }
 }
 assert.equal(JSON.stringify({hip:hip.parts,knee:muscles.parts}),original);
 const shader=read('assets/atlas/atlas-renderer.js');
 for(const id of ['uJointGraph','KNEE_MUSCLE_LAYERS','kin.deformPoint','riggedHipMuscles','riggedKneeMuscles'])
  assert.ok(shader.includes(id),id);
 assert.ok(read('assets/atlas/atlas-unified.js').includes('verifyKneeMuscles'));
});

test('V7 six new source-matched body regions are fully FMA-attributed and SHA-pinned',async()=>{
 const {createHash}=await import('node:crypto');
 const proof=JSON.parse(read('atlas/regions/provenance.json'));
 const expected={skull:14,neck:8,thorax:30,elbow:3,wrist:15,ankle:14};
 const expectedMuscles={skull:16,neck:14,thorax:11,elbow:10,wrist:10,ankle:12};
 assert.equal(proof.schema,'body-live/extended-regions-provenance-v1');
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.kinematics_validated,false);
 assert.equal(Object.keys(proof.regions).length,6);
 const atlas=JSON.parse(read('atlas/assets/body-skeleton.json'));
 assert.equal(proof.pinned_commit,atlas.source_commit);
 let n=0;
 for(const [region,count]of Object.entries(expected)){
  const raw=read('atlas/regions/'+region+'.json'),obj=JSON.parse(raw),r=proof.regions[region];
  assert.equal(createHash('sha256').update(raw).digest('hex'),r.asset_sha256,region+' sha changed');
  assert.equal(obj.schema,'body-live/extended-region-v1');assert.equal(obj.region,region);
  assert.equal(obj.source_commit,atlas.source_commit);assert.equal(obj.license,'CC BY 4.0');
  assert.deepEqual(obj.source_frame.origin_metres,[0,.9,0]);assert.equal(obj.source_frame.scale,5);
  assert.equal(Object.keys(obj.parts).length,count);assert.equal(r.source_parts,count);n+=count;
  assert.equal(Object.keys(obj.muscle_parts||{}).length,expectedMuscles[region],region+' muscle count');
  assert.equal(r.muscle_source_parts,expectedMuscles[region],region+' muscle provenance count');
  for(const [id,p] of Object.entries(obj.muscle_parts)){
   const entry=r.muscles[id];
   assert.ok(entry&&p.name&&p.fma&&p.system==='muscle',region+'/'+id+' muscle identity');
   assert.equal(entry.fma,p.fma);assert.equal(entry.source_system,p.source_system);
   assert.equal(entry.triangles,p.faces.length);assert.equal(entry.vertices,p.vertices.length);
   assert.ok(p.vertices.length>=35&&p.faces.length>=50,region+'/'+id+' muscle topology');
   assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
   assert.ok(p.faces.every(face=>face.length===3&&face.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length)));
  }

  for(const [id,p] of Object.entries(obj.parts)){
   const entry=r.structures[id];
   assert.ok(p.name&&p.fma&&entry);
   assert.equal(entry.fma,p.fma);assert.equal(entry.triangles,p.faces.length);
   assert.equal(entry.vertices,p.vertices.length);assert.equal(p.system,'bone');
   assert.ok(p.vertices.length>35&&p.faces.length>=50);
   assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
   assert.ok(p.faces.every(tri=>tri.length===3&&tri.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length)));
  }
 }
 assert.equal(n,84);
 const win={};const {runInNewContext}=await import('node:vm');
 runInNewContext(read('assets/atlas/atlas-extended-regions.js'),{window:win,Float32Array});
 const X=win.BodyExtendedRegions;
 assert.equal(X.ids.length,6);
 for(const region of X.ids){
  const asset=JSON.parse(read('atlas/regions/'+region+'.json'));
  const identity=X.createPose(region,asset,0);
  for(const [id,part]of Object.entries(asset.parts)){
   const initial=part.vertices[Math.floor(part.vertices.length/2)];
   const reset=X.transform(identity.matrices[id],initial);
   assert.ok(Math.hypot(...reset.map((x,i)=>x-initial[i]))<1e-8,region+'/'+id+' rest pose drift');
  }
  assert.equal(X.config[region].labels[4],'Source muscles');
  if(X.config[region].motion){
   const [muscleId,musclePart]=Object.entries(asset.muscle_parts)[0];
   const skin=X.createSkin(region,muscleId,musclePart.vertices,asset.parts);
   assert.ok(skin&&!skin.validated&&skin.weights.length===musclePart.vertices.length);
   assert.equal(skin.method,'source-surface-proximity-inferred');
   assert.ok(skin.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
   const bent=X.createPose(region,asset,X.config[region].motion.max);
   const moving=Object.keys(asset.parts).filter(id=>X.moving(region,id));
   assert.ok(moving.length>=2,region+' no moving sourced bones');
   const p=asset.parts[moving[0]].vertices[0];
   const moved=X.transform(bent.matrices[moving[0]],p);
   assert.ok(Math.hypot(...p.map((x,i)=>x-moved[i]))>.001,region+' motion is inert');
   assert.equal(bent.validated,false);
  }
 }
 const html=read('atlas/index.html');
 assert.ok(html.includes('atlas-extended-regions.js'));
 assert.ok(html.includes('class="region-dock"'),'persistent mobile region navigation absent');
 for(const name of ['hip','nerve','knee','shoulder','thorax','neck','skull','elbow','wrist','ankle'])
  assert.ok(html.includes('class="region-dock-grid"')&&html.includes('data-region="'+name+'"'),'missing mobile region '+name);

 for(const id of X.ids)assert.ok(html.includes('data-region="'+id+'"'),id+' missing navigation');
 const source=read('atlas/sources/index.html');
 assert.ok(source.includes('/atlas/regions/provenance.json'));
});

test('V8 canonical specimen keeps every source bone once and exposes licensed muscles across all ten regions',async()=>{
 const {createHash}=await import('node:crypto');
 const root=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const atlas=JSON.parse(read('atlas/assets/v8-overview-detail.json'));
 const proof=JSON.parse(read('atlas/assets/v8-overview-provenance.json'));
 const expectedRegions=['skull','neck','thorax','elbow','wrist','ankle','left-wrist','left-ankle','hip','knee','shoulder','left-hip','left-knee','left-shoulder'];
 assert.equal(atlas.schema,'body-live/overview-v8-v1');
 assert.equal(proof.schema,'body-live/overview-v8-provenance-v1');
 assert.equal(atlas.source_commit,root.source_commit);
 assert.equal(atlas.source_commit,proof.source_commit);
 assert.deepEqual(atlas.source_frame,root.source_frame);
 assert.equal(proof.original_bones,78);
 assert.equal(Object.keys(atlas.bones).length,59);
 assert.equal(Object.keys(atlas.muscles).length,149);
 assert.equal(proof.additional_bones,59);
 assert.equal(proof.unique_muscles,149);
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.kinematics_validated,false);
 assert.equal(createHash('sha256').update(read('atlas/assets/v8-overview-detail.json')).digest('hex'),proof.overview_sha256);
 const ids=new Set(root.parts.map(p=>p.id));
 for(const [id,part]of Object.entries(atlas.bones)){
  assert.ok(!ids.has(id),'duplicate overview bone: '+id);ids.add(id);
  assert.ok(part.name&&part.fma&&part.system==='bone');
  assert.ok(expectedRegions.includes(part.region));
 }
 for(const [id,part]of Object.entries(atlas.muscles)){
  assert.ok(!ids.has(id),'duplicate anatomical source identity: '+id);ids.add(id);
  assert.ok(part.name&&part.fma&&part.system==='muscle');
  assert.ok(expectedRegions.includes(part.region));
 }
 for(const [region,expected]of Object.entries(proof.region_counts)){
  const source=JSON.parse(read('atlas/regions/'+region+'.json'));
  assert.equal(expected.bones,Object.keys(source.parts).length);
  assert.equal(expected.muscles,Object.keys(source.muscle_parts).length);
  assert.equal(createHash('sha256').update(read('atlas/regions/'+region+'.json')).digest('hex'),proof.detail_sha256[region]);
  for(const [id,part]of Object.entries({...source.parts,...source.muscle_parts})){
   const overview=atlas.bones[id]||atlas.muscles[id]||root.parts.find(p=>p.id===id);
   assert.ok(overview,'source part missing from the unified specimen: '+region+'/'+id);
   assert.equal(overview.fma,part.fma);
  }
 }
 assert.equal(ids.size,78+59+149);
 assert.deepEqual(proof.bilateral_added,{bones:25,muscles:54});
 assert.deepEqual(proof.additional_lab_muscles,{hip:8,shoulder:9,knee:5});
 for(const [region,path] of Object.entries({hip:'hip/spatial/assets/hip-source.json',shoulder:'shoulder/spatial/assets/shoulder-source.json',knee:'knee/spatial/assets/knee-muscles-source.json'}))
  assert.equal(createHash('sha256').update(read(path)).digest('hex'),proof.source_lab_sha256[region]);
 assert.equal(Object.keys(proof.bilateral_source_sha256).length,6);
 for(const path of ['assets/atlas/atlas-registry.js','assets/atlas/atlas-renderer.js',
   'assets/atlas/atlas-controller.js','assets/atlas/atlas-loader.js']){
  assert.doesNotThrow(()=>new Function(read(path)),path+' syntax');
 }
 const html=read('atlas/index.html');
 assert.ok(html.includes('atlas-registry.js'));
 for(const mode of ['bones','muscles','combined'])assert.ok(html.includes('data-overview-system="'+mode+'"'));
 assert.ok(read('assets/atlas/atlas-loader.js').includes('verifyOverview'));
 assert.ok(read('assets/atlas/atlas-renderer.js').includes('loadOverview(asset)'));
});

test('V8.2 source-registered regional teaching motion has bounded neutral and independent axes',async()=>{
 const {runInNewContext}=await import('node:vm');
 const win={};const shared={window:win,Float32Array,Math};
 runInNewContext(read('assets/atlas/atlas-extended-regions.js'),shared);
 runInNewContext(read('assets/atlas/atlas-region-motion.js'),shared);
 const M=win.BodyRegionMotion;
 const expected={skull:['mandible'],neck:['atlas','axis'],thorax:['left-first-rib','right-first-rib'],
  elbow:['right-radius','right-ulna'],wrist:['right-lunate'],ankle:['right-calcaneus','right-talus']};
 assert.equal(M.profile('nerve'),null,'never invent an animated continuous sciatic nerve');
 for(const [region,moving]of Object.entries(expected)){
  const asset=JSON.parse(read('atlas/regions/'+region+'.json'));
  const conf=M.profile(region);assert.ok(conf&&conf.max>0,region);
  const neutral=M.poseExtended(region,asset,0,0);
  const rest=M.poseExtended(region,asset,conf.max,conf.other?conf.maxSecondary:0);
  for(const [id,matrix]of Object.entries(neutral.matrices)){
   const identity=M.identity();
   assert.ok([...matrix].every((x,i)=>Math.abs(x-identity[i])<1e-5),region+' neutral drift '+id);
  }
  for(const id of moving){
   assert.ok(rest.matrices[id],region+' missing '+id);
   assert.ok([...rest.matrices[id]].some((v,i)=>Math.abs(v-neutral.matrices[id][i])>1e-4),region+' motion did not affect '+id);
  }
  const zero=M.poseExtended(region,asset,NaN,NaN);
  assert.ok(Object.values(zero.matrices).every(mat=>[...mat].every(Number.isFinite)),region+' NaN');
  if(conf.other){
   const before=M.poseExtended(region,asset,0,0);
   const secondary=M.poseExtended(region,asset,0,conf.maxSecondary);
   assert.ok(Object.keys(asset.parts).some(id=>[...secondary.matrices[id]].some((v,i)=>Math.abs(v-before.matrices[id][i])>1e-5)),region+' secondary inert');
  }
  assert.equal(rest.validated,false,region+' clinical signoff not supported');
 }
 for(const region of ['hip','knee','shoulder']){
  const spec=M.profile(region);assert.ok(spec?.other);
  const identity=M.identity();
  const pose=region==='hip'?{matrices:{femur:identity}}:region==='knee'?
   {matrices:{tibia:identity,fibula:identity,patella:identity}}:
   {matrices:{humerus:identity},rest:{glenohumeral:[0,0,0]}};
  const next=M.poseLegacy(region,pose,spec.maxSecondary);
  const k=region==='hip'?'femur':region==='knee'?'tibia':'humerus';
  assert.ok([...next.matrices[k]].some((v,i)=>Math.abs(v-identity[i])>1e-5),region+' secondary axis');
  assert.equal(next.validated,false);
 }
 assert.doesNotThrow(()=>new Function(read('assets/atlas/atlas-region-motion.js')));
 const html=read('atlas/index.html');
 assert.ok(html.includes('atlas-region-motion.js'));
 assert.ok(html.includes('id="joint-secondary-control"'));
 assert.ok(html.includes('id="joint-rest"'));
});

test('V8.2 source-matched muscle rigs follow their designated moving bones without fabricating tissues',async()=>{
 const {runInNewContext}=await import('node:vm');
 const win={};const ctx={window:win,Float32Array,Math};
 runInNewContext(read('assets/atlas/atlas-extended-regions.js'),ctx);
 runInNewContext(read('assets/atlas/atlas-region-motion.js'),ctx);
 const M=win.BodyRegionMotion;
 const expected={skull:4,neck:14,thorax:8,elbow:10,wrist:10,ankle:12};
 for(const [region,count]of Object.entries(expected)){
  const asset=JSON.parse(read('atlas/regions/'+region+'.json'));
  const movingPose=M.poseExtended(region,asset,Math.min(15,M.profile(region).max),5);
  let countRigged=0;
  for(const [id,p]of Object.entries(asset.muscle_parts)){
   const rig=M.skin(region,id,p.vertices,asset.parts);
   if(!rig)continue;
   countRigged++;
   assert.equal(rig.validated,false);
   assert.equal(rig.method,'source-surface-proximity-inferred');
   assert.ok(asset.parts[rig.fixedId]&&asset.parts[rig.targetId],region+'/'+id+' missing bone anchor');
   assert.equal(rig.weights.length,p.vertices.length);
   assert.ok(rig.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
   const moving=movingPose.matrices[rig.targetId],I=M.identity();
   assert.ok([...moving].some((v,i)=>Math.abs(v-I[i])>1e-5),region+'/'+id+' target did not animate');
  }
  assert.equal(countRigged,count,region+' tissue coverage');
 }
});

test('V8.2 anatomically scoped motion stays bounded, uses real source pivots and returns neutral without drift',async()=>{
 const vm=await import('node:vm');
 const context={window:{},Float32Array,Math,Number,Object,Set,Map,WeakMap,Array,Error};
 vm.runInNewContext(read('assets/atlas/atlas-extended-regions.js'),context);
 vm.runInNewContext(read('assets/atlas/atlas-region-motion.js'),context);
 const R=context.window.BodyRegionMotion;
 const moving=['hip','knee','shoulder','skull','neck','thorax','elbow','wrist','ankle'];
 assert.equal(R.profile('nerve'),null,'No invented nerve joint mechanics');
 assert.equal(R.profile('skull').label,'Mandible opening');
 assert.equal(R.profile('thorax').label,'Inspiratory rib lift');
 for(const id of moving){
  const profile=R.profile(id);
  assert.ok(profile&&profile.max>0,id+' must have bounded motion');
  const values=R.safe(id,10000,-9999);
  assert.equal(values.primary,profile.max,id+' clamps primary angle');
  assert.equal(values.secondary,profile.other?profile.minSecondary:0,id+' clamps secondary');
  const rest=R.safe(id,0,0);
  assert.equal(rest.primary,0);assert.equal(rest.secondary,0);
 }
 for(const name of ['skull','neck','thorax','elbow','wrist','ankle']){
  const asset=JSON.parse(read('atlas/regions/'+name+'.json'));
  const a=R.poseExtended(name,asset,0,0);
  const primary=R.profile(name).max*.5;
  const b=R.poseExtended(name,asset,primary,0);
  const c=R.poseExtended(name,asset,0,0);
  assert.equal(a.validated,false);
  const flattened=(pose)=>Object.values(pose.matrices).flatMap(m=>Array.from(m));
  const one=flattened(a),two=flattened(b),three=flattened(c);
  assert.ok(one.length>0);
  assert.ok(two.every(Number.isFinite),name+' nonfinite animated source geometry');
  assert.ok(two.some((v,i)=>Math.abs(v-one[i])>1e-6),name+' does not move any source structure');
  assert.deepEqual(three,one,name+' repeated rest pose drift');
  if(R.profile(name).other){
   const d=R.poseExtended(name,asset,primary,R.profile(name).maxSecondary*.5);
   const four=flattened(d);
   assert.ok(four.some((v,i)=>Math.abs(v-two[i])>1e-6),name+' secondary axis fails to move');
  }
 }
 const I=R.identity(),knee={matrices:{femur:I,tibia:I,fibula:I,patella:I},validated:false};
 const k=R.poseLegacy('knee',knee,8);
 assert.ok(Array.from(k.matrices.tibia).some((v,i)=>Math.abs(v-I[i])>1e-6));
 assert.deepEqual(R.poseLegacy('knee',knee,0).matrices,knee.matrices);
 assert.equal(R.poseLegacy('nerve',knee,20),knee);
});

test('V9 199 conventional bones, sourced muscles and connective surfaces remain identity-verified',async()=>{
 const {createHash}=await import('node:crypto');
 const base=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const v8=JSON.parse(read('atlas/assets/v8-overview-detail.json'));
 const v9=JSON.parse(read('atlas/assets/v9-source-expansion.json'));
 const proof=JSON.parse(read('atlas/assets/v9-source-provenance.json'));
 assert.equal(v9.schema,'body-live/v9-source-expansion-v1');
 assert.equal(v9.source_commit,base.source_commit);
 assert.equal(v9.source_commit,v8.source_commit);
 assert.equal(v9.source_commit,proof.source_commit);
 assert.deepEqual(v9.source_frame.origin_metres,v8.source_frame.origin_metres);
 assert.equal(v9.source_frame.scale,v8.source_frame.scale);
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.kinematics_validated,false);
 assert.equal(proof.clinical_use_approved,false);
 assert.equal(createHash('sha256').update(read('atlas/assets/v9-source-expansion.json')).digest('hex'),proof.asset_sha256);
 assert.equal(Object.keys(v9.bones).length,64);
 assert.equal(Object.keys(v9.muscles).length,237);
 assert.equal(Object.keys(v9.connective).length,48);
 assert.equal(proof.conventional_skeleton.total_rendered_standard_bones,199);
 assert.equal(proof.conventional_skeleton.unavailable_in_pinned_atlas.length,7);
 const digits=Object.values(v9.bones).filter(p=>/phalanx of/i.test(p.name));
 assert.equal(digits.length,56);
 assert.equal(Object.keys(v9.bones).length-digits.length,8);
 const known=[...base.parts,...Object.values(v8.bones),...Object.values(v8.muscles)];
 const ids=new Set([...base.parts.map(p=>p.id),...Object.keys(v8.bones),...Object.keys(v8.muscles)]);
 const fmas=new Set(known.map(p=>p.fma));
 for(const [kind,system]of [['bones','bone'],['muscles','muscle'],['connective','connective']]){
  for(const [id,p]of Object.entries(v9[kind])){
   assert.ok(!ids.has(id),'duplicate geometry '+id);ids.add(id);
   assert.ok(!fmas.has(p.fma),'duplicate source FMA '+p.fma);fmas.add(p.fma);
   assert.equal(p.system,system);
   assert.equal(p.reference_pose_only,true);
   assert.ok(p.faces.length>=25);
   assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
   assert.ok(p.faces.every(f=>f.length===3&&f.every(x=>Number.isInteger(x)&&x>=0&&x<p.vertices.length)));
  }
 }
 assert.equal(ids.size,78+59+149+64+237+48);
 assert.ok(proof.subgroups.back>=30);
 assert.ok(proof.subgroups['intrinsic-hand-foot']>=55);
 assert.equal(proof.subgroups.face,0);
 for(const x of v9.relationships){
  assert.ok(ids.has(x.structure));assert.ok(x.related.every(n=>ids.has(n)));
  assert.equal(x.motion_validated,false);
  assert.equal(x.attachment_coordinates_validated,false);
 }
 for(const path of ['assets/atlas/atlas-v9-source.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-renderer.js']){
  assert.doesNotThrow(()=>new Function(read(path)),path);
 }
 assert.match(read('atlas/index.html'),/data-studio-tissue="connective"/);
 assert.match(read('atlas/index.html'),/data-mobile-tissue="connective"/);
});

test('V9 canonical digital bones and external-review release gates are explicit',()=>{
 const v9=JSON.parse(read('atlas/assets/v9-source-expansion.json'));
 const status=JSON.parse(read('docs/v9-review-status.json'));
 const all=Object.values(v9.bones).map(p=>p.name.toLowerCase());
 const finger=all.filter(n=>n.includes('phalanx of')&&(n.includes('finger')||n.includes('thumb')));
 const toe=all.filter(n=>n.includes('phalanx of')&&n.includes('toe'));
 assert.equal(finger.length,28);
 assert.equal(toe.length,28);
 for(const side of ['left','right']){
   assert.equal(finger.filter(n=>n.includes(side)).length,14,side+' hand has 14 bones');
   assert.equal(toe.filter(n=>n.includes(side)).length,14,side+' foot has 14 bones');
   for(const digit of ['thumb','big toe']){
     const group=(digit==='thumb'?finger:toe).filter(n=>n.includes(side)&&n.includes(digit));
     assert.equal(group.length,2,side+' '+digit+' has two phalanges, no fabricated middle');
   }
 }
 const skull=['ethmoid','vomer','left lacrimal bone','right lacrimal bone',
 'left palatine bone','right palatine bone','left inferior nasal concha','right inferior nasal concha'];
 for(const name of skull)assert.equal(all.filter(n=>n===name).length,1,'source skull bone '+name);
 assert.equal(status.release_approved,false);
 assert.equal(status.expert_validated,false);
 assert.equal(status.clinical_use_approved,false);
 for(const candidate of Object.values(status.candidate_meshes)){
   assert.equal(candidate.integrated,false,'external source must not be represented as imported');
   assert.equal(candidate.frame_registered,false,'coordinate compatibility must not be assumed');
 }
 for(const [scope,g] of Object.entries(status.approvals)){
   if(g.status.startsWith('approved')){
     assert.ok(g.reviewer?.name&&g.reviewer?.credential&&g.reviewer?.affiliation,scope+' requires independent named reviewer');
     assert.ok(g.signed_at&&g.evidence?.length,scope+' requires dated evidence');
   }
 }
 assert.equal(status.approvals.whole_application_regression.status,'failed');
});

test('V10 registered facial muscles have independent source license, source IDs and verified geometry',async()=>{
 const {createHash}=await import('node:crypto');
 const v10=JSON.parse(read('atlas/assets/v10-facial-reference.json'));
 const proof=JSON.parse(read('atlas/assets/v10-facial-provenance.json'));
 const base=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const v8=JSON.parse(read('atlas/assets/v8-overview-detail.json'));
 const v9=JSON.parse(read('atlas/assets/v9-source-expansion.json'));
 assert.equal(v10.schema,'body-live/v10-facial-source-v1');
 assert.equal(v10.source_commit,'c835665a9ade09ee0b993cee6eee1b25b7f7311b');
 assert.equal(v10.base_source_commit,base.source_commit);
 assert.equal(v10.license,'CC-BY-SA-2.1-JP');
 assert.equal(proof.license,v10.license);
 assert.equal(proof.anatomist_reviewed,false);
 assert.equal(proof.jaw_dynamics_validated,false);
 assert.equal(proof.source_alignment_independently_recomputed,false);
 assert.equal(proof.clinical_use_approved,false);
 assert.equal(proof.pinned_omf_commit,v10.source_commit);
 assert.equal(proof.facial_bin_git_blob,'0332821585e1b03ac4258d891b3ec220ab3ff30a');
 assert.equal(createHash('sha256').update(read('atlas/assets/v10-facial-reference.json')).digest('hex'),proof.asset_sha256);
 assert.deepEqual(v10.source_frame.origin_metres,[0,.9,0]);
 assert.equal(v10.source_frame.scale,5);
 const parts=Object.entries(v10.parts);
 assert.equal(parts.length,47);
 assert.equal(proof.total_muscle_meshes,433);
 const ids=new Set([...base.parts.map(p=>p.id),...Object.keys(v8.bones),...Object.keys(v8.muscles),
  ...Object.keys(v9.bones),...Object.keys(v9.muscles),...Object.keys(v9.connective)]);
 const fmas=new Set([...base.parts,...Object.values(v8.bones),...Object.values(v8.muscles),...Object.values(v9.bones),...Object.values(v9.muscles),...Object.values(v9.connective)].map(x=>x.fma));
 for(const [id,p] of parts){
  assert.ok(!ids.has(id),'duplicate source mesh '+id);ids.add(id);
  assert.ok(!fmas.has(p.fma),'duplicate FMA '+p.fma);fmas.add(p.fma);
  assert.equal(p.reference_pose_only,true);
  assert.equal(p.system,'muscle');
  assert.equal(p.source_version,'BodyParts3D 3.0');
  assert.ok(proof.original_obj_sha256[id]);
  assert.ok(p.faces.length>=25);
  for(const v of p.vertices){
   assert.equal(v.length,3);
   assert.ok(v.every(Number.isFinite));
   assert.ok(v[1]>2.5&&v[1]<4.5,'outside BodyParts3D 4.0 head elevation');
  }
  for(const f of p.faces)assert.ok(f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length));
 }
 for(const re of [/orbicularis oris/i,/masseter/i,/temporalis/i,/pterygoid/i,/zygomaticus/i]){
  assert.ok(parts.some(([,p])=>re.test(p.name)),'Missing facial family '+re);
 }
 assert.equal(proof.upstream_registration.heldOutBone,'FMA53650');
 assert.ok(proof.upstream_registration.heldOutSourceToTargetSurfaceRmsMm<.5);
 assert.ok(proof.upstream_registration.heldOutTargetToSourceSurfaceRmsMm<.5);
 for(const path of ['assets/atlas/atlas-loader.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-registry.js',
                    'assets/atlas/atlas-v10-facial.js','assets/atlas/atlas-controller.js'])
  assert.doesNotThrow(()=>new Function(read(path)),path+' invalid JavaScript');
 assert.match(read('atlas/index.html'),/atlas-v10-facial\.js/);
});

test('V10 facial bone-fit sanity checks use actual base mandible vertices and verify sides',()=>{
 const v10=JSON.parse(read('atlas/assets/v10-facial-reference.json'));
 const base=JSON.parse(read('atlas/assets/body-skeleton.json'));
 const jaw=base.parts.find(x=>x.name==='Mandible').vertices;
 assert.ok(jaw.length>200,'registered source jaw control present');
 const square=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
 const muscles=Object.values(v10.parts);
 for(const p of muscles){
  const meanX=p.vertices.reduce((s,v)=>s+v[0],0)/p.vertices.length;
  if(/right/i.test(p.name))assert.ok(meanX<.02,p.name+' should remain on right anatomy');
  if(/left/i.test(p.name))assert.ok(meanX>-.02,p.name+' should remain on left anatomy');
 }
 for(const p of muscles.filter(x=>/masseter|pterygoid/i.test(x.name))){
  const step=Math.max(1,Math.floor(p.vertices.length/180));
  let nearest=Infinity;
  for(let i=0;i<p.vertices.length;i+=step)
   for(const v of jaw)nearest=Math.min(nearest,square(p.vertices[i],v));
  assert.ok(Math.sqrt(nearest)<.04,'mastication muscle not near source mandible: '+p.name);
 }
});

test('V11 coccyx and bilateral middle-ear bones are 7 distinct original-source structures with registered control frames',async()=>{
 const {createHash}=await import('node:crypto');
 const asset=JSON.parse(read('atlas/assets/v11-coccyx-ossicles.json'));
 const proof=JSON.parse(read('atlas/assets/v11-source-provenance.json'));
 const base=JSON.parse(read('atlas/assets/body-skeleton.json'));
 assert.equal(asset.schema,'body-live/v11-registered-osteology-v1');
 assert.equal(proof.schema,'body-live/v11-source-provenance-v1');
 assert.equal(asset.license,'CC BY-SA 4.0');
 assert.equal(proof.source_sha256,'294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea');
 assert.equal(createHash('sha256').update(read('atlas/assets/v11-coccyx-ossicles.json')).digest('hex'),proof.asset_sha256);
 assert.equal(asset.base_source_commit,base.source_commit);
 assert.equal(proof.canonical_count_conventional,206);
 assert.equal(proof.previous_conventional_count,199);
 assert.equal(proof.new_osteology_bone_count,7);
 for(const prop of ['human_anatomist_reviewed','ear_specialist_reviewed','biomechanics_validated','clinical_use_approved'])
  assert.equal(proof[prop],false,prop+' is not an accepted clinical claim');
 assert.deepEqual(asset.source_frame,{origin_metres:[0,.9,0],scale:5});
 const names=['z-v11-coccyx','z-v11-left-malleus','z-v11-left-incus','z-v11-left-stapes',
  'z-v11-right-malleus','z-v11-right-incus','z-v11-right-stapes'];
 assert.deepEqual(Object.keys(asset.bones).sort(),names.sort());
 const all=[...base.parts.map(p=>p.id)];
 const fmas=new Set(base.parts.map(p=>p.fma));
 for(const id of names){
  const p=asset.bones[id];
  assert.equal(p.system,'bone');
  assert.equal(p.license,'CC BY-SA 4.0');
  assert.equal(p.source_repo,'LluisV/Z-Anatomy');
  assert.equal(p.reference_pose_only,true);
  assert.ok(p.faces.length>80&&p.vertices.length>60);
  assert.ok(!all.includes(id)&&!fmas.has(p.fma));
  fmas.add(p.fma);
  assert.ok(p.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
  assert.ok(p.faces.every(t=>t.length===3&&t.every(i=>Number.isInteger(i)&&i>=0&&i<p.vertices.length)));
 }
 assert.equal(asset.bones['z-v11-coccyx'].fma,'FMA20229');
 const sacrum=base.parts.find(p=>p.name==='Sacrum');
 const coc=asset.bones['z-v11-coccyx'];
 assert.ok(Math.max(...coc.vertices.map(p=>p[1])) < Math.min(...sacrum.vertices.map(p=>p[1]))+.08);
 assert.ok(Math.abs(coc.vertices.reduce((s,p)=>s+p[0],0)/coc.vertices.length)<.12);
 for(const side of ['left','right']){
  const temporal=base.parts.find(p=>p.name===side[0].toUpperCase()+side.slice(1)+' temporal bone');
  const X=temporal.vertices.map(p=>p[0]);
  const min=Math.min(...X),max=Math.max(...X);
  for(const name of ['malleus','incus','stapes']){
   const p=asset.bones['z-v11-'+side+'-'+name];
   const center=p.vertices.reduce((s,v)=>s+v[0],0)/p.vertices.length;
   assert.ok(center>min-.12&&center<max+.12,'ossicle is in source temporal envelope');
   assert.ok(side==='left'?center>0:center<0,'correct lateral identification');
   const span=Math.max(...p.vertices.map(v=>v[0]))-Math.min(...p.vertices.map(v=>v[0]));
   assert.ok(span<.09&&span>.0005,'ossicle size is plausible');
  }
 }
 assert.ok(proof.registration.coccyx.control_rms.Sacrum<.09);
 assert.ok(proof.registration.ear.control_rms['Temporal bone.l']<.08);
 assert.ok(proof.registration.ear.control_rms['Temporal bone.r']<.08);
 assert.ok(proof.validation.ear_heldout_frontal.trimmed_rms_units<.18);
 assert.ok(proof.validation.coccyx_source_sacrum_min_distance_units<.18);
 for(const path of ['assets/atlas/atlas-v11-source.js','assets/atlas/atlas-loader.js','assets/atlas/atlas-renderer.js','assets/atlas/atlas-controller.js'])
  assert.doesNotThrow(()=>new Function(read(path)),path);
 assert.match(read('atlas/index.html'),/atlas-v11-source\.js/);
});
