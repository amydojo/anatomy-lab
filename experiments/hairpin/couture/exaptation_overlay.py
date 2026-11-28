"""Globally noded common overlay, exact coordinate identity, no sliver removal."""
import numpy as np, shapely as sh, json,sys
from pathlib import Path
from shapely.strtree import STRtree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from functools import lru_cache
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
q=np.load(root/'genesis/conditioned-correspondence.npz');b=np.load(root/'bridge/bridge-correspondence.npz');z=np.load(root/'atlas/native-atlas.npz');a=json.load(open(root/'atlas/native-atlas.json'));F=q['faces'];A=q['idealTarget'][F][:,:,:2];lower=np.array(next(x['nativeTriangleIDs'] for x in a['regions'] if x['name']=='block_2_interior_negative_skin'));B=z['vertices'][z['faces'][lower]];chart=np.load(sys.argv[3]);L=chart[z['faces'][lower]];pa=sh.polygons(A);pb=sh.polygons(L);D=sh.intersection(sh.union_all(pa),sh.union_all(pb));original=sh.union_all(sh.polygons(B[:,:,:2]));assert sh.area(sh.symmetric_difference(original,sh.union_all(pb)))<1e-9
T=np.concatenate([A,L]);E=np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]);flip=(E[:,0,0]>E[:,1,0])|((E[:,0,0]==E[:,1,0])&(E[:,0,1]>E[:,1,1]));E[flip]=E[flip,::-1];E=np.unique(E.reshape(-1,4),axis=0).reshape(-1,2,2)
cells=sh.get_parts(sh.polygonize(sh.get_parts(sh.union_all(sh.linestrings(E)))));rep=sh.point_on_surface(cells);sel=sh.covers(D,rep);cells=cells[sel];rep=rep[sel];assert np.all(sh.get_num_interior_rings(cells)==0);owners=[]
for polys in [pa,pb]:
 tree=STRtree(polys);i,j=tree.query(rep,predicate='intersects');owner=np.full(len(cells),-1,int);owner[i]=j;assert np.all(owner>=0);owners.append(owner)
oa,ob=owners;cells=sh.orient_polygons(cells,exterior_cw=False);rings=sh.get_exterior_ring(cells);C,I=sh.get_coordinates(rings,return_index=True);counts=np.bincount(I);starts=np.r_[0,np.cumsum(counts)[:-1]];keep=np.ones(len(C),bool);keep[starts+counts-1]=False;C=C[keep];I=I[keep];counts-=1;starts=np.r_[0,np.cumsum(counts)[:-1]]
def bary(P,T):
 d=P-T[:,0];e=T[:,1]-T[:,0];f=T[:,2]-T[:,0];den=e[:,0]*f[:,1]-e[:,1]*f[:,0];u=(d[:,0]*f[:,1]-d[:,1]*f[:,0])/den;v=(e[:,0]*d[:,1]-e[:,1]*d[:,0])/den;return np.c_[1-u-v,u,v]
w=bary(C,A[oa[I]]);v=bary(C,L[ob[I]]);violation=float(max(0,-w.min(),-v.min(),w.max()-1,v.max()-1));refs=[q['idealCompact'][F],b['idealFrozen'][F],q['idealTarget'][F]];P=np.stack([np.einsum('ij,ijk->ik',w,x[oa[I]]) for x in refs]+[np.einsum('ij,ijk->ik',v,B[ob[I]])],axis=1);X,first,ix=np.unique(C,axis=0,return_index=True,return_inverse=True);Y=P[first];mismatch=float(np.linalg.norm(Y[ix]-P,axis=2).max());outF=[];outOwner=[]
def det(t):
 e=t[...,1,:]-t[...,0,:];f=t[...,2,:]-t[...,0,:];return e[...,0]*f[...,1]-e[...,1]*f[...,0]
for n in [3,4]:
 ci=np.flatnonzero(counts==n);ids=ix[starts[ci,None]+np.arange(n)];opts=[[[0,1,2]]] if n==3 else [[[0,1,2],[0,2,3]],[[0,1,3],[1,2,3]]];scores=[];ts=[]
 for opt in opts:
  f=ids[:,opt];p=Y[f].transpose(0,1,3,2,4);p=np.concatenate([p,p.astype(np.float32).astype(float)],2);ar=np.linalg.norm(np.cross(p[...,1,:]-p[...,0,:],p[...,2,:]-p[...,0,:]),axis=-1)/2;d=det(X[f]);bad=(ar<1e-10).sum((1,2))+1e6*(d<=0).sum(1);mn=ar.min((1,2));scores.append((bad,mn));ts.append(f)
 pick=np.zeros(len(ci),int) if n==3 else ((scores[1][0]<scores[0][0])|((scores[1][0]==scores[0][0])&(scores[1][1]>scores[0][1]))).astype(int);f=np.stack(ts)[pick,np.arange(len(ci))];outF.append(f.reshape(-1,3));outOwner.append(np.repeat(ci,n-2))
