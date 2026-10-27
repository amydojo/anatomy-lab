#!/usr/bin/env python3
"""Read Z-Anatomy GLB index without importing or redistributing mixed-license models.

Hash-pinned source includes NONCOMMERCIAL unrelated inner-ear meshes. Audit only;
selected sciatic structures may be extracted separately under original per-component
license review; do not ship a whole nervous.glb.
"""
import json,struct,hashlib,urllib.request
COMMIT="8ca3b7421bcfbe88b85859eb1983d5cf79f21749"
SHA={"nervous":"115402de4700658ea0cadb1d9749fa1d145e6397","skeletal":"73a8ace5eb2ada06d0253e192679cab9d5cd4e6f"}
def get(name):
    url=f"https://raw.githubusercontent.com/nqwrc/3d-anatomy/{COMMIT}/public/models/{name}.glb"
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"BODY-LIVE-nerve-audit"}),timeout=80) as r:raw=r.read()
    hashv=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
    if hashv!=SHA[name]:raise ValueError("SOURCE HASH MISMATCH "+name+":"+hashv)
    if raw[:4]!=b'glTF':raise ValueError('Invalid GLB')
    n=struct.unpack_from('<I',raw,12)[0]
    model=json.loads(raw[20:20+n])
    print(json.dumps({"file":name,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"sceneRoots":model["scenes"][model.get("scene",0)]["nodes"],"nodes":len(model["nodes"]),"meshes":len(model["meshes"]),"extensions":model.get("extensionsUsed",[])}))
    return model
for name in ["nervous","skeletal"]:
    model=get(name)
    nodes=model["nodes"]
    words=["sciatic","ischiad","sacral plex","tibial nerve","fibular nerve","peroneal nerve"] if name=="nervous" else ["femur.r","hip bone.r","pelvis","sacrum"]
    for i,n in enumerate(nodes):
        title=(n.get("extras",{}).get("za_name") or n.get("name") or "")
        if any(w in title.lower() for w in words):
            print(json.dumps({"file":name,"index":i,"name":title,"mesh":n.get("mesh"),"translation":n.get("translation"),"rotation":n.get("rotation"),"scale":n.get("scale"),"children":n.get("children",[])[:10],"parentNodes":[j for j,v in enumerate(nodes) if i in v.get("children",[])]}))
