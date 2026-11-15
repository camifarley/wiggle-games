// Simulated playtests for punch / smash detection (wrists vs shoulders). Run: npm test
import { createPunchTracker } from '../src/core/punch.js';

let failures = 0;
const ASPECT = 16 / 9;
const SW = 0.22;             // shoulder width in frame heights (kid ~2.5 m away)
const SWX = SW / ASPECT;     // ... in norm x units

// Realistic landmark jitter (v2): real recordings show raw wrists jumping ~0.1-0.3 shoulder widths per frame
// even when the hand is still (fixtures.local, 2026-11-15). The first version of these scenarios used almost no
// jitter (~0.015), which is why it passed while real standing still fired punches. Every scenario now uses
// JITTER (shoulder widths, uniform +-) on the wrists unless it says otherwise.
const JITTER = 0.12;

// A pose generator: body(t) -> { mx, my, scale }, hands(t) -> { l: [ux, uy, uz], r: [...] } in shoulder widths
// vis(t, side) -> wrist visibility (default 0.9)
function simulate(name, dur, hands, { fps = 30, body = () => ({ mx: 0.5, my: 0.45, scale: 1 }), config, lostRight, jitter = JITTER, vis } = {}) {
  const tr = createPunchTracker(config);
  const dt = 1 / fps;
  let rng = 5;
  const noise = (a) => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 2 * a; };
  const got = [];
  for (let t = 0; t < dur; t += dt) {
    const b = body(t), hs = hands(t);
    const sx = SWX * b.scale, sy = SW * b.scale;
    const P = (ux, uy, uz = 0, j = 0.01, v = 0.95) => ({ x: b.mx + (ux + noise(j)) * sx, y: b.my + (uy + noise(j)) * sy, z: (uz + noise(j * 3)) * sx, v });
    const pts = {
      leftShoulder: P(-0.5, 0), rightShoulder: P(0.5, 0),
      leftWrist: P(...hs.l.slice(0, 3), jitter, vis ? vis(t, 'l') : 0.9),
      rightWrist: lostRight?.(t) ? { x: 0, y: 0, v: 0.1 } : P(...hs.r.slice(0, 3), jitter, vis ? vis(t, 'r') : 0.9),
    };
    const evs = tr.update(dt, pts, ASPECT);
    for (const e of evs) got.push(`${t.toFixed(2)}${e.hand[0]}`);
    // TRACE="scenario name part" TRACE_FPS=30 node scripts/test-punch.js  prints what the detector saw
    if (process.env.TRACE && name.includes(process.env.TRACE) && fps === +(process.env.TRACE_FPS || 30)) {
      for (const [n, h] of Object.entries(tr.state.hands)) if (h.speed > 1.5 || h.pending || evs.length) console.log(`   ${t.toFixed(2)} ${n[0]} sp ${h.speed.toFixed(1)} v ${h.vx.toFixed(1)},${h.vy.toFixed(1)} tr ${h.travel.toFixed(2)} pre ${h.pre.toFixed(2)} up ${(-h.y).toFixed(2)} n ${h.hist.length} pend ${h.pending ? 'Y' : '-'} moving ${tr.state.moving} clap ${tr.state.clap} pump ${tr.state.pump} ${evs.map((e) => 'PUNCH ' + e.hand).join()}`);
    }
  }
  return got;
}

