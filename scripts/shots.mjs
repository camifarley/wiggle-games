#!/usr/bin/env node
// Menu screenshots: plays each game headlessly with the FAKE camera and saves a small shot.webp per release.
//
//   npm run shots                     every game's latest release
//   npm run shots 06                  one game (folder name or number), latest release
//   npm run shots 06 --all-releases   every release of that game (npm run shots -- --all-releases = all games)
//   npm run shots 06@1.1              one release
//   options: --show (visible Chrome window), --keep-going (don't stop at the first failure),
//            --out <dir> (write somewhere else, e.g. a scratch folder), --chrome <path>
//
// Output: src/games/NN-x/vX.Y/shot.webp (or NN-x/shot.webp for a plain index.js game), 640×400 webp q≈0.8.
// The registry finds them (import.meta.glob); nothing to list by hand.
//
// PRIVACY (the repo is public and the real camera sees a child): shots ONLY ever come from ?fakecam.
//  1. every URL this script opens has ?fakecam (checked before loading, refuses otherwise);
//  2. getUserMedia is replaced in the page with one that throws, and Chrome runs with its fake media device;
//  3. right before each capture the page must report ?fakecam AND a canvas-generated camera track
//     (CanvasCaptureMediaStreamTrack), or the shot is refused and nothing is written.
//
// Staging a good moment (mid-action, not a title card):
//  - a NEW release can export `shot` on its game object:
//      shot: { wait: 6, keys: ['down ArrowUp', 'wait 3', 'press Space'], setup(ctx) { ... } }
//    setup runs once the game started; keys run after it, then `wait` seconds, then the capture.
//  - FROZEN old releases are staged from outside, in STAGE below (never edit their code).
//    STAGE[id@version] wins over the game's own hook.
//  Key steps: 'down K' / 'up K' / 'press K' (puppeteer key names: Space, ArrowUp, Enter, KeyS, …), 'wait N' (s),
//  'speed N' (1|2|4 test-controls fast-forward), 'skip next' / 'skip finale' (game.debugSkip),
//  { skip: 'why' } leaves a release without a shot (the menu keeps its emoji icon).
//  'click x y' (CSS px in the 1280×800 page), 'eval <js>' (runs in the page; `ctx` = wiggle.ctx).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'src/games');
const W = 1280, H = 800, SCALE = 0.5; // captured at 640×400
const QUALITY = 80;
const DEFAULT_WAIT = 6;

// Bounc'a Bugs: jump until the first bag bursts, then catch the bugs flying out
const BUG_JUMPS = ['wait 2', ...Array.from({ length: 4 }, () => ['wait 1.3', 'press Space']).flat()];

// Old releases (frozen code): how to reach a lively moment from outside. Tuned by looking at the results.
const STAGE = {
  '01-bubble-pop@1.0': { wait: 7 },
  '01-bubble-pop@1.1': { wait: 7 },
  // needs a real face: the plain fake camera only shows "Look at me!". Keeps its emoji until a fake face exists.
  '02-animal-face': { skip: 'needs a face (the fake camera has none yet)' },
  '03-bouncy-boom': { wait: 6 },
  '04-bounca-bugs@1.0': { keys: BUG_JUMPS, wait: 1.2 },
  '04-bounca-bugs@1.1': { keys: BUG_JUMPS, wait: 1.2 },
  '04-bounca-bugs@2.0': { keys: BUG_JUMPS, wait: 1.2 },
  '05-move-lab': { wait: 3 },
  '06-smash-run@1.0': { keys: ['wait 2', 'down ArrowUp', 'wait 4', 'press Enter', 'wait 0.5', 'press Enter', 'wait 0.5', 'press Enter'], wait: 0.3 },
  '06-smash-run@1.1': { keys: ['wait 2', 'down ArrowUp', 'wait 4', 'press Enter', 'wait 0.5', 'press Enter', 'wait 0.5', 'press Enter'], wait: 0.3 },
  '06-smash-run@1.2': { keys: ['wait 2', 'down ArrowUp'], wait: 6 },
  '07-space-pilot@1.0': { keys: ['wait 2', 'down ArrowRight', 'wait 1', 'up ArrowRight'], wait: 6 },
  '08-mega-roll@1.0': { keys: ['wait 2', 'down ArrowLeft', 'wait 1', 'up ArrowLeft'], wait: 6 },
  '09-cloud-credits@1.0': { keys: ['wait 2', 'skip next', 'wait 1', 'skip next'], wait: 3 },
  '09-cloud-credits@1.1': { keys: ['wait 2', 'skip next', 'wait 1', 'skip next'], wait: 3 },
};

