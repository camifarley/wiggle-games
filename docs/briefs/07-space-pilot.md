# 07 · Space Pilot  🚀  (big brief: build it in releases)

Status: **brief v2, not built.** Revised after a day of real playtests. This is a *large* brief on purpose:
**v1.0 builds only §A–§J.** Everything marked **[v1.2]**, **[v1.3]**, **[later]** waits for playtest feedback.

> **Release plan shifted (after the v1.0 playtest):** the playtest feedback below IS **v1.1**, so the sections
> first planned for v1.1 moved to **[v1.2]** and the old v1.2 ones to **[v1.3]**.

### v1.1 "Dizzy aliens!" (playtest feedback, a grown-up tester at ~2 m on a Mac)
1. **Calmer background:** stars and planets far away, small, dim and slow; the play layer is the brightest thing.
2. **Passport layout:** the grid is centred under the title on every page and screen size; no duplicate label.
3. **Crab tantrum:** claws out and shaking at the pilot, stomping, steam puffs. Funny, not scary.
4. **Bad guy "on the line":** a second small panel under the comms screen shows the current bad guy (the crab
   during the boss) talking **gibberish** (mouth flapping, squiggly bubble, "blah blah BLAH… BAH!", synthesized
   babble through `ctx.sfx`, never TTS); the "BAH!" lands with a comic bonk. Taunts, indignant when hit, splutters when beaten.
5. **Boss slime:** big, slow, readable goo that really reaches the glass: a juicy SPLAT; wave over it to wipe
   (squelch + points), or it slides off by itself after ~3 s. Never damage.
6. **Friends aboard:** a small panel with the 3 latest rescues; each pops in, waves and squeaks a gibberish
   thank-you. Self-view, bad-guy view and friends panel form a small left column.
7. **Teach the moves, fix the spin:** no camera/screen rotation on spin (it made a tester queasy): the BAD GUYS get
   dizzy instead (spinning, stars round their heads, easier to catch). Moves are taught one at a time (voice line +
   big pictogram next to the comms screen), and an untried move is re-prompted after a while.
Builders: read "Working from a big brief" in `CLAUDE.md` first.

> **Originality:** blocky voxel aliens in an 8-bit *spirit*, and robot-animal bosses in the *spirit* of classic
> action-game boss themes. **All our own designs, names and art.** Don't copy any existing game's sprites,
> characters, names, music or sounds.

---
## A. The fantasy
**You ARE the space pilot.** Bad-guy aliens have captured the friendly aliens of the galaxy. You fly out, zap
the bad guys into a shower of cubes, and **tractor-beam the good guys home**. Mission control can see you on
the comms screen.

## B. Lessons from playtests this design follows
| Lesson (real data) | What it means here |
|---|---|
| Punch is our least reliable detector (3 real punches read as 9 before the fix) | **Lasers auto-fire.** Steering IS aiming. Punch and shout are **bonus shots**, never required |
| Holding a pose tires a 4-year-old and fails | **Lean** is the main steering; arms-out is an optional extra |
| Boulders felt "forever away" until they came close and fast | Aliens **swoop right up to the glass**; anything he misses **boops the windshield** (the bonk joke) |
| Gloves and pop-up words covered the action in Smash Run | **No control-stick gloves.** Thin dashboard, small comms screen, celebration text in the **top corners** only |
| He loves collecting (Mega Roll stickers) and things never get hurt | Good guys are **rescued** into an **Alien Passport** collection. Bad guys explode into cubes and the pilots **pop out in escape pods** shaking a tiny fist |
| He invents build-up-then-release strategies (Bubble Pop) | Bad-guy formations **grow** if left, and the mega laser charges from thrusters |
| He needs to know if the camera sees him (Distance Dance) | The **comms screen doubles as tracking feedback** |
| Short rounds with a score work (Mega Roll, Bubble Pop) | **Missions of 60–90 s**, ending in a **score card** |
| Agents' tests were noisy | Silent `?fakecam`, `?keys`, debug skips, 🔧 panel from day one |

## C. Core controls (body → effect)
| Body | Effect | Notes |
|---|---|---|
| **Lean** left/right (`gestures.steer`) | Ship banks and steers; the crosshair follows | Main control. Arms-out wrist tilt also steers if he does it |
| *(nothing)* | **Lasers auto-fire** at whatever is under the crosshair; generous aim assist | The core loop works with lean alone |
| **Run in place** (`gestures.run`) | **Thrusters:** faster, star streaks, charges the MEGA LASER **[v1.2]** | In v1.0: just speed and streaks |
| **Punch** (`punch` event) | **Double blast:** cyan twin lasers, extra damage | Bonus. Behind a sensitivity slider |
| **Jump** | **HYPERSPACE hop:** stars stretch, a whoosh, dodges everything for 1 s | |
| **Crouch** | **Duck:** a big alien or asteroid passes just overhead | |
| **Spin** | **BARREL ROLL** (§E): dodges, blasts everything near | Starts on `turn`, completes on `spin`. **v1.1: no screen roll; the bad guys get dizzy instead** |
| **Wave hands** | **Windshield wipers** wipe off alien slime | Motion in the lower screen |
| **Shout "PEW!"** **[v1.2]** | **Hot-pink SONIC lasers** (wider, ripple rings, warbly) | Mic loudness only; see §L |

