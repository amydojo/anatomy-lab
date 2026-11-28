"""Independent event audit of frozen numerical FUSION arrays."""
import numpy as np,json,sys
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
from anastomosis_fusion import build
p=Path(sys.argv[1]);q=dict(np.load(p/'fusion.npz'));P=q['criticalPre'].astype(float);F=q['preFaces'];G=q['postFaces'];Q=q['criticalPost'].astype(float);caps=q['removedCaps'];T=P[F[caps]];n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);a=np.linalg.norm(n,axis=1)/2
A=unary_union([Polygon(t[:,1:]) for t in T[n[:,0]>0]]);B=unary_union([Polygon(t[:,1:]) for t in T[n[:,0]<0]]);m=q['vertexMap'];keep=np.setdiff1d(np.arange(len(F)),caps)
r={'capPositiveArea':A.area,'capNegativeArea':B.area,'capSymmetricDifferenceArea':A.symmetric_difference(B).area,'capTotalSurfaceAreaRemoved':float(a.sum()),'capXExtent':float(np.ptp(T[:,:,0])),'eventRegionBounds':[T.reshape(-1,3).min(0).tolist(),T.reshape(-1,3).max(0).tolist()],'retainedCoordinateMax':float(np.max(abs(P[F[keep]]-Q[m[F[keep]]]))),'lastRegularToContactMaxVertexDisplacement':float(np.linalg.norm(P-q['pre'][-1],axis=1).max()),'vertexMapUVError':float(np.max(abs(q['preUV']-q['postUV'][m]))),'regularUVConstant':all(np.array_equal(build(t,t>=.65)[2],q['postUV'] if t>=.65 else q['preUV']) for t in np.r_[np.linspace(0,.64,65),np.linspace(.65,1,36)])}
for s in ('pre','post'):
    V=q[s].astype(float);f=q[s+'Faces'];T=V[:,f];N=np.cross(T[:,:,1]-T[:,:,0],T[:,:,2]-T[:,:,0]);n=N/np.linalg.norm(N,axis=2)[:,:,None];t=np.linspace(0,1,len(V));g=t*t*(3-2*t);ref=(1-g[:,None,None])*N[0]+g[:,None,None]*N[-1];r[s]={'opposedHistorical':int((np.sum(N*ref,axis=2)<=0).sum()),'maxAdjacentNormalAngle':float(np.degrees(np.arccos(np.clip(np.sum(n[1:]*n[:-1],axis=2),-1,1))).max())}
(p/'event-audit.json').write_text(json.dumps(r,indent=2));assert r['capSymmetricDifferenceArea']==r['retainedCoordinateMax']==r['vertexMapUVError']==0 and r['regularUVConstant'] and not r['pre']['opposedHistorical'] and not r['post']['opposedHistorical']
