#!/usr/bin/env python3
"""Acquire one pinned female CT skeleton; never fuse Denver or alter native coordinates."""
import argparse, hashlib, json, math, pathlib, re, shutil, struct
from concurrent.futures import ThreadPoolExecutor
from acquire_axis import HOST, REPO, REV, ROOT, get, sha, compact_stl, glb, self_test
BASE=pathlib.Path(__file__).resolve().parents[1]
AXIS=BASE/"assets/atlas/vhf/axis/v1"
DENVER=BASE/"assets/atlas/vhf/world"
CONTRACT=BASE/"docs/UNITY_CONTRACT.json"
FOLDERS=["SKULL","SPINAL_COLUMN","THORAX"]+[f"{part}_{side}" for side in ("LEFT","RIGHT") for part in ("UPPER_EXTREMITY","LOWER_EXTREMITY","HAND","FOOT")]
def require(condition,message):
    if not condition: raise ValueError(message)
def read_pinned(path,expected):
    b=path.read_bytes();require(sha(b)==expected,"Pinned manifest mismatch: "+str(path));return json.loads(b)
def center(s):
    return [(a+b)/2 for a,b in zip(s["min"],s["max"])]
def bounds(items):
    return {"min":[min(s["min"][k] for s in items) for k in range(3)],"max":[max(s["max"][k] for s in items) for k in range(3)]}
def checked_glb(data,s):
    require(len(data)==s["bytes"] and sha(data)==s["sha256"],"GLB integrity "+s["id"])
    require(struct.unpack_from("<III",data)==(0x46546c67,2,len(data)),"GLB header "+s["id"])
    n,kind=struct.unpack_from("<II",data,12);require(kind==0x4e4f534a,"GLB JSON")
    doc=json.loads(data[20:20+n]);p,i=doc["accessors"];require(p["count"]==s["vertices"] and i["count"]==3*s["triangles"],"GLB counts")
    require(p["min"]==s["min"] and p["max"]==s["max"],"GLB bounds")
def inventory():
    result=[]
    for folder in FOLDERS:
        prefix=f"{ROOT}/{folder}/"
        listing=json.loads(get(f"{HOST}/api/datasets/{REPO}/tree/{REV}/{ROOT}/{folder}",2_000_000))
        for x in listing:
            if x.get("type")!="file" or not x["path"].endswith(".stl"):continue
            path=x["path"];require(path.startswith(prefix) and "/" not in path[len(prefix):],"Unexpected path "+path)
            name=pathlib.PurePosixPath(path).stem
            require(re.fullmatch(r"[A-Za-z0-9_]+",name) is not None,"Unexpected name "+name)
            info=x["lfs"];require(re.fullmatch(r"[0-9a-f]{64}",info["oid"]) and 84<info["size"]<=100_000_084,"LFS metadata "+name)
            result.append(dict(name=name,folder=folder,path=path,source_sha256=info["oid"],source_bytes=info["size"]))
    require(len(result)==143,"Pinned revision has "+str(len(result))+" STL labels; reconcile source changes instead of mixing revisions")
    require(len({s["name"].lower() for s in result})==143,"Ambiguous label identity")
    require(len({s["source_sha256"] for s in result})==143,"Duplicate source geometry")
    return sorted(result,key=lambda x:x["path"])
def qualify(item,existing,out):
    name,folder=item["name"],item["folder"]
    identifier="bonehub-vhf-"+name.lower();old=existing.get(identifier)
    url=f"{HOST}/datasets/{REPO}/resolve/{REV}/{item['path']}"
    if old:
        require(old["source_url"]==url and old["source_sha256"]==item["source_sha256"] and old["source_bytes"]==item["source_bytes"],"Existing source identity changed: "+name)
        data=(AXIS/old["file"]).read_bytes();checked_glb(data,old)
        (out/old["file"]).write_bytes(data)
        return dict(old,reused=True)
    source=get(url,item["source_bytes"])
    require(len(source)==item["source_bytes"] and sha(source)==item["source_sha256"],"Source integrity "+name)
    p,i,stats=compact_stl(source)
    derived=glb(identifier,p,i,stats);filename=identifier+".glb"
    rec=dict(id=identifier,source_name=name,region=folder,source_url=url,source_sha256=item["source_sha256"],source_bytes=len(source),file=filename,sha256=sha(derived),bytes=len(derived),reused=False,**stats)
    checked_glb(derived,rec);(out/filename).write_bytes(derived)
    print(name,stats["triangles"],flush=True)
    return rec
