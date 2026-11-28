"""METALLURGY: local polar integration and positive-weight planar tension.
Frozen GENESIS topology, endpoint positions and UV; no control fallback."""
import numpy as np,json,sys
from pathlib import Path
from scipy.spatial.transform import Rotation
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import splu,spsolve
from scipy.interpolate import PchipInterpolator
from shapely.geometry import Polygon
def normals(p,F):
    t=p[F];return np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
def frame(p,F):
    t=p[F];e=t[:,1]-t[:,0];g=t[:,2]-t[:,0];n=np.cross(e,g);return np.stack([e,g,n/np.sqrt(np.linalg.norm(n,axis=1))[:,None]],2)
def boundary(F):
    e=np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),axis=1);ue,c=np.unique(e,axis=0,return_counts=True);be=ue[c==1];adj={}
    assert c.max()==2
    for x,y in be:adj.setdefault(x,[]).append(y);adj.setdefault(y,[]).append(x)
    assert all(len(v)==2 for v in adj.values());loop=[min(adj)];last=-1
    while True:
        nxt=next(k for k in adj[loop[-1]] if k!=last)
        if nxt==loop[0]:break
        last=loop[-1];loop.append(nxt)
    assert len(loop)==len(adj);return ue,be,np.array(loop)
def measure(p,F,a,b,t,prev,M=None,A=None):
    p=p.astype(np.float32).astype(float);n=normals(p,F);na=normals(a,F);nb=normals(b,F);ar=np.linalg.norm(n,axis=1)/2
    f=np.clip((t-.12)/.79,0,1);f=f*f*(3-2*f);ref=(1-f)*na+f*nb
    op=np.sum(n*ref,axis=1)<=0;deg=ar<1e-10;tmp=np.zeros(len(F),bool) if prev is None else np.sum(n*prev,axis=1)<0
    local=op
    if M is not None:
        e=A[F[:,1]]-A[F[:,0]];g=A[F[:,2]]-A[F[:,0]];nn=np.cross(np.einsum('ijk,ik->ij',M,e),np.einsum('ijk,ik->ij',M,g));local=np.sum(n*nn,axis=1)<=0
    return {'t':t,'opposed':int(op.sum()),'degenerate':int(deg.sum()),'temporal':int(tmp.sum()),'localOpposed':int(local.sum()),'minArea':float(ar.min()),'area':float(ar.sum()),'affectedFaceIDs':np.flatnonzero(op|deg|tmp|local).tolist()},n
def summarize(ss,keys):
    return {**{k:max(x[k] for x in ss) for k in keys},'passes':sum(not any(x[k] for k in keys) for x in ss),'samples':ss}
def polar(q,stretch,weight):
    A=q['idealCompact'];B=q['idealTarget'];F=q['faces'];a=q['compact'];b=q['target'];ss=[];prev=None
    if stretch:
        G=frame(B,F)@np.linalg.inv(frame(A,F));u,s,v=np.linalg.svd(G);R=u@v;assert np.min(np.linalg.det(R))>0;rot=Rotation.from_matrix(R).as_rotvec()
        E=np.stack([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]],1);i=E[:,:,0].ravel();j=E[:,:,1].ravel();d=(A[j]-A[i]).reshape(-1,3,3)
        le=np.maximum(np.linalg.norm(d,axis=2),np.linalg.norm((B[j]-B[i]).reshape(-1,3,3),axis=2));floor=np.percentile(le,15)
        w=(1/np.maximum(le,floor)**2 if weight=='balanced' else np.broadcast_to(1/np.maximum(le.max(1),floor)[:,None]**2,le.shape) if weight=='face' else np.ones_like(le)).ravel()
        L=coo_matrix((np.r_[w,w,-w,-w],(np.r_[i,j,i,j],np.r_[i,j,j,i])),shape=(len(A),len(A))).tocsc();lu=splu(L[1:,1:])
    for step in range(81):
        t=step/80;M=None
        if step==0:p=a
        elif step==80:p=b
        elif not stretch:p=(1-t)*a+t*b
        else:
            st=s**t if stretch=='log' else 1+t*(s-1);M=Rotation.from_rotvec(rot*t).as_matrix()@((v.transpose(0,2,1)*st[:,None,:])@v)
            D=(M@d.transpose(0,2,1)).transpose(0,2,1).reshape(-1,3);rhs=np.stack([np.bincount(j,weights=w*D[:,k],minlength=len(A))-np.bincount(i,weights=w*D[:,k],minlength=len(A)) for k in range(3)],1)
            p=np.vstack([np.zeros((1,3)),lu.solve(rhs[1:])]);p+=(1-t)*A.mean(0)+t*B.mean(0)-p.mean(0)
        r,prev=measure(p,F,a,b,t,prev,M,A);ss.append(r)
    r=summarize(ss,['opposed','degenerate','temporal','localOpposed'])
    if stretch:r['conditioning']={'stretchMin':float(s.min()),'stretchMax':float(s.max()),'weightRatio':float(w.max()/w.min())}
    return r
