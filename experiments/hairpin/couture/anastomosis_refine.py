"""Common paired refinement preserving every original common chart triangle.
No geometry discarded to pass the area floor. Reports failed candidate."""
import numpy as np,json,collections,sys
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union,polygonize
from shapely.strtree import STRtree
from functools import lru_cache
def det(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def bary(x,t):
    a,b,c=t;d=det(a,b,c);u=det(a,x,c)/d;v=det(a,b,x)/d;return np.array([1-u-v,u,v])
def normal(P,F):
    T=P[F];return np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0])
def run(base,bridge,atlas,out):
    q=dict(np.load(base));b=dict(np.load(bridge));z=dict(np.load(atlas/'native-atlas.npz'));r=json.loads((atlas/'native-atlas.json').read_text());F=q['faces'];UV=q['idealTarget'][F][:,:,:2];lower=np.array(next(x['nativeTriangleIDs'] for x in r['regions'] if x['name']=='block_2_interior_negative_skin'));B=z['vertices'][z['faces'][lower]];L=B[:,:,:2]
    pa=[Polygon(t) for t in UV];pb=[Polygon(t) for t in L];D=unary_union(pb).intersection(unary_union(pa));trees=[STRtree(pa),STRtree(pb)]
    lines=[]
    for T in (UV,L):
        es={tuple(sorted((tuple(t[i]),tuple(t[(i+1)%3])))) for t in T for i in range(3)};lines.extend(LineString(e) for e in es)
    cells=polygonize(unary_union(lines));xy=[];weights=[];own=[];positions=[];index={};faces=[];oa=[];ob=[];bad=[];maxb=0.;mismatch=0.
    def put(x,i,j):
        nonlocal maxb,mismatch
        x=tuple(x);w=bary(x,UV[i]);v=bary(x,L[j]);maxb=max(maxb,float(max(-w.min(),w.max()-1,-v.min(),v.max()-1,0)));pos=np.array([w@q['idealCompact'][F[i]],w@b['idealFrozen'][F[i]],w@q['idealTarget'][F[i]],v@B[j]])
        if x in index:
            k=index[x];mismatch=max(mismatch,float(np.linalg.norm(positions[k]-pos,axis=1).max()));return k
        k=len(xy);index[x]=k;xy.append(x);weights.append(w);own.append(i);positions.append(pos);return k
    for cell in cells:
        pt=cell.representative_point()
        if not D.covers(pt):continue
        ij=[tree.query(pt,predicate='intersects') for tree in trees]
        if cell.interiors or any(not len(x) for x in ij):bad.append(float(cell.area));continue
        i,j=int(ij[0][0]),int(ij[1][0]);ids=[put(x,i,j) for x in list(cell.exterior.coords)[:-1]]
        if not cell.exterior.is_ccw:ids=ids[::-1]
        @lru_cache(None)
        def best(a,c):
            if c-a<2:return (0,float('inf'),())
            opts=[]
            for k in range(a+1,c):
                t=[ids[a],ids[k],ids[c]]
                if det(*[xy[x] for x in t])<=0:continue
                l=best(a,k);rr=best(k,c)
                if l is None or rr is None:continue
                P=np.array([positions[x] for x in t]).transpose(1,0,2);P=np.concatenate([P,P.astype(np.float32).astype(float)]);ar=np.linalg.norm(np.cross(P[:,1]-P[:,0],P[:,2]-P[:,0]),axis=1)/2;opts.append((l[0]+rr[0]-int((ar<1e-10).sum()),min(l[1],rr[1],float(ar.min())),l[2]+rr[2]+(t,)))
            return max(opts,key=lambda x:x[:2]) if opts else None
        result=best(0,len(ids)-1)
        if not result:bad.append(float(cell.area));continue
        faces.extend(result[2]);oa.extend([i]*len(result[2]));ob.extend([j]*len(result[2]))
    f=np.array(faces);used=np.unique(f);idx=np.full(len(xy),-1,int);idx[used]=np.arange(len(used));f=idx[f];xy=np.array(xy)[used];w=np.array(weights)[used];o=np.array(own)[used];oa=np.array(oa);ob=np.array(ob);ids=F[o];chart=np.einsum('ij,ijk->ik',w,q['chart'][ids]);A0,B0,T,lp=np.array(positions)[used].transpose(1,0,2);n=len(xy)
    E=collections.defaultdict(list)
    for i,tr in enumerate(f):
        for x,y in zip(tr,np.roll(tr,-1)):E[tuple(sorted((int(x),int(y))))].append((i,int(x),int(y)))
    be=[x[0][1:] for x in E.values() if len(x)==1];deg=collections.Counter(x for e in be for x in e);unintended=sum(D.boundary.distance(Point((xy[x]+xy[y])/2))>1e-8 for x,y in be);ar=np.array([det(*t)/2 for t in xy[f]]);exA=np.array([a.intersection(D).area for a in pa]);exB=np.array([a.intersection(D).area for a in pb]);coverA=np.bincount(oa,weights=ar,minlength=len(pa));coverB=np.bincount(ob,weights=ar,minlength=len(pb));reports={}
    for name,P in [('compact',A0),('frozen',B0),('upper',T),('lower',lp)]:
        ni=normal(P,f);ns=normal(P.astype(np.float32).astype(float),f);area=np.linalg.norm(ns,axis=1)/2;badid=np.flatnonzero((area<1e-10)|(np.sum(ni*ns,axis=1)<=0));reports[name]={'belowFloorIdeal':int((np.linalg.norm(ni,axis=1)/2<1e-10).sum()),'belowFloorStored':int((area<1e-10).sum()),'opposedOrCollapsed':int((np.sum(ni*ns,axis=1)<=0).sum()),'minStoredArea':float(area.min()),'affectedFaceIDs':badid.tolist()}
    tri=xy[f];samples=np.stack([tri.mean(1),(tri[:,0]+tri[:,1])/2,(tri[:,1]+tri[:,2])/2,(tri[:,2]+tri[:,0])/2],1);W=np.array([[bary(x,UV[i]) for x in t] for i,t in zip(oa,samples)]);ref=np.einsum('fsk,fkd->fsd',W,q['idealCompact'][F[oa]]);act=A0[f].astype(np.float32).astype(float);wit=np.stack([act.mean(1),(act[:,0]+act[:,1])/2,(act[:,1]+act[:,2])/2,(act[:,2]+act[:,0])/2],1);err=np.linalg.norm(ref-wit,axis=2)
    adj=collections.defaultdict(set)
    for x,y in E:adj[x].add(y);adj[y].add(x)
    unseen=set(range(n));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for x in adj[todo.pop()]:
                if x in unseen:unseen.remove(x);todo.append(x)
    report={'vertices':n,'triangles':len(f),'components':cc,'euler':n-len(E)+len(f),'boundaryEdges':len(be),'boundaryDegreeDefects':sum(v!=2 for v in deg.values()),'unintendedBoundaryEdges':int(unintended),'nonmanifoldEdges':sum(len(x)>2 for x in E.values()),'badCells':bad,'sharedDomainArea':D.area,'coverageArea':float(ar.sum()),'maxCommonFaceCoverageError':float(abs(coverA-exA).max()),'maxLowerFaceCoverageError':float(abs(coverB-exB).max()),'maxBarycentricViolation':maxb,'sharedVertexMismatch':mismatch,'compactWitnessChecks':err.size,'compactWitnessMax':float(err.max()),'endpoints':reports,'nativeUpperParents':len(np.unique(q['targetChildNativeID'][q['targetFaceOwner'][oa]])),'nativeLowerParents':len(np.unique(lower[ob]))}
    report['regularEndpointPass']=bool(not bad and cc==1 and not any(report[k] for k in ['boundaryDegreeDefects','unintendedBoundaryEdges','nonmanifoldEdges']) and max(report['maxCommonFaceCoverageError'],report['maxLowerFaceCoverageError'])<1e-9 and maxb<1e-7 and err.max()<2e-5 and all(not any(v[k] for k in ['belowFloorIdeal','belowFloorStored','opposedOrCollapsed']) for v in reports.values()))
    out.mkdir(parents=True,exist_ok=True);(out/'refinement.json').write_text(json.dumps(report,indent=2));np.savez_compressed(out/'refinement.npz',xy=xy,faces=f,weights=w,vertexCommonFace=o,faceCommonOwner=oa,faceLowerOwner=ob,upperNativeParent=q['targetChildNativeID'][q['targetFaceOwner'][oa]],lowerNativeParent=lower[ob],chart=chart,compact=A0,frozen=B0,target=T,lower=lp,boundary=np.array(be));return report
if __name__=='__main__':run(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]),Path(sys.argv[4]))
