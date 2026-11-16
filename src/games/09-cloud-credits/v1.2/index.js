// 09 · Cloud Credits v1.2 "Catch the stars!": the v1.1 credit scroll over the sunset clouds, after a playtest:
// - star bubbles float toward you and pop when they touch your big invisible bubble (lean to steer into one);
//   no waving needed (?debug draws the bubble reach); surprises drift past and the happy cloud comes back later;
// - no basket, ropes or burner around the view: just open sky (a puff lifts the view and puffs a few wisps);
// - real people in the credits: "by congusbongus" under each track, sound packs grouped under who made them.
// Film-style: big cloud cards one at a time first (Cami, co-designer, musicians, sounds), then the roll of
// everyone else (nobody repeated), then THANK YOU. Brief: docs/briefs/09-cloud-credits.md.
//
// Credits come from src/credits.json plus the family names typed on this device in the 🔧 panel (localStorage).
// No voice at all (parent's call): only the calm music and soft chimes.
// Optional body play is unchanged from v1.0: lean = drift, jump / arms up = puff, wave at stars = constellation.
//
// Test: ?fakecam&keys&debug  ← → drift, Space puff, the fake ball waves at stars, ] fast-forward, ⏭ next section, 🏁 THANK YOU.

import credits from '../../../credits.json';
import { createWorld3D } from './world3d.js';
import { buildScroll } from './scroll.js';
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
const RATE = 0.66;           // scroll speed in line units per second (a name line = 1.15): relaxed but steady
const TAIL = 12;             // extra line units so the last lines can drift out of view (estimate for timing)
const MOMENT = { in: 1.3, hold: 4.6, out: 1.5 }; // a big card: float in, hold to read, drift past (one at a time)
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
  const sc = buildScroll(credits, family);
  // Part 1: the big cards, one at a time, alone on screen. Part 2: the roll. Then THANK YOU.
  let t = INTRO;
  for (const m of sc.moments) { m.scale = 0.85; m.start = t; t += MOMENT.in + MOMENT.hold + MOMENT.out; }
  const rollStart = t + 0.6;
  return { lines: sc.lines, moments: sc.moments, height: sc.height, rollStart, endAt: rollStart + (sc.height + TAIL) / RATE };
}

function freshRide() {
  const tl = buildTimeline();
  return {
    phase: 'ride', clock: 0, endT: 0, ...tl, said: new Set(),
    x: 0, vx: 0, puffY: 0, puffV: 0, flame: 0, armsUp: false, lastPuff: -9, rise: 0,
    stars: [], flyers: [], got: 0, spawnT: 5, dust: [], dustT: 0, puffs: [], sched: [],
    disc: [], fillT: 0, glow: 0, sparkT: 0, wink: 0,
    stats: { stars: 0, popped: 0, steered: 0, puffs: 0, jumps: 0, armsUp: 0, leans: 0, rides: 0 },
  };
}

function restart() {
  const rides = (S?.stats.rides || 0) + 1;
  S = freshRide(); S.stats.rides = rides;
  cardCache.clear();
  for (const o of [W3.rainbow, W3.plane, W3.friendCloud, ...W3.friends]) o.visible = false;
  againBtn?.remove(); againBtn = null;
  if (debugOn) window.wiggle.game = S;
}

function later(after, fn) { S.sched.push({ at: ctx.time + after, fn }); }

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
}

// ---------------------------------------------------------------- discoveries

const DISCOVERIES = [
  { at: 0.1, type: 'birds', dur: 10 },
  { at: 0.2, type: 'cloud', dur: 0 },     // world objects (cloud, balloons) end when they've floated past, not on a timer
  { at: 0.35, type: 'balloons', dur: 0 },
  { at: 0.5, type: 'plane', dur: 8 },
  { at: 0.6, type: 'rainbow', dur: 28 },
  { at: 0.68, type: 'cloud', dur: 0 },    // the happy cloud comes back later, from another side and distance
  { at: 0.8, type: 'birds', dur: 10 },
];

