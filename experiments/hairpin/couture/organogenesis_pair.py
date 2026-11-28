"""ORGANOGENESIS: recorded deterministic local chart solution and reference-pair graph rebuild.
Only three interior source chart vertices move. Original physical references unchanged.
No tolerance snapping or discard of positive-area cells."""
import numpy as np,shapely as sh,json,sys,collections
from pathlib import Path
from shapely.strtree import STRtree
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
q=dict(np.load(root/'genesis/conditioned-correspondence.npz'));b=dict(np.load(root/'bridge/bridge-correspondence.npz'))
X0,inv=np.unique(q['sourceUV'].reshape(-1,2),axis=0,return_inverse=True);SF=inv.reshape(-1,3);X=X0.copy()
# Recorded local coordinate descent solution, then first full-mesh
# deterministic residual trial. Acceptance is NOT the proxy objective.
X[395,0]+=.00002;X[517,0]+=.00001;X[518,0]+=.00001;S=X[SF]
def det(T):
 e=T[:,1]-T[:,0];f=T[:,2]-T[:,0];return e[:,0]*f[:,1]-e[:,1]*f[:,0]
E,C=np.unique(np.sort(np.concatenate([SF[:,[0,1]],SF[:,[1,2]],SF[:,[2,0]]]),axis=1),axis=0,return_counts=True);bd=np.unique(E[C==1]);assert len(bd)==413 and np.array_equal(X[bd],X0[bd]);ratio=det(S)/det(q['sourceUV']);assert ratio.min()>.5
oldDomain=sh.union_all(sh.polygons(q['sourceUV']));newDomain=sh.union_all(sh.polygons(S));assert sh.area(sh.symmetric_difference(oldDomain,newDomain))<1e-12
assert abs(sh.area(sh.polygons(S)).sum()-sh.area(newDomain))<1e-12
U=q['chart'];F=q['faces'];c=q['compactFaceOwner'];t=q['targetFaceOwner'];T=q['targetUV'];moved=np.flatnonzero(np.any(X!=X0,axis=1));old=collections.defaultdict(list);src=collections.defaultdict(list)
for i,f in enumerate(SF):
 for a,j in zip(f,np.roll(f,-1)):src[tuple(sorted((int(a),int(j))))].append(i)
changed=[e for e in src if np.isin(e,moved).any()];pairs={tuple(sorted(src[e])) for e in changed if len(src[e])==2};assert all(len(src[e])==2 for e in changed)
for i,f in enumerate(F):
 for a,j in zip(f,np.roll(f,-1)):old[tuple(sorted((int(a),int(j))))].append(i)
kept=[];removed=0;replaced=0
for e,ids in old.items():
 if len(ids)==2:
  i,j=ids
  if c[i]==c[j] and t[i]==t[j]:removed+=1;continue
  if t[i]==t[j] and tuple(sorted((int(c[i]),int(c[j])))) in pairs:replaced+=1;continue
 kept.append(e)
E=np.r_[U[np.array(kept)],X[np.array(changed)]];cells=sh.get_parts(sh.polygonize(sh.get_parts(sh.union_all(sh.linestrings(E)))));rep=sh.point_on_surface(cells);domain=sh.union_all(sh.polygons(U[F]));ok=sh.covers(domain,rep);cells=cells[ok];rep=rep[ok];assert np.all(sh.get_num_interior_rings(cells)==0)
own=[]
for R in [S,T]:
 pol=sh.polygons(R);tree=STRtree(pol);i,j=tree.query(rep,predicate='intersects');o=np.full(len(cells),-1,int);o[i]=j;miss=np.flatnonzero(o<0)
 if len(miss):
  fail={'ownerMisses':len(miss),'areas':sh.area(cells[miss]).tolist(),'centers':sh.get_coordinates(rep[miss]).tolist(),'removedRedundantEdges':removed,'replacedSegments':replaced};(out/'failure.json').write_text(json.dumps(fail,indent=2));raise RuntimeError(fail)
 own.append(o)
