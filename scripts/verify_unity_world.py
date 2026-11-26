#!/usr/bin/env python3
"""Verify pinned archive bytes and publish only exact new assets; no source reacquisition."""
import hashlib,json,pathlib,struct,zipfile,sys,math,array
ROOT=pathlib.Path(__file__).resolve().parents[1]
ARCHIVE='1d7f8d54a5c683ac6f675a2495cb32585dc1d097058fd0f683418db6808ea58e'
MANIFEST='e8c22674b3f29c3db3671632cb4ba0ccfcf7168a319dc9f77fb3c3773f09273f'
def sha(b):return hashlib.sha256(b).hexdigest()
def require(c,msg):
 if not c:raise ValueError(msg)
def verify(path,publish=False):
 require(sha(path.read_bytes())==ARCHIVE,'archive digest')
 with zipfile.ZipFile(path) as z:
  mb=z.read('manifest.json');require(sha(mb)==MANIFEST,'manifest digest')
  m=json.loads(mb);q=json.loads(z.read('qualification.json'));inv=json.loads(z.read('source-inventory.json'));by={s['name']:s for s in inv}
  ss=m['structures'];require(len(ss)==len(by)==143 and len({s['id'] for s in ss})==len({s['source_sha256'] for s in ss})==143,'unique inventory')
  require(m['revision']=='53bd62452ae3fc34ba0fa6188517cd8ca9bf4a10' and q['manifestSha256']==MANIFEST and sum(s['reused'] for s in ss)==61,'pinned revision and reuse')
  require(sum(s['triangles'] for s in ss)==6070400 and sum(s['vertices'] for s in ss)==3035302,'mesh totals')
  require(set(z.namelist())=={s['file'] for s in ss}|{'manifest.json','qualification.json','registration-metadata.json','source-inventory.json'},'archive inventory')
  for s in ss:
   f=s['file'];require(f==s['id']+'.glb' and pathlib.PurePosixPath(f).name==f,'safe file name')
   b=z.read(f);require(len(b)==s['bytes'] and sha(b)==s['sha256'] and by[s['source_name']]['source_sha256']==s['source_sha256'],f+' hashes')
   require(struct.unpack_from('<III',b)==(0x46546c67,2,len(b)),f+' header')
   n,k=struct.unpack_from('<II',b,12);require(k==0x4e4f534a,f+' JSON')
   d=json.loads(b[20:20+n]);size,kind=struct.unpack_from('<II',b,20+n);require(kind==0x004e4942 and 28+n+size==len(b),f+' BIN')
   prim=d['meshes'][0]['primitives'][0];require(d['meshes'][0]['name']==s['id'],f+' mesh name')
   def values(i,typ,components):
    a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];off=28+n+v.get('byteOffset',0)+a.get('byteOffset',0)
    code={5126:'f',5125:'I',5123:'H'}[a['componentType']];require(a['componentType'] in typ and v.get('byteStride',struct.calcsize(code)*components)==struct.calcsize(code)*components,f+' format')
    result=array.array(code);result.frombytes(b[off:off+a['count']*components*result.itemsize]);require(len(result)==a['count']*components,f+' accessor length')
    if sys.byteorder!='little':result.byteswap()
    return result
   p=values(prim['attributes']['POSITION'],{5126},3);i=values(prim['indices'],{5125,5123},1)
   require(len(p)==3*s['vertices'] and len(i)==3*s['triangles'] and max(i)<s['vertices'] and all(map(math.isfinite,p)),f+' actual mesh')
   require([min(p[k::3]) for k in range(3)]==s['min'] and [max(p[k::3]) for k in range(3)]==s['max'],f+' bounds')
   if s['reused'] and publish:require(sha((ROOT/'assets/atlas/vhf/axis/v1'/f).read_bytes())==s['sha256'],f+' existing AXIS mismatch')
  if publish:
   out=ROOT/'assets/atlas/vhf/unity/v1';out.mkdir(parents=True,exist_ok=True)
   for s in ss:
    if not s['reused']:(out/s['file']).write_bytes(z.read(s['file']))
   for f in ('manifest.json','qualification.json','registration-metadata.json','source-inventory.json'):(out/f).write_bytes(z.read(f))
 print('Verified 143 GLBs, 6070400 triangles, 3035302 vertices; exact pinned archive and manifest.')
if __name__=='__main__':verify(pathlib.Path(sys.argv[1]),'--publish' in sys.argv[2:])