function check(name, dur, hands, expected, opts = {}) {
  for (const fps of opts.fpsList || [30, 12]) {
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
  // punching WHILE running in place (Smash Run's main move): the whole body bobs up and down at 2.8 steps/s
  const p = punches(4);
  check('4 punches while running in place (body bobbing)', p.dur, p.hands, 4,
    { body: (t) => ({ mx: 0.5, my: 0.45 - 0.35 * SW * Math.abs(Math.sin(Math.PI * 2.8 * t)), scale: 1 }) });
}
{
  // big side swings (wind up out to the side, a short pause, swing across at shoulder height), alternating hands
  const W_L = [-1.2, 0.5, 0], W_R = [1.2, 0.5, 0];
  const L = path([[0, SIDE_L], [0.6, W_L], [1.1, W_L], [1.4, [0.8, -0.05, 0]], [2.2, SIDE_L], [3.4, SIDE_L], [4.0, W_L], [4.5, W_L], [4.8, [0.8, -0.05, 0]], [5.6, SIDE_L]]);
  const R = path([[0, SIDE_R], [1.7, SIDE_R], [2.3, W_R], [2.8, W_R], [3.1, [-0.8, -0.05, 0]], [3.9, SIDE_R], [5.1, SIDE_R], [5.7, W_R], [6.2, W_R], [6.5, [-0.8, -0.05, 0]], [7.3, SIDE_R]]);
  check('4 big side swings', 8, (t) => ({ l: L(t), r: R(t) }), 4);
}
{
  // both fists punch forward together, 3 times (a downward hammer no longer counts: real arms dropping after a
  // raise looked exactly like it)
  const kl = [[0, GUARD_L]], kr = [[0, GUARD_R]];
  for (let i = 0; i < 3; i++) { const t = 1 + i * 1.6; kl.push([t, GUARD_L], [t + 0.16, [-0.2, 0.05, -1.2]], [t + 0.4, [-0.2, 0.05, -1.2]], [t + 0.8, GUARD_L]); kr.push([t, GUARD_R], [t + 0.16, [0.2, 0.05, -1.2]], [t + 0.4, [0.2, 0.05, -1.2]], [t + 0.8, GUARD_R]); }
  const L = path(kl), R = path(kr);
  const want = (g) => g.length === 3 && g.every((e) => e.endsWith('b')); want.label = '3 (both hands)';
  check('3 two-fist punches', 6, (t) => ({ l: L(t), r: R(t) }), want);
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
check('standing still, very jittery wrists (0.3 shoulder widths)', 6, still(GUARD_L, GUARD_R), 0, { jitter: 0.3 });
// too close: wrists below the bottom of the picture, barely visible, their guessed positions jumping around
check('wrists below the picture (guessed, jumping)', 6, (t) => ({ l: [-0.5 + Math.sin(t * 7) * 0.4, 1.4 + Math.sin(t * 5) * 0.5], r: [0.5 + Math.cos(t * 6) * 0.4, 1.5 + Math.cos(t * 4) * 0.5] }), 0,
  { body: () => ({ mx: 0.5, my: 0.85, scale: 2.4 }), jitter: 0.3, vis: () => 0.2 });
{
  // too close, a fist comes up into the picture from below: that IS a punch
  // (shoulders at 0.72 of the picture, shoulder width = half the picture height: the wrist starts just below it)
  const L = path([[0, [-0.5, 0.65, 0]], [1.5, [-0.5, 0.65, 0]], [1.72, [-0.25, -0.25, -1]], [2.2, [-0.25, -0.25, -1]], [2.8, [-0.5, 0.65, 0]]]);
  check('fist rises into the picture from below (too close)', 3.5, (t) => ({ l: L(t), r: [0.5, 0.65, 0] }), 1,
    { body: () => ({ mx: 0.5, my: 0.72, scale: 2.4 }), vis: (t, side) => (side === 'l' && t > 1.5 && t < 2.6 ? 0.6 : 0.25) });
}
{
  // arm raised high (showing a toy / airplane arm), then dropped: neither the raise nor the drop is a punch
  const L = path([[0.5, SIDE_L], [0.9, [-0.4, -1.3, 0]], [2.2, [-0.4, -1.3, 0]], [2.45, [-0.6, 0.2, 0]], [3.5, SIDE_L]]);
  check('arm whipped up overhead, then dropped', 4, (t) => ({ l: L(t), r: SIDE_R }), 0);
}
{
  // leaning side to side like a plane, arms out, the shoulder line tilting +-0.35 rad
  const ang = (t) => 0.35 * Math.sin(2 * Math.PI * 0.6 * t);
  const hands = (t) => { const a = ang(t); return { l: [-1.5 * Math.cos(a), -1.5 * Math.sin(a), 0], r: [1.5 * Math.cos(a), 1.5 * Math.sin(a), 0] }; };
  check('leaning side to side, arms out like a plane', 6, hands, 0, { body: (t) => ({ mx: 0.5 + 0.06 * Math.sin(2 * Math.PI * 0.6 * t), my: 0.45, scale: 1 }) });
}
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
  const p = punches(3, { out: 0.8, back: 0.6 });
  check('3 very slow pushes, default sensitivity', p.dur, p.hands, 0);
  // (30 fps only: at 12 fps with realistic jitter, a 0.8 s push is as small as the noise; high-sensitivity
  // tuning is for the Mac/iPhone tier anyway)
  check('3 very slow pushes, sensitivity 2.5', p.dur, p.hands, 3, { config: { sensitivity: 2.5 }, fpsList: [30] });
}

if (failures) { console.log(`\n${failures} punch scenario(s) failed`); process.exit(1); }
console.log('\nAll punch scenarios passed');
