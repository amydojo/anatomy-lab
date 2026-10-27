#!/usr/bin/env python3
"""V5.4 sciatic import: isolate Z-Anatomy CC BY-SA components; register composite to BODY/LIVE hip.

Source is NOT patient imaging. Nerve models are curves converted to polygonal
surfaces in Z-Anatomy / nqwrc atlas. BodyParts3D hip is a distinct source release/
reference composite. Registration uses an automatic femur ICP and records errors;
never claim anatomical validation or same donor, including if ICP is low.

Requires: numpy, scipy, DracoPy. The full noncommercial mixed-license GLB is
never committed or redistributed. Only three right-side nerve component meshes
are exported, subject to CC BY-SA 4.0 and original credits.
"""
from __future__ import annotations
import hashlib, json, math, struct, urllib.request
from pathlib import Path
import DracoPy
import numpy as np
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parents[1]
UPSTREAM="nqwrc/3d-anatomy"
PIN="8ca3b7421bcfbe88b85859eb1983d5cf79f21749"
SHA={"nervous":"115402de4700658ea0cadb1d9749fa1d145e6397",
     "skeletal":"73a8ace5eb2ada06d0253e192679cab9d5cd4e6f"}
ORIGINAL="https://github.com/Z-Anatomy/Models-of-human-anatomy"
GEOMETRY_NAMES={"sciatic":"Sciatic nerve.r","tibial":"Tibial nerve.r",
                "commonFibular":"Common fibular nerve.r"}
BENCHMARK="Femur.r"
DATA=ROOT/"hip/spatial/assets"
DATA.mkdir(parents=True,exist_ok=True)

