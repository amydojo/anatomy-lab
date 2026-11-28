"""MORPHOSIS FUSION 002: actual indexed native right half, clipped cap, one deliberate native upper-branch cut and weld.
No compact correspondence or complete front claim. Requires shapely 2.1."""
import numpy as np,collections,json,sys
from pathlib import Path
from shapely.geometry import Polygon
from shapely import constrained_delaunay_triangles,points,distance
from shapely.ops import unary_union
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
def normal(V,F):
 t=V[F];return np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
def edges(F):
 e=collections.defaultdict(list)
 for i,f in enumerate(F):
  for a,b in zip(f,np.roll(f,-1)):e[tuple(sorted((int(a),int(b))))].append((i,int(a),int(b)))
 return e
def loops(F):
 E=edges(F);be=[a[0][1:] for a in E.values() if len(a)==1];d=dict(be);assert len(d)==len(be) and set(d)==set(d.values());seen=set(d);out=[]
 while seen:
  a=min(seen);r=[a];seen.remove(a)
  while d[r[-1]]!=a:r.append(d[r[-1]]);seen.remove(r[-1])
  out.append(r)
 return out
def clip(V,F,owners,axis,plane,sign):
 vs=[];fs=[];oo=[];lookup={}
 def put(k,p):
  if k not in lookup:lookup[k]=len(vs);vs.append(p)
  return lookup[k]
 for f,owner in zip(F,owners):
  d=(V[f,axis]-plane)*sign;poly=[]
  for i,j in [(0,1),(1,2),(2,0)]:
   a,b=f[i],f[j];u,v=d[i],d[j]
   if u>=0:poly.append(put(('v',int(a)),V[a]))
   if u*v<0:
    aa,bb=sorted((a,b));t=(plane-V[aa,axis])/(V[bb,axis]-V[aa,axis]);p=V[aa]+t*(V[bb]-V[aa]);p[axis]=plane;poly.append(put(('e',int(aa),int(bb)),p))
  if len(poly)<3:continue
  if len(poly)==3:ts=[poly]
  else:
   assert len(poly)==4;options=[[[poly[0],poly[1],poly[2]],[poly[0],poly[2],poly[3]]],[[poly[1],poly[2],poly[3]],[poly[1],poly[3],poly[0]]]];ts=max(options,key=lambda f:np.linalg.norm(normal(np.array(vs),np.array(f)),axis=1).min())
  fs.extend(ts);oo.extend([owner]*len(ts))
 return np.array(vs),np.array(fs),np.array(oo),lookup
def cap(V,loop,axis):
 dim=[i for i in range(3) if i!=axis];xy=V[loop][:,dim];p=Polygon(xy);assert p.is_valid and p.area>0
 lookup={tuple(x):i for x,i in zip(xy,loop)};T=[]
 for tr in constrained_delaunay_triangles(p).geoms:T.append([lookup[x] for x in list(tr.exterior.coords)[:-1]])
 T=np.array(T);E=edges(T);boundary={(a,b) for a,b in zip(loop,np.roll(loop,-1))};current={x[0][1:] for x in E.values() if len(x)==1}
 if current==boundary:T=T[:,::-1]
 else:assert current=={(b,a) for a,b in boundary}
 return T