def harmonic(q,N):
    A=q['idealCompact'];B=q['idealTarget'];a=q['compact'];b=q['target'];F=q['faces'];n=len(A);ue,be,loop=boundary(F);bd=np.unique(be);inside=np.setdiff1d(np.arange(n),bd);lookup=np.full(n,-1);lookup[inside]=np.arange(len(inside))
    assert np.all(normals(A,F)[:,2]<0) and np.all(normals(B,F)[:,2]<0)
    i=np.concatenate([F[:,0],F[:,1],F[:,2]]);j=np.concatenate([F[:,1],F[:,2],F[:,0]]);k=np.concatenate([F[:,2],F[:,0],F[:,1]])
    rows=np.r_[i,i];cols=np.r_[j,k];mask=lookup[rows]>=0;rows=rows[mask];cols=cols[mask];ri=lookup[rows]
    def weights(P):
        x=P[j,:2]-P[i,:2];y=P[k,:2]-P[i,:2];lx=np.linalg.norm(x,axis=1);ly=np.linalg.norm(y,axis=1);cross=np.abs(x[:,0]*y[:,1]-x[:,1]*y[:,0]);dot=np.sum(x*y,axis=1)
        tan=np.where(dot>=0,cross/(lx*ly+dot+1e-300),(lx*ly-dot)/np.maximum(cross,1e-300));w=np.r_[tan/lx,tan/ly][mask];s=np.bincount(ri,w,minlength=len(inside));return w/s[ri]
    wa=weights(A);wb=weights(B);assert min(wa.min(),wb.min())>0;repro=[]
    for P,w in [(A,wa),(B,wb)]:
        x=np.stack([np.bincount(ri,w*P[cols,d],minlength=len(inside)) for d in range(2)],1);repro.append(float(np.max(abs(x-P[inside,:2]))))
    assert max(repro)<1e-10
    inmask=lookup[cols]>=0;bm=~inmask;poses=[]
    for step in range(N):
        t=step/(N-1);P=(1-t)*A+t*B;w=(1-t)*wa+t*wb
        L=coo_matrix((np.r_[np.ones(len(inside)),-w[inmask]],(np.r_[np.arange(len(inside)),ri[inmask]],np.r_[np.arange(len(inside)),lookup[cols[inmask]]])),shape=(len(inside),len(inside))).tocsc()
        rhs=np.stack([np.bincount(ri[bm],w[bm]*P[cols[bm],d],minlength=len(inside)) for d in range(2)],1);P[inside,:2]=spsolve(L,rhs)
        if step==0:P=a.copy()
        if step==N-1:P=b.copy()
        poses.append(P.astype(np.float32))
    return np.array(poses),{'affineReproductionMax':repro,'minimumNormalizedWeight':float(min(wa.min(),wb.min()))}
