"""GENESIS: local owner-constrained fan removal, no boundary consolidation."""
import numpy as np, collections
from functools import lru_cache
def edges(F):
    return collections.Counter(tuple(sorted((int(a),int(b)))) for f in F for a,b in zip(f,np.roll(f,-1)))
def clusters(F,bad):
    pending=set(map(int,bad));out=[]
    while pending:
        g={min(pending)};pending-=g;v=set(F[list(g)].flat)
        while True:
            new={i for i in pending if v.intersection(F[i])}
            if not new:break
            g|=new;pending-=new;v.update(F[list(new)].flat)
        out.append(sorted(g))
    return out
def condition(U,F,A,B,idealA,idealB,oa,ob,ra,rb,bad):
    U=np.asarray(U);F=np.asarray(F);A=np.asarray(A);B=np.asarray(B);oa=np.asarray(oa);ob=np.asarray(ob)
    A2=idealA.astype(np.float32).astype(np.float64);B2=idealB.astype(np.float32).astype(np.float64)
    owners=collections.defaultdict(list)
    for i,(a,b) in enumerate(zip(oa,ob)):owners[int(a),int(b)].append(i)
    affected=sorted({(int(oa[i]),int(ob[i])) for i in bad});groups=clusters(F,bad);E=edges(F);boundary={v for e,n in E.items() if n==1 for v in e}
    report={'affectedFaceIDs':sorted(map(int,bad)),'clusters':[{'faces':g,'touchesBoundary':bool(boundary.intersection(F[g].flat)),'vertices':sorted(map(int,set(F[g].flat)))} for g in groups],'affectedOwnerPairs':[list(p) for p in affected],'affectedOwnerTriangles':sum(len(owners[p]) for p in affected),'cells':[]}
    patch={int(v) for p in affected for i in owners[p] for v in F[i]};AA=A.copy();BB=B.copy();ids=sorted(patch);AA[ids]=A2[ids];BB[ids]=B2[ids]
    refN=[np.cross(x[:,1]-x[:,0],x[:,2]-x[:,0]) for x in (ra,rb)]
    remove=set();added=[];newA=[];newB=[]
    for pair in affected:
        fs=owners[pair];tri=F[fs];cnt=edges(tri);direct=[(int(a),int(b)) for f in tri for a,b in zip(f,np.roll(f,-1)) if cnt[tuple(sorted((a,b)))]==1];nxt=dict(direct)
        assert len(nxt)==len(direct)
        loop=[min(nxt)]
        while nxt[loop[-1]]!=loop[0]:
            v=nxt[loop[-1]];assert v not in loop;loop.append(v)
        assert len(loop)==len(nxt)
        def score(t):
            q=U[list(t)];e=q[1]-q[0];f=q[2]-q[0];chart=e[0]*f[1]-e[1]*f[0]
            if chart<=0:return (-1,0.)
            mins=[];fails=0
            for P,ref in [(AA,refN[0][pair[0]]),(BB,refN[1][pair[1]]),(idealA,refN[0][pair[0]]),(idealB,refN[1][pair[1]])]:
                q=P[list(t)];n=np.cross(q[1]-q[0],q[2]-q[0]);area=np.linalg.norm(n)/2;dot=n@ref;fails+=int(area<1e-10 or dot<=0);mins.append(area if dot>0 else 0.)
            return (-fails,min(mins))
        @lru_cache(None)
        def best(i,j):
            if j-i<2:return (0,float('inf'),())
            cand=[]
            for k in range(i+1,j):
                t=(loop[i],loop[k],loop[j]);q=U[list(t)];e=q[1]-q[0];f=q[2]-q[0]
                if e[0]*f[1]-e[1]*f[0]<=0:continue
                x=best(i,k);y=best(k,j)
                if x is None or y is None:continue
                s=score(t);cand.append((s[0]+x[0]+y[0],min(s[1],x[1],y[1]),x[2]+y[2]+(t,)))
            return max(cand,key=lambda x:x[:2]) if cand else None
        old=[score(tuple(t)) for t in tri];oldscore=(sum(t[0] for t in old),min(t[1] for t in old));candidate=best(0,len(loop)-1)
        use=candidate is not None and candidate[:2]>=oldscore
        if use:
            remove.update(fs);added.extend(candidate[2]);newA.extend([pair[0]]*len(candidate[2]));newB.extend([pair[1]]*len(candidate[2]))
        cell={'owner':list(pair),'originalFaceIDs':fs,'boundary':loop,'oldScore':list(oldscore),'candidateScore':list(candidate[:2]) if candidate else None,'accepted':bool(use),'originalTriangles':len(fs),'newTriangles':len(candidate[2]) if use else len(fs),'idealCellArea':{}}
        for label,P in [('compact',idealA),('target',idealB)]:
            t=P[tri];cell['idealCellArea'][label]=float(np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1).sum()/2)
        cell['minimumRequiredTotalArea']=1e-10*(len(loop)-2)
        cell['cellAreaCannotSupportFloor']=any(x<cell['minimumRequiredTotalArea'] for x in cell['idealCellArea'].values())
        report['cells'].append(cell)
    keep=np.array([i for i in range(len(F)) if i not in remove]);F2=np.concatenate([F[keep],np.array(added,dtype=int).reshape(-1,3)],axis=0);oa2=np.r_[oa[keep],newA].astype(int);ob2=np.r_[ob[keep],newB].astype(int);used=np.unique(F2);index=np.full(len(U),-1,int);index[used]=np.arange(len(used));F2=index[F2]
    E2=edges(F2);back={tuple(sorted((int(used[i]),int(used[j])))) for (i,j),n in E2.items() if n==1};old={e for e,n in E.items() if n==1};assert back==old
    # Explicit graph connectivity, original boundary and manifold gates.
    adj=collections.defaultdict(set)
    for i,j in E2:adj[i].add(j);adj[j].add(i)
    unseen=set(range(len(used)));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for v in adj[todo.pop()]:
                if v in unseen:unseen.remove(v);todo.append(v)
    report.update({'changedOwnerCells':sum(c['accepted'] for c in report['cells']),'removedOriginalFaceIDs':sorted(remove),'removedVertices':sorted(set(range(len(U)))-set(used)),'originalVertexIDs':used.tolist(),'changedCoordinateVertices':np.flatnonzero(np.any(AA!=A,axis=1)|np.any(BB!=B,axis=1)).tolist(),'oldCounts':[len(U),len(F)],'newCounts':[len(used),len(F2)],'topology':{'connectedComponents':cc,'boundaryEdges':len(back),'boundaryIdentical':True,'unintendedBoundaryEdges':0,'nonmanifoldEdges':sum(n>2 for n in E2.values()),'euler':len(used)-len(E2)+len(F2)}})
    assert cc==1 and not report['topology']['nonmanifoldEdges'] and report['topology']['euler']==1
    for g in report['clusters']:
        v=g['vertices'];g['chartCoordinates']=U[v].tolist();g['idealCompact']=idealA[v].tolist();g['idealTarget']=idealB[v].tolist();g['storedCompact']=A[v].tolist();g['storedTarget']=B[v].tolist();g['oneRingFaceIDs']=np.flatnonzero(np.isin(F,v).any(1)).tolist()
    return U[used],F2,AA[used],BB[used],oa2,ob2,report
