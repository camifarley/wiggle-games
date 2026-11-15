// Everything 2D on top of the 3D view: lasers, star streaks, the crosshair, windshield boops (cracks, googly
// eyes, slime) and the wipers, the canopy frame + thin dashboard (speed, shields, rescued, radar), the comms
// screen (his face via ctx.head(), holo style, doubles as tracking feedback), score, passport icon, banners
// (TOP-RIGHT corner only), move cues, the countdown and the boss intro card.

import { DESIGNS } from './world3d.js';
import { drawFriend, passportStats } from './passport.js';

const fake = new URLSearchParams(location.search).has('fakecam');
const font = (px, w = 900) => `${w} ${px}px ui-rounded, system-ui, sans-serif`;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const INK = '#1b1140';

let crop = null, fizzT = 0;
export function reset() { crop = null; fizzT = 0; }

export const dashHeight = (ctx) => clamp(ctx.H * 0.1, 50, 84);
export function passportIconPos(ctx) { const u = Math.min(ctx.W, ctx.H); const r = Math.max(36, u * 0.065); return { x: ctx.W - r - 12, y: 66 + r, r }; }

// is the camera seeing him? (comms screen + the "Captain, I can't see you!" line)
export function trackingState(ctx, S) {
  const zone = ctx.body().zone;
  const fakeOnly = fake && !ctx.testinput.active; // ?fakecam alone has no body: only the debug keys (L, Z) say "not seen"
  if (S?.away || (!fakeOnly && zone === 'none')) return { ok: false, kind: 'none', say: "Captain, I can't see you! Step back!" };
  if (zone === 'too-close') return { ok: false, kind: 'close', say: 'Step back so I can see your knees!' };
  return { ok: true, kind: zone };
}

function pill(g, x, y, w, h, fill, stroke) {
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, Math.min(h / 2, 18)); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
}
function outlined(g, text, x, y, fill, lw = 6) {
  g.lineWidth = lw; g.strokeStyle = 'rgba(13,8,40,.85)'; g.lineJoin = 'round';
  g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
}

export function drawAll(g, ctx, S, extra) {
  drawStreaks(g, ctx, S, extra);
  drawBolts(g, ctx, S);
  drawPops(g, ctx, S);
  drawCrosshair(g, ctx, S);
  drawBoops(g, ctx, S);
  drawSlime(g, ctx, S);
  drawWipers(g, ctx, S);
  drawCanopy(g, ctx, S);
  drawDashboard(g, ctx, S, extra);
  drawComms(g, ctx, S, extra);
  drawScore(g, ctx, S);
  drawPassportIcon(g, ctx, S, extra);
  drawBossBar(g, ctx, S);
  drawBanners(g, ctx, S);
  drawCue(g, ctx, S);
  drawCountdown(g, ctx, S);
  if (S.phase === 'bossIntro') drawBossCard(g, ctx, S);
  if (S.away && S.phase !== 'end') {
    const u = Math.min(ctx.W, ctx.H);
    g.font = font(u * 0.05); g.textAlign = 'center'; g.textBaseline = 'middle';
    outlined(g, '⏸ waiting for you, Captain!', ctx.W / 2, ctx.H * 0.2, '#ffffff');
  }
}

// ---------- star streaks (hyperspace, thrusters, barrel roll) ----------
function drawStreaks(g, ctx, S, { rolling }) {
  const run = ctx.gestures.run.intensity;
  const k = Math.max(S.hop > 0 ? 1 : 0, run * 0.8, rolling ? 0.6 : 0, S.phase === 'bossIntro' ? 0.5 : 0);
  if (k < 0.2) return;
  const { W, H } = ctx, u = Math.min(W, H);
  const n = S.hop > 0 ? 40 : 22;
  g.strokeStyle = S.hop > 0 ? 'rgba(180,240,255,.75)' : `rgba(255,255,255,${0.25 + k * 0.35})`;
  g.lineWidth = S.hop > 0 ? 3 : 2;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i * 2.399, f = (ctx.time * (S.hop > 0 ? 3 : 1.6) + i * 0.137) % 1;
    const r0 = u * (0.1 + f * 0.9), len = u * (S.hop > 0 ? 0.35 : 0.12) * (0.3 + f);
    const cx = W / 2 + Math.cos(a) * r0 * 1.4, cy = H * 0.45 + Math.sin(a) * r0 * 0.9;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len * 1.4, cy + Math.sin(a) * len * 0.9);
  }
  g.stroke();
}

