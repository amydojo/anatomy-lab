"""FIRST LIGHT: render immutable master and exact recovered GLB.
Run with Blender 4.x: blender -b -t 4 --python-exit-code 1 --python render_first_light.py -- --assets vector-output --out vector-proofs
No remodeling, decimation, UV changes or material edits. Runtime geometry is
uniformly rescaled in the render scene only, to match the master authoring units.
"""
import bpy, sys, os, json, hashlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
assets=os.path.abspath(args[args.index('--assets')+1])
out=os.path.abspath(args[args.index('--out')+1])
os.makedirs(out,exist_ok=True)
def digest(p):
    with open(p,'rb') as f:return hashlib.sha256(f.read()).hexdigest()
def xyz(p):return (p[0],-p[2],p[1])
def camera(scene,name,loc,target,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o)
    o.location=xyz(loc);o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    else:d.lens=55
    return o
def light(scene,name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc)
    o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
views=[('hero',(-82,56,105),None),('top',(0,125,.01),90),('side',(-125,0,0),90),('underside',(0,-125,.01),90)]
report={}
for edition,filename in [('master','VECTOR-005-master.blend'),('runtime','VECTOR-005-preview.glb')]:
    path=os.path.join(assets,filename)
    if edition=='master':bpy.ops.wm.open_mainfile(filepath=path)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=path)
        # GLB uses atlas scale; preserve node transforms through a common root.
        root=bpy.data.objects.new('Proof scale only',None);bpy.context.scene.collection.objects.link(root)
        for o in list(bpy.context.scene.objects):
            if o!=root and o.parent is None:o.parent=root
        root.scale=(1000,1000,1000)
    scene=bpy.context.scene
    deps=bpy.context.evaluated_depsgraph_get()
    objects=[o for o in scene.objects if o.type=='MESH']
    tris=0
    for o in objects:
        ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();tris+=len(m.loop_triangles);ev.to_mesh_clear()
    for o in list(scene.objects):
        if o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
    if scene.world is None:scene.world=bpy.data.worlds.new('Proof world')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.12,.12,.12,1)
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.4
    light(scene,'Key softbox',(-38,65,38),65000,48,(.76,.87,1))
    light(scene,'Warm rim',(45,28,-45),55000,37,(1,.54,.25))
    light(scene,'Orchid rim',(-30,13,-42),24000,29,(1,.20,.52))
    light(scene,'Underside fill',(15,-40,25),36000,36,(.65,.75,1))
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
    # Ubuntu Blender is built without OpenImageDenoise.
    scene.cycles.use_denoising=False
    for layer in scene.view_layers:layer.cycles.use_denoising=False
    scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.render.threads_mode='FIXED';scene.render.threads=4
    report[edition]={'sourceSha256':digest(path),'triangles':tris,'components':len(objects),'views':[]}
    for name,loc,ortho in views:
        scene.camera=camera(scene,name,loc,(0,0,0),ortho)
        dest=os.path.join(out,edition+'-'+name+'.png');scene.render.filepath=dest
        bpy.ops.render.render(write_still=True)
        if not os.path.getsize(dest):raise RuntimeError('Empty render '+dest)
        report[edition]['views'].append({'name':name,'file':os.path.basename(dest),'sha256':digest(dest)})
        with open(os.path.join(out,'proof-report.json'),'w') as f:json.dump(report,f,indent=2)
print('FIRST_LIGHT_PROOF',json.dumps(report))
