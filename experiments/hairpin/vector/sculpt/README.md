# VECTOR 005 / INCARNATION 002 — SCULPT

## Creative lock

Approved concept: user-supplied MAPO_DOFU_VECTOR_005_Approved_Reference.png, SHA-256 b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555. The perspective illustration is not CAD. The following landmarks are design interpretations in the existing authoring coordinate units, not measured dimensions from that illustration.

| Landmark | FIRST LIGHT | SCULPT intention |
|---|---|---|
| Forward extremity | Z +37 | Z +38, near-knife tip and longer solid wedge |
| Maximum lateral extent | rounded hull | broad chine at front Z +14, authored half-width 10.35 |
| Front standing zone | raised rounded pad | angular insert, Z +8.7 to +28, follows shoulder seams |
| Central torsion | outer radius 6.9 | outer radius 4.15; shoulders rise around it |
| Rear standing zone | raised rounded pad | angular insert, Z -30.5 to -9 |
| Tail | thin curved ribbon | swept transverse airfoil, crown Y 8.25 |
| Pod centers | +20 / -23 | +20 / -22; shrouded into lower chine |

## Method

A distinct editable Blender master; no transformation or optimization of the prior GLB. Longitudinal cages are authored at nonuniform stations; each lateral section has independent ridge, deck-seam, blade-edge and underside-chine coordinates. Selective crease weights retain crisp character lines through subdivision. Construction Bézier curves are editable inspection guides, not a live parametric surface dependency. The thin nose bridge, angular standing inserts, lower annular housings and substantial spanwise tail aerofoil are distinct meshes. Five logical assemblies are retained as collections. Interfaces and intentional overlaps are provisional, not certified mating geometry. Clay is deliberately neutral and no AFTERBURN branding or colorway is added.

## Reproducible build

```sh
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/sculpt/build_sculpt.py -- --out sculpt-output
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/sculpt/render_clay.py -- --old first-light/VECTOR-005-master.blend --new sculpt-output/VECTOR-005-SCULPT-master.blend --out clay-output
```

The master stage and proof stage are independent. The old master is recovered from workflow 45920240694 and hash-verified before render. The matched camera and neutral clay override are identical across historical and new model proofs. The old wordmark and emblem geometry are hidden for shape comparison only; source files are not saved or altered. The proofs include three-quarter, top, side, front, rear and underside. Perspective reference comparisons are approximate visual comparisons, not registered photogrammetric measurements.

No runtime GLB, retopology, texture bake or automatic integration. Static/dynamic envelope, assembly intersections, actual mechanical fit, material parity and creative review remain open. Existing FIRST LIGHT assets and 9,752-triangle derivative remain historical checkpoints. Active MARROW, GYROSCOPE, physics and anatomical rendering are outside scope.
