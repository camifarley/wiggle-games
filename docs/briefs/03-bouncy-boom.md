# 03 · Bouncy Boom  🎉

Status: **brief, not built**. Kid-idea origin: "wave hands → slime and bouncy balls come out;
spin → balls break into confetti."

## 1. The fantasy
**You're a slime wizard.** Your hands shoot goo and bouncy balls, and your spin makes everything explode.

## 2. Core verbs: body → effect
| Body move | On screen | Sound | Voice (sometimes, not every time) |
|---|---|---|---|
| **Wave hands** | Slime splurts out where the hands move; every few splurts a bouncy ball pops out | squish / splat, then a boing | "Splat!" "More balls!" |
| **Wave harder** | Bigger splurts, faster balls, slime flies farther | louder, higher-pitched | "Whoa, super slime!" |
| **SPIN around** | **Every ball bursts into confetti at once.** Screen shake, flash, a huge number | big BOOM + tada | "BOOOM!" "Mega boom!" |
| **Hide face** (peekaboo) | Balls creep toward where the face was, eyes searching | quiet tiptoe notes | "Where did you go?" |
| **Face comes back** | Balls jump in surprise and bounce everywhere | boing chorus | "BOO!" (giggle) |
| **Freeze / move slowly** | (Sneaky round, see §5) the noise meter stays low | soft snoring | "Shhh… sneaky…" |
| **Leave the frame** | Balls fall asleep (Zzz) and the slime droops | snores | Returns: "You're back!" |

**Make the balls into characters:** every ball has googly eyes that **follow the kid's face**. That's
cheap, and it makes the screen feel alive and aware of him, which is exactly what Animal Face lacked.

## 3. Signature moment
**The Mega Boom.** The screen is packed with 40+ googly-eyed balls. He spins. Every ball bursts at
once into a confetti tornado, with a giant number: **"47 BALLS! ×3! = 141!"**

## 4. Build-up → release
This is built on his own Bubble Pop strategy (wait until the screen is full, then explode):
- Balls **never leave the screen**. They bounce around and pile up, so waving keeps adding to the pile.
- The boom score = balls × **combo multiplier** (×1 for 1–9 balls, ×2 for 10–24, ×3 for 25–49, ×5 for 50+).
  The more you build, the more it pays off.
- A big **ball counter** with a fill bar shows the next multiplier tier: "×3 at 25!"
- Voice teases at thresholds: "So many balls! Spin to BOOM!"

## 5. Energy pacing: crazy ↔ sneaky
**Crazy (default):** wave, slime, balls, spin, boom.

**Sneaky round: "Shhh! The Slime Monster is sleeping"** (every ~90 s, or after 3 booms):
- A big, sleepy green slime monster slides in and snores. A **noise meter** reads total body movement.
- Goal: **move slowly or stay still** for 10 seconds while the snore bar fills. Small, slow moves are allowed (sneaking),
  so it's a challenge, not a freeze.
- **Stay sneaky** → the monster snores out a **giant rainbow MEGA BALL** (worth 10 balls in the next boom).
- **Too wild** → the monster wakes up, sneezes slime ALL over the screen (hilarious), says "Bless me!",
  and goes back to sleep for another try. Waking it is funny, not a fail. Sneaking just pays better.
- The calm round also gives a dizzy 4-year-old a breather after spinning.

## 6. Session arc
- **0:00–0:30 Hook:** the first wave makes slime and a ball appear immediately. No instructions, and the voice only says "Wave your hands!"
- **0:30–2:00 Grow:** each boom levels up the party (**Level 2, 3, 4…** in big numbers). Each level unlocks a ball type:
  1. Rubber balls (classic)
  2. **Glitter balls** (sparkle trail)
  3. **Tiny super-bouncers** (pop out three at a time, very fast)
  4. **Beach ball** (huge, slow, worth 5)
  5. **Rainbow balls** (change color, double confetti)

  The slime color also changes each level: green → purple → blue → gold.
