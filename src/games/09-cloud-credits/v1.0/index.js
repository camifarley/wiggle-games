// 09 · Cloud Credits v1.0 "Thank you!": a quiet hot-air-balloon ride above the clouds at sunset while the credits
// float toward you on little clouds. Brief: docs/briefs/09-cloud-credits.md. Nothing to win, nothing to lose:
// if he does nothing, the balloon floats on and the credits play to the end (about 2½ minutes).
//
// Credits come from src/credits.json (the one source of truth, also used to generate docs/CREDITS.md) plus the
// family names typed on this device in the 🔧 panel (localStorage only; the repo is public).
//
// Optional, gentle body play (pose + motion): lean = drift the balloon, jump or both arms up = a soft "puff" up,
// wave at a sparkly star (or float into it) = it chimes a pentatonic note and joins a constellation that glows
// into a smiling balloon at the end. Standing still or walking away is fine.
//
// Test: ?fakecam&keys&debug  ← → drift, Space puff, the fake ball waves at stars, ] fast-forward, ⏭ next card, 🏁 THANK YOU.

import credits from '../../../credits.json';
import { createWorld3D } from './world3d.js';
import { buildCards } from './cards.js';
import { loadTuning, loadFamily } from './settings.js';
import { createTuning } from './tuning.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
const font = (px, w = 800) => `${w} ${Math.round(px)}px ${FONT}`;

// timeline (ride-clock seconds at speed 1)
const INTRO = 6.5;
const T = { card: { in: 2.0, hold: 3.4 }, banner: { in: 1.6, hold: 2.4 }, out: 1.8 };
const FLOW = 6; // m/s the world floats toward us
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
// the constellation: a smiling hot-air balloon (0..1 box). Stars fill these in order.
const SLOTS = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = -Math.PI / 2 + i * Math.PI / 4; return [0.5 + Math.cos(a) * 0.3, 0.36 + Math.sin(a) * 0.3]; }),
  [0.42, 0.74], [0.58, 0.74], [0.42, 0.9], [0.58, 0.9],
];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [5, 8], [3, 9], [8, 10], [9, 11], [10, 11]];
const PASTEL = ['#ffd6e8', '#fff1b8', '#c9f0ff', '#e3d4ff', '#d4ffe0', '#ffe0c2'];

let ctx, S, W3, tuning, family, set, panel, againBtn, onKey;
let cardCache = new Map(), cacheKey = '';

// ---------------------------------------------------------------- ride state

function buildTimeline() {
  const cards = buildCards(credits, family);
  let t = INTRO;
  for (const c of cards) {
    const p = T[c.kind];
    c.in = p.in; c.hold = p.hold + (c.lines?.length > 3 ? 0.6 : 0) + (c.family ? 1 : 0);
    c.start = t; t += c.in + c.hold;
  }
  return { cards, endAt: t + 0.8 };
}

function freshRide() {
  const tl = buildTimeline();
  return {
    phase: 'ride', clock: 0, endT: 0, ...tl, said: new Set(),
    x: 0, vx: 0, puffY: 0, puffV: 0, flame: 0, armsUp: false, lastPuff: -9, rise: 0,
    stars: [], flyers: [], got: 0, spawnT: 5, dust: [], dustT: 0, puffs: [], sched: [],
    disc: [], fillT: 0, glow: 0, sparkT: 0, wink: 0,
    stats: { stars: 0, waved: 0, floated: 0, puffs: 0, jumps: 0, armsUp: 0, leans: 0, rides: 0 },
  };
}

function restart() {
  const rides = (S?.stats.rides || 0) + 1;
  S = freshRide(); S.stats.rides = rides;
  cardCache.clear();
  for (const o of [W3.rainbow, W3.plane, W3.friendCloud, ...W3.friends]) o.visible = false;
  againBtn?.remove(); againBtn = null;
  ctx.say('Up, up, and away! Let\'s float above the clouds, and say thank you!');
  if (debugOn) window.wiggle.game = S;
}

function later(after, fn) { S.sched.push({ at: ctx.time + after, fn }); }
function sayOnce(key, text, opts = { interrupt: false }) { if (S.said.has(key)) return; S.said.add(key); ctx.say(text, opts); }

function chime(i, vol = 0.1) {
  const f = PENTA[i % PENTA.length];
  ctx.sfx.tone(f, 1.1, 'sine', vol);
  ctx.sfx.tone(f * 2, 0.5, 'sine', vol * 0.25);
}

function puff(kind) {
  if (!set.interaction || S.phase !== 'ride' && S.phase !== 'end') return;
  if (ctx.time - S.lastPuff < 1.2) return;
  S.lastPuff = ctx.time;
  S.stats.puffs++; S.stats[kind]++;
  S.puffV = 3.4; S.flame = 1;
  ctx.sfx.whoosh();
  ctx.sfx.tone(110, 0.5, 'sine', 0.06);
  const n = Math.round(10 * ctx.perf.settings.particles) + 4;
  for (let i = 0; i < n; i++) S.puffs.push({ x: ctx.W * rnd(0.1, 0.9), y: ctx.H * rnd(0.85, 1), vx: rnd(-40, 40), vy: rnd(-120, -40), r: rnd(18, 42), t: 0, life: rnd(1.2, 2) });
  if (S.stats.puffs === 1) ctx.say('Puff! Up we go!', { interrupt: false });
}

