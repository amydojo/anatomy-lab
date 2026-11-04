# BODY / LIVE — X-RAY Experiment 001\n\n> V3 rescue notes and acceptance protocol are appended below.

Route: /experiments/xray/  
Branch: experiment/ar-xray-elbow, isolated from V14.  
Status: experimental. Requires a physical iPhone validation pass.

## Usage — V2
Serve over HTTPS and open /experiments/xray/. **Close-up / Tap** is the default: activate the rear camera, tap a textured edge near your elbow, then one near your wrist. Image-feature patch matching follows these manual visual anchors; it does not detect real bones or joints. Low contrast, rapid motion or camera viewpoint changes cause tracking to stop. Use Reset anchors and tap again. Close-up reveals only schematic forearm structures; an elbow angle is deliberately not reported. The user can also pause a frame even when tracking is lost, and set anchors on the frozen image while camera hardware is off.

Select **Full arm / Auto** to load MediaPipe Pose Landmarker. Keep the shoulder, elbow and wrist in frame. The engine must observe multiple plausible, consistent frames before acquiring an arm lock. Select left/right arm and anatomy layers. Pause releases the camera; Resume reopens it.

## Architecture
- xray-core.mjs: MediaPipe indices for shoulder/elbow/wrist, conservative full-arm plausibility and multi-frame stable-lock gates, EMA, tracking state, 2D angle, registered illustrative full-arm and elbow-to-wrist-only geometry.
- xray-tracker.mjs: grayscale patch matching near two user-tapped visual anchors with a reject-on-loss policy. **Not anatomical detection, optical-flow segmentation, or validated tracking.**
- xray.mjs: getUserMedia lifecycle, direct image-feature tracking in close-up and optional on-device MediaPipe Pose Landmarker (GPU then CPU) in full-arm mode. Persistent SVG interaction, layer inspection, tracking loss and camera release.
- index.html/xray.css: independent mobile-first instrument layout; does not load or modify the production atlas renderer.
- tests/xray-core.test.mjs and tests/xray.spec.mjs: math checks and **mocked** browser camera and inference checks.
- xray-experiment.yml: automated test workflow targeting mobile Chromium, WebKit, and desktop Chromium.

## Anatomy provenance and limitations
The production atlas contains BodyParts3D sourced elbow bones with CC BY 4.0 and external provenance records. This prototype **does not render or register those source meshes over a person**. It deliberately draws a labeled illustrative 2D rig to the estimated shoulder–elbow–wrist points. Biceps, brachialis, brachioradialis, triceps, bones, tendon and collateral ligament silhouettes are schematic, **not measured tissue**. Humerus, radius and ulna link to their corresponding Atlas entries; this does not validate the overlay's anatomical positioning.

In full-arm mode, the elbow angle is a 2D projected angle; it is not clinically measured joint ROM. In close-up mode, joint flexion is unavailable and the UI displays N/A. Image-plane pose fails under rotation, occlusion, low contrast, cropped joints, or foreshortening. The prototype cannot identify injuries, muscle size, actual tendons, pathology or medical findings.

## Camera privacy
Video only, never microphone. No video upload, recording, file storage, localStorage, screenshots or analytics are implemented by the experiment. Model inference runs in the browser. Third-party package, WASM and model resource requests may expose network metadata; MediaPipe documents use of task performance metrics and a privacy policy, so disclose those dependencies before public use. A user-initiated paused image is temporarily held only in canvas memory. Stop, navigation and page backgrounding terminate camera tracks and clear the paused frame.

## Performance and fallbacks
Detection uses requestAnimationFrame, bounds inference to approximately 29 iterations/second, reports measured inference FPS, and chooses GPU then CPU. This does not guarantee 30 FPS or a particular thermal profile. No made-up tracking is shown when the model fails. HTTPS and camera permission are required.

## Real-device acceptance — not yet verified
- iPhone Safari rear-camera permission and true environment camera selection
- Both arm landmark confidence and recovery in changing lighting
- Geometry translates and flexes with the live arm and does not persist on tracking loss
- Selection, layers, opacity, manual registration and pause/resume
- Portrait, rotation, page backgrounding and extended-session stability
- No production atlas regressions

## V2 implementation / known gaps
- The close-up matcher is an experimental grayscale patch matching baseline, not a learned elbow detector. It requires nearby texture or a visible edge and may lose lock on smooth skin, lighting change or arm rotation.
- Manual anchors only support the elbow-to-wrist image segment. No upper-arm muscle or joint-angle claims in close-up mode.
- P0 next improvement: camera test clips with **separately consented** material and real iPhone Safari validation for tapping behavior, image tracking, thermal/FPS, orientation and camera resume. No user screen recordings are committed as fixtures.
- Future: world-landmark depth, person segmentation and occlusion, accurate camera calibration, medically reviewed skinned 3D geometry. This prototype is not ready for a clinical interpretation or a production release.

---

# X-RAY V3 rescue — implementation and acceptance report

**Branch:** `experiment/ar-xray-elbow`; **draft PR:** #38. Never merge without physical iPhone acceptance.
**Scope:** This camera prototype draws a 2D instructional illustration; it is NOT a scan, tissue measurement, or anatomical registration.