// ---- args
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); if (i < 0) return false; argv.splice(i, 1); return true; };
const opt = (n) => { const i = argv.indexOf(n); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const ALL = flag('--all-releases');
const SHOW = flag('--show');
const KEEP_GOING = flag('--keep-going');
const VERBOSE = flag('--verbose');
const t0 = Date.now();
const vlog = (m) => { if (VERBOSE) console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`); };
const OUT = opt('--out');
const CHROME = opt('--chrome') || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const query = argv[0] || null;

const die = (m) => { console.error(`shots: ${m}`); process.exit(1); };
const vcmp = (a, b) => { const [x, y] = [a, b].map((v) => v.split('.').map(Number)); return x[0] - y[0] || x[1] - y[1]; };

// ---- what to shoot
function listGames() {
  return fs.readdirSync(GAMES).filter((d) => /^\d+-/.test(d) && fs.existsSync(path.join(GAMES, d, 'meta.json'))).map((id) => {
    const meta = JSON.parse(fs.readFileSync(path.join(GAMES, id, 'meta.json'), 'utf8'));
    const plain = !meta.releases?.length;
    const versions = plain ? ['1.0'] : meta.releases.map((r) => r.version).sort(vcmp);
    return { id, number: Number(id.split('-')[0]), plain, versions };
  });
}
function targets() {
  let games = listGames();
  let onlyVer = null;
  if (query) {
    const [q, v] = query.split('@');
    const n = /^\d+$/.test(q) ? Number(q) : null;
    games = games.filter((g) => g.id === q || (n != null && g.number === n));
    if (!games.length) die(`no game "${q}"`);
    onlyVer = v || null;
  }
  const out = [];
  for (const g of games) {
    const vers = onlyVer ? [onlyVer] : ALL ? g.versions : [g.versions.at(-1)];
    for (const v of vers) {
      if (!g.versions.includes(v)) die(`${g.id} has no v${v}`);
      const rel = g.plain ? '' : `v${v}`;
      const file = path.join(OUT ? path.resolve(OUT) : GAMES, g.id, rel, 'shot.webp');
      out.push({ ...g, version: v, key: g.plain ? g.id : `${g.id}@${v}`, file, hash: g.plain ? `#/play/${g.id}` : `#/play/${g.id}@${v}` });
    }
  }
  return out;
}

// ---- privacy guard #1: only fake-camera URLs
function safeUrl(u) {
  const url = new URL(u);
  if (!url.searchParams.has('fakecam')) die(`REFUSING ${u}: screenshots only come from ?fakecam (never the real camera)`);
  if (url.searchParams.has('sound')) die(`REFUSING ${u}: shots run silent (no &sound)`);
  return url.href;
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function startServer() {
  process.env.HTTP = '1'; // vite.config.js: plain http (no self-signed cert)
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'error', server: {
    host: '127.0.0.1', port: 5290, strictPort: false, open: false,
    // writing shot.webp into src/ would change the registry glob and reload the page mid-shot
    hmr: false, watch: { ignored: ['**/shot.webp'] },
  } });
  await server.listen();
  const addr = server.httpServer.address();
  return { server, base: `http://127.0.0.1:${addr.port}/` };
}

async function runSteps(page, steps) {
  for (const s of steps || []) {
    const [cmd, ...rest] = s.split(' ');
    const arg = rest.join(' ');
    if (cmd === 'wait') await sleep(Number(arg));
    else if (cmd === 'down') await page.keyboard.down(arg);
    else if (cmd === 'up') await page.keyboard.up(arg);
    else if (cmd === 'press') await page.keyboard.press(arg);
    else if (cmd === 'speed') await page.evaluate((n) => { window.wiggle.testinput.timeScale = n; }, Number(arg));
    else if (cmd === 'skip') await page.evaluate((k) => window.wiggle.runtime.game?.debugSkip?.[k]?.(), arg);
    else if (cmd === 'click') { const [x, y] = rest.map(Number); await page.mouse.click(x, y); }
    else if (cmd === 'eval') await page.evaluate((code) => { const ctx = window.wiggle.ctx; return (0, eval)(`(ctx) => { ${code} }`)(ctx); }, arg);
    else throw new Error(`unknown step "${s}"`);
  }
}

