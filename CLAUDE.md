# Wiggle Games — rules for agents

Camera-based movement mini-games for a 4-year-old. Static web app (Vite + plain JS ES modules,
no framework) that runs in Safari on iPhone, Chrome/Safari on a Mac and Silk on an Amazon Fire tablet.
Deployed to GitHub Pages when `main` changes.

## Who it's for
- A 4-year-old used to polished console games: make it **juicy** (big sounds, particles, bounce, voice).
- He reads numbers and some simple words. Menu = number + icon + short title.
- No losing and no fail states. Every bit of effort gets rewarded.
- Visible on-screen buttons only: the core gives every game a Back button. No hidden gestures.
- Speak instructions with `ctx.say()`. Don't rely on text.

## Layout
```
src/core/        shared engine (camera, loop, perf tiers, trackers, audio, fx, ui)
src/games/NN-x/  one folder per game: meta.json + index.js (+ assets/)
src/games/_template/  copy this to start a game
```
Games are discovered automatically (`src/games/registry.js`). **Never add games to a list by hand.**
`NN` is the number the kid sees on the menu. Use the next free number. If two branches pick the
same number, the one that merges second renumbers.

## Game contract
```js
export default {
  needs: ['motion'],         // any of: motion, color, face, hands, pose (ask only for what you use)
  showCamera: true,          // false => runtime fills `background` instead
  init(ctx) {}, update(dt, ctx) {}, draw(g, ctx) {}, destroy(ctx) {}
}
```
`meta.json`: `{ "title": "Bubble Pop", "icon": "🫧", "color": "#5ee0ff" }`
(optional `"last": true` keeps the card at the end of the menu whatever its number: used by 09 Cloud Credits)

## Releases (every game keeps its history)
The kid co-designs these games, so he can play every version and see how each game grew.
- Today's game = **v1.0**. Fixes/tweaks = minor (**v1.1**), big changes = major (**v2.0**).
- Versioned layout: `src/games/NN-x/v1.0/index.js`, `v1.1/index.js`, … each with a `cover.svg|png`
  (a picture of the main thing that changed), listed oldest-first in `meta.json`:
  `"releases": [{ "version": "1.0", "title": "First bugs!" }, { "version": "1.1", "title": "New bugs!" }]`.
  A game with a plain `index.js` and no `releases` is an implicit v1.0 (no picker).
