# 07 · Space Pilot: progress checklist

Brief: `07-space-pilot.md` (v2). Releases: **v1.0 "Rescue Run!"** (§A–§K, merged) · **v1.1 "Dizzy aliens!"**
(playtest feedback, this branch). Release plan shifted: the brief's old [v1.1] sections are now [v1.2], old [v1.2] → [v1.3].
Code: `src/games/07-space-pilot/v1.0/` (index.js game loop, world3d.js three.js scene, hud.js 2D cockpit/HUD,
recipes.js + passport.js Alien Passport, settings.js + tuning.js 🔧 panel). Tests: `scripts/test-space-pilot.js`.

## v1.1 "Dizzy aliens!" (playtest feedback = the whole release)
Code: `src/games/07-space-pilot/v1.1/` (copied from v1.0 with `new-release`; v1.0 untouched).
- ☑ 1. Calmer background: 700 (low: 260) far stars at 140–460 m, fixed 1.6 px, dim blue-grey, 55 % opacity, 12 %
  parallax; planet/moon smaller, farther, desaturated; nebula 10 %; darker sky. Star streaks only for the hyperspace
  hop (and faintly at full thrusters). Bad-guy voxels get a little self-glow, so the play layer is the brightest.
  Camera bank on lean reduced 0.18 → 0.05.
- ☑ 2. Passport: fixed-size cells in a centred grid (`width: max-content; margin: auto`), sized to the page width;
  the duplicate planet label is gone (the info line only shows tap feedback). Re-lays out on resize. Checked every
  page at 375 / 768 / 1024 px: left and right margins equal.
- ☑ 3. Crab tantrum: claws swing out and shake at the pilot, the hull stomps (hops), legs scramble, white steam
  cubes puff from the dome, stomp sounds. On taunts, phase changes, hits (sometimes) and every 7–10 s on its own.
- ☑ 4. "On the line" panel under the comms screen: the current wave's alien design, or CAPTAIN CLANK in the boss.
  Gibberish lines (taunt / hit / spit / dizzy / phase / defeat) in a squiggly speech bubble to the right, mouth
  flapping, babble = scheduled `sfx.squeak` + `sfx.tone`, "BAH!"/"PTOO" ends with `bonk`. No `ctx.say` for aliens; pod
  words, driver pops and freed-friend pops are gibberish too ("Zibba!", "Klonk!", "Weeboo!"). The v1.0 TTS line
  "I'll be back! Bleep bloop!" is now a crab babble.
- ☑ 5. Boss slime: two big (1.5×) slow (3.6 s) jelly-wobbling goo balls per spit, never auto-targeted, so they
  always land: SPLAT on the glass where they hit (r ≈ 13–17 % of the short side) + bonk + "wave to wipe!". Waving
  over a splat (`ctx.motion.at` at the splat, `wipeAt`) wipes it: squelch + "SQUEAKY CLEAN! +100". Otherwise it holds
  ~3 s and slides off. All slime (boops too) now slides off after ~2.6–3.2 s instead of ~14 s.
- ☑ 6. Friends aboard panel: the 3 latest rescues (newest right), pop in, hop, wave, ♪, gibberish thank-you
  squeaks (throttled when many arrive at once). Left column = comms · bad guy · friends, sized to fit above the
  dashboard (checked 1024×768 and 844×390 phone landscape).
- ☑ 7. Spin: no screen rotation at all. `turn` → bad guys in view get DIZZY 4 s (spin in place, wobble, stars
  round their heads, drift toward the crosshair lane, 1 hit, bigger aim target, swoopers stop booping, ×2 points);
  `spin` → DIZZY SPIN 6 s (+500). Dizzy boss: no attacks, eyes spin, double damage. The dizzy guard and slow-mo
  are gone (no rotation left to guard against). Move tutor: lean (start), punch (9 s), jump (19 s), spin (29 s),
  airplane arms (41 s); duck when the big rock comes, wave at the first slime. Voice line + big pictogram card
  next to the comms screen; ✅ YES! when he does it; a strip of learned moves under the column; an untried move is
  re-prompted after ~22 s.

