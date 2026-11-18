// Magic Mirror: a playground of silly camera effects he drives with his body. A hub of 12 effect
// "stations" (+ 🎲 Surprise me). The hub shows the focused effect LIVE on him (show, don't tell) and
// refreshes the other tiles one at a time. In a station: a voice line, the effect, a magic meter that
// fills with movement and pops into a finale, then the effect keeps going. No winning, no losing.
// Brief: docs/briefs/10-magic-mirror.md · progress: docs/briefs/10-magic-mirror.progress.md
//
// Rendering: three.js shaders in gl.js (lazy chunk), drawn onto the 2D stage under the HUD and particles.
// Test: ?keys&fakecam=person (cartoon kid driven by the keys). ?debug: digits 1-9, 0, -, = start a
// station, H = hub, F = finale now. The camera picture never leaves the device; nothing is saved but
// settings, points and play counts.

import { createMirrorGL, GL_TIERS } from './gl.js';
import { EFFECT_STATIONS } from './effects.js';
import { CUTOUT_STATIONS } from './cutouts.js';
import { loadTuning } from './settings.js';
import { createPanel } from './panel.js';
import { createClapDetector, clamp, hsl, emoji } from './util.js';

export const STATIONS = [...EFFECT_STATIONS, ...CUTOUT_STATIONS];
STATIONS.forEach((d, i) => { d.n = i + 1; });
const SURPRISE = { id: 'surprise', n: 13, title: 'Surprise me!', word: 'Surprise!', icon: '🎲', color: '#ffffff' };
const TILES = [...STATIONS, SURPRISE];

const STORE = 'wiggle.magicmirror';
const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const GESTURES = ['jump', 'crouch', 'stand', 'spin', 'turn', 'hide', 'peekaboo', 'punch', 'still', 'lean', 'step', 'leave', 'return'];
const CLONE_CAP = { high: 8, medium: 6, low: 4 };
const fmt = (n) => Math.round(n).toLocaleString('en-US');

let ctx, S, gl, tuning, panel, ui, offs = [], onPointer, onKey, onResize;

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify({ points: S.points, stats: S.stats })); } catch { /* private mode */ } }

// ---------- the body this frame (smoothed, with sensible defaults when nobody is seen) ----------
function createBody() {
  return {
    found: false, chest: { x: 0.5, y: 0.55 }, feet: { x: 0.5, y: 0.95 }, top: 0.25, size: 0.16,
    lean: 0, height: 0, crouch: 0, armsUp: 0, motion: 0, vel: { x: 0, y: 0 }, wrists: [{ ok: false }, { ok: false }],
    _m: 0, _prev: null,
  };
}
function updateBody(B, dt) {
  const P = ctx.pose, seg = ctx.segment;
  const a = (ctx.camera.width || 640) / (ctx.camera.height || 480);
  const k = Math.min(1, dt * 12);
  const ease = (o, x, y) => { o.x += (x - o.x) * k; o.y += (y - o.y) * k; };
  let chest = null, feet = null, top = null, size = null;
  if (P.found && P.leftShoulder && P.leftHip) {
    const ls = P.leftShoulder, rs = P.rightShoulder, lh = P.leftHip, rh = P.rightHip;
    const sm = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }, hm = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    size = Math.max(0.04, Math.hypot((sm.x - hm.x) * a, sm.y - hm.y) / 1.5);
    chest = { x: sm.x * 0.6 + hm.x * 0.4, y: sm.y * 0.6 + hm.y * 0.4 };
    const ank = [P.leftAnkle, P.rightAnkle].filter((p) => p && (p.v ?? 1) > 0.5);
    feet = { x: hm.x, y: Math.min(0.99, ank.length ? Math.max(...ank.map((p) => p.y)) + size * 0.12 : hm.y + size * 2.6) };
    top = (P.nose?.y ?? sm.y - size) - size * 0.75;
    const up = [P.leftWrist, P.rightWrist].map((w) => (w && (w.v ?? 1) > 0.5 ? clamp((sm.y - w.y) / (size * 0.9)) : 0));
    B.armsUp += ((up[0] + up[1]) / 2 - B.armsUp) * Math.min(1, dt * 6);
    B.wrists = [P.leftWrist, P.rightWrist].map((w) => (w && (w.v ?? 1) > 0.5 ? { x: w.x, y: w.y, ok: true } : { ok: false }));
    const d = B.wrists[0].ok && B.wrists[1].ok ? Math.hypot((B.wrists[0].x - B.wrists[1].x) * a, B.wrists[0].y - B.wrists[1].y) / size : null;
    if (S.clap.update(ctx.time, d)) fire('clap', {});
  } else if (seg?.ready && seg.box) {
    const b = seg.box;
    size = b.h / 4.2; chest = { x: b.x + b.w / 2, y: b.y + b.h * 0.35 }; feet = { x: b.x + b.w / 2, y: b.y + b.h }; top = b.y;
    B.wrists = [{ ok: false }, { ok: false }];
    B.armsUp *= Math.exp(-dt * 3);
  } else {
    B.wrists = [{ ok: false }, { ok: false }];
    B.armsUp *= Math.exp(-dt * 3);
  }
  B.found = !!chest;
  if (chest) {
    const px = B.chest.x, py = B.chest.y;
    ease(B.chest, chest.x, chest.y); ease(B.feet, feet.x, feet.y);
    B.top += (top - B.top) * k; B.size += (size - B.size) * k;
    const vx = (B.chest.x - px) / Math.max(dt, 1e-3), vy = (B.chest.y - py) / Math.max(dt, 1e-3);
    B.vel.x += (vx - B.vel.x) * Math.min(1, dt * 10); B.vel.y += (vy - B.vel.y) * Math.min(1, dt * 10);
  } else { B.vel.x *= 0.9; B.vel.y *= 0.9; }
  B.lean = ctx.gestures.steer?.value || 0;
  B.height = ctx.gestures.height || 0;
  const crouchT = ctx.gestures.crouching ? 1 : clamp(-B.height / 4);
  B.crouch += (crouchT - B.crouch) * Math.min(1, dt * 8);
  B._m += ((ctx.motion.total || 0) - B._m) * Math.min(1, dt * 4);
  B.motion = clamp(B._m * 4);
}

