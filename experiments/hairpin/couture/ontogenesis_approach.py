"""Compare actual native branch PL trajectory with the explicit regional split."""
import numpy as np,json,sys
from pathlib import Path
from shapely.geometry import Polygon
root=Path(sys.argv[1]);out=Path(sys.argv[2]);q=dict(np.load(out/'lineage.npz'));m=dict(np.load(sys.argv[3]));w=dict(np.load(root/'overlap/regional-overlap.npz'));G=q['faces'];K=q['splitFaces'];W=q['weldMap'];V=q['target'];H=m['postFaces'];B=m['idealPost'];preF=m['preFaces'][:len(H)];co=q['branchCornerOwner'].ravel();cw=q['branchCornerWeights'].reshape(-1,3);corner=K.ravel();_,first=np.unique(corner,return_index=True);Fowner=q['commonFaceOwner'];side=q['splitSide'];P=w['witnessChart'];old=w['witnessCommonOwner'];bo=w['witnessBranchOwner'];cut=-20.013
def bary(P,T):
 d=P-T[:,0];e=T[:,1]-T[:,0];f=T[:,2]-T[:,0];den=e[:,0]*f[:,1]-e[:,1]*f[:,0];u=(d[:,0]*f[:,1]-d[:,1]*f[:,0])/den;v=(e[:,0]*d[:,1]-e[:,1]*d[:,0])/den;return np.c_[1-u-v,u,v]
children={i:[] for i in np.unique(Fowner)}
for k,i in enumerate(Fowner):children[i].append(k)
owner=np.full(len(P),-1,int);best=np.full(len(P),np.inf);sg=np.where(B[H[bo],1].mean(1)<cut,-1,1)
for rank in range(3):
 cand=np.array([children[i][rank] if rank<len(children[i]) else -1 for i in old]);sel=(cand>=0)&(side[np.maximum(cand,0)]==sg);ids=np.flatnonzero(sel);ww=bary(P[ids],V[G[cand[ids]]][:,:,:2]);vi=np.maximum(0,-ww.min(1));upd=ids[vi<best[ids]];best[upd]=vi[vi<best[ids]];owner[upd]=cand[upd]
assert np.all(owner>=0);wa=bary(P,V[G[owner]][:,:,:2]);wb=bary(P,B[H[bo]][:,:,:2]);wa=np.maximum(wa,0);wa/=wa.sum(1)[:,None];wb=np.maximum(wb,0);wb/=wb.sum(1)[:,None]
loops=[]
for s in [-1,1]:
 f=K[side==s];e,c=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),1),axis=0,return_counts=True);bd=e[c==1];adj={}
 for i,j in bd:adj.setdefault(i,[]).append(j);adj.setdefault(j,[]).append(i)
 assert all(len(v)==2 for v in adj.values());i=min(adj);l=[i];prev=None
 while True:
  j=next(x for x in adj[l[-1]] if x!=prev)
  if j==i:break
  prev=l[-1];l.append(j)
 assert len(l)==len(adj);loops.append(l)
poses=[];rows=[];prev=None
for k,X in enumerate(m['pre']):
 C=np.einsum('ij,ijk->ik',cw,X[preF[co]]);Y=C[first].astype(np.float32);poses.append(Y);T=Y[K].astype(float);N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2
 actual=np.einsum('ij,ijk->ik',wa,Y[K[owner]]);ref=np.einsum('ij,ijk->ik',wb,X[preF[bo]]);err=np.linalg.norm(actual-ref,axis=1);mx=int(err.argmax());polys=[Polygon(Y[l,:2]) for l in loops];areaErr=max(abs(polys[i].area+N[side==s,2].sum()/2) for i,s in enumerate([-1,1]));ov=polys[0].intersection(polys[1]).area;gap=polys[0].distance(polys[1])
 r={'frame':k,'maxInteriorWitnessError':float(err[mx]),'witnessIndex':mx,'commonFaceID':int(old[mx]),'branchFaceID':int(bo[mx]),'witnessesAboveThreshold':int((err>=2e-5).sum()),'belowFloor':int((ar<1e-10).sum()),'projectedNonpositive':int((N[:,2]>=0).sum()),'temporalReversals':0 if prev is None else int((np.sum(prev*N,axis=1)<0).sum()),'minArea':float(ar.min()),'sharedCornerMismatch':float(np.linalg.norm(Y[corner].astype(float)-C,axis=1).max()),'simpleBoundary':all(g.is_valid and g.exterior.is_simple for g in polys),'projectedAreaError':float(areaErr),'crossDomainOverlap':float(ov),'projectedGap':float(gap)};rows.append(r);prev=N
C=np.einsum('ij,ijk->ik',cw,m['criticalPre'][preF[co]]);Y=C[first].astype(np.float32);welded=np.zeros_like(V,dtype=np.float32);welded[W]=Y;gap=np.linalg.norm(welded[W]-Y,axis=1);report={'sampleCount':len(rows),'witnessCountPerSample':len(P),'maxOwnerBarycentricViolation':float(best.max()),'peakWitnessError':max(x['maxInteriorWitnessError'] for x in rows),'peakWitnessesAboveThreshold':max(x['witnessesAboveThreshold'] for x in rows),'peakBelowFloor':max(x['belowFloor'] for x in rows),'peakTemporalReversals':max(x['temporalReversals'] for x in rows),'peakProjectedNonpositive':max(x['projectedNonpositive'] for x in rows),'criticalWeldGap':float(gap.max()),'criticalWeldedAgainstIdealMax':float(np.linalg.norm(welded-V,axis=1).max()),'minProjectedGap':min(x['projectedGap'] for x in rows),'completeSampledTransferPass':all(x['maxInteriorWitnessError']<2e-5 and not any(x[k] for k in ['belowFloor','temporalReversals','projectedNonpositive']) and x['simpleBoundary'] and x['projectedAreaError']<1e-8 and x['crossDomainOverlap']==0 and x['projectedGap']>0 for x in rows),'scope':'Two open regional patches. Not a closed object or continuous collision certificate; welded expansion to separated approach requires an independently qualified opening event.','samples':rows}
(out/'approach.json').write_text(json.dumps(report,indent=2));np.savez_compressed(out/'approach.npz',poses=np.array(poses),faces=K,weldMap=W,critical=Y,criticalWelded=welded)
