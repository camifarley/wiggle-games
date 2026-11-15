// Run-in-place detector: intensity 0..1 plus 'idle' | 'walking' | 'running' from the body.
// Pure logic (no DOM): tested by `npm test` (scripts/test-run.js + real recordings via replay.js).
//
// Inputs per tracking sample (same units as height.js, so recordings replay exactly):
//   y     shoulder-line height in frame heights (0 = top)
//   size  shoulder width x BODY_SCALE (face-size equivalents), so 1 unit ~ one face size
//   knees { l, r } knee y in frame heights when both are visible (else null)
//   motion  motion.total (0..1), optional
//
// Signals:
//  1. BOB: every footfall dips the shoulders a little. bob = shoulder height minus its slow average, in
//     size units. A step = one down-and-up swing bigger than `stepAmp` (hysteresis, so noise can't count).
//     Steps 1.5-3.5 per second = running; slower = walking.
//  2. KNEES (when visible): running/walking lifts the knees in turn, so the left-right knee difference
//     swings back and forth. Jumping moves both knees together (no swing).
//  3. MOTION: a little overall motion is required (a still body with a jittery tracker isn't running).
// Not running:
//  - JUMPING: a jump moves the shoulders 2-4 size units (real recordings); running bob is well under that.
//    A swing bigger than `jumpAmp` marks "jumping" for a moment and its steps don't count. With knees in
//    view, a big bob with the knees moving together is also a jump.
//  - ARM WAVING: lots of motion but the shoulders don't bob: no steps, no knee swing.
//  - WALKING CLOSER/FURTHER: the shoulder width changes quickly, or steadily over a second (a real walk
//    between two spots, distance-true4 2026-11-15); steps (shoulders or knees) don't count while it does.
//  - STANDING STILL: nothing crosses the thresholds.
// `sensitivity` (default 1) scales the step and knee thresholds down (2 = twice as easy).

export const RUN_DEFAULTS = {
  stepAmp: 0.22,      // size units: one down-up swing of the shoulders at least this big = a step
  jumpAmp: 1.6,       // size units: a swing bigger than this is a jump, not a step
  jumpHold: 0.7,      // s after a jump-sized swing during which steps don't count
  kneeAmp: 0.35,      // size units: the left-right knee difference must swing at least this much
  window: 2.0,        // s of steps used for the step rate
  maxGap: 1.2,        // s: no step for this long = stopped
  walkRate: 0.8,      // steps/s at which walking starts
  runRate: 2.2,       // steps/s where intensity reaches ~0.6 (running)
  fullRate: 3.5,      // steps/s for intensity 1 (with a big bob)
  fullAmp: 0.9,       // size units of bob for full intensity
  walkAt: 0.12,       // intensity >= this = walking
  runAt: 0.45,        // intensity >= this = running
  hyst: 0.06,         // intensity hysteresis between states
  minMotion: 0.004,   // motion.total below this = nobody's moving (ignore tracker jitter)
  moveRate: 0.35,     // |d ln(size)/dt| above this = walking toward/away from the camera
  minSwings: 2,       // running needs at least this many shoulder up/down swings in the window (else: walking)
  moveTrend: 0.25,    // or shoulder width changing by more than this (ln) over the last trendTime s
  trendTime: 1.0,     // s
  moveHold: 0.6,      // s: steps right after walking toward/away still don't count
  rise: 6,            // 1/s: intensity climbs this fast toward its target
  fall: 1.6,          // 1/s: and falls this fast (tired legs keep some speed for a moment)
  sensitivity: 1,
};

