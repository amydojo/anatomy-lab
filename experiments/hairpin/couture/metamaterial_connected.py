"""METAMATERIAL 015 — controlled structural expression.

Pinned baseline 0e03518cd474a76a069061a60216257bf24183e6.
Reproduce from ORGANOGENESIS root containing connected/connected.npz.
Usage: python metamaterial_connected.py <reference-root> <output-directory>
Requires NumPy, SciPy, Shapely. Actual archived indexed geometry, no new faces.
Full executed source, timing, interval and diagnostic-native pipeline:
METAMATERIAL-research.zip SHA256
106313e9779bcfa306859b8858419612baaf6d54e3c1f2b4a2a2b5060dad8bcb.
Source bundle SHA256 cc23c99f7296a4714dbfc323dd884d6485ed7984d74b0d45313f3d4f5879181b.

Measured same-grid regular passes original/elastic/ARAP/constrained/
regularized/minimax: 17/4/3/65/65/65 of 65. Historical original sampling
21/65. Three orientation-constrained candidates pass 65 PL boundary
intervals and direct endpoint interval; min area bound 2.0495741e-10.
Minimax peak principal stretch 3.496094 vs 192.499193 basic constrained,
edge stretch 3.007920 vs 89.428874. Critical 233 projected contacts,
77 duplicated seam pairs, zero outside-ancestor, zero weld/loop error.
Open regional research derivative; no closed-frame or physical claim.

Preserve original 25724-face paired candidate SHA
211315c779acf05469b08a39586ec9b970a173ad0ef123491e666365fec38400
and 24901-face event arrays SHA
0d453341937fb15f21a33645051253838117d73538b4277724e36a45212924ea.
A original 378 intervals unchanged. Arc-length PL retiming passes all
155 regular phase records (25/77/5/24/24); B 47/47 regular at 24fps.
Independent smooth PCHIP/cubic spline quarter samples and completed
Bernstein interval tests pass bridge80, TENSION160, opening65 (closing
reverse), correction2 nonzero intervals. Full repeat timed out,
overwriting some detailed rows; manifest preserves observed console
summaries, surviving detailed report, resumable source. No native claim.
155 decoded-frame CPU diagnostic, 24fps, 6.458333s. No shader parity.

Native paired/event workflow 46106695164, connector 46105616837,
EXAPTATION 46104505199, corrected FUSION 46103224550 and native branch
46103622069 all queued without artifacts at inspection. No redundant new
workflow trigger. Native script in research archive is staged but
unexecuted. No actual modifier-stage attribution or evaluated rear
correspondence; original 107 penetrations remain gated. No source repair,
protected geometry, physics, runtime, controller, anatomy or production
changes. Independent workstreams retain authority.
"""
import numpy as np, json,sys
from pathlib import Path
from scipy.sparse import coo_matrix,diags,bmat,eye,hstack,vstack
from scipy.sparse.linalg import splu
from scipy.optimize import linprog
from shapely.geometry import Polygon
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
q=dict(np.load(root/'connected/connected.npz'));X=q['poses'][0].astype(float);D=q['poses'][-1].astype(float);F=q['faces'];W=q['weldMap'];n=len(X)
E,C=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),1),axis=0,return_counts=True);bd=E[C==1];fixed=np.unique(bd);free=np.setdiff1d(np.arange(n),fixed);adj={}
for i,j in bd:adj.setdefault(i,[]).append(j);adj.setdefault(j,[]).append(i)
loops=[];seen=set(adj)
while seen:
 l=[min(seen)];prev=None
 while True:
  j=next(i for i in adj[l[-1]] if i!=prev)
  if j==l[0]:break
  l.append(j);prev=l[-2]
 seen-=set(l);loops.append(np.array(l))
