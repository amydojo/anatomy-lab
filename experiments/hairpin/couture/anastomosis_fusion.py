"""ANASTOMOSIS: authored isolated cap-weld event, not frozen B or VECTOR."""
import numpy as np,collections,json,sys
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
Y=[0,1.5,3,5,8,11,14,17,19,20.5,22]
X=[-5,-4.1,-3.2,0,3.2,4.1,5]
def build(t,joined=False,critical=False):
    p=min(t/.65,1);s=p*p*(3-2*p);gap=0. if critical or joined else 4.8*(1-s)
    coords={};cells=[]
    def point(k,x,y):coords[k]=(x,y);return k
    def g(i,j):return point(f'g{i}_{j}',X[i],Y[j])
    for j in range(len(Y)-1):
        for i in range(len(X)-1):
            if j<2 or i in (0,1,4,5):cells.append((g(i,j),g(i+1,j),g(i+1,j+1),g(i,j+1)))
    for side,root in [('L',2),('R',4)]:
        def br(k,j):
            if k==0:return g(root,j)
            x=X[root]+k/4*((-gap/2 if side=='L' else gap/2)-X[root])
            return point(f'T{j}' if joined and k==4 else f'{side}{k}_{j}',x,Y[j])
        for j in (8,9):
            for k in range(4):
                a,b,c,d=br(k,j),br(k+1,j),br(k+1,j+1),br(k,j+1);cells.append((a,b,c,d) if side=='L' else (b,a,d,c))
    names=sorted(coords);index={k:i for i,k in enumerate(names)};xy=np.array([coords[k] for k in names]);n=len(xy);x,y=xy.T
    grow=.62+.38*(t*t*(3-2*t));xx=x*(.82+.18*y/22)*grow;yy=y*(.60+.40*t)+.035*x*x
    z=.32*np.sin(y/22*np.pi)+.025*x*np.sin(y/22*np.pi);h=.20+.12*t+.025*np.cos(y/22*np.pi)
    V=np.concatenate([np.c_[xx,yy,z+h/2],np.c_[xx,yy,z-h/2]]).astype(np.float32);ids=[k+':U' for k in names]+[k+':D' for k in names]
    ux=np.array([0 if k.startswith(('L4_','R4_','T')) else ((-1 if k[0]=='L' else 1)*3.2*(1-int(k[1])/4)/10 if k[0] in 'LR' else coords[k][0]/10) for k in names]);UV=np.tile(np.c_[.5+ux,y/22],(2,1))
    top=[];fids=[];edges=collections.defaultdict(list)
    for ci,c in enumerate(cells):
        a,b,c,d=[index[k] for k in c];top.extend([(a,b,c),(a,c,d)]);fids.extend([f'cell{ci}:0',f'cell{ci}:1'])
        for i,j in [(a,b),(b,c),(c,d),(d,a)]:edges[tuple(sorted((i,j)))].append((i,j))
    bot=[tuple(n+x for x in f[::-1]) for f in top];F=top+bot;fid=[f'U:{k}' for k in fids]+[f'D:{k}' for k in fids];roles=[0]*len(top)+[1]*len(bot);caps=[];be=[]
    for es in edges.values():
        if len(es)!=1:continue
        a,b=es[0];be.append((a,b));tag='|'.join(sorted((names[a],names[b])));cap=names[a].startswith(('L4_','R4_')) and names[b].startswith(('L4_','R4_'))
        F.extend([(b,a,a+n),(b,a+n,b+n)]);fid.extend([f'W:{tag}:0',f'W:{tag}:1']);roles.extend([3 if cap else 2]*2)
        if cap:caps.extend([len(F)-2,len(F)-1])
    return V,np.array(F),UV,ids,fid,np.array(roles),caps,np.array(be),n
