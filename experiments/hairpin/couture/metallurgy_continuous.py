"""Float64 piecewise-linear certificate for stored METALLURGY poses.
Requires numpy and numba; not a certificate for arbitrary Blender F-curves."""
import numpy as np,json,sys
from pathlib import Path
from numba import njit
def minimum(a,b,c):
    t=np.clip(np.divide(-b,2*a,out=np.zeros_like(a),where=a>0),0,1)
    return np.minimum(np.minimum(c,a+b+c),a*t*t+b*t+c)
@njit
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
@njit
def poly(a,b,c,A,B,C):
    e=b-a;f=c-a;E=(B-A)-e;F=(C-A)-f;return cross(E,F),cross(E,f)+cross(e,F),cross(e,f)
@njit
def roots(a,b,c,rr,k):
    scale=max(abs(a),abs(b),abs(c),1e-300)
    if abs(a)<scale*1e-15:
        if abs(b)>scale*1e-15:
            t=-c/b
            if 0<t<1:rr[k]=t;k+=1
        return k
    D=b*b-4*a*c
    if D<0:return k
    z=np.sqrt(D);q=-.5*(b+z if b>=0 else b-z)
    for t in (q/a,c/q if q!=0 else -b/(2*a)):
        if 0<t<1:rr[k]=t;k+=1
    return k
@njit
def sign(x,eps):return 1 if x>eps else -1 if x<-eps else 0
@njit
def on(a,b,c,eps):return min(a[0],b[0])-eps<=c[0]<=max(a[0],b[0])+eps and min(a[1],b[1])-eps<=c[1]<=max(a[1],b[1])+eps
@njit
def hit(a,b,c,d):
    e=b-a;f=d-c;eps=1e-13*max(1.,np.linalg.norm(e),np.linalg.norm(f));ss=[sign(cross(e,c-a),eps),sign(cross(e,d-a),eps),sign(cross(f,a-c),eps),sign(cross(f,b-c),eps)]
    return (ss[0]*ss[1]<0 and ss[2]*ss[3]<0) or (ss[0]==0 and on(a,b,c,eps)) or (ss[1]==0 and on(a,b,d,eps)) or (ss[2]==0 and on(c,d,a,eps)) or (ss[3]==0 and on(c,d,b,eps))
@njit
def swept(P,Q,be):
    n=len(be);tests=0;hits=0;first=(-1,-1,-1.)
    for i in range(n):
        a,b=be[i];p=P[a];q=P[b];A=Q[a];B=Q[b]
        lo=np.minimum(np.minimum(p,q),np.minimum(A,B));hi=np.maximum(np.maximum(p,q),np.maximum(A,B))
        for j in range(i+1,n):
            c,d=be[j]
            if a==c or a==d or b==c or b==d:continue
            r=P[c];s=P[d];C=Q[c];D=Q[d];l=np.minimum(np.minimum(r,s),np.minimum(C,D));h=np.maximum(np.maximum(r,s),np.maximum(C,D))
            if np.any(hi<l) or np.any(h<lo):continue
            tests+=1;rr=np.empty(10);rr[0]=0;rr[1]=1;k=2
            for x,y,z in (poly(p,q,r,A,B,C),poly(p,q,s,A,B,D),poly(r,s,p,C,D,A),poly(r,s,q,C,D,B)):k=roots(x,y,z,rr,k)
            ts=np.sort(rr[:k]);failed=False
            for m in range(k):
                for t in (ts[m],(ts[m]+ts[m+1])/2 if m+1<k else ts[m]):
                    if hit(p+t*(A-p),q+t*(B-q),r+t*(C-r),s+t*(D-s)):
                        hits+=1;failed=True
                        if first[0]<0:first=(i,j,t)
                        break
                if failed:break
    return tests,hits,first
def certify(poses,F):
    e=np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),axis=1);ue,counts=np.unique(e,axis=0,return_counts=True);be=ue[counts==1];res=[]
    for i,(P,Q) in enumerate(zip(poses[:-1],poses[1:])):
        P=P.astype(float);Q=Q.astype(float);e=P[F[:,1]]-P[F[:,0]];f=P[F[:,2]]-P[F[:,0]];E=(Q[F[:,1]]-Q[F[:,0]])-e;G=(Q[F[:,2]]-Q[F[:,0]])-f
        c=np.cross(e,f);b=np.cross(E,f)+np.cross(e,G);a=np.cross(E,G);m=minimum(-a[:,2],-b[:,2],-c[:,2]);sus=np.flatnonzero(m/2<1e-10);minArea=float(m.min()/2);bad=0
        if len(sus):
            minArea=float(np.min(m[np.setdiff1d(np.arange(len(F)),sus)])/2) if len(sus)<len(F) else float('inf')
            for j in sus:
                aa,bb,cc=a[j],b[j],c[j];coef=[4*(aa@aa),6*(aa@bb),2*(bb@bb+2*aa@cc),2*(bb@cc)];rr=np.roots(np.trim_zeros(coef,'f')) if any(coef) else []
                ts=[0.,1.]+[float(x.real) for x in rr if abs(x.imag)<1e-9 and 0<x.real<1];ar=min(np.linalg.norm((aa*t+bb)*t+cc)/2 for t in ts);minArea=min(minArea,ar);bad+=int(ar<1e-10)
        tests,hits,first=swept(P[:,:2],Q[:,:2],be)
        res.append({'interval':i,'minimumSignedProjectionTwiceArea':float(m.min()),'projectedNonpositive':int(np.sum(m<=0)),'min3DAreaConservative':minArea,'belowFloor3D':bad,'areaExactTests':len(sus),'boundarySweptCandidatePairs':tests,'boundaryCrossingOrNearContactPairs':hits,'firstBoundaryCandidate':list(first)})
    r={'intervals':len(res),'minProjectionTwiceArea':min(x['minimumSignedProjectionTwiceArea'] for x in res),'min3DAreaConservative':min(x['min3DAreaConservative'] for x in res),'projectedNonpositiveTotal':sum(x['projectedNonpositive'] for x in res),'belowFloor3DTotal':sum(x['belowFloor3D'] for x in res),'sweptBoundaryCandidates':sum(x['boundarySweptCandidatePairs'] for x in res),'boundaryCrossingOrNearContactPairs':sum(x['boundaryCrossingOrNearContactPairs'] for x in res),'samples':res,'limitations':'Float64 polynomial/segment check of piecewise-linear interpolation between stored samples; not every float32 rounding, arbitrary Blender F-curves, or solid collision.'}
    r['piecewiseLinearCertificatePass']=not any(r[k] for k in ('projectedNonpositiveTotal','belowFloor3DTotal','boundaryCrossingOrNearContactPairs'));return r
if __name__=='__main__':
    q=np.load(sys.argv[1]);poses=np.load(sys.argv[2])['poses'];r=certify(poses,q['faces']);Path(sys.argv[3]).write_text(json.dumps(r,indent=2));print({k:v for k,v in r.items() if k!='samples'})
