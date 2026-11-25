import pathlib,json,hashlib,struct
root=pathlib.Path("assets/atlas/vhf/axis/v1")
m=(root/"manifest.json").read_bytes()
assert hashlib.sha256(m).hexdigest()=="2fdd5646e81e66ab16458091fdc9d8a45ffbbc1465f5f2bb0056f07cedc953d7"
d=json.loads(m);assert len(d["structures"])==61 and d["revision"]=="53bd62452ae3fc34ba0fa6188517cd8ca9bf4a10" and d["license"]=="CC BY 4.0"
for s in d["structures"]:
    p=root/s["file"];assert p.parent==root
    b=p.read_bytes();assert len(b)==s["bytes"] and hashlib.sha256(b).hexdigest()==s["sha256"]
    assert struct.unpack_from("<III",b)==(0x46546c67,2,len(b))
assert len(list(root.glob("*.glb")))==61
print("61 pinned geometry assets verified")
