"""Actual native FUSION storage, critical event contact isolation, editable pre/post masters, and matched renders."""
import bpy,sys,json,math,hashlib,collections,wave,struct
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from anastomosis_fusion import run,build,audit
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[args.index('--out')+1]).resolve();out.mkdir(parents=True,exist_ok=True)
rep=run(out);q=dict(np.load(out/'fusion.npz'));bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
def hits(P,F):
    tree=BVHTree.FromPolygons(P.tolist(),F.tolist(),all_triangles=True);sets=[set(f) for f in F]
    return [(int(a),int(b)) for a,b in tree.overlap(tree) if a<b and not sets[a].intersection(sets[b])]
def mat(name,c,m,r):
    x=bpy.data.materials.new(name);x.use_nodes=True;x.use_fake_user=True;bs=x.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Metallic'].default_value=m;bs.inputs['Roughness'].default_value=r;return x
clay=mat('Engineering clay',(.43,.43,.43),0,.5);silver=mat('Silver edge',(.64,.61,.56),.92,.22);petrol=mat('Petrol blade',(.018,.075,.13),.92,.23);orchid=mat('Orchid inlay',(.65,.013,.19),.8,.25);amber=mat('Amber connection',(.65,.25,.025),.85,.23)
materials=[petrol,silver,silver,amber,orchid]
def mesh(P,F,U,roles,ids,name):
    d=bpy.data.meshes.new(name);d.from_pydata(P.tolist(),[],F.tolist());d.update();o=bpy.data.objects.new(name,d);s.collection.objects.link(o)
    layer=d.uv_layers.new(name='PersistentMaterialChart')
    for l in d.loops:layer.data[l.index].uv=U[l.vertex_index]
    for m in materials:d.materials.append(m)
    for x in d.polygons:
        role=int(roles[x.index]);x.material_index=4 if role==0 and .32<float(U[list(x.vertices),1].mean())<.38 else role;x.use_smooth=role<2
    o['fictional_research']='Authored isolated FUSION; not native VECTOR or frozen wearable'
    o['vertexIDs']=json.dumps(ids.tolist());return o
def read(o):return np.array([tuple(v.co) for v in o.data.vertices],dtype=np.float32)
regular=[];peak=0
for stage in ('pre','post'):
    P=q[stage];F=q[stage+'Faces'];U=q[stage+'UV'];roles=q[stage+'Roles'];ids=q[stage+'IDs'];o=mesh(P[0],F,U,roles,ids,stage);uv0=np.array([tuple(x.uv) for x in o.data.uv_layers[0].data]);n=len(P[0])//2
    for j,X in enumerate(P):
        o.data.vertices.foreach_set('co',X.ravel());o.data.update();Y=read(o);assert np.array_equal(Y,X) and np.array_equal(uv0,np.array([tuple(x.uv) for x in o.data.uv_layers[0].data]));h=hits(Y,F);r,_=audit(Y,F,q[stage+'Boundary'],n);regular.append({'stage':stage,'frame':j,'rawNonadjacentBVH':len(h),'pairs':h[:200],'regularPass':r['regularPass']});peak=max(peak,len(h))
    bpy.data.objects.remove(o,do_unlink=True)
# Critical contact allowed ONLY among faces incident on the two tip loops.
P=q['criticalPre'];F=q['preFaces'];h=hits(P,F);cap=np.unique(F[q['removedCaps']]);touch=np.any(np.isin(F,cap),axis=1);bad=[(a,b) for a,b in h if not (touch[a] and touch[b])]
Q=q['criticalPost'];G=q['postFaces'];assert np.array_equal(P,Q[q['vertexMap']])
postHits=hits(Q,G);rep['actualRegular']=regular;rep['actualRegularPasses']=sum(x['regularPass'] and not x['rawNonadjacentBVH'] for x in regular);rep['peakRegularBVH']=peak
rep['actualCritical']={'rawContactPairs':h,'outsideEventPairs':bad,'postRawPairs':postHits,'criticalCoordinateError':float(np.max(abs(P-Q[q['vertexMap']]))),'localizedFaceIDs':np.flatnonzero(touch).tolist()}
rep['actualEventPass']=bool(rep['event']['eventPass'] and not bad and not postHits and rep['actualRegularPasses']==101 and len(h)>0)
(out/'native-fusion.json').write_text(json.dumps(rep,indent=2))
# Geometry proof is recorded before renders. No film on a failed native gate.
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.25,.25,1)
for name,loc,power,size in [('Key',(12,-8,24),5500,18),('Strip',(-12,14,16),4200,15),('Rim',(8,24,6),2600,12)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.22;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,10,0))-o.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Inspection');cam=bpy.data.objects.new('Inspection',cd);s.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO'
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=4;s.render.image_settings.file_format='PNG'
def camera(mode):
    c=Vector((0,11,0));cam.location=c+Vector((0,-5,35) if mode=='engineering' else (12,-15,32));cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=27 if mode=='engineering' else 26