- **~1:30 Twist:** the first sneaky round with the Slime Monster.
- **2:00–4:00:** the levels keep going, sneaky rounds repeat, and the monster gets sillier (wears a hat, snores louder).
- **4:00+ Finale:** "SUPER PARTY!" The screen fills with balls on its own and the voice says "Biggest spin ever!" That spin
  triggers a giant confetti storm and a trophy ⭐ with the total score. Then free play continues; there's no game-over screen.

## 7. Absence & surprise inputs
- **Hide face** → peekaboo (balls sneak in, then BOO). A cheap, sure laugh.
- **Leave the frame** → balls sleep, then wake up excited when he's back.
- **Spin** → boom (the main mechanic).
- **Stand totally still** in crazy mode for 3 s → the balls get curious and slowly roll toward him (a teaser to make him move).

## 8. No-fail rule
- Spinning with 0–3 balls still gives a mini-boom with confetti, just smaller.
- Waking the monster = a slime-sneeze joke plus a retry.
- If spin detection misses, nothing bad happens: the balls stay, and a fallback appears (§10).

## 9. Numbers & progress
- **Ball counter** (top left, big), **score** (top center, huge, counts up fast after a boom), **Level N** badge.
- Scores should reach the thousands in a 3-minute session (he loved 400+ in Bubble Pop).

## 10. Tech
**needs: `['motion', 'face']`**
- `motion`: where the hands are moving (spawn points for slime and balls) and how much (noise meter, wave strength).
- `face`: googly-eye target, peekaboo, **spin detection**. Skip `hands` and `pose` because they're too heavy alongside face on the Fire tablet.

**Spin detection (face + motion):**
- SPIN = face visible → face lost for **0.4–3 s** while `motion.total` stays **high** (body moving) → face visible again.
- PEEKABOO = face lost while motion is **low**, or hands moving only near the face, then face back.
- LEFT FRAME = face lost **> 3 s**.
- Tune the thresholds in playtests. On the Fire tablet's 12 fps tracking, a fast spin still loses the face for several frames.

**Fallback:** if there are 25+ balls and no boom for 20 s, a big pulsing **💥 button** appears (any tap = boom). It
covers missed spins, the parent helping, or a dizzy kid. Visible buttons only, per the house rules.

**Performance budget (ball caps by tier):** high 80 / medium 50 / low 30. When at the cap, new balls replace the oldest.
Slime = wobbly circles that splat to the edges and drip, plus one jiggling puddle path at the bottom. **No per-pixel
metaballs.** Googly eyes: two circles per ball, which is cheap. Confetti through `ctx.fx` (already tier-scaled).

**Core additions (additive, reusable for future games; commit separately with the `core:` prefix):**
1. `motion.hotspots(n)` → the top n moving regions `{x, y, strength}` (spawn points; useful in many games).
2. `core/gestures.js` → events from face + motion: `spin`, `peekaboo`, `leave`, `return`, `still`.
   Every future game gets "absence is input" for free.
3. `sfx.splat()`, `sfx.squish()`, `sfx.snore()`, `sfx.boom()` (Web Audio synth, no files).
4. Debug keys with `?debug`: **S** = spin, **P** = peekaboo, **L** = leave/return, so agents can test with `?fakecam`.

**Physics:** simple per-ball gravity, wall and floor bounce with restitution ~0.85, squash-and-stretch on impact.
Ball-to-ball collisions only on high tier (or skip them; kids won't notice).

## 11. Safety & setup
- Spinning needs **clear space** about 1.5 m around the kid. Put the device somewhere high and stable, about 2 m away, so the face is visible when standing.
- **Dizziness guard:** after 3 spins in 20 s, the game calls a sneaky round: "Whoa, I'm dizzy! Shhh, sneaky time…"
- No flashing faster than 3×/s; the boom flash is one soft white pulse.

## 12. Playtest questions
- Does he discover that saving balls makes bigger booms, or does he spin constantly? (Both are fine. It tells us how much to tease.)
- Is the sneaky round fun or frustrating? Does he *try* to wake the monster on purpose? (If yes, make the sneeze even better.)
- Does spin detection fire every time he spins? Does it ever fire when he didn't?
- Does he talk to the googly-eyed balls? (A sign the characters work.)
- Which level or ball type gets the biggest reaction?
