"""Independent UNITY geometry audit; no inference of physical units."""
import argparse, hashlib, json, struct, zipfile
from pathlib import Path
import numpy as np

REV='53bd62452ae3fc34ba0fa6188517cd8ca9bf4a10'
ARCHIVE='1d7f8d54a5c683ac6f675a2495cb32585dc1d097058fd0f683418db6808ea58e'
MANIFEST='e8c22674b3f29c3db3671632cb4ba0ccfcf7168a319dc9f77fb3c3773f09273f'
def need(ok,msg):
    if not ok: raise ValueError(msg)
def sha(b): return hashlib.sha256(b).hexdigest()
def mesh(b,s):
    need(sha(b)==s['sha256'] and len(b)==s['bytes'],'mesh digest '+s['id'])
    need(struct.unpack_from('<III',b)==(0x46546c67,2,len(b)),'GLB header')
    n,t=struct.unpack_from('<II',b,12); need(t==0x4e4f534a,'JSON chunk')
    d=json.loads(b[20:20+n]); size,kind=struct.unpack_from('<II',b,20+n)
    need(kind==0x004e4942 and 28+n+size==len(b),'binary chunk')
    need(d['nodes']==[{'mesh':0}],'unexpected node transform')
    def read(i,dtype,width,component,typ):
        a=d['accessors'][i]; v=d['bufferViews'][a['bufferView']]; off=a.get('byteOffset',0)+v.get('byteOffset',0)
        need(a['componentType']==component and a['type']==typ and v.get('byteStride',width*4)==width*4 and 'sparse' not in a,'unsupported accessor')
        need(0<=off and off+a['count']*width*4<=size,'accessor bounds')
        return np.frombuffer(b,dtype=dtype,count=a['count']*width,offset=28+n+off).reshape(-1,width)
    p=read(0,'<f4',3,5126,'VEC3'); i=read(1,'<u4',1,5125,'SCALAR').reshape(-1,3)
    need(len(p)==s['vertices'] and len(i)==s['triangles'] and np.isfinite(p).all() and i.max()<len(p),'geometry count/index/finite '+s['id'])
    need(np.array_equal(p.min(0),s['min']) and np.array_equal(p.max(0),s['max']),'actual bounds '+s['id'])
    return p,i

def main(archive):
    need(hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()==ARCHIVE,'archive digest')
    with zipfile.ZipFile(archive) as z:
        raw=z.read('manifest.json'); need(sha(raw)==MANIFEST,'manifest digest'); m=json.loads(raw)
        rows=m['structures']; need(m['revision']==REV and len(rows)==143 and len({s['id'] for s in rows})==143,'inventory')
        need(len({s['source_sha256'] for s in rows})==143,'duplicate source digest')
        inventory=json.loads(z.read('source-inventory.json')); source={x['name']:x for x in inventory}; need(len(inventory)==len(source)==143,'source inventory')
        centers={}; total_v=total_t=0; lo=np.full(3,np.inf); hi=-lo.copy()
        for s in rows:
            a=source[s['source_name']]; need(a['source_sha256']==s['source_sha256'] and a['source_bytes']==s['source_bytes'] and a['folder']==s['region'],'source metadata linkage')
            p,i=mesh(z.read(s['file']),s); total_v+=len(p); total_t+=len(i); lo=np.minimum(lo,p.min(0)); hi=np.maximum(hi,p.max(0)); centers[s['source_name']]=(p.min(0).astype(float)+p.max(0))/2
        need(np.array_equal(lo,m['bounds']['min']) and np.array_equal(hi,m['bounds']['max']),'world bounds')
        mid=(centers['HIP_LEFT'][0]+centers['HIP_RIGHT'][0])/2
        signed=[(centers[s['source_name']][0]-mid)*(1 if s['region'].endswith('_LEFT') else -1) for s in rows if s['region'].endswith(('_LEFT','_RIGHT'))]
        need(all(x>0 for x in signed),'relative laterality')
        chain=['SKULL_CRANIAL_MAXILLA']+[f'VERTEBRA_{a}{i}' for a,n in [('C',7),('T',12),('L',6)] for i in range(1,n+1)]+['SACRUM']
        gaps=[float(centers[a][2]-centers[b][2]) for a,b in zip(chain,chain[1:])]; need(min(gaps)>0,'axial ordering')
        for side in ['LEFT','RIGHT']:
            for names in [('CLAVICLE','HUMERUS','RADIUS'),('HIP','FEMUR','TIBIA','TALUS'),('HIP','FEMUR','FIBULA','CALCANEUS')]:
                a=[centers[n+'_'+side][2] for n in names]; need(all(x>y for x,y in zip(a,a[1:])),'limb order '+side)
        reg=json.loads(z.read('registration-metadata.json'))['existingFit']; mat=np.array(reg['matrix_source_to_denver_raw']); rot=mat[:3,:3]; need(np.allclose(rot.T@rot,np.eye(3),atol=1e-8) and np.isclose(np.linalg.det(rot),1),'historic rigid matrix')
        thresholds=reg['thresholds']; need(thresholds=={'median':3,'p95':8,'centroidDelta':5},'historic gates'); failures=[k for k,v in reg['metrics'].items() if any(x>y for x,y in zip(v,[3,8,5]))]; need(failures==['sacrum_coccyx'],'historical failure changed')
        return {'schema':'body-live-ground-truth-audit-1','archiveSha256':ARCHIVE,'manifestSha256':MANIFEST,'revision':REV,'structures':len(rows),'vertices':total_v,'triangles':total_t,'bounds':{'min':lo.tolist(),'max':hi.tolist(),'extent':(hi-lo).tolist()},'relativeLaterality':{'count':len(signed),'minimumSignedDistance':float(min(signed)),'hipMidlineX':float(mid)},'axialOrdering':{'pairs':len(gaps),'minimumCenterGap':min(gaps)},'limbOrderChains':6,'landmarks':{n:c.tolist() for n,c in centers.items()},'landmarkType':'AABB midpoint proxies; not anatomical point landmarks','historicalRegistration':{'determinant':float(np.linalg.det(rot)),'maxOrthogonalityError':float(np.max(np.abs(rot.T@rot-np.eye(3)))),'failedStructures':failures,'thresholds':thresholds,'rerunICP':False},'units':None,'physicalCoordinateVerified':False,'denverFusionAllowed':False}
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('archive',type=Path); p.add_argument('--output',type=Path,required=True); a=p.parse_args(); report=main(a.archive); a.output.write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps({k:v for k,v in report.items() if k!='landmarks'},indent=2))
