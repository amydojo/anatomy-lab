"""Actual Blender storage, collision witnesses and representative two-camera
renders of the paired derivative shell; original upper strip exact."""
import bpy,sys,json,hashlib,collections,math
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from exogenesis_shell import build
from morphogenesis_measure import nearest
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);base=arg('baseline');inp=arg('numerics')
q=np.load(base/'conditioned-correspondence.npz');p=np.load(inp/'tension-161.npz');assert np.array_equal(p['faces'],q['faces']) and np.array_equal(p['uv'],q['chart'])
assert np.array_equal(p['poses'][0],q['compact']) and np.array_equal(p['poses'][-1],q['target'])
P,F,U,be,report=build(p['poses'],p['faces'],p['uv']);assert report['passes']==161
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
d=bpy.data.meshes.new('EXOGENESIS paired shell');d.from_pydata(P[0].tolist(),[],F.tolist());d.update();obj=bpy.data.objects.new('Connected derivative shell — native upper / constructed lower',d);s.collection.objects.link(obj)
uv=d.uv_layers.new(name='PersistentMaterialChart')
n=len(q['compact']);nf=len(q['faces']);roles=np.r_[np.zeros(nf,int),np.ones(nf,int),np.full(2*len(be),2,int)]
# Separate persistent wall UVs: each wall quad has edge-length coordinate
# and thickness coordinate, never zero-area UV due to identical skin chart.
arc={};adj={int(a):int(b) for a,b in be};v=min(adj);start=v;length=0.;arc[v]=0.
while True:
    w=adj[v];length+=float(np.linalg.norm(P[0,w]-P[0,v]))
    if w==start:break
    arc[w]=length;v=w
for poly in d.polygons:
    for l in poly.loop_indices:
        vid=d.loops[l].vertex_index
        if poly.index<2*nf:uv.data[l].uv=U[vid]
        else:
            vv=vid%n;u=arc[vv]/length
            ids=[x%n for x in poly.vertices]
            if start in ids and any(arc[x]/length>.9 for x in ids) and vv==start:u=1.
            uv.data[l].uv=(u,1. if vid<n else 0.)
    poly.use_smooth=poly.index<2*nf
uv0=np.array([tuple(x.uv) for x in uv.data]);sets=[set(f) for f in F];raw=[];stored=[]
for i,X in enumerate(P):
    d.vertices.foreach_set('co',X.ravel());d.update();bpy.context.view_layer.update();Y=np.array([tuple(v.co) for v in d.vertices],dtype=np.float32);assert np.array_equal(Y,X)
    tree=BVHTree.FromPolygons(Y.tolist(),F.tolist(),all_triangles=True)
    hits=[(a,b) for a,b in tree.overlap(tree) if a<b and not sets[a].intersection(sets[b])]
    pairs=collections.Counter(tuple(sorted((int(roles[a]),int(roles[b])))) for a,b in hits)
    raw.append({'frame':i,'count':len(hits),'categories':{str(k):v for k,v in pairs.items()},'pairs':hits[:200]});stored.append(Y)
    assert np.array_equal(uv0,np.array([tuple(x.uv) for x in uv.data]))
report['actualStoredPoseCount']=len(stored);report['actualStoredExact']=bool(np.array_equal(np.array(stored),P));report['rawBVH']=raw;report['peakRawBVH']=max(x['count'] for x in raw)
report['persistentUVStable']=True;report['nativeUpperEndpointMaxError']=float(np.max(abs(P[-1,:n]-q['target'])))
report['fullSampledPass']=bool(report['passes']==161 and report['peakRawBVH']==0 and report['actualStoredExact'])
# Actual Euclidean point-to-opposite-skin distance witnesses. These are
# sampled point-to-triangle distances, not an exhaustive triangle-pair min.
dist=[]
for i in (0,40,80,120,160):
    X=P[i].astype(float);upper=X[:n];lower=X[n:];ids=np.unique(np.r_[np.arange(0,n,31),be.ravel()])
    a,_=nearest(upper[ids],lower[q['faces']]);b,_=nearest(lower[ids],upper[q['faces']]);dist.append({'frame':i,'sampledVerticesPerSkin':len(ids),'upperToLowerMin':float(a.min()),'lowerToUpperMin':float(b.min()),'median':float(np.median(np.r_[a,b]))})
