"""Evaluated-region topology/parameterization diagnostic. No control fallback.
Rebuild chart from evaluated indexed connectivity, not interpolated UV seams.
"""
import collections, math, json
import numpy as np
from mathutils import Vector
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import spsolve
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree
def diagnose(faces):
    edge=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    adj=collections.defaultdict(set);boundary=collections.defaultdict(set)
    for (a,b),n in edge.items():
        adj[a].add(b);adj[b].add(a)
        if n==1:boundary[a].add(b);boundary[b].add(a)
    def cc(g):
        todo=set(g);groups=[]
        while todo:
            seed=todo.pop();stack=[seed];group={seed}
            while stack:
                for j in g[stack.pop()]:
                    if j in todo:todo.remove(j);stack.append(j);group.add(j)
            groups.append(group)
        return groups
    return {'vertices':len(adj),'edges':len(edge),'triangles':len(faces),'components':len(cc(adj)),'componentSizes':sorted(map(len,cc(adj)),reverse=True),'boundaryEdges':sum(n==1 for n in edge.values()),'boundaryComponents':len(cc(boundary)),'boundaryDegreeDefects':sum(len(v)!=2 for v in boundary.values()),'nonmanifoldEdges':sum(n>2 for n in edge.values()),'euler':len(adj)-len(edge)+len(faces)},adj,boundary
def chart_evaluated(me, matrix, marker, report):
    layer=me.uv_layers.get('LiquidChart')
    assert layer is not None
    pts={};uvs=collections.defaultdict(list);faces=[];rejected=collections.Counter()
    for t in me.loop_triangles:
        if t.material_index!=marker:continue
        ids=tuple(t.vertices);p=[matrix@me.vertices[i].co for i in ids]
        normal=(p[1]-p[0]).cross(p[2]-p[0])
        if normal.length<=1e-12:rejected['zeroWorldArea']+=1;continue
        if normal.z<=1e-9:rejected['nonUpper']+=1;continue
        q=[tuple(layer.data[l].uv) for l in t.loops]
        if abs((q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[2][0]-q[0][0])*(q[1][1]-q[0][1]))<1e-12:rejected['degenerateInheritedUVIncluded']+=1
        faces.append(ids)
        for i,v,u in zip(ids,p,q):pts[i]=v;uvs[i].append(u)
    raw,adj,boundary=diagnose(faces)
    report['rawEvaluatedIndexedTopology']=raw;report['inheritedUVClassification']=dict(rejected)
    report['maxInheritedUVSpreadAtSharedVertex']=max((max(math.dist(v,us[0]) for v in us) for us in uvs.values()),default=0)
    # No discarded islands or filled holes: the selected entire upward marked region must be a disk.
    assert raw['components']==1 and raw['boundaryComponents']==1 and raw['boundaryDegreeDefects']==0 and raw['nonmanifoldEdges']==0 and raw['euler']==1,raw
    start=min(boundary);loop=[start];prev=None;cur=start
    while True:
        nxt=next(i for i in sorted(boundary[cur]) if i!=prev)
        if nxt==start:break
        assert nxt not in loop;loop.append(nxt);prev,cur=cur,nxt
    assert len(loop)==len(boundary)
    uv={i:np.mean(us,axis=0) for i,us in uvs.items()}
    corners=[(0,0),(1,0),(1,1),(0,1)]
    # Actual inherited chart corners establish orientation only; boundary is
    # redistributed by physical arc length, eliminating modifier UV seams.
    c=[min(loop,key=lambda i:np.linalg.norm(uv[i]-q)) for q in corners]
    assert len(set(c))==4
    k=loop.index(c[0]);loop=loop[k:]+loop[:k]
    if not loop.index(c[1])<loop.index(c[2])<loop.index(c[3]):loop=[loop[0]]+loop[:0:-1]
    indices=[loop.index(i) for i in c]+[len(loop)]
    assert indices==sorted(indices),indices
    fixed={};boundaryMap=[]
    for j in range(4):
        seq=loop[indices[j]:indices[j+1]+1] if j<3 else loop[indices[j]:]+[loop[0]]
        d=[0.]
        for a,b in zip(seq,seq[1:]):d.append(d[-1]+(pts[a]-pts[b]).length)
        for i,x in zip(seq,d):
            t=x/d[-1];q=(1-t)*np.array(corners[j])+t*np.array(corners[(j+1)%4]);angle=(-.75+(j+t)*.5)*math.pi
            fixed[i]=np.array([.5+.48*math.cos(angle),.5+.48*math.sin(angle)])
            if i!=seq[-1]:boundaryMap.append((j+t,tuple(q),tuple(fixed[i])))
    inside=sorted(set(adj)-set(fixed));lookup={i:k for k,i in enumerate(inside)}
    rr=[];cc=[];vv=[];rhs=np.zeros((len(inside),2))
    for i in inside:
        k=lookup[i];rr.append(k);cc.append(k);vv.append(len(adj[i]))
        for n in adj[i]:
            if n in fixed:rhs[k]+=fixed[n]
            else:rr.append(k);cc.append(lookup[n]);vv.append(-1.)
    sol=spsolve(coo_matrix((vv,(rr,cc)),shape=(len(inside),len(inside))).tocsr(),rhs)
    fixed.update({i:sol[k] for k,i in enumerate(inside)})
    rows=[];sg=[]
    for f in faces:
        q=[tuple(fixed[i]) for i in f];p=[pts[i] for i in f]
        a=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[2][0]-q[0][0])*(q[1][1]-q[0][1]);sg.append(a)
        if a<0:q=[q[0],q[2],q[1]];p=[p[0],p[2],p[1]]
        rows.append({'uv':q,'p':p})
    domain=Polygon([q[2] for q in boundaryMap]);assert domain.is_valid and domain.area>0
    report['harmonicChart']={'signedPositive':int(sum(x>1e-14 for x in sg)),'signedNegative':int(sum(x<-1e-14 for x in sg)),'degenerate':int(sum(abs(x)<=1e-14 for x in sg)),'area':float(sum(abs(x) for x in sg)/2),'expectedConvexDomainArea':float(domain.area),'corners':list(map(int,c)),'boundaryVertices':len(boundaryMap)}
    assert all(x>1e-14 for x in sg) or all(x<-1e-14 for x in sg),report['harmonicChart']
    assert abs(report['harmonicChart']['area']/domain.area-1)<1e-6
    return rows,boundaryMap,domain