- **Never edit an old release folder.** (One narrow exception: wiring a grown-up/test tool into a release's 🔧 panel, such as the
  🎮 Keyboard toggle, is allowed when it doesn't change gameplay at all. Say so in the PR; `verify-pr` will flag it for review.) To make a new release, copy the latest folder to the new version,
  change it, draw a cover, and add the entry to `meta.json`. Releases share the core (so core changes must
  stay backward compatible with old releases too).
- More than one release → tapping the game opens a picker (v1.0 … newest, NEW badge). Routes:
  `#/play/<game>` (picker) and `#/play/<game>@<version>`. `ctx.release` tells a game which version is
  running; show it small in the HUD.

## Credits
`src/credits.json` is the one list of credits (shown by 09 Cloud Credits). `docs/CREDITS.md` is generated from it
(`npm run credits`). `npm test` fails if any file under `public/sounds/` (or future `public/art|music|images/`) has no
entry (`assets`: paths or `*` globs relative to `public/`), or if CREDITS.md is stale. Add a credit with every new asset.
Roles only, never real names (family names are typed on the device in Cloud Credits' 🔧 panel).

## Sounds
- Today's game sounds are synthesized (`src/core/audio.js`). Real sound files are being chosen by the parent and kid
  in the **Sound Picker** (`sounds.html`, live at `/sounds.html`): 17 slots × ~6 Kenney CC0 candidates, 👍/👎/⭐,
  exported as `sound-picks-*.json`. Candidates: `public/sounds/candidates.json` + `.m4a` files (AAC plays on
  Mac/iPhone/Fire), rebuilt by `scripts/sounds-shortlist.py`. Only use CC0 or CC-BY sounds and list them in
  `docs/CREDITS.md`. Nothing ominous: this is for a 4-year-old.
- **Picks are wired in through the core, not per game:** `src/core/sound-picks.js` (slot → files or a
  `synthLab` design) and `src/core/music-picks.js` (`menu` / game id / mood → track). A picked file replaces the
  synth for that name everywhere (`ctx.sfx.pop()` plays it); if it hasn't loaded, the synth plays. Picked files
  live in `public/sounds/sfx/` and `public/sounds/music/`.
  **Applying an export:** `venv/bin/python -I scripts/sounds-apply-picks.py <sound-picks.json> .` copies the picks to
  `public/sounds/sfx/`, matches loudness (plus the Picker's 🔉/🔊 votes) and regenerates `sound-picks.js`.
  Sounds that repeat a lot rotate through every 👍 (⭐ weighted 3×, never twice in a row); "moment" sounds
  (power-up, win, collect, tap…) use the single ⭐. `sfx.ding()` plays `collect` and `sfx.tada()` plays `powerup`.
  Menu buttons play `tap`. Games only hear the other slots (smash, punch, bonk, step, laser…) if they call
  `ctx.sfx.play('<slot>')`. Don't play sounds with `new Audio()` in games: it
  skips the parent's volume/mute and the rate limits. Use `ctx.sfx.play(slot)` / `ctx.music.jingle()`.
- **Test runs with `?fakecam` are silent by default; add `&sound` to hear them** (`?fakecam&sound`). `?mute` forces
  silence in any mode. Silent = Web Audio sfx + music at gain 0, `say()` a no-op (speech cancelled), and any
  HTML `<audio>` muted. A small "🔇 test mode" badge shows bottom-left. `audio.muted` (read-only) is true in test
  mode or when the parent picked 🔇; `audio.testMuted` is true only for the URL mute. The parent's 🔊/🎵 menu
  settings are separate and stay saved per device.

## Core API (ctx)
- `ctx.W`, `ctx.H` (CSS px), `ctx.time` (s since start), `g` = 2D canvas context already scaled for DPR
- **Coordinates:** trackers return 0..1 *norm* coords in the **mirrored** camera image (what the kid sees).
  `ctx.view.toScreen(nx, ny)`, `ctx.view.toNorm(x, y)`, `ctx.view.scale(n)` convert to and from screen px.
- `ctx.motion.at(nx, ny, r)` → 0..1 movement in a circle; `ctx.motion.total` → whole view
- `ctx.motion.hotspots(n, minStrength)` → up to n `{x, y, strength}` where movement is happening (spawn points)
- `ctx.gestures.on('spin'|'peekaboo'|'hide'|'leave'|'return'|'still', fn)`, `ctx.gestures.state`
  (`present|hidden|away`), tunable via `ctx.gestures.config`. Needs **both** `face` and `motion`.
  Listeners auto-clear when the game stops. Spin = face lost while the body moves a lot, then back.
- `ctx.gestures.on('jump'|'crouch'|'stand', fn)`, `ctx.gestures.height` (head height vs standing, in face
  sizes; + up, − crouching), `ctx.gestures.crouching`. Distance-independent.
  **Source:** if the game's `needs` include `pose`, height comes from the **shoulder line** (body tracking:
  works 1–4 m away and when the head leaves the frame; `ctx.gestures.heightSource === 'body'`). Otherwise the
  face's eye line, which only works within ~1.2 m (the face tracker's limit; confirmed by a recording).
  **Any game that needs jumping, crouching or spinning should include `pose`.**
  **Spin with `pose`:** counted from the shoulders (`src/core/spin.js`): side-on the shoulder line nearly
  vanishes, so one turn = two quick dips. Also emits `turn` (a half turn) and sets `ctx.gestures.turn`
  (0 facing … 1 side-on). Verified against a real 3-spin recording. Peekaboo/leave still use the face when
  `face` is in `needs` (body presence otherwise); the face never double-counts spins when `pose` is on.
  **Peekaboo with `pose` and no `face`** (`src/core/peekaboo.js`, `ctx.gestures.peekabooSource === 'body'`):
  both wrists within ~1 shoulder width of the head for ≥ 0.4 s emits `hide`, then a hand dropping away emits
  `peekaboo`. `ctx.gestures.handsNear` (farther wrist to head, in shoulder widths) and `ctx.gestures.covering`
  show it live; a station/game may set `peekabooSource` itself (Move Lab's Peekaboo station does). In that mode a
  short tracking dropout emits nothing (no face-style `hide`/`peekaboo`); leave/return still use body presence.
  Simulated scenarios in `scripts/test-peekaboo.js`. Recordings log `hn`, `cv` and the raw points `pk`.
  Logic + thresholds in `src/core/height.js`, covered by simulated playtests in `scripts/test-height.js`
  (`npm test`). Change thresholds there and add a scenario, never by guessing in a game.
  `?debug` shows the live head height (green = jump, blue = crouch).
- **Run in place** (needs `pose`; `src/core/run.js`, scenarios in `scripts/test-run.js`): `ctx.gestures.run` =
  `{intensity 0..1, state: 'idle'|'walking'|'running', rate (steps/s), bob, jumping, kneeDiff}`. Events `step`,
  `walk`, `run` (started running), `runstop`. From the shoulder-line bob (one down-up swing per step, ~1.5–3.5/s),
  the left/right knee swing when knees are visible, and a little motion. Jumps (shoulders move 2–4 face sizes),
  squats, arm waving and walking closer/further don't count (simulated + real jump/squat/spin/distance
  recordings in `npm test` must never read "running"). Live tuning: `ctx.gestures.runConfig` (incl.
  `sensitivity`, `walkAt`, `runAt`); reset to defaults when a game starts.
- **Punch** (needs `pose`; `src/core/punch.js`, `scripts/test-punch.js`): `ctx.gestures.on('punch', fn({hand:
  'left'|'right'|'both', speed, x, y}))`, a fast push or swing of a wrist in shoulder widths/s relative to the
  shoulders (depth counts half), with travel + per-hand cooldown. Not punches: slow arm raise, clapping, the
  running arm pump at normal intensity, pulling the fist back. `ctx.gestures.punch.value` = fastest wrist /
  threshold (live signal); tune via `ctx.gestures.punchConfig` (`sensitivity`, `speed`, `travel`, `cooldown`).
  Recordings log `kq` (knee y), `ri`/`rs`/`rr` (run), `pv` (punch signal) and `pz` (wrist depth);
  `scripts/replay.js` replays labelled `run` (number of runs) and `punch` (number of punches) recordings.
- **Steer** (needs `pose`; `src/core/steer.js`, scenarios in `scripts/test-steer.js`): `ctx.gestures.steer` =
  `{value −1..1 (+ = screen right, mirrored), mode: 'lean'|'arms'|'sim'|'none', raw, hold, torso, tilt, shift, wing,
  count, left, right}`; event `lean` `{side}` each time `|value|` passes `steerConfig.countAt`. **Lean** = shoulders vs
  hips + shoulder-line tilt + whole-body shift vs a learned center (each against a slowly learned "standing straight"
  baseline, so a tilted camera or crooked stance reads straight); **airplane arms** (both wrists out wide at shoulder
  height ≥ 0.25 s) = the wrist-to-wrist tilt. Deadzone + smoothing. Not steering: standing still, walking
  closer/further, jumping (extra-slow smoothing), spinning (side-on = straight), arm waving. Stepping sideways steers
  until the center catches up (~6 s). A short tracking dropout keeps the steering and never re-learns "straight"
  (only after `relearnAfter` = 2 s without a body). Tune via `ctx.gestures.steerConfig` (`sensitivity`, `deadzone`, `smooth`, …);
  reset to defaults when a game starts. **Sim hook:** set `ctx.gestures.simLean` to a number −1..1 to drive the
  steering instead of the pose (same smoothing and `lean` events; `null` = real body; reset to `null` per game). The
  ←/→ debug keys only set this value, so a test-input layer can take them over. Recordings log `hp` (hips), `sv` (value), `sm` (mode); Move Lab station 12
  "Lean / Airplane arms" ✈️ records labelled leans that `scripts/replay.js` replays (`lean` = number of leans).
- `ctx.body()` → `{found, width, headIn, kneesIn, feetIn, wholeBody, zone}` where the kid stands (needs `pose`).
  `zone`: `'too-close'` (knees not in view) · `'good'` (shoulders to knees) · `'too-far'` · `'none'`. Knees, not
  feet: a laptop camera often can't see feet at 2 m (real recording). Jumping/squatting games should prompt
  "Step back so I can see your knees!" when `zone === 'too-close'`. `width` = shoulder width
  in frame heights (bigger = closer). Recordings log it per row (`bw`, `kn`, `ft`, `hd`, `z`).
- `ctx.head()` → `{found, x, y, width, roll, source, estimated}` screen-px top of the kid's head, for
  hats/crowns/wearables. Uses `face` when it sees one; otherwise falls back to `pose` (nose for position, ears/eyes
  for tilt, shoulder width for size, smoothed). When the head is above the frame (jumping) it's estimated from the
  shoulders (`estimated: true`). `source` = `face|body|fake|none`. With `?fakecam` it returns a pretend head
  (drops when crouching via the C key).
- `ctx.color.track('red'|'orange'|'yellow'|'green'|'blue'|'pink'|{hue,tol,minSat,minVal})` → `{found,x,y,size}`
- `ctx.face` → `{found, center, leftEye, rightEye, roll, size, mouthOpen, smile, blinkLeft, blinkRight, blend, points[478]}`
- `ctx.hands` → `[{tip, palm, points[21], handedness}]`
- `ctx.pose` → `{found, nose, leftWrist, rightWrist, leftAnkle, rightAnkle, leftKnee, ..., points[33]}`
- `ctx.sfx.pop/ding/boing/whoosh/tada/splat/squish/snore/boom/giggle/sneeze/buzz/skitter()`, `ctx.sfx.squeak(pitch)`, `ctx.sfx.tone(freq, dur, type)`,
  `ctx.say(text, {interrupt})` (pass `interrupt:false` for minor lines so they don't cut off instructions)
- **Sound engine** (`src/core/audio.js`): every sfx goes through a master bus (parent volume 🔊🔉🔈🔇 and
  🎵 music on/off on the menu, remembered per device) and a rate limit (same sound ≥ 45 ms apart, ≤ 14 at once),
  so spamming `sfx.pop()` is safe. `ctx.sfx.play('smash'|'punch'|'bonk'|'laser'|'sonic'|'powerup'|'win'|
  'collect'|'step'|'shield'|'cubes'|'tap'|…, {vol, rate})` plays any Sound Picker slot (file if picked, else a synth).
  `say()` ducks the music while it talks and is silent when the parent mutes.
- **Music** (`src/core/music.js`): the runtime starts the game's picked track automatically (and the menu's).
  `ctx.music.play('sneaky')` switches mood (e.g. a "move slowly" round), `ctx.music.resume()` goes back to the
  game's track, `ctx.music.jingle('win')` plays a one-shot over the music, `ctx.music.stop()`. Tracks are
  `'gen:<style>:<seed>'` (happy chiptune generated in code: `sunny zoom hop groove downhill tiptoe fanfare`,
  pre-rendered into a seamless loop) or a file path.
- `ctx.fx.burst(x,y,opts)`, `ctx.fx.confetti(n)`, `ctx.fx.text(x,y,str,opts)`, `ctx.fx.shake(px)`
- `ctx.recorder` (`src/core/recorder.js`): records tracker **numbers only** (never video/images) for tests.
  `recorder.start({station, expected, colors})`, `recorder.event(name, data)`, `recorder.stop()`,
  `recorder.download({trueCount, ...})` saves a labelled JSON (one row per tracking sample: eye-line `y`,
  eye-distance `s` exactly as fed to `height.js`, motion, face found/size/blendshapes, color blobs; plus every
  gesture event). The runtime ticks it; it stops when the game stops. `ctx.gestures.onAny(fn(name, data))`
  hears every gesture event; `ctx.gestures.raw` = `{y, size, dt}` fed to the height tracker this frame.
- **Fixtures/replay:** put recordings in `fixtures.local/` (gitignored). `npm test` runs `scripts/replay.js`,
  which replays every jump/squat recording through `createHeightTracker` and fails unless it produces the
  labelled `trueCount` (skips when the folder is empty or a file is unlabelled). `node scripts/replay.js file.json`
  checks one file.
- `ctx.testinput` (`src/core/testinput.js`): test controls; `.active`, `.lean`, `.timeScale`, `.toggleButton()`;
  games may set `debugSkip = { next, finale }` on their exported object. See "Testing without moving".
- `ctx.perf.settings` → current tier (`name`, `particles`, `maxParticles`, `trackFps`, ...)

## Performance
- `src/core/perf.js` starts at a tier (Apple = high, Fire = low, others guessed) and drops one tier
  after 3 seconds below 24 fps. Scale heavy effects by `ctx.perf.settings.particles`.
- `needs` is the main cost lever: `motion` and `color` are almost free. `face`, `hands` and `pose` are
  ML models (several MB, loaded lazily). Use one ML model per game unless you really need more.
- Don't create gradients or images every frame for hundreds of objects. Don't call `getImageData` in games.
- URL flags: `?debug` (overlay: fps, tier, motion mask, tracking points), `?tier=low|medium|high`
  (pin a tier), `?tier=auto` (forget the saved tier), `?fakecam` (synthetic camera: a moving red ball; **silent**,
  add `&sound` to hear it), `?mute` (silent in any mode).
- Debug keys (with `?debug`): **S** spin, **P** peekaboo, **L** leave/return, **T** still, **J** jump, **C** crouch/stand,
  **Z** pretend `ctx.body().zone === 'too-close'` (toggle), **hold R** run (**tap R** = walk a few steps), **X** punch,
  **hold ← / →** lean left / right (steer).
  In `?debug`, `window.wiggle.ctx` exposes the live game context for console inspection
  (games may also set `window.wiggle.game` to their state).
  With test controls on (`?keys`, see "Testing without moving") these keys move the pretend body instead.
- A hidden Browser pane / background tab throttles or pauses animation (frames can freeze entirely).
  Show the pane before judging timing, fps or "nothing moved".

## Testing without moving (test controls)
For grown-ups play-testing levels, not for the kid. `src/core/testinput.js` (UI) + `src/core/testbody.js` (pure).
- **Turn on:** `?keys` in the URL, the **🎮 Keyboard** button in a 🔧 panel (Move Lab overlay, Smash Run v1.2 tuning;
  any panel can add `ctx.testinput.toggleButton()`), or the 🎮 chip that `?debug` shows. It stays on for the browser tab
  (sessionStorage) until turned off (`?keys=0`, ✕ Turn off). While on, a **🎮 KEYS** badge is always visible.
- **Keys:** Space jump · ↓ hold crouch · ↑ hold run · Shift+↑ or W hold sneak (tiptoe: steady "walking", quiet
  motion, never "running") · ← → hold lean · Enter punch · S spin · P peekaboo (tap or hold) ·
  L leave / come back · T stand still · `[` `]` game speed 1×/2×/4× · `?` (or H without `?debug`) cheat sheet with a live
  stick figure and what the detectors see. The `?debug` letters J/C/R/X/S/P/L/T also go through the pretend body when on.
  Space/arrows/Enter are `preventDefault`ed (no scrolling, no clicking the focused button); auto-repeat is ignored
  (holding Space = one jump); keys typed in inputs/textareas are ignored; losing window focus releases held keys.
- **Touch pad** (iPhone / Fire, no keyboard): translucent buttons in the bottom corners (◀ ▶ ⬇ 🤫 hold, ⬆ hold, 🦘, 👊, 🌀,
  🙈 hold), shown automatically on touch screens while test mode is on (🕹 Touch pad in the cheat sheet, or `?pad`).
- **Through the detectors, never around them:** keys move a pretend body; it becomes a 33-point `tracking.pose`
  (replacing the pose tracker), an eye line + presence for gestures' face path, and `ctx.motion.total` (what gestures
  and sneaky rounds read; `motion.at()` / `hotspots()` stay the camera's),
  sampled at the tier's `trackFps` with ~0.15 s lag. height.js / spin.js / run.js / punch.js / peekaboo.js / body
  zones / `ctx.head()` then decide what happened, with their real thresholds and ramps (run takes ~1.3 s to read
  "running"; a crouch ~0.6 s). `scripts/test-testinput.js` (`npm test`) checks one jump per Space tap (incl. auto-repeat),
  crouch/stand on ↓, run rising and falling with ↑, spin on S, punches, peekaboo and lean at 12/20/30 Hz.
  Games that only `need` motion (Bubble Pop) or read `ctx.face` landmarks directly (Animal Face) aren't driven by it.
  ← → ease the pretend body's lean toward −1/+1 and back; gestures copies it into `gestures.simLean`, steer.js's sim
  hook (Mega Roll, Move Lab ✈️).
- **Silent:** `?keys` in the URL is silent test mode like `?fakecam` (🔇 badge); add `&sound` to hear the game. Turning
  test controls on from a 🔧 panel doesn't change the sound.
- **Fast-forward & skip:** the runtime runs `game.update` `ctx.testinput.timeScale` times per frame (detectors stay in
  real time). A game may opt in to skip buttons: `game.debugSkip = { next: fn, finale: fn }` (on the exported game
  object, set any time); ⏭ / 🏁 then appear next to the badge while test mode is on.
- **TEST-INPUT rule:** a recording made while test controls, `?fakecam` or the `?debug` gesture keys were used is saved
  with `testInput: true` + `testInputSource`, its filename starts with `TEST-`, and `scripts/replay.js` reports it as
  TEST-INPUT and never enforces or counts it. Never put a test-input recording in `fixtures.local/` as real data.
- **Replay-as-input (later):** `recorder.start({ fullPose: true })` (or `?recpose`) adds `pp` = all 33 pose landmarks as
  33 × `[x, y, z, v]` = 132 numbers, on rows where a new pose sample arrived (`poseFormat:
  'mp33-xyzv'`; format in `recorder.js`). Enough for a future `?replay=<file>` to drive every body detector.
- **Caveat:** the pretend body is tidy. It tests levels, flow, rewards and pacing; it does NOT tell you whether a
  threshold feels right for a 4-year-old. Feel tuning (sensitivity, speeds, lag) still needs a real kid and real
  recordings.

## Game briefs
Design briefs live in `docs/briefs/` (template: `docs/briefs/_TEMPLATE.md`). Read the game's brief before
building or changing it. This repo is public: no child names or personal details in briefs or code.

## iOS camera rules (live in src/core/camera.js — DO NOT break)
1. `<video>` keeps exactly: `autoplay playsinline webkit-playsinline muted disablePictureInPicture`.
2. Never call `video.play()` right after `getUserMedia`. Wait for `onloadeddata`, then `play()`.
3. The rAF loop calls `camera.keepAlive()` every frame:
   `if (video.paused && video.readyState >= 2) video.play().catch(()=>{})`.
4. The camera starts once per session from the Play tap and is **never stopped between games**.
   Only exception: the parent picks another camera from the menu's 📷 button (`camera.use(deviceId)`,
   remembered per device in localStorage).
