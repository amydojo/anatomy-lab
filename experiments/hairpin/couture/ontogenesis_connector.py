"""Read-only native source connector lineage and opposing-prong/rear chart probe.
Modifier-propagated tags are candidates, never exact control-parent assertions."""
import bpy,sys,json,hashlib,collections,math
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
source=arg('source');frozen=arg('frozen');out=arg('out');out.mkdir(exist_ok=True,parents=True);atlas=np.load(arg('atlas')/'native-atlas.npz');collision=json.loads(arg('collision').read_text());pairs=np.array(collision['sourceIntersectingParentPairs']);assert len(pairs)==107
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';assert sha(source)==expected and sha(frozen)=='4a71ff5ef2134044b2e716a13fe567f58a07c2e4a18b259b39eba097740f2957'
def read(o):
 dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);m=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg);m.calc_loop_triangles();V=np.array([tuple(e.matrix_world@x.co) for x in m.vertices]);F=np.array([tuple(x.vertices) for x in m.loop_triangles]);P=np.array([x.polygon_index for x in m.loop_triangles]);M=np.array([x.material_index for x in m.loop_triangles]);a=m.attributes.get('ONTOGENESIS_control_id');tags=np.array([x.value for x in a.data])[P] if a and a.domain=='FACE' else np.full(len(F),-1);uv=m.uv_layers.get('ChromaticArtworkUV');U=np.array([[tuple(uv.data[l].uv) for l in t.loops] for t in m.loop_triangles]) if uv else np.empty((0,3,2));e.to_mesh_clear();return V,F,P,M,tags,U
def hits(V,F):
 tree=BVHTree.FromPolygons(V.tolist(),F.tolist(),all_triangles=True);sets=[set(f) for f in F];return [(int(i),int(j)) for i,j in tree.overlap(tree) if i<j and not sets[i].intersection(sets[j])]
def key(T):return tuple(sorted(map(tuple,T)))
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;bpy.context.view_layer.update();o=bpy.data.objects['TENSION_continuous_frame'];V,F,P,M,_,UV=read(o);assert np.array_equal(V,atlas['vertices']) and np.array_equal(F,atlas['faces']) and np.array_equal(P,atlas['nativeEvaluatedPolygon'])
control=np.array([tuple(o.matrix_world@v.co) for v in o.data.vertices]);polys=[list(p.vertices) for p in o.data.polygons];mods=[{'name':m.name,'type':m.type,'enabled':m.show_viewport,'settings':{k:getattr(m,k) for k in ('thickness','offset','vertex_group','thickness_vertex_group','width','segments','limit_method','angle_limit','use_clamp_overlap','material_offset','material_offset_rim') if hasattr(m,k)}} for m in o.modifiers]
parts=[]
for obj in s.objects:
 if obj.type!='MESH':continue
 # Existing hidden rear meshes are preserved; read-only unhide for actual bounds.
 obj.hide_set(False);bpy.context.view_layer.update();x,f,_,_,_,_=read(obj);parts.append({'name':obj.name,'assembly':obj.get('assembly'),'role':obj.get('role'),'matrixWorld':[list(v) for v in obj.matrix_world],'origin':list(obj.matrix_world.translation),'bounds':[x.min(0).tolist(),x.max(0).tolist()],'evaluatedTriangles':len(f),'nativeParent':obj.parent.name if obj.parent else None})
copy=o.copy();copy.data=o.data.copy();s.collection.objects.link(copy);tag=copy.data.attributes.new('ONTOGENESIS_control_id','INT','FACE');tag.data.foreach_set('value',np.arange(len(polys),dtype=np.int32)+1);stack=[];arrays={}
for n in range(len(mods)+1):
 for j,m in enumerate(copy.modifiers):m.show_viewport=j<n and mods[j]['enabled']
 bpy.context.view_layer.update();x,f,p,mat,tags,uv=read(copy);h=hits(x,f);bounds=x[f].mean(1);local=[(i,j) for i,j in h if all(3.8<bounds[k,0]<5.7 and -2.4<bounds[k,1]<-1.2 for k in (i,j))]
 stack.append({'stage':n,'activeModifiers':[m['name'] for m in mods[:n]],'vertices':len(x),'triangles':len(f),'rawNonadjacentBVHPairs':len(h),'connectorNeighborhoodRawPairs':local,'propagatedFaceTagsPresent':int((tags>0).sum())});arrays[f'stage{n}Vertices']=x;arrays[f'stage{n}Faces']=f;arrays[f'stage{n}ControlTags']=tags
 # Geometry is compared against protected master at final stage.
 if n==len(mods):assert np.array_equal(x,V) and np.array_equal(f,F);finalTags=tags
