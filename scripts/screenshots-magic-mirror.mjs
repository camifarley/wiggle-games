// Screenshots of every Magic Mirror station with the FAKE person (?fakecam=person): never a real camera.
// Drives headless Chrome over the DevTools protocol (no extra npm packages), muted, using the test
// controls' keys (synthetic key events) and window.wiggle.mirror.
//
//   npm run dev:http -- --port 5110      (in another terminal)
//   node scripts/screenshots-magic-mirror.mjs http://localhost:5110 docs/screenshots/10-magic-mirror
//
// Writes NN-station.jpg per station (+ a few finale shots), hub.jpg and contact-sheet.jpg.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5110';
const OUT = process.argv[3] || 'docs/screenshots/10-magic-mirror';
const TIER = process.argv[4] || 'high';
const W = 1280, H = 720;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'mm-shots-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
  '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check',
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank',
], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${expr}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
};
const key = (k, type) => evaluate(`dispatchEvent(new KeyboardEvent('${type}', { key: ${JSON.stringify(k)}, bubbles: true })), 1`);
const tap = async (k, hold = 80) => { await key(k, 'keydown'); await sleep(hold); await key(k, 'keyup'); };
const down = (k) => key(k, 'keydown');
const up = (k) => key(k, 'keyup');

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  const buf = Buffer.from(r.data, 'base64');
  writeFileSync(join(OUT, `${name}.jpg`), buf);
  console.log(`  ${name}.jpg ${(buf.length / 1024).toFixed(0)} KB`);
  return { name, data: r.data };
}

const SPACE = ' ';
// What to do in each station before the picture (keys = the test controls: Space jump, ↓ crouch,
// ←/→ lean, ↑ run, Enter punch, s spin, p peekaboo, t stand still).
const PLAN = [
  { n: 1, name: 'funhouse', act: async () => { await down('ArrowRight'); await sleep(1300); await tap(SPACE); await sleep(330); }, after: () => up('ArrowRight') },
  { n: 2, name: 'clone-party', act: async () => { for (let i = 0; i < 5; i++) { await tap(SPACE); await sleep(800); } await down('ArrowLeft'); await sleep(900); }, after: () => up('ArrowLeft') },
  { n: 3, name: 'time-smear', act: async () => { await down('ArrowUp'); await down('ArrowLeft'); await sleep(900); await up('ArrowLeft'); await down('ArrowRight'); await sleep(900); }, after: async () => { await up('ArrowUp'); await up('ArrowRight'); } },
  { n: 4, name: 'rainbow-trails', act: async () => { await down('ArrowUp'); await down('ArrowLeft'); await sleep(800); await up('ArrowLeft'); await down('ArrowRight'); await sleep(500); await tap(SPACE); await sleep(250); }, after: async () => { await up('ArrowUp'); await up('ArrowRight'); } },
  { n: 5, name: 'light-painter', act: async () => { await down('ArrowUp'); await down('ArrowLeft'); await sleep(900); await up('ArrowLeft'); await tap(SPACE); await down('ArrowRight'); await sleep(1000); await up('ArrowRight'); await tap('Enter'); await sleep(250); await tap('Enter'); await sleep(500); }, after: () => up('ArrowUp') },
  { n: 6, name: 'kaleidoscope', act: async () => { await down('p'); await sleep(1500); await tap('s'); await sleep(700); }, after: () => up('p') },
  { n: 7, name: 'pixel-me', act: async () => { await sleep(600); await tap(SPACE); await sleep(260); } },
  { n: 8, name: 'teleporter', act: async () => { await sleep(500); await tap(SPACE); await sleep(1900); } },
  { n: 9, name: 'giant', act: async () => { await down('p'); await sleep(2200); await tap(SPACE); await sleep(350); }, after: () => up('p') },
  { n: 10, name: 'statue', act: async () => { await tap('t'); await sleep(3800); } },
  { n: 11, name: 'invisible', act: async () => { await down('p'); await sleep(2600); await up('p'); await sleep(300); } },
  { n: 12, name: 'jelly-me', act: async () => { await sleep(600); await tap(SPACE); await sleep(250); await down('ArrowLeft'); await sleep(450); }, after: () => up('ArrowLeft') },
];
const EXTRA = [
  { n: 9, name: 'giant-tiny', act: async () => { await down('ArrowDown'); await sleep(1800); }, after: () => up('ArrowDown') },
  { n: 8, name: 'teleporter-space-zap', act: async () => { await sleep(500); await tap(SPACE); await sleep(220); } },
  { n: 2, name: 'clone-party-finale-conga', act: async () => { for (let i = 0; i < 3; i++) { await tap(SPACE); await sleep(700); } await evaluate('wiggle.mirror.finale()'); await sleep(2600); } },
  { n: 6, name: 'kaleidoscope-finale-bloom', act: async () => { await evaluate('wiggle.mirror.finale()'); await sleep(1300); } },
  { n: 7, name: 'pixel-me-finale-build', act: async () => { await evaluate('wiggle.mirror.finale()'); await sleep(1500); } },
  { n: 10, name: 'statue-cracking', act: async () => { await tap('t'); await sleep(4300); await down('ArrowUp'); await sleep(600); }, after: () => up('ArrowUp') },
  { n: 11, name: 'invisible-finale-ghosts', act: async () => { await down('ArrowUp'); await sleep(800); await evaluate('wiggle.mirror.finale()'); await sleep(2000); }, after: () => up('ArrowUp') },
  { n: 12, name: 'jelly-finale-quake', act: async () => { await evaluate('wiggle.mirror.finale()'); await sleep(1400); } },
];

