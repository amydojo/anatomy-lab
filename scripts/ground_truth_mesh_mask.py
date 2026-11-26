"""Pinned full-volume -> native STL correspondence, no automatic coordinate approval."""
import argparse, gzip, hashlib, io, json, re, tempfile, urllib.request, zipfile
from pathlib import Path
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
from audit_ground_truth import ARCHIVE, MANIFEST, REV, mesh, need, sha
from reproduce_ground_truth_registration import sample

HEADER_ARCHIVE='ac3b87c981cfeba43953c9e1f6eaba9d6c27ebbbb0065c3405b0128d7b0d215a'
SPACING=np.array([0.7226560115814209,0.7226560115814209,1.])
SHAPE=(673,670,1727)
DTYPES={'uchar':'u1','unsigned char':'u1','uint8':'u1','uint8_t':'u1','short':'i2','short int':'i2','int16':'i2','int16_t':'i2','ushort':'u2','unsigned short':'u2','unsigned short int':'u2','uint16':'u2','uint16_t':'u2','int':'i4','int32':'i4','uint':'u4','uint32':'u4'}
def pinned_read(path, digest):
    with path.open('rb') as f: need(hashlib.file_digest(f,'sha256').hexdigest()==digest,'archive hash '+str(path))
    return zipfile.ZipFile(path)
def parse_header(f):
    raw=f.readline();need(raw.startswith(b'NRRD000'),'NRRD magic')
    fields={}
    while True:
        line=f.readline();need(line and len(raw)+len(line)<2_000_000,'header limit')
        raw+=line
        if line in (b'\n',b'\r\n'):break
        line=line.decode('utf-8').strip()
        if line.startswith('#'):continue
        k,v=line.split(':=' if ':=' in line else ':',1);need(k not in fields,'duplicate NRRD key');fields[k]=v.strip()
    return raw,fields
def labels(fields):
    result=[]
    for k,name in fields.items():
        if not re.fullmatch(r'Segment\d+_Name',k):continue
        p=k[:-4]
        result.append({'name':name,'layer':int(fields[p+'Layer']),'value':int(fields[p+'LabelValue']),'segmentId':fields[p+'ID'],'extent':list(map(int,fields[p+'Extent'].split()))})
    need(len({x['name'] for x in result})==len(result) and len({(x['layer'],x['value']) for x in result})==len(result),'ambiguous segment identity')
    need(all(x['value']>0 for x in result),'invalid background label')
    return sorted(result,key=lambda x:x['name'])
def read_points(f, fields, segs, shape=SHAPE):
    sizes=list(map(int,fields['sizes'].split()));dim=int(fields['dimension'])
    need(dim in (3,4) and len(sizes)==dim and tuple(sizes[-3:])==shape,'unexpected volume dimensions')
    layers=sizes[0] if dim==4 else 1
    need(fields['kinds'].split()==(['list'] if dim==4 else [])+['domain']*3,'unexpected axis kinds')
    need(fields['encoding']=='gzip' and 'data file' not in fields and 'datafile' not in fields,'unsupported encoding')
    need(int(fields.get('byte skip','0'))==0 and int(fields.get('line skip','0'))==0,'unsupported skips')
    dtype=np.dtype(DTYPES[fields['type']]);endian=fields.get('endian','little');need(endian in ('little','big'),'invalid endian');dtype=dtype.newbyteorder('<' if endian=='little' else '>')
    need(all(0<=s['layer']<layers for s in segs),'invalid layer')
    lookup={(s['layer'],s['value']):s['name'] for s in segs}; chunks={s['name']:[] for s in segs}
    nx,ny,nz=shape; size=nx*ny*layers*dtype.itemsize
    with gzip.GzipFile(fileobj=f) as payload:
        for z in range(nz):
            slab=payload.read(size);need(len(slab)==size,'truncated volume')
            a=np.frombuffer(slab,dtype=dtype).reshape(ny,nx,layers)
            y,x,l=np.nonzero(a)
            if len(x)==0:continue
            vals=a[y,x,l]
            for layer in np.unique(l):
                sel=l==layer
                for value in np.unique(vals[sel]):
                    key=(int(layer),int(value));need(key in lookup,'unmapped nonzero label '+str(key))
                    take=sel&(vals==value)
                    chunks[lookup[key]].append(np.column_stack((x[take],y[take],np.full(np.count_nonzero(take),z))).astype(np.int32))
        need(payload.read(1)==b'','unexpected trailing decompressed volume')
    need(all(chunks.values()),'empty named segment')
    return {k:np.concatenate(v) for k,v in chunks.items()}