// ---------------------------------------------------------------- discoveries

const DISCOVERIES = [
  { at: 0.1, type: 'birds', dur: 10 },
  { at: 0.22, type: 'cloud', dur: 22 },
  { at: 0.35, type: 'balloons', dur: 34 },
  { at: 0.5, type: 'plane', dur: 8 },
  { at: 0.6, type: 'rainbow', dur: 28 },
  { at: 0.8, type: 'birds', dur: 10 },
];

function startDiscovery(d) {
  const o = { ...d, t: 0 };
  if (d.type === 'birds') { o.y = rnd(0.12, 0.26); o.dir = Math.random() < 0.5 ? 1 : -1; for (const k of [1, 2.8, 4.6]) later(k, () => { ctx.sfx.tone(2600, 0.06, 'sine', 0.035); ctx.sfx.tone(3100, 0.05, 'sine', 0.025); }); sayOnce(`b${d.at}`, 'Look! Birds!'); }
  if (d.type === 'cloud') { const side = Math.random() < 0.5 ? -1 : 1; o.side = side; W3.friendCloud.position.set(S.x + side * 20, -1.5, -150); W3.friendCloud.visible = true; }
  if (d.type === 'balloons') {
    W3.friends.forEach((f, i) => { f.position.set(S.x + [-28, 34, -44][i], [3, 6, 9][i], [-120, -150, -185][i]); f.visible = true; f.userData.ph = i * 2; });
    later(4, () => sayOnce('ball', 'Balloon friends!'));
  }
  if (d.type === 'plane') { o.dir = Math.random() < 0.5 ? 1 : -1; W3.plane.visible = true; later(1, () => sayOnce('plane', 'A paper airplane!')); }
  if (d.type === 'rainbow') { W3.rainbow.position.x = S.x + (Math.random() < 0.5 ? -70 : 70); W3.rainbow.visible = true; later(3, () => sayOnce('rain', 'A rainbow!')); }
  S.disc.push(o);
}

function updateDiscoveries(dt, flow) {
  const prog = S.clock / S.endAt;
  for (const d of DISCOVERIES) if (!S.said.has(`d${d.at}`) && prog >= d.at && S.phase === 'ride') { S.said.add(`d${d.at}`); startDiscovery(d); }
  for (const o of S.disc) {
    o.t += dt;
    if (o.type === 'cloud') {
      const c = W3.friendCloud;
      c.position.z = Math.min(c.position.z + flow * 0.9, 40);
      c.position.y = -1.5 + Math.sin(ctx.time * 0.6) * 0.4;
      if (!o.winked && c.position.z > -55) { o.winked = true; S.wink = 0.9; ctx.sfx.tone(1320, 0.25, 'sine', 0.05); sayOnce('wink', 'That cloud winked at you!'); }
      if (c.position.z >= 40) c.visible = false;
    }
    if (o.type === 'balloons') W3.friends.forEach((f) => { f.position.z += flow * 0.45; f.position.y += Math.sin(ctx.time * 0.8 + f.userData.ph) * 0.01; f.rotation.y += dt * 0.2; if (f.position.z > 30) f.visible = false; });
    if (o.type === 'plane') {
      const k = o.t / o.dur, p = W3.plane;
      p.position.set(S.x + o.dir * lerp(-34, 34, k), 3 + Math.sin(k * Math.PI) * 4, lerp(-46, -30, k));
      p.rotation.set(0, -o.dir * Math.PI / 2, Math.sin(k * Math.PI * 2) * 0.5 * o.dir);
      if (k >= 1) p.visible = false;
    }
    if (o.type === 'rainbow') {
      const op = Math.min(ease(o.t / 4), ease((o.dur - o.t) / 4)) * 0.5;
      for (const m of W3.rainbow.children) m.material.opacity = op;
      if (o.t >= o.dur) W3.rainbow.visible = false;
    }
  }
  S.disc = S.disc.filter((o) => o.t < o.dur);
}

// ---------------------------------------------------------------- stars to wave at

function spawnStar() {
  S.stars.push({ x: S.x + rnd(-24, 24), y: rnd(3, 13), z: -rnd(75, 95), charge: 0, t: rnd(0, 6), sx: -999, sy: -999, r: 10 });
  if (S.stats.rides <= 1) sayOnce('star', 'Ooh, a sparkly star! Wave at it!');
}

function collectStar(s, how) {
  const i = S.got++;
  S.stats.stars++; S.stats[how]++;
  chime(i);
  const n = Math.round(14 * ctx.perf.settings.particles) + 4;
  ctx.fx.burst(s.sx, s.sy, { color: pick(['#fff1a8', '#ffe066', '#ffffff']), count: n, speed: 140, gravity: 0, size: 6, life: 0.9 });
  S.flyers.push({ x: s.sx, y: s.sy, t: 0, slot: i });
  if (i === 2) ctx.say('Twinkle twinkle!', { interrupt: false });
  if (i === SLOTS.length - 1) later(1, () => ctx.say('You made a star picture!', { interrupt: false }));
}