for ci in np.flatnonzero(counts>4):
 ids=ix[starts[ci]:starts[ci]+counts[ci]]
 @lru_cache(None)
 def best(i,j):
  if j-i<2:return (0,float('inf'),[])
  options=[]
  for k in range(i+1,j):
   t=ids[[i,k,j]]
   if det(X[t])<=0:continue
   l=best(i,k);r=best(k,j)
   if l is None or r is None:continue
   p=Y[t].transpose(1,0,2);p=np.concatenate([p,p.astype(np.float32).astype(float)]);ar=np.linalg.norm(np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),axis=1)/2;options.append((l[0]+r[0]-int((ar<1e-10).sum()),min(l[1],r[1],ar.min()),l[2]+r[2]+[t]))
  return max(options,key=lambda v:v[:2]) if options else None
 v=best(0,len(ids)-1);assert v is not None;outF.append(np.array(v[2]));outOwner.append(np.full(len(v[2]),ci))
f=np.concatenate(outF);c=np.concatenate(outOwner);oa=oa[c];ob=ob[c];d=det(X[f])/2;assert np.all(d>0);edges,cnt=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),1),axis=0,return_counts=True);be=edges[cnt==1];boundaryDegree=np.bincount(be.ravel(),minlength=len(X));nonman=int((cnt>2).sum());unint=int((sh.distance(sh.points(X[be].mean(1)),sh.boundary(D))>1e-8).sum());M=coo_matrix((np.ones(2*len(edges)),(np.r_[edges[:,0],edges[:,1]],np.r_[edges[:,1],edges[:,0]])),shape=(len(X),len(X)));cc=connected_components(M,directed=False)[0];coverA=np.bincount(oa,weights=d,minlength=len(A));coverB=np.bincount(ob,weights=d,minlength=len(B));expA=sh.area(sh.intersection(pa,D));expB=sh.area(sh.intersection(pb,D));reports={}
for k,n in enumerate(['compact','frozen','upper','lower']):
 p=Y[:,k][f];s=p.astype(np.float32).astype(float);N=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);S=np.cross(s[:,1]-s[:,0],s[:,2]-s[:,0]);ar=np.linalg.norm(S,axis=1)/2;bad=(ar<1e-10)|(np.sum(N*S,axis=1)<=0)|(np.linalg.norm(N,axis=1)/2<1e-10);reports[n]={'idealBelow':int((np.linalg.norm(N,axis=1)/2<1e-10).sum()),'storedBelow':int((ar<1e-10).sum()),'opposed':int((np.sum(N*S,axis=1)<=0).sum()),'minStoredArea':float(ar.min()),'affectedFaceIDs':np.flatnonzero(bad).tolist(),'maxAffineStorageBound':float(np.linalg.norm(Y[:,k]-Y[:,k].astype(np.float32),axis=1).max())}
r={'vertices':len(X),'triangles':len(f),'components':int(cc),'euler':len(X)-len(edges)+len(f),'boundaryEdges':len(be),'boundaryDegreeDefects':int(((boundaryDegree!=0)&(boundaryDegree!=2)).sum()),'nonmanifoldEdges':nonman,'unintendedBoundaryEdges':unint,'domainArea':float(sh.area(D)),'coveredArea':float(d.sum()),'maxCommonCoverageError':float(abs(coverA-expA).max()),'maxLowerCoverageError':float(abs(coverB-expB).max()),'maxBarycentricViolation':violation,'sharedVertexMismatch':mismatch,'minVerticalSeparation':float((Y[:,2,2]-Y[:,3,2]).min()),'endpoints':reports};r['numericalPass']=bool(cc==1 and r['euler']==1 and not any(r[k] for k in ['boundaryDegreeDefects','nonmanifoldEdges','unintendedBoundaryEdges']) and max(r['maxCommonCoverageError'],r['maxLowerCoverageError'])<1e-9 and violation<1e-7 and mismatch<2e-5 and r['minVerticalSeparation']>0 and all(not (x['idealBelow'] or x['storedBelow'] or x['opposed']) for x in reports.values()));(out/'refinement.json').write_text(json.dumps(r,indent=2));np.savez_compressed(out/'refinement.npz',xy=X,faces=f,compact=Y[:,0],frozen=Y[:,1],target=Y[:,2],lower=Y[:,3],faceCommonOwner=oa,faceLowerOwner=ob,upperNativeParent=q['targetChildNativeID'][q['targetFaceOwner'][oa]],lowerNativeParent=lower[ob],boundary=be,chart=chart);print(json.dumps(r,indent=2))