def render(P,F,U,roles,ids,name,mode):
    o=mesh(P,F,U,roles,ids,name)
    if mode=='engineering':
        for i in range(len(o.data.materials)):o.data.materials[i]=clay
    camera(mode);s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True);bpy.data.objects.remove(o,do_unlink=True)
# Actual native evidence before/at/after contact. Critical pre-contact
# geometry is not represented as a regular valid solid.
for stage,k in [('pre',0),('pre',32),('pre',58),('pre',64),('post',0),('post',18),('post',35)]:
    for mode in ('engineering','couture'):render(q[stage][k],q[stage+'Faces'],q[stage+'UV'],q[stage+'Roles'],q[stage+'IDs'],f'{mode}-{stage}-{k:03d}',mode)
# Editable separate pre/post native masters and exact connectivity map.
# No hiding duplicate objects in an animation; renderer constructs the
# explicit connectivity at the event, and both stage masters are saved.
masters={}
for stage in ('pre','post'):
    P=q[stage];F=q[stage+'Faces'];U=q[stage+'UV'];o=mesh(P[0],F,U,q[stage+'Roles'],q[stage+'IDs'],stage);basis=o.shape_key_add(name='Basis');keys=o.data.shape_keys;keys.use_relative=False;basis.interpolation='KEY_LINEAR'
    for k,X in enumerate(P[1:],1):
        key=o.shape_key_add(name=f'{stage}-{k:03d}');key.data.foreach_set('co',X.ravel());key.interpolation='KEY_LINEAR'
    for k,key in enumerate(keys.key_blocks):keys.eval_time=key.frame;keys.keyframe_insert(data_path='eval_time',frame=k+1)
    for fc in keys.animation_data.action.fcurves:
        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    s.frame_start=1;s.frame_end=len(P);s.render.fps=16;s.frame_set(1);camera('couture');f=out/f'ANASTOMOSIS-{stage}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(f))
    errors=[]
    for k,X in enumerate(P):
        s.frame_set(k+1);dg=bpy.context.evaluated_depsgraph_get();eo=o.evaluated_get(dg);me=eo.to_mesh();Y=np.array([tuple(v.co) for v in me.vertices]);errors.append(float(np.max(abs(Y-X))));eo.to_mesh_clear()
    masters[stage]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'evaluatedKeyframeMaxError':max(errors)};bpy.data.objects.remove(o,do_unlink=True)
rep['masters']=masters;(out/'native-fusion.json').write_text(json.dumps(rep,indent=2))
assert rep['actualEventPass'],'Native event qualification failed; diagnostic preserved'
# Short fixed-camera film, 33 pre frames + 18 post frames, actual direct
# geometry with one localized connectivity event. No opacity or switching.
seq=[('pre',k) for k in range(0,65,2)]+[('post',k) for k in range(0,36,2)];rep['filmFrames']=len(seq)
for i,(stage,k) in enumerate(seq):render(q[stage][k],q[stage+'Faces'],q[stage+'UV'],q[stage+'Roles'],q[stage+'IDs'],f'frame-{i:04d}','couture')
# Original low-amplitude synthesized contact event aligned to first post frame.
rate=44100;fps=16;cue=33/fps;duration=len(seq)/fps
with wave.open(str(out/'fusion.wav'),'wb') as w:
    w.setparams((1,2,rate,0,'NONE','not compressed'));buf=bytearray()
    for i in range(round(duration*rate)):
        t=i/rate;z=t-cue;x=.12*min(1,z/.005)*math.exp(-z/.12)*(math.sin(2*math.pi*1330*z)+.3*math.sin(2*math.pi*2570*z)) if 0<=z<.55 else 0.;buf.extend(struct.pack('<h',round(32767*x)))
    w.writeframes(buf)
rep['soundCueSeconds']=cue;(out/'native-fusion.json').write_text(json.dumps(rep,indent=2))
