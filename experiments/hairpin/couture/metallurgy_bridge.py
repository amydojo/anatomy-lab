"""METALLURGY frozen B strip bridge. Actual native indexed triangles; no substitution."""
import bpy,sys,math,json,hashlib,itertools,collections,bisect
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True)
src=arg('source');compact=arg('compact')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
assert sha(src)==expected
def arc(points):
    d=[0.]
    for a,b in zip(points,points[1:]):d.append(d[-1]+(a-b).length)
    return [x/d[-1] for x in d]
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return (a[0]-b[0],a[1]-b[1])
def orient(a,b,c):return cross(sub(b,a),sub(c,a))
def signed(poly):return sum(cross(a,b) for a,b in zip(poly,poly[1:]+poly[:1]))/2
def triangle(uv,xyz):
    if orient(*uv)<0:uv=[uv[0],uv[2],uv[1]];xyz=[xyz[0],xyz[2],xyz[1]]
    return {'uv':uv,'p':xyz}
def interp(q,p):
    a,b,c=q['uv'];d=orient(a,b,c);assert d>1e-14
    v=orient(a,p,c)/d;w=orient(a,b,p)/d
    return Vector(np.array(q['p'],dtype=np.float64).T@np.array([1-v-w,v,w],dtype=np.float64))
def chart(o,start,end,first,last,stride,offset=0):
    d=o.data;M=o.matrix_world
    ids={offset+i*stride+j:(i,j) for i in range(start,end+1) for j in range(first,last+1)}
    centers=[sum((M@d.vertices[offset+i*stride+j].co for j in range(first,last+1)),Vector())/(last-first+1) for i in range(start,end+1)]
    u=arc(centers);uv={i:(u[row-start],(col-first)/(last-first)) for i,(row,col) in ids.items()}
    d.calc_loop_triangles();rows=[];faces=set()
    for t in d.loop_triangles:
        if all(i in uv for i in t.vertices) and len(d.polygons[t.polygon_index].vertices)==4 and all(i in uv for i in d.polygons[t.polygon_index].vertices):
            faces.add(t.polygon_index);rows.append(triangle([uv[i] for i in t.vertices],[M@d.vertices[i].co for i in t.vertices]))
    assert len(faces)==(end-start)*(last-first),(o.name,len(faces))
    assert abs(sum(signed(q['uv']) for q in rows)-1)<1e-7
    return rows,uv,faces
bpy.ops.wm.open_mainfile(filepath=str(compact));bpy.context.view_layer.update()
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body')
assert len(body.data.vertices)==2888 and not body.modifiers
A,oldUV,oldFaces=chart(body,0,120,3,6,8)
oldIndices=[]
for t in body.data.loop_triangles:
    if t.polygon_index in oldFaces:
        ids=list(t.vertices)
        if orient(*[oldUV[i] for i in ids])<0:ids=[ids[0],ids[2],ids[1]]
        oldIndices.append(ids)
assert len(oldIndices)==len(A)
frozen=arg('frozen');frozenHash=sha(frozen)
assert frozenHash=='4a71ff5ef2134044b2e716a13fe567f58a07c2e4a18b259b39eba097740f2957'
bpy.ops.wm.open_mainfile(filepath=str(frozen));bpy.context.view_layer.update()
bodyB=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body')
assert len(bodyB.data.vertices)==2888 and not bodyB.modifiers
bodyB.data.calc_loop_triangles()
nativeB={tuple(sorted(t.vertices)):t.index for t in bodyB.data.loop_triangles if t.polygon_index in oldFaces}
keys={tuple(sorted(ids)) for ids in oldIndices}
bridge={'frozenSha256':frozenHash,'oldStripTriangleCount':len(oldIndices),'frozenStripTriangleCount':len(nativeB),'matchingNativeTriangles':len(keys.intersection(nativeB)),'differentTriangleKeys':len(keys.symmetric_difference(nativeB))}
(out/'bridge-report.json').write_text(json.dumps(bridge,indent=2))
assert keys==set(nativeB),'Native diagonal differs; a separate common refinement is required'
Borig=[{'uv':q['uv'],'p':[bodyB.matrix_world@bodyB.data.vertices[i].co for i in ids]} for q,ids in zip(A,oldIndices)]
bridge['frozenTriangleIDs']=[int(nativeB[tuple(sorted(ids))]) for ids in oldIndices]
# Transform mm to illustrative authoring units, preserving compact geometry.
R=Matrix.Rotation(-math.pi/2,3,'Z')*.1
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene;bpy.context.view_layer.update()
frame=bpy.data.objects['TENSION_continuous_frame']
assert frame.get('assembly')=='front' and len(frame.data.vertices)>=3636
# Interior of one actual upper rail. Deliberately exclude nose bridge,
# outer sidewall and mating boundaries. No claim about complete frame.
Bcontrol,uv,faces=chart(frame,21,98,1,7,9,2*909)
def surface_tree(rows):
    vs=[v for q in rows for v in q['p']];return BVHTree.FromPolygons(vs,[(i,i+1,i+2) for i in range(0,len(vs),3)],all_triangles=True)