## D. The cockpit and comms screen
- First-person view through a **canopy frame at the very edges** and a **thin dashboard strip** at the bottom:
  speed, shields (drama only), rescued counter, radar dot map. **No gloves.**
- **Comms screen** (small, top-left, not over the action): his live camera **cropped to his face via
  `ctx.head()`**, holo-styled (cyan tint, scanlines, "LIVE ● CAPTAIN").
  - **Tracking feedback:** when the body isn't seen, the holo fizzes and mission control says **"Captain, I can't
    see you! Step back!"** (use `ctx.body().zone`).
  - **Hijacks [v1.2]:** static, then a goofy bad-guy alien face ("Bleep! You'll never catch us!"), then back.
- Aliens **swoop close**: they fill a good part of the view, wiggle and make faces. Missed bad guys **boop the
  windshield** (cracked-glass graphic, googly eyes, slide down, slime splat). No penalty.

## E. Barrel roll (he spins in real life)
- A real spin takes him ~2 s and `spin` fires as it finishes, so **start rolling on the first `turn`** event, then
  complete on `spin`. **About 2.5 s** total, ease-in-out, a brief **slow-motion moment upside down**, star streaks,
  and a "BARREL ROLL!" banner (top corner). A half turn rolls gently back. Dizzy guard: 3 spins in 20 s brings a calm moment.

## F. Good guys vs bad guys
- **Bad guys:** blocky **voxel aliens** (crab-ish, squid-ish, saucer-ish; our designs) in **dancing formations**.
  Zapped → **burst into a shower of colored cubes** (instanced), and the tiny pilot pops out in an escape pod.
- **Good guys:** round, cute, big-eyed aliens (different silhouette and colors from bad guys, clearly "friendly"),
  usually **trapped in bubble cages** carried by bad guys, or stranded on asteroids.
  - Free a cage by zapping its carrier or the cage → the good guy waves → a **tractor beam** (blue cone from
  the ship) pulls it aboard with a happy "boop-boop!" → **"RESCUED!"** plus a passport stamp.
  - Tractor beam is automatic when a freed good guy is near the crosshair (lean to line up), or just drifts in.
- **Never harm good guys:** lasers pass through them harmlessly (they giggle).

## G. Alien Passport (collection)
- Good-guy species from a **recipe system** (reuse Mega Roll's pattern: shape × color × pattern × hat/antenna ×
  size, stable ids, funny names like "Polka-dot Bubble Blob with a Bow"). Hundreds of species; rare sparkly;
  golden. Pages by home planet.
- **"NEW FRIEND!"** banner the first time; the book fills in grey silhouettes. Saved per device; export/import in 🔧.
- Boss trophies **[v1.3]**: a shelf of defeated boss badges.

## H. Missions (60–90 s each, a score card at the end)
v1.0 has **one mission type** done well, with a boss finale:

**v1.0 · "Rescue Run"** (Sector 1): fly through waves of bad-guy formations carrying caged good guys; zap, free,
beam aboard. Ends with the **first boss** (§I). Score card at the end.

**Mission ideas for later releases** (the rescue theme stays central; each adds one twist):
1. **Fuel Run [v1.2]:** a friendly ship is stranded out of fuel. Catch glowing fuel orbs (steer through them), then
   fly alongside to pump it in (a fuel gauge fills); the ship zooms off, honks a thank-you, and drops friends.
2. **Save the Planet [v1.2]:** bad guys are covering a smiling little planet in goo blocks. Zap the blocks off;
   the planet's face appears more and more, flowers bloom, its moon dances. Rescues pop out of the craters.
3. **Lost in the Nebula** (sneaky) **[v1.3]:** good guys are hiding in a foggy nebula and only peek out if he's
   **quiet and moves slowly** (motion low); sudden moves make them hide (giggles). The calm round.
4. **Space Whale Escort [v1.3]:** guide a huge friendly whale through a bad-guy zone; zap anything heading for it.
   Baby whales follow.
5. **Comet Herding [later]:** steer to nudge baby comets back to their mom.
6. **Moon Base Delivery [later]:** carry rescued friends home to a moon base and land (crouch to land!).

