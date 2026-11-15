#!/usr/bin/env node
// Make a new release of a game, or check that no old release was edited.
//
//   node .claude/skills/new-release/new-release.mjs <game> <version> "<title>" [--from <version>] [--root <games dir>]
//   node .claude/skills/new-release/new-release.mjs --check [<base ref>] [--root <games dir>]
//
// <game> = folder name or number ("01-bubble-pop", "01", "1"). <version> like 1.1 or 2.0.
// Creating:
//  - a game with no releases yet (plain index.js): first moves it to v1.0/ with `git mv` (unchanged, history kept)
//    and adds a placeholder v1.0/cover.svg + a releases list with v1.0.
//  - copies the latest release folder (or --from) to v<version>/, puts a placeholder cover.svg in it
//    (REDRAW IT: a picture of the main thing that changed), and adds the entry to meta.json.
// Checking (--check): every release that exists on <base> (default origin/main, else main) must be byte-identical
// here, and a game that had a plain index.js on <base> and now has v1.0/ must have v1.0/index.js == that index.js.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const root = opt('--root') || 'src/games';
const from = opt('--from');
const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const die = (m) => { console.error(`new-release: ${m}`); process.exit(1); };
const vcmp = (a, b) => { const [x, y] = [a, b].map((v) => v.split('.').map(Number)); return x[0] - y[0] || x[1] - y[1]; };
const readMeta = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
// keep the one-line-per-release style the repo uses
function writeMeta(dir, m) {
  const { releases, ...rest } = m;
  let s = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  s += `,\n  "releases": [\n${releases.map((r) => `    ${JSON.stringify(r).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`).join(',\n')}\n  ]\n}\n`;
  fs.writeFileSync(path.join(dir, 'meta.json'), s);
}
function placeholderCover(meta, version, title) {
  const esc = (t) => String(t).replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <!-- PLACEHOLDER: redraw this as a picture of the main thing that changed in v${version} -->
  <rect width="400" height="300" rx="24" fill="#1b1140"/>
  <circle cx="200" cy="130" r="80" fill="${esc(meta.color || '#5ee0ff')}" opacity=".35"/>
  <text x="200" y="160" font-size="90" text-anchor="middle">${esc(meta.icon || '🎮')}</text>
  <text x="200" y="250" font-family="system-ui,sans-serif" font-weight="900" font-size="26" fill="#fff" text-anchor="middle">${esc(title)}</text>
  <text x="200" y="285" font-family="system-ui,sans-serif" font-weight="900" font-size="26" fill="#ffcc33" text-anchor="middle">v${esc(version)}</text>
</svg>
`;
}
function findGame(q) {
  const dirs = fs.readdirSync(root).filter((d) => /^\d+-/.test(d));
  const n = /^\d+$/.test(q) ? Number(q) : null;
  const hit = dirs.find((d) => d === q) || dirs.find((d) => n != null && Number(d.split('-')[0]) === n);
  if (!hit) die(`no game "${q}" in ${root} (have: ${dirs.join(', ')})`);
  return path.join(root, hit);
}

if (args[0] === '--check') {
  const base = args[1] || (git('rev-parse', '--verify', '-q', 'origin/main') ? 'origin/main' : 'main');
  let bad = 0;
  for (const d of fs.readdirSync(root).filter((x) => /^\d+-/.test(x))) {
    const dir = path.join(root, d);
    const metaOld = git('show', `${base}:${dir}/meta.json`);
    if (metaOld == null) continue; // a new game
    let rel = [];
    try { rel = JSON.parse(metaOld).releases || []; } catch { /* */ }
    for (const r of rel) {
      const changed = git('diff', '--name-only', base, '--', `${dir}/v${r.version}`);
      if (changed?.trim()) { console.log(`EDITED OLD RELEASE ${dir}/v${r.version}:\n  ${changed.trim().split('\n').join('\n  ')}`); bad++; }
    }
    if (!rel.length) { // plain index.js on base: if it's now v1.0, it must be the same code
      const oldIdx = git('show', `${base}:${dir}/index.js`);
      const v10 = path.join(dir, 'v1.0', 'index.js');
      if (oldIdx != null && fs.existsSync(v10) && fs.readFileSync(v10, 'utf8') !== oldIdx) { console.log(`CHANGED WHILE MOVING: ${v10} differs from ${base}:${dir}/index.js`); bad++; }
      else if (oldIdx != null && fs.existsSync(v10)) console.log(`ok ${dir}: index.js moved to v1.0/ unchanged`);
    }
  }
  console.log(bad ? `\n${bad} old release problem(s) (only a 🔧 test-tool hook with no gameplay change is allowed: say so in the PR)` : `ok: no old release was edited (vs ${base})`);
  process.exit(bad ? 1 : 0);
}

const [q, version, title] = args;
if (!q || !/^\d+\.\d+$/.test(version || '') || !title) die('usage: new-release.mjs <game> <version e.g. 1.1> "<title>" [--from <version>]');
const dir = findGame(q);
const meta = readMeta(dir);
const inGit = git('rev-parse', '--is-inside-work-tree')?.trim() === 'true' && git('ls-files', '--error-unmatch', path.join(dir, 'meta.json')) != null;

if (!meta.releases?.length) {
  // 1. plain game → v1.0
  const files = fs.readdirSync(dir).filter((f) => f !== 'meta.json');
  if (!files.includes('index.js')) die(`${dir} has no releases and no index.js`);
  fs.mkdirSync(path.join(dir, 'v1.0'));
  for (const f of files) {
    const src = path.join(dir, f), dst = path.join(dir, 'v1.0', f);
    if (inGit && git('ls-files', '--error-unmatch', src) != null) execFileSync('git', ['mv', src, dst]); else fs.renameSync(src, dst);
  }
  fs.writeFileSync(path.join(dir, 'v1.0', 'cover.svg'), placeholderCover(meta, '1.0', meta.title));
  meta.releases = [{ version: '1.0', title: meta.title }];
  console.log(`moved ${dir}/{${files.join(',')}} → v1.0/ (unchanged) + placeholder v1.0/cover.svg`);
  if (files.some((f) => f !== 'index.js')) console.log('  NOTE: other files moved too; check relative imports/asset paths (../ depth changed by one).');
}
if (meta.releases.some((r) => r.version === version)) die(`${dir} already has v${version}`);
const latest = from || meta.releases.map((r) => r.version).sort(vcmp).at(-1);
if (vcmp(version, latest) <= 0 && !from) die(`v${version} must be newer than the latest release v${latest}`);
const srcDir = path.join(dir, `v${latest}`), dstDir = path.join(dir, `v${version}`);
if (!fs.existsSync(srcDir)) die(`no ${srcDir}`);
fs.cpSync(srcDir, dstDir, { recursive: true });
for (const f of fs.readdirSync(dstDir)) if (/^cover\./.test(f)) fs.rmSync(path.join(dstDir, f));
fs.writeFileSync(path.join(dstDir, 'cover.svg'), placeholderCover(meta, version, title));
meta.releases.push({ version, title });
meta.releases.sort((a, b) => vcmp(a.version, b.version));
writeMeta(dir, meta);
console.log(`copied v${latest} → v${version}, added "${title}" to ${dir}/meta.json
next: edit ${dstDir}/index.js, REDRAW ${dstDir}/cover.svg (placeholder now), never touch older v*/ folders,
      then: node .claude/skills/new-release/new-release.mjs --check`);
