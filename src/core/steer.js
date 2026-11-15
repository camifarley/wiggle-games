// Steering detector: a value from -1 (left) to +1 (right) from the body. Pure logic (no DOM): tested by
// `npm test` (scripts/test-steer.js + real Move Lab "Lean / Airplane arms" recordings via replay.js).
//
// Coordinates are the MIRRORED camera image (what the kid sees), so leaning to the screen's right = +1.
// Every distance is in shoulder widths (aspect-corrected), so it works the same 1-4 m from the camera.
//
// Two ways to steer:
//  1. LEAN (default): three signals, each compared with a slowly learned "standing straight" baseline
//     (a tilted camera or a crooked natural stance reads as straight after a few seconds):
//       torso   shoulder midpoint vs hip midpoint (sideways torso lean)          full at `torsoFull` sw
//       tilt    the shoulder line's angle (leaning drops one shoulder)            full at `tiltFull` rad
//       shift   shoulder midpoint vs a learned center (leaning the whole body)  full at `shiftFull` sw
//     Without hips in view: shift + tilt only. Stepping sideways to a new spot steers too, until the center
//     catches up (`centerSlow` s): a real run-in-place recording drifted 0.2 frame widths while running.
//  2. AIRPLANE ARMS: both wrists held out wide, roughly at shoulder height, for `armsHold` s. Then the
//     wrist-to-wrist angle steers (minus the learned shoulder tilt, so a tilted camera reads level).
// Then: x `sensitivity`, a deadzone (standing naturally = straight), clamp to -1..1, smoothing (`smooth` s).
//
// Not steering (simulated negatives in npm test):
//  - STANDING STILL: tracker jitter stays inside the deadzone.
//  - WALKING CLOSER/FURTHER: shoulder width changes fast -> hold straight, re-learn the center.
//  - JUMPING: shoulders move up/down fast -> extra-slow smoothing, so a landing wobble can't flick it.
//  - SPINNING: shoulders narrow (side-on) -> straight until facing again.
//  - ARM WAVING: fast wrists never count as airplane arms; lean mode doesn't look at the wrists.
//
// Events from update(): 'lean' { side: 'left'|'right' } each time the value passes `countAt` (re-armed
// below `releaseAt`). Move Lab's ✈️ station counts these; replay.js replays them.

