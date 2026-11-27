"""Actual paired native upper/lower projected overlap; cut-boundary walls
are constructed. Static endpoint only, original qualified mesh unchanged."""
import numpy as np,json,sys,collections
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union,polygonize
from shapely.strtree import STRtree
from functools import lru_cache
def area3(T):return np.linalg.norm(np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]),axis=1)/2
def det(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def lift(x,t):
    a,b,c=t;u=det(a[:2],x,c[:2])/det(*t[:,:2]);v=det(a[:2],b[:2],x)/det(*t[:,:2]);return np.array([x[0],x[1],(1-u-v)*a[2]+u*b[2]+v*c[2]]),max(0,-u,-v,u+v-1)
def run(base,atlas,out):
    q=np.load(base);z=np.load(atlas/'native-atlas.npz');r=json.loads((atlas/'native-atlas.json').read_text());lowerIDs=np.array(next(x['nativeTriangleIDs'] for x in r['regions'] if x['name']=='block_2_interior_negative_skin'));A=q['targetRef'];B=z['vertices'][z['faces'][lowerIDs]]
    pa=[Polygon(t[:,:2]) for t in A];pb=[Polygon(t[:,:2]) for t in B];U=unary_union(pa);L=unary_union(pb);D=U.intersection(L);assert D.geom_type=='Polygon' and D.is_valid
    lines=[]
    for T in (A,B):
        e={tuple(sorted((tuple(t[i,:2]),tuple(t[(i+1)%3,:2])))) for t in T for i in range(3)};lines.extend(LineString(x) for x in e)
    cells=list(polygonize(unary_union(lines)));trees=[STRtree(pa),STRtree(pb)];vertices=[];top=[];bottom=[];faces=[];oa=[];ob=[];index={};maxMismatch=0.;maxBary=0.;covered=0.;badCells=[]
    def put(x,i,j):
        nonlocal maxMismatch,maxBary
        x=tuple(x);a,ea=lift(x,A[i]);b,eb=lift(x,B[j]);maxBary=max(maxBary,ea,eb)
        if x in index:
            k=index[x];maxMismatch=max(maxMismatch,float(np.linalg.norm(top[k]-a)),float(np.linalg.norm(bottom[k]-b)));return k
        k=len(vertices);index[x]=k;vertices.append(x);top.append(a);bottom.append(b);return k
    for cell in cells:
        p=cell.representative_point()
        if not D.covers(p):continue
        assert not cell.interiors;covered+=cell.area;ij=[tr.query(p,predicate='intersects') for tr in trees]
        if any(not len(x) for x in ij):badCells.append({'area':cell.area,'reason':'no reference owner'});continue
        i,j=int(ij[0][0]),int(ij[1][0]);loop=list(cell.exterior.coords)[:-1];ids=[put(x,i,j) for x in loop]
        if not cell.exterior.is_ccw:ids=ids[::-1]
        @lru_cache(None)
        def best(a,b):
            if b-a<2:return (0,float('inf'),())
            cand=[]
            for k in range(a+1,b):
                t=[ids[a],ids[k],ids[b]]
                if det(*[vertices[v] for v in t])<=0:continue
                x=best(a,k);y=best(k,b)
                if x is None or y is None:continue
                vals=[];bad=0
                for pts in (top,bottom):
                    p=np.array([pts[v] for v in t]);z=p.astype(np.float32).astype(float);a1=area3(p[None])[0];a2=area3(z[None])[0];bad+=int(min(a1,a2)<1e-10);vals.append(min(a1,a2))
                cand.append((x[0]+y[0]-bad,min(x[1],y[1],*vals),x[2]+y[2]+(t,)))
            return max(cand,key=lambda x:x[:2]) if cand else None
        choice=best(0,len(ids)-1)
        if not choice:badCells.append({'area':cell.area,'reason':'no positive triangulation'});continue
        faces.extend(choice[2]);oa.extend([i]*len(choice[2]));ob.extend([j]*len(choice[2]))
    T=np.array(top);Btm=np.array(bottom);F=np.array(faces);oa=np.array(oa);ob=np.array(ob);xy=np.array(vertices);used=np.unique(F);idx=np.full(len(T),-1,int);idx[used]=np.arange(len(used));T=T[used];Btm=Btm[used];xy=xy[used];F=idx[F]
    edge=collections.defaultdict(list)
    for f in F:
        for a,b in zip(f,np.roll(f,-1)):edge[tuple(sorted((int(a),int(b))))].append((int(a),int(b)))
    be=[v[0] for v in edge.values() if len(v)==1];deg=collections.Counter(v for e in be for v in e);orientationDefects=sum(len(v)==2 and v[0]!=v[1][::-1] for v in edge.values());unintended=sum(D.boundary.distance(LineString([xy[a],xy[b]]))>1e-8 or D.boundary.distance(Point((xy[a]+xy[b])/2))>1e-8 for a,b in be)
    adj=collections.defaultdict(set)
    for a,b in edge:adj[a].add(b);adj[b].add(a)
    unseen=set(range(len(T)));components=0
    while unseen:
        components+=1;todo=[unseen.pop()]
        while todo:
            for v in adj[todo.pop()]:
                if v in unseen:unseen.remove(v);todo.append(v)
    expectedA=np.array([p.intersection(D).area for p in pa]);expectedB=np.array([p.intersection(D).area for p in pb]);faceArea=np.array([det(*t)/2 for t in xy[F]]);areaA=np.bincount(oa,weights=faceArea,minlength=len(A));areaB=np.bincount(ob,weights=faceArea,minlength=len(B));N=len(T);wall=np.array([(b,a,a+N) for a,b in be]+[(b,a+N,b+N) for a,b in be]);SF=np.concatenate([F,F[:,::-1]+N,wall]);X=np.concatenate([T,Btm]);Y=X.astype(np.float32).astype(float);ideal=area3(X[SF]);stored=area3(Y[SF]);gap=Y[:N,2]-Y[N:,2];dot=np.sum(np.cross(X[SF[:,1]]-X[SF[:,0]],X[SF[:,2]]-X[SF[:,0]])*np.cross(Y[SF[:,1]]-Y[SF[:,0]],Y[SF[:,2]]-Y[SF[:,0]]),axis=1)
    r={'upperProjectedArea':U.area,'lowerProjectedArea':L.area,'pairedDomainArea':D.area,'pairedDomainCoverageRatio':D.area/U.area,'coveredCellArea':covered,'badCells':badCells,'verticesPerSkin':N,'trianglesPerSkin':len(F),'shellTriangles':len(SF),'componentsPerSkin':components,'boundaryEdges':len(be),'boundaryDegreeDefects':sum(v!=2 for v in deg.values()),'nonmanifoldEdges':sum(len(v)>2 for v in edge.values()),'orientationEdgeDefects':orientationDefects,'unintendedBoundaryEdges':unintended,'eulerPerSkin':N-len(edge)+len(F),'nativeUpperParentCount':len(np.unique(q['targetChildNativeID'][oa])),'nativeLowerParentCount':len(np.unique(lowerIDs[ob])),'maxBarycentricViolation':float(maxBary),'sharedVertexMismatch':maxMismatch,'maxUpperProjectedFaceCoverageError':float(np.max(abs(areaA-expectedA))),'maxLowerProjectedFaceCoverageError':float(np.max(abs(areaB-expectedB))),'upperTotalCoverageError':float(abs(areaA.sum()-D.area)),'lowerTotalCoverageError':float(abs(areaB.sum()-D.area)),'verticalGapMin':float(gap.min()),'verticalGapMax':float(gap.max()),'belowFloorIdeal':int((ideal<1e-10).sum()),'belowFloorStored':int((stored<1e-10).sum()),'opposedOrCollapsedStoredNormals':int((dot<=0).sum()),'minStoredArea':float(stored.min()),'maxFloat32CoordinateError':float(np.max(abs(Y-X))),'limitations':['Actual clipped native upper/lower reference surfaces; cut-boundary sidewalls not native.','New projected overlay; original qualified correspondence unchanged.','Static endpoint only, no complete motion or topology change.']}
    r['numericalEndpointPass']=bool(not badCells and components==1 and not any(r[k] for k in ('boundaryDegreeDefects','nonmanifoldEdges','orientationEdgeDefects','unintendedBoundaryEdges','belowFloorIdeal','belowFloorStored','opposedOrCollapsedStoredNormals')) and r['eulerPerSkin']==1 and max(r['maxUpperProjectedFaceCoverageError'],r['maxLowerProjectedFaceCoverageError'])<1e-9 and maxBary<1e-7 and maxMismatch<2e-5 and gap.min()>0)
    out.mkdir(parents=True,exist_ok=True);(out/'native-pair-report.json').write_text(json.dumps(r,indent=2));np.savez_compressed(out/'native-pair.npz',vertices=Y.astype(np.float32),ideal=X,faces=SF,xy=xy,skinFaces=F,boundary=np.array(be),upperNativeParentIDs=q['targetChildNativeID'][oa],lowerNativeParentIDs=lowerIDs[ob],upperRefOwner=oa,lowerRefOwner=ob,affectedFaces=np.flatnonzero((stored<1e-10)|(dot<=0)))
    return r
if __name__=='__main__':print(run(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3])))