function updateStars(dt, flow) {
  const { W, H } = ctx, u = Math.min(W, H);
  if (set.interaction && S.phase === 'ride' && S.clock > INTRO) {
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.stars.length < 3) { spawnStar(); S.spawnT = rnd(4, 7.5); }
  }
  const f = H / 2 / Math.tan((W3.camera.fov * Math.PI) / 360);
  for (const s of S.stars) {
    s.z += flow * 0.85; s.t += dt;
    const p = W3.toScreen(s.x, s.y, s.z, W, H);
    s.sx = p.x; s.sy = p.y; s.depth = p.depth;
    s.r = Math.max(u * 0.03, (1.5 * f) / Math.max(1, p.depth));
    if (!set.interaction || !p.on || s.done) continue;
    // waved at: motion in a circle around the star (screen -> mirrored camera norm coords)
    const n = ctx.view.toNorm(s.sx, s.sy);
    const m = n.x > -0.1 && n.x < 1.1 && n.y > -0.1 && n.y < 1.1 ? ctx.motion.at(clamp(n.x, 0, 1), clamp(n.y, 0, 1), Math.max(0.07, (s.r * 1.4) / H)) : 0;
    s.charge = m > 0.15 ? s.charge + dt * (2 + m * 6) : Math.max(0, s.charge - dt);
    if (s.charge > 0.35) { s.done = true; collectStar(s, 'waved'); continue; }
    // floated into: it passes close to the middle of the view (lean to steer toward it)
    if (p.depth < 12 && Math.hypot(s.sx - W / 2, (s.sy - H * 0.45) * 1.2) < u * 0.25) { s.done = true; collectStar(s, 'floated'); }
  }
  S.stars = S.stars.filter((s) => !s.done && s.depth > 3 && s.z < 5);
  for (const fl of S.flyers) fl.t += dt;
  S.flyers = S.flyers.filter((fl) => fl.t < 1.1);

  // magic dust where he moves, so waving always does something visible
  if (set.interaction) {
    S.dustT -= dt;
    if (S.dustT <= 0) {
      S.dustT = 0.08;
      for (const h of ctx.motion.hotspots?.(3, 0.25) || []) {
        const p = ctx.view.toScreen(h.x, h.y);
        if (S.dust.length < 90 * ctx.perf.settings.particles + 20) S.dust.push({ x: p.x + rnd(-20, 20), y: p.y + rnd(-20, 20), t: 0, life: rnd(0.7, 1.3), r: rnd(4, 9), c: pick(PASTEL) });
      }
    }
  }
  for (const d of S.dust) { d.t += dt; d.y -= 25 * dt; }
  S.dust = S.dust.filter((d) => d.t < d.life);
}

// ---------------------------------------------------------------- update

function updateBody(dt) {
  const g = ctx.gestures;
  const lean = set.interaction ? g.steer.value : 0;
  S.vx += (lean * 7 * set.drift - S.vx) * Math.min(1, dt * 1.5);
  S.x = clamp(S.x + S.vx * dt, -35, 35);
  if (Math.abs(lean) < 0.05) S.x *= 1 - dt * 0.02; // the sun slowly comes back ahead
  // arms up (both wrists above the nose) = puff, like a jump
  const p = ctx.pose;
  const up = !!(p?.found && p.leftWrist && p.rightWrist && p.nose && p.leftWrist.v > 0.5 && p.rightWrist.v > 0.5
    && p.leftWrist.y < p.nose.y - 0.04 && p.rightWrist.y < p.nose.y - 0.04);
  if (up && !S.armsUp) puff('armsUp');
  S.armsUp = up;
  // the puff: up, then a slow float back down (a soft spring)
  S.puffV += (-S.puffY * 0.7 - S.puffV * 1.1) * dt;
  S.puffY += S.puffV * dt;
  S.flame = Math.max(0, S.flame - dt * 1.2);
  for (const q of S.puffs) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 14; }
  S.puffs = S.puffs.filter((q) => q.t < q.life);
}

function updateEnd(dt) {
  S.endT += dt;
  const t = S.endT;
  if (t > 1.0) sayOnce('bye', 'Thank you! Sweet dreams!', { interrupt: true });
  // the constellation fills its missing stars one by one, then glows into the picture
  if (t > 2.6 && S.got < SLOTS.length) {
    S.fillT -= dt;
    if (S.fillT <= 0) { S.fillT = 0.28; S.got++; chime(S.got - 1, 0.06); }
  }
  if (S.got >= SLOTS.length && t > 2.6) S.glow = Math.min(1, S.glow + dt * 0.6);
  // soft sparkle fireworks (gentle: no shake, no bangs)
  if (t > 3 && t < 40) {
    S.sparkT -= dt;
    if (S.sparkT <= 0) {
      S.sparkT = rnd(1, 1.6);
      const x = ctx.W * rnd(0.12, 0.88), y = ctx.H * rnd(0.08, 0.36);
      ctx.fx.burst(x, y, { color: pick(PASTEL), count: Math.round(28 * ctx.perf.settings.particles) + 6, speed: 170, gravity: 40, size: 5, life: 1.6 });
      ctx.sfx.tone(pick(PENTA) * 2, 0.6, 'sine', 0.035);
    }
  }
  if (t > 8 && !againBtn) showAgain();
  if (t > 75) restart(); // loop slowly if nobody taps
}

