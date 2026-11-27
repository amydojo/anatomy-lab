"""Stage C persistent aperture derivative. Explicit authored opening;
no runtime deletion, no topology birth or frozen B alteration."""
import numpy as np,json,sys,collections
from pathlib import Path
from shapely.geometry import Polygon
from exogenesis_shell import normals
SELECT=[501,512,513,521,522,530,531,539,540,548,549,560,561,569,570,578,579,587,588,596,597,608,609,617]
def build_aperture(P,F,U,owners):
    hole=np.isin(owners,SELECT);retained=np.flatnonzero(~hole);removed=np.flatnonzero(hole);assert len(removed)==921
    used=np.unique(F[retained]);idx=np.full(len(U),-1,int);idx[used]=np.arange(len(used));f=idx[F[retained]];top=f[:,::-1];n=len(used);nf=len(f)
    ed=collections.defaultdict(list)
    for tr in top:
        for a,b in zip(tr,np.roll(tr,-1)):ed[tuple(sorted((int(a),int(b))))].append((int(a),int(b)))
    be=np.array([x[0] for x in ed.values() if len(x)==1]);nxt=dict(be);assert len(nxt)==len(be) and len(set(nxt.values()))==len(be)
    loops=[];unseen=set(nxt)
    while unseen:
        loop=[min(unseen)];unseen.remove(loop[0])
        while nxt[loop[-1]]!=loop[0]:
            x=nxt[loop[-1]];assert x in unseen;loop.append(x);unseen.remove(x)
        loops.append(np.array(loop))
    assert len(loops)==2 and n-len(ed)+nf==0 and max(map(len,ed.values()))==2
    loops.sort(key=lambda loop:abs(Polygon(P[0,used[loop],:2]).area),reverse=True);outer,inner=loops;assert len(outer)==457
    wall=np.array([(b,a,a+n) for a,b in be]+[(b,a+n,b+n) for a,b in be]);SF=np.concatenate([top,f+n,wall]);E=collections.defaultdict(list)
    for tr in SF:
        for a,b in zip(tr,np.roll(tr,-1)):E[tuple(sorted((int(a),int(b))))].append((int(a),int(b)))
    assert all(len(x)==2 and x[0]==x[1][::-1] for x in E.values()) and 2*n-len(E)+len(SF)==0
    adj=collections.defaultdict(set)
    for a,b in E:adj[a].add(b);adj[b].add(a)
    unseen=set(range(2*n));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for x in adj[todo.pop()]:
                if x in unseen:unseen.remove(x);todo.append(x)
    assert cc==1
    def shell(up,h):
        lo=up.copy();lo[:,2]=(up[:,2].astype(float)-h).astype(np.float32);return np.concatenate([up,lo]).astype(np.float32)
    na=normals(shell(P[0,used],.10).astype(float),SF);nb=normals(shell(P[-1,used],.28).astype(float),SF)
    rows=[];poses=[];prev=None;UV=np.concatenate([U[used],U[used]])
    for i,up in enumerate(P[:,used]):
        t=i/(len(P)-1);s=t*t*(3-2*t);X=shell(up,.10+.18*s);Y=X.astype(float);N=normals(Y,SF);ar=np.linalg.norm(N,axis=1)/2;sep=Y[:n,2]-Y[n:,2];poly=Polygon(Y[outer,:2],[Y[inner,:2]]);ap=Polygon(Y[inner,:2]);p=N[:nf,2];centered=Y-Y.mean(0);vol=float(np.einsum('ij,ij->i',centered[SF[:,0]],np.cross(centered[SF[:,1]],centered[SF[:,2]])).sum()/6);expected=float(np.sum(p/2*sep[top].mean(1)));edge=Y[be[:,1]]-Y[be[:,0]];ref=np.cross(edge,np.array([0.,0.,1.]));w=N[2*nf:];wallop=int(np.sum(np.sum(w*np.concatenate([ref,ref]),axis=1)<=0));f0=np.clip((t-.12)/.79,0,1);f0=f0*f0*(3-2*f0);op=int(np.sum(np.sum(N*((1-f0)*na+f0*nb),axis=1)<=0));temp=0 if prev is None else int(np.sum(np.sum(N*prev,axis=1)<0));prev=N
        r={'frame':i,'minArea':float(ar.min()),'belowFloor':int(np.sum(ar<1e-10)),'opposedHistoricalNormals':op,'temporalNormalReversals':temp,'wallOpposed':wallop,'projectedNonpositive':int(np.sum(p<=0)+np.sum(N[nf:2*nf,2]>=0)),'verticalSeparationMin':float(sep.min()),'verticalSeparationMax':float(sep.max()),'boundaryValid':bool(poly.is_valid and ap.is_valid),'projectedAreaError':float(abs(poly.area-p.sum()/2)),'apertureProjectedArea':float(ap.area),'apertureBoundaryLength':float(ap.length),'apertureXYExtents':np.ptp(Y[inner,:2],axis=0).tolist(),'signedVolume':vol,'volumeError':abs(vol-expected)}
        r['samplePass']=bool(not any(r[k] for k in ('belowFloor','opposedHistoricalNormals','temporalNormalReversals','wallOpposed','projectedNonpositive')) and r['verticalSeparationMin']>0 and r['boundaryValid'] and r['apertureProjectedArea']>0 and r['projectedAreaError']<1e-8 and vol>0 and r['volumeError']<1e-8);rows.append(r);poses.append(X)
    report={'scope':'Persistent aperture derivative; explicit 24 source reference-face patch excluded before animation, never removed during it. Not frozen B topology or complete native parity.','selectedCompactReferenceFaceIDs':SELECT,'removedOriginalCommonFaceIDs':removed.tolist(),'retainedOriginalCommonFaceIDs':retained.tolist(),'originalVertexIDs':used.tolist(),'vertices':2*n,'triangles':len(SF),'edges':len(E),'connectedComponents':cc,'boundaryEdges':0,'nonmanifoldEdges':0,'euler':0,'genus':1,'topFaces':nf,'bottomFaces':nf,'sidewallFaces':len(wall),'outerBoundaryEdges':len(outer),'innerBoundaryEdges':len(inner),'sampleCount':len(rows),'passes':sum(x['samplePass'] for x in rows),'minArea':min(x['minArea'] for x in rows),'apertureAreaRange':[min(x['apertureProjectedArea'] for x in rows),max(x['apertureProjectedArea'] for x in rows)],'samples':rows}
    return np.array(poses),SF,UV,be,report,f,used,retained,loops
if __name__=='__main__':
    q=np.load(sys.argv[1]);p=np.load(sys.argv[2]);out=Path(sys.argv[3]);out.mkdir(parents=True,exist_ok=True);P,F,U,be,r,f,used,retained,loops=build_aperture(p['poses'],q['faces'],q['chart'],q['compactFaceOwner']);(out/'aperture-report.json').write_text(json.dumps(r,indent=2));np.savez_compressed(out/'aperture-poses.npz',poses=P,faces=F,uv=U,boundary=be,skinFaces=f,originalVertexIDs=used,retainedFaceIDs=retained,outerLoop=loops[0],innerLoop=loops[1]);print({k:v for k,v in r.items() if k not in ('samples','removedOriginalCommonFaceIDs','retainedOriginalCommonFaceIDs','originalVertexIDs')})