function startDiscovery(d) {
  const o = { ...d, t: 0 };
  if (d.type === 'birds') { o.y = rnd(0.12, 0.26); o.dir = Math.random() < 0.5 ? 1 : -1; for (const k of [1, 2.8, 4.6]) later(k, () => { ctx.sfx.tone(2600, 0.06, 'sine', 0.035); ctx.sfx.tone(3100, 0.05, 'sine', 0.025); }); }
  if (d.type === 'cloud') {
    // a different side, distance and height each time (the second visit takes the other side)
    const side = S.cloudSide ? -S.cloudSide : (Math.random() < 0.5 ? -1 : 1);
    S.cloudSide = side; o.side = side; o.winked = false;
    W3.friendCloud.position.set(S.x + side * rnd(14, 30), rnd(-3.5, 1.5), -rnd(130, 170));
    W3.friendCloud.visible = true;
  }
  if (d.type === 'balloons') {
    W3.friends.forEach((f, i) => { f.position.set(S.x + [-28, 34, -44][i], [3, 6, 9][i], [-120, -150, -185][i]); f.visible = true; f.userData.ph = i * 2; });
  }
  if (d.type === 'plane') { o.dir = Math.random() < 0.5 ? 1 : -1; W3.plane.visible = true; }
  if (d.type === 'rainbow') { W3.rainbow.position.x = S.x + (Math.random() < 0.5 ? -70 : 70); W3.rainbow.visible = true; }
  S.disc.push(o);
}

