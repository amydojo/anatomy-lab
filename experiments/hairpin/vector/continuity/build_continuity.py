"""CONTINUITY 003.3 — new rear structure on hash-locked PRECISION.
No edits to front, joint, or either propulsion assembly. Clay master only.
Atlas authoring coordinates x lateral, y up, z forward; Blender (x,-z,y).
"""
import bpy,bmesh,math,sys,os,json,hashlib,struct
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(source)=='f2875d9b4cac18195d426a7f3939e891187e4d69ea1a701d1ee899fe335c4d1a'
bpy.ops.wm.open_mainfile(filepath=source);scene=bpy.context.scene
def xyz(p):return (p[0],-p[2],p[1])
def atlas(p):return (p.x,p.z,-p.y)
def fingerprint(o):
    h=hashlib.sha256()
    h.update(str(tuple(tuple(row) for row in o.matrix_world)).encode())
    for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
    for p in o.data.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    for m in o.modifiers:
        h.update(str((m.name,m.type,[(p.identifier,str(getattr(m,p.identifier,None))) for p in m.bl_rna.properties if not p.is_readonly and p.type in {'FLOAT','INT','BOOLEAN','ENUM','STRING'}])).encode())
    return h.hexdigest()
def evaluated_fingerprint(o,deps):
    ev=o.evaluated_get(deps);m=ev.to_mesh();h=hashlib.sha256()
    for v in m.vertices:h.update(struct.pack('<3f',*(ev.matrix_world@v.co)))
    for p in m.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    ev.to_mesh_clear();return h.hexdigest()
# Unhide historical rear for evaluation only; protected front stays exact.
for o in scene.objects:
    if o.type=='MESH':o.hide_set(False);o.hide_render=False
bpy.context.view_layer.update()
def protected():
    deps=bpy.context.evaluated_depsgraph_get()
    return {o.name:{'assembly':o['assembly'],'control':fingerprint(o),'evaluated':evaluated_fingerprint(o,deps)} for o in scene.objects if o.type=='MESH' and o.get('assembly')!='rear'}
before=protected()
rear=bpy.data.collections['rear'];guides=bpy.data.collections.new('CONTINUITY rear construction');scene.collection.children.link(guides);guides.hide_render=True
mat=bpy.data.materials['Neutral clay']
for o in list(rear.objects):bpy.data.objects.remove(o,do_unlink=True)
def make(name,vs,fs,role,thick=0,bevel=.035):
    d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in vs],[],fs);d.update()
    o=bpy.data.objects.new(name,d);rear.objects.link(o);o['assembly']='rear';o['role']=role;o.data.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    if thick:
        m=o.modifiers.new('Selective structural skin','SOLIDIFY');m.thickness=thick;m.offset=0;m.use_even_offset=False
    if bevel:
        m=o.modifiers.new('Precision edge break','BEVEL');m.width=bevel;m.segments=3;m.limit_method='ANGLE';m.angle_limit=.45
    return o
def rail(name,pts,tension=.82):
    p=[Vector(q) for q in pts];h=[(p[min(i+1,len(p)-1)]-p[max(0,i-1)])*tension/(3 if i in (0,len(p)-1) else 6) for i in range(len(p))]
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';s=d.splines.new('BEZIER');s.bezier_points.add(len(p)-1)
    for q,v,k in zip(s.bezier_points,p,h):
        q.handle_left_type=q.handle_right_type='FREE';q.co=xyz(v);q.handle_left=xyz(v-k);q.handle_right=xyz(v+k)
    o=bpy.data.objects.new(name,d);guides.objects.link(o);o.hide_set(True)
    samples=[]
    for i in range(len(p)-1):
        a,b,c,e=p[i],p[i]+h[i],p[i+1]-h[i+1],p[i+1]
        for j in range(10):
            t=j/10;u=1-t;samples.append(tuple(a*u**3+3*b*u*u*t+3*c*u*t*t+e*t**3))
    return samples+[tuple(p[-1])]
