"""UNFURL: exact evaluated indexed regional chart overlay. No independent patch transport.
Actual compact upper-prong strip and actual protected front upper-rail region.
Exact native control surface is fallback, never mislabeled evaluated parity.
Open regional boundaries are intentional. No full accessory or folding claim.
"""
import bpy,sys,math,json,hashlib,itertools,collections,bisect
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True)
src=arg('source');compact=arg('compact')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
assert sha(src)==expected
def arc(points):
    d=[0.]
    for a,b in zip(points,points[1:]):d.append(d[-1]+(a-b).length)
    return [x/d[-1] for x in d]
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return (a[0]-b[0],a[1]-b[1])
def orient(a,b,c):return cross(sub(b,a),sub(c,a))
def signed(poly):return sum(cross(a,b) for a,b in zip(poly,poly[1:]+poly[:1]))/2
def triangle(uv,xyz):
    if orient(*uv)<0:uv=[uv[0],uv[2],uv[1]];xyz=[xyz[0],xyz[2],xyz[1]]
    return {'uv':uv,'p':xyz}
def interp(q,p):
    a,b,c=q['uv'];d=orient(a,b,c);assert d>1e-14
    v=orient(a,p,c)/d;w=orient(a,b,p)/d
    return q['p'][0]*(1-v-w)+q['p'][1]*v+q['p'][2]*w
def chart(o,start,end,first,last,stride,offset=0):
    d=o.data;M=o.matrix_world
    ids={offset+i*stride+j:(i,j) for i in range(start,end+1) for j in range(first,last+1)}
    centers=[sum((M@d.vertices[offset+i*stride+j].co for j in range(first,last+1)),Vector())/(last-first+1) for i in range(start,end+1)]
    u=arc(centers);uv={i:(u[row-start],(col-first)/(last-first)) for i,(row,col) in ids.items()}
    d.calc_loop_triangles();rows=[];faces=set()
    for t in d.loop_triangles:
        if all(i in uv for i in t.vertices) and len(d.polygons[t.polygon_index].vertices)==4 and all(i in uv for i in d.polygons[t.polygon_index].vertices):
            faces.add(t.polygon_index);rows.append(triangle([uv[i] for i in t.vertices],[M@d.vertices[i].co for i in t.vertices]))
    assert len(faces)==(end-start)*(last-first),(o.name,len(faces))
    assert abs(sum(signed(q['uv']) for q in rows)-1)<1e-7
    return rows,uv,faces
bpy.ops.wm.open_mainfile(filepath=str(compact));bpy.context.view_layer.update()
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body')
assert len(body.data.vertices)==2888 and not body.modifiers
A,_,_=chart(body,0,120,3,6,8)
# Transform mm to illustrative authoring units, preserving compact geometry.
R=Matrix.Rotation(-math.pi/2,3,'Z')*.1
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene;bpy.context.view_layer.update()
frame=bpy.data.objects['TENSION_continuous_frame']
assert frame.get('assembly')=='front' and len(frame.data.vertices)>=3636
# Interior of one actual upper rail. Deliberately exclude nose bridge,
# outer sidewall and mating boundaries. No claim about complete frame.
Bcontrol,uv,faces=chart(frame,21,98,1,7,9,2*909)
def surface_tree(rows):
    vs=[v for q in rows for v in q['p']];return BVHTree.FromPolygons(vs,[(i,i+1,i+2) for i in range(0,len(vs),3)],all_triangles=True)
def evaluated_tree(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles();v=[e.matrix_world@x.co for x in me.vertices];f=[tuple(t.vertices) for t in me.loop_triangles];e.to_mesh_clear();return BVHTree.FromPolygons(v,f,all_triangles=True)
native_eval=evaluated_tree(frame)
# Probe exact evaluated top surface via UV chart and face tag propagated
# through copied native modifiers. Never edit protected source data.
copy=frame.copy();copy.data=frame.data.copy();s.collection.objects.link(copy)
d=copy.data;marker=bpy.data.materials.new('LIQUID METAL evaluation chart sentinel');d.materials.append(marker);mi=len(d.materials)-1
chartuv=d.uv_layers.new(name='LiquidChart')
for p in d.polygons:
    if p.index in faces:
        p.material_index=mi
        for l in p.loop_indices:chartuv.data[l].uv=uv[d.loops[l].vertex_index]
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();e=copy.evaluated_get(dg);me=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg);me.calc_loop_triangles()
sys.path.insert(0,str(Path(__file__).parent))
from unfurl_chart import chart_evaluated,overlay_noded
probe_diag={}
try:
    B=chart_evaluated(me,e.matrix_world,mi,probe_diag)
    (out/'evaluated-chart.json').write_text(json.dumps(probe_diag,indent=2))
    uvs,pa,pb,faces,diag=overlay_noded(A,B,interp)
    probe_diag['overlay']=diag
    (out/'evaluated-chart.json').write_text(json.dumps(probe_diag,indent=2))
    assert diag['pass'],diag
finally:
    (out/'evaluated-chart.json').write_text(json.dumps(probe_diag,indent=2))
    e.to_mesh_clear();bpy.data.objects.remove(copy,do_unlink=True)
