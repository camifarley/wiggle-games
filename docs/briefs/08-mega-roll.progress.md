# 08 · Mega Roll: progress checklist

Brief: `08-mega-roll.md`. Current release: **v2.0 "Animal parade!"** (v2.0 §A–§H). v1.0 is frozen.
Code: `src/games/08-mega-roll/v2.0/` (index.js game loop, sections.js scenes + themes, mountain.js seeded runs,
parade.js, meshes.js all low-poly models + landmarks, world3d.js scene/camera, book.js passport, viewer.js 3D sticker
viewer, recipes.js catalog, settings.js + tuning.js 🔧). Tests: `scripts/test-mega-roll.js` (v1.0),
`scripts/test-mega-roll-v2.js` (v2.0). Screenshots: `docs/screenshots/08-mega-roll-v2/`.

## v2.0 sections
- ☑ §A Readability: camera higher (8.2 m) and tilted further down (looks 11 m ahead), FOV 60. Debris: 160 cubes max
  (was 260), ~12 per bonk, smaller, 0.55 s life, pushed sideways off the path + back toward the camera. Things only
  get a small cube burst; speed lines only at the screen edges; celebration words in the top band; roofs fly sideways.
- ☑ §B Parade: bonked critters hop up (squeak, giggle, 💛 pop + sticker), then trot behind the ball along its exact
  path. Drawn as a **V formation** (geese) hugging the ball's sides, because the higher camera only sees ~3.5 m behind
  the ball: a straight line behind it was invisible. Parade animals are shrunk (×0.72, BIG ones too). Cap drawn while
  rolling: high 14 / medium 10 / low 6 (🔧 "Parade shown"), the rest as a "🚩 +N" flag; HUD counter 🐾 N; every 10th
  friend gets a banner. Peekaboo BOO makes the parade jump. Group photo at the finish: rows facing a close photo camera,
  cheering, flash, "📸 PARADE: N friends!", up to 40 shown (18 on low tier).
- ☑ §C Buildings: house / igloo / tractor / rock / log cabin = 2 hits, barn / windmill = 3. A crack bounces the ball
  straight back so it rolls right in again (bonk-bonk-CRASH), wobble, 2 crack lines, the roof pops off on the first
  crack, "●●○ ALMOST!" pips. Collapse = squash + sink, chunky cubes, small confetti, big score, sticker.
  Every village scene has a building right in the path. Wrecking roll: crouching fills a charge (🔧 1.6 s); full =
  orange glowing ball, bigger, "WRECKING ROLL READY!", next building (or landmark ×3) in one hit. RAINBOW ROLL also
  one-hits buildings.
- ☑ §D Sections: 27 hand-made scenes (farm 11, forest 9, snowy 7: fewer for snowy, see open questions) with animals
  doing things (drink, peck, graze, waddle across the path, hop, slide, herd, sit, dance, wave, flop, look). Seeded:
  order (no repeats in a row), mirroring, jitter, flock colors (group looks), hats, sizes, one hidden rare sticker near
  the edge in calm/busy scenes. 4 acts: calm (2 intro scenes, density ×0.6) → busier (3, ×0.9) → village rush
  (3, ×1.25) → finale (flag-lined approach + landmark arena).
- ☑ §E Species progression: one or two species at the start; each theme's species arrive one by one (sections 0, 1,
  2, 3, 5, 6) in a scene that stars them (or a welcome group if the scene can't), with a NEW FRIEND! reveal (banner +
  voice + power-up sound) as the ball approaches the first one. Density climbs per act.
- ☑ §F Finale: Giant Barn / Log Tower / Ice Castle made of chunky pieces that crack off top-first; the ball rolls in,
  BONKs, bounces back and rolls in again (6 hits by default; wrecking = 3, landing a big bounce on it = 2; it gives up
  after 30 s so it never drags). Collapse → +1000 + 50 per friend → group photo → score screen.
- ☑ §G Themes: picker with 3 big picture buttons (🐄 / 🌲 / ❄️, sticker count each); each theme has its own palette,
  sky, species, scenes, things, buildings and landmark; "Mountain 4721 · Squishy Taco Fields / Hollow / Peak".
  New mountain → picker; Same mountain → same seed + theme. Best score per theme + seed.
- ☑ §H Passport: 3 theme books (count / total each), one scrolling page: 🆕 Recently found shelf, then a section per
  species / kind (animals first) with found stickers + grey "to find" silhouettes. Tap a sticker: its name is spoken
  and the 3D viewer opens (drag to rotate, slow auto-spin, 📱 Tilt button on touch screens requests DeviceOrientation
  permission from the tap). Saved with core `collection.js` under v1.0's key: v1.0 books load unchanged (test).

## Decisions
- No round timer in v2.0: a run is a fixed hand-made course (~490 m ≈ 50 s at 10 m/s) ending at the landmark, with a
  progress bar (ball → landmark) and species icons as they're revealed. (v1.0 keeps its 60 s rounds.)
- Every shape lives in exactly one theme book; scenes only place shapes from their theme. Snow bunnies became a new
  snowy species, the **Reindeer**, because bunnies are in the Forest book. Finale markers per theme (flag / mushroom / pine).
- New stickers: Sheepdog, Goat, Deer, Fox, Squirrel, Owl, Seal, Polar Cub, Reindeer, Log, Picnic Basket, Sled, Log Cabin
  (45 shapes, 36,450 stickers). All v1.0 ids still valid.
- Uses core `rng.js` and `collection.js` (v1.0 keeps its frozen copies). No core changes in this release.
- v2.0 has its own 🔧 settings key (`wiggle.megaroll.tuning2`), seeds (`wiggle.megaroll.seed2`) and bests
  (`wiggle.megaroll.best2`, keyed `theme:seed`): v2.0 courses differ from v1.0's.
- Mountain 4721's fingerprint is pinned per theme in the test: changing generation = a new release.

## Open questions (for the next playtest)
- Does the V-shaped parade read as "my parade"? Or would a camera that pulls back as the parade grows be better?
- Is the bonk-bonk-CRASH bounce fun, or does he want to steer past buildings?
- Finale length: 6 hits ≈ 12 s. Too long or too short? Does he discover the wrecking roll (crouch)?
- Snowy has fewer scenes (7) than Farm (11): add more if he picks Snowy a lot.
- Does he use the 3D viewer? Tilt on iPhone untested on a real device.

## Deferred
- [v2.1] Unlocking new kinds across runs; a giant friendly animal mid-run (prize cow / moose / polar bear) that you
  belly-bonk 3× until it laughs and leads the parade.
