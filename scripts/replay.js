// Replays real Move Lab recordings (fixtures.local/*.json) through the detectors. Part of `npm test`.
// A recording labelled "5 jumps" must still produce exactly 5 jumps after any change to height.js.
//
// Get a fixture: open Move Lab, run the Jump or Squat station, open the 🔧 overlay, confirm or
// correct the count, tap 💾, and drop the file into fixtures.local/ (gitignored: it stays private).
// Run one file: node scripts/replay.js path/to/file.json
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHeightTracker } from '../src/core/height.js';
import { createSpinTracker } from '../src/core/spin.js';
import { createRunTracker } from '../src/core/run.js';
import { createPunchTracker } from '../src/core/punch.js';
import { createSteerTracker } from '../src/core/steer.js';
import { createToyStation } from '../src/games/05-move-lab/toy.js';

// Which detector event each station's labelled count refers to.
//   run: how many separate times he started running (Move Lab "Run in place": run, stop, run, ...)
//   punch: how many punches / smash moves
//   lean: how many leans (left + right) in Move Lab "Lean / Airplane arms"
//   toy: how many colours he really showed (Move Lab "Magic toy", replayed through toy.js)
export const STATION_EVENT = { jump: 'jump', squat: 'crouch', spin: 'spin', run: 'run', punch: 'punch', toy: 'hit', lean: 'lean' };
// Real recordings of other moves that must never look like running (jumping, squats, spins, walking
// closer/further). Enforced on body recordings: a 'running' state there fails the test.
const NOT_RUNNING = ['jump', 'squat', 'spin', 'distance', 'closer'];

// Feeds the recorded eye-line samples into a fresh height tracker, exactly as gestures.js did live.
export function replayHeight(rec, config) {
  const tracker = createHeightTracker(config);
  const resets = new Set((rec.events || []).filter((e) => e.name === 'return').map((e) => e.i));
  const out = [];
  rec.rows.forEach((r, i) => {
    if (resets.has(i)) tracker.reset();
    if (r.y == null || !(r.hdt > 0)) return;
    for (const name of tracker.update(r.hdt, r.y, r.s)) out.push({ name, t: r.t });
  });
  return out;
}

// Spin: feeds the recorded shoulder width (body recordings) into a fresh spin tracker.
export function replaySpin(rec, config) {
  const tracker = createSpinTracker(config);
  const out = [];
  for (const r of rec.rows) {
    if (r.s == null || !(r.hdt > 0)) continue;
    for (const name of tracker.update(r.hdt, r.s)) out.push({ name, t: r.t });
  }
  return out;
}

// Run: shoulder line + knees + motion into a fresh run tracker. Returns 'run' bursts (a new 'run' only
// counts after at least `gap` s of not running) and the time spent running.
export function replayRun(rec, config, gap = 1.0) {
  const tracker = createRunTracker({ ...(rec.runConfig || {}), ...config });
  const out = [];
  let runningFor = 0, lastRunEnd = -9, wasRunning = false;
  for (const r of rec.rows) {
    if (!(r.hdt > 0)) continue;
    const knees = r.kq ? { l: r.kq[0], r: r.kq[1] } : null;
    tracker.update(r.hdt, r.y, r.s, knees, r.m ?? 1);
    const running = tracker.state.state === 'running';
    if (running) { runningFor += r.hdt; if (!wasRunning && r.t - lastRunEnd >= gap) out.push({ name: 'run', t: r.t }); }
    else if (wasRunning) lastRunEnd = r.t;
    wasRunning = running;
  }
  return Object.assign(out, { runningFor });
}

