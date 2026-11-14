// Simulated playtests for jump / crouch detection. Run: npm test
// Each scenario feeds a fake head path (y, size in frame heights) at a tracking rate and
// checks which events come out.
import { createHeightTracker } from '../src/core/height.js';

const TRACK_FPS = [30, 12]; // Mac/iPhone vs Fire tablet
let failures = 0;

// A 4-year-old: eye distance ~5.5 cm. Jump lifts the head ~12 cm (~2.2 face sizes),
// crouch drops it ~35 cm (~6 face sizes).
function scenario(name, segments, expected, fps) {
  const tracker = createHeightTracker();
  const dt = 1 / fps;
  const events = [];
  let t = 0;
  let rng = 1;
  const noise = () => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 0.004; };
  for (const seg of segments) {
    for (let st = 0; st < seg.dur; st += dt, t += dt) {
      const { y, size } = seg.at(st / seg.dur);
      for (const e of tracker.update(dt, y + noise(), size)) events.push(`${e}@${t.toFixed(1)}`);
    }
  }
  const got = events.map((e) => e.split('@')[0]);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}\n     expected ${expected.join(',') || '(none)'}\n     got      ${events.join(', ') || '(none)'}`);
}

const hold = (y, size, dur) => ({ dur, at: () => ({ y, size }) });
const move = (y0, y1, s0, s1, dur) => ({ dur, at: (k) => ({ y: y0 + (y1 - y0) * k, size: s0 + (s1 - s0) * k }) });
const jump = (y, size) => {
  const up = 2.2 * size; // head rises ~2.2 face sizes
  return { dur: 0.45, at: (k) => ({ y: y - up * Math.sin(Math.PI * k), size }) };
};
const SIZE = 0.06;   // standing ~2 m away
const STAND = 0.4;   // eye line in frame when standing

for (const fps of TRACK_FPS) {
  scenario('stands, jumps 3 times', [
    hold(STAND, SIZE, 3), jump(STAND, SIZE), hold(STAND, SIZE, 1), jump(STAND, SIZE), hold(STAND, SIZE, 1), jump(STAND, SIZE), hold(STAND, SIZE, 1),
  ], ['jump', 'jump', 'jump'], fps);

  scenario('taps Play up close, walks back, then jumps (the reported bug)', [
    hold(0.5, 0.25, 2),                       // face huge, right at the screen
    move(0.5, 0.62, 0.25, SIZE, 2),           // walks back; head ends LOWER in frame
    hold(0.62, SIZE, 3), jump(0.62, SIZE), hold(0.62, SIZE, 1), jump(0.62, SIZE), hold(0.62, SIZE, 1),
  ], ['jump', 'jump'], fps);

  scenario('crouch for a bug hat, stand, jump', [
    hold(STAND, SIZE, 3), move(STAND, STAND + 6 * SIZE, SIZE, SIZE, 0.6), hold(STAND + 6 * SIZE, SIZE, 5),
    move(STAND + 6 * SIZE, STAND, SIZE, SIZE, 0.6), hold(STAND, SIZE, 1), jump(STAND, SIZE), hold(STAND, SIZE, 1),
  ], ['crouch', 'stand', 'jump'], fps);

  scenario('nods and leans slowly: no jumps', [
    hold(STAND, SIZE, 3),
    { dur: 4, at: (k) => ({ y: STAND - Math.sin(k * Math.PI * 8) * 0.5 * SIZE, size: SIZE }) }, // nodding
    move(STAND, STAND - 1.5 * SIZE, SIZE, SIZE, 2), hold(STAND - 1.5 * SIZE, SIZE, 2),           // slow lean/tiptoe
  ], [], fps);

  scenario('ten fast jumps in a row (mega bag)', [
    hold(STAND, SIZE, 3),
    ...Array.from({ length: 10 }, () => [jump(STAND, SIZE), hold(STAND, SIZE, 0.15)]).flat(),
  ], Array(10).fill('jump'), fps);

  scenario('standing height ends up slightly off (camera bumped), then jumps', [
    hold(STAND, SIZE, 3), move(STAND, STAND + 1.5 * SIZE, SIZE, SIZE, 0.3), hold(STAND + 1.5 * SIZE, SIZE, 4),
    jump(STAND + 1.5 * SIZE, SIZE), hold(STAND + 1.5 * SIZE, SIZE, 1), jump(STAND + 1.5 * SIZE, SIZE), hold(STAND + 1.5 * SIZE, SIZE, 1),
  ], ['jump', 'jump'], fps);

  scenario('walks closer mid-game, keeps jumping', [
    hold(STAND, SIZE, 3), jump(STAND, SIZE), hold(STAND, SIZE, 1),
    move(STAND, 0.45, SIZE, 0.09, 1.5), hold(0.45, 0.09, 2), jump(0.45, 0.09), hold(0.45, 0.09, 1),
  ], ['jump', 'jump'], fps);
}

if (failures) { console.log(`\n${failures} scenario(s) failed`); process.exit(1); }
console.log('\nAll scenarios passed');
