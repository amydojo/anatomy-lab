"""Persistent-surface choreography proxy: ALL 25 actual source parts visible
throughout; no separate shell, no topology change, no claim of mechanical fold.
Not an exact SERPENT-002 compact endpoint. Source SHA pinned, never saved."""
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
bpy.context.view_layer.update()
parts=[(o,o.matrix_world.copy(),o['assembly']) for o in s.objects if o.type=='MESH']
assert len(parts)==25 and {g for o,m,g in parts}=={'front','rear','front_pod','rear_pod','joint'}
assert not any(o.hide_render for o,m,g in parts)
def evaluated(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles()
    v=[e.matrix_world@a.co for a in me.vertices];f=[tuple(p.vertices) for p in me.loop_triangles];e.to_mesh_clear();return v,f
baseline={o.name:evaluated(o) for o,m,g in parts}
for o in list(s.objects):
    if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for layer in s.view_layers:layer.material_override=None;layer.cycles.use_denoising=False
if s.world is None:s.world=bpy.data.worlds.new('COUTURE stage')
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for name,loc,power,size in [('Key',(30,-30,65),90000,65),('Strip',(-40,35,30),70000,45),('Rim',(15,40,-25),45000,42)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size*.28
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('COUTURE camera');cam=bpy.data.objects.new('COUTURE camera',camd);s.collection.objects.link(cam);s.camera=cam
camd.type='ORTHO';camd.clip_end=2000;cam.location=(95,-75,150);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
def matrix_error(a,b):return max(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))
def inspect():
    items=[];allv=[]
    for o,m,g in parts:
        v,f=evaluated(o);allv+=v
        lo=[min(p[k] for p in v) for k in range(3)];hi=[max(p[k] for p in v) for k in range(3)]
        items.append((o.name,lo,hi,BVHTree.FromPolygons(v,f,all_triangles=True)))
    hits=[]
    for a,b in itertools.combinations(items,2):
        if any(a[2][k]<b[1][k] or b[2][k]<a[1][k] for k in range(3)):continue
        n=len(a[3].overlap(b[3]))
        if n:hits.append({'a':a[0],'b':b[0],'trianglePairs':n})
    return hits,[max(p[k] for p in allv)-min(p[k] for p in allv) for k in range(3)]
basehits,_=inspect();basepairs={frozenset((h['a'],h['b'])) for h in basehits}
def apply(t):
    release=phase(t,.08,.26);unfold=phase(t,.20,.76);expand=phase(t,.33,.88);lock=phase(t,.76,.94)
    for o,m,g in parts:
        # Atlas forward maps to Blender -Y. Front and rear fold into parallel
        # longitudinal ribbons around shared source origin, NOT a certified hinge.
        sign=1 if g.startswith('front') else -1 if g.startswith('rear') else 0
        angle=sign*math.pi/2*(1-unfold)
        # Fictional axis-specific contraction: preserves topology but not rigidity or volume.
        sx=.12+.88*expand;sy=.30+.70*expand;sz=.11+.89*expand
        if sign==0:sx=.24+.76*expand;sy=.24+.76*expand;sz=.24+.76*expand
        S=Matrix.Diagonal((sx,sy,sz,1));R=Matrix.Rotation(angle,4,'Z')
        shift=Vector((-5.1*(1-expand),sign*(.9*(1-unfold)+.45*release*(1-lock)),0))
        # Pods stay attached to their own assembly; no independent floating offset.
        A=Matrix.Translation(shift)@R@S
        o.matrix_world=m if t==1 else A@m
    bpy.context.view_layer.update()
    return {'release':release,'unfold':unfold,'fictionalExpansion':expand,'lock':lock}
emit=[]
for o,m,g in parts:
    if 'pod' in g:
        for i,mat in enumerate(o.data.materials):
            if mat and mat.get('family')=='amber' and mat.use_nodes:
                copy=mat.copy();o.data.materials[i]=copy
                p=copy.node_tree.nodes.get('Principled BSDF')
                if p and 'Emission Strength' in p.inputs:socket=p.inputs['Emission Strength'];emit.append((socket,socket.default_value))
report={'sourceSha256':expected,'mechanicalQualification':False,'wearableEndpoint':'folded actual-VECTOR proxy; NOT the separate integrated SERPENT-002 master','illustrativeMmPerUnit':10,'correspondence':{'front frame':'first prong proxy','rear frame':'second prong proxy','torsion core and collars':'crown/axis proxy','standing inserts and webs':'persistent nested blade surfaces','pods':'persistent contracted underside housings'},'sourcePartNames':[o.name for o,m,g in parts],'baselineSurfacePairs':basehits,'limitations':['No compact topology identity with the separate U-ribbon fashion master.','Affine contraction is fictional nonrigid scale change, not mechanical nesting.','Shared origin is hypothetical, not actual new hinge.','Baseline-name matching is not proof of historically qualified local contact.','No physical scale, containment, retention, continuous collision or hover solver claim.','Native source geometry and final evaluated positions restored; temporary emission material copies only.'],'samples':[]}
N=49;preflight='--preflight' in args
if preflight:s.cycles.samples=8;s.render.resolution_x=320;s.render.resolution_y=180
for i in ([0,N-1] if preflight else range(N)):
    t=i/(N-1);state=apply(t);ignite=phase(t,.92,1)
    for socket,target in emit:socket.default_value=target*ignite
    camd.ortho_scale=17+79*phase(t,.22,.9)
    if i%4==0 or i==N-1:
        hits,bounds=inspect();report['samples'].append({'t':t,'state':state,'boundsAuthoring':bounds,'visibleParts':sum(not o.hide_render for o,m,g in parts),'worldMatrices':{o.name:[list(row) for row in o.matrix_world] for o,m,g in parts},'surfaceOverlaps':hits,'nonBaselinePairNames':[h for h in hits if frozenset((h['a'],h['b'])) not in basepairs]})
    dest=out/f'frame-{i:04d}.png';s.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
    assert dest.stat().st_size>1000
    (out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
error=max(matrix_error(o.matrix_world,m) for o,m,g in parts);verror=0
for o,m,g in parts:
    v,f=evaluated(o);oldv,oldf=baseline[o.name];assert f==oldf and len(v)==len(oldv)
    verror=max(verror,max((a-b).length for a,b in zip(v,oldv)))
report.update({'endpointMaxMatrixError':error,'endpointMaxEvaluatedVertexError':verror,'endpointPartCount':len(parts),'visibilityChanges':0,'endpointTopologyEqual':True})
assert error<1e-6 and verror<1e-5 and all(not o.hide_render for o,m,g in parts)
assert hashlib.sha256(src.read_bytes()).hexdigest()==expected
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('METAMORPHOSIS',json.dumps({k:v for k,v in report.items() if k not in ('samples','baselineSurfacePairs')}))
