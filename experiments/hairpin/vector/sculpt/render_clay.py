"""Matched neutral-clay proofs of SCULPT and historical FIRST LIGHT master.
No source file is modified. FIRST LIGHT graphic geometry is hidden for form review.
"""
import bpy, sys, os, hashlib, json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=os.path.abspath(args[args.index('--out')+1]);os.makedirs(out,exist_ok=True)
old=os.path.abspath(args[args.index('--old')+1]);new=os.path.abspath(args[args.index('--new')+1])
def sha(path):return hashlib.sha256(open(path,'rb').read()).hexdigest()
assert sha(old)=='2bf525342c5a48fde5d6ef380f087b736109dd35c442513e79b7c6595c30ebdd'
def xyz(p):return (p[0],-p[2],p[1])
def camera(scene,name,loc,ortho):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o)
    o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    else:d.lens=55
    return o
def light(scene,name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
views=[('hero',(82,49,96),None),('top',(0,125,.01),86),('side',(125,0,0),86),('front',(0,0,125),28),('rear',(0,0,-125),28),('underside',(0,-125,.01),86)]
report={}
for edition,path in [('sculpt',new),('first-light',old)]:
    bpy.ops.wm.open_mainfile(filepath=path);scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
        elif edition=='first-light' and ('wordmark' in o.name or 'emblem' in o.name):o.hide_render=True
    m=bpy.data.materials.new('Matched neutral clay');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(.44,.44,.44,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.36
    for layer in scene.view_layers:layer.material_override=m;layer.cycles.use_denoising=False
    if scene.world is None:scene.world=bpy.data.worlds.new('Clay world')
    scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(.12,.12,.12,1);bg.inputs['Strength'].default_value=.35
    light(scene,'Broad key',(36,65,42),85000,48)
    light(scene,'Character strip',(-40,26,-38),62000,30)
    light(scene,'Rear rim',(15,48,-58),43000,32)
    light(scene,'Underside fill',(-20,-45,23),34000,42)
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.render.threads_mode='FIXED';scene.render.threads=4
    report[edition]={'sourceSha256':sha(path),'views':[]}
    for name,loc,ortho in views:
        scene.camera=camera(scene,name,loc,ortho);dest=os.path.join(out,edition+'-'+name+'.png')
        scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
        report[edition]['views'].append({'name':name,'sha256':sha(dest),'file':os.path.basename(dest)})
        with open(os.path.join(out,'clay-proof-report.json'),'w') as f:json.dump(report,f,indent=2)
print('SCULPT_CLAY_PROOFS',json.dumps(report))