- ☑ 8. Ducking easy and never a fail (added to v1.1 after the parent couldn't make it work at a distance).
  - New core `src/core/duck.js` (`core:` commit, tests in `scripts/test-duck.js` through the real height
    tracker at 30/12 fps): a latch opens at "DUCK!" and ANY duck until the rock passes counts. That means a dip
    ≥ 1.2 face sizes for 0.1 s, `crouching`, the `crouch` event, a hop or a spin. It catches quick bobs and early
    ducks that the crouch event (2.0 held 0.3 s) misses, and ignores standing noise, nods and walking closer.
  - Not ducked yet? The rock stops and wobbles just above, in front of him (z −14), with the ⬇ card held up and
    "Duck down!" every 3 s, for up to 6 s. Still nothing: it floats up and over ("WHEW! +50"). No bonk any more.
  - Height comes from the shoulder line (pose), so knees out of view don't matter. There's no "step back" nag
    while a duck window is open. One step-back check happens before the first rock (👣 STEP BACK! card + line,
    only if the zone is too close or none).
  - DUCK is the first move taught: a slow practice rock at 2 s, then rocks at 40 % and 75 % of the mission.
  - The view dips a little with any head dip, and fully when the duck counts.
  - Each window is recorded as a `duck` event: start, seenAt, how, minHeight, waited, result
    (ducked / waited / floated), practice, zone at start and end. The 💾 summary lists them too.
  - Possible false positive: leaning sideways lowers the shoulder midpoint a little. In a no-fail game a false
    "ducked" is harmless; real recordings will tell.

### v1.1 round 2 (second playtest: ~6 ft away, 🔧 open; real recording space-pilot-unlabelled-…-2026-11-16-06-17)
- ☑ 1. **Play closer: no knees needed.** Every move here reads the shoulders or wrists.
  - Core `ctx.body()` now also reports `shouldersIn` / `hipsIn` (additive `core:` commit).
  - Space Pilot's rule (🔧 Play distance): 0 = head + shoulders in view is enough (default), 1 = hips too,
    2 = knees (the classic zone).
  - "Step back" only when what the rule needs leaves the frame. The knees-based step-check nag is gone.
  - Checked against the recording (4,268 rows with a body): of the 1,427 "too-close" rows, 242 have shoulders + hips
    in view, 1,165 have head + shoulders (no hips) and also count as fine now, and only 20 would still say "step back".
    The 2,841 "good" rows stay good.
- ☑ 2. **Bigger for a 6 ft viewer.** Live sliders for star size (default 2.6 px, was a fixed 1.6), star brightness
  (0.65), HUD size (×1.15: column, cards, banners, cues, score) and object size (×1.25: bad guys, friends,
  bubbles, rocks, goo, boss).
- ☑ 3. **Rocks.**
  - Broken look: IcosahedronGeometry is non-indexed, so jittering each vertex separately tore the faces apart.
    The jitter is now by corner position, so the surface stays closed, with flat normals and front faces.
  - Stuck rock: added a lifetime guard. No rock can outlive its path (duck: 12 s + wait + 6 s; others 30 s). The
    guard finishes the duck window or frees the friend, removes the mesh and records `rockTimeout`. The full
    mission runs ended with 0 rocks left.
- ☑ 4. **Friend fly-in.** A rescued friend zips from where it was beamed across the screen into the Friends Aboard
  panel (sparkle trail + whoosh), lands with a pop, then waves and squeaks thanks.
- ☑ 5. **Slower ramp.** 🔧 Game pace (×0.7 default) scales every alien and rock speed. The rounds, where each
  adds ONE thing:
  1. a lonely friend in a bubble off to the side (lean + beam)
  2. a practice duck rock (duck)
  3. one bad guy carrying one friend
  4. same count + punch taught
  5. more bad guys
  6. same + swoops at the glass (jump taught)
  7. more
  8. same + spin taught
  9. more
  10. the slime round (wave)
  11. the full formation (airplane arms)

  Counts grow toward 🔧 Max formation size over 🔧 Ramp rounds (default 4: 1, 2, 3, 5, then 6–7). Then the boss.
  🔧 Mission length cap (150 s) jumps to the boss after the current round. The move tutor is folded into the rounds.
- ☑ 6. **Crab arm swap.**
  - One claw "powers down": low, closer, glowing, the only weak point. The other is raised behind a shield bubble
    and does the snap attacks.
  - Every 🔧 Crab arm-swap time (12 s), or when the low claw is half done, the low claw spins, sparks and powers
    back on, and the other drops. "⬅ LEFT CLAW!" / "RIGHT CLAW! ➡" + voice.
  - A claw breaks at 0 (its cage is freed). Both broken → the heart (charge + goo), then the defeat.
  - The crab sways near the middle with the low claw to one side, so he leans to it. If he doesn't hit it for a
    while, the low claw slides over to him (always finishable).
  - Boss bar = left claw · right claw · heart. Default health per weak point lowered 40 → 24.
- ☑ 7. **Slime round.** A goo-blaster spits 🔧 Slime splats (5) big goo balls over 🔧 Slime round length (25 s).
  The splats stay put during the round. The first time, a ghost 👋 waves over the splat with "WAVE to wipe!".
  Each wipe gives squeegee streaks, a squeak and +100. The round ends after 3 wipes or the time limit, with a big
  release: the goo-blaster is zapped and the leftover slime slides off.
- ☑ 8. **Pause (core).** ⏸ next to Back in every game; Escape always; Space only with test keys off. Frozen frame +
  "⏸ Paused / ▶ Play" overlay, music ducked, gesture events muted, `ctx.paused`, `game.onPause`.
  Tested by `scripts/test-pause.js`. The button overlaps the left edge of the score pill in Mega Roll and Space
  Pilot v1.0 (frozen releases; v1.1 moved its score right).
- ☑ 9. **🔧 sliders, grouped at the top:**
  - **Pace:** pace, ramp rounds, max formation, swoop every
  - **Look:** star size and brightness, HUD size, object size
  - **Slime round:** length, splats
  - **Duck:** dip depth (live into duck.js), wait time (default 9 s: the recording shows ~3.4 s reactions)
  - **Boss:** health, arm-swap time
  - **Play distance**

  v1.1 now saves its tuning under its own key (v1.0's saved tuning untouched).
- Open: the whole mission is now ~150 s of rounds + ~60–90 s of boss (with leaning). That's longer than the brief's
  60–90 s, so tune it with Game pace / Ramp rounds / Mission length cap.

## v1.0 sections
- ☑ §A Fantasy: first-person pilot, zap bad guys into cubes, tractor-beam friends home, comms screen.
- ☑ §B Playtest lessons: auto-fire (punch is a bonus), lean steering, close swoops + windshield boops, no gloves,
  celebration text in the top-right corner only, rescue collection, nothing gets hurt (pilots escape in pods),
  comms = tracking feedback, short mission + score card, silent tests / 🔧 / debug skips.
- ☑ §C Controls: lean steers + aims (crosshair leads the lean), lasers auto-fire with aim assist (magnet + radius),
  punch = cyan double blast (3 dmg, two targets), jump = hyperspace hop (1 s: FOV stretch, streaks, dodges),
  crouch = duck (camera drops; asteroid passes overhead), spin = barrel roll (§E), wave = wipers (motion in the
  lower view), run = thrusters (speed + streaks only; mega laser is v1.1).
- ☑ §D Cockpit: thin canopy edges + thin dashboard (speed, shields, RESCUED counter, radar, mission bar → 🦀).
  Comms screen top-left under Back: live face crop via `ctx.head()`, cyan holo + scanlines, "LIVE · CAPTAIN";
  body not seen → static + "CAN'T SEE YOU! Step back!" (+ voice line, every 10 s max); too close → "STEP BACK" strip.
  Swoopers come right up to the glass, wiggle and make faces; missed ones BOOP the windshield (pixel face squish,
  googly eyes, cracks, slide down, slime splat). No penalty.
- ☑ §E Barrel roll: starts on `turn`, rolls to upside down, slow-motion hold, `spin` commits the full roll
  (ROLL BLAST zaps everything close, ×2 points); a half turn with no spin rolls back. `spin` alone (debug S)
  starts a committed roll. Dizzy guard: 3 rolls in 20 s → 8 s calm (a gentle wobble instead + voice line).
- ☑ §F Good guys / bad guys: 3 voxel designs (snapper, squirm, zoomer; our own pixel art, 2 dance frames),
  formations of `formationSize`, bottom-row carriers hold bubble cages; zap carrier or cage (3 hits) → friend
  waves → tractor beam (auto when near the crosshair, or after 2.2 s) → RESCUED! Friends stranded on asteroids too.
  Lasers pass through friends (they giggle).
- ☑ §G Alien Passport: recipe system (6 shapes = home planets × 9 colors × 5 patterns × 7 hats × 3 sizes =
  5,670 friends, stable ids, funny names), rare/golden, NEW FRIEND! banner, cover + golden shelf + newest, a page
  per planet with grey silhouettes, saved per device, export/import (merge) in 🔧. Boss trophies = v1.2.
- ☑ §H Mission "Rescue Run": ~60 s of waves (one formation every 12 s, asteroid friends, 2 duck asteroids) then
  the boss. Score card: stars, friends rescued (big number + faces), zapped, new friends, boss stamp,
  🔁 Again / 🛂 Passport. (➡️ Next mission waits for the v1.1 galaxy map.)
- ☑ §I Boss #1 Captain Clank's CRAB-TANK: intro card (kid-cute wrestling style), 3 phases (left claw, right
  claw, then the power core behind an armor plate), glowing weak points auto-hit when lined up, telegraphed
  attacks (snap → lean away / hop / duck / roll; goo balls → zap them or wipe the slime; charge → jump or duck),
  hits only rattle the cockpit (shields are drama), flustered driver in a glass dome, defeat = giant cube shower,
  driver escapes in a pod ("I'll be back!"), every friend aboard is freed at once. ~35–45 s at default health.
- ☑ §J Sounds: existing slots only (laser, sonic, cubes, engine, shield, win, bonk, smash, splat, collect,
  powerup, tap) + synth tones. Music: generated `gen:zoom:7` (mission) and `gen:downhill:3` (boss) until the Sound
  Studio picks `07-space-pilot` / `07-space-pilot-boss` in music-picks.js (the game then uses the picks).
- ☑ §K Tuning/testing: 🔧 panel (steer sensitivity/deadzone/speed, aim assist, laser rate, alien speed, formation
  size, swoop distance, swoop frequency, punch + run sensitivity, wiper motion, boss health, mission length, comms
  camera toggle, presets, notes, 💾 export with summary, passport export/import, 🎮 Keyboard toggle, game buttons).
  Game keys (with `?debug` or test controls): 1 wave · 2 free all cages · 3 boss · 4 boss next phase · 5 end ·
  6 slime · 7 wipe · 8 duck asteroid · 9 passport. `debugSkip`: ⏭ next wave / boss phase, 🏁 boss.
- ☑ Release folder v1.0 + `cover.svg`; meta.json releases `[{ "version": "1.0", "title": "Rescue Run!" }]`.

## Not built yet (wait for playtests)
- ☐ [v1.2] (was v1.1) Mic "PEW!" sonic lasers (§L), comms hijacks, mega laser from thrusters, galaxy map + seeded missions,
  Fuel Run, Save the Planet, boss #2 ROBO-RHINO, ➡️ Next mission button.
- ☐ [v1.3] (was v1.2) Lost in the Nebula, Space Whale Escort, MECHA-OCTO, ROCKET ROOSTER, boss trophy shelf.
- ☐ [later] the rest of the parking lot (§M), bosses 5–8.

## Decisions
- **Core helpers extracted** (separate `core:` commit): `src/core/rng.js` (seeded streams) and
  `src/core/collection.js` (saved found-map with merging export/import). Mega Roll v1.0 keeps its frozen copies.
  The passport recipes stay game-local (different catalog), following Mega Roll's pattern.
- **No friend is ever lost:** a carrier that flies away keeps its friend in the boss's cargo hold; the boss's
  defeat frees them all. Stars (1–3) count the friends freed *during the waves* (offered vs freed), always ≥ 1.
- Cages take 3 hits and are only targetable once their carrier has arrived (otherwise auto-fire freed everyone
  before the formation was even on screen). Bad guys are preferred over cages by the aim assist.
- Boss health = laser hits per weak point (default 40 ≈ 7 s of locked zapping); the weak point is guarded while a
  snap or charge winds up, so the rhythm is "dodge, then zap". The boss drifts to line its weak point up with the
  pilot when he hasn't hit it for 3 s (forgiving).
- Wipers read `ctx.motion.at(0.5, 0.75, 0.35)` (the brief's "motion in the lower screen"). Slime also fades by
  itself after ~14 s so it never blocks the view for long. Key 7 wipes in tests.
- Comms with `?fakecam` alone (no test controls) counts as "seen"; `L` (leave) / `Z` (too close) show the states.
- Banners are drawn right-aligned in the top-right corner (left of the 🛂 passport icon), never mid-screen. Move
  cues (DUCK / JUMP / LEAN) sit low in the middle above the dashboard. The boss intro card is the one mid-screen
  overlay (while the boss flies in; nothing to hit yet).

## Open questions (for playtests)
- v1.1: is the left column too much on a phone? Does the crab's babble read as funny? Does he find the moves from
  the pictograms? Does waving over a splat feel connected (motion threshold `wipeAt`)? Does he spin on purpose now?
- Does lean + auto-fire feel like flying and fighting, or too automatic? Is the aim assist too strong?
- Are boops (one swoop every ~2.5 s) too frequent or too rare? Is the squished face too big on a phone?
- Does he wave to wipe? (motion threshold `wipeAt` needs a real check; may also trigger from leaning.)
- Boss length/difficulty at default health 40; is the snap's "lean away" readable for a 4-year-old?
- Comms face crop from `ctx.head()` is untested on a real camera in this build (fakecam only).
- Fire tablet (low tier) not checked yet: the game drops formation size to 6, DPR 1, fewer stars/debris.

## Sound Studio wishlist (new slots, not added here)
`capture` (tractor-beam boop-boop), `alienchirp` (swoop/boop), `bossintro`, `cockpitalarm` (attack wind-up),
plus a heroic-but-cute mission track (`07-space-pilot`) and a boss track (`07-space-pilot-boss`).