// Punch: the recorded wrists + shoulders (pk, pz) into a fresh punch tracker.
export function replayPunch(rec, config) {
  const tracker = createPunchTracker({ ...(rec.punchConfig || {}), ...config });
  const aspect = rec.device?.camera ? rec.device.camera[0] / rec.device.camera[1] : 4 / 3;
  const out = [];
  let prevT = null, lastPk = null;
  for (const r of rec.rows) {
    const dt = prevT == null ? 1 / 30 : r.t - prevT;
    if (!r.pk) continue;
    const key = r.pk.join(',');
    if (key === lastPk) continue; // the same pose sample again (rows follow camera frames)
    lastPk = key; prevT = r.t;
    const q = (i, z) => (r.pk[i * 3] == null ? undefined : { x: r.pk[i * 3], y: r.pk[i * 3 + 1], v: r.pk[i * 3 + 2], z: z ?? 0 });
    const pts = { leftWrist: q(1, r.pz?.[0]), rightWrist: q(2, r.pz?.[1]), leftShoulder: q(3), rightShoulder: q(4) };
    for (const e of tracker.update(dt, pts, aspect)) out.push({ name: 'punch', t: r.t, hand: e.hand });
  }
  return out;
}

// Steer: the recorded shoulders + wrists (pk) and hips (hp) into a fresh steer tracker. Returns 'lean'
// events plus the largest |value| (maxAbs) and the time spent steering hard (|value| > 0.5).
export function replaySteer(rec, config) {
  const tracker = createSteerTracker({ ...(rec.steerConfig || {}), ...config });
  const aspect = rec.device?.camera ? rec.device.camera[0] / rec.device.camera[1] : 4 / 3;
  const out = [];
  let prevT = null, lastKey = null, maxAbs = 0, hard = 0;
  for (const r of rec.rows) {
    const dt = prevT == null ? 1 / 30 : r.t - prevT;
    let pts = null;
    if (r.pk) {
      const key = r.pk.join(',') + (r.hp ? r.hp.join(',') : '');
      if (key === lastKey) continue; // the same pose sample again (rows follow camera frames)
      lastKey = key;
      const q = (a, i) => (a?.[i * 3] == null ? undefined : { x: a[i * 3], y: a[i * 3 + 1], v: a[i * 3 + 2] });
      pts = { leftWrist: q(r.pk, 1), rightWrist: q(r.pk, 2), leftShoulder: q(r.pk, 3), rightShoulder: q(r.pk, 4), leftHip: q(r.hp, 0), rightHip: q(r.hp, 1) };
    } else if (lastKey === null) continue; // no body yet
    else lastKey = null;
    prevT = r.t;
    for (const e of tracker.update(dt, pts, aspect)) out.push({ name: 'lean', t: r.t, side: e.side });
    maxAbs = Math.max(maxAbs, Math.abs(tracker.state.value));
    if (Math.abs(tracker.state.value) > 0.5) hard += dt;
  }
  return Object.assign(out, { maxAbs, hard });
}

// Toy: the recorded colour blobs (c), shoulder width (bw) and wrists (pk) through the Magic toy station
// logic (src/games/05-move-lab/toy.js), with the same 3.2 s demo the station starts with.
export const TOY_DEMO = 3.2;
export function replayToy(rec, config) {
  const st = createToyStation(config);
  const aspect = rec.device?.camera ? rec.device.camera[0] / rec.device.camera[1] : 16 / 9;
  const out = [];
  let prev = 0;
  for (const r of rec.rows) {
    const dt = Math.max(0, r.t - prev); prev = r.t;
    const blobs = {};
    for (const [k, v] of Object.entries(r.c || {})) blobs[k] = v ? { found: true, x: v[0], y: v[1], size: v[2] } : { found: false };
    const wrists = [];
    if (r.pk) for (const i of [1, 2]) if (r.pk[i * 3] != null && r.pk[i * 3 + 2] >= 0.5) wrists.push({ x: r.pk[i * 3], y: r.pk[i * 3 + 1] });
    for (const e of st.update(dt, r.t < TOY_DEMO ? 'demo' : 'go', { blobs, bodyWidth: r.bw || 0, wrists, aspect })) {
      if (e.name === 'hit') out.push({ name: 'hit', t: r.t, color: e.color });
    }
    if (out.length >= (rec.expected ?? 3)) break; // the station ends at its goal
  }
  return out;
}

