"""Conservative continuous numerical boundary separation for PL paths.
Nonadjacent edge tests; critical endpoint contact separately localized.
Float64 coefficient bounds, not exact arithmetic."""
import numpy as np,json,sys
from pathlib import Path
import shapely as sh
root=Path(sys.argv[1]);out=Path(sys.argv[2]);q=np.load(root/'event.npz')
def boundary(F):
 e,c=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),1),axis=0,return_counts=True);return e[c==1]
def cross(a,b):return a[...,0]*b[...,1]-a[...,1]*b[...,0]
def bern(A,B,C,D,E,F):
 u=B-A;v=C-A;du=E-D-u;dv=F-D-v;c0=cross(u,v);c1=cross(du,v)+cross(u,dv);c2=cross(du,dv);return np.stack([c0,c0+c1/2,c0+c1+c2],axis=-1)
def prove(a,b,c,d,allow0=False,allow1=False):
 eps=2e-13
 def pos(v):return (v[:,0]>=0 if allow0 else v[:,0]>eps)&(v[:,1]>eps)&(v[:,2]>=0 if allow1 else v[:,2]>eps)
 def neg(v):return pos(-v)
 A=a.min(1);B=b.min(1);C=c.max(1);D=d.max(1);P=c.min(1);Q=d.min(1);R=a.max(1);S=b.max(1)
 def sep(x,y):return ((x>=0 if allow0 else x>eps)&(y>=0 if allow1 else y>eps)&((x>eps)|(y>eps))).any(1)
 good=sep(A-C,B-D)|sep(P-R,Q-S)
 for x,y,z,w in [(a,b,c,d),(c,d,a,b)]:
  h=bern(x[:,0],x[:,1],z[:,0],y[:,0],y[:,1],w[:,0]);j=bern(x[:,0],x[:,1],z[:,1],y[:,0],y[:,1],w[:,1]);good|=(pos(h)&pos(j))|(neg(h)&neg(j))
 return good
def check(P,F,critical=()):
 E=boundary(F);ii,jj=np.triu_indices(len(E),1);sel=~(E[ii,:,None]==E[jj,None,:]).any((1,2));ii,jj=ii[sel],jj[sel];rows=[];crit=set(critical)
 for k in range(len(P)-1):
  X=P[k,E,:2].astype(float);Y=P[k+1,E,:2].astype(float);low=np.minimum(X.min(1),Y.min(1));hi=np.maximum(X.max(1),Y.max(1));sel=(np.minimum(hi[ii],hi[jj])+1e-13>=np.maximum(low[ii],low[jj])).all(1);i,j=ii[sel],jj[sel];a,b,c,d=X[i],Y[i],X[j],Y[j];n=len(i);unres=[];stack=[(a,b,c,d,i,j,0,k in crit,k+1 in crit)]
  while stack:
   a,b,c,d,i,j,depth,allow0,allow1=stack.pop();good=prove(a,b,c,d,allow0,allow1);bad=~good
   if not bad.any():continue
   a,b,c,d,i,j=a[bad],b[bad],c[bad],d[bad],i[bad],j[bad]
   if depth==12:unres.extend(zip(i.tolist(),j.tolist()));continue
   m=(a+b)/2;z=(c+d)/2;stack.append((a,m,c,z,i,j,depth+1,allow0,False));stack.append((m,b,z,d,i,j,depth+1,False,allow1))
  unique=sorted(set(unres));rows.append({'interval':k,'sweptCandidates':n,'unresolvedPairs':len(unique),'pairs':unique[:500]})
 return {'boundaryEdges':len(E),'intervals':len(rows),'fullySeparatedIntervals':sum(not x['unresolvedPairs'] for x in rows),'peakUnresolved':max(x['unresolvedPairs'] for x in rows),'rows':rows}
rep={}
for label in ['bridge','tension','correction','split']:
 P=q[label];F=q['splitFaces'] if label=='split' else q['faces'];rep[label]=check(P,F,(0,len(P)-1) if label=='split' else ())
(out/'boundary-intervals.json').write_text(json.dumps(rep,indent=2))
K=q['splitFaces'];F=q['faces'];W=q['weldMap'];C=q['split'][0];u=q['materialChart'];be=boundary(K);ls=sh.linestrings(C[be,:2]);i,j=sh.STRtree(ls).query(ls,predicate='intersects');s=(i<j)&~(be[i,:,None]==be[j,None,:]).any((1,2));i,j=i[s],j[s];same=(W[be[i]][:,:,None]==W[be[j]][:,None,:]).any((1,2));seam=(np.sort(W[be[i]],axis=1)==np.sort(W[be[j]],axis=1)).all(1)
r={'criticalNonadjacentBoundaryContactPairs':len(i),'allContactsMapToSharedAncestorVertexOrEdge':bool(same.all()),'exactDuplicatedSeamEdgeContactPairs':int(seam.sum()),'outsideAncestorContactPairs':[[int(a),int(b)] for a,b in zip(i[~same],j[~same])],'maxLoopMaterialChartDiscontinuity':float(abs(u[W][K]-u[F]).max()),'scope':'Projected boundary contacts only; not full-frame collision.'}
(out/'critical-contact.json').write_text(json.dumps(r,indent=2));assert all(not x['peakUnresolved'] for x in rep.values()) and same.all() and r['maxLoopMaterialChartDiscontinuity']==0
