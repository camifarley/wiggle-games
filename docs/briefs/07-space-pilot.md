# 07 · Space Pilot  🚀

Status: **brief, not built**. Depends on game 06 (Smash Run) landing first: it reuses `run.js`, `punch.js` and
the three.js setup. Parent direction: 3D space flight that feels like **sitting in a cockpit** (not steering a
tiny ship from outside), a **live feed of the kid's face in a corner like a high-tech comms display**, and
aliens in the spirit of classic pixel-art arcade invaders, in 3D. **Cool to look at, but fun first.**

> Originality note: the aliens are **our own designs**, blocky voxel creatures built from little cubes in an
> 8-bit spirit. Don't copy any existing game's sprites, names or sounds.

## 1. The fantasy
**You ARE the space pilot.** Your arms are the wings, your punches fire the lasers, and mission control can
see you on the comms screen.

## 2. Core verbs: body → effect (each one mapped to something a kid would do anyway)
| Body move | In the cockpit | Sound | Voice |
|---|---|---|---|
| **Arms out like wings, tilt** | The ship banks and steers that way (the whole view tilts, like a real plane) | engine hum swells | "Banking left!" |
| *(arms down)* **lean** | Same steering, by leaning the body, so steering always works | | |
| **Punch** | **Cyan** twin lasers fire from the bottom corners of the cockpit and **home in** on the nearest alien | pew pew | "Direct hit!" |
| **Shout "PEW!"** (any loud shout) | **Hot-pink SONIC lasers**: a different color, wider beams with ripple rings around them and a wobbly "sound wave" trail. They home in too | a warbly pew | "Sonic blast!" |
| **Run in place** | **Thrusters**: speed up, star streaks, and the mega-laser charge meter fills | rumble | "Full thrusters!" |
| **Jump** | **HYPERSPACE BOOST**: the stars stretch into lines, whoosh, and you pop out in a new area | warp | "Hyperspace!" |
| **Spin** | **Barrel roll** (the whole view rolls 360°) that dodges everything and blasts aliens near you. **Slow and long enough to enjoy** (see §10) | | "Barrel roll!" |
| **Crouch** | Dive under an asteroid or a big alien | | "Duck!" |
| **Wave hands** | **Windshield wipers**: wipe off the alien slime splatted on the glass | squeak squeak | "Wipers!" |

## 3. The cockpit (what makes it feel real)
- First-person view through a **canopy frame**: struts at the edges and a slightly curved glass feel, with subtle
  reflections and scratches.
- A **dashboard** across the bottom: glowing gauges (speed, mega-laser charge, shield bubbles, score), a round
  **radar** showing aliens as blips, and blinking buttons that react when things happen.
- **Two control-stick gloves** at the bottom that move with his real hands (from pose wrists), so he sees
  himself flying.
- **Comms display** (top corner): his **live camera feed, cropped and zoomed to his face** (crop from
  `ctx.head()`, which works from across the room), framed as a hologram: cyan tint, scanlines, a little static
  flicker, a "LIVE" dot and a label like "CAPTAIN". Sometimes it **gets hijacked**: static, then a goofy alien
  face "transmitting" a silly message ("Bleep! You can't catch us!"), then back to him. The face feed is
  mirrored and processed on the device only (never recorded).
- **Screen shake, hit flashes and alarm lights** in the cockpit when things bump you.

## 4. Aliens & things in space
- **Blocky voxel aliens** (our own designs): squat crab-like ones, tall squid-like ones, round saucer ones. They
  come in **formations** that wobble and dance in step, all built from little colored cubes so they **burst into
  cubes** when hit (very satisfying in 3D).
- **Asteroids:** big ones split into smaller ones (shared fun with Smash Run).
- **Collectibles:** space gems, stars, glowing rings to fly through (steering practice).
- **Friendly things to discover:** a space whale, a cat astronaut floating by (wave hi: it waves back).

## 5. Signature moment
Running in place charges the **MEGA LASER** ("CHARGE 100%!"), a whole formation of aliens dances ahead, he
punches, and a giant beam sweeps the screen: every alien bursts into cubes. **"WAVE CLEARED! 24 ALIENS!"**

## 6. Build-up → release
- **Mega laser:** thrusters (running) charge it; a full charge plus a punch fires a screen-clearing beam.
- **Formations:** the longer a formation lives, the bigger it grows (more aliens join), so waiting pays off with a
  bigger mega-laser clear (the Bubble Pop strategy he invented).

