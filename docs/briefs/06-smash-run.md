# 06 · Smash Run  🪨

Status: **v1.0 built** (`src/games/06-smash-run/v1.0/`; core `run.js` + `punch.js`; Move Lab stations 10 and 11). Not yet tested on a real body. Kid-idea origin: "boulders come toward me, I smash them, and they explode into
more boulders. Smashing pumpkins could be fun too." Parent direction: **3D**; running makes you move forward;
smashing must be **forgiving** while you're actively playing; if you just stop, a boulder can crash into
the screen in a funny way.

## 1. The fantasy
**You're a super-strong runner.** You charge down a canyon, and anything that rolls at you explodes on
your fists. Stop running and you get bonked (hilariously).

## 2. Core verbs: body → effect
| Body move | In the 3D world | Sound | Voice (sometimes) |
|---|---|---|---|
| **Run in place** | The world rushes toward you. Faster running = faster speed, with a speed-lines effect | footsteps + wind | "Run run run!" |
| **Punch / swing arms** | Big cartoon **power gloves** (driven by his real wrists) punch forward. Anything in the smash zone explodes | whoosh + CRUNCH | "SMASH!" |
| **Running hard** (power mode) | A glowing **power aura**: anything that reaches you explodes automatically. Running alone is enough to smash | crackle | "Power run!" |
| **Jump** | Ground-pound shockwave: smashes everything close | BOOM | "Ground pound!" |
| **Stop and stand still** | A boulder rolls up… and **BONKS into the screen**: cracked-glass effect, boulder squished against the "camera", googly eyes, slides down slowly | bonk + slide whistle | Boulder: "Oops! Sorry!" |
| **Crouch** | Duck: a boulder bounces right over your head (funny near-miss) | whoosh | "Phew!" |

## 3. Signature moment
He's sprinting in place, gloves pumping. A **giant boulder** rolls up, he punches, and it explodes into **three
medium boulders**, which he smashes into **nine small ones**, which he smashes into confetti and gems:
**"CHAIN SMASH ×13!"**

## 4. Build-up → release
- **Split smashing** (his idea): big boulders split into smaller boulders that keep rolling at you. One big
  rock = a chain of smashes, and the chain counter climbs: ×2, ×5, ×13.
- **Speed meter:** keep running to fill it. Full meter = **POWER MODE** for 10 s (glowing aura, everything
  explodes on contact, bigger explosions, a "HYPER" voice line).

## 5. Forgiving by design (the key requirement)
Timing and aiming should never be the challenge. The challenge is *keep moving*.
- **Huge smash zone:** a boulder can be smashed during the whole last ~1.5 s before it reaches you, not one
  exact moment.
- **Any big move counts:** a punch with either hand, a swing, a kick, a jump, or just running hard (power aura).
  There's no left/right aiming in v1.0: whatever is closest in front of you gets smashed.
- **Auto-aim:** the punch effect flies to the nearest smashable thing.
- **Only one way to get bonked:** standing still. That's a choice he makes on purpose, and it's funny, so
  it's never a punishment (no lives, no score loss).
- Boulders roll **slower** when he's running slowly, so tired legs still win.

## 6. Energy pacing: crazy ↔ sneaky
**Crazy (default):** run, smash, chain.

**Sneaky round: "Sleeping Rock Troll"** (about every 90 s): the canyon gets dark and a giant snoozing rock troll
blocks the path, with gems scattered around it.
- **Walk in place slowly and quietly** to tiptoe past and collect gems (run detector reports a slow walk).
- **Run too fast** → the troll wakes up, sneezes out a pile of boulders (more smashing, which is fun), and dozes off again.
- After a few tries he gets past anyway (no fail).

## 7. Session arc (worlds)
Each world lasts about 60–75 s, with a new smashable thing every world (variety is the reward):
1. **Rocky Canyon:** boulders (split into smaller boulders), sometimes a golden boulder (worth ×5).
2. **Pumpkin Patch:** pumpkins (orange goo and flying seeds), scarecrows (straw explosion).
3. **Snowy Mountain:** snowballs that grow as they roll, snowmen (carrot nose flies off), ice blocks.
4. **Candy Land:** piñatas (candy shower), gumballs, giant cupcakes.
5. **Finale: MEGA BOULDER.** Fills the screen. Each smash chips it (a crack appears, the counter goes 1…10). On 10 it
   explodes into every smashable from every world plus a confetti storm. Then free running continues.