// Checks one recording. Returns { status: 'pass' | 'fail' | 'skip', msg }.
export function checkRecording(rec, opts = {}) {
  const want = STATION_EVENT[rec.station];
  // other body moves must never read as running (this needs no label: it's about what he did NOT do)
  let neg = '';
  if (NOT_RUNNING.includes(rec.station) && rec.heightSource === 'body') {
    const r = replayRun(rec);
    if (r.runningFor > 0) return { status: 'fail', msg: `run detector said "running" for ${r.runningFor.toFixed(1)} s during ${rec.station} (must be 0)` };
    neg = ' · never "running" ✓';
  }
  if (!want) return { status: neg ? 'pass' : 'skip', msg: neg ? `not running${neg}` : `station "${rec.station}" has no replay check yet` };
  if (rec.trueCount == null) return { status: neg ? 'pass' : 'skip', msg: `${neg ? `not running${neg}; ` : ''}not labelled (confirm the count in the 🔧 overlay before saving)` };
  const got = (want === 'spin' ? replaySpin(rec) : want === 'run' ? replayRun(rec) : want === 'punch' ? replayPunch(rec) : want === 'hit' ? replayToy(rec, opts.toy) : want === 'lean' ? replaySteer(rec) : replayHeight(rec)).filter((e) => e.name === want);
  const live = rec.station === 'toy' ? rec.detected ?? 0 : (rec.events || []).filter((e) => e.src === 'gestures' && e.name === want).length;
  const note = rec.events?.length && live !== got.length ? ` (live run detected ${live}: replay differs from the live run)` : '';
  const ok = got.length === rec.trueCount;
  // Jump/Squat moved to body tracking (shoulders). Face-era recordings (no heightSource, or 'face') are
  // kept as information: the face tracker can't see a jumping kid past ~1.2 m, so they can't be enforced.
  // Same for face-era toy recordings: without the body there's no wrist or distance to judge a toy by.
  const enforced = rec.heightSource === 'body' || rec.heightSource === 'sim';
  return {
    status: enforced ? (ok ? 'pass' : 'fail') : ok ? 'info-pass' : 'info-fail',
    msg: `${rec.station === 'toy' ? 'colours shown' : want}: expected ${rec.trueCount}, replay got ${got.length} [${got.map((e) => `${e.t.toFixed(1)}${e.color ? ' ' + e.color : ''}`).join(', ')}]${note}${neg}`,
  };
}

// A synthetic recording in the exact format recorder.js writes, so the replay path is tested even
// when fixtures.local/ is empty.
export function syntheticRecording(jumps = 3, fps = 30) {
  const rows = [];
  let t = 0;
  const SIZE = 0.06, STAND = 0.4, dt = 1 / fps;
  const push = (y) => { t += dt; rows.push({ t, hdt: dt, y, s: SIZE, f: 1, m: 0.02, h: 0, fs: SIZE }); };
  for (let i = 0; i < fps * 3; i++) push(STAND);
  for (let j = 0; j < jumps; j++) {
    for (let k = 0; k < 0.45 * fps; k++) push(STAND - 2.2 * SIZE * Math.sin(Math.PI * k / (0.45 * fps)));
    for (let i = 0; i < fps; i++) push(STAND);
  }
  return { kind: 'wiggle-recording', version: 1, station: 'jump', heightSource: 'sim', expected: jumps, trueCount: jumps, rows, events: [] };
}

// Synthetic run recording: run in place (shoulder bob + alternating knees), stop, run again.
export function syntheticRun(runs = 2, fps = 30) {
  const rows = [];
  let t = 0;
  const S = 0.045, dt = 1 / fps;
  const push = (bob, kl, kr, m) => { t += dt; rows.push({ t: +t.toFixed(3), hdt: dt, y: 0.45 - bob * S, s: S, f: 0, m, h: 0, kq: [0.8 - kl * S, 0.8 - kr * S] }); };
  for (let i = 0; i < fps * 2; i++) push(0, 0, 0, 0.002);
  for (let r = 0; r < runs; r++) {
    for (let i = 0; i < fps * 4; i++) { const tt = i / fps, p = Math.sin(Math.PI * 2.8 * tt); push(0.35 * Math.sin(2 * Math.PI * 2.8 * tt), Math.max(0, p) * 1.2, Math.max(0, -p) * 1.2, 0.06); }
    for (let i = 0; i < fps * 3; i++) push(0, 0, 0, 0.002);
  }
  return { kind: 'wiggle-recording', version: 1, station: 'run', heightSource: 'sim', expected: runs, trueCount: runs, rows, events: [] };
}

