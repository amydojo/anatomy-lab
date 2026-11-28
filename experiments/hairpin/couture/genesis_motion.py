"""GENESIS evaluated-region motion, executed only on passed actual reopened endpoints."""
import bpy,sys,json,hashlib,math,collections
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);src=arg('source');p=arg('conditioned')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(src)==expected
report2=json.loads((p/'qualification.json').read_text());assert report2['endpointPass']
q=np.load(p/'conditioned-correspondence.npz')
for label in ('compact','target'):
    file=p/('GENESIS-'+label+'-chart-conditioned.blend');assert sha(file)==report2['reopened'][label]['nativeFileSha256']
    bpy.ops.wm.open_mainfile(filepath=str(file));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');assert np.array_equal(np.array([tuple(v.co) for v in o.data.vertices]),q[label]);assert np.array_equal(np.array([tuple(f.vertices) for f in o.data.polygons]),q['faces'])
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene
pa=q['compact'].tolist();pb=q['target'].tolist();uvs=q['chart'].tolist();faces=q['faces'].tolist()
diag=report2['topology'];use_eval=True
probe_diag={'chartConditioning':report2['moves']}
e0=report2['reopened']['compact']['forwardVertexMax'];e1=report2['reopened']['target']['forwardVertexMax'];en=e1
e0w=report2['reopened']['compact']['forwardWitnessMax'];e1w=report2['reopened']['target']['forwardWitnessMax'];nativew=e1w
# Keep native source immutable. Only research derivative scene objects are removed.
for o in list(s.objects):
    if o.type in ('MESH','CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for l in s.view_layers:l.material_override=None;l.cycles.use_denoising=False
d=bpy.data.meshes.new('GENESIS chart-conditioned ribbon');d.from_pydata(pa,[],faces);d.update()
obj=bpy.data.objects.new('Single persistent upper ribbon',d);s.collection.objects.link(obj)
uvlayer=d.uv_layers.new(name='PersistentMaterialChart')
for l in d.loops:uvlayer.data[l.index].uv=uvs[l.vertex_index]
for p in d.polygons:p.use_smooth=True
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
mode=args[args.index('--mode')+1]
clay=material('Neutral clay',(.4,.4,.4),0,.5);metal=material('Silver ribbon',(.62,.59,.53),.92,.23);petrol=material('Petrol longitudinal lane',(.005,.045,.1),.8,.25);orchid=material('Persistent orchid trace',(.8,.015,.25),.55,.24)
for m in ([clay] if mode=='clay' else [metal,petrol,orchid]):d.materials.append(m)
# Face assignment is invariant throughout; longitudinal material stripe
# is a research treatment, not native artwork/material equivalence.
for p in d.polygons:
    u,v=np.mean([uvs[i] for i in p.vertices],axis=0)
    p.material_index=0 if mode=='clay' else 2 if .70<v<.78 else 1 if v<.30 else 0
if mode=='metal':
    # Analytic UV marking avoids jagged per-triangle material boundaries.
    for p in d.polygons:p.material_index=0
    n=metal.node_tree.nodes;l=metal.node_tree.links;bs=n.get('Principled BSDF')
    tex=n.new('ShaderNodeUVMap');tex.uv_map='PersistentMaterialChart';sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['UV'],sep.inputs[0])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
    colors=[(0,(.005,.045,.10,1)),(.285,(.005,.045,.10,1)),(.295,(.62,.59,.53,1)),(.695,(.62,.59,.53,1)),(.705,(.8,.015,.25,1)),(.755,(.8,.015,.25,1)),(.765,(.62,.59,.53,1)),(1,(.62,.59,.53,1))]
    for i,(pos,col) in enumerate(colors):
        el=ramp.color_ramp.elements[0 if i==0 else 1] if i<2 else ramp.color_ramp.elements.new(pos)
        el.position=pos;el.color=col
    l.new(sep.outputs['Y'],ramp.inputs[0]);l.new(ramp.outputs['Color'],bs.inputs['Base Color'])
mat_ids=[p.material_index for p in d.polygons]
a=np.array(pa,dtype=np.float64);b=np.array(pb,dtype=np.float64);uvn=np.array(uvs);F=np.array(faces)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,l,h):return smooth((t-l)/(h-l))
def calc(t):
    # Common displacement field on shared vertices, never per-face motion.
    f=phase(t,.12,.91);u=uvn[:,0];v=uvn[:,1]
    g=np.clip((t-.10-.12*(1-u))/.70,0,1);g=g*g*(3-2*g)
    g+=.025*np.sin(np.pi*np.clip((t-.80)/.19,0,1))*np.exp(-3*np.clip((t-.80)/.19,0,1))
    p=(1-g[:,None])*a+g[:,None]*b
    # Broad coordinated sweep and a reversible cross-sectional twist.
    envelope=math.sin(math.pi*f)*np.sin(np.pi*u)
    p[:,0]+=2.2*envelope;p[:,2]+=1.5*envelope+(v-.5)*1.2*envelope
    if t==0:p=a.copy()
    if t==1:p=b.copy()
    return p
def normals(p):
    q=p[F];return np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0])
