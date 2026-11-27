"""TENSION 003.1 — front-only structural refinement of immutable EXOSKELETON.
No changes to rear, joint or propulsion geometry, no export or livery.
Coordinates in authoring units; atlas (x,y,z) -> Blender (x,-z,y).
"""
import bpy,bmesh,sys,os,json,math,hashlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(source)=='f68448915a32bbdf00bb9eaded3545b31f44afd4f6d321f85b823f0248ab37c0'
bpy.ops.wm.open_mainfile(filepath=source);scene=bpy.context.scene
def xyz(v):return (v[0],-v[2],v[1])
front=bpy.data.collections['front'];guides=bpy.data.collections.new('TENSION construction');scene.collection.children.link(guides);guides.hide_render=True
mat=bpy.data.materials['Neutral clay']
for o in list(front.objects):bpy.data.objects.remove(o,do_unlink=True)
# Frozen rear is retained in this derivative for clearance only.
for o in scene.objects:
    if o.get('assembly','').startswith('rear'):o.hide_render=True;o.hide_set(True)
def make(name,vs,faces,role,thick,bevel=.045):
    d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in vs],[],faces);d.update()
    o=bpy.data.objects.new(name,d);front.objects.link(o);o['assembly']='front';o['role']=role;o.data.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    if thick:
        m=o.modifiers.new('Selective structural thickness','SOLIDIFY');m.thickness=thick;m.offset=0;m.use_even_offset=False
    if bevel:
        m=o.modifiers.new('Controlled edge radius','BEVEL');m.width=bevel;m.segments=3;m.limit_method='ANGLE';m.angle_limit=.45
    return o
def sample(name,pts,tension=.92):
    p=[Vector(q) for q in pts];h=[(p[min(i+1,len(p)-1)]-p[max(0,i-1)])*tension/(3 if i in (0,len(p)-1) else 6) for i in range(len(p))]
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';s=d.splines.new('BEZIER');s.bezier_points.add(len(p)-1)
    for q,v,k in zip(s.bezier_points,p,h):q.handle_left_type=q.handle_right_type='FREE';q.co=xyz(v);q.handle_left=xyz(v-k);q.handle_right=xyz(v+k)
    o=bpy.data.objects.new(name,d);guides.objects.link(o);o.hide_set(True)
    out=[]
    for i in range(len(p)-1):
        a,b,c,e=p[i],p[i]+h[i],p[i+1]-h[i+1],p[i+1]
        for j in range(10):
            t=j/10;u=1-t;out.append(tuple(a*u**3+3*b*u*u*t+3*c*u*t*t+e*t**3))
    return out+[tuple(p[-1])]
# z, upper inner X/Y, upper ridge X/Y, upper outer X/Y,
# lower inner X/Y, lower ridge X/Y, lower outer X/Y.
# Deliberate longitudinal roll reversal; lower member wraps the pod's
# outside radius rather than forming a straight beam under the tread.
S=[
 (37.75,.045,.05,.13,.085,.23,.025,.045,-.12,.13,-.15,.23,-.13),
 (36.2,.20,.20,.64,.35,1.10,.12,.20,-.22,.65,-.32,1.10,-.23),
 (33,.72,.64,1.85,1.02,3.15,.30,1.05,-.55,2.25,-.78,3.18,-.45),
 (29,2.15,1.90,4.05,2.56,5.95,.72,3.05,-1.45,4.85,-1.84,5.95,-.88),
 (24,4.75,3.24,6.32,3.95,8.45,1.55,5.95,-2.35,7.30,-3.45,8.72,-1.78),
 (19,5.30,3.85,6.90,4.48,8.90,2.42,6.48,-2.55,7.85,-4.10,9.20,-2.62),
 (14,5.10,3.94,6.72,4.74,8.55,3.40,5.98,-2.2,7.18,-3.45,8.55,-2.55),
 (9,4.10,3.64,5.95,4.68,7.30,3.55,4.35,-1.42,5.85,-1.83,7.12,-.95),
 (5,3.55,2.64,4.82,3.60,6.05,2.65,3.50,-.82,4.65,-.98,5.88,-.35),
 (2.5,3.50,1.25,4.05,1.65,4.80,1.18,3.50,.20,4.02,.10,4.80,.20),
 (1.7,3.48,.78,3.92,.91,4.34,.68,3.48,.10,3.92,.06,4.34,.08)]
# One continuous surface network. Top left/right share a real nose bridge;
# lower/upper join through tapered end faces instead of intersecting plates.
vs=[];fs=[];grid={}
for side in [-1,1]:
    for level,offset in [('upper',1),('lower',7)]:
        rails=[]
        for k in range(3):
            pts=[(side*row[offset+k*2],row[offset+k*2+1],row[0]) for row in S]
            rails.append(sample('TENSION_'+str(side)+'_'+level+'_'+str(k),pts))
        # Interpolate transverse surface with a continuous quadratic blend
        # through the midpoint. More than a three-rail planar extrusion.
        rows=[]
        for i in range(len(rails[0])):
            a,b,c=map(Vector,[r[i] for r in rails]);q=2*b-.5*(a+c)
            ids=[]
            for j in range(9):
                t=j/8;u=1-t;p=a*u*u+2*q*u*t+c*t*t
                ids.append(len(vs));vs.append(tuple(p))
            rows.append(ids)
        grid[side,level]=rows
        for i in range(len(rows)-1):
            for j in range(8):fs.append((rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]))
    u,l=grid[side,'upper'],grid[side,'lower']
    for end in [0,len(u)-1]:
        for j in range(8):fs.append((u[end][j],l[end][j],l[end][j+1],u[end][j+1]))
