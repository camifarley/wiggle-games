// Coloured-toy helpers: is the kid holding up a coloured toy? Pure (no DOM, no ctx) except toySample().
// Extracted from Move Lab's Magic toy station (src/games/05-move-lab/toy.js uses these, unchanged
// behaviour) so other games (Bubble Pop's bubble wand) can find a toy the same way.
//
// Two things a playtest taught us:
// 1. From play distance (body tracking, knees in view) a hand-held toy covers only ~0.3-0.5% of the
//    view. So "big enough" scales with how big the kid looks (shoulder width squared), and a blob near
//    a wrist needs a bit less.
// 2. A big coloured thing in the room (or a coloured shirt) is "found" all the time. Each colour has a
//    baseline (how much of it is in view when nobody is showing it). Only the amount ABOVE the baseline
//    counts.
//
//   import { createToyFinder, toySample } from '../../core/toy.js';
//   const finder = createToyFinder();                 // colours: red, blue, yellow, green
//   const toy = finder.update(dt, toySample(ctx, finder.colors), { learn: !wandOn });
//   if (toy) { const p = ctx.view.toScreen(toy.x, toy.y); ... }   // toy = { color, x, y, size, excess, need, near }
// Needs `color` (and `pose` for distance + "in his hand") in the game's needs.

export const TOY_SIZING = {
  maxSize: 0.006,    // needed when we can't see the body (old fixed threshold; fine up close)
  perBody: 0.06,     // needed = perBody × shoulderWidth²  (0.22 wide → 0.0029)
  minSize: 0.0022,   // never below this (color.js reports found from 0.002)
  nearWrist: 1.2,    // blob within this many shoulder widths of a wrist counts as "in his hand"
  nearFactor: 0.8,   // ...and then needs this fraction of the size
  baseMargin: 0.4,   // also need this fraction of the baseline on top (noise in a busy colour)
  baseRise: 1.5,     // baseline learns a colour that's away from his hands fast (fraction of the gap per s)
  baseRiseHand: 0.1, // ...a blob in his hand only slowly (it's probably a toy, not the room)
  baseRiseNoBody: 0.5, // ...and in between when we can't see his body
  baseFall: 3,       // drops fast when the colour goes away
  busy: 0.012,       // baseline above this = colour is in the background
};

export const TOY_COLOR_ORDER = ['red', 'blue', 'yellow', 'green'];

// Size a toy must add to the view: scales with how big the kid looks (shoulder width²).
export function toyNeed(C, bodyWidth, near) {
  const k = near ? C.nearFactor : 1;
  if (!(bodyWidth > 0)) return C.maxSize * k;
  return Math.max(C.minSize, Math.min(C.maxSize, C.perBody * bodyWidth * bodyWidth) * k);
}

// Is this blob within nearWrist shoulder widths of a visible wrist?
export function toyInHand(C, blob, bodyWidth, wrists, aspect) {
  return bodyWidth > 0 && wrists.some((w) => Math.hypot((w.x - blob.x) * aspect, w.y - blob.y) <= C.nearWrist * bodyWidth);
}

// How fast colour c's background baseline climbs this sample (fraction of the gap per s).
// freeze = this colour may be the toy right now: never learn it away.
export function toyBaseRise(C, blob, { bodyWidth = 0, inHand = false, fast = false, freeze = false } = {}) {
  if (fast) return C.baseRise;
  if (freeze) return 0;
  if (!(bodyWidth > 0)) return C.baseRiseNoBody;
  return blob?.found && inHand ? C.baseRiseHand : C.baseRise;
}

// One step of baseline learning for one colour (mutates base[c]). v = blob size (0 if not found).
export function learnToyBase(C, base, c, v, dt, rise) {
  if (base[c] == null) base[c] = 0;
  base[c] += (v - base[c]) * Math.min(1, dt * (v > base[c] ? rise : C.baseFall));
}

// Build one sample from the live ctx: { blobs, bodyWidth, wrists, aspect } (what Move Lab and replay feed).
export function toySample(ctx, colors = TOY_COLOR_ORDER) {
  const blobs = {};
  for (const name of colors) { const b = ctx.color.track(name); blobs[name] = { found: b.found, x: b.x, y: b.y, size: b.size }; }
  const body = ctx.body ? ctx.body() : { found: false };
  const p = ctx.pose || {}, wrists = [];
  for (const w of [p.leftWrist, p.rightWrist]) if (p.found && w && (w.v ?? 1) >= 0.5) wrists.push({ x: w.x, y: w.y });
  return { blobs, bodyWidth: body.found ? body.width : 0, wrists, aspect: (ctx.camera?.width / ctx.camera?.height) || 16 / 9 };
}

// A finder for games: any of `colors`, whichever stands out most above its background.
// update(dt, sample, { learn }) → the toy { color, x, y, size, excess, need, near } or null.
//   learn: true  = learn backgrounds (normal play: a blob in his hand only learns slowly)
//   learn: false = freeze every background that could be the toy (while the toy is being used),
//                  backgrounds still fall when a colour leaves.
// hold: a toy is reported after it's been "enough" for `on` s, and kept while it's at least `keep` × need
// (so a toy flickering at the edge doesn't blink on and off). Nothing is reported in the first `warmup` s
// (the backgrounds are learned first), so create the finder when the game starts, not when the toy is needed.
export function createToyFinder(config = {}) {
  const C = { ...TOY_SIZING, on: 0.12, keep: 0.6, warmup: 1.5, ...config };
  const colors = C.colors || TOY_COLOR_ORDER;
  const base = {};
  const f = {
    C, base, colors, current: null, toy: null, holdT: 0, age: 0,
    update(dt, sample, { learn = true } = {}) {
      const { blobs = {}, bodyWidth = 0, wrists = [], aspect = 16 / 9 } = sample;
      f.age += dt;
      let best = null, bestRatio = 0;
      for (const c of colors) {
        const b = blobs[c];
        const near = !!b?.found && toyInHand(C, b, bodyWidth, wrists, aspect);
        const need = toyNeed(C, bodyWidth, near) + C.baseMargin * (base[c] || 0);
        const excess = b?.found ? b.size - (base[c] || 0) : 0;
        const ratio = excess / need;
        const lim = c === f.current ? C.keep : 1;
        if (ratio >= lim && ratio > bestRatio) { bestRatio = ratio; best = { color: c, x: b.x, y: b.y, size: b.size, excess, need, near }; }
        const v = b?.found ? b.size : 0;
        learnToyBase(C, base, c, v, dt, toyBaseRise(C, b, { bodyWidth, inHand: near, freeze: !learn && ratio >= C.keep * 0.5 }));
      }
      if (f.age < C.warmup) best = null; // first learn what the room looks like
      if (best && best.color === f.current) f.toy = best;                  // still showing it
      else if (best && (f.holdT += dt) >= C.on) { f.current = best.color; f.toy = best; f.holdT = 0; } // new toy
      else { if (!best) f.holdT = 0; f.current = null; f.toy = null; }
      return f.toy;
    },
    reset() { for (const k of Object.keys(base)) delete base[k]; f.current = null; f.toy = null; f.holdT = 0; f.age = 0; },
  };
  return f;
}
