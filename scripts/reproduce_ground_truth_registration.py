"""Independent seeded reproduction of the prior two-femur rigid fit.

Original sample seed and exact centroid definition are not recorded; this is
not a bit-for-bit reproduction. Use final packed Denver bones, never fit hips
or sacrum. All distances are uncalibrated source units. No promotion.
"""
import argparse, hashlib, io, json, zipfile
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import trimesh
from audit_ground_truth import ARCHIVE, MANIFEST, mesh, need, sha

N=35000
THRESHOLDS=[3,8,5]
def sample(v,f,rng):
    t=v[f].astype(float)
    weights=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)
    need(np.isfinite(weights).all() and weights.sum()>0,'surface area')
    tri=t[rng.choice(len(t),N,p=weights/weights.sum())]
    u=np.sqrt(rng.random(N)); w=rng.random(N)
    return (1-u[:,None])*tri[:,0]+(u*(1-w))[:,None]*tri[:,1]+(u*w)[:,None]*tri[:,2]

def rigid(a,b):
    ac=a.mean(0);bc=b.mean(0)
    u,_,vt=np.linalg.svd((a-ac).T@(b-bc))
    rr=vt.T@u.T
    if np.linalg.det(rr)<0:
        vt[-1]*=-1;rr=vt.T@u.T
    return rr,bc-rr@ac

def fit(a,b,iterations=40):
    # Side-specific nearest neighbors; no held-out structures in optimization.
    R=np.diag([-1.,-1.,1.]); T=np.concatenate(b).mean(0)-R@np.concatenate(a).mean(0)
    trees=[cKDTree(x) for x in b]
    for _ in range(iterations):
        aa=[];bb=[];dd=[]
        for src,dst,tree in zip(a,b,trees):
            x=src@R.T+T;d,j=tree.query(x)
            aa.append(x);bb.append(dst[j]);dd.append(d)
        aa=np.concatenate(aa);bb=np.concatenate(bb);dd=np.concatenate(dd)
        k=int(len(dd)*.85); keep=np.argpartition(dd,k-1)[:k]
        dR,dT=rigid(aa[keep],bb[keep]); R=dR@R;T=dR@T+dT
    return R,T

def metrics(a,b,R,T):
    x=a@R.T+T
    dist=np.concatenate([cKDTree(b).query(x)[0],cKDTree(x).query(b)[0]])
    return [float(np.median(dist)),float(np.quantile(dist,.95)),float(np.linalg.norm(x.mean(0)-b.mean(0)))]

def denver_meshes(root,manifest):
    translation=np.array(manifest['geometry_transform']['translation'])
    need(np.array_equal(translation,[-620,-430,-500]) and manifest['geometry_transform']['scale']==1,'packing changed')
    found={}
    for bundle in manifest['bundles']:
        if bundle['tissue']!='Bone':continue
        raw=(root/bundle['file']).read_bytes();need(sha(raw)==bundle['sha256'],'Denver bundle digest')
        scene=trimesh.load_scene(io.BytesIO(raw),file_type='glb',process=False)
        expected=[s for s in manifest['structures'] if s['side']==bundle['side'] and s['tissue']=='Bone']
        for node in scene.graph.nodes_geometry:
            transform,name=scene.graph[node];geo=scene.geometry[name]
            v=trimesh.transform_points(geo.vertices,transform)-translation
            bounds=np.r_[v.min(0),v.max(0)]
            matches=[s for s in expected if np.allclose(bounds,s['bounds_raw'],atol=.001,rtol=0)]
            need(len(matches)==1,'unambiguous Denver geometry '+str(node))
            s=matches[0];need(s['id'] not in found,'duplicate Denver ID')
            need(len(v)==s['vertices'] and len(geo.faces)==s['triangles'],'Denver geometry counts')
            found[s['id']]=(v,np.asarray(geo.faces))
    return found

def run(archive,root):
    need(hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()==ARCHIVE,'archive digest')
    raw=(root/'lower-body-manifest.json').read_bytes()
    need(sha(raw)=='b4403e606faac7fca9525692f51a4d83db8d6a44622ab78a3b2bd07bf3e545c0','Denver manifest digest')
    den=json.loads(raw); packed=denver_meshes(root,den)
    lookup={(s['side'].lower(),s['source_name'].lower()):s['id'] for s in den['structures'] if s['tissue']=='Bone'}
    rng=np.random.default_rng(1592)
    with zipfile.ZipFile(archive) as z:
        raw=z.read('manifest.json');need(sha(raw)==MANIFEST,'manifest digest')
        by={s['source_name'].lower():s for s in json.loads(raw)['structures']}
        def src(name):
            s=by[name]; return sample(*mesh(z.read(s['file']),s),rng)
        def dst(side,name):
            return sample(*packed[lookup[side,name]],rng)
        def joined(names):
            vs=[];fs=[];off=0
            for side,name in names:
                v,f=packed[lookup[side,name]];vs.append(v);fs.append(f+off);off+=len(v)
            return sample(np.concatenate(vs),np.concatenate(fs),rng)
        a=[src('femur_'+s) for s in ('left','right')];b=[dst(s,'femur') for s in ('left','right')]
        R,T=fit(a,b)
        pairs={f'femur_{s}':(a[i],b[i]) for i,s in enumerate(('left','right'))}
        for s in ('left','right'):pairs['hip_'+s]=(src('hip_'+s),dst(s,'pelvis'))
        pairs['sacrum_coccyx']=(src('sacrum'),joined([('left','sacrum'),('left','coccyx')]))
        result={k:metrics(x,y,R,T) for k,(x,y) in pairs.items()}
        historical=json.loads(z.read('registration-metadata.json'))['existingFit']
        old=np.array(historical['matrix_source_to_denver_raw'])
        old_measured={k:metrics(x,y,old[:3,:3],old[:3,3]) for k,(x,y) in pairs.items()}
        matrix=np.eye(4);matrix[:3,:3]=R;matrix[:3,3]=T
        return {'method':'seeded independent two-femur trimmed rigid ICP; symmetric sampled nearest neighbors; sample centroid delta','seed':1592,'samplesPerStructure':N,'iterations':40,'trim':.85,'thresholds':THRESHOLDS,'metricOrder':['median','p95','centroidDelta'],'units':'source units','fit':['femur_left','femur_right'],'heldOut':['hip_left','hip_right','sacrum_coccyx'],'matrix':matrix.tolist(),'determinant':float(np.linalg.det(R)),'metrics':result,'historicalMatrixOnSameSamples':old_measured,'historicalRecordedMetrics':historical['metrics'],'failedStructures':[k for k,v in result.items() if any(x>y for x,y in zip(v,THRESHOLDS))],'rawDenverComparisonPerformed':False,'denverFusionAllowed':False}

def self_test():
    rng=np.random.default_rng(7);a=[rng.normal(size=(2000,3))+[i*10,0,0] for i in (0,1)]
    R=np.diag([-1.,-1.,1.]);T=np.array([5.,9.,2.]);b=[x@R.T+T for x in a]
    rr,tt=fit(a,b);need(np.allclose(rr,R,atol=1e-9) and np.allclose(tt,T,atol=1e-9),'synthetic rigid fit')
    need(max(metrics(a[0],b[0],rr,tt))<1e-8,'synthetic distances')
    print('Synthetic rigid fit and metric test passed')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path);p.add_argument('--denver',type=Path);p.add_argument('--output',type=Path);p.add_argument('--self-test',action='store_true');a=p.parse_args()
    self_test()
    if not a.self_test:
        result=run(a.archive,a.denver);a.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
