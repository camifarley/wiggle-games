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
  sizes; + up, − crouching), `ctx.gestures.crouching`. Inferred from the face's height, distance-independent.
- `ctx.head()` → `{found, x, y, width, roll}` screen-px top of the kid's head, for hats/crowns/wearables.
  Needs `face`. With `?fakecam` it returns a pretend head (drops when crouching via the C key).
- `ctx.color.track('red'|'orange'|'yellow'|'green'|'blue'|'pink'|{hue,tol,minSat,minVal})` → `{found,x,y,size}`
- `ctx.face` → `{found, center, leftEye, rightEye, roll, size, mouthOpen, smile, blinkLeft, blinkRight, blend, points[478]}`
- `ctx.hands` → `[{tip, palm, points[21], handedness}]`
- `ctx.pose` → `{found, nose, leftWrist, rightWrist, leftAnkle, rightAnkle, leftKnee, ..., points[33]}`
- `ctx.sfx.pop/ding/boing/whoosh/tada/splat/squish/snore/boom/giggle/sneeze/buzz/skitter()`, `ctx.sfx.squeak(pitch)`, `ctx.sfx.tone(freq, dur, type)`,
  `ctx.say(text, {interrupt})` (pass `interrupt:false` for minor lines so they don't cut off instructions)
- `ctx.fx.burst(x,y,opts)`, `ctx.fx.confetti(n)`, `ctx.fx.text(x,y,str,opts)`, `ctx.fx.shake(px)`
- `ctx.perf.settings` → current tier (`name`, `particles`, `maxParticles`, `trackFps`, ...)

## Performance
- `src/core/perf.js` starts at a tier (Apple = high, Fire = low, others guessed) and drops one tier
  after 3 seconds below 24 fps. Scale heavy effects by `ctx.perf.settings.particles`.
- `needs` is the main cost lever: `motion` and `color` are almost free. `face`, `hands` and `pose` are
  ML models (several MB, loaded lazily). Use one ML model per game unless you really need more.
- Don't create gradients or images every frame for hundreds of objects. Don't call `getImageData` in games.
- URL flags: `?debug` (overlay: fps, tier, motion mask, tracking points), `?tier=low|medium|high`
  (pin a tier), `?tier=auto` (forget the saved tier), `?fakecam` (synthetic camera: a moving red ball).
- Debug keys (with `?debug`): **S** spin, **P** peekaboo, **L** leave/return, **T** still, **J** jump, **C** crouch/stand.
  In `?debug`, `window.wiggle.ctx` exposes the live game context for console inspection
  (games may also set `window.wiggle.game` to their state).
- A hidden Browser pane / background tab throttles or pauses animation (frames can freeze entirely).
  Show the pane before judging timing, fps or "nothing moved".

## Game briefs
Design briefs live in `docs/briefs/` (template: `docs/briefs/_TEMPLATE.md`). Read the game's brief before
building or changing it. This repo is public: no child names or personal details in briefs or code.

## iOS camera rules (live in src/core/camera.js — DO NOT break)
1. `<video>` keeps exactly: `autoplay playsinline webkit-playsinline muted disablePictureInPicture`.
2. Never call `video.play()` right after `getUserMedia`. Wait for `onloadeddata`, then `play()`.
3. The rAF loop calls `camera.keepAlive()` every frame:
   `if (video.paused && video.readyState >= 2) video.play().catch(()=>{})`.
4. The camera starts once per session from the Play tap and is **never stopped between games**.
5. Audio unlocks inside the Play tap (`audio.unlock()`).
6. The `<video>` element stays in the DOM, nearly transparent. Never `display:none`.

## Changing the core from a game branch (allowed, with guardrails)
A game branch may improve `src/core/` when the game needs it. Rules:
- **Additive by default:** add new functions or options, and keep existing signatures and behavior.
- If you *must* change shared behavior, update every game that uses it **in the same branch**.
- Put core changes in **separate commits prefixed `core:`** so they're easy to review or cherry-pick.
- Document any new core API in the "Core API" section above, in the same branch.
- Never weaken the iOS camera rules.

## Workflow
- Branch per game: `game/NN-name`. Core-only work (rare): `core/what`.
- Before merging: `git merge main` into your branch, then `npm run build` must pass, then smoke-test
  the menu, your game and one other game (`npm run dev:http`, then open `http://localhost:5173/?fakecam&debug`).
- `npm run dev` = HTTPS on your LAN (for iPhone/Fire testing; accept the self-signed cert).
