// Keyboard test controls (src/core/testbody.js) must work THROUGH the real detectors, exactly as
// gestures.js wires them: a key moves the pretend body, the body becomes tracker samples, and only the
// detectors decide what happened. Run: node scripts/test-testinput.js (part of `npm test`).
import { createTestBody, createKeyMapper } from '../src/core/testbody.js';
import { createHeightTracker, BODY_SCALE } from '../src/core/height.js';
import { createSpinTracker } from '../src/core/spin.js';
import { createRunTracker } from '../src/core/run.js';
import { createPunchTracker } from '../src/core/punch.js';
import { createPeekabooTracker } from '../src/core/peekaboo.js';
import { createSteerTracker } from '../src/core/steer.js';

const ASPECT = 16 / 9;

// The same glue as gestures.js (_updateHeight / _updateRun / _updatePeekaboo) on a 60 fps frame loop
// with tracking samples at `trackFps` (12 = Fire tablet, 30 = iPhone).
function rig({ trackFps = 20, fps = 60, delay } = {}) {
  const body = createTestBody(delay != null ? { delay } : {});
  const keys = createKeyMapper(body);
  const height = createHeightTracker(), spin = createSpinTracker(), run = createRunTracker();
  const punch = createPunchTracker(), peek = createPeekabooTracker(), steer = createSteerTracker();
  const events = [];
  const log = { states: [] };
  let t = 0, acc = 0, sample = body.sample(ASPECT), newSample = true, poseDt = 0;
  const dt = 1 / fps;
  function frame() {
    t += dt; acc += dt;
    body.update(dt);
    if (acc >= 1 / trackFps) { acc -= 1 / trackFps; sample = body.sample(ASPECT); newSample = true; }
    const p = sample.pose;
    const emit = (name, data) => events.push({ name, t, ...data });
    if (p.found) {
      const ls = p.leftShoulder, rs = p.rightShoulder;
      const y = (ls.y + rs.y) / 2;
      const size = Math.hypot((rs.x - ls.x) * ASPECT, rs.y - ls.y) * BODY_SCALE;
      for (const e of spin.update(dt, size)) emit(e);
      for (const e of height.update(dt, y, size)) emit(e);
      const ok = (q) => q && q.v >= 0.5 && q.y <= 1.02;
      const knees = ok(p.leftKnee) && ok(p.rightKnee) ? { l: p.leftKnee.y, r: p.rightKnee.y } : null;
      for (const e of run.update(dt, y, size, knees, sample.motion)) emit(e === 'stop' ? 'runstop' : e);
    } else run.update(dt, null, null, null, sample.motion);
    poseDt += dt;
    if (newSample) {
      newSample = false;
      for (const e of punch.update(poseDt, p.found ? p : null, ASPECT)) emit('punch', { hand: e.hand });
      poseDt = 0;
    }
    for (const e of peek.update(dt, p.found ? p : null, ASPECT)) emit(e);
    // steering: gestures copies the pretend body's eased lean into gestures.simLean -> steer.js drive()
    for (const e of steer.drive(dt, body.lean)) emit('lean', { side: e.side });
    log.states.push({ t, run: run.state.state, intensity: run.state.intensity, crouching: height.state.crouching, height: height.state.height });
  }
  const api = {
    body, keys, events, log, run, height, steer,
    get t() { return t; },
    wait(s) { for (let i = 0; i < Math.round(s * fps); i++) frame(); return api; },
    down(key, opts = {}) { keys.keyDown({ key, repeat: false, ...opts }); return api; },
    up(key) { keys.keyUp({ key }); return api; },
    tap(key, hold = 0.12) { return api.down(key).wait(hold).up(key); },
    count(name, from = 0) { return events.filter((e) => e.name === name && e.t >= from).length; },
  };
  api.wait(1.5); // stand there while height.js learns standing height
  return api;
}

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `\n     ${detail}` : ''}`);
}
const names = (r, from = 0) => r.events.filter((e) => e.t >= from).map((e) => `${e.name}@${e.t.toFixed(2)}`).join(' ');

for (const trackFps of [12, 20, 30]) {
  const tag = `(${trackFps} Hz tracking)`;
  {
    const r = rig({ trackFps });
    for (let i = 0; i < 5; i++) r.tap(' ').wait(1.0);
    check(`5 Space taps = exactly 5 jumps ${tag}`, r.count('jump') === 5, names(r));
    check(`  ...and jumping never reads as running or crouching ${tag}`, r.count('run') === 0 && r.count('crouch') === 0, names(r));
  }
  {
    // holding Space: the browser sends auto-repeat keydowns every ~33 ms
    const r = rig({ trackFps });
    r.down(' ');
    for (let i = 0; i < 45; i++) r.wait(1 / 30).down(' ', { repeat: true });
    r.up(' ').wait(1);
    check(`Space held 1.5 s with auto-repeat = exactly 1 jump ${tag}`, r.count('jump') === 1, names(r));
    // a repeat-flag-less duplicate keydown (some browsers) must not jump again either
    const r2 = rig({ trackFps });
    r2.down(' ').wait(0.1).down(' ').wait(0.1).down(' ').wait(0.5).up(' ').wait(1);
    check(`  duplicate keydowns without keyup = 1 jump ${tag}`, r2.count('jump') === 1, names(r2));
  }
  {
    const r = rig({ trackFps });
    const t0 = r.t;
    r.down('ArrowDown').wait(0.25);
    const early = r.count('crouch');
    r.wait(1.5);
    const held = r.count('crouch');
    const tCrouch = r.events.find((e) => e.name === 'crouch')?.t - t0;
    r.up('ArrowDown').wait(1.2);
    check(`↓ hold = one crouch, after a realistic lag ${tag}`, early === 0 && held === 1 && tCrouch > 0.3 && tCrouch < 1.2, `crouch after ${tCrouch?.toFixed(2)} s · ${names(r, t0)}`);
    check(`  ↓ release = stand ${tag}`, r.count('stand', t0) === 1 && !r.height.state.crouching, names(r, t0));
    check(`  crouching never reads as a jump or a run ${tag}`, r.count('jump', t0) === 0 && r.count('run', t0) === 0, names(r, t0));
  }
  {
    const r = rig({ trackFps });
    const t0 = r.t;
    r.down('ArrowUp');
    r.wait(0.4);
    const at04 = r.run.state.intensity;
    r.wait(2.6);
    const tRun = r.events.find((e) => e.name === 'run')?.t - t0;
    const peak = r.run.state.state;
    r.up('ArrowUp');
    r.wait(0.5);
    const after05 = r.run.state.intensity;
    r.wait(3);
    check(`↑ hold: run intensity ramps up (not instant) and reaches running ${tag}`, at04 < 0.3 && peak === 'running' && tRun > 0.6 && tRun < 2.5,
      `intensity at 0.4 s ${at04.toFixed(2)}, running after ${tRun?.toFixed(2)} s, state at 3 s: ${peak}`);
    check(`  ↑ release: intensity decays, then idle ${tag}`, after05 > 0.05 && r.run.state.state === 'idle' && r.count('runstop', t0) >= 1,
      `intensity 0.5 s after release ${after05.toFixed(2)} · final ${r.run.state.state}`);
    check(`  running never reads as a jump, crouch or punch ${tag}`, r.count('jump', t0) === 0 && r.count('crouch', t0) === 0 && r.count('punch', t0) === 0, names(r, t0).slice(0, 300));
    // a quick tap = a few walking steps at most, never running
    const r2 = rig({ trackFps });
    r2.tap('ArrowUp', 0.2).wait(3);
    check(`  ↑ tap: never "running" ${tag}`, r2.count('run') === 0 && !r2.log.states.some((s) => s.run === 'running'), names(r2));
  }
  {
    const r = rig({ trackFps });
    r.tap('s').wait(2.5);
    check(`S = exactly 1 spin (two half turns) ${tag}`, r.count('spin') === 1 && r.count('turn') === 2, names(r));
    r.tap('s').wait(2.5).tap('s').wait(2.5);
    check(`  S, S = 2 more spins ${tag}`, r.count('spin') === 3, names(r));
    check(`  spinning never reads as running or punching ${tag}`, r.count('run') === 0 && r.count('punch') === 0, names(r));
  }
  {
    const r = rig({ trackFps });
    for (let i = 0; i < 4; i++) r.tap('Enter').wait(0.8);
    const hands = r.events.filter((e) => e.name === 'punch').map((e) => e.hand).join(',');
    check(`4 Enter taps = exactly 4 punches, alternating hands ${tag}`, r.count('punch') === 4 && hands === 'left,right,left,right', `${names(r)} hands ${hands}`);
    // Enter held with auto-repeat: one punch
    const r2 = rig({ trackFps });
    r2.down('Enter');
    for (let i = 0; i < 20; i++) r2.wait(1 / 30).down('Enter', { repeat: true });
    r2.up('Enter').wait(1);
    check(`  Enter held (auto-repeat) = 1 punch ${tag}`, r2.count('punch') === 1, names(r2));
    // punching while running (Smash Run's main move): every tap still counts over the run arm pump
    const r3 = rig({ trackFps });
    r3.down('ArrowUp').wait(2.5);
    const p0 = r3.count('punch');
    for (let i = 0; i < 4; i++) r3.tap('Enter').wait(0.8);
    r3.up('ArrowUp').wait(1);
    check(`  4 Enter taps while running = 4 punches ${tag}`, p0 === 0 && r3.count('punch') === 4, `${p0} before · ${names(r3).slice(-200)}`);
  }
  {
    const r = rig({ trackFps });
    r.tap('p').wait(3);
    check(`P tap = hide then peekaboo (body) ${tag}`, r.count('hide') === 1 && r.count('peekaboo') === 1, names(r));
    r.down('p').wait(2).up('p').wait(2);
    check(`  P held 2 s = one more peekaboo, after release ${tag}`, r.count('peekaboo') === 2, names(r));
    check(`  hands up to the face and down never read as punches ${tag}`, r.count('punch') === 0, names(r));
  }
}

{
  // lean: ramps toward -1 / +1 while held, eases back
  const r = rig();
  r.down('ArrowLeft').wait(0.3);
  const l03 = r.body.lean;
  r.wait(1.2);
  const l15 = r.body.lean;
  r.up('ArrowLeft').wait(1.5);
  const back = r.body.lean;
  r.down('ArrowRight').wait(1.5);
  const right = r.body.lean;
  check('← hold leans toward -1 (eased), release eases back, → leans +1', l03 < -0.2 && l03 > -0.8 && l15 < -0.9 && Math.abs(back) < 0.05 && right > 0.9,
    `0.3 s ${l03.toFixed(2)}, 1.5 s ${l15.toFixed(2)}, 1.5 s after release ${back.toFixed(2)}, right ${right.toFixed(2)}`);
  check('  steer.js (via gestures.simLean) follows: one lean left, one lean right, straight in between',
    r.count('lean') === 2 && r.events.filter((e) => e.name === 'lean').map((e) => e.side).join(',') === 'left,right' && r.steer.state.value > 0.85,
    `${names(r)} · steer value ${r.steer.state.value.toFixed(2)}`);
  check('  leaning never reads as a jump, crouch, spin or run', r.count('jump') + r.count('crouch') + r.count('spin') + r.count('run') === 0, names(r));
}
{
  // the tracker delay: nothing happens in the first `delay` s after a key
  const r = rig({ delay: 0.15 });
  const t0 = r.t;
  r.tap(' ', 0.05).wait(1);
  const first = r.events.find((e) => e.name === 'jump');
  check('Jump is detected after the ~0.15 s tracking delay, not instantly', first && first.t - t0 >= 0.15 && first.t - t0 < 0.5, `jump after ${(first?.t - t0).toFixed(2)} s`);
}
{
  // blur while holding: no stuck crouch / run
  const r = rig();
  r.down('ArrowDown').down('ArrowUp').wait(1);
  r.keys.blur();
  r.wait(3);
  check('Window blur releases held keys (no stuck crouch or run)', !r.height.state.crouching && r.run.state.state === 'idle', names(r));
}
{
  // everything at once on the 12 Hz Fire tier: still one event per key
  const r = rig({ trackFps: 12 });
  r.tap(' ').wait(1.2).tap('Enter').wait(1).tap('s').wait(2.5).tap(' ').wait(1.2);
  check('Mixed keys at 12 Hz: 2 jumps, 1 punch, 1 spin', r.count('jump') === 2 && r.count('punch') === 1 && r.count('spin') === 1, names(r));
}

if (failures) { console.log(`\n${failures} test-input scenario(s) failed`); process.exit(1); }
console.log('\nAll test-input scenarios passed');
