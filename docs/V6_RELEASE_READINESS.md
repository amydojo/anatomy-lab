# V6 prerequisite — release-readiness audit of PRs #4, #5 and #6
**Audited 2026-10-27 (UTC). Docs only. No merges or production changes.**

## Executive decision
All three PRs are **OPEN, DRAFT, MERGEABLE**, and have recent successful CI evidence. **HOLD** each one from the currently deployed public `main` until qualified anatomical, source-license and claim-scope reviewers accept its precise geometry/changes. No GitHub approval reviews were recorded for #4/#5/#6 at audit time. A successful Playwright run is not an expert anatomical approval.

The source chain is `main` → **#4 V5.3 Hip** → **#5 V5.4 Nerve Truth** → **#6 V5.5 Nerve / Follow**. This is a stack of dependent review units, not three independent merge-ready features. The V6 planning PR is independent of this stack.

## Current public deployment
- `main`: `a0863916c4569bcac32c9a238d9b57d640f746b1` (V5.2 Knee / Spatial).
- Production alias: `anatomy-lab-ten.vercel.app`, deployment ID `dpl_8etduY5eZMnE9whhgeLNV3hqaNZh`. The latest staged V5.5 preview is a different Vercel deployment.
- Planning does **not** rename aliases, change feature flags, promote previews, publish anatomy, or merge any reviewable PR.

## PR #4 — Hip / Spatial
- URL: https://github.com/amydojo/anatomy-lab/pull/4
- Head: `21ed35f04c33a7c1d64c481631d48fcd18d6c3e1`; base: `main`.
- CI: **144 Playwright/browser tests passed**, workflow run `40459766251`; source and geometry checks successful. Some subsequent checks on the same head were *canceled*, contributing to GitHub's `mergeable_state=unstable`. Revalidate required checks on the final merge candidate.
- Product: 11 referenced BodyParts3D 4.0 right hip bones and gluteal/deep rotator meshes; multi-axis rigid illustrative femur movement, exposed-layer exploration, gluteus medius lesson. Legacy Hip/Exposed preserved.
- Provenance file: `hip/spatial/assets/provenance.json` on the branch has `anatomist_reviewed=false` and `biomechanics_validated=false`.
- Review source: `docs/V53_HIP_ANATOMY_REVIEW.md`. Checklist unfinished, review identity/date/scope pending.
- **Blockers**: qualified hip anatomy review of orientation, insertion/relationships, joint pivot/kinematics, overlap/layer order; explicit educational claim scope; component license and source attribution confirmation.
- **Disposition**: keep draft until reviewer signs exact commit and source asset hashes. Do not merge merely because runnable.

