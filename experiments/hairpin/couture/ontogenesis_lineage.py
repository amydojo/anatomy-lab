"""Persistent split/weld lineage of qualified strip. Diagnostic, not closed frame."""
import numpy as np,json,sys
from pathlib import Path
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
root=Path(sys.argv[1]);branch=Path(sys.argv[2]);tension=Path(sys.argv[3]);out=Path(sys.argv[4]);out.mkdir(exist_ok=True,parents=True)
q=np.load(root/'genesis/conditioned-correspondence.npz');b=np.load(root/'bridge/bridge-correspondence.npz');m=np.load(branch);t=np.load(tension);F=q['faces'];P=q['idealTarget'];U=q['chart'];cut=-20.013;n=len(P);vmap={};links=[(i,i,0.) for i in range(n)];newF=[];owner=[];sides=[];cross=[]
def intersect(a,b):
 a,b=sorted((int(a),int(b)));key=(a,b)
 if key not in vmap:
  w=(cut-P[a,1])/(P[b,1]-P[a,1]);assert 0<w<1;vmap[key]=len(links);links.append((a,b,w))
 return vmap[key]
def mapv(X):
 a,j,w=np.array(links).T;a=a.astype(int);j=j.astype(int);return (1-w[:,None])*X[a]+w[:,None]*X[j]
def norm(X,F):
 T=X[F];return np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0])
for i,f in enumerate(F):
 d=P[f,1]-cut
 if np.all(d>=0) or np.all(d<=0):newF.append(f);owner.append(i);sides.append(1 if d.mean()>0 else -1);continue
 cross.append(i)
 for s in [-1,1]:
  poly=[]
  for a,j in zip(f,np.roll(f,-1)):
   da,db=(P[a,1]-cut)*s,(P[j,1]-cut)*s
   if da>=0:poly.append(a)
   if da*db<0:poly.append(intersect(a,j))
  assert len(poly) in (3,4)
  if len(poly)==3:faces=[poly]
  else:
   choices=[[[poly[0],poly[1],poly[2]],[poly[0],poly[2],poly[3]]],[[poly[0],poly[1],poly[3]],[poly[1],poly[2],poly[3]]]]
   def score(ff):
    a,j,w=np.array([links[k] for k in np.ravel(ff)]).T;a=a.astype(int);j=j.astype(int);ar=[];op=0
    for X in [q['idealCompact'],b['idealFrozen'],P]:
     T=((1-w[:,None])*X[a]+w[:,None]*X[j]).reshape(-1,3,3);Y=T.astype(np.float32).astype(float);N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);M=np.cross(Y[:,1]-Y[:,0],Y[:,2]-Y[:,0]);op+=int((np.sum(N*M,1)<=0).sum());ar.extend(np.linalg.norm(N,axis=1)/2);ar.extend(np.linalg.norm(M,axis=1)/2)
    return (-op,-sum(x<1e-10 for x in ar),min(ar))
   faces=max(choices,key=score)
  newF.extend(faces);owner.extend([i]*len(faces));sides.extend([s]*len(faces))
G=np.array(newF);owner=np.array(owner);sides=np.array(sides);S=mapv(U);links=np.array(links);assert len(cross)==107
native=q['targetChildNativeID'][q['targetFaceOwner'][owner]]
def topo(F,n):
 e,c=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),1),axis=0,return_counts=True);a,b=e.T;M=coo_matrix((np.ones(2*len(e)),(np.r_[a,b],np.r_[b,a])),shape=(n,n));return dict(vertices=n,faces=len(F),edges=len(e),components=int(connected_components(M,directed=False)[0]),boundaryEdges=int((c==1).sum()),nonmanifold=int((c>2).sum()),euler=n-len(e)+len(F))
orig=abs(norm(np.c_[U,np.zeros(n)],F)[:,2])/2;area=abs(norm(np.c_[S,np.zeros(len(S))],G)[:,2])/2;cov=np.bincount(owner,weights=area,minlength=len(F));err=abs(cov-orig)
report={'scope':'Actual common strip split along native FUSION plane; open regional patch only.','crossingOriginalFaces':cross,'newVertices':len(links)-n,'newFaces':len(G)-len(F),'topology':topo(G,len(links)),'maxChartFaceCoverageError':float(err.max()),'maxRelativeChartCoverageError':float((err/orig).max()),'endpoints':{}}
for name,X in [('compact',q['idealCompact']),('frozen',b['idealFrozen']),('target',P)]:
 X=mapv(X);Y=X.astype(np.float32).astype(float);N=norm(X,G);M=norm(Y,G);a=np.linalg.norm(M,axis=1)/2;report['endpoints'][name]={'idealBelowFloor':int((np.linalg.norm(N,axis=1)/2<1e-10).sum()),'storedBelowFloor':int((a<1e-10).sum()),'opposed':int((np.sum(N*M,1)<=0).sum()),'minArea':float(a.min()),'affectedFaces':np.flatnonzero((a<1e-10)|(np.sum(N*M,1)<=0)).tolist(),'maxStorageBound':float(np.linalg.norm(X-Y,axis=1).max())}
