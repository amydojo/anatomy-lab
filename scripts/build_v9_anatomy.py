#!/usr/bin/env python3
"""BODY / LIVE V9: pinned source geometry additions, never fabricated surfaces.

Phase A: all 56 phalanges and eight facial bones in the pinned atlas.
Seven missing conventional bones (six ossicles and coccyx) are NOT in source.
Phase B: remaining uniquely sourced muscular reference meshes.
Phase C: available connective structures and costal cartilage, static only.
"""
from __future__ import annotations
import hashlib,json,re
from pathlib import Path
from import_bp3d_whole_body import load,decode,id_of,PIN,PINNED_ATLAS_BLOB
from build_v8_overview import mesh_lod
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"atlas/assets/v9-source-expansion.json"
PROOF=ROOT/"atlas/assets/v9-source-provenance.json"
BONE_NAMES=("Ethmoid","Vomer","Left lacrimal bone","Right lacrimal bone",
 "Left palatine bone","Right palatine bone",
 "Left inferior nasal concha","Right inferior nasal concha")
BONE_GAPS=("Coccyx","Left malleus","Right malleus","Left incus","Right incus",
 "Left stapes","Right stapes")
NAME_FINGER=re.compile(r"^(Distal|Middle|Proximal) phalanx of (left|right) (index|middle|ring|little) finger$|^(Distal|Proximal) phalanx of (left|right) thumb$",re.I)
NAME_TOE=re.compile(r"^(Distal|Middle|Proximal) phalanx of (left|right) (second|third|fourth|little) toe$|^(Distal|Proximal) phalanx of (left|right) big toe$",re.I)
CARTILAGE=re.compile(r"^(Left|Right) (first|second|third|fourth|fifth|sixth|seventh) costal cartilage$",re.I)
CONNECTIVE=re.compile(r"ligament|tendon|membrane|linea alba|interosseous|raphe|trochlea|conus elasticus",re.I)
BACK=re.compile(r"trapezius|rhomboid|latissimus|longissimus|iliocostalis|spinalis|semispinalis|multifidus|splenius|interspinalis|serratus posterior",re.I)
CORE=re.compile(r"abdominis|external oblique|internal oblique|psoas|iliacus|quadratus lumborum|pubococcygeus|iliococcygeus|coccygeus",re.I)
THIGH=re.compile(r"sartorius|rectus femoris|adductor (brevis|longus|magnus|minimus)|semimembranosus|semitendinosus|biceps femoris|gracilis",re.I)
FACE=re.compile(r"masseter|temporalis|pterygoid|orbicularis|zygomaticus|buccinator|mentalis|frontalis|risorius|procerus|nasalis",re.I)
DIGITS=re.compile(r"hand|foot|hallucis|pollicis|lumbrical|interosse|digiti minimi|plantar",re.I)
def hash_data(raw):return hashlib.sha256(raw).hexdigest()
def main():
 raw,proof=load("atlas.json")
 if proof["git_blob_sha1"]!=PINNED_ATLAS_BLOB:raise ValueError("Pinned Atlas SHA1 changed")
 atlas=json.loads(raw)
 if atlas["version"]!="BodyParts3D 4.0":raise ValueError("Unexpected pinned source version")
 index={}
 for info in atlas["parts"]:index.setdefault(info["name"],[]).append(info)
 names=[i["name"] for i in atlas["parts"]]
 finger=sorted(n for n in names if NAME_FINGER.fullmatch(n))
 toe=sorted(n for n in names if NAME_TOE.fullmatch(n))
 if len(finger)!=28 or len(toe)!=28:raise ValueError(f"Missing phalanges in source {len(finger)}/{len(toe)}")
 for name in finger+toe+list(BONE_NAMES):
  if len(index.get(name,[]))!=1:raise ValueError("Ambiguous/missing conventional source bone "+name)
 for name in BONE_GAPS:
  if name in index:raise ValueError("Prior missing-bone claim is now outdated: "+name)
 old=json.loads((ROOT/"atlas/assets/v8-overview-detail.json").read_text())
 skel=json.loads((ROOT/"atlas/assets/body-skeleton.json").read_text())
 old_ids={p["id"] for p in skel["parts"]}|set(old["bones"])|set(old["muscles"])
 known_fma={p["fma"] for p in skel["parts"]}|{p["fma"] for p in list(old["bones"].values())+list(old["muscles"].values())}
 bone_infos=[index[name][0] for name in finger+toe+list(BONE_NAMES)]
 candidates={}
 for i in atlas["parts"]:
  system=i["system"];name=i["name"]
  if system=="muscular" and i["conceptId"] not in known_fma:
   candidates.setdefault(("muscles",i["conceptId"]),i)
  elif (system=="connective" and CONNECTIVE.search(name)) or CARTILAGE.fullmatch(name):
   candidates.setdefault(("connective",i["conceptId"]),i)
 planned=[("bones",i) for i in bone_infos]+[(kind,info) for (kind,_),info in sorted(candidates.items())]
 chunks={};inputs={"atlas.json":proof}
 for chunk in sorted({p["chunk"] for _,p in planned}):
  binary,meta=load(f"body-{chunk}.bin")
  if len(binary)!=atlas["chunks"][chunk]["bytes"]:raise ValueError("Length mismatch in chunk "+str(chunk))
  chunks[chunk]=binary;inputs[f"body-{chunk}.bin"]=meta
 groups={"bones":{},"muscles":{},"connective":{}}
 def classify(name,kind):
  if kind=="bones":return ("hand" if "finger" in name or "thumb" in name else "foot" if "toe" in name else "face")
  if kind=="connective":return "connective"
  if BACK.search(name):return "back"
  if CORE.search(name):return "core"
  if THIGH.search(name):return "thigh"
  if FACE.search(name):return "face"
  if DIGITS.search(name):return "intrinsic-hand-foot"
  return "other-source-muscle"
 def body_group(name,group):
  if group in ("hand","intrinsic-hand-foot"):return "upper"
  if group=="foot":return "lower"
  if group in ("face",):return "head"
  if group in ("back","core"):return "spine"
  if group=="thigh":return "lower"
  if group=="connective":
   if any(x in name.lower() for x in ("calcaneal","plantar","leg")):return "lower"
   if any(x in name.lower() for x in ("forearm","tendon of")):return "upper"
   if "costal" in name.lower():return "thorax"
   return "spine"
  return "thorax"
 by_fma={};skipped=[];truncated=[]
 for kind,info in planned:
  name=info["name"];fma=info["conceptId"];key=id_of(name)
  if key in old_ids or fma in known_fma:
   if kind=="bones":raise ValueError("Conventional new bone already imported "+name)
   skipped.append(name);continue
  if fma in by_fma:
   if kind=="bones":raise ValueError("Duplicate bone concept "+name)
   skipped.append(name);continue
  if key in {k for parts in groups.values() for k in parts}:
   raise ValueError("Duplicate normalized source identity "+name)
  vertices,faces=decode(chunks[info["chunk"]],info)
  verts=[[round((p[i]-(.9 if i==1 else 0))*5,5) for i in range(3)] for p in vertices]
  obj={"name":name,"fma":fma,"system":("bone" if kind=="bones" else "muscle" if kind=="muscles" else "connective"),"vertices":verts,"faces":faces}
  target=260 if kind=="bones" else 220 if kind=="muscles" else 170
  reduced=mesh_lod(obj,min(target,len(faces)))
  reduced["region"]="source-expansion"
  reduced["subgroup"]=classify(name,kind)
  reduced["group"]=body_group(name,reduced["subgroup"])
  reduced["source_system"]=info["system"]
  reduced["reference_pose_only"]=True
  groups[kind][key]=reduced;by_fma[fma]=name
 source_bones={k:len(v) for k,v in groups.items()}
 if source_bones["bones"]!=64:raise ValueError("The 64 source bone additions are incomplete")
 if source_bones["muscles"]<170:raise ValueError("Insufficient additional source muscles")
 relationship_specs=[
  ("right-calcaneal-tendon",["right-calcaneus","right-soleus","lateral-head-of-right-gastrocnemius"]),
  ("left-calcaneal-tendon",["left-calcaneus","left-soleus","lateral-head-of-left-gastrocnemius"]),
  ("interosseous-membrane-of-right-forearm",["right-radius","right-ulna"]),
  ("interosseous-membrane-of-left-forearm",["left-radius","left-ulna"]),
  ("interosseous-membrane-of-right-leg",["right-tibia","right-fibula"]),
  ("interosseous-membrane-of-left-leg",["left-tibia","left-fibula"])]
  # explicit structural relationships only: not validated attachment tracks
 valid_ids=old_ids|set(groups["bones"])|set(groups["muscles"])|set(groups["connective"])
 relationships=[]
 for ligament,neighbours in relationship_specs:
  if ligament not in valid_ids:continue
  listed=[n for n in neighbours if n in valid_ids]
  if listed:
   relationships.append({"structure":ligament,"related":listed,
    "relationship_kind":"educational_anatomical-association",
    "motion_validated":False,"attachment_coordinates_validated":False})
 asset={"schema":"body-live/v9-source-expansion-v1","source_commit":PIN,
  "source_frame":{"origin_metres":[0,.9,0],"scale":5,"axes":"Y-up source metres"},
  "dataset":"BodyParts3D 4.0","license":"CC BY 4.0",
  **groups,"relationships":relationships}
 OUT.write_text(json.dumps(asset,separators=(",",":"))+"\n")
 provenance={"schema":"body-live/v9-source-provenance-v1",
  "source_commit":PIN,"pinned_atlas_blob":PINNED_ATLAS_BLOB,"license":"CC BY 4.0",
  "attribution":"BodyParts3D © Database Center for Life Science",
  "anatomist_reviewed":False,"kinematics_validated":False,
  "clinical_use_approved":False,"mesh_transform":"(sourceXYZ - [0,.9,0])*5; simplification only",
  "conventional_skeleton":{"existing_bones":135,"phalanges":56,"facial_bones":8,
   "total_rendered_standard_bones":199,"reference_total":206,
   "unavailable_in_pinned_atlas":list(BONE_GAPS)},
  "asset_sha256":hash_data(OUT.read_bytes()),"counts":source_bones,
  "subgroups":{k:sum(1 for v in groups["muscles"].values() if v["subgroup"]==k) for k in
   ("back","core","thigh","face","intrinsic-hand-foot","other-source-muscle")},
  "source_files":inputs,"skipped_source_duplicates":skipped,
  "relationships":relationships,
  "limitations":["Coccyx and six middle ear ossicles are unavailable in this pinned source",
   "Most named facial-expression and mastication muscles are absent from this pinned atlas",
   "No experimental tendon attachments, force vectors, joint constraints or cartilage mechanics",
   "Static source connective meshes are visual references, not deformation rigs",
   "Additional left/right detailed lab motion requires separate independent validation"]}
 PROOF.write_text(json.dumps(provenance,indent=2)+"\n")
 print(json.dumps({"counts":source_bones,"subgroups":provenance["subgroups"],
  "asset_bytes":OUT.stat().st_size,"sha256":provenance["asset_sha256"],
  "available_standard_bones":199,"missing_standard_bones":list(BONE_GAPS)},indent=2))
if __name__=="__main__":main()
