#!/usr/bin/env python3
"""Import OMFAtlas' registered BodyParts3D 3.0 facial subset, with SHA pinning.

OMFAtlas's 47 original OBJ meshes were transformed against BodyParts3D 4.0
control bones. We fetch its documented binary derivative at a PINNED commit,
verify both Git blob IDs, then convert OMF Atlas' source-frame metres to our
canonical (metres - [0,.9,0])*5, without inventing new surfaces.

This is a technical overlay, NOT independent clinical signoff or a validated
jaw-muscle motion engine.
"""
import hashlib,json,struct,urllib.request
from pathlib import Path
from build_v8_overview import mesh_lod

ROOT=Path(__file__).resolve().parents[1]
SOURCE_REPO="choxos/OMFAtlas"
COMMIT="c835665a9ade09ee0b993cee6eee1b25b7f7311b"
BASE=f"https://raw.githubusercontent.com/{SOURCE_REPO}/{COMMIT}/public/models/facial/"
EXPECTED_MANIFEST_BLOB="de8608c724c50f15955bf0269767e0ec65a390a7"
EXPECTED_BINARY_BLOB="0332821585e1b03ac4258d891b3ec220ab3ff30a"
TARGET=ROOT/"atlas/assets/v10-facial-reference.json"
PROOF=ROOT/"atlas/assets/v10-facial-provenance.json"

def gitsha(data):
 return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def download(file,blob):
 req=urllib.request.Request(BASE+file,headers={"User-Agent":"BODY-LIVE-registered-open-anatomy/1.0"})
 with urllib.request.urlopen(req,timeout=95) as resp:
  data=resp.read(20000000)
 if gitsha(data)!=blob:raise RuntimeError("Pinned OMFAtlas Git blob SHA mismatch: "+file+" expected="+blob+" observed="+gitsha(data)+" bytes="+str(len(data))+" prefix="+repr(data[:32]))
 return data
def bounds(verts):
 return [[min(v[i] for v in verts),max(v[i] for v in verts)] for i in range(3)]
def boxgap(a,b):
 return (sum(max(0,lo1-hi2,lo2-hi1)**2 for (lo1,hi1),(lo2,hi2) in zip(a,b)))**.5

