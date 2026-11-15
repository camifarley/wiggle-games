# 08 · Mega Roll  🏔️

Status: **v1.0 built** ("First mountain!"): `src/games/08-mega-roll/v1.0/`, steering in `src/core/steer.js`, Move Lab station 12 "Lean" ✈️. Number 07 is reserved for Space Pilot.

Parent direction: a downhill game that is **always moving**, with **procedurally generated levels from a seed**
(replay the *same* mountain to beat your score, or roll a *new* one), **timed rounds that end in a score**,
**chunky low-poly / blocky art**, **thousands of different kinds of objects**, and a **collection / passport book**
of everything you've found.

> **Originality:** these are classic genre pillars (endless downhill rollers, seeded runs, sticker books). The
> parent liked how one mobile game of this type felt, but **this is our own game**: own premise, own characters,
> own art, own names. No revenge story, no villagers getting hurt. Things *pop into stickers* and
> critters bounce away giggling.

## 1. The fantasy
**You're a giant bouncy ball rolling down a mountain that nobody has ever rolled before.** Every mountain is
brand new, and everything you bonk turns into a sticker for your book.

## 2. Core verbs: body → effect (the ball is ALWAYS rolling downhill; no running needed to move)
| Body move | In the game | Sound | Voice |
|---|---|---|---|
| **Lean** left/right (or **arms out like wings** and tilt) | Steer the ball. Gentle auto-assist pulls you toward smashables; the edges bounce you back, so you can never fall off | rumble | "Lean! Steer!" |
| **Crouch** (tuck) | **Tuck = speed boost**: the ball zooms and the camera stretches | whoosh | "Zoom!" |
| **Jump** | **Big bounce**: fly over fences/rivers, hit ramps for air-time bonus | boing | "Big bounce!" |
| **Spin** | **Spin-roll**: a sweep that bonks everything nearby | | "Spin-roll!" |
| **Run in place** | **Turbo** (optional extra speed and a faster combo meter) | footsteps | "Turbo!" |
| **Stand still** | Nothing bad: the ball keeps rolling and the assist keeps you on course | | |

**His face on the ball:** a round "porthole" on the ball shows his live camera face (cropped via `ctx.head()`),
always facing the camera (a billboard), not rolling around. Toggle it in 🔧. Processed on the device only.

## 3. Mountains from a seed (the replay loop)
- A **seed** fully determines a mountain: course shape, villages, forests, ramps, rivers, and every object's
  position *and kind*. Same seed = exactly the same mountain, every time.
- Every mountain gets a **kid-readable name and number** generated from the seed, e.g. **"Mountain 4721 · Wobbly
  Pickle Peak"**, shown at the start and on the score screen.
- **End of round (timer hits 0):** the score counts up big, with ⭐ **best score on this mountain** (saved per
  device) and **NEW STICKERS** found this round. Three big buttons:
  - **🔁 Same mountain:** replay the same seed and try to beat your best.
  - **🏔️ New mountain:** a new random seed (fresh course, fresh best score).
  - **📖 Sticker book.**
- Optional later: a **"Mountain of the day"** (seed from the date), so everyone in the family plays the same one.

## 4. Timed round & scoring
- **Round length:** 60 s by default (tunable 30–120 s in 🔧), with a big countdown clock. The last 10 s get a
  drumroll and a "10, 9, 8…" voice count (he reads numbers).
- **Score:** every bonk scores (small things a little, big things a lot), a **combo meter** fills with
  consecutive bonks, and a full meter = **RAINBOW ROLL** for a few seconds (the ball glows, grows a bit, smashes
  even the big stuff, and scores ×2). Air time and ramp jumps give bonuses.
- **Nothing ends a round early.** Walls and big rocks just bounce the ball with a goofy "boing".

## 5. Thousands of kinds of things (procedural object recipes)
Objects are generated from **recipes**, so the catalog is huge but the code stays small:
- **Base shapes** (~25–40): cow, sheep, pig, chicken, hay bale, fence, mailbox, cart, house, barn, windmill,
  tree, pine, bush, snowman, igloo, pumpkin, mushroom, rock, crate, barrel, flag, bench, lamppost, tractor,
  hot-air balloon, robot, dinosaur statue…
- **× color palette** (~10) **× pattern** (plain, spots, stripes, checks, sparkles) **× hat/accessory** (none, top hat,
  party hat, bow, sunglasses, crown…) **× size** (tiny, normal, BIG) gives thousands of distinct stickers.