def download(name):
  url=f"https://raw.githubusercontent.com/{UPSTREAM}/{PIN}/public/models/{name}.glb"
  req=urllib.request.Request(url,headers={"User-Agent":"BODY-LIVE-source-import"})
  with urllib.request.urlopen(req,timeout=100) as response: raw=response.read()
  sha=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
  if sha!=SHA[name]: raise ValueError(f"Source archive mismatch: {name} {sha}")
  return raw,{"url":url,"git_blob_sha1":sha,"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)}

def parse(raw):
  if raw[:4]!=b'glTF':raise ValueError("Not a GLB asset")
  n,ty=struct.unpack_from("<II",raw,12)
  if ty!=0x4e4f534a:raise ValueError("GLB JSON chunk missing")
  info=json.loads(raw[20:20+n])
  i=20+n
  size,typ=struct.unpack_from("<II",raw,i)
  if typ!=0x004e4942:raise ValueError("Binary chunk missing")
  return info,raw[i+8:i+8+size]

def transform(node):
  if "matrix" in node:return np.array(node["matrix"],dtype=np.float64).reshape((4,4),order="F")
  tr=np.eye(4);tr[:3,3]=node.get("translation",[0,0,0])
  q=node.get("rotation",[0,0,0,1])
  x,y,z,w=q
  rot=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
  tr[:3,:3]=rot@np.diag(node.get("scale",[1,1,1]))
  return tr

def extract(info,binary,name):
  found=[(i,n) for i,n in enumerate(info["nodes"])
         if (n.get("extras",{}).get("za_name") or n.get("name"))==name]
  if len(found)!=1:raise ValueError("Expected one named model: "+name)
  idx,node=found[0]
  if "mesh" not in node:raise ValueError("Missing source mesh: "+name)
  mm=info["meshes"][node["mesh"]]
  parents={c:i for i,n in enumerate(info["nodes"]) for c in n.get("children",[])}
  chain=[idx]
  while chain[-1] in parents:
    chain.append(parents[chain[-1]])
  matrix=np.eye(4)
  for ancestor in chain[::-1]:matrix=matrix@transform(info["nodes"][ancestor])
  verts,faces=[],[]
  for prim in mm["primitives"]:
    ext=prim.get("extensions",{}).get("KHR_draco_mesh_compression")
    if not ext:raise ValueError("Unsupported source primitive / no Draco")
    view=info["bufferViews"][ext["bufferView"]]
    offset=view.get("byteOffset",0);lenbuf=view["byteLength"]
    mesh=DracoPy.decode(binary[offset:offset+lenbuf])
    v=np.asarray(mesh.points,dtype=np.float64)
    f=np.asarray(mesh.faces,dtype=np.int64)
    if v.ndim!=2 or v.shape[1]!=3 or f.ndim!=2 or f.shape[1]!=3:raise ValueError("Unusable decoded topology")
    allworld=(np.column_stack((v,np.ones(len(v))))@matrix.T)[:,:3]
    faces.extend((f+len(verts)).tolist())
    verts.extend(allworld.tolist())
  p=np.asarray(verts,dtype=np.float64)
  f=np.asarray(faces,dtype=np.int64)
  if not np.isfinite(p).all() or f.max()>=len(p) or len(f)<40:raise ValueError("Unusable mesh")
  return p,f,{"node":idx,"node_name":name,"mesh_index":node["mesh"],"node_chain":chain,
              "node_world_matrix":matrix.round(8).tolist(),"vertices":len(p),"faces":len(f),
              "bbox_m":[p.min(axis=0).round(6).tolist(),p.max(axis=0).round(6).tolist()]}

def rigid_fit(source,target):
  src0=source-source.mean(axis=0);dst0=target-target.mean(axis=0)
  H=src0.T@dst0
  U,S,V=np.linalg.svd(H)
  flip=np.eye(3);flip[-1,-1]=np.sign(np.linalg.det(U@V))
  R=U@flip@V
  # row vector transform: pts@R+t.
  t=target.mean(axis=0)-source.mean(axis=0)@R
  return R,t

def register(source,target):
  # BodyParts3D V4 meshes use 10*(world_m - origin_m), Y-up.
  # Atlas geometry may be subtly reshaped/decimated. Low geometric RMS alone
  # is NOT a statement of common subject or accurate nerve registration.
  rng=np.random.default_rng(54)
  ref=target[rng.choice(len(target),min(len(target),13000),replace=False)]
  sample=source[rng.choice(len(source),min(len(source),9000),replace=False)]
  tree=cKDTree(ref)
  scale=1.
  # Set an initial shared metric frame and translate centroids before ICP.
  R=np.eye(3)
  t=np.median(ref,axis=0)-np.median(sample,axis=0)
  best=(float('inf'),R,t)
  for iteration in range(28):
    aligned=sample@R+t
    dist,indices=tree.query(aligned,k=1)
    mask=dist<=np.quantile(dist,.72)
    refineR,refineT=rigid_fit(sample[mask],ref[indices[mask]])
    R=refineR;t=refineT
    rms=float(np.sqrt(np.mean(dist[mask]**2)))
    if rms<best[0]:best=(rms,R.copy(),t.copy())
  _,R,t=best
  dist,_=tree.query(sample@R+t,k=1)
  return R,t,{"method":"right-femur robust rigid ICP (auto; no expert landmarks)",
               "rms_trimmed_scene_units":round(float(np.sqrt(np.mean(np.sort(dist)[:int(.72*len(dist))]**2))),6),
               "median_scene_units":round(float(np.median(dist)),6),
               "p95_scene_units":round(float(np.percentile(dist,95)),6),
               "max_scene_units":round(float(np.max(dist)),6),
               "reference_sample_count":len(ref),"source_sample_count":len(sample),
               "scale":"shared source metres to hip display units (x10)",
               "rotation_determinant":round(float(np.linalg.det(R)),6),
               "clinical_landmarks_verified":False}

def trace_centerline(pos,n=24):
  # Geometry-derived visual sampling ONLY. Do not misrepresent as imaging traced fascicles.
  y=pos[:,1];lo,hi=np.quantile(y,[.04,.96]);out=[]
  for k in range(n):
    c=lo+(hi-lo)*k/max(1,n-1);rad=(hi-lo)/max(1,n-1)*.6
    pts=pos[np.abs(y-c)<rad]
    if len(pts)<3:continue
    out.append(np.median(pts,axis=0).round(4).tolist())
  return out

def main():
  nerveRaw,nerveProof=download("nervous")
  boneRaw,boneProof=download("skeletal")
  nerves,nbin=parse(nerveRaw);bones,bbin=parse(boneRaw)
  femur,ff,benchmark=extract(bones,bbin,BENCHMARK)
  hip=json.loads((DATA/"hip-source.json").read_text())
  target=np.asarray(hip["parts"]["femur"]["vertices"],dtype=np.float64)
  # Source GLB scene geometry is in metres. Hip source in 10x-metres display units.
  # Similar scale, but not verified same donor. Fit candidate registration.
  R,t,fit=register(femur*10,target)
  if fit["median_scene_units"]>1.0 or fit["rotation_determinant"]<.99:
    raise ValueError("Gross registration failure; refusing misleading composite: "+str(fit))
  models={};infos={}
  for part,name in GEOMETRY_NAMES.items():
    vertices,faces,details=extract(nerves,nbin,name)
    registered=vertices*10@R+t
    models[part]={"structure":name,"geometry_source":"Z-Anatomy / nerve surface derived from curves",
                  "vertices":np.round(registered,5).tolist(),"faces":faces.tolist(),
                  "tracePoints_derived_not_measured":trace_centerline(registered)}
    infos[part]=details
  out={"schema":"body-live/nerve-truth-atlas-v1","kind":"mixed-source atlas composite",
       "source":"Z-Anatomy derivative, nqwrc/3d-anatomy nerve model",
       "geometry_license":"CC BY-SA 4.0","license_url":"https://creativecommons.org/licenses/by-sa/4.0/",
       "source_commit":PIN,"reference_anatomy":"BodyParts3D 4.0 hip model",
       "registration":{"rotation":R.round(8).tolist(),"translation":t.round(8).tolist(),"fit":fit},
       "segments":models,
       "graph":{"sciatic":["tibial","commonFibular"],"tibial":[],"commonFibular":[]},
       "not_patient_specific":True,"clinical_reviewed":False}
  provenance={"schema":"body-live/nerve-provenance-v1",
    "geometry_origin":"Z-Anatomy anatomical curves, derivative surface exports; NOT MRI/CT segmentation",
    "upstream_source":ORIGINAL,"distribution":f"https://github.com/{UPSTREAM}/tree/{PIN}",
    "license_summary":"Isolated peripheral nerve derivative: CC BY-SA 4.0; exclude unrelated NC inner ear/kidney. Legal license review recommended.",
    "attribution":["Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0",
                   "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan",
                   "nqwrc/3d-anatomy - optimized Draco glTF export of Z-Anatomy"],
    "source_files":{"nervous.glb":nerveProof,"skeletal.glb":boneProof},
    "source_nodes":infos,"benchmark_node":benchmark,
    "registration":out["registration"],"source_hip_model":hip["source_commit"],
    "narrative":"Surface geometry is actual Z-Anatomy-derived sciatic model, registered to different BodyParts3D 4.0 hip reference mesh by automated rigid femur ICP. Anatomical relationship is plausible composite, not clinically proven or same donor.",
    "micro_ct_2026":{"source":"https://discover.pennsieve.io/datasets/692","license":"CC BY 4.0",
      "scope":"6 excised ~9 cm sciatic nerve microCT samples from one donor; fascicles/graphs, NOT whole in-situ pelvic nerve",
      "imported":False,"reason":"No validated registration to pelvis; separate microstructure future work"},
    "status":{"geometry_real_source":True,"imaging_derived":False,"clinically_verified":False,
              "same_donor":False,"registration_expert_verified":False,"anatomist_reviewed":False}}
  (DATA/"sciatic-source.json").write_text(json.dumps(out,separators=(",",":"))+"\n")
  (DATA/"sciatic-provenance.json").write_text(json.dumps(provenance,indent=2)+"\n")
  (DATA/"NERVE-ASSET-LICENSE.txt").write_text(
    "Sciatic, tibial and common fibular nerve surface adaptations\n"+
    "Z-Anatomy - The libre 3D atlas of anatomy - CC BY-SA 4.0\n"+
    "BodyParts3D - The Database Center for Life Science - CC BY-SA 2.1 Japan\n"+
    "3d-anatomy: https://github.com/nqwrc/3d-anatomy (Draco GLB adaptation)\n"+
    "License: https://creativecommons.org/licenses/by-sa/4.0/\n"+
    "Changes: mesh extraction of named peripheral nerves, decoding, automatic femur registration, triangulated JSON export.\n"+
    "No other body-system assets, noncommercial inner-ear structures, Wikipedia text or downstream atlas meshes are included.\n"+
    "Anatomy is NOT clinically verified and NOT patient-specific.\n")
  print(json.dumps({"exported":list(models),"fit":fit,"sizes":{"mesh":(DATA/"sciatic-source.json").stat().st_size},
     "counts":{k:{"vertices":len(v["vertices"]),"faces":len(v["faces"])} for k,v in models.items()}},indent=2))
if __name__=="__main__":main()
