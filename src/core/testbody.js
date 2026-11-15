// A pretend body for testing without moving: keys move it, and it produces the SAME tracker samples a
// real body would (a 33-point pose, an eye line, a motion level). Pure logic (no DOM): tested by
// `npm test` (scripts/test-testinput.js), which feeds these samples through the real detectors.
//
// Nothing here emits gesture events. A jump only "happens" when height.js sees the shoulders rise, a
// spin when spin.js sees the shoulder width dip twice, a run when run.js counts the bob, and so on.
// So keyboard testing has realistic lag and ramps, and a detector bug shows up here too.
//
//   const b = createTestBody()
//   b.press('jump' | 'crouch' | 'run' | 'left' | 'right' | 'punch' | 'spin' | 'peekaboo' | 'leave' | 'still')
//   b.release(name)           // for the held ones: crouch, run, left, right, peekaboo
//   b.update(dt)              // advance time (input reaches the body `delay` s late, like a tracker)
//   b.sample(aspect)          // { pose, face, motion } right now (a NEW pose object each call)
//   b.lean                    // -1 (left) .. 1 (right), eased (for steer-style games)
//
// Units: the body is drawn in shoulder widths (sw) around the shoulder midpoint; `u` = one face size
// (sw x BODY_SCALE), the unit height.js and run.js measure in. Norm coords are mirrored (what the kid
// sees), so the subject's LEFT shoulder is on the screen's left, like a mirror.

import { BODY_SCALE } from './height.js';

export const TESTBODY_DEFAULTS = {
  delay: 0.15,      // s from key to body (a real tracker is about this far behind)
  sw: 0.16,         // shoulder width in frame heights: 'good' zone, knees and feet in view
  x0: 0.5, y0: 0.42, // shoulder midpoint (norm x, frame-height y)
  jumpUp: 2.6,      // u: jump height (real jumps move the shoulders 2-4 face sizes)
  jumpTime: 0.5,    // s in the air
  crouchDown: 4.2,  // u: shoulders drop this much in a full crouch
  crouchIn: 0.35,   // s to get all the way down
  crouchOut: 0.3,   // s back up
  runRise: 1.0,     // s of holding Run to reach full effort
  runFall: 1.0,     // s to slow to a stop after letting go
  leanRate: 3,      // 1/s: lean eases toward its target this fast
  leanShift: 0.5,   // sw: body slides this far sideways at full lean
  leanRoll: 0.3,    // rad: shoulder tilt at full lean
  punchOut: 0.15,   // s to throw a punch
  punchHold: 0.08,  // s fist out
  punchBack: 0.4,   // s pulling it back
  spinTime: 1.4,    // s per full turn
  peekIn: 0.7,      // s hands up to the face (steady, so punch.js doesn't see a punch)
  peekMin: 1.2,     // s a tap keeps the hands up (a held key: as long as it's held)
  peekOut: 0.7,     // s hands back down
  leaveTime: 0.7,   // s to walk out of (or into) the picture
  stillFor: 4,      // s a tap on Still freezes the body (any other key ends it sooner)
  jitter: 0.0012,   // landmark noise (norm), like a real tracker; 0 when frozen
  fidget: 0.02,     // motion.total of a kid standing "still" (above gestures' stillMotion)
};

const HOLD = new Set(['crouch', 'run', 'left', 'right', 'peekaboo']);

// Base skeleton in shoulder widths: [x, y, z] (x right on screen, y down, z toward camera negative).
// Index = MediaPipe pose landmark (0 nose ... 32 right foot index).
const BASE = [
  [0, -0.75, -0.3],                                         // 0 nose
  [-0.07, -0.84, -0.25], [-0.1, -0.85, -0.25], [-0.13, -0.84, -0.24], // 1-3 left eye inner/eye/outer
  [0.07, -0.84, -0.25], [0.1, -0.85, -0.25], [0.13, -0.84, -0.24],    // 4-6 right eye
  [-0.22, -0.8, -0.1], [0.22, -0.8, -0.1],                 // 7-8 ears
  [-0.06, -0.64, -0.28], [0.06, -0.64, -0.28],             // 9-10 mouth
  [-0.5, 0, 0], [0.5, 0, 0],                               // 11-12 shoulders
  [-0.62, 0.55, 0], [0.62, 0.55, 0],                       // 13-14 elbows
  [-0.6, 1.05, -0.05], [0.6, 1.05, -0.05],                 // 15-16 wrists
  [-0.62, 1.15, -0.05], [0.62, 1.15, -0.05],               // 17-18 pinky
  [-0.58, 1.17, -0.08], [0.58, 1.17, -0.08],               // 19-20 index
  [-0.55, 1.1, -0.08], [0.55, 1.1, -0.08],                 // 21-22 thumb
  [-0.33, 1.5, 0], [0.33, 1.5, 0],                         // 23-24 hips
  [-0.3, 2.4, -0.05], [0.3, 2.4, -0.05],                   // 25-26 knees
  [-0.3, 3.2, 0], [0.3, 3.2, 0],                           // 27-28 ankles
  [-0.3, 3.28, 0.05], [0.3, 3.28, 0.05],                   // 29-30 heels
  [-0.24, 3.32, -0.12], [0.24, 3.32, -0.12],               // 31-32 foot index
];
const NAMES = { nose: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28 };
const UPPER = (i) => i <= 22;      // head, arms (move with the shoulders)
const LEFT_ARM = [13, 15, 17, 19, 21], RIGHT_ARM = [14, 16, 18, 20, 22];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (k) => k * k * (3 - 2 * k);