- Each recipe has a **stable id** and a **generated funny name** ("Polka-dot Party Cow", "Tiny Striped Barn with
  Sunglasses"). Rarity tiers: common, rare (sparkle), **golden** (very rare, big celebration).
- All built from **flat-shaded low-poly / blocky primitives** (boxes, cones, low-poly spheres) and recolored.
  Same art family as Smash Run and Space Pilot.
- **Critters never get hurt:** animals bounce away, spin, giggle, and a sticker pops out. Objects burst into
  chunky cubes and confetti.

## 6. The Sticker Book (passport)
- A page per **base shape**, with a grid of slots for its variants: grey silhouettes until found, then the
  colored sticker with its funny name and a "found on Mountain 4721" stamp.
- **First time you bonk a new kind:** "NEW STICKER!" banner with a sparkle sound; it flies to a book icon in the
  corner.
- Progress numbers he can read: **"137 / 2,400 stickers"**, page completion stars, golden sticker shelf.
- Saved per device (localStorage); exportable via 🔧 (and importable, so stickers can move between devices).

## 7. Build-up → release & pacing
- **Build-up:** the combo meter → RAINBOW ROLL; villages are dense clusters to plow through (big combo moments).
- **Crazy ↔ calm within a run:** busy villages alternate with calm meadow/forest stretches with a few
  rare stickers hidden off the main line (steering practice, "sneaky" golden finds).
- **Signature moment:** RAINBOW ROLL down the middle of a big village. Everything bursts into stickers and
  confetti, the combo counter races up, and **"NEW STICKER! ×4"**.

## 8. Absence & surprise
- **Leave the frame:** the ball slows to a gentle cruise and waits (the timer pauses) until he's back.
- **Peekaboo:** the porthole face hides and a cartoon "?" appears, then "BOO!" with a burst of speed.

## 9. Tech
**needs:** `['pose', 'motion']`. Body tracking only (2–3 m away, knees in view). Use `ctx.body().zone` prompts
("Step back so I can see your knees!").

**Steering detector (new core module, shared with Space Pilot):** `src/core/steer.js`: a steering value from −1
to 1 from body lean (shoulder midpoint x vs a learned center, plus shoulder tilt), or the wrist-to-wrist tilt
when the arms are out wide. Smoothed, with a deadzone (standing naturally = straight). Pure module, simulated
scenarios in `npm test`, plus a **Move Lab station "Lean / Airplane arms" ✈️** so it can be recorded on the real
kid. **If Space Pilot's builder has already added `steer.js` on main, reuse it.**

**Seeded generation:** a small seeded PRNG (e.g. mulberry32/sfc32) with **separate streams** per purpose (course
layout, object placement, object recipes, cosmetics) so tweaking one doesn't reshuffle the others. The course is
generated in **chunks** (by chunk index from the seed), streamed in ahead and disposed behind. Deterministic tests
in `npm test`: same seed → identical chunk/object list; different seeds differ; the mountain name is stable.

**Recipe catalog:** a deterministic recipe space (`id → {shape, color, pattern, accessory, size}` + name), plus a
mesh builder with caching per recipe (instancing where possible). Test: ids are stable and names are unique enough.

**3D:** three.js (the version Smash Run pins; reuse its patterns: lazy chunk, low tier = fewer objects/no shadows).
Third-person chase camera behind and above the ball, looking downhill. Target Mac and iPhone; the Fire tablet
gets a later dedicated pass.

**Releases:** start at `v1.0/` with a cover in `meta.json` releases (title e.g. "First mountain!").

**Tuning panel (🔧),** same as Smash Run: live sliders (round length, roll speed, steering sensitivity/deadzone,
auto-assist strength, object density, combo fill, rainbow length, face porthole on/off), presets (Default /
Super easy / Wild), saved per device, a notes box, and 💾 export (settings + notes + session summary: seed, score,
stickers found, steering stats + the numbers-only recording). Plus **a seed field** so the parent can type a
mountain number to replay it.

**Testing:** `?fakecam&debug` keys: J jump, C crouch, S spin, hold R run, **←/→ arrows = lean** (add to the steer
debug keys), plus game keys to end the round now, roll a new seed, and open the book.

## 10. Safety & setup
Leaning and jumping need clear space; same setup as the other body games (2–2.5 m, knees in view). Rounds are short
by design, with a natural rest at every score screen.

## 11. Playtest questions
- Does lean steering feel good, or does he want arms-out steering? Is the auto-assist too strong or too weak?
- Does he want to replay the **same** mountain to beat his score, or always roll a new one?
- Does the sticker book hook him? Does he point at stickers and name them? Which shapes are favorites?
- Is 60 s the right round length?
