"""Recover the exact native baked masters from FIRST RIDE's failed export.
No rebake, decimation, changes to UVs, or material redesign.
"""
import bpy,sys,os,json,hashlib,struct
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
out=os.path.abspath(arg('out'));tier=int(arg('tier'));SIZE=1024
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
pins={20000:{'master':'f51f570cf1815a9c2c6d31df0af3fc75f17683450e619736be5edb703dd17fe2','base':'e6a8ef08adcf07d1135d9dd2471134b6cacd10ec18b2f9c47acd4a3b2cb07328','normal':'eb1c1bce7aa02103423eb2ae6b369561da24c65dc74ab7c37b3ff188fcdbd5c8','orm':'074381915b16acaa341b62544362899a7da46c90e2309cb2a6afd2df424d5841','emissive':'07ac83b71f9351d33a178363fd7a4a4542e51c70f525d377e27dcc060f692efb'},13700:{'master':'4cba498a2d594ee41b9fa3871f7097591d542cc729c114fd8e326a8d4342ee57','base':'72bf9100fdef878232d22dfb33cd28157360ba38c51365e3ef5fc5d0e3af6608','normal':'65f2a6377c449c3508ff4af81f9d354ba5ed713b91fc1e6a93df6e6968f494ab','orm':'29c61e001aa2a00712fa16a9aa20024f599c0cd784ae54147a6a76d10f6b4446','emissive':'c4d6e9fa976e04d60c37f79ac0216416ce69346294e4b630fc122c23ed742e7a'}}
pin=pins[tier];dest=os.path.join(out,'VECTOR-005-VELOCITY-'+str(tier)+'.blend')
assert sha(dest)==pin['master']
for k in ('base','normal','orm','emissive'):assert sha(os.path.join(out,k+'.png'))==pin[k]
report=json.load(open(os.path.join(out,'reduction.json')));assert report['sourceSha256']=='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
bpy.ops.wm.open_mainfile(filepath=dest);lows=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(lows)==25
for o in lows:
    o.data.calc_loop_triangles();assert len(o.data.uv_layers)==1 and o.data.uv_layers[0].name=='VelocityAtlas'
    assert len(o.data.materials)==1 and o.data.materials[0].name=='VELOCITY / baked AFTERBURN'
assert sum(len(o.data.loop_triangles) for o in lows)==report['triangles']
for k in ('base','normal','orm','emissive'):
    im=bpy.data.images['Velocity_'+k];assert im.packed_file and tuple(im.size)==(1024,1024)
    assert hashlib.sha256(im.packed_file.data).hexdigest()==pin[k], 'Packed image differs: '+k
report['masterSha256']=pin['master'];report['recoveredBakeHashes']=pin
def select(o):
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
# Join by assembly ONLY after saving the individual qualification meshes.
joined=[]
# Blender join destroys the absorbed RNA objects. Partition before any join,
# so later assemblies never dereference invalidated objects from lows.
groups=('front','rear','joint','front_pod','rear_pod')
assembly_items={group:[o for o in lows if o['assembly']==group] for group in groups}
assert all(assembly_items.values()) and sum(map(len,assembly_items.values()))==len(lows)
for group in groups:
    items=assembly_items.pop(group);select(items[0])
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