## User flow
1. Open the HTTPS preview in Safari and allow rear-camera access.
2. Keep the forearm visible. Tap **Freeze frame**; the current cover-cropped video is copied into an ephemeral canvas and all live camera tracks stop.
3. Tap the elbow, then wrist. Each accepted tap shows a labeled visible marker, including on low-texture skin. If the points are too close, retap the wrist.
4. **ILLUSTRATION READY** appears with forearm-only anatomical silhouettes aligned between the points. Select a colored structure to see a visible name and information; Layers opens muscle, bone, and schematic connective options.
5. **Resume live** is optional. A texture patch near each manually placed anchor must match across frames. Matching failure hides the live geometry and presents **Freeze & recalibrate**. Smooth skin still supports the frozen educational display, but not a claim of live tracking.
6. Full arm / Auto is optional; it requires shoulder, elbow and wrist, loads MediaPipe only in that mode, and offers a one-tap return to Close-up / Tap when initialization fails.

## Confirmed source defects repaired (code-level evidence)
- V2 tracker `setAnchor` required variance >= .00024 and contrast >= .085 even for a stationary instructional overlay; ordinary smooth skin could reject both taps. V3 accepts valid manual points independently of tracking texture and reports whether live matching is supported.
- V2 close-up rendered only after `tracker.ready`; rejected calibration thus necessarily suppressed anatomy. V3 renders the frozen illustration once two sufficiently spaced manual anchors exist.
- V2 awaited camera permission, `video.play()`, and MediaPipe creation without bounded timeouts. V3 bounds camera, preview and pose initialization, cleans up late-acquired tracks, and provides a close-up fallback if pose initialization fails.
- V2 runtime tracking exceptions invoked `stop()`, displaying generic **CAMERA OFF**; V3 uses a visible **START FAILED** recovery state while releasing the stream.
- V2 declared **TRACKING ARM** before checking rendered shapes; V3 only uses that status when its geometry renderer actually displays shapes.
- V2 held structure details entirely behind the settings sheet, making selection feedback hard to see. V3 puts the selected structure name directly in the camera view.

## Hypotheses, mitigations, not proven from this environment
- Object-fit cropping / viewport misalignment on the reported iPhone may also contribute to edge-offset overlays. V3 shares an explicit `coverTransform` between frame sampling and freeze capture and unit-tests round-trips for 0/90/180/270 degrees and mirroring, but the browser's orientation-specific camera feed still needs real iPhone validation.
- The live matcher searches small grayscale patches and may drift, especially after permission restart, major movement, camera autofocus, lighting changes, or smooth skin. Tracking quality is **not** medically or device validated. V3 forces loss-and-recalibration instead of falsely retaining geometry.
- GPU delegate failure / remote model download may explain the loading phase in the reported video. Source code supports that possibility, but no runtime logs from the physical recording were available to assign a specific cause.
- The 3 November recording itself was not accessible as an attachment to this task, so this is a source-level diagnosis using the user-reported timestamps, not a verified frame-by-frame video assessment.

## Test evidence and remaining gate
- Unit tests: anchor acceptance, insufficient anchor spacing, source/viewport transform with mirroring and rotation, pose gates, geometry provenance.
- Playwright: mobile Chromium, mobile WebKit and desktop Chromium mocked-camera regression suite, plus a **locally rendered realistic forearm fixture** captured by a genuine HTML Canvas. The fixture's visible pixels are used for freeze/selection and alignment; screenshots saved to `artifacts/xray-v3-<project>-before.png` and `artifacts/xray-v3-<project>-calibrated.png` in GitHub Actions artifacts. This is **not** real iPhone performance proof.
- Additional recovery tests: pose model creation fails on both GPU and CPU, user can switch to close-up; changed camera image loses lock and exposes **Freeze & recalibrate**. Check GitHub Actions conclusions for the exact commit before claiming a passing gate.
- No user footage, image capture or camera pixels leave the browser. The CI fixture is entirely synthetic.

## Physical iPhone Safari acceptance protocol — required
1. Open the exact-SHA Vercel preview on a physical iPhone over HTTPS; permit rear camera. Confirm camera fills the viewport and status/control rows do not cover the elbow/wrist.
2. With only forearm and elbow in view (shoulder excluded), Freeze. Confirm a **visible frozen image** remains after Safari camera indicator turns off.
3. Tap elbow once, confirm **ELBOW PLACED** and exactly one marker. Tap wrist once, confirm **ILLUSTRATION READY**, two markers and three or more legible forearm structures on Muscle layer. Try smooth skin, not only textured clothing.
4. Tap a structure; confirm the structure label appears without opening the sheet. Switch to Bone and Connective; check each layer's visible silhouettes and selection.
5. Resume live with the arm held steady; if live image matching is reliable, overlay must follow the two points. If not, confirm **IMAGE MATCH LOST** and that anatomy is hidden rather than floating at the edge; tap Freeze & recalibrate and repeat.
6. Switch to Full arm / Auto with shoulder visible; test CPU fallback/recovery, camera permission deny/retry, backgrounding, portrait/landscape, and page reload. Verify no lingering camera indicator or stuck spinner.
7. Record browser + model/version, exact preview SHA, pass/fail and time-coded video for any remaining defect. Do not merge the draft PR based solely on CI.

## Non-goals
No MRI/X-ray output, real internal tissue detection, clinical angle, measured joint range of motion, 3D depth, or accuracy-certified anatomical overlay. Full-arm 2D projection is not medical registration.
