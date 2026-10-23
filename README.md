# BODY / LIVE — Interactive Anatomy Atlas

A mobile-friendly collection of exploratory, interactive anatomy simulations, built as dependency-free static HTML.

## Live chapters

| Experience | Route | What it explores |
|---|---|---|
| Atlas homepage | `/` | Visual body map and anatomy lab hub |
| Hip / Live | `/hip/` | Muscle layers, femur movement, sciatic nerve |
| Hip / Exposed | `/hip/dissection/` | Five-depth virtual posterior hip dissection |
| Knee / Live | `/knee/` | Flexion, ACL/PCL, menisci, patella, muscles, nerves |
| Shoulder / Live | `/shoulder/` | Arm elevation, scapular motion, rotator cuff, labrum |

## Structure

```
index.html                  # main atlas and body map
hip/index.html              # hip motion lab
hip/dissection/index.html   # deep-hip virtual dissection
knee/index.html             # knee lab
shoulder/index.html         # shoulder lab
assets/                     # extracted anatomy cover artwork
README.md
```

## Run locally

No build step or dependencies. Serve the repository directory with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. For deployment, import this GitHub repository into Vercel as an **Other** framework/static project, using the repository root with no build command.

## Adding an anatomy lab

1. Create `<joint>/index.html` with its own interactive model.
2. Add a tile and corresponding visual body-map hotspot to `index.html`.
3. Add the new destination to the shared navigation in existing lab pages.
4. Keep interaction accessible to keyboard and mobile users. Test movement, layer controls, and links at both viewport sizes.

### Model constraints

These are simplified, illustrative 2D models and educational activities. They are *not* precise biomechanical calculations, clinical diagnostic instruments, or substitutes for professional assessment. Pain referral and sensory maps overlap, and users should stop movements that provoke symptoms.

## Provenance

Organized from the original BODY / LIVE Hip, Hip / Exposed, Knee and Shoulder labs created during October 2026. The original interactive lab code is preserved, with navigational links normalized for the hub.
