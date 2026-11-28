"""Independent sampled VTK triangle-intersection evidence; preserve inherited hits."""
import numpy as np,json,sys
from pathlib import Path
from scipy.spatial import cKDTree
from vtk import vtkTriangle
def check(P,F):
    T=P[F].astype(float);c=T.mean(1);rad=np.linalg.norm(T-c[:,None],axis=2).max(1);tree=cKDTree(c);pairs=tree.query_pairs(2*rad.max()+1e-10,output_type='ndarray');i,j=pairs.T;lo=T.min(1);hi=T.max(1);sel=(np.linalg.norm(c[i]-c[j],axis=1)<=rad[i]+rad[j]+1e-10)&(np.minimum(hi[i],hi[j])+1e-10>=np.maximum(lo[i],lo[j])).all(1)&~(F[i,:,None]==F[j,None,:]).any((1,2));pairs=pairs[sel];hits=[]
    for i,j in pairs:
        if vtkTriangle.TrianglesIntersect(*T[i],*T[j]):hits.append([int(i),int(j)])
    return {'candidates':len(pairs),'hits':hits,'count':len(hits)}
if __name__=='__main__':
    q=dict(np.load(sys.argv[1]));z=dict(np.load(sys.argv[2]));out=Path(sys.argv[3]);rows=[]
    for k in [0,16,32,48,64]:
        r=check(q['pre'][k],q['preFaces']);r['frame']=k;rows.append(r)
    r=check(q['criticalPre'],q['preFaces']);touch=np.isin(q['preFaces'],np.unique(q['preFaces'][q['removedCaps']])).any(1);r['outsideEvent']=[p for p in r['hits'] if not all(touch[p])]
    post=check(q['post'],q['postFaces']);parents=q['postOwner'][np.array(post['hits'],int).reshape(-1,2)];V=z['vertices'];F=z['faces'];inherited=[list(map(int,p)) for p in parents if min(p)>=0 and vtkTriangle.TrianglesIntersect(*V[F[p[0]]],*V[F[p[1]]])]
    out.write_text(json.dumps({'samples':rows,'critical':r,'post':post,'sourceIntersectingParentPairs':inherited,'scope':'Double precision VTK triangle intersection with sphere/AABB broad phase, shared vertices excluded. Five approach samples only; not continuous or Blender raw BVH.'},indent=2))