// ---------- rects: an area of the stage the camera "covers" (full screen, the hub preview, a tile) ----------
function makeRect(x, y, w, h) {
  const vw = ctx.camera.width || 640, vh = ctx.camera.height || 480;
  const s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s;
  const ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
  return {
    x, y, w, h, dw, dh, unit: Math.min(w, h), k: gl.scale * (w / ctx.W),
    toScreen: (nx, ny) => ({ x: ox + nx * dw, y: oy + ny * dh }),
    toNorm: (px, py) => ({ x: (px - ox) / dw, y: (py - oy) / dh }),
  };
}

// ---------- the mirror API stations get ----------
const NOOP_FX = { burst() {}, confetti() {}, text() {}, shake() {} };
function makeM(rect, live, def) {
  const st = S.station;
  return {
    ctx, set: tuning.settings, preview: !live, time: S.t, rect, body: S.body, gl, music: ctx.music,
    aspect: (ctx.camera.width || 640) / (ctx.camera.height || 480),
    tierName: ctx.perf.settings.name,
    maxClones: Math.min(tuning.settings.maxClones, CLONE_CAP[ctx.perf.settings.name] || 6),
    finaleTime: def.finaleTime || 4,
    fx: live ? ctx.fx : NOOP_FX,
    meter: live ? (v) => { if (st && st.finaleT == null) st.meter = Math.min(1, st.meter + v * tuning.settings.meterSpeed); } : () => {},
    score: live ? (pts, text, x, y, o) => score(pts, text, x, y, o) : () => {},
    sfx: live ? sfx : () => {},
    say: live ? (text, o) => ctx.say(text, o) : () => {},
    meterBurst: live ? meterBurst : () => {},
  };
}
function sfx(name, ...a) {
  const f = ctx.sfx[name];
  if (typeof f === 'function' && name !== 'play') f(...a);
  else ctx.sfx.play(name);
}
function score(pts, text, x, y, o = {}) {
  const st = S.station;
  if (!st) return;
  const u = Math.min(ctx.W, ctx.H);
  if (x == null) { const c = st.rect.toScreen(S.body.chest.x, S.body.chest.y); x = c.x; y = c.y - u * 0.18; }
  x = clamp(x, u * 0.15, ctx.W - u * 0.15); y = clamp(y, u * 0.28, ctx.H - u * 0.2);
  st.combo = st.t - st.lastHit < 2.5 ? Math.min(5, st.combo + 1) : 1;
  st.lastHit = st.t;
  const got = Math.round(pts * (o.small ? 1 : st.combo));
  st.points += got; S.points += got;
  st.flash = 1;
  if (text) ctx.fx.text(x, y, text, { size: u * (o.big ? 0.16 : o.small ? 0.05 : 0.09), color: o.big ? '#ffffff' : '#ffcc33', life: 1 });
  if (!o.small) ctx.fx.text(x, y + u * 0.07, `+${fmt(got)}`, { size: u * 0.055, color: '#fff' });
  ctx.recorder.event('score', { pts: got, text });
}
function meterBurst() {
  const m = meterRect();
  for (let i = 0; i < 10; i++) ctx.fx.burst(m.x + (m.w * i) / 9, m.y + m.h / 2, { count: 14, speed: 600, size: 10, color: hsl(i * 36) });
}

