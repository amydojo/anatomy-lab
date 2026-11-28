"""CHIMERA surface transport experiment.
Both actual evaluated endpoint surfaces are partitioned into corresponding
triangular wedges. No face visibility changes. Different topology means
the common patch representation is NOT guaranteed connected in between.
Preserve and report seam separation; do not certify a mechanically viable fold.
"""
import bpy,sys,math,json,hashlib,itertools,bisect
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True)
src=arg('source');compact=arg('compact')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
assert sha(src)==expected
# 10 mm per authoring unit is illustrative; crown near shared origin.
C=Matrix.Translation(Vector((0,-5.4,0)))@Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Scale(.1,4)
def group(g):return 'front' if g.startswith('front') else 'rear' if g.startswith('rear') else 'joint'
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
def area(v):return (v[1]-v[0]).cross(v[2]-v[0]).length*.5
def style(m):
    p=m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
    return {'name':m.name if m else 'Neutral','color':tuple(p.inputs['Base Color'].default_value) if p else (.4,.4,.4,1),'metal':p.inputs['Metallic'].default_value if p else .5,'rough':p.inputs['Roughness'].default_value if p else .28}
def snapshot(o,transform,source=False):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg);me.calc_loop_triangles()
    M=transform@e.matrix_world;N=M.to_3x3().inverted_safe().transposed()
    if hasattr(me,'calc_normals_split'):me.calc_normals_split()
    normals=[(N@Vector(n.vector if hasattr(n,'vector') else n.normal)).normalized() for n in (me.corner_normals if hasattr(me,'corner_normals') else me.loops)]
    v=[M@x.co for x in me.vertices];rows=[]
    for tri in me.loop_triangles:
        ids=list(tri.vertices);loops=list(tri.loops);pts=[v[i] for i in ids]
        a=area(pts)
        if a<=1e-15:continue
        m=me.materials[tri.material_index] if len(me.materials) else None
        q={'v':pts,'ids':ids,'norm':[normals[i] for i in loops],'area':a,'name':o.name,'index':tri.index,'mat':style(m) if source else m,'uv':{u.name:[Vector(u.data[i].uv) for i in loops] for u in me.uv_layers}}
        if source:
            if o.name.startswith('SERPENT_003'):
                # Actual ring station IDs from the continuous ribbon generator.
                ring=sum(i//8 for i in ids)/3;u=ring/360
                g='front' if u<.39 else 'rear' if u>.61 else 'joint'
                q['group']=g;q['u']=1-u/.39 if g=='front' else (u-.61)/.39 if g=='rear' else (u-.39)/.22
                q['cross']=sum(i%8 for i in ids)/3
            else:
                q['group']='joint';q['u']=.45;q['cross']=sum(p.z for p in pts)/3
        else:
            q['group']=group(o['assembly'])
        rows.append(q)
    e.to_mesh_clear();return rows
# Source actual closed master, then actual 52-degree pivot pose.
bpy.ops.wm.open_mainfile(filepath=str(compact));bpy.context.view_layer.update()
wear=[o for o in bpy.context.scene.objects if o.type=='MESH']
closed=[q for o in wear for q in snapshot(o,C,True)]
pivot=bpy.data.objects['Release axis — proposed'];pivot_c=C@pivot.matrix_world.translation;axis_c=(C.to_3x3()@Vector((0,1,0))).normalized();pivot.rotation_euler.y=math.radians(52);bpy.context.view_layer.update()
opened={(q['name'],q['index']):q for o in wear for q in snapshot(o,C,True)}
for q in closed:
    p=opened[(q['name'],q['index'])];assert q['ids']==p['ids'];q['open']=p['v'];q['openNorm']=p['norm']
# Compute arc-length stations of actual compact body (same vertices).
body=next(o for o in wear if o.name.startswith('SERPENT_003'))
assert len(body.data.vertices)==2888
def lengths(pts):
    d=[0.]
    for a,b in zip(pts,pts[1:]):d.append(d[-1]+(b-a).length)
    return d
centers=[sum((body.data.vertices[8*i+j].co for j in range(8)),Vector())/8 for i in range(361)]
arc=lengths(centers)
for q in closed:
    if q['name']==body.name:
        k=sum(i//8 for i in q['ids'])/3;i=min(359,int(k));a=arc[i]+(arc[i+1]-arc[i])*(k-i)
        q['u']=(1-a/arc[140]) if q['group']=='front' else (a-arc[220])/(arc[-1]-arc[220]) if q['group']=='rear' else (a-arc[140])/(arc[220]-arc[140])
# Target actual protected evaluated triangles and original material/UV assignment.
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene;bpy.context.view_layer.update()
parts=[o for o in s.objects if o.type=='MESH'];assert len(parts)==25
target=[q for o in parts for q in snapshot(o,Matrix.Identity(4))]
# Measure actual frame arc in native 101-row grid; project other component
# centroids into same longitudinal chart via nearest longitudinal station.
charts={}
for g,name in [('front','TENSION_continuous_frame'),('rear','CONTINUITY_rear_frame')]:
    o=bpy.data.objects[name];assert len(o.data.vertices)>=3636
    pts=[sum((o.matrix_world@o.data.vertices[k*909+i*9+4].co for k in (0,2)),Vector())/2 for i in range(101)]
    if abs(pts[0].y)>abs(pts[-1].y):pts.reverse()
    d=lengths(pts);charts[g]=(pts,d)
for q in target:
    p=sum(q['v'],Vector())/3;g=q['group']
    if g=='joint':q['u']=(p.x+6)/12;q['cross']=math.atan2(p.z,p.y)
    else:
        pts,d=charts[g];j=min(range(101),key=lambda i:abs(pts[i].y-p.y))
        q['u']=d[j]/d[-1];q['cross']=math.atan2(p.z,p.x)
# Coherent patch ordering, not an isometric parameterization.
def order(q):return (min(79,max(0,int(q['u']*80))),q['cross'],q['u'],q['name'],q['index'])
def interp(a,b,t):return a.lerp(b,t)
def wedge(v,a,b):return [v[0].copy(),interp(v[1],v[2],a),interp(v[1],v[2],b)]
def normw(v,a,b):return [p.normalized() for p in wedge(v,a,b)]
# Exact two-pointer interval merge.
def transport(A,B):
    A=sorted(A,key=order);B=sorted(B,key=order)
    wa=sum(q['area'] for q in A);wb=sum(q['area'] for q in B)
    def edges(rows,w):
        e=[0.]
        for q in rows:e.append(e[-1]+q['area']/w)
        e[-1]=1.;return e
    ae,be=edges(A,wa),edges(B,wb);i=j=0;p=[];ca=[0.]*len(A);cb=[0.]*len(B)
    while i<len(A) and j<len(B):
        lo=max(ae[i],be[j]);hi=min(ae[i+1],be[j+1]);enda,endb=ae[i+1],be[j+1]
        if hi>lo:
            a,b=A[i],B[j];u0=(lo-ae[i])/(enda-ae[i]);u1=(hi-ae[i])/(enda-ae[i]);v0=(lo-be[j])/(endb-be[j]);v1=(hi-be[j])/(endb-be[j])
            ca[i]+=u1-u0;cb[j]+=v1-v0
            p.append({'a':wedge(a['v'],u0,u1),'open':wedge(a['open'],u0,u1),'b':wedge(b['v'],v0,v1),'an':normw(a['norm'],u0,u1),'on':normw(a['openNorm'],u0,u1),'bn':normw(b['norm'],v0,v1),'sourceName':a['name'],'style':a['mat'],'mat':b['mat'],'uv':{k:wedge(v,v0,v1) for k,v in b['uv'].items()},'name':b['name'],'group':b['group']})
        if enda<=endb:i+=1
        if endb<=enda:j+=1
    err=max(abs(x-1) for x in ca+cb);assert err<1e-6,err
    return p,{'sourceTriangles':len(A),'targetTriangles':len(B),'patches':len(p),'maxFractionCoverageError':err,'sourceArea':wa,'targetArea':wb,'partitionSourceArea':sum(area(q['a']) for q in p),'partitionTargetArea':sum(area(q['b']) for q in p)}
patches=[];coverage={}
for g in ('front','rear','joint'):
    p,coverage[g]=transport([q for q in closed if q['group']==g],[q for q in target if q['group']==g]);patches+=p
# Endpoint point-to-surface checks, in addition to per-triangle coverage.
def tree(rows):
    v=[v for q in rows for v in q['v']];f=[(i,i+1,i+2) for i in range(0,len(v),3)]
    return BVHTree.FromPolygons(v,f,all_triangles=True)
def distance(v,t):return max(t.find_nearest(p)[3] for p in v)
e0=distance((v for q in patches for v in q['a']),tree(closed))
e1=distance((v for q in patches for v in q['b']),tree(target))
assert max(e0,e1)<2e-5,(e0,e1)
for g,v in coverage.items():
    for k in ('Source','Target'):
        assert abs(v['partition'+k+'Area']-v[k.lower()+'Area'])/v[k.lower()+'Area']<1e-5,(g,k,v)
for o in list(s.objects):
    if o.type in ('MESH','CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for l in s.view_layers:l.material_override=None;l.cycles.use_denoising=False
mixes={};emissions=[]
def material(q):
    key=(q['style']['name'],q['mat'].name if q['mat'] else '')
    if key in mixes:return mixes[key][0]
    m=q['mat'].copy() if q['mat'] else bpy.data.materials.new('Neutral target');m.use_nodes=True
    n=m.node_tree.nodes;l=m.node_tree.links
    o=next(x for x in n if x.type=='OUTPUT_MATERIAL' and x.is_active_output)
    old=o.inputs['Surface'].links[0].from_socket if o.inputs['Surface'].is_linked else n.new('ShaderNodeBsdfPrincipled').outputs[0]
    # Compact material stays tied to the same patch; target native UVs remain.
    p=n.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=q['style']['color'];p.inputs['Metallic'].default_value=q['style']['metal'];p.inputs['Roughness'].default_value=q['style']['rough']
    mix=n.new('ShaderNodeMixShader');l.new(p.outputs[0],mix.inputs[1]);l.new(old,mix.inputs[2]);l.new(mix.outputs[0],o.inputs['Surface']);mixes[key]=(m,mix.inputs[0])
    if q['mat'] and q['mat'].get('family')=='amber':
        orig=n.get('Principled BSDF')
        if orig and 'Emission Strength' in orig.inputs:socket=orig.inputs['Emission Strength'];emissions.append((socket,socket.default_value))
    return m
# Group by actual target object. Each patch stays present for entire film.
objects=[];patch_order=[]
for name in sorted({q['name'] for q in patches}):
    rows=[q for q in patches if q['name']==name];v=[p for q in rows for p in q['a']];f=[(i,i+1,i+2) for i in range(0,len(v),3)]
    d=bpy.data.meshes.new(name+' correspondence');d.from_pydata(v,[],f);d.update()
    mats={}
    for i,q in enumerate(rows):
        m=material(q)
        if m.name not in mats:mats[m.name]=len(d.materials);d.materials.append(m)
        d.polygons[i].material_index=mats[m.name];d.polygons[i].use_smooth=True
    if hasattr(d,'use_auto_smooth'):d.use_auto_smooth=True
    for uvname in sorted({k for q in rows for k in q['uv']}):
        u=d.uv_layers.new(name=uvname)
        for i,q in enumerate(rows):
            for j,p in enumerate(q['uv'].get(uvname,[Vector((0,0))]*3)):u.data[3*i+j].uv=p
    o=bpy.data.objects.new(name+' / CHIMERA',d);s.collection.objects.link(o)
    arrays={k:np.array([tuple(p) for q in rows for p in q[k]],dtype=np.float32) for k in ('a','open','b','an','on','bn')}
    arrays['leafMask']=np.repeat(np.array([q['sourceName']=='Concealed release leaf' for q in rows]),3)
    objects.append((o,rows[0]['group'],arrays,f));patch_order.extend(rows)
# Shared compact coordinate witnesses: measure seams instead of concealing them.
source_pts=np.concatenate([a['a'] for o,g,a,f in objects]);target_pts=np.concatenate([a['b'] for o,g,a,f in objects])
def witness(points):
    groups={}
    for i,p in enumerate(points):groups.setdefault(tuple(np.round(p,5)),[]).append(i)
    return [idx for idx in groups.values() if len(idx)>1]
w0=witness(source_pts);w1=witness(target_pts)
def seam(points,groups):
    v=[float(np.max(np.linalg.norm(points[idx]-points[idx[0]],axis=1))) for idx in groups]
    return {'witnessGroups':len(v),'separatedOver0p1':sum(x>.1 for x in v),'maxGapAuthoring':max(v,default=0),'p95GapAuthoring':float(np.percentile(v,95)) if v else 0}
def apply(t):
    release=phase(t,.04,.19);morph=phase(t,.19,.88);unfold=phase(t,.19,.62);allp=[]
    # Outward swing of rear prong before expansion, avoiding historical
    # counter-rotation across the other pod. Fictional, not collision-free.
    for o,g,a,f in objects:
        A=a['a'].copy();N=a['an'].copy();mask=a['leafMask']
        RR=np.array(Matrix.Rotation(math.radians(52)*release,3,axis_c),dtype=np.float32);pc=np.array(pivot_c,dtype=np.float32)
        A[mask]=(A[mask]-pc)@RR.T+pc;N[mask]=N[mask]@RR.T
        angle=math.pi*unfold if g=='rear' else 0.
        R=np.array([[math.cos(angle),-math.sin(angle),0],[math.sin(angle),math.cos(angle),0],[0,0,1]],dtype=np.float32)
        shift=np.array([(1 if g=='rear' else -1 if g=='front' else 0)*2.5*math.sin(math.pi*morph),0,0],dtype=np.float32)
        P=(1-morph)*(A@R.T)+morph*a['b']+shift
        NN=(1-morph)*(N@R.T)+morph*a['bn'];NN/=np.maximum(np.linalg.norm(NN,axis=1)[:,None],1e-9)
        if t==0:P=a['a'];NN=a['an']
        if t==1:P=a['b'];NN=a['bn']
        o.data.vertices.foreach_set('co',P.ravel());o.data.update()
        o.data.normals_split_custom_set(NN.tolist());allp.append(P)
    for m,socket in mixes.values():socket.default_value=phase(t,.26,.91)
    for socket,value in emissions:socket.default_value=value*phase(t,.92,1)
    bpy.context.view_layer.update();return np.concatenate(allp)
def inspect(points):
    trees=[];start=0
    for o,g,a,f in objects:
        n=len(a['a']);v=points[start:start+n];start+=n
        trees.append((o.name,v.min(axis=0),v.max(axis=0),BVHTree.FromPolygons(v.tolist(),f,all_triangles=True)))
    hits=[]
    for a,b in itertools.combinations(trees,2):
        if np.any(a[2]<b[1]) or np.any(b[2]<a[1]):continue
        h=len(a[3].overlap(b[3]))
        if h:hits.append({'a':a[0],'b':b[0],'trianglePairs':h})
    return hits
# Render same actual patch representation throughout. Exact native source file
# is separately qualified; native material/normal image equivalence not asserted.
if s.world is None:s.world=bpy.data.worlds.new('CHIMERA studio')
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.15,.15,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for name,loc,power,size in [('Key',(30,-30,65),90000,65),('Strip',(-40,35,30),70000,45),('Rim',(15,40,-25),45000,42)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size*.28;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('CHIMERA camera');o=bpy.data.objects.new('CHIMERA camera',d);s.collection.objects.link(o);s.camera=o;d.type='ORTHO';d.clip_end=2000;o.location=(95,-75,150)
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
report={'sourceSha256':expected,'compactSha256':sha(compact),'coverage':coverage,'compactMaxVertexSurfaceErrorAuthoring':e0,'deployedMaxVertexSurfaceErrorAuthoring':e1,'patchCount':len(patches),'targetPartCount':len(objects),'visibilityChanges':0,'limitations':['Exact endpoint surface coverage via per-triangle subdivision, not original shared topology.','Interior seam separation and folded surfaces are expected; this is a correspondence experiment, NOT a qualified continuous skin.','Native target UVs interpolated; image parity, generated-coordinate material parity and artwork readability are unqualified.','Source and target physical scale relationship fictional; 10 mm per authoring unit is illustrative.','Cross-object surface overlap only; not self-intersection, containment, continuous collision or mechanical safety.','No native asset mutation.'],'samples':[]}
preflight='--preflight' in args;N=49
if preflight:s.cycles.samples=8;s.render.resolution_x=320;s.render.resolution_y=180
for i in ([0,16,48] if preflight else range(N)):
    t=i/(N-1);P=apply(t);center=Vector(tuple((P.min(axis=0)+P.max(axis=0))/2));o.location=center+Vector((95,-75,150));o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    d.ortho_scale=17+79*phase(t,.18,.88)
    if i%4==0 or i==48:
        hits=inspect(P)
        A=P.reshape(-1,3,3);areas=np.linalg.norm(np.cross(A[:,1]-A[:,0],A[:,2]-A[:,0]),axis=1)/2
        report['samples'].append({'t':t,'surfaceOverlapPairs':hits,'compactSeams':seam(P,w0),'deployedSeams':seam(P,w1),'minPatchArea':float(areas.min()),'nearDegeneratePatches':int(np.sum(areas<1e-9)),'area':float(areas.sum())})
        (out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
    s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
assert np.max(np.abs(P-target_pts))==0 and sha(src)==expected
report['endpointMaxStoredCoordinateError']=float(np.max(np.abs(P-target_pts)))
# Read back actual rendered mesh positions, not only the input arrays.
actual=np.concatenate([np.array([tuple(v.co) for v in o.data.vertices],dtype=np.float32) for o,g,a,f in objects]);report['endpointMaxMeshCoordinateError']=float(np.max(np.abs(actual-target_pts)));assert report['endpointMaxMeshCoordinateError']==0
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('CHIMERA surface transport',json.dumps({k:v for k,v in report.items() if k!='samples'}))
