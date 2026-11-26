"""Independent certification of guarded-collapse candidates against the pinned exact GLBs."""
import argparse,gzip,hashlib,json,pathlib,struct,zipfile
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
SHA=lambda b:hashlib.sha256(b).hexdigest()
def source_glb(z,e):
 raw=z.read(e['file']);assert SHA(raw)==e['sha256'] and len(raw)==e['bytes'];jn=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+jn]);prim=d['meshes'][0]['primitives'][0];assert d['meshes'][0]['name']==e['id'];start=28+jn
 def access(k,dtype,width):
  a=d['accessors'][k];v=d['bufferViews'][a['bufferView']];return np.frombuffer(raw,dtype,a['count']*width,start+v.get('byteOffset',0)+a.get('byteOffset',0))
 p=access(prim['attributes']['POSITION'],'<f4',3).reshape(-1,3).astype('f8');p=np.column_stack(((240-p[:,0])*.005,(p[:,2]-1000)*.005,(p[:,1]-235)*.005)).astype('<f4');f=access(prim['indices'],'<u4',1).reshape(-1,3);assert len(p)==e['vertices'] and len(f)==e['triangles'];return p,f
def geometry(blob):
 raw=gzip.decompress(blob);magic,v,n,w=struct.unpack_from('<4sIII',raw);assert magic==b'BLD1' and w in (2,4) and len(raw)==16+v*12+n*w;p=np.frombuffer(raw,'<f4',3*v,16).reshape(-1,3);f=np.frombuffer(raw,'<u2' if w==2 else '<u4',n,16+12*v).reshape(-1,3);assert np.isfinite(p).all() and f.max()<v;return p,f,w,raw
def normal(p,f):
 a,b,c=p[f].astype('f8').transpose(1,0,2);return np.cross(b-a,c-a)
def topology(f,n):
 pairs=np.vstack((f[:,[0,1]],f[:,[1,2]],f[:,[2,0]])).astype('i8');pairs.sort(axis=1);key=pairs[:,0]*n+pairs[:,1];unique,inv,ct=np.unique(key,return_inverse=True,return_counts=True);a,b=unique//n,unique%n;used=np.unique(f);graph=coo_matrix((np.ones(len(a)),(a,b)),shape=(n,n)).tocsr();components=connected_components(graph,directed=False,return_labels=False)-(n-len(used));boundary=unique[ct==1];degree=np.bincount(np.r_[boundary//n,boundary%n],minlength=n);bg=coo_matrix((np.ones(len(boundary)),(boundary//n,boundary%n)),shape=(n,n)).tocsr();bc=connected_components(bg,directed=False,return_labels=False)-np.count_nonzero(degree==0);return (int(components),int(len(used)-len(unique)+len(f)),int(bc),int(np.count_nonzero((degree!=0)&(degree!=2))),int(np.count_nonzero(ct>2))),unique,ct,inv
