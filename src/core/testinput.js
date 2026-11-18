// Test controls: play-test any game WITHOUT moving (for grown-ups). Keys or an on-screen pad move a
// pretend body (testbody.js), and the pretend body is fed to the SAME detectors a real body is: its
// 33-point pose replaces tracking.pose, its eye line and presence drive gestures' face path, and its
// motion level replaces motion.total (gestures and games: sneaky rounds hear how busy it is). So jumps, spins, runs and punches arrive with
// realistic lag and ramps, exactly as a game would see them from a kid. Feel tuning still needs a kid.
//
// Turn on: ?keys in the URL, the 🎮 Keyboard button in a game's 🔧 panel (testinput.toggleButton()),
// or the 🎮 chip that ?debug shows. Stays on for this browser tab (sessionStorage) until turned off.
//   Space jump · ↓ hold crouch · ↑ hold run · Shift+↑ (or W) hold sneak · ← → hold lean · Enter punch · S spin · P peekaboo
//   L leave / come back · T stand still · [ ] game speed 1× 2× 4× · ? (or H) cheat sheet
//   The ?debug letters J (jump), C (crouch toggle), R (hold: run), X (punch) go through the body too.
// While on, a 🎮 KEYS badge is shown; on touch screens a translucent pad (also toggled from the sheet).
// Recordings made while it's on are marked testInput: true and never count as real data (replay.js).
// ?keys in the URL is silent test mode, like ?fakecam (audio.js): add &sound to hear the game.
//
//   testinput.active            on (and a game is running or not: see .running)
//   testinput.lean              -1..1 pretend lean, eased (gestures feeds it to steer.js via gestures.simLean)
//   testinput.timeScale         1 | 2 | 4: the runtime runs the game's update this many times per frame
//   testinput.pose / .face / .motion   the current pretend samples (read by runtime / gestures)
//   game.debugSkip = { next: fn, finale: fn }   optional: shown as ⏭ / 🏁 buttons while test mode is on

import { createTestBody, createKeyMapper } from './testbody.js';
import { perf } from './perf.js';
import { camera } from './camera.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const STORE = 'wiggle.testInput';
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};
let enabled = params.has('keys') ? params.get('keys') !== '0' : store.get(STORE) === '1';
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let padOn = params.has('pad') || (coarse && store.get(STORE + '.pad') !== '0');
const SPEEDS = [1, 2, 4];

const body = createTestBody();
const keys = createKeyMapper(body);
let running = false, needs = [], game = null, acc = 0, sample = null, readout = null;
const listeners = new Set();
// ?fakecam=person draws the cartoon kid from the same pose sample the detectors get (null = it idles)
camera.fakePoseSource = () => (enabled && running ? testinput.pose : null);