5. Audio unlocks inside the Play tap (`audio.unlock()`).
6. The `<video>` element stays in the DOM, nearly transparent. Never `display:none`.

## Changing the core from a game branch (allowed, with guardrails)
A game branch may improve `src/core/` when the game needs it. Rules:
- **Additive by default:** add new functions or options, and keep existing signatures and behavior.
- If you *must* change shared behavior, update every game that uses it **in the same branch**.
- Put core changes in **separate commits prefixed `core:`** so they're easy to review or cherry-pick.
- Document any new core API in the "Core API" section above, in the same branch.
- Never weaken the iOS camera rules.

## Skills (studio workflow)
Project skills in `.claude/skills/` (any session can run them):
- **`check-recordings`**: collect new Move Lab/game recordings from Downloads into `fixtures.local/`, summarize
  counts, notes and signal timelines, and run the replay checks (`node .claude/skills/check-recordings/summarize.mjs`).
- **`verify-pr`**: independent check of a builder's PR in a temporary worktree: merge into latest main, build,
  `npm test` with real recordings, old releases untouched, bundle sizes, plus a fake-camera smoke test
  (`bash .claude/skills/verify-pr/verify.sh <N>`).
- **`handoff-update`**: changes to an existing game go to the builder session that made it, with the release rules.

