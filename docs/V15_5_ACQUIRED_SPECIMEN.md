# V15.5 — Acquired VHF specimen checkpoint

User supplied Final 3D STL Models-stl.zip. Archive SHA-256: 9886eda040f6087bbb65182530f8bd262be456f366b155025c12b3dc56da774e.

Archive contains 128 STL files, 2,306,858 binary triangles plus 28,532 ASCII triangles (two right biceps femoris files). Source README explicitly grants CC BY 4.0 and requests citations. Source: University of Denver Center for Orthopaedic Biomechanics. Dataset DOI 10.56902/COB.vh.2022.0; papers 10.1038/s41597-022-01905-2 and 10.48550/arXiv.2209.06948.

Offline source pack produced from actual archive: BODY_LIVE_VHF_Right_Knee_Source_Pack.zip, includes reproducible builder, per-structure SHA-256 and topology manifest, original README, offline render and vhf-right-knee-source.glb. GLB SHA-256 2aac40404f4aee5867d0f4feb13cf6aab5db2bc2360f0585356738113c35fb7c; 6,929,868 bytes. Exact coordinate deduplication only. One common translation [-620,-430,-500] in raw source units; source axes, relative positions and triangle winding preserved. Verify physical units and coordinate orientation before mapping into runtime.

17 structures, 172,928 indexed vertices, 345,788 triangles. All selected structures have zero detected degenerate triangles, boundary edges and edges with more than two adjacent faces under exact coordinate deduplication. GLB roundtrip retained mesh counts, triangle counts and bounds. No clinical review; no evidence of validated anatomical registration against existing atlas. Synthetic material colors, no scanned textures.

|Structure|Triangles|
|---|---:|
|Femur|89466|
|Tibia|60362|
|Fibula|19480|
|Patella|6588|
|Distal femoral cartilage|24628|
|Patellar cartilage|5666|
|Lateral tibial cartilage|5104|
|Medial tibial cartilage|6494|
|ACL|4296|
|PCL|3612|
|MCL|3110|
|LCL|2022|
|Vastus lateralis|40734|
|Vastus medialis|24358|
|Vastus intermedius|35670|
|Biceps femoris short head|11098|
|Popliteus|3100|

No separate named meniscus or tendon meshes in uploaded archive. Do not infer their presence. Full selected structures extend beyond knee region. Offline source pack available as conversation artifact; binary transfer into repository has not been performed. Runtime integration, coordinate mapping, indexed-buffer support, accelerated picking, LOD generation, browser QA and physical testing remain pending. Do not label existing preview as source specimen. Production unchanged.
