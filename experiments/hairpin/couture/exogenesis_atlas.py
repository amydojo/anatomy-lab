"""Read-only complete evaluated front atlas, plus actual frozen wearable topology.
Native triangle IDs are authoritative. Anatomical/engineering role labels are
derived from control blocks and normals; generated/uncertain faces explicit."""
import bpy,sys,json,hashlib,collections
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
from shapely import points
from shapely.strtree import STRtree
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from unfurl_chart import diagnose
from morphogenesis_measure import bary
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
src=arg('source');frozen=arg('frozen');out=arg('out');out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(src)==expected
frozenHash='4a71ff5ef2134044b2e716a13fe567f58a07c2e4a18b259b39eba097740f2957';assert sha(frozen)==frozenHash
def read(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg);me.calc_loop_triangles()
    P=np.array([tuple(e.matrix_world@v.co) for v in me.vertices],dtype=np.float64);F=np.array([tuple(t.vertices) for t in me.loop_triangles]);M=np.array([t.material_index for t in me.loop_triangles]);poly=np.array([t.polygon_index for t in me.loop_triangles])
    layer=me.uv_layers.get('ChromaticArtworkUV');UV=np.array([[tuple(layer.data[l].uv) for l in t.loops] for t in me.loop_triangles]) if layer else np.empty((0,3,2))
    e.to_mesh_clear();return P,F,M,poly,UV
def topo(P,F):
    r,_,_=diagnose(F.tolist());T=P[F];r['signedVolume']=float(np.einsum('ij,ij->i',T[:,0],np.cross(T[:,1],T[:,2])).sum()/6);r['genusIfClosedOrientable']=(2-r['euler'])/2 if r['components']==1 and not r['boundaryEdges'] and not r['nonmanifoldEdges'] else None;return r
