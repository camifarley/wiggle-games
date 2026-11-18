# 10 · Magic Mirror 🪞

## 1. The fantasy
The screen is a magic mirror. He sees himself, and every move he makes does something funny to his reflection: he
stretches, clones, smears through time, paints with light, shrinks, turns to stone and breaks free. He's the
special-effects wizard.

## 2. Why (from playtests)
- He loves seeing himself and feeling in control of a funny effect. His favourite console title is a mirror-effects toy.
- **But a mirror alone isn't a game.** A face-mirror game scored 1/5 because it only echoed blinks. So every effect needs:
  - a **body trigger** that does something big and visible,
  - a **build-up → release** (a meter that fills with movement and pops into a big finale),
  - and room for discoverable quirks he can poke at.
- No losing, no fail states. Big sounds, particles and bounce.
- Short `ctx.say()` instructions; the menu = number + picture + short word.

## 3. Structure
- **Hub:** a grid of big tiles, one per effect (number + picture + one word).
  - "Show, don't tell": the focused tile shows the effect LIVE on his camera image, at low res. The other tiles show a
    still or cover; animate them only if perf allows.
  - Big ◀ ▶ buttons and tapping a tile enter a station.
  - A big **🎲 Surprise me!** tile cycles a random effect every ~25 s with a fun transition.
- **In a station:**
  - A one-line voice intro ("Jump to make a clone!"), the effect running on him, and a meter.
  - The finale when the meter fills, then the effect keeps going.
  - Visible ◀ ▶ / 🏠 buttons. No hidden gestures.
- **Stations need no win.** They're toys with a payoff.

## 4. v1.0 stations (aim for these 12; cut or replace any that don't feel good, and note why)
| # | Station | Body trigger → effect | Finale |
|---|---|---|---|
| 1 | **Funhouse** | lean = wavy mirror bend; jump = stretched tall; crouch = squashed wide | big jelly wobble of the whole picture |
| 2 | **Clone Party** | each jump/clap spawns a time-delayed copy of him (echo clones, up to 8) | all the clones dance in a conga line |
| 3 | **Time Smear** | slit-scan: each row of the picture is a little older, so moving makes noodle-stretchy him; faster moves = wilder | rewind wave |
| 4 | **Rainbow Trails** | movement leaves rainbow ghost trails; standing still lets them fade | the rainbow meter bursts into confetti |
| 5 | **Light Painter** | wrists paint glowing ribbons in the air | clap = ribbons burst into fireworks |
| 6 | **Kaleidoscope** | mirrored segments of him; arms up = more segments; spin = it rotates | a flower bloom |
| 7 | **Pixel Me** | 8-bit blocky him; jump = the blocks fly off and snap back | crouch = tiny pixels, a jump = giant ones |
| 8 | **Teleporter** | his cutout over silly backdrops (space, underwater with fish swimming round him, jungle, snow); a jump teleports him (zap) | — |
| 9 | **Giant / Tiny** | crouch = tiny him; arms up / jump = GIANT him that stomps with screen shake and tiny houses | — |
| 10 | **Statue** | stand still = he slowly turns to gold or stone; move = cracks and bursts free | a sneaky "move slowly" challenge, funny, never a fail |
| 11 | **Invisible** | peekaboo / hide = he fades to see-through with only his outline shimmering; pop out = "BOO!" burst | — |
| 12 | **Jelly Me** | his cutout wobbles like jelly on springs; jumps jiggle him | — |

[v1.1]:
- Face stations: bubble/dragon breath from an open mouth, sparkle eyes on a blink, a big head that grows. They need
  `face`; see the tech notes.
- A **📸 Photo booth** that saves stills on the device only.
- A **Mix** mode that stacks two effects.

[later]: a "mirror twin" (symmetry), thermal/neon outline, puppy ears that flap.

## 5. Tech
- **Rendering:** WebGL fragment shaders on a video texture via three.js, in a lazy chunk like Smash Run. Use a ring
  buffer of low-res frame render targets (e.g. 320×240 × 30–60 frames, fewer on low tier) for the clones, time smear
  and trails. Scale with `ctx.perf.settings`; it must stay smooth on the Fire/low tier (fewer frames, lower res,
  cheaper effects).
- **No `getImageData` in the game** (CLAUDE.md rule).
- **Person cutout (segmentation):** stations 2, 8, 9, 11 and 12 need a mask of him.
  - Add a core tracker: `needs: ['segment']` using MediaPipe ImageSegmenter with the small selfie segmenter model,
    lazily loaded like the others.
  - It provides `ctx.segment` → `{ ready, mask (a texture or canvas usable by WebGL), width, height }` in the mirrored
    view coords.
  - Put it in separate `core:` commit(s), document it in CLAUDE.md "Core API", keep it additive, and copy the model the
    way `npm install` copies the MediaPipe files.
- **needs:** `['pose', 'segment', 'motion']`. Use `ctx.gestures` (jump, crouch, spin, peekaboo/hide, still), wrists
  from `ctx.pose`, and motion.
  - Face stations wait for v1.1 unless a clean lazy "request face mid-game" core option is added (separate `core:`
    commit with docs and tests).
- **Fake camera for screenshots and tests:**
  - `?fakecam` shows a red ball, and segmentation finds no person in it.
  - Add (in a `core:` commit) an option for `?fakecam` to draw a simple cartoon person driven by the pretend test body
    (`src/core/testbody.js`), e.g. `?fakecam=person`, so effects, cutouts and screenshots have someone to work on.
  - **Never** use or commit real camera frames: the repo is public and the camera sees a child.
- **Privacy:** camera images never leave the device, and nothing is saved by default.
- **Sound:** a signature sound per station via `ctx.sfx.play(slot)` and the core synth. Music via the core music picks.
  Test silently (`?fakecam`/`?keys`).
- **🔧 panel:** live sliders per station (effect strength, trail length, clone delay, meter speed, mask smoothing,
  resolution) and global ones, plus 🎮 Keyboard (`ctx.testinput.toggleButton()`), a notes box and 💾 Export
  (`ctx.recorder`) like the other games.
- **Test controls:** everything playable with `?keys&fakecam` (Space jump, ↓ crouch, S spin, P peekaboo, T still,
  ← → lean, Enter punch). Set `debugSkip` to jump between stations.

## 6. Playtest questions
- Which stations does he return to? Does the meter/finale matter, or is the live effect enough?
- Is the cutout good enough on the laptop and the Fire?
- Does he understand each trigger from the voice line?