// ---------- stations ----------
function startStation(def, { surprise = false } = {}) {
  leaveStation();
  const st = Object.assign(def.init(), {
    def, t: 0, meter: 0, finaleT: null, finales: 0, points: 0, combo: 0, lastHit: -9, flash: 0, shown: 0,
    surprise, surpriseT: 0, rect: makeRect(0, 0, ctx.W, ctx.H), banner: 0, bannerText: '',
  });
  S.station = st; S.mode = 'station';
  const stat = (S.stats[def.id] ||= { visits: 0, seconds: 0, finales: 0, points: 0 });
  stat.visits++; save();
  ctx.recorder.start({ station: `magic-mirror:${def.id}`, title: def.title, maxRows: 18000 });
  ctx.sfx.whoosh();
  ctx.say(def.intro);
  st.banner = 2.2; st.bannerText = `${def.icon} ${def.title}`;
  ui.render();
}

function leaveStation() {
  const st = S.station;
  if (!st) return;
  if (st.finaleT != null) { st.def.finaleEnd?.(st, makeM(st.rect, true, st.def)); ctx.music.resume(); }
  const stat = S.stats[st.def.id]; if (stat) { stat.seconds += st.t; stat.points += st.points; }
  save();
  ctx.recorder.stop();
  S.station = null;
}

function toHub() {
  leaveStation();
  S.mode = 'hub'; S.hubT = 0;
  ctx.sfx.whoosh();
  ui.render();
}

function startFinale(st) {
  st.finaleT = 0; st.finales++;
  S.stats[st.def.id].finales++; save();
  const M = makeM(st.rect, true, st.def);
  st.def.finale?.(st, M);
  ctx.fx.confetti(Math.round(120 * ctx.perf.settings.particles + 40));
  ctx.fx.shake(14);
  ctx.sfx.tada();
  ctx.say(st.def.finaleLine);
  score(1000, null, ctx.W / 2, ctx.H * 0.4);
  st.banner = 2.5; st.bannerText = `✨ ${st.def.finaleLine.split(/[.!]/)[0]}! ✨`;
  ctx.recorder.event('finale', { station: st.def.id });
}

function nextStation(dir = 1) {
  const st = S.station;
  const i = st ? STATIONS.indexOf(st.def) : -1;
  startStation(STATIONS[(i + dir + STATIONS.length) % STATIONS.length]);
}

function surprise() {
  const cur = S.station?.def;
  const pool = STATIONS.filter((d) => d !== cur);
  const def = pool[Math.floor(Math.random() * pool.length)];
  S.transition = { t: 0, def };
  ctx.sfx.whoosh(); ctx.sfx.play('sonic');
}

function fire(name, data) {
  const st = S.station;
  ctx.recorder.event('gesture', { name });
  S.log.unshift(`${S.t.toFixed(1)} ${name}`); S.log.length = Math.min(S.log.length, 6);
  if (S.mode === 'hub') { S.hubPoke = 1; if (name === 'jump' || name === 'clap' || name === 'spin') S.hubPokeKick = 1; return; }
  if (!st || S.transition) return;
  const fn = st.def.on?.[name];
  if (fn) { try { fn(st, makeM(st.rect, true, st.def), data); } catch (e) { console.error('[magic-mirror]', e); } }
}

// ---------- hub layout ----------
function layoutHub() {
  const { W, H } = ctx;
  const land = W > H * 1.1;
  const top = Math.max(96, H * 0.13);
  let pv, grid;
  if (land) {
    const pw = Math.min(W * 0.46, (H - top - 120) * 4 / 3);
    pv = { x: W * 0.03, y: top, w: pw, h: pw * 0.75 };
    grid = { x: pv.x + pv.w + W * 0.03, y: top, w: W - (pv.x + pv.w + W * 0.03) - W * 0.02, h: H - top - 16 };
  } else {
    const pw = W * 0.92, ph = Math.min(pw * 0.72, H * 0.36);
    pv = { x: (W - pw) / 2, y: top, w: pw, h: ph };
    grid = { x: W * 0.03, y: pv.y + pv.h + 76, w: W * 0.94, h: H - (pv.y + pv.h + 76) - 12 };
  }
  const N = TILES.length;
  let best = 0, cols = 4;
  for (let c = 2; c <= 7; c++) {
    const rows = Math.ceil(N / c);
    const tw = grid.w / c, th = grid.h / rows;
    const s = Math.min(tw, th * 1.25);
    if (s > best) { best = s; cols = c; }
  }
  const rows = Math.ceil(N / cols);
  const cw = Math.min(grid.w / cols, (grid.h / rows) * 1.3), ch = Math.min(grid.h / rows, cw * 0.82);
  const ox = grid.x + (grid.w - cw * cols) / 2, oy = grid.y;
  const tiles = TILES.map((d, i) => ({ def: d, x: ox + (i % cols) * cw + cw * 0.04, y: oy + Math.floor(i / cols) * ch + ch * 0.04, w: cw * 0.92, h: ch * 0.92 }));
  return { land, pv, tiles, top };
}

