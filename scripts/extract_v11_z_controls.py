"""Export only real Z-Anatomy skeletal meshes needed for BODY/LIVE registration.
Run with Blender Python, not CPython. The provenance remains CC BY-SA 4.0.
"""
import bpy, json, hashlib, urllib.request
from pathlib import Path
from mathutils import Vector
COMMIT="6c7f9016bd5899ac8edafd31b9900c151df42ed6"
URL="https://raw.githubusercontent.com/LluisV/Z-Anatomy/"+COMMIT+"/Resources/Models/FBX/SkeletalSystem100.fbx"
SHA256="294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea"
target=Path("/tmp/v11-z-registration-source.json")
path=Path("/tmp/v11-skeletal-control.fbx")
with urllib.request.urlopen(urllib.request.Request(URL,headers={"User-Agent":"BODY-LIVE-registration/1"}),timeout=180) as h:path.write_bytes(h.read(90_000_000))
if hashlib.sha256(path.read_bytes()).hexdigest()!=SHA256:raise RuntimeError("Source FBX SHA mismatch")
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(path),use_custom_normals=False,ignore_leaf_bones=True)
wanted=["Sacrum","Coccyx","Temporal bone.l","Temporal bone.r","Hip bone.l","Hip bone.r","Frontal bone","Vertebra L5","Malleus.l","Malleus.r","Incus.l","Incus.r","Stapes.l","Stapes.r"]
objects={}
for name in wanted:
 obj=bpy.data.objects.get(name)
 if obj is None or obj.type!="MESH":raise RuntimeError("Source control or bone mesh missing: "+name)
 if len(obj.data.vertices)<30 or len(obj.data.polygons)<30:raise RuntimeError("Source has insufficient geometry: "+name)
 verts=[list(map(lambda v:round(v,7),obj.matrix_world @ p.co)) for p in obj.data.vertices]
 triangles=[]
 for poly in obj.data.polygons:
  vs=list(poly.vertices)
  for j in range(1,len(vs)-1):triangles.append([vs[0],vs[j],vs[j+1]])
 if len(triangles)<30:raise RuntimeError("Unusable mesh "+name)
 objects[name]={"name":name,"vertices":verts,"faces":triangles,"source_materials":[m.name for m in obj.data.materials if m],"source_parent":obj.parent.name if obj.parent else None}
data={"schema":"body-live/v11-z-extracted-controls-v1","source":URL,"sha256":SHA256,
"license":"CC BY-SA 4.0; BodyParts3D attribution CC BY-SA 2.1 Japan", "objects":objects}
target.write_text(json.dumps(data,separators=(",",":"))+"\n")
print("EXTRACT",json.dumps({"meshes":len(objects),"bytes":target.stat().st_size,"objects":{k:[len(p["vertices"]),len(p["faces"])] for k,p in objects.items()}}),flush=True)
