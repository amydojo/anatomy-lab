"""Reversible controlled opening on actual ONTOGENESIS lineage.
No closed-frame or cinematic qualification claim. Explicit critical boundary
contacts, no face swaps. Quintic time law on PL geometric intervals."""
import numpy as np,json,sys
from pathlib import Path
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from shapely.geometry import Polygon
root=Path(sys.argv[1]);lineage=Path(sys.argv[2]);tension=Path(sys.argv[3]);out=Path(sys.argv[4]);out.mkdir(parents=True,exist_ok=True)
q=dict(np.load(lineage/'lineage.npz'));a=dict(np.load(lineage/'approach.npz'));b=np.load(root/'bridge/bridge-motion.npz')['poses'];t=np.load(tension)['poses'];F=q['faces'];K=q['splitFaces'];W=q['weldMap'];E=q['vertexAncestorEdges'];w=q['vertexAncestorWeight'][:,None]
def lift(X):return ((1-w)*X[E[:,0]]+w*X[E[:,1]]).astype(np.float32)
def norm(X,G):
 T=X[G].astype(float);return np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0])
def edges(G):return np.unique(np.sort(np.concatenate([G[:,[0,1]],G[:,[1,2]],G[:,[2,0]]]),1),axis=0,return_counts=True)
def loops(G):
 ed,c=edges(G);be=ed[c==1];adj={}
 for i,j in be:adj.setdefault(i,[]).append(j);adj.setdefault(j,[]).append(i)
 assert all(len(v)==2 for v in adj.values());seen=set(adj);ls=[]
 while seen:
  i=min(seen);l=[i];prev=None
  while True:
   j=next(x for x in adj[l[-1]] if x!=prev)
   if j==i:break
   l.append(j);prev=l[-2]
  seen-=set(l);ls.append(np.array(l))
 return ls
def topology(G,n):
 e,c=edges(G);i,j=e.T;M=coo_matrix((np.ones(2*len(e)),(np.r_[i,j],np.r_[j,i])),shape=(n,n));return {'vertices':n,'faces':len(G),'edges':len(e),'components':int(connected_components(M,directed=False)[0]),'boundaryEdges':int((c==1).sum()),'nonmanifold':int((c>2).sum()),'euler':n-len(e)+len(G),'boundaryLoops':len(loops(G))}
def domains(X,G,ls,N):
 polys=[Polygon(X[l,:2]) for l in ls];valid=all(p.is_valid and p.exterior.is_simple for p in polys);ar=abs(N[:,2].sum()/2)
 if len(polys)==1:return valid,abs(polys[0].area-ar),0.,None
 return valid,abs(sum(p.area for p in polys)-ar),float(polys[0].intersection(polys[1]).area),float(polys[0].distance(polys[1]))
def qmin(c0,c1,c2):
 z=np.divide(-c1,2*c2,out=np.zeros_like(c1),where=c2!=0);z=np.clip(z,0,1);return np.minimum(np.minimum(c0,c0+c1+c2),c0+c1*z+c2*z*z)
def interval(X,Y,G):
 A=X[G].astype(float);B=Y[G].astype(float);e=A[:,1]-A[:,0];f=A[:,2]-A[:,0];de=B[:,1]-B[:,0]-e;df=B[:,2]-B[:,0]-f;c0=np.cross(e,f);c1=np.cross(de,f)+np.cross(e,df);c2=np.cross(de,df);sg=np.sign(c0[:,2]);p=qmin(c0[:,2]*sg,c1[:,2]*sg,c2[:,2]*sg)
 nn=c0/np.linalg.norm(c0,axis=1)[:,None];d=lambda x:np.sum(x*nn,axis=1);lb=qmin(d(c0),d(c1),d(c2))/2
 return {'minSignedProjectedDoubleArea':float(p.min()),'projectedOrientationFailures':int((p<=0).sum()),'minAreaLowerBound':float(lb.min()),'areaBoundFailures':int((lb<1e-10).sum())}
def audit(P,G,label,critical_indices=()):
 ls=loops(G);rows=[];intervals=[];prev=None;ref=norm(P[0],G);critical=set(critical_indices)
 for k,X in enumerate(P):
  N=norm(X,G);ar=np.linalg.norm(N,axis=1)/2;valid,err,over,gap=domains(X,G,ls,N);row={'frame':k,'critical':k in critical,'belowFloor':int((ar<1e-10).sum()),'projectedSignFailures':int((N[:,2]*ref[:,2]<=0).sum()),'temporalReversals':0 if prev is None else int((np.sum(N*prev,axis=1)<0).sum()),'minArea':float(ar.min()),'boundarySimple':bool(valid),'areaError':float(err),'domainOverlap':over,'domainGap':gap};row['regularPass']=bool(not any(row[v] for v in ['belowFloor','projectedSignFailures','temporalReversals']) and valid and err<1e-8 and over<1e-12 and (gap is None or gap>0));rows.append(row);prev=N
  if k:intervals.append(interval(P[k-1],X,G))
 return {'label':label,'topology':topology(G,len(P[0])),'samples':len(P),'regularPasses':sum(x['regularPass'] for x in rows if not x['critical']),'regularCount':sum(not x['critical'] for x in rows),'criticalRows':[x for x in rows if x['critical']],'minArea':min(x['minArea'] for x in rows),'peakDomainOverlap':max(x['domainOverlap'] for x in rows),'peakAreaError':max(x['areaError'] for x in rows),'minPLAreaBound':min(x['minAreaLowerBound'] for x in intervals),'PLAreaBoundFailures':sum(x['areaBoundFailures'] for x in intervals),'PLOrientationFailures':sum(x['projectedOrientationFailures'] for x in intervals),'rows':rows,'intervals':intervals}
