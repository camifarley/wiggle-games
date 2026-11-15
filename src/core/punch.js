// Punch / smash-move detector: a fast push or swing of either hand. Pure logic (no DOM): tested by
// `npm test` (scripts/test-punch.js + labelled real recordings via replay.js).
//
// Inputs per tracking sample: { leftWrist, rightWrist, leftShoulder, rightShoulder } as { x, y, z, v } in norm
// coords (z optional: MediaPipe's depth, same scale as x, negative = toward the camera), aspect = camera w/h.
//
// A move is judged when it ENDS (it slowed down, or `settle` s after it started): that adds ~0.1-0.25 s of
// delay but lets us check where the fist ended up (an arm whipped overhead passes shoulder height on the way).
//
// Everything is measured in SHOULDER WIDTHS and relative to the shoulders' midpoint, so it works at any
// distance and the whole body moving doesn't look like a punch.
//  speed   = how fast the SMOOTHED wrist moves (shoulder widths per second) over the last ~0.12 s. Depth (z)
//            counts at `zWeight` because a straight punch at the camera barely moves in the picture.
//  travel  = how far it went in the last `travelTime` s
//  punch   = speed > `speed` AND travel > `travel` AND the move is a BURST (well above what that hand was doing
//            just before) AND it reaches about shoulder height (or is a huge swing), then a `cooldown`.
//
// What real recordings taught us (v2, fixtures.local: punch / run / lean / toy / distance):
//  - A wrist below the bottom of the picture still gets a position, but it's a guess (visibility 0.1-0.4) that
//    jumps around: "punches while I wasn't moving". Only wrists IN the picture with `minVis` count, and the
//    speed window must be made of good samples only.
//  - Raw wrist landmarks jitter by ~0.1-0.3 shoulder widths per frame, so a 0.12 s speed over raw points was
//    above the old threshold while standing still. Wrists are smoothed first (`smooth` s time constant).
//  - Running in place pumps the arms all the time. A punch is a BURST: its speed must be `burst` times the
//    hand's own recent activity (average speed over the `preTime` s before it), not just fast.
//  - Walking, leaning, ducking to the camera: shoulders move too. While the shoulder midpoint moves SIDEWAYS
//    faster than `bodyMax` shoulder widths/s (up/down is the running bob: punching while running must work) (or the shoulder line tilts faster than `tiltMax` rad/s, or its width
//    changes faster than `sizeMax` /s) nothing counts, and for `bodyHold` s after.
//  - A punch at the screen ENDS around shoulder height: between `minUp` and `maxUp` shoulder widths from the
//    shoulder line (arms raised to show a toy end higher), and the move overall isn't mostly downward.
// Not punches either:
//  - SLOW ARM RAISE: too slow.   CLAPPING: both hands rush straight toward each other (or bounce apart).
//  - PULLING BACK: after a punch, that hand moving back the opposite way (for `recoil` s).
//  - RUNNING ARM PUMP: both hands swing at once in opposite up/down directions: needs `pumpBoost` x speed.
//  - ARM DROPPING: a move that is mostly downward (after raising an arm, or a hammer smash) doesn't count.
// Both fists punching at once = one punch with hand 'both'.
// `sensitivity` (default 1) divides the speed, travel and burst thresholds and lengthens `settle` (2 = twice as easy).

