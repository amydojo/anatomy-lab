"""Conservative correspondence-mapped geometry research; no source mutation."""
import argparse,gzip,hashlib,json,struct,zipfile,time,pathlib
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
SHA=lambda b:hashlib.sha256(b).hexdigest()
def load(z,e):
 l=next(x for x in e['levels'] if x['level']=='exact-display');b=z.read(l['file']);assert SHA(b)==l['sha256'];b=gzip.decompress(b);assert SHA(b)==l['decodedSha256'];_,v,n,w=struct.unpack_from('<4sIII',b);return np.frombuffer(b,'<f4',v*3,16).reshape(-1,3).copy(),np.frombuffer(b,'<u2' if w==2 else '<u4',n,16+v*12).reshape(-1,3).astype('i4')
def edges(f,n):
 pairs=np.concatenate((f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]));pairs.sort(1);keys=pairs[:,0].astype('i8')*n+pairs[:,1];order=np.argsort(keys,kind='stable');keys=keys[order];st=np.r_[0,np.flatnonzero(keys[1:]!=keys[:-1])+1];ct=np.diff(np.r_[st,len(keys)]);return keys[st],ct,order,st
def signature(f,n):
 k,ct,_,_=edges(f,n);a=k//n;b=k%n;used=np.unique(f);adj=csr_matrix((np.ones(len(k),dtype='u1'),(a,b)),shape=(n,n));components=connected_components(adj,directed=False,return_labels=False)-(n-len(used));boundary=k[ct==1];deg=np.bincount(np.r_[boundary//n,boundary%n],minlength=n);bv=np.flatnonzero(deg);ba=csr_matrix((np.ones(len(boundary),dtype='u1'),(boundary//n,boundary%n)),shape=(n,n));bc=connected_components(ba,directed=False,return_labels=False)-(n-len(bv));return [int(components),int(len(used)-len(k)+len(f)),int(bc),int(np.count_nonzero((deg!=0)&(deg!=2))),int(np.count_nonzero(ct>2))],k,ct
def normals(p,f):
 a=p[f].astype('f8');return np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
def cert(p0,f0,p,m,limit,sig):
 mapped=m[f0];a,b,c=mapped.T;distinct=(a!=b)&(b!=c)&(a!=c);ret=mapped[distinct];old=normals(p0,f0[distinct]);new=normals(p,ret);dot=(old*new).sum(1);zero=(np.linalg.norm(old,axis=1)==0)|(np.linalg.norm(new,axis=1)==0);reverse=int(np.count_nonzero((dot<=0)&~zero));zeros=int(zero.sum());_,first,counts=np.unique(np.sort(ret,axis=1),axis=0,return_index=True,return_counts=True)
 duplicates=int(np.sum(counts-1));f=ret[np.sort(first)].astype('i4');ts,k,ct=signature(f,len(p));used=np.zeros(len(p),bool);used[f.ravel()]=True;collapsed=mapped[~distinct];lost=int(np.count_nonzero(~used[collapsed].all(1)));n=len(p)
 if len(collapsed):
  lo=collapsed.min(1);hi=collapsed.max(1);ck=lo.astype('i8')*n+hi;mask=lo!=hi;idx=np.searchsorted(k,ck[mask]);lost+=int(np.count_nonzero((idx>=len(k))|(k[np.minimum(idx,len(k)-1)]!=ck[mask])))
 err=float(np.linalg.norm(p0.astype('f8')-p[m].astype('f8'),axis=1).max());pass_=err<=limit and ts==sig and not(reverse or zeros or duplicates or lost) and len(f)<len(f0)*.95 and len(p)<len(p0)*.95
 return f,dict(passed=pass_,triangles=len(f),vertices=len(p),error=err,limit=limit,normalReversals=reverse,zeroNormals=zeros,duplicateFaces=duplicates,lostCollapsedSupport=lost,topologyChanged=ts!=sig,signature=ts)