# Nose bridge only forward of 33; identical shared vertices, no duplicate
# coincident faces. Opening extends from the end of this bridge to the gimbal.
for level in ['upper','lower']:
    a,b=grid[-1,level],grid[1,level]
    for i in range(20):fs.append((a[i][0],b[i][0],b[i+1][0],a[i+1][0]))
# Close the small leading central edge between the joined surfaces.
fs.append((grid[-1,'upper'][0][0],grid[-1,'lower'][0][0],grid[1,'lower'][0][0],grid[1,'upper'][0][0]))
frame=make('TENSION_continuous_frame',vs,fs,'continuous frame',.28,.035)
def patch(name,stations,role,thick=.45):
    rails=[sample(name+'_rail_'+str(k),[r[k] for r in stations],.78) for k in range(len(stations[0]))];n=len(rails);v=[r[i] for i in range(len(rails[0])) for r in rails]
    f=[(i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j) for i in range(len(rails[0])-1) for j in range(n-1)]
    return make(name,v,f,role,thick)
# Tread is suspended just inside upper frame, with discrete shaped bridges.
rows=[(28,1.55,2.36),(25,3.4,3.10),(20,4.68,3.56),(15,4.55,3.72),(10,3.0,3.52),(8.5,1.7,3.30)]
patch('TENSION_tread',[[(-w,y-.08,z),(-w*.78,y,z),(0,y+.08,z),(w*.78,y,z),(w,y-.08,z)] for z,w,y in rows],'standing insert',.48)
# Cross webs terminate at actual frame rail stations, not guessed widths.
for station,deckY in [(4,3.22),(6,3.68)]:
    row=S[station];z=row[0];x,y=row[1],row[2]
    patch('TENSION_web_'+str(station),[[(-x-.18,y,z-.6),(-x*.52,deckY-.32,z-.6),(0,deckY-.32,z-.6),(x*.52,deckY-.32,z-.6),(x+.18,y,z-.6)],[(-x-.18,y,z+.6),(-x*.52,deckY-.32,z+.6),(0,deckY-.32,z+.6),(x*.52,deckY-.32,z+.6),(x+.18,y,z+.6)]],'support web',.62)
# Split swept mount saddles approach the preserved annular pod radially.
# No solid plate over the propulsion mechanism. The lower frame passes
# outside its radius; discrete saddles provide a provisional mating interface.
for s in [-1,1]:
    patch('TENSION_pod_saddle_'+str(s),[
      [(s*4.8,-2.4,25),(s*5.9,-2.7,25),(s*6.9,-2.8,24)],
      [(s*5.7,-2.6,22),(s*6.55,-3.0,22),(s*7.6,-3.5,22)],
      [(s*5.9,-2.55,19),(s*6.65,-3.0,19),(s*7.85,-4.0,19)],
      [(s*4.9,-2.3,15.6),(s*5.8,-2.7,15.6),(s*6.9,-3.3,16)]],'pod saddle',.50)
# The frame itself converges to bearing tips. A local machined sleeve gives
# the interface a defined geometry; its contact with fixed collar is checked.
for s in [-1,1]:
    v=[];f=[];n=48
    for x,r in [(3.33,3.15),(3.72,3.15),(4.12,3.4),(4.12,3.72),(3.45,3.72),(3.33,3.55)]:
        for j in range(n):
            a=j*2*math.pi/n;v.append((s*x,r*math.cos(a),r*math.sin(a)))
    for k in range(6):
        for j in range(n):f.append((k*n+j,k*n+(j+1)%n,((k+1)%6)*n+(j+1)%n,((k+1)%6)*n+j))
    make('TENSION_bearing_sleeve_'+str(s),v,f,'bearing sleeve',0,.025)
scene['stage']='TENSION 003.1 / front-only unapproved clay'
scene['source_sha256']=sha(source)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in front.objects:
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(m)
    stats.append({'name':o.name,'role':o['role'],'triangles':len(m.loop_triangles),'controlVertices':len(o.data.vertices),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)})
    bm.free();ev.to_mesh_clear()
dest=os.path.join(out,'VECTOR-005-TENSION-front.blend');bpy.ops.wm.save_as_mainfile(filepath=dest)
report={'sourceSha256':sha(source),'masterSha256':sha(dest),'frontComponents':stats,'evaluatedFrontTriangles':sum(x['triangles'] for x in stats),'note':'Frozen rear retained hidden; original joint and pod meshes unchanged. Creative study only; no actual load validation.'}
json.dump(report,open(os.path.join(out,'tension-build.json'),'w'),indent=2);print('TENSION_BUILD',json.dumps(report))