function updateDiscoveries(dt, flow) {
  const prog = S.clock / S.endAt;
  for (const d of DISCOVERIES) if (!S.said.has(`d${d.at}`) && prog >= d.at && S.phase === 'ride') { S.said.add(`d${d.at}`); startDiscovery(d); }
  for (const o of S.disc) {
    o.t += dt;
    if (o.type === 'cloud') {
      const c = W3.friendCloud;
      c.position.z += flow * 0.9;
      c.position.y += Math.sin(ctx.time * 0.6) * 0.004;
      if (!o.winked && c.position.z > -55) { o.winked = true; S.wink = 0.9; ctx.sfx.tone(1320, 0.25, 'sine', 0.05); }
      if (c.position.z >= 40) { c.visible = false; o.done = true; }
    }
    if (o.type === 'balloons') W3.friends.forEach((f) => { f.position.z += flow * 0.45; f.position.y += Math.sin(ctx.time * 0.8 + f.userData.ph) * 0.01; f.rotation.y += dt * 0.2; if (f.position.z > 30) f.visible = false; }); if (o.type === 'balloons' && W3.friends.every((f) => !f.visible)) o.done = true;
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
  S.disc = S.disc.filter((o) => (o.dur ? o.t < o.dur : !o.done));
}

// ---------------------------------------------------------------- stars to wave at

// v1.2: the balloon is a big invisible bubble. Stars float toward us from far away and arrive near the middle of
// the view (about 40-60 % height, drifting a little left and right). A star that reaches the bubble (POP depth, within
// the bubble's width) pops itself: chime, sparkle, constellation. Leaning drifts the balloon, so he can steer into
// a star off to the side; one that misses gently floats past. No waving needed. ?debug shows the bubble's reach.
const POP = { depth: 9, width: 4.5, height: 3 }; // metres in front of / beside / above-below the camera
function spawnStar() {
  // most stars come straight at us (a free catch); some arrive a bit to the side (lean to catch them)
  const side = Math.random() < 0.5 ? -1 : 1, off = Math.random() < 0.55 ? rnd(0, 3.5) : rnd(4.5, 9);
  const x = S.x + side * off;
  S.stars.push({ x, x0: S.x, off, y: rnd(-1.4, 1.2), z: -rnd(90, 105), t: 0, ph: rnd(0, 6), sx: -999, sy: -999, r: 10, alpha: 0, near: 0 });
}

function collectStar(s, how) {
  const i = S.got++;
  S.stats.stars++; S.stats[how]++;
  chime(i);
  const n = Math.round(14 * ctx.perf.settings.particles) + 4;
  ctx.fx.burst(s.sx, s.sy, { color: pick(['#fff1a8', '#ffe066', '#ffffff']), count: n, speed: 140, gravity: 0, size: 6, life: 0.9 });
  S.flyers.push({ x: s.sx, y: s.sy, t: 0, slot: i });
  S.rimFlash = 1;
}

function updateStars(dt, flow) {
  const { W, H } = ctx, u = Math.min(W, H);
  if (set.interaction && S.phase === 'ride' && S.clock > INTRO) {
    S.spawnT -= dt;
    if (S.spawnT <= 0 && S.stars.length < 3) { spawnStar(); S.spawnT = rnd(4, 7.5); }
  }
  const f = H / 2 / Math.tan((W3.camera.fov * Math.PI) / 360);
  const camY = S.camY ?? 0;
  let near = 0;
  for (const s of S.stars) {
    s.t += dt;
    s.z += flow * 1.1;
    s.x += Math.sin(s.t * 0.45 + s.ph) * 0.45 * dt; // a little left-right drift
    const p = W3.toScreen(s.x, s.y + camY * 0.6, s.z, W, H);
    s.sx = p.x; s.sy = p.y; s.depth = p.depth;
    s.r = Math.max(u * 0.02, (0.8 * f) / Math.max(1, p.depth));
    s.alpha = Math.min(1, s.t / 1.5) * clamp((p.depth - 1.5) / 3, 0, 1);
    if (!set.interaction || !p.on || s.done) continue;
    // a gentle pull when a star comes close just beside the bubble (a lean that slightly over- or undershoots still
    // catches it); stars well off to the side still float past
    if (p.depth < POP.depth * 2.5 && Math.abs(s.x - S.x) < POP.width * 1.6) s.x += (S.x - s.x) * Math.min(1, dt * 0.9);
    const dx = Math.abs(s.x - S.x), dy = Math.abs(s.y + camY * 0.6 - camY);
    // how close it is to touching the bubble (for the shimmer on the bubble's rim)
    s.near = clamp((POP.depth * 2.4 - p.depth) / (POP.depth * 1.4), 0, 1) * clamp((POP.width * 1.6 - dx) / (POP.width * 0.6), 0, 1);
    near = Math.max(near, s.near);
    if (p.depth < POP.depth && dx < POP.width && dy < POP.height) {
      s.done = true;
      // steered = it started outside the bubble's path and the lean brought it in
      collectStar(s, s.off > POP.width ? 'steered' : 'popped');
    }
  }
  S.rimTarget = near;
  S.stars = S.stars.filter((s) => !s.done && s.depth > 1.5 && s.z < 5);
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

// the scroll column: where it is, how big its text is (name font px = base; 1 line unit = base * 1.25 px)
function layout() {
  const { W, H } = ctx;
  const wide = W > H * 1.05;
  const base = clamp(Math.min(W, H * 1.3) * (wide ? 0.034 : 0.05), 17, 34) * set.textSize;
  const unit = base * 1.25;
  const bottom = H - Math.max(28, H * 0.06); // no basket any more: the scroll can use the bottom of the view
  return wide
    ? (() => { // the key-moment cloud gets the space right of the column, so the two never overlap
      const x = W * 0.25, colW = Math.min(W * 0.44, base * 22), right = x + colW / 2 + W * 0.02;
      return { wide, base, unit, x, colW, top: Math.max(H * 0.17, 100), bottom, card: { x: (right + W) / 2, y: H * 0.36, maxW: W - right - W * 0.03 } };
    })()
    : { wide, base, unit, x: W / 2, colW: W * 0.9, top: Math.max(H * 0.5, bottom - unit * 9), bottom, card: { x: W / 2, y: H * 0.27, maxW: W * 0.9 } };
}
const scrollPos = () => Math.max(0, S.clock - S.rollStart) * RATE; // line units scrolled so far (the roll starts after the cards)

function drawScroll(g) {
  const L = layout(), p = scrollPos(), band = L.bottom - L.top;
  const STYLE = {
    header: { f: 1.12, w: 900, c: '#ffe9a8' },
    name: { f: 1, w: 900, c: '#ffffff' },
    role: { f: 0.74, w: 700, c: '#ffe3ef' },
    note: { f: 0.74, w: 800, c: '#fff4d6' },
    by: { f: 0.84, w: 900, c: '#c9f0ff' },
  };
  g.save();
  // a faint shaded strip behind the column: the words stay readable over bright clouds, the scenery stays visible
  const mid = (L.top + L.bottom) / 2;
  g.save();
  g.translate(L.x, mid); g.scale(L.colW * 0.62, band * 0.62);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, 'rgba(50,20,70,.26)'); gr.addColorStop(0.6, 'rgba(50,20,70,.16)'); gr.addColorStop(1, 'rgba(50,20,70,0)');
  g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(70,25,80,.55)';
  g.shadowColor = 'rgba(60,20,70,.6)'; g.shadowBlur = Math.max(4, L.base * 0.3); g.shadowOffsetY = Math.max(1, L.base * 0.06);
  for (const ln of S.lines) {
    const y = L.bottom - (p - ln.y - ln.h / 2) * L.unit;
    if (y > L.bottom + L.unit || y < L.top - L.unit) continue;
    const fadeIn = clamp((L.bottom - y) / (L.unit * 1.2), 0, 1), fadeOut = clamp((y - L.top) / (band * 0.22), 0, 1);
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0.01) continue;
    const st = STYLE[ln.kind];
    let fs = L.base * st.f;
    g.font = font(fs, st.w);
    const mw = g.measureText(ln.text).width;
    if (mw > L.colW) { fs *= L.colW / mw; g.font = font(fs, st.w); }
    g.globalAlpha = a;
    g.lineWidth = fs * 0.16;
    g.strokeText(ln.text, L.x, y);
    g.fillStyle = st.c;
    g.fillText(ln.text, L.x, y);
  }
  g.restore();
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
  const key = c.key ?? c.start;
  if (cardCache.has(key)) return cardCache.get(key);
  const dpr = Math.min(2, ctx.view.dpr || 1);
  const z0 = sizes(), k = c.scale || 1;
  const z = { ...z0, big: z0.big * k, mid: z0.mid * k, small: Math.max(14, z0.small * k), maxW: c.side ? layout().card.maxW : z0.maxW };
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
    const px = { big: z.big, mid: z.mid * 1.15, small: z.small, huge: z.big * 1.3, head: z.small * 1.05 };
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
    w = Math.min(Math.max(z.maxW, tw + pad * 2), Math.max(tw + pad * 2, z.big * 6)); h = th + pad * 1.5;
    const top = h * 0.2; // room for the puffs on top
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil((h + top + h * 0.12) * dpr);
    g.scale(dpr, dpr);
    cloudShape(g, 4, top + 10, w - 8, h, 'rgba(150,80,140,.22)'); // soft shadow
    cloudShape(g, 4, top, w - 8, h, c.thanks ? '#fff6fb' : '#fffaf4');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = top + pad * 0.75;
    for (const l of lines) {
      g.font = font(l.fs, l.size === 'small' ? 700 : 900);
      g.fillStyle = l.size === 'head' ? '#d9578f' : l.size === 'small' ? '#7a5a8f' : c.thanks ? '#d9578f' : '#4a2a6a';
      g.fillText(l.text, w / 2, y + l.lh / 2);
      y += l.lh;
    }
    h += top + h * 0.12;
  }
  const out = { cv, w, h };
  cardCache.set(key, out);
  return out;
}

