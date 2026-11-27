"""PRECISION 003.2: local edits to exact TENSION 003.1 master.
No rebuild of rear, joint, pod, or successful lower-spar centerlines.
Authoring units. Keep object names and mating classifications for unchanged gate.
"""
import bpy,bmesh,math,hashlib,json,sys,os,struct
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(source)=='925527d37b4a9974fd131c69815ac6a23d7f5c1dd3fa7984cc75f57e9bea8980'
bpy.ops.wm.open_mainfile(filepath=source);scene=bpy.context.scene
front=bpy.data.collections['front']
def atlas(v):return (v.x,v.z,-v.y)
def xyz(x,y,z):return (x,-z,y)
def smooth(a,b,z):
    t=max(0,min(1,(z-a)/(b-a)));return t*t*(3-2*t)
def fingerprint(o):
    d=hashlib.sha256()
    for v in o.data.vertices:d.update(struct.pack('<3f',*v.co))
    for p in o.data.polygons:d.update(struct.pack('<I',len(p.vertices)));d.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    d.update(str(tuple(tuple(x) for x in o.matrix_world)).encode())
    return d.hexdigest()
frozen={o.name:fingerprint(o) for o in scene.objects if o.type=='MESH' and o.get('assembly')!='front'}
frame=bpy.data.objects['TENSION_continuous_frame'];assert len(frame.data.vertices)==3636
original=[atlas(v.co) for v in frame.data.vertices]
# Verify recorded mesh grid before touching it; two sides, upper then lower,
# 101 longitudinal samples, nine transverse samples.
N=101;W=9
for block in range(4):
    points=original[block*N*W:(block+1)*N*W]
    assert abs(points[0][2]-37.75)<.001 and abs(points[-1][2]-1.7)<.001
    assert all((p[0]<0)==(block<2) for p in points)
# Sweep envelope of original pod in front-local coordinates. The relative
# pose is exactly the existing transform: pod rotates -.65*twist and offsets
# along the front up axis. For z-slices, intersect actual evaluated triangles
# with the slice, including a longitudinal guard band for thickness.
deps=bpy.context.evaluated_depsgraph_get();pod=bpy.data.objects['front_pod_outer_housing'];ev=pod.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
pv=[atlas(ev.matrix_world@v.co) for v in m.vertices];tris=[tuple(t.vertices) for t in m.loop_triangles];ev.to_mesh_clear()
sweeps=[]
for t in [-.14,0,.14]:
    a=-.65*t;c,s=math.cos(a),math.sin(a)
    for d in [0,1]:
        for k in [0,1.6]:
            off=-.6*d+.65*k
            sweeps.append([(c*x+s*y,-s*x+c*y+off,z) for x,y,z in pv])
# Only lateral X extrema matter for the relief, independent of vertical offset.
# Cache z-band maximum using conservative triangle slab clipping.
def lateral(z):
    low,high=z-.30,z+.30;mx=0
    for vv in sweeps[::4]:
        for f in tris:
            p=[vv[i] for i in f]
            if max(q[2] for q in p)<low or min(q[2] for q in p)>high:continue
            for q in p:
                if low<=q[2]<=high:mx=max(mx,abs(q[0]))
            for a,b in zip(p,p[1:]+p[:1]):
                for zz in (low,high):
                    if (a[2]-zz)*(b[2]-zz)<0:
                        t=(zz-a[2])/(b[2]-a[2]);mx=max(mx,abs(a[0]+t*(b[0]-a[0])))
    return mx
# A narrow, smooth outer relief preserves the lower ridge and outer rail.
# z samples shared by four blocks. Do not displace the entire lower ribbon.
relief={}
for i in range(N):
    z=original[N*W+i*W][2];inner=abs(original[N*W+i*W][0])
    if 12.8<z<27.2:
        r=lateral(z)
        relief[i]=max(0,r+.31-inner)*smooth(12.8,14.5,z)*(1-smooth(25.5,27.2,z)) if r else 0
    else:relief[i]=0