bpy.ops.wm.open_mainfile(filepath=str(frozen));bpy.context.view_layer.update();body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body');W,WF,WM,WP,WUV=read(body);wear=topo(W,WF)
bpy.ops.wm.open_mainfile(filepath=str(src));bpy.context.view_layer.update();s=bpy.context.scene;o=bpy.data.objects['TENSION_continuous_frame'];assert o.get('assembly')=='front'
P,F,M,poly,UV=read(o);top=topo(P,F);assert len(P)==13618 and len(F)==27240
key=lambda t:tuple(sorted(map(tuple,t)))
native=collections.defaultdict(list)
for i,t in enumerate(P[F]):native[key(t)].append(i)
assert all(len(v)==1 for v in native.values()),'Native triangle keys ambiguous'
probe=json.loads((arg('probe')/'growth-probe.json').read_text())
# Mark ALL control polygons, not just interiors. Classifications are
# control-grid roles; modifier descendants are not asserted exact parent faces.
copy=o.copy();copy.data=o.data.copy();s.collection.objects.link(copy);d=copy.data;labels={};controlLabels=[]
def classify(p):
    ids=list(p.vertices);blocks={v//909 for v in ids if v<3636}
    if any(v>=3636 for v in ids) or len(blocks)!=1:return 'connector_or_branch_control'
    k=next(iter(blocks));rows=[(v%909)//9 for v in ids];cols=[v%9 for v in ids]
    band='end_connection' if min(rows)<21 or max(rows)>98 else 'edge_band' if min(cols)<1 or max(cols)>7 else 'interior'
    return f'block_{k}_{band}'
for p in d.polygons:
    role=classify(p);controlLabels.append(role)
    if role not in labels:
        mat=bpy.data.materials.new('ATLAS '+role);d.materials.append(mat);labels[role]=len(d.materials)-1
    p.material_index=labels[role]
bpy.context.view_layer.update();Q,G,CM,CP,CUV=read(copy);bpy.data.objects.remove(copy,do_unlink=True)
reverse={v:k for k,v in labels.items()};roles=['modifier_generated_unattributed']*len(F);marked=np.zeros(len(F),bool)
for f,mi in zip(G,CM):
    ids=native.get(key(Q[f]),[]);assert len(ids)==1
    i=ids[0];assert not marked[i];marked[i]=True;roles[i]=reverse.get(int(mi),'modifier_generated_unattributed')
assert marked.all()
# The eight verified marked regions are exact native ID sets from the
# previous immutable-source probe. Other labels are explicit candidates.
N=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
known={}
for block in probe['blocks']:
    for i in block['nativeTriangleIDs']:
        assert i not in known;known[i]=f"block_{block['block']}_interior_{'positive' if block['nativeNormalZSign']>0 else 'negative'}_skin"
for i in range(len(F)):
    if i in known:roles[i]=known[i]
    elif roles[i].startswith('block_'):
        nz=N[i,2]/np.linalg.norm(N[i]);roles[i]+='_positive_skin_candidate' if nz>.65 else '_negative_skin_candidate' if nz<-.65 else '_sidewall_candidate'
# All native faces have a single partition ID; all chart boundaries explicit.
names=sorted(set(roles));owner=np.array([names.index(x) for x in roles]);ed=collections.defaultdict(list)
for i,f in enumerate(F):
    for a,b in zip(f,np.roll(f,-1)):ed[tuple(sorted((int(a),int(b))))].append(i)
assert all(len(v)==2 for v in ed.values());E=np.array(list(ed));adj=np.array(list(ed.values()));interfaces=owner[adj[:,0]]!=owner[adj[:,1]]
counts=collections.Counter(roles);regions=[]
for k,name in enumerate(names):
    ids=np.flatnonzero(owner==k);rr,_,_=diagnose(F[ids].tolist());regions.append({'id':k,'name':name,'nativeTriangleCount':len(ids),'topology':rr,'nativeTriangleIDs':ids.tolist(),'bounds':[P[F[ids]].reshape(-1,3).min(0).tolist(),P[F[ids]].reshape(-1,3).max(0).tolist()]})
# Native attachment proximity evidence, not mechanical mating qualification.
centers=P[F].mean(1);mating={}
for obj in s.objects:
    if obj==o or obj.type!='MESH' or obj.get('assembly')!='front':continue
    A,B,_,_,_=read(obj);tree=BVHTree.FromPolygons(A.tolist(),B.tolist(),all_triangles=True)
    ds=np.array([tree.find_nearest(p)[3] for p in centers]);mating[obj.name]={'minCentroidDistance':float(ds.min()),'nearWithinPointOne':np.flatnonzero(ds<.1).tolist()}
# Actual lower skin coverage relative to the frozen qualified upper strip.
q=np.load(arg('baseline')/'conditioned-correspondence.npz');lower=next(x for x in probe['blocks'] if x['block']==2 and x['nativeNormalZSign']==-1);lowerIDs=np.array(lower['nativeTriangleIDs']);LT=P[F[lowerIDs]];polys=[Polygon(t[:,:2]) for t in LT];tree=STRtree(polys)
T=q['target'];witness=T[:,:2];pairs=tree.query(points(witness),predicate='intersects');hit=np.full(len(T),-1,int);hit[pairs[0]]=pairs[1];valid=np.flatnonzero(hit>=0)
weights=bary(witness[valid],LT[hit[valid],:,:2]);lp=np.einsum('ij,ijk->ik',weights,LT[hit[valid]]);gap=T[valid,2]-lp[:,2]
report={'sourceSha256':expected,'frozenBSha256':frozenHash,'fullNativeTopology':top,'frozenBTopology':wear,'topologyCompatibleWithoutChange':top['euler']==wear['euler'] and top['boundaryEdges']==wear['boundaryEdges'],'nativeTriangleOwnershipComplete':bool(len(owner)==len(F) and marked.all()),'nativeMaterialSlots':[m.name for m in o.data.materials],'controlRoleCounts':dict(collections.Counter(controlLabels)),'regions':regions,'physicalBoundaryEdges':0,'chartInterfaceEdges':int(interfaces.sum()),'chartInterfacePairs':{f'{names[a]} | {names[b]}':n for (a,b),n in collections.Counter(tuple(sorted((int(owner[x]),int(owner[y])))) for x,y in adj[interfaces]).items()},'matingCentroidProximityCandidates':mating,'actualOpposingBlock2Skin':{'nativeTriangleCount':len(LT),'matchedUpperVertices':len(valid),'totalUpperVertices':len(T),'unmatchedUpperVertices':len(T)-len(valid),'verticalGapMin':float(gap.min()) if len(gap) else None,'verticalGapMax':float(gap.max()) if len(gap) else None,'verticalGapMedian':float(np.median(gap)) if len(gap) else None,'nonpositiveGap':int(np.sum(gap<=0)),'derivativeOffsetPoint28MaxDeviationOnMatchedVertices':float(np.max(abs(gap-.28))) if len(gap) else None},'limitations':['Native triangle ID and adjacency exact; semantic role labels from control grids and normal threshold are candidate classifications, not exact control-face provenance.','Connector/branch bucket includes all cross-block or extra-index control faces; crown/nose semantic distinction not independently established.','Mating candidates use face-centroid distance to other native front components; not contact qualification.','Genus difference requires explicit topology change, not disappearance.','Actual opposing skin may not share identical projected domain; no native lower parity claimed.']}
np.savez_compressed(out/'native-atlas.npz',vertices=P,faces=F,nativeTriangleIDs=np.arange(len(F)),nativeEvaluatedPolygon=poly,nativeMaterial=M,nativeLoopUV=UV,regionID=owner,edgeVertices=E,edgeFaceIDs=adj,chartInterfaceMask=interfaces,frozenVertices=W,frozenFaces=WF,matchedUpperVertexIDs=valid,lowerTriangleIDs=lowerIDs[hit[valid]],lowerPositions=lp,verticalGap=gap)
(out/'native-atlas.json').write_text(json.dumps(report,indent=2))
# An editable diagnostic native mesh, not a replacement riding asset.
bpy.ops.wm.read_factory_settings(use_empty=True);d=bpy.data.meshes.new('EXOGENESIS exact native atlas');d.from_pydata(P.tolist(),[],F.tolist());d.update();ob=bpy.data.objects.new('Native frame atlas — diagnostic',d);bpy.context.collection.objects.link(ob)
for i,name in enumerate(names):
    mat=bpy.data.materials.new(name);mat.diffuse_color=((i*.618)%1,(i*.397+.3)%1,(i*.213+.4)%1,1);d.materials.append(mat)
for i,p in enumerate(d.polygons):p.material_index=int(owner[i])
if len(UV):
    uv=d.uv_layers.new(name='NativeChromaticArtworkUV')
    for i,l in enumerate(d.loops):uv.data[i].uv=UV.reshape(-1,2)[i]
bpy.ops.wm.save_as_mainfile(filepath=str(out/'EXOGENESIS-native-atlas.blend'))
assert sha(src)==expected and sha(frozen)==frozenHash