def mask_surface(points, spacing, origin):
    lo=points.min(0);hi=points.max(0)
    cropped=np.zeros(tuple(hi-lo+3),dtype=bool);cropped[tuple((points-lo+1).T)]=True
    comp,num=ndimage.label(cropped);counts=np.bincount(comp.ravel())[1:];need(len(counts)==num and counts.sum()==len(points),'component accounting')
    vertices,faces,_,_=marching_cubes(cropped.astype(np.uint8),level=.5,spacing=tuple(spacing),allow_degenerate=False)
    vertices=vertices+(lo-1)*spacing+origin
    return vertices,faces,{'components6Connected':int(num),'largestComponentFraction':float(counts.max()/counts.sum()),'voxels':int(len(points)),'occupiedIndexMin':lo.tolist(),'occupiedIndexMax':hi.tolist()}
def distances(a,b):
    d1=cKDTree(b).query(a)[0];d2=cKDTree(a).query(b)[0]
    def stats(d):return {'median':float(np.median(d)),'p95':float(np.quantile(d,.95)),'p99':float(np.quantile(d,.99)),'mean':float(d.mean()),'max':float(d.max())}
    return {'meshToMask':stats(d1),'maskToMesh':stats(d2),'symmetricMedian':float(np.median(np.r_[d1,d2])),'symmetricP95':float(np.quantile(np.r_[d1,d2],.95))}
def fetch_volume(meta, dest):
    expected=meta['sourceLfsSha256'];size=meta['sourceBytes'];need(re.fullmatch('[0-9a-f]{64}',expected) and size>0,'missing immutable LFS identity')
    h=hashlib.sha256();n=0
    with urllib.request.urlopen(meta['sourceUrl'],timeout=120) as resp,dest.open('wb') as out:
        while True:
            block=resp.read(1024*1024)
            if not block:break
            n+=len(block);need(n<=size,'source exceeds pinned size');h.update(block);out.write(block)
    need(n==size and h.hexdigest()==expected,'full volume hash '+meta['path'])
