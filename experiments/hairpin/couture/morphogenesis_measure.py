"""Double precision distance qualification; chart provenance and conservative nearest triangle.
No relaxed threshold and no changes to the correspondence construction."""
import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Polygon
from shapely import points
from shapely.strtree import STRtree
EPS=2e-5
def nearest(P,T):
    P=np.asarray(P,dtype=np.float64);T=np.asarray(T,dtype=np.float64)
    centers=T.mean(1);rad=np.linalg.norm(T-centers[:,None],axis=2).max(1);tree=cKDTree(centers)
    def distances(p,t):
        a,b,c=t[:,0],t[:,1],t[:,2];ab=b-a;ac=c-a;ap=p-a;n=np.cross(ab,ac);nn=np.einsum('ij,ij->i',n,n)
        safe=np.maximum(nn,1e-300);u=np.einsum('ij,ij->i',np.cross(ap,ac),n)/safe;v=np.einsum('ij,ij->i',np.cross(ab,ap),n)/safe
        proj=a+u[:,None]*ab+v[:,None]*ac;d=np.linalg.norm(p-proj,axis=1);d[(u<0)|(v<0)|(u+v>1)|(nn==0)]=np.inf
        for x,y in [(a,b),(b,c),(c,a)]:
            e=y-x;den=np.einsum('ij,ij->i',e,e);f=np.clip(np.einsum('ij,ij->i',p-x,e)/np.maximum(den,1e-300),0,1);d=np.minimum(d,np.linalg.norm(p-x-f[:,None]*e,axis=1))
        return d
    _,seed=tree.query(P);upper=distances(P,T[seed]);out=np.empty(len(P));ids=np.empty(len(P),dtype=int)
    for start in range(0,len(P),512):
        sl=slice(start,start+512);q=P[sl];up=upper[sl];lists=tree.query_ball_point(q,up+rad.max()+1e-10);n=np.array([len(x) for x in lists]);ii=np.repeat(np.arange(len(q)),n);jj=np.concatenate(lists).astype(int)
        keep=np.linalg.norm(q[ii]-centers[jj],axis=1)<=up[ii]+rad[jj]+1e-10;ii=ii[keep];jj=jj[keep];dd=distances(q[ii],T[jj]);order=np.lexsort((dd,ii));k=order[np.r_[True,np.diff(ii[order])!=0]];assert len(k)==len(q);out[sl]=dd[k];ids[sl]=jj[k]
    return out,ids
def bary(p,t):
    a,b,c=t[:,0],t[:,1],t[:,2];e=b-a;f=c-a;q=p-a;den=e[:,0]*f[:,1]-e[:,1]*f[:,0];u=(q[:,0]*f[:,1]-q[:,1]*f[:,0])/den;v=(e[:,0]*q[:,1]-e[:,1]*q[:,0])/den;return np.stack([1-u-v,u,v],1)
def map_chart(P,UV,T):
    P=np.asarray(P,np.float64);UV=np.asarray(UV,np.float64);T=np.asarray(T,np.float64);polys=[Polygon(q) for q in UV];tree=STRtree(polys)
    query=points(P);pairs=tree.query(query,predicate='intersects');owner=np.full(len(P),-1,int);owner[pairs[0]]=pairs[1];missing=np.flatnonzero(owner<0)
    if len(missing):owner[missing]=tree.nearest(query[missing])
    w=bary(P,UV[owner]);wc=np.maximum(w,0);wc/=wc.sum(1)[:,None];chart_err=np.linalg.norm(P-np.einsum('ij,ijk->ik',wc,UV[owner]),axis=1);assert chart_err.max()<1e-9,chart_err.max()
    return np.einsum('ij,ijk->ik',wc,T[owner]),owner,chart_err
def witnesses(T):
    return np.stack([T.mean(1),(T[:,0]+T[:,1])/2,(T[:,1]+T[:,2])/2,(T[:,2]+T[:,0])/2],1).reshape(-1,T.shape[-1])
def audit(uv,xyz,F,refuv,ref):
    uv=np.asarray(uv,np.float64);xyz=np.asarray(xyz,np.float64);F=np.asarray(F,int);refuv=np.asarray(refuv,np.float64);ref=np.asarray(ref,np.float64);T=xyz[F];U=uv[F];P=np.concatenate([uv,witnesses(U)]);X=np.concatenate([xyz,witnesses(T)]);Y,owners,err=map_chart(P,refuv,ref);dist=np.linalg.norm(X-Y,axis=1)
    Q=np.concatenate([refuv.reshape(-1,2),witnesses(refuv)]);Z=np.concatenate([ref.reshape(-1,3),witnesses(ref)]);W,revown,rerr=map_chart(Q,U,T);reverse=np.linalg.norm(Z-W,axis=1)
    _,faceowner,_=map_chart(U.mean(1),refuv,ref);weights=bary(U.reshape(-1,2),np.repeat(refuv[faceowner],3,axis=0));bad=float(max(0,-weights.min(),weights.max()-1))
    def signed(q):
        e=q[:,1]-q[:,0];f=q[:,2]-q[:,0];return (e[:,0]*f[:,1]-e[:,1]*f[:,0])/2
    areas=signed(U);ra=signed(refuv);covered=np.bincount(faceowner,weights=areas,minlength=len(ref));areaerror=np.abs(covered-ra)
    n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);rn=np.cross(ref[:,1]-ref[:,0],ref[:,2]-ref[:,0]);dots=np.einsum('ij,ij->i',n,rn[faceowner]);ga=np.linalg.norm(n,axis=1)/2
    report={'forwardVertexMax':float(dist[:len(uv)].max()),'forwardWitnessMax':float(dist[len(uv):].max()),'forwardChecks':len(P),'reverseMax':float(reverse.max()),'reverseChecks':len(Q),'chartReconstructionMax':float(max(err.max(),rerr.max())),'maxFaceBarycentricViolation':bad,'maxPerFaceChartAreaError':float(areaerror.max()),'maxRelativeFaceAreaError':float((areaerror/ra).max()),'uncoveredFaces':int(np.sum(covered==0)),'chartNonpositiveFaces':int(np.sum(areas<=0)),'opposedOrZeroGeometricNormals':int(np.sum(dots<=0)),'minGeometricArea':float(ga.min()),'nearDegenerateGeometricFaces':int(np.sum(ga<1e-10)),'badFaceIDs':np.flatnonzero((dots<=0)|(ga<1e-10)).tolist()}
    report['distancePass']=bool(max(dist.max(),reverse.max())<EPS);report['coveragePass']=bool(bad<1e-7 and areaerror.max()<1e-9 and (areaerror/ra).max()<1e-5 and not report['uncoveredFaces'] and not report['chartNonpositiveFaces']);report['orientationPass']=not report['opposedOrZeroGeometricNormals']
    return report,faceowner
def selftest():
    T=np.array([[[0,0,0],[1,0,0],[0,1,0]]],float);P=np.array([[.2,.2,0],[.2,.2,2],[1,1,0],[-1,0,0]]);ds,_=nearest(P,T);assert np.allclose(ds,[0,2,2**-.5,1])
    T=np.array([[[0,0,0],[1,0,0],[.5,0,0]]],float);ds,_=nearest([[.5,1,0]],T);assert np.allclose(ds,[1])
    return 5