// ---------- lasers ----------
function drawBolts(g, ctx, S) {
  g.lineCap = 'round';
  for (const b of S.bolts) {
    const k = Math.min(1, b.t / b.dur);
    const k0 = Math.max(0, k - 0.35);
    const x0 = b.x0 + (b.x1 - b.x0) * k0, y0 = b.y0 + (b.y1 - b.y0) * k0;
    const x1 = b.x0 + (b.x1 - b.x0) * k, y1 = b.y0 + (b.y1 - b.y0) * k;
    const w = b.twin ? 14 : 8;
    g.strokeStyle = b.color; g.globalAlpha = 0.45; g.lineWidth = w * 1.8;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.globalAlpha = 1; g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.45;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (b.hit && b.target) {
      const f = (b.t - b.dur) / 0.08;
      g.fillStyle = b.color; g.globalAlpha = 1 - f;
      g.beginPath(); g.arc(b.x1, b.y1, (b.twin ? 30 : 18) * (0.6 + f), 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }
}

function drawPops(g, ctx, S) {
  const u = Math.min(ctx.W, ctx.H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of S.pops) {
    const k = p.t / 0.9;
    g.globalAlpha = 1 - k * k;
    const y = p.y - k * u * 0.08;
    g.font = font(u * (p.small ? 0.03 : 0.042));
    outlined(g, p.word, p.x, y, p.color, 4);
    if (p.text) { g.font = font(u * 0.028); outlined(g, p.text, p.x, y + u * 0.036, '#ffe14d', 4); }
  }
  g.globalAlpha = 1;
}

function drawCrosshair(g, ctx, S) {
  if (S.phase === 'end') return;
  const u = Math.min(ctx.W, ctx.H);
  const x = S.aimX, y = S.aimY;
  const locked = !!S.lock;
  const r = u * (locked ? 0.045 : 0.055) * (1 + (locked ? Math.sin(ctx.time * 14) * 0.06 : 0));
  g.save();
  g.translate(x, y);
  g.rotate(locked ? ctx.time * 2 : 0);
  g.strokeStyle = locked ? '#ff5ea8' : 'rgba(255,255,255,.85)';
  g.lineWidth = locked ? 4 : 3;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.arc(0, 0, r, i * Math.PI / 2 + 0.25, (i + 1) * Math.PI / 2 - 0.25); g.stroke();
  }
  g.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(dx * r * 0.45, dy * r * 0.45); g.lineTo(dx * r * 0.85, dy * r * 0.85); }
  g.stroke();
  g.restore();
  if (locked && S.lock.kind === 'weak') { g.font = font(u * 0.03); g.textAlign = 'center'; outlined(g, 'ZAP IT!', x, y - r - u * 0.03, '#ffe14d', 4); }
}

// ---------- windshield boops ----------
function drawAlienFace(g, design, color, x, y, px, t) {
  const rows = DESIGNS[design].frames[Math.floor(t * 6) % 2];
  const h = rows.length, w = rows[0].length;
  const pal = { X: color, D: shade(color, 0.6), W: '#ffffff', K: INK, Y: '#ffe14d', P: '#ff5ea8' };
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = rows[r][c];
    if (ch === '.' || ch === ' ') continue;
    g.fillStyle = pal[ch];
    g.fillRect(x + (c - w / 2) * px, y + (r - h / 2) * px, px + 0.5, px + 0.5);
  }
  // googly eyes on top: they wobble
  const eyeY = y + (design === 'zoomer' ? -2.2 : design === 'squirm' ? -1.2 : -1.6) * px;
  for (const s of [-1, 1]) {
    const ex = x + s * px * 1.6;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, eyeY, px * 1.15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(2, px * 0.15); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(ex + Math.sin(t * 17 + s) * px * 0.45, eyeY + Math.cos(t * 13 + s * 2) * px * 0.45, px * 0.5, 0, Math.PI * 2); g.fill();
  }
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * k, gg = ((n >> 8) & 255) * k, b = (n & 255) * k;
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}