def evaluated_tree(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles();v=[e.matrix_world@x.co for x in me.vertices];f=[tuple(t.vertices) for t in me.loop_triangles];e.to_mesh_clear();return BVHTree.FromPolygons(v,f,all_triangles=True)
native_eval=evaluated_tree(frame)
dg=bpy.context.evaluated_depsgraph_get();ev=frame.evaluated_get(dg);nativeMesh=ev.to_mesh();nativeMesh.calc_loop_triangles()
nativeTriangles=np.array([[tuple(ev.matrix_world@nativeMesh.vertices[i].co) for i in t.vertices] for t in nativeMesh.loop_triangles],dtype=np.float64)
ev.to_mesh_clear()
# Probe exact evaluated top surface via UV chart and face tag propagated
# through copied native modifiers. Never edit protected source data.
copy=frame.copy();copy.data=frame.data.copy();s.collection.objects.link(copy)
d=copy.data;marker=bpy.data.materials.new('LIQUID METAL evaluation chart sentinel');d.materials.append(marker);mi=len(d.materials)-1
chartuv=d.uv_layers.new(name='LiquidChart')
for p in d.polygons:
    if p.index in faces:
        p.material_index=mi
        for l in p.loop_indices:chartuv.data[l].uv=uv[d.loops[l].vertex_index]
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();e=copy.evaluated_get(dg);me=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg);me.calc_loop_triangles()
sys.path.insert(0,str(Path(__file__).parent))
from unfurl_chart import chart_evaluated,overlay_noded,remap_compact
compactOriginal=A
rootA=sum((p for q in A for u,p in zip(q['uv'],q['p']) if u[0]>.999999),Vector())/sum(u[0]>.999999 for q in A for u in q['uv'])
probe_diag={}
try:
    B,boundaryMap,domain=chart_evaluated(me,e.matrix_world,mi,probe_diag)
    A=remap_compact(A,boundaryMap,probe_diag)
    Bnew=remap_compact(Borig,boundaryMap,{})
    targetRootUV={q[2] for q in boundaryMap if 1<=q[0]<=2}
    rootBpts=[p for q in B for uv,p in zip(q['uv'],q['p']) if tuple(uv) in targetRootUV]
    assert rootBpts
    rootB=sum(rootBpts,Vector())/len(rootBpts)
    (out/'evaluated-chart.json').write_text(json.dumps(probe_diag,indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x)))
    assert len(Bnew)==len(A)
finally:
    (out/'evaluated-chart.json').write_text(json.dumps(probe_diag,indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x)))
    e.to_mesh_clear();bpy.data.objects.remove(copy,do_unlink=True)
use_eval=True
# The two actual regions remain tied to one index buffer through the film.
# Register compact root to target root for coherent unfolding at real chart scale.
C=Matrix.Translation(rootB-R@rootA)@R.to_4x4()


