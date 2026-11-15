// 08 · Mega Roll v1.0 "First mountain!": you're a giant bouncy ball rolling down a mountain nobody has ever
// rolled before. Brief: docs/briefs/08-mega-roll.md. Body tracking only (pose): steer.js, height.js, spin.js,
// run.js, peekaboo.js in the core.
//
// The ball ALWAYS rolls. Lean (or airplane arms) steers, crouch = tuck (zoom), jump = big bounce, spin =
// spin-roll, run in place = turbo. A seed makes the whole mountain (mountain.js): replay the same one to beat
// your best, or roll a new one. Everything you bonk pops out a sticker for the book (recipes.js, book.js).
// No fail states: walls and big things just BOING you back, and nothing ends a round early.
//
// Debug (?debug): ←/→ lean, J jump, C crouch, S spin, hold R run, P peekaboo, L leave/return, Z too close.
// Game keys: E = end the round now, N = new mountain, M = same mountain again, B = sticker book,
// W = RAINBOW ROLL now, G = a golden thing right ahead. The 🔧 panel is always there.

import { createWorld3D, groundY, BALL_R, RAMP_H } from './world3d.js';
import { createMountain, randomSeed, CHUNK } from './mountain.js';
import { recipePoints, recipeName, rarity, parseId, SHAPE, COLOR } from './recipes.js';
import { loadBook, saveBook, addSticker, bookStats, loadBests, saveBests, exportBookJSON, importBookJSON, createBook, drawSticker, stickerEl } from './book.js';
import { loadTuning, applyCore } from './settings.js';
import { createTuning } from './tuning.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const fake = params.has('fakecam');
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const SEED_STORE = 'wiggle.megaroll.seed';
const GRAVITY = 24;

let ctx, S, W3, M, set, tuning, panel, book, bests, bookUI, onKey, ui, bookCount = 0;

const WORDS = {
  critter: ['BOING!', 'WHEEE!', 'HEE HEE!', 'BOUNCE!', 'YIPPEE!'],
  thing: ['BONK!', 'POP!', 'CRUNCH!', 'SMASH!', 'KA-BOOM!'],
  tough: ['MEGA SMASH!', 'KA-BLAM!', 'BOOM!'],
};

function freshRound(seed) {
  return {
    seed, phase: 'intro', phaseT: 0, roundT: set.roundLength, roundLen: set.roundLength, lastCount: 99,
    x: 0, d: 0, h: 0, vy: 0, vx: 0, speed: 0, roll: 0, air: 0, maxAir: 0, onRamp: null, scale: 1,
    score: 0, shown: 0, combo: 0, bestCombo: 0, lastBonk: -9, meter: 0, rainbow: 0, rainbows: 0,
    spinRoll: 0, tuck: 0, burst: 0, edgeCool: 0, bumpCool: 0, shake: 0,
    away: false, hiding: false, hideT: 0, boo: 0,
    dead: new Set(), flying: [], splashed: new Set(), jumpedRiver: new Set(),
    newStickers: [], newBurst: { n: 0, t: 0 }, bonks: 0, flyers: [], pops: [],
    stats: { bonks: 0, bumps: 0, edge: 0, jumps: 0, spins: 0, crouches: 0, peekaboos: 0, leaves: 0, ramps: 0, rivers: 0, airTime: 0,
      rainbows: 0, critters: 0, golden: 0, rare: 0, steer: { left: 0, right: 0, straight: 0, arms: 0, lean: 0, maxAbs: 0, leans: 0 }, byShape: {} },
  };
}

// ---------- helpers ----------
let saidAt = {};
function sayMaybe(text, { gap = 4, key = text, interrupt = false, chance = 1 } = {}) {
  if (Math.random() > chance || ctx.time - (saidAt[key] ?? -99) < gap) return;
  saidAt[key] = ctx.time;
  ctx.say(text, { interrupt });
}
// key: a banner with the same key updates in place (NEW STICKER! ×4 instead of four banners)
function banner(text, { sub = '', color = '#ffcc33', life = 2.2, big = false, key = null } = {}) {
  const same = key && S.banners.find((b) => b.key === key && b.t < b.life - 0.2);
  if (same) { Object.assign(same, { text, sub, color, life: Math.max(life, same.t + 1.2) }); return; }
  S.banners = S.banners.filter((b) => b.t < b.life - 0.3).slice(-1);
  S.banners.push({ text, sub, color, life, t: 0, big, key });
}
const screenOf = (x, d, h = 1) => W3.toScreen(x, groundY(d) + h, -d, ctx.W, ctx.H);

function loadSeed() { try { const v = Math.round(+localStorage.getItem(SEED_STORE)); return v >= 1 && v <= 9999 ? v : null; } catch { return null; } }
function saveSeed(s) { try { localStorage.setItem(SEED_STORE, String(s)); } catch { /* private mode */ } }

// ---------- rounds ----------

function startRound(seed) {
  seed = seed ?? randomSeed(S ? [S.seed] : []);
  saveSeed(seed);
  for (const i of [...W3.chunks.keys()]) W3.removeChunk(i);
  M = createMountain(seed, { density: set.density });
  S = freshRound(seed);
  S.banners = [];
  W3.setSky(M.snowy);
  S.x = M.centerX(0);
  streamChunks();
  hideScore();
  if (bookUI?.isOpen) bookUI.close();
  banner(`Mountain ${seed}`, { sub: M.name, color: '#ffffff', life: 3.6, big: true });
  ctx.say(`Mountain ${seed}! ${M.name}! Lean to steer! Ready?`);
  ctx.recorder.event('round', { seed, name: M.name, length: S.roundLen });
  if (debugOn) window.wiggle.game = S;
}

function endRound() {
  if (S.phase !== 'play') return;
  S.phase = 'end'; S.phaseT = 0;
  const prev = bests[S.seed] || 0;
  S.prevBest = prev;
  S.newBest = S.score > prev;
  if (S.newBest) { bests[S.seed] = Math.round(S.score); saveBests(bests); }
  ctx.sfx.tada();
  ctx.fx.confetti(140);
  ctx.say(`Time's up! ${fmt(S.score)} points!${S.newBest && prev > 0 ? ' New best score!' : ''}${S.newStickers.length ? ` And ${S.newStickers.length} new stickers!` : ''}`);
  ctx.recorder.event('end', { seed: S.seed, score: Math.round(S.score), best: bests[S.seed] || 0, newBest: S.newBest, stickers: S.newStickers.length, bonks: S.stats.bonks });
  showScore();
}