export const STEER_DEFAULTS = {
  torsoFull: 0.4,    // shoulder widths of shoulders-vs-hips offset for full steering
  tiltFull: 0.3,     // radians of shoulder-line tilt for full steering (~17 degrees)
  shiftFull: 0.8,    // shoulder widths of whole-body shift for full steering
  wTorso: 0.5, wTilt: 0.3, wShift: 0.2, // blend of the lean signals (with hips in view)
  wingFull: 0.45,    // radians of wrist-to-wrist tilt for full steering (airplane arms)
  armsOut: 0.8,      // each wrist at least this many shoulder widths beyond its shoulder = arms out
  armsLevel: 1.3,    // ... and within this many shoulder widths above/below the shoulder line
  armsHold: 0.25,    // s arms must be out before airplane mode takes over
  waveSpeed: 5,      // shoulder widths/s: a wrist faster than this is waving, not flying
  deadzone: 0.15,    // |raw| below this = straight
  sensitivity: 1,    // x raw before the deadzone (2 = half the lean for the same steering)
  smooth: 0.18,      // s smoothing time constant
  baseFast: 4,       // s: baseline learning while near straight
  baseSlow: 40,      // s: ... and while steering (so a held lean keeps steering)
  centerSlow: 6,     // s: the body center follows this slowly while shifted (stepping to a new spot re-centers)
  nearStraight: 0.3, // |component - baseline| (in "full" units) below this counts as near straight
  warmup: 0.6,       // s: learn the baseline quickly at the start (and after the body was lost)
  moveRate: 0.35,    // |d ln(width)/dt| above this = walking toward/away from the camera
  jumpSpeed: 2.5,    // shoulder widths/s of vertical shoulder speed = jumping
  jumpHold: 0.35,    // s of extra-slow smoothing after the shoulders stop moving fast
  jumpSmooth: 0.7,   // s smoothing while jumping / bobbing (a landing wobble can't flick the steering)
  narrow: 0.65,      // width below this fraction of the recent wide width = turned side-on (spinning)
  turnHold: 0.4,     // s of straight after facing again
  lostFade: 0.5,     // s time constant back to straight when the body isn't seen
  countAt: 0.55,     // |value| above this = one 'lean' event
  releaseAt: 0.25,   // ... re-armed below this
  minVis: 0.5,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ok = (p, minVis) => p && p.v >= minVis && Number.isFinite(p.x) && Number.isFinite(p.y);

export function createSteerTracker(config = {}) {
  const c = { ...STEER_DEFAULTS, ...config };
  const s = {
    t: 0, value: 0, raw: 0, target: 0, mode: 'none', hold: null, seen: false,
    torso: 0, tilt: 0, shift: 0, wing: 0,          // components in "full" units, after the baseline
    base: { torso: null, tilt: null, shift: null }, center: null, warm: 0,
    wide: 0, lnW: null, wRate: 0, prevY: null, prevW: null, armsT: 0, jumpUntil: -9, turnUntil: -9,
    armed: { left: true, right: true }, count: 0, left: 0, right: 0,
  };
  const reset = () => {
    s.value = 0; s.raw = 0; s.target = 0; s.mode = 'none'; s.hold = null; s.seen = false;
    s.torso = s.tilt = s.shift = s.wing = 0;
    s.base = { torso: null, tilt: null, shift: null }; s.center = null; s.warm = 0;
    s.wide = 0; s.lnW = null; s.prevY = null; s.prevW = null; s.armsT = 0; s.jumpUntil = -9; s.turnUntil = -9;
    s.armed = { left: true, right: true };
  };

  // smoothing + deadzone-free events, shared by the real path and drive() (debug keys)
  function finish(dt, target, tau = c.smooth) {
    s.target = target;
    s.value += (target - s.value) * Math.min(1, dt / Math.max(0.01, tau));
    if (Math.abs(s.value) < 1e-4) s.value = 0;
    const events = [];
    for (const side of ['left', 'right']) {
      const v = side === 'right' ? s.value : -s.value;
      if (s.armed[side] && v >= c.countAt) { s.armed[side] = false; s.count++; s[side]++; events.push({ name: 'lean', side }); }
      if (!s.armed[side] && v <= c.releaseAt) s.armed[side] = true;
    }
    return events;
  }

  const shape = (raw) => {
    const r = raw * (c.sensitivity || 1);
    const a = Math.abs(r);
    return a <= c.deadzone ? 0 : Math.sign(r) * clamp((a - c.deadzone) / (1 - c.deadzone), 0, 1);
  };

  function learn(key, v, dt) {
    if (s.base[key] == null) { s.base[key] = v; return 0; }
    const d = v - s.base[key];
    const tau = s.warm < c.warmup ? 0.15 : Math.abs(d) < c.nearStraight ? c.baseFast : c.baseSlow;
    s.base[key] += d * Math.min(1, dt / tau);
    return v - s.base[key];
  }

  return {
    state: s,
    config: c,
    reset,
    get value() { return s.value; },

    // pts: { leftShoulder, rightShoulder, leftHip?, rightHip?, leftWrist?, rightWrist? } (norm, mirrored),
    // or null when no body is seen. aspect = camera width / height. Returns [{ name: 'lean', side }].
    update(dt, pts, aspect = 4 / 3) {
      s.t += dt;
      if (!(dt > 0)) return [];
      const A = pts && ok(pts.leftShoulder, c.minVis) && ok(pts.rightShoulder, c.minVis) ? [pts.leftShoulder, pts.rightShoulder] : null;
      if (!A) {
        s.seen = false; s.mode = 'none'; s.hold = 'lost'; s.armsT = 0; s.warm = 0; s.lnW = null; s.prevY = null;
        return finish(dt, 0, c.lostFade);
      }
      s.seen = true;
      // screen-left / screen-right shoulder (works facing either way)
      const [L, R] = A[0].x <= A[1].x ? A : [A[1], A[0]];
      const dx = (R.x - L.x) * aspect, dy = R.y - L.y;
      const w = Math.hypot(dx, dy);
      if (w < 1e-3) return finish(dt, 0);
      const mx = (L.x + R.x) / 2 * aspect, my = (L.y + R.y) / 2;
      s.warm += dt;

      // spin / side-on: the shoulder line narrows
      s.wide = Math.max(w, s.wide * Math.exp(-dt / 2.5));
      if (w < c.narrow * s.wide) s.turnUntil = s.t + c.turnHold;
      // walking toward / away from the camera
      const ln = Math.log(w);
      // (smoothed over ~0.25 s: per-frame tracker jitter in the width is several % at 12 fps)
      if (s.lnW == null) { s.lnW = ln; s.wRate = 0; }
      const prevLn = s.lnW;
      s.lnW += (ln - s.lnW) * Math.min(1, dt / 0.25);
      s.wRate += (Math.abs(s.lnW - prevLn) / dt - s.wRate) * Math.min(1, dt / 0.2);
      const moving = s.wRate > c.moveRate;
      // jumping: shoulders moving up/down fast
      const vy = s.prevY == null ? 0 : Math.abs(my - s.prevY) / dt / w;
      s.prevY = my;
      if (vy > c.jumpSpeed) s.jumpUntil = s.t + c.jumpHold;

      if (s.t < s.turnUntil) { s.hold = 'turn'; s.mode = 'none'; s.armsT = 0; s.raw = 0; return finish(dt, 0); }
      if (moving) {
        // walking: re-learn where "straight" is right here
        s.hold = 'moving'; s.center = mx; s.raw = 0;
        return finish(dt, 0);
      }
      const jumping = s.t < s.jumpUntil;
      s.hold = jumping ? 'jump' : null;

      // lean signals
      if (s.center == null) s.center = mx;
      const shiftRaw = (mx - s.center) / w / c.shiftFull;
      // the center follows slowly (stepping to a new spot re-centers in a while)
      s.center += (mx - s.center) * Math.min(1, dt / (s.warm < c.warmup ? 0.15 : Math.abs(shiftRaw) < c.nearStraight ? c.baseFast : c.centerSlow));
      s.shift = clamp(shiftRaw, -1.5, 1.5);
      s.tilt = clamp(learn('tilt', Math.atan2(dy, dx) / c.tiltFull, dt), -1.5, 1.5);
      const hipsIn = ok(pts.leftHip, c.minVis) && ok(pts.rightHip, c.minVis);
      let lean;
      if (hipsIn) {
        const hx = (pts.leftHip.x + pts.rightHip.x) / 2 * aspect;
        s.torso = clamp(learn('torso', (mx - hx) / w / c.torsoFull, dt), -1.5, 1.5);
        lean = (c.wTorso * s.torso + c.wTilt * s.tilt + c.wShift * s.shift) / (c.wTorso + c.wTilt + c.wShift);
      } else {
        s.torso = 0;
        lean = (s.tilt + s.shift) / 2; // no hips: half shoulder tilt, half whole-body shift
      }

      // airplane arms
      const lw = pts.leftWrist, rw = pts.rightWrist;
      let arms = false, wing = 0;
      if (ok(lw, c.minVis) && ok(rw, c.minVis)) {
        const [WL, WR] = lw.x <= rw.x ? [lw, rw] : [rw, lw];
        const outL = (L.x - WL.x) * aspect / w, outR = (WR.x - R.x) * aspect / w;
        const lvl = Math.max(Math.abs(WL.y - my), Math.abs(WR.y - my)) / w;
        const sp = s.prevW ? Math.max(Math.hypot((WL.x - s.prevW[0]) * aspect, WL.y - s.prevW[1]), Math.hypot((WR.x - s.prevW[2]) * aspect, WR.y - s.prevW[3])) / dt / w : 0;
        s.prevW = [WL.x, WL.y, WR.x, WR.y];
        if (outL > c.armsOut && outR > c.armsOut && lvl < c.armsLevel && sp < c.waveSpeed) s.armsT += dt; else s.armsT = 0;
        arms = s.armsT >= c.armsHold;
        if (arms) wing = Math.atan2(WR.y - WL.y, (WR.x - WL.x) * aspect) / c.wingFull - (s.base.tilt ?? 0) * c.tiltFull / c.wingFull;
      } else { s.prevW = null; s.armsT = 0; }
      s.wing = clamp(wing, -1.5, 1.5);
      s.mode = arms ? 'arms' : 'lean';
      s.raw = arms ? s.wing : lean;
      return finish(dt, shape(s.raw), jumping ? c.jumpSmooth : c.smooth);
    },

    // Drive the value directly (debug arrow keys): target -1..1, same smoothing and events.
    drive(dt, target) {
      s.t += dt;
      s.mode = target ? 'sim' : 'none'; s.hold = null; s.seen = true; s.raw = target;
      return finish(dt, clamp(target, -1, 1), 0.2);
    },
  };
}