## 8. Absence & surprise
- **Leave the frame:** the world slows to a stop and boulders line up politely and wait ("Where'd you go?").
- **Spin:** a tornado smash clears everything on screen.
- **Peekaboo (hands over face):** boulders tiptoe closer… "BOO!" and they all scatter.

## 9. Numbers & progress
Smash counter (big), chain multiplier, distance in meters (he reads numbers), world number, and gems.
Thousands of points within a couple of minutes.

## 10. Tech
**needs: `['pose', 'motion']`** (body tracking only: he'll be 2–3 m away and moving a lot).

**3D:** three.js (pinned version, npm, loaded only by this game as a lazy chunk). Low-poly, flat-shaded, bright
colors, fog to hide the far end of the world. First-person camera on a path that auto-steers (no steering in v1.0).
Instanced meshes for debris, with simple caps by perf tier. **Target Mac and iPhone for now.** The Fire tablet gets a
dedicated pass later across all games, so don't spend effort on it beyond not crashing. The camera feed is a
small mirrored picture-in-picture in a corner (or hidden), not the background.

**New core detectors** (pure modules + simulated scenarios in `npm test`, verified in **Move Lab first** with
real recordings, like jump/squat/spin were):
1. **`run.js`: run-in-place intensity** 0..1 (and `walking`/`running` states) from the shoulder-line bob
   rhythm (about 1.5–3.5 steps/s) plus knee alternation when knees are visible plus overall motion. It must not count
   jumping or arm waving as running.
2. **`punch.js`: smash moves** from wrist speed relative to shoulder width (a fast push or swing of either hand),
   with a generous threshold and a cooldown; emits `punch` with the hand. A jump also counts as a smash in the game.
3. **Move Lab stations** "Run in place" 🏃 and "Smash" 👊 (Phase 2 stations 14 and new), with overlay graphs,
   so the parent can record real runs and punches before the game depends on them.
4. `ctx.body().zone` prompts: "Step back so I can see your knees!" (needed for running detection).

**Testing:** `?fakecam&debug` keys for run (hold R = run, tap = walk), punch (X), jump (J). Every world reachable
via debug keys.

## 10b. Parent tuning panel (🔧): find the settings that feel best
The parent will tune this game by playing it with the kid, so tuning is a first-class feature, not a debug afterthought.
- A small visible **🔧** button (like Move Lab's) opens a panel over the game. The game keeps running underneath.
- **Live sliders** (changes apply instantly) for every feel setting, with a short plain-English label each:
  boulder speed, spawn rate, smash window (seconds before impact), punch sensitivity, run sensitivity
  (walk vs run thresholds), power-aura threshold, speed-meter fill rate, split count (how many pieces a big
  boulder breaks into), world length, explosion size / debris amount, and bonk frequency when standing still.
- **Live readouts** next to them: run intensity, punches detected, current speed, smash window state, plus a
  small graph of run intensity and punch events over the last 5 s with threshold lines (like Move Lab's overlay).
- **Presets:** "Default", "Super easy", "Wild". Settings are saved on this device (localStorage) and a **Reset**
  button restores the defaults.
- **Notes box** (free text) for what felt good or bad.
- **💾 Export** downloads one JSON file containing the current settings, the notes, a summary of the session (smashes,
  bonks, chain records, time per world, how often running/punching were detected), and the **recording**
  (the core `recorder.js`: numbers only, never video, including run/punch signals and events). It should work
  like Move Lab's 💾 so the file can go straight into `fixtures.local/`.
- A `?debug`-free route to it: the 🔧 button is always visible (small, top-right) so it works on the live site.

## 11. Safety & setup
- Running in place and punching need **clear space with arms out** (no TV edges or furniture within reach). The device goes
  2–2.5 m away, at about chest height, stable.
- **Rest breaks:** after about 90 s of hard running, the troll round (a calm walk) comes automatically.
- Punching is at the air, toward the screen, never at people. The voice says "Punch the air!" the first time.

## 12. Playtest questions
- Is running detected reliably as walking vs running? Does arm-waving trick it?
- Does he discover punching, or just run and let the aura do it? (Both are fine.)
- Does he stop on purpose to get bonked? (If yes, make the bonk even sillier, with more variations.)
- Which world/smashable gets the biggest reaction? Is 3D worth it on the Fire tablet?