// a key-moment card: floats in, holds briefly (gently bobbing), drifts up and away while the scroll continues
function momentPose(tau) {
  const { W, H } = ctx, cx = W / 2, cy = H * 0.44;
  const par = clamp(-S.x * W * 0.004, -W * 0.05, W * 0.05);
  if (tau < MOMENT.in) { const k = ease(tau / MOMENT.in); return { x: cx + par * k, y: lerp(cy + H * 0.05, cy, k), s: lerp(0.2, 1, k), a: Math.min(1, tau / (MOMENT.in * 0.6)) }; }
  const th = tau - MOMENT.in;
  if (th < MOMENT.hold) return { x: cx + par, y: cy + Math.sin(ctx.time * 1.3) * H * 0.005, s: 1 + th * 0.008, a: 1 };
  const k = clamp((th - MOMENT.hold) / MOMENT.out, 0, 1);
  return { x: cx + par, y: cy - H * 0.12 * k, s: 1 + MOMENT.hold * 0.008 + k * 0.3, a: 1 - k };
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
    if (s.sy < 0 || !(s.depth > 0)) continue;
    g.globalAlpha = s.alpha ?? 1;
    const tw = 1 + 0.15 * Math.sin(s.t * 5) + s.near * 0.25;
    g.fillStyle = 'rgba(255,240,170,.18)';
    g.beginPath(); g.arc(s.sx, s.sy, s.r * 1.9 * tw, 0, Math.PI * 2); g.fill();
    drawStar(g, s.sx, s.sy, s.r * tw, Math.sin(s.t) * 0.2, '#fff1a8', '#ffd84d');
  }
  g.globalAlpha = 1;
  if (!front && debugOn) { // ?debug: where a star in the bubble's path pops (an ellipse POP.width x POP.height at POP.depth)
    const { W, H } = ctx, c = W3.toScreen(S.x, S.camY ?? 0, -POP.depth, W, H), e = W3.toScreen(S.x + POP.width, (S.camY ?? 0) + POP.height, -POP.depth, W, H);
    g.save(); g.setLineDash([8, 6]); g.strokeStyle = 'rgba(200,235,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(c.x, c.y, Math.abs(e.x - c.x), Math.abs(e.y - c.y), 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = g.strokeStyle; g.font = font(12, 700); g.textAlign = 'center'; g.fillText('bubble reach', c.x, c.y - Math.abs(e.y - c.y) - 6);
    g.restore();
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

// v1.2: no basket, ropes or burner: just open sky. A puff shows as the view rising plus a few soft cloud wisps.
function drawOverlay(g) {
  const { W, H } = ctx;
  // the bubble: a faint shimmering rim that shows up when a star is about to touch it, and flashes on a pop
  const a = Math.max(S.rimA || 0, (S.rimFlash || 0) * 0.9);
  if (a > 0.02) {
    const R = Math.hypot(W, H) / 2;
    const gr = g.createRadialGradient(W / 2, H / 2, R * 0.55, W / 2, H / 2, R);
    gr.addColorStop(0, 'rgba(210,235,255,0)'); gr.addColorStop(0.7, `rgba(210,235,255,${0.16 * a})`); gr.addColorStop(1, `rgba(255,220,250,${0.34 * a})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.lineWidth = Math.max(3, Math.min(W, H) * 0.008);
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `hsla(${(ctx.time * 50 + i * 120) % 360}, 90%, 85%, ${0.32 * a})`;
      g.beginPath(); g.ellipse(W / 2, H / 2, W * (0.47 - i * 0.012), H * (0.46 - i * 0.012), Math.sin(ctx.time * 0.3) * 0.03, i * 2, i * 2 + Math.PI * 1.3); g.stroke();
    }
    g.restore();
  }
  for (const q of S.puffs) {
    g.fillStyle = `rgba(255,255,255,${0.45 * (1 - q.t / q.life)})`;
    g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,240,220,.6)'; g.font = font(13, 700); g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.fillText(`v${ctx.release || '1.2'}`, W - 10, H - 10);
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
    lines: S.lines.length, reached: S.phase === 'end' ? 'THANK YOU' : `line ${currentLine() + 1}/${S.lines.length}`,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return name;
}

function currentLine() { const p = scrollPos(); let i = 0; for (let j = 0; j < S.lines.length; j++) if (p >= S.lines[j].y) i = j; return i; }

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
          `${S.phase === 'end' ? 'THANK YOU' : `line ${currentLine() + 1}/${S.lines.length}`} · ${Math.round(S.clock / set.speed)}s of ~${Math.round(S.endAt / set.speed)}s`,
          `stars ⭐ ${S.stats.stars} (popped ${S.stats.popped}, steered ${S.stats.steered}) · puffs ${S.stats.puffs} (jump ${S.stats.jumps}, arms ${S.stats.armsUp})`,
          `lean ${st.value.toFixed(2)} (${st.mode}) · leans ${S.stats.leans} · body ${ctx.body().zone} · motion ${ctx.motion.total.toFixed(2)}`,
        ].join('\n');
      },
      exportFile,
      actions: [
        { label: '🔁 Restart', fn: () => restart() },
        { label: '⏭ Next section', fn: () => game.debugSkip.next() },
        { label: '🏁 THANK YOU', fn: () => game.debugSkip.finale() },
      ],
    });

    const g = ctx.gestures;
    g.on('jump', () => puff('jumps'));
    g.on('lean', () => { S.stats.leans++; });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') game.debugSkip.next();
      if (k === 'e') game.debugSkip.finale();
      if (k === 'w' && S.stars[0]) { S.stars[0].done = true; collectStar(S.stars[0], 'popped'); }
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
      void before;
      const p1 = scrollPos(), L = layout();
      if (S.forceEnd || p1 > S.height + (L.bottom - L.top) / L.unit + 0.5) {
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
    S.rimA = (S.rimA || 0) + ((S.rimTarget || 0) - (S.rimA || 0)) * Math.min(1, dt * 3);
    S.rimFlash = Math.max(0, (S.rimFlash || 0) - dt * 1.4);
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
    S.camY = y;
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
      // never both at once: the cards first, then the roll
      if (S.clock < S.rollStart) {
        for (const m of S.moments) { const tau = S.clock - m.start; if (tau >= 0 && tau <= MOMENT.in + MOMENT.hold + MOMENT.out) drawCard(g, m, momentPose(tau)); }
      } else drawScroll(g);
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
    drawOverlay(g);
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
      // during the cards: the next card; then the next section header coming in at the bottom
      if (S.clock < S.rollStart) { const m = S.moments.find((c) => c.start > S.clock + 0.01); S.clock = m ? m.start : S.rollStart; return; }
      const p = scrollPos();
      const nxt = S.lines.find((l) => l.kind === 'header' && l.y > p + 0.05);
      if (nxt) S.clock = S.rollStart + (nxt.y - 0.55) / RATE; else S.forceEnd = true;
    },
    finale() { if (S.phase === 'ride') S.forceEnd = true; },
  },
};

export default game;