def verify(p0,f0,p,f,m,limit):
 assert len(m)==len(p0) and m.max()<len(p);error=float(np.linalg.norm(p0.astype('f8')-p[m].astype('f8'),axis=1).max());assert error<=limit
 same=np.all(p0.view('u4')==p[m].view('u4'),axis=1);assert np.bincount(m[same],minlength=len(p)).min()>0
 mapped=m[f0];a,b,c=mapped.T;distinct=(a!=b)&(b!=c)&(c!=a);ret=mapped[distinct];assert np.array_equal(ret,f);assert len(np.unique(np.sort(f,axis=1),axis=0))==len(f)
 assert np.all((normal(p0,f0[distinct])*normal(p,f)).sum(1)>0)
 s0,k0,ct0,inv0=topology(f0,len(p0));s,k,ct,_=topology(f,len(p));assert s0==s
 collapsed=mapped[~distinct];assert np.isin(collapsed,np.unique(f)).all();lo=collapsed.min(1);hi=collapsed.max(1);ed=lo!=hi;assert np.isin(lo[ed].astype('i8')*len(p)+hi[ed],k).all()
 fn=normal(p0,f0);fn/=np.maximum(np.linalg.norm(fn,axis=1)[:,None],1e-30);order=np.argsort(inv0,kind='stable');starts=np.r_[0,np.cumsum(ct0)[:-1]];two=starts[ct0==2];fa=order[two]%len(f0);fb=order[two+1]%len(f0);sharp=k0[ct0==2][(fn[fa]*fn[fb]).sum(1)<np.cos(np.deg2rad(45))];locked=np.unique(np.r_[sharp,k0[ct0!=2]]);va=locked//len(p0);vb=locked%len(p0);v=np.unique(np.r_[va,vb]);assert np.array_equal(p[m[v]].view('u4'),p0[v].view('u4'));ka=np.minimum(m[va],m[vb]).astype('i8')*len(p)+np.maximum(m[va],m[vb]);assert np.isin(ka,k).all()
 return dict(maxCorrespondenceDistance=error,limit=limit,topology=list(s),lockedFeatureEdges=len(locked),lockedFeatureVertices=len(v),normalReversals=0,collapsedFaces=len(collapsed),faceMapVerified=True)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('source');ap.add_argument('derivatives');ap.add_argument('guard');ap.add_argument('out');a=ap.parse_args();sz=zipfile.ZipFile(a.source);dz=zipfile.ZipFile(a.derivatives);smraw=sz.read('manifest.json');dmraw=dz.read('manifest.json');sm=json.loads(smraw);dm=json.loads(dmraw);assert SHA(smraw)==dm['sourceManifestSha256']=='e8c22674b3f29c3db3671632cb4ba0ccfcf7168a319dc9f77fb3c3773f09273f';assert SHA(dmraw)=='a13a90aabd010a5bb1ac76357573441fc60133e62405ad96d079451a02166543';assert len(sm['structures'])==143
 out=pathlib.Path(a.out);out.mkdir(exist_ok=True,parents=True);src={x['id']:x for x in sm['structures']};rows=[];errors=[]
 for e in dm['structures']:
  fid=e['id'];rpath=pathlib.Path(a.guard)/(fid+'.json');r=json.loads(rpath.read_text()) if rpath.exists() else None;old=next(l for l in e['levels'] if l['level']==e['overviewLevel']);row=dict(id=fid,sourceTriangles=e['exact']['triangles'],baselineTriangles=old['triangles'],baselineGpuBytes=old['gpuBytes'],baselineTransferBytes=old['bytes'],new=None);best=r and r['best']
  if best:
   try:
    p0,f0=source_glb(sz,src[fid]);b=(rpath.parent/(fid+'.bld.gz')).read_bytes();mb=(rpath.parent/(fid+'.map.bin')).read_bytes();assert SHA(b)==best['sha256'] and SHA(mb)==best['mapSha256'];p,f,w,raw=geometry(b);assert SHA(raw)==best['decodedSha256'];m=np.frombuffer(mb,'<u4');limit=float(np.linalg.norm(np.array(e['max'])-np.array(e['min']))*.012);cert=verify(p0,f0,p,f,m,limit);row['new']=dict(triangles=len(f),vertices=len(p),bytes=len(b),gpuBytes=16*len(p)+f.size*w,sha256=SHA(b),mapSha256=SHA(mb),certificate=cert,passNumber=best['passNumber'],trialCount=len(r['trials']))
   except Exception as ex:errors.append(dict(id=fid,error=repr(ex)))
  row['selected']='new' if row['new'] and row['new']['gpuBytes']<old['gpuBytes'] else 'baseline';rows.append(row)
 summary=dict(labels=len(rows),verifiedNew=sum(x['new'] is not None for x in rows),selectedNew=sum(x['selected']=='new' for x in rows),sourceTriangles=sum(x['sourceTriangles'] for x in rows),overviewTriangles=sum(x['new']['triangles'] if x['selected']=='new' else x['baselineTriangles'] for x in rows),overviewGpuBytes=sum(x['new']['gpuBytes'] if x['selected']=='new' else x['baselineGpuBytes'] for x in rows),overviewTransferBytes=sum(x['new']['bytes'] if x['selected']=='new' else x['baselineTransferBytes'] for x in rows),errors=errors);(out/'independent-reduction-audit.json').write_text(json.dumps(dict(sourceManifestSha256=SHA(smraw),baselineDerivativeManifestSha256=SHA(dmraw),summary=summary,rows=rows),indent=2));print(summary)
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
