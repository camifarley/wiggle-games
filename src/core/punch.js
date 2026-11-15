// Punch / smash-move detector: a fast push or swing of either hand. Pure logic (no DOM): tested by
// `npm test` (scripts/test-punch.js + labelled real recordings via replay.js).
//
// Inputs per tracking sample: { leftWrist, rightWrist, leftShoulder, rightShoulder } as { x, y, z, v } in norm
// coords (z optional: MediaPipe's depth, same scale as x, negative = toward the camera), aspect = camera w/h.
//
// Everything is measured in SHOULDER WIDTHS and relative to the shoulders' midpoint, so it works at any
// distance and running/jumping (the whole body moving) doesn't look like a punch.
//  speed   = how fast the wrist moves (shoulder widths per second), over the last ~0.12 s. Depth (z) counts
//            at `zWeight` because a straight punch at the camera barely moves in the picture.
//  travel  = how far it went in the last `travelTime` s (rules out one-sample tracker jumps)
//  punch   = speed > `speed` AND travel > `travel`, then a `cooldown` for that hand.
// Not punches:
//  - SLOW ARM RAISE: too slow.
//  - CLAPPING: both hands rush straight toward each other (or bounce apart) at the same time.
//  - PULLING BACK: after a punch, that hand moving back the opposite way (for `recoil` s).
//  - RUNNING ARM PUMP: both hands swing at the same time in opposite up/down directions with a short
//    travel. A pump only counts when it's `pumpBoost` times faster than a punch (wild flailing = smashing).
// Two hands smashing together (hammer) = one punch with hand 'both'.
// `sensitivity` (default 1) divides the speed and travel thresholds (2 = twice as easy).

export const PUNCH_DEFAULTS = {
  speed: 3.5,        // shoulder widths / s
  travel: 0.55,      // shoulder widths moved within travelTime
  travelTime: 0.3,   // s
  velWindow: 0.12,   // s used for the speed estimate
  cooldown: 0.35,    // s per hand
  bothWithin: 0.12,  // s: the other hand punching this soon after = one two-hand smash
  zWeight: 0.5,      // depth counts this much (noisy, but a straight punch is mostly depth)
  clapDist: 2.0,     // hands within this (shoulder widths) rushing straight at each other (or apart) = a clap
  clapHold: 0.3,     // s a clap keeps blocking punches (covers the bounce apart)
  recoil: 1.2,       // s after a punch: pulling that hand back (moving the opposite way) doesn't count
  pumpBoost: 1.7,    // arm pump only counts above speed x this
  minVis: 0.4,
  maxJump: 2.5,      // shoulder widths in one sample = tracking glitch, restart that hand
  sensitivity: 1,
};

