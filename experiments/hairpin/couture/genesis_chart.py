"""GENESIS local diagonal chart conditioning. Three native edge midpoints;
chart displacement only. All physical reference triangles preserved."""
import numpy as np,collections
from functools import lru_cache
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union,polygonize
from shapely.strtree import STRtree
from genesis_condition import edges
from morphogenesis_measure import bary
def det(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def area(T):return np.linalg.norm(np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]),axis=1)/2
def trial(q,baseline):
    A=q['sourceUV'];AP=q['compactRemapped'];B=q['targetUV'];BP=q['targetRegion']
    X,ix=np.unique(B.reshape(-1,2),axis=0,return_inverse=True);faces=ix.reshape(-1,3).tolist();verts=X.tolist();parents=list(range(len(B)));xyz=np.zeros((len(X),3));xyz[ix]=BP.reshape(-1,3);xyz=xyz.tolist()
    # Shared reference vertices must have identical native positions.
    assert np.max(np.abs(np.array(xyz)[ix]-BP.reshape(-1,3)))<2e-5
    moves=[]
    def split(a,b,parent,frac=.25):
        hits=[i for i,f in enumerate(faces) if a in f and b in f];assert len(hits)==2
        ear=next(i for i in hits if parents[i]==parent);other=next(i for i in hits if i!=ear);opp=next(j for j in faces[other] if j not in (a,b))
        mid=(np.array(verts[a])+np.array(verts[b]))/2;uv=(1-frac)*mid+frac*np.array(verts[opp]);i=len(verts)
        verts.append(uv.tolist());xyz.append(((np.array(xyz[a])+np.array(xyz[b]))/2).tolist());new=[]
        moves.append({'edge': [a,b], 'nativeParents':[parents[j] for j in hits],'originalChartMidpoint':mid.tolist(),'conditionedChartMidpoint':uv.tolist(),'nativeMidpoint':xyz[-1],'fraction':frac})
        for j in hits:
            f=faces[j];k=next(k for k in range(3) if {f[k],f[(k+1)%3]}=={a,b});aa,bb,cc=f[k],f[(k+1)%3],f[(k+2)%3];ff=[[aa,i,cc],[i,bb,cc]]
            assert all(det(*[verts[v] for v in t])>1e-14 for t in ff)
            new.extend([(t,parents[j]) for t in ff])
        for j in sorted(hits,reverse=True):del faces[j];del parents[j]
        for t,p in new:faces.append(t);parents.append(p)
    # Exactly three known boundary-ear diagonals, pinned to archived IDs.
    assert len(B)==1109 and len(X)==641
    split(77,89,1078);split(257,261,934);split(258,261,933)
    V=np.array(verts);Y=np.array(xyz);F=np.array(faces);B2=V[F];BP2=Y[F];parents=np.array(parents)
    originalAreas=area(BP);parentAreas=np.bincount(parents,weights=area(BP2),minlength=len(BP));parentError=float(np.max(np.abs(parentAreas-originalAreas)))
    assert parentError<1e-10 and np.max(np.abs(parentAreas-originalAreas)/originalAreas)<1e-5
    # Child vertices must lie on the original triangle, valid barycentric
    # coordinates and orientation. Together with exact areas and edge-midpoint
    # subdivision this proves full original parent-face geometry coverage.
    ref=BP[parents];a=ref[:,0];e=ref[:,1]-a;f=ref[:,2]-a;n=np.cross(e,f);den=np.einsum('ij,ij->i',n,n)
    w=BP2-a[:,None];u=np.einsum('ijk,ik->ij',np.cross(w,f[:,None]),n)/den[:,None];v=np.einsum('ijk,ik->ij',np.cross(e[:,None],w),n)/den[:,None]
    weights=np.stack([1-u-v,u,v],axis=2);reconstructed=np.einsum('ijk,ikl->ijl',weights,ref);parentDist=float(np.linalg.norm(reconstructed-BP2,axis=2).max())
    parentBaryViolation=float(max(0,-weights.min(),weights.max()-1));assert parentDist<2e-5 and parentBaryViolation<1e-7
    assert np.all(np.einsum('ij,ij->i',np.cross(BP2[:,1]-BP2[:,0],BP2[:,2]-BP2[:,0]),n)>0)
    lines=[]
    for T in (A,B2):
        es={tuple(sorted((tuple(f[k]),tuple(f[(k+1)%3])))) for f in T for k in range(3)}
        lines.extend(LineString(e) for e in es)
    cells=list(polygonize(unary_union(lines)));polysA=[Polygon(f) for f in A];polysB=[Polygon(f) for f in B2];trees=[STRtree(polysA),STRtree(polysB)]
    domain=unary_union(polysB);originalDomain=unary_union([Polygon(f) for f in B]);assert domain.is_valid and domain.geom_type=='Polygon'
    domainDiff=float(domain.symmetric_difference(originalDomain).area);assert domainDiff<1e-10
    U=[];P=[];Q=[];index={};ff=[];ownA=[];ownB=[];mismatch=0.
    def own(tree,polys,p):
        ids=tree.query(p,predicate='intersects')
        if len(ids):return int(ids[0])
        j=int(tree.nearest(p));assert polys[j].distance(p)<1e-9;return j
    def at(uv,i,j):
        nonlocal mismatch
        uv=tuple(uv);values=[]
        for T,G,z in [(A,AP,i),(B2,BP2,j)]:
            w=bary(np.array([uv]),T[[z]])[0];assert min(w)>-1e-7 and max(w)<1+1e-7;values.append(w@G[z])
        if uv in index:
            k=index[uv];mismatch=max(mismatch,float(np.linalg.norm(P[k]-values[0])),float(np.linalg.norm(Q[k]-values[1])));return k
        k=len(U);index[uv]=k;U.append(uv);P.append(values[0]);Q.append(values[1]);return k
    covered=0.
    for cell in cells:
        p=cell.representative_point()
        if not domain.covers(p):continue
        assert not cell.interiors;covered+=cell.area
        i=own(trees[0],polysA,p);j=own(trees[1],polysB,p)
        loop=list(cell.exterior.coords)[:-1];ids=[at(v,i,j) for v in loop]
        if det(*[U[k] for k in ids[:3]])<0:ids=ids[::-1]
        ts=[]
        if parents[j] in [1077,1078,933,934,935,425]:
            @lru_cache(None)
            def best(a,b):
                if b-a<2:return (0,float('inf'),())
                cs=[]
                for k in range(a+1,b):
                    t=[ids[a],ids[k],ids[b]]
                    if det(*[U[v] for v in t])<=0:continue
                    x=best(a,k);y=best(k,b)
                    if x is None or y is None:continue
                    mn=[];fail=0
                    for pts in (P,Q):
                        z=np.array([pts[v] for v in t]);ar=area(z[None])[0];zr=z.astype(np.float32).astype(float);ar2=area(zr[None])[0];fail+=int(min(ar,ar2)<1e-10);mn.append(min(ar,ar2))
                    cs.append((-fail+x[0]+y[0],min(x[1],y[1],*mn),x[2]+y[2]+(t,)))
                return max(cs,key=lambda x:x[:2]) if cs else None
            choice=best(0,len(ids)-1)
            if choice is not None:ts=choice[2]
        if not ts:
            c=at((cell.centroid.x,cell.centroid.y),i,j);ts=[]
            for a,b in zip(ids,ids[1:]+ids[:1]):
                v=det(U[a],U[b],U[c])
                if v==0:continue
                ts.append([a,b,c] if v>0 else [b,a,c])
        ff.extend(ts);ownA.extend([i]*len(ts));ownB.extend([j]*len(ts))
    U=np.array(U);P=np.array(P);Q=np.array(Q);ff=np.array(ff);used=np.unique(ff);idx=np.full(len(U),-1);idx[used]=np.arange(len(used));U=U[used];P=P[used];Q=Q[used];ff=idx[ff]
    E=edges(ff);boundary=[e for e,n in E.items() if n==1];badboundary=sum(domain.boundary.distance(Point(U[a]))>1e-7 or domain.boundary.distance(Point(U[b]))>1e-7 or domain.boundary.distance(Point((U[a]+U[b])/2))>1e-7 for a,b in boundary)
    adj=collections.defaultdict(set)
    for a,b in E:adj[a].add(b);adj[b].add(a)
    unseen=set(range(len(U)));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for j in adj[todo.pop()]:
                if j in unseen:unseen.remove(j);todo.append(j)
    topology={'connectedComponents':cc,'boundaryEdges':len(boundary),'unintendedBoundaryEdges':badboundary,'nonmanifoldEdges':sum(n>2 for n in E.values()),'euler':len(U)-len(E)+len(ff),'chartArea':float(covered/domain.area),'sharedVertexEndpointMismatch':mismatch}
    assert cc==1 and not badboundary and not topology['nonmanifoldEdges'] and topology['euler']==1 and abs(covered/domain.area-1)<1e-6 and mismatch<2e-5
    def facekeys(uv,F):return {tuple(sorted(map(tuple,uv[t].round(12)))) for t in F}
    old=facekeys(baseline['chart'],baseline['faces']);new=facekeys(U,ff)
    report={'moves':moves,'nativeParentCount':len(B),'refinedTargetReferenceTriangles':len(B2),'originalNativeParentAreaError':parentError,'originalNativeParentBarycentricViolation':parentBaryViolation,'originalNativeParentSurfaceError':parentDist,'chartDomainSymmetricDifferenceArea':domainDiff,'topology':topology,'oldCounts':[len(baseline['chart']),len(baseline['faces'])],'newCounts':[len(U),len(ff)],'chartFacesComparedAt12Decimals':{'unchanged':len(old&new),'removed':len(old-new),'added':len(new-old)},'limitations':['Only three target-chart diagonals displaced; original physical parent geometry exactly subdivided.','Global arrangement rebuilt; numerical ordering and local tessellation may differ.','Source strip is historical SERPENT 004, not entire frozen wearable.']}
    return U,ff,P,Q,np.array(ownA),np.array(ownB),B2,BP2,parents,report
