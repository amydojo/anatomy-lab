#!/usr/bin/env python3
"""Pinned, auditable BodyParts3D 4.0 hip import. NOT anatomical sign-off.

Same reference-pose coordinates for bone/muscle models. Import from SHA-verified
ashemag/human-atlas distribution (official BodyParts3D 4.0 derivative, CC BY 4.0).
Generates /hip/spatial/assets/hip-source.json and provenance.json.
"""
import hashlib,json,struct,urllib.request,math
from pathlib import Path
PIN="1c38bf35c254a891200d3cedecfd57abebe83d8d"
ROOT=f"https://raw.githubusercontent.com/ashemag/human-atlas/{PIN}/public/models/"
SHA={"atlas.json":"0f81b5621479a0c0548f4683c316f33bd4d6545b",
     "body-1.bin":"b2a0a781478031ca966f57d73d6bd0b8652edcf7",
     "body-11.bin":"f437a61bfd8c976108abf3e3a607784af3eb3575",
     "body-13.bin":"24a9953b6677cf07cd6beea9f221a0690c6efa44"}
BONES={"hipBone":("Right hip bone","FMA16586"),"femur":("Right femur","FMA24474"),"sacrum":("Sacrum","FMA16202")}
MUSCLES={"maximus":("Right gluteus maximus","FMA22328"),"medius":("Right gluteus medius","FMA22330"),
 "minimus":("Right gluteus minimus","FMA22332"),"piriformis":("Right piriformis","FMA22340"),
 "obturator":("Right obturator internus","FMA22324"),"gemellusSuperior":("Right gemellus superior","FMA22334"),
 "gemellusInferior":("Right gemellus inferior","FMA22336"),"quadratus":("Right quadratus femoris","FMA22338")}
# A single display transform for every element. Hip pivot estimated, not measured.
# Y is superior in the derived distribution. Numbers are source metres.
ORIGIN=(-.057,.895,-.045); SCALE=10.0
OUT=Path(__file__).resolve().parents[1]/"hip/spatial/assets"

def download(name):
 req=urllib.request.Request(ROOT+name,headers={"User-Agent":"BODY-LIVE-anatomy-hip-import/1.0"})
 with urllib.request.urlopen(req,timeout=100) as response: data=response.read()
 blob=hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
 if blob!=SHA[name]: raise ValueError(f"Source hash mismatch {name}: {blob}")
 return data,{"url":ROOT+name,"git_blob_sha1":blob,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}

def decode(raw,item):
 n=int(item["vertexCount"]);m=int(item["indexCount"]);p=int(item["positions"]);i=int(item["indices"])
 if not (0<=p<=p+12*n<=len(raw) and 0<=i<=i+4*m<=len(raw) and m%3==0):raise ValueError("Unsafe geometry offsets")
 verts=list(struct.iter_unpack("<fff",raw[p:p+12*n]))
 idx=struct.unpack_from("<"+str(m)+"I",raw,i)
 if max(idx)>=len(verts) or not all(math.isfinite(v) for pt in verts for v in pt):raise ValueError("Invalid topology")
 return verts,[list(idx[j:j+3]) for j in range(0,m,3)]

def main():
 atlas_bytes,atlas_proof=download("atlas.json")
 atlas=json.loads(atlas_bytes)
 assert atlas["version"]=="BodyParts3D 4.0"
 selected={**BONES,**MUSCLES}
 chunks={};checks={"atlas":atlas_proof}
 for chunk in (1,11,13):
  name=f"body-{chunk}.bin"
  raw,proof=download(name)
  if len(raw)!=atlas["chunks"][chunk]["bytes"]:raise ValueError("Unexpected chunk length")
  chunks[chunk]=raw;checks[name]=proof
 result={"schema":"body-live/hip-sourced-v1","dataset":"BodyParts3D 4.0","license":"CC BY 4.0",
  "source_commit":PIN,"shared_transform":{"origin_metres":ORIGIN,"scale":SCALE,
  "source_axes":"source metres, Y-up; uniform transform for all anatomical components"},
  "parts":{}}
 evidence={}
 for key,(name,fma) in selected.items():
  arr=[p for p in atlas["parts"] if p["name"]==name and p["conceptId"]==fma]
  if len(arr)!=1:raise ValueError("Missing or duplicate "+key)
  p=arr[0];verts,faces=decode(chunks[p["chunk"]],p)
  result["parts"][key]={"name":name,"fma":fma,
    "system":"bone" if key in BONES else "muscle",
    "vertices":[[round((v[i]-ORIGIN[i])*SCALE,5) for i in range(3)] for v in verts],
    "faces":faces}
  evidence[key]={"fma":fma,"source_name":name,"chunk":p["chunk"],
    "vertex_count":len(verts),"triangle_count":len(faces),
    "bbox_metres":{"min":[min(v[i] for v in verts) for i in range(3)],
                   "max":[max(v[i] for v in verts) for i in range(3)]}}
 if not all(len(p["faces"])>200 for p in result["parts"].values()):raise ValueError("Incomplete model")
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/"hip-source.json").write_text(json.dumps(result,separators=(",",":"))+"\n")
 proof={"schema":"body-live/hip-source-proof-v1","source":"BodyParts3D 4.0 © DBCLS",
 "attribution":"BodyParts3D, © The Database Center for Life Science, CC Attribution 4.0 International",
 "license_url":"https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
 "distribution":"https://github.com/ashemag/human-atlas",
 "pinned_commit":PIN,"inputs":checks,"parts":evidence,"transform":result["shared_transform"],
 "anatomist_reviewed":False,"biomechanics_validated":False,
 "nerve_path":"Not in imported source subset; schematic educational approximation",
 "joint_pivot":"Estimated display origin; not landmark measured",
 "notes":["Reference-pose anatomy; muscles are static and concealed in motion inspection.",
 "Joint animation uses a schematic fixed ball-and-socket pivot and Euler rotations.",
 "No claim that nerve path or muscle attachments are reviewed; no diagnosis or stress estimates."]}
 (OUT/"provenance.json").write_text(json.dumps(proof,indent=2)+"\n")
 print(json.dumps({"imported":list(result["parts"]),"vertices":sum(len(p["vertices"]) for p in result["parts"].values()),"triangles":sum(len(p["faces"]) for p in result["parts"].values()),"size":(OUT/"hip-source.json").stat().st_size}))

if __name__=="__main__":main()