def run(archive,headers,out,selected):
    rng=np.random.default_rng(159202)
    with pinned_read(headers,HEADER_ARCHIVE) as hz,pinned_read(archive,ARCHIVE) as az,tempfile.TemporaryDirectory() as td:
        raw=az.read('manifest.json');need(sha(raw)==MANIFEST,'mesh manifest');m=json.loads(raw)
        mapping={(s['region'],s['source_name']):s for s in m['structures']};need(len(mapping)==143,'mesh inventory')
        h=json.loads(hz.read('ground-truth-headers.json'));need(h['revision']==REV and not h['errors'],'header revision or errors')
        volumes=[x for x in h['files'] if x['path'].endswith('.seg.nrrd')];need(len(volumes)==11,'volume inventory')
        header_map={(Path(v['path']).name.split('.')[0],s['name']) for v in volumes for s in labels(v['metadata'])};need(header_map==set(mapping),'header label/mesh mismatch')
        result={'schema':'body-live-image-mesh-correspondence-1','revision':REV,'meshArchiveSha256':ARCHIVE,'headerArchiveSha256':HEADER_ARCHIVE,'sampling':{'seed':159202,'samplesPerSurface':35000,'metric':'bidirectional sampled surface nearest-neighbor; approximate, not exact point-to-triangle','maskSurface':'marching cubes at 0.5, padded outside with background, all components retained','spacingMm':SPACING.tolist()},'volumes':[],'structures':[],'physicalCoordinateApproved':False,'denverFusionAllowed':False}
        surfaces={}
        for v in volumes:
            region=Path(v['path']).name.split('.')[0]
            if selected and region not in selected:continue
            path=Path(td)/Path(v['path']).name;fetch_volume(v,path)
            with path.open('rb') as f:
                raw,fields=parse_header(f);need(sha(raw)==v['headerPrefixSha256'],'header mismatch after full hash')
                need(fields['space']=='left-posterior-superior' and fields['space origin']=='(0,0,0)','unexpected frame')
                dirs=np.array([list(map(float,x.split(','))) for x in re.findall(r'\(([^)]+)\)',fields['space directions'])]);need(np.array_equal(dirs,np.diag(SPACING)),'unexpected directions')
                segs=labels(fields);need(segs==labels(v['metadata']),'segment metadata mismatch')
                pts=read_points(f,fields,segs)
            result['volumes'].append({'region':region,'path':v['path'],'sourceSha256':v['sourceLfsSha256'],'bytes':v['sourceBytes'],'fullyHashVerified':True,'labels':len(segs)})
            for seg in segs:
                name=seg['name'];s=mapping[region,name];p,i=mesh(az.read(s['file']),s)
                vtx,faces,maskmeta=mask_surface(pts[name],SPACING,np.zeros(3))
                a=sample(p,i,rng);b=sample(vtx,faces,rng);identity=distances(a,b);ras=distances(a*np.array([-1,-1,1]),b)
                # Bounding values are geometric proxies, not independently annotated anatomical landmarks.
                extent=np.r_[pts[name].min(0),pts[name].max(0)]
                rec={'region':region,'name':name,'meshId':s['id'],'meshSourceSha256':s['source_sha256'],'segmentId':seg['segmentId'],'layer':seg['layer'],'labelValue':seg['value'],'mask':maskmeta,'nativeIdentityLpsHypothesis':identity,'rasSignFlipNegativeControl':ras,'meshBoundsNative':[p.min(0).tolist(),p.max(0).tolist()],'maskBoundsLpsMm':[vtx.min(0).tolist(),vtx.max(0).tolist()],'maskVoxelCentroidLpsMm':(pts[name].mean(0)*SPACING).tolist(),'meshSampleCentroidNative':a.mean(0).tolist(),'groupedName':bool(re.search(r'PHALANGE|SKULL_CRANIAL|SACRUM|STERNUM',name))}
                result['structures'].append(rec);surfaces[name]=b
                print(region,name,round(identity['symmetricMedian'],3),round(identity['symmetricP95'],3),flush=True)
            path.unlink()
            out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
        joints=[]
        for side in ('LEFT','RIGHT'):
            for a,b in [('FEMUR','HIP'),('FEMUR','TIBIA'),('TIBIA','TALUS'),('HUMERUS','ULNA'),('HUMERUS','RADIUS')]:
                x,y=a+'_'+side,b+'_'+side
                if x in surfaces and y in surfaces:
                    d=cKDTree(surfaces[y]).query(surfaces[x])[0];joints.append({'pair':[x,y],'minimumSampledDistanceMm':float(d.min()),'p01DirectedMm':float(np.quantile(d,.01)),'interpretation':'mask surface proximity only; no signed penetration, contact or clinical validation'})
        result['jointProxies']=joints
        result['summary']={'volumes':len(result['volumes']),'structures':len(result['structures']),'all143':len(result['structures'])==143}
        if result['structures']:
            med=[x['nativeIdentityLpsHypothesis']['symmetricMedian'] for x in result['structures']];p95=[x['nativeIdentityLpsHypothesis']['symmetricP95'] for x in result['structures']]
            result['summary'].update({'medianOfStructureMedians':float(np.median(med)),'medianOfStructureP95':float(np.median(p95)),'maxStructureP95':float(max(p95)),'structuresIdentityCloserThanRas':sum(x['nativeIdentityLpsHypothesis']['symmetricMedian']<x['rasSignFlipNegativeControl']['symmetricMedian'] for x in result['structures'])})
        out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
        if not selected:need(result['summary']['all143'] and len(result['volumes'])==11,'incomplete full comparison')
        print(json.dumps(result['summary']),flush=True)
def self_test():
    # List axis fastest, same integer in different layers; anisotropic physical origin.
    a=np.zeros((4,3,2,2),np.uint8);a[1,1,0,0]=1;a[2,0,1,1]=1
    f=io.BytesIO(gzip.compress(a.tobytes()))
    fields={'sizes':'2 2 3 4','dimension':'4','kinds':'list domain domain domain','encoding':'gzip','type':'uchar'}
    segs=[{'name':'a','layer':0,'value':1},{'name':'b','layer':1,'value':1}]
    p=read_points(f,fields,segs,(2,3,4));need(p['a'].tolist()==[[0,1,1]] and p['b'].tolist()==[[1,0,2]],'axis/layer decoding')
    v,_,meta=mask_surface(np.array([[2,3,4]]),SPACING,np.zeros(3))
    need(np.allclose(v.min(0),(np.array([2,3,4])-.5)*SPACING) and np.allclose(v.max(0),(np.array([2,3,4])+.5)*SPACING),'physical spacing')
    need(meta['components6Connected']==1 and distances(v,v)['symmetricP95']==0,'surface distance')
    try:read_points(io.BytesIO(gzip.compress(a.tobytes()[:-1])),fields,segs,(2,3,4))
    except ValueError:pass
    else:raise ValueError('truncated volume accepted')
    print('Layer/order, anisotropic spacing, distance and truncation checks passed')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path);p.add_argument('--headers',type=Path);p.add_argument('--output',type=Path);p.add_argument('--region',action='append');p.add_argument('--self-test',action='store_true');a=p.parse_args();self_test()
    if not a.self_test:run(a.archive,a.headers,a.output,a.region)