## 7. Forgiving by design (same rules as Smash Run)
- **Homing lasers and auto-lock:** any punch hits the nearest alien. No aiming required.
- Steering only matters for **bonus** things (rings, gems), never for "surviving".
- **Nothing ends the game.** Getting hit = cockpit shake, alarm lights, alien slime splatting the windshield
  (then wipers!). Shields "recharge" by themselves; they're just for drama.

## 8. Energy pacing: crazy ↔ sneaky
**Crazy:** dogfight waves (punch, thrusters, barrel rolls).

**Sneaky: "Stealth mode"** (about every 90 s). The lights dim, the cockpit glows red, and a **sleeping alien mothership** floats
ahead. Lean slowly to glide past its sensor beams. Moving too fast → "INTRUDER ALERT!", silly sirens, and a flood of
aliens to blast (fun either way). Glide past quietly → a treasure vault of gems opens.

## 9. Session arc (sectors)
1. **Sector 1, Training:** slow aliens, the voice teaches one move at a time (punch, then wings, then thrusters).
2. **Sector 2, Asteroid Belt:** asteroids split; gems hide inside.
3. **Sector 3, Alien Armada:** bigger dancing formations, mega-laser time.
4. **Sector 4, Nebula:** stealth round, colorful clouds, the space whale.
5. **Finale, the MOTHERSHIP:** a giant voxel ship. Each hit knocks off chunks of cubes (counter 1…10), then it bursts
   into thousands of cubes, with a confetti storm and "MISSION COMPLETE!". Free flight continues.

## 10. Tech
**needs:** `['pose', 'motion']`. The comms feed uses the camera video plus `ctx.head()` for the crop (no face model
needed). Reuses `run.js` and `punch.js` (from Smash Run) and the shoulder-based jump/crouch/spin.

**New core detector** (pure module + simulated scenarios in `npm test` + a Move Lab station "Airplane arms" ✈️):
- `steer.js`: a steering value from −1 to 1. With arms out (both wrists out wide near shoulder height) it uses the
  wrist-to-wrist line's tilt; otherwise the body lean (shoulder midpoint x vs a learned center, plus shoulder-line
  tilt). Smoothed, with a deadzone so standing naturally flies straight.

**3D:** reuse the three.js version and helpers from Smash Run. Instanced cubes for alien bursts. Target Mac and
iPhone; the Fire tablet gets a separate pass later.

**Tuning panel (🔧):** same as Smash Run section 10b: live sliders (alien speed, formation size, steering
sensitivity/deadzone, punch sensitivity, charge rate, hit/slime frequency, comms hijack frequency), presets, notes
and 💾 export with a numbers-only recording.

**Shout to fire (parent approved):** either input fires, and they look different so he can tell which one he used:
- **Punch** → cyan twin lasers. **Shout** → hot-pink sonic lasers (wider, ripple rings, wobbly trail, warbly sound).
- Core addition `src/core/mic.js`: microphone **loudness only** (no speech recognition, nothing recorded or sent). A
  shout = loudness jumps well above the room's background level (learned), with a short cooldown. The game's own
  sounds must not trigger it: ignore the mic briefly after loud game sounds, or compare against the game's output level.
  Permission is requested from a tap (iOS rule), with a friendly cockpit prompt ("Turn on your space radio?").
  If permission is denied, punch-only works fine. Add to the tuning panel: shout sensitivity plus a live loudness meter.
  Add a Move Lab station "Shout" 📢 for real recordings (loudness numbers only).

**Barrel roll timing:** a real spin takes him about **2 seconds**, and the spin detector only fires as the spin
*finishes*. So: **start rolling on the first `turn` event** (halfway around), then finish the full roll on `spin`.
The roll animation lasts about **2.5 s** with an ease-in-out, a short slow-motion moment at upside-down, star streaks,
and a "BARREL ROLL!" banner, so he clearly sees it after he stops spinning. If only a half turn happens, the view
gently rolls back.

## 11. Safety & setup
Arms-out steering and punching need room. Same placement as the other body games: 2–2.5 m away, knees in view.
The "Step back so I can see your knees!" prompt applies.

## 12. Playtest questions
- Does arms-out steering feel natural, or does he prefer leaning?
- Does he notice and love the comms feed of himself? Do the alien hijacks get laughs?
- Is barrel-roll-by-spinning discoverable? Does he spin on purpose?
- Cockpit cool factor vs readability: can he tell what's happening at a glance?