**Galaxy map [v1.2]:** a mission-select screen of planets with **big numbers** (1, 2, 3…) and icons; stars
earned per mission; the next planet unlocks. Missions are **seeded** (like Mega Roll's mountains), so a
replay is the same mission.

**Score card (every mission):**
- **Good guys rescued:** big number plus faces, the headline
- **Bad guys zapped**
- **Boss defeated:** stamp
- **New friends** (passport)
- **Stars:** 1–3 based on rescues (always at least 1)
- Buttons: **🔁 Again**, **➡️ Next mission**, **📖 Passport**

## I. Bosses: alien pilots in mega-robots, themed like robot animals
Each boss is a **giant robot-animal mech driven by a little bad-guy alien** (visible in a glass cockpit dome, making
faces). Bosses are **telegraphed and forgiving**:
- **Weak points glow** and get hit automatically when he leans to line them up.
- Simple attack patterns announced by sound and wind-up animation, dodged by lean, jump (hyperspace hop), crouch
  or barrel roll. **Getting hit only rattles the cockpit**; nothing ends the fight.
- **3 phases:** each phase the mech loses a chunk of armor (cubes fly), and the driver gets more flustered.
- **Defeat:** the mech wobbles and bursts into a giant cube shower, the driver pops out in an escape pod
  ("I'll be back!"), and **every good guy the boss was holding is freed at once**: a big rescue moment.
- ~45–60 s, with a **boss intro card** (name plus a picture, like a wrestling intro, done kid-cute).

**Boss roster (our designs; v1.0 builds #1 only):**
| # | Boss | Robot animal | Gimmick | Weak point |
|---|---|---|---|---|
| 1 | **Captain Clank's CRAB-TANK** | robot crab | snaps giant pincers, scuttles side to side; each claw holds a cage | the glowing claws (free the cages!) |
| 2 | **ROBO-RHINO** [v1.2] | robot rhino ship | revs up and **charges** (lean or hop to dodge) | the horn, then the engine |
| 3 | **MECHA-OCTO** [v1.3] | robot octopus | 8 arms, each holding a caged friend; ink-cloud screen splats (wipers!) | each arm's hand |
| 4 | **ROCKET ROOSTER** [v1.3] | robot rooster | lays egg-bombs; zapped eggs **hatch good guys** | the comb antenna |
| 5 | **SHARK-SUB** [later] | robot shark | circles and lunges, chomp-chomp | teeth, then the fin |
| 6 | **GORILLA-MECH** [later] | robot gorilla | throws asteroids; punch them back for a bonus | chest gauge |
| 7 | **THUNDER-BEE HIVE** [later] | robot bee hive | spits drone swarms | the queen core |
| 8 | **SNAIL FORTRESS** [later] | robot snail | slow, shielded shell; a barrel roll bounces shots back | the eye-stalks |

## J. Sounds & music
- Pick through the **Sound Studio session** (it owns `src/core/audio.js`, `music.js`, `sound-picks.js`): new
  slots such as `capture` (tractor-beam boop), `alienchirp`, `bossintro`, `cockpitalarm`, plus a heroic-but-cute
  mission track and a boss track. Until then, reuse existing slots (`laser`, `sonic`, `cubes`, `engine`, `shield`, `win`).
- Silent `?fakecam` and `?keys` tests as everywhere.

## K. Tuning, testing, tooling (v1.0)
- **🔧 panel:** steering sensitivity/deadzone, aim-assist strength, alien speed, formation size, how close aliens
  swoop, boop frequency, punch sensitivity, boss health, mission length, notes, and 💾 export (settings, notes, summary:
  rescued/zapped/boops/barrel rolls/steer stats, plus the numbers-only recording).
- **Test keys** via core test controls (← → lean, Space, ↓, S spin, Enter punch, `[ ]` time scale), plus game keys:
  spawn wave, free all cages, jump to boss, boss next phase, end mission. Implement `game.debugSkip`.
- **Releases:** `src/games/07-space-pilot/v1.0/` + `cover.svg`; `meta.json` releases
  `[{ "version": "1.0", "title": "Rescue Run!" }]`.

## L. Microphone "PEW!" [v1.2]
New core module (`src/core/mic.js`): loudness only; no speech recognition, nothing recorded or sent. Learns the
room's background level; a shout = a sharp jump above it; cooldown. **Ignores the game's own sounds** (duck
or compare with the output level). Permission is asked from a tap ("Turn on your space radio?"); if denied, everything
still works. Off by default with a 🔧 toggle and sensitivity slider. Move Lab station "Shout" 📢 for real
recordings. Coordinate audio-side changes with the Sound Studio session.

## M. Later ideas parking lot
Mega laser charged by thrusters; formations that grow if left alone; galaxy map with stars; seeded missions;
boss trophy shelf; two-player (parent + kid) co-pilot; the space cat astronaut who waves back; a calm
"stargazing" bedtime mission.

## N. Safety & setup
Same as other body games: 2–2.5 m, knees in view, clear space for leaning and spinning. Missions are short with a
natural rest at each score card.

## O. Playtest questions (after v1.0)
- Does auto-fire + lean feel like *flying and fighting*, or too automatic? Should punch matter more?
- Does he notice and love rescuing (the beam, the passport)? Is the boss fun or scary? Too long?
- Barrel roll: does he spin on purpose to trigger it?
- Is the comms screen of himself a highlight? Does "Captain, I can't see you!" help him stand in the right spot?