// Synthetic punch recording in recorder.js's pk / pz format (nose, wrists, shoulders as x,y,v triples).
export function syntheticPunch(n = 4, fps = 30) {
  const rows = [];
  const dt = 1 / fps, A = 16 / 9, SW = 0.22, SX = SW / A;
  let t = 0;
  const P = (ux, uy) => [0.5 + ux * SX, 0.45 + uy * SW, 0.95];
  const push = (l, r, lz = 0, rz = 0) => { t += dt; rows.push({ t: +t.toFixed(3), hdt: dt, y: 0.45, s: SW * 0.2, f: 0, m: 0.03, h: 0, pk: [...P(0, -0.7), ...P(...l), ...P(...r), ...P(-0.5, 0), ...P(0.5, 0)], pz: [lz * SX, rz * SX] }); };
  const GL = [-0.4, 0.6], GR = [0.4, 0.6];
  for (let i = 0; i < fps; i++) push(GL, GR);
  for (let k = 0; k < n; k++) {
    const left = k % 2 === 0;
    for (let i = 1; i <= 5; i++) { const e = i / 5; const p = [(left ? -1 : 1) * (0.4 - 0.25 * e), 0.6 - 0.55 * e]; push(left ? p : GR, left ? GL : p, left ? -1.2 * e : 0, left ? 0 : -1.2 * e); }
    for (let i = 0; i < fps * 0.4; i++) push(left ? [-0.15, 0.05] : GL, left ? GR : [0.15, 0.05], left ? -1.2 : 0, left ? 0 : -1.2);
    for (let i = 1; i <= 12; i++) { const e = 1 - i / 12; const p = [(left ? -1 : 1) * (0.4 - 0.25 * e), 0.6 - 0.55 * e]; push(left ? p : GL, left ? GR : p, left ? -1.2 * e : 0, left ? 0 : -1.2 * e); }
    for (let i = 0; i < fps * 0.5; i++) push(GL, GR);
  }
  return { kind: 'wiggle-recording', version: 1, station: 'punch', heightSource: 'sim', device: { camera: [1280, 720] }, expected: n, trueCount: n, rows, events: [] };
}

// Synthetic lean recording in recorder.js's pk / hp format: lean right, straight, lean left, ... (n leans).
export function syntheticLean(n = 4, fps = 30) {
  const rows = [];
  const dt = 1 / fps, A = 16 / 9, SW = 0.2, T = 1.5 * SW;
  let t = 0;
  const P = (x, y) => [+(x / A).toFixed(4), +y.toFixed(4), 0.95];
  const push = (th) => {
    t += dt;
    const hx = 0.5 * A, hy = 0.75, mx = hx + T * Math.sin(th), my = hy - T * Math.cos(th), c = Math.cos(th * 0.9), s = Math.sin(th * 0.9);
    const L = [mx - 0.5 * SW * c, my - 0.5 * SW * s], R = [mx + 0.5 * SW * c, my + 0.5 * SW * s];
    rows.push({ t: +t.toFixed(3), hdt: dt, y: my, s: SW * 0.2, f: 0, m: 0.02, h: 0,
      pk: [...P(mx, my - 0.6 * SW), ...P(L[0], L[1] + 1.4 * SW), ...P(R[0], R[1] + 1.4 * SW), ...P(...L), ...P(...R)], hp: [...P(hx - 0.35 * SW, hy), ...P(hx + 0.35 * SW, hy)] });
  };
  for (let i = 0; i < fps * 2; i++) push(0);
  for (let k = 0; k < n; k++) {
    const dir = k % 2 ? -1 : 1;
    for (let i = 0; i < fps * 1.8; i++) push(dir * 0.3 * Math.min(1, i / (fps * 0.3), (fps * 1.8 - i) / (fps * 0.3)));
    for (let i = 0; i < fps * 1.2; i++) push(0);
  }
  return { kind: 'wiggle-recording', version: 1, station: 'lean', heightSource: 'sim', device: { camera: [1280, 720] }, expected: n, trueCount: n, rows, events: [] };
}