export const PUNCH_DEFAULTS = {
  speed: 3,          // shoulder widths / s (smoothed wrist)
  travel: 0.6,       // shoulder widths moved within travelTime
  travelTime: 0.35,  // s
  velWindow: 0.12,   // s used for the speed estimate
  smooth: 0.05,      // s: wrist smoothing time constant (kills landmark jitter)
  burst: 4,          // speed must be this many times the hand's activity in the preTime before
  preTime: [0.3, 0.9], // s before now: the window that measures "what the hand was doing before"
  minUp: -0.3,       // fist must end at most this many shoulder widths BELOW the shoulder line...
  bigTravel: 99,     // ...unless it travelled this far (off: real arm swings while running reached 2.2)
  down: 0.5,         // a move that is mostly DOWNWARD (arm dropping after being raised) isn't a punch
  maxUp: 0.5,        // fist ending higher than this above the shoulder line = arm raised up (showing a toy), not a punch
  bodyMax: 1.6,      // shoulder midpoint faster than this (shoulder widths / s) = the body is moving
  tiltMax: 2.5,      // rad / s of shoulder-line tilt = leaning / turning
  sizeMax: 1.5,      // |d ln(shoulder width) / dt| = walking toward / away from the camera
  bodyHold: 0.3,     // s after body motion before punches count again
  edge: 0.03,
  offCalm: 0.25,     // s a hand must have been out of the picture for its entry to count as 'calm before'        // wrists closer than this to the picture's edge (or outside) don't count
  cooldown: 0.35,    // s per hand
  settle: 0.3,       // s: a move is judged when it slows down; still going this long after it started = not a punch
  bothWithin: 0.15,  // s: the other hand punching this soon after = one two-hand smash
  zWeight: 0.5,      // depth counts this much (noisy, but a straight punch is mostly depth)
  clapDist: 2.0,     // hands within this (shoulder widths) rushing straight at each other (or apart) = a clap
  clapHold: 0.3,     // s a clap keeps blocking punches (covers the bounce apart)
  recoil: 1.2,       // s after a punch: pulling that hand back (moving the opposite way) doesn't count
  pumpBoost: 1.7,    // arm pump only counts above speed x this
  minVis: 0.5,       // wrist landmark visibility needed
  maxJump: 2.5,      // shoulder widths in one sample = tracking glitch, restart that hand
  sensitivity: 1,
};

