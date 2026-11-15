// Simulated playtests for run-in-place detection (shoulder bob + knees + motion). Run: npm test
import { createRunTracker } from '../src/core/run.js';

let failures = 0;
const SIZE = 0.045;   // shoulder width x BODY_SCALE, frame heights (a kid ~2.5 m away; real recordings ~0.03-0.05)
const STAND = 0.45;   // shoulder line y
const KNEE = 0.8;     // knee y

// seg: { dur, y(t) in size units above standing, knees(t) -> {l, r} size units of lift (or null), size(t), m }
function run(segments, fps, config) {
  const tr = createRunTracker(config);
  const dt = 1 / fps;
  let rng = 11;
  const noise = (a) => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * 2 * a; };
  const log = [];
  let t = 0;
  for (const seg of segments) {
    for (let st = 0; st < seg.dur - 1e-9; st += dt, t += dt) {
      const size = (seg.size ? seg.size(st / seg.dur) : SIZE) * (1 + noise(0.01));
      const y = STAND - (seg.y(st, st / seg.dur) + noise(0.05)) * size;
      const kn = seg.knees ? seg.knees(st) : null;
      const knees = kn ? { l: KNEE - kn.l * size + noise(0.04) * size, r: KNEE - kn.r * size + noise(0.04) * size } : null;
      tr.update(dt, y, size, knees, seg.m ?? 0.05);
      log.push({ t, seg: seg.name, i: tr.state.intensity, state: tr.state.state });
    }
  }
  return log;
}

