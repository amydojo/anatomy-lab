#!/usr/bin/env python3
"""Build an auditable right-knee subset from pinned BodyParts3D 4.0-derived geometry.

Upstream: ashemag/human-atlas (pin below), packed from the official BodyParts3D 4.0
isa_BP3D_4.0_obj_99.zip. Source coordinates are METRES, Y-up, originally transformed
together from millimetres/Z-up; never individually centre or scale bones.

Generated geometry is actual sourced 4.0 bone topology, not diagnostic validation.
All non-bone tissue remains explicitly schematic in KNEE / SPATIAL.
"""
from __future__ import annotations
import hashlib
import json
import math
import struct
import urllib.request
from pathlib import Path

UPSTREAM = "https://raw.githubusercontent.com/ashemag/human-atlas"
PIN = "1c38bf35c254a891200d3cedecfd57abebe83d8d"
ATLAS_PATH = "public/models/atlas.json"
CHUNK_PATH = "public/models/body-13.bin"
ATLAS_GIT_SHA = "0f81b5621479a0c0548f4683c316f33bd4d6545b"
CHUNK_GIT_SHA = "24a9953b6677cf07cd6beea9f221a0690c6efa44"
SOURCE_LICENSE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
IDS = {"femur":"FMA24474","tibia":"FMA24477","fibula":"FMA24480","patella":"FMA24486"}
OUTPUT = Path(__file__).resolve().parents[1] / "knee/spatial/assets/bp3d-right-knee-4.0.json"
MANIFEST_OUTPUT = Path(__file__).resolve().parents[1] / "knee/spatial/assets/provenance.json"


def git_blob_sha(content: bytes) -> str:
    header = b"blob " + str(len(content)).encode() + b"\0"
    return hashlib.sha1(header + content).hexdigest()


def download_verified(path: str, expected_git_sha: str) -> tuple[bytes, dict]:
    url = f"{UPSTREAM}/{PIN}/{path}"
    request = urllib.request.Request(url, headers={"User-Agent":"BODY-LIVE-v5-reproducible-import/1.0"})
    with urllib.request.urlopen(request, timeout=75) as response:
        content = response.read()
    actual = git_blob_sha(content)
    if actual != expected_git_sha:
        raise ValueError(f"Upstream binary was changed: {path}, got {actual}")
    return content, {"upstream_url":url,"git_blob_sha1":actual,
                     "sha256":hashlib.sha256(content).hexdigest(),"bytes":len(content)}


def get_part(manifest: dict, fma: str, name: str) -> dict:
    selected = [p for p in manifest["parts"] if p["conceptId"] == fma
                and p["name"].lower() == "right " + name]
    if len(selected) != 1:
        raise ValueError(f"Expected one exact right {name} mesh, got {len(selected)}")
    part = selected[0]
    if part["chunk"] != 13:
        raise ValueError(f"Unexpected source chunk for {name}: {part['chunk']}")
    return part


def extract(raw: bytes, info: dict) -> tuple[list[tuple[float,float,float]], list[list[int]]]:
    n = int(info["vertexCount"])
    f = int(info["indexCount"])
    voff = int(info["positions"])
    ioff = int(info["indices"])
    if not (0 <= voff <= voff+12*n <= len(raw)):
        raise ValueError("Out-of-bounds vertex buffer")
    if not (0 <= ioff <= ioff+4*f <= len(raw)):
        raise ValueError("Out-of-bounds triangle buffer")
    if f % 3:
        raise ValueError("Non-triangular element count")
    pos = [tuple(v) for v in struct.iter_unpack("<fff", raw[voff:voff+12*n])]
    idx = struct.unpack_from("<" + str(f) + "I",raw,ioff)
    if len(pos) != n or max(idx, default=0) >= n:
        raise ValueError("Invalid source mesh topology")
    if not all(math.isfinite(c) for p in pos for c in p):
        raise ValueError("Non-finite source vertex")
    faces = [list(idx[i:i+3]) for i in range(0,len(idx),3)]
    return pos,faces


def bounding_box(pos):
    return {"min":[round(min(p[a] for p in pos),7) for a in range(3)],
            "max":[round(max(p[a] for p in pos),7) for a in range(3)]}