// hide grown-up / test chrome so the shot shows only the game
const HIDE_CSS = `.ti-root, .back-btn, .debug, [data-shot-hide] { display: none !important; }`;

async function shoot(browser, base, t) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  // privacy guard #2: the page can never open a real camera
  await page.evaluateOnNewDocument(() => {
    const no = () => Promise.reject(new DOMException('shots.mjs: real camera disabled', 'NotAllowedError'));
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: no, configurable: false });
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: () => Promise.resolve([]), configurable: false });
    }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/^INFO: /.test(m.text())) errors.push(m.text()); vlog(`console.${m.type()}: ${m.text().slice(0, 200)}`); });
  if (VERBOSE) page.on('requestfailed', (r) => vlog(`request failed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  try {
    vlog(`open ${t.hash}`);
    await page.goto(safeUrl(`${base}?fakecam&keys&shot${t.hash}`), { waitUntil: 'load' });
    await page.waitForSelector('.big-btn', { timeout: 20000 });
    await page.click('.big-btn'); // ▶ Play
    vlog('play tapped');
    // started, or the core's "Oops" error screen (then fail fast)
    await page.waitForFunction(() => !!window.wiggle?.runtime?.game || /hiccup|need the camera/.test(document.getElementById('ui')?.textContent || ''), { timeout: 60000 });
    if (!(await page.evaluate(() => !!window.wiggle.runtime.game))) throw new Error(`the game did not start (${errors.slice(-1)[0] || 'error screen'})`);
    vlog('game running');
    await page.addStyleTag({ content: HIDE_CSS });
    await page.evaluate(() => { for (const d of document.querySelectorAll('body > div')) if (d.textContent === '🔇 test mode') d.setAttribute('data-shot-hide', ''); });
    const hook = await page.evaluate(() => { const s = window.wiggle.runtime.game?.shot; return s ? { wait: s.wait, keys: s.keys, setup: typeof s.setup === 'function' } : null; });
    const stage = STAGE[t.key] || hook || {};
    if (!STAGE[t.key] && hook?.setup) await page.evaluate(() => window.wiggle.runtime.game.shot.setup(window.wiggle.ctx));
    await runSteps(page, stage.keys);
    await sleep(stage.wait ?? DEFAULT_WAIT);
    // privacy guard #3: right before the capture, prove the picture can only contain the fake camera
    const ok = await page.evaluate(() => {
      if (!new URLSearchParams(location.search).has('fakecam')) return 'no ?fakecam in the page URL';
      const v = document.getElementById('cam');
      const tracks = v?.srcObject?.getVideoTracks?.() || [];
      if (!tracks.length) return 'no camera track';
      if (!tracks.every((tr) => typeof CanvasCaptureMediaStreamTrack !== 'undefined' && tr instanceof CanvasCaptureMediaStreamTrack)) return 'camera track is not the fake canvas stream';
      return true;
    });
    if (ok !== true) throw new Error(`PRIVACY GUARD refused the shot: ${ok}`);
    vlog('capture');
    const buf = await page.screenshot({ type: 'webp', quality: QUALITY });
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    fs.writeFileSync(t.file, buf);
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(k).catch(() => {});
    return { bytes: buf.length, errors };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const list = targets();
  if (!fs.existsSync(CHROME)) die(`no Chrome at ${CHROME} (pass --chrome <path> or set CHROME_PATH)`);
  const { default: puppeteer } = await import('puppeteer-core');
  const { server, base } = await startServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: !SHOW,
    args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
      '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    defaultViewport: null,
  });
  let failed = 0;
  try {
    for (const t of list) {
      if (STAGE[t.key]?.skip) { console.log(`${t.key.padEnd(24)} skipped: ${STAGE[t.key].skip}`); continue; }
      try {
        const r = await shoot(browser, base, t);
        console.log(`${t.key.padEnd(24)} ${(r.bytes / 1024).toFixed(1).padStart(5)} KB  ${path.relative(ROOT, t.file)}${r.errors.length ? `  (page errors: ${r.errors.slice(0, 2).join(' | ').slice(0, 160)})` : ''}`);
      } catch (e) {
        failed++;
        console.log(`${t.key.padEnd(24)} FAILED: ${e.message}`);
        if (!KEEP_GOING) break;
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
