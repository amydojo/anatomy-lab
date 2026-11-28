"""Readback and bidirectional clipped reference witnesses for the ONTOGENESIS dissolved candidate.
A diagnostic candidate is not promoted even if distances pass."""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from morphogenesis_measure import map_chart,bary,witnesses,EPS
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]);candidate=Path(args[1]);out=Path(args[2]);out.mkdir(parents=True,exist_ok=True)
q=np.load(root/'genesis/conditioned-correspondence.npz');b=np.load(root/'bridge/bridge-correspondence.npz');z=np.load(root/'atlas/native-atlas.npz');r=json.loads((root/'atlas/native-atlas.json').read_text());p=np.load(candidate/'candidate.npz');rep=json.loads((candidate/'report.json').read_text());F=p['faces'];X=p['xy'];A=q['idealTarget'][q['faces']][:,:,:2];lower=np.array(next(x['nativeTriangleIDs'] for x in r['regions'] if x['name']=='block_2_interior_negative_skin'));B=z['vertices'][z['faces'][lower]];L=p['chart'][z['faces'][lower]];D=unary_union([Polygon(t) for t in A]).intersection(unary_union([Polygon(t) for t in L]))
result={}
for name,refuv,ref,owner in [('compact',A,q['idealCompact'][q['faces']],np.arange(len(F))),('frozen',A,b['idealFrozen'][q['faces']],p['faceCommonOwner']),('target',A,q['idealTarget'][q['faces']],p['faceCommonOwner']),('lower',L,B,p['lowerRefOwner'])]:
 bpy.ops.wm.read_factory_settings(use_empty=True);d=bpy.data.meshes.new('ONTOGENESIS '+name);d.from_pydata(p[name].tolist(),[],F.tolist());d.update();o=bpy.data.objects.new('ONTOGENESIS '+name+' diagnostic',d);bpy.context.collection.objects.link(o);attr=d.attributes.new('NativeParentID','INT','FACE');attr.data.foreach_set('value',(p['lowerNativeParent'] if name=='lower' else p['upperNativeParent']).astype(np.int32));uv=d.uv_layers.new(name='CommonProjectedChart');mn=X.min(0);scale=np.ptp(X,axis=0)
 for l in d.loops:uv.data[l.index].uv=(X[l.vertex_index]-mn)/scale
 path=out/f'ONTOGENESIS-{name}-diagnostic.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path));bpy.ops.wm.open_mainfile(filepath=str(path));d=next(o for o in bpy.context.scene.objects if o.type=='MESH').data;Y=np.array([tuple(v.co) for v in d.vertices]);assert np.array_equal(np.array([tuple(f.vertices) for f in d.polygons]),F)
 U=X[F];P=np.concatenate([U.reshape(-1,2),witnesses(U)]);face=np.r_[np.repeat(np.arange(len(F)),3),np.repeat(np.arange(len(F)),4)]
 if name=='lower':
  own=p['lowerRefOwner'][face];w=bary(P,L[own]);viol=float(max(0,-w.min(),w.max()-1));w=np.maximum(w,0);w/=w.sum(1)[:,None];R=np.einsum('ij,ijk->ik',w,B[own])
 else:
  ti=p['targetRefOwner'][face];ci=p['compactRefOwner'][face];w=bary(P,q['targetRef'][ti,:,:2]);viol=float(max(0,-w.min(),w.max()-1));w=np.maximum(w,0);w/=w.sum(1)[:,None]
  if name=='target':R=np.einsum('ij,ijk->ik',w,q['targetRef'][ti])
  else:
   uu=np.einsum('ij,ijk->ik',w,q['targetUV'][ti]);ww=bary(uu,q['sourceUV'][ci]);viol=max(viol,float(max(0,-ww.min(),ww.max()-1)));ww=np.maximum(ww,0);ww/=ww.sum(1)[:,None];R=np.einsum('ij,ijk->ik',ww,(q['sourceRef'] if name=='compact' else b['sourceRef'])[ci])
 Yt=Y[F];forward=np.linalg.norm(np.concatenate([Yt.reshape(-1,3),witnesses(Yt)])-R,axis=1)
 # Reverse actual clipped reference boundaries, midpoints and interior witnesses.
 Q=[];Z=[]
 for i,t in enumerate(refuv):
  g=Polygon(t).intersection(D)
  for c in ([g] if g.geom_type=='Polygon' else [a for a in getattr(g,'geoms',[]) if a.geom_type=='Polygon']):
   if c.area<=0:continue
   u=np.asarray(c.exterior.coords)[:-1];w0=np.r_[u,(u+np.roll(u,-1,axis=0))/2,[[c.representative_point().x,c.representative_point().y]]];w=bary(w0,np.broadcast_to(t,(len(w0),3,2)));w=np.maximum(w,0);w/=w.sum(1)[:,None];Q.extend(w0);Z.extend(w@ref[i])
 back,_,err=map_chart(np.asarray(Q),U,Yt);reverse=np.linalg.norm(back-np.asarray(Z),axis=1)
 n=np.cross(Yt[:,1]-Yt[:,0],Yt[:,2]-Yt[:,0]);ideal=p[name][F];N=np.cross(ideal[:,1]-ideal[:,0],ideal[:,2]-ideal[:,0]);sets=[set(f) for f in F];tree=BVHTree.FromPolygons(Y.tolist(),F.tolist(),all_triangles=True);hits=[(int(a),int(b)) for a,b in tree.overlap(tree) if a<b and not sets[a].intersection(sets[b])]
 result[name]={'forwardChecks':len(forward),'forwardMax':float(forward.max()),'reverseChecks':len(reverse),'reverseMax':float(reverse.max()),'reverseChartError':float(err.max()),'barycentricViolation':viol,'readbackMax':float(abs(Y-p[name].astype(np.float32)).max()),'belowFloor':int((np.linalg.norm(n,axis=1)/2<1e-10).sum()),'opposedOrCollapsed':int((np.sum(n*N,axis=1)<=0).sum()),'rawBVHOverlapCount':len(hits),'rawBVHPairs':hits,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 (out/'native-readback.json').write_text(json.dumps(result,indent=2))
complete=bool(rep['numericalPass'] and all(max(v['forwardMax'],v['reverseMax'])<EPS and v['barycentricViolation']<1e-7 and not any(v[k] for k in ['readbackMax','belowFloor','opposedOrCollapsed','rawBVHOverlapCount']) for v in result.values()));(out/'qualification.json').write_text(json.dumps({'endpointPass':complete,'reopened':result,'numerical':rep,'scope':'Four clipped diagnostic endpoints; no paired motion or protected source change.'},indent=2));assert complete,'Retained endpoint gate failed; no inherited motion'
