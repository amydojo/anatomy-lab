"""KINETIC: actual Blender geometry and original MARROW transform replay.
Two independent inspection films: material/clay studio or actual solver
fixture. No new gameplay forces. Source master is opened read-only.
"""
import bpy,sys,os,json,hashlib,math
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
src=os.path.abspath(arg('source'));out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
assert hashlib.sha256(open(src,'rb').read()).hexdigest()=='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
replay=json.load(open(arg('replay')));mode=arg('mode');sequence=arg('sequence')
bpy.ops.wm.open_mainfile(filepath=src);scene=bpy.context.scene
def xyz(v):return Vector((v[0],-v[2],v[1]))
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
parts={o.name:(o,o.matrix_world.copy(),o.get('assembly')) for o in scene.objects if o.type=='MESH'}
assert len(parts)==25
for o in list(scene.objects):
    if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for layer in scene.view_layers:layer.material_override=None;layer.cycles.use_denoising=False
if mode=='clay':
    mat=bpy.data.materials.new('KINETIC clay inspection');mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.44,.44,.44,1);p.inputs['Roughness'].default_value=.36
    for layer in scene.view_layers:layer.material_override=mat
if scene.world is None:scene.world=bpy.data.worlds.new('Studio')
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.16,.16,.16,1);bg.inputs['Strength'].default_value=.65
def light(name,loc,power,size,height):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=height
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler();return o
lights=[light('Long key',(30,65,32),95000,65,24),light('Opposing softbox',(-45,28,-35),71000,50,18),light('Rear strip',(18,44,-60),68000,55,12),light('Underside fill',(-16,-45,22),37000,42,22)]
lightLocal=[(o,o.location.copy(),o.rotation_euler.to_quaternion()) for o in lights]
# Individual pod emission material copies; geometry unchanged.
emit={}
for name,(o,_,g) in parts.items():
    if g in ('front_pod','rear_pod') and o.get('role')=='radial elements':
        for i,m in enumerate(o.data.materials):
            if m and m.get('family')=='amber':
                m=m.copy();m.name='KINETIC '+g;o.data.materials[i]=m;emit[g]=m.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength']
assert len(emit)==2
# True fixture geometry, never saved into vehicle master. Exact radius
# and angular resolution are the same as the Node triangle fixture.
if sequence=='fixture':
    p=[];f=[];N=64;K=96
    for j in range(N+1):
        a=math.pi*j/N
        for k in range(K+1):
            b=2*math.pi*k/K;p.append(xyz((250*math.sin(a)*math.cos(b),250*math.cos(a),250*math.sin(a)*math.sin(b))))
    for j in range(N):
        for k in range(K):
            a=j*(K+1)+k;b=a+K+1;f.extend([(a,b,a+1),(a+1,b,b+1)])
    d=bpy.data.meshes.new('Exact synthetic sphere fixture');d.from_pydata(p,[],f);d.update();o=bpy.data.objects.new('Fixture — NOT anatomical data',d);scene.collection.objects.link(o)
    for poly in d.polygons:poly.use_smooth=True
    m=bpy.data.materials.new('Neutral surface fixture');m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.25,.27,.29,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;d.materials.append(m)
# Exact matrix columns from original board motion; atlas to Blender basis.
def transform(q):
    r=q['r'];A=Matrix((r[:3],r[3:6],r[6:9])).transposed();R=C@A@C.transposed()
    T=R.to_4x4();T.translation=xyz([1000*v for v in q['t']]);return T
def apply(row):
    pose=row['pose'];s=row['state'];base=transform(pose)
    for name,(o,m,g) in parts.items():
        q=pose[{'front':'front','rear':'rear','front_pod':'frontPod','rear_pod':'rearPod'}.get(g,'front')] if g!='joint' else pose
        assert g in ('front','rear','front_pod','rear_pod','joint')
        o.matrix_world=transform(q)@m
    v=pose['vehicle'];emit['front_pod'].default_value=v['frontEmission'];emit['rear_pod'].default_value=v['rearEmission']
    bpy.context.view_layer.update()
    return base
cam=bpy.data.cameras.new('Kinetic inspection');co=bpy.data.objects.new('Kinetic inspection',cam);scene.collection.objects.link(co);scene.camera=co;cam.type='ORTHO';cam.ortho_scale=96 if sequence=='studio' else 114;cam.clip_end=2000
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=6;scene.cycles.use_denoising=False
scene.render.resolution_x=768;scene.render.resolution_y=432;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.fps=replay['fps'];scene.render.film_transparent=False
# Use the full 9-second scripted mechanical study, or actual solver contact
# circuit + flight/capture/landing. No interpolation of physics beyond trace.
rows=replay['frames'] if sequence=='studio' else replay['contact']+replay['flight']
if '--limit' in args:rows=rows[:int(arg('limit'))]
report={'sourceSha256':hashlib.sha256(open(src,'rb').read()).hexdigest(),'mode':mode,'sequence':sequence,'fps':replay['fps'],'resolution':[768,432],'frames':[],'note':'Studio is a scripted input-state articulation proof. Fixture is actual solver trace on synthetic sphere, not anatomical gameplay. Camera is a local inspection camera, not GYROSCOPE.'}
for i,row in enumerate(rows):
    base=apply(row)
    if sequence=='fixture':
        R=base.to_3x3();center=base.translation
        back=R@xyz((1,.64,.65)).normalized();up=R@xyz((0,1,0))
        for o,loc,rot in lightLocal:
            o.location=center+R@loc;o.rotation_euler=(R.to_quaternion()@rot).to_euler()
    else:
        center=xyz((0,0,0));back=xyz((1,.40,.72)).normalized();up=xyz((0,1,0))
    right=up.cross(back).normalized();vert=back.cross(right).normalized()
    co.location=center+back*180;co.rotation_euler=Matrix((right,vert,back)).transposed().to_euler()
    scene.frame_set(i+1);bpy.context.view_layer.update()
    dest=os.path.join(out,f'frame-{i:04d}.png');scene.render.filepath=dest;bpy.ops.render.render(write_still=True)
    report['frames'].append({'file':os.path.basename(dest),'sha256':hashlib.sha256(open(dest,'rb').read()).hexdigest(),'phase':row['pose']['vehicle']['phase'],'emission':[row['pose']['vehicle']['frontEmission'],row['pose']['vehicle']['rearEmission']],'hoverOffset':row['pose']['vehicle']['hoverOffset']})
    json.dump(report,open(os.path.join(out,'motion-report.json'),'w'),indent=2)
print('KINETIC_RENDER',json.dumps({'frames':len(report['frames']),'fps':report['fps'],'sequence':sequence,'mode':mode}),flush=True)
