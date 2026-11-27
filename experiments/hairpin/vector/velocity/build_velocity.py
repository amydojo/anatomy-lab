"""VELOCITY: component-specific evaluated derivative, immutable native master.
Blender 4.0.2, no source edits. Candidate tiers are not acceptance claims.
"""
import bpy,bmesh,sys,os,json,math,hashlib,time
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
src=os.path.abspath(arg('source'));out=os.path.abspath(arg('out'));os.makedirs(out,exist_ok=True)
tier=int(arg('tier'));assert tier in (20000,10000,5000,3500)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(src)=='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
bpy.ops.wm.open_mainfile(filepath=src);scene=bpy.context.scene
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
high=[o for o in scene.objects if o.type=='MESH'];assert len(high)==25
def select(o):
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
def measure(o):
    o.data.calc_loop_triangles();return len(o.data.loop_triangles)
def evalmesh(o):
    ev=o.evaluated_get(deps);return bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
# Explicit component importance: keep exposed silhouette, grip edges, bearing
# and radial features preferentially. Every component survives every tier.
def weight(role):
    if 'frame' in role:return 1.20
    if 'standing' in role:return 1.25
    if 'bearing' in role or 'collar' in role:return 1.35
    if 'radial' in role:return 1.25
    if 'web' in role or 'saddle' in role:return .65
    return 1.0
records=[];lows=[]
for o in high:
    mesh=evalmesh(o);lo=bpy.data.objects.new('LOW_'+o.name,mesh);scene.collection.objects.link(lo);lo.matrix_world=o.matrix_world.copy()
    for k in ('assembly','role'):lo[k]=o[k]
    records.append({'name':o.name,'assembly':o['assembly'],'role':o['role'],'sourceTriangles':measure(lo),'weight':weight(o['role'])})
    lows.append(lo)
assert sum(v['sourceTriangles'] for v in records)==101792
# Weighted allocation using caps/floors, no artificial target success.
den=sum(v['sourceTriangles']*v['weight'] for v in records)
for rec,lo,o in zip(records,lows,high):
    goal=max(48,min(rec['sourceTriangles'],round(tier*rec['sourceTriangles']*rec['weight']/den)))
    rec['targetTriangles']=goal;select(lo)
    # Dissolve only nearly coplanar same-material regions first. Do not
    # weld across independent pieces. Collapse is quadric-based in Blender.
    m=lo.modifiers.new('Planar same-material prepass','DECIMATE');m.decimate_type='DISSOLVE';m.angle_limit=math.radians(1.5);m.delimit={'NORMAL','MATERIAL','SEAM','SHARP'}
    bpy.ops.object.modifier_apply(modifier=m.name)
    n=measure(lo)
    if n>goal:
        m=lo.modifiers.new('Component quadric reduction','DECIMATE');m.decimate_type='COLLAPSE';m.ratio=goal/n;m.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=m.name)
    rec['triangles']=measure(lo);rec['vertices']=len(lo.data.vertices)
    # Independent symmetric sampled vertex-to-surface error. This is not
    # Hausdorff or continuous clearance. Same authoring units as gate.
    hi=evalmesh(o);hi.calc_loop_triangles();lo.data.calc_loop_triangles()
    hv=[o.matrix_world@v.co for v in hi.vertices];lv=[lo.matrix_world@v.co for v in lo.data.vertices]
    ht=BVHTree.FromPolygons(hv,[tuple(t.vertices) for t in hi.loop_triangles],all_triangles=True)
    lt=BVHTree.FromPolygons(lv,[tuple(t.vertices) for t in lo.data.loop_triangles],all_triangles=True)
    def distances(v,tree):
        a=sorted(tree.find_nearest(p)[3] for p in v)
        return {'max':a[-1],'p95':a[int(.95*(len(a)-1))]}
    rec['sourceToLow']=distances(hv,lt);rec['lowToSource']=distances(lv,ht)
    bm=bmesh.new();bm.from_mesh(lo.data);rec['nonManifoldEdges']=sum(not e.is_manifold for e in bm.edges);bm.free();bpy.data.meshes.remove(hi)