function showAgain() {
  againBtn = document.createElement('button');
  againBtn.textContent = '🎈 Again!';
  againBtn.setAttribute('aria-label', 'Ride again');
  againBtn.style.cssText = `position:fixed;left:50%;bottom:calc(max(16px, env(safe-area-inset-bottom)) + 8px);transform:translateX(-50%);
    z-index:4;font:800 clamp(26px,5vw,40px) ${FONT};color:#4a2a6a;background:#fffaf2;border:4px solid #ffb3d1;border-radius:999px;
    padding:12px 34px;box-shadow:0 6px 0 rgba(120,60,120,.35);cursor:pointer;`;
  againBtn.onclick = () => { ctx.sfx.play('tap'); restart(); };
  document.body.append(againBtn);
}

// ---------------------------------------------------------------- 2D drawing

function sizes() {
  const { W, H } = ctx;
  const u = W < H ? Math.min(W * 1.3, H) : Math.min(W, H * 1.25); // portrait phones: there's room to go bigger
  const big = clamp(u * 0.085, 30, 92) * set.textSize;
  return { u, big, mid: big * 0.54, small: Math.max(15, big * 0.42), maxW: Math.min(W * 0.86, 1100) };
}

function cloudShape(g, x0, y0, w, h, fill) {
  const r = h * 0.32;
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x0, y0, w, h, r);
  g.fill();
  const n = Math.max(3, Math.round(w / (h * 0.55)));
  for (let i = 0; i < n; i++) {
    const cx = x0 + r + (i + 0.5) * ((w - 2 * r) / n), rr = h * (0.26 + 0.08 * Math.sin(i * 2.3 + 1));
    g.beginPath(); g.arc(cx, y0 + h * 0.12, rr, 0, Math.PI * 2); g.fill();
  }
  const m = Math.max(2, Math.round(n * 0.6));
  for (let i = 0; i < m; i++) {
    const cx = x0 + r * 1.2 + (i + 0.5) * ((w - 2.4 * r) / m);
    g.beginPath(); g.arc(cx, y0 + h * 0.9, h * 0.18, 0, Math.PI * 2); g.fill();
  }
}

// each card is drawn once to its own canvas (crisp, cheap); scaled while it floats in and out
function renderCard(c) {
  const key = c.start;
  if (cardCache.has(key)) return cardCache.get(key);
  const dpr = Math.min(2, ctx.view.dpr || 1);
  const z = sizes();
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  let w, h;
  if (c.kind === 'banner') {
    const fs = z.big * 0.78;
    g.font = font(fs, 900);
    const text = `${c.icon}  ${c.title}  ${c.icon}`;
    const fit = Math.min(1, (z.maxW - fs * 2) / g.measureText(text).width);
    const f2 = fs * fit;
    g.font = font(f2, 900);
    const tw = g.measureText(text).width;
    w = tw + f2 * 2.6; h = f2 * 1.9;
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    g.scale(dpr, dpr);
    g.font = font(f2, 900); // resizing the canvas reset it
    const tail = h * 0.55, y0 = h * 0.12, bh = h * 0.76;
    // ribbon tails (darker), then the band
    g.fillStyle = '#d9578f';
    for (const s of [0, 1]) {
      const x = s ? w - tail * 1.2 : 0;
      g.beginPath();
      if (!s) { g.moveTo(x, y0 + bh * 0.2); g.lineTo(x + tail * 1.2, y0 + bh * 0.2); g.lineTo(x + tail * 1.2, y0 + bh * 1.05); g.lineTo(x, y0 + bh * 1.05); g.lineTo(x + tail * 0.45, y0 + bh * 0.62); }
      else { g.moveTo(x, y0 + bh * 0.2); g.lineTo(w, y0 + bh * 0.2); g.lineTo(w - tail * 0.45, y0 + bh * 0.62); g.lineTo(w, y0 + bh * 1.05); g.lineTo(x, y0 + bh * 1.05); }
      g.fill();
    }
    g.fillStyle = '#ff86b8';
    g.beginPath(); g.roundRect(tail * 0.7, y0, w - tail * 1.4, bh, bh * 0.18); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(tail * 0.7 + 6, y0 + 5, w - tail * 1.4 - 12, bh * 0.16);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(120,30,80,.45)'; g.shadowOffsetY = 3;
    g.fillText(text, w / 2, y0 + bh * 0.54);
  } else {
    const px = { big: z.big, mid: z.mid, small: z.small, huge: z.big * 1.3 };
    const lines = c.lines.map((l) => {
      let fs = px[l.size];
      g.font = font(fs, l.size === 'small' ? 700 : 900);
      const mw = g.measureText(l.text).width, room = z.maxW - z.big * 1.4;
      if (mw > room) fs *= room / mw;
      return { ...l, fs, lh: fs * (l.size === 'small' ? 1.35 : 1.22) };
    });
    let tw = 0;
    for (const l of lines) { g.font = font(l.fs, l.size === 'small' ? 700 : 900); tw = Math.max(tw, g.measureText(l.text).width); }
    const th = lines.reduce((a, l) => a + l.lh, 0);
    const pad = z.big * 0.6;
    w = Math.max(tw + pad * 2, z.big * 6); h = th + pad * 1.5;
    const top = h * 0.2; // room for the puffs on top
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil((h + top + h * 0.12) * dpr);
    g.scale(dpr, dpr);
    cloudShape(g, 4, top + 10, w - 8, h, 'rgba(150,80,140,.22)'); // soft shadow
    cloudShape(g, 4, top, w - 8, h, c.thanks ? '#fff6fb' : '#fffaf4');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = top + pad * 0.75;
    for (const l of lines) {
      g.font = font(l.fs, l.size === 'small' ? 700 : 900);
      g.fillStyle = l.size === 'small' ? '#7a5a8f' : c.thanks ? '#d9578f' : '#4a2a6a';
      g.fillText(l.text, w / 2, y + l.lh / 2);
      y += l.lh;
    }
    h += top + h * 0.12;
  }
  const out = { cv, w, h };
  cardCache.set(key, out);
  return out;
}

