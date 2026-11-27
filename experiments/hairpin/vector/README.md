# VECTOR 005 / INCARNATION — AFTERBURN

## Reference lock

Approved user image: MAPO_DOFU_VECTOR_005_Approved_Reference.png (1199 × 1312), SHA-256 b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555. Use the hero vehicle as authority. The user can load that exact image in ATELIER's local reference panel; no poster artwork, characters, or environmental graphics are included in the mesh. The image is not committed to the repo.

Interpretation: front nose points +Z; two longitudinally distinct standing zones; arch around a transverse central gimbal; swept rear spoiler/sail; asymmetrical orange and orchid accents; two downward-facing segmented propulsion rings. Hero image is a perspective concept, not measured CAD; exact hidden construction, thickness, surface contact and graphic positioning are not specified. The candidate is deliberately not described as a faithful recreation until actual renders are compared.

## Reproducible modeling

Blender 4.x required. Run from repository root:
```sh
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/build_vector.py -- --out vector-output
```

The editable master uses Blender mesh control cages, subdivision modifiers, bevels and separate curved spars and radial assemblies. Runtime derivative applies modifiers and decimates per component. This is a first volumetric blockout/finish exploration, not hand-sculpted final CAD. Both files are exported by Blender; no primitive JS fallback.

Output: VECTOR-005-master.blend, VECTOR-005-preview.glb, mapo-dofu-wordmark.svg, build-report.json and actual Blender PNG proof views. SVG import is provisional and may require Blender's SVG importer; the editable SVG is exported regardless. The master is saved before cameras/lights are added; the build script is the reproducible render rig. UVs are provisional planar coordinates, not a final unwrap. No actual normal/AO/roughness texture bake is claimed. The asset uses scalar metallic/roughness, base colors, normals and emissive factors. The adapter rejects texture-bearing GLBs instead of discarding image maps.

## ATELIER inspection

Run the existing repository web server. Place generated GLB in experiments/hairpin/vector/generated/VECTOR-005-preview.glb or import the local GLB at /experiments/hairpin/?edition=vector. Use the reference picker to display the approved image next to the mesh. Existing material evaluator supports both illumination modes, orbit, zoom, silhouette/clay and kinetic state. Imported normals are preserved. The scalar emissive factor is mapped to the existing PARITY scalar emission approximation; this is not complete glTF PBR fidelity. Front/rear/center/pod names preserve existing transforms, with common board-center origins as required by the current articulation implementation.

## Qualification

The dedicated workflow installs Blender, builds and renders the actual asset, uploads the master/GLB evidence and passes the export to the existing desktop/mobile browser environment. The GLB adapter fixture independently tests coordinate transform, material, normal, UV and invalid file behavior. Asset-specific tests require the real output in that workflow; other runs explicitly skip only the unavailable asset-specific tests. Static and animated envelope limits remain unchanged; the 3,500-triangle gameplay target is a separate gate, not a master constraint. Full component intersection tests, textured GLB adapter, bake, real device performance and creative fidelity are unresolved. No new physics, active gameplay or production changes.