from morphogenesis_measure import audit,map_chart,nearest,witnesses,EPS
from metallurgy_solver import harmonic,height
q=np.load(arg('baseline')/'conditioned-correspondence.npz');U=q['chart'];F=q['faces'];uv=np.array([z['uv'] for z in A]);uvB=np.array([z['uv'] for z in Bnew])
assert np.array_equal(uv,uvB)
oldRef=np.array([[tuple(C@p) for p in z['p']] for z in A]);newRef=np.array([[tuple(C@p) for p in z['p']] for z in Bnew])
bridge['referenceChartMaxError']=float(np.max(abs(uv-q['sourceUV'])));bridge['historicalRefMaxError']=float(np.max(abs(oldRef-q['sourceRef'])))
assert bridge['referenceChartMaxError']<1e-12 and bridge['historicalRefMaxError']<EPS
# All B subdivisions are on the actual corresponding native B triangles.
nativeRef=np.array([[tuple(C@p) for p in z['p']] for z in Borig])
sub={}
for name,x,y in [('refinedToNative',newRef,nativeRef),('nativeToRefined',nativeRef,newRef)]:
    d,_=nearest(np.concatenate([x.reshape(-1,3),witnesses(x)]),y);sub[name]=float(d.max())
bridge['nativeRefinementBidirectional']=sub
bridge['nativeArea']=float(np.linalg.norm(np.cross(nativeRef[:,1]-nativeRef[:,0],nativeRef[:,2]-nativeRef[:,0]),axis=1).sum()/2)
bridge['refinedArea']=float(np.linalg.norm(np.cross(newRef[:,1]-newRef[:,0],newRef[:,2]-newRef[:,0]),axis=1).sum()/2)
assert max(sub.values())<EPS and abs(bridge['nativeArea']-bridge['refinedArea'])/bridge['nativeArea']<1e-5
ideal,_,_=map_chart(U,uv,newRef);stored=ideal.astype(np.float32)
bpy.ops.wm.read_factory_settings(use_empty=True);d=bpy.data.meshes.new('Frozen B regional correspondence');d.from_pydata(stored.tolist(),[],F.tolist());d.update()
o=bpy.data.objects.new('Frozen B actual mapped prong strip',d);bpy.context.collection.objects.link(o)
layer=d.uv_layers.new(name='PersistentMaterialChart')
for l in d.loops:layer.data[l.index].uv=U[l.vertex_index]
file=out/'METALLURGY-B-bridge.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file))
d=next(o for o in bpy.context.scene.objects if o.type=='MESH').data;read=np.array([tuple(v.co) for v in d.vertices])
assert np.array_equal(np.array([tuple(p.vertices) for p in d.polygons]),F)
rep,owner=audit(U,read,F,uv,newRef);bridge['frozenEndpoint']=rep;bridge['meshReadbackMax']=float(np.max(abs(read-stored)))
bridge['endpointPass']=bool(rep['distancePass'] and rep['coveragePass'] and rep['orientationPass'] and not rep['nearDegenerateGeometricFaces'] and bridge['meshReadbackMax']<EPS)
np.savez_compressed(out/'bridge-correspondence.npz',chart=U,faces=F,frozen=read,idealFrozen=ideal,compact=q['compact'],sourceUV=uv,sourceRef=newRef,nativeBRef=nativeRef)
(out/'bridge-report.json').write_text(json.dumps(bridge,indent=2))
assert sha(frozen)==frozenHash
assert bridge['endpointPass'],'Frozen B endpoint not qualified'
# Preliminary bridge, not a whole wearable release. Retain every gate.
qq={'idealCompact':ideal,'idealTarget':q['idealCompact'],'compact':read,'target':q['compact'],'faces':F}
poses,weights=harmonic(qq,81);motion,poses=height(qq,poses,False);bridge['bridgeMotion']=motion;bridge['bridgeWeights']=weights
(out/'bridge-report.json').write_text(json.dumps(bridge,indent=2));np.savez_compressed(out/'bridge-motion.npz',poses=poses,faces=F,uv=U)
assert motion['passes']==81,'Bridge motion not fully qualified'
