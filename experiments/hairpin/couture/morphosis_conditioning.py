"""MORPHOSIS: reproduce affected owner-cell budgets and precision diagnostics."""
import numpy as np,json,collections,sys
from pathlib import Path
p=Path(sys.argv[1]);out=Path(sys.argv[2]);q=np.load(p/'refinement.npz');F=q['faces'];xy=q['xy'];X={k:q[k] for k in ['compact','frozen','target','lower']};eps=1e-10
area=lambda T:np.linalg.norm(np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]),axis=1)/2
bad=set();details={};areas={};recenter={}
for k,P in X.items():
 T=P[F];S=P.astype(np.float32).astype(float)[F];a=area(T);b=area(S);n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);m=np.cross(S[:,1]-S[:,0],S[:,2]-S[:,0]);opp=np.sum(n*m,1)<=0;ids=np.flatnonzero((a<eps)|(b<eps)|opp);bad.update(ids.tolist());areas[k]=a;details[k]={'idealBelow':int((a<eps).sum()),'storedBelow':int((b<eps).sum()),'opposed':int(opp.sum()),'roundingOnlyBelow':int(((a>=eps)&(b<eps)).sum()),'exactZeroStored':int((b==0).sum()),'affected':ids.tolist()}
 recenter[k]={}
 for name,C in [('global',np.zeros(3)),('mean',P.mean(0)),('bbox',(P.max(0)+P.min(0))/2)]:
  Y=(P-C).astype(np.float32).astype(float)+C;Z=Y[F];N=np.cross(Z[:,1]-Z[:,0],Z[:,2]-Z[:,0]);recenter[k][name]={'belowFloor':int((np.linalg.norm(N,axis=1)/2<eps).sum()),'opposed':int((np.sum(n*N,1)<=0).sum()),'maxCoordinateError':float(abs(Y-P).max())}
owner=list(zip(q['faceCommonOwner'],q['faceLowerOwner']));groups=collections.defaultdict(list)
for i,k in enumerate(owner):groups[k].append(i)
affected=sorted(set(owner[i] for i in bad));cells=[]
for k in affected:
 ids=groups[k];es=collections.Counter(tuple(sorted((int(a),int(b)))) for f in F[ids] for a,b in zip(f,np.roll(f,-1)));be=[e for e,c in es.items() if c==1];minimum=len(be)-2;tot={name:float(v[ids].sum()) for name,v in areas.items()};cells.append({'owner':list(map(int,k)),'faces':ids,'boundaryEdges':len(be),'minimalTriangles':minimum,'idealAreas':tot,'impossibleByAreaBudget':any(v<minimum*eps for v in tot.values())})
remaining=set(bad);clusters=[]
while remaining:
 group={min(remaining)};remaining-=group;v=set(F[list(group)].flat)
 while True:
  nxt={i for i in remaining if v.intersection(F[i])}
  if not nxt:break
  remaining-=nxt;group|=nxt;v.update(F[list(nxt)].flat)
 ids=sorted(group);vv=sorted(v);clusters.append({'faces':ids,'vertices':vv,'chartXY':xy[vv].tolist(),'upperNativeParents':np.unique(q['upperNativeParent'][ids]).tolist(),'lowerNativeParents':np.unique(q['lowerNativeParent'][ids]).tolist()})
e=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),axis=1),axis=0);bade=e[np.isin(e,list(set(F[list(bad)].flat))).all(1)];lens=np.linalg.norm(xy[bade[:,1]]-xy[bade[:,0]],axis=1)
r={'affectedUnion':len(bad),'affectedOwnerCells':len(affected),'affectedCellTriangles':sum(len(groups[k]) for k in affected),'impossibleOwnerCells':sum(c['impossibleByAreaBudget'] for c in cells),'clusters':clusters,'endpoints':details,'cells':cells,'minAffectedXYEdge':float(lens.min()),'recenter':recenter,'scope':'Fixed owner-cell area budget, not permission to discard slivers.'};out.mkdir(parents=True,exist_ok=True);(out/'conditioning.json').write_text(json.dumps(r,indent=2,default=lambda x:x.item()))
