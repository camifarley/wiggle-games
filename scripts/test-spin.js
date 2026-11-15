// Simulated playtests for body-based spin detection (shoulder width over time). Run: npm test
import { createSpinTracker } from '../src/core/spin.js';

let failures = 0;
const W = 0.055; // facing shoulder width (any unit)

function scenario(name, segments, expected, fps) {
  const tr = createSpinTracker();
  const dt = 1 / fps;
  let rng = 7;
  const noise = () => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 0.004; };
  const got = [];
  let t = 0;
  for (const seg of segments) {
    for (let st = 0; st < seg.dur; st += dt, t += dt) {
      for (const e of tr.update(dt, Math.max(0.001, seg.w(st / seg.dur) + noise()))) if (e === 'spin') got.push(t.toFixed(1));
    }
  }
  const ok = got.length === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}: expected ${expected} spin(s), got ${got.length} [${got.join(', ')}]`);
}

const face = (dur, w = W) => ({ dur, w: () => w });
// one full turn: |cos| of the body angle -> dips to ~0 at 90 and 270 degrees, wide (back) at 180
const spin = (dur = 1.6, w = W) => ({ dur, w: (k) => w * Math.abs(Math.cos(k * 2 * Math.PI)) });
const walk = (w0, w1, dur) => ({ dur, w: (k) => w0 + (w1 - w0) * k });
const sideways = (dur, w = W) => ({ dur, w: (k) => w * Math.max(0.05, Math.abs(Math.cos(Math.min(1, k * 4) * Math.PI / 2))) });

for (const fps of [30, 12]) {
  scenario('three spins with pauses', [face(2), spin(), face(1.2), spin(), face(1.5), spin(), face(1.5)], 3, fps);
  scenario('fast spins back to back', [face(2), spin(1.1), spin(1.1), spin(1.1), face(1)], 3, fps);
  scenario('slow spin', [face(2), spin(2.4), face(1.5)], 1, fps);
  scenario('walks back from the screen (width shrinks steadily)', [face(1, 0.137), walk(0.137, W, 1.3), face(3)], 0, fps);
  scenario('turns sideways and stays (walking off)', [face(2), sideways(3)], 0, fps);
  scenario('half turn (turns around, stays facing away)', [face(2), { dur: 0.8, w: (k) => W * Math.abs(Math.cos(k * Math.PI)) }, face(3)], 0, fps);
  scenario('fidgeting, arms waving, no turning', [face(2), { dur: 4, w: (k) => W * (0.85 + 0.15 * Math.sin(k * 40)) }], 0, fps);
}

if (failures) { console.log(`\n${failures} spin scenario(s) failed`); process.exit(1); }
console.log('\nAll spin scenarios passed');
