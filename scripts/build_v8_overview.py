#!/usr/bin/env python3
"""V8 unified overview LOD: selected anatomically aligned BodyParts3D meshes.

Builds mobile-friendly overview geometry from the same six SHA-pinned detail files
used in the labs. NEVER mirrors, manufactures or repositions anatomical surfaces.
The original 78-bone context remains a separate, immutable source-derived LOD.
"""
from __future__ import annotations
import hashlib, json, math
from pathlib import Path
import numpy as np
import fast_simplification

ROOT=Path(__file__).resolve().parents[1]
REGIONS=("skull","neck","thorax","elbow","wrist","ankle")
SKELETON=ROOT/"atlas/assets/body-skeleton.json"
PROOF=ROOT/"atlas/regions/provenance.json"
DEST=ROOT/"atlas/assets/v8-overview-detail.json"
MANIFEST=ROOT/"atlas/assets/v8-overview-provenance.json"

def digest(raw:bytes)->str:return hashlib.sha256(raw).hexdigest()
def mesh_lod(part,target):
    vertices=np.asarray(part["vertices"],dtype=np.float64)
    triangles=np.asarray(part["faces"],dtype=np.int32)
    if len(triangles)>target:
        ratio=(len(triangles)-target)/len(triangles)
        vertices,triangles=fast_simplification.simplify(vertices,triangles,ratio)
        vertices=np.asarray(vertices,dtype=np.float64)
        triangles=np.asarray(triangles,dtype=np.int32)
    if len(triangles)<25 or not np.isfinite(vertices).all():
        raise ValueError("Unusable overview mesh "+part["name"])
    if int(triangles.max())>=len(vertices) or int(triangles.min())<0:
        raise ValueError("Broken overview topology "+part["name"])
    return dict(name=part["name"],fma=part["fma"],system=part["system"],
        vertices=np.round(vertices,4).tolist(),faces=triangles.tolist())

def main():
    original=json.loads(SKELETON.read_text())
    proofs=json.loads(PROOF.read_text())
    if proofs["pinned_commit"]!=original["source_commit"]:
        raise ValueError("Mixed source release")
    base={p["id"] for p in original["parts"]}
    bones={};muscles={};reused={};input_hashes={}
    counts={}
    for region in REGIONS:
        path=ROOT/f"atlas/regions/{region}.json"
        raw=path.read_bytes()
        reference=proofs["regions"][region]
        if digest(raw)!=reference["asset_sha256"]:raise ValueError("SHA mismatch "+region)
        source=json.loads(raw)
        if source["source_commit"]!=original["source_commit"]:
            raise ValueError("Source release mismatch "+region)
        if source["source_frame"]["origin_metres"]!=[0,.9,0] or source["source_frame"]["scale"]!=5:
            raise ValueError("Coordinate frame mismatch "+region)
        counts[region]={"bones":len(source["parts"]),"muscles":len(source["muscle_parts"])}
        input_hashes[region]=reference["asset_sha256"]
        for category,key in ((bones,"parts"),(muscles,"muscle_parts")):
            for name,part in source[key].items():
                if name in category:
                    if category[name]["fma"]!=part["fma"]:
                        raise ValueError("Conflicting FMA for "+name)
                    reused.setdefault(name,[]).append(region)
                    continue
                if category is bones and name in base:
                    reused.setdefault(name,[]).append(region)
                    continue
                target=min(len(part["faces"]),440 if category is bones else (520 if region=="thorax" else 300))
                item=mesh_lod(part,target)
                item["region"]=region
                item["group"]={"skull":"head","neck":"spine","thorax":"thorax",
                    "elbow":"upper","wrist":"upper","ankle":"lower"}[region]
                category[name]=item
    asset={"schema":"body-live/overview-v8-v1","dataset":"BodyParts3D 4.0",
      "source_commit":original["source_commit"],"source_frame":original["source_frame"],
      "license":"CC BY 4.0","bones":bones,"muscles":muscles}
    DEST.write_text(json.dumps(asset,separators=(",",":"))+"\n")
    manifest={"schema":"body-live/overview-v8-provenance-v1","source_commit":original["source_commit"],
      "license":"CC BY 4.0","anatomist_reviewed":False,"kinematics_validated":False,
      "original_bones":len(original["parts"]),"additional_bones":len(bones),
      "unique_muscles":len(muscles),"region_counts":counts,"detail_sha256":input_hashes,
      "overview_sha256":digest(DEST.read_bytes()),"reused_region_parts":reused,
      "geometry":"exact source frame; simplification only; no mirroring or synthesized meshes",
      "incomplete":["Unrepresented left hand and foot bones","Unrepresented facial/jaw muscles",
         "Missing tendons and ligaments","No anatomist-reviewed muscle attachments",
         "Reference-source sciatic nerve not spatially verified across these meshes"]}
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"additional_bones":len(bones),"unique_muscles":len(muscles),
        "triangles":sum(len(p["faces"]) for p in list(bones.values())+list(muscles.values())),
        "bytes":DEST.stat().st_size,"source":original["source_commit"]},indent=2))

if __name__=="__main__":main()