function streamChunks() {
  const cur = Math.floor(S.d / CHUNK);
  const ahead = ctx.perf.tier.name === 'low' ? 3 : 4;
  for (let i = Math.max(-1, cur - 1); i <= cur + ahead; i++) {
    if (W3.chunks.has(i)) continue;
    // chunk -1: just ground behind the start line (the camera sits behind the ball)
    const ch = i < 0 ? { index: -1, d0: -CHUNK, d1: 0, biome: 'start', ramps: [], rivers: [], objects: [] } : M.chunk(i);
    const rec = W3.addChunk(ch, M, { decor: ctx.perf.tier.name !== 'low' || i % 2 === 0 });
    for (const o of ch.objects) if (S.dead.has(o.id)) { const m = rec.objs.get(o.id); if (m) { m.parent?.remove(m); rec.objs.delete(o.id); } }
  }
  for (const i of [...W3.chunks.keys()]) if (i < cur - 1 && !(i === -1 && cur <= 0)) W3.removeChunk(i);
}

// ---------- bonks ----------

function addScore(n) { S.score += n; }

function bonk(o, { how = 'roll' } = {}) {
  if (S.dead.has(o.id)) return;
  S.dead.add(o.id);
  const mesh = W3.objectMesh(o);
  const r = parseId(o.recipe);
  const tier = rarity(r);
  const rainbow = S.rainbow > 0;
  // combo: bonks within 2.5 s of each other chain up
  S.combo = ctx.time - S.lastBonk < 2.5 ? S.combo + 1 : 1;
  S.lastBonk = ctx.time;
  S.bestCombo = Math.max(S.bestCombo, S.combo);
  const mult = (1 + Math.min(4, Math.floor(S.combo / 5)) * 0.5) * (rainbow ? 2 : 1);
  const pts = Math.round(recipePoints(r) * mult / 5) * 5;
  addScore(pts);
  S.stats.bonks++; S.bonks++;
  S.stats.byShape[r.shape] = (S.stats.byShape[r.shape] || 0) + 1;
  if (!rainbow) {
    S.meter += set.comboFill * (ctx.gestures.run.state === 'running' ? 1.5 : 1) * (o.kind === 'tough' ? 2 : 1);
    if (S.meter >= 1) startRainbow();
  }
  const p = screenOf(o.x, o.d, 1.2);
  const u = Math.min(ctx.W, ctx.H);
  const col = COLOR[r.color].hex;
  if (mesh) {
    if (o.kind === 'critter') {
      // critters never get hurt: they bounce away giggling, spinning
      mesh.userData.hit = true;
      const side = o.x >= S.x ? 1 : -1;
      S.flying.push({ mesh, vx: side * (5 + Math.random() * 5), vy: 9 + Math.random() * 4, vz: -(S.speed * 0.6 + 3), spin: (Math.random() - 0.5) * 14, t: 0, y0: mesh.position.y });
      ctx.sfx.squeak(1 + Math.random() * 0.6);
      if (Math.random() < 0.45) ctx.sfx.giggle();
      S.stats.critters++;
    } else {
      mesh.parent?.remove(mesh);
      const big = o.kind === 'tough' || r.size === 'big';
      const n = Math.round((big ? 40 : 18) * ctx.perf.settings.particles);
      W3.debris(o.x, groundY(o.d) + 1, -o.d, { count: n, colors: [col, col, '#ffffff', '#ffe14d'], speed: big ? 10 : 7, size: big ? 0.45 : 0.28, up: big ? 9 : 6, vz: -S.speed * 0.5 });
      if (big) { ctx.sfx.boom(); S.shake = Math.max(S.shake, 0.5); ctx.fx.shake(8); } else ctx.sfx.pop();
    }
  }
  ctx.fx.burst(p.x, p.y, { count: Math.round(14 * ctx.perf.settings.particles), speed: 380, size: 7, color: col });
  if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: `+${pts}`, word: pick(WORDS[o.kind]), t: 0, color: tier === 'golden' ? '#ffd23f' : '#ffffff', id: o.recipe });
  // the sticker
  const isNew = addSticker(book, o.recipe, S.seed);
  if (isNew) {
    saveBook(book);
    bookCount++;
    S.newStickers.push(o.recipe);
    if (S.flyers.length < 6) S.flyers.push({ id: o.recipe, x: p.x, y: p.y, t: 0 });
    const nb = S.newBurst;
    nb.n = ctx.time - nb.t < 1.6 ? nb.n + 1 : 1; nb.t = ctx.time;
    banner(nb.n > 1 ? `NEW STICKER! ×${nb.n}` : 'NEW STICKER!', { sub: recipeName(r), color: tier === 'golden' ? '#ffd23f' : tier === 'rare' ? '#d9c2ff' : '#7dff6a', life: 2, key: 'new' });
    ctx.sfx.ding();
    ctx.sfx.tone(1320, 0.12, 'triangle', 0.12);
  }
  if (tier === 'golden') {
    S.stats.golden++;
    addScore(500);
    ctx.fx.confetti(220);
    ctx.sfx.tada();
    banner('🌟 GOLDEN! 🌟', { sub: recipeName(r), color: '#ffd23f', life: 3 });
    ctx.say(`Golden sticker! ${recipeName(r)}!`);
  } else if (tier === 'rare') {
    S.stats.rare++;
    if (isNew) sayMaybe(`Wow! A ${recipeName(r)}!`, { gap: 6, key: 'rare' });
  } else if (isNew && Math.random() < 0.3) sayMaybe(`${recipeName(r)}!`, { gap: 5, key: 'name' });
  if (S.combo > 0 && S.combo % 10 === 0) { sayMaybe(`${S.combo} in a row!`, { gap: 2, key: 'combo' }); ctx.sfx.tada(); }
  ctx.recorder.event('bonk', { shape: r.shape, kind: o.kind, pts, combo: S.combo, isNew, tier, how, rainbow });
}

function startRainbow() {
  S.rainbow = set.rainbowTime; S.meter = 0; S.rainbows++; S.stats.rainbows++;
  banner('🌈 RAINBOW ROLL! 🌈', { sub: 'Smash EVERYTHING!', color: '#ff5ea8', life: 2.6 });
  ctx.say('Rainbow roll!');
  ctx.sfx.tada(); ctx.fx.confetti(160);
  ctx.recorder.event('rainbow', {});
}

function bump(o) {
  // tough thing, no rainbow: BOING the ball back (never a fail), the thing wobbles
  if (S.bumpCool > 0) return;
  S.bumpCool = 0.5;
  const side = S.x >= o.x ? 1 : -1;
  S.vx = side * Math.max(7, Math.abs(S.vx) * 0.8);
  S.speed *= 0.55;
  S.d -= 0.4;
  const mesh = W3.objectMesh(o);
  if (mesh) mesh.userData.wobT = 0.6;
  addScore(5);
  S.stats.bumps++;
  ctx.sfx.boing();
  ctx.fx.shake(5);
  const p = screenOf(o.x, o.d, 2);
  if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: '+5', word: 'BOING!', t: 0, color: '#5ee0ff' });
  if (S.meter > 0.75) sayMaybe('Almost rainbow! Then you can smash it!', { gap: 10, key: 'almost' });
  else sayMaybe(pick(['Boing! Too big!', 'Bounce! Fill the rainbow to smash it!', 'Boing!']), { gap: 6, key: 'bump' });
  ctx.recorder.event('bump', { shape: o.shape });
}