B=np.array([lift(x) for x in b]);T=np.array([lift(x) for x in t]);C=a['critical'];CW=a['criticalWelded'];P=a['poses'];assert np.array_equal(B[-1],T[0]) and np.array_equal(C,CW[W]) and np.array_equal(W[K],F)
correction=np.array([((1-u)*T[-1]+u*CW).astype(np.float32) for u in np.linspace(0,1,9)]);correction[0]=T[-1];correction[-1]=CW
S=np.concatenate([C[None],P[::-1],P[1:],C[None]])
reports=[audit(B,F,'DORMANT bridge'),audit(T,F,'UNFURL'),audit(correction,F,'endpoint storage reconciliation'),audit(S,K,'DIFFERENTIATE / CONVERGE',(0,len(S)-1))]
e0,c0=edges(F);e1,c1=edges(K);bd0={tuple(e) for e in e0[c0==1]};bd1=e1[c1==1];mapped=np.sort(W[bd1],axis=1);u,c=np.unique(mapped,axis=0,return_counts=True);old={tuple(e) for e in u[c==1]};seam=u[c==2];assert old==bd0 and len(seam)==107 and np.all(c<=2)
orig={tuple(e):int(c) for e,c in zip(e0,c0)};assert all(orig[tuple(e)]==2 for e in seam);assert len(np.unique(seam))==108
uv=q['materialChart'];event={'faceSetPreservedExactly':bool(np.array_equal(W[K],F)),'weldMap':W.tolist(),'newBoundaryEdgeCopies':int(2*len(seam)),'newBoundaryEdgeAncestors':seam.tolist(),'newBoundaryVertexCopies':len(W)-len(CW),'originalBoundaryEdgesPreserved':len(old),'criticalPositionError':float(abs(C-CW[W]).max()),'criticalMaterialUVError':float(abs(uv[W]-uv[W]).max()),'criticalCoordinateTopology':'Coincident boundary contact, not regular embedding; zero faces deleted or substituted.'}
kin={}
for label,P0 in [('bridge',B),('tension',T),('correction',correction),('split',S)]:
 d=np.diff(P0.astype(float),axis=0);dd=np.diff(d,axis=0);kin[label]={'maxStep':float(np.linalg.norm(d,axis=2).max()),'maxSecondDifference':float(np.linalg.norm(dd,axis=2).max()),'quinticEndpointVelocity':0,'quinticEndpointAcceleration':0}
rep={'scope':'One actual open regional strip, explicit reversible split/weld event. Differentiation reverses native approach and reconverges, not full object nor creative acceptance.','stages':reports,'event':event,'joins':{'bridgeToTensionExact':bool(np.array_equal(B[-1],T[0])),'tensionToCorrectionExact':bool(np.array_equal(T[-1],correction[0])),'correctionToSplitExact':bool(np.array_equal(correction[-1][W],S[0])),'splitToLockExact':bool(np.array_equal(S[-1],CW[W])),'maxStorageReconciliationDisplacement':float(np.linalg.norm(T[-1].astype(float)-CW,axis=1).max()),'timeLaw':'Quintic smoothstep on each PL interval; zero first/second derivatives at interval endpoints; conservative stop-at-samples diagnostic'},'kinematics':kin}
rep['sampledPass']=all(x['regularPasses']==x['regularCount'] for x in reports) and event['criticalPositionError']==0
np.savez_compressed(out/'event.npz',bridge=B,tension=T,correction=correction,split=S,lock=CW,faces=F,splitFaces=K,weldMap=W,materialChart=uv,nativeLoopUV=q['nativeLoopUV'],nativeMaterial=q['nativeMaterial'],nativeParent=q['nativeParent'],commonFaceOwner=q['commonFaceOwner'],compactRefOwner=q['compactRefOwner'],splitSide=q['splitSide'])
(out/'event.json').write_text(json.dumps(rep,indent=2));assert rep['sampledPass'] and all(not x['PLAreaBoundFailures'] and not x['PLOrientationFailures'] for x in reports)