function drawBoops(g, ctx, S) {
  const u = Math.min(ctx.W, ctx.H);
  for (const c of S.cracks) {
    g.globalAlpha = Math.max(0, 1 - c.t / 3) * 0.85;
    g.strokeStyle = '#e8f6ff'; g.lineWidth = 2.5;
    let seed = c.seed;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
      let x = c.x, y = c.y;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { const L = u * (0.04 + rnd() * 0.05); x += Math.cos(a + (rnd() - 0.5) * 0.8) * L; y += Math.sin(a + (rnd() - 0.5) * 0.8) * L; g.lineTo(x, y); }
    }
    g.stroke();
    g.beginPath(); g.arc(c.x, c.y, u * 0.03, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  for (const b of S.boops) {
    // SPLAT onto the glass (squish), stick, then slide down
    const t = b.t;
    const squish = t < 0.15 ? 1.35 - t * 2 : 1 + Math.sin(t * 20) * 0.04 * Math.max(0, 1 - t);
    const slide = t > 0.6 ? (t - 0.6) ** 2 * u * 0.35 : 0;
    g.save();
    g.translate(b.x, b.y + slide);
    g.scale(squish, 2 - squish);
    g.globalAlpha = t > 1.4 ? Math.max(0, 1 - (t - 1.4) / 0.4) : 1;
    drawAlienFace(g, b.design, b.color, 0, 0, b.size, t);
    g.restore();
  }
  g.globalAlpha = 1;
}

function drawSlime(g, ctx, S) {
  for (const s of S.slime) {
    g.globalAlpha = clamp(s.a, 0, 1) * 0.78;
    g.fillStyle = '#6be36b';
    let seed = s.seed;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = s.r * (0.7 + rnd() * 0.45);
      const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * 0.8;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.fill();
    // drips sliding down
    for (let i = 0; i < 4; i++) {
      const dx = (rnd() - 0.5) * s.r * 1.4, len = s.r * (0.4 + rnd() * 0.6) * Math.min(1, s.t * 0.6 + 0.3);
      g.beginPath(); g.roundRect(s.x + dx - s.r * 0.07, s.y, s.r * 0.14, len + s.r * 0.4, s.r * 0.07); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath(); g.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.18, s.r * 0.1, -0.6, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function drawWipers(g, ctx, S) {
  if (S.wipe <= 0) return;
  const { W, H } = ctx;
  const k = 1 - S.wipe; // 0..1, sweeps there and back twice
  const a = Math.sin(k * Math.PI * 4) * 1.1;
  const base = H - dashHeight(ctx);
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = W / 2 + side * W * 0.22;
    const L = Math.min(W, H) * 0.62;
    const ang = -Math.PI / 2 + a * side * -1 + side * 0.15;
    g.strokeStyle = '#2a2450'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(bx, base); g.lineTo(bx + Math.cos(ang) * L, base + Math.sin(ang) * L); g.stroke();
    g.strokeStyle = '#8a93b8'; g.lineWidth = 4; g.stroke();
  }
}

// ---------- the cockpit: canopy edges + thin dashboard ----------
function drawCanopy(g, ctx, S) {
  const { W, H } = ctx, u = Math.min(W, H);
  const dh = dashHeight(ctx), t = Math.max(10, u * 0.03);
  g.fillStyle = '#231b52';
  g.strokeStyle = 'rgba(120,200,255,.5)'; g.lineWidth = 2;
  // top arc
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, t * 0.6);
  g.quadraticCurveTo(W / 2, t * 2.2, 0, t * 0.6); g.closePath(); g.fill(); g.stroke();
  // corner struts
  for (const s of [0, 1]) {
    const x = s ? W : 0, d = s ? -1 : 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + d * t * 2.2, 0); g.lineTo(x + d * t * 1.1, H - dh); g.lineTo(x, H - dh); g.closePath(); g.fill(); g.stroke();
  }
  // glass glint
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = u * 0.05;
  g.beginPath(); g.moveTo(W * 0.12, H * 0.2); g.lineTo(W * 0.24, H * 0.08); g.stroke();
}

function drawDashboard(g, ctx, S, { set }) {
  const { W, H } = ctx, u = Math.min(W, H);
  const dh = dashHeight(ctx), y0 = H - dh;
  const grad = g.createLinearGradient(0, y0, 0, H);
  grad.addColorStop(0, '#2e2468'); grad.addColorStop(1, '#17113d');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, y0 + 8); g.quadraticCurveTo(W / 2, y0 - 10, W, y0 + 8); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,200,255,.6)'; g.lineWidth = 2; g.stroke();
  // mission progress along the top edge: waves -> 🦀
  const prog = S.phase === 'intro' ? 0 : S.phase === 'waves' ? Math.min(1, S.missionT / S.missionLen) : 1;
  const px0 = W * 0.3, px1 = W * 0.7, py = y0 + 2;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(px0, py - 3, px1 - px0, 6, 3); g.fill();
  g.fillStyle = '#5ee0ff'; g.beginPath(); g.roundRect(px0, py - 3, Math.max(6, (px1 - px0) * prog), 6, 3); g.fill();
  g.font = `${Math.max(14, dh * 0.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🦀', px1 + dh * 0.25, py);
  const cy = y0 + dh * 0.58, fs = Math.max(13, dh * 0.3);
  // left: speed + shields
  g.textAlign = 'left'; g.font = font(fs);
  g.fillStyle = '#ffe14d'; g.fillText(`⚡${Math.round(S.speed * 10)}`, 14 + u * 0.03, cy);
  const sx = 14 + u * 0.03 + fs * 4;
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i < S.shields ? '#5ee0ff' : 'rgba(94,224,255,.2)';
    g.beginPath(); g.arc(sx + i * fs * 0.9, cy, fs * 0.33, 0, Math.PI * 2); g.fill();
  }
  // center: RESCUED (the headline)
  g.textAlign = 'center';
  g.font = font(dh * 0.42);
  outlined(g, `🛸 ${S.stats.rescued}`, W / 2, cy, '#5ee0ff', 4);
  g.font = font(dh * 0.17, 800); g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillText('RESCUED', W / 2, cy + dh * 0.3);
  // right: radar (bad guys pink, friends cyan, boss orange)
  const rr = dh * 0.38, rx = W - 14 - u * 0.03 - rr - 30, ry = cy - 2;
  g.fillStyle = 'rgba(0,30,40,.7)'; g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(94,224,255,.6)'; g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(ctx.time * 3) * rr, ry + Math.sin(ctx.time * 3) * rr); g.stroke();
  const dot = (x, z, c, s = 2.5) => {
    const dx = clamp((x - S.px) / 20, -1, 1), dz = clamp(-z / 60, 0, 1);
    g.fillStyle = c; g.beginPath(); g.arc(rx + dx * rr * 0.9, ry + rr * 0.85 - dz * rr * 1.7, s, 0, Math.PI * 2); g.fill();
  };
  for (const e of S.enemies) dot(e.x, e.z, '#ff5ea8');
  for (const f of S.friends) dot(f.x, f.z, '#5ee0ff', 3);
  if (S.boss && S.boss.mesh.visible) dot(S.boss.x, S.boss.z, '#ff9f1c', 5);
  // version tag
  g.font = font(11, 700); g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'right';
  g.fillText(`v${ctx.release}`, W - 8, H - 9);
  void set;
}

// ---------- comms screen (top-left, under the back button) ----------
function drawComms(g, ctx, S, { set }) {
  const u = Math.min(ctx.W, ctx.H);
  const w = clamp(u * 0.25, 92, 210), h = w * 0.78;
  const x = 14, y = Math.max(84, 14 + 70);
  const seen = trackingState(ctx, S);
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, 14);
  g.fillStyle = '#04202e'; g.fill();
  g.clip();
  const cam = ctx.camera;
  if (seen.kind === 'none') {
    // static fizz + mission control's message
    fizzT += 1;
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(150,230,255,${Math.random() * 0.5})`;
      g.fillRect(x + Math.random() * w, y + Math.random() * h, 2 + Math.random() * 10, 2);
    }
    g.fillStyle = 'rgba(4,32,46,.6)'; g.fillRect(x, y + h * 0.3, w, h * 0.4);
    g.font = font(w * 0.1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14d';
    g.fillText("CAN'T SEE YOU!", x + w / 2, y + h * 0.42);
    g.font = font(w * 0.085, 800); g.fillStyle = '#ffffff';
    g.fillText('👣 Step back! 👣', x + w / 2, y + h * 0.58);
  } else if (set.face && cam.ready && cam.video.videoWidth) {
    const hd = ctx.head();
    const vw = cam.video.videoWidth, vh = cam.video.videoHeight, view = ctx.view;
    let cx = vw / 2, cy = vh * 0.35, size = vh * 0.45;
    if (hd.found || hd.source === 'fake') {
      // ctx.head() is in screen px of the mirrored "cover" camera view -> back to video px
      const n = view.toNorm(hd.x, hd.y + hd.width * 0.55);
      cx = (1 - n.x) * vw; cy = n.y * vh;
      size = Math.max(60, (hd.width / view.dw) * vw * 2.1);
    }
    crop = crop ? { x: crop.x + (cx - crop.x) * 0.2, y: crop.y + (cy - crop.y) * 0.2, s: crop.s + (size - crop.s) * 0.12 } : { x: cx, y: cy, s: size };
    g.save();
    g.translate(x + w / 2, y + h / 2); g.scale(-1, 1);
    const sw = crop.s, sh = crop.s * (h / w);
    try { g.drawImage(cam.video, crop.x - sw / 2, crop.y - sh / 2, sw, sh, -w / 2, -h / 2, w, h); } catch { /* frame not ready */ }
    g.restore();
    // holo tint + scanlines
    g.fillStyle = 'rgba(40,200,255,.28)'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,20,40,.22)';
    const off = (ctx.time * 30) % 4;
    for (let yy = y + off; yy < y + h; yy += 4) g.fillRect(x, yy, w, 1.5);
  } else {
    // camera off (🔧) or not ready: a cartoon pilot
    g.fillStyle = '#0a3a50'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffe0c2'; g.beginPath(); g.arc(x + w / 2, y + h * 0.55, h * 0.28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#cfefff'; g.lineWidth = 4; g.beginPath(); g.arc(x + w / 2, y + h * 0.55, h * 0.36, 0, Math.PI * 2); g.stroke();
    g.fillStyle = INK; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + w / 2 + s * h * 0.1, y + h * 0.5, h * 0.035, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2, y + h * 0.58, h * 0.1, 0.3, Math.PI - 0.3); g.stroke();
  }
  // label
  g.font = font(Math.max(10, w * 0.075)); g.textAlign = 'left'; g.textBaseline = 'top';
  const blink = Math.floor(ctx.time * 2) % 2;
  g.fillStyle = 'rgba(4,32,46,.7)'; g.fillRect(x, y, w, w * 0.12);
  g.fillStyle = seen.kind === 'none' ? '#ffcc33' : '#ffffff';
  g.fillText(seen.kind === 'none' ? '● NO SIGNAL' : `${blink ? '●' : '○'} LIVE · CAPTAIN`, x + 8, y + 3);
  if (seen.kind === 'close') {
    g.fillStyle = 'rgba(255,94,168,.85)'; g.fillRect(x, y + h - w * 0.14, w, w * 0.14);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText('👣 STEP BACK 👣', x + w / 2, y + h - w * 0.13);
  }
  g.restore();
  g.strokeStyle = seen.ok ? '#5ee0ff' : '#ffcc33'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(x, y, w, h, 14); g.stroke();
}