export function createPunchTracker(config = {}) {
  const c = { ...PUNCH_DEFAULTS, ...config };
  const hand = () => ({ hist: [], speed: 0, travel: 0, vx: 0, vy: 0, vz: 0, last: -9, dir: null, x: 0, y: 0, nx: 0, ny: 0 });
  const s = { t: 0, sw: null, hands: { left: hand(), right: hand() }, value: 0, lastPunch: -9, lastHand: null, clap: false, clapUntil: -9, pump: false, count: 0 };
  const ok = (p) => p && p.v >= c.minVis;

  return {
    state: s,
    config: c,
    reset() { s.sw = null; s.hands = { left: hand(), right: hand() }; s.value = 0; s.clap = false; s.pump = false; },

    // Returns a list of { name: 'punch', hand: 'left' | 'right' | 'both', speed, x, y } (x, y = wrist, norm).
    update(dt, pts, aspect = 4 / 3) {
      const events = [];
      s.t += dt;
      const ls = pts?.leftShoulder, rs = pts?.rightShoulder;
      if (!ok(ls) || !ok(rs)) { s.value = 0; for (const h of Object.values(s.hands)) h.hist = []; return events; }
      const swNow = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
      if (!(swNow > 0.01)) return events;
      // shoulder width moves slowly (turning/arms can make it flicker)
      s.sw = s.sw == null ? swNow : s.sw + (swNow - s.sw) * Math.min(1, dt / 0.5);
      const sw = s.sw;
      const mx = (ls.x + rs.x) / 2, my = (ls.y + rs.y) / 2;
      const sens = Math.max(0.2, c.sensitivity || 1);
      const speedTh = c.speed / sens, travelTh = c.travel / sens;

      for (const name of ['left', 'right']) {
        const h = s.hands[name];
        const w = pts[name + 'Wrist'];
        if (!ok(w)) { h.hist = []; h.speed = 0; h.travel = 0; continue; }
        const x = ((w.x - mx) * aspect) / sw, y = (w.y - my) / sw, z = ((w.z ?? 0) * aspect) / sw;
        h.nx = w.x; h.ny = w.y;
        const prev = h.hist[h.hist.length - 1];
        if (prev && Math.hypot(x - prev.x, y - prev.y) > c.maxJump) h.hist = [];
        h.hist.push({ t: s.t, x, y, z });
        while (h.hist.length > 2 && h.hist[0].t < s.t - Math.max(c.travelTime, c.velWindow) - 0.05) h.hist.shift();
        h.x = x; h.y = y;
        // speed: from the oldest sample inside velWindow (at least one sample back)
        let ref = null;
        for (let i = h.hist.length - 2; i >= 0; i--) { ref = h.hist[i]; if (s.t - ref.t >= c.velWindow) break; }
        if (!ref) { h.speed = 0; h.travel = 0; continue; }
        const span = Math.max(1e-3, s.t - ref.t);
        h.vx = (x - ref.x) / span; h.vy = (y - ref.y) / span;
        h.vz = ((z - ref.z) / span) * c.zWeight;
        h.speed = Math.hypot(h.vx, h.vy, h.vz);
        h.travel = 0;
        for (const p of h.hist) if (s.t - p.t <= c.travelTime + 1e-6) h.travel = Math.max(h.travel, Math.hypot(x - p.x, y - p.y, (z - p.z) * c.zWeight));
      }

      const L = s.hands.left, R = s.hands.right;
      const both = L.hist.length && R.hist.length;
      // clap: both hands fast, moving (almost) straight toward each other, or bouncing apart
      const gap = both ? Math.hypot(L.x - R.x, L.y - R.y) : 9;
      const rel = both ? Math.abs((L.x - R.x) * (L.vx - R.vx) + (L.y - R.y) * (L.vy - R.vy)) / Math.max(gap, 1e-3) : 0;
      const sum2d = Math.hypot(L.vx, L.vy) + Math.hypot(R.vx, R.vy);
      if (both && gap < c.clapDist && L.speed > speedTh * 0.5 && R.speed > speedTh * 0.5 && rel > 0.75 * sum2d) s.clapUntil = s.t + c.clapHold;
      s.clap = s.t < s.clapUntil;
      // arm pump: both hands fast at once, in opposite up/down directions, mostly vertical
      s.pump = both && L.speed > speedTh * 0.5 && R.speed > speedTh * 0.5 && L.vy * R.vy < 0 &&
        Math.abs(L.vy) > Math.abs(L.vx) && Math.abs(R.vy) > Math.abs(R.vx);
      const need = s.pump ? speedTh * c.pumpBoost : speedTh;
      s.value = Math.max(L.speed, R.speed) / speedTh;

      for (const name of ['left', 'right']) {
        const h = s.hands[name];
        if (s.clap || h.speed < need || h.travel < travelTh || s.t - h.last < c.cooldown) continue;
        // pulling the fist back after a punch isn't another punch
        if (h.dir && s.t - h.last < c.recoil && h.vx * h.dir[0] + h.vy * h.dir[1] + h.vz * h.dir[2] < 0) continue;
        h.last = s.t;
        h.dir = [h.vx, h.vy, h.vz];
        const other = s.hands[name === 'left' ? 'right' : 'left'];
        if (s.t - s.lastPunch <= c.bothWithin && s.lastHand && s.lastHand !== name) {
          // the second hand of a two-hand smash: upgrade the previous punch instead of counting another
          other.last = s.t; other.dir = [other.vx, other.vy, other.vz]; s.lastHand = 'both';
          const prev = events[events.length - 1];
          if (prev) prev.hand = 'both';
          continue;
        }
        if (other.speed >= need && other.travel >= travelTh && s.t - other.last >= c.cooldown) {
          other.last = s.t; other.dir = [other.vx, other.vy, other.vz];
          s.lastPunch = s.t; s.lastHand = 'both'; s.count++;
          events.push({ name: 'punch', hand: 'both', speed: Math.max(h.speed, other.speed) / speedTh, x: (h.nx + other.nx) / 2, y: (h.ny + other.ny) / 2 });
          break;
        }
        s.lastPunch = s.t; s.lastHand = name; s.count++;
        events.push({ name: 'punch', hand: name, speed: h.speed / speedTh, x: h.nx, y: h.ny });
      }
      return events;
    },
  };
}