report['euclideanThicknessWitnesses']=dist
(out/'actual-shell-report.json').write_text(json.dumps(report,indent=2))
np.savez_compressed(out/'shell-poses.npz',poses=P,faces=F,uv=U,boundary=be,faceRole=roles,loopUV=uv0)
def mat(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;return m
clay=mat('Engineering clay',(.43,.43,.43),0,.5);clay.use_fake_user=True
silver=mat('COUTURE persistent silver/orchid',(.62,.59,.53),.93,.22);petrol=mat('Lower petrol',(.015,.065,.12),.88,.24);wall=mat('Continuous silver edge',(.62,.59,.53),.92,.19)
nd=silver.node_tree.nodes;lk=silver.node_tree.links;tex=nd.new('ShaderNodeUVMap');tex.uv_map=uv.name;sep=nd.new('ShaderNodeSeparateXYZ');lk.new(tex.outputs[0],sep.inputs[0]);ramp=nd.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
colors=[(0,(.62,.59,.53,1)),(.68,(.62,.59,.53,1)),(.69,(.7,.015,.22,1)),(.75,(.7,.015,.22,1)),(.76,(.62,.59,.53,1)),(1,(.62,.59,.53,1))]
for i,(pos,col) in enumerate(colors):
    el=ramp.color_ramp.elements[i] if i<2 else ramp.color_ramp.elements.new(pos);el.position=pos;el.color=col
lk.new(sep.outputs['Y'],ramp.inputs[0]);lk.new(ramp.outputs[0],nd.get('Principled BSDF').inputs['Base Color'])
for m in [silver,petrol,wall]:d.materials.append(m)
for i,x in enumerate(d.polygons):x.material_index=int(roles[i])
s.world=bpy.data.worlds.new('EXOGENESIS studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1)
for name,loc,power,size in [('Key',(20,-30,55),65000,50),('Strip',(-30,20,35),45000,40),('Rim',(15,35,-20),35000,35)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.20;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((4,-12,2))-o.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Inspection');cam=bpy.data.objects.new('Inspection',cd);s.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO'
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.resolution_x=1000;s.render.resolution_y=564;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=4;s.render.image_settings.file_format='PNG'
fixedCenter=Vector(tuple((P.min((0,1))+P.max((0,1)))/2));fixedScale=float(np.max(P.max((0,1))-P.min((0,1)))*1.35)
selected=sorted({0,40,80,120,160,min(range(161),key=lambda i:report['samples'][i]['minArea']),max(range(161),key=lambda i:raw[i]['count'])})
for i in selected:
    X=P[i];d.vertices.foreach_set('co',X.ravel());d.update()
    for treatment in ('engineering','couture'):
        if treatment=='engineering':
            c=fixedCenter;cam.location=c+Vector((75,-25,85));cd.ortho_scale=fixedScale
            for j in range(3):d.materials[j]=clay
        else:
            c=Vector(tuple((X.min(0)+X.max(0))/2));cam.location=c+Vector((70,-20,34));cd.ortho_scale=max(8,float(np.max(X.max(0)-X.min(0))*1.25))
            for j,m in enumerate([silver,petrol,wall]):d.materials[j]=m
        cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/f'{treatment}-{i:03d}.png');bpy.ops.render.render(write_still=True)
# Native editable absolute keys. Direct stored arrays are authority;
# reopening keyframes is measured separately rather than assumed exact.
d.vertices.foreach_set('co',P[0].ravel());d.update();basis=obj.shape_key_add(name='Basis');keys=d.shape_keys;keys.use_relative=False;basis.interpolation='KEY_LINEAR'
for i,X in enumerate(P[1:],1):
    key=obj.shape_key_add(name=f'LAYER-{i:03d}');key.data.foreach_set('co',X.ravel());key.interpolation='KEY_LINEAR'
for i,k in enumerate(keys.key_blocks):keys.eval_time=k.frame;keys.keyframe_insert(data_path='eval_time',frame=i+1)
for fc in keys.animation_data.action.fcurves:
    for kp in fc.keyframe_points:kp.interpolation='LINEAR'
s.frame_start=1;s.frame_end=161;s.render.fps=32;s.frame_set(1)
file=out/'EXOGENESIS-layered-shell.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;obj=next(o for o in s.objects if o.type=='MESH');errs=[]
for i,X in enumerate(P):
    s.frame_set(i+1);dg=bpy.context.evaluated_depsgraph_get();eo=obj.evaluated_get(dg);me=eo.to_mesh();Y=np.array([tuple(v.co) for v in me.vertices]);errs.append(float(np.max(abs(Y-X))));eo.to_mesh_clear()
report['editableKeyframeMaxError']=max(errs);report['editableKeyframesExact']=max(errs)==0;report['nativeSha256']=hashlib.sha256(file.read_bytes()).hexdigest();report['selectedRenderFrames']=selected
(out/'actual-shell-report.json').write_text(json.dumps(report,indent=2))
assert report['fullSampledPass'],'Raw collision or geometry gate failed; diagnostic retained'
