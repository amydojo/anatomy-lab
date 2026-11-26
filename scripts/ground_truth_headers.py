"""Read pinned image-header prefixes; no coordinate or registration promotion."""
import argparse, gzip, hashlib, io, json, re, urllib.request
from pathlib import Path
import nibabel as nib
import numpy as np
from acquire_axis import HOST, REPO, REV

def req(url, headers=None):
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=60)

def listing():
    root='visible_human_3d_models/CT'
    todo=[root]; result=[]
    while todo:
        path=todo.pop()
        url=f'{HOST}/api/datasets/{REPO}/tree/{REV}/{path}?limit=100'
        while url:
            with req(url) as response:
                data=json.load(response)
                next_link=re.search(r'<([^>]+)>;\s*rel="next"',response.headers.get('Link',''))
            for x in data:
                p=x['path']; name=p.rsplit('/',1)[-1].lower()
                if x['type']=='directory':
                    if name not in ('mesh','nurbs','01_male','male'): todo.append(p)
                elif ('female' in p.lower()) and p.lower().endswith(('.nii.gz','.nii','.nrrd','.nhdr','.dcm')):
                    result.append(x)
            url=next_link.group(1) if next_link else None
    return sorted(result,key=lambda x:x['path'])

def nifti_header(data):
    h=nib.Nifti1Header.from_fileobj(io.BytesIO(data),check=False)
    q,qc=h.get_qform(coded=True); s,sc=h.get_sform(coded=True)
    def matrix(a):
        return None if a is None else {'matrix':a.tolist(),'determinant':float(np.linalg.det(a[:3,:3])),'axisCodes':list(nib.aff2axcodes(a))}
    return {'shape':list(h.get_data_shape()),'zooms':list(map(float,h.get_zooms())),'units':list(h.get_xyzt_units()),'qformCode':int(qc),'sformCode':int(sc),'qform':matrix(q),'sform':matrix(s),'maxQformSformDifference':float(np.max(np.abs(q-s))) if q is not None and s is not None else None}

def read_header(x):
    path=x['path']; url=f'{HOST}/datasets/{REPO}/resolve/{REV}/{path}'
    with req(url,{'Range':'bytes=0-1048575','Accept-Encoding':'identity'}) as response:
        prefix=response.read(1048576)
    if path.lower().endswith(('.nii','.nii.gz')):
        raw=gzip.GzipFile(fileobj=io.BytesIO(prefix)).read(352) if path.endswith('.gz') else prefix[:352]
        info=nifti_header(raw)
    elif path.lower().endswith(('.nrrd','.nhdr')):
        match=re.search(br'\r?\n\r?\n',prefix)
        if match is None: raise ValueError('NRRD header delimiter missing within bound')
        raw=prefix[:match.end()]
        fields={}
        for line in raw.decode('utf-8').splitlines():
            if ':=' in line: k,v=line.split(':=',1); fields[k]=v
            elif ':' in line and not line.startswith('#'): k,v=line.split(':',1); fields[k]=v.strip()
        info={k:v for k,v in fields.items() if k in ('space','space directions','space origin','space units','sizes','kinds','dimension','measurement frame','encoding','Segmentation_ReferenceImageExtentOffset') or re.match(r'Segment\d+_(Name|ID|LabelValue|Layer|Extent)$',k)}
    else:
        import pydicom
        raw=prefix
        d=pydicom.dcmread(io.BytesIO(prefix),stop_before_pixels=True)
        info={k:str(getattr(d,k,None)) for k in ('ImageOrientationPatient','ImagePositionPatient','PixelSpacing','SpacingBetweenSlices','SliceThickness','FrameOfReferenceUID','SeriesInstanceUID')}
    return {'path':path,'revision':REV,'sourceUrl':url,'sourceLfsSha256':x.get('lfs',{}).get('oid'),'sourceBytes':x.get('size'),'headerPrefixSha256':hashlib.sha256(raw).hexdigest(),'headerBytes':len(raw),'metadata':info,'fullFileHashVerified':False}

def main(out):
    report={'revision':REV,'files':[],'errors':[],'physicalCoordinateVerified':False}
    try:
        files=listing()
        if not files: raise ValueError('No matching pinned female image files')
        for x in files:
            try: report['files'].append(read_header(x))
            except Exception as e: report['errors'].append({'path':x['path'],'error':str(e)})
    except Exception as e: report['errors'].append({'error':str(e)})
    out.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print('Header records:',len(report['files']),'errors:',len(report['errors']))
    if report['errors']: raise SystemExit(1)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True,type=Path); main(p.parse_args().output)
