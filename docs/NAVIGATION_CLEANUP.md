# Navigation cleanup — isolated from PLAYGROUND

Base: e8f4a2e1647e15c9f55d986e379aae2c894d1f5d. Target feat/nexus-experience; coordinate before merging.

Static audit: 14 HTML pages, 156 literal root-relative href/src references, zero missing local targets. This is not external or dynamic runtime qualification.

- Classic home primary action now enters /play/; original directory and anchors retained at /.
- Four joint labs mislabeled / as Atlas; Collections points to /nexus/, brand links to /play/.
- Collections Explore and /play/ now use the same worldURL policy. Older continuous AXIS is explicitly experimental, with its separate source/stream/zoom tests retained.
- Removed duplicate entry and recent primary destinations; hide empty history. Joint labs, experimental collections, sources are grouped. Region links honor chosen input profile.
- PRESENCE tools omit duplicate no-op Explore, reticle inspection and incompatible continuum resume. Existing guarded Perform preserved.
- External pinned origins retained for draft storage and reproducibility. WORLD runtime and AXIS streaming/zoom remain unqualified. No external health claim.
- No renderer, geometry, picking, mobile HUD, scientific gate or production modification.

Added static and browser tests. The existing continuum test explicitly enters the preserved legacy route; its source, zoom and restore gates remain. Physical and browser qualification must be verified, not assumed.

## Follow-up qualification
Initial navigation CI 45771739840: 3 browser passes and 3 failures. The V4 runtime hides the static fallback navigation and creates its own menu; fixing static markup alone was insufficient. Corrected generated brand and region menu destinations, as well as fallback brand links. The browser test now opens the actual rendered region menu and navigates to Collections; dissection retains its static navigation check. Retest required. Original failure retained in CI history.
