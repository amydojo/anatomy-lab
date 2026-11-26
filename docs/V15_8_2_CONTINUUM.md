# V15.8.2 CONTINUUM — experimental candidate

## Scope
One BoneHub axial world, source=axis by default. Legacy regional comparison: source=axis&axisMode=regional. Denver source=world&residency=bounded remains separate. No clinical validation. The source inventory retains L6 and excludes the two registration femurs.

## Implementation
Manifest-wide fixed display bounds and four semantic landmarks; integrity-checked two-request batches; priority adapts to camera location between batches; individual failures retry once, remain reported, and can be retried via R3. Camera, selection and isolation survive landmark travel. D-pad travel eases only target over 650 ms; analog movement interrupts travel. Touch/pinch/wheel/tap operate on the same axial camera; double tap explicitly fits. Existing bounded source GPU upload queue and eviction hysteresis are reused. Renderer diagnostics expose actual drawn structure IDs. No source data or transforms changed.

## Geometry inventory (manifest-derived, not browser measurements)
59 structures, 3,915,232 triangles, 1,957,550 indexed vertices, 70,516,044 bytes GLB payload. Approximate compact CPU geometry arrays 58,275,192 bytes; estimated packed GPU buffers at full residency 89,595,992 bytes (excluding drivers, shader, CPU temporaries and other scenes). Existing 32 MiB GPU target is soft: all visible full-resolution geometry may exceed it. No simplified derivatives are shipped; this is a progressive exact-source candidate, not a hierarchical LOD release. CPU arrays are retained. Visibility counts are draw submission evidence, not pixel evidence.

## Registration
ASCENSION_REGISTRATION.json remains unchanged. Held-out sacrococcygeal median 3.3399 and centroid discrepancy 10.563021 fail provisional criteria 3 and 5 source units. Physical units unconfirmed. The source manifest path identifies Female CT geometry; identity correspondence to Denver and segmentation extent have not been independently established. Separate spaces are retained. Do not re-fit to sacrum without independent validation.

## Acceptance
Browser workflow includes regional regression, full inventory and actual rib/skull draw ID assertions, camera continuity and failure recovery. Browser results and screenshots must be inspected before acceptance. Physical iPhone/controller/AirPlay tests, LOD derivation and topology/surface-error assessment, cross-dataset validation and measured sustained frame pacing remain outstanding. No production promotion.