async function main() {
  // connect
  let ver;
  for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
  if (!ver) throw new Error('Chrome did not start');
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) { pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const url = `${BASE}/?keys&fakecam=person&tier=${TIER}#/play/10-magic-mirror`;
  await send('Page.navigate', { url });
  await sleep(1500);
  await evaluate(`document.querySelector('.big-btn')?.click(), 1`);
  for (let i = 0; i < 60; i++) { if (await evaluate('!!window.wiggle?.mirror')) break; await sleep(250); }
  // hide test-mode chrome (badges) so the pictures show what the kid sees
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = '.ti-root, [title^="Silent because"] { display: none !important; }'; document.head.append(s); return 1; })()`);
  await sleep(2500);
  const shots = [];
  await evaluate('wiggle.mirror.focus(1), 1');
  await sleep(2500);
  shots.push({ ...(await shot('00-hub')), label: 'Hub' });
  for (const p of [...PLAN, ...EXTRA]) {
    await evaluate(`wiggle.mirror.start(${p.n}), 1`);
    await sleep(1600); // intro banner fades
    await p.act();
    const isExtra = EXTRA.includes(p);
    const fname = `${String(p.n).padStart(2, '0')}-${p.name}`;
    const s = await shot(fname);
    console.log(`    fps ${Math.round(await evaluate('wiggle.mirror.fps'))} (${await evaluate('wiggle.mirror.tier')})`);
    shots.push({ ...s, label: `${p.n} · ${p.name.replace(/-/g, ' ')}`, extra: isExtra });
    await p.after?.();
    await sleep(300);
  }
  // contact sheet: every station (main shots) in a grid, plus the hub
  const main = shots.filter((s) => !s.extra);
  const cols = 4, cw = 400, ch = 225, pad = 12, lh = 30;
  const rows = Math.ceil(main.length / cols);
  const sw = cols * (cw + pad) + pad, sh = rows * (ch + lh + pad) + pad + 60;
  await send('Emulation.setDeviceMetricsOverride', { width: sw, height: sh, deviceScaleFactor: 1, mobile: false });
  await evaluate(`(() => {
    document.body.innerHTML = '';
    document.querySelectorAll('canvas, video, .mm-ui, .mm-wrench, .mm-panel, #ui').forEach((e) => e.remove());
    document.body.style.cssText = 'margin:0;background:#1b1140;font:800 18px system-ui,sans-serif;color:#fff';
    const h = document.createElement('div'); h.textContent = '🪞 Magic Mirror v1.0: every station (fake camera person only)';
    h.style.cssText = 'padding:16px 12px 8px;font-size:24px'; document.body.append(h);
    const g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:${pad}px;padding:0 ${pad}px';
    document.body.append(g);
    window.__add = (src, label) => { const d = document.createElement('div'); d.innerHTML = '<img style="width:${cw}px;height:${ch}px;border-radius:10px;display:block"><div style="height:${lh}px;line-height:${lh}px"></div>'; d.querySelector('img').src = src; d.querySelector('div').textContent = label; g.append(d); };
    return 1; })()`);
  for (const s of main) await evaluate(`window.__add('data:image/jpeg;base64,${s.data}', ${JSON.stringify(s.label)}), 1`);
  await sleep(800);
  await shot('contact-sheet');
  ws.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); });