// ---------- the round loop ----------

function updateBall(dt) {
  const st = ctx.gestures.steer;
  const playing = S.phase === 'play';
  const cruising = S.phase !== 'play' || S.away;
  // speed: always rolling. tuck (crouch) zooms, turbo (running) zooms, BOO bursts.
  S.tuck += ((ctx.gestures.crouching && playing ? 1 : 0) - S.tuck) * Math.min(1, dt * 3);
  const run = ctx.gestures.run.intensity;
  let target = set.rollSpeed * (1 + (set.tuckBoost - 1) * S.tuck) * (1 + (set.runBoost - 1) * run) * (S.rainbow > 0 ? 1.15 : 1) * (S.burst > 0 ? 1.45 : 1);
  if (S.phase === 'intro') target = S.phaseT > 3 ? set.rollSpeed * 0.5 : 0.8;
  else if (S.phase === 'end') target = 3;
  else if (S.away) target = 3.5; // a gentle cruise while he's gone (the timer waits)
  S.speed += (target - S.speed) * Math.min(1, dt * (target > S.speed ? 1.6 : 1.2));
  S.d += S.speed * dt;
  S.roll += S.speed * dt / (BALL_R * S.scale);

  // steering: lean value + gentle auto-assist (toward things to bonk, and along the path)
  const steer = cruising && S.phase !== 'play' ? 0 : st.value;
  let want = steer * set.steerSpeed;
  const cx = M.centerX(S.d + 8);
  let assistX = cx;
  if (!cruising) {
    let best = null, bestScore = 0;
    for (const ch of [M.chunk(Math.floor(S.d / CHUNK)), M.chunk(Math.floor(S.d / CHUNK) + 1)]) {
      for (const o of ch.objects) {
        if (S.dead.has(o.id) || (o.kind === 'tough' && S.rainbow <= 0)) continue;
        const ahead = o.d - S.d;
        if (ahead < 5 || ahead > 28) continue;
        const lat = Math.abs(o.x - S.x);
        if (lat > 4 + ahead * 0.35) continue;
        const sc = (1 - ahead / 30) * (1 - lat / 14) * (o.hidden ? 1.4 : 1);
        if (sc > bestScore) { bestScore = sc; best = o; }
      }
    }
    if (best) assistX = best.x;
  }
  const assistV = clamp((assistX - S.x) * 1.1, -set.steerSpeed * 0.75, set.steerSpeed * 0.75);
  const free = 1 - Math.min(1, Math.abs(steer) * 1.5); // the more he leans, the less the assist pulls
  want += assistV * set.assist * (0.35 + 0.65 * free);
  S.vx += (want - S.vx) * Math.min(1, dt * 4);
  S.x += S.vx * dt;

  // edges bounce you back: you can never fall off
  S.edgeCool -= dt; S.bumpCool -= dt;
  const c = M.centerX(S.d), lim = M.halfWidth(S.d) - BALL_R * S.scale;
  const off = S.x - c;
  if (Math.abs(off) > lim) {
    const side = Math.sign(off);
    S.x = c + side * lim;
    S.vx = -side * Math.max(5, Math.abs(S.vx) * 0.7);
    if (S.edgeCool <= 0) {
      S.edgeCool = 0.6; S.stats.edge++;
      ctx.sfx.boing();
      const p = screenOf(S.x + side, S.d, 1.5);
      if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: '', word: 'BOING!', t: 0, color: '#5ee0ff' });
    }
  }

  // vertical: ramps launch, jumps bounce, gravity
  const ch = M.chunk(Math.floor(S.d / CHUNK));
  if (S.h <= 0.25 && S.vy <= 0) {
    for (const rp of ch.ramps) {
      const rx = M.centerX(rp.d) + rp.off;
      const k = (S.d - (rp.d - rp.len / 2)) / rp.len;
      if (k >= 0 && k <= 1 && Math.abs(S.x - rx) < rp.w / 2 + 0.4) { S.onRamp = rp; S.h = RAMP_H * k; }
    }
  }
  if (S.onRamp) {
    const rp = S.onRamp, k = (S.d - (rp.d - rp.len / 2)) / rp.len;
    if (k > 1) {
      S.onRamp = null; S.vy = 5 + S.speed * 0.45; S.h = RAMP_H;
      S.stats.ramps++; ctx.sfx.whoosh(); addScore(50);
      banner('RAMP! +50', { color: '#ffcc33', life: 1.2, key: 'air' });
      sayMaybe(pick(['Wheee!', 'Up we go!', 'Ramp!']), { gap: 3, key: 'ramp' });
    } else if (k < 0 || Math.abs(S.x - (M.centerX(rp.d) + rp.off)) > rp.w / 2 + 0.6) S.onRamp = null;
    else S.h = RAMP_H * k;
  }
  if (!S.onRamp && (S.h > 0 || S.vy > 0)) {
    S.vy -= GRAVITY * dt; S.h += S.vy * dt; S.air += dt;
    if (S.h <= 0) land();
  }

  // rivers: jump over for a bonus, or roll through with a big splash (no harm)
  for (const rv of ch.rivers) {
    const key = `${ch.index}:${rv.d}`;
    if (Math.abs(S.d - rv.d) > rv.w / 2) continue;
    if (S.h > 0.6 && !S.jumpedRiver.has(key)) { S.jumpedRiver.add(key); addScore(100); banner('JUMPED THE RIVER! +100', { color: '#5ee0ff', life: 1.6 }); ctx.sfx.ding(); }
    if (S.h < 0.3 && !S.splashed.has(key) && !S.jumpedRiver.has(key)) {
      S.splashed.add(key); S.stats.rivers++;
      W3.debris(S.x, groundY(S.d) + 0.3, -S.d, { count: 30, colors: ['#4fb8ff', '#bfe8ff', '#ffffff'], speed: 6, size: 0.22, up: 8 });
      ctx.sfx.splat(); S.speed *= 0.8;
      const p = screenOf(S.x, S.d, 1.5);
      S.pops.push({ x: p.x, y: p.y, text: '', word: 'SPLASH!', t: 0, color: '#5ee0ff' });
      sayMaybe('Splash! Jump over the river next time!', { gap: 12, key: 'river' });
    }
  }
}