def audit(V,F):
 E=edges(F);e=np.array(list(E));M=coo_matrix((np.ones(2*len(e)),(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(len(V),len(V)));cc=connected_components(M,directed=False)[0];N=normal(V,F);ar=np.linalg.norm(N,axis=1)/2;T=V[F];vol=float(np.einsum('ij,ij->i',T[:,0],np.cross(T[:,1],T[:,2])).sum()/6);return {'vertices':len(V),'faces':len(F),'edges':len(E),'components':cc,'euler':len(V)-len(E)+len(F),'boundary':sum(len(x)==1 for x in E.values()),'nonmanifold':sum(len(x)>2 for x in E.values()),'orientation':sum(len(x)==2 and x[0][1:]!=x[1][1:][::-1] for x in E.values()),'belowFloor':int((ar<1e-10).sum()),'minArea':float(ar.min()),'volume':vol}
def run(src,out):
 q=np.load(src);V,F=q['vertices'],q['faces'];V1,F1,o1,_=clip(V,F,np.arange(len(F)),0,.01,1);ls=loops(F1);assert len(ls)==1;T=cap(V1,ls[0],0);F1=np.r_[F1,T];o1=np.r_[o1,np.full(len(T),-1)]
 plane=-20.013
 A,FA,oa,_=clip(V1,F1,np.arange(len(F1)),1,plane,-1);B,FB,ob,_=clip(V1,F1,np.arange(len(F1)),1,plane,1);la=loops(FA);lb=loops(FB);chosen=max(la,key=lambda l:A[l,2].mean());selected=set(chosen);bb={tuple(p):i for i,p in enumerate(B) if p[1]==plane};match={i:bb[tuple(A[i])] for l in la for i in l};selB={match[i] for i in chosen};chosenB=next(l for l in lb if set(l)==selB)
 bmap=np.full(len(B),-1,int)
 for i,j in match.items():
  if j not in selB:bmap[j]=i
 rest=np.flatnonzero(bmap<0);bmap[rest]=np.arange(len(A),len(A)+len(rest));P=np.r_[A,B[rest]];G=np.r_[FA,bmap[FB]];parent=np.r_[o1[oa],o1[ob]];side=np.r_[np.full(len(A),-1),np.full(len(rest),1)];caps=np.r_[cap(A,chosen,1),bmap[cap(B,chosenB,1)]];preF=np.r_[G,caps];capIDs=np.arange(len(G),len(preF));preOwner=np.r_[parent,np.full(len(caps),-2)]
 poly=Polygon(A[chosen][:,[0,2]]);other=np.array([A[i,[0,2]] for l in la if l is not chosen for i in l]);mind=float(distance(points(other),poly).min());assert mind>0
 d=distance(points(P[:,[0,2]]),poly);u=np.clip(d/(mind*.45),0,1);w=1-u*u*(3-2*u);radius=3.;a=np.clip(abs(P[:,1]-plane)/radius,0,1);w*=1-a*a*(3-2*a);amp=.35
 pre=[];rows=[];prev=None
 for t in np.linspace(0,.99,65):
  X=P.copy();X[:,1]+=side*amp*(1-t*t*(3-2*t))*w;X=X.astype(np.float32);r=audit(X.astype(float),preF);N=normal(X.astype(float),preF);r['temporalReversal']=0 if prev is None else int((np.sum(prev*N,axis=1)<0).sum());prev=N;rows.append(r);pre.append(X)
 mp=np.arange(len(P))
 for i,j in match.items():
  if i in selected:mp[bmap[j]]=i
 H=mp[G];used=np.unique(H);idx=np.full(len(P),-1,int);idx[used]=np.arange(len(used));H=idx[H];mp=idx[mp];Q=P[used].astype(np.float32);critical=P.astype(np.float32);assert np.array_equal(critical,Q[mp]);post=audit(Q.astype(float),H)
 hit=np.flatnonzero(parent>=0);source=V[F[parent[hit]]];child=Q[H[hit]].astype(float);a0=source[:,0];e=source[:,1]-a0;f=source[:,2]-a0;N=np.cross(e,f);den=np.sum(N*N,1);v=child-a0[:,None];u=np.einsum('ijk,ik->ij',np.cross(v,f[:,None]),N)/den[:,None];w2=np.einsum('ijk,ik->ij',np.cross(e[:,None],v),N)/den[:,None];re=a0[:,None]+u[:,:,None]*e[:,None]+w2[:,:,None]*f[:,None];err=float(np.linalg.norm(re-child,axis=2).max());violation=float(max(0,-u.min(),-w2.min(),(u+w2-1).max()))
 ideal=P[used];childI=ideal[H[hit]];v=childI-a0[:,None];uI=np.einsum('ijk,ik->ij',np.cross(v,f[:,None]),N)/den[:,None];vI=np.einsum('ijk,ik->ij',np.cross(e[:,None],v),N)/den[:,None];wI=np.stack([1-uI-vI,uI,vI],axis=2);idealViolation=float(max(0,-wI.min(),wI.max()-1));assert idealViolation<1e-7
 wvalid=np.maximum(wI,0);wvalid/=wvalid.sum(2)[:,:,None];ref=np.einsum('fij,fjk->fik',wvalid,source);dist=np.linalg.norm(child-ref,axis=2);delta=child-ref;wit=np.stack([delta.mean(1),(delta[:,0]+delta[:,1])/2,(delta[:,1]+delta[:,2])/2,(delta[:,2]+delta[:,0])/2],1);witness=float(np.linalg.norm(wit,axis=2).max());areas=lambda V,F:np.linalg.norm(normal(V,F),axis=1)/2
 c1=np.bincount(o1[o1>=0],weights=areas(V1,F1)[o1>=0],minlength=len(F));c2=np.bincount(parent[hit],weights=areas(ideal,H)[hit],minlength=len(F));cov=float(abs(c1-c2).max());assert cov<1e-9
 loopUV=np.zeros((len(H),3,2));loopUV[hit]=np.einsum('fij,fjk->fik',wvalid,q['nativeLoopUV'][parent[hit]]);capface=np.flatnonzero(parent<0);loopUV[capface]=ideal[H[capface]][:,:,[1,2]];mat=np.full(len(H),-1);mat[hit]=q['nativeMaterial'][parent[hit]];preUV=np.concatenate([loopUV,P[preF[capIDs]][:,:,[0,2]]]);preMat=np.r_[mat,np.full(len(capIDs),-2)]
 region=q['regionID'];block2=np.isin(region,[16,17,18,19,20,21]);preserved=int(len(np.intersect1d(np.flatnonzero(block2),np.unique(parent[hit]))));capT=P[preF[capIDs]];cn=normal(P,preF[capIDs]);p1=unary_union([Polygon(t[:,[0,2]]) for t in capT[cn[:,1]>0]]);p2=unary_union([Polygon(t[:,[0,2]]) for t in capT[cn[:,1]<0]]);capDiff=float(p1.symmetric_difference(p2).area)
 report={'nativeConnectionParentIDsPreserved':preserved,'idealBarycentricViolation':idealViolation,'validMappedStoredVertexBound':float(dist.max()),'validMappedStoredWitnessBound':witness,'clippedNativePerParentAreaError':cov,'criticalCapSymmetricDifferenceArea':capDiff,'criticalCapArea':float(p1.area),'scope':'Native half-frame clipped at x=.01 with constructed symmetry cap; one native cross-section cut/weld. Not frozen B correspondence or complete front.','half':audit(V1,F1),'preFirst':rows[0],'preLast':rows[-1],'post':post,'samples':rows,'nativeChildFaces':len(hit),'nativeParentCount':len(np.unique(parent[hit])),'nativeSurfacePlaneError':err,'nativeBarycentricViolation':violation,'removedCapTriangles':len(caps),'weldedVertices':len(P)-len(Q),'maxRetainedCoordinateDiscontinuity':float(np.max(abs(critical-Q[mp]))),'selectedCutPlane':plane,'selectedSectionVertices':len(chosen),'supportClearanceXZ':mind,'monotonicYDerivativeLowerBound':1-1.5*amp/radius,'regularPasses':sum(not any(r[k] for k in ('boundary','nonmanifold','orientation','belowFloor','temporalReversal')) and r['components']==1 and r['euler']==2 and r['volume']>0 for r in rows),'limitations':['Sampled triangle integrity only; separate collision gate.','Monotone analytic displacement sampled at vertices, PL realization not certified.','Constructed symmetry cap and temporary contact caps explicitly marked.','No full artwork shader parity or frozen B compact mapping.']}
 out.mkdir(parents=True,exist_ok=True);(out/'branch.json').write_text(json.dumps(report,indent=2,default=lambda x:x.item()));np.savez_compressed(out/'branch.npz',pre=np.array(pre),preFaces=preF,criticalPre=critical,post=Q,postFaces=H,vertexMap=mp,preOwner=preOwner,postOwner=parent,removedCaps=capIDs,idealPost=ideal,preLoopUV=preUV,postLoopUV=loopUV,preMaterial=preMat,postMaterial=mat,sourceParents=np.unique(parent[hit]))
if __name__=='__main__':run(Path(sys.argv[1]),Path(sys.argv[2]))
