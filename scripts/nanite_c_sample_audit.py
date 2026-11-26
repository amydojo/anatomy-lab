"""Scale-normalized independent sampled surface audit. Source-map proof remains separate."""
import argparse,json,pathlib,zipfile,time
import numpy as np
from scipy.spatial import cKDTree
from nanite_c_verify_reduce import source_glb,geometry,SHA
def sampler(p,f,n=512):
 p=p.astype('f8');tri=p[f];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)/2;cdf=np.cumsum(area);rng=np.random.default_rng(123895);t=(np.arange(n)+rng.random(n))/n*cdf[-1];ids=np.searchsorted(cdf,t);u=np.sqrt(rng.random(n));v=rng.random(n);q=(1-u[:,None])*tri[ids,0]+(u*(1-v))[:,None]*tri[ids,1]+(u*v)[:,None]*tri[ids,2];ext=np.vstack([p[np.argmin(p[:,a])] for a in range(3)]+[p[np.argmax(p[:,a])] for a in range(3)]);return np.vstack([q,ext])
def point_triangle_distances(q,tri):
 a=tri[:,0];u=tri[:,1]-a;v=tri[:,2]-a;x=q-a;scale=np.maximum.reduce([np.linalg.norm(u,axis=1),np.linalg.norm(v,axis=1),np.linalg.norm(v-u,axis=1)]);scale=np.where(scale>0,scale,1);u=u/scale[:,None];v=v/scale[:,None];x=x/scale[:,None];n=np.cross(u,v);n2=(n*n).sum(1);safe=np.where(n2>0,n2,1);dot=(x*n).sum(1);proj=x-(dot/safe)[:,None]*n;b1=(np.cross(proj,v)*n).sum(1)/safe;b2=(np.cross(u,proj)*n).sum(1)/safe;inside=(n2>0)&(b1>=0)&(b2>=0)&(b1+b2<=1)
 def segment(a,b):
  d=b-a;t=((x-a)*d).sum(1)/np.where((d*d).sum(1)>0,(d*d).sum(1),1);r=x-a-np.clip(t,0,1)[:,None]*d;return (r*r).sum(1)
 best=np.minimum.reduce([segment(np.zeros_like(u),u),segment(np.zeros_like(v),v),segment(u,v)]);best=np.where(inside,np.minimum(best,dot*dot/safe),best);return np.sqrt(np.maximum(best,0))*scale
def regression():
 for scale in [1,1e-3,1e-6,1e-9]:
  t=np.array([[[0.,0,0],[scale,0,0],[0,scale,0]]]);q=np.array([scale*.25,scale*.25,scale*.1]);assert abs(point_triangle_distances(q,t)[0]-scale*.1)<scale*1e-12
def distances(points,p,f):
 tri=p[f].astype('f8');center=tri.mean(1);radius=np.linalg.norm(tri-center[:,None,:],axis=2).max(1);maxr=radius.max();tree=cKDTree(center);d,_=tree.query(points);result=[]
 for q,upper in zip(points,d):
  idx=np.asarray(tree.query_ball_point(q,float(upper+maxr+1e-10)),dtype='i8');delta=np.linalg.norm(center[idx]-q,axis=1)-radius[idx];idx=idx[delta<=upper+1e-10];result.append(float(point_triangle_distances(q,tri[idx]).min()))
 return dict(samples=len(result),median=float(np.median(result)),p95=float(np.percentile(result,95)),maximum=max(result))
if __name__=='__main__':
 regression();ap=argparse.ArgumentParser();ap.add_argument('source');ap.add_argument('guard');ap.add_argument('audit');ap.add_argument('output');a=ap.parse_args();sz=zipfile.ZipFile(a.source);smraw=sz.read('manifest.json');sm={s['id']:s for s in json.loads(smraw)['structures']};audit=json.loads(pathlib.Path(a.audit).read_text());assert SHA(smraw)==audit['sourceManifestSha256'];rows=[]
 for r in audit['rows']:
  if r['selected']!='new':continue
  p0,f0=source_glb(sz,sm[r['id']]);z=(pathlib.Path(a.guard)/(r['id']+'.bld.gz')).read_bytes();assert SHA(z)==r['new']['sha256'];p,f,_,_=geometry(z);forward=distances(sampler(p0,f0),p,f);reverse=distances(sampler(p,f),p0,f0);bound=r['new']['certificate']['maxCorrespondenceDistance'];rows.append(dict(id=r['id'],sourceToDerivative=forward,derivativeToSource=reverse,certifiedUpperBound=bound,passed=max(forward['maximum'],reverse['maximum'])<=bound+1e-6))
 out=dict(sourceManifestSha256=audit['sourceManifestSha256'],rows=rows,samples=sum(x['sourceToDerivative']['samples']+x['derivativeToSource']['samples'] for x in rows),passed=all(x['passed'] for x in rows));pathlib.Path(a.output).write_text(json.dumps(out,indent=2));print({k:v for k,v in out.items() if k!='rows'})
 if not out['passed']:raise SystemExit(1)
