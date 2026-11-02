"""Inspect the pinned Z-Anatomy skeletal FBX, including raw source mesh names.

Runs under Blender in GitHub Actions. No geometry is imported into BODY/LIVE by
this diagnostic script. All externally sourced records remain under original
license; inner-ear meshes with special NC terms are marked ineligible.
"""
import bpy, os, json, hashlib, urllib.request, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"docs/v11-z-skeletal-inventory.json"
COMMIT="6c7f9016bd5899ac8edafd31b9900c151df42ed6"
URL="https://raw.githubusercontent.com/LluisV/Z-Anatomy/"+COMMIT+"/Resources/Models/FBX/SkeletalSystem100.fbx"
path=Path("/tmp/atlas-z-skeleton-100.fbx")
req=urllib.request.Request(URL,headers={"User-Agent":"BODY-LIVE-source-review/1"})
with urllib.request.urlopen(req,timeout=180) as fh: path.write_bytes(fh.read(90_000_000))
print("Downloaded",path.stat().st_size,"SHA256",hashlib.sha256(path.read_bytes()).hexdigest(),flush=True)
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(path),use_custom_normals=False,ignore_leaf_bones=True)
objects=[o for o in bpy.data.objects if o.type=="MESH"]
words=re.compile(r"coccy|sacrum|sacr|temporal|malleus|incus|stapes|ossicle|ear|auricular|sphenoid|ilium|hip|pelvis|vertebra|skull",re.I)
def world_box(o):
 from mathutils import Vector
 verts=[o.matrix_world @ Vector(corner) for corner in o.bound_box]
 return [[round(min(v[i] for v in verts),4),round(max(v[i] for v in verts),4)] for i in range(3)]
def spec(o):
 return {"name":o.name,"mesh":o.data.name,"parent":o.parent.name if o.parent else None,
 "vertices":len(o.data.vertices),"polygons":len(o.data.polygons),
 "bounds_world":world_box(o),"matrix":[[round(x,6) for x in row]for row in o.matrix_world],
 "materials":[m.name for m in o.data.materials if m][:5]}
results={"source":URL,"commit":COMMIT,"source_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
"all_objects":len(objects),"selected":[spec(o) for o in objects if words.search(o.name) or (o.parent and words.search(o.parent.name))],
"all_mesh_names":[o.name for o in objects], "groups":[{"name":c.name,"objects":len(c.objects)}for c in bpy.data.collections]}
OUT.write_text(json.dumps(results,indent=2)+"\n")
print("SUMMARY",json.dumps({"total":len(objects),"selected":len(results["selected"]),
"matches":[{"name":x["name"],"vertices":x["vertices"],"bounds":x["bounds_world"]}for x in results["selected"][:120]]})[:17000],flush=True)