def spatial_audit(entries):
    by={s["source_name"].upper():s for s in entries}
    require(all(x in by for x in ["HIP_LEFT","HIP_RIGHT","FEMUR_LEFT","FEMUR_RIGHT","SACRUM","SKULL_CRANIAL_MAXILLA","TIBIA_LEFT","TIBIA_RIGHT","FIBULA_LEFT","FIBULA_RIGHT"]),"Missing required anchors")
    mid=(center(by["HIP_LEFT"])[0]+center(by["HIP_RIGHT"])[0])/2
    sign=1 if center(by["HIP_LEFT"])[0]>center(by["HIP_RIGHT"])[0] else -1
    checks=[]
    for s in entries:
        region=s["region"];side="LEFT" if region.endswith("_LEFT") else "RIGHT" if region.endswith("_RIGHT") else None
        if not side:continue
        # Region and filename agreement are separate from geometric laterality.
        name=s["source_name"].upper()
        if name.endswith("_LEFT") or name.endswith("_RIGHT"):
            require(name.endswith("_"+side),"Filename/folder laterality conflict: "+name)
        signed=(center(s)[0]-mid)*sign*(1 if side=="LEFT" else -1)
        checks.append({"id":s["id"],"side":side,"signedMidlineDistanceSourceUnits":signed,"pass":signed>0})
    require(all(c["pass"] for c in checks),"Geometric laterality failed; inspect pinned naming and pose; do not automatically reflect/relabel")
    for side in ("LEFT","RIGHT"):
        z=lambda name:center(by[name+"_"+side])[2]
        require(z("HIP")>z("FEMUR")>z("TIBIA") and z("FEMUR")>z("FIBULA"),"Unexpected leg order "+side)
        feet=[s for s in entries if s["region"]=="FOOT_"+side]
        require(feet and max(center(s)[2] for s in feet)<z("TIBIA"),"Unexpected foot position "+side)
    require(center(by["SKULL_CRANIAL_MAXILLA"])[2]>center(by["SACRUM"])[2],"Unexpected axial order")
    return {"checks":checks,"midlineSourceX":mid,"leftSign":sign,"limitations":"AABB centroids and ordering only; not joint-contact, physical-unit, CT-mask or landmark validation."}
def registration_metadata(axis,den,reg):
    def transform(p):return [sum(row[i]*p[i] for i in range(3))+row[3] for row in reg["matrix_source_to_denver_raw"][:3]]
    data=[]
    for side in ("LEFT","RIGHT"):
        for source,target in (("HIP","Pelvis"),("FEMUR","Femur")):
            a=next(s for s in axis["structures"] if s["source_name"]==source+"_"+side)
            b=next(s for s in den["structures"] if s["source_name"]==target and s["side"].upper()==side)
            ac=center(a);dc=[(b["bounds_raw"][k]+b["bounds_raw"][k+3])/2 for k in range(3)];tc=transform(ac)
            data.append({"source":a["id"],"target":b["id"],"sourceAabbCenter":ac,"targetAabbCenter":dc,"transformedSourceAabbCenter":tc,"residual":math.dist(tc,dc)})
    return {"existingFit":reg,"aabbCenterChecks":data,"note":"Independent manifest arithmetic, not new surface registration, and not the centroid metric in prior ICP. Prior fit was in raw Denver coordinates; remove stored translation before comparison. Physical units unconfirmed.","decision":"No Denver fusion."}
def main():
    parser=argparse.ArgumentParser();parser.add_argument("--output",type=pathlib.Path);parser.add_argument("--self-test",action="store_true");args=parser.parse_args()
    self_test()
    c=json.loads(CONTRACT.read_text());require(c["canonicalSource"]["revision"]==REV,"Source revision drift")
    axis=read_pinned(AXIS/"manifest.json",c["canonicalSource"]["sourceManifestSha256"])
    den=read_pinned(DENVER/"lower-body-manifest.json",c["secondarySource"]["manifestSha256"])
    reg=json.loads((BASE/"docs/ASCENSION_REGISTRATION.json").read_text())
    existing={s["id"]:s for s in axis["structures"]}
    require(len(existing)==61,"Expected 61 existing meshes")
    require(len({s["id"] for s in den["structures"]})==128,"Unexpected Denver inventory")
    meta=registration_metadata(axis,den,reg)
    require(meta["existingFit"]["metrics"]["sacrum_coccyx"][0]>reg["thresholds"]["median"],"Review changed historical gate")
    for s in axis["structures"]:checked_glb((AXIS/s["file"]).read_bytes(),s)
    if args.self_test:
        print("UNITY source/registration metadata verified; no fusion");return
    if args.output is None:parser.error("--output required")
    out=args.output;out.mkdir(parents=True,exist_ok=False)
    (out/"registration-metadata.json").write_text(json.dumps(meta,indent=2)+"\n")
    listing=inventory();(out/"source-inventory.json").write_text(json.dumps(listing,indent=2)+"\n")
    require(set(existing)<=set("bonehub-vhf-"+s["name"].lower() for s in listing),"Existing inventory not a subset")
    with ThreadPoolExecutor(max_workers=2) as pool:
        entries=list(pool.map(lambda s:qualify(s,existing,out),listing))
    require(sum(s["reused"] for s in entries)==61,"Existing geometry reuse mismatch")
    require(len(list(out.glob("*.glb")))==143,"Missing geometry")
    audit=spatial_audit(entries)
    manifest={"schema":"body-live-unity-source-1","source":REPO,"revision":REV,"subject":"02_Female","license":"CC BY 4.0","citation_dois":["10.57967/hf/10464","10.1038/s41597-022-01905-2"],"coordinate_space":"Unmodified shared BoneHub CT mesh source coordinates; physical units/header validation pending","registration":"Denver fusion blocked","structureCount":len(entries),"bounds":bounds(entries),"structures":entries}
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    report={"state":"source-qualification-only","labels":143,"reused":61,"new":82,"regionCounts":{f:sum(s["region"]==f for s in entries) for f in FOLDERS},"triangles":sum(s["triangles"] for s in entries),"vertices":sum(s["vertices"] for s in entries),"glbBytes":sum(s["bytes"] for s in entries),"manifestSha256":sha((out/"manifest.json").read_bytes()),"spatial":audit,"rendering":"not integrated","units":"unconfirmed","clinicalValidation":"not performed","denverFusion":False}
    (out/"qualification.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items() if k!="spatial"},indent=2))
if __name__=="__main__":main()