# Store editable low mesh components in their native authoring units.
# Keep originals only in the separate immutable source file; qualification
# expects original object names and roles.
for o in high:o.name='HIGH_'+o.name;o.hide_render=True;o.hide_set(True)
for lo,rec in zip(lows,records):lo.name=rec['name']
# Save separate mechanical derivative with no hidden high mesh geometry.
# A temporary collection exclusion is NOT enough because the gate reads all.
# Save via a separate build stage below after baking; report now for recovery.
report={'tier':tier,'sourceSha256':sha(src),'components':records,'triangles':sum(v['triangles'] for v in records),'vertices':sum(v['vertices'] for v in records),'limitations':'Quadric and same-material planar simplification; no exact preservation guarantee. Bidirectional vertex sampling, not continuous Hausdorff. All tiers require independent mechanical and visual qualification.'}
json.dump(report,open(os.path.join(out,'reduction.json'),'w'),indent=2)
if '--geometry-only' in args:
    for hi in high:bpy.data.objects.remove(hi,do_unlink=True)
    dest=os.path.join(out,'VECTOR-005-VELOCITY-'+str(tier)+'-geometry.blend')
    bpy.ops.wm.save_as_mainfile(filepath=dest)
    report['geometryMasterSha256']=sha(dest)
    json.dump(report,open(os.path.join(out,'reduction.json'),'w'),indent=2)
    print('VELOCITY_GEOMETRY',json.dumps({k:v for k,v in report.items() if k!='components'}),flush=True)
    sys.exit(0)
