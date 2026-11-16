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
