"""LIQUID METAL: connected regional chart overlay. No independent patch transport.
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
layer=me.uv_layers.get('LiquidChart');Bprobe=[]
if layer:
    for t in me.loop_triangles:
        if t.material_index!=mi:continue
        ps=[e.matrix_world@me.vertices[i].co for i in t.vertices];normal=(ps[1]-ps[0]).cross(ps[2]-ps[0])
        if normal.z<=1e-9:continue
        qs=[tuple(layer.data[l].uv) for l in t.loops]
        if abs(orient(*qs))<1e-12:continue
        Bprobe.append(triangle(qs,ps))
e.to_mesh_clear();bpy.data.objects.remove(copy,do_unlink=True)
probe_area=sum(signed(q['uv']) for q in Bprobe);probe_error=max((native_eval.find_nearest(v)[3] for q in Bprobe for v in q['p']),default=1e9)
# Overlay clipping: shared chart vertices are welded, not independent triangles.
def clip(poly,a,b):
    result=[]
    for p,q in zip(poly,poly[1:]+poly[:1]):
        dp=orient(a,b,p);dq=orient(a,b,q);ip=dp>=-1e-12;iq=dq>=-1e-12
        if ip:result.append(p)
        if ip!=iq:
            t=dp/(dp-dq);result.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    clean=[]
    for p in result:
        if not clean or math.dist(p,clean[-1])>1e-10:clean.append(p)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<=1e-10:clean.pop()
    return clean
def overlay(A,B):
    bins=collections.defaultdict(list)
    def keys(q):
        u=[p[0] for p in q['uv']];v=[p[1] for p in q['uv']]
        return itertools.product(range(max(0,int(min(u)*100)),min(100,int(max(u)*100))+1),range(max(0,int(min(v)*20)),min(20,int(max(v)*20))+1))
    for j,q in enumerate(B):
        for k in keys(q):bins[k].append(j)
    verts=[];pa=[];pb=[];faces=[];index={};mismatch=0.;covered=0.
    def vertex(p,a,b):
        nonlocal mismatch
        k=tuple(round(x,9) for x in p)
        x,y=interp(a,p),interp(b,p)
        if k in index:
            i=index[k];mismatch=max(mismatch,(x-pa[i]).length,(y-pb[i]).length);return i
        i=len(verts);index[k]=i;verts.append(p);pa.append(x);pb.append(y);return i
    for a in A:
        for j in sorted({i for k in keys(a) for i in bins.get(k,[])}):
            b=B[j];poly=a['uv'][:]
            for x,y in zip(b['uv'],b['uv'][1:]+b['uv'][:1]):
                if not poly:break
                poly=clip(poly,x,y)
            if len(poly)<3 or signed(poly)<1e-13:continue
            covered+=signed(poly);ids=[vertex(p,a,b) for p in poly]
            # Interior fan preserves every shared boundary segment, including
            # collinear vertices; no diagonal mismatch across neighboring cells.
            center=(sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly))
            ci=vertex(center,a,b)
            for k,l in zip(ids,ids[1:]+ids[:1]):
                if k!=l and ci not in (k,l) and abs(orient(verts[k],verts[l],verts[ci]))>1e-14:faces.append((k,l,ci))
    edges=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    boundary=[e for e,n in edges.items() if n==1]
    def external(e):
        p,q=[verts[i] for i in e];return any(abs(p[k]-z)<1e-7 and abs(q[k]-z)<1e-7 for k in (0,1) for z in (0,1))
    adj=collections.defaultdict(set)
    for a,b in edges:adj[a].add(b);adj[b].add(a)
    unseen=set(range(len(verts)));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for k in adj[todo.pop()]:
                if k in unseen:unseen.remove(k);todo.append(k)
    diag={'chartArea':covered,'sharedVertexEndpointMismatch':mismatch,'connectedComponents':cc,'boundaryEdges':len(boundary),'unintendedBoundaryEdges':sum(not external(e) for e in boundary),'nonmanifoldEdges':sum(n>2 for n in edges.values())}
    diag['pass']=abs(covered-1)<1e-6 and mismatch<2e-5 and cc==1 and not diag['unintendedBoundaryEdges'] and not diag['nonmanifoldEdges']
    return verts,pa,pb,faces,diag
probe_diag={'chartArea':probe_area,'vertexSurfaceError':probe_error,'triangles':len(Bprobe)}
candidate=None
if abs(probe_area-1)<1e-5 and probe_error<2e-5:
    candidate=overlay(A,Bprobe);probe_diag['overlay']=candidate[-1]
use_eval=bool(candidate and candidate[-1]['pass'])
B=Bprobe if use_eval else Bcontrol
uvs,pa,pb,faces,diag=candidate if use_eval else overlay(A,Bcontrol)
assert diag['pass'],diag
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
mat_ids=[p.material_index for p in d.polygons]
a=np.array(pa,dtype=np.float64);b=np.array(pb,dtype=np.float64);uvn=np.array(uvs);F=np.array(faces)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,l,h):return smooth((t-l)/(h-l))
def calc(t):
    # Common displacement field on shared vertices, never per-face motion.
    f=phase(t,.12,.91);u=uvn[:,0];v=uvn[:,1]
    p=(1-f)*a+f*b
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
report={'sourceSha256':expected,'compactSha256':sha(compact),'sourceRegion':'SERPENT_004 first prong, rows 0–120, facets 3–5, actual native unmodified surface','targetRegion':'TENSION_continuous_frame upper rail block 2, rows 21–98, lanes 1–7','targetEvaluatedRegionUsed':use_eval,'evaluatedProbe':probe_diag,'topology':diag,'vertices':len(uvs),'triangles':len(faces),'sourceVertexError':e0,'targetRegionVertexError':e1,'sourceWitnessError':e0w,'targetRegionWitnessError':e1w,'nativeEvaluatedVertexError':en,'nativeEvaluatedWitnessError':nativew,'crossComponentIntersections':'not applicable: isolated one surface only','fictionalScaleMmPerAuthoringUnit':10,'materialTreatment':'persistent chart stripe; native target livery not claimed','limitations':['Open regional boundary intentional; no closed solid, thickness or complete frame.','No topology opening event attempted: first qualify a single continuous strip.','If evaluated probe fails, endpoint is native CONTROL region only; full evaluated endpoint qualification remains open.','Self BVH nonadjacent overlaps are sampled candidates, not continuous exact collision proof.','No physical folding, conserved volume or wearable fit.'],'samples':[]}
preflight='--preflight' in args;N=41
if preflight:s.cycles.samples=8;s.render.resolution_x=320;s.render.resolution_y=180
for i in ([0,20,40] if preflight else range(N)):
    t=i/(N-1);p=calc(t);d.vertices.foreach_set('co',p.astype(np.float32).ravel());d.update();bpy.context.view_layer.update()
    if i%4==0 or i==40:
        report['samples'].append(inspect(p,t));(out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
    center=Vector(tuple((p.min(axis=0)+p.max(axis=0))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=max(12,float(np.max(p.max(axis=0)-p.min(axis=0)))*1.30)
    s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
actual=np.array([tuple(v.co) for v in d.vertices]);report['endpointMeshReadbackError']=float(np.max(np.abs(actual-b)));assert report['endpointMeshReadbackError']<2e-5
assert sha(src)==expected
report['sampledRegionalPass']=bool(use_eval and all(not x['degenerateTriangles'] and not x['orientationOpposedToInterpolatedEndpointNormals'] and not x['nonAdjacentSurfaceOverlapCandidates'] for x in report['samples']))
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('LIQUID_METAL',json.dumps({k:v for k,v in report.items() if k!='samples'}))