export const testinput = {
  body,
  get active() { return enabled; },
  get running() { return running; },
  get lean() { return body.lean; }, // gestures copies it into gestures.simLean (steer.js's sim hook) while on
  timeScale: 1,
  pose: { found: false, points: [] },
  face: { found: false, points: [], center: { x: 0.5, y: 0.5 }, leftEye: null, rightEye: null, roll: 0, size: 0, mouthOpen: 0, smile: 0, blinkLeft: 0, blinkRight: 0, blend: {} },
  motion: 0,
  usedSince: 0, // performance.now() ms when it was last on (recorder: "was test input used?")

  handles(key) { return enabled && running && keys.handles(key); },

  setEnabled(on) {
    on = !!on;
    if (on === enabled) return;
    enabled = on;
    store.set(STORE, on ? '1' : null);
    keys.blur(); body.reset(); acc = 1;
    if (!on) this.timeScale = 1;
    console.info(`[testinput] ${on ? 'ON: keys move a pretend body' : 'off'}`);
    ui.render();
    listeners.forEach((fn) => fn(on));
  },
  toggle() { this.setEnabled(!enabled); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  setReadout(fn) { readout = fn; },

  // runtime: a game started / stopped
  begin(n, g) { needs = n; game = g; running = true; body.reset(); acc = 1; this.timeScale = 1; ui.render(); },
  end() { running = false; game = null; keys.blur(); body.reset(); this.timeScale = 1; ui.render(); },

  // runtime, every frame while a game runs: advance the pretend body; a new tracker sample every
  // 1 / trackFps s (so detectors that look at sample-to-sample speed see a realistic rate).
  update(dt) {
    if (!enabled || !running) return false;
    this.usedSince = performance.now();
    body.update(dt);
    acc += dt;
    if (acc < 1 / perf.settings.trackFps && sample) return false;
    acc = 0;
    sample = body.sample(camera.width / camera.height);
    this.pose = sample.pose; this.face = sample.face; this.motion = sample.motion;
    return true;
  },

  // runtime, every frame: keep the skip buttons in step with the running game
  frame(g) { if (g !== game) game = g; ui.syncSkip(); ui.tickSheet(); },

  // A "🎮 Keyboard" on/off button for a parent panel (Move Lab overlay, Smash Run tuning, ...).
  toggleButton() {
    const b = document.createElement('button');
    b.type = 'button';
    const sync = () => { b.textContent = enabled ? '🎮 Keyboard: ON' : '🎮 Keyboard: off'; b.classList.toggle('on', enabled); };
    b.onclick = () => { this.toggle(); b.blur(); };
    sync();
    const off = this.onChange(sync);
    // stop listening once the panel is thrown away
    const mo = new MutationObserver(() => { if (!b.isConnected) { off(); mo.disconnect(); } });
    queueMicrotask(() => { if (b.isConnected) mo.observe(document.body, { childList: true, subtree: true }); });
    return b;
  },
};

// ---------- keyboard ----------
const typing = (t) => t?.closest?.('input, textarea, select, [contenteditable]');
addEventListener('keydown', (e) => {
  if (!enabled || !running || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ']' || e.key === '[') {
    e.preventDefault();
    if (e.repeat) return;
    const i = SPEEDS.indexOf(testinput.timeScale) + (e.key === ']' ? 1 : -1);
    testinput.timeScale = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i))];
    ui.render();
    return;
  }
  if (e.key === '?' || (e.key.toLowerCase() === 'h' && !debugOn)) { ui.sheet(!ui.sheetOpen); return; }
  if (keys.keyDown(e)) e.preventDefault(); // Space / arrows: no page scroll, no clicking the focused button
}, true);
addEventListener('keyup', (e) => {
  if (!enabled || !running || typing(e.target)) return;
  if (keys.keyUp(e)) e.preventDefault(); // (Space "clicks" a focused button on keyup)
}, true);
addEventListener('blur', () => keys.blur());
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.blur(); });