// where a card is on screen at local time tau: floats in from far away, holds (gently bobbing), drifts past
function cardPose(c, tau, i) {
  const { W, H } = ctx;
  const par = clamp(-S.x * W * 0.006, -W * 0.08, W * 0.08);
  const cy = c.kind === 'banner' ? H * 0.36 : H * 0.45;
  if (tau < c.in) {
    const k = ease(tau / c.in);
    return { x: W / 2 + par * k, y: lerp(H * 0.38, cy, k), s: lerp(0.12, 1, k), a: Math.min(1, tau / (c.in * 0.6)) };
  }
  const th = tau - c.in;
  if (th < c.hold) return { x: W / 2 + par, y: cy + Math.sin(ctx.time * 1.3 + i) * H * 0.006, s: 1 + th * 0.012, a: 1 };
  const k = clamp((th - c.hold) / T.out, 0, 1), side = i % 2 ? 1 : -1;
  return { x: W / 2 + par + side * W * 0.75 * k * k, y: cy - H * 0.12 * k, s: 1 + c.hold * 0.012 + k * 0.7, a: 1 - k };
}

function drawCard(g, c, p) {
  if (p.a <= 0.01) return;
  const r = renderCard(c);
  g.globalAlpha = p.a;
  g.drawImage(r.cv, p.x - (r.w * p.s) / 2, p.y - (r.h * p.s) / 2, r.w * p.s, r.h * p.s);
  g.globalAlpha = 1;
}

function drawStar(g, x, y, r, rot, fill, glow) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  if (glow) { g.shadowColor = glow; g.shadowBlur = r * 1.2; }
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.restore();
}

function drawConstellation(g, cx, cy, size, k, alpha = 1) {
  const pts = SLOTS.map(([x, y]) => [cx + (x - 0.5) * size, cy + (y - 0.5) * size]);
  const lit = (i) => i < S.got;
  g.save();
  g.globalAlpha = alpha;
  if (k > 0) {
    // glowing picture: a soft balloon fill and a smile
    g.fillStyle = `rgba(255,190,220,${0.25 * k})`;
    g.beginPath(); g.arc(cx, cy + (0.36 - 0.5) * size, size * 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.9 * k})`; g.lineWidth = Math.max(2, size * 0.02); g.lineCap = 'round';
    const fy = cy + (0.36 - 0.5) * size;
    g.beginPath(); g.arc(cx, fy + size * 0.02, size * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.9 * k})`;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * size * 0.08, fy - size * 0.06, size * 0.022, 0, Math.PI * 2); g.fill(); }
  }
  g.lineWidth = Math.max(1.5, size * (0.012 + 0.01 * k));
  g.shadowColor = '#fff1a8'; g.shadowBlur = 6 + 18 * k;
  for (const [a, b] of LINKS) {
    if (!lit(a) || !lit(b)) continue;
    g.strokeStyle = `rgba(255,241,168,${0.55 + 0.45 * k})`;
    g.beginPath(); g.moveTo(...pts[a]); g.lineTo(...pts[b]); g.stroke();
  }
  g.shadowBlur = 0;
  pts.forEach(([x, y], i) => {
    if (lit(i)) drawStar(g, x, y, size * (0.045 + 0.02 * k) * (1 + 0.12 * Math.sin(ctx.time * 3 + i)), 0, '#fff1a8', '#ffe066');
    else { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, Math.max(2, size * 0.014), 0, Math.PI * 2); g.fill(); }
  });
  g.restore();
}

function slotScreen(i) {
  const m = miniBox();
  const [x, y] = SLOTS[i % SLOTS.length];
  return [m.cx + (x - 0.5) * m.size, m.cy + (y - 0.5) * m.size];
}
function miniBox() {
  const { W, H } = ctx, size = clamp(Math.min(W, H) * 0.17, 64, 140);
  return { cx: W / 2, cy: Math.max(14, 0) + size * 0.55 + 8, size };
}

