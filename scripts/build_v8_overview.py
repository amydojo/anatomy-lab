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
from import_bp3d_whole_body import load as source_load, decode as source_decode, id_of, MUSCLES, WRIST, ANKLE

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
    # Bilateral completeness for the HOME specimen only. The focused wrist
    # and ankle labs remain explicitly right-sided. These left-side meshes
    # are fetched from the pinned upstream atlas (no mirroring/invention).
    raw,atlas_proof=source_load("atlas.json")
    upstream=json.loads(raw)
    if upstream["version"]!="BodyParts3D 4.0":raise ValueError("Unexpected dataset")
    index={}
    for info in upstream["parts"]:index.setdefault(info["name"],[]).append(info)
    extra_bones=[]
    for name in list(WRIST)+list(ANKLE):
        left=name.replace("Right","Left").replace("right","left")
        if left not in extra_bones:extra_bones.append(left)
    extra_muscles=[]
    for region in ("elbow","wrist","ankle"):
        for name in MUSCLES[region]:
            left=name.replace("Right","Left").replace("right","left")
            if left not in extra_muscles:extra_muscles.append(left)
    requests={}
    for name in extra_bones+extra_muscles:
        if len(index.get(name,[]))!=1:raise ValueError("Left-side source name ambiguous "+name)
        requests[name]=index[name][0]
    # Extend the overview with existing source-verified Hip, Knee and Shoulder
    # muscles; these use different local unit scales but the same pinned
    # BodyParts3D anatomical frame. Add their real left-sided counterparts.
    lab_files={"hip":"hip/spatial/assets/hip-source.json",
       "shoulder":"shoulder/spatial/assets/shoulder-source.json",
       "knee":"knee/spatial/assets/knee-muscles-source.json"}
    labs={};lab_hashes={};left_lab_region={}
    for region,filename in lab_files.items():
        data=(ROOT/filename).read_bytes()
        lab=json.loads(data)
        if lab["source_commit"]!=original["source_commit"] or lab["license"]!="CC BY 4.0":
            raise ValueError("Source mismatch for "+region)
        labs[region]=lab
        lab_hashes[region]=digest(data)
        for info in lab["parts"].values():
            if info.get("system")!="muscle":continue
            name=info["name"].replace("Right","Left").replace("right","left")
            if len(index.get(name,[]))!=1:raise ValueError("Missing source counterpart "+name)
            requests[name]=index[name][0]
            left_lab_region[name]=region
    chunk_data={};chunk_hashes={}
    for chunk in sorted({x["chunk"] for x in requests.values()}):
        binraw,binmeta=source_load(f"body-{chunk}.bin")
        if len(binraw)!=upstream["chunks"][chunk]["bytes"]:raise ValueError("Source chunk length mismatch")
        chunk_data[chunk]=binraw;chunk_hashes[f"body-{chunk}.bin"]=binmeta["sha256"]
    left_upper={n.replace("Right","Left").replace("right","left") for n in
      list(WRIST)+list(MUSCLES["elbow"])+list(MUSCLES["wrist"])}
    bilateral={"bones":0,"muscles":0}
    for name,info in requests.items():
        isMuscle=name in extra_muscles or name in left_lab_region
        target=muscles if isMuscle else bones
        key=id_of(name)
        if key in target or key in base:continue
        vertices,faces=source_decode(chunk_data[info["chunk"]],info)
        part={"name":name,"fma":info["conceptId"],
           "system":"muscle" if isMuscle else "bone",
           "vertices":[[round((p[i]-(.9 if i==1 else 0))*5,5) for i in range(3)] for p in vertices],
           "faces":faces}
        item=mesh_lod(part,300 if isMuscle else 390)
        item["region"]=("left-"+left_lab_region[name]) if name in left_lab_region else (
           "left-wrist" if name in left_upper else "left-ankle")
        item["group"]="upper" if item["region"] in ("left-wrist","left-shoulder") else "lower"
        target[key]=item
        bilateral["muscles" if isMuscle else "bones"]+=1
    lab_added={}
    existing_fmas={p["fma"] for p in muscles.values()}
    for region,lab in labs.items():
        srcframe=lab.get("shared_transform") or lab.get("source_frame")
        scale=srcframe["scale"]
        origin=srcframe["origin_metres"]
        added=0
        for part in lab["parts"].values():
            if part.get("system")!="muscle" or part["fma"] in existing_fmas:continue
            id=id_of(part["name"])
            if id in muscles or id in bones:raise ValueError("Conflicting anatomical identity "+id)
            # Exact inverse lab display transform, followed by the canonical
            # overview world transform. Never move individual vertices by eye.
            vertices=[[round(((v/scale)+origin[i]-(.9 if i==1 else 0))*5,5)
               for i,v in enumerate(vertex)] for vertex in part["vertices"]]
            source={"name":part["name"],"fma":part["fma"],"system":"muscle",
                "vertices":vertices,"faces":part["faces"]}
            item=mesh_lod(source,360 if region=="shoulder" else 320)
            item["region"]=region;item["group"]="upper" if region=="shoulder" else "lower"
            muscles[id]=item;existing_fmas.add(part["fma"]);added+=1
        lab_added[region]=added
    asset={"schema":"body-live/overview-v8-v1","dataset":"BodyParts3D 4.0",
      "source_commit":original["source_commit"],"source_frame":original["source_frame"],
      "license":"CC BY 4.0","bones":bones,"muscles":muscles}
    DEST.write_text(json.dumps(asset,separators=(",",":"))+"\n")
    manifest={"schema":"body-live/overview-v8-provenance-v1","source_commit":original["source_commit"],
      "license":"CC BY 4.0","anatomist_reviewed":False,"kinematics_validated":False,
      "original_bones":len(original["parts"]),"additional_bones":len(bones),
      "unique_muscles":len(muscles),"bilateral_added":bilateral,
      "bilateral_source_sha256":{"atlas.json":atlas_proof["sha256"],**chunk_hashes},
      "additional_lab_muscles":lab_added,"source_lab_sha256":lab_hashes,
      "region_counts":counts,"detail_sha256":input_hashes,
      "overview_sha256":digest(DEST.read_bytes()),"reused_region_parts":reused,
      "geometry":"exact source frame; simplification only; no mirroring or synthesized meshes",
      "incomplete":["Limited bilateral hand/foot anatomy: no finger or toe phalanges yet","Unrepresented facial/jaw muscles",
         "Missing tendons and ligaments","No anatomist-reviewed muscle attachments",
         "Reference-source sciatic nerve not spatially verified across these meshes"]}
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"additional_bones":len(bones),"unique_muscles":len(muscles),"additional_lab_muscles":lab_added,
        "triangles":sum(len(p["faces"]) for p in list(bones.values())+list(muscles.values())),
        "bytes":DEST.stat().st_size,"source":original["source_commit"]},indent=2))

if __name__=="__main__":main()