# Smooth relief with local max envelope to avoid a narrow kink, keeping
# conservative maxima. Lower ridge/outer rail unchanged outside joint/nose.
relief={i:max(relief[i],.72*relief.get(i-1,0),.72*relief.get(i+1,0)) for i in range(N)}
# Round tiny tip convergence using a locally reduced skin thickness.
vg=frame.vertex_groups.new(name='PRECISION_tip_thickness')
max_lower=0;lower_changed=0
for idx,v in enumerate(frame.data.vertices):
    block,i,j=idx//(N*W),(idx%(N*W))//W,idx%W
    sign=-1 if block<2 else 1;upper=block%2==0;u=j/8
    x,y,z=original[idx];ax=abs(x)
    # Upper mass reduction along outer span; inner edge kept for web contact.
    if upper:
        inner=abs(original[block*N*W+i*W][0]);blend=smooth(7,12,z)*(1-smooth(29,34,z))
        ax=inner+(ax-inner)*(1-.21*blend)
        y-=.24*blend*math.sin(math.pi*u)**2
    else:
        delta=relief[i]*(1-u)**2
        ax+=delta;max_lower=max(max_lower,delta);lower_changed+=delta>1e-6
    # Retreat outboard from the fixed collar only at the gimbal end.
    # Keep both upper/lower termination connected; no rigid rear bridge.
    end=1-smooth(2.0,5.6,z)
    ax+=.88*end
    # Remove the near-zero thickness cusp at nose by regularizing the
    # cross-sectional slope over the last 1.7 units, not reshaping the wedge.
    tip=smooth(35.8,37.75,z)
    if tip:
        y=y*(1-.55*tip)+( .095 if upper else -.095)*.55*tip
    v.co=xyz(sign*ax,y,z)
    vg.add([idx],1-.80*tip,'REPLACE')
solid=next(m for m in frame.modifiers if m.type=='SOLIDIFY');solid.vertex_group=vg.name;solid.thickness_vertex_group=.0
frame.data.update()
# Thin angular tread, retain longitudinal heights at fixed webs. Only
# transverse shape and thickness change; lower surface remains supported.
tread=bpy.data.objects['TENSION_tread']
assert len(tread.data.vertices)==255
old=[atlas(v.co) for v in tread.data.vertices]
for v in tread.data.vertices:
    x,y,z=old[v.index];row=(v.index//5)*5;oldw=max(abs(old[row][0]),abs(old[row+4][0]),.01)
    widths=[(8.5,1.70),(10,3.0),(12,4.28),(22,4.55),(25,3.40),(28,1.55)]
    w=next((wa+(wb-wa)*(z-za)/(zb-za) for (za,wa),(zb,wb) in zip(widths,widths[1:]) if za<=z<=zb),oldw)
    x=x/oldw*w;y-=.06
    v.co=xyz(x,y,z)
next(m for m in tread.modifiers if m.type=='SOLIDIFY').thickness=.32;tread.data.update()
# Replace full 360-degree sleeve by a front-facing annular sector.
# All z positive; preserve name/role and fixed frame mating gate. Wider
# outer lug bridges the newly relieved frame ends. It is still a provisional
# bearing, not an assertion of true hinge fit under landing compression.
for sign in [-1,1]:
    o=bpy.data.objects['TENSION_bearing_sleeve_'+str(sign)]
    profile=[(3.34,3.18),(3.76,3.18),(4.70,3.02),(5.00,3.28),(4.82,3.68),(3.52,3.72)]
    vs=[];faces=[];n=29
    for x,r in profile:
        for j in range(n):
            a=math.radians(32+116*j/(n-1));vs.append(xyz(sign*x,r*math.cos(a),r*math.sin(a)))
    for k in range(len(profile)):
        for j in range(n-1):faces.append((k*n+j,k*n+j+1,((k+1)%len(profile))*n+j+1,((k+1)%len(profile))*n+j))
    faces.extend([tuple(k*n for k in reversed(range(len(profile)))),tuple(k*n+n-1 for k in range(len(profile)))])
    d=bpy.data.meshes.new('PRECISION_forward_bearing_shoe');d.from_pydata(vs,[],faces);d.update()
    for m in o.data.materials:d.materials.append(m)
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    o.data=d
# Existing construction curves no longer exactly match local edited rails;
# retain them as hidden historical guides, not false live dependencies.
scene['stage']='PRECISION 003.2 / front only / unapproved'
scene['precision_source_sha256']=sha(source)
bpy.context.view_layer.update()
assert frozen=={o.name:fingerprint(o) for o in scene.objects if o.type=='MESH' and o.get('assembly')!='front'}
deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in front.objects:
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(m)
    stats.append({'name':o.name,'triangles':len(m.loop_triangles),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)});bm.free();ev.to_mesh_clear()
dest=os.path.join(out,'VECTOR-005-PRECISION-front.blend');bpy.ops.wm.save_as_mainfile(filepath=dest)
report={'sourceSha256':sha(source),'masterSha256':sha(dest),'frozenMeshCount':len(frozen),'frozenGeometryUnchanged':True,'lowerReliefMax':max_lower,'lowerReliefVertices':lower_changed,'components':stats,'note':'Same front frame topology; local relief and forward bearing sectors. Mechanical fit remains gated.'}
json.dump(report,open(os.path.join(out,'precision-build.json'),'w'),indent=2);print('PRECISION_BUILD',json.dumps(report))
