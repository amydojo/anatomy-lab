"""Exact geometry motion derivative. No decimation or texture parity claim.
Export evaluated mesh at original atlas scale; scalar PBR diagnostic only.
Original editable native source is never saved or modified.
"""
import bpy,sys,os,json,hashlib,math
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
src=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
digest=hashlib.sha256(open(src,'rb').read()).hexdigest();assert digest=='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
bpy.ops.wm.open_mainfile(filepath=src);scene=bpy.context.scene
objects=[o for o in scene.objects if o.type=='MESH'];assert len(objects)==25
# Scalar derivative is explicitly an approximation for motion only;
# do not allow the existing strict importer to silently discard textures.
oldmats={};report=[]
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    g=o['assembly'];original=o.name;o.name='__marrow_'+g+'_'+original
    for i,m in enumerate(o.data.materials):
        if m is None:continue
        if m.name not in oldmats:
            fam=m.get('family');p=m.node_tree.nodes.get('Principled BSDF');assert p
            n=bpy.data.materials.new('Scalar motion diagnostic / '+m.name);n.use_nodes=True;q=n.node_tree.nodes.get('Principled BSDF')
            for key in ('Base Color','Metallic','Roughness','Emission Color','Emission Strength'):
                a=p.inputs.get(key);bb=q.inputs.get(key)
                if a is not None and bb is not None:bb.default_value=a.default_value
            n['family']=fam or '';oldmats[m.name]=n
        o.data.materials[i]=oldmats[m.name]
    # Keep all evaluated vertices and faces, scale only. Existing pivot at
    # board center; source object transforms are preserved in scaled units.
    for v in o.data.vertices:v.co*=.001
    o.location*=.001;o.data.calc_loop_triangles()
    report.append({'name':original,'assembly':g,'triangles':len(o.data.loop_triangles),'vertices':len(o.data.vertices)})
    o.select_set(False)
for o in objects:o.select_set(True)
dest=os.path.join(out,'VECTOR-005-KINETIC-scalar.glb')
bpy.ops.export_scene.gltf(filepath=dest,export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_extras=True,export_materials='EXPORT')
import struct
raw=open(dest,'rb').read();length,kind=struct.unpack_from('<II',raw,12);j=json.loads(raw[20:20+length])
assert not j.get('images') and not j.get('textures')
triangles=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])
assert triangles==sum(p['triangles'] for p in report)
for m in j['meshes']:
    for p in m['primitives']:assert j['accessors'][p['attributes']['POSITION']]['count']<=65535
manifest={'sourceSha256':digest,'glbSha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'evaluatedTriangles':triangles,'drawBatches':sum(len(m['primitives']) for m in j['meshes']),'textureDecodedBytes':0,'components':report,'limitations':'Scalar motion diagnostic; graphic textures, procedural bump, UV-mapped lettering, anisotropy and material parity excluded. No decimation. No runtime integration approval.'}
json.dump(manifest,open(os.path.join(out,'kinetic-glb-report.json'),'w'),indent=2);print('KINETIC_GLB',json.dumps(manifest),flush=True)