## Workflow
- Branch per game: `game/NN-name`. Core-only work (rare): `core/what`.
- **Read first:** this file, the game's brief in `docs/briefs/`, and `CLAUDE.local.md` if present (private
  design lessons from playtests; gitignored, so it may only exist in the main checkout).
- Before opening a PR: `git merge main` into your branch, then `npm run build` and `npm test` must pass, then smoke-test
  the menu, your game and one other game with `?fakecam&debug` (debug keys simulate gestures).
- `npm run dev` = HTTPS on your LAN (for iPhone/Fire testing; accept the self-signed cert).

## Parallel builders (several sessions at once)
Each game is built by its own Claude Code session in its own git worktree.
- **Setup in a fresh worktree:** run `npm install` first (it also copies the MediaPipe files).
- **Dev server port:** another session may already be using 5173. Run `npm run dev:http` and use the
  URL Vite prints (it picks the next free port), or pass `-- --port 51NN` with your game number.
- **Game number** is reserved in the brief's title (`# 05 · ...`). Use exactly that folder number.
- **Stay in your lane:** edit only `src/games/NN-name/` and your brief. Core changes follow the rules
  above (additive, separate `core:` commits, documented here). If you change CLAUDE.md, keep it to
  your own additions so merges stay clean.
- **Finish with a pull request, never a direct push to `main`:** push your branch, then
  `gh pr create --base main` with a short summary (what was built, how it was tested, what's untested on
  real devices). The repo owner merges PRs; merging deploys the live site.
- If `main` moved while you worked (another game merged), `git merge main` again, re-run the build,
  and push before asking for the merge.
