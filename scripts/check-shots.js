// npm test: WARN (never fail) about games whose latest release has no menu screenshot yet.
// The menu card then shows the meta.json emoji icon. Fix: `npm run shots <game>` (fake camera only).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const GAMES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/games');
const vcmp = (a, b) => { const [x, y] = [a, b].map((v) => v.split('.').map(Number)); return x[0] - y[0] || x[1] - y[1]; };
const missing = [];
let big = [];
for (const id of fs.readdirSync(GAMES).filter((d) => /^\d+-/.test(d)).sort()) {
  const metaFile = path.join(GAMES, id, 'meta.json');
  if (!fs.existsSync(metaFile)) continue;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const latest = meta.releases?.length ? meta.releases.map((r) => r.version).sort(vcmp).at(-1) : null;
  const shot = path.join(GAMES, id, latest ? `v${latest}` : '', 'shot.webp');
  if (!fs.existsSync(shot)) missing.push(`${id}${latest ? `@${latest}` : ''}`);
  else if (fs.statSync(shot).size > 80 * 1024) big.push(`${path.relative(GAMES, shot)} (${(fs.statSync(shot).size / 1024).toFixed(0)} KB)`);
}
if (missing.length) console.log(`WARN menu screenshots: no shot.webp for ${missing.join(', ')} (menu shows the emoji). Run: npm run shots <game>`);
else console.log('ok menu screenshots: every latest release has a shot.webp');
if (big.length) console.log(`WARN menu screenshots larger than 80 KB: ${big.join(', ')}`);
