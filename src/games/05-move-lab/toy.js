// Magic toy (station 8) logic, kept pure (no DOM, no ctx) so scripts/replay.js can replay a real
// recording through exactly the same code the station runs.
//
// Two things a playtest taught us:
// 1. From play distance (body tracking, knees in view) a hand-held toy covers only ~0.3-0.5% of the
//    view. So "big enough" scales with how big the kid looks (shoulder width squared), and a blob near
//    a wrist needs a bit less.
// 2. A big coloured thing in the room (or a coloured shirt) is "found" all the time. Each colour has a
//    baseline (how much of it is in view when nobody is showing it). Only the amount ABOVE the baseline
//    counts, and a colour that is busy in the background is skipped when picking what to ask for.
//
// color.track() measures ALL matching pixels in the view (size = fraction of the view, x/y = centroid),
// so a toy adds to whatever is already there.
//
// The sizing + background-learning pieces live in src/core/toy.js (shared with other games).

import { TOY_SIZING, TOY_COLOR_ORDER, toyNeed, toyInHand, toyBaseRise, learnToyBase } from '../../core/toy.js';

export { toyNeed };

export const TOY_CONFIG = {
  order: TOY_COLOR_ORDER, // ask in this order, skipping busy colours
  ...TOY_SIZING, // distance-aware size + background baseline numbers (src/core/toy.js)
  hold: 0.5,         // s of "showing it" to count (leaky: flicker drains at half speed)
  drain: 0.5,
  wait: 1.6,         // s after a hit before the next colour is asked for
  giveUp: 25,        // s with no sign of this colour at all → try another colour (maybe he has no yellow toy)
};

export const TOY_COLORS = {
  red: { css: '#ff3b3b', say: 'Find something red! Show me!', yay: 'RED!' },
  blue: { css: '#3b7bff', say: 'Now something blue!', yay: 'BLUE!' },
  yellow: { css: '#ffd400', say: 'Now something yellow!', yay: 'YELLOW!' },
  green: { css: '#2fd35a', say: 'Now something green!', yay: 'GREEN!' },
};

// One sample: blobs = { red: {found, x, y, size}, ... } (norm coords, mirrored view),
// bodyWidth = ctx.body().width or 0, wrists = [{x, y}] visible wrists, aspect = camera w / h.
export function createToyStation(config = {}) {
  const C = { ...TOY_CONFIG, ...config };
  const base = {};
  const s = {
    C, base,
    target: null, asked: [], hold: 0, wait: 0, tried: 0, count: 0,
    need: C.maxSize, excess: 0, near: false, blob: null, showing: false,
    // Which colour to ask for next: the first one not asked yet whose background is quiet.
    pick() {
      const left = C.order.filter((c) => !s.asked.includes(c));
      const others = C.order.filter((c) => c !== s.target);
      const pool = left.length ? left : others.length ? others : C.order;
      return pool.find((c) => (base[c] || 0) <= C.busy) || pool.slice().sort((a, b) => (base[a] || 0) - (base[b] || 0))[0];
    },
    // phase: 'demo' (only learn) or 'go'. Returns events: [{ name: 'ask'|'hit'|'skip', color }]
    update(dt, phase, sample) {
      const ev = [];
      const { blobs = {}, bodyWidth = 0, wrists = [], aspect = 16 / 9 } = sample;
      const inHand = (b) => toyInHand(C, b, bodyWidth, wrists, aspect);
      // Learn every colour's background. During the demo (he's watching Coach Boing) everything is
      // learned fast. After that the colour he's asked to show never climbs (that would learn his toy
      // away) and a blob in his hand climbs only slowly.
      for (const c of C.order) {
        const b = blobs[c], v = b?.found ? b.size : 0;
        const rise = toyBaseRise(C, b, { bodyWidth, inHand: !!b?.found && bodyWidth > 0 && inHand(b), fast: phase === 'demo', freeze: c === s.target });
        learnToyBase(C, base, c, v, dt, rise);
      }
      if (phase === 'demo') return ev;
      if (!s.target) { s.target = s.pick(); s.asked.push(s.target); s.tried = 0; ev.push({ name: 'ask', color: s.target, first: true }); }
      if (s.wait > 0) {
        s.wait -= dt;
        if (s.wait <= 0) { s.target = s.pick(); s.asked.push(s.target); s.tried = 0; ev.push({ name: 'ask', color: s.target }); }
        s.showing = false; s.excess = 0;
        return ev;
      }
      const b = blobs[s.target];
      s.blob = b?.found ? b : null;
      s.near = !!s.blob && inHand(s.blob);
      s.need = toyNeed(C, bodyWidth, s.near) + C.baseMargin * (base[s.target] || 0);
      s.excess = s.blob ? s.blob.size - (base[s.target] || 0) : 0;
      s.showing = s.excess >= s.need;
      s.hold = s.showing ? s.hold + dt : Math.max(0, s.hold - dt * C.drain);
      s.tried = s.excess >= s.need * 0.5 ? 0 : s.tried + dt; // any sign of the toy resets the give-up clock
      if (s.hold >= C.hold) {
        s.count++; s.hold = 0; s.wait = C.wait;
        ev.push({ name: 'hit', color: s.target });
      } else if (s.tried >= C.giveUp && s.hold === 0) {
        ev.push({ name: 'skip', color: s.target });
        s.hold = 0; s.wait = 0.01; // next update asks for another colour
      }
      return ev;
    },
    // 0..1 how close the current blob is to "enough" (for the ring that fills up)
    get progress() { return Math.min(1, s.hold / C.hold); },
    get almost() { return s.blob ? Math.max(0, Math.min(1, s.excess / s.need)) : 0; },
  };
  return s;
}
