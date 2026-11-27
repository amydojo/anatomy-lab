"""EXOSKELETON 003 — open, load-path-first clay master. Blender 4.x.
All distances in authoring units; atlas coordinates (x,y,z) -> Blender (x,-z,y).
No prior master mutation, no runtime derivative.
"""
import bpy,bmesh,math,sys,os,json
from mathutils import Vector
from math import pi,cos,sin
args=sys.argv[sys.argv.index('--')+1:];out=os.path.abspath(args[args.index('--out')+1]);os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
def xyz(p):return (p[0],-p[2],p[1])
def clay(name,tone):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(tone,tone,tone,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(tone,tone,tone,1);p.inputs['Roughness'].default_value=.36
    return m
mat=clay('Neutral clay',.44)
groups={}
for name in ['front','rear','joint','front_pod','rear_pod','construction']:
    c=bpy.data.collections.new(name);scene.collection.children.link(c);groups[name]=c
groups['construction'].hide_render=True
def mesh(name,g,vs,fs,role,thick=0,bevel=0):
    d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in vs],[],fs);d.update()
    o=bpy.data.objects.new(name,d);groups[g].objects.link(o);o.data.materials.append(mat);o['assembly']=g;o['role']=role
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    if thick:
        m=o.modifiers.new('Structural skin thickness','SOLIDIFY');m.thickness=thick;m.offset=0;m.use_even_offset=True
    if bevel:
        m=o.modifiers.new('Controlled edge break','BEVEL');m.width=bevel;m.segments=3;m.limit_method='ANGLE';m.angle_limit=.25
        m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
# Explicit cubic Bezier longitudinal rails. The same control points and
# handles drive the sampled mesh and are saved as editable source curves.
def rail(name,pts,tension=.65):
    p=[Vector(q) for q in pts];h=[]
    for i,v in enumerate(p):
        if i==0:d=(p[1]-v)*tension/3
        elif i==len(p)-1:d=(v-p[i-1])*tension/3
        else:d=(p[i+1]-p[i-1])*tension/6
        h.append(d)
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';s=c.splines.new('BEZIER');s.bezier_points.add(len(p)-1)
    for q,v,d in zip(s.bezier_points,p,h):
        q.handle_left_type=q.handle_right_type='FREE';q.co=xyz(v);q.handle_left=xyz(v-d);q.handle_right=xyz(v+d)
    o=bpy.data.objects.new(name,c);groups['construction'].objects.link(o);o.hide_set(True)
    samples=[]
    for i in range(len(p)-1):
        a,b,c,d=p[i],p[i]+h[i],p[i+1]-h[i+1],p[i+1]
        for j in range(8):
            t=j/8;u=1-t;samples.append(a*u**3+3*b*u*u*t+3*c*u*t*t+d*t**3)
    samples.append(p[-1]);return samples
def patch(name,g,stations,role,thick=.42,tensions=None):
    # stations are 3-D cross sections, not an extruded 2-D silhouette.
    # Independent longitudinal Bezier tension per rail. Across-width facets
    # are preserved by explicit ridge rails and a small edge break.
    rails=[rail(name+'_rail_'+str(k),[s[k] for s in stations],(tensions or [.65]*len(stations[0]))[k]) for k in range(len(stations[0]))]
    n=len(rails);vs=[tuple(r[i]) for i in range(len(rails[0])) for r in rails]
    fs=[(i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j) for i in range(len(rails[0])-1) for j in range(n-1)]
    o=mesh(name,g,vs,fs,role,thick,.075)
    # Mark longitudinal hard character lines; smooth only across non-ridge edges.
    for e in o.data.edges:
        a,b=e.vertices
        if a%n==b%n and a%n in (1,n-2):e.use_edge_sharp=True
    return o
