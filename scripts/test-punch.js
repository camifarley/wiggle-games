// Simulated playtests for punch / smash detection (wrists vs shoulders). Run: npm test
import { createPunchTracker } from '../src/core/punch.js';

let failures = 0;
const ASPECT = 16 / 9;
const SW = 0.22;             // shoulder width in frame heights (kid ~2.5 m away)
const SWX = SW / ASPECT;     // ... in norm x units

// A pose generator: body(t) -> { mx, my, scale }, hands(t) -> { l: [ux, uy, uz], r: [...] } in shoulder widths
function simulate(name, dur, hands, { fps = 30, body = () => ({ mx: 0.5, my: 0.45, scale: 1 }), config, lostRight } = {}) {
  const tr = createPunchTracker(config);
  const dt = 1 / fps;
  let rng = 5;
  const noise = (a) => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 2 * a; };
  const got = [];
  for (let t = 0; t < dur; t += dt) {
    const b = body(t), hs = hands(t);
    const sx = SWX * b.scale, sy = SW * b.scale;
    const P = (ux, uy, uz = 0) => ({ x: b.mx + ux * sx + noise(0.002), y: b.my + uy * sy + noise(0.003), z: uz * sx + noise(0.01), v: 0.95 });
    const pts = {
      leftShoulder: P(-0.5, 0), rightShoulder: P(0.5, 0),
      leftWrist: P(...hs.l), rightWrist: lostRight?.(t) ? { x: 0, y: 0, v: 0.1 } : P(...hs.r),
    };
    for (const e of tr.update(dt, pts, ASPECT)) got.push(`${t.toFixed(2)}${e.hand[0]}`);
  }
  return got;
}

