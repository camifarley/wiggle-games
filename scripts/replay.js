// Replays real Move Lab recordings (fixtures.local/*.json) through the detectors. Part of `npm test`.
// A recording labelled "5 jumps" must still produce exactly 5 jumps after any change to height.js.
//
// Get a fixture: open Move Lab, run the Jump or Squat station, open the 🔧 overlay, confirm or
// correct the count, tap 💾, and drop the file into fixtures.local/ (gitignored: it stays private).
// Run one file: node scripts/replay.js path/to/file.json
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHeightTracker } from '../src/core/height.js';

// Which detector event each station's labelled count refers to.
export const STATION_EVENT = { jump: 'jump', squat: 'crouch' };

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

// Checks one recording. Returns { status: 'pass' | 'fail' | 'skip', msg }.
export function checkRecording(rec) {
  const want = STATION_EVENT[rec.station];
  if (!want) return { status: 'skip', msg: `station "${rec.station}" has no replay check yet` };
  if (rec.trueCount == null) return { status: 'skip', msg: 'not labelled (confirm the count in the 🔧 overlay before saving)' };
  const got = replayHeight(rec).filter((e) => e.name === want);
  const live = (rec.events || []).filter((e) => e.src === 'gestures' && e.name === want).length;
  const note = rec.events?.length && live !== got.length ? ` (live run detected ${live}: replay differs from the live run)` : '';
  const ok = got.length === rec.trueCount;
  return {
    status: ok ? 'pass' : 'fail',
    msg: `${want}: expected ${rec.trueCount}, replay got ${got.length} [${got.map((e) => e.t.toFixed(1)).join(', ')}]${note}`,
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
  return { kind: 'wiggle-recording', version: 1, station: 'jump', expected: jumps, trueCount: jumps, rows, events: [] };
}

function main() {
  let failures = 0;
  const report = (name, r) => {
    if (r.status === 'fail') failures++;
    console.log(`${r.status.toUpperCase()} ${name}\n     ${r.msg}`);
  };
  report('synthetic 3-jump recording (format self-check)', checkRecording(syntheticRecording(3)));

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
