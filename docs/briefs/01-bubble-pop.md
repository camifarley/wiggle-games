# 01 · Bubble Pop  (🫧)

Releases: **v1.0 "First bubbles!"** (the original: bubbles float up, wave to pop, +1 each) ·
**v1.1 "Giant bubbles!"** (this brief).

## 1. The fantasy
You're a bubble wizard: you grow GIANT bubbles just by waiting, then pop them into a chain reaction.

## 2. Core verbs: body → effect (v1.1)
| Body move | What happens on screen | Sound | Voice line |
|---|---|---|---|
| Wave / flail at bubbles | pop, +10 per bubble inside it | pop | — |
| Stand still | bubbles that touch MERGE, growing up to GIANT (×N shows how many are inside) | soft bloop, boing at giant | "It's getting GIANT!" |
| Pop a giant (or any ×4+) | it bursts into a shower of minis that pop one after another: CHAIN ×N, each link worth more; a mini pops bubbles next to it, so chains spread | rising squeaks, tada at ×8+ | "Chain reaction!" |
| Spin (body tracking) | a spiral of new bubbles flies out from around him; a half turn = a little puff | whoosh | "Spinny bubbles!" |
| Tap a bubble (touch screens) | pops it | pop | — |

## 3. Signature moment
Standing still until the screen is full of ×10 giants, then one flail: GIANT POP → CHAIN ×40.

## 4. Build-up → release
Merging IS the mechanic (from the playtest: he waited for the screen to fill, then flailed). Waiting 30 s and
flailing 10 s scores ~3–4× more than flailing for 40 s (checked by `scripts/test-bubble-pop.js`).

## 5. Specials (one at a time, 6 per round at 6/15/24/33/42/51 s; a missed one floats away after 9 s)
- 💣 **Boom**: shockwave pops everything near it (giants in range chain).
- 🌈 **Rainbow**: a rainbow sweeps across and pops the whole screen (double points).
- 🐟🦆🐸 **Critter**: a friend floats out, waves 👋, giggles and swims off. Critters never get hurt.
- ⭐ **Golden**: +500 and confetti.
- 🪄 **Wand**: 10 s of bubble wand with a countdown ring (around the wand and big at the top right). Bubbles stream
  out of a coloured toy he holds up (`src/core/toy.js`: distance-aware size, background colours ignored), else
  from his faster-moving hand (pose wrists), else from wherever the movement is. Faster moves = more bubbles.

## 6. Session arc
60-second round (a bar under the score fills toward ⛈️) → "A bubble storm is coming!" at 52 s → **BUBBLE STORM**
(9 s flood from the bottom and sides) → everything left pops in one last cascade → **score screen**: big score,
🏆 best (saved per device, `localStorage` `wiggle.bubble-pop.v1.1.best`), 🫧 popped · 🔗 best chain · 🟣 giants,
a big ▶ button. The next round starts on tap or after a 10-s countdown ring.

## 8. No-fail rule
Nothing is lost: bubbles never escape (they gather under the score), unpopped bubbles still pop for him at the
end of the storm.

## 9. Numbers
+10 per bubble, chain links 15 → 60, chain bonus ×10, specials 100–500, a cheer every 1000. A round lands in the
low thousands up to ~10 000. Celebration words (CHAIN ×N, GIANT!, BOOM!) show in a band under the score, never
over the bubbles; only small "+N" float at a popped bubble (and not for long chains).

## Tech
- `needs: ['motion', 'pose', 'color']`. Bubble caps by tier: 20 / 30 / 42 (storm ×1.4), minis 24 / 40 / 60.
  Bubble pictures are pre-rendered per hue (no gradients per frame).
- **Debug keys (`?debug`)**: **1** boom · **2** rainbow · **3** critter · **4** golden · **5** wand bubble ·
  **6** giant bubble · **7** fill the screen · **K** wand + pretend toy for 3 s · **G** storm now · **E** end round.
  With `?keys`: **S** spins through the real spin detector (~1–2 s), **]** fast-forward, ⏭ ends the round (or starts
  the next), 🏁 jumps to the storm. `window.wiggle.game` = round state, `window.wiggle.gameApi` = the game object.
- Tests: `scripts/test-bubble-pop.js` (round flow, one special at a time, wand 10 s, spin swirl, wait-then-flail
  beats flailing), `scripts/test-toy.js` (toy finder). Untested on real devices: real spin from a 4-year-old,
  the wand with a real toy, fps on the Fire tablet with 42 bubbles + colour tracking.