function check(name, dur, hands, expected, opts = {}) {
  for (const fps of [30, 12]) {
    const got = simulate(name, dur, hands, { ...opts, fps });
    const ok = typeof expected === 'function' ? expected(got) : got.length === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}: expected ${typeof expected === 'function' ? expected.label : expected}, got ${got.length} [${got.join(' ')}]`);
  }
}

// --- helpers ---
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
// a keyframed path: [[t, [ux, uy, uz]], ...] (held before the first / after the last key)
const path = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ease((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};
const SIDE_L = [-0.6, 1.6, 0], SIDE_R = [0.6, 1.6, 0];
const GUARD_L = [-0.4, 0.6, 0], GUARD_R = [0.4, 0.6, 0];
const still = (l, r) => () => ({ l, r });

// alternating straight punches at the camera: fist from the chest to straight ahead (mostly depth)
function punches(n, { out = 0.16, hold = 0.15, back = 0.3, pause = 0.45 } = {}) {
  const L = [[0, GUARD_L]], R = [[0, GUARD_R]];
  let t = 1;
  for (let i = 0; i < n; i++) {
    const keys = i % 2 ? R : L, guard = i % 2 ? GUARD_R : GUARD_L, sign = i % 2 ? 1 : -1;
    keys.push([t, guard], [t + out, [sign * 0.15, 0.05, -1.2]], [t + out + hold, [sign * 0.15, 0.05, -1.2]], [t + out + hold + back, guard]);
    t += out + hold + back + pause;
  }
  const l = path(L), r = path(R);
  return { dur: t + 0.5, hands: (tt) => ({ l: l(tt), r: r(tt) }) };
}

{ const p = punches(6); check('6 alternating straight punches', p.dur, p.hands, 6); }
{ const p = punches(6, { out: 0.26, pause: 0.3 }); check('6 slower, lazier punches (generous)', p.dur, p.hands, 6); }
{
  // big side swings, alternating hands
  const L = path([[0, SIDE_L], [1, [-1.2, 0.8, 0]], [1.3, [1.0, 0.3, 0]], [1.9, SIDE_L], [3, SIDE_L], [3.3, [1.0, 0.3, 0]], [3.9, SIDE_L]]);
  const R = path([[0, SIDE_R], [2, [1.2, 0.8, 0]], [2.3, [-1.0, 0.3, 0]], [2.9, SIDE_R], [4, SIDE_R], [4.3, [-1.0, 0.3, 0]], [4.9, SIDE_R]]);
  check('4 big side swings', 5.5, (t) => ({ l: L(t), r: R(t) }), 4);
}
{
  // two-hand hammer smash from overhead, 3 times
  // arms already up, smash down fast, lift them back up slowly
  const keys = (sx) => { const k = [[0, [sx, -1.2, 0]]]; for (let i = 0; i < 3; i++) { const t = 1 + i * 2.2; k.push([t, [sx, -1.2, 0]], [t + 0.25, [sx, 1.0, 0]], [t + 0.6, [sx, 1.0, 0]], [t + 2.0, [sx, -1.2, 0]]); } return path(k); };
  const L = keys(-0.3), R = keys(0.3);
  const want = (g) => g.length === 3 && g.every((e) => e.endsWith('b')); want.label = "3 (both hands)";
  check('3 two-hand hammer smashes', 7.5, (t) => ({ l: L(t), r: R(t) }), want);
}
{
  const L = path([[0.5, SIDE_L], [2.0, [-0.6, -1.4, 0]], [3.5, SIDE_L]]);
  const R = path([[0.5, SIDE_R], [2.0, [0.6, -1.4, 0]], [3.5, SIDE_R]]);
  check('slow arm raise (both arms up and down)', 4, (t) => ({ l: L(t), r: R(t) }), 0);
}
{
  // clapping: hands rush together in front of the chest and bounce apart, 6 claps
  const kl = [[0, [-0.9, 0.7, 0]]], kr = [[0, [0.9, 0.7, 0]]];
  for (let i = 0; i < 6; i++) { const t = 0.8 + i * 0.55; kl.push([t, [-0.9, 0.7, 0]], [t + 0.15, [-0.08, 0.7, 0]], [t + 0.35, [-0.9, 0.7, 0]]); kr.push([t, [0.9, 0.7, 0]], [t + 0.15, [0.08, 0.7, 0]], [t + 0.35, [0.9, 0.7, 0]]); }
  const L = path(kl), R = path(kr);
  check('clapping 6 times', 4.5, (t) => ({ l: L(t), r: R(t) }), 0);
}
{
  // running arm pump at 2.8 steps/s, hands swing up/down in turn, the whole body bobs
  const f = 2.8 / 2, A = 0.3;
  const hands = (t) => ({ l: [-0.45, 0.7 + A * Math.sin(2 * Math.PI * f * t), 0.1 * Math.cos(2 * Math.PI * f * t)], r: [0.45, 0.7 - A * Math.sin(2 * Math.PI * f * t), -0.1 * Math.cos(2 * Math.PI * f * t)] });
  const body = (t) => ({ mx: 0.5, my: 0.45 - 0.08 * Math.abs(Math.sin(Math.PI * 2.8 * t)), scale: 1 });
  check('running arm pump (normal intensity)', 6, hands, 0, { body });
}
check('standing still', 4, still(SIDE_L, SIDE_R), 0);
check('running in place, hands still at guard (body bobs)', 5, still(GUARD_L, GUARD_R), 0,
  { body: (t) => ({ mx: 0.5, my: 0.45 - 0.3 * SW * Math.abs(Math.sin(Math.PI * 2.8 * t)), scale: 1 }) });
check('walking closer (body grows 40%)', 3, still(SIDE_L, SIDE_R), 0,
  { body: (t) => ({ mx: 0.5, my: 0.45 + 0.05 * Math.min(1, t / 1.5), scale: 1 + 0.4 * Math.min(1, t / 1.5) }) });
{
  // one punch while the other hand flickers in and out of tracking: still exactly one
  const p = punches(1);
  check('one punch, other hand flickering', p.dur, p.hands, 1, { lostRight: (t) => Math.floor(t * 7) % 2 === 0 });
}
{
  // sensitivity: a slow push is ignored by default and counted when the parent turns sensitivity up
  const p = punches(3, { out: 0.6, back: 0.6 });
  check('3 very slow pushes, default sensitivity', p.dur, p.hands, 0);
  check('3 very slow pushes, sensitivity 2.5', p.dur, p.hands, 3, { config: { sensitivity: 2.5 } });
}

if (failures) { console.log(`\n${failures} punch scenario(s) failed`); process.exit(1); }
console.log('\nAll punch scenarios passed');
