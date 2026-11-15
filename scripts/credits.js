// Credits: src/credits.json is the one source of truth.
//   node scripts/credits.js           regenerate docs/CREDITS.md from it   (npm run credits)
//   node scripts/credits.js --check   (npm test) fail if
//     - a sound/music/art file under public/ has no credits entry (assets: paths or * globs, relative to public/)
//     - an asset pattern matches no file (a stale entry)
//     - an entry with a license that needs attribution (CC-BY…) is missing its name, source or url
//     - docs/CREDITS.md is out of date (run `npm run credits`)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const DOC = join(ROOT, 'docs', 'CREDITS.md');
// folders whose files must all be credited (future art/music folders go here too)
const SCANNED = ['sounds', 'music', 'art', 'images', 'models', 'fonts'];
// metadata files that aren't assets (the Sound Picker's candidate lists)
const IGNORE = [/^sounds\/[^/]+\.json$/];

export function loadCredits() { return JSON.parse(readFileSync(join(ROOT, 'src', 'credits.json'), 'utf8')); }

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    if (n.startsWith('.')) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [relative(PUBLIC, p).split('\\').join('/')];
  });
}

const globRe = (pat) => new RegExp(`^${pat.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);

export function markdown(c) {
  const out = ['# Credits', '', '<!-- Generated from src/credits.json by `npm run credits`. Edit that file, not this one. -->', ''];
  for (const s of c.sections) {
    out.push(`## ${s.title}`);
    if (s.note) out.push('', s.note);
    out.push('');
    for (const e of s.entries) {
      const bits = [e.role, e.source, e.license].filter(Boolean).join(' · ');
      out.push(`- **${e.name}**${bits ? `: ${bits}` : ''}${e.url ? ` (${e.url})` : ''}`);
    }
    out.push('');
  }
  out.push('The child is credited by role only. Other family names are never in this repo: they are typed on the device in Cloud Credits\' 🔧 panel.', '');
  return out.join('\n');
}

export function check(c, files) {
  const errors = [];
  const entries = c.sections.flatMap((s) => s.entries.map((e) => ({ ...e, section: s.id })));
  const pats = entries.flatMap((e) => (e.assets || []).map((p) => ({ p, re: globRe(p), e })));
  for (const f of files) if (!pats.some(({ re }) => re.test(f))) errors.push(`no credits entry for public/${f} (add it to src/credits.json "assets")`);
  for (const { p, re, e } of pats) if (!files.some((f) => re.test(f))) errors.push(`"${e.name}" asset "${p}" matches no file (stale entry?)`);
  for (const e of entries) {
    if (!e.name) errors.push(`an entry in "${e.section}" has no name`);
    if (/BY/i.test(e.license || '') && !(e.source && e.url)) errors.push(`"${e.name}" is ${e.license}: attribution needs source and url`);
  }
  return errors;
}

export function assetFiles() {
  return SCANNED.flatMap((d) => walk(join(PUBLIC, d))).filter((f) => !IGNORE.some((re) => re.test(f)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const c = loadCredits();
  const md = markdown(c);
  if (process.argv.includes('--check')) {
    const files = assetFiles();
    const errors = check(c, files);
    if (readFileSync(DOC, 'utf8') !== md) errors.push('docs/CREDITS.md is out of date: run `npm run credits`');
    // self-test: an uncredited file must be caught
    if (!check(c, [...files, 'sounds/sfx/brand-new-sound.m4a']).some((e) => e.includes('brand-new-sound'))) errors.push('self-test: an uncredited file was not caught');
    if (errors.length) { console.error(`credits: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`); process.exit(1); }
    console.log(`credits: ok (${files.length} asset files covered by ${c.sections.reduce((n, s) => n + s.entries.length, 0)} entries; CREDITS.md in sync)`);
  } else {
    writeFileSync(DOC, md);
    console.log(`wrote docs/CREDITS.md (${c.sections.length} sections)`);
  }
}