function check(name, segments, expect, fpsList = [30, 12], config) {
  for (const fps of fpsList) {
    const log = run(segments, fps, config);
    const errs = [];
    for (const [segName, want] of Object.entries(expect)) {
      const rows = log.filter((r) => r.seg === segName);
      // judge the second half of a segment (the detector needs a moment to react)
      const tail = rows.slice(Math.floor(rows.length / 2));
      const frac = (st) => tail.filter((r) => r.state === st).length / Math.max(1, tail.length);
      const anyRun = rows.some((r) => r.state === 'running');
      const maxI = Math.max(...rows.map((r) => r.i));
      if (want === 'running' && frac('running') < 0.8) errs.push(`${segName}: running ${(frac('running') * 100).toFixed(0)}% (want ≥80%)`);
      if (want === 'walking' && frac('walking') < 0.7) errs.push(`${segName}: walking ${(frac('walking') * 100).toFixed(0)}% (want ≥70%) running ${(frac('running') * 100).toFixed(0)}%`);
      if (want === 'idle' && frac('idle') < 0.8) errs.push(`${segName}: idle ${(frac('idle') * 100).toFixed(0)}% (want ≥80%)`);
      if (want === 'not-running' && anyRun) errs.push(`${segName}: was 'running' (max intensity ${maxI.toFixed(2)})`);
      if (want === 'quiet' && (anyRun || frac('idle') < 0.6)) errs.push(`${segName}: idle ${(frac('idle') * 100).toFixed(0)}%, max intensity ${maxI.toFixed(2)}${anyRun ? ', was running' : ''}`);
    }
    const ok = !errs.length;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}${ok ? '' : '\n     ' + errs.join('\n     ')}`);
  }
}

// --- body motions (size units) ---
const still = (dur, name = 'still') => ({ name, dur, y: () => 0, m: 0.002 });
// running/walking in place: shoulders bob once per step; knees lift in turn (each knee every other step)
const steps = (name, dur, rate, bob, kneeLift, m = 0.06) => ({
  name, dur, m,
  y: (t) => bob * Math.sin(2 * Math.PI * rate * t),
  knees: kneeLift == null ? null : (t) => {
    const p = Math.sin(Math.PI * rate * t);
    return { l: kneeLift * Math.max(0, p), r: kneeLift * Math.max(0, -p) };
  },
});
// jumping: shoulders fly up ~3 units, knees move together
const hops = (name, dur, rate, height = 2.8, knees = true) => ({
  name, dur, m: 0.12,
  y: (t) => { const ph = (t * rate) % 1; return ph < 0.45 ? height * Math.sin(Math.PI * ph / 0.45) : -0.4 * Math.sin(Math.PI * (ph - 0.45) / 0.55); },
  knees: knees ? (t) => { const ph = (t * rate) % 1; const k = ph < 0.45 ? height * Math.sin(Math.PI * ph / 0.45) : 0; return { l: k, r: k }; } : null,
});
const singleJumps = (name, n) => {
  const segs = [];
  for (let i = 0; i < n; i++) segs.push({ ...hops(name, 0.45, 1 / 0.45), knees: null }, { name, dur: 1.4, y: () => 0, m: 0.02 });
  return segs;
};
// arm waving: big motion, shoulders jiggle a bit (arms tug them), no knee lift
const wave = (name, dur) => ({ name, dur, m: 0.25, y: (t) => 0.06 * Math.sin(2 * Math.PI * 3 * t) + 0.04 * Math.sin(2 * Math.PI * 1.3 * t), knees: () => ({ l: 0.02, r: 0 }) });
// walking two steps closer: shoulders grow fast, real step bob, then stands
const walkCloser = (name, dur) => ({ name, dur, m: 0.1, size: (k) => SIZE * (1 + 0.6 * k), y: (t) => 0.35 * Math.sin(2 * Math.PI * 2 * t) - 1.5 * (t / dur) });
// squat: down 3 units and back up, twice
const squat = (name, dur) => ({ name, dur, m: 0.05, y: (t) => -3 * Math.max(0, Math.sin(Math.PI * 2 * t / dur)) });

check('standing still', [still(5)], { still: 'idle' });
check('running in place, knees visible', [still(1.5, 'warm'), steps('run', 6, 2.8, 0.35, 1.2)], { run: 'running' });
check('running in place, too close to see the knees', [still(1.5, 'warm'), steps('run', 6, 2.8, 0.35, null)], { run: 'running' });
check('fast sprint', [still(1, 'warm'), steps('sprint', 5, 3.5, 0.5, 1.5)], { sprint: 'running' });
check('slow tiptoe walk, knees visible (troll round)', [still(1.5, 'warm'), steps('walk', 6, 1.3, 0.12, 0.9)], { walk: 'walking' });
check('slow walk, no knees, small bob', [still(1.5, 'warm'), steps('walk', 6, 1.4, 0.2, null)], { walk: 'walking' });
check('run then stop: drops to idle', [steps('run', 5, 2.8, 0.35, 1.2), still(4, 'stop')], { run: 'running' });
check('jumping over and over (knees together)', [still(1.5, 'warm'), hops('jump', 6, 1.6)], { jump: 'not-running' });
check('jumping over and over (knees hidden)', [still(1.5, 'warm'), hops('jump', 6, 1.6, 2.8, false)], { jump: 'not-running' });
check('single jumps with pauses (Jump station)', [still(1.5, 'warm'), ...singleJumps('jumps', 5)], { jumps: 'not-running' });
check('waving arms wildly', [still(1.5, 'warm'), wave('wave', 6)], { wave: 'quiet' });
check('walking two steps closer, then standing', [still(1.5, 'warm'), walkCloser('closer', 1.5), still(3, 'after')], { closer: 'not-running', after: 'idle' });
check('squats', [still(1.5, 'warm'), squat('squat', 4)], { squat: 'not-running' });
// tuning: a gentle jog is only walking at the default sensitivity, running when the parent turns it up
check('gentle jog, default sensitivity', [still(1.5, 'warm'), steps('jog', 6, 2.4, 0.09, null)], { jog: 'not-running' }, [30]);
check('gentle jog, sensitivity 2.5', [still(1.5, 'warm'), steps('jog', 6, 2.4, 0.09, null)], { jog: 'running' }, [30], { sensitivity: 2.5 });

if (failures) { console.log(`\n${failures} run scenario(s) failed`); process.exit(1); }
console.log('\nAll run scenarios passed');
