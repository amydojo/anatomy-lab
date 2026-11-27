"""TENSION matched front-only clay and reflected-stripe surface diagnostics.
Uses exact camera matrices and scale from artifact 15165131408.
Zebra is a world reflection test, not applied decoration or production livery.
"""
import bpy,sys,os,json,hashlib
from mathutils import Vector,Euler
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
path=os.path.abspath(arg('master'));out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
edition=arg('edition');mode=arg('mode');proof=json.load(open(arg('baseline')))
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert proof['sourceSha256']=='925527d37b4a9974fd131c69815ac6a23d7f5c1dd3fa7984cc75f57e9bea8980'
if edition=='before':assert sha(path)==proof['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=path);scene=bpy.context.scene
def xyz(p):return Vector((p[0],-p[2],p[1]))
for o in list(scene.objects):
    if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
    elif o.type=='MESH':o.hide_render=o.get('assembly','') not in ('front','front_pod','joint')
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
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.threads_mode='FIXED';scene.render.threads=4
report={'edition':edition,'mode':mode,'sourceSha256':sha(path),'baselineProofSha256':sha(arg('baseline')),'views':[]}
views=list(proof['views'])
# Identical closeup framing for both editions; full views are the exact
# original TENSION camera transforms, not independently re-fit.
for name,focus,direction,scale in [('nose',(0,.3,34.7),(1,.42,.7),10),('propulsion',(0,-2.7,20),(1,-.52,.42),22),('bearing',(0,1,2.8),(1,.36,.55),16)]:
    rot=xyz(direction).to_track_quat('Z','Y').to_euler()
    views.append({'view':name,'center':list(xyz(focus)),'rotation':list(rot),'orthographicScale':scale,'close':True})
if '--details-only' in args:views=[v for v in views if v.get('close')]
for v in views:
    name=v['view']
    if mode=='zebra' and name=='side':continue
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.rotation_euler=Euler(v['rotation']);o.location=Vector(v['center'])+o.rotation_euler.to_matrix()@Vector((0,0,140));d.type='ORTHO';d.ortho_scale=v['orthographicScale'];d.clip_end=500;scene.camera=o;bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get();uv=[]
    for obj in scene.objects:
        if obj.type!='MESH' or obj.hide_render:continue
        ev=obj.evaluated_get(deps);msh=ev.to_mesh();uv.extend(world_to_camera_view(scene,o,ev.matrix_world@p.co) for p in msh.vertices);ev.to_mesh_clear()
    rect=[min(p.x for p in uv),min(p.y for p in uv),max(p.x for p in uv),max(p.y for p in uv)]
    if not v.get('close') and (min(rect[:2])<.02 or max(rect[2:])>.98):raise RuntimeError('Matched camera clips new candidate '+name+str(rect))
    dest=os.path.join(out,edition+'-'+mode+'-'+name+'.png');scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
    report['views'].append({'view':name,'file':os.path.basename(dest),'sha256':sha(dest),'orthographicScale':d.ortho_scale,'center':v['center'],'rotation':v['rotation'],'projectedBounds':rect,'intentionalCloseup':bool(v.get('close'))})
    json.dump(report,open(os.path.join(out,edition+'-'+mode+'-report.json'),'w'),indent=2)
print('PRECISION_PROOF',json.dumps(report))