rows=[]
for phase,seq in [('bridge',np.load(root/'bridge/bridge-motion.npz')['poses']),('tension',t['poses'])]:
 prev=None;na=norm(mapv(seq[0]),G);nb=norm(mapv(seq[-1]),G)
 for k,x in enumerate(seq):
  X=mapv(x).astype(np.float32).astype(float);N=norm(X,G);a=np.linalg.norm(N,axis=1)/2;u=k/(len(seq)-1);v=np.clip((u-.12)/.79,0,1) if phase=='tension' else u;v=v*v*(3-2*v);opp=int((np.sum(N*((1-v)*na+v*nb),1)<=0).sum());temp=0 if prev is None else int((np.sum(N*prev,1)<0).sum());rows.append({'phase':phase,'frame':k,'belowFloor':int((a<1e-10).sum()),'opposed':opp,'temporal':temp,'minArea':float(a.min())});prev=N
report['motion']={k:{'samples':len([r for r in rows if r['phase']==k]),'passes':sum(not any(r[v] for v in ('belowFloor','opposed','temporal')) for r in rows if r['phase']==k),'peakBelowFloor':max(r['belowFloor'] for r in rows if r['phase']==k),'peakOpposed':max(r['opposed'] for r in rows if r['phase']==k),'peakTemporal':max(r['temporal'] for r in rows if r['phase']==k)} for k in ('bridge','tension')};report['motionSamples']=rows
seam=np.array(sorted(vmap.values()));dups={v:len(links)+i for i,v in enumerate(seam)};K=G.copy()
for i in np.flatnonzero(sides>0):K[i]=[dups.get(v,v) for v in K[i]]
weld=np.r_[np.arange(len(links)),seam];assert np.array_equal(weld[K],G);report['splitTopology']=topo(K,len(weld));report['weldedSeamVertices']=len(seam);report['weldMapExact']=True
H=m['postFaces'];Q=m['idealPost'];parent=m['postOwner'];preF=m['preFaces'][:len(H)];assert np.array_equal(m['vertexMap'][preF],H)
by={i:np.flatnonzero(parent==i) for i in np.unique(native)};X=mapv(P);cornerOwner=[];cornerWeights=[];miss=[]
for i,g in enumerate(G):
 candidates=by[native[i]]
 for vi in g:
  pos=X[vi,:2];best=None
  for j in candidates:
   T=Q[H[j]][:,:2];c=Q[H[j],1].mean()
   if (c-cut)*sides[i]<-1e-8:continue
   e=T[1]-T[0];f=T[2]-T[0];d=pos-T[0];den=e[0]*f[1]-e[1]*f[0]
   if abs(den)<1e-20:continue
   u=(d[0]*f[1]-d[1]*f[0])/den;v=(e[0]*d[1]-e[1]*d[0])/den;w=np.array([1-u-v,u,v]);viol=max(0,-w.min(),w.max()-1)
   if best is None or viol<best[0]:best=(viol,j,w)
  if best is None:raise ValueError((i,vi))
  if best[0]>1e-7:miss.append((i,int(vi),float(best[0])))
  w=np.maximum(best[2],0);w/=w.sum();cornerOwner.append(best[1]);cornerWeights.append(w)
co=np.array(cornerOwner);cw=np.array(cornerWeights);targetCorner=np.einsum('ij,ijk->ik',cw,m['post'][H[co]]);critical=np.einsum('ij,ijk->ik',cw,m['criticalPre'][preF[co]]);initial=np.einsum('ij,ijk->ik',cw,m['pre'][0][preF[co]]);ix=K.ravel();first=np.unique(ix,return_index=True)[1];assert np.array_equal(ix[first],np.arange(len(weld)));Xp=initial[first];maxMismatch=float(np.linalg.norm(Xp[ix]-initial,axis=1).max());report['nativeTransfer']={'cornerWitnesses':len(co),'invalidOwnerCorners':len(miss),'maxValidMappedDeployedDistance':float(np.linalg.norm(targetCorner-X[G].reshape(-1,3),axis=1).max()),'criticalDiscontinuity':float(np.linalg.norm(targetCorner-critical,axis=1).max()),'initialSharedCornerMismatch':maxMismatch,'scope':'Corner mapping only; interior child triangle may cross native branch child edges.'}
np.savez_compressed(out/'lineage.npz',faces=G,splitFaces=K,weldMap=weld,vertexAncestorEdges=links[:,:2].astype(int),vertexAncestorWeight=links[:,2],commonFaceOwner=owner,compactRefOwner=q['compactFaceOwner'][owner],nativeParent=native,targetRefOwner=q['targetFaceOwner'][owner],materialChart=S,splitSide=sides,compact=mapv(q['idealCompact']),frozen=mapv(b['idealFrozen']),target=X,initialBranch=Xp,branchCornerOwner=co.reshape(-1,3),branchCornerWeights=cw.reshape(-1,3,3),nativeLoopUV=np.einsum('ij,ijk->ik',cw,m['postLoopUV'][co]).reshape(-1,3,2),nativeMaterial=m['postMaterial'][co.reshape(-1,3)[:,0]])
(out/'lineage.json').write_text(json.dumps(report,indent=2));assert report['topology']['components']==1 and not report['topology']['nonmanifold'] and report['maxRelativeChartCoverageError']<1e-5
