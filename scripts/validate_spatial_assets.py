#!/usr/bin/env python3
"""Validate a four-bone knee subset before permitting a source-mesh import.

No downloading, transformation, anatomical recentering or clinical claims.
Accepts local .obj / binary .stl files and writes an auditable, hash-bound geometry manifest.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

RIGHT_IDS = {"femur": 24474, "tibia": 24477, "fibula": 24480, "patella": 24486}
REQUIRED = tuple(RIGHT_IDS)


def bounds(points):
    low = [float("inf")] * 3
    high = [float("-inf")] * 3
    count = 0
    for point in points:
        if not all(math.isfinite(v) for v in point):
            raise ValueError("Non-finite vertex coordinate")
        for i, v in enumerate(point):
            low[i] = min(low[i], v)
            high[i] = max(high[i], v)
        count += 1
    if count == 0:
        raise ValueError("No vertices found")
    return {"min": low, "max": high, "center": [(a+b)/2 for a,b in zip(low,high)],
            "span": [b-a for a,b in zip(low,high)], "vertex_occurrences": count}


def obj_geometry(path):
    def vertices():
        with path.open("rt", encoding="utf-8", errors="replace") as handle:
            for line in handle:
                if line.startswith("v "):
                    fields = line.split()
                    if len(fields) >= 4:
                        yield tuple(float(x) for x in fields[1:4])
    report = bounds(vertices())
    report["format"] = "OBJ"
    return report


def stl_geometry(path):
    size = path.stat().st_size
    with path.open("rb") as f:
        head = f.read(84)
        if len(head) < 84:
            raise ValueError("Invalid or incomplete binary STL header")
        triangles = struct.unpack_from("<I", head, 80)[0]
        if size != 84 + triangles * 50:
            raise ValueError("STL binary size inconsistent with triangle count")
        def vertices():
            for _ in range(triangles):
                face = f.read(50)
                if len(face) < 50:
                    raise ValueError("Truncated STL triangle")
                raw = struct.unpack_from("<9f",face,12)
                for n in range(0,9,3):
                    yield raw[n:n+3]
        report = bounds(vertices())
        report["triangles"] = triangles
        report["format"] = "STL"
        return report


def describe(name, path):
    if name not in RIGHT_IDS:
        raise ValueError("Unknown bone ID: " + name)
    if not path.is_file():
        raise FileNotFoundError(str(path))
    ext = path.suffix.lower()
    if ext not in (".obj",".stl"):
        raise ValueError("Expected OBJ or binary STL for " + name)
    stats = obj_geometry(path) if ext == ".obj" else stl_geometry(path)
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            digest.update(chunk)
    return {"structure": name, "fma_id": RIGHT_IDS[name], "filename": path.name,
            "bytes": path.stat().st_size, "sha256": digest.hexdigest(), **stats}


def report(entries, release, license_url):
    missing = sorted(set(REQUIRED)-set(entries))
    if missing:
        raise ValueError("Missing required anatomy: " + ", ".join(missing))
    measurements = {name: entries[name] for name in REQUIRED}
    femur = measurements["femur"]
    tibia = measurements["tibia"]
    # Only a heuristic flag, NOT clinical or landmark-validation.
    z_gap = tibia["max"][2] - femur["min"][2]
    warnings = [
        "Geometry identity / right-side laterality must be verified by reviewer.",
        "This check does not validate articulation surfaces, menisci or ligament attachments.",
        "Original shared coordinates must be preserved: never independently recenter bones.",
        "Assumes source coordinates are millimeters and Z-up; inspect axis orientation manually."
    ]
    if abs(z_gap) > 200:
        warnings.append("Possible knee-plane mismatch: femoral inferior and tibial superior Z differ by over 200 source units.")
    for name, s in measurements.items():
        if any(x <= 0 for x in s["span"]):
            warnings.append(name + " has a degenerate or unexpected bounding box")
    return {
        "schema": "body-live/v5-asset-alignment-v1",
        "release": release,
        "license": license_url,
        "coordinate_frame": "source whole-body millimeters, Z-up, no recentering",
        "geometry": measurements,
        "heuristic_distal_femur_to_proximal_tibia_z_delta": round(z_gap,4),
        "reviewed": False,
        "usable_as_verified_medical_geometry": False,
        "warnings": warnings
    }


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mesh",action="append",required=True,metavar="BONE=PATH")
    ap.add_argument("--release",required=True)
    ap.add_argument("--license-url",required=True)
    ap.add_argument("--out",required=True,type=Path)
    a=ap.parse_args()
    entries={}
    for arg in a.mesh:
        if "=" not in arg:
            ap.error("--mesh expects BONE=PATH")
        name,location=arg.split("=",1)
        if name in entries:
            ap.error("Duplicate mesh key "+name)
        entries[name]=describe(name,Path(location))
    result=report(entries,a.release,a.license_url)
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(str(a.out))

if __name__=="__main__":
    main()
