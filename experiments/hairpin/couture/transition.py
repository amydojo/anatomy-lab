"""Reversible fictional expansion proof. Actual protected mesh endpoint.
No mechanical folding claim; compact shell is a separate topology.
"""
import bpy,sys,hashlib,json,math,itertools
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
src=arg('source');out=arg('out');out.mkdir(parents=True,exist_ok=True)
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
assert hashlib.sha256(src.read_bytes()).hexdigest()==expected
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene
parts=[(o,o.matrix_world.copy(),o.get('assembly')) for o in s.objects if o.type=='MESH']
assert len(parts)==25 and {g for o,m,g in parts}=={'front','rear','front_pod','rear_pod','joint'}
for o in list(s.objects):
    if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for layer in s.view_layers:layer.material_override=None
with bpy.data.libraries.load(str(arg('compact')),link=False) as (a,b):
    b.objects=[n for n in a.objects if n.startswith(('SWITCH','Orchid'))]
shell=[]
for o in b.objects:
    if o and o.type=='MESH':
        s.collection.objects.link(o);shell.append((o,o.matrix_world.copy()))
assert len(shell)==5
# Illustrative conversion only: 10 mm per authoring unit. Source native units unchanged.
orient=Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Scale(.1,4)
if s.world is None:s.world=bpy.data.worlds.new('COUTURE stage')
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for name,loc,power,size in [('Key',(30,-30,65),90000,65),('Strip',(-40,35,30),70000,45),('Rim',(15,40,-25),45000,42)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size*.28
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('COUTURE camera');cam=bpy.data.objects.new('COUTURE camera',camd);s.collection.objects.link(cam);s.camera=cam
camd.type='ORTHO';camd.clip_end=2000;cam.location=(100,-85,140);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
def matrix_error(a,b):return max(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))
def inspect(objects):
    dg=bpy.context.evaluated_depsgraph_get();items=[]
    for o in objects:
        e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles()
        v=[e.matrix_world@a.co for a in me.vertices];f=[tuple(p.vertices) for p in me.loop_triangles];e.to_mesh_clear()
        lo=[min(p[k] for p in v) for k in range(3)];hi=[max(p[k] for p in v) for k in range(3)]
        items.append((o.name,lo,hi,BVHTree.FromPolygons(v,f,all_triangles=True)))
    hits=[]
    for a,b in itertools.combinations(items,2):
        if any(a[2][k]<b[1][k] or b[2][k]<a[1][k] for k in range(3)):continue
        n=len(a[3].overlap(b[3]))
        if n:hits.append({'a':a[0],'b':b[0],'trianglePairs':n})
    return hits
def apply(t):
    release=phase(t,.10,.30);expand=phase(t,.30,.83);lock=phase(t,.72,.92);ignite=phase(t,.92,1)
    # Fictional matter-scale change; no hidden volume conservation.
    scale=.015+.985*expand
    # Core exists from the start, below visual resolution; report containment as unproven.
    for o,m,g in parts:
        offset=Vector((0,0,0))
        sign=1 if g.startswith('front') else -1 if g.startswith('rear') else 0
        offset.y=sign*3.2*expand*(1-lock)
        offset.z=(2.2 if 'pod' in g else 0)*expand*(1-lock)
        o.matrix_world=Matrix.Translation(offset)@Matrix.Scale(scale,4)@m
        o.hide_render=False
    # The shell visibly separates; topology mismatch is disclosed.
    # Its fictional retraction approaches zero then is hidden at the end.
    shrink=max(.001,1-expand)
    for i,(o,m) in enumerate(shell):
        a=(i-(len(shell)-1)/2)*.19*release*(1-lock)
        shift=Vector(((-1)**i*release*1.7*(1-lock),0,0))
        rot=Matrix.Rotation(a,4,'Y')
        if 'deployant leaf' in o.name:
            p=Vector((-40,0,-2.7));m=Matrix.Translation(p)@Matrix.Rotation(math.radians(65)*release,4,'Y')@Matrix.Translation(-p)@m
        o.matrix_world=Matrix.Translation(shift)@Matrix.Scale(shrink,4)@rot@orient@m
        o.hide_render=expand>=1
    bpy.context.view_layer.update()
    return scale,shrink,ignite
# No master material or transforms saved to source. Original emission restored exactly.
emit=[]
for o,m,g in parts:
    if 'pod' in g:
        for i,mat in enumerate(o.data.materials):
            if mat and mat.get('family')=='amber' and mat.use_nodes:
                c=mat.copy();o.data.materials[i]=c
                p=c.node_tree.nodes.get('Principled BSDF')
                if p and 'Emission Strength' in p.inputs:
                    socket=p.inputs['Emission Strength'];emit.append((socket,socket.default_value))
report={'sourceSha256':expected,'candidate':'C03 SWITCH (provisional choreography proxy, not selection)','illustrativeMmPerUnit':10,'fictional':True,'mechanicalQualification':False,'limitations':['No volume conservation or continuous clearance.','Distinct compact shell topology retracts to near zero and is hidden; not a topology-preserving morph.','Sampled surface overlaps include historical contacts; no containment or nesting validation.','Static native endpoint; no gameplay or hover solver integration.'],'samples':[]}
N=49
for i in range(N):
    t=i/(N-1);scale,shrink,ignite=apply(t)
    for socket,target in emit:socket.default_value=target*ignite
    camd.ortho_scale=15+85*phase(t,.28,.88)
    dest=out/f'frame-{i:04d}.png';s.render.filepath=str(dest)
    if i%4==0 or i==N-1:
        visible=[o for o,m,g in parts]+[o for o,m in shell if not o.hide_render]
        report['samples'].append({'t':t,'scale':scale,'shellScale':shrink,'shellHidden':shell[0][0].hide_render,'worldMatrices':{o.name:[list(row) for row in o.matrix_world] for o in visible},'surfaceOverlaps':inspect(visible)})
    bpy.ops.render.render(write_still=True)
error=max(matrix_error(o.matrix_world,m) for o,m,g in parts)
report['endpointMaxMatrixError']=error;report['endpointPartCount']=len(parts)
assert error<1e-6 and all(o.hide_render for o,m in shell)
assert hashlib.sha256(src.read_bytes()).hexdigest()==expected
(out/'transition-evidence.json').write_text(json.dumps(report,indent=2))
print('COUTURE endpoint matrix error',error)