export function createTestBody(config = {}) {
  const c = { ...TESTBODY_DEFAULTS, ...config };
  let rnd = 1; // tiny deterministic noise (tests stay repeatable)
  const noise = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 - 0.5; };
  const s = {
    clock: 0, queue: [],
    held: { crouch: false, run: false, left: false, right: false, peekaboo: false },
    jumpT: null, jumpQueued: false,
    crouch: 0, effort: 0, phase: 0, lean: 0,
    punches: [], hand: 0,
    spinT: null, spinQueued: false,
    peek: 0, peekSince: null,
    away: false, awayK: 0,
    frozenUntil: -1,
    jumps: 0, // jumps started (for tests / the HUD)
  };

  function act(name, down) {
    if (down && name !== 'still') s.frozenUntil = -1; // any move ends a freeze
    if (HOLD.has(name)) {
      s.held[name] = down;
      if (name === 'peekaboo' && down) s.peekSince = s.clock;
      return;
    }
    if (!down) return;
    if (name === 'jump') { if (s.jumpT == null) { s.jumpT = 0; s.jumps++; } else s.jumpQueued = true; }
    if (name === 'punch') { s.hand ^= 1; s.punches.push({ hand: s.hand ? 'left' : 'right', t: 0 }); }
    if (name === 'spin') { if (s.spinT == null) s.spinT = 0; else s.spinQueued = true; }
    if (name === 'leave') s.away = !s.away;
    if (name === 'still') s.frozenUntil = s.clock + c.stillFor;
  }

  const body = {
    config: c,
    state: s,
    get lean() { return s.lean; },
    get effort() { return s.effort; },
    get frozen() { return s.clock < s.frozenUntil; },
    get away() { return s.away; },

    // Key down / up. Arrives at the body `delay` s later (in update), like a real tracker's lag.
    press(name) { s.queue.push({ at: s.clock + c.delay, name, down: true }); },
    release(name) { s.queue.push({ at: s.clock + c.delay, name, down: false }); },
    releaseAll() { for (const k of HOLD) if (s.held[k]) this.release(k); },
    reset() {
      Object.assign(s, { queue: [], jumpT: null, jumpQueued: false, crouch: 0, effort: 0, phase: 0, lean: 0,
        punches: [], spinT: null, spinQueued: false, peek: 0, peekSince: null, away: false, awayK: 0, frozenUntil: -1 });
      for (const k of HOLD) s.held[k] = false;
    },

    update(dt) {
      s.clock += dt;
      while (s.queue.length && s.queue[0].at <= s.clock) { const q = s.queue.shift(); act(q.name, q.down); }
      // jump: one parabola per tap; a tap in the air jumps again right after landing
      if (s.jumpT != null) {
        s.jumpT += dt;
        if (s.jumpT >= c.jumpTime) { s.jumpT = null; }
      } else if (s.jumpQueued && s.crouch < 0.2) { s.jumpQueued = false; s.jumpT = 0; s.jumps++; }
      // crouch eases down / up
      s.crouch = clamp01(s.crouch + (s.held.crouch ? dt / c.crouchIn : -dt / c.crouchOut));
      // run effort ramps up while held, decays after
      s.effort = clamp01(s.effort + (s.held.run ? dt / c.runRise : -dt / c.runFall));
      const rate = s.effort > 0 ? 1.2 + 2.0 * s.effort : 0; // steps per second
      s.phase += rate * dt;
      // lean eases toward the held direction (both or neither = upright)
      const target = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0);
      s.lean += (target - s.lean) * Math.min(1, dt * c.leanRate);
      if (Math.abs(s.lean) < 0.002 && !target) s.lean = 0;
      // punches: out, hold, back
      for (const p of s.punches) p.t += dt;
      s.punches = s.punches.filter((p) => p.t < c.punchOut + c.punchHold + c.punchBack);
      // spin
      if (s.spinT != null) {
        s.spinT += dt;
        if (s.spinT >= c.spinTime) { s.spinT = s.spinQueued ? 0 : null; s.spinQueued = false; }
      }
      // peekaboo: hands up while held (at least peekMin for a tap)
      const covering = s.held.peekaboo || (s.peekSince != null && s.clock - s.peekSince < c.peekMin);
      s.peek = clamp01(s.peek + (covering ? dt / c.peekIn : -dt / c.peekOut));
      if (!covering && s.peek === 0) s.peekSince = null;
      // leave / return: walk off to the side
      s.awayK = clamp01(s.awayK + (s.away ? dt : -dt) / c.leaveTime);
    },

    // One tracker sample. aspect = camera width / height.
    sample(aspect = 16 / 9) {
      const sw = c.sw, u = sw * BODY_SCALE;
      const frozen = this.frozen;
      const jit = frozen ? 0 : c.jitter;
      // vertical offsets (frame heights, + = down)
      const jumpH = s.jumpT != null ? 4 * c.jumpUp * (s.jumpT / c.jumpTime) * (1 - s.jumpT / c.jumpTime) : 0;
      const drop = ease(s.crouch) * c.crouchDown * u;
      const runA = s.effort > 0.02 ? (0.2 + 0.4 * s.effort) * Math.min(1, s.effort * 8) : 0; // u
      const bob = -runA * Math.sin(2 * Math.PI * s.phase);   // shoulders up (+) / down (-) per step, in u
      const kneeP = Math.sin(Math.PI * s.phase);              // left knee up on even steps, right on odd
      const kneeLift = runA > 0 ? (0.6 + 0.8 * s.effort) : 0; // u
      const turn = s.spinT != null ? 2 * Math.PI * ease(s.spinT / c.spinTime) : 0;
      const cosT = Math.cos(turn), sinT = Math.sin(turn);
      const roll = s.lean * c.leanRoll;
      const cx = c.x0 + (s.lean * c.leanShift * sw + ease(s.awayK) * 0.9 * aspect) / aspect; // norm x of the shoulder mid
      const cy = c.y0 - jumpH * u - bob * u;

      const pts = BASE.map(([bx, by, bz], i) => {
        let x = bx, y = by, z = bz;
        // arms: punch (fist forward and in) or hands up to the face (peekaboo) or a little run pump
        const arm = LEFT_ARM.includes(i) ? 'left' : RIGHT_ARM.includes(i) ? 'right' : null;
        if (arm) {
          const side = arm === 'left' ? -1 : 1;
          const wristish = i >= 15;
          const reach = wristish ? 1 : 0.5;
          // run arm pump (opposite arms): slow enough that punch.js mustn't count it
          y += (arm === 'left' ? 1 : -1) * Math.sin(Math.PI * s.phase) * 0.18 * s.effort * reach;
          if (s.peek > 0) {
            const k = s.peek; // linear: a steady raise
            const tx = side * (wristish ? 0.16 : 0.45), ty = wristish ? -0.72 : -0.2;
            x += (tx - x) * k; y += (ty - y) * k; z += (-0.45 - z) * k * reach;
          }
          for (const p of s.punches) {
            if (p.hand !== arm) continue;
            const t = p.t;
            const k = t < c.punchOut ? ease(t / c.punchOut) : t < c.punchOut + c.punchHold ? 1 : 1 - ease((t - c.punchOut - c.punchHold) / c.punchBack);
            const tx = side * (wristish ? 0.2 : 0.45), ty = wristish ? -0.05 : 0.0, tz = wristish ? -1.3 : -0.6;
            x += (tx - x) * k * reach; y += (ty - y) * k * reach; z += (tz - z) * k * reach;
          }
        }
        // running knees (and the foot under them)
        if (runA > 0 && i >= 25) {
          const left = i % 2 === 1;
          const lift = Math.max(0, left ? kneeP : -kneeP) * kneeLift * BODY_SCALE; // u -> sw
          y -= i <= 26 ? lift : lift * 1.2;
        }
        // crouch: upper body and hips drop, knees a little, feet stay
        let dy = 0;
        if (drop) dy = UPPER(i) || i === 23 || i === 24 ? drop : i <= 26 ? drop * 0.2 : 0;
        // the run bob is the whole upper body; legs stay planted (feet don't bob)
        const legs = i >= 25;
        // spin: turn around the vertical axis (x shrinks to nothing side-on, mirrors facing away)
        const rx = x * cosT + z * sinT, rz = -x * sinT + z * cosT;
        // lean: tilt around the hips
        const ly = y - 1.5;
        const fx = rx * Math.cos(roll) - ly * Math.sin(roll), fy = rx * Math.sin(roll) + ly * Math.cos(roll) + 1.5;
        const X = cx + (fx * sw) / aspect + noise() * jit;
        const Y = (legs ? c.y0 - jumpH * u : cy) + fy * sw + dy + noise() * jit;
        // facing away: the face points aren't really seen; side-on: the far arm is hidden
        let v = 0.98;
        if (i <= 10 && cosT < 0.2) v = 0.3;
        return { x: X, y: Y, z: (rz * sw) / aspect, v };
      });
      const gone = s.awayK >= 0.95;
      const pose = gone ? { found: false, points: [] } : { found: true, points: pts, simulated: true };
      if (!gone) for (const [k, i] of Object.entries(NAMES)) pose[k] = pts[i];

      // face (for games that track the face): hidden facing away, behind hands, or out of the picture
      const faceSeen = !gone && cosT > 0.5 && s.peek < 0.6 && s.awayK < 0.5;
      const le = pts[2], re = pts[5];
      const face = faceSeen
        ? { found: true, points: [], center: pts[0], leftEye: le, rightEye: re, roll: Math.atan2(re.y - le.y, re.x - le.x),
          size: Math.hypot(re.x - le.x, re.y - le.y), mouthOpen: 0, smile: 0, blinkLeft: 0, blinkRight: 0, blend: {}, simulated: true }
        : { found: false, points: [], center: { x: 0.5, y: 0.5 }, leftEye: null, rightEye: null, roll: 0, size: 0,
          mouthOpen: 0, smile: 0, blinkLeft: 0, blinkRight: 0, blend: {}, simulated: true };

      // motion.total: a little fidget, more for every big move
      let m = frozen ? 0.002 : c.fidget;
      if (s.jumpT != null) m += 0.12;
      if (s.crouch > 0 && s.crouch < 1) m += 0.08;
      m += 0.1 * s.effort + 0.05 * Math.abs(s.lean) * (s.held.left || s.held.right ? 1 : 0);
      if (s.spinT != null) m += 0.18;
      if (s.peek > 0 && s.peek < 1) m += 0.04;
      if (s.punches.length) m += 0.08;
      if (s.awayK > 0 && s.awayK < 1) m += 0.1;
      return { pose, face, motion: Math.min(1, m), u, sw };
    },
  };
  return body;
}

