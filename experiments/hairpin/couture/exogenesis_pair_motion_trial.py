"""Rejected coarse paired-motion experiment; no qualification claim."""
import numpy as np,json,sys
from pathlib import Path
from morphogenesis_measure import map_chart,bary,witnesses
q=np.load(sys.argv[1]);p=np.load(sys.argv[2]);z=np.load(sys.argv[3]);xy=z['xy'];f=z['skinFaces'];n=len(xy);F=z['faces'];A=q['idealTarget'][q['faces']];uv=A[:,:,:2];ref=q['idealCompact'][q['faces']]
actual,owner,_=map_chart(xy,uv,ref);w=bary(xy,uv[owner]);w=np.maximum(w,0);w/=w.sum(1)[:,None];ids=q['faces'][owner];X=z['vertices'];gap=X[:n,2]-X[n:,2]
mapped,_,_=map_chart(witnesses(xy[f]),uv,ref);err=np.linalg.norm(mapped-witnesses(actual[f]),axis=1);rows=[];prev=None
for i,P in enumerate(p['poses']):
    t=i/(len(p['poses'])-1);up=np.einsum('ij,ijk->ik',w,P[ids]);lo=up.copy();s=t*t*(3-2*t);lo[:,2]-=(1-s)*.1+s*gap;Y=np.concatenate([up,lo]).astype(np.float32)
    if i==len(p['poses'])-1:Y=X.copy()
    Q=Y.astype(float);T=Q[F];N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2
    rows.append({'frame':i,'belowFloor':int((ar<1e-10).sum()),'projectedNonpositive':int(np.sum(N[:len(f),2]<=0)+np.sum(N[len(f):2*len(f),2]>=0)),'temporalReversals':0 if prev is None else int(np.sum(np.sum(N*prev,axis=1)<0)),'minArea':float(ar.min()),'verticalGapMin':float(np.min(Q[:n,2]-Q[n:,2]))});prev=N
r={'compactWitnessChecks':len(err),'compactWitnessMax':float(err.max()),'compactWitnessExceedingThreshold':int((err>=2e-5).sum()),'trajectorySamples':len(rows),'peakBelowFloor':max(x['belowFloor'] for x in rows),'peakProjectedNonpositive':max(x['projectedNonpositive'] for x in rows),'peakTemporalReversals':max(x['temporalReversals'] for x in rows),'passesBasicGeometry':sum(not any(x[k] for k in ['belowFloor','projectedNonpositive','temporalReversals']) for x in rows),'samples':rows,'scope':'Coarse pair mapped at vertices only; no exact compact coverage or raw collision claim. Further common refinement required.'}
Path(sys.argv[4]).write_text(json.dumps(r,indent=2));print({k:v for k,v in r.items() if k!='samples'})
