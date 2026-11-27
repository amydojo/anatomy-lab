import bpy,sys,os,json,hashlib,math
from mathutils import Vector,Euler,Matrix
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
path=os.path.abspath(arg('master'));out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
edition=arg('edition');mode=arg('mode');subset=arg('subset')
baseline=json.load(open(arg('baseline')))
assert baseline['sourceSha256']=='464e25dea9fef7b609b0117a744d94f659aaa862bc8eedd7cc6ff4d40c481dfe'
recorded={v['view']:v for v in baseline['views']}
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
def xyz(p):return Vector((p[0],-p[2],p[1]))
bpy.ops.wm.open_mainfile(filepath=path);scene=bpy.context.scene
assert scene.get('source_sha256')=='1f55c85022e8f6a70fbf7f7c06617c8c01005b1a5ce178796a8ab112dd7dfe55'
def points(scene):
    deps=bpy.context.evaluated_depsgraph_get();v=[]
    for o in scene.objects:
        if o.type!='MESH' or o.hide_render:continue
        ev=o.evaluated_get(deps);m=ev.to_mesh();v.extend(ev.matrix_world@p.co for p in m.vertices);ev.to_mesh_clear()
    return v
allpts=points(scene)


for o in list(scene.objects):
    if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
for layer in scene.view_layers:layer.material_override=None;layer.cycles.use_denoising=False
if scene.world is None:scene.world=bpy.data.worlds.new('Studio')
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value=(.16,.16,.16,1);bg.inputs['Strength'].default_value=.65
def light(name,loc,power,size,shape='RECTANGLE',height=None,color=(1,1,1)):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape=shape;d.size=size;d.color=color
    if shape=='RECTANGLE':d.size_y=height or size*.35
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Long key',(30,65,32),95000,65,height=24)
light('Opposing softbox',(-45,28,-35),71000,50,height=18)
light('Rear strip',(18,44,-60),68000,55,height=12)
light('Underside fill',(-16,-45,22),37000,42,height=22)
if mode=='cinematic':
    bg.inputs['Strength'].default_value=.24
    light('Warm rear accent',(-32,15,-38),22000,30,color=(1,.40,.12))
    light('Cool rim',(35,22,38),25000,36,color=(.35,.67,1))
if mode=='id':
    colors={'petrol':(.04,.32,.65),'orange':(1,.26,.02),'silver':(.74,.74,.74),'carbon':(.13,.17,.20),'grip':(.28,.15,.38),'orchid':(.9,.02,.48),'amber':(1,.75,.04)}
    for mat in bpy.data.materials:
        if 'family' not in mat:continue
        n=mat.node_tree.nodes;l=mat.node_tree.links;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(*colors[mat['family']],1);e.inputs[1].default_value=1;o=n.new('ShaderNodeOutputMaterial');l.new(e.outputs[0],o.inputs[0])
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.threads_mode='FIXED';scene.render.threads=4
W,H=1600,1100;aspect=W/H
views={
 'front-hero':((82,49,96),(0,1,0),None),
 'rear-hero':((-82,46,-96),(0,1,0),None),
 'top':((0,1,0),(1,0,0),None),
 'side':((1,0,0),(0,1,0),None),
 'front':((0,0,1),(0,1,0),None),
 'rear':((0,0,-1),(0,1,0),None),
 'underside':((0,-1,0),(-1,0,0),None),
 'low-angle':((1,-.30,.58),(0,1,0),None),
 'central':((1,.22,.43),(0,1,0),(0,0,0,19)),
 'rear-propulsion':((1,-.58,-.35),(0,1,0),(0,-2.6,-21,25)),
 'tail':((1,.15,-.7),(0,1,0),(0,5.7,-32,22)),
 'wordmark':((1,.85,.25),(0,1,0),(6.5,3.8,19,23)),
 'grip':((.5,1,.3),(0,1,0),(0,3.8,19,23)),
 'ride-scale':((82,49,96),(0,1,0),None)
}
def frame(name,extra=0):
    direction,hint,focus=views[name];back=xyz(direction).normalized();right=xyz(hint).cross(back).normalized();up=back.cross(right).normalized()
    if focus is None:
        lo=[min(p.dot(v) for p in allpts) for v in (right,up,back)];hi=[max(p.dot(v) for p in allpts) for v in (right,up,back)]
        center=sum((v*(a+b)/2 for v,a,b in zip((right,up,back),lo,hi)),Vector())
        scale=max(hi[0]-lo[0],(hi[1]-lo[1])*aspect)*1.20+extra
    else:center=xyz(focus[:3]);scale=focus[3]
    return right,up,back,center,scale
