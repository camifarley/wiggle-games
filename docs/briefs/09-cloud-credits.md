# 09 · Cloud Credits  ☁️

Status: **v1.0 built** (`src/games/09-cloud-credits/v1.0/`; credits in `src/credits.json`). Parent direction: a credits list for the sounds (and any future credits) presented
as a **level you can't lose**: a pleasant, quiet scene with the credits scrolling over the front of the
gameplay, maybe floating through the clouds. (The parent made a credits level like this on a previous
commercial game. This one is our own design.)

## 1. The fantasy
**After all that smashing, you float up above the clouds on a balloon and say thank you to everyone who
helped make the games.** Nothing to win, nothing to lose, just a gentle ride.

## 2. Mood (the most important part)
- **Quiet and soft:** a warm sunset sky, slow drifting clouds, a calm music track (picked with the Sound
  Studio session), gentle wind and the odd bird chirp. No shake, no flashes, no countdowns, no score pressure.
- **Slow pace:** the whole ride takes **about 2–3 minutes** at default speed. It's the cool-down after body games:
  a natural bedtime-ish wind-down.
- **It can't be failed:** if he does nothing, the balloon floats along and the credits play to the end.

## 3. What he sees
- **First-person-ish view from a hot-air balloon basket** (the basket rim at the bottom of the screen). Below:
  a sea of fluffy low-poly clouds; ahead: the sun low on the horizon.
- **Credits float toward you on clouds and banners**, big and readable, in the middle band of the screen, then
  drift gently past. This is the one game where text *should* be in the middle: the credits ARE the content.
  Each credit holds for at least ~3 s at readable size (he reads some words, you read the rest).
- **Little things to discover between credits:** a flock of birds, a sleepy moon, a rainbow, a friendly
  cloud with a face that winks, a paper airplane, balloon friends floating by. Small surprises reward
  looking around.
- **Ending:** a giant cloud spells **"THANK YOU FOR PLAYING!"**, fireworks made of soft sparkles (gentle,
  not loud), the voice says "Thank you! Sweet dreams!", then the ride loops slowly or offers ⬅ back to games.

## 4. Gentle, optional interaction (body)
Everything is optional; nothing is required to progress.
| Move | Effect |
|---|---|
| **Lean** left/right | The balloon drifts that way (look around, steer toward stars) |
| **Arms up / jump** | A soft "puff": the balloon rises a little and floats back down |
| **Wave a hand** at a sparkly star | It twinkles, chimes a soft note (a pentatonic scale, so any order sounds nice) and joins a constellation in the sky |
| **Stand still** | Totally fine: the ride continues |
| **Leave** | It keeps going (it's credits, not a game) |

The stars-to-constellation idea gives a calm "build-up → release": at the end, the constellation he made glows
into a picture (e.g. a smiling balloon) behind the THANK YOU cloud.

## 5. The credits content
Sections, in order:
1. **Made by:** the family (see Privacy below), "with help from Claude".
2. **Game ideas by:** the co-designer (Privacy below) and the parent.
3. **Sounds:** every sound asset with source, author and license (e.g. "Kenney.nl, CC0 1.0"), grouped by
   source so it stays readable.
4. **Music:** each track: title, artist, license.
5. **Tools & tech:** three.js, MediaPipe (Google), Vite, Web Audio, GitHub Pages.
6. **Special thanks:** testers, family, pets (editable).
7. **THANK YOU FOR PLAYING!**

## 6. One source of truth for credits
- **`src/credits.json`** (public, committed): sections → entries `{ name, role?, source?, license?, url?, assets? }`.
  `docs/CREDITS.md` is generated from it (or they're kept in sync by a check). Every future asset gets an
  entry here, so the credits game and the docs never drift.
- **A test in `npm test`:** every non-candidate file under `public/sounds/` (and future art/music folders) must be
  covered by a credits entry. Adding a sound without crediting it fails the build. (Picker candidates are covered
  by the Kenney entry.)
- Licenses that require attribution (CC-BY) must show title, author, license and link exactly as required.

## 7. Privacy (public repo)
- **Never commit family or child names.** Public `credits.json` uses roles ("Our little co-designer", "Chief
  tester", "The grown-up").
- **Family names are added on the device:** the 🔧 panel has a "Family credits" box (e.g. "Game ideas: ____")
  saved in localStorage, so they show on that device's credits screen only, never in the repo or the build.

## 8. Tech
- `needs: ['pose', 'motion']` (lean and wave); everything still works with no body detected.
- three.js scene (reuse Smash Run's version and lazy loading): instanced low-poly clouds, a gradient sky dome,
  soft fog, a slow camera drift. Text as canvas-textured planes or DOM overlays (crisp and readable; whichever
  looks better at phone sizes).
- Uses the core music API from the Sound Studio work (`music.play('credits')`) once merged, with a fallback
  to silence plus soft synth chimes.
- **Tuning panel (🔧):** scroll speed, text size, interaction on/off, the family credits box, a notes box.
- **Test controls:** works with `?keys` (lean with ←/→) and fast-forward to skip through the credits quickly.
- Menu: a card **"☁️ Thank you"** (the number is assigned like any game), always the last card. Releases folder `v1.0/`
  with a cover.

## 9. Playtest questions
- Does it actually calm him down after a body game? Is 2–3 minutes right, or too long?
- Does he try to collect stars, or just watch? Does he like seeing names float by?
- Is the text readable on the iPhone and from 2 m away on the laptop?