def height(q,poses,tension):
    A=q['compact'];B=q['target'];F=q['faces'];a=q['idealCompact'];b=q['idealTarget'];na=normals(a,F);nb=normals(b,F);ga=-na[:,:2]/na[:,2,None];gb=-nb[:,:2]/nb[:,2,None]
    ue,be,loop=boundary(F);curve=PchipInterpolator([0,.02,.08,.12,.20,.35,.55,.70,.80,.90,.96,1],[1,1,.44,.42,.42,.28,.22,.23,.30,.60,1,1]);prev=None;ss=[];pp=[];last=None;pv=None;velprev=None;dt=1/(len(poses)-1)
    baseedge=np.linalg.norm(A[ue[:,1]]-A[ue[:,0]],axis=1);basearea=np.linalg.norm(normals(A,F),axis=1)/2
    ef={}
    for i,f in enumerate(F):
        for x,y in zip(f,np.roll(f,-1)):ef.setdefault(tuple(sorted((int(x),int(y)))),[]).append(i)
    af=np.array([v for v in ef.values() if len(v)==2])
    for k,p0 in enumerate(poses):
        t=k*dt;p=p0.astype(float);z=p[:,2].mean();factor=float(curve(t)) if tension else 1.;p[:,2]=z+factor*(p[:,2]-z);p=p.astype(np.float32).astype(float)
        r,prev=measure(p,F,A,B,t,prev);nr=normals(p,F);poly=Polygon(p[loop,:2]);g=(1-t)*ga+t*gb
        r.update(heightFactor=factor,projectedNonpositive=int(np.sum(nr[:,2]>=0)),boundarySimple=bool(poly.is_valid and poly.exterior.is_simple),projectionAreaError=abs(poly.area+nr[:,2].sum()/2),heightGradientOpposed=int(np.sum(np.sum(nr*np.c_[g,-np.ones(len(g))],axis=1)<=0)))
        unit=nr/np.linalg.norm(nr,axis=1)[:,None];r['maxTemporalAngleDeg']=0 if last is None else float(np.degrees(np.arccos(np.clip(np.sum(unit*last,axis=1),-1,1))).max());last=unit
        r['projectedInjectivityPass']=bool(r['boundarySimple'] and not r['projectedNonpositive'] and r['projectionAreaError']<1e-8)
        er=np.linalg.norm(p[ue[:,1]]-p[ue[:,0]],axis=1)/baseedge;ar=np.linalg.norm(nr,axis=1)/2/basearea
        r['edgeStretchPercentiles']=np.percentile(er,[0,5,50,95,100]).tolist();r['areaRatioPercentiles']=np.percentile(ar,[0,5,50,95,100]).tolist();r['boundaryLength']=float(np.linalg.norm(p[be[:,1]]-p[be[:,0]],axis=1).sum());r['minBoundaryEdge']=float(np.linalg.norm(p[be[:,1]]-p[be[:,0]],axis=1).min());r['dihedralPercentilesDeg']=np.percentile(np.degrees(np.arccos(np.clip(np.sum(unit[af[:,0]]*unit[af[:,1]],axis=1),-1,1))),[50,95,100]).tolist()
        if pv is not None:
            vel=(p-pv)/dt;r['velocityP95']=float(np.percentile(np.linalg.norm(vel,axis=1),95));r['accelerationP95']=None if velprev is None else float(np.percentile(np.linalg.norm((vel-velprev)/dt,axis=1),95));velprev=vel
        pv=p.copy();ss.append(r);pp.append(p.astype(np.float32))
    keys=['opposed','degenerate','temporal','projectedNonpositive','heightGradientOpposed'];r=summarize(ss,keys);r['passes']=sum(not any(x[k] for k in keys) and x['projectedInjectivityPass'] for x in ss);r['injectiveFrames']=sum(x['projectedInjectivityPass'] for x in ss);r['endpointMaxError']=max(float(np.max(abs(pp[0]-A))),float(np.max(abs(pp[-1]-B))));r['maxTemporalAngleDeg']=max(x['maxTemporalAngleDeg'] for x in ss)
    return r,np.array(pp)
if __name__=='__main__':
    q=np.load(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);assert len(q['chart'])==12573 and len(q['faces'])==24687
    res={'polar':{name:polar(q,s,w) for name,s,w in [('linear',None,None),('polar_log_balanced','log','balanced'),('polar_linear_balanced','linear','balanced'),('polar_log_face','log','face'),('polar_linear_face','linear','face'),('polar_log_uniform','log','uniform')]}}
    for n in (81,161):
        h,d=harmonic(q,n);raw,_=height(q,h,False);r,p=height(q,h,True);res[str(n)]={'harmonic':raw,'tension':r,'weights':d};np.savez_compressed(out/f'tension-{n}.npz',poses=p,faces=q['faces'],uv=q['chart'])
    (out/'trajectory-comparison.json').write_text(json.dumps(res,indent=2));assert all(res[str(n)]['tension']['passes']==n and res[str(n)]['tension']['endpointMaxError']==0 for n in (81,161))