function land() {
  const air = S.air;
  S.h = 0; S.vy = 0; S.air = 0;
  if (air > 0.45) {
    const bonus = Math.round(air * 100 / 10) * 10;
    addScore(bonus); S.stats.airTime += air; S.maxAir = Math.max(S.maxAir, air);
    banner(`AIR TIME +${bonus}`, { color: '#7dff6a', life: 1.3, key: 'air' });
    ctx.sfx.boing(); ctx.fx.shake(6); S.shake = 0.3;
    // landing pounds whatever is right under the ball
    for (const o of nearby(BALL_R * S.scale + 1.8)) if (o.kind !== 'tough' || S.rainbow > 0) bonk(o, { how: 'pound' });
    W3.debris(S.x, groundY(S.d) + 0.2, -S.d, { count: 16, colors: ['#ffffff', '#e8d6a8'], speed: 5, size: 0.2, up: 3 });
  }
}

function nearby(radius) {
  const out = [];
  const i0 = Math.floor((S.d - radius) / CHUNK), i1 = Math.floor((S.d + radius) / CHUNK);
  for (let i = Math.max(0, i0); i <= i1; i++) for (const o of M.chunk(i).objects) {
    if (S.dead.has(o.id)) continue;
    if (Math.hypot(o.x - S.x, o.d - S.d) < radius + o.r) out.push(o);
  }
  return out;
}

function collide() {
  const R = BALL_R * S.scale;
  for (const o of nearby(R + 0.2)) {
    const mesh = W3.objectMesh(o);
    const top = (mesh?.userData.headY ?? 1.5) * 0.85;
    if (S.h > top) continue; // flew right over it
    if (o.kind === 'tough' && S.rainbow <= 0 && S.spinRoll <= 0) bump(o);
    else bonk(o);
  }
  if (S.spinRoll > 0) for (const o of nearby(6.5)) if (o.kind !== 'tough' || S.rainbow > 0) bonk(o, { how: 'spin' });
}

function updateFlying(dt) {
  for (let i = S.flying.length - 1; i >= 0; i--) {
    const f = S.flying[i];
    f.t += dt;
    f.vy -= 18 * dt;
    f.mesh.position.x += f.vx * dt; f.mesh.position.y += f.vy * dt; f.mesh.position.z += f.vz * dt;
    f.mesh.rotation.y += f.spin * dt; f.mesh.rotation.z += f.spin * 0.4 * dt;
    if (f.mesh.position.y < f.y0 && f.vy < 0) { f.mesh.position.y = f.y0; f.vy = Math.abs(f.vy) * 0.5; } // bouncy landing
    if (f.t > 1.6) { f.mesh.parent?.remove(f.mesh); S.flying.splice(i, 1); }
  }
  // tough things wobble after a BOING
  for (const c of W3.chunks.values()) for (const m of c.objs.values()) {
    if (!(m.userData.wobT > 0)) continue;
    m.userData.wobT -= dt;
    m.rotation.z = Math.sin(m.userData.wobT * 30) * 0.08 * m.userData.wobT;
  }
}

function trackStats(dt) {
  const st = ctx.gestures.steer, s = S.stats.steer;
  if (st.value < -0.15) s.left += dt; else if (st.value > 0.15) s.right += dt; else s.straight += dt;
  if (st.mode === 'arms') s.arms += dt; else if (st.mode === 'lean') s.lean += dt;
  s.maxAbs = Math.max(s.maxAbs, Math.abs(st.value));
}

// ---------- score screen (DOM, big buttons) ----------

const UI_STYLE = `
.mr-ui { position: fixed; inset: 0; z-index: 4; pointer-events: none; font-family: ui-rounded, system-ui, sans-serif; color: #fff; }
.mr-score { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
  overflow-y: auto; box-sizing: border-box; padding: 16px; border-radius: 28px; background: rgba(27,17,64,.88); border: 4px solid #ffcc33; text-align: center; pointer-events: auto; }
.mr-score[hidden] { display: none; }
.mr-score .mt { font-size: clamp(16px, 3vmin, 24px); opacity: .85; font-weight: 800; }
.mr-score .pts { font-size: clamp(54px, 14vmin, 120px); font-weight: 900; line-height: 1; color: #ffe14d; text-shadow: 0 5px 0 rgba(0,0,0,.3); }
.mr-score .best { font-size: clamp(18px, 4vmin, 32px); font-weight: 900; margin: 4px 0 8px; }
.mr-score .best.new { color: #7dff6a; animation: mrpulse .5s ease-in-out infinite alternate; }
@keyframes mrpulse { to { transform: scale(1.08); } }
.mr-score .stk { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; min-height: 20px; margin-bottom: 10px; }
.mr-score .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.mr-score .btns button { font: inherit; font-weight: 900; font-size: clamp(20px, 4vmin, 30px); color: #fff; border-radius: 22px; padding: 14px 18px; min-width: 150px;
  border: 4px solid rgba(255,255,255,.6); background: #ff5ea8; box-shadow: 0 6px 0 rgba(0,0,0,.3); cursor: pointer; }
.mr-score .btns button:nth-child(2) { background: #4d8dff; }
.mr-score .btns button:nth-child(3) { background: #3fbf6a; }
.mr-score .btns button:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,.3); }
.mr-score .btns .em { font-size: 1.5em; display: block; }
`;

