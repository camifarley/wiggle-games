// Duck window latch: "did he duck at ANY point while the big thing was coming?" Pure (no DOM), tested by
// scripts/test-duck.js (npm test) with simulated head paths through the real height tracker.
//
// Why: a game that judges a duck only at the instant something passes (gestures.crouching, which needs a
// 2-face-size drop held 0.3 s, plus smoothing) misses a 4-year-old's quick bob down, or a duck done a moment
// early. A latch opens when the warning starts and remembers the first duck it sees until the game closes it.
//
//   const latch = createDuckLatch()
//   latch.open(time)                                   // when "DUCK!" is announced
//   latch.update(dt, time, { height, crouching })      // every frame: ctx.gestures.height / .crouching
//   latch.mark('crouch' | 'jump' | 'spin' | ..., time) // gesture events also count
//   latch.ducked                                       // true once anything counted
//   latch.close() -> { start, seenAt, how, minHeight, waited } // for the recording
//
// height is gestures.height (head height vs standing, in face sizes; - = lower). With body tracking it comes from
// the shoulder line, so it works when the knees are out of view (too close) too.

export const DUCK_DEFAULTS = {
  duckDown: 1.2,  // face sizes below standing: a gentle, quick dip counts (a full crouch is 2.0 + held 0.3 s)
  minDip: 0.1,    // s it must stay that low (one noisy sample is not a duck)
};

export function createDuckLatch(config = {}) {
  const c = { ...DUCK_DEFAULTS, ...config };
  let s = { open: false, start: 0, seenAt: null, how: null, minHeight: 0, belowT: 0 };
  const api = {
    config: c,
    get state() { return s; },
    get ducked() { return s.seenAt != null; },
    open(time = 0) { s = { open: true, start: time, seenAt: null, how: null, minHeight: 0, belowT: 0 }; },
    mark(how, time = 0) { if (s.open && s.seenAt == null) { s.seenAt = time; s.how = how; } },
    update(dt, time, { height = 0, crouching = false } = {}) {
      if (!s.open) return api.ducked;
      if (Number.isFinite(height)) s.minHeight = Math.min(s.minHeight, height);
      if (crouching) api.mark('crouching', time);
      s.belowT = height < -c.duckDown ? s.belowT + dt : 0;
      if (s.belowT >= c.minDip) api.mark('dip', time);
      return api.ducked;
    },
    close(time = 0) {
      const out = { start: s.start, seenAt: s.seenAt, how: s.how, minHeight: +s.minHeight.toFixed(2), waited: +(time - s.start).toFixed(2), ducked: s.seenAt != null };
      s.open = false;
      return out;
    },
  };
  return api;
}
