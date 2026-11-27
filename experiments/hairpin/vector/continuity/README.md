# VECTOR 005 / TENSION 003.3 — CONTINUITY

Source lock: PRECISION workflow 45923602408, master artifact 15165915241, SHA256 f2875d9b4cac18195d426a7f3939e891187e4d69ea1a701d1ee899fe335c4d1a. Mechanical artifact 15164904312 confirms 8/8 fixed contacts, 0 unclassified front-related pairs, gap 2.5146628618240356, dimensional/contact-plane pass, 12 poses. All 11 recovered clay/zebra images verified against reports and source digest. Reference SHA256 b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555.

New master opens the exact source and replaces only the rear structural collection. Protected front, joint, front and rear pod meshes are fingerprinted at control and evaluated topology/position levels (including transforms and scalar modifier settings) before/after. The rear has a separate longitudinal station set, wider diffuser and an integral elevated transverse tail sharing upper ribbon vertices. No full enclosed hull. Two web supports, angular insert, saddle pair and rear-facing bearing sectors are provisional mechanical interfaces. Original construction guides are retained as history. New rail curves are build-time inputs, not live drivers.

The extended gate preserves the 12 established poses and front requirements, adds eight rear fixed contacts at the same 0.08 authoring-unit proximity threshold, checks all pairwise evaluated surface intersections, topology and whole-vehicle dimensions. Candidate rear mating interfaces are declared explicitly; cross-deck hits never count as mating. Protected hardware-only intersections, not covered by previous front-only testing, are reported as unclassified rather than silently excused. A zero-unclassified result would still not prove continuous collision clearance, containment, structural strength or true moving-bearing fit.

Render jobs use a common neutral override, evaluated combined bounds from the three actual masters, explicit padding, and exact existing visual pose equations. 1600x1100 Cycles, 32 samples, no denoising. Closeups intentionally crop. Historical PRECISION shown front-only; EXOSKELETON shown complete. The five static articulation poses are visual transform snapshots, not recorded gameplay. Reference comparison board requires recovered actual render output and manual visual review.

Reproduce:
```sh
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/continuity/build_continuity.py -- --source precision/VECTOR-005-PRECISION-front.blend --out continuity
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/continuity/qualify_continuity.py -- --master continuity/VECTOR-005-CONTINUITY-master.blend --out continuity-geometry.json
```

No livery, runtime export/decimation, active MARROW, GYROSCOPE, physics, anatomy or production changes. Creative approval required before AFTERBURN.
