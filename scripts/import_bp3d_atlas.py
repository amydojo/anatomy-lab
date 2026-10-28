#!/usr/bin/env python3
"""BODY / LIVE V6: pinned BodyParts3D 4.0 full-body skeletal overview.

Only derived 4.0 CC BY 4.0 assets, not registered nerve or unreviewed hip animation.
Source: ashemag/human-atlas pinned distribution; one reference frame, no per-bone reposition.
Generates /atlas/assets/body-skeleton.json and provenance.json.
This is skeletal coverage, not a whole-person clinical scan.
"""
from pathlib import Path
import hashlib,json,math,re,struct,urllib.request
import numpy as np
import fast_simplification

PIN="1c38bf35c254a891200d3cedecfd57abebe83d8d"
ROOT=f"https://raw.githubusercontent.com/ashemag/human-atlas/{PIN}/public/models/"
SHA={"atlas.json":"0f81b5621479a0c0548f4683c316f33bd4d6545b",
     "body-11.bin":"f437a61bfd8c976108abf3e3a607784af3eb3575",
     "body-12.bin":"88e823456d067922f9c27c2405a69fe983eef68b",
     "body-13.bin":"24a9953b6677cf07cd6beea9f221a0690c6efa44"}
OUT=Path(__file__).resolve().parents[1]/"atlas/assets"
# Preserve absolute source coordinates. All region transitions resolve through
# known, source-matched reference frame transforms.
FRAME={"origin_metres":[0,.90,0],"scale":5,"axes":"BodyParts3D 4.0 derivative metres, Y-up"}
INDIVIDUAL={
"Frontal bone","Left parietal bone","Right parietal bone","Occipital bone",
"Left temporal bone","Right temporal bone","Sphenoid bone","Mandible","Atlas","Axis",
"Sacrum","Body of sternum",
"Left clavicle","Right clavicle","Left scapula","Right scapula",
"Left humerus","Right humerus","Left radius","Right radius","Left ulna","Right ulna",
"Left hip bone","Right hip bone","Left femur","Right femur",
"Left tibia","Right tibia","Left fibula","Right fibula","Left patella","Right patella"
}
SPINE=re.compile(r"^(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth) (?:cervical|thoracic|lumbar) vertebra$",re.I)
RIB=re.compile(r"^(?:Left|Right) (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) rib$",re.I)
def download(filename):
  with urllib.request.urlopen(urllib.request.Request(ROOT+filename,headers={"User-Agent":"BODY-LIVE-Atlas-import"}),timeout=90) as r:raw=r.read()
  blob=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
  if blob!=SHA[filename]:raise RuntimeError("Hash mismatch for "+filename)
  return raw,{"url":ROOT+filename,"git_blob_sha1":blob,"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)}
def decode(blob,item):
  n=int(item["vertexCount"]);m=int(item["indexCount"]);p=int(item["positions"]);i=int(item["indices"])
  if not (n>0 and m>0 and m%3==0 and p>=0 and p+12*n<=len(blob) and i>=0 and i+4*m<=len(blob)):raise ValueError("Invalid source offsets")
  vert=np.frombuffer(blob,dtype="<f4",count=3*n,offset=p).reshape(-1,3).astype("float64")
  faces=np.frombuffer(blob,dtype="<u4",count=m,offset=i).reshape(-1,3).astype("int32")
  if faces.max()>=n or not np.isfinite(vert).all():raise ValueError("Invalid source vertices or triangles")
  return vert,faces
def target_faces(name,n):
  if "rib" in name.lower():return min(n,210)
  if "vertebra" in name.lower() or name in ("Atlas","Axis"):return min(n,290)
  if "scapula" in name.lower():return min(n,550)
  if name in ("Frontal bone","Occipital bone","Sphenoid bone","Mandible"):return min(n,600)
  return min(n,360)
def group_for(name):
  n=name.lower()
  if "rib" in n or "sternum" in n:return "thorax"
  if "vertebra" in n or name in ("Atlas","Axis","Sacrum"):return "spine"
  if any(k in n for k in ("frontal","parietal","temporal","occipital","sphenoid","mandible")):return "head"
  if any(k in n for k in ("hip bone","femur","tibia","fibula","patella")):return "lower"
  return "upper"
def main():
  atlas_raw,atlas_proof=download("atlas.json")
  atlas=json.loads(atlas_raw)
  if atlas["version"]!="BodyParts3D 4.0":raise ValueError("Unexpected source release")
  selected=[p for p in atlas["parts"] if p["name"] in INDIVIDUAL or SPINE.fullmatch(p["name"]) or RIB.fullmatch(p["name"])]
  names=[p["name"] for p in selected]
  if len(names)!=len(set(names)):raise ValueError("Duplicate model names: prevent silently mixed models")
  if not INDIVIDUAL.issubset(names):raise ValueError("Missing selected core skeleton bones "+str(INDIVIDUAL-set(names)))
  if sum("rib" in x.lower() for x in names)!=24:raise ValueError("Missing bilateral rib anatomy")
  if sum("vertebra" in x.lower() for x in names)<20:raise ValueError("Missing reference spine")
  chunks={};sourceInputs={"atlas.json":atlas_proof}
  for n in (11,12,13):
    name=f"body-{n}.bin";b,proof=download(name)
    if len(b)!=atlas["chunks"][n]["bytes"]:raise ValueError("Chunk size conflict")
    chunks[n]=b;sourceInputs[name]=proof
  result={"schema":"body-live/atlas-skeleton-v1","dataset":"BodyParts3D 4.0",
          "license":"CC BY 4.0","source_commit":PIN,"source_frame":FRAME,
          "mesh_kind":"single-reference skeletal context, decimated for mobile","parts":[]}
  details={}
  total=0
  for p in selected:
    if p["chunk"] not in chunks:raise ValueError(f"Unexpected mesh chunk {p['name']} {p['chunk']}")
    vertices,faces=decode(chunks[p["chunk"]],p)
    target=target_faces(p["name"],len(faces))
    if target<len(faces):
      vertices,faces=fast_simplification.simplify(vertices,faces,(len(faces)-target)/len(faces))
      vertices=np.asarray(vertices,dtype=np.float64);faces=np.asarray(faces,dtype=np.int32)
    if len(faces)<70 or len(vertices)<35:raise ValueError("Over-decimated "+p["name"])
    s=(vertices-np.array(FRAME["origin_metres"]))*FRAME["scale"]
    s=np.round(s,4)
    if not np.isfinite(s).all():raise ValueError("NaNs in LOD")
    key=p["name"].lower().replace(" ","-")
    result["parts"].append({"id":key,"name":p["name"],"fma":p["conceptId"],"group":group_for(p["name"]),
      "vertices":s.tolist(),"faces":faces.tolist()})
    total+=len(faces)
    details[key]={"fma":p["conceptId"],"source_chunk":p["chunk"],"source_verts":p["vertexCount"],"source_triangles":p["indexCount"]//3,
     "lod_vertices":len(vertices),"lod_triangles":len(faces),"target_faces":target}
  OUT.mkdir(parents=True,exist_ok=True)
  asset=OUT/"body-skeleton.json"
  asset.write_text(json.dumps(result,separators=(",",":"))+"\n")
  proof={"schema":"body-live/atlas-provenance-v1",
    "attribution":"BodyParts3D © The Database Center for Life Science (DBCLS), CC BY 4.0",
    "source_license":"https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
    "distribution":"https://github.com/ashemag/human-atlas",
    "pinned_commit":PIN,"source_files":sourceInputs,"source_frame":FRAME,
    "part_count":len(details),"lod_triangle_count":total,
    "lod_json_sha256":hashlib.sha256(asset.read_bytes()).hexdigest(),"models":details,
    "anatomist_reviewed":False,"same_reference_release":True,"patient_specific":False,
    "not_complete_body":True,"absent_structures":["full hand and foot structures","complete facial bones","ligaments","soft tissues","organs"],
    "limitations":["Source-derived skeletal model from one reference atlas release; not imaged patient anatomy.",
      "Simplified LOD surfaces are for navigation, not anatomical diagnosis.",
      "Hip-to-Knee coordinate correspondence still does not verify the separately sourced sciatic nerve.",
      "Do not represent unsupported regions as fully reconstructed anatomy."]}
  (OUT/"provenance.json").write_text(json.dumps(proof,indent=2)+"\n")
  print(json.dumps({"models":len(details),"lod_triangles":total,"bytes":asset.stat().st_size,"groups":{k:sum(p["group"]==k for p in result["parts"]) for k in ["head","thorax","spine","upper","lower"]}}))
if __name__=="__main__":main()
