"""Actual Blender FUSION 002 inspection; preserve strict raw overlap gate.
No film if inherited native intersections remain."""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);source=arg('source');proof=arg('proof');atlas=arg('atlas')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(source)==expected
q=dict(np.load(proof/'branch.npz'));z=dict(np.load(atlas/'native-atlas.npz'));rep=json.loads((proof/'branch.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update();s=bpy.context.scene;o=bpy.data.objects['TENSION_continuous_frame'];mats=list(o.data.materials)
dg=bpy.context.evaluated_depsgraph_get();eo=o.evaluated_get(dg);me=eo.to_mesh();me.calc_loop_triangles();V=np.array([tuple(eo.matrix_world@v.co) for v in me.vertices]);F=np.array([tuple(t.vertices) for t in me.loop_triangles]);eo.to_mesh_clear();assert np.array_equal(V,z['vertices']) and np.array_equal(F,z['faces'])
def hits(P,F):
    tree=BVHTree.FromPolygons(P.tolist(),F.tolist(),all_triangles=True);sets=[set(f) for f in F];return [(int(a),int(b)) for a,b in tree.overlap(tree) if a<b and not sets[a].intersection(sets[b])]
sourceHits={tuple(sorted(p)) for p in hits(V,F)}
for o in list(s.objects):bpy.data.objects.remove(o,do_unlink=True)
def material(name,c,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.use_fake_user=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;return m
clay=material('Engineering clay',(.43,.43,.43),0,.5);cap=material('Constructed symmetry cap',(.62,.59,.54),.90,.23);contact=material('Constructed fusion contact',(.80,.29,.04),.9,.22)
for m in mats:m.use_fake_user=True
def mesh(P,stage):
    F=q[stage+'Faces'];U=q[stage+'LoopUV'];M=q[stage+'Material'];d=bpy.data.meshes.new('MORPHOSIS '+stage);d.from_pydata(P.tolist(),[],F.tolist());d.update();o=bpy.data.objects.new('MORPHOSIS '+stage+' diagnostic',d);s.collection.objects.link(o)
    for m in mats+[cap,contact]:d.materials.append(m)
    uv=d.uv_layers.new(name='ChromaticArtworkUV')
    for l in d.loops:uv.data[l.index].uv=U.reshape(-1,2)[l.index]
    for p in d.polygons:
        i=int(M[p.index]);p.material_index=i if i>=0 else len(mats)+(i==-2);p.use_smooth=i>=0
    attr=d.attributes.new('NativeTriangleID','INT','FACE');attr.data.foreach_set('value',q[stage+'Owner'].astype(np.int32))
    return o
def read(o):return np.array([tuple(v.co) for v in o.data.vertices],dtype=np.float32)
records=[]
for stage in ('pre','post'):
    P=q['pre'] if stage=='pre' else q['post'][None];F=q[stage+'Faces'];o=mesh(P[0],stage);uv0=np.array([tuple(l.uv) for l in o.data.uv_layers[0].data]);owners=q[stage+'Owner']
    for i,X in enumerate(P):
        o.data.vertices.foreach_set('co',X.ravel());o.data.update();Y=read(o);assert np.array_equal(Y,X);assert np.array_equal(uv0,np.array([tuple(l.uv) for l in o.data.uv_layers[0].data]));h=hits(Y,F);inherited=[p for p in h if min(owners[list(p)])>=0 and tuple(sorted(owners[list(p)])) in sourceHits];records.append({'stage':stage,'frame':i,'rawPairs':h,'inheritedRawPairs':len(inherited),'otherRawPairs':len(h)-len(inherited)})
    bpy.data.objects.remove(o,do_unlink=True)
critical=hits(q['criticalPre'],q['preFaces']);event=np.isin(q['preFaces'],np.unique(q['preFaces'][q['removedCaps']])).any(1);outside=[p for p in critical if not all(event[list(p)])]
rep['actualStored']=records;rep['criticalRawPairs']=critical;rep['outsideEventRawPairs']=outside;rep['rawSourceOverlapCount']=len(sourceHits);rep['actualEventPass']=bool(rep['regularPasses']==65 and not any(x['rawPairs'] for x in records) and not outside and rep['criticalCapSymmetricDifferenceArea']==0 and rep['maxRetainedCoordinateDiscontinuity']==0)
(out/'native-branch-report.json').write_text(json.dumps(rep,indent=2))
# Actual editable pre/post masters and inspection render scenes, even on
# failed collision gate. No topology-changing animation by visibility.
s.world=bpy.data.worlds.new('MORPHOSIS studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1)
center=Vector((5,-20,0))
for name,loc,power,size in [('Key',(25,-30,50),65000,45),('Strip',(-20,-10,30),40000,35),('Rim',(20,-40,-18),25000,25)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.2;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Inspection');cam=bpy.data.objects.new('Inspection',cd);s.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO'
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.resolution_x=1000;s.render.resolution_y=564;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=4;s.render.image_settings.file_format='PNG'
def camera(mode):
    c=center if mode=='engineering' else Vector((6.7,-20.013,3.2));cam.location=c+Vector((75,5,45) if mode=='engineering' else (35,5,42));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=44 if mode=='engineering' else 9
for stage,k in [('pre',0),('pre',32),('pre',64),('post',0)]:
    X=q['pre'][k] if stage=='pre' else q['post'];o=mesh(X,stage);original=list(o.data.materials)
    for mode in ('engineering','couture'):
        camera(mode)
        for i,m in enumerate(original):o.data.materials[i]=clay if mode=='engineering' else m
        s.render.filepath=str(out/f'{mode}-{stage}-{k:03d}.png');bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(o,do_unlink=True)
masters={}
for stage in ('pre','post'):
    P=q['pre'] if stage=='pre' else q['post'][None];o=mesh(P[0],stage)
    if stage=='pre':
        basis=o.shape_key_add(name='Basis');keys=o.data.shape_keys;keys.use_relative=False;basis.interpolation='KEY_LINEAR'
        for k,X in enumerate(P[1:],1):
            key=o.shape_key_add(name=f'Approach {k:03d}');key.data.foreach_set('co',X.ravel());key.interpolation='KEY_LINEAR'
        for k,key in enumerate(keys.key_blocks):keys.eval_time=key.frame;keys.keyframe_insert(data_path='eval_time',frame=k+1)
        for fc in keys.animation_data.action.fcurves:
            for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    s.frame_start=1;s.frame_end=len(P);s.frame_set(1);camera('couture');file=out/f'MORPHOSIS-{stage}-diagnostic.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.data.objects.remove(o,do_unlink=True);masters[stage]={'sha256':sha(file)}
# Reopen both sources independently and audit all evaluated stored keys.
for stage in ('pre','post'):
    file=out/f'MORPHOSIS-{stage}-diagnostic.blend';bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');P=q['pre'] if stage=='pre' else q['post'][None];errs=[]
    for i,X in enumerate(P):
        s.frame_set(i+1);dg=bpy.context.evaluated_depsgraph_get();eo=o.evaluated_get(dg);me=eo.to_mesh();Y=np.array([tuple(v.co) for v in me.vertices]);errs.append(float(np.max(abs(Y-X))));eo.to_mesh_clear()
    masters[stage]['reopenedEvaluatedKeyMaxError']=max(errs)
rep['masters']=masters;assert sha(source)==expected;(out/'native-branch-report.json').write_text(json.dumps(rep,indent=2));assert rep['actualEventPass'],'Original raw collision gate failed; diagnostic inspection retained, film unauthorized'
