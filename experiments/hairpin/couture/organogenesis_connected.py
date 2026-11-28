"""Alternative B: retain two actual regional material bridge bands.
Failure retained; no new geometry or native parity claim."""
import numpy as np,json,sys
from pathlib import Path
from shapely.geometry import Polygon
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);q=dict(np.load(root/'lineage.npz'));a=dict(np.load(root/'approach.npz'));W=q['weldMap'];K=q['splitFaces'];F=q['faces'];X=a['criticalWelded'];C=a['critical'];V=q['target'];n=len(V);seam=W[n:];x=V[:,0];lo,hi=x[seam].min(),x[seam].max();u=(x-lo)/(hi-lo)
smooth=lambda t:np.clip(t,0,1)**2*(3-2*np.clip(t,0,1))
weight=smooth((u-.12)/.15)*smooth((.88-u)/.15);keep=weight[seam]==0;remap=np.arange(len(W));remap[n:][keep]=seam[keep];G=remap[K];used=np.unique(G);idx=np.full(len(W),-1);idx[used]=np.arange(len(used));G=idx[G];mapping=W[used];assert np.array_equal(mapping[G],F)
e,c=np.unique(np.sort(np.concatenate([G[:,[0,1]],G[:,[1,2]],G[:,[2,0]]]),1),axis=0,return_counts=True);be=e[c==1];adj={}
for i,j in be:adj.setdefault(i,[]).append(j);adj.setdefault(j,[]).append(i)
assert all(len(v)==2 for v in adj.values());seen=set(adj);ls=[]
while seen:
 i=min(seen);l=[i];prev=None
 while True:
  j=next(x for x in adj[l[-1]] if x!=prev)
  if j==i:break
  l.append(j);prev=l[-2]
 seen-=set(l);ls.append(np.array(l))
i,j=e.T;M=coo_matrix((np.ones(2*len(e)),(np.r_[i,j],np.r_[j,i])),shape=(len(used),len(used)));cc=int(connected_components(M,directed=False)[0]);assert cc==1 and len(ls)==2 and len(used)-len(e)+len(G)==0
seq=np.concatenate([C[None],a['poses'][::-1]]);P=(C[None]+(seq.astype(float)-C[None])*weight[W][None,:,None]).astype(np.float32)[:,used];rows=[];prev=None
for k,Y in enumerate(P):
 T=Y[G].astype(float);N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2;ps=[Polygon(Y[l,:2]) for l in ls];ix=int(np.argmax([p.area for p in ps]));outer=ps[ix];inner=ps[1-ix];domain=Polygon(outer.exterior.coords,[inner.exterior.coords]);err=abs(domain.area-abs(N[:,2].sum()/2));r={'frame':k,'belowFloor':int((ar<1e-10).sum()),'projectedNonpositive':int((N[:,2]>=0).sum()),'temporalReversals':0 if prev is None else int((np.sum(N*prev,axis=1)<0).sum()),'domainValid':bool(domain.is_valid),'areaError':float(err),'apertureArea':float(inner.area),'nativeApproachDeviationMax':float(np.linalg.norm(Y.astype(float)-seq[k,used],axis=1).max()),'minArea':float(ar.min())};r['pass']=bool(not any(r[v] for v in ['belowFloor','projectedNonpositive','temporalReversals']) and r['domainValid'] and err<1e-8 and inner.area>0);rows.append(r);prev=N
rep={'scope':'Connected open surface with two actual retained seam bands; no native wall or complete front. Critical slit not regular embedding.','vertices':len(used),'faces':len(G),'components':cc,'euler':len(used)-len(e)+len(G),'boundaryLoops':len(ls),'boundaryEdges':len(be),'nonmanifold':int((c>2).sum()),'seamCopiesRetainedWelded':int(keep.sum()),'seamCopiesSeparated':int((~keep).sum()),'regularPasses':sum(r['pass'] for r in rows[1:]),'regularSamples':len(rows)-1,'maxNativeApproachDeviation':max(r['nativeApproachDeviationMax'] for r in rows),'maxApertureArea':max(r['apertureArea'] for r in rows),'peakBelowFloor':max(r['belowFloor'] for r in rows),'peakProjectedNonpositive':max(r['projectedNonpositive'] for r in rows),'peakTemporalReversals':max(r['temporalReversals'] for r in rows),'criticalCoordinateError':float(abs(P[0]-X[mapping]).max()),'rows':rows}
(out/'connected.json').write_text(json.dumps(rep,indent=2));np.savez_compressed(out/'connected.npz',poses=P,faces=G,weldMap=mapping,materialChart=q['materialChart'][mapping],nativeParent=q['nativeParent'],commonFaceOwner=q['commonFaceOwner'],compactRefOwner=q['compactRefOwner'],retainedSeamIDs=seam[keep],separatedSeamIDs=seam[~keep])