loops.sort(key=lambda l:Polygon(X[l,:2]).area,reverse=True);assert len(loops)==2
A=E[:,0];B=E[:,1];L0=np.linalg.norm(X[A,:2]-X[B,:2],axis=1);weights=1/np.maximum(L0,np.percentile(L0,15));weights/=np.median(weights)
L=coo_matrix((np.r_[weights,weights,-weights,-weights],(np.r_[A,B,A,B],np.r_[A,B,B,A])),shape=(n,n)).tocsc();lu=splu(L[free][:,free]);Lf=L[free][:,fixed]
# Elastic and ARAP baselines: fixed actual boundary, no orientation barrier.
elastic=X.copy();elastic[fixed]=D[fixed];elastic[free,1]=X[free,1]+lu.solve(-Lf@(D[fixed,1]-X[fixed,1]))
Y=elastic[:,:2].copy();orig=X[:,:2];d=orig[A]-orig[B]
for k in range(12):
 cur=Y[A]-Y[B];S=np.zeros((n,2,2));outer=weights[:,None,None]*cur[:,:,None]*d[:,None,:];np.add.at(S,A,outer);np.add.at(S,B,outer);u,s,v=np.linalg.svd(S);R=u@v;bad=np.linalg.det(R)<0;u[bad,:,-1]*=-1;R=u@v
 target=np.einsum('eij,ej->ei',(R[A]+R[B])*.5,d)*weights[:,None];rhs=np.zeros((n,2));np.add.at(rhs,A,target);np.add.at(rhs,B,-target);Y[free]=lu.solve(rhs[free]-Lf@Y[fixed])
arap=X.copy();arap[:,:2]=Y
# Longitudinal L1 redistribution: projected signed area is affine in y.
x=X[:,0];tri=X[F];base=-np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])[:,2];assert base.min()>0
coef=np.c_[x[F[:,2]]-x[F[:,1]],x[F[:,0]]-x[F[:,2]],x[F[:,1]]-x[F[:,0]]];coef=-coef
assert np.max(abs(base+(coef*(D[:,1]-X[:,1])[F]).sum(1)+np.cross(D[F][:,1]-D[F][:,0],D[F][:,2]-D[F][:,0])[:,2]))<1e-12
active=np.flatnonzero(abs(D[:,1]-X[:,1])>0);active_set=set(active.tolist())
for _ in range(3):active_set.update(E[np.isin(E,list(active_set)).any(1)].ravel().tolist())
active=np.array(sorted(active_set-set(fixed.tolist())));na=len(active);iv=np.full(n,-1);iv[active]=np.arange(na);target=D[:,1]-X[:,1];fixed_disp=target.copy();fixed_disp[active]=0
row=np.repeat(np.arange(len(F)),3);col=iv[F].ravel();c=coef.ravel();use=col>=0;M=coo_matrix((c[use],(row[use],col[use])),shape=(len(F),na)).tocsr();constant=base+(coef*fixed_disp[F]).sum(1);nonzero=np.diff(M.indptr)>0
ulp=np.spacing(np.abs(X[:,1]).astype(np.float32)).astype(float);roundbound=(abs(coef)*ulp[F]).sum(1)*.65
floor=np.minimum(.85*base,np.maximum(.25*base,roundbound));scale=np.maximum(abs(coef).max(1),1e-16);rhs=(constant-floor)/scale
M=diags(1/scale)@M
I=eye(na,format='csr');zero=coo_matrix((len(F),na)).tocsr();G=bmat([[-M[nonzero],zero[nonzero]],[I,-I],[-I,-I]],format='csr');h=np.r_[rhs[nonzero],target[active],-target[active]]
assert np.all(constant[~nonzero]>=floor[~nonzero]-1e-12)
opts={'dual_feasibility_tolerance':1e-9,'primal_feasibility_tolerance':1e-9}
res=linprog(np.r_[np.zeros(na),np.ones(na)],A_ub=G,b_ub=h,bounds=[(-.5,.5)]*na+[(0,None)]*na,method='highs',options=opts);assert res.success,res.message
opt=X.copy();opt[:,1]+=fixed_disp;opt[active,1]+=res.x[:na]
# Edge-gradient regularization with unchanged hard orientation constraints.
ee=E[(iv[E]>=0).any(1)];nr=len(ee);ri=np.repeat(np.arange(nr),2);ci=iv[ee].ravel();vv=np.tile([1.,-1.],nr);valid=ci>=0;H=coo_matrix((vv[valid],(ri[valid],ci[valid])),shape=(nr,na)).tocsr();edgefixed=fixed_disp[ee[:,0]]-fixed_disp[ee[:,1]];edtarget=(elastic[ee[:,0],1]-X[ee[:,0],1])-(elastic[ee[:,1],1]-X[ee[:,1],1])-edgefixed
J=eye(nr,format='csr');zeros=lambda n,m:coo_matrix((n,m)).tocsr();G2=vstack([hstack([G,zeros(G.shape[0],nr)]),hstack([H,zeros(nr,na),-J]),hstack([-H,zeros(nr,na),-J])],format='csr');h2=np.r_[h,edtarget,-edtarget];length=np.linalg.norm(X[ee[:,0],:2]-X[ee[:,1],:2],axis=1);ew=1/np.maximum(length,np.percentile(length,20));ew/=np.median(ew)
# Preserve actual infeasible bounded alternative.
bounded=linprog(np.r_[np.zeros(na),np.ones(na),.15*ew],A_ub=G2,b_ub=h2,bounds=[(-.350001,.350001)]*na+[(0,None)]*(na+nr),method='highs',options=opts)
res2=linprog(np.r_[np.zeros(na),np.ones(na),.15*ew],A_ub=G2,b_ub=h2,bounds=[(-.5,.5)]*na+[(0,None)]*(na+nr),method='highs',options=opts)
reg=None
if res2.success:
 reg=X.copy();reg[:,1]+=fixed_disp;reg[active,1]+=res2.x[:na]
