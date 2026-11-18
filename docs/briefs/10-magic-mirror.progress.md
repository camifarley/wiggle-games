# 10 · Magic Mirror: progress (v1.0)

## Core
- ☑ `core:` segment tracker (`needs: ['segment']`, `ctx.segment`): MediaPipe ImageSegmenter (selfie segmenter) on a tiny
  mirrored copy of the camera; pure mask logic in `segmask.js`; `scripts/test-segment.js`
- ☑ `core:` `?fakecam=person`: cartoon kid driven by the pretend body, exact fake mask; `scripts/test-fakeperson.js`
- ☑ `core:` music pick `10-magic-mirror` → `gen:sunny:3` (generated, until the parent picks one in the Sound Picker)
- ☑ CLAUDE.md "Core API" docs (segment, fakecam=person, needs list)

## Game (`src/games/10-magic-mirror/v1.0/`)
- ☑ Hub: big LIVE preview of the focused station (auto-advances every 5 s, ◀ ▶ to pick), 13 tiles (12 + 🎲), tiles
  refreshed one per frame (high), every 2nd (medium), every 4th (low) frame
- ☑ Station frame: voice intro, ✨ points with combo, rainbow magic meter → finale (voice, confetti, +1000), effect keeps
  going; 🏠 ◀ ▶ buttons; 🎲 Surprise me switches every 25 s with a dice flash
- ☑ 1 Funhouse · ☑ 2 Clone Party · ☑ 3 Time Smear · ☑ 4 Rainbow Trails · ☑ 5 Light Painter · ☑ 6 Kaleidoscope
- ☑ 7 Pixel Me · ☑ 8 Teleporter · ☑ 9 Giant / Tiny · ☑ 10 Statue · ☑ 11 Invisible · ☑ 12 Jelly Me
- ☑ 🔧 panel: global + per-station sliders, readouts (tier, fps, cutout source, body signals, events), "played on this
  device" stats (visits / seconds / finales per station), 🎮 Keyboard, notes, 💾 Export (numbers only)
- ☑ Sounds per station (core sfx + Sound Picker slots), `debugSkip` (⏭ next station, 🏁 finale)
- ☑ cover.svg, meta.json releases
- ☑ Screenshots (fake person only) + contact sheet in `docs/screenshots/10-magic-mirror/`
  (`scripts/screenshots-magic-mirror.mjs`: headless Chrome, muted)
- ☑ `scripts/test-magic-mirror.js`: every station runs 12 simulated s + finale, shader values stay finite; clap detector

## Deferred (per brief)
- [v1.1] face stations (bubble breath, sparkle eyes, big head), 📸 photo booth, Mix mode
- [later] mirror twin, neon outline, puppy ears

## Decisions
- **three.js full-screen shaders** into an offscreen WebGL canvas drawn onto the 2D stage (like Smash Run), so core HUD,
  particles and screen shake stay on top. One shader per station on a shared header (gl.js).
- **History = one atlas texture** (8×8 tiles of 256 px on high = 64 frames ≈ 2.1 s; 8×5 × 192 px medium; 5×4 × 128 px
  low). Alpha channel stores his mask at that moment, so clones / trails / ghosts are cutouts for free.
- **Room plate**: learned where the mask is clear (for Invisible). Never-seen spots fall back to an average of the room
  around him (mask-weighted), so he never shows through.
- **No mask yet?** A body-shaped mask is drawn from the pose (reusing fakeperson's shapes) until the segmenter answers,
  so cutout stations never go blank.
- **Model** loads from Google's model storage like the face/pose models (the repo never self-hosted model files: only the
  WASM runtime is copied by `npm install`). Kept consistent rather than downloading a model at install time.
- **Giant / Tiny sizes are relative**: "normal" = he fills ~55% of the screen whatever his distance; GIANT is capped so
  his head stays on screen; the houses scale the other way (that's what sells "giant").
- **Kaleidoscope** wedges always look UP from his hips (head + arms in every wedge); segment count has hysteresis.
- **Clap** = both wrists far apart then together within 0.9 s (body sizes). Punch also fires fireworks / clones, so the
  keyboard (no clap key) can test it; hands-to-face (peekaboo) also reads as a clap, a discoverable quirk.
- **Statue** meter fills slowly while freezing (build-up) and in big chunks when he bursts free; more stone = more points.
  Its finale is the sneaky "move slowly" round (sneaky music, slow moves earn sparkles, a fast move = funny crack).
- Points persist per device (`wiggle.magicmirror`), plus play counts per station for the playtest question "which
  stations does he return to?" (🔧 panel). No pictures are ever stored.

## Perf notes
- Mac (headless Chrome, 1280×720): 60 fps on every station on the high and the low tier.
- Fire / iPhone: untested on device. Low tier = 0.6 render scale, 20 history frames, 4 clones, 6 trail ghosts,
  2-pass ribbons, segmenter 144 px @ 12 Hz, tile refresh every 4th frame.

## Open questions
- Is the selfie segmenter good enough on the Fire at 12 Hz? (`segment.config.fps`, 🔧 "Cutout smoothing")
- Does he understand "Cover your eyes to turn invisible" (body peekaboo = both hands at the head ≥ 0.4 s)?
- Time Smear and Jelly read best in motion; are they funny enough or should v1.1 swap them for face stations?