na=normals(a);nb=normals(b)
E=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]));edgeArray=np.array(list(E));boundary=np.array([e for e,n in E.items() if n==1]);uvRead=np.array([tuple(l.uv) for l in uvlayer.data]);prev=[None]
baseLen=np.linalg.norm(a[edgeArray[:,0]]-a[edgeArray[:,1]],axis=1)
baseArea=np.linalg.norm(na,axis=1)/2
assert np.all(baseLen>0) and np.all(baseArea>=1e-10)
def inspect(p,t):
    n=normals(p);areas=np.linalg.norm(n,axis=1)/2
    f=phase(t,.12,.91);ref=(1-f)*na+f*nb
    dots=np.sum(n*ref,axis=1)
    tree=BVHTree.FromPolygons(p.tolist(),faces,all_triangles=True)
    # Adjacent triangles legitimately touch. Non-adjacent BVH hits are
    # potential self-intersections, not exact solid collision classification.
    hits=[(i,j) for i,j in tree.overlap(tree) if i<j and not set(faces[i]).intersection(faces[j])]
    length=np.linalg.norm(p[edgeArray[:,0]]-p[edgeArray[:,1]],axis=1);ratio=length/baseLen;ar=areas/baseArea;bl=np.linalg.norm(p[boundary[:,0]]-p[boundary[:,1]],axis=1);flip=0 if prev[0] is None else int(np.sum(np.sum(n*prev[0],axis=1)<0));prev[0]=n.copy()
    return {'t':t,'temporalNormalReversals':flip,'edgeStretchP95':float(np.percentile(ratio,95)),'edgeStretchMax':float(ratio.max()),'areaRatioP95':float(np.percentile(ar,95)),'areaRatioMax':float(ar.max()),'boundaryMinEdge':float(bl.min()),'boundaryLength':float(bl.sum()),'materialUVReadbackStable':np.array_equal(uvRead,np.array([tuple(l.uv) for l in uvlayer.data])),'connectedComponents':diag['connectedComponents'],'unintendedBoundaryEdges':diag['unintendedBoundaryEdges'],'sharedEdgeSeparation':0.,'degenerateTriangles':int(np.sum(areas<1e-10)),'orientationOpposedToInterpolatedEndpointNormals':int(np.sum(dots<=0)),'nonAdjacentSurfaceOverlapCandidates':len(hits),'overlapExamplePairs':hits[:20],'surfaceArea':float(areas.sum()),'materialAssignmentStable':mat_ids==[p.material_index for p in d.polygons]}
s.world=bpy.data.worlds.new('Liquid studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for name,loc,power,size in [('Key',(20,-30,55),70000,50),('Strip',(-30,20,35),50000,40),('Rim',(15,35,-20),35000,35)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.22;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('Ribbon camera');cam=bpy.data.objects.new('Ribbon camera',camd);s.collection.objects.link(cam);s.camera=cam;camd.type='ORTHO';camd.clip_end=1000
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
report={'sourceSha256':expected,'baselineProvenanceSha256':report2['baselineProvenanceSha256'],'sourceRegion':'SERPENT_004 first prong, rows 0–120, facets 3–5, actual native unmodified surface','targetRegion':'TENSION_continuous_frame upper rail block 2, rows 21–98, lanes 1–7','targetEvaluatedRegionUsed':use_eval,'independentEndpointQualification':report2,'evaluatedProbe':probe_diag,'topology':diag,'vertices':len(uvs),'triangles':len(faces),'sourceVertexError':e0,'targetRegionVertexError':e1,'sourceWitnessError':e0w,'targetRegionWitnessError':e1w,'nativeEvaluatedVertexError':en,'nativeEvaluatedWitnessError':nativew,'crossComponentIntersections':'not applicable: isolated one surface only','fictionalScaleMmPerAuthoringUnit':10,'materialTreatment':'persistent chart stripe; native target livery not claimed','limitations':['Open regional boundary intentional; no closed solid, thickness or complete frame.','No topology opening event attempted: first qualify a single continuous strip.','No control fallback; a failed evaluated chart aborts with preserved diagnostics.','Self BVH nonadjacent overlaps are sampled candidates, not continuous exact collision proof.','No physical folding, conserved volume or wearable fit.'],'samples':[]}
# Native editable endpoints and sampled shape keys for independent inspection.
preflight='--preflight' in args;N=81
if not preflight:
    d.vertices.foreach_set('co',a.astype(np.float32).ravel());d.update()
    obj.shape_key_add(name='Basis')
    for frame in range(81):
        key=obj.shape_key_add(name=f'UNFURL-{frame:03d}');key.data.foreach_set('co',calc(frame/80).astype(np.float32).ravel())
        for f0,value in [(frame-1,0),(frame,1),(frame+1,0)]:
            if f0==frame and value==0:continue
            key.value=value;key.keyframe_insert(data_path='value',frame=f0+1)
        key.value=0
    s.frame_start=1;s.frame_end=81;s.render.fps=16;s.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'evaluated-ribbon.blend'))
    # Film uses direct sampled mesh, not an approximate key interpolation.
    obj.shape_key_clear()

if preflight:s.cycles.samples=8;s.render.resolution_x=320;s.render.resolution_y=180
for i in ([0,40,80] if preflight else range(N)):
    t=i/(N-1);p=calc(t);d.vertices.foreach_set('co',p.astype(np.float32).ravel());d.update();bpy.context.view_layer.update()
    stored=np.array([tuple(v.co) for v in d.vertices],dtype=np.float64)
    report['samples'].append(inspect(stored,t));(out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
    center=Vector(tuple((p.min(axis=0)+p.max(axis=0))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=max(12,float(np.max(p.max(axis=0)-p.min(axis=0)))*1.30)
    s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
actual=np.array([tuple(v.co) for v in d.vertices]);report['endpointMeshReadbackError']=float(np.max(np.abs(actual-b)));assert report['endpointMeshReadbackError']<2e-5
assert sha(src)==expected
report['sampledRegionalPass']=bool(use_eval and all(not x['degenerateTriangles'] and not x['orientationOpposedToInterpolatedEndpointNormals'] and not x['nonAdjacentSurfaceOverlapCandidates'] and not x['temporalNormalReversals'] and x['materialUVReadbackStable'] and x['materialAssignmentStable'] for x in report['samples']))
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('GENESIS',json.dumps({k:v for k,v in report.items() if k!='samples'}))
