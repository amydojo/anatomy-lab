# VECTOR 005 / INCARNATION 003 — EXOSKELETON

## Reference lock

Approved user image SHA-256 b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555. The hero view shows a tapered spear opening into sweeping body surfaces, a partly exposed central mechanism, a suspended aft structure and recessed amber propulsion. This clay candidate interprets these volumes in normalized authoring units, not measured CAD.

## New structural architecture

- Front and rear primary spars are broad, independently curved surface patches; lower spars follow separate load paths with open channels.
- The blade nose connects the front spars only; a longitudinal through-opening follows the tip.
- Front and rear standing inserts use discrete transverse support webs, rather than continuous enclosed hulls.
- Separate bearing forks approach a compact fixed torsion assembly. No rigid front-to-rear crossmember.
- The rear airfoil is a suspended, spanwise patch rising above the aft insert.
- Annular propulsion housings, radial segments and local mount webs remain visible.

The cubic Bezier rails are actual geometry-generation inputs. Their exact handles and control positions are stored in the Blender file. They are not live parametric drivers: changing a guide in Blender does not automatically rebuild its patch. The sampled mesh, solidify and bevel modifiers remain editable. Geometry is a creative master, not a structural engineering design.

## Reproduce

```sh
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/exoskeleton/build_exoskeleton.py -- --out exo-output
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/exoskeleton/qualify_exoskeleton.py -- --master exo-output/VECTOR-005-EXOSKELETON-master.blend --out geometry-report.json
```

Use render_exoskeleton.py with --first, --sculpt, --exo, --edition and --out. Historical master hashes are pinned. All three masters supply evaluated vertices to a common orthographic framing computation. Full views use 18% padding and are checked with Blender's actual camera projection. Top/underside orient the longitudinal axis horizontally. Closeups intentionally crop and use matched centers/scales. Neutral clay override and illumination are shared. No source master is saved by the proof script.

## Qualification limits

The geometry script compares actual evaluated triangle surfaces with BVHs in rest and 11 additional sampled combinations of twist, deployment and compression. Uses existing vehicle transform equations in authoring units, including pod offset/gimbal. It records every intersecting pair, separates explicitly named candidate mating interfaces from unclassified hits, checks existing dimensional and contact-plane limits and measures axial front/rear gap. It also casts vertical rays through selected structural regions. These tests do not prove mechanical attachment, full solid containment, exact joint fit, continuous swept clearance or load capacity. Any unclassified intersection fails the gate. Visual seam assessment requires actual clay renders.

FIRST LIGHT and SCULPT remain immutable. No GLB, runtime optimization, AFTERBURN materials, active gameplay or production changes. No creative approval based on metrics.

## VERTICAL SCULPTURE addendum — front-first creative gate

The complete EXOSKELETON candidate was built before the addendum arrived. Freeze the recovered master (artifact 15165190755, workflow 45922028710, SHA-256 f68448915a32bbdf00bb9eaded3545b31f44afd4f6d321f85b823f0248ab37c0). No additional full-vehicle reconstruction, materials or runtime work until front-only clay review. The independent VERTICAL workflow renders the existing front, front-pod and torsion assemblies alone, with the rear hidden only in the proof scene. 1600 × 1100, 48 Cycles samples, matched neutral clay, three-quarter / low-angle / side. No substitute geometry. Review whether the upper and lower ribbon architecture produces genuinely broad sculptural planes, visible longitudinal openings and readable suspended support. In the authored sections, some cross-web ends may terminate below or short of the upper-spar mating surface; actual attachment and visible pinching or seams require mesh-distance and render review. Intersection-free components are not necessarily connected. The original geometry job was blocked at apt update by HTTP 403 from an unrelated Microsoft repository, not a geometry result; VERTICAL retries against signed Ubuntu package sources and the exact recovered master.