# Broad rising upper load paths. Each row specifies inner edge, ridge and
# outer edge independently. No continuous lower hull or padded loop.
front=[(37.8,.10,.22,.45,.12,.20,.02),(34,.50,1.65,3.1,.55,1.05,.20),(29,2.2,4.3,6.6,1.8,2.65,.40),(23,5.25,7.5,10.1,3.2,4.35,.45),(16,5.8,8.1,10.3,3.5,4.55,.85),(9,4.9,7.2,9.0,3.5,5.5,1.1),(5.0,3.8,5.7,7.0,3.4,5.5,2.0),(3.0,3.3,4.9,5.9,2.6,4.55,2.0)]
rear=[(-3.0,3.35,4.9,6.0,2.6,4.55,2),(-6,4.2,6.4,8.1,3.4,5.1,1.3),(-12,5.5,7.8,9.8,3.8,4.65,.7),(-20,5.8,8.2,10.2,4.0,4.65,.9),(-26,4.7,7.1,9.2,4.4,5.1,1.9),(-31,3.2,5.6,7.4,5.1,6.0,3.5),(-35,1.6,3.8,5.2,5.7,6.25,4.4)]
for g,rows in [('front',front),('rear',rear)]:
    for s in [-1,1]:
        stations=[]
        for z,a,b,c,y1,y2,y3 in rows:
            stations.append([(s*a,y1,z),(s*(a+.12*(b-a)),y1+.08,z),(s*b,y2,z),(s*(b+.10*(c-b)),y2-.10,z),(s*c,y3,z)])
        patch(g+'_upper_spar_'+str(s),g,stations,'primary spar',.46,[.58,.55,.70,.70,.50])
        # Lower diverging aero blade, deliberately separated from upper by
        # a through-channel. Supports are separate transverse webs.
        sub=rows[2:-1] if g=='front' else rows[1:-1]
        st=[]
        for z,a,b,c,y1,y2,y3 in sub:
            st.append([(s*(a-.65),-2.05,z),(s*(b-.3),-2.65,z),(s*(c-.15),-.65,z)])
        patch(g+'_lower_spar_'+str(s),g,st,'lower load path',.48,[.62,.68,.58])
# Open fork nose: tiny solid leading blade joins the two primary spars;
# the longitudinal channel opens behind the tip.
patch('nose_knife','front',[[(-.12,.04,37.8),(0,.05,37.9),(.12,.01,37.8)],[(-.65,.21,36.5),(0,.52,36.8),(.65,.21,36.5)],[(-1.55,.50,34.2),(0,.83,34.8),(1.55,.50,34.2)],[(-2.25,.8,32.2),(0,.90,33.0),(2.25,.8,32.2)]],'nose bridge',.29)
# Thin standing inserts (open underside except for two discrete cross webs).
def tread(g,rows):
    stations=[[( -w,y-.13,z),(-w+.35,y,z),(0,y+.05,z),(w-.35,y,z),(w,y-.13,z)] for z,w,y in rows]
    patch(g+'_suspended_insert',g,stations,'standing insert',.55,[.45,.55,.65,.55,.45])
tread('front',[(27,1.85,2.7),(24,3.7,3.35),(18,4.85,3.72),(12,4.5,3.78),(9,2.8,3.65)])
tread('rear',[(-9,2.6,3.72),(-13,4.5,4.05),(-20,4.85,4.25),(-25,3.9,4.58),(-28.7,2.3,4.85)])
def web(g,z,half,y):
    # Bent transverse webs with open bays fore and aft.
    patch(g+'_cross_web_'+str(z),g,[[(-half,y-.85,z-.6),(-half*.55,y-.3,z-.6),(0,y,z-.6),(half*.55,y-.3,z-.6),(half,y-.85,z-.6)],[(-half,y-.85,z+.6),(-half*.55,y-.3,z+.6),(0,y,z+.6),(half*.55,y-.3,z+.6),(half,y-.85,z+.6)]],'support web',.62)
for g,zs in [('front',[(23,7.5,3.08),(13,7.5,3.47)]),('rear',[(-14,7.5,3.8),(-24,7.0,4.3)])]:
    for z,w,y in zs:web(g,z,w,y)
# Each moving half has two descending mount webs terminating at the pod rim.
for g,z in [('front',20),('rear',-21)]:
    for s in [-1,1]:
        patch(g+'_pod_mount_'+str(s),g,[[(s*4.2,-3.5,z-4),(s*5.6,-2.7,z-4),(s*6.8,-1.8,z-4)],[(s*4.6,-3.65,z),(s*6.0,-2.7,z),(s*7.5,-1.45,z)],[(s*4.2,-3.5,z+4),(s*5.6,-2.7,z+4),(s*6.8,-1.8,z+4)]],'pod mount',.65)