co,to=own;cells=sh.orient_polygons(cells,exterior_cw=False);C,I=sh.get_coordinates(sh.get_exterior_ring(cells),return_index=True);counts=np.bincount(I);starts=np.r_[0,np.cumsum(counts)[:-1]];keep=np.ones(len(C),bool);keep[starts+counts-1]=False;C=C[keep];I=I[keep];counts-=1;starts=np.r_[0,np.cumsum(counts)[:-1]];coords,first,ix=np.unique(C,axis=0,return_index=True,return_inverse=True);face=[];owner=[];extra=[]
for i,n in enumerate(counts):
 ids=ix[starts[i]:starts[i]+n]
 if n==3:face.append(ids);owner.append(i);continue
 k=len(coords)+len(extra);extra.append(C[starts[i]:starts[i]+n].mean(0));face.extend([[a,j,k] for a,j in zip(ids,np.roll(ids,-1))]);owner.extend([i]*n)
coords=np.r_[coords,np.array(extra).reshape(-1,2)];face=np.array(face);owner=np.array(owner);co=co[owner];to=to[owner]
def bary(P,T):
 d=P-T[:,0];e=T[:,1]-T[:,0];f=T[:,2]-T[:,0];den=e[:,0]*f[:,1]-e[:,1]*f[:,0];u=(d[:,0]*f[:,1]-d[:,1]*f[:,0])/den;v=(e[:,0]*d[:,1]-e[:,1]*d[:,0])/den;return np.c_[1-u-v,u,v]
uv=coords[face].reshape(-1,2);ws=bary(uv,S[np.repeat(co,3)]);wt=bary(uv,T[np.repeat(to,3)]);violation=float(max(0,-ws.min(),-wt.min(),ws.max()-1,wt.max()-1));assert violation<1e-7
cross=det(coords[face]);assert np.all(cross>0)
_,first=np.unique(face.ravel(),return_index=True);assert len(first)==len(coords);geom=[];mismatch=[]
for R,w,ids in [(q['sourceRef'],ws,co),(b['sourceRef'],ws,co),(q['targetRef'],wt,to)]:
 P=np.einsum('ij,ijk->ik',w,R[np.repeat(ids,3)]);v=P[first];mismatch.append(float(np.linalg.norm(v[face.ravel()]-P,axis=1).max()));geom.append(v)
area=cross/2;sc=np.bincount(co,weights=area,minlength=len(S));tc=np.bincount(to,weights=area,minlength=len(T));rs=sh.area(sh.polygons(S));rt=sh.area(sh.polygons(T))
rep={'removedRedundantEdges':removed,'replacedOldSourceSegments':replaced,'newSourceEdges':len(changed),'vertices':len(coords),'triangles':len(face),'barycentricViolation':violation,'maxSharedMismatch':mismatch,'maxSourceFaceCoverageError':float(abs(sc-rs).max()),'maxTargetFaceCoverageError':float(abs(tc-rt).max()),'chartDomainArea':float(sh.area(domain)),'coveredArea':float(area.sum()),'movedSourceChartVertices':moved.tolist(),'maximumChartDisplacement':float(np.linalg.norm(X-X0,axis=1).max()),'minimumChartOrientationRatio':float(ratio.min()),'fixedBoundaryVertices':len(bd)}
(out/'rebuild.json').write_text(json.dumps(rep,indent=2));assert max(rep['maxSourceFaceCoverageError'],rep['maxTargetFaceCoverageError'])<1e-9 and max(mismatch)<2e-5
np.savez_compressed(out/'chart-adjustment.npz',originalSourceUV=q['sourceUV'],sourceUV=S,sourceVertexChart=X,originalSourceVertexChart=X0,sourceFaces=SF)
for name,P in [('genesis',geom[0]),('bridge',geom[1])]:
 d=out/name;d.mkdir(exist_ok=True);data=q.copy() if name=='genesis' else b.copy();data.update(sourceUV=S,chart=coords,faces=face,compact=P.astype(np.float32))
 if name=='genesis':data.update(idealCompact=P,idealTarget=geom[2],target=geom[2].astype(np.float32),compactFaceOwner=co,targetFaceOwner=to);np.savez_compressed(d/'conditioned-correspondence.npz',**data)
 else:data.update(idealFrozen=P,frozen=P.astype(np.float32));np.savez_compressed(d/'bridge-correspondence.npz',**data)
(out/'atlas').symlink_to((root/'atlas').resolve(),target_is_directory=True)