export function createRunTracker(config = {}) {
  const c = { ...RUN_DEFAULTS, ...config };
  const s = {
    t: 0, ema: null, sz: null, lnSize: null, sizeRate: 0, sizeHist: [], movingUntil: -9, trend: 0, bob: 0,
    phase: 0, lo: 0, hi: 0, steps: [], kneeSteps: [], swings: [], lastKneeSwing: -9,
    kneePhase: 0, kneeLo: 0, kneeHi: 0, kneeDiff: null, kneesSeen: 0,
    jumpUntil: -9, amp: 0, rate: 0, intensity: 0, state: 'idle', moving: false, jumping: false, raw: 0,
  };
  const reset = () => {
    s.ema = null; s.sz = null; s.lnSize = null; s.sizeRate = 0; s.sizeHist = []; s.movingUntil = -9; s.bob = 0; s.phase = 0;
    s.steps = []; s.kneeSteps = []; s.swings = []; s.intensity = 0; s.state = 'idle'; s.rate = 0; s.amp = 0; s.kneeDiff = null; s.raw = 0;
  };

  return {
    state: s,
    config: c,
    reset,
    get intensity() { return s.intensity; },
    get running() { return s.state === 'running'; },
    get walking() { return s.state === 'walking'; },

    // Returns events: 'step' (each counted step), 'walk', 'run', 'stop' (state changes).
    update(dt, y, size, knees = null, motionTotal = 1) {
      const events = [];
      s.t += dt;
      const sens = Math.max(0.2, c.sensitivity || 1);
      if (y != null && size > 0) {
        // slow averages: shoulder height (1 s) and size (1 s)
        if (s.ema == null) { s.ema = y; s.sz = size; s.lnSize = Math.log(size); }
        const k = Math.min(1, dt / 1.0);
        s.ema += (y - s.ema) * k;
        s.sz += (size - s.sz) * k;
        const ln = Math.log(size);
        const rate = (ln - s.lnSize) / Math.max(dt, 1e-3);
        s.lnSize = ln;
        s.sizeRate += (rate - s.sizeRate) * Math.min(1, dt / 0.4);
        // walking toward/away: either a fast size change, or a steady trend over the last second (real walk
        // between two spots: ~0.2/s, under moveRate). Held for moveHold s (the steps right after still walk).
        s.sizeHist.push({ t: s.t, ln });
        while (s.sizeHist.length > 2 && s.sizeHist[0].t < s.t - c.trendTime) s.sizeHist.shift();
        const trend = s.sizeHist.length > 1 && s.t - s.sizeHist[0].t >= c.trendTime * 0.6 ? Math.abs(ln - s.sizeHist[0].ln) : 0;
        if (Math.abs(s.sizeRate) > c.moveRate || trend > c.moveTrend) s.movingUntil = s.t + c.moveHold;
        s.moving = s.t < s.movingUntil;
        s.trend = trend;
        s.bob = (s.ema - y) / s.sz; // + = shoulders above their average

        // step = a swing down past -thr then up past +thr (or up then down)
        const thr = (c.stepAmp / sens) / 2;
        s.lo = Math.min(s.lo, s.bob); s.hi = Math.max(s.hi, s.bob);
        if (Math.abs(s.bob) > c.jumpAmp * 0.6) s.jumpUntil = s.t + c.jumpHold; // way above average = a jump
        const next = s.bob > thr ? 1 : s.bob < -thr ? -1 : 0;
        if (next && next !== s.phase) {
          const swing = s.hi - s.lo;
          s.swings.push(s.t); // any up/down swing of the shoulders (even a jump-sized one): they're bouncing
          if (s.phase !== 0) {
            if (swing > c.jumpAmp) s.jumpUntil = s.t + c.jumpHold;
            // a big bob while the knees (seen for a while) haven't swung = both legs together = a jump
            const kneesTogether = s.kneesSeen >= 1 && s.kneeDiff != null && swing > c.stepAmp * 3 &&
              s.t - s.lastKneeSwing > 0.8;
            if (kneesTogether) s.jumpUntil = Math.max(s.jumpUntil, s.t + 0.3);
            // count one step per full down-up cycle (on the way up)
            if (next === 1 && s.t >= s.jumpUntil && !s.moving && motionTotal >= c.minMotion) {
              s.steps.push(s.t); s.amp += (swing - s.amp) * 0.4; events.push('step');
            }
          }
          s.phase = next;
          s.lo = s.hi = s.bob;
        }
      }
      // knees: the difference between the knees swings when they lift in turn
      if (knees && knees.l != null && knees.r != null && s.sz > 0) {
        s.kneesSeen = Math.min(1, s.kneesSeen + dt);
        const d = (knees.l - knees.r) / s.sz;
        s.kneeDiff = s.kneeDiff == null ? d : s.kneeDiff + (d - s.kneeDiff) * Math.min(1, dt / 0.06);
        const kt = (c.kneeAmp / sens) / 2;
        s.kneeLo = Math.min(s.kneeLo, s.kneeDiff); s.kneeHi = Math.max(s.kneeHi, s.kneeDiff);
        const kn = s.kneeDiff > kt ? 1 : s.kneeDiff < -kt ? -1 : 0;
        if (kn && kn !== s.kneePhase) {
          // every swing (left up, right up, ...) is one step
          if (s.kneePhase !== 0) s.lastKneeSwing = s.t;
          if (s.kneePhase !== 0 && s.t >= s.jumpUntil && !s.moving && motionTotal >= c.minMotion) s.kneeSteps.push(s.t);
          s.kneePhase = kn; s.kneeLo = s.kneeHi = s.kneeDiff;
        }
      } else {
        s.kneesSeen = Math.max(0, s.kneesSeen - dt);
        if (s.kneesSeen === 0) { s.kneeDiff = null; s.kneePhase = 0; }
      }

      const old = s.t - c.window;
      while (s.steps.length && s.steps[0] < old) s.steps.shift();
      while (s.kneeSteps.length && s.kneeSteps[0] < old) s.kneeSteps.shift();
      while (s.swings.length && s.swings[0] < old) s.swings.shift();
      s.jumping = s.t < s.jumpUntil;
      const rateOf = (arr) => {
        if (!arr.length || s.t - arr[arr.length - 1] > c.maxGap) return 0;
        if (arr.length === 1) return 0.5 / c.window; // a single step: barely walking
        // steps per second over the span they cover (plus half a step at the ends)
        return (arr.length - 1) / Math.max(0.3, arr[arr.length - 1] - arr[0]) * Math.min(1, arr.length / 3);
      };
      const rate = Math.max(rateOf(s.steps), rateOf(s.kneeSteps));
      s.rate = rate;
      if (!s.steps.length) s.amp *= Math.max(0, 1 - dt);
      // intensity from the step rate (piecewise: walking band, running band), plus a bigger-bob bonus
      let target = 0;
      const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
      if (rate >= c.walkRate * 0.5) {
        if (rate < c.walkRate) target = lerp(0.04, c.walkAt, (rate - c.walkRate * 0.5) / (c.walkRate * 0.5));
        else if (rate < c.runRate) target = lerp(c.walkAt, c.runAt, (rate - c.walkRate) / (c.runRate - c.walkRate));
        else target = lerp(c.runAt, 0.85, (rate - c.runRate) / (c.fullRate - c.runRate));
        if (rate >= c.runRate * 0.85) target += 0.15 * Math.min(1, s.amp / c.fullAmp);
        target = Math.min(1, target);
        // knees alone (shoulders not bouncing) = walking, never running: walking between two spots swings the
        // knees just like running does (distance-true4 2026-11-15), but running in place also bounces the
        // shoulders up and down (real run recording), sometimes as high as a jump
        if (s.swings.length < c.minSwings) target = Math.min(target, c.runAt - c.hyst - 0.02);
      }
      s.raw = target;
      const speed = target > s.intensity ? c.rise : c.fall;
      s.intensity += (target - s.intensity) * Math.min(1, dt * speed);
      if (s.intensity < 0.005) s.intensity = 0;

      const prev = s.state;
      const I = s.intensity;
      if (prev === 'running') s.state = I < c.runAt - c.hyst ? (I < c.walkAt ? 'idle' : 'walking') : 'running';
      else if (prev === 'walking') s.state = I >= c.runAt ? 'running' : I < c.walkAt - c.hyst / 2 ? 'idle' : 'walking';
      else s.state = I >= c.runAt ? 'running' : I >= c.walkAt ? 'walking' : 'idle';
      if (s.state !== prev) events.push(s.state === 'running' ? 'run' : s.state === 'walking' ? 'walk' : 'stop');
      return events;
    },
  };
}