# Exact existing visual-pose equations in authoring units. Apply only
# temporary object transforms, not mesh edits; master never saved.
original={o.name:o.matrix_world.copy() for o in scene.objects if o.type=='MESH'}
def pose(t,d,c):
    for name,base in original.items():
        o=bpy.data.objects[name];g=o.get('assembly','');a=t if g.startswith('front') else -t if g.startswith('rear') else 0
        dy=-c if g!='joint' else 0;dx=0
        if g.endswith('_pod'):
            off=-.6*d+.65*c;dx=math.sin(a)*off;dy+=math.cos(a)*off;a*=.35
        co,si=math.cos(a),math.sin(a)
        # convert atlas XY rotation to Blender XZ rotation.
        m=Matrix(((co,0,si,dx),(0,1,0,0),(-si,0,co,dy),(0,0,0,1)))
        o.matrix_world=m@base
    bpy.context.view_layer.update()
report={'edition':edition,'mode':mode,'subset':subset,'sourceSha256':sha(path),'baselineProofSha256':sha(arg('baseline')),'views':[]}
def state(label):
    emission={'rest':.55,'carve':.65,'flight':3.1,'capture':1.75,'landing':4.2}.get(label,.55)
    for mat in bpy.data.materials:
        if mat.get('family')=='amber':
            p=mat.node_tree.nodes.get('Principled BSDF')
            if p:p.inputs['Emission Strength'].default_value=emission
        if mat.get('family')=='orchid':
            p=mat.node_tree.nodes.get('Principled BSDF')
            if p:p.inputs['Roughness'].default_value=.17 if label=='carve' else .25
    return emission
def render(name,label,values=(0,0,0),extra=0):
    emission=state(label);pose(*values);v=recorded[label];center=Vector(v['center']);rotation=Euler(v['rotation']);scale=v['orthographicScale'];b=rotation.to_matrix()@Vector((0,0,1))
    d=bpy.data.cameras.new(label);o=bpy.data.objects.new(label,d);scene.collection.objects.link(o);o.location=center+b*140;o.rotation_euler=rotation;d.type='ORTHO';d.ortho_scale=scale;d.clip_end=500;scene.camera=o;bpy.context.view_layer.update()
    uv=[world_to_camera_view(scene,o,p) for p in points(scene)];rect=[min(p.x for p in uv),min(p.y for p in uv),max(p.x for p in uv),max(p.y for p in uv)]
    close=views[name][2] is not None
    if not close and (min(rect[:2])<.035 or max(rect[2:])>.965):raise RuntimeError('Cropped full view '+label+str(rect))
    file=edition+'-'+mode+'-'+label+'.png';dest=os.path.join(out,file);scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
    report['views'].append({'view':label,'file':file,'sha256':sha(dest),'center':list(center),'rotation':list(o.rotation_euler),'orthographicScale':scale,'projectedBounds':rect,'intentionalCloseup':close,'pose':values,'emissionStrength':emission})
    json.dump(report,open(os.path.join(out,edition+'-'+mode+'-'+subset+'-report.json'),'w'),indent=2)

if subset=='states':
    for name,p in [('rest',(0,0,0)),('carve',(.14,0,0)),('flight',(0,1,0)),('capture',(.07,.28,0)),('landing',(0,0,1.6))]:render('low-angle',name,p,4)
else:
    names={'hero':['front-hero'],'main':['front-hero','rear-hero','top','side'],'details':['low-angle','central','grip','tail','wordmark','rear-propulsion'],'id':['front-hero','underside'],'cinematic':['front-hero'],'ride':['ride-scale']}[subset]
    for name in names:render(name,name,extra=100 if name=='ride-scale' else 0)
print('AFTERBURN_PROOF',json.dumps(report))
