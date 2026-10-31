#!/usr/bin/env python3
"""BODY / LIVE V7.0 · deterministic, pinned, same-source whole-body regions.
BodyParts3D 4.0 via ashemag/human-atlas, CC BY 4.0.
No inferred or synthetic geometry. Imports regions requested for exploration.
All source meshes remain a single reference pose. Never claim validated motions.
"""
from __future__ import annotations
import hashlib,json,re,struct,urllib.request,time,math
from pathlib import Path

PIN="1c38bf35c254a891200d3cedecfd57abebe83d8d"
PINNED_ATLAS_BLOB="0f81b5621479a0c0548f4683c316f33bd4d6545b"
BASE=f"https://raw.githubusercontent.com/ashemag/human-atlas/{PIN}/public/models/"
DEST=Path(__file__).resolve().parents[1]/"atlas/regions"

SKULL=["Frontal bone","Occipital bone","Sphenoid bone","Mandible"]+[
 f"{side} {bone}" for side in ("Left","Right")
 for bone in ("parietal bone","temporal bone","maxilla","nasal bone","zygomatic bone")]
NECK=["Atlas","Axis"]+[f"{s} cervical vertebra" for s in (
 "Third","Fourth","Fifth","Sixth","Seventh")]+["Hyoid bone"]
THORAX=[f"{side} {s} rib" for side in ("Left","Right") for s in (
 "first","second","third","fourth","fifth","sixth","seventh",
 "eighth","ninth","tenth","eleventh","twelfth")]+[
 "Manubrium","Body of sternum","Xiphoid process",
 "Third thoracic vertebra","Fifth thoracic vertebra","Seventh thoracic vertebra"]
ELBOW=["Right humerus","Right radius","Right ulna"]
WRIST=["Right radius","Right ulna"]+[f"Right {s}" for s in (
 "scaphoid","lunate","triquetral","pisiform","trapezium","trapezoid","capitate","hamate")]+[
 f"Right {s} metacarpal bone" for s in ("first","second","third","fourth","fifth")]
ANKLE=["Right tibia","Right fibula","Right talus","Right calcaneus","Navicular bone of right foot",
 "Right cuboid bone"]+[f"Right {s} cuneiform bone" for s in (
 "medial","intermediate","lateral")]+[
 f"Right {s} metatarsal bone" for s in ("first","second","third","fourth","fifth")]
REGIONS={"skull":SKULL,"neck":NECK,"thorax":THORAX,"elbow":ELBOW,"wrist":WRIST,"ankle":ANKLE}

# Explicit, exact source names. "Muscle" is a functional grouping here:
# BodyParts3D categorizes a few named lower-limb muscles as skeletal.
# The raw upstream system label is retained in the provenance record.
MUSCLES={
 "skull": ["Right inferior rectus","Right lateral rectus","Right medial rectus","Right superior rectus","Right superior oblique","Right inferior oblique","Left inferior rectus","Left lateral rectus","Left medial rectus","Left superior rectus","Left superior oblique","Left inferior oblique","Right mylohyoid","Left mylohyoid","Right geniohyoid","Left geniohyoid"],
 "neck": ["Left sternocleidomastoid","Right sternocleidomastoid","Left scalenus anterior","Right scalenus anterior","Left scalenus medius","Right scalenus medius","Left scalenus posterior","Right scalenus posterior","Left splenius capitis","Right splenius capitis","Left longus capitis","Right longus capitis","Left platysma","Right platysma"],
 "thorax": ["Right serratus anterior","Left serratus anterior","Right pectoralis minor","Left pectoralis minor","Sternocostal part of right pectoralis major","Sternocostal part of left pectoralis major","Right transversus thoracis","Left transversus thoracis","Diaphragm","external intercostal muscle","Internal intercostal muscle"],
 "elbow": ["Right brachialis","Right brachioradialis","Long head of right biceps brachii","Short head of right biceps brachii","Lateral head of right triceps brachii","Long head of right triceps brachii","Medial head of right triceps brachii","Right supinator","Humeral head of right pronator teres","Ulnar head of right pronator teres"],
 "wrist": ["Right flexor carpi radialis","Right palmaris longus","Right extensor carpi radialis brevis","Right extensor carpi radialis longus","Right flexor digitorum profundus","Right extensor digitorum","Right opponens pollicis","Right abductor pollicis brevis","Right abductor pollicis longus","Humeral head of right flexor carpi ulnaris"],
 "ankle": ["Right tibialis anterior","Right tibialis posterior","Right fibularis longus","Right fibularis brevis","Lateral head of right gastrocnemius","Medial head of right gastrocnemius","Right soleus","Right flexor hallucis longus","Right extensor hallucis longus","Right flexor digitorum longus","Right extensor digitorum longus","Right flexor digitorum brevis"],
}

def load(name):
 url=BASE+name
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={
    "User-Agent":"BODY-LIVE-V7-pinned-import/1.0"}),timeout=70) as stream:data=stream.read()
   blob=hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
   return data,{"url":url,"git_blob_sha1":blob,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}
  except Exception:
   if attempt==2:raise
   time.sleep(3+2*attempt)

def id_of(name):
 return re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-")

def decode(raw,info):
 vcount,indexcount=int(info["vertexCount"]),int(info["indexCount"])
 vp,ip=int(info["positions"]),int(info["indices"])
 if vcount<35 or indexcount<150 or indexcount%3 or min(vp,ip)<0:
  raise ValueError("Incomplete source mesh "+info["name"])
 if vp+12*vcount>len(raw) or ip+4*indexcount>len(raw):
  raise ValueError("Source offsets out of range "+info["name"])
 verts=list(struct.iter_unpack("<fff",raw[vp:vp+12*vcount]))
 ix=struct.unpack_from("<"+str(indexcount)+"I",raw,ip)
 if max(ix)>=vcount or not all(math.isfinite(x) for v in verts for x in v):
  raise ValueError("Invalid source topology "+info["name"])
 return verts,[list(ix[i:i+3]) for i in range(0,indexcount,3)]