function createUI() {
  const style = document.createElement('style'); style.textContent = UI_STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'mr-ui';
  root.innerHTML = `<div class="mr-score" hidden><div class="mt"></div><div class="pts">0</div><div class="best"></div><div class="mt nl"></div><div class="stk"></div>
    <div class="btns"><button class="same"><span class="em">🔁</span>Same mountain</button><button class="new"><span class="em">🏔️</span>New mountain</button><button class="book"><span class="em">📖</span>Sticker book</button></div></div>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  $('.same').onclick = () => { ctx.sfx.pop(); startRound(S.seed); };
  $('.new').onclick = () => { ctx.sfx.pop(); startRound(null); };
  $('.book').onclick = () => { ctx.sfx.pop(); hideScore(); bookUI.open(S.newStickers.length ? parseId(S.newStickers[S.newStickers.length - 1]).shape : null); };
  return { root, $, destroy() { root.remove(); style.remove(); } };
}

function showScore() {
  const { $ } = ui;
  $('.mr-score').hidden = false;
  $('.mt').textContent = `Mountain ${S.seed} · ${M.name}`;
  const best = bests[S.seed] || 0;
  $('.best').textContent = S.newBest ? (S.prevBest ? `⭐ NEW BEST! (was ${fmt(S.prevBest)})` : `⭐ Best: ${fmt(best)}`) : `⭐ Best: ${fmt(best)}`;
  $('.best').classList.toggle('new', S.newBest && S.prevBest > 0);
  $('.nl').textContent = S.newStickers.length ? `NEW STICKERS: ${S.newStickers.length}` : `${S.stats.bonks} bonks!`;
  const stk = $('.stk'); stk.textContent = '';
  for (const id of S.newStickers.slice(0, 14)) stk.append(stickerEl(id, { size: 52 }));
  if (S.newStickers.length > 14) stk.append(Object.assign(document.createElement('div'), { textContent: `+${S.newStickers.length - 14} more`, style: 'align-self:center;font-weight:900' }));
}
function hideScore() { ui && (ui.$('.mr-score').hidden = true); }

// ---------- readouts / export (🔧) ----------

function readouts() {
  const gs = ctx.gestures, st = gs.steer, s = S.stats.steer;
  const b = ctx.body();
  const rec = ctx.recorder;
  return [
    `steer  ${st.value >= 0 ? '+' : ''}${st.value.toFixed(2)} ${st.mode}${st.hold ? ` (${st.hold})` : ''}  raw ${st.raw.toFixed(2)}  leans ${st.left}◀ ${st.right}▶${fake || gs._simSteer.used ? ' (sim keys)' : ''}`,
    `lean   torso ${st.torso.toFixed(2)} tilt ${st.tilt.toFixed(2)} shift ${st.shift.toFixed(2)} wing ${st.wing.toFixed(2)}`,
    `time   left ${s.left.toFixed(0)} s · straight ${s.straight.toFixed(0)} s · right ${s.right.toFixed(0)} s · arms ${s.arms.toFixed(0)} s`,
    `ball   ${S.speed.toFixed(1)} m/s · ${S.d.toFixed(0)} m · tuck ${S.tuck.toFixed(2)} · run ${gs.run.intensity.toFixed(2)} ${gs.run.state}${S.h > 0 ? ` · air ${S.h.toFixed(1)} m` : ''}`,
    `round  ${S.phase} ${S.roundT.toFixed(0)}/${S.roundLen} s${S.away ? ' · AWAY (paused)' : ''} · biome ${M.biomeAt(S.d)}`,
    `score  ${fmt(S.score)} · bonks ${S.stats.bonks} · combo ×${S.combo} (best ${S.bestCombo}) · meter ${Math.round(S.meter * 100)}%${S.rainbow > 0 ? ` · RAINBOW ${S.rainbow.toFixed(1)} s` : ''}`,
    `moves  jumps ${S.stats.jumps} · spins ${S.stats.spins} · crouches ${S.stats.crouches} · peekaboos ${S.stats.peekaboos} · bumps ${S.stats.bumps} · edges ${S.stats.edge}`,
    `book   ${fmt(bookStats(book).count)} stickers · ${S.newStickers.length} new this round`,
    `zone ${b.zone}  tier ${ctx.perf.tier.name}  fps ${ctx.perf.fps.toFixed(0)} · recording ${rec.rows.length} rows${rec.full ? ' (full)' : ''}`,
  ].join('\n');
}

function exportFile() {
  const rec = ctx.recorder;
  if (!rec.rows.length && !rec.events.length) return null;
  const st = S.stats;
  return rec.download({
    trueCount: null, expected: 'session',
    game: '08-mega-roll', release: ctx.release,
    preset: tuning.preset, settings: { ...set },
    note: (tuning.notes || '').trim() || null,
    summary: {
      seed: S.seed, mountain: M.name, phase: S.phase, score: Math.round(S.score), best: bests[S.seed] || 0, roundLength: S.roundLen,
      newStickers: S.newStickers, stickersTotal: bookStats(book).count, bonks: st.bonks, bestCombo: S.bestCombo, rainbows: st.rainbows,
      steer: { ...Object.fromEntries(Object.entries(st.steer).map(([k, v]) => [k, +(+v).toFixed(2)])), leans: ctx.gestures.steer.count },
      moves: { jumps: st.jumps, spins: st.spins, crouches: st.crouches, peekaboos: st.peekaboos, leaves: st.leaves },
      bumps: st.bumps, edge: st.edge, ramps: st.ramps, rivers: st.rivers, airTime: +st.airTime.toFixed(1), golden: st.golden, rare: st.rare, critters: st.critters,
      byShape: st.byShape, distance: Math.round(S.d),
    },
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- the game ----------

function applySettings(s) { set = s; applyCore(s, ctx.gestures); }

export default {
  needs: ['pose', 'motion'],
  showCamera: false,
  background: '#86ccff',

  init(c) {
    ctx = c;
    saidAt = {};
    tuning = loadTuning();
    applySettings(tuning.settings);
    book = loadBook();
    bests = loadBests();
    bookCount = bookStats(book).count;
    const sp = Math.round(+params.get('seed'));
    const seed = (sp >= 1 && sp <= 9999 ? sp : null) || loadSeed() || randomSeed();
    W3 = createWorld3D({ tier: ctx.perf.tier.name, snowy: createMountain(seed).snowy });
    ui = createUI();
    bookUI = createBook({ book, say: (t) => ctx.say(t), onClose: () => { if (S.phase === 'end') showScore(); } });
    ctx.recorder.start({ station: 'mega-roll', title: 'Mega Roll', maxRows: 30 * 60 * 10 });
    S = null;
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.mega = { startRound, endRound, startRainbow, get S() { return S; }, get M() { return M; }, W3, book, bests, bookUI }; }
    startRound(seed);

    panel = createTuning({
      ctx, tuning,
      onChange: (s) => applySettings(s),
      onSeed: (v) => startRound(v),
      mountain: () => ({ seed: S.seed, title: M.title, best: fmt(bests[S.seed] || 0) }),
      readouts,
      graph: () => ({
        v: (ctx.gestures.steer.value + 1) / 2, aura: ctx.gestures.steer.mode === 'arms',
        lines: [{ v: (1 + ctx.gestures.steerConfig.deadzone) / 2, show: `deadzone ±${ctx.gestures.steerConfig.deadzone.toFixed(2)}`, color: '#ffcc33' }, { v: (1 - ctx.gestures.steerConfig.deadzone) / 2, show: '', color: '#ffcc33' }],
      }),
      exportFile,
      exportBook: () => { const name = `mega-roll-stickers-${new Date().toISOString().slice(0, 10)}.json`; download(name, exportBookJSON(book, bests)); return `saved ${name} (${bookStats(book).count} stickers)`; },
      importBook: (text) => { const n = importBookJSON(book, bests, text); saveBook(book); saveBests(bests); bookCount = bookStats(book).count; bookUI.render(); return `imported: ${n} new stickers (now ${bookStats(book).count})`; },
      actions: [
        { label: '⏹ End round', fn: () => endRound() },
        { label: '🔁 Same', fn: () => startRound(S.seed) },
        { label: '🏔️ New', fn: () => startRound(null) },
        { label: '📖 Book', fn: () => bookUI.open() },
        { label: '🌈 Rainbow', fn: () => startRainbow() },
      ],
    });

    const g = ctx.gestures;
    g.on('jump', () => {
      S.stats.jumps++; panel.mark('jump', '#7dff6a');
      if (S.h < 0.4 && !S.onRamp) { S.vy = set.bounce; S.h = Math.max(S.h, 0.01); S.air = 0; ctx.sfx.boing(); sayMaybe('Big bounce!', { gap: 5, key: 'jump' }); }
    });
    g.on('spin', () => {
      S.stats.spins++; S.spinRoll = 1.0;
      banner('🌀 SPIN-ROLL! 🌀', { color: '#b48cff', life: 1.4 });
      ctx.sfx.whoosh(); sayMaybe('Spin-roll!', { gap: 3, key: 'spin' });
    });
    g.on('crouch', () => { S.stats.crouches++; ctx.sfx.whoosh(); sayMaybe('Zoom!', { gap: 4, key: 'tuck' }); });
    g.on('run', () => sayMaybe('Turbo!', { gap: 8, key: 'run' }));
    g.on('lean', (d) => { S.stats.steer.leans++; panel.mark(d.side === 'left' ? '◀' : '▶', '#5ec8ff'); if (Math.random() < 0.25) sayMaybe(pick(['Lean! Steer!', 'Wheee!', 'Roll roll roll!']), { gap: 10, key: 'lean' }); });
    g.on('leave', () => { S.away = true; S.stats.leaves++; ctx.say("Where'd you go? I'll wait!"); });
    g.on('return', () => { if (!S.away) return; S.away = false; ctx.say('There you are! Roll!'); });
    g.on('hide', () => { S.hiding = true; S.hideT = 0; ctx.sfx.squeak(0.6); });
    g.on('peekaboo', () => {
      S.hiding = false; S.stats.peekaboos++; S.boo = 1.2; S.burst = 2;
      ctx.say('BOO!'); ctx.sfx.giggle(); ctx.sfx.whoosh();
      ctx.fx.burst(ctx.W / 2, ctx.H * 0.7, { count: 40, speed: 600, color: '#ffe14d' });
    });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'e') endRound();
      if (k === 'n') startRound(null);
      if (k === 'm') startRound(S.seed);
      if (k === 'b') { if (bookUI.isOpen) bookUI.close(); else { hideScore(); bookUI.open(); } }
      if (k === 'w') startRainbow();
      if (k === 'g') {
        // test: a golden thing pops up right ahead (not part of the seeded mountain)
        const ch = M.chunk(Math.floor((S.d + 15) / CHUNK));
        const o = { id: `g-${Math.round(S.d)}`, recipe: `${pick(['cow', 'pig', 'robot', 'dino', 'snowman'])}.gold.plain.crown.normal`, kind: 'thing', d: S.d + 15, x: S.x, r: 0.8, rot: 0, wob: 0 };
        o.kind = SHAPE[o.recipe.split('.')[0]].kind;
        ch.objects.push(o);
        const rec = W3.chunks.get(ch.index);
        if (rec) { const m = W3.makeObject(o.recipe); m.position.set(o.x, groundY(o.d), -o.d); m.userData.o = o; rec.group.add(m); rec.objs.set(o.id, m); }
      }
    };
    if (debugOn) addEventListener('keydown', onKey);
  },

  update(dt) {
    S.phaseT += dt;
    for (const b of S.banners) b.t += dt;
    S.banners = S.banners.filter((b) => b.t < b.life);
    if (bookUI.isOpen) { panel.update(dt); return; } // the world waits while the book is open

    if (S.phase === 'intro') {
      const n = 3 - Math.floor(S.phaseT - 1.2);
      if (S.phaseT > 1.2 && n !== S.lastCount && n >= 1 && n <= 3) { S.lastCount = n; ctx.say(String(n), { interrupt: false }); ctx.sfx.tone(520, 0.12, 'square', 0.12); }
      if (S.phaseT > 4.2) { S.phase = 'play'; S.phaseT = 0; S.lastCount = 99; ctx.say('GO!', { interrupt: false }); ctx.sfx.tone(880, 0.25, 'square', 0.15); ctx.sfx.whoosh(); }
    } else if (S.phase === 'play') {
      if (!S.away) S.roundT -= dt;
      trackStats(dt);
      // the last 10 s: drumroll + "10, 9, 8..."
      const sec = Math.ceil(S.roundT);
      if (sec <= 10 && sec >= 1 && sec !== S.lastCount) {
        S.lastCount = sec;
        ctx.say(String(sec), { interrupt: false });
        for (let k = 0; k < 4; k++) setTimeout(() => ctx.sfx.tone(140 + k * 4, 0.05, 'triangle', 0.15), k * 60);
      }
      if (S.roundT <= 0) { S.roundT = 0; endRound(); }
    }

    S.rainbow = Math.max(0, S.rainbow - dt);
    S.spinRoll = Math.max(0, S.spinRoll - dt);
    S.burst = Math.max(0, S.burst - dt);
    S.boo = Math.max(0, S.boo - dt);
    S.shake = Math.max(0, S.shake - dt);
    if (S.hiding) { S.hideT += dt; if (S.hideT > 4 && !ctx.gestures.covering) S.hiding = false; }
    // the meter drains slowly only after a long quiet stretch (effort is kept)
    if (ctx.time - S.lastBonk > 6) S.meter = Math.max(0, S.meter - dt * 0.02);
    S.scale += ((S.rainbow > 0 ? 1.3 : 1) - S.scale) * Math.min(1, dt * 3);

    updateBall(dt);
    if (S.phase === 'play' && !S.away) collide();
    streamChunks();
    updateFlying(dt);
    W3.animate(ctx.time, dt, S.d - 10, S.d + CHUNK * 4);
    for (const p of S.pops) p.t += dt;
    S.pops = S.pops.filter((p) => p.t < 1.1);
    for (const f of S.flyers) f.t += dt;
    S.flyers = S.flyers.filter((f) => f.t < 1);
    S.shown += (S.score - S.shown) * Math.min(1, dt * 6);
    if (Math.abs(S.score - S.shown) < 1) S.shown = S.score;
    if (S.phase === 'end') {
      // the score counts up on the score screen
      const k = Math.min(1, S.phaseT / 1.6);
      ui.$('.pts').textContent = fmt(S.score * (1 - (1 - k) ** 3));
    }
    if (S.phase === 'play' && ctx.body().zone === 'too-close') sayMaybe('Step back so I can see your knees!', { gap: 10, key: 'zone' });
    panel.update(dt);
  },

  draw(g) {
    const { W, H } = ctx;
    const st = ctx.gestures.steer;
    W3.setBall({ x: S.x, d: S.d, h: S.h, roll: S.roll + (S.spinRoll > 0 ? S.spinRoll * 18 : 0), lean: st.value, scale: S.scale, rainbow: S.rainbow, t: ctx.time });
    W3.setCamera({ x: S.x, d: S.d, h: S.h, dt: 1 / 60, tuck: Math.max(S.tuck, S.burst > 0 ? 0.6 : 0), shake: S.shake * 0.6, aspect: W / H });
    g.drawImage(W3.render(W, H, Math.min(ctx.view.dpr, ctx.perf.tier.name === 'low' ? 1 : 1.5)), 0, 0, W, H);
    const u = Math.min(W, H);

    // speed lines when tucking / turbo / boo
    const zoom = Math.max(S.tuck, ctx.gestures.run.intensity, S.burst > 0 ? 0.8 : 0);
    if (zoom > 0.25 && S.phase === 'play') {
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.55, zoom * 0.6)})`; g.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = i * 2.39, rr = u * (0.45 + ((ctx.time * 2.5 + i * 0.37) % 1) * 0.5);
        const cx = W / 2 + Math.cos(a) * rr * 1.3, cy = H * 0.55 + Math.sin(a) * rr * 0.6;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * u * 0.1, cy + Math.sin(a) * u * 0.05); g.stroke();
      }
    }

    drawPorthole(g);
    drawPops(g);
    drawHud(g);
    drawBanners(g);
    drawFlyers(g);
  },

  destroy() {
    if (onKey) removeEventListener('keydown', onKey);
    onKey = null;
    panel?.destroy(); panel = null;
    bookUI?.destroy(); bookUI = null;
    ui?.destroy(); ui = null;
    W3?.dispose(); W3 = null;
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.mega; }
  },
};

