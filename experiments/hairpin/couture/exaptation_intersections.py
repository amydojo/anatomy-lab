"""Read-only classification of the 107 inherited pairs; no collision exemption."""
import json,sys,numpy as np
from pathlib import Path
from collections import Counter
from vtk import vtkTriangle
root=Path(sys.argv[1]);z=np.load(root/'atlas/native-atlas.npz');a=json.load(open(root/'atlas/native-atlas.json'));c=json.load(open(sys.argv[2]));pairs=np.array(c['sourceIntersectingParentPairs']);V=z['vertices'];F=z['faces'];T=V[F[pairs]];N=np.cross(T[:,:,1]-T[:,:,0],T[:,:,2]-T[:,:,0]);N/=np.linalg.norm(N,axis=2)[:,:,None];names={x['id']:x['name'] for x in a['regions']};records=[]
def slice_tri(t,n,p):
 d=(t-p)@n;pts=[]
 for i,j in [(0,1),(1,2),(2,0)]:
  if abs(d[i])<1e-12:pts.append(t[i])
  if d[i]*d[j]<0:pts.append(t[i]+d[i]/(d[i]-d[j])*(t[j]-t[i]))
 return np.array(pts),d
for k,(i,j) in enumerate(pairs):
 t,u=T[k];n,m=N[k];p,da=slice_tri(t,m,u[0]);q,db=slice_tri(u,n,t[0]);direction=np.cross(n,m);direction/=np.linalg.norm(direction);l=max((p@direction).min(),(q@direction).min());h=min((p@direction).max(),(q@direction).max());origin=p[0]-(p[0]@direction)*direction;seg=np.array([origin+l*direction,origin+h*direction]);strict=da.min()<-1e-8 and da.max()>1e-8 and db.min()<-1e-8 and db.max()>1e-8 and h>l
 records.append({'pair':[int(i),int(j)],'component':'TENSION_continuous_frame','regions':[names[x] for x in z['regionID'][[i,j]]],'materialSlots':z['nativeMaterial'][[i,j]].tolist(),'evaluatedPolygons':z['nativeEvaluatedPolygon'][[i,j]].tolist(),'sharedVertices':len(set(F[i])&set(F[j])),'normalAngleDeg':float(np.degrees(np.arccos(np.clip(n@m,-1,1)))),'signedPlaneDistances':[da.tolist(),db.tolist()],'strictCrossing':bool(strict),'vtkIntersection':bool(vtkTriangle.TrianglesIntersect(*t,*u)),'segment':seg.tolist(),'segmentLength':float(max(0,h-l))})
r={'pairs':records,'count':len(records),'strictCrossings':sum(x['strictCrossing'] for x in records),'vtkConfirmed':sum(x['vtkIntersection'] for x in records),'coincidentConstructionSurfaces':0,'regionPairs':dict(Counter(' | '.join(sorted(x['regions'])) for x in records)),'materialPairs':dict(Counter(str(sorted(x['materialSlots'])) for x in records)),'segmentLengthRange':[min(x['segmentLength'] for x in records),max(x['segmentLength'] for x in records)],'repairDecision':'No repair candidate justified yet: modifier/control-parent provenance and intended load-bearing contacts not established.','limits':'Only inherited pairs, not complete native collision or articulation audit. Geometric penetration does not establish design intent.'};pts=np.array([x['segment'] for x in records]).reshape(-1,3);r['segmentBounds']=[pts.min(0).tolist(),pts.max(0).tolist()];Path(sys.argv[3]).write_text(json.dumps(r,indent=2));assert r['count']==r['strictCrossings']==r['vtkConfirmed']==107
