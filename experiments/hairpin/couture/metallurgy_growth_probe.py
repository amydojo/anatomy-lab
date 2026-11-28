"""GROWTH applicability probe: actual protected evaluated front structural frame.
Read-only source; no deformation or full assembly authorization."""
import bpy,sys,math,json,hashlib,collections
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
sys.path.insert(0,str(Path(__file__).parent))
from unfurl_chart import diagnose
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
src=arg('source');out=arg('out');out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(src)==expected
bpy.ops.wm.open_mainfile(filepath=str(src));bpy.context.view_layer.update();s=bpy.context.scene
o=bpy.data.objects['TENSION_continuous_frame'];assert o.get('assembly')=='front' and len(o.data.vertices)>=3636
def read(obj):
    dg=bpy.context.evaluated_depsgraph_get();e=obj.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles()
    P=np.array([tuple(e.matrix_world@v.co) for v in me.vertices]);F=np.array([tuple(t.vertices) for t in me.loop_triangles]);mi=np.array([t.material_index for t in me.loop_triangles]);e.to_mesh_clear();return P,F,mi
P,F,_=read(o);top,_,_=diagnose(F.tolist())
key=lambda t:tuple(sorted(map(tuple,t)))
native=collections.defaultdict(list)
for i,t in enumerate(P[F]):native[key(t)].append(i)
copy=o.copy();copy.data=o.data.copy();s.collection.objects.link(copy)
markers={};selected={}
for k in range(4):
    m=bpy.data.materials.new(f'GROWTH block {k} sentinel');copy.data.materials.append(m);mi=len(copy.data.materials)-1;markers[mi]=k
    ids={k*909+i*9+j for i in range(21,99) for j in range(1,8)}
    polys=[p for p in copy.data.polygons if len(p.vertices)==4 and all(v in ids for v in p.vertices)];assert len(polys)==77*6
    for p in polys:p.material_index=mi
    selected[k]=len(polys)
bpy.context.view_layer.update();Q,G,M=read(copy);bpy.data.objects.remove(copy,do_unlink=True)
N=np.cross(Q[G[:,1]]-Q[G[:,0]],Q[G[:,2]]-Q[G[:,0]])
report={'sourceSha256':expected,'fullFrameEvaluatedTopology':top,'blocks':[],'projectedPairOverlaps':[],'scope':'Actual four interior evaluated strip regions; not complete front correspondence or motion.','limitations':['Marker propagation on temporary copied modifiers; every selected native triangle checked by exact coordinate triplet.','Upper/lower layers cannot be assumed to form one graph; graph qualification applies only to each selected surface.','Full sidewall and branching correspondence remains separate.']}
domains={}
for mi,k in markers.items():
    for sign in (1,-1):
        ids=np.flatnonzero((M==mi)&(N[:,2]*sign>1e-9));faces=G[ids]
        if not len(faces):continue
        t,_,bd=diagnose(faces.tolist());proj=[Polygon(Q[f,:2]) for f in faces]
        union=unary_union(proj);sumarea=sum(p.area for p in proj);matches=[native.get(key(Q[f]),[]) for f in faces]
        assert all(matches),('unmatched native evaluated triangles',k,sign)
        x={'block':k,'nativeNormalZSign':sign,'controlQuads':selected[k],'selectedEvaluatedTriangles':len(faces),'topology':t,'projectedUnionArea':float(union.area),'projectedTriangleAreaSum':float(sumarea),'projectedAreaExcess':float(sumarea-union.area),'projectedUnionType':union.geom_type,'bounds':np.stack([Q[faces].reshape(-1,3).min(0),Q[faces].reshape(-1,3).max(0)]).tolist(),'nativeTriangleIDs':[int(a[0]) for a in matches],'ambiguousNativeMatches':sum(len(a)>1 for a in matches)}
        x['planarDiskCandidate']=bool(t['components']==1 and t['boundaryComponents']==1 and t['euler']==1 and not t['nonmanifoldEdges'] and not t['boundaryDegreeDefects'] and union.geom_type=='Polygon' and union.is_valid and abs(sumarea-union.area)<1e-8)
        report['blocks'].append(x);domains[k,sign]=union
for a in sorted(domains):
    for b in sorted(domains):
        if a>=b:continue
        overlap=domains[a].intersection(domains[b]);report['projectedPairOverlaps'].append({'a':list(a),'b':list(b),'area':float(overlap.area)})
report['nativeSourceUnchanged']=sha(src)==expected
(out/'growth-probe.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='blocks'}))
assert report['nativeSourceUnchanged']
