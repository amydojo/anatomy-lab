"""TENSION matched front-only clay and reflected-stripe surface diagnostics.
Uses exact camera matrices and scale from artifact 15165131408.
Zebra is a world reflection test, not applied decoration or production livery.
"""
import bpy,sys,os,json,hashlib,math
from mathutils import Vector,Euler,Matrix
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
paths={'precision':os.path.abspath(arg('precision')),'exoskeleton':os.path.abspath(arg('exo')),'continuity':os.path.abspath(arg('master'))}
out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
edition=arg('edition');mode=arg('mode');subset=arg('subset')
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(paths['precision'])=='f2875d9b4cac18195d426a7f3939e891187e4d69ea1a701d1ee899fe335c4d1a'
assert sha(paths['exoskeleton'])=='f68448915a32bbdf00bb9eaded3545b31f44afd4f6d321f85b823f0248ab37c0'
def xyz(p):return Vector((p[0],-p[2],p[1]))
def open_model(name):
    bpy.ops.wm.open_mainfile(filepath=paths[name]);scene=bpy.context.scene
    for o in scene.objects:
        if o.type=='MESH':
            o.hide_set(False);o.hide_render=name=='precision' and o.get('assembly','').startswith('rear')
    bpy.context.view_layer.update();return scene
def points(scene):
    deps=bpy.context.evaluated_depsgraph_get();v=[]
    for o in scene.objects:
        if o.type!='MESH' or o.hide_render:continue
        ev=o.evaluated_get(deps);m=ev.to_mesh();v.extend(ev.matrix_world@p.co for p in m.vertices);ev.to_mesh_clear()
    return v
allpts=[]
for k in paths:allpts.extend(points(open_model(k)))
scene=open_model(edition);path=paths[edition]

for o in list(scene.objects):
    if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
    
m=bpy.data.materials.new('Temporary inspection override');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.44,.44,.44,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.36
for layer in scene.view_layers:layer.material_override=m;layer.cycles.use_denoising=False
if scene.world is None:scene.world=bpy.data.worlds.new('Proof world')
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value=(.12,.12,.12,1);bg.inputs['Strength'].default_value=.35
def light(name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
if mode=='clay':
    light('Broad key',(36,65,42),85000,48);light('Character strip',(-40,26,-38),62000,30);light('Rear rim',(15,48,-58),43000,32);light('Underside fill',(-20,-45,23),34000,42)
else:
    # Mirror-like diagnostic surface. Alternating world stripes reflect
    # through surface normals; camera rays see only a neutral background.
    p.inputs['Base Color'].default_value=(.72,.72,.72,1);p.inputs['Metallic'].default_value=1;p.inputs['Roughness'].default_value=.035
    nodes=scene.world.node_tree.nodes;links=scene.world.node_tree.links;nodes.clear()
    tc=nodes.new('ShaderNodeTexCoord');wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='Z';wave.inputs['Scale'].default_value=2.4;wave.inputs['Distortion'].default_value=0
    links.new(tc.outputs['Normal'],wave.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR';ramp.color_ramp.elements[0].position=.39;ramp.color_ramp.elements[0].color=(.018,.018,.018,1);ramp.color_ramp.elements[1].position=.61;ramp.color_ramp.elements[1].color=(1.8,1.8,1.8,1);links.new(wave.outputs['Fac'],ramp.inputs[0])
    stripes=nodes.new('ShaderNodeBackground');links.new(ramp.outputs['Color'],stripes.inputs['Color']);stripes.inputs['Strength'].default_value=1
    plain=nodes.new('ShaderNodeBackground');plain.inputs['Color'].default_value=(.12,.12,.12,1);plain.inputs['Strength'].default_value=.35
    lp=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader');links.new(lp.outputs['Is Camera Ray'],mix.inputs[0]);links.new(stripes.outputs[0],mix.inputs[1]);links.new(plain.outputs[0],mix.inputs[2]);o=nodes.new('ShaderNodeOutputWorld');links.new(mix.outputs[0],o.inputs['Surface'])
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
 'tail':((1,.15,-.7),(0,1,0),(0,5.7,-32,22))
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
report={'edition':edition,'mode':mode,'subset':subset,'sourceSha256':sha(path),'commonSourceHashes':{k:sha(p) for k,p in paths.items()},'views':[]}
def render(name,label,values=(0,0,0),extra=0):
    pose(*values);r,u,b,center,scale=frame(name,extra)
    d=bpy.data.cameras.new(label);o=bpy.data.objects.new(label,d);scene.collection.objects.link(o);o.location=center+b*140;o.rotation_euler=Matrix((r,u,b)).transposed().to_euler();d.type='ORTHO';d.ortho_scale=scale;d.clip_end=500;scene.camera=o;bpy.context.view_layer.update()
    uv=[world_to_camera_view(scene,o,p) for p in points(scene)];rect=[min(p.x for p in uv),min(p.y for p in uv),max(p.x for p in uv),max(p.y for p in uv)]
    close=views[name][2] is not None
    if not close and (min(rect[:2])<.035 or max(rect[2:])>.965):raise RuntimeError('Cropped full view '+label+str(rect))
    file=edition+'-'+mode+'-'+label+'.png';dest=os.path.join(out,file);scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
    report['views'].append({'view':label,'file':file,'sha256':sha(dest),'center':list(center),'rotation':list(o.rotation_euler),'orthographicScale':scale,'projectedBounds':rect,'intentionalCloseup':close,'pose':values})
    json.dump(report,open(os.path.join(out,edition+'-'+mode+'-'+subset+'-report.json'),'w'),indent=2)
if subset=='articulation':
    for name,p in [('rest',(0,0,0)),('carve',(.14,0,0)),('flight',(0,1,0)),('capture',(.07,.28,0)),('landing',(0,0,1.6))]:render('low-angle',name,p,4)
else:
    names={'all':list(views),'main':['front-hero','rear-hero','top','side','front','rear'],'details':['underside','low-angle','central','rear-propulsion','tail'],'matched':['front-hero','rear-hero','top','side','low-angle'],'zebra':['front-hero','rear-hero','side','low-angle','central','tail']}[subset]
    for name in names:render(name,name)
print('CONTINUITY_PROOF',json.dumps(report))