// render a station's look into a rect of the stage (or a tile canvas): backdrop, shader, front layer
function renderStation(g, def, st, rect, live) {
  const M = makeM(rect, live, def);
  const B = S.body;
  if (!live) {
    const now = S.t;
    const dt = Math.min(0.1, now - (st._lastT ?? now - 1 / 30));
    st._lastT = now;
    try { def.update(dt, st, B, M); } catch (e) { console.error(e); }
  }
  g.save();
  if (!live) { g.beginPath(); g.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.08); g.clip(); }
  if (def.drawBack) def.drawBack(g, st, B, M);
  const src = gl.render(def, def.values(st, B, M), rect.w, rect.h);
  g.drawImage(gl.canvas, src.sx, src.sy, src.sw, src.sh, rect.x, rect.y, rect.w, rect.h);
  def.drawFront?.(g, st, B, M);
  g.restore();
}

function previewState(def) {
  let st = S.previews.get(def.id);
  if (!st) { st = Object.assign(def.init(), { finaleT: null, t: 0 }); S.previews.set(def.id, st); }
  return st;
}

function refreshTile(tile) {
  const def = tile.def;
  if (def === SURPRISE) return;
  const k = Math.min(1.5, devicePixelRatio || 1) * (ctx.perf.settings.name === 'low' ? 0.7 : 1);
  let c = S.tileImgs.get(def.id);
  const w = Math.max(8, Math.round(tile.w * k)), h = Math.max(8, Math.round(tile.h * k));
  if (!c || c.width !== w || c.height !== h) { c = document.createElement('canvas'); c.width = w; c.height = h; S.tileImgs.set(def.id, c); }
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, tile.w, tile.h);
  renderStation(g, def, previewState(def), makeRect(0, 0, tile.w, tile.h), false);
}