def audit(P,F,be,n):
    P=P.astype(float);T=P[F];N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2;E=collections.defaultdict(list)
    for f in F:
        for a,b in zip(f,np.roll(f,-1)):E[tuple(sorted((int(a),int(b))))].append((int(a),int(b)))
    adj=collections.defaultdict(set)
    for a,b in E:adj[a].add(b);adj[b].add(a)
    unseen=set(range(len(P)));cc=0
    while unseen:
        cc+=1;todo=[unseen.pop()]
        while todo:
            for x in adj[todo.pop()]:
                if x in unseen:unseen.remove(x);todo.append(x)
    nt=(len(F)-2*len(be))//2;poly=unary_union([Polygon(t[:,:2]) for t in T[:nt]]);area=float(N[:nt,2].sum()/2);vol=float(np.einsum('ij,ij->i',T[:,0],np.cross(T[:,1],T[:,2])).sum()/6);gap=P[:n,2]-P[n:,2]
    r={'vertices':len(P),'triangles':len(F),'edges':len(E),'components':cc,'euler':len(P)-len(E)+len(F),'boundaryEdges':sum(len(x)==1 for x in E.values()),'nonmanifoldEdges':sum(len(x)>2 for x in E.values()),'orientationDefects':sum(len(x)==2 and x[0]!=x[1][::-1] for x in E.values()),'belowFloor':int((ar<1e-10).sum()),'minArea':float(ar.min()),'nonpositiveProjected':int((N[:nt,2]<=0).sum()+(N[nt:2*nt,2]>=0).sum()),'projectedAreaError':abs(poly.area-area),'domainType':poly.geom_type,'apertures':len(poly.interiors) if poly.geom_type=='Polygon' else -1,'thicknessMin':float(gap.min()),'volume':vol,'apertureArea':float(sum(Polygon(x).area for x in poly.interiors)) if poly.geom_type=='Polygon' else None}
    r['regularPass']=bool(cc==1 and not any(r[k] for k in ['boundaryEdges','nonmanifoldEdges','orientationDefects','belowFloor','nonpositiveProjected']) and r['projectedAreaError']<1e-8 and r['thicknessMin']>0 and vol>0 and poly.geom_type=='Polygon' and r['euler']==2-2*r['apertures']);return r,N
def run(out):
    out.mkdir(parents=True,exist_ok=True);pre=[];post=[];rows=[];prev=None
    for t in np.r_[np.linspace(0,.64,65),np.linspace(.65,1,36)]:
        joined=t>=.65;P,F,UV,ids,fids,roles,caps,be,n=build(float(t),joined);r,N=audit(P,F,be,n);old=prev if prev and prev[0]==joined else None;r['temporalReversals']=0 if old is None else int((np.sum(N*old[1],axis=1)<0).sum());r['regularPass']&=not r['temporalReversals'];r.update(t=float(t),joined=bool(joined));rows.append(r);prev=(joined,N);(post if joined else pre).append(P)
    p,F,U,ids,fi,roles,caps,be,n=build(.65,False,True);q,G,W,jds,gi,rr,_,bb,m=build(.65,True)
    def alias(k):return 'T'+k.split('_',1)[1] if k.startswith(('L4_','R4_')) else k
    mp=np.array([jds.index(alias(k)) for k in ids]);keep=np.setdiff1d(np.arange(len(F)),caps);oldSet={tuple(sorted(t)) for t in mp[F[keep]]};newSet={tuple(sorted(t)) for t in G};capVerts=np.unique(F[caps]);gap=float(np.max(abs(p-q[mp])));N=np.cross(p[F[caps,1]]-p[F[caps,0]],p[F[caps,2]]-p[F[caps,0]])
    r={'removedCapFaceIDs':[fi[i] for i in caps],'removedCapCount':len(caps),'weldedVertexCount':len(p)-len(q),'vertexMap':mp.tolist(),'retainedTriangleSetIdentical':oldSet==newSet,'retainedTriangleCount':len(keep),'maxEventCoordinateDiscontinuity':gap,'capVertexIDs':[ids[i] for i in capVerts],'capNormalSum':N.sum(0).tolist(),'retainedUVMaxError':float(np.max(abs(U-W[mp]))),'preRegular':rows[64],'postRegular':rows[65]}
    r['eventPass']=bool(oldSet==newSet and gap==0 and np.array_equal(U,W[mp]) and len(caps)==8 and len(p)-len(q)==6 and rows[64]['regularPass'] and rows[65]['regularPass'] and rows[64]['euler']==2 and rows[65]['euler']==0)
    np.savez_compressed(out/'fusion.npz',pre=np.array(pre),post=np.array(post),preFaces=F,postFaces=G,preUV=U,postUV=W,preRoles=roles,postRoles=rr,criticalPre=p,criticalPost=q,preBoundary=be,postBoundary=bb,preIDs=np.array(ids),postIDs=np.array(jds),preFaceIDs=np.array(fi),postFaceIDs=np.array(gi),removedCaps=np.array(caps),vertexMap=mp)
    rep={'scope':'Isolated authored derivative; not frozen B or native VECTOR. Coincident cap weld at critical event, not ordinary smooth manifold motion. No visibility swapping.','regularSamples':len(rows),'regularPasses':sum(x['regularPass'] for x in rows),'event':r,'samples':rows};(out/'fusion.json').write_text(json.dumps(rep,indent=2));assert rep['regularPasses']==101 and r['eventPass'];return rep
if __name__=='__main__':run(Path(sys.argv[1]))