def collapse(p,f,r,limit,locked,sharp,p0,f0,source_map,guard=True):
 n=len(p);k,ct,order,st=edges(f,n);a=k//n;b=k%n;adj=csr_matrix((np.ones(2*len(k),dtype='u1'),(np.r_[a,b],np.r_[b,a])),shape=(n,n));adj.sort_indices()
 bad=k[ct!=2];lock=locked.copy();lock[bad//n]=True;lock[bad%n]=True;norm=normals(p,f);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-30);two=st[ct==2];ids1=order[two]%len(f);ids2=order[two+1]%len(f);crease=(norm[ids1]*norm[ids2]).sum(1)<sharp;creasekeys=k[ct==2][crease];lock[creasekeys//n]=True;lock[creasekeys%n]=True
 dist=np.linalg.norm(p[a].astype('f8')-p[b].astype('f8'),axis=1);src=np.r_[a,b];dst=np.r_[b,a];d=np.tile(dist,2);eligible=(~lock[src])&(d>0)&(r[src]+d<=limit)&np.tile(ct==2,2);src=src[eligible];dst=dst[eligible];d=d[eligible];o=np.lexsort((dst,d,src));src=src[o];dst=dst[o];d=d[o];first=np.r_[True,src[1:]!=src[:-1]] if len(src) else np.array([],bool);src=src[first];dst=dst[first];d=d[first];target=np.arange(n,dtype='i4');target[src]=dst
 safe=np.ones(n,bool)
 for j in range(3):
  v=f[:,j];to=target[v];changed=v!=to;test=changed&(to!=f[:,(j+1)%3])&(to!=f[:,(j+2)%3]);ff=f[test].copy();ff[:,j]=to[test];nn=normals(p,ff);ln=np.linalg.norm(nn,axis=1);unit=nn/np.maximum(ln[:,None],1e-30);bad=(ln==0)|((unit*norm[test]).sum(1)<.5);safe[v[test][bad]]=False
 blocked=np.zeros(n,bool);mapping=np.arange(n,dtype='i4');linkfail=0;localfail=int((~safe[src]).sum());order=np.argsort(d,kind='stable')
 for v,t in zip(src[order],dst[order]):
  if blocked[v] or blocked[t] or not safe[v]:continue
  nv=adj.indices[adj.indptr[v]:adj.indptr[v+1]];nt=adj.indices[adj.indptr[t]:adj.indptr[t+1]]
  if len(np.intersect1d(nv,nt,assume_unique=True))!=2:linkfail+=1;continue
  mapping[v]=t;blocked[v]=blocked[t]=True;blocked[nv]=True;blocked[nt]=True
 orig=source_map[f0];oldnorm=normals(p0,f0);rolled=0
 while guard:
  trial=mapping[orig];a,b,c=trial.T;valid=(a!=b)&(b!=c)&(a!=c);dots=(oldnorm[valid]*normals(p,trial[valid])).sum(1);bad=orig[valid][dots<=0];undo=np.unique(bad);undo=undo[mapping[undo]!=undo]
  if not len(undo):break
  mapping[undo]=undo;rolled+=len(undo)
 active=np.flatnonzero(mapping!=np.arange(n));newr=r.copy();np.maximum.at(newr,mapping[active],r[active]+np.linalg.norm(p[active].astype('f8')-p[mapping[active]].astype('f8'),axis=1));accepted=len(active)
 u,inv=np.unique(mapping,return_inverse=True);mf=inv[f];a,b,c=mf.T;keep=(a!=b)&(b!=c)&(a!=c);return p[u],mf[keep].astype('i4'),newr[u],inv.astype('i4'),lock[u],dict(accepted=accepted,locked=int(lock.sum()),localNormalRejected=localfail,linkRejected=linkfail,accumulatedNormalRollbacks=int(rolled))
def run(z,e,out,passes=12,guard=True,fraction=.012):
 p0,f0=load(z,e);p=p0;f=f0;mapping=np.arange(len(p),dtype='i4');radius=np.zeros(len(p));locked=np.zeros(len(p),bool);sig,_,_=signature(f,len(p));limit=float(np.linalg.norm(np.array(e['max'])-np.array(e['min']))*fraction);trials=[];best=None;t=time.perf_counter()
 for i in range(passes):
  p,f,radius,remap,locked,stats=collapse(p,f,radius,limit,locked,np.cos(np.deg2rad(45)),p0,f0,mapping,guard);mapping=remap[mapping];certf,result=cert(p0,f0,p,mapping,limit,sig);result.update(passNumber=i+1,**stats);trials.append(result)
  if result['passed']:best=(p.copy(),certf.copy(),mapping.copy(),result.copy())
  if not stats['accepted'] or result['topologyChanged'] or result['normalReversals'] or result['zeroNormals'] or result['duplicateFaces'] or result['lostCollapsedSupport']:break
 report=dict(id=e['id'],sourceHash=e['sourceHash'],sourceTriangles=len(f0),sourceVertices=len(p0),sourceSignature=sig,limit=limit,elapsedMs=(time.perf_counter()-t)*1000,trials=trials,best=None)
 if best:
  p,f,m,b=best;w=2 if len(p)<=65536 else 4;raw=struct.pack('<4sIII',b'BLD1',len(p),f.size,w)+p.astype('<f4').tobytes()+f.astype('<u2' if w==2 else '<u4').tobytes();zipped=gzip.compress(raw,6,mtime=0);(out/(e['id']+'.bld.gz')).write_bytes(zipped);mb=m.astype('<u4').tobytes();(out/(e['id']+'.map.bin')).write_bytes(mb);report['best']=dict(**b,bytes=len(zipped),gpuBytes=len(p)*16+f.size*w,sha256=SHA(zipped),decodedSha256=SHA(raw),mapSha256=SHA(mb))
 (out/(e['id']+'.json')).write_text(json.dumps(report,indent=2));print(e['id'],report['best']['triangles'] if best else None,[(x['passNumber'],x['triangles'],x['passed'],x['normalReversals'],x['lostCollapsedSupport']) for x in trials],flush=True)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('input');ap.add_argument('output');ap.add_argument('--passes',type=int,default=12);ap.add_argument('--cohort',action='store_true');ap.add_argument('--unguarded',action='store_true');ap.add_argument('--regional',action='store_true');a=ap.parse_args();z=zipfile.ZipFile(a.input);raw=z.read('manifest.json');assert SHA(raw)=='a13a90aabd010a5bb1ac76357573441fc60133e62405ad96d079451a02166543';manifest=json.loads(raw);assert len(manifest['structures'])==143;out=pathlib.Path(a.output);out.mkdir(exist_ok=False);es=sorted(manifest['structures'],key=lambda e:e['exact']['triangles'],reverse=True)
 for e in es[:8] if a.cohort else es:run(z,e,out,a.passes,not a.unguarded,.004 if a.regional else .012)
