"""Replay actual archived data, qualify localized candidate in Blender storage."""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).parent))
from genesis_chart import trial
from morphogenesis_measure import audit,nearest,witnesses,EPS
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
p=arg('baseline');out=arg('out');src=arg('source');out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(src)==expected
a=np.load(p/'endpoint-provenance.npz');q=np.load(p/'endpoint-correspondence.npz');r=json.loads((p/'independent-endpoint-qualification.json').read_text())
bad=set.union(*(set(r[k]['badFaceIDs']) for k in ('compact','target','idealDoubleCompact','idealDoubleTarget')))
assert len(bad)==35 and len(a['chart'])==12593 and len(a['faces'])==24727
U,F,A,B,oa,ob,refUV,refB,parents,rep=trial(q,a)
idealA=A.copy();idealB=B.copy();A=A.astype(np.float32).astype(np.float64);B=B.astype(np.float32).astype(np.float64)
rep['historicalBVH']=r['historicalBVH'];rep['sourceSha256']=expected;rep['baselineProvenanceSha256']=sha(p/'endpoint-provenance.npz')
# Independently reopen immutable native source and check all exact target triangle IDs.
bpy.ops.wm.open_mainfile(filepath=str(src));bpy.context.view_layer.update()
frame=bpy.data.objects['TENSION_continuous_frame'];dg=bpy.context.evaluated_depsgraph_get();e=frame.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles()
native=np.array([[tuple(e.matrix_world@me.vertices[i].co) for i in t.vertices] for t in me.loop_triangles],dtype=np.float64)
e.to_mesh_clear()
def key(t):return tuple(sorted(map(tuple,t)))
matches=[key(native[i])==key(t) for i,t in zip(a['nativeTriangleIDs'],q['targetRegion'])]
assert all(matches);rep['nativeTriangleProvenanceMatched']=sum(matches)
for move in rep['moves']:move['nativeTriangleIDs']=[int(a['nativeTriangleIDs'][i]) for i in move['nativeParents']]
rep['targetChildNativeProvenanceCount']=len(parents)
# Save two actual editable research endpoint meshes. No riding geometry modified.
bpy.ops.wm.read_factory_settings(use_empty=True)
results={}
for label,points,owner,uv,ref in [('compact',A,oa,q['sourceUV'],q['compactRemapped']),('target',B,ob,refUV,refB)]:
    d=bpy.data.meshes.new('GENESIS '+label);d.from_pydata(points.tolist(),[],F.tolist());d.update()
    obj=bpy.data.objects.new('GENESIS '+label+' — regional research',d);bpy.context.collection.objects.link(obj)
    layer=d.uv_layers.new(name='PersistentMaterialChart')
    for l in d.loops:layer.data[l.index].uv=U[l.vertex_index]
    obj['research_status']='Regional research candidate, not a qualified riding asset'
    obj['protected_source_sha256']=expected
    name=out/('GENESIS-'+label+'-chart-conditioned.blend');bpy.ops.wm.save_as_mainfile(filepath=str(name))
    bpy.ops.wm.open_mainfile(filepath=str(name));obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');d=obj.data
    read=np.array([tuple(v.co) for v in d.vertices],dtype=np.float64)
    assert np.array_equal(np.array([tuple(p.vertices) for p in d.polygons]),F)
    uvread=np.array([tuple(l.uv) for l in d.uv_layers['PersistentMaterialChart'].data])
    uvError=float(np.max(np.abs(uvread-U[F.reshape(-1)])))
    report,owners=audit(U,read,F,uv,ref);assert np.array_equal(owners,owner)
    report['meshReadbackMax']=float(np.max(np.abs(read-points)));report['uvReadbackMax']=uvError;report['nativeFileSha256']=sha(name)
    ideal=idealA if label=='compact' else idealB;idealReport,_=audit(U,ideal,F,uv,ref);report['idealDouble']=idealReport
    results[label]=report
    # Reopen a fresh scene before the next endpoint.
    bpy.ops.wm.read_factory_settings(use_empty=True)
rep['reopened']=results
rep['endpointPass']=bool(all(v['distancePass'] and v['coveragePass'] and v['orientationPass'] and not v['nearDegenerateGeometricFaces'] and v['meshReadbackMax']<EPS and v['uvReadbackMax']<EPS and v['idealDouble']['distancePass'] and v['idealDouble']['coveragePass'] and v['idealDouble']['orientationPass'] and not v['idealDouble']['nearDegenerateGeometricFaces'] for v in results.values()))
np.savez_compressed(out/'conditioned-correspondence.npz',chart=U,faces=F,compact=A,target=B,compactFaceOwner=oa,targetFaceOwner=ob,nativeTriangleIDs=a['nativeTriangleIDs'],targetChildParent=parents,targetChildNativeID=a['nativeTriangleIDs'][parents],targetUV=refUV,targetRef=refB,sourceUV=q['sourceUV'],sourceRef=q['compactRemapped'],idealCompact=idealA,idealTarget=idealB)
(out/'qualification.json').write_text(json.dumps(rep,indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x)))
assert sha(src)==expected
print('GENESIS',json.dumps({'endpointPass':rep['endpointPass'],'counts':rep['newCounts'],'reopened':results},default=lambda x:x.item() if isinstance(x,np.generic) else str(x)))
assert rep['endpointPass'],'Retained strict endpoint failure; regional films and front assembly blocked'
