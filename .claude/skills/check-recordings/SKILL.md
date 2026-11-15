---
name: check-recordings
description: Collect and analyze new Move Lab / game recordings (wiggle-recording JSON from the 🔧 💾 button). Use when the parent says "new recordings", "see recording", "I recorded…", "check the data", or drops files into Downloads/fixtures.local. Copies them into fixtures.local, summarizes counts, notes and signal timelines, runs the replay checks, and diagnoses what misbehaved.
---

# Check recordings

Recordings are the ground truth for every body detector (jump, squat, spin, run, punch, distance…). Each file
says what the station asked for (`expected`), what the parent says really happened (`trueCount`, from ✅ / ✏️),
what was detected live, a fun rating, an optional **note**, and per-frame numbers (never video).

## Steps

1. **Collect + summarize** (run from the MAIN checkout's repo root, not a worktree, since `fixtures.local/` lives there):
   ```bash
   node .claude/skills/check-recordings/summarize.mjs            # last 2 hours + anything new from Downloads
   node .claude/skills/check-recordings/summarize.mjs --all      # everything
   node .claude/skills/check-recordings/summarize.mjs --file fixtures.local/<name>.json
   ```
   It copies new recordings from `~/Downloads` into `fixtures.local/` (it never deletes from Downloads) and prints,
   per file: counts, fun, the parent's NOTE, event counts, a 1-per-second timeline of the relevant signals,
   and the replay result.
   If nothing new shows up, say so plainly ("the newest recording is still the 4:54 PM one…") and ask
   where they saved it. Don't analyze an old file as if it were new.

2. **Read the parent's note first.** It usually says what felt wrong. Then compare **real vs detected**:
   - detected < real → missed moves; detected > real → false triggers; unlabelled → remind them to tap
     ✅ Yes or ✏️ Not quite before 💾 so it can become a test.

3. **Diagnose from the timeline, not from guesses.** Typical patterns we've seen:
   - `----` (no face) for long stretches → the face tracker lost them (it only works within ~1.2 m) → use body tracking.
   - height stuck near a threshold, or size jumping a lot → standing height learned wrong / moved closer.
   - run state flips idle↔running while the parent says "he ran the whole time" → run detector; but first
     check whether the **station's own rules** (not the detector) blocked the count. The Run station once
     demanded a STOP between runs.
   - zone `too-close` / `no-knees` → camera framing, not the detector.
   - many `punch` events in a station where he didn't punch → punch false positives.
   When useful, replay variants: `scripts/replay.js` exports `replayHeight`, `replaySpin`, `replayRun`,
   `replayPunch` (each takes `(rec, configOverrides)`), so you can measure "what if threshold X" against the real
   file before changing code. Never tune on one file alone: the simulated scenarios
   (`scripts/test-*.js`) must keep passing too, and if a fix hurts them, undo it and say so.

4. **Report to the parent** in plain language: a small table of what happened over time, the cause, and
   what you'll change (or what recording would settle it, e.g. "record the Smash station with real punches").

5. **Fixes:** detector/core fixes can be made here (they're shared, with tests). **Changes to a specific game go
   to its builder session**: use the `handoff-update` skill.

6. **Private notes:** if the parent shares ratings or reactions, add them to `ratings.local.md`
   (gitignored) and new design lessons to `CLAUDE.local.md`. Never put the child's name or ratings in committed files.

## Notes
- Labelled recordings in `fixtures.local/` are enforced by `npm test` (replay must reproduce the real count).
  Face-era Jump/Squat recordings are reported as info only.
- The summary script imports `scripts/replay.js`, so it always uses the current detectors.