def overlay_noded(A,B,interp,domain=None):
    # Global exact GEOS noding: every crossing and T-junction shares one graph vertex.
    # No per-triangle clipping/welding tolerances and no independent moving faces.
    if domain is None:domain=Polygon([(0,0),(1,0),(1,1),(0,1)])
    lines=[]
    for rows in (A,B):
        edges=set()
        for q in rows:
            for a,b in zip(q['uv'],q['uv'][1:]+q['uv'][:1]):
                edges.add(tuple(sorted((tuple(a),tuple(b)))))
        lines.extend(LineString(e) for e in edges if e[0]!=e[1])
    noded=unary_union(lines);cells=list(polygonize(noded))
    ap=[Polygon(q['uv']) for q in A];bp=[Polygon(q['uv']) for q in B];at=STRtree(ap);bt=STRtree(bp)
    v=[];pa=[];pb=[];faces=[];idx={};mismatch=0.;covered=0.;holes=0
    def owner(tree,polys,p):
        ids=tree.query(p,predicate='intersects')
        if len(ids):return int(ids[0])
        i=int(tree.nearest(p));assert polys[i].distance(p)<1e-9;return i
    def vertex(q,a,b):
        nonlocal mismatch
        k=tuple(q);x,y=interp(a,k),interp(b,k)
        if k in idx:
            j=idx[k];mismatch=max(mismatch,(x-pa[j]).length,(y-pb[j]).length);return j
        j=len(v);idx[k]=j;v.append(k);pa.append(x);pb.append(y);return j
    for cell in cells:
        if cell.area<=0:continue
        p=cell.representative_point()
        if not domain.covers(p):continue
        if cell.interiors:holes+=len(cell.interiors);continue
        a=A[owner(at,ap,p)];b=B[owner(bt,bp,p)]
        poly=list(cell.exterior.coords)[:-1];center=(p.x,p.y)
        # Cells are intersections of triangles (convex except numerical noise).
        # Use polygon centroid for an interior fan; preserve noded edges.
        center=(cell.centroid.x,cell.centroid.y);assert cell.covers(Point(center))
        ids=[vertex(q,a,b) for q in poly];ci=vertex(center,a,b);covered+=cell.area
        for j,k in zip(ids,ids[1:]+ids[:1]):
            if j==k:continue
            q,r,s=v[j],v[k],v[ci];area=(r[0]-q[0])*(s[1]-q[1])-(r[1]-q[1])*(s[0]-q[0])
            if area==0:continue
            faces.append((j,k,ci) if area>0 else (k,j,ci))
    top,_,boundary=diagnose(faces)
    edges=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    bad=sum(domain.boundary.distance(Point(v[a]))>=1e-7 or domain.boundary.distance(Point(v[b]))>=1e-7 or domain.boundary.distance(Point((np.array(v[a])+np.array(v[b]))/2))>=1e-7 for (a,b),n in edges.items() if n==1)
    diag={'chartArea':covered/domain.area,'absoluteChartArea':covered,'expectedChartArea':domain.area,'sharedVertexEndpointMismatch':mismatch,'connectedComponents':top['components'],'boundaryEdges':top['boundaryEdges'],'unintendedBoundaryEdges':bad,'nonmanifoldEdges':top['nonmanifoldEdges'],'polygonizedCells':len(cells),'cellHoles':holes,'indexedTopology':top}
    diag['pass']=abs(covered/domain.area-1)<1e-6 and mismatch<2e-5 and top['components']==1 and not bad and not top['nonmanifoldEdges'] and not holes
    return v,pa,pb,faces,diag