# Minimize worst intrinsic displacement-gradient component; secondary
# fidelity solve allows only 5% margin above the optimized bound.
T=X[F];u=T[:,1]-T[:,0];v=T[:,2]-T[:,0];nn=np.cross(u,v);nn/=np.linalg.norm(nn,axis=1)[:,None];e1=u/np.linalg.norm(u,axis=1)[:,None];e2=np.cross(nn,e1);Q=np.stack([np.stack([np.sum(u*e1,1),np.sum(v*e1,1)],1),np.stack([np.sum(u*e2,1),np.sum(v*e2,1)],1)],1);Mi=np.linalg.inv(Q);gradcoef=np.stack([-Mi.sum(1),Mi[:,0,:],Mi[:,1,:]],1).transpose(0,2,1).reshape(-1,3);ff=np.repeat(F,2,axis=0);rr=np.repeat(np.arange(len(ff)),3);cc=iv[ff].ravel();ok=cc>=0;Dg=coo_matrix((gradcoef.ravel()[ok],(rr[ok],cc[ok])),shape=(len(ff),na)).tocsr();gfix=(gradcoef*fixed_disp[ff]).sum(1);gs=np.maximum(abs(gradcoef).max(1),1);Dg=diags(1/gs)@Dg;gfix/=gs;sel=np.diff(Dg.indptr)>0;minfixed=float(abs(gfix[~sel]*gs[~sel]).max());Dg=Dg[sel];gfix=gfix[sel];gs=gs[sel];tau=coo_matrix((-1/gs,(np.arange(len(gs)),np.zeros(len(gs),int))),shape=(len(gs),1)).tocsr();G3=vstack([hstack([-M[nonzero],zeros(int(nonzero.sum()),1)]),hstack([Dg,tau]),hstack([-Dg,tau])],format='csr');h3=np.r_[rhs[nonzero],-gfix,gfix];res3=linprog(np.r_[np.zeros(na),1.],A_ub=G3,b_ub=h3,bounds=[(-.5,.5)]*na+[(minfixed,None)],method='highs',options=opts)
mini=None;res4=None
if res3.success:
 bound=res3.x[-1]*1.05+1e-5;G4=vstack([G,hstack([Dg,zeros(len(gs),na)]),hstack([-Dg,zeros(len(gs),na)])],format='csr');h4=np.r_[h,bound/gs-gfix,bound/gs+gfix];res4=linprog(np.r_[np.zeros(na),np.ones(na)],A_ub=G4,b_ub=h4,bounds=[(-.5,.5)]*na+[(0,None)]*na,method='highs',options=opts)
 if res4.success:
  mini=X.copy();mini[:,1]+=fixed_disp;mini[active,1]+=res4.x[:na]