function drawFace(g, x, y, s, { sleepy = false, wink = false } = {}) {
  g.save();
  g.strokeStyle = '#5a3a6e'; g.fillStyle = '#5a3a6e'; g.lineWidth = Math.max(2, s * 0.09); g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = x + side * s * 0.35, ey = y - s * 0.1;
    if (sleepy || (wink && side === 1)) { g.beginPath(); g.arc(ex, ey, s * 0.13, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
    else { g.beginPath(); g.ellipse(ex, ey, s * 0.08, s * 0.12, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.beginPath(); g.arc(x, y + s * 0.08, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,160,.45)';
  for (const side of [-1, 1]) { g.beginPath(); g.arc(x + side * s * 0.55, y + s * 0.12, s * 0.12, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function drawSkyBits(g) {
  const { W, H } = ctx, u = Math.min(W, H);
  const f = H / 2 / Math.tan((W3.camera.fov * Math.PI) / 360);
  // the sleepy moon
  if (W3.moon.visible) {
    const p = W3.toScreen(W3.moon.position.x, W3.moon.position.y, W3.moon.position.z, W, H);
    if (p.on) {
      const s = (9 * f) / p.depth;
      drawFace(g, p.x, p.y, s * 0.8, { sleepy: true });
      g.fillStyle = 'rgba(255,255,255,.8)'; g.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const k = (ctx.time * 0.35 + i / 3) % 1;
        g.globalAlpha = Math.sin(k * Math.PI);
        g.font = font(s * (0.4 + k * 0.4), 900);
        g.fillText('z', p.x + s * (1 + k * 0.9), p.y - s * (0.6 + k * 1.4));
      }
      g.globalAlpha = 1;
    }
  }
  // the friendly cloud's face
  if (W3.friendCloud.visible) {
    const c = W3.friendCloud.position;
    const p = W3.toScreen(c.x, c.y + 0.2, c.z + 5, W, H);
    if (p.on) drawFace(g, p.x, p.y, (4.2 * f) / p.depth, { wink: S.wink > 0 });
  }
  // birds
  for (const o of S.disc) {
    if (o.type !== 'birds') continue;
    const k = o.t / o.dur;
    for (let i = 0; i < 5; i++) {
      const bx = (o.dir > 0 ? lerp(-0.15, 1.15, k) : lerp(1.15, -0.15, k)) * W - o.dir * (Math.abs(i - 2) * u * 0.05 + i * u * 0.01);
      const by = H * o.y + Math.abs(i - 2) * u * 0.03 + Math.sin(ctx.time * 2 + i) * 4;
      const fl = Math.sin(ctx.time * 9 + i * 1.3) * 0.5, s = u * 0.022;
      g.strokeStyle = 'rgba(70,40,90,.75)'; g.lineWidth = Math.max(2, s * 0.25); g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx - s, by - s * fl); g.quadraticCurveTo(bx - s * 0.4, by - s * 0.5, bx, by); g.quadraticCurveTo(bx + s * 0.4, by - s * 0.5, bx + s, by - s * fl); g.stroke();
    }
  }
}

function drawStars(g, front) {
  if (!front) for (const s of S.stars) {
    if (s.depth == null || s.depth < 0.5) continue;
    const tw = 1 + 0.15 * Math.sin(s.t * 5) + s.charge * 0.8;
    g.fillStyle = 'rgba(255,240,170,.18)';
    g.beginPath(); g.arc(s.sx, s.sy, s.r * 1.9 * tw, 0, Math.PI * 2); g.fill();
    drawStar(g, s.sx, s.sy, s.r * tw, Math.sin(s.t) * 0.2, '#fff1a8', '#ffd84d');
  }
  if (!front) return;
  for (const fl of S.flyers) {
    const k = ease(fl.t / 1.0), [tx, ty] = slotScreen(fl.slot);
    drawStar(g, lerp(fl.x, tx, k), lerp(fl.y, ty, k) - Math.sin(k * Math.PI) * 60, lerp(22, 8, k), k * 6, '#fff1a8', '#ffe066');
  }
  for (const d of S.dust) {
    g.globalAlpha = 1 - d.t / d.life;
    drawStar(g, d.x, d.y, d.r, d.t * 3, d.c, null);
  }
  g.globalAlpha = 1;
}

function drawBasket(g) {
  const { W, H } = ctx;
  const hb = clamp(H * 0.11, 46, 120);
  const roll = -ctx.gestures.steer.value * 0.04 * (set.interaction ? 1 : 0);
  // ropes up to the balloon (out of view above)
  g.strokeStyle = 'rgba(90,55,35,.85)'; g.lineWidth = Math.max(3, W * 0.004);
  for (const [x0, x1] of [[0.07, 0.02], [0.93, 0.98]]) { g.beginPath(); g.moveTo(W * x0, H - hb * 0.9); g.lineTo(W * x1, -10); g.stroke(); }
  g.save();
  g.translate(W / 2, H); g.rotate(roll); g.translate(-W / 2, -H);
  // woven basket
  g.fillStyle = '#b07a45'; g.fillRect(-20, H - hb, W + 40, hb + 20);
  g.strokeStyle = 'rgba(90,50,25,.45)'; g.lineWidth = 2;
  const rowH = hb / 4;
  for (let r = 1; r < 4; r++) { g.beginPath(); g.moveTo(-20, H - hb + r * rowH + rowH * 0.3); g.lineTo(W + 20, H - hb + r * rowH + rowH * 0.3); g.stroke(); }
  const step = rowH * 1.4;
  for (let r = 0; r < 4; r++) for (let x = ((r % 2) * step) / 2 - 20; x < W + 20; x += step) {
    g.fillStyle = 'rgba(255,220,160,.18)'; g.beginPath(); g.ellipse(x, H - hb + r * rowH + rowH * 0.85, step * 0.35, rowH * 0.32, 0, 0, Math.PI * 2); g.fill();
  }
  // padded rim
  g.fillStyle = '#7a4a2a'; g.beginPath(); g.roundRect(-20, H - hb - hb * 0.16, W + 40, hb * 0.32, hb * 0.16); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-20, H - hb - hb * 0.12, W + 40, hb * 0.07);
  g.restore();
  // burner flame glow at the top when puffing
  if (S.flame > 0) {
    const a = S.flame;
    const gr = g.createRadialGradient(W / 2, -H * 0.05, 0, W / 2, -H * 0.05, H * 0.35);
    gr.addColorStop(0, `rgba(255,220,120,${0.55 * a})`); gr.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.4);
  }
  for (const q of S.puffs) {
    g.fillStyle = `rgba(255,255,255,${0.55 * (1 - q.t / q.life)})`;
    g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
  }
  // version, small
  g.fillStyle = 'rgba(255,240,220,.6)'; g.font = font(13, 700); g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.fillText(`v${ctx.release || '1.0'}`, W - 10, H - 10);
}

function drawEnd(g) {
  const { W, H } = ctx, t = S.endT;
  const k = ease(S.glow);
  // the constellation grows from the little one at the top into a big glowing picture
  const m = miniBox();
  const size = lerp(m.size, Math.min(H * 0.42, W * 0.62), k);
  drawConstellation(g, W / 2, lerp(m.cy, H * 0.27, k), size, k);
  // the THANK YOU cloud
  const c = S.thankCard;
  const tin = ease(t / 2.6);
  const p = { x: W / 2, y: lerp(H * 0.38, lerp(H * 0.46, H * 0.64, k), tin) + Math.sin(ctx.time * 1.2) * H * 0.006, s: lerp(0.12, lerp(1.05, 0.82, k), tin), a: Math.min(1, t / 1.2) };
  drawCard(g, c, p);
}

// ---------------------------------------------------------------- export

function exportFile() {
  const name = `cloud-credits-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  const data = {
    game: '09-cloud-credits', release: ctx.release, date: new Date().toISOString(),
    settings: set, notes: tuning.notes, stats: S.stats, rideSeconds: Math.round(S.endAt / set.speed),
    cards: S.cards.length, reached: S.phase === 'end' ? 'THANK YOU' : `card ${currentCard() + 1}/${S.cards.length}`,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return name;
}

function currentCard() { let i = 0; for (let j = 0; j < S.cards.length; j++) if (S.clock >= S.cards[j].start) i = j; return i; }

// ---------------------------------------------------------------- game

const game = {
  needs: ['pose', 'motion'],
  showCamera: false,
  background: '#e7739a',

  init(c) {
    ctx = c;
    tuning = loadTuning(); set = tuning.settings;
    family = loadFamily();
    W3 = createWorld3D({ tier: ctx.perf.settings.name });
    W3.setDusk(0);
    S = null; cardCache = new Map(); cacheKey = '';
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.cloud = { get S() { return S; }, W3, restart }; }
    restart();

    panel = createTuning({
      tuning, family,
      onChange: (s) => { set = s; cardCache.clear(); },
      onFamily: () => { /* names apply on the next ride (🔁 Restart) */ },
      readouts: () => {
        const st = ctx.gestures.steer;
        return [
          `${S.phase === 'end' ? 'THANK YOU' : `card ${currentCard() + 1}/${S.cards.length}`} · ${Math.round(S.clock / set.speed)}s of ~${Math.round(S.endAt / set.speed)}s`,
          `stars ⭐ ${S.stats.stars} (waved ${S.stats.waved}, floated ${S.stats.floated}) · puffs ${S.stats.puffs} (jump ${S.stats.jumps}, arms ${S.stats.armsUp})`,
          `lean ${st.value.toFixed(2)} (${st.mode}) · leans ${S.stats.leans} · body ${ctx.body().zone} · motion ${ctx.motion.total.toFixed(2)}`,
        ].join('\n');
      },
      exportFile,
      actions: [
        { label: '🔁 Restart', fn: () => restart() },
        { label: '⏭ Next card', fn: () => game.debugSkip.next() },
        { label: '🏁 THANK YOU', fn: () => game.debugSkip.finale() },
      ],
    });

    const g = ctx.gestures;
    g.on('jump', () => puff('jumps'));
    g.on('lean', () => { S.stats.leans++; if (set.interaction && S.stats.leans === 2) ctx.say('Wheee! We\'re drifting!', { interrupt: false }); });
    g.on('return', () => { if (S.phase === 'ride') ctx.say('Welcome back!', { interrupt: false }); });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') game.debugSkip.next();
      if (k === 'e') game.debugSkip.finale();
      if (k === 'w' && S.stars[0]) { S.stars[0].done = true; collectStar(S.stars[0], 'waved'); }
    };
    if (debugOn) addEventListener('keydown', onKey);
  },

  update(dt) {
    for (const s of S.sched) if (ctx.time >= s.at) { s.done = true; s.fn(); }
    S.sched = S.sched.filter((s) => !s.done);
    const rideDt = dt * set.speed;
    const flow = FLOW * rideDt;
    S.rise = Math.min(1, S.rise + dt / 5);
    S.wink = Math.max(0, S.wink - dt);

    if (S.phase === 'ride') {
      const before = S.clock;
      S.clock += rideDt;
      for (const c of S.cards) {
        if (c.say && before < c.start + c.in * 0.6 && S.clock >= c.start + c.in * 0.6) ctx.say(c.say, { interrupt: c.kind === 'banner' || c.family });
      }
      if (S.clock >= S.endAt) {
        S.phase = 'end'; S.endT = 0;
        S.thankCard = { kind: 'card', start: -1, thanks: true, lines: [{ text: 'THANK YOU', size: 'huge' }, { text: 'FOR PLAYING!', size: 'big' }, { text: '💖 ☁️ 🎈 ☁️ 💖', size: 'mid' }] };
        cardCache.delete(-1);
        S.stars = [];
      }
    } else updateEnd(dt);

    // evening comes slowly: sunset -> dusk -> the sleepy moon
    const prog = S.phase === 'end' ? 1 : S.clock / S.endAt;
    W3.setDusk(ease((prog - 0.3) / 0.7) * 0.9 + (S.phase === 'end' ? Math.min(0.1, S.endT * 0.02) : 0));
    W3.moon.visible = prog > 0.45;
    if (W3.moon.visible) W3.moon.position.set(95 + S.x * 0.2, lerp(30, 70, ease((prog - 0.45) / 0.55)), -330);

    updateBody(dt);
    updateDiscoveries(rideDt, flow);
    updateStars(dt, flow);
    W3.animate(dt, flow, ctx.time);
    panel.update(dt);
  },

  draw(g) {
    const { W, H } = ctx;
    const key = `${W}x${H}x${set.textSize}`;
    if (key !== cacheKey) { cacheKey = key; cardCache.clear(); }
    const st = set.interaction ? ctx.gestures.steer.value : 0;
    // rise out of the clouds at the start, gentle bob, the puff
    const y = lerp(-13, 0, ease(S.rise)) + S.puffY + Math.sin(ctx.time * 0.7) * 0.25;
    W3.setCamera({ x: S.x, y, roll: -st * 0.04 + Math.sin(ctx.time * 0.5) * 0.008, yaw: -S.vx * 0.006, aspect: W / H });
    g.drawImage(W3.render(W, H, Math.min(ctx.view.dpr, ctx.perf.settings.name === 'low' ? 1 : 1.5)), 0, 0, W, H);

    drawSkyBits(g);
    drawStars(g, false); // stars to wave at stay behind the credits, so they never hide the words
    if (S.phase === 'end') drawEnd(g);
    else {
      if (S.got > 0 || S.stars.length) {
        const m = miniBox();
        drawConstellation(g, m.cx, m.cy, m.size, 0, 0.9);
        g.fillStyle = 'rgba(255,248,220,.95)'; g.font = font(clamp(m.size * 0.2, 16, 26), 900); g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(`⭐ ${S.got}`, m.cx + m.size * 0.45, m.cy - m.size * 0.3);
      }
      S.cards.forEach((c, i) => {
        const tau = S.clock - c.start;
        if (tau < 0 || tau > c.in + c.hold + T.out) return;
        drawCard(g, c, cardPose(c, tau, i));
      });
      // the intro title
      if (S.clock < INTRO + 0.5) {
        const a = Math.min(1, S.clock / 1.2) * (1 - ease((S.clock - INTRO + 1.2) / 1.5));
        const fs = sizes().big * 1.1;
        g.globalAlpha = Math.max(0, a);
        g.font = font(fs, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = fs * 0.16; g.strokeStyle = 'rgba(120,50,110,.55)'; g.lineJoin = 'round';
        g.strokeText('☁️ Thank you! ☁️', W / 2, H * 0.42); g.fillStyle = '#fff'; g.fillText('☁️ Thank you! ☁️', W / 2, H * 0.42);
        g.globalAlpha = 1;
      }
    }
    drawStars(g, true);
    drawBasket(g);
  },

  destroy() {
    if (onKey) removeEventListener('keydown', onKey);
    onKey = null;
    againBtn?.remove(); againBtn = null;
    panel?.destroy(); panel = null;
    W3?.dispose(); W3 = null;
    cardCache.clear();
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.cloud; }
  },

  // test controls (⏭ / 🏁) and the 🔧 panel buttons
  debugSkip: {
    next() {
      if (S.phase !== 'ride') return;
      const nxt = S.cards.find((c) => c.start > S.clock + 0.01);
      S.clock = nxt ? nxt.start : S.endAt;
    },
    finale() { if (S.phase === 'ride') S.clock = S.endAt; },
  },
};

export default game;
