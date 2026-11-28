"""Native diagnostic reopening of persistent lineage, not a film or complete sequence."""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]);p=Path(args[1]);tension=Path(args[2]);out=Path(args[3]);out.mkdir(parents=True,exist_ok=True)
q=np.load(p/'lineage.npz');a=np.load(p/'approach.npz');b=np.load(root/'bridge/bridge-motion.npz');t=np.load(tension);E=q['vertexAncestorEdges'];w=q['vertexAncestorWeight'][:,None]
def lift(X):return ((1-w)*X[E[:,0]]+w*X[E[:,1]]).astype(np.float32)
seqs={'bridge':(np.array([lift(X) for X in b['poses']]),q['faces']),'tension':(np.array([lift(X) for X in t['poses']]),q['faces']),'approach':(a['poses'],q['splitFaces'])}
report={}
for name,(P,F) in seqs.items():
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;d=bpy.data.meshes.new('ONTOGENESIS '+name);d.from_pydata(P[0].tolist(),[],F.tolist());d.update();o=bpy.data.objects.new('Persistent regional '+name,d);s.collection.objects.link(o)
 uv=d.uv_layers.new(name='PersistentMaterialChart');U=q['materialChart'] if name!='approach' else q['materialChart'][q['weldMap']]
 for l in d.loops:uv.data[l.index].uv=U[l.vertex_index]
 native=d.uv_layers.new(name='NativeChromaticArtworkUV')
 for l in d.loops:native.data[l.index].uv=q['nativeLoopUV'].reshape(-1,2)[l.index]
 for label,values in [('NativeParentID',q['nativeParent']),('CompactReferenceID',q['compactRefOwner']),('OriginalCommonFaceID',q['commonFaceOwner']),('FusionSide',q['splitSide'])]:
  z=d.attributes.new(label,'INT','FACE');z.data.foreach_set('value',values.astype(np.int32))
 uv0=np.array([tuple(l.uv) for l in uv.data]);sets=[set(f) for f in F];rows=[];prev=None
 for k,X in enumerate(P):
  d.vertices.foreach_set('co',X.ravel());d.update();Y=np.array([tuple(v.co) for v in d.vertices],dtype=np.float32);assert np.array_equal(Y,X);assert np.array_equal(uv0,np.array([tuple(l.uv) for l in uv.data]));T=Y[F].astype(float);N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2;tree=BVHTree.FromPolygons(Y.tolist(),F.tolist(),all_triangles=True);hits=[(int(i),int(j)) for i,j in tree.overlap(tree) if i<j and not sets[i].intersection(sets[j])];rows.append({'frame':k,'belowFloor':int((ar<1e-10).sum()),'temporalReversals':0 if prev is None else int((np.sum(N*prev,axis=1)<0).sum()),'rawBVHCount':len(hits),'pairs':hits[:100]});prev=N
 # Native editable sample animation, original pose authority retained.
 d.vertices.foreach_set('co',P[0].ravel());d.update();basis=o.shape_key_add(name='Basis');keys=d.shape_keys;keys.use_relative=False;basis.interpolation='KEY_LINEAR'
 for k,X in enumerate(P[1:],1):
  key=o.shape_key_add(name=f'{name}-{k:03d}');key.data.foreach_set('co',X.ravel());key.interpolation='KEY_LINEAR'
 for k,key in enumerate(keys.key_blocks):keys.eval_time=key.frame;keys.keyframe_insert(data_path='eval_time',frame=k+1)
 for fc in keys.animation_data.action.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
 s.frame_start=1;s.frame_end=len(P);s.render.fps=32;s.frame_set(1);file=out/f'ONTOGENESIS-{name}-diagnostic.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;o=next(x for x in s.objects if x.type=='MESH');errs=[]
 for k,X in enumerate(P):
  s.frame_set(k+1);dg=bpy.context.evaluated_depsgraph_get();eo=o.evaluated_get(dg);me=eo.to_mesh();Y=np.array([tuple(v.co) for v in me.vertices]);errs.append(float(abs(Y-X).max()));eo.to_mesh_clear()
 report[name]={'samples':len(P),'actualStoredExact':True,'peakRawBVH':max(x['rawBVHCount'] for x in rows),'peakBelowFloor':max(x['belowFloor'] for x in rows),'peakTemporal':max(x['temporalReversals'] for x in rows),'editableReopenedKeyMaxError':max(errs),'masterSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'rows':rows}
 (out/'native-lineage.json').write_text(json.dumps(report,indent=2))
# Explicitly separate regional masters; no concatenation or arbitrary visibility event.
assert all(not any(v[k] for k in ['peakRawBVH','peakBelowFloor','peakTemporal']) for v in report.values())
