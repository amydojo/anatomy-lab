#!/usr/bin/env python3
"""Reproducible, pinned, SAME-FRAME right shoulder anatomy import.

BodyParts3D 4.0 © DBCLS, CC BY 4.0 via pinned ashemag/human-atlas.
Do not synthesize missing muscles, tendon, ligament or nerve surfaces.
For display only; joint motion and anatomy are not clinically reviewed.
"""
from __future__ import annotations
import hashlib, json, math, struct, urllib.request, time
from pathlib import Path

PIN="1c38bf35c254a891200d3cedecfd57abebe83d8d"
BASE=f"https://raw.githubusercontent.com/ashemag/human-atlas/{PIN}/public/models/"
ATLAS_GIT_SHA="0f81b5621479a0c0548f4683c316f33bd4d6545b"
OUTPUT=Path(__file__).resolve().parents[1]/"shoulder/spatial/assets"
AXIS_ORIGIN=(0.,.9,0.)
SCALE=5.
REQUIRED={
 "clavicle":"Right clavicle","scapula":"Right scapula","humerus":"Right humerus",
 "supraspinatus":"Right supraspinatus","infraspinatus":"Right infraspinatus",
 "subscapularis":"Right subscapularis","teresMinor":"Right teres minor",
}
OPTIONAL={
 "teresMajor":"Right teres major",
 "deltoidClavicular":"Right deltoid clavicular part",
 "deltoidAcromial":"Right deltoid acromial part",
 "deltoidSpinal":"Right deltoid spinal part",
 "bicepsLong":"Right biceps brachii long head",
 "bicepsShort":"Right biceps brachii short head",
 "coracobrachialis":"Right coracobrachialis",
 "pectoralisClavicular":"Right pectoralis major clavicular part",
}
def norm(s):
 return " ".join(s.lower().replace("·"," ").replace("-"," ").replace(","," ").replace("muscle","").split())

def download(name):
 url=BASE+name
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"BODY-LIVE-V6-6-pinned-source-import/1.0"})
   with urllib.request.urlopen(req,timeout=90) as stream:data=stream.read()
   h=hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
   return data,{"url":url,"git_blob_sha1":h,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}
  except Exception:
   if attempt==2:raise
   time.sleep(2+2*attempt)
def decode(raw,info):
 n,m=int(info["vertexCount"]),int(info["indexCount"])
 p,i=int(info["positions"]),int(info["indices"])
 if n<35 or m<180 or m%3 or min(p,i)<0 or p+12*n>len(raw) or i+4*m>len(raw):
  raise ValueError("Invalid source topology/offset: "+info["name"])
 verts=list(struct.iter_unpack("<fff",raw[p:p+12*n]))
 idx=struct.unpack_from("<"+str(m)+"I",raw,i)
 if max(idx)>=n or not all(math.isfinite(v) for pt in verts for v in pt):raise ValueError("Invalid source coordinates")
 faces=[list(idx[j:j+3]) for j in range(0,m,3)]
 return verts,faces

def find(manifest,label,required):
 name=norm(label)
 exact=[p for p in manifest if norm(p["name"])==name]
 if len(exact)==1:return exact[0]
 # Permit source version's alternate naming of deltoid components, but never
 # silently substitute another-side or an entire muscle for a named part.
 if not required:
  # BodyParts3D occasionally places the head descriptor before the muscle
  # ("Clavicular part of right deltoid"). Find only an unambiguous named part.
  want=set(name.split())-{"part","head","of"}
  alternatives=[p for p in manifest if want.issubset(set(norm(p["name"]).split()))]
  if len(alternatives)==1:return alternatives[0]
  return None
 raise ValueError(f"Required distinct right-shoulder source {label!r}: {len(exact)} exact matches")

def main():
 raw,atlas_proof=download("atlas.json")
 if atlas_proof["git_blob_sha1"]!=ATLAS_GIT_SHA:raise ValueError("Unpinned atlas input")
 atlas=json.loads(raw)
 if atlas["version"]!="BodyParts3D 4.0":raise ValueError("Incompatible anatomical source")
 selected={}
 for key,name in REQUIRED.items():selected[key]=find(atlas["parts"],name,True)
 for key,name in OPTIONAL.items():
  p=find(atlas["parts"],name,False)
  if p is not None:selected[key]=p
 print("SHOULDER_SOURCE_NAMES",json.dumps([p["name"] for p in atlas["parts"] if any(k in p["name"].lower() for k in ("deltoid","biceps brachii","supraspinatus","infraspinatus","subscapularis"))]))
 chunks={}
 proofs={"atlas.json":atlas_proof}
 for chunk in sorted({p["chunk"] for p in selected.values()}):
  fname=f"body-{chunk}.bin"
  data,proof=download(fname)
  if len(data)!=atlas["chunks"][chunk]["bytes"]:raise ValueError("Source chunk length mismatch "+fname)
  chunks[chunk]=data;proofs[fname]=proof
 asset={"schema":"body-live/shoulder-sourced-v1","dataset":"BodyParts3D 4.0",
        "license":"CC BY 4.0","source_commit":PIN,
        "source_frame":{"origin_metres":list(AXIS_ORIGIN),"scale":SCALE,"axes":"source metres, Y-up"},
        "parts":{}}
 evidence={}
 for key,info in selected.items():
  vertices,faces=decode(chunks[info["chunk"]],info)
  transformed=[[round((pt[i]-AXIS_ORIGIN[i])*SCALE,5) for i in range(3)] for pt in vertices]
  tissue=key not in ("clavicle","scapula","humerus")
  asset["parts"][key]={"name":info["name"],"fma":info["conceptId"],"system":"muscle" if tissue else "bone",
                       "vertices":transformed,"faces":faces}
  evidence[key]={"fma":info["conceptId"],"name":info["name"],"chunk":info["chunk"],
                 "vertices":len(vertices),"triangles":len(faces)}
 OUTPUT.mkdir(parents=True,exist_ok=True)
 assetpath=OUTPUT/"shoulder-source.json"
 assetpath.write_text(json.dumps(asset,separators=(",",":"))+"\n")
 proof={"schema":"body-live/shoulder-provenance-v1",
  "attribution":"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
  "license":"CC BY 4.0","license_url":"https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  "original_release":"4.0 99% reduced IS-A tree",
  "distribution":"https://github.com/ashemag/human-atlas",
  "pinned_commit":PIN,"input_hashes":proofs,"models":evidence,
  "asset_sha256":hashlib.sha256(assetpath.read_bytes()).hexdigest(),
  "anatomist_reviewed":False,"kinematics_validated":False,
  "missing":[n for k,n in OPTIONAL.items() if k not in selected],
  "unsupported":["ligament models not imported","glenoid labrum not imported","axillary/suprascapular nerves not imported","tendons not independently validated"],
  "notes":["Reference-pose source geometry; source meshes share atlas coordinate frame.",
           "A single humeral teaching pivot is not validated glenohumeral/scapulothoracic kinematics.",
           "Muscles stay in source pose during movement; do not infer tendon deformation."]}
 (OUTPUT/"provenance.json").write_text(json.dumps(proof,indent=2)+"\n")
 print(json.dumps({"parts":list(selected),"triangles":sum(len(x["faces"]) for x in asset["parts"].values()),
                   "bytes":assetpath.stat().st_size,"chunks":list(chunks)}))
if __name__=="__main__":main()
