// Simulated playtests for steering (lean / airplane arms). Run: npm test
// A 2D stick kid: hips, a torso that leans sideways, shoulders, wrists. Distances in shoulder widths.
import { createSteerTracker } from '../src/core/steer.js';

let failures = 0;
const ASPECT = 16 / 9;

// pose(t) -> { lean (rad, + = toward screen right), shift (sw), sw (frame heights), cx, hipY, jump (sw up),
//              turn (0 facing .. 1 side-on), arms: null | { tilt (rad), out (sw), up (sw) } | 'wave' | 'flap',
//              camRoll (rad), hips (bool) }
function makePts(p, t, noise) {
  const sw = p.sw ?? 0.2, T = 1.5 * sw;
  const cos = Math.cos, sin = Math.sin;
  const hx = (p.cx ?? 0.5) * ASPECT + (p.shift ?? 0) * sw, hy = (p.hipY ?? 0.75) - (p.jump ?? 0) * sw;
  const th = p.lean ?? 0;
  const mx = hx + T * sin(th), my = hy - T * cos(th);
  const phi = th * 0.9 + (p.camRoll ?? 0);
  const half = 0.5 * sw * (1 - 0.9 * (p.turn ?? 0));
  const L = [mx - half * cos(phi), my - half * sin(phi)], R = [mx + half * cos(phi), my + half * sin(phi)];
  const out = { leftShoulder: L, rightShoulder: R };
  if (p.hips !== false) { const hh = 0.35 * sw; out.leftHip = [hx - hh * cos(phi * 0.3), hy]; out.rightHip = [hx + hh * cos(phi * 0.3), hy]; }
  const a = p.arms;
  if (a && typeof a === 'object') {
    const ang = a.tilt + (p.camRoll ?? 0), reach = (a.out ?? 1.4) * sw;
    out.leftWrist = [L[0] - reach * cos(ang), L[1] - reach * sin(ang) - (a.up ?? 0) * sw];
    out.rightWrist = [R[0] + reach * cos(ang), R[1] + reach * sin(ang) - (a.up ?? 0) * sw];
  } else if (a === 'wave') { // both hands waving fast above the head, out to the sides
    out.leftWrist = [L[0] - 1.1 * sw + 0.6 * sw * sin(t * 14), L[1] - 0.2 * sw + 0.8 * sw * cos(t * 14)];
    out.rightWrist = [R[0] + 1.1 * sw - 0.6 * sw * sin(t * 13), R[1] - 0.2 * sw + 0.8 * sw * cos(t * 13 + 1)];
  } else if (a === 'flap') { // arms out, flapping up and down together like a bird
    const f = 0.9 * sin(t * 9);
    out.leftWrist = [L[0] - 1.3 * sw * cos(f), L[1] + 1.3 * sw * sin(f)];
    out.rightWrist = [R[0] + 1.3 * sw * cos(f), R[1] + 1.3 * sw * sin(f)];
  } else if (a === 'one') { // one arm waving out to the side, the other down
    out.leftWrist = [L[0] - 1.2 * sw, L[1] + 1.2 * sw * sin(t * 12)];
    out.rightWrist = [R[0] + 0.1 * sw, R[1] + 1.4 * sw];
  } else { out.leftWrist = [L[0] + 0.05 * sw, L[1] + 1.4 * sw]; out.rightWrist = [R[0] - 0.05 * sw, R[1] + 1.4 * sw]; }
  const pts = {};
  for (const [k, [x, y]] of Object.entries(out)) pts[k] = { x: x / ASPECT + noise(0.003), y: y + noise(0.004), v: 0.95 };
  return pts;
}

function simulate(dur, pose, { fps = 30, config, lost } = {}) {
  const tr = createSteerTracker(config);
  let rng = 7;
  const noise = (a) => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 2 * a; };
  const dt = 1 / fps, ev = [], vals = [];
  for (let t = 0; t < dur; t += dt) {
    const pts = lost?.(t) ? null : makePts(pose(t), t, noise);
    for (const e of tr.update(dt, pts, ASPECT)) ev.push(`${t.toFixed(1)}${e.side[0]}`);
    vals.push({ t, v: tr.state.value, mode: tr.state.mode });
  }
  return { ev, vals, tr };
}