# Rear-specific landmarks: low bearing termination, fast flaring shoulder,
# wide diffuser, climbing aft ribbons. Short clipped rear instead of nose.
# z, upper inner x/y, ridge x/y, outer x/y, lower inner x/y, ridge x/y, outer x/y
S=[
(-1.85,4.32,.70,4.85,1.05,5.18,.65,4.32,.12,4.85,.05,5.18,.12),
(-3.0,4.38,1.25,5.25,1.94,5.95,1.45,4.38,-.35,5.22,-.65,5.95,-.32),
(-6.0,4.4,2.6,6.15,3.75,7.6,2.25,4.5,-.85,6.12,-1.5,7.55,-.65),
(-10.5,4.85,3.4,6.85,4.65,8.8,2.2,5.1,-1.7,6.85,-2.7,8.9,-1.25),
(-15.5,5.3,3.85,7.25,4.7,9.55,2.0,6.3,-2.45,7.9,-3.7,9.65,-1.7),
(-21.0,5.55,4.0,7.65,4.85,10.05,2.7,6.7,-2.65,8.25,-4.15,10.1,-2.45),
(-26.0,4.9,4.3,7.2,5.2,9.7,3.55,6.15,-2.1,7.85,-3.1,9.7,-1.8),
(-30.2,3.55,4.8,6.1,6.1,8.35,4.9,4.7,-.8,6.55,-1.5,8.35,.2),
(-33.5,2.65,6.05,4.85,7.15,6.8,6.25,3.1,1.85,5.15,1.45,6.8,2.45),
(-35.5,1.75,6.45,3.75,7.3,5.65,6.8,2.05,3.0,3.95,3.25,5.65,4.1),
(-36.25,1.55,6.35,3.3,7.10,5.15,6.65,1.60,5.9,3.4,6.65,5.15,6.30)]
# Continuous rear network, no solid sidewalls. Independent rail curvature.
vs=[];fs=[];grid={}
for sign in [-1,1]:
    for level,k in [('upper',1),('lower',7)]:
        rr=[rail('CONTINUITY_'+str(sign)+'_'+level+'_'+str(j),[(sign*r[k+2*j],r[k+2*j+1],r[0]) for r in S]) for j in range(3)]
        rows=[]
        for i in range(len(rr[0])):
            a,b,c=map(Vector,[v[i] for v in rr]);q=2*b-.5*(a+c);ids=[]
            for j in range(9):
                t=j/8;u=1-t;ids.append(len(vs));vs.append(tuple(a*u*u+2*q*u*t+c*t*t))
            rows.append(ids)
        grid[sign,level]=rows
        for i in range(len(rows)-1):
            for j in range(8):fs.append((rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]))
    u,l=grid[sign,'upper'],grid[sign,'lower']
    for end in [0,len(u)-1]:
        for j in range(8):fs.append((u[end][j],l[end][j],l[end][j+1],u[end][j+1]))
# Raised transverse wing is part of the same surface network, not a separate
# cap. Span joins the upper inner rails only in the aftmost section.
# Lower returns remain open beneath it, and trailing edge is thin.
a,b=grid[-1,'upper'],grid[1,'upper'];rows=[]
for i in range(80,101):
    pa,pb=Vector(vs[a[i][0]]),Vector(vs[b[i][0]]);ids=[a[i][0]]
    for j in range(1,12):
        t=j/12;v=pa.lerp(pb,t);v.y+=.32*math.sin(math.pi*t)*math.sin(math.pi*(i-80)/40);v.z+=.48*math.sin(math.pi*t)*math.sin(math.pi*(i-80)/40);ids.append(len(vs));vs.append(tuple(v))
    ids.append(b[i][0]);rows.append(ids)
for i in range(len(rows)-1):
    for j in range(12):fs.append((rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]))
frame=make('CONTINUITY_rear_frame',vs,fs,'rear continuous frame',.30)
def patch(name,stations,role,thick=.45):
    rr=[rail(name+'_rail_'+str(k),[r[k] for r in stations],.76) for k in range(len(stations[0]))];n=len(rr);v=[r[i] for i in range(len(rr[0])) for r in rr]
    f=[(i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j) for i in range(len(rr[0])-1) for j in range(n-1)]
    return make(name,v,f,role,thick)