## PR #5 — Nerve Truth
- URL: https://github.com/amydojo/anatomy-lab/pull/5
- Head: `0bca51e1fc178a99f388894843367e65752d0fb3`; base: `feat/v5-3-hip-spatial` (#4).
- CI: **162 Playwright/browser tests passed**, workflow run `40558132820`; verification checks successful.
- Product: isolated Z-Anatomy-derived right sciatic, tibial and common-fibular 3D source surfaces, registered onto the separately sourced BodyParts3D 4.0 hip by automated right-femur ICP; original full mixed-license nervous-system source bundle excluded.
- **Source geometry is not medical imaging**. Nerve atlas and 4.0 pelvis are not shown to come from the same specimen. Source provenance explicitly marks: `imaging_derived=false`, `clinically_verified=false`, `same_donor=false`, `registration_expert_verified=false`, `anatomist_reviewed=false`.
- ICP fit recorded in `hip/spatial/assets/sciatic-provenance.json`: median `0.062219` display units (~6.22 mm) and P95 `0.143454` display units (~14.35 mm). **These are FEMUR SURFACE FIT residuals and cannot be cited as sciatic nerve localization errors.**
- Licensing: isolated Z-Anatomy derivative CC BY-SA 4.0 with original BodyParts3D attribution. Upstream atlas contains separately restricted material; exclusion and license compatibility require legal review for planned distribution, especially commercial/public reuse.
- Review source: `docs/V54_NERVE_SOURCE_AUDIT.md`. No expert or legal approval recorded.
- **Blockers**: clinical-anatomy review of nerve course vs piriformis/foramen and variants; expert registration check; exact licensing/attribution share-alike compliance; claim language.
- **Disposition**: hold draft, no clinical or patient-specific claims.

## PR #6 — Nerve / Follow
- URL: https://github.com/amydojo/anatomy-lab/pull/6
- Head: `beef3207fd63b79e32a505757c4758b6d7e3554c`; base: `feat/v5-4-nerve-truth` (#5).
- CI: **189 Playwright/browser tests passed**, workflow run `40585658753`; additional focused Knee verification `40585658841` successful.
- Product: `hip/spatial/nerve-follow.js` audits mesh triangle connectivity and creates a source-derived, Y-ordered **visual** path; arc-length interpolation, branch selector and gaps, camera target, reduced-motion-aware Follow control; `assets/hip-knee-bridge.js` verifies common BodyParts3D femur reference alignment.
- Hip/Knee bridge: 480 corresponding femur vertices map between scene frames within rounding, **not nerve placement or cross-source anatomical continuity**.
- Nerve parent-child relationships exist by source labels; endpoint gaps are quantified and surfaced. Graph connections do **not** imply continuous imaged nerve tissue. Atlas vs registered composite modes remain explicitly different.
- No anatomical approval review recorded and no dedicated V5.5 expert reviewer signoff identified during audit. Existing V5.3/V5.4 source blockers are inherited.
- **Blockers**: qualified review of branch course and continuity claims, renderer transition behavior, gaps and measurement labeling; legal/scope approval inherited from #5, anatomy inherited from #4.
- **Disposition**: hold draft pending parent review and own path/navigation approval.

## Unresolved issues across the stack
| Risk | Evidence | Required action | Gate |
| --- | --- | --- | --- |
| Anatomical accuracy | Imported source meshes but no independent anatomy signoff; hip pivot illustrative | Qualified anatomy reviewer confirms selected educational claims, structures and screenshot views at exact commit+hash | Required before public anatomical publication |
| Composite misinterpretation | Nerve comes from distinct reference source, ICP measures femur only | Keep explicit seam and labels; reviewer checks spatial relation, no claim of same donor | Required |
| Share-alike/mixed content | CC BY-SA derivative nerve and excluded noncommercial components | Verify legal scope, attributions, license artifacts, origin+modification notices; confirm no NC redistributions | Required |
| CI stability | #4 has canceled later checks though a full run passed | Run all required checks again on merge-candidate commit, after any rebases | Required |
| Runtime performance | Canvas2D reprojects/sorts triangles; V6 full-body budget not benchmarked | Device measurements before choosing GPU renderer and asset budgets | Required before V6 GPU/atlas release |
| UX scientific accuracy | Branch gaps, sampled visual lines, inferred atlas seams | Test no false continuity and that disclosure survives animation/region changes | Required |
| Release process | Stack consists of draft PRs with bases on one another | Agree stage order, record approval, rebase later PRs after acceptance, rerun tests after rebase | Required |

## Release gates and staged merge protocol
**Gate A — technical verification:** CI green on exact SHA; source hash checks; mobile screenshot/real Safari and keyboard smoke tests; no outstanding correctness regressions. Test count alone does not pass later gates.

**Gate B — evidence and legal:** for each sourced structure/relation, original source, license, pinned hash, transformation, out-of-scope material exclusion, attribution, uncertainty, and share-alike release plan are documented and accepted.

**Gate C — qualified anatomy review:** structured reviewer signoff specifying credentials, commit, source asset SHA, structures/laterality, relationships, kinematic assumptions, unresolved findings and educational claim scope. Outstanding adverse findings block release.

**Gate D — publication decision:** owner approves exact release scope and target; production alias remains fixed until the explicit release action. Then release sequentially:
1. Review and approve #4 against `main`; merge only if gates B/C/D are satisfied and CI stable.
2. Rebase #5 onto accepted `main`, ensure no unexpected diff; repeat gates A/B/C/D for the sciatic derivative/composite.
3. Rebase #6 onto accepted `main`, repeat gates A/B/C/D for nerve-follow continuity and shared spatial infrastructure.
4. Only after this may the integrated V6 anatomy adapter be considered for production. Separate **shell-only** V6 can remain gated to approved source/schematic context.

**Stop condition**: If any source component is unlicensed for the intended distribution, a review has material unresolved findings, a source hash changes, or a transition depicts anatomically unsupported continuity, **do not publish that data**. Preserve the current production experience and continue under preview.

## V6 work while approvals are pending
Permitted: write code-independent architecture documents, design an Atlas shell and semantic body region list from `main`, create a preview `/atlas/` with no unreviewed geometry, performance benchmarks, and the source/evidence validation framework.

Not permitted without additional decisions: silently merge draft anatomy, enable V5.3–V5.5 links on the production front page, import mixed-license bundles, claim medical-grade nerve accuracy, or alter Vercel production alias.

### Evidence gathered
- GitHub REST PR metadata, changed files, review lists and commit check-runs for #4/#5/#6.
- Source asset manifests `hip/spatial/assets/provenance.json` and `sciatic-provenance.json`.
- GitHub Actions logs for successful browser runs 40459766251 (144), 40558132820 (162), 40585658753 (189).
- Existing `docs/V53_HIP_ANATOMY_REVIEW.md`, `docs/V54_NERVE_SOURCE_AUDIT.md`, `README.md` and spatial engine source.
- Live main ref and Vercel production alias were read-only verified.

**No medical or legal review performed by this document's author.**