def main():
 manifest_raw=download("atlas.json",EXPECTED_MANIFEST_BLOB)
 binary=download("facial.bin",EXPECTED_BINARY_BLOB)
 info=json.loads(manifest_raw)
 if len(info["parts"])!=47 or info["bytes"]!=len(binary):raise ValueError("Facial pack incomplete")
 if info["license"]!="CC-BY-SA-2.1-JP" or not info["source"].startswith("BodyParts3D 3.0"):
  raise ValueError("Missing original asset license or provenance")
 registration=info["registration"]
 if registration["heldOutSourceToTargetSurfaceRmsMm"]>.5 or registration["heldOutTargetToSourceSurfaceRmsMm"]>.5:
  raise ValueError("Source's held-out bone registration exceeds 0.5 mm RMS")
 base=json.loads((ROOT/"atlas/assets/body-skeleton.json").read_text())
 old8=json.loads((ROOT/"atlas/assets/v8-overview-detail.json").read_text())
 old9=json.loads((ROOT/"atlas/assets/v9-source-expansion.json").read_text())
 current=[*base["parts"],*old8["bones"].values(),*old8["muscles"].values(),
          *old9["bones"].values(),*old9["muscles"].values(),*old9["connective"].values()]
 fmas={p["fma"] for p in current}
 ids={p["id"] for p in base["parts"]}|set(old8["bones"])|set(old8["muscles"])|set(old9["bones"])|set(old9["muscles"])|set(old9["connective"])
 skull=next(p for p in base["parts"] if p["name"]=="Mandible")
 jaw_bounds=bounds(skull["vertices"])
 out={}
 source_sha={}
 for p in info["parts"]:
  sid=p["conceptId"]
  norm=p["name"].lower()
  key="facial-v3-"+sid.lower()
  if sid in fmas or key in ids or key in out:raise ValueError("Duplicate FMA or identity "+sid)
  count=p["vertexCount"];faces=p["indexCount"]
  rawpos=binary[p["positions"]:p["positions"]+12*count]
  rawindices=binary[p["indices"]:p["indices"]+4*faces]
  if len(rawpos)!=12*count or len(rawindices)!=4*faces or faces%3:raise ValueError("Truncated bin "+sid)
  tuples=list(struct.iter_unpack("<fff",rawpos))
  # Source OMF coordinates already registered to BP3D v4 metre-Y-up frame.
  v=[[round(float(x)*5,5),round((float(y)-.9)*5,5),round(float(z)*5,5)] for x,y,z in tuples]
  if any(not all(abs(x)<100 for x in row) for row in v):raise ValueError("Nonfinite/outlier face positions "+sid)
  triangles=list(struct.iter_unpack("<III",rawindices))
  if any(any(i>=count for i in t) for t in triangles):raise ValueError("Invalid mesh topology "+sid)
  bbox=bounds(v)
  # Both OMF and the atlas use the same BodyParts3D reference head. Checks
  # reject mirrored, mm/metre and gross registration errors.
  if bbox[1][0]<2.70 or bbox[1][1]>4.35 or bbox[0][0]<-.80 or bbox[0][1]>.80 or bbox[2][0]<-.95 or bbox[2][1]>1.0:
   raise ValueError("Face not in canonical skull frame: "+p["name"]+" "+str(bbox))
  if any(word in norm for word in ("masseter","pterygoid")) and boxgap(bbox,jaw_bounds)>.37:
   raise ValueError("Mastication muscle too far from mandible "+p["name"])
  target=2000 if any(t in norm for t in ("orbicularis","temporalis","masseter","pterygoid")) else 1250
  reduced=mesh_lod({"name":p["name"],"fma":sid,"system":"muscle","vertices":v,"faces":triangles},target)
  reduced["group"]="head"
  reduced["region"]="facial-v3"
  reduced["source_system"]="muscular"
  reduced["source_version"]="BodyParts3D 3.0"
  reduced["reference_pose_only"]=True
  out[key]=reduced
  source_sha[key]=p["sourceSha256"]
 payload={"schema":"body-live/v10-facial-source-v1","source":"BodyParts3D 3.0, via registered OMFAtlas subset",
  "source_commit":COMMIT,"base_source_commit":base["source_commit"],
  "source_frame":{"origin_metres":[0,.9,0],"scale":5,"axes":"BodyParts3D 4.0 derivative metres Y up"},
  "license":"CC-BY-SA-2.1-JP","parts":out}
 TARGET.write_text(json.dumps(payload,separators=(",",":"))+"\n")
 proof={"schema":"body-live/v10-facial-provenance-v1","source_repo":SOURCE_REPO,
  "pinned_omf_commit":COMMIT,"manifest_git_blob":EXPECTED_MANIFEST_BLOB,
  "facial_bin_git_blob":EXPECTED_BINARY_BLOB,
  "manifest_sha256":hashlib.sha256(manifest_raw).hexdigest(),
  "binary_sha256":hashlib.sha256(binary).hexdigest(),
  "asset_sha256":hashlib.sha256(TARGET.read_bytes()).hexdigest(),
  "license":"CC-BY-SA-2.1-JP",
  "attribution":info["attribution"],"original_archive":info["sourceUrl"],
  "original_obj_sha256":source_sha,"upstream_registration":registration,
  "coordinate_transform":"[x,(y-.9),z]*5 from OMFAtlas BodyParts3D 4.0-registered metres",
  "source_alignment_independently_recomputed":False,
  "source_alignment_method":"Upstream held-out left maxilla RMS plus local source-mandible bbox fit",
  "all_geometry_reused":True,"anatomist_reviewed":False,
  "jaw_dynamics_validated":False,"clinical_use_approved":False,
  "unique_facial_muscles":len(out),"total_muscle_meshes":386+len(out),
  "excluded_bones":["coccyx","left malleus","right malleus","left incus","right incus","left stapes","right stapes"],
  "limits":["V3.0 facial muscles static reference; no measured tendon origins or insertions",
   "Transform validated numerically upstream, not independently fitted from original four controls in this repository",
   "CC BY-SA 2.1 Japan applies to these adapted facial assets, separately from V4.0 CC BY 4.0 geometry",
   "Adult reference, educational display; no medical or biomechanical expert review"]}
 PROOF.write_text(json.dumps(proof,indent=2)+"\n")
 print(json.dumps({"source":SOURCE_REPO,"meshes":len(out),"triangles":sum(len(p["faces"]) for p in out.values()),
  "asset_bytes":TARGET.stat().st_size,"manifest_sha256":proof["manifest_sha256"],
  "model_sha256":proof["asset_sha256"]},indent=2))
if __name__=="__main__":main()