// ---------- 2D drawing ----------

const font = (px, w = 900) => `${w} ${px}px ui-rounded, system-ui, sans-serif`;
function pill(g, x, y, w, h, fill, stroke) {
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
}

// his live face in a round porthole on the ball (always facing the camera). Cropped around the head from
// the body tracker; processed on this device only. Hands over the face = "?", then BOO!
let crop = null;
function drawPorthole(g) {
  const b = W3.ballScreen(ctx.W, ctx.H);
  const R = b.r * 0.62;
  if (R < 6) return;
  const x = b.x, y = b.y - b.r * 0.05;
  g.save();
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2);
  g.fillStyle = '#1b1140'; g.fill();
  g.clip();
  const cam = ctx.camera;
  if (S.hiding) {
    g.fillStyle = '#b48cff'; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.fillStyle = '#fff'; g.font = font(R * 1.3); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', x, y + Math.sin(ctx.time * 6) * R * 0.08);
  } else if (set.face && cam.ready && cam.video.videoWidth) {
    const vw = cam.video.videoWidth, vh = cam.video.videoHeight;
    const p = ctx.pose;
    let cx = vw / 2, cy = vh * 0.35, size = vh * 0.5;
    if (p.found && p.nose && p.nose.v > 0.3 && p.leftShoulder && p.rightShoulder) {
      cx = (1 - p.nose.x) * vw; cy = p.nose.y * vh; // pose x is mirrored; the video isn't
      size = Math.max(60, Math.abs(p.leftShoulder.x - p.rightShoulder.x) * vw * 1.15);
    }
    crop = crop ? { x: crop.x + (cx - crop.x) * 0.25, y: crop.y + (cy - crop.y) * 0.25, s: crop.s + (size - crop.s) * 0.15 } : { x: cx, y: cy, s: size };
    g.translate(x, y); g.scale(-1, 1); // mirrored, like a mirror
    try { g.drawImage(cam.video, crop.x - crop.s / 2, crop.y - crop.s / 2, crop.s, crop.s, -R, -R, R * 2, R * 2); } catch { /* frame not ready */ }
  } else {
    // a cartoon face instead
    g.fillStyle = '#ffe0c2'; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.fillStyle = '#1b1140';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * R * 0.35, y - R * 0.15, R * 0.13, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = R * 0.1; g.strokeStyle = '#1b1140'; g.beginPath(); g.arc(x, y + R * 0.1, R * 0.4, 0.2, Math.PI - 0.2); g.stroke();
  }
  g.restore();
  g.lineWidth = Math.max(3, R * 0.14);
  g.strokeStyle = S.rainbow > 0 ? `hsl(${(ctx.time * 300) % 360},100%,65%)` : '#ffffff';
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
  if (S.boo > 0) {
    g.font = font(R * 1.1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14d';
    g.strokeStyle = '#1b1140'; g.lineWidth = 6;
    const yy = y - R * 1.8 - (1.2 - S.boo) * R;
    g.strokeText('BOO!', x, yy); g.fillText('BOO!', x, yy);
  }
}