# Audit actual simulated float32 geometry. Critical slit is not regular.
def audit(P):
 rows=[];prev=None;N0=np.cross(X[F][:,1]-X[F][:,0],X[F][:,2]-X[F][:,0])
 for k,Z in enumerate(P):
  T=Z[F].astype(float);N=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);ar=np.linalg.norm(N,axis=1)/2;ps=[Polygon(Z[l,:2]) for l in loops];domain=Polygon(ps[0].exterior.coords,[ps[1].exterior.coords]);err=abs(domain.area+N[:,2].sum()/2);r={'frame':k,'minArea':float(ar.min()),'belowFloor':int((ar<1e-10).sum()),'projectedNonpositive':int((N[:,2]>=0).sum()),'temporalReversals':0 if prev is None else int((np.sum(N*prev,axis=1)<0).sum()),'opposedReferenceNormals':int((np.sum(N*N0,axis=1)<=0).sum()),'domainValid':bool(domain.is_valid),'areaError':float(err),'apertureArea':float(ps[1].area)};r['pass']=not any(r[v] for v in ['belowFloor','projectedNonpositive','temporalReversals','opposedReferenceNormals']) and r['domainValid'] and err<1e-8 and r['apertureArea']>0;rows.append(r);prev=N
 return {'regularPasses':sum(x['pass'] for x in rows[1:]),'regularCount':len(rows)-1,'peakProjectedNonpositive':max(x['projectedNonpositive'] for x in rows),'peakBelowFloor':max(x['belowFloor'] for x in rows),'peakOpposed':max(x['opposedReferenceNormals'] for x in rows),'peakTemporal':max(x['temporalReversals'] for x in rows),'maxApertureArea':max(x['apertureArea'] for x in rows),'minArea':min(x['minArea'] for x in rows),'rows':rows}
report={};seqs={};s=np.linspace(0,1,66)
for name,Y in [('original',D),('elastic',elastic),('arap',arap),('constrained',opt)]+([('regularized',reg)] if reg is not None else [])+([('minimax',mini)] if mini is not None else []):
 P=(X[None]+s[:,None,None]*(Y-X)[None]).astype(np.float32);r=audit(P);r['maxReferenceDisplacementError']=float(np.linalg.norm(Y-D,axis=1).max());r['rmsReferenceDisplacementError']=float(np.sqrt(np.mean(np.sum((Y-D)**2,1))));r['maxDisplacement']=float(np.linalg.norm(Y-X,axis=1).max());report[name]=r;seqs[name]=P
 print(name,{k:v for k,v in r.items() if k!='rows'},flush=True)
report['optimization']={'activeVertices':na,'constraints':int(nonzero.sum()),'linearProgramObjective':float(res.fun),'minimaxGradientStatus':res3.message,'minimaxGradientObjective':float(res3.fun) if res3.success else None,'minimaxFidelityStatus':res4.message if res4 is not None else None,'regularizedLPStatus':res2.message,'regularizedLPObjective':float(res2.fun) if res2.success else None,'boundedTrialStatus':bounded.message,'lpStatus':res.message,'scope':'Fixed XZ and actual boundary positions, longitudinal L1 fidelity, hard projected orientation constraints. No closed-frame qualification.'}
(out/'comparison.json').write_text(json.dumps(report,indent=2));np.savez_compressed(out/'connected-comparison.npz',**seqs,faces=F,weldMap=W,materialChart=q['materialChart'],nativeParent=q['nativeParent'],commonFaceOwner=q['commonFaceOwner'],compactRefOwner=q['compactRefOwner'],outerLoop=loops[0],innerLoop=loops[1])
assert 'minimax' in report and report['minimax']['regularPasses']==65