# Suspended rear aerofoil, swept back and rising from two roots. Clear
# aperture below the span. Not an enclosed cap.
tail=[]
for x,lead,trail,h in [(-5.5,-29,-34.5,5.75),(-4.9,-28,-34,7.4),(-2.8,-26,-33,8.2),(0,-25.6,-32.8,8.45),(2.8,-26,-33,8.2),(4.9,-28,-34,7.4),(5.5,-29,-34.5,5.75)]:
    tail.append([(x,h-.30,lead),(x,h,lead-.9),(x,h-.15,trail+.8),(x,h-.4,trail)])
patch('rear_suspended_aerofoil','rear',tail,'tail wing',.52,[.65,.70,.70,.60])
# Machined compact central torsion and visible open propulsion rings.
def ring(name,g,center,axis,profile,role,n=64):
    vs=[];fs=[]
    for r,d in profile:
        for j in range(n):
            a=j*2*pi/n;p=(d,r*cos(a),r*sin(a)) if axis=='x' else (r*cos(a),d,r*sin(a))
            vs.append(tuple(center[k]+p[k] for k in range(3)))
    for i in range(len(profile)):
        for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,((i+1)%len(profile))*n+(j+1)%n,((i+1)%len(profile))*n+j))
    return mesh(name,g,vs,fs,role,0,.05)
ring('torsion_core','joint',(0,0,0),'x',[(2.2,-2.6),(3.65,-2.6),(4.05,-2.1),(4.05,2.1),(3.65,2.6),(2.2,2.6)],'gimbal')
for s in [-1,1]:ring('torsion_collar_'+str(s),'joint',(0,0,0),'x',[(1.4,s*2.62),(3.55,s*2.62),(3.65,s*3.1),(3.2,s*3.35),(1.4,s*3.35)],'gimbal collar')
# Separate bearing forks connect moving frames toward each collar; no rigid
# front-to-rear member. Mechanical overlap is measured, not assumed safe.
for g,s in [('front',1),('rear',-1)]:
    for x in [-1,1]:
        patch(g+'_bearing_fork_'+str(x),g,[[(x*3.45,.25,s*1.0),(x*4.0,.75,s*1.0),(x*4.4,1.2,s*1.0)],[(x*3.6,.5,s*3.0),(x*4.8,1.1,s*3.0),(x*5.7,1.65,s*3.0)],[(x*4.2,.7,s*6.0),(x*5.7,1.2,s*6.0),(x*7.0,1.6,s*6.0)]],'bearing fork',.65)
for g,z,r in [('front_pod',20,6.1),('rear_pod',-21,5.9)]:
    ring(g+'_outer_housing',g,(0,-3.2,z),'y',[(r*.72,-2.4),(r,-2.05),(r*1.02,-.6),(r*.91,.3),(r*.70,.3),(r*.68,-1.9)],'propulsion housing')
    ring(g+'_inner_hub',g,(0,-3.2,z),'y',[(.55,-2.52),(r*.3,-2.52),(r*.34,-1.7),(r*.27,-.4),(.55,-.4)],'propulsion hub')
    vs=[];fs=[]
    for j in range(24):
        a=(j+.12)*2*pi/24;b=(j+.86)*2*pi/24;o=len(vs)
        for y in [-5.58,-5.23]:
            for rr,t in [(r*.38,a),(r*.69,a),(r*.69,b),(r*.38,b)]:vs.append((rr*cos(t),y,z+rr*sin(t)))
        fs.extend(tuple(o+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh(g+'_radial_elements',g,vs,fs,'radial elements',0,.035)
scene['reference_sha256']='b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555'
scene['stage']='EXOSKELETON / clay candidate';scene['units']='authoring units; 0.001 atlas units each'
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(m)
    stats.append({'name':o.name,'assembly':o['assembly'],'role':o['role'],'controlVertices':len(o.data.vertices),'evaluatedTriangles':len(m.loop_triangles),'evaluatedNonManifoldEdges':sum(not e.is_manifold for e in bm.edges)})
    bm.free();ev.to_mesh_clear()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'VECTOR-005-EXOSKELETON-master.blend'))
report={'blender':bpy.app.version_string,'components':stats,'evaluatedTriangles':sum(p['evaluatedTriangles'] for p in stats),'constructionCurves':len(groups['construction'].objects),'qualification':'Unapproved clay; rail curves feed sampled patches at build time, not live dependencies.'}
json.dump(report,open(os.path.join(out,'exoskeleton-report.json'),'w'),indent=2)
print('EXO_MASTER',json.dumps({k:v for k,v in report.items() if k!='components'}))
