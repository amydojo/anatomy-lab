"""EXOSKELETON three-way clay proofs: all candidates share evaluated framing.
Orthographic orientation and common scale calculated from all mesh vertices.
"""
import bpy,sys,os,json,hashlib,math
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
paths={'first-light':os.path.abspath(arg('first')),'sculpt':os.path.abspath(arg('sculpt')),'exoskeleton':os.path.abspath(arg('exo'))}
out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
edition=arg('edition')
front_only='--front-only' in args
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(paths['first-light'])=='2bf525342c5a48fde5d6ef380f087b736109dd35c442513e79b7c6595c30ebdd'
assert sha(paths['sculpt'])=='996b0e91c3ed1fc5731b75c5bdbdf2efbabc8ec2306b78efe13bd93387a8ca32'
def xyz(p):return Vector((p[0],-p[2],p[1]))
def open_model(name):
    bpy.ops.wm.open_mainfile(filepath=paths[name]);scene=bpy.context.scene
    for o in scene.objects:
        if name=='first-light' and ('wordmark' in o.name or 'emblem' in o.name):o.hide_render=True
        if front_only and o.type=='MESH':
            group=o.get('assembly','')
            o.hide_render=not (group in ('front','front_pod','joint') or (name=='first-light' and any(x in o.name for x in ['__marrow_front_','__marrow_joint_'])))
    return scene
def points(scene):
    deps=bpy.context.evaluated_depsgraph_get();v=[]
    for o in scene.objects:
        if o.type!='MESH' or o.hide_render:continue
        ev=o.evaluated_get(deps);m=ev.to_mesh()
        v.extend(ev.matrix_world@p.co for p in m.vertices);ev.to_mesh_clear()
    return v
allpts=[]
for k in paths:allpts.extend(points(open_model(k)))
# Camera back vector and explicit up; top/underside put the longitudinal
# axis horizontally in the landscape proof, eliminating the old clipping.
views={
 'hero':((82,49,96),(0,1,0),None),
 'top':((0,1,0),(1,0,0),None),
 'side':((1,0,0),(0,1,0),None),
 'front':((0,0,1),(0,1,0),None),
 'rear':((0,0,-1),(0,1,0),None),
 'underside':((0,-1,0),(-1,0,0),None),
 'low-angle':((1,-.25,.6),(0,1,0),None),
 'gimbal':((1,.25,.45),(0,1,0),(0,0,0)),
 'standing-underside':((.7,-.8,.6),(0,1,0),(0,0,18))
}
if front_only:
    views={'hero':((82,49,96),(0,1,0),None),'low-angle':((1,-.32,.62),(0,1,0),None),'side':((1,0,0),(0,1,0),None)}
W,H=(1600,1100) if front_only else (1200,800);aspect=W/H
def frame(name):
    direction,up_hint,focus=views[name];back=xyz(direction).normalized()
    right=xyz(up_hint).cross(back).normalized();up=back.cross(right).normalized()
    if focus is None:
        lo=[min(p.dot(v) for p in allpts) for v in [right,up,back]]
        hi=[max(p.dot(v) for p in allpts) for v in [right,up,back]]
        center=sum((v*(a+b)/2 for v,a,b in zip([right,up,back],lo,hi)),Vector())
        scale=max(hi[0]-lo[0],(hi[1]-lo[1])*aspect)*1.18
    else:
        center=xyz(focus);scale=31 if name=='gimbal' else 34
    return right,up,back,center,scale
scene=open_model(edition);v=points(scene)
for o in list(scene.objects):
    if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
m=bpy.data.materials.new('Identical neutral clay override');m.use_nodes=True
p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.44,.44,.44,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.36
for layer in scene.view_layers:layer.material_override=m;layer.cycles.use_denoising=False
if scene.world is None:scene.world=bpy.data.worlds.new('Clay world')
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.12,.12,.12,1);bg.inputs['Strength'].default_value=.35
def light(name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Broad key',(36,65,42),85000,48);light('Character strip',(-40,26,-38),62000,30);light('Rear rim',(15,48,-58),43000,32);light('Underside fill',(-20,-45,23),34000,42)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48 if front_only else 24;scene.cycles.use_denoising=False
scene.render.resolution_x=W;scene.render.resolution_y=H;scene.render.resolution_percentage=100
scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.threads_mode='FIXED';scene.render.threads=4
report={'edition':edition,'frontOnly':front_only,'sourceSha256':sha(paths[edition]),'commonSourceHashes':{k:sha(p) for k,p in paths.items()},'views':[]}
for name in views:
    r,u,b,center,scale=frame(name);d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o)
    o.location=center+b*140;o.rotation_euler=Matrix((r,u,b)).transposed().to_euler();d.type='ORTHO';d.ortho_scale=scale;d.clip_end=500;scene.camera=o
    bpy.context.view_layer.update()
    projected=[world_to_camera_view(scene,o,p) for p in v]
    rect=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
    close=views[name][2] is not None
    if not close and (min(rect[:2])<.04 or max(rect[2:])>.96):raise RuntimeError('Full view cropped: '+name+str(rect))
    dest=os.path.join(out,edition+'-'+name+'.png');scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
    report['views'].append({'view':name,'file':os.path.basename(dest),'sha256':sha(dest),'orthographicScale':scale,'center':list(center),'rotation':list(o.rotation_euler),'projectedBounds':rect,'intentionalCloseup':close})
    json.dump(report,open(os.path.join(out,edition+'-proof-report.json'),'w'),indent=2)
print('EXO_PROOF',json.dumps(report))