bpy.data.objects.remove(copy,do_unlink=True)
# Material-tag cross-check in a separate copy. Material assignments can be
# changed by modifiers; preserve only when exact evaluated geometry matches.
copy=o.copy();copy.data=o.data.copy();s.collection.objects.link(copy);base=len(copy.data.materials)
for i,p in enumerate(copy.data.polygons):
 m=bpy.data.materials.new('ONTOGENESIS control marker '+str(i));copy.data.materials.append(m);p.material_index=base+i
bpy.context.view_layer.update();x,f,p,mat,_,_=read(copy);same=np.array_equal(x,V) and np.array_equal(f,F);marker=mat-base if same else np.full(len(F),-1);bpy.data.objects.remove(copy,do_unlink=True)
records=[]
for i,j in pairs:
 rec={'nativePair':[int(i),int(j)],'evaluatedPolygonIDs':P[[i,j]].tolist(),'propagatedControlFaceCandidates':(finalTags[[i,j]]-1).tolist(),'materialMarkerControlFaceCandidates':marker[[i,j]].tolist(),'candidateAgreement':bool(same and np.all(marker[[i,j]]==finalTags[[i,j]]-1))}
 records.append(rec)
report={'sourceSha256':expected,'actualNativeArraysExact':True,'modifierStack':mods,'stages':stack,'markerProbeGeometryExact':same,'pairRecords':records,'bothMarkerCandidatesAgree':sum(x['candidateAgreement'] for x in records),'controlPolygonCount':len(polys),'assemblyInterfaces':parts,'limits':'Face tags may propagate to generated solidify/bevel faces. Agreement is candidate ancestry, not proof of exact parent or intended mating. Raw BVH hits are candidates, not strict collision classification. No repair.'}
(out/'connector-provenance.json').write_text(json.dumps(report,indent=2));np.savez_compressed(out/'connector-stages.npz',controlVertices=control,nativeFaces=F,nativeVertices=V,controlPolygonOffsets=np.r_[0,np.cumsum([len(p) for p in polys])],controlPolygonIndices=np.concatenate(polys),finalControlTag=finalTags,materialMarkerCandidate=marker,**arrays)
# Actual opposing prong strip and evaluated rear candidate chart. Source
# region remains hardware-free; no remapping or new wearable approval.
bpy.ops.wm.open_mainfile(filepath=str(frozen));bpy.context.view_layer.update();body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body');x,f,_,_,_,_=read(body);assert np.array_equal(x,atlas['frozenVertices']) and np.array_equal(f,atlas['frozenFaces'])
ids={i*8+j for i in range(240,361) for j in range(3,7)};t=np.flatnonzero(np.isin(f,list(ids)).all(1)&(np.ptp(f//8,axis=1)==1)&(np.ptp(f%8,axis=1)==1));assert len(t)==720
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;rear=bpy.data.objects['CONTINUITY_rear_frame'];rear.hide_set(False);bpy.context.view_layer.update();rv,rf,rp,rm,_,ru=read(rear);copy=rear.copy();copy.data=rear.data.copy();s.collection.objects.link(copy);d=copy.data;mi=len(d.materials);d.materials.append(bpy.data.materials.new('ONTOGENESIS rear strip sentinel'));vid={2*909+i*9+j for i in range(21,99) for j in range(1,8)};polys=[p for p in d.polygons if len(p.vertices)==4 and all(v in vid for v in p.vertices)];assert len(polys)==77*6
for p in polys:p.material_index=mi
bpy.context.view_layer.update();z,g,_,marker,_,_=read(copy);bpy.data.objects.remove(copy,do_unlink=True);native={key(rv[f]):i for i,f in enumerate(rf)};N=np.cross(z[g[:,1]]-z[g[:,0]],z[g[:,2]]-z[g[:,0]]);sel=np.flatnonzero((marker==mi)&(N[:,2]>1e-9));rearIDs=np.array([native[key(z[g[i]])] for i in sel]);assert len(np.unique(rearIDs))==len(rearIDs)
sys.path.insert(0,str(Path(__file__).parent));from unfurl_chart import diagnose
top,_,_=diagnose(rf[rearIDs].tolist());rearReport={'frozenOpposingProngTriangleIDs':t.tolist(),'rearNativeTriangleIDs':rearIDs.tolist(),'rearRegionTopology':top,'rearMaterialIDs':rm[rearIDs].tolist(),'rearBounds':[rv[rf[rearIDs]].reshape(-1,3).min(0).tolist(),rv[rf[rearIDs]].reshape(-1,3).max(0).tolist()],'scope':'Measured two actual regional source sets only. No rear correspondence or motion qualification.'};(out/'rear-region.json').write_text(json.dumps(rearReport,indent=2));np.savez_compressed(out/'rear-region.npz',frozenVertices=x,frozenFaces=f,opposingProngTriangleIDs=t,rearVertices=rv,rearFaces=rf,rearNativeTriangleIDs=rearIDs,rearLoopUV=ru)
assert sha(source)==expected