use_eval=True
# The two actual regions remain tied to one index buffer through the film.
# Register compact root to target root for coherent unfolding at real chart scale.
rootA=sum((p for p,uv in zip(pa,uvs) if uv[0]>.999999),Vector())/sum(uv[0]>.999999 for uv in uvs)
rootB=sum((p for p,uv in zip(pb,uvs) if uv[0]>.999999),Vector())/sum(uv[0]>.999999 for uv in uvs)
C=Matrix.Translation(rootB-R@rootA)@R.to_4x4()
for i,p in enumerate(pa):pa[i]=C@p
source_tree=surface_tree([{'p':[C@p for p in q['p']]} for q in A]);target_tree=surface_tree(B)
def maxdist(points,tree):return max(tree.find_nearest(p)[3] for p in points)
e0=maxdist(pa,source_tree);e1=maxdist(pb,target_tree);en=maxdist(pb,native_eval)
assert max(e0,e1)<2e-5
# Also check triangle centroids and edge midpoints: no silent planar shortcut.
def witnesses(v):
    for a,b,c in faces:
        yield (v[a]+v[b]+v[c])/3
        yield (v[a]+v[b])/2;yield (v[b]+v[c])/2;yield (v[c]+v[a])/2
e0w=maxdist(witnesses(pa),source_tree);e1w=maxdist(witnesses(pb),target_tree)
assert max(e0w,e1w)<2e-5,(e0w,e1w)
nativew=maxdist(witnesses(pb),native_eval)
# Keep native source immutable. Only research derivative scene objects are removed.
for o in list(s.objects):
    if o.type in ('MESH','CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for l in s.view_layers:l.material_override=None;l.cycles.use_denoising=False
d=bpy.data.meshes.new('LIQUID METAL welded chart');d.from_pydata(pa,[],faces);d.update()
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
def inspect(p,t):
    n=normals(p);areas=np.linalg.norm(n,axis=1)/2
    f=phase(t,.12,.91);ref=(1-f)*na+f*nb
    dots=np.sum(n*ref,axis=1)
    tree=BVHTree.FromPolygons(p.tolist(),faces,all_triangles=True)
    # Adjacent triangles legitimately touch. Non-adjacent BVH hits are
    # potential self-intersections, not exact solid collision classification.
    hits=[(i,j) for i,j in tree.overlap(tree) if i<j and not set(faces[i]).intersection(faces[j])]
    return {'t':t,'connectedComponents':diag['connectedComponents'],'unintendedBoundaryEdges':diag['unintendedBoundaryEdges'],'sharedEdgeSeparation':0.,'degenerateTriangles':int(np.sum(areas<1e-10)),'orientationOpposedToInterpolatedEndpointNormals':int(np.sum(dots<0)),'nonAdjacentSurfaceOverlapCandidates':len(hits),'overlapExamplePairs':hits[:20],'surfaceArea':float(areas.sum()),'materialAssignmentStable':mat_ids==[p.material_index for p in d.polygons]}
s.world=bpy.data.worlds.new('Liquid studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for name,loc,power,size in [('Key',(20,-30,55),70000,50),('Strip',(-30,20,35),50000,40),('Rim',(15,35,-20),35000,35)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.22;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('Ribbon camera');cam=bpy.data.objects.new('Ribbon camera',camd);s.collection.objects.link(cam);s.camera=cam;camd.type='ORTHO';camd.clip_end=1000
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
report={'sourceSha256':expected,'compactSha256':sha(compact),'sourceRegion':'SERPENT_004 first prong, rows 0–120, facets 3–5, actual native unmodified surface','targetRegion':'TENSION_continuous_frame upper rail block 2, rows 21–98, lanes 1–7','targetEvaluatedRegionUsed':use_eval,'evaluatedProbe':probe_diag,'topology':diag,'vertices':len(uvs),'triangles':len(faces),'sourceVertexError':e0,'targetRegionVertexError':e1,'sourceWitnessError':e0w,'targetRegionWitnessError':e1w,'nativeEvaluatedVertexError':en,'nativeEvaluatedWitnessError':nativew,'crossComponentIntersections':'not applicable: isolated one surface only','fictionalScaleMmPerAuthoringUnit':10,'materialTreatment':'persistent chart stripe; native target livery not claimed','limitations':['Open regional boundary intentional; no closed solid, thickness or complete frame.','No topology opening event attempted: first qualify a single continuous strip.','No control fallback; a failed evaluated chart aborts with preserved diagnostics.','Self BVH nonadjacent overlaps are sampled candidates, not continuous exact collision proof.','No physical folding, conserved volume or wearable fit.'],'samples':[]}
# Native editable endpoints and sampled shape keys for independent inspection.
preflight='--preflight' in args;N=81
if not preflight:
    d.vertices.foreach_set('co',a.astype(np.float32).ravel());d.update()
    obj.shape_key_add(name='Basis')
    for frame in range(0,81,4):
        key=obj.shape_key_add(name=f'UNFURL-{frame:03d}');key.data.foreach_set('co',calc(frame/80).astype(np.float32).ravel())
        for f0,value in [(max(0,frame-4),0),(frame,1),(min(80,frame+4),0)]:
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
    if i%4==0 or i==80:
        report['samples'].append(inspect(p,t));(out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
    center=Vector(tuple((p.min(axis=0)+p.max(axis=0))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=max(12,float(np.max(p.max(axis=0)-p.min(axis=0)))*1.30)
    s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
actual=np.array([tuple(v.co) for v in d.vertices]);report['endpointMeshReadbackError']=float(np.max(np.abs(actual-b)));assert report['endpointMeshReadbackError']<2e-5
assert sha(src)==expected
report['sampledRegionalPass']=bool(use_eval and all(not x['degenerateTriangles'] and not x['orientationOpposedToInterpolatedEndpointNormals'] and not x['nonAdjacentSurfaceOverlapCandidates'] for x in report['samples']))
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('LIQUID_METAL',json.dumps({k:v for k,v in report.items() if k!='samples'}))