function drawPops(g) {
  const u = Math.min(ctx.W, ctx.H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of S.pops) {
    const k = p.t / 1.1;
    g.globalAlpha = 1 - k * k;
    const y = p.y - k * u * 0.14;
    g.font = font(u * 0.045); g.lineWidth = 5; g.strokeStyle = 'rgba(27,17,64,.8)';
    g.strokeText(p.word, p.x, y); g.fillStyle = p.color; g.fillText(p.word, p.x, y);
    if (p.text) { g.font = font(u * 0.035); g.strokeText(p.text, p.x, y + u * 0.045); g.fillStyle = '#ffe14d'; g.fillText(p.text, p.x, y + u * 0.045); }
  }
  g.globalAlpha = 1;
}

function bookIconPos() { const u = Math.min(ctx.W, ctx.H); return { x: ctx.W - Math.max(40, u * 0.07) - 12, y: 66 + Math.max(40, u * 0.07) }; }

function drawHud(g) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  g.textBaseline = 'middle';
  // timer (top center): big, red and pulsing in the last 10 s
  const sec = Math.max(0, Math.ceil(S.phase === 'intro' ? S.roundLen : S.roundT));
  const last = S.phase === 'play' && sec <= 10;
  const th = Math.min(u * 0.12, 80), tw = th * 2.3;
  const pulse = last ? 1 + Math.abs(Math.sin(ctx.time * Math.PI)) * 0.12 : 1;
  g.save(); g.translate(W / 2, 14 + th / 2); g.scale(pulse, pulse);
  pill(g, -tw / 2, -th / 2, tw, th, last ? 'rgba(200,30,60,.85)' : 'rgba(27,17,64,.7)', last ? '#ffffff' : '#ffcc33');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(th * 0.62);
  g.fillText(`⏱ ${sec}`, 0, th * 0.04);
  g.restore();
  if (S.away && S.phase === 'play') { g.font = font(th * 0.3); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⏸ waiting for you!', W / 2, 14 + th + th * 0.3); }

  // score (top left, after the back button) + the combo / rainbow meter under it
  // (narrow phones: under the back button instead)
  const narrow = W / 2 - tw / 2 - 114 < 150;
  const x0 = narrow ? 16 : 104, y0 = narrow ? 104 : 18, sh = Math.min(u * 0.1, 64);
  const sw = narrow ? Math.min(W * 0.45, sh * 3.8) : Math.min(W / 2 - tw / 2 - x0 - 10, sh * 3.8);
  {
    pill(g, x0, y0, sw, sh, 'rgba(27,17,64,.7)', null);
    g.fillStyle = '#ffe14d'; g.textAlign = 'center'; g.font = font(Math.min(sh * 0.62, sw / 5));
    g.fillText(fmt(S.shown), x0 + sw / 2, y0 + sh / 2 + 2);
    const my = y0 + sh + 10, mh = sh * 0.4;
    // the best score on this mountain (to beat)
    const best = bests[S.seed];
    if (best) { g.font = font(mh * 0.75, 800); g.textAlign = 'left'; g.fillStyle = S.score > best ? '#7dff6a' : '#fff'; g.fillText(`⭐ ${fmt(best)}${S.score > best ? ' BEATEN!' : ''}`, x0 + 6, my + mh * 1.8); }
    pill(g, x0, my, sw, mh, 'rgba(0,0,0,.45)', null);
    const fill = S.rainbow > 0 ? S.rainbow / set.rainbowTime : S.meter;
    if (fill > 0) {
      const grad = g.createLinearGradient(x0, 0, x0 + sw, 0);
      for (let k = 0; k <= 6; k++) grad.addColorStop(k / 6, `hsl(${(k * 55 + (S.rainbow > 0 ? ctx.time * 400 : 0)) % 360},100%,60%)`);
      g.fillStyle = grad; g.beginPath(); g.roundRect(x0, my, Math.max(mh, sw * fill), mh, mh / 2); g.fill();
    }
    g.font = font(mh * 0.8); g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText(S.rainbow > 0 ? '🌈 RAINBOW!' : S.combo > 1 && ctx.time - S.lastBonk < 2.5 ? `×${S.combo} combo` : '🌈', x0 + 8, my + mh / 2 + 1);
  }

  // the book icon (right side, under the 🔧) with the sticker count
  const bp = bookIconPos(), br = Math.max(40, u * 0.07);
  const bounce = S.flyers.length ? 1 + Math.sin(ctx.time * 20) * 0.08 : 1;
  g.save(); g.translate(bp.x, bp.y); g.scale(bounce, bounce);
  g.fillStyle = 'rgba(27,17,64,.7)'; g.beginPath(); g.arc(0, 0, br * 0.75, 0, Math.PI * 2); g.fill();
  g.font = `${br * 0.8}px sans-serif`; g.textAlign = 'center'; g.fillText('📖', 0, 2);
  g.restore();
  g.font = font(br * 0.32); g.fillStyle = '#fff'; g.textAlign = 'center';
  g.fillText(fmt(bookCount), bp.x, bp.y + br * 0.95);

  // tuck / turbo / steering hints (bottom), and the small version tag
  g.font = font(u * 0.028, 700); g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right';
  g.fillText(`v${ctx.release}`, W - 10, H - 14);
  const st = ctx.gestures.steer;
  const ay = H - Math.max(40, u * 0.08), ax = W / 2;
  g.globalAlpha = 0.85;
  g.font = font(u * 0.07); g.textAlign = 'center';
  if (st.value < -0.2) g.fillText('◀', ax - u * 0.25 - st.value * -u * 0.05, ay);
  if (st.value > 0.2) g.fillText('▶', ax + u * 0.25 + st.value * u * 0.05, ay);
  if (S.tuck > 0.5) { g.font = font(u * 0.05); g.fillText('ZOOM!', ax, ay); }
  g.globalAlpha = 1;
  if (S.phase === 'play' && ctx.body().zone === 'too-close') {
    g.font = font(u * 0.045); g.fillStyle = '#fff'; g.textAlign = 'center';
    g.fillText('👣 Step back! 👣', W / 2, H - u * 0.17);
  }
}

