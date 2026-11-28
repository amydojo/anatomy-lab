"""Actual Blender readback and worst-frame rendering, no full film before inspection."""
import bpy,sys,json,hashlib,collections
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);baseline=arg('baseline');numerics=arg('numerics')
sys.path.insert(0,str(Path(__file__).parent))
from metallurgy_solver import height,normals
q=np.load(baseline/'conditioned-correspondence.npz');qual=json.loads((baseline/'qualification.json').read_text());assert qual['endpointPass']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for label in ('compact','target'):
    f=baseline/('GENESIS-'+label+'-chart-conditioned.blend')
    assert sha(f)==qual['reopened'][label]['nativeFileSha256']
    bpy.ops.wm.open_mainfile(filepath=str(f));o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    assert np.array_equal(np.array([tuple(v.co) for v in o.data.vertices]),q[label]);assert np.array_equal(np.array([tuple(p.vertices) for p in o.data.polygons]),q['faces'])
candidate=np.load(numerics/'tension-161.npz');P=candidate['poses'];F=q['faces'];U=q['chart'];assert np.array_equal(F,candidate['faces']) and np.array_equal(U,candidate['uv']);assert np.array_equal(P[0],q['compact']) and np.array_equal(P[-1],q['target'])
s=bpy.context.scene
for o in list(s.objects):bpy.data.objects.remove(o,do_unlink=True)
d=bpy.data.meshes.new('METALLURGY frozen common mesh');d.from_pydata(P[0].tolist(),[],F.tolist());d.update()
o=bpy.data.objects.new('TENSION — evaluated regional study',d);s.collection.objects.link(o)
layer=d.uv_layers.new(name='PersistentMaterialChart')
for l in d.loops:layer.data[l.index].uv=U[l.vertex_index]
for f in d.polygons:f.use_smooth=True
uv0=np.array([tuple(l.uv) for l in layer.data]);assert np.array_equal(np.array([tuple(p.vertices) for p in d.polygons]),F)
stored=[];overlaps=[];faceSets=[set(f) for f in F]
for i,p in enumerate(P):
    d.vertices.foreach_set('co',p.ravel());d.update();bpy.context.view_layer.update()
    read=np.array([tuple(v.co) for v in d.vertices],dtype=np.float32);assert np.array_equal(read,p)
    assert np.array_equal(uv0,np.array([tuple(l.uv) for l in layer.data]))
    tree=BVHTree.FromPolygons(read.tolist(),F.tolist(),all_triangles=True)
    hits=[(a,b) for a,b in tree.overlap(tree) if a<b and not faceSets[a].intersection(faceSets[b])]
    # Retain original raw BVH gate even if projection evidence suggests
    # a numerical near-contact. Never remove a candidate silently.
    overlaps.append({'frame':i,'count':len(hits),'pairs':hits[:100]});stored.append(read)
report,read=height(q,np.array(stored),False)
report['rawBVHOverlapCandidates']=overlaps;report['peakBVHOverlapCandidates']=max(x['count'] for x in overlaps)
report['storedMeshExact']=bool(np.array_equal(read,P));report['persistentUVStable']=True
report['fullSampledPass']=bool(report['passes']==161 and report['peakBVHOverlapCandidates']==0 and report['storedMeshExact'])
report['limitations']=['Isolated open upper-rail strip only, not frozen B full object.','Planar injectivity is sampled at 161 phases, not continuous-time proof.','Raw BVH overlap candidates retained; no clearance or solid-volume qualification.','Height compression is explicitly fictional.']
(out/'actual-motion-audit.json').write_text(json.dumps(report,indent=2))
np.savez_compressed(out/'actual-poses.npz',poses=read,faces=F,uv=U)
# Select actual worst configurations before any full film. Keep same cameras for both treatments.
ss=report['samples'];selected=sorted({0,160,40,80,120,min(range(161),key=lambda i:ss[i]['minArea']),max(range(161),key=lambda i:ss[i]['maxTemporalAngleDeg']),max(range(161),key=lambda i:overlaps[i]['count']),max(range(161),key=lambda i:ss[i]['edgeStretchPercentiles'][-1])})
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
clay=material('Inspection clay',(.4,.4,.4),0,.5);metal=material('Petrol / polished silver / orchid',(.62,.59,.53),.92,.23)
n=metal.node_tree.nodes;l=metal.node_tree.links;bs=n.get('Principled BSDF');tex=n.new('ShaderNodeUVMap');tex.uv_map=layer.name;sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs[0],sep.inputs[0]);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
colors=[(0,(.005,.045,.10,1)),(.285,(.005,.045,.10,1)),(.295,(.62,.59,.53,1)),(.695,(.62,.59,.53,1)),(.705,(.8,.015,.25,1)),(.755,(.8,.015,.25,1)),(.765,(.62,.59,.53,1)),(1,(.62,.59,.53,1))]
for i,(pos,col) in enumerate(colors):
    el=ramp.color_ramp.elements[i] if i<2 else ramp.color_ramp.elements.new(pos);el.position=pos;el.color=col
l.new(sep.outputs['Y'],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs['Base Color']);d.materials.append(metal)
s.world=bpy.data.worlds.new('METALLURGY studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1)
for name,loc,power,size in [('Key',(20,-30,55),70000,50),('Strip',(-30,20,35),50000,40),('Rim',(15,35,-20),35000,35)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='RECTANGLE';light.size=size;light.size_y=size*.22;obj=bpy.data.objects.new(name,light);s.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('Inspection camera');cam=bpy.data.objects.new('Inspection camera',camd);s.collection.objects.link(cam);s.camera=cam;camd.type='ORTHO';camd.clip_end=1000
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.resolution_x=1000;s.render.resolution_y=563;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
for i in selected:
    p=P[i];d.vertices.foreach_set('co',p.ravel());d.update();center=Vector(tuple((p.min(0)+p.max(0))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=max(12,float(np.max(p.max(0)-p.min(0)))*1.30)
    for mode,mat in [('clay',clay),('metal',metal)]:
        d.materials[0]=mat;s.render.filepath=str(out/f'{mode}-{i:03d}.png');bpy.ops.render.render(write_still=True)
# Actual editable sampled shape keys, no interpolation qualification between keys.
d.materials[0]=metal;d.vertices.foreach_set('co',P[0].ravel());d.update();o.shape_key_add(name='Basis')
for i,p in enumerate(P):
    key=o.shape_key_add(name=f'TENSION-{i:03d}');key.data.foreach_set('co',p.ravel())
    for k,val in [(i-1,0),(i,1),(i+1,0)]:
        key.value=val;key.keyframe_insert(data_path='value',frame=k+1)
    key.value=0
s.frame_start=1;s.frame_end=161;s.render.fps=32;s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'METALLURGY-TENSION.blend'))
(out/'inspection.json').write_text(json.dumps({'selectedFrames':selected,'fullSampledPass':report['fullSampledPass'],'nativeSha256':sha(out/'METALLURGY-TENSION.blend'),'sourceEndpointHashes':{x:qual['reopened'][x]['nativeFileSha256'] for x in ('compact','target')},'frameCount':161,'note':'Only worst configurations rendered in this stage; no full movie.'},indent=2))