# UV packing: two 512x512 tiles across upper half, 32 128px tiles
# in lower half. Actual smart-project charts within each padded tile.
SIZE=1024;small=0
for lo,rec in zip(lows,records):
    select(lo)
    for old in list(lo.data.uv_layers):lo.data.uv_layers.remove(old)
    uv=lo.data.uv_layers.new(name='VelocityAtlas');lo.data.uv_layers.active=uv
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
    if rec['name']=='TENSION_continuous_frame':x,y,w=0,512,512
    elif rec['name']=='CONTINUITY_rear_frame':x,y,w=512,512,512
    else:x,y,w=(small%8)*128,(small//8)*128,128;small+=1
    for uvpoint in lo.data.uv_layers['VelocityAtlas'].data:
        u,v=uvpoint.uv;uvpoint.uv=((x+5+u*(w-10))/SIZE,(y+5+v*(w-10))/SIZE)
    rec['atlasTile']=[x,y,w,w]
    # low projection is explicitly the sole render-active UV channel
    lo.data.uv_layers['VelocityAtlas'].active_render=True
# Bake original node graphs without lights. Per-component selected-to-active
# prevents one component's geometry from projecting onto a different part.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=False
for layer in scene.view_layers:layer.cycles.use_denoising=False
scene.render.bake.use_clear=False
images={}
for key,space in [('base','sRGB'),('normal','Non-Color'),('orm','Non-Color'),('emissive','sRGB')]:
    im=bpy.data.images.new('Velocity_'+key,width=SIZE,height=SIZE,alpha=False,float_buffer=False);im.colorspace_settings.name=space
    im.generated_color=(.5,.5,1,1) if key=='normal' else (1,.5,0,1) if key=='orm' else (0,0,0,1)
    images[key]=im
target=bpy.data.materials.new('Velocity bake target');target.use_nodes=True;tn=target.node_tree.nodes.new('ShaderNodeTexImage')
for lo in lows:
    lo.data.materials.clear();lo.data.materials.append(target)
    for f in lo.data.polygons:f.material_index=0
original={o.name:list(o.data.materials) for o in high}
def emission_proxy(mat,key):
    m=mat.copy();n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');e=n.new('ShaderNodeEmission');output=n.get('Material Output')
    def channel(name):
        s=p.inputs[name];return s.links[0].from_socket if s.is_linked else s.default_value
    def wire(value,s):
        if isinstance(value,bpy.types.NodeSocket):l.new(value,s)
        else:
            if isinstance(value,(float,int)):s.default_value=(value,value,value,1) if s.type=='RGBA' else value
            else:s.default_value=value
    if key=='base':wire(channel('Base Color'),e.inputs['Color'])
    elif key=='orm':
        c=n.new('ShaderNodeCombineColor');c.mode='RGB';c.inputs[0].default_value=1;wire(channel('Roughness'),c.inputs[1]);wire(channel('Metallic'),c.inputs[2]);l.new(c.outputs[0],e.inputs['Color'])
    else:
        if mat.get('family')=='amber':wire(channel('Emission Color'),e.inputs['Color'])
        else:e.inputs['Color'].default_value=(0,0,0,1)
    e.inputs['Strength'].default_value=1;l.new(e.outputs[0],output.inputs['Surface']);return m
for key,im in images.items():
    proxies={}
    for hi in high:
        for i,mat in enumerate(original[hi.name]):
            if key=='normal':hi.data.materials[i]=mat
            else:
                if mat.name not in proxies:proxies[mat.name]=emission_proxy(mat,key)
                hi.data.materials[i]=proxies[mat.name]
    tn.image=im;target.node_tree.nodes.active=tn
    for lo,hi in zip(lows,high):
        select(lo);hi.hide_set(False);hi.hide_render=False;hi.select_set(True)
        bpy.ops.object.bake(type='NORMAL' if key=='normal' else 'EMIT',use_selected_to_active=True,cage_extrusion=.24,max_ray_distance=.7,margin=3,use_clear=False,normal_space='TANGENT')
        hi.hide_set(True);hi.hide_render=True
    for hi in high:
        for i,m in enumerate(original[hi.name]):hi.data.materials[i]=m
    for m in proxies.values():bpy.data.materials.remove(m)
    im.filepath_raw=os.path.join(out,key+'.png');im.file_format='PNG';im.save();im.pack()
    print('VELOCITY_BAKE',key,sha(im.filepath_raw),flush=True)
# Standard glTF node graph, no baked illumination. AO is neutral (R=1).
mat=bpy.data.materials.new('VELOCITY / baked AFTERBURN');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
uv=n.new('ShaderNodeUVMap');uv.uv_map='VelocityAtlas'
tex={}
for key,im in images.items():
    t=n.new('ShaderNodeTexImage');t.image=im;t.extension='EXTEND';l.new(uv.outputs['UV'],t.inputs['Vector']);tex[key]=t
l.new(tex['base'].outputs['Color'],p.inputs['Base Color'])
sep=n.new('ShaderNodeSeparateColor');sep.mode='RGB';l.new(tex['orm'].outputs['Color'],sep.inputs[0]);l.new(sep.outputs[1],p.inputs['Roughness']);l.new(sep.outputs[2],p.inputs['Metallic'])
normal=n.new('ShaderNodeNormalMap');normal.uv_map='VelocityAtlas';l.new(tex['normal'].outputs['Color'],normal.inputs['Color']);l.new(normal.outputs[0],p.inputs['Normal'])
l.new(tex['emissive'].outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.55
for lo in lows:lo.data.materials.clear();lo.data.materials.append(mat)
for hi in high:bpy.data.objects.remove(hi,do_unlink=True)
# Native derivative retains individual meshes, assembly and role. The
# unchanged complete-vehicle gate runs against this saved geometry.
dest=os.path.join(out,'VECTOR-005-VELOCITY-'+str(tier)+'.blend')
bpy.ops.wm.save_as_mainfile(filepath=dest);report['masterSha256']=sha(dest)
# Join by assembly ONLY after saving the individual qualification meshes.
joined=[]
for group in ('front','rear','joint','front_pod','rear_pod'):
    items=[o for o in lows if o['assembly']==group];select(items[0])
    for o in items:o.select_set(True)
    bpy.ops.object.join();o=bpy.context.object;o.name='__marrow_'+group;o['assembly']=group
    for v in o.data.vertices:v.co*=.001
    o.location*=.001;joined.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in joined:o.select_set(True)
glb=os.path.join(out,'VECTOR-005-VELOCITY-'+str(tier)+'.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_materials='EXPORT',export_tangents=True)
import struct
raw=open(glb,'rb').read();length=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+length])
assert len(j.get('images',[]))>=4 and len(j['materials'])==1
pbr=j['materials'][0]['pbrMetallicRoughness'];assert 'baseColorTexture' in pbr and 'metallicRoughnessTexture' in pbr and 'normalTexture' in j['materials'][0] and 'emissiveTexture' in j['materials'][0]
report.update({'glbSha256':sha(glb),'glbBytes':len(raw),'exportTriangles':sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives']),'drawBatches':sum(len(m['primitives']) for m in j['meshes']),'images':len(j['images']),'atlasSize':SIZE,'nominalTextureBytesRGBA8WithMips':4*4*sum((SIZE//2**i)**2 for i in range(11)),'materialApproximation':'Baked base, normal, roughness/metallic and emissive; neutral AO, no coat/anisotropy extension. Ray projection and mip seams require actual inspection.'})
json.dump(report,open(os.path.join(out,'reduction.json'),'w'),indent=2);print('VELOCITY_EXPORT',json.dumps({k:v for k,v in report.items() if k!='components'}),flush=True)