// big words live in the TOP band (never the middle of the screen: that's where the action is)
function drawBanners(g) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  const top = 14 + Math.min(u * 0.12, 80) + 12;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = top + u * 0.05;
  for (const b of S.banners) {
    const k = b.t / b.life;
    const pop = b.t < 0.2 ? 0.6 + 2 * b.t : 1;
    g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const size = (b.big ? u * 0.085 : u * 0.06) * pop;
    g.font = font(size); g.lineWidth = 7; g.strokeStyle = 'rgba(27,17,64,.85)';
    g.strokeText(b.text, W / 2, y); g.fillStyle = b.color; g.fillText(b.text, W / 2, y);
    if (b.sub) { g.font = font(size * 0.5, 800); g.lineWidth = 5; g.strokeText(b.sub, W / 2, y + size * 0.75); g.fillStyle = '#fff'; g.fillText(b.sub, W / 2, y + size * 0.75); }
    y += size * (b.sub ? 1.5 : 1.1);
  }
  g.globalAlpha = 1;
  // the 3-2-1 countdown: upper third, not the middle
  if (S.phase === 'intro' && S.phaseT > 1.2) {
    const n = 3 - Math.floor(S.phaseT - 1.2);
    const k = (S.phaseT - 1.2) % 1;
    const txt = n >= 1 ? String(n) : 'GO!';
    g.font = font(u * (0.2 - k * 0.05)); g.lineWidth = 10; g.strokeStyle = 'rgba(27,17,64,.85)';
    g.globalAlpha = 1 - k * 0.6;
    g.strokeText(txt, W / 2, H * 0.36); g.fillStyle = n >= 1 ? '#ffffff' : '#7dff6a'; g.fillText(txt, W / 2, H * 0.36);
    g.globalAlpha = 1;
  }
}

// new stickers fly into the book icon
function drawFlyers(g) {
  const bp = bookIconPos();
  const u = Math.min(ctx.W, ctx.H);
  for (const f of S.flyers) {
    const k = f.t, e = k < 0.15 ? 0 : (k - 0.15) / 0.85;
    const ee = e * e * (3 - 2 * e);
    const x = f.x + (bp.x - f.x) * ee, y = f.y - (1 - ee) * u * 0.06 * Math.sin(Math.PI * Math.min(1, k * 2)) + (bp.y - f.y) * ee;
    const R = u * (k < 0.15 ? 0.02 + k * 0.1 : 0.035 * (1 - ee * 0.4));
    drawSticker(g, f.id, x, y, R);
  }
}