export function createPunchTracker(config = {}) {
  const c = { ...PUNCH_DEFAULTS, ...config };
  const hand = () => ({ pending: null, hist: [], offT: 9, enteredAt: -9, sx: null, sy: null, sz: 0, speed: 0, travel: 0, vx: 0, vy: 0, vz: 0, last: -9, dir: null, x: 0, y: 0, nx: 0, ny: 0, pre: 0 });
  const s = { t: 0, sw: null, hands: { left: hand(), right: hand() }, value: 0, lastPunch: -9, lastHand: null, clap: false, clapUntil: -9, pump: false,
    count: 0, body: null, bodySpeed: 0, bodyUntil: -9, moving: false };
  const vis = (p) => p && p.v >= c.minVis;
  const inPic = (p) => p.x > c.edge && p.x < 1 - c.edge && p.y > c.edge && p.y < 1 - c.edge;
  const resetHand = (h) => { h.hist = []; h.sx = null; h.speed = 0; h.travel = 0; };

  return {
    state: s,
    config: c,
    reset() { s.sw = null; s.hands = { left: hand(), right: hand() }; s.value = 0; s.clap = false; s.pump = false; s.body = null; s.bodyUntil = -9; s.moving = false; },

    // Returns a list of { name: 'punch', hand: 'left' | 'right' | 'both', speed, x, y } (x, y = wrist, norm).
    update(dt, pts, aspect = 4 / 3) {
      const events = [];
      s.t += dt;
      const ls = pts?.leftShoulder, rs = pts?.rightShoulder;
      if (!(ls?.v >= 0.5) || !(rs?.v >= 0.5)) { s.value = 0; s.body = null; for (const h of Object.values(s.hands)) resetHand(h); return events; }
      const swNow = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
      if (!(swNow > 0.01)) return events;
      // shoulder width moves slowly (turning/arms can make it flicker)
      s.sw = s.sw == null ? swNow : s.sw + (swNow - s.sw) * Math.min(1, dt / 0.5);
      const sw = s.sw;
      const mx = (ls.x + rs.x) / 2, my = (ls.y + rs.y) / 2;
      const tilt = Math.atan2(rs.y - ls.y, (rs.x - ls.x) * aspect);
      // whole-body motion: the shoulders moving, tilting or growing/shrinking
      if (s.body && dt > 0) {
        const k = Math.min(1, dt / 0.1);
        const v = Math.abs((mx - s.body.mx) * aspect) / sw / dt; // sideways only: running in place bobs up and down
        const tr = Math.abs(tilt - s.body.tilt) / dt;
        const zr = Math.abs(Math.log(swNow / s.body.sw)) / dt;
        s.bodySpeed += (v - s.bodySpeed) * k;
        s.tiltRate = (s.tiltRate || 0) + (tr - (s.tiltRate || 0)) * k;
        s.sizeRate = (s.sizeRate || 0) + (zr - (s.sizeRate || 0)) * k;
        if (s.bodySpeed > c.bodyMax || s.tiltRate > c.tiltMax || s.sizeRate > c.sizeMax) s.bodyUntil = s.t + c.bodyHold;
      }
      s.body = { mx, my, tilt, sw: swNow };
      s.moving = s.t < s.bodyUntil;
      const sens = Math.max(0.2, c.sensitivity || 1);
      const speedTh = c.speed / sens, travelTh = c.travel / sens;
      const ks = 1 - Math.exp(-dt / Math.max(1e-3, c.smooth));

      for (const name of ['left', 'right']) {
        const h = s.hands[name];
        const w = pts[name + 'Wrist'];
        // a wrist off the picture (or barely seen) is a guess: forget this hand until it's back
        if (!vis(w) || !inPic(w)) { resetHand(h); h.offT += dt; continue; }
        // back in the picture after resting outside it (fist coming up from below): calm before, by definition
        if (h.offT >= c.offCalm && !h.hist.length) h.enteredAt = s.t;
        h.offT = 0;
        const rx = ((w.x - mx) * aspect) / sw, ry = (w.y - my) / sw, rz = ((w.z ?? 0) * aspect) / sw;
        if (h.sx != null && Math.hypot(rx - h.sx, ry - h.sy) > c.maxJump) resetHand(h);
        if (h.sx == null) { h.sx = rx; h.sy = ry; h.sz = rz; } else { h.sx += (rx - h.sx) * ks; h.sy += (ry - h.sy) * ks; h.sz += (rz - h.sz) * ks; }
        const x = h.sx, y = h.sy, z = h.sz;
        h.nx = w.x; h.ny = w.y;
        h.hist.push({ t: s.t, x, y, z, speed: 0 });
        while (h.hist.length > 2 && h.hist[0].t < s.t - Math.max(c.travelTime, c.velWindow, c.preTime[1]) - 0.05) h.hist.shift();
        h.x = x; h.y = y;
        // speed: from the oldest sample inside velWindow (at least one sample back)
        let ref = null;
        for (let i = h.hist.length - 2; i >= 0; i--) { ref = h.hist[i]; if (s.t - ref.t >= c.velWindow) break; }
        if (!ref) { h.speed = 0; h.travel = 0; continue; }
        const span = Math.max(1e-3, s.t - ref.t);
        h.vx = (x - ref.x) / span; h.vy = (y - ref.y) / span;
        h.vz = ((z - ref.z) / span) * c.zWeight;
        h.speed = Math.hypot(h.vx, h.vy, h.vz);
        h.hist[h.hist.length - 1].speed = h.speed;
        h.travel = 0;
        let preSum = 0, preN = 0;
        for (const p of h.hist) {
          const age = s.t - p.t;
          if (age <= c.travelTime + 1e-6) h.travel = Math.max(h.travel, Math.hypot(x - p.x, y - p.y, (z - p.z) * c.zWeight));
          if (age >= c.preTime[0] && age <= c.preTime[1]) { preSum += p.speed; preN++; }
        }
        // no history before = we just started seeing this hand: assume it was busy (no instant punch)
        h.pre = preN ? preSum / preN : s.t - h.enteredAt <= c.travelTime + 0.1 ? 0 : Infinity;
      }

      const L = s.hands.left, R = s.hands.right;
      // clap / pump need both hands tracked for a moment (a hand that just reappeared has garbage speed)
      const steady = (h) => h.hist.length > 2 && s.t - h.hist[0].t >= c.velWindow;
      const both = steady(L) && steady(R);
      // clap: both hands fast, moving (almost) straight toward each other or bouncing apart, mostly sideways
      const gap = both ? Math.hypot(L.x - R.x, L.y - R.y) : 9;
      const rel = both ? Math.abs((L.x - R.x) * (L.vx - R.vx) + (L.y - R.y) * (L.vy - R.vy)) / Math.max(gap, 1e-3) : 0;
      const sum2d = Math.hypot(L.vx, L.vy) + Math.hypot(R.vx, R.vy);
      const sideways = Math.abs(L.vx) + Math.abs(R.vx) > 1.5 * (Math.abs(L.vy) + Math.abs(R.vy));
      if (both && gap < c.clapDist && L.speed > speedTh * 0.5 && R.speed > speedTh * 0.5 && rel > Math.max(0.75 * sum2d, speedTh) && sideways) s.clapUntil = s.t + c.clapHold;
      s.clap = s.t < s.clapUntil;
      // arm pump: both hands fast at once, in opposite up/down directions, mostly vertical
      s.pump = both && L.speed > speedTh * 0.5 && R.speed > speedTh * 0.5 && L.vy * R.vy < 0 &&
        Math.abs(L.vy) > Math.abs(L.vx) && Math.abs(R.vy) > Math.abs(R.vx);
      const need = s.pump ? speedTh * c.pumpBoost : speedTh;
      s.value = Math.max(L.speed, R.speed) / speedTh;

      // 1) a hand STARTS a candidate move: fast, far, a burst over what it was doing, body still, no clap
      for (const name of ['left', 'right']) {
        const h = s.hands[name];
        if (h.pending || h.hist.length < 2 || s.clap || s.moving || s.t - h.last < c.cooldown) continue;
        if (h.speed < need || h.travel < travelTh || h.speed < Math.max(1.5, c.burst / sens) * h.pre) continue;
        // pulling the fist back after a punch isn't another punch
        if (h.dir && s.t - h.last < c.recoil && h.vx * h.dir[0] + h.vy * h.dir[1] < 0) continue;
        // the move started at the farthest point within travelTime
        let start = h.hist[0], far = -1;
        for (const p of h.hist) if (s.t - p.t <= c.travelTime + 1e-6) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d > far) { far = d; start = p; } }
        h.pending = { t: s.t, x0: start.x, y0: start.y, peak: h.speed, travel: h.travel };
      }
      // 2) ...and it's judged when it ENDS (slowed down, or after `settle` s): where did the fist end up?
      const done = [];
      for (const name of ['left', 'right']) {
        const h = s.hands[name], p = h.pending;
        if (!p) continue;
        p.peak = Math.max(p.peak, h.speed);
        p.travel = Math.max(p.travel, h.travel);
        if (s.moving || s.clap) { h.pending = null; continue; }
        const lost = !h.hist.length;
        const stillGoing = !lost && h.speed > p.peak * 0.45;
        if (stillGoing && s.t - p.t < c.settle * Math.max(1, sens)) continue;
        h.pending = null;
        if (stillGoing) continue; // a long smooth sweep (raising an arm, waving) never stops like a punch does
        const dx = h.x - p.x0, dy = h.y - p.y0, dist = Math.hypot(dx, dy);
        const up = -h.y;
        const ok = up <= c.maxUp && dy <= c.down * dist && (up >= c.minUp || p.travel >= c.bigTravel / sens);
        if (!ok) continue;
        h.last = s.t;
        h.dir = [dx, dy];
        done.push({ name, h, speed: p.peak });
      }
      if (done.length === 2) {
        s.lastPunch = s.t; s.lastHand = 'both'; s.count++;
        events.push({ name: 'punch', hand: 'both', speed: Math.max(done[0].speed, done[1].speed) / speedTh, x: (L.nx + R.nx) / 2, y: (L.ny + R.ny) / 2 });
      } else if (done.length === 1) {
        const { name, h, speed } = done[0];
        const other = s.hands[name === 'left' ? 'right' : 'left'];
        if (s.t - s.lastPunch <= c.bothWithin && s.lastHand && s.lastHand !== name && s.lastHand !== 'both') {
          // the second fist of a two-fist punch, a moment later: it's the same punch
          s.lastHand = 'both';
        } else if ((other.pending && s.t - other.pending.t <= c.bothWithin) ||
          (other.travel >= travelTh * 0.8 && other.hist.some((q) => s.t - q.t <= c.travelTime && q.speed >= need * 0.6))) {
          // the other fist made the same move at the same time: count once, as both
          other.pending = null; other.last = s.t;
          s.lastPunch = s.t; s.lastHand = 'both'; s.count++;
          events.push({ name: 'punch', hand: 'both', speed: speed / speedTh, x: (L.nx + R.nx) / 2, y: (L.ny + R.ny) / 2 });
        } else {
          s.lastPunch = s.t; s.lastHand = name; s.count++;
          events.push({ name: 'punch', hand: name, speed: speed / speedTh, x: h.nx, y: h.ny });
        }
      }
      return events;
    },
  };
}
