# 04 · Bounc'a Bugs  🐞

Status: **brief, not built**. Kid-idea origin: "a bag with lots of bugs in it; jump to make it explode
and the bugs go everywhere. Crouch down low (still looking at the screen) and the bugs crawl on your head."

## 1. The fantasy
**You're a giant bug wrangler.** Your jumps shake the ground hard enough to burst a bug bag, and your head
is the best bug playground in the world.

## 2. Core verbs: body → effect
| Body move | On screen | Sound | Voice (sometimes) |
|---|---|---|---|
| **Jump** (bag full) | The bag bulges bigger with each jump, bugs poke out, a big jump-counter number | rising squeak, rustle | "Jump! Again!" "One more!" |
| **Jump** (bag at max) | **KA-BOOM.** The bag bursts and bugs fly everywhere, bouncing off the walls | boom + buzz swarm | "BUGS EVERYWHERE!" |
| **Crouch low** | Bugs everywhere stop, turn, and **scurry toward him**, then climb onto his head and stack into a growing "bug hat" | skitter clicks, tickle giggles | "They're climbing on you!" "Tickle tickle!" |
| **Stand back up** | The bug hat rides along on his real head (anchored to face tracking) | happy chirps | "Bug hat! 12 bugs!" |
| **Jump with a bug hat** | **Bounc'a bugs!** Every bug on his head pops off into the air, flips, and bounces around. Points × hat size | boing chorus | "Bounc'a BUGS!" |
| **Tilt / wiggle head** | Hat bugs wobble; a few tumble off and giggle | squeaks | "Whoa, hold on!" |
| **Hide face** (peekaboo) | Bugs dive back toward the empty bag and hide; antennae peek out | tiptoe | "Where did he go?" → "BOO!" bugs jump |
| **Spin** (already detected in the core) | Bugs get dizzy spiral eyes and wobble around | slide-whistle | "Dizzy bugs!" |
| **Leave the frame** | Bugs throw a little bug party (dance in a circle) | tiny music | Returns: "He's back! Hide!" |

**Visual style:** cartoon bugs, round and cute, with **googly eyes**, matching the Bouncy Boom balls so the games feel
like one family. Never realistic or creepy: the bugs should look like they're having the best day ever.

## 3. Signature moment
He crouches. Dozens of tiny googly-eyed bugs race across the screen and pile onto his head into a wobbling bug tower.
He stands up, sees himself wearing it, and **JUMPS**. Every bug launches into the air at once: **"BOUNC'A BUGS! 34 × 2!"**

## 4. Build-up → release (two layers)
This builds on what he invented in Bubble Pop (build up, then release) and what Bouncy Boom tests:
1. **The bag:** each jump pumps it bigger, with a huge on-screen jump counter (**3… 4… 5!**). The first bag pops after
   **3 jumps** (instant gratification). Later bags need 5, then 7, and hold more bugs.
2. **The bug hat:** the longer he crouches, the more bugs climb on and the taller the hat grows. The jump that launches
   them scores **hat size × multiplier** (×2 at 10, ×3 at 25, ×5 at 40), the same thresholds-and-progress-bar idea as Bouncy Boom.

## 5. Energy pacing: crazy ↔ sneaky
**Crazy (default):** jump, burst, crouch, launch. Jumping is great exercise, so let it be the main verb.

**Sneaky round: "The Bug King"** (every ~90 s, after a bag is cleared):
- The screen dims to a cozy night with fireflies. A **golden Bug King** with a tiny crown wanders in.
- It's shy. It only climbs onto his head if he **crouches slowly** and stays quiet (low motion).
- **Fast crouch or flailing** → the King gets startled, zips to the other side, and giggles. That's funny, not a fail. Try again.
- **Slow and sneaky** → the King climbs up and **becomes his crown 👑**. The crown stays on his head for the rest
  of the session, and every Bounc'a Bugs launch then shoots gold sparkles.
- After 3 startles, the King gives up being shy: "Okay, okay, you can be king!" (no-fail).
- Each later round adds a royal: Bug Queen (tiara), Bug Prince (tiny cape). He collects a royal family on his head.

## 6. Session arc
- **0:00–0:20 Hook:** a wiggling, buzzing bag sits at the bottom. The voice says only "Jump!" After 3 jumps: first explosion.
- **0:20–1:30 Grow:** "Crouch down low!" teaches the bug hat; the first launch follows. Each new bag drops in on a little
  parachute with a **new bug type**:
  1. Ladybugs (classic, red with spots)
  2. **Bumblebees** (they fly instead of crawl, with fuzzy wings and a buzz)
  3. **Caterpillars** (long and slow, worth 3, inchworm wiggle)
  4. **Fireflies** (glowing; extra-good at night)
  5. **Beetles** (shiny rainbow shells, extra bouncy)
- **~1:30 Twist:** the first Bug King sneaky round.
- **2:00–4:00:** bags get bigger and more jumps are needed (counting out loud with big numbers: he reads numbers), with the
  next royal visitors.