function drawHub(g) {
  const { W, H } = ctx;
  const L = layoutHub();
  S.layout = L;
  const u = Math.min(W, H);
  g.fillStyle = '#1b1140'; g.fillRect(0, 0, W, H);
  // sparkly background
  for (let i = 0; i < 24; i++) {
    const x = ((Math.sin(i * 91.7) * 0.5 + 0.5) * W + S.t * 8 * (1 + (i % 3))) % W;
    const y = (Math.cos(i * 37.3) * 0.5 + 0.5) * H;
    g.fillStyle = hsl(i * 30 + S.t * 40, 90, 70, 0.25 + 0.25 * Math.sin(S.t * 3 + i));
    g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); g.fill();
  }
  // title
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ts = Math.min(u * 0.075, 52);
  g.font = `900 ${ts}px ui-rounded, system-ui, sans-serif`;
  g.fillStyle = '#fff';
  g.fillText(W < 560 ? 'Magic Mirror' : '🪞 Magic Mirror', W / 2, Math.max(48, L.top * 0.5));
  // focused station, LIVE
  const def = STATIONS[S.focus];
  const pv = L.pv;
  const bump = 1 + S.hubPoke * 0.02;
  g.save();
  g.translate(pv.x + pv.w / 2, pv.y + pv.h / 2); g.scale(bump, bump); g.translate(-(pv.x + pv.w / 2), -(pv.y + pv.h / 2));
  renderStation(g, def, previewState(def), makeRect(pv.x, pv.y, pv.w, pv.h), false);
  g.lineWidth = 6; g.strokeStyle = def.color;
  g.beginPath(); g.roundRect(pv.x, pv.y, pv.w, pv.h, Math.min(pv.w, pv.h) * 0.08); g.stroke();
  g.restore();
  // label under the preview
  const ly = pv.y + pv.h + Math.min(48, u * 0.07);
  g.font = `900 ${Math.min(u * 0.07, 46)}px ui-rounded, system-ui, sans-serif`;
  const lab = `${def.icon} ${def.word}`, num = `${def.n}  `;
  const nw = g.measureText(num).width, lw = g.measureText(lab).width;
  g.textAlign = 'left';
  g.fillStyle = '#ffcc33'; g.fillText(num, pv.x + pv.w / 2 - (nw + lw) / 2, ly);
  g.fillStyle = '#fff'; g.fillText(lab, pv.x + pv.w / 2 - (nw + lw) / 2 + nw, ly);
  g.textAlign = 'center';
  const pulse = 1 + Math.sin(S.t * 5) * 0.06;
  g.save(); g.translate(pv.x + pv.w - u * 0.1, pv.y + pv.h - u * 0.1); g.scale(pulse, pulse);
  g.fillStyle = 'rgba(27,17,64,.55)'; g.beginPath(); g.arc(0, 0, u * 0.07, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-u * 0.025, -u * 0.035); g.lineTo(u * 0.04, 0); g.lineTo(-u * 0.025, u * 0.035); g.fill();
  g.restore();
  // tiles
  const every = { high: 1, medium: 2, low: 4 }[ctx.perf.settings.name] || 2;
  S.tileTick = (S.tileTick + 1) % every;
  if (S.tileTick === 0) {
    const real = L.tiles.filter((t) => t.def !== SURPRISE);
    S.rr = (S.rr + 1) % real.length;
    refreshTile(real[S.rr]);
  }
  for (const t of L.tiles) {
    const d = t.def, focused = d === def;
    const m = Math.min(t.w, t.h);
    const s = focused ? 1.04 + Math.sin(S.t * 6) * 0.02 : 1;
    g.save(); g.translate(t.x + t.w / 2, t.y + t.h / 2); g.scale(s, s); g.translate(-t.w / 2, -t.h / 2);
    g.beginPath(); g.roundRect(0, 0, t.w, t.h, m * 0.12);
    if (d === SURPRISE) {
      const gr = g.createLinearGradient(0, 0, t.w, t.h);
      for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hsl(i * 60 + S.t * 90, 85, 62));
      g.fillStyle = gr; g.fill();
      emoji(g, '🎲', t.w / 2, t.h * 0.42, m * 0.5, { rot: Math.sin(S.t * 2) * 0.4 });
    } else {
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
      const img = S.tileImgs.get(d.id);
      if (img) { g.save(); g.clip(); g.drawImage(img, 0, 0, t.w, t.h); g.restore(); }
      else emoji(g, d.icon, t.w / 2, t.h * 0.45, m * 0.45);
    }
    g.lineWidth = focused ? 5 : 3; g.strokeStyle = focused ? '#fff' : d.color;
    g.beginPath(); g.roundRect(0, 0, t.w, t.h, m * 0.12); g.stroke();
    // number + icon + word
    g.fillStyle = 'rgba(27,17,64,.7)';
    g.beginPath(); g.roundRect(0, t.h - m * 0.28, t.w, m * 0.28, [0, 0, m * 0.12, m * 0.12]); g.fill();
    g.textAlign = 'left'; g.font = `900 ${m * 0.2}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#ffcc33';
    g.fillText(d === SURPRISE ? '🎲' : String(d.n), m * 0.07, t.h - m * 0.14);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `800 ${Math.min(m * 0.16, (t.w / Math.max(5, d.word.length)) * 1.5)}px ui-rounded, system-ui, sans-serif`;
    g.fillText(d.word, t.w * 0.56, t.h - m * 0.14);
    if (d !== SURPRISE) emoji(g, d.icon, t.w - m * 0.15, m * 0.15, m * 0.2);
    g.restore();
  }
}

// ---------- station HUD ----------
function meterRect() {
  const { W, H } = ctx;
  const side = Math.min(120, W * 0.18);
  return { x: side, y: H - Math.max(70, H * 0.1), w: W - side * 2, h: Math.max(26, Math.min(44, H * 0.05)) };
}

function drawStationHUD(g, st) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  const def = st.def;
  // title + points (between the corner buttons)
  st.shown += (st.points - st.shown) * 0.1;
  const bump = 1 + st.flash * 0.25;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = Math.max(44, u * 0.07);
  g.font = `900 ${Math.min(u * 0.06, 40)}px ui-rounded, system-ui, sans-serif`;
  const label = `${def.n} ${def.icon} ${def.word}`;
  const lw = g.measureText(label).width;
  g.fillStyle = 'rgba(27,17,64,.6)'; g.beginPath(); g.roundRect(W / 2 - lw / 2 - 20, ty - u * 0.045, lw + 40, u * 0.09, u * 0.045); g.fill();
  g.fillStyle = '#fff'; g.fillText(label, W / 2, ty);
  g.save(); g.translate(W / 2, ty + u * 0.1); g.scale(bump, bump);
  g.font = `900 ${Math.min(u * 0.075, 50)}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = u * 0.012; g.strokeStyle = 'rgba(27,17,64,.75)'; g.fillStyle = '#ffcc33';
  g.strokeText(`✨ ${fmt(st.shown)}`, 0, 0); g.fillText(`✨ ${fmt(st.shown)}`, 0, 0);
  g.restore();
  if (st.combo > 1 && st.t - st.lastHit < 2.5) {
    g.save(); g.translate(W / 2 + u * 0.22, ty + u * 0.1); g.rotate(0.2 + Math.sin(st.t * 10) * 0.06);
    g.fillStyle = '#ff5ea8'; g.font = `900 ${u * 0.06}px ui-rounded, system-ui, sans-serif`; g.fillText(`x${st.combo}!`, 0, 0); g.restore();
  }
  // magic meter
  const m = meterRect();
  const full = st.finaleT != null;
  const v = full ? Math.max(0, 1 - st.finaleT / def.finaleTime) : st.meter;
  const shake = !full && v > 0.85 ? Math.sin(st.t * 40) * 3 : 0;
  g.save(); g.translate(shake, 0);
  g.fillStyle = 'rgba(27,17,64,.65)'; g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, m.h / 2); g.fill();
  if (v > 0.005) {
    const gr = g.createLinearGradient(m.x, 0, m.x + m.w, 0);
    for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hsl(i * 50 + (full ? st.t * 400 : 0), 95, 60));
    g.fillStyle = gr;
    g.beginPath(); g.roundRect(m.x + 4, m.y + 4, Math.max(m.h - 8, (m.w - 8) * v), m.h - 8, (m.h - 8) / 2); g.fill();
  }
  g.lineWidth = 3; g.strokeStyle = full ? '#fff' : def.color; g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, m.h / 2); g.stroke();
  emoji(g, full ? '🎉' : def.icon, m.x + m.w + m.h * 0.2 > W - 100 ? m.x + m.w - m.h * 0.5 : m.x + m.w, m.y + m.h / 2, m.h * 1.3, { rot: v > 0.85 ? Math.sin(st.t * 20) * 0.3 : 0 });
  g.restore();
  // banner (station name / finale)
  if (st.banner > 0) {
    const k = clamp(st.banner * 2), s = 0.7 + 0.3 * Math.min(1, (2.5 - st.banner) * 5);
    g.save(); g.globalAlpha = k; g.translate(W / 2, H * 0.42); g.scale(s, s);
    g.font = `900 ${Math.min(u * 0.11, 84)}px ui-rounded, system-ui, sans-serif`;
    g.lineWidth = u * 0.018; g.strokeStyle = 'rgba(27,17,64,.8)'; g.fillStyle = '#fff';
    g.strokeText(st.bannerText, 0, 0); g.fillText(st.bannerText, 0, 0);
    g.restore();
  }
  // Surprise me: dice + seconds left
  if (st.surprise) {
    const left = Math.max(0, tuning.settings.surpriseTime - st.surpriseT);
    const x = W - Math.max(100, u * 0.16), y = ty + u * 0.1;
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x, y, u * 0.05, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffcc33'; g.beginPath(); g.arc(x, y, u * 0.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / tuning.settings.surpriseTime)); g.stroke();
    emoji(g, '🎲', x, y, u * 0.06, { rot: Math.sin(st.t * 3) * 0.3 });
  }
  // finding you…
  if (def.usesMask && !S.body.found && !(ctx.segment?.ready && ctx.segment.box)) {
    g.font = `800 ${u * 0.04}px ui-rounded, system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText('👀 Where are you? Stand in front of me!', W / 2, m.y - u * 0.06);
  }
  g.font = `700 13px ui-monospace, monospace`; g.fillStyle = 'rgba(255,255,255,.5)'; g.textAlign = 'right';
  g.fillText(`v${ctx.release}`, W - 12, H - 10);
}

function drawTransition(g) {
  const tr = S.transition;
  if (!tr) return;
  const { W, H } = ctx;
  const u = Math.min(W, H);
  const k = tr.t < 0.5 ? tr.t / 0.5 : 1 - (tr.t - 0.5) / 0.5;
  g.fillStyle = `rgba(255,255,255,${clamp(k) * 0.9})`; g.fillRect(0, 0, W, H);
  emoji(g, '🎲', W / 2, H / 2, u * (0.2 + k * 0.3), { rot: tr.t * 12 });
}

// ---------- DOM buttons (big, visible: no hidden gestures) ----------
const CSS = `
.mm-ui { position: fixed; inset: 0; pointer-events: none; z-index: 4; }
.mm-ui button { pointer-events: auto; position: absolute; border-radius: 50%; border: 3px solid rgba(255,255,255,.55);
  background: rgba(27,17,64,.65); color: #fff; font-size: 34px; width: 80px; height: 80px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.mm-ui button:active { transform: scale(.9); }
.mm-ui .home { top: max(16px, env(safe-area-inset-top)); left: calc(max(16px, env(safe-area-inset-left)) + 90px); width: 76px; height: 76px; }
.mm-ui .prev { left: max(16px, env(safe-area-inset-left)); bottom: max(16px, env(safe-area-inset-bottom)); }
.mm-ui .next { right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); }
.mm-ui[data-mode="hub"] .home { display: none; }
@media (max-width: 640px) { .mm-ui button { width: 64px; height: 64px; font-size: 28px; } .mm-ui .home { left: calc(max(16px, env(safe-area-inset-left)) + 84px); } }
`;
function createUI() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const root = document.createElement('div'); root.className = 'mm-ui';
  const mk = (cls, txt, label, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.setAttribute('aria-label', label); b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); fn(); }); root.append(b); return b; };
  mk('home', '🏠', 'Back to the mirror hub', () => toHub());
  const prev = mk('prev', '◀', 'Previous', () => (S.mode === 'hub' ? focus(-1) : nextStation(-1)));
  const next = mk('next', '▶', 'Next', () => (S.mode === 'hub' ? focus(1) : nextStation(1)));
  document.body.append(root);
  return {
    render() {
      root.dataset.mode = S.mode;
      // in the hub, the arrows sit beside the live preview
      const L = S.mode === 'hub' ? layoutHub() : null;
      for (const [b, side] of [[prev, -1], [next, 1]]) {
        if (L) {
          const y = L.pv.y + L.pv.h + Math.min(48, Math.min(ctx.W, ctx.H) * 0.07) - 40;
          b.style.top = `${y}px`; b.style.bottom = 'auto';
          b.style.left = side < 0 ? `${L.pv.x}px` : 'auto';
          b.style.right = side > 0 ? `${ctx.W - (L.pv.x + L.pv.w)}px` : 'auto';
        } else { b.style.top = ''; b.style.bottom = ''; b.style.left = ''; b.style.right = ''; }
      }
    },
    destroy() { root.remove(); style.remove(); },
  };
}
function focus(dir) {
  S.focus = (S.focus + dir + STATIONS.length) % STATIONS.length;
  S.focusHold = 12;
  ctx.say(STATIONS[S.focus].word, { interrupt: true });
}

// ---------- the game ----------
const game = {
  needs: ['pose', 'segment', 'motion'],
  showCamera: false,
  background: '#1b1140',

  async init(c) {
    ctx = c;
    const saved = load();
    tuning = loadTuning();
    S = {
      mode: 'hub', t: 0, hubT: 0, focus: 0, focusHold: 0, station: null, points: saved.points || 0, stats: saved.stats || {},
      body: createBody(), clap: createClapDetector(), previews: new Map(), tileImgs: new Map(), tileTick: 0, rr: 0,
      transition: null, hubPoke: 0, log: [], layout: null,
    };
    const tierName = ctx.perf.settings.name;
    gl = createMirrorGL({ tier: tierName, video: ctx.camera.video });
    applySettings();
    ui = createUI();
    panel = createPanel({
      ctx, tuning, stations: STATIONS,
      group: () => S.station?.def.id || STATIONS[S.focus].id,
      onChange: applySettings,
      readouts,
      stats: statsText,
      exportFile: () => ctx.recorder.download({ game: 'magic-mirror', station: S.station?.def.id || 'hub', settings: tuning.settings, notes: tuning.notes, stats: S.stats }),
      actions: [
        { label: '🏠 Hub', fn: () => toHub() },
        { label: '⏭ Next station', fn: () => nextStation(1) },
        { label: '🏁 Finale now', fn: () => { if (S.station && S.station.finaleT == null) S.station.meter = 1; } },
        { label: '🎲 Surprise', fn: () => startStation(STATIONS[Math.floor(Math.random() * STATIONS.length)], { surprise: true }) },
      ],
    });
    for (const name of GESTURES) offs.push(ctx.gestures.on(name, (d) => fire(name, d)));
    onPointer = (e) => {
      if (S.mode !== 'hub' || !S.layout) return;
      const { pv, tiles } = S.layout;
      const x = e.clientX, y = e.clientY;
      if (x >= pv.x && x <= pv.x + pv.w && y >= pv.y && y <= pv.y + pv.h) { ctx.sfx.pop(); startStation(STATIONS[S.focus]); return; }
      for (const t of tiles) {
        if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
          ctx.sfx.pop();
          if (t.def === SURPRISE) startStation(STATIONS[Math.floor(Math.random() * STATIONS.length)], { surprise: true });
          else startStation(t.def);
          return;
        }
      }
    };
    ctx.view.canvas.addEventListener('pointerdown', onPointer);
    onResize = () => { applySettings(); ui.render(); if (S.station) S.station.rect = makeRect(0, 0, ctx.W, ctx.H); };
    addEventListener('resize', onResize);
    if (debugOn) {
      onKey = (e) => {
        if (e.target?.closest?.('input, textarea')) return;
        const k = e.key.toLowerCase();
        const idx = { 0: 9, '-': 10, '=': 11 }[k] ?? (/^[1-9]$/.test(k) ? +k - 1 : null);
        if (idx != null && STATIONS[idx]) startStation(STATIONS[idx]);
        if (k === 'h') toHub();
        if (k === 'f' && S.station && S.station.finaleT == null) S.station.meter = 1;
      };
      addEventListener('keydown', onKey);
    }
    // skip buttons in test mode (⏭ / 🏁)
    game.debugSkip = {
      next: () => (S.mode === 'hub' ? startStation(STATIONS[S.focus]) : nextStation(1)),
      finale: () => { if (S.station && S.station.finaleT == null) S.station.meter = 1; },
    };
    // for screenshots / console (numbers only; nothing about the picture)
    window.wiggle = window.wiggle || {};
    window.wiggle.mirror = {
      get S() { return S; }, STATIONS, start: (n, o) => startStation(STATIONS[n - 1], o), hub: toHub,
      finale: () => { if (S.station) S.station.meter = 1; }, focus: (n) => { S.focus = n - 1; S.focusHold = 60; },
      get gl() { return gl; },
      get fps() { return ctx.perf.fps; },
      seg: () => { const g = ctx.segment; return { ready: g.ready, source: g.source, coverage: g.coverage, box: g.box, error: g.error, frame: g.frame }; },
      surprise: (secs) => { tuning.settings.surpriseTime = secs; startStation(STATIONS[0], { surprise: true }); },
      get tier() { return ctx.perf.settings.name; },
    };
    // precompile shaders a few per frame in the hub
    S.warm = [...STATIONS];
    ui.render();
    ctx.say('Magic Mirror! Tap a picture to try it!');
  },

  update(dt) {
    S.t += dt; S.hubT += dt;
    S.frameDt = (S.frameDt || 0) + dt;
    S.hubPoke = Math.max(0, S.hubPoke - dt * 3);
    updateBody(S.body, dt);
    ctx.segment.config.smooth = tuning.settings.maskSmooth;
    if (S.warm?.length) gl.warm(S.warm.shift());
    if (S.mode === 'hub') {
      S.focusHold -= dt;
      if (S.focusHold <= 0) { S.focusHold = 5; if (S.hubT > 1) S.focus = (S.focus + 1) % STATIONS.length; }
    }
    if (S.transition) {
      S.transition.t += dt;
      if (S.transition.t >= 0.5 && !S.transition.done) { S.transition.done = true; startStation(S.transition.def, { surprise: true }); }
      if (S.transition.t >= 1) S.transition = null;
    }
    const st = S.station;
    if (st) {
      st.t += dt;
      st.flash = Math.max(0, st.flash - dt * 2.5);
      st.banner = Math.max(0, st.banner - dt);
      const M = makeM(st.rect, true, st.def);
      try { st.def.update(dt, st, S.body, M); } catch (e) { console.error('[magic-mirror]', e); }
      if (st.finaleT == null && st.meter >= 1) startFinale(st);
      else if (st.finaleT != null) {
        st.finaleT += dt;
        if (st.finaleT >= st.def.finaleTime) {
          st.def.finaleEnd?.(st, M);
          st.finaleT = null; st.meter = 0;
        }
      }
      if (st.surprise && st.finaleT == null && !S.transition) {
        st.surpriseT += dt;
        if (st.surpriseT >= tuning.settings.surpriseTime) surprise();
      }
    }
    panel.update(dt);
  },

  draw(g) {
    gl.frame(ctx, S.frameDt || 1 / 60);
    S.frameDt = 0;
    if (S.mode === 'hub') drawHub(g);
    else if (S.station) {
      const st = S.station;
      g.fillStyle = '#1b1140'; g.fillRect(0, 0, ctx.W, ctx.H);
      renderStation(g, st.def, st, st.rect, true);
      drawStationHUD(g, st);
    }
    drawTransition(g);
  },

  destroy() {
    leaveStation();
    offs.forEach((off) => off()); offs = [];
    ctx.view.canvas.removeEventListener('pointerdown', onPointer);
    removeEventListener('resize', onResize);
    if (onKey) removeEventListener('keydown', onKey);
    panel?.destroy(); ui?.destroy(); gl?.destroy();
    panel = ui = gl = null;
    if (window.wiggle) delete window.wiggle.mirror;
  },
};

function applySettings() {
  const s = tuning.settings;
  const base = (GL_TIERS[ctx.perf.settings.name] || GL_TIERS.medium).scale;
  gl.resize(ctx.W, ctx.H, Math.min(1.25, base * s.sharpness));
  gl.settings.feather = s.maskFeather;
  gl.settings.cut = s.maskCut;
  gl.settings.plateRate = s.plateRate;
}

function readouts() {
  const seg = ctx.segment, B = S.body, st = S.station;
  return [
    `tier ${ctx.perf.settings.name} · ${ctx.perf.fps.toFixed(0)} fps · render ${gl.canvas.width}x${gl.canvas.height}`,
    `history ${gl.historyFrames}/${gl.maxFrames} frames @ ${gl.fps} fps (${gl.historySeconds.toFixed(1)} s)`,
    `cutout: ${seg.ready ? seg.source : 'not ready'}${seg.error ? ' (model failed: ' + seg.error + ')' : ''} · ${seg.width}x${seg.height} · person ${(seg.coverage * 100).toFixed(0)}%`,
    `body ${B.found ? 'seen' : 'not seen'} · motion ${B.motion.toFixed(2)} · lean ${B.lean.toFixed(2)} · height ${B.height.toFixed(1)} · crouch ${B.crouch.toFixed(2)} · arms up ${B.armsUp.toFixed(2)}`,
    st ? `station ${st.def.n} ${st.def.title} · meter ${(st.meter * 100).toFixed(0)}% · finales ${st.finales} · ✨ ${fmt(st.points)}` : `hub · focus ${STATIONS[S.focus].title}`,
    `events: ${S.log.join(' · ') || '-'}`,
  ].join('\n');
}
function statsText() {
  const rows = STATIONS.map((d) => {
    const s = S.stats[d.id];
    return s ? `${String(d.n).padStart(2)} ${d.word.padEnd(8)} ${String(s.visits).padStart(3)}x ${String(Math.round(s.seconds)).padStart(5)} s  ${s.finales} finales` : `${String(d.n).padStart(2)} ${d.word.padEnd(8)}   -`;
  });
  return `total ✨ ${fmt(S.points)}\n` + rows.join('\n');
}

export default game;
