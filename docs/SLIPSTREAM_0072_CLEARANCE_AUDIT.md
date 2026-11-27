# SLIPSTREAM 007.2 — independent adverse interval audit

Baseline 1c8387b, candidate contact chart f32dd61, laboratory c56823c, rejection classification 5c41104. C1 SHA-256 c32c9bf10e85df16552a475139acd721e027be0d365fbdf8f500f08033949ec7. Protected VECTOR SHA-256 e64ef983520090af7b07b2e3f67e6fc365a615b17d5ba457faf2039f3920fb66.

Actual C1 31,712 source triangles and full VECTOR 19,986 triangles. The five assembly meshes have 10,113 unique vertices after exact coordinate welding. C1 and all five assemblies have closed consistently oriented edge incidence, no boundary or nonmanifold edges and no collapsed indexed faces. This is not self-intersection certification.

Exact input schedule: parallel approach, push .35, 240 steps. The independently generated continuous candidate used exact extremal footprint witnesses; full transformed vehicle geometry was used for the following separate offline audit. Candidate matrices transferred rounded to 11 decimal places, using all five assembly transforms. Baseline poses recovered from completed artifact 15225869755. Same step and input schedule, not same spatial trajectory.

| Mode | Step | Transverse pairs | Unanimous inside vertices | Deepest inside vertex distance |
|---|---:|---:|---:|---:|
| Legacy |132|175|267|.004246300375898171|
| Legacy |144|169|269|.004244224234187896|
| Legacy |156|168|267|.00422569888272454|
| Adaptive |132|164|357|.005709927358656759|
| Adaptive |144|170|366|.00572060215940873|
| Adaptive |156|171|365|.005714169208024464|
| Continuous |132|271|3120|.015044730004971807|
| Continuous |144|847|3184|.008648227288964758|
| Continuous |156|391|2740|.012656679138491876|

All nine poses returned zero ambiguous vertices and zero near-coplanar candidates in these particular tests. Three independent ray directions, unanimous parity only, nearest actual triangle distance for unanimously inside vertices. Not a proof of solid containment, self-intersection absence, true penetration depth or volume. Endpoint vertex chords in the continuous mode crossed the source surface at 1,972 vertices (132→144) and 3,888 (144→156). Chords are not actual articulated vertex trajectories or continuous collision certification.

Bounded orientation feasibility: 13 common pitch/roll rotations per pose, angle magnitude <= .12 rad, center fixed, unchanged relative assemblies, no lift. None of the 39 candidates eliminated transverse crossings. Minimum pair counts at steps 132,144,156 were 257,711,325; this is discrete research, not exhaustive feasibility proof.

Legacy offset-distance rejection counts during blocked C1 steps: 31,277. Of these 13,358 had surface displacement within the old center-distance limit and a normal offset change greater than the raw surface displacement. These are candidate rejections, not unique traversable obstacles.

The continuous candidate improved C1 blocked steps 835→85 but regressed negative directional samples 70→137, rib blocked steps 217→397, and this full-mesh adverse interval. Strict footprint gating blocked 1,497 C1 steps. Neither is live-authorized. Preserve both research failures. Do not use directional rays as structural clearance gates, and do not resolve this by lifting the vehicle arbitrarily. Investigate feasible footprint-aware contact transition constraints with full-mesh verification and continuous motion evidence.