// ---------- on-screen UI: badge, cheat sheet, touch pad ----------
const CSS = `
.ti-root { position: fixed; inset: 0; pointer-events: none; z-index: 60; font: 700 15px system-ui, sans-serif; color: #fff; }
.ti-root button { pointer-events: auto; font: inherit; color: #fff; background: rgba(20,10,50,.55); border: 2px solid rgba(255,255,255,.45);
  border-radius: 12px; padding: 6px 10px; cursor: pointer; -webkit-user-select: none; user-select: none; touch-action: none; }
.ti-root button.on { border-color: #ffcc33; background: rgba(255,204,51,.3); }
.ti-bar { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
.ti-badge { background: rgba(255,120,30,.8) !important; border-color: #fff !important; letter-spacing: .5px; }
.ti-chip { opacity: .55; }
.ti-sheet { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 46px); left: 50%; transform: translateX(-50%);
  width: min(360px, calc(100vw - 24px)); background: rgba(15,8,40,.88); border: 2px solid rgba(255,255,255,.3); border-radius: 14px;
  padding: 10px 12px; pointer-events: auto; font-weight: 500; font-size: 14px; line-height: 1.45; }
.ti-sheet[hidden], .ti-pad[hidden], .ti-root [hidden] { display: none; }
.ti-sheet kbd { display: inline-block; min-width: 22px; text-align: center; background: rgba(255,255,255,.18); border-radius: 5px; padding: 0 5px; font: 700 13px ui-monospace, monospace; }
.ti-sheet .row { display: flex; gap: 10px; align-items: flex-start; }
.ti-sheet canvas { width: 84px; height: 120px; background: rgba(0,0,0,.35); border-radius: 8px; flex: none; }
.ti-sheet .live { font: 12px ui-monospace, monospace; opacity: .85; white-space: pre-wrap; margin-top: 6px; }
.ti-sheet .btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.ti-sheet .note { opacity: .7; font-size: 12px; margin-top: 6px; }
.ti-pad { position: absolute; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 26px); /* clear of audio's 🔇 badge */ display: grid; gap: 8px; opacity: .8; }
.ti-pad.left { left: max(10px, env(safe-area-inset-left)); grid-template-columns: repeat(2, 66px); }
.ti-pad.right { right: max(10px, env(safe-area-inset-right)); grid-template-columns: repeat(3, 66px); }
.ti-pad button { height: 66px; font-size: 24px; padding: 0; border-radius: 16px; background: rgba(0,0,0,.35); line-height: 1.05; }
.ti-pad button small { display: block; font-size: 11px; font-weight: 700; }
.ti-pad button.down { background: rgba(255,204,51,.45); border-color: #ffcc33; }
.ti-pad .wide { grid-column: span 2; }
@media (max-width: 430px) {
  .ti-pad { gap: 6px; }
  .ti-pad.left { grid-template-columns: repeat(2, 56px); }
  .ti-pad.right { grid-template-columns: repeat(3, 56px); }
  .ti-pad button { height: 56px; font-size: 21px; }
}
`;

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const ui = {
  built: false, sheetOpen: false, skipKey: '',
  build() {
    if (this.built || typeof document === 'undefined' || !document.body) return;
    this.built = true;
    const style = h('style'); style.textContent = CSS; document.head.append(style);
    const root = this.root = h('div', 'ti-root');
    const bar = this.bar = h('div', 'ti-bar');
    this.chip = h('button', 'ti-chip', '🎮 off'); this.chip.title = 'Test controls (keyboard / touch pad)';
    this.chip.onclick = () => testinput.setEnabled(true);
    this.badge = h('button', 'ti-badge', '🎮 KEYS'); this.badge.title = 'Test controls are ON (tap for the cheat sheet)';
    this.badge.onclick = () => this.sheet(!this.sheetOpen);
    this.speed = h('button', null, '1×'); this.speed.title = 'Game speed ( [ / ] )';
    this.speed.onclick = () => { const i = (SPEEDS.indexOf(testinput.timeScale) + 1) % SPEEDS.length; testinput.timeScale = SPEEDS[i]; this.render(); };
    this.next = h('button', null, '⏭'); this.next.title = 'Skip to the next level / round (game.debugSkip.next)';
    this.finale = h('button', null, '🏁'); this.finale.title = 'Skip to the finale (game.debugSkip.finale)';
    const skip = (k) => () => { try { game?.debugSkip?.[k]?.(); } catch (e) { console.error('[testinput] debugSkip', e); } };
    this.next.onclick = skip('next'); this.finale.onclick = skip('finale');
    bar.append(this.chip, this.badge, this.speed, this.next, this.finale);

    const sheet = this.sheetEl = h('div', 'ti-sheet'); sheet.hidden = true;
    const row = h('div', 'row');
    this.canvas = h('canvas'); this.canvas.width = 168; this.canvas.height = 240;
    const keysEl = h('div');
    keysEl.innerHTML = [
      ['Space', 'jump'], ['↓ hold', 'crouch'], ['↑ hold', 'run'], ['⇧↑ / W hold', 'sneak (tiptoe)'], ['← → hold', 'lean'], ['Enter', 'punch'],
      ['S', 'spin'], ['P', 'peekaboo'], ['L', 'leave / back'], ['T', 'stand still'], ['[ ]', 'speed'], ['?', 'this sheet'],
    ].map(([k, v]) => `<kbd>${k}</kbd> ${v}`).join('<br>');
    row.append(this.canvas, keysEl);
    this.live = h('div', 'live');
    const btns = h('div', 'btns');
    this.padBtn = h('button', null, '🕹 Touch pad');
    this.padBtn.onclick = () => { padOn = !padOn; store.set(STORE + '.pad', padOn ? '1' : '0'); this.render(); };
    const off = h('button', null, '✕ Turn off'); off.onclick = () => { this.sheet(false); testinput.setEnabled(false); };
    btns.append(this.padBtn, off);
    const note = h('div', 'note', 'Keys move a pretend body; the real detectors decide what happened (with a little lag, like a camera). Feel tuning still needs a real kid. Recordings made now are marked TEST-INPUT.');
    sheet.append(row, this.live, btns, note);

    // touch pad: hold buttons press on pointerdown and release on up / cancel
    const padBtn = (parent, label, sub, name, hold, cls) => {
      const b = h('button', cls); b.innerHTML = `${label}<small>${sub}</small>`;
      const release = (e) => { if (!b.classList.contains('down')) return; b.classList.remove('down'); if (hold) body.release(name); e?.preventDefault(); };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (b.classList.contains('down') && hold) return; // second finger on a held button
        b.classList.add('down');
        body.press(name);
        if (!hold) setTimeout(() => b.classList.remove('down'), 150);
        try { b.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      parent.append(b);
    };
    const left = this.padL = h('div', 'ti-pad left');
    padBtn(left, '◀', 'lean', 'left', true); padBtn(left, '▶', 'lean', 'right', true);
    padBtn(left, '⬇', 'crouch', 'crouch', true); padBtn(left, '🤫', 'sneak', 'sneak', true);
    const right = this.padR = h('div', 'ti-pad right');
    padBtn(right, '🌀', 'spin', 'spin', false); padBtn(right, '🙈', 'peek', 'peekaboo', true); padBtn(right, '👊', 'punch', 'punch', false);
    padBtn(right, '⬆', 'run', 'run', true); padBtn(right, '🦘', 'jump', 'jump', false, 'wide');

    root.append(bar, sheet, left, right);
    document.body.append(root);
  },

  sheet(open) { this.sheetOpen = open; this.render(); },

  render() {
    this.build();
    if (!this.built) return;
    const on = enabled, inGame = running;
    this.chip.hidden = on || !debugOn;
    this.badge.hidden = !on;
    this.speed.hidden = !on || !inGame;
    this.speed.textContent = `${testinput.timeScale}×`;
    this.speed.classList.toggle('on', testinput.timeScale !== 1);
    this.sheetEl.hidden = !on || !this.sheetOpen;
    this.padL.hidden = this.padR.hidden = !on || !inGame || !padOn;
    this.padBtn.classList.toggle('on', padOn);
    this.skipKey = '';
    this.syncSkip();
  },

  syncSkip() {
    if (!this.built) return;
    const s = enabled && running ? game?.debugSkip : null;
    const key = `${!!s?.next}${!!s?.finale}`;
    if (key === this.skipKey) return;
    this.skipKey = key;
    this.next.hidden = !s?.next; this.finale.hidden = !s?.finale;
  },

  // cheat sheet: a little stick figure of the pretend body + what the detectors make of it
  tickSheet() {
    if (!this.built || this.sheetEl.hidden) return;
    const now = performance.now();
    if (now - (this.lastDraw || 0) < 66) return;
    this.lastDraw = now;
    const g = this.canvas.getContext('2d'), W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);
    const p = testinput.pose;
    if (p.found) {
      const P = (i) => [(p.points[i].x - 0.5) * W * 1.6 + W / 2, (p.points[i].y - 0.05) * H];
      g.strokeStyle = '#7dff6a'; g.lineWidth = 5; g.lineCap = 'round';
      for (const [a, b] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]]) {
        const A = P(a), B = P(b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      }
      const n = P(0); g.fillStyle = '#ffcc33'; g.beginPath(); g.arc(n[0], n[1], 14, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = '#fff'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.fillText('away', W / 2, H / 2); }
    const b = body.state;
    const lines = [`lean ${body.lean.toFixed(2)}  effort ${b.effort.toFixed(2)}  ${body.frozen ? 'STILL' : ''}`];
    if (readout) { try { lines.push(readout()); } catch { /* game gone */ } }
    if (!needs.includes('pose') && !needs.includes('face')) lines.push('(this game only uses motion: keys do nothing here)');
    this.live.textContent = lines.join('\n');
  },
};

if (typeof document !== 'undefined') {
  const boot = () => ui.render();
  if (document.body) boot(); else addEventListener('DOMContentLoaded', boot);
}