# Compact angular tread, broad aft stance. No continuous solid floor.
rows=[(-8.5,1.95,3.28),(-11.0,3.55,3.65),(-16.0,4.70,3.93),(-23.0,4.8,4.14),(-26.0,3.7,4.40),(-28.5,2.05,4.64)]
patch('CONTINUITY_rear_tread',[[(-w,y-.08,z),(-w*.76,y,z),(0,y+.045,z),(w*.76,y,z),(w,y-.08,z)] for z,w,y in rows],'rear standing insert',.32)
for idx,y in [(4,3.86),(6,4.38)]:
    z,x,fy=S[idx][:3]
    patch('CONTINUITY_rear_web_'+str(idx),[[(-x-.23,fy,z-.62),(-x*.52,y-.22,z-.62),(0,y-.22,z-.62),(x*.52,y-.22,z-.62),(x+.23,fy,z-.62)],[(-x-.23,fy,z+.62),(-x*.52,y-.22,z+.62),(0,y-.22,z+.62),(x*.52,y-.22,z+.62),(x+.23,fy,z+.62)]],'rear support web',.64)
# Local swept saddles reach the original rear pod housing, not its hub.
for s in [-1,1]:
    patch('CONTINUITY_rear_saddle_'+str(s),[
        [(s*4.7,-2.45,-16),(s*6,-2.65,-16),(s*7.8,-3.6,-16)],
        [(s*5.55,-2.55,-19),(s*6.5,-3.0,-19),(s*8.0,-3.9,-19)],
        [(s*5.65,-2.55,-23),(s*6.6,-3.1,-23),(s*8.15,-3.85,-23)],
        [(s*4.9,-2.25,-26),(s*6.0,-2.7,-26),(s*7.9,-3.1,-26)]],'rear pod saddle',.50)
# Rear-facing sector, same collar mating category as front, no rigid bridge.
for s in [-1,1]:
    profile=[(3.34,3.18),(3.76,3.18),(4.85,3.02),(5.32,3.28),(5.0,3.68),(3.52,3.72)]
    v=[];f=[];n=29
    for x,r in profile:
        for j in range(n):
            a=math.radians(32+116*j/(n-1));v.append((s*x,r*math.cos(a),-r*math.sin(a)))
    for k in range(len(profile)):
        for j in range(n-1):f.append((k*n+j,k*n+j+1,((k+1)%len(profile))*n+j+1,((k+1)%len(profile))*n+j))
    f.extend([tuple(k*n for k in reversed(range(len(profile)))),tuple(k*n+n-1 for k in range(len(profile)))])
    make('CONTINUITY_rear_bearing_'+str(s),v,f,'rear bearing sleeve',0,.025)
bpy.context.view_layer.update();after=protected()
assert before==after,'Protected front/hardware fingerprint changed'
deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(m)
    stats.append({'name':o.name,'assembly':o['assembly'],'role':o['role'],'controlVertices':len(o.data.vertices),'evaluatedTriangles':len(m.loop_triangles),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)})
    bm.free();ev.to_mesh_clear()
scene['stage']='CONTINUITY 003.3 / unapproved complete clay master';scene['continuity_source_sha256']=sha(source)
dest=os.path.join(out,'VECTOR-005-CONTINUITY-master.blend');bpy.ops.wm.save_as_mainfile(filepath=dest)
report={'sourceSha256':sha(source),'masterSha256':sha(dest),'protectedBefore':before,'protectedAfter':after,'protectedUnchanged':before==after,'components':stats,'evaluatedTriangles':sum(s['evaluatedTriangles'] for s in stats),'limitations':'No material work, optimization or exact fit claim. Guide curves are build inputs, not live dependencies.'}
json.dump(report,open(os.path.join(out,'continuity-build.json'),'w'),indent=2);print('CONTINUITY_BUILD',json.dumps({'protectedMeshes':len(before),'components':len(stats),'triangles':report['evaluatedTriangles'],'sha256':report['masterSha256']}))