// Keyboard -> body. Pure (takes { key, repeat } like a KeyboardEvent) so tests can drive it.
// Returns true when the key was a test key (the caller should preventDefault it).
export const KEYMAP = {
  ' ': 'jump', Spacebar: 'jump', ArrowDown: 'crouch', ArrowUp: 'run', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'punch', s: 'spin', p: 'peekaboo', l: 'leave', t: 'still',
  // the ?debug letters, now through the body too
  j: 'jump', x: 'punch', r: 'run',
};
export function createKeyMapper(body) {
  const down = new Set(); // keys currently held (auto-repeat sends more keydowns: ignore them)
  let crouchToggle = false;
  const nameOf = (key) => KEYMAP[key] ?? KEYMAP[key?.toLowerCase?.()] ?? (key?.toLowerCase?.() === 'c' ? 'crouch-toggle' : null);
  return {
    handles: (key) => nameOf(key) != null,
    keyDown(e) {
      const name = nameOf(e.key);
      if (!name) return false;
      const id = name;
      if (e.repeat || down.has(id)) return true; // held: one press only
      down.add(id);
      if (name === 'crouch-toggle') { crouchToggle = !crouchToggle; crouchToggle ? body.press('crouch') : body.release('crouch'); return true; }
      body.press(name);
      return true;
    },
    keyUp(e) {
      const name = nameOf(e.key);
      if (!name) return false;
      down.delete(name);
      if (HOLD.has(name)) body.release(name);
      return true;
    },
    // window lost focus: a keyup may never come, so let go of everything
    blur() { down.clear(); crouchToggle = false; body.releaseAll(); },
  };
}
