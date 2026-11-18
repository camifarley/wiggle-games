// Duck window latch (src/core/duck.js): simulated head paths go through the REAL height tracker (height.js), and
// the latch must catch quick / shallow / early ducks that the crouch event misses, and ignore standing, noise and
// walking closer. Run: npm test
import { createHeightTracker } from '../src/core/height.js';
import { createDuckLatch } from '../src/core/duck.js';

let failures = 0;
const SIZE = 0.06, STAND = 0.4; // ~2 m away; eye line when standing
const hold = (y, dur, size = SIZE) => ({ dur, at: () => ({ y, size }) });
// a dip of `depth` face sizes down and back up in `dur` seconds (half sine)
const dip = (depth, dur) => ({ dur, at: (k) => ({ y: STAND + depth * SIZE * Math.sin(Math.PI * k), size: SIZE }) });
const down = (depth, dur) => ({ dur, at: (k) => ({ y: STAND + depth * SIZE * k, size: SIZE }) });
const up = (depth, dur) => ({ dur, at: (k) => ({ y: STAND + depth * SIZE * (1 - k), size: SIZE }) });
const closer = (dur) => ({ dur, at: (k) => ({ y: STAND + 0.08 * k, size: SIZE * (1 + 0.6 * k) }) });

// settle standing, open the window at `openAt`, feed the path, close at the end
function scenario(name, segments, expectDuck, fps, { openAt = 1.2, noiseAmp = 0.004, expectCrouchEvent = null } = {}) {
  const tracker = createHeightTracker();
  const latch = createDuckLatch();
  const dt = 1 / fps;
  let t = 0, rng = 7, opened = false, crouchEvents = 0;
  const noise = () => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * noiseAmp; };
  for (const seg of [hold(STAND, 1.2), ...segments]) {
    for (let st = 0; st < seg.dur; st += dt, t += dt) {
      if (!opened && t >= openAt) { latch.open(t); opened = true; }
      const { y, size } = seg.at(st / seg.dur);
      for (const e of tracker.update(dt, y + noise(), size)) if (e === 'crouch') { crouchEvents++; latch.mark('crouch', t); }
      latch.update(dt, t, { height: tracker.state.height, crouching: tracker.state.crouching });
    }
  }
  const r = latch.close(t);
  let ok = r.ducked === expectDuck;
  if (expectCrouchEvent != null) ok = ok && (crouchEvents > 0) === expectCrouchEvent;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}: ducked ${r.ducked}${r.how ? ` (${r.how} at +${(r.seenAt - r.start).toFixed(2)} s)` : ''}, min height ${r.minHeight}, crouch events ${crouchEvents}`);
}

for (const fps of [30, 12]) {
  // the crouch event misses these, the latch must not
  scenario('quick bob down 1.6 face sizes in 0.4 s', [dip(1.6, 0.4), hold(STAND, 1)], true, fps, { expectCrouchEvent: false });
  scenario('deep quick duck 3 face sizes in 0.35 s', [dip(3, 0.35), hold(STAND, 1)], true, fps);
  scenario('ducks early, stands back up before the rock passes', [down(4, 0.3), hold(STAND + 4 * SIZE, 0.6), up(4, 0.3), hold(STAND, 2)], true, fps);
  scenario('full crouch held (also a crouch event)', [down(6, 0.4), hold(STAND + 6 * SIZE, 1.5)], true, fps, { expectCrouchEvent: true });
  // not ducks
  scenario('stands still (tracking noise)', [hold(STAND, 3)], false, fps, { noiseAmp: 0.012 });
  scenario('tiny nod 0.6 face sizes', [dip(0.6, 0.5), hold(STAND, 1)], false, fps);
  scenario('walks closer to the camera', [closer(1.2), hold(STAND + 0.08, 1, SIZE * 1.6)], false, fps);
}

// gesture marks count, and nothing counts before the window opens
{
  const l = createDuckLatch();
  l.update(0.1, 0, { height: -5 });
  const before = l.ducked;
  l.open(1); l.mark('jump', 1.4);
  const r = l.close(2);
  const ok = !before && r.ducked && r.how === 'jump';
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} closed latch ignores crouching; a hop marks the duck`);
}

if (failures) { console.log(`\n${failures} duck scenario(s) FAILED`); process.exit(1); }
console.log('\nAll duck scenarios passed');
