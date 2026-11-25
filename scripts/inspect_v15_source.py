"""Offline, lossless binary STL inspection and indexed derivation. No publication."""
import argparse, hashlib, json, math, struct
from collections import Counter
from pathlib import Path
import zipfile

def inspect(data):
    if len(data)<84: raise ValueError("truncated STL")
    n=struct.unpack_from("<I",data,80)[0]
    if n<1 or n>2000000 or len(data)!=84+50*n: raise ValueError("unsupported or oversized binary STL")
    vertices=[]; faces=[]; ids={}; edges=Counter(); directed=Counter(); degenerate=0; invalid_normals=0
    for record in struct.iter_unpack("<12fH",data[84:]):
        if not all(math.isfinite(x) for x in record[:12]): raise ValueError("nonfinite STL")
        if math.hypot(*record[:3])==0: invalid_normals+=1
        face=[]
        for i in (3,6,9):
            v=tuple(record[i:i+3])
            if v not in ids: ids[v]=len(vertices); vertices.append(v)
            face.append(ids[v])
        a,b,c=[vertices[i] for i in face]
        ab=[b[i]-a[i] for i in range(3)]; ac=[c[i]-a[i] for i in range(3)]
        cross=(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])
        if math.hypot(*cross)==0: degenerate+=1
        faces.append(face)
        for a,b in zip(face,face[1:]+face[:1]):
            edges[tuple(sorted((a,b)))]+=1; directed[a,b]+=1
    stats={"vertices":len(vertices),"triangles":n,"duplicate_vertex_occurrences":3*n-len(vertices),"degenerate_triangles":degenerate,"boundary_edges":sum(v==1 for v in edges.values()),"nonmanifold_edges":sum(v>2 for v in edges.values()),"same_direction_shared_edges":sum(v==2 and (directed[a,b]==2 or directed[b,a]==2) for (a,b),v in edges.items()),"zero_source_normals":invalid_normals,"bounds":[[min(v[i] for v in vertices) for i in range(3)],[max(v[i] for v in vertices) for i in range(3)]],"source_bytes":len(data),"expanded_position_normal_bytes_estimate":n*3*24}
    return stats,vertices,faces

def sha(data): return hashlib.sha256(data).hexdigest()

def run(archive, output, members):
    output.mkdir(parents=True,exist_ok=False)
    report={"schema":"body-live-source-inspection-1","source_doi":"10.56902/COB.vh.2022.1","license":"CC-BY-4.0","archive_sha256":sha(archive.read_bytes()),"status":"inspection-only; orientation, units, laterality and identity require review","assets":[]}
    with zipfile.ZipFile(archive) as z:
        if len(set(z.namelist()))!=len(z.namelist()): raise ValueError("duplicate archive names")
        for member in sorted(set(members)):
            entry=z.getinfo(member)
            if not member.lower().endswith(".stl") or entry.file_size>100000084: raise ValueError("unsupported member")
            data=z.read(entry); stats,vertices,faces=inspect(data)
            derived=json.dumps({"vertices":vertices,"faces":faces},separators=(",",":"),allow_nan=False).encode()
            name=sha(derived)+".json"; (output/name).write_bytes(derived)
            report["assets"].append({"member":member,"source_sha256":sha(data),"derived_sha256":sha(derived),"derived_file":name,"derived_bytes":len(derived),"transform":"identity; source units unverified",**stats})
    (output/"inspection.json").write_text(json.dumps(report,indent=2)+"\n")
if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("archive",type=Path); p.add_argument("--output",type=Path); p.add_argument("--member",action="append",default=[]); a=p.parse_args()
    if not a.member:
        with zipfile.ZipFile(a.archive) as z:
            for n in sorted(z.namelist()):
                if n.lower().endswith(".stl"): print(n)
    else:
        if not a.output: p.error("--output required")
        run(a.archive,a.output,a.member)
