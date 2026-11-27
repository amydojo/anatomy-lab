# VECTOR 005 / AFTERBURN 004.1 — CHROMATIC ENGINEERING

## Source lock
CONTINUITY 003.3 artifact 15166226284, run 45924963659, SHA-256 1f55c85022e8f6a70fbf7f7c06617c8c01005b1a5ce178796a8ab112dd7dfe55. Geometry report artifact 15166471380. Approved reference SHA-256 b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555. The optional tail change is deferred; all three treatments use exact CONTINUITY geometry, preserving all 25 meshes. No new geometry, displacement, decals as separate objects, runtime export, retopology or changes to gameplay.

## Material architecture
The hex palette is sRGB, converted to scene-linear RGB for Principled BSDF. Factory, Afterburn and Covert differ only in zoning. Primary frame upper/lower rail blocks and transverse lanes determine longitudinal panel boundaries; standing inserts, webs, collars, housing, hub and radial elements have role-based families. Each study records actual face counts per material slot and control/evaluated geometry fingerprints before and after. Afterburn is the primary candidate. Surgical silver uses anisotropy with UV tangent and subtle bump; carbon, grip and silver procedural detail is shading only. Orange, petrol and orchid use selective coat. Thermal amber emission is confined to existing radial elements.

Graphics are custom filled angular SVG outlines and raster PNG masks, composited into base color through local AfterburnUV coordinates, not floating geometry. Full MAPO DOFU on positive-side front upper ribbon, VECTOR/HAIRPIN/AFTERBURN/MD-005 on negative-side rear upper ribbon, angular velocity emblem on rear grip. Projection UVs are not certified for production unwrap, and graphic readability/placement must be checked in actual renders. No floral symbol. The packed masks are 2048x256, 1024x512 and 512x256 RGBA; nominal decoded base allocation 4.5 MiB across one edition (6 MiB with a full mip chain, excluding implementation overhead).

## Proof design
Three hero views share neutral lighting, orthographic framing and geometry. Afterburn adds rear hero, top, side, propulsion, gimbal, grip, tail, wordmark, material family ID, reduced-scale view and rest/carve/flight/capture/landing snapshots. Diagnostic ID colors are material-family colors, not final livery. Emission strength .55/.65/3.1/1.75/4.2 respectively; carve changes orchid roughness from .25 to .17. Static states apply original visual pose equations only; no timing or gameplay integration claimed. The separate cinematic lighting rig is implemented but not executed until neutral creative inspection.

## Runtime compatibility
- Scalar base-color, metallic and roughness and emissive RGB/strength have standard glTF counterparts; base color and emissive maps require sRGB decoding, metallic/roughness/AO and normal maps require linear/non-color interpretation.
- Packed artwork is composited in Blender nodes. Bake the complete base-color result into a non-overlapping production UV atlas; the current local overlapping UV projections are not ready for direct texture export.
- Object-space procedural noise, wave bump and anisotropic reflection require baking or explicitly qualified extensions. Bake tangent-space normal detail; verify tangent convention, seam handling and mip behavior. Anisotropy and coat may need approximation if the existing runtime does not implement corresponding extensions. Strength above one requires compatible emissive-strength handling or a documented approximation.
- Build packed ORM textures if appropriate; AO is not currently baked. Consolidate redundant material slots and textures at VELOCITY, preserving functional emissive regions and graphic legibility. No texture-memory or frame-pacing claims for gameplay yet.
- The existing scalar-only VECTOR GLB adapter rejects texture-bearing GLBs; do not bypass that gate. Future PARITY browser evidence must compare actual baked asset under studio/game lighting. No Blender-only proof establishes runtime parity.

## Reproduction
```sh
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/afterburn/build_afterburn.py -- --source baseline/VECTOR-005-CONTINUITY-master.blend --out afterburn-output
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/continuity/qualify_continuity.py -- --master afterburn-output/VECTOR-005-AFTERBURN-master.blend --out afterburn-geometry.json
blender -b -t 4 --python-exit-code 1 --python experiments/hairpin/vector/afterburn/render_afterburn.py -- --master afterburn-output/VECTOR-005-AFTERBURN-master.blend --edition afterburn --mode studio --subset main --out proofs
```

Actual build, fingerprint equality, unchanged mechanical gate, image evidence and user creative approval are required before this candidate is qualified. Candidate moving-interface intersections remain diagnostic; continuous clearance, exact mechanical fit and containment uncertified.