- **4:00+ Finale: MEGA BAG.** A giant bag needs **10 jumps**. The voice counts along, "ONE! TWO! …TEN!", and the
  biggest explosion fills the screen with every bug type. Then free play continues.

## 7. Absence & surprise inputs
- **Peekaboo:** bugs rush to hide in the empty bag; on BOO they all jump out again.
- **Spin:** dizzy bugs (spiral eyes, wobbly walking) for 3 s. Silly, and it doesn't break anything.
- **Leave:** a bug dance party; on return they scatter and squeal.
- **Standing still for 3 s:** a single brave bug walks up and waves at him, a gentle nudge to move.

## 8. No-fail rule
- A jump that "misses" (no bag, no hat) still makes every bug on screen hop. Every jump does *something*.
- Bugs falling off the hat are more bugs to collect, not a loss.
- Startling the Bug King = a giggle and a retry. After 3 tries, he gets the crown anyway.
- Bugs never leave the screen; nothing is ever lost.

## 9. Numbers & progress
- **Jump counter** on the bag: huge numbers, counting up (3/5 shown as **3** with dots for the remaining jumps).
- **Bug hat counter** next to his head: "🐞 23".
- **Score** top center (counts up fast; aim for thousands in 3 minutes, like Bouncy Boom).
- **Bag number** badge top right: "Bag 4".

## 10. Tech
**needs: `['face', 'motion']`**. Face gives head position (bug hat anchor), jump and crouch detection via head height,
and the existing gestures (spin, peekaboo, leave). Motion gives the sneaky-round noise level.
Skip `pose` for now (heavier, especially on the Fire tablet). Revisit only if face-based jump/crouch is unreliable.

**Jump & crouch detection (from the face's height in the frame):**
- Track a **standing baseline**: a slow average of the face's y position while he's neither jumping nor crouching.
- Measure height in **face sizes** (eye distance), so it works whether he's 1.5 m or 3 m from the camera.
- **JUMP** = face rises > ~0.7 face-sizes above the baseline within 0.4 s, then comes back down. Debounce 0.35 s.
- **CROUCH** = face drops > ~2 face-sizes below the baseline for > 0.3 s. **STAND** = back within 1 face-size.
- Fire tablet tracking runs at 12 fps: a jump is airborne about 0.4 s, which is about 5 samples, so that's enough. Tune in playtests.
- Design note: our lessons say *don't trigger important actions by holding a pose*. A crouch is OK here because
  it's a big, deliberate move he chose himself, and the effect is **gradual** (bugs keep climbing while he stays low),
  so nothing switches by accident.

**Bug hat anchoring:** use the top-of-forehead face landmark, the face size and the head tilt. Each hat bug stores a slot
(angle around the head arc + stack layer) in head-local coordinates, so the hat moves and tilts with his real head.
Taller stacks sway with head motion (a little spring physics).

**Fallback:** if crouching hasn't been detected after 40 s with bugs on screen, show a big **⬇️ "Bugs, come here!" button**.
A **⬆️ jump button** appears for the finale if 10 jumps aren't being detected. Visible buttons only.

**Performance budget (bug caps by tier):** high 120 / medium 70 / low 40. Hat bugs drawn: high 40 / medium 25 / low 15, with the rest shown
as a "+N" badge. Bugs = an oval body, a head, 6 line legs (2-frame walk cycle) and googly eyes; no images or gradients per bug.
Bees and fireflies fly (sine bob), the others crawl along the floor and walls (they can walk up the sides of the screen).

**Core additions (additive, reusable; commit with the `core:` prefix):**
1. `gestures`: new events **`jump`**, **`crouch`**, **`stand`**, plus `gestures.height` (head height in face sizes
   relative to standing; negative = crouching). Every future game gets jumping and crouching for free.
2. `view.headAnchor()` (or a helper in tracking): the top-of-head point, head width and tilt in screen px, for "wear
   something on your head" effects (crowns, hats, bugs, future costume games).
3. `sfx.buzz()`, `sfx.squeak(pitch)`, `sfx.skitter()`.
4. Debug keys: **J** = jump, **C** = toggle crouch/stand. With `?fakecam`, fake a head position so the bug hat can be
   tested without a real face.

## 11. Safety & setup
- Jumping needs **clear floor**: no rugs that slide, no furniture edges nearby, socks off or sneakers on.
- The device must see his **whole head when crouching and when jumping**: about 2–2.5 m away, at roughly his chest
  height (lower than for Bouncy Boom), on something that won't wobble when he lands.
- The voice calls a rest break after a long jumping streak ("Phew! Bugs need a nap!"), which leads into the Bug King
  sneaky round.

## 12. Playtest questions
- Do jumps register every time? Any false jumps when he just nods or leans?
- Does he discover the "crouch, then jump" combo himself, or does he need the voice prompt?
- Does seeing bugs on his own head delight him or feel too creepy? (If creepy, make them bigger, rounder and sillier.)
- Is the Bug King round too hard to do slowly? Does he enjoy startling it on purpose?
- Which bug type gets the biggest reaction? Does he want to keep the crown or royal family between sessions?