// Synthetic toy recordings in recorder.js's format. Kid at play distance (shoulders 0.2 of the frame
// height), a big blue thing in the room the whole time. shown = colours he holds up, in ask order.
export function syntheticToy(shown = ['red', 'yellow', 'green'], { toySize = 0.0032, fps = 30, background = 0.058 } = {}) {
  const rows = [];
  const dt = 1 / fps;
  let t = 0, k = 0;
  const wrist = [0.72, 0.36];
  const push = (toy) => {
    t += dt; k++;
    const c = { red: null, blue: [0.62, 0.47, +(background + 0.004 * Math.sin(k / 9)).toFixed(5)], yellow: null, green: null };
    if (toy) {
      const flicker = (k % 7) === 0; // the tracker loses a small toy now and then
      c[toy] = flicker ? null : [wrist[0] + 0.01, wrist[1] - 0.03, toySize];
    }
    rows.push({ t: +t.toFixed(3), hdt: dt, y: 0.53, s: 0.04, f: 0, m: 0.01, h: 0, bw: 0.2, kn: 1, z: 2,
      pk: [0.6, 0.39, 1, 0.52, 0.85, 0.6, ...wrist, 0.95, 0.54, 0.53, 1, 0.66, 0.48, 1], c });
  };
  for (let i = 0; i < fps * 5; i++) push(null);            // demo + a moment to find his toy
  for (const col of shown) {
    for (let i = 0; i < fps * 2; i++) push(col);            // holds it up ~2 s
    for (let i = 0; i < fps * 3; i++) push(null);           // puts it down, next colour asked
  }
  for (let i = 0; i < fps * 3; i++) push(null);
  return { kind: 'wiggle-recording', version: 1, station: 'toy', heightSource: 'sim', colors: ['red', 'blue', 'yellow', 'green'],
    device: { camera: [1280, 720] }, expected: 3, trueCount: shown.length, rows, events: [] };
}

function main() {
  let failures = 0;
  const report = (name, r) => {
    if (r.status === 'fail') failures++;
    const label = r.status === 'info-fail' ? 'INFO (face-era, not enforced) MISS' : r.status === 'info-pass' ? 'INFO (face-era) ok' : r.status.toUpperCase();
    console.log(`${label} ${name}\n     ${r.msg}`);
  };
  report('synthetic 3-jump recording (format self-check)', checkRecording(syntheticRecording(3)));
  report('synthetic 2-run recording (format self-check)', checkRecording(syntheticRun(2)));
  report('synthetic 4-punch recording (format self-check)', checkRecording(syntheticPunch(4)));
  report('synthetic 4-lean recording (format self-check)', checkRecording(syntheticLean(4)));
  report('synthetic toy: small toys held up at play distance count, big blue background ignored', checkRecording(syntheticToy(['red', 'yellow', 'green'])));
  report('synthetic toy: only a big blue background (no toy) counts nothing', checkRecording(syntheticToy([])));
  report('synthetic toy: a big background colour still counts nothing when it is asked for', checkRecording(syntheticToy([]), { toy: { order: ['blue'], busy: 1 } }));

  const arg = process.argv[2];
  const dir = 'fixtures.local';
  const files = arg ? [arg] : existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f)) : [];
  if (!files.length) console.log(`SKIP no recordings in ${dir}/ (save one from Move Lab's 🔧 overlay to add real-data tests)`);
  for (const file of files) {
    let rec;
    try { rec = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { report(basename(file), { status: 'fail', msg: `unreadable: ${e.message}` }); continue; }
    if (rec.kind !== 'wiggle-recording') { report(basename(file), { status: 'skip', msg: 'not a wiggle recording' }); continue; }
    report(basename(file), checkRecording(rec));
  }
  if (failures) { console.log(`\n${failures} recording(s) failed`); process.exit(1); }
  console.log('\nAll recordings passed');
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) main();