function check(name, dur, pose, expect, opts) {
  for (const fps of [30, 12]) {
    const r = simulate(dur, pose, { ...opts, fps });
    const res = expect(r);
    const ok = res === true;
    if (!ok) failures++;
    const maxAbs = Math.max(...r.vals.filter((x) => x.t > 1).map((x) => Math.abs(x.v)));
    console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}: leans [${r.ev.join(' ')}] max|v| ${maxAbs.toFixed(2)}${ok ? '' : ` -> ${res}`}`);
  }
}

const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
// lean schedule: [[start, end, angle]] with 0.3 s ramps
const leans = (list, extra = {}) => (t) => {
  let th = 0;
  for (const [a, b, ang] of list) if (t >= a - 0.3 && t <= b + 0.3) th = ang * Math.min(ease((t - a + 0.3) / 0.3), ease((b + 0.3 - t) / 0.3));
  return { lean: th, ...(typeof extra === 'function' ? extra(t) : extra) };
};
const count = (n, side) => ({ ev }) => {
  const got = side ? ev.filter((e) => e.endsWith(side[0])).length : ev.length;
  return got === n || `expected ${n}${side ? ' ' + side : ''} leans, got ${got}`;
};
const none = count(0);
const quiet = (lim) => ({ ev, vals }) => (ev.length === 0 && Math.max(...vals.filter((x) => x.t > 1).map((x) => Math.abs(x.v))) < lim) || `should stay straight (max |v| < ${lim})`;
const D = 0.3; // lean angle (~17 degrees)

console.log('--- leaning ---');
check('lean right, left, right, left (2 s each)', 14, leans([[2, 4, D], [5, 7, -D], [8, 10, D], [11, 13, -D]]), (r) => {
  const c = count(4)(r); if (c !== true) return c;
  return (r.ev.join(' ').match(/r/g) || []).length === 2 || 'expected 2 right + 2 left';
});
check('lean direction: right lean = positive', 4, leans([[1.5, 3.5, D]]), ({ vals }) => vals.find((x) => x.t > 2.5).v > 0.5 || 'right lean must give > 0.5');
check('gentle lean (10 deg) still steers', 6, leans([[2, 5, 0.17]]), ({ vals }) => vals.find((x) => x.t > 4).v > 0.2 || 'small lean too weak');
check('held lean keeps steering for 6 s', 10, leans([[2, 8.5, D]]), ({ vals }) => vals.find((x) => x.t > 8).v > 0.5 || 'held lean faded');
check('lean with no hips in view (close to the camera)', 10, leans([[2, 4, D], [5.5, 7.5, -D]], { hips: false }), count(2));
check('lean while the whole body shifts too', 10, leans([[2, 4, D], [5.5, 7.5, -D]], (t) => ({ shift: t > 1.7 && t < 4.3 ? 0.4 : t > 5.2 && t < 7.8 ? -0.4 : 0 })), count(2));
check('far away (small kid, 4 m)', 10, leans([[2, 4, D], [5.5, 7.5, -D]], { sw: 0.08 }), count(2));
check('close (big kid, 1 m)', 10, leans([[2, 4, D], [5.5, 7.5, -D]], { sw: 0.4, hipY: 0.95 }), count(2));
check('tilted camera (8 deg), lean both ways', 12, leans([[3, 5, D], [7, 9, -D]], { camRoll: 0.14 }), count(2));

console.log('--- airplane arms ---');
const plane = (list) => (t) => {
  let tilt = 0;
  for (const [a, b, ang] of list) if (t >= a - 0.3 && t <= b + 0.3) tilt = ang * Math.min(ease((t - a + 0.3) / 0.3), ease((b + 0.3 - t) / 0.3));
  return { arms: t > 0.5 ? { tilt } : null };
};
check('airplane arms tilt right, left, right', 11, plane([[2, 3.5, 0.5], [4.5, 6, -0.5], [7, 8.5, 0.5]]), (r) => {
  const c = count(3)(r); if (c !== true) return c;
  return r.vals.some((x) => x.mode === 'arms') || 'never in arms mode';
});
check('airplane arms held level = straight', 8, () => ({ arms: { tilt: 0 } }), quiet(0.12));

console.log('--- not steering ---');
check('standing still (tracker jitter)', 10, () => ({}), quiet(0.05));
check('natural sway (3 deg, slow)', 12, (t) => ({ lean: 0.05 * Math.sin(t * 1.3) }), quiet(0.2));
check('tilted camera (10 deg), standing still', 10, () => ({ camRoll: 0.17 }), quiet(0.12));
check('crooked natural stance', 10, () => ({ lean: 0.06, shift: 0.1 }), quiet(0.12));
check('walking closer then back (with sway)', 10, (t) => {
  const k = t < 2 ? 0 : t < 4 ? (t - 2) / 2 : t < 6 ? 1 : t < 8 ? 1 - (t - 6) / 2 : 0;
  return { sw: 0.12 + 0.18 * k, hipY: 0.7 + 0.2 * k, lean: 0.08 * Math.sin(t * 6), cx: 0.5 + 0.04 * k };
}, none);
check('jumping 5 times', 10, (t) => {
  const k = t > 1.5 ? ((t - 1.5) % 1.4) : 9;
  const j = k < 0.45 ? 0.9 * Math.sin(Math.PI * k / 0.45) : 0;
  return { jump: j, lean: k < 0.45 ? 0.08 * Math.sin(k * 20) : 0 };
}, quiet(0.4));
check('spinning 3 times', 10, (t) => {
  const k = t > 2 && t < 7 ? (t - 2) / 1.6 : 0;
  return { turn: Math.abs(Math.sin(Math.PI * k)), shift: 0.25 * Math.sin(Math.PI * 2 * k) };
}, none);
check('waving both arms fast', 8, (t) => ({ arms: t > 1 ? 'wave' : null }), quiet(0.35));
check('flapping arms like a bird', 8, (t) => ({ arms: t > 1 ? 'flap' : null }), none);
check('waving one arm', 8, (t) => ({ arms: t > 1 ? 'one' : null }), quiet(0.25));
check('body lost mid-lean fades to straight', 6, leans([[1.5, 6, D]]), ({ vals }) => Math.abs(vals[vals.length - 1].v) < 0.1 || 'should fade when lost', { lost: (t) => t > 3.5 });

if (failures) { console.log(`\n${failures} steering check(s) failed`); process.exit(1); }
console.log('\nAll steering checks passed');
