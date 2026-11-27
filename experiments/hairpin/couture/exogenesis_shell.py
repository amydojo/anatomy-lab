"""Connected closed derivative shell from exact METALLURGY upper strip.
Lower skin and walls are constructed, not exact native VECTOR correspondence."""
import numpy as np,json,sys,collections
from pathlib import Path
from shapely.geometry import Polygon
def normals(P,F):
    t=P[F];return np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
def build(P,F,U):
    n=len(P[0]);top=F[:,::-1];bottom=F+n;directed=collections.defaultdict(list)
    for i,f in enumerate(top):
        for a,b in zip(f,np.roll(f,-1)):directed[tuple(sorted((int(a),int(b))))].append((int(a),int(b)))
    be=[v[0] for v in directed.values() if len(v)==1];nxt=dict(be);loop=[min(nxt)]
    while nxt[loop[-1]]!=loop[0]:loop.append(nxt[loop[-1]])
    assert len(loop)==len(be)==457
    walls=np.array([(b,a,a+n) for a,b in be]+[(b,a+n,b+n) for a,b in be]);SF=np.concatenate([top,bottom,walls]);edges=collections.defaultdict(list)
    for i,f in enumerate(SF):
        for a,b in zip(f,np.roll(f,-1)):edges[tuple(sorted((int(a),int(b))))].append((i,int(a),int(b)))
    assert all(len(e)==2 and e[0][1:]==e[1][1:][::-1] for e in edges.values())
    UV=np.concatenate([U,U]);rows=[];poses=[];prev=None
    def endpoint(upper,th):
        lo=upper.copy();lo[:,2]=(upper[:,2].astype(float)-th).astype(np.float32);return np.concatenate([upper,lo]).astype(float)
    na=normals(endpoint(P[0],.10),SF);nb=normals(endpoint(P[-1],.28),SF)
    for i,upper in enumerate(P):
        t=i/(len(P)-1);s=t*t*(3-2*t);th=.10+.18*s
        lo=upper.copy();lo[:,2]=(upper[:,2].astype(float)-th).astype(np.float32);X=np.concatenate([upper,lo]).astype(np.float32);Y=X.astype(float);N=normals(Y,SF);area=np.linalg.norm(N,axis=1)/2
        sep=Y[:n,2]-Y[n:,2];poly=Polygon(Y[loop,:2]);projected=N[:len(F),2];projected_sum=projected.sum()/2
        Q=Y-Y.mean(0);tri=Q[SF];volume=float(np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6)
        expected=float(np.sum(projected/2*sep[top].mean(1)));wallsN=N[2*len(F):];wallE=np.array([Y[b]-Y[a] for a,b in be]);wallRef=np.cross(wallE,np.array([0.,0.,1.]));dots=np.sum(wallsN*np.concatenate([wallRef,wallRef]),axis=1)
        temp=0 if prev is None else int(np.sum(np.sum(N*prev,axis=1)<0));prev=N
        r={'frame':i,'minArea':float(area.min()),'belowFloor':int(np.sum(area<1e-10)),'topBelowFloor':int(np.sum(area[:len(F)]<1e-10)),'bottomBelowFloor':int(np.sum(area[len(F):2*len(F)]<1e-10)),'wallBelowFloor':int(np.sum(area[2*len(F):]<1e-10)),'temporalNormalReversals':temp,'projectedNonpositive':int(np.sum(projected<=0)+np.sum(N[len(F):2*len(F),2]>=0)),'wallOpposed':int(np.sum(dots<=0)),'verticalSeparationMin':float(sep.min()),'verticalSeparationMax':float(sep.max()),'projectedBoundarySimple':bool(poly.is_valid and poly.exterior.is_simple),'projectedAreaError':float(abs(poly.area-projected_sum)),'signedVolume':volume,'expectedVerticalIntegralVolume':expected,'volumeError':abs(volume-expected),'surfaceArea':float(area.sum())}
        r['samplePass']=bool(not any(r[k] for k in ['belowFloor','temporalNormalReversals','projectedNonpositive','wallOpposed']) and r['verticalSeparationMin']>0 and r['projectedBoundarySimple'] and r['projectedAreaError']<1e-8 and volume>0 and r['volumeError']<1e-8)
        f=np.clip((t-.12)/.79,0,1);f=f*f*(3-2*f);op=np.sum(N*((1-f)*na+f*nb),axis=1)<=0
        r['opposedHistoricalNormals']=int(op.sum());r['samplePass']=bool(r['samplePass'] and not r['opposedHistoricalNormals']);rows.append(r);poses.append(X)
    report={'scope':'Closed derivative shell, actual upper endpoint only, lower offset and walls are research geometry','vertices':2*n,'triangles':len(SF),'edges':len(edges),'connectedComponents':1,'boundaryEdges':0,'nonmanifoldEdges':0,'euler':2*n-len(edges)+len(SF),'topFaces':len(F),'bottomFaces':len(F),'sidewallFaces':len(walls),'sampleCount':len(rows),'passes':sum(r['samplePass'] for r in rows),'minArea':min(r['minArea'] for r in rows),'peakBelowFloor':max(r['belowFloor'] for r in rows),'peakTemporalReversals':max(r['temporalNormalReversals'] for r in rows),'peakWallOpposed':max(r['wallOpposed'] for r in rows),'peakOpposedHistoricalNormals':max(r['opposedHistoricalNormals'] for r in rows),'verticalSeparationRange':[min(r['verticalSeparationMin'] for r in rows),max(r['verticalSeparationMax'] for r in rows)],'samples':rows,'limitations':['No lower-native parity claim; vertical offset is a derivative.','Vertical gap is not minimum Euclidean distance.','Graph+positive gap+simple boundary certify sampled embedding geometrically, not arbitrary temporal interpolation or actual BVH.','No new aperture, physical fit or full wearable claim.']}
    return np.array(poses),SF,UV,np.array(be),report
if __name__=='__main__':
    q=np.load(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);P,F,U,be,r=build(q['poses'],q['faces'],q['uv']);(out/'shell-report.json').write_text(json.dumps(r,indent=2));np.savez_compressed(out/'shell-poses.npz',poses=P,faces=F,uv=U,boundary=be);print({k:v for k,v in r.items() if k!='samples'})
