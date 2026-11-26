#!/usr/bin/env python3
"""Acquire pinned public BoneHub STLs; exact indexed derivatives, never clinical registration."""
import argparse, array, hashlib, json, math, pathlib, struct, sys, urllib.request
REPO="BoneHub/visible-human-3d-models"
REV="53bd62452ae3fc34ba0fa6188517cd8ca9bf4a10"
ROOT="visible_human_3d_models/CT/Mesh/02_Female"
HOST="https://huggingface.co"
def get(url, limit):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"BODY-LIVE-axis-qualification/1"}),timeout=90) as response:
        b=response.read(limit+1)
    if len(b)>limit: raise ValueError("download limit exceeded")
    return b
def sha(b): return hashlib.sha256(b).hexdigest()
def inventory():
    result={"SPINAL_COLUMN":["SACRUM"]+[f"VERTEBRA_{r}{i}" for r,n in (("C",7),("T",12),("L",6)) for i in range(1,n+1)],
            "THORAX":["STERNUM"]+[f"RIB_{i}_{s}" for s in ("LEFT","RIGHT") for i in range(1,13)],
            "SKULL":["SKULL_CRANIAL_MAXILLA","SKULL_MANDIBLE"]}
    for side in ("LEFT","RIGHT"):
        result["UPPER_EXTREMITY_"+side]=["CLAVICLE_"+side,"SCAPULA_"+side]
        result["LOWER_EXTREMITY_"+side]=["HIP_"+side,"FEMUR_"+side]
    return result
def compact_stl(data):
    if len(data)<84: raise ValueError("truncated STL")
    n=struct.unpack_from("<I",data,80)[0]
    if not 0<n<=2_000_000 or len(data)!=84+50*n: raise ValueError("unsupported binary STL")
    pos=array.array("f"); idx=array.array("I"); seen={}
    lo=[math.inf]*3; hi=[-math.inf]*3; degenerate=0
    for _,_,_,*p in struct.iter_unpack("<12fH",data[84:]):
        tri=[]
        for j in (0,3,6):
            v=tuple(p[j:j+3])
            if not all(math.isfinite(x) for x in v): raise ValueError("nonfinite vertex")
            k=seen.get(v)
            if k is None:
                k=len(pos)//3;seen[v]=k;pos.extend(v)
                for a in range(3): lo[a]=min(lo[a],v[a]);hi[a]=max(hi[a],v[a])
            tri.append(k)
        if len(set(tri))<3: degenerate+=1
        idx.extend(tri)
    if sys.byteorder!="little": pos.byteswap();idx.byteswap()
    return pos.tobytes(),idx.tobytes(),{"vertices":len(pos)//3,"triangles":n,"min":lo,"max":hi,"repeated_index_triangles":degenerate}
def glb(name,p,i,stats):
    doc={"asset":{"version":"2.0","generator":"BODY LIVE AXIS exact dedup 1"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"name":name,"primitives":[{"attributes":{"POSITION":0},"indices":1,"mode":4}]}],"buffers":[{"byteLength":len(p)+len(i)}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":len(p),"target":34962},{"buffer":0,"byteOffset":len(p),"byteLength":len(i),"target":34963}],"accessors":[{"bufferView":0,"componentType":5126,"count":stats["vertices"],"type":"VEC3","min":stats["min"],"max":stats["max"]},{"bufferView":1,"componentType":5125,"count":stats["triangles"]*3,"type":"SCALAR"}]}
    j=json.dumps(doc,separators=(",",":"),sort_keys=True).encode();j+=b" "*((-len(j))%4);b=p+i
    return struct.pack("<III",0x46546c67,2,28+len(j)+len(b))+struct.pack("<II",len(j),0x4e4f534a)+j+struct.pack("<II",len(b),0x004e4942)+b
def self_test():
    data=bytes(80)+struct.pack("<I",1)+struct.pack("<12fH",0,0,1,0,0,0,1,0,0,0,1,0,0)
    p,i,s=compact_stl(data);assert s["vertices"]==3 and s["triangles"]==1
    g=glb("fixture",p,i,s);assert struct.unpack_from("<III",g)==(0x46546c67,2,len(g))
    try: compact_stl(data[:-1])
    except ValueError: pass
    else: raise AssertionError("truncation accepted")
def main():
    parser=argparse.ArgumentParser();parser.add_argument("--output",type=pathlib.Path);parser.add_argument("--self-test",action="store_true");args=parser.parse_args()
    self_test()
    if args.self_test:return
    if not args.output:parser.error("--output required")
    out=args.output;out.mkdir(parents=True,exist_ok=False);entries=[]
    for folder,names in inventory().items():
        directory=f"{ROOT}/{folder}"
        listing=json.loads(get(f"{HOST}/api/datasets/{REPO}/tree/{REV}/{directory}",2_000_000))
        files={pathlib.PurePosixPath(x["path"]).stem:x for x in listing if x.get("type")=="file" and x["path"].endswith(".stl")}
        for name in names:
            item=files[name];expected=item["lfs"]["oid"];size=item["lfs"]["size"]
            if len(expected)!=64 or not 84<size<=100_000_084:raise ValueError("invalid LFS metadata")
            url=f"{HOST}/datasets/{REPO}/resolve/{REV}/{directory}/{name}.stl"
            data=get(url,size)
            if len(data)!=size or sha(data)!=expected:raise ValueError("source integrity: "+name)
            p,i,stats=compact_stl(data);identifier="bonehub-vhf-"+name.lower()
            derived=glb(identifier,p,i,stats);filename=identifier+".glb";(out/filename).write_bytes(derived)
            entries.append(dict(id=identifier,source_name=name,region=folder,source_url=url,source_sha256=expected,source_bytes=size,file=filename,sha256=sha(derived),bytes=len(derived),**stats))
            print(name,stats["triangles"],flush=True)
    manifest={"schema":"body-live-axis-source-1","source":REPO,"revision":REV,"license":"CC BY 4.0","citation_dois":["10.57967/hf/10464","10.1038/s41597-022-01905-2"],"coordinate_space":"BoneHub source STL coordinates, unchanged; axes and units unverified; not registered to Denver meshes","registration":"unverified","structures":entries}
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
if __name__=="__main__":main()