def main():
 atlasraw,atlasmeta=load("atlas.json")
 if atlasmeta["git_blob_sha1"]!=PINNED_ATLAS_BLOB:raise ValueError("Pinned atlas hash changed")
 atlas=json.loads(atlasraw)
 if atlas.get("version")!="BodyParts3D 4.0":raise ValueError("Wrong source release")
 index={}
 for entry in atlas["parts"]:index.setdefault(entry["name"],[]).append(entry)
 groups={}
 for region,names in REGIONS.items():
  if len(set(names))!=len(names):raise ValueError("Duplicate region label "+region)
  chosen=[]
  for name in names:
   options=index.get(name,[])
   # Hyoid duplicated in source distribution; only explicitly selected 12.
   if name=="Hyoid bone":options=[x for x in options if x["chunk"]==12]
   if len(options)!=1:raise ValueError(f"{region}: {name}: {len(options)} exact source candidates")
   chosen.append(options[0])
  groups[region]=chosen
 muscle_groups={}
 for region,names in MUSCLES.items():
  if len(set(names))!=len(names):raise ValueError("Duplicate muscle label "+region)
  selected=[]
  for name in names:
   options=index.get(name,[])
   if len(options)!=1:raise ValueError(f"{region}: muscle {name}: {len(options)} exact source candidates")
   info=options[0]
   if info["vertexCount"]<35 or info["indexCount"]<150:raise ValueError("Incomplete muscle "+name)
   selected.append(info)
  muscle_groups[region]=selected
 chunks={}
 proof={"schema":"body-live/extended-regions-provenance-v1","dataset":"BodyParts3D 4.0",
  "attribution":"BodyParts3D © Database Center for Life Science","license":"CC BY 4.0",
  "license_url":"https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  "upstream":"https://github.com/ashemag/human-atlas","pinned_commit":PIN,
  "source_frame":{"origin_metres":[0,.9,0],"scale":5,"axes":"Y-up source metres"},
  "anatomist_reviewed":False,"kinematics_validated":False,"inputs":{"atlas.json":atlasmeta},
  "regions":{},"unsupported":[
   "Tendons, cartilage, ligaments, nerve geometry, and connective tissue not reconstructed by this import",
   "Muscle meshes are licensed reference-pose anatomy; named subsets are not exhaustive, attachments are not experimentally verified",
   "No measured elbow, radiocarpal, ankle, craniocervical, or temporomandibular motion",
   "A source mesh's presence does not certify clinical accuracy or patient-specific anatomy"]}
 DEST.mkdir(parents=True,exist_ok=True)
 for chunk in sorted({x["chunk"] for v in list(groups.values())+list(muscle_groups.values()) for x in v}):
  raw,meta=load(f"body-{chunk}.bin")
  if len(raw)!=atlas["chunks"][chunk]["bytes"]:raise ValueError("Chunk byte mismatch")
  chunks[chunk]=raw;proof["inputs"][f"body-{chunk}.bin"]=meta
 for region,items in groups.items():
  parts={}
  for info in items:
   verts,faces=decode(chunks[info["chunk"]],info)
   # Exact scene reference used in existing 78-part LOD: (source - [0,.9,0])*5.
   vertices=[[round((p[i]-(.9 if i==1 else 0))*5,5) for i in range(3)] for p in verts]
   key=id_of(info["name"])
   parts[key]={"name":info["name"],"fma":info["conceptId"],"system":"bone",
    "vertices":vertices,"faces":faces}
  muscle_parts={}
  for info in muscle_groups[region]:
   verts,faces=decode(chunks[info["chunk"]],info)
   vertices=[[round((p[i]-(.9 if i==1 else 0))*5,5) for i in range(3)] for p in verts]
   key=id_of(info["name"])
   if key in parts or key in muscle_parts:raise ValueError("Duplicate anatomical ID "+key)
   muscle_parts[key]={"name":info["name"],"fma":info["conceptId"],"system":"muscle",
    "source_system":info["system"],"vertices":vertices,"faces":faces}
  asset={"schema":"body-live/extended-region-v1","region":region,"dataset":"BodyParts3D 4.0",
   "license":"CC BY 4.0","source_commit":PIN,
   "source_frame":{"origin_metres":[0,.9,0],"scale":5,"axes":"Y-up source metres"},
   "parts":parts,"muscle_parts":muscle_parts}
  path=DEST/f"{region}.json"
  path.write_text(json.dumps(asset,separators=(",",":"))+"\n")
  proof["regions"][region]={"asset_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
   "structures":{k:{"name":v["name"],"fma":v["fma"],"vertices":len(v["vertices"]),
      "triangles":len(v["faces"])} for k,v in parts.items()},
   "source_parts":len(parts),"muscle_source_parts":len(muscle_parts),
   "muscles":{k:{"name":v["name"],"fma":v["fma"],"source_system":v["source_system"],
     "vertices":len(v["vertices"]),"triangles":len(v["faces"])} for k,v in muscle_parts.items()},
   "triangles":sum(len(v["faces"]) for v in list(parts.values())+list(muscle_parts.values())),
   "movement":"source-reference-pose; no measured biomechanics"}
  print(region,len(parts),"bones",len(muscle_parts),"muscles",proof["regions"][region]["triangles"],"triangles",path.stat().st_size,"bytes")
 (DEST/"provenance.json").write_text(json.dumps(proof,indent=2)+"\n")

if __name__=="__main__":main()