def remap_compact(A,boundaryMap,report):
    """Exact subdivision of compact original triangles along the boundary;
    solve new compact harmonic chart on the same convex polygon as target."""
    old=[];xyz=[];vid={};faces=[]
    def put(u,p):
        u=tuple(u)
        if u in vid:
            assert (xyz[vid[u]]-p).length<2e-5;return vid[u]
        i=len(old);vid[u]=i;old.append(u);xyz.append(p);return i
    for q in A:faces.append(tuple(put(u,p) for u,p in zip(q['uv'],q['p'])))
    raw,adj,bd=diagnose(faces)
    assert raw['components']==1 and raw['euler']==1 and raw['boundaryComponents']==1
    def perimeter(p):
        x,y=p
        if abs(y)<1e-10:return x
        if abs(x-1)<1e-10:return 1+y
        if abs(y-1)<1e-10:return 3-x
        if abs(x)<1e-10:return 4-y
        raise ValueError(p)
    targets=[(t,tuple(q),tuple(v)) for t,q,v in boundaryMap]
    targets.append((4.,targets[0][1],targets[0][2]))
    split={};boundaryEdges={tuple(sorted((i,j))) for i in bd for j in bd[i]}
    originalBoundary=sorted((perimeter(old[i]),i) for i in bd)
    for a,b in sorted(boundaryEdges):
        ta,tb=perimeter(old[a]),perimeter(old[b])
        if abs(ta-tb)>2:
            if ta<tb:ta+=4
            else:tb+=4
        lo,hi=sorted((ta,tb));mids=[]
        for t,q,v in targets:
            if lo+1e-11<t<hi-1e-11:
                frac=(t-ta)/(tb-ta);p=xyz[a].lerp(xyz[b],frac)
                i=put(q,p);mids.append((frac,i))
        split[a,b]=[i for _,i in sorted(mids)]
    refined=[]
    for f in faces:
        cycle=[]
        for a,b in zip(f,f[1:]+f[:1]):
            cycle.append(a);k=tuple(sorted((a,b)));m=split.get(k,[])
            cycle.extend(m if a<b else m[::-1])
        if len(cycle)==3:refined.append(tuple(cycle));continue
        uv=tuple(np.mean([old[i] for i in f],axis=0));p=sum((xyz[i] for i in f),Vector())/3
        k=put(uv,p)
        refined.extend((a,b,k) for a,b in zip(cycle,cycle[1:]+cycle[:1]))
    refinedStats,adj,bd=diagnose(refined)
    assert refinedStats['components']==1 and refinedStats['euler']==1 and refinedStats['boundaryComponents']==1
    ts=np.array([q[0] for q in targets]);qs=np.array([q[2] for q in targets])
    fixed={}
    for i in bd:
        t=perimeter(old[i]);fixed[i]=np.array([np.interp(t,ts,qs[:,k]) for k in range(2)])
    inside=sorted(set(adj)-set(fixed));lookup={i:k for k,i in enumerate(inside)}
    rr=[];cc=[];vv=[];rhs=np.zeros((len(inside),2))
    for i in inside:
        k=lookup[i];rr.append(k);cc.append(k);vv.append(len(adj[i]))
        for n in adj[i]:
            if n in fixed:rhs[k]+=fixed[n]
            else:rr.append(k);cc.append(lookup[n]);vv.append(-1.)
    sol=spsolve(coo_matrix((vv,(rr,cc)),shape=(len(inside),len(inside))).tocsr(),rhs)
    fixed.update({i:sol[k] for k,i in enumerate(inside)})
    rows=[];sg=[]
    for f in refined:
        q=[tuple(fixed[i]) for i in f];p=[xyz[i] for i in f]
        a=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[2][0]-q[0][0])*(q[1][1]-q[0][1]);sg.append(a)
        if a<0:q=[q[0],q[2],q[1]];p=[p[0],p[2],p[1]]
        rows.append({'uv':q,'p':p})
    report['compactConvexChart']={'before':raw,'afterBoundarySubdivision':refinedStats,'positive':int(sum(x>1e-14 for x in sg)),'negative':int(sum(x<-1e-14 for x in sg)),'degenerate':int(sum(abs(x)<=1e-14 for x in sg)),'area':float(sum(abs(x) for x in sg)/2)}
    assert all(x>1e-14 for x in sg) or all(x<-1e-14 for x in sg),report['compactConvexChart']
    return rows