def build():
    atlas_bytes,atlas_proof = download_verified(ATLAS_PATH,ATLAS_GIT_SHA)
    chunk,chunk_proof = download_verified(CHUNK_PATH,CHUNK_GIT_SHA)
    manifest = json.loads(atlas_bytes)
    if manifest.get("version") != "BodyParts3D 4.0":
        raise ValueError("Unexpected anatomy release")
    if len(chunk) != manifest["chunks"][13]["bytes"]:
        raise ValueError("Unexpected packed chunk size")

    extracted={}
    details={}
    for name,fma in IDS.items():
        info = get_part(manifest,fma,name)
        vertices,faces = extract(chunk,info)
        extracted[name] = (vertices,faces)
        details[name] = {
           "id":info["id"],"fma":fma,"original_name":info["name"],
           "source_vertex_count":info["vertexCount"],
           "source_triangle_count":len(faces),
           "source_bounds_metres":bounding_box(vertices),
           "source_offsets_bytes":{"vertices":info["positions"],"indices":info["indices"]}}
    femur=details["femur"]["source_bounds_metres"]
    tibia=details["tibia"]["source_bounds_metres"]
    patella=details["patella"]["source_bounds_metres"]
    fibula=details["fibula"]["source_bounds_metres"]

    # Automated sanity checks on static reference-pose geometry; not clinical verification.
    if not (abs(tibia["max"][1]-femur["min"][1]) < .05):
        raise ValueError("Femur/tibia appear misaligned in source Y")
    if not (femur["min"][0] <= patella["max"][0] and femur["max"][0] >= patella["min"][0]):
        raise ValueError("Patella/femur source X axes unexpectedly separated")
    if not (tibia["min"][0] <= fibula["max"][0] and tibia["max"][0] >= fibula["min"][0]):
        raise ValueError("Fibula/tibia source X axes unexpectedly separated")

    # One transform for ALL FOUR. This is a display transform, not bone-by-bone adjustment.
    origin = [
      round((femur["min"][0]+femur["max"][0])/2, 8),
      round((femur["min"][1]+tibia["max"][1])/2, 8),
      round((tibia["min"][2]+tibia["max"][2])/2, 8)
    ]
    scale = 7.5
    output = {"schema":"body-live/sourced-knee-geometry-v1",
              "source":"BodyParts3D 4.0 / Database Center for Life Science",
              "license":"CC BY 4.0","source_release":"4.0 99%-reduced IS-A tree",
              "upstream_commit":PIN,
              "aligned_shared_transform":{"origin_metres":origin,"scale_to_scene":scale,
                "source_axes":"metres, Y-up, transformed uniformly from the BodyParts3D coordinate system"},
              "bone_meshes":{}}
    for name,(pos,faces) in extracted.items():
        # Keep the topology. Round only after applying a single shared transform.
        positions = [[round((p[i]-origin[i])*scale,5) for i in range(3)] for p in pos]
        output["bone_meshes"][name]={"fma":IDS[name],"vertices":positions,"faces":faces}
    proof={"schema":"body-live/bp3d-import-provenance-v1",
           "upstream_project":"https://github.com/ashemag/human-atlas",
           "source_dataset":"Official BodyParts3D 4.0 IS-A Tree, 99%-polygon-reduced",
           "source_archive":"isa_BP3D_4.0_obj_99.zip",
           "original_creator":"Database Center for Life Science (DBCLS)",
           "required_attribution":"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
           "license_url":SOURCE_LICENSE,"upstream_commit":PIN,"atlas":atlas_proof,"packed_chunk":chunk_proof,
           "meshes":details,"coordinate_frame":"Original four elements share reference pose; uniformly transformed for display; never independently aligned",
           "transforms":output["aligned_shared_transform"],
           "anatomist_reviewed":False,"kinematically_validated":False,
           "soft_tissue_status":"Hand-authored illustrative geometry; not part of BodyParts3D bone import",
           "warnings":[
             "BodyParts3D dataset authors warn of possible structure assignment errors.",
             "The static reference alignment does not validate joint movement.",
             "Patella tracking and ligament attachment points remain schematic.",
             "Do not infer forces, nerve effects, diagnosis, or surgical accuracy."
           ]}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(output,separators=(",",":"))+"\n",encoding="utf-8")
    MANIFEST_OUTPUT.write_text(json.dumps(proof,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"exported","bones":list(output["bone_meshes"]),
                      "mesh_bytes":OUTPUT.stat().st_size,"provenance_bytes":MANIFEST_OUTPUT.stat().st_size,
                      "triangles":sum(len(v["faces"]) for v in output["bone_meshes"].values()),
                      "source_github_sha":PIN},indent=2))

if __name__ == "__main__":
    build()