// ---------- score (top-left, next to the back button) ----------
function drawScore(g, ctx, S) {
  const { W } = ctx, u = Math.min(W, ctx.H);
  const sh = Math.min(u * 0.09, 56), x0 = 104, y0 = 16;
  const sw = Math.min(W * 0.32, sh * 4);
  pill(g, x0, y0, sw, sh, 'rgba(13,8,40,.7)', 'rgba(94,224,255,.6)');
  g.fillStyle = '#ffe14d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(Math.min(sh * 0.6, sw / 5));
  g.fillText(fmt(S.shown), x0 + sw / 2, y0 + sh / 2 + 2);
  if (S.combo > 2 && ctx.time - S.lastZap < 1.8) {
    g.font = font(sh * 0.36); g.textAlign = 'left';
    outlined(g, `×${1 + Math.min(4, Math.floor(S.combo / 3))} combo!`, x0 + sw + 8, y0 + sh / 2, '#ff5ea8', 4);
  }
}

function drawPassportIcon(g, ctx, S, { passport }) {
  const p = passportIconPos(ctx);
  const bounce = S.flyers.length ? 1 + Math.sin(ctx.time * 20) * 0.08 : 1;
  g.save(); g.translate(p.x, p.y); g.scale(bounce, bounce);
  g.fillStyle = 'rgba(13,8,40,.7)'; g.beginPath(); g.arc(0, 0, p.r * 0.75, 0, Math.PI * 2); g.fill();
  g.font = `${p.r * 0.8}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🛂', 0, 2);
  g.restore();
  g.font = font(p.r * 0.32); g.fillStyle = '#fff'; g.textAlign = 'center';
  g.fillText(fmt(passportStats(passport).count), p.x, p.y + p.r * 0.95);
  // new friends fly into the passport
  const u = Math.min(ctx.W, ctx.H);
  for (const f of S.flyers) {
    const k = f.t, e = k < 0.15 ? 0 : (k - 0.15) / 0.85, ee = e * e * (3 - 2 * e);
    const x = f.x + (p.x - f.x) * ee, y = f.y + (p.y - f.y) * ee - Math.sin(Math.PI * ee) * u * 0.1;
    drawFriend(g, f.id, x, y, u * (0.05 - ee * 0.03), { t: ctx.time, wave: 1, happy: true });
  }
}

function drawBossBar(g, ctx, S) {
  const B = S.boss;
  if (!B || (S.phase !== 'boss' && S.phase !== 'bossDown')) return;
  const { W } = ctx, u = Math.min(W, ctx.H);
  const w = Math.min(W * 0.34, 320), h = Math.max(14, u * 0.025), x = W / 2 - w / 2, y = 30;
  g.font = `${h * 1.6}px sans-serif`; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText('🦀', x - 6, y + h / 2);
  for (let i = 0; i < 3; i++) {
    const sx = x + (w / 3) * i + 2, sw = w / 3 - 4;
    const fill = S.phase === 'bossDown' ? 0 : i + 1 < B.phase ? 0 : i + 1 > B.phase ? 1 : B.hp / B.maxHp;
    pill(g, sx, y, sw, h, 'rgba(0,0,0,.55)', null);
    if (fill > 0) pill(g, sx, y, Math.max(h, sw * fill), h, i === B.phase - 1 ? '#ffe14d' : '#ff9f1c', null);
  }
}

// TOP-RIGHT corner only: never over the middle of the action
function drawBanners(g, ctx, S) {
  const { W } = ctx, u = Math.min(W, ctx.H);
  const right = passportIconPos(ctx).x - passportIconPos(ctx).r - 10;
  let y = 30;
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const b of S.banners) {
    const k = b.t / b.life;
    const popIn = b.t < 0.2 ? 0.6 + 2 * b.t : 1;
    g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const size = Math.min((b.big ? u * 0.07 : u * 0.052), (right - W * 0.45) / Math.max(4, b.text.length) * 1.7) * popIn;
    g.font = font(size);
    outlined(g, b.text, right, y + size / 2, b.color, 6);
    if (b.sub) { g.font = font(size * 0.5, 800); outlined(g, b.sub, right, y + size * 1.25, '#ffffff', 4); }
    y += size * (b.sub ? 1.75 : 1.2);
  }
  g.globalAlpha = 1;
}

// move cues: DUCK / JUMP / LEAN, low in the middle above the dashboard
function drawCue(g, ctx, S) {
  const c = S.cue;
  if (!c) return;
  const { W, H } = ctx, u = Math.min(W, H);
  const y = H - dashHeight(ctx) - u * 0.12;
  const pulse = 1 + Math.abs(Math.sin(ctx.time * 8)) * 0.12;
  g.save(); g.translate(W / 2, y); g.scale(pulse, pulse);
  g.font = font(u * 0.075); g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = c.kind === 'duck' ? '⬇ DUCK! ⬇' : c.kind === 'jump' ? '⬆ JUMP! ⬆' : (c.aimX ?? 0) <= S.px ? 'LEAN! ➡' : '⬅ LEAN!';
  outlined(g, txt, 0, 0, c.kind === 'lean' ? '#ffcc33' : '#ff5ea8', 8);
  g.restore();
  // the snap's target: a red ring around where the claw will snap
  if (c.kind === 'lean') {
    g.strokeStyle = `rgba(255,80,120,${0.5 + Math.sin(ctx.time * 12) * 0.3})`; g.lineWidth = 6;
    g.setLineDash([14, 10]);
    g.beginPath(); g.arc(W / 2 + (c.aimX - S.px) * u * 0.06, H * 0.46, u * 0.16, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }
}

function drawCountdown(g, ctx, S) {
  if (S.phase !== 'intro' || S.phaseT < 1.2) return;
  const { W, H } = ctx, u = Math.min(W, H);
  const n = 3 - Math.floor(S.phaseT - 1.2), k = (S.phaseT - 1.2) % 1;
  const txt = n >= 1 ? String(n) : 'GO!';
  g.font = font(u * (0.2 - k * 0.05)); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = 1 - k * 0.6;
  outlined(g, txt, W / 2, H * 0.3, n >= 1 ? '#ffffff' : '#7dff6a', 10);
  g.globalAlpha = 1;
}

// the wrestling-style (kid-cute) boss intro card
function drawBossCard(g, ctx, S) {
  const { W, H } = ctx, u = Math.min(W, H);
  const t = S.phaseT;
  const k = Math.min(1, t / 0.4), out = t > 3.7 ? Math.min(1, (t - 3.7) / 0.5) : 0;
  const cw = Math.min(W - 24, u * 1.2), ch = Math.min(H * 0.42, u * 0.5);
  const x = W / 2 - cw / 2 + (1 - k) * -W + out * W, y = H * 0.12;
  g.save();
  g.translate(x + cw / 2, y + ch / 2); g.rotate(-0.03);
  g.fillStyle = 'rgba(13,8,40,.92)'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 26); g.fill();
  g.strokeStyle = '#ffe14d'; g.lineWidth = 6; g.stroke();
  // sparkly stars around the frame
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + t; g.font = `${u * 0.035}px sans-serif`; g.textAlign = 'center'; g.fillText('⭐', Math.cos(a) * cw * 0.48, Math.sin(a) * ch * 0.46); }
  // the crab picture
  const pr = ch * 0.28, px = -cw * 0.25, py = ch * 0.05;
  drawCrab(g, px, py, pr, t);
  // the name
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = font(ch * 0.1); outlined(g, '⚠ BOSS! ⚠', cw * 0.0, -ch * 0.28, '#ff5ea8', 5);
  g.font = font(Math.min(ch * 0.13, cw * 0.06)); outlined(g, "CAPTAIN CLANK'S", cw * 0.0, -ch * 0.08, '#ffffff', 6);
  g.font = font(Math.min(ch * 0.2, cw * 0.09)); outlined(g, 'CRAB-TANK!', cw * 0.0, ch * 0.14, '#ff9f1c', 7);
  g.font = font(Math.min(ch * 0.07, cw * 0.035), 800); outlined(g, 'Zap the glowing claws!', cw * 0.0, ch * 0.33, '#ffe14d', 4);
  g.restore();
}
function drawCrab(g, x, y, r, t) {
  g.save(); g.translate(x, y + Math.sin(t * 6) * r * 0.04);
  g.fillStyle = '#ff6b3d';
  // claws
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * r * 1.15, -r * 0.5 + Math.sin(t * 5 + s) * r * 0.06);
    g.beginPath(); g.arc(0, 0, r * 0.42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0828'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.44, -Math.PI / 2 - 0.4 + s * 0.3, -Math.PI / 2 + 0.4 + s * 0.3); g.fill();
    g.fillStyle = '#ffe14d'; g.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3; g.beginPath(); g.arc(0, r * 0.1, r * 0.15, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.restore();
    g.fillStyle = '#ff6b3d';
    g.fillRect(s > 0 ? r * 0.55 : -r * 0.95, -r * 0.3, r * 0.4, r * 0.16);
  }
  // legs
  g.strokeStyle = '#c9472a'; g.lineWidth = r * 0.1; g.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(s * r * 0.6, r * 0.2 + i * r * 0.12); g.lineTo(s * r * 1.05, r * 0.55 + i * r * 0.12 + Math.sin(t * 10 + i) * r * 0.05); g.stroke(); }
  // body
  g.fillStyle = '#ff6b3d'; g.beginPath(); g.ellipse(0, r * 0.15, r * 0.85, r * 0.5, 0, 0, Math.PI * 2); g.fill();
  // dome + driver
  g.fillStyle = '#3fd16b'; g.beginPath(); g.arc(0, -r * 0.35, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.08, -r * 0.38, r * 0.06, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(170,236,255,.35)'; g.beginPath(); g.arc(0, -r * 0.3, r * 0.35, Math.PI, 0); g.fill();
  // googly eyes + grin
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(s * r * 0.35, -r * 0.05, r * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(s * r * 0.35 + Math.sin(t * 7) * r * 0.04, -r * 0.03, r * 0.07, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#fff'; g.fillRect(-r * 0.3, r * 0.22, r * 0.6, r * 0.12);
  g.restore();
}
