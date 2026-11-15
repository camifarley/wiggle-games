# 05 · Move Lab  🧪

Status: **Phase 1 built** (hub, Coach Boing, stations 1–9, parent overlay, recorder, replay in `npm test`). Phases 2–3 not built. Purpose: one place to try every body mechanic, for **three audiences at once**:
1. **The kid:** a string of quick, silly 20–30 second "move challenges" that earn stamps.
2. **The parent:** see exactly what the camera detects (and misses) on each device, and rate which moves are fun.
3. **The builders (us):** real movement recordings that become automated tests, plus per-device
   calibration that every game uses. This makes all future games more reliable.

The idea in one line: **every new mechanic gets born here first**, tested on the real kid and the real devices,
before a game depends on it.

## 1. The fantasy
**You're in Coach Boing's Move Lab.** A bouncy blob coach shows a move, you copy it, and the lab machines go
bananas when you get it right. Fill your **Move Passport** with stamps.

## 2. Structure
- **Hub:** a grid of big **station** cards (icon + number + short name), like the main menu. Each finished station gets a
  stamp ⭐ in the passport.
- **Station:** a 20–30 s micro-challenge for ONE mechanic. Coach Boing **demonstrates the move** with an animation
  (he can't read instructions, so a demo is essential), the voice says it, and a big counter shows "Jump 5 times! **3**".
- **Parent overlay** (🔧 button, top-right, visible but small): the raw signal graph, thresholds, an event log and
  the hit/miss score for the station. It's the same idea as `?debug`, but designed for a grown-up holding a phone.
- **Every station follows the same pattern:** prompt → kid does N moves → counter + effects per detection → "You
  did it!" → stamp. The station always ends on success (a timeout also gives the stamp).

## 3. Stations
Grouped by what they need (cheapest first). **Phase** says when each gets built (§9).

| # | Station | Kid prompt | Signal | Phase |
|---|---|---|---|---|
| 1 | **Jump** 🦘 | "Jump 5 times!" | `gestures.jump` (head height) | 1 |
| 2 | **Squat** 🐸 | "Crouch down like a frog… now stand!" ×3 | `crouch` / `stand` | 1 |
| 3 | **Spin** 🌀 | "Spin around!" ×3 | `spin` | 1 |
| 4 | **Peekaboo** 🙈 | "Hide your face… BOO!" ×3 | `peekaboo` | 1 |
| 5 | **Freeze** 🧊 | "Dance… FREEZE!" (statues) | `motion.total` + `still` | 1 |
| 6 | **Wave** 👋 | "Wave to pop the bubbles here… and here!" (targets in each zone) | `motion.at` / `hotspots` | 1 |
| 7 | **Silly face** 😮 | "Open your mouth big! Smile! Blink! Tilt your head!" | face blendshapes, `roll` | 1 |
| 8 | **Magic toy** 🔴 | "Show me something red!" (then blue, yellow) | `color.track` | 1 |
| 9 | **Come closer / go back** 👣 | "Step closer… now back!" | face size (distance) | 1 |
| 10 | **Finger pop** ☝️ | "Pop bubbles with your finger!" | `hands` fingertip | 2 |
| 11 | **Clap** 👏 | "Clap 5 times!" | hands meet (palm distance) | 2 |
| 12 | **High five** ✋ | Hit targets with left/right hand | `hands` + handedness | 2 |
| 13 | **Arms up** 🙌 | "Reach for the sky! Make a star!" (Y, T, star poses) | `pose` wrists vs shoulders | 2 |
| 14 | **Run in place** 🏃 | "Run, run, run!" (speed meter) | `pose` knee/ankle alternation, or head bounce rhythm | 2 |
| 15 | **Lean** 🏄 | "Lean left… lean right!" (surfboard) | `pose` shoulder midpoint / face x | 2 |
| 16 | **Stomp** 🦖 | "Stomp like a dinosaur!" | pose ankle drop + motion low in frame | 2 |
| 17 | **Big & small** 🎈 | "Make yourself BIG… now tiny!" | pose spread (wrist–ankle span) | 2 |
| 18 | **Flamingo** 🦩 | "Stand on one foot!" (timer) | pose ankle heights | 3 |
| 19 | **Dance beat** 🎵 | Move on the beat | motion.total rhythm vs tempo | 3 |
| 20 | **Count fingers** 🖐️ | "Show me 3 fingers!" | hand landmarks | 3 |

Phase 1 needs no new ML. It covers everything the existing games already use, which is where the reliability problems are.

## 4. Built-in measurement (the expansive part)
Every station run is **also an experiment**:
- **Known answer:** the prompt says "Jump 5 times", so the station knows the kid *meant* to do 5. It shows
  "**detected 5 / 5**" (or 3 / 5) to the parent. A **"Not quite" / "Yes"** pair in the parent overlay lets the parent
  correct the count ("he actually did 6").
- **Recorder:** while a station runs, it records the **tracker numbers** (eye-line height, face size, motion,
  pose/hand landmarks, events fired) at the tracking rate. **No video, no images.**
- **Export:** a 💾 button saves the recording as a small JSON file, labelled with the station, device, tier and
  the true count. Drop it into `fixtures.local/` and `npm test` **replays it** through the detectors. A real jump
  session becomes a permanent regression test ("this exact 5-jump recording from the Fire tablet must produce
  5 jumps"). This extends the simulated scenarios in `scripts/test-height.js` with real data.
- **Privacy:** recordings contain only numbers. Keep them private by default (`fixtures.local/`, gitignored). Only the
  1-D signals (height, size, motion) are safe to commit as public test fixtures. Full face/body landmark traces stay local.

## 5. Calibration (benefits every game)
- **"Stand on the star" warm-up** (first visit, about 10 s): learns his standing height, face size at play distance, normal
  jump height and crouch depth on THIS device.
- Saves a **per-device calibration profile** (localStorage) that the core gestures use in every game.
  Example: if his real jumps reach +2.4 face sizes on the iPhone, the jump threshold can safely be 1.2 there.
- The parent overlay shows the profile and has a **Reset calibration** button.

## 6. Rewards & no-fail
- Every station ends in a stamp, even on a timeout ("Great try! ⭐"). The parent sees the real hit rate; the kid only
  sees success.
- Each detection fires a big reaction (machine lights, confetti, Coach Boing cheering, a sound).
- **Move Passport:** all stamps collected = the lab throws a party (confetti storm, Coach Boing dances).
- The kid can replay favourite stations, which is itself data: **which mechanics he picks again = which to build games around.**

## 7. Parent overlay (🔧)
- A **live signal graph** for the station (e.g. head height over the last 5 s with the jump and crouch threshold lines),
  so you can *see* why a jump was missed (peaked at 0.8, threshold 1.0).
- **Event log** with timestamps, and **detected / expected**.
- **Threshold sliders** (session-only) to try values live. "Save to device" writes them into the calibration profile.
- **Fun rating:** 😐 🙂 😄 per station (how much he enjoyed this move), exportable alongside the recordings.

## 8. Tech
- **needs vary per station.** Core addition: `ctx.setNeeds([...])` (async) so a game can switch trackers at runtime,
  loading ML models on demand (Phase 2 stations load `hands` or `pose`). Load at most one heavy model at a time on the
  low tier.
- **Core additions** (additive, reusable, separate `core:` commits):
  1. `ctx.setNeeds(needs)` (dynamic tracker switching).
  2. `core/recorder.js`: record tracker frames + events to JSON. `scripts/replay.js` replays fixtures through
     the detectors in `npm test`.
  3. **Calibration profile** in `perf`/`gestures` (per device), read by `height.js` thresholds.
  4. **Replay as a fake camera:** `?replay=<file>` feeds a recorded session into the trackers instead of the
     camera, so builders can test games against **real** movement without a kid in front of the Mac (phase 3).
  5. New detectors as they're proven: `clap`, `armsUp`, `run` (cadence), `lean`, `stomp`, each in its own pure
     module with simulated plus recorded tests, like `height.js`.
- **Performance:** one station live at a time; trackers not used by the current station are paused.
- **Testing:** every station must work with `?fakecam&debug` (debug keys simulate its events) and with a replayed
  recording once one exists.

## 9. Phases
1. **Phase 1 (build first):** hub, Coach Boing, stations 1–9, parent overlay (graph + log + detected/expected),
   recorder + export, replay in `npm test`. This alone diagnoses every detector the existing games use.
2. **Phase 2:** `setNeeds`, hands + pose stations 10–17, new detector modules.
3. **Phase 3:** calibration profiles feeding all games, `?replay=` fake camera, stations 18–20.

## 10. Safety & setup
- Same setup as Bounc'a Bugs: device about 2–2.5 m away at chest height, clear floor, no socks on hard floors.
- Running in place and stomping are loud on upstairs floors 😅. The parent can skip any station.
- Short stations (≤ 30 s) with a calm one (Silly face, Magic toy) after every two energetic ones.

## 11. Playtest questions
- Which stations does he ask to repeat? (These are the mechanics to build the next games around.)
- Which stations show the worst detected/expected? (Fix those detectors before any game relies on them.)
- Does Coach Boing's demo make each move clear without words?
- Is the lab fun on its own, or only useful as a tool? (Both are fine. It's a tool first.)
