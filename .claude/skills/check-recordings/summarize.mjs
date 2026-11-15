// Collects new Move Lab / game recordings and summarizes them for the studio session.
// Usage (from the repo root of the MAIN checkout):
//   node .claude/skills/check-recordings/summarize.mjs [--minutes N] [--all] [--file path.json]
//
// 1. Copies wiggle-recording JSON files from ~/Downloads into fixtures.local/ (never moves or deletes
//    anything in Downloads; skips exact duplicates like "name (1).json").
// 2. Prints a summary per recording (newest first): station, counts, fun, note, events, and a compact
//    timeline of the signals that matter for that station.
// 3. Prints the replay check result (scripts/replay.js) for each.
// Recordings are numbers only (no video); still, they describe a child: never paste them anywhere public.
import { readdirSync, readFileSync, statSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const minutes = args.includes('--minutes') ? +args[args.indexOf('--minutes') + 1] : 120;
const all = args.includes('--all');
const only = args.includes('--file') ? resolve(args[args.indexOf('--file') + 1]) : null;
const FIX = 'fixtures.local';
const DL = join(homedir(), 'Downloads');
if (!existsSync('scripts/replay.js')) { console.error('Run this from the repo root (main checkout).'); process.exit(1); }
mkdirSync(FIX, { recursive: true });

const isRec = (p) => { try { const d = JSON.parse(readFileSync(p, 'utf8')); return d && d.kind === 'wiggle-recording' ? d : null; } catch { return null; } };
const clean = (name) => name.replace(/ \(\d+\)(?=\.json$)/, '');

// 1. collect from Downloads
const copied = [];
if (existsSync(DL) && !only) {
  for (const f of readdirSync(DL)) {
    if (!f.endsWith('.json')) continue;
    const src = join(DL, f);
    if (!isRec(src)) continue;
    const dst = join(FIX, clean(f));
    if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue; // already have it
    copyFileSync(src, dst);
    copied.push(basename(dst));
  }
}
console.log(copied.length ? `Copied from Downloads: ${copied.join(', ')}` : 'No new recordings in Downloads.');

// 2. pick recordings to summarize
const cutoff = Date.now() - minutes * 60_000;
let files = only ? [only] : readdirSync(FIX).filter((f) => f.endsWith('.json')).map((f) => join(FIX, f));
files = files.map((p) => ({ p, m: statSync(p).mtimeMs })).filter((x) => only || all || x.m >= cutoff || copied.includes(basename(x.p)))
  .sort((a, b) => b.m - a.m).map((x) => x.p);
if (!files.length) { console.log(`No recordings from the last ${minutes} min. Use --all or --minutes N.`); process.exit(0); }

const { checkRecording } = await import(resolve('scripts/replay.js'));
const ZONES = ['none', 'too-close', 'good', 'too-far'];
const RUN = ['idle', 'walking', 'running'];
const f2 = (v, d = 2) => (v == null || Number.isNaN(v) ? '  -  ' : (+v).toFixed(d));

for (const p of files) {
  const d = isRec(p);
  if (!d) { console.log(`\n${basename(p)}: not a wiggle recording, skipped`); continue; }
  const { rows = [], events = [], ...m } = d;
  const ev = {};
  for (const e of events) ev[e.name] = (ev[e.name] || 0) + 1;
  console.log(`\n━━ ${basename(p)}`);
  console.log(`  station ${m.station}  expected ${m.expected}  real ${m.trueCount ?? 'UNLABELLED'}  detected ${m.detected}` +
    `  confirmed ${m.confirmed ?? '-'}  fun ${m.fun ?? '-'}  timedOut ${!!m.timedOut}  ${f2(m.duration, 1)} s  source ${m.heightSource || 'face'}` +
    `  device ${m.device?.ua || '?'}/${m.device?.tier || '?'}`);
  if (m.note) console.log(`  NOTE: ${m.note}`);
  if (m.settings) console.log(`  settings: ${JSON.stringify(m.settings).slice(0, 300)}`);
  if (m.summary) console.log(`  summary: ${JSON.stringify(m.summary).slice(0, 400)}`);
  console.log(`  face seen ${rows.filter((r) => r.f).length}/${rows.length} rows · events ${JSON.stringify(ev)}`);

  // compact timeline: 1 line per second, the columns that exist in this file
  const has = (k) => rows.some((r) => r[k] != null);
  console.log('  timeline (1/s):');
  let next = 0;
  for (const r of rows) {
    if (r.t < next) continue;
    next += 1;
    const cols = [`${f2(r.t, 1).padStart(5)}s`];
    if (has('h')) cols.push(`height ${f2(r.h)}`);
    if (has('s')) cols.push(`size ${f2(r.s, 3)}`);
    if (has('rs')) cols.push(`run ${RUN[r.rs] ?? r.rs} ${f2(r.ri)}`);
    if (has('pv')) cols.push(`punch ${f2(r.pv)}`);
    if (has('z')) cols.push(`zone ${ZONES[r.z] ?? '-'}${r.kn != null ? (r.kn ? ' knees' : ' no-knees') : ''}`);
    if (has('m')) cols.push(`motion ${f2(r.m, 3)}`);
    if (has('f')) cols.push(r.f ? 'face' : '----');
    console.log('   ' + cols.join('  '));
  }
  const keyEv = events.filter((e) => !['step'].includes(e.name)).slice(0, 40).map((e) => `${f2(e.t, 1)}:${e.name}`);
  if (keyEv.length) console.log(`  events: ${keyEv.join('  ')}${events.length > 40 ? ' …' : ''}`);
  try {
    const r = checkRecording(d);
    console.log(`  REPLAY: ${r.status.toUpperCase()} — ${r.msg}`);
  } catch (e) { console.log(`  REPLAY: error ${e.message}`); }
}
