# KINESIS 007.3 — independent C1 configuration-space evidence

Foundation: 00d205a, SLIPSTREAM workflow 46073543260, laboratory 15234067213, desktop 15233553030, mobile 15234626133. All three jobs passed execution; neither contact variant authorized for live riding. Protected VECTOR SHA-256 e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66; C1 SHA-256 c32c9bf10e85df16552a475139acd721e027be0d365fbdf8f500f08033949ec7.

Independent Python/Numba experiment used 31,712 actual C1 triangles and all 19,986 actual VECTOR triangles. Local binary trees partition the indexed vehicle triangle set; each OBB contains its assigned triangles by convexity. Five trees, depth five, 315 nodes. SAT versus actual anatomical BVH, conditional outside parity. Source topology closed edge incidence, not self-intersection certified. Independent reference: transverse crossings and unanimous three-ray inside vertices (10,113 unique assembly vertices), not exact solid overlap truth. Local prototype did not test reverse containment; repository JS oracle adds source component representative reverse containment under a conditional valid-solid assumption, and rejects open/ambiguous topology.

72 configurations: 6 original straight routes × 4 previous modes × samples 12/144/240. Reference observed-clear 52, observed-colliding/ambiguous 20.
- Assembly boxes: 49 accepted observed-clear, 3 false rejections, 0 observed collision accepted.
- Depth two: 49 accepted observed-clear, 3 false rejections, 0 observed collision accepted.
- Depth five: 52 accepted observed-clear, 0 false rejections, 0 observed collision accepted.
- Depth-five isolated local compiled query median .1076055ms, p95 .342771ms. Excludes compilation; not browser/device performance and not proof of safe behavior everywhere.

Adverse Continuous poses, steps 132, 144, 156: 45 correction candidates each (lift 0/.002/.004/.006/.008; pitch or roll 0/±.12/±.24 rad). None of 135 clear under conservative envelope. At zero correction: 271/847/391 transverse pairs; 3120/3184/2740 inside vertices. At .008 normal shift alone: 379/401/446 pairs; 2559/355/1426 inside vertices. Step 132 exact reference run for all 45; steps 144/156 reference for unchanged and .008 lift, plus any envelope-clear candidate (none). No exhaustive search proof; no excessive-lift rescue.

Motion envelope: midpoint orientation via shortest rotation per assembly, linear translation; inflate all box axes by half translation + 2R sin(relative angle/4), recursively subdivide. Actual independent articulation interpolation is not mechanically certified and recorded 10Hz frames omit actual intermediate motion. 2/18 tested intervals clear (low-speed diagonal and perpendicular Continuous 12→24). Adaptive parallel 12→24 both endpoints observed-clear, envelope unresolved at all eight terminal subdivisions. Rejections are not proof of collision.

Ten viable C1 seed regions × 3 headings: 18/30 reconstructed rest poses conditionally clear. Offline bounded prefix filter on existing Continuous trajectory: max .004 normal shift, ±.12 rad pitch/roll, .002 shift and .12 rad parameter-change per .1s. Initial corrected placement independently tested, not a motion out of overlap. Stop at first failed transition, no time-index skipping or autopilot. Local prototype is conditional envelope only (no added magnetic support gate or reverse containment).
- .35 parallel: 1/20 admitted, stop step 24.
- .35 diagonal: 20/20.
- .35 perpendicular: 20/20.
- 1 parallel: 0/20, stop step 12.
- 1 diagonal: 4/20, stop step 60.
- 1 perpendicular: 3/20, stop step 48.
- .65 carving: 13/30, stop step 168.
- .35 flight schedule: 1/60, stop step 24 before flight.
No actual KINESIS locomotion trajectory or flight authorization. New repository prefix requires actual magnetic proximity and pod support plus reverse containment, so results may differ.

Repository implementation: kinesis-oracle.mjs (offline OBB/SAT, conditional parity and reverse containment, motion envelopes), kinesis-path.mjs (support-gated prefix, no time skipping), kinesis-lab-runner.mjs (five specimens, second spatially independent seed when available, selected 30Hz primary schedules), kinesis.test.mjs (four independently executed fixtures passed), kinesis.spec.mjs (actual side/chase review and frozen live state). Explicit query flow=kinesis only opens research review; it never alters live solver. KINESIS mode only shows admitted frames and stops visibly; unavailable if no admitted start. Historical modes remain available.

Remaining: five-source JS workflow and actual new browser evidence; full solid topology/self-intersection and actual fixed-step continuous mechanical sweep; feasible continuous contact integration with bounded cost and rider agency; physical controller acceptance. No live authorization, no source changes, no vehicle redesign, no production promotion.
