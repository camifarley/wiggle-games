// 08 · Mega Roll v2.0 "Animal parade!": the playtest redesign. Brief: docs/briefs/08-mega-roll.md (v2.0 section),
// progress: docs/briefs/08-mega-roll.progress.md. v1.0 stays frozen in ../v1.0.
//
// Pick a theme (🐄 Farm / 🌲 Forest / ❄️ Snowy), then roll down a seeded mountain made of hand-made scenes
// (sections.js, mountain.js). Animals are FRIENDS: bonk one and it hops up and joins the PARADE trotting behind the
// ball (parade.js). Buildings are the smash: they crack over 2–3 bonks (roof pops off) and collapse; crouching
// charges a WRECKING ROLL that flattens any building in one hit. New species arrive with a NEW FRIEND! reveal.
// Every run ends at a giant landmark (barn / log tower / ice castle) to crack apart, then the parade group photo.
// No fail states: walls and buildings just bounce you back ("almost!").
//
// Debug (?debug): ←/→ lean, J jump, C crouch, S spin, hold R run, P peekaboo, L leave/return, Z too close.
// Game keys: E = straight to the finale, N = new mountain (theme picker), M = same mountain, B = passport,
// W = RAINBOW ROLL, K = full wrecking charge, G = a golden thing ahead. Test controls (?keys) work too, with
// ⏭ next act / 🏁 finale (debugSkip).

import { createWorld3D, groundY, BALL_R, RAMP_H } from './world3d.js';
import { createRun, randomSeed, CHUNK } from './mountain.js';
import { THEME_INFO } from './sections.js';
import { recipePoints, recipeName, rarity, parseId, SHAPE, COLOR, THEMES } from './recipes.js';
import { loadCollection, themeCount, loadBests, saveBests, createPassport, drawSticker, stickerEl } from './book.js';
import { createViewer } from './viewer.js';
import { createParade } from './parade.js';
import { loadTuning, applyCore } from './settings.js';
import { createTuning } from './tuning.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const fake = params.has('fakecam');
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const SEED_STORE = 'wiggle.megaroll.seed2';
const GRAVITY = 24;
const PARADE_CAP = { high: 30, medium: 20, low: 10 };

let ctx, S, W3, M, set, tuning, panel, col, bests, passport, viewer, onKey, ui, parade, game;

const WORDS = { thing: ['BONK!', 'POP!', 'BOOP!'], tough: ['CRACK!', 'KRAK!'], collapse: ['CRASH!', 'KA-BLAM!', 'TIMBER!'] };
const HAPPY = ['Yay!', 'Wheee!', 'Hi friend!', 'Come along!', 'Join the parade!'];

function freshRound(seed, theme) {
  return {
    seed, theme, phase: 'intro', phaseT: 0,
    x: 0, d: 0, h: 0, vy: 0, vx: 0, speed: 0, roll: 0, air: 0, onRamp: null, scale: 1,
    score: 0, shown: 0, combo: 0, bestCombo: 0, lastBonk: -9, meter: 0, rainbow: 0,
    charge: 0, charged: false, spinRoll: 0, tuck: 0, burst: 0, edgeCool: 0, bumpCool: 0, shake: 0,
    away: false, hiding: false, hideT: 0, boo: 0, banners: [], pops: [], flyers: [], falling: [],
    dead: new Set(), hits: {}, splashed: new Set(), jumpedRiver: new Set(), revealed: new Set(),
    newStickers: [], newBurst: { n: 0, t: 0 }, act: 0,
    finale: null, photoT: 0,
    stats: { bonks: 0, friends: 0, buildings: 0, cracks: 0, bumps: 0, edge: 0, jumps: 0, spins: 0, crouches: 0, peekaboos: 0, leaves: 0,
      ramps: 0, rivers: 0, airTime: 0, rainbows: 0, wrecks: 0, golden: 0, rare: 0, reveals: [], steer: { left: 0, right: 0, straight: 0, arms: 0, lean: 0, maxAbs: 0, leans: 0 }, byShape: {} },
  };
}

// ---------- helpers ----------
let saidAt = {};
function sayMaybe(text, { gap = 4, key = text, interrupt = false, chance = 1 } = {}) {
  if (Math.random() > chance || ctx.time - (saidAt[key] ?? -99) < gap) return;
  saidAt[key] = ctx.time;
  ctx.say(text, { interrupt });
}
// big words live in the TOP band (never over the path). key: same key updates in place (NEW STICKER! ×4)
function banner(text, { sub = '', color = '#ffcc33', life = 2.2, big = false, key = null, icon = null } = {}) {
  const same = key && S.banners.find((b) => b.key === key && b.t < b.life - 0.2);
  if (same) { Object.assign(same, { text, sub, color, icon, life: Math.max(life, same.t + 1.2) }); return; }
  S.banners = S.banners.filter((b) => b.t < b.life - 0.3).slice(-1);
  S.banners.push({ text, sub, color, life, t: 0, big, key, icon });
}
const screenOf = (x, d, h = 1) => W3.toScreen(x, groundY(d) + h, -d, ctx.W, ctx.H);
const objX = (o) => o.x + (o.dx || 0), objD = (o) => o.d - (o.dz || 0);
function loadSeeds() { try { return JSON.parse(localStorage.getItem(SEED_STORE)) || {}; } catch { return {}; } }
function saveSeed(theme, seed) { try { const s = loadSeeds(); s[theme] = seed; s.last = theme; localStorage.setItem(SEED_STORE, JSON.stringify(s)); } catch { /* private */ } }
const bestKey = () => `${S.theme}:${S.seed}`;

// ---------- rounds ----------

function startRound(seed, theme) {
  theme = theme || S?.theme || 'farm';
  seed = seed ?? randomSeed(S ? [S.seed] : []);
  saveSeed(theme, seed);
  for (const i of [...W3.chunks.keys()]) W3.removeChunk(i);
  parade?.clear();
  if (S?.finale?.mesh) W3.removeObject(S.finale.mesh);
  for (const f of S?.falling || []) W3.removeObject(f.mesh);
  M = createRun(seed, theme, { density: set.density });
  S = freshRound(seed, theme);
  S.x = M.centerX(0);
  W3.setSky(M.info.sky, M.info.fog);
  W3.setFinale(0);
  parade = createParade(W3, { cap: set.paradeCap || PARADE_CAP[ctx.perf.tier.name] || 20 });
  streamChunks();
  hideScore(); ui.picker(false);
  if (passport?.isOpen) passport.close();
  const first = SHAPE[M.info.species[0]];
  banner(`${M.info.emoji} Mountain ${seed}`, { sub: M.name, color: '#ffffff', life: 3.6, big: true });
  ctx.say(`Mountain ${seed}! ${M.name}! Find the ${first.name.toLowerCase()}s! Lean to steer!`);
  ctx.recorder.event('round', { seed, theme, name: M.name });
  if (debugOn) window.wiggle.game = S;
}

function streamChunks() {
  const cur = Math.floor(S.d / CHUNK);
  const ahead = ctx.perf.tier.name === 'low' ? 3 : 4;
  for (let i = Math.max(-1, cur - 1); i <= cur + ahead; i++) {
    if (W3.chunks.has(i) || i * CHUNK > M.length + 40) continue;
    const ch = i < 0 ? { ...M.chunk(0), index: -1, d0: -CHUNK, d1: 0, objects: [], decor: [], ramps: [], rivers: [] } : M.chunk(i);
    const rec = W3.addChunk(ch, M, { decor: ctx.perf.tier.name !== 'low' || i % 2 === 0 });
    for (const o of ch.objects) if (S.dead.has(o.id)) { const m = rec.objs.get(o.id); if (m) { m.parent?.remove(m); rec.objs.delete(o.id); } }
  }
  for (const i of [...W3.chunks.keys()]) if (i < cur - 1 && !(i === -1 && cur <= 0)) W3.removeChunk(i);
  // the landmark appears when it's in view
  if (!S.finale && S.d > M.landmarkD - 190) {
    const mesh = W3.makeLandmark(M.info.landmark, M.landmark.x, M.landmark.d);
    S.finale = { mesh, hits: 0, hp: set.landmarkHits, state: 'waiting', wob: 0, back: 0, t: 0, down: false };
  }
}

// ---------- bonks ----------

function addScore(n) { S.score += n; }

function comboUp(kind) {
  S.combo = ctx.time - S.lastBonk < 2.5 ? S.combo + 1 : 1;
  S.lastBonk = ctx.time;
  S.bestCombo = Math.max(S.bestCombo, S.combo);
  if (S.rainbow <= 0) {
    S.meter += set.comboFill * (ctx.gestures.run.state === 'running' ? 1.5 : 1) * (kind === 'tough' ? 2 : 1);
    if (S.meter >= 1) startRainbow();
  }
  return (1 + Math.min(4, Math.floor(S.combo / 5)) * 0.5) * (S.rainbow > 0 ? 2 : 1);
}

// the sticker pops out of everything you bonk; new kinds fly into the book
function sticker(o, p) {
  const r = parseId(o.recipe), tier = rarity(r);
  const isNew = col.add(o.recipe, { m: S.seed, th: S.theme });
  if (!p.behind) S.pops.push({ x: p.x, y: p.y, t: 0, id: o.recipe, sticker: true });
  if (isNew) {
    S.newStickers.push(o.recipe);
    if (S.flyers.length < 6 && !p.behind) S.flyers.push({ id: o.recipe, x: p.x, y: p.y, t: 0 });
    const nb = S.newBurst;
    nb.n = ctx.time - nb.t < 1.6 ? nb.n + 1 : 1; nb.t = ctx.time;
    banner(nb.n > 1 ? `NEW STICKER! ×${nb.n}` : 'NEW STICKER!', { sub: recipeName(r), color: tier === 'golden' ? '#ffd23f' : tier === 'rare' ? '#d9c2ff' : '#7dff6a', life: 2, key: 'new' });
    ctx.sfx.play('collect');
  }
  if (tier === 'golden') {
    S.stats.golden++; addScore(500);
    ctx.fx.confetti(Math.round(120 * ctx.perf.settings.particles));
    ctx.sfx.play('powerup');
    banner('🌟 GOLDEN! 🌟', { sub: recipeName(r), color: '#ffd23f', life: 3, key: 'gold' });
    ctx.say(`Golden sticker! ${recipeName(r)}!`);
  } else if (tier === 'rare') { S.stats.rare++; if (isNew) sayMaybe(`Wow! A ${recipeName(r)}!`, { gap: 6, key: 'rare' }); }
  return isNew;
}

function bonk(o, { how = 'roll' } = {}) {
  if (S.dead.has(o.id)) return;
  if (o.kind === 'tough') return hitBuilding(o, { how });
  S.dead.add(o.id);
  const mesh = W3.objectMesh(o);
  const mult = comboUp(o.kind);
  const pts = Math.round(recipePoints(o.recipe) * mult / 5) * 5;
  addScore(pts);
  S.stats.bonks++;
  S.stats.byShape[o.shape] = (S.stats.byShape[o.shape] || 0) + 1;
  const p = screenOf(objX(o), objD(o), 1.2);
  const u = Math.min(ctx.W, ctx.H);
  if (o.kind === 'critter') {
    // FRIENDS: no explosion. A happy hop, a squeak, a sticker, and off to the parade.
    if (mesh) { mesh.userData.hit = true; parade.join(mesh, o); }
    S.stats.friends++;
    ctx.sfx.squeak(1.1 + Math.random() * 0.5);
    if (Math.random() < 0.35) ctx.sfx.giggle();
    if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: `+${pts}`, word: pick(HAPPY), t: 0, color: '#ffffff', heart: true });
    if (parade.count % 10 === 0) { banner(`🐾 PARADE: ${parade.count}!`, { color: '#7dff6a', life: 1.6, key: 'parade' }); sayMaybe(`${parade.count} friends in the parade!`, { gap: 3, key: 'pc' }); }
  } else {
    // things: a small, quick cube burst that flies OFF the path
    if (mesh) mesh.parent?.remove(mesh);
    const col2 = COLOR[parseId(o.recipe).color].hex;
    const side = objX(o) >= S.x ? 1 : -1;
    W3.debris(objX(o), groundY(objD(o)) + 0.8, -objD(o), { count: Math.round(8 * ctx.perf.settings.particles), colors: [col2, col2, '#ffffff'], speed: 6, size: 0.2, up: 4, side, vz: 3 });
    ctx.sfx.pop();
    if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: `+${pts}`, word: pick(WORDS.thing), t: 0, color: '#ffffff' });
  }
  sticker(o, p);
  if (S.combo > 0 && S.combo % 10 === 0) { sayMaybe(`${S.combo} in a row!`, { gap: 2, key: 'combo' }); ctx.sfx.play('powerup', { vol: 0.6 }); }
  ctx.recorder.event('bonk', { shape: o.shape, kind: o.kind, pts, combo: S.combo, how, rainbow: S.rainbow > 0 });
}

// buildings: crack 2-3 times (wobble, cracks, the roof pops off), then a big chunky collapse.
// RAINBOW ROLL or a full WRECKING charge flattens them in one hit.
function hitBuilding(o, { how = 'roll' } = {}) {
  if (S.bumpCool > 0 && how === 'roll') return;
  S.bumpCool = 0.45;
  const mesh = W3.objectMesh(o);
  const wreck = S.charged || S.rainbow > 0;
  const n = (S.hits[o.id] || 0) + (wreck ? 99 : how === 'pound' ? 2 : 1);
  S.hits[o.id] = n;
  const p = screenOf(objX(o), objD(o), 2.5);
  if (n >= o.hp) return collapse(o, mesh, wreck);
  // a crack: bounce back (never a fail: "almost!")
  S.stats.cracks++;
  // bounce straight back a little: the ball rolls right into it again (bonk-bonk-CRASH)
  const side = S.x >= objX(o) ? 1 : -1;
  S.vx = side * 1.5; S.speed *= 0.35; S.d = objD(o) - o.r - BALL_R * S.scale - 2.2;
  comboUp('tough');
  addScore(20);
  if (mesh) {
    mesh.userData.wobT = 0.7;
    if (n === 1 && mesh.userData.roof) popRoof(mesh);
    addCracks(mesh, n);
  }
  ctx.sfx.play('bonk'); ctx.fx.shake(5);
  if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: `${'●'.repeat(n)}${'○'.repeat(o.hp - n)}`, word: n === o.hp - 1 ? 'ALMOST!' : pick(WORDS.tough), t: 0, color: '#ffcc33' });
  sayMaybe(n === o.hp - 1 ? 'Almost! One more!' : pick(['Crack!', 'Again!', 'Bonk it again!']), { gap: 2.5, key: 'crack' });
  ctx.recorder.event('crack', { shape: o.shape, n, hp: o.hp });
}

function popRoof(mesh) {
  const roof = mesh.userData.roof;
  const wp = roof.getWorldPosition(roof.position.clone());
  const ws = roof.getWorldScale(roof.scale.clone());
  roof.parent.remove(roof);
  roof.position.copy(wp); roof.scale.copy(ws);
  W3.scene.add(roof);
  S.falling.push({ mesh: roof, vx: (Math.random() - 0.5) * 4, vy: 9, vz: 3, spin: 5, t: 0, life: 1.4 });
}

function addCracks(mesh, n) {
  const h = mesh.userData.headY || 3;
  for (let k = 0; k < 2; k++) {
    W3.meshes.part(mesh, W3.G.box, '#2a1a1a', 0.09, h * (0.22 + Math.random() * 0.2), 0.05,
      (Math.random() - 0.5) * 2.2, h * (0.25 + Math.random() * 0.35), 1.65, 0, 0, (Math.random() - 0.5) * 1.4);
  }
}

function collapse(o, mesh, wreck) {
  S.dead.add(o.id);
  S.stats.buildings++;
  if (S.charged) { S.charged = false; S.charge = 0; S.stats.wrecks++; banner('💥 WRECKING ROLL! 💥', { color: '#ff8a3d', life: 1.6, key: 'wreck' }); }
  const mult = comboUp('tough');
  const pts = Math.round(recipePoints(o.recipe) * mult / 5) * 5 + 100;
  addScore(pts);
  const p = screenOf(objX(o), objD(o), 2.5);
  if (mesh) { mesh.userData.collapse = 0.001; S.falling.push({ mesh, collapse: true, t: 0, life: 0.5, y0: mesh.position.y }); }
  const c2 = COLOR[parseId(o.recipe).color].hex;
  const side = objX(o) >= S.x ? 1 : -1;
  W3.debris(objX(o), groundY(objD(o)) + 1.5, -objD(o), { count: Math.round(22 * ctx.perf.settings.particles), colors: [c2, c2, '#ffffff', '#8a6a50'], speed: 8, size: 0.42, up: 7, side, vz: 4, life: 0.75 });
  ctx.fx.confetti(Math.round(40 * ctx.perf.settings.particles));
  ctx.sfx.play('smash'); ctx.fx.shake(10); S.shake = 0.4;
  if (!p.behind) S.pops.push({ x: p.x, y: p.y, text: `+${pts}`, word: pick(WORDS.collapse), t: 0, color: '#ff8a3d', big: true });
  sayMaybe(pick(['Crash!', 'Down it goes!', 'Timber!', 'Ka-blam!']), { gap: 2, key: 'collapse' });
  sticker(o, p);
  ctx.recorder.event('collapse', { shape: o.shape, wreck, pts });
}

function startRainbow() {
  S.rainbow = set.rainbowTime; S.meter = 0; S.stats.rainbows++;
  banner('🌈 RAINBOW ROLL! 🌈', { sub: 'Smash every building!', color: '#ff5ea8', life: 2.4, key: 'rainbow' });
  ctx.say('Rainbow roll!');
  ctx.sfx.play('powerup'); ctx.fx.confetti(Math.round(80 * ctx.perf.settings.particles));
  ctx.recorder.event('rainbow', {});
}

// a new species: the big NEW FRIEND! reveal as the ball comes near the first one
function checkReveals() {
  for (const o of M.objects) {
    if (!o.reveal || S.revealed.has(o.shape) || o.d - S.d > 34 || o.d < S.d) continue;
    S.revealed.add(o.shape);
    const sh = SHAPE[o.shape];
    S.stats.reveals.push(o.shape);
    banner(`${sh.emoji} NEW FRIEND: ${sh.name.toUpperCase()}!`, { sub: 'Bonk them to join the parade!', color: '#7dff6a', life: 3.2, big: true, key: 'reveal' });
    ctx.say(`A new friend! ${sh.name}! Bonk them to join the parade!`);
    ctx.sfx.play('powerup');
    S.reveal = { shape: o.shape, t: 0 };
  }
}

// ---------- the round loop ----------

function updateBall(dt) {
  const st = ctx.gestures.steer;
  const playing = S.phase === 'play';
  S.tuck += ((ctx.gestures.crouching && (playing || S.phase === 'finale') ? 1 : 0) - S.tuck) * Math.min(1, dt * 3);
  // WRECKING ROLL: crouch-boosting charges the ball
  if (!S.charged) {
    S.charge = clamp(S.charge + (S.tuck > 0.5 ? dt / set.chargeTime : -dt * 0.12), 0, 1);
    if (S.charge >= 1) { S.charged = true; banner('🟠 WRECKING ROLL READY!', { sub: 'Smash a building in one hit!', color: '#ff8a3d', life: 2, key: 'wreck' }); ctx.sfx.play('powerup', { vol: 0.7 }); sayMaybe('Wrecking roll! Smash a building!', { gap: 6, key: 'wr' }); }
  }
  const run = ctx.gestures.run.intensity;
  let target = set.rollSpeed * (1 + (set.tuckBoost - 1) * S.tuck) * (1 + (set.runBoost - 1) * run) * (S.rainbow > 0 ? 1.15 : 1) * (S.burst > 0 ? 1.45 : 1);
  if (S.phase === 'intro') target = S.phaseT > 3 ? set.rollSpeed * 0.5 : 0.8;
  else if (S.phase === 'photo' || S.phase === 'end') target = 0;
  else if (S.away) target = 3;
  if (S.phase === 'finale') return updateFinale(dt);
  S.speed += (target - S.speed) * Math.min(1, dt * (target > S.speed ? 1.6 : 1.2));
  S.d += S.speed * dt;
  S.roll += S.speed * dt / (BALL_R * S.scale);

  // steering + gentle auto-assist (toward things to bonk, and along the path)
  const steer = playing ? st.value : 0;
  let want = steer * set.steerSpeed;
  let assistX = M.centerX(S.d + 8);
  if (playing && !S.away) {
    let best = null, bestScore = 0;
    for (const i of [Math.floor(S.d / CHUNK), Math.floor(S.d / CHUNK) + 1]) for (const o of M.chunk(i).objects) {
      if (S.dead.has(o.id) || (o.kind === 'tough' && !S.charged && S.rainbow <= 0)) continue;
      const ahead = objD(o) - S.d;
      if (ahead < 5 || ahead > 28) continue;
      const lat = Math.abs(objX(o) - S.x);
      if (lat > 4 + ahead * 0.35) continue;
      const sc = (1 - ahead / 30) * (1 - lat / 14) * (o.kind === 'critter' ? 1.3 : 1) * (o.hidden ? 1.4 : 1);
      if (sc > bestScore) { bestScore = sc; best = o; }
    }
    if (best) assistX = objX(best);
  }
  const assistV = clamp((assistX - S.x) * 1.1, -set.steerSpeed * 0.75, set.steerSpeed * 0.75);
  want += assistV * set.assist * (0.35 + 0.65 * (1 - Math.min(1, Math.abs(steer) * 1.5)));
  S.vx += (want - S.vx) * Math.min(1, dt * 4);
  S.x += S.vx * dt;

  // edges bounce you back
  S.edgeCool -= dt; S.bumpCool -= dt;
  const c = M.centerX(S.d), lim = M.halfWidth(S.d) - BALL_R * S.scale, off = S.x - c;
  if (Math.abs(off) > lim) {
    const side = Math.sign(off);
    S.x = c + side * lim; S.vx = -side * Math.max(5, Math.abs(S.vx) * 0.7);
    if (S.edgeCool <= 0) { S.edgeCool = 0.6; S.stats.edge++; ctx.sfx.boing(); }
  }

  // ramps, jumps, gravity
  const ch = M.chunk(Math.floor(S.d / CHUNK));
  if (S.h <= 0.25 && S.vy <= 0) for (const rp of ch.ramps) {
    const rx = M.centerX(rp.d) + rp.off, k = (S.d - (rp.d - rp.len / 2)) / rp.len;
    if (k >= 0 && k <= 1 && Math.abs(S.x - rx) < rp.w / 2 + 0.4) { S.onRamp = rp; S.h = RAMP_H * k; }
  }
  if (S.onRamp) {
    const rp = S.onRamp, k = (S.d - (rp.d - rp.len / 2)) / rp.len;
    if (k > 1) { S.onRamp = null; S.vy = 5 + S.speed * 0.45; S.h = RAMP_H; S.stats.ramps++; ctx.sfx.whoosh(); addScore(50); banner('RAMP! +50', { color: '#ffcc33', life: 1.2, key: 'air' }); }
    else if (k < 0 || Math.abs(S.x - (M.centerX(rp.d) + rp.off)) > rp.w / 2 + 0.6) S.onRamp = null;
    else S.h = RAMP_H * k;
  }
  if (!S.onRamp && (S.h > 0 || S.vy > 0)) { S.vy -= GRAVITY * dt; S.h += S.vy * dt; S.air += dt; if (S.h <= 0) land(); }

  // streams: jump over for a bonus, or splash through (no harm)
  for (const rv of ch.rivers) {
    const key = `${rv.d}`;
    if (Math.abs(S.d - rv.d) > rv.w / 2) continue;
    if (S.h > 0.6 && !S.jumpedRiver.has(key)) { S.jumpedRiver.add(key); addScore(100); banner('JUMPED THE STREAM! +100', { color: '#5ee0ff', life: 1.6, key: 'air' }); ctx.sfx.ding(); }
    if (S.h < 0.3 && !S.splashed.has(key) && !S.jumpedRiver.has(key)) {
      S.splashed.add(key); S.stats.rivers++;
      W3.debris(S.x, groundY(S.d) + 0.3, -S.d, { count: 14, colors: ['#4fb8ff', '#bfe8ff', '#ffffff'], speed: 5, size: 0.18, up: 6, vz: 4 });
      ctx.sfx.splat(); S.speed *= 0.85;
    }
  }
  if (playing && S.d >= M.arena0) startFinale();
}

function land() {
  const air = S.air;
  S.h = 0; S.vy = 0; S.air = 0;
  if (air > 0.45) {
    const bonus = Math.round(air * 100 / 10) * 10;
    addScore(bonus); S.stats.airTime += air;
    banner(`AIR TIME +${bonus}`, { color: '#7dff6a', life: 1.3, key: 'air' });
    ctx.sfx.boing(); ctx.fx.shake(5);
    for (const o of nearby(BALL_R * S.scale + 1.8)) bonk(o, { how: 'pound' });
  }
}

function nearby(radius) {
  const out = [];
  const i0 = Math.floor((S.d - radius - 3) / CHUNK), i1 = Math.floor((S.d + radius + 3) / CHUNK);
  for (let i = Math.max(0, i0); i <= i1; i++) for (const o of M.chunk(i).objects) {
    if (S.dead.has(o.id)) continue;
    if (Math.hypot(objX(o) - S.x, objD(o) - S.d) < radius + o.r) out.push(o);
  }
  return out;
}

function collide() {
  const R = BALL_R * S.scale;
  for (const o of nearby(R + 0.2)) {
    const mesh = W3.objectMesh(o);
    if (S.h > (mesh?.userData.headY ?? 1.5) * 0.85) continue; // flew right over it
    bonk(o);
  }
  if (S.spinRoll > 0) for (const o of nearby(6.5)) if (o.kind !== 'tough' || S.charged || S.rainbow > 0) bonk(o, { how: 'spin' });
}

// ---------- the finale: crack the giant landmark apart ----------

function startFinale() {
  S.phase = 'finale'; S.phaseT = 0;
  if (!S.finale) streamChunks();
  const F = S.finale;
  F.state = 'roll'; F.t = 0;
  banner(`${M.info.landmarkName}!`, { sub: 'Bonk it down! Crouch to charge!', color: '#ff8a3d', life: 3, big: true, key: 'finale' });
  ctx.say(`The ${M.info.landmarkName.toLowerCase()}! Bonk it down!`);
}

function updateFinale(dt) {
  const F = S.finale, L = M.landmark;
  W3.setFinale(Math.min(1, S.phaseT / 1.5));
  S.x += (L.x - S.x) * Math.min(1, dt * 2);
  F.t += dt; F.wob = Math.max(0, F.wob - dt);
  if (F.state === 'roll') {
    // roll in (faster with tuck), BONK, bounce back, roll in again
    S.speed += (set.rollSpeed * 1.8 * (1 + (set.tuckBoost - 1) * S.tuck) - S.speed) * Math.min(1, dt * 3);
    S.d += S.speed * dt; S.roll += S.speed * dt / BALL_R;
    if (!S.onAir && (S.h > 0 || S.vy > 0)) { S.vy -= GRAVITY * dt; S.h = Math.max(0, S.h + S.vy * dt); if (S.h === 0) S.vy = 0; }
    if (S.d >= L.d - L.r - BALL_R) hitLandmark();
  } else if (F.state === 'back') {
    S.speed += (-16 - S.speed) * Math.min(1, dt * 8);
    S.d += S.speed * dt; S.roll += S.speed * dt / BALL_R;
    if (S.d <= L.d - 15) { F.state = 'roll'; S.speed = 6; }
  } else if (F.state === 'down') {
    S.speed *= 0.9; S.d += S.speed * dt;
    if (F.t > 2.2) startPhoto();
  }
  // a little auto-help: it never takes forever
  if (F.state !== 'down' && S.phaseT > 30) F.hits = F.hp - 1;
}

function hitLandmark() {
  const F = S.finale;
  const strong = S.charged || S.rainbow > 0 ? 3 : S.h > 0.6 ? 2 : 1;
  if (S.charged) { S.charged = false; S.charge = 0; S.stats.wrecks++; }
  F.hits = Math.min(F.hp, F.hits + strong);
  F.wob = 0.7;
  addScore(100 * strong);
  // pieces crack off, roof and tops first
  const k = F.hits / F.hp, pieces = F.mesh.userData.pieces;
  const maxStage = Math.max(...pieces.map((q) => q.userData.stage));
  for (const q of pieces) {
    if (q.userData.gone || q.userData.stage > Math.floor(k * (maxStage + 1)) - 1 + (F.hits >= F.hp ? 99 : 0)) continue;
    q.userData.gone = true;
    flingPiece(q, F.hits >= F.hp ? 1.6 : 1);
  }
  const p = W3.toScreen(M.landmark.x, groundY(M.landmark.d) + 6, -M.landmark.d, ctx.W, ctx.H);
  S.pops.push({ x: p.x, y: p.y, text: `${'●'.repeat(F.hits)}${'○'.repeat(F.hp - F.hits)}`, word: strong >= 3 ? 'WRECKING ROLL!' : strong === 2 ? 'BIG BONK!' : F.hits >= F.hp - 1 ? 'ALMOST!' : 'CRACK!', t: 0, color: '#ff8a3d', big: true });
  W3.debris(M.landmark.x, groundY(M.landmark.d) + 2, -(M.landmark.d - 5), { count: Math.round(14 * ctx.perf.settings.particles), colors: ['#ffffff', '#c9905a', '#ffe14d'], speed: 7, size: 0.35, up: 7, vz: 5 });
  ctx.sfx.play('smash'); ctx.fx.shake(8 + strong * 3);
  ctx.recorder.event('landmark', { hits: F.hits, strong });
  if (F.hits >= F.hp) {
    F.state = 'down'; F.t = 0; S.speed = 3;
    const pts = 1000 + parade.count * 50;
    addScore(pts);
    banner(`💥 ${M.info.landmarkName} DOWN! 💥`, { sub: `+${fmt(pts)}`, color: '#ffcc33', life: 2.4, big: true, key: 'finale' });
    ctx.fx.confetti(Math.round(260 * ctx.perf.settings.particles)); ctx.sfx.play('win'); S.shake = 0.8;
    ctx.say('Ka-boom! You did it!');
    for (let i = 0; i < 3; i++) setTimeout(() => W3?.debris(M.landmark.x + (Math.random() - 0.5) * 10, groundY(M.landmark.d) + 4, -M.landmark.d, { count: 20, colors: ['#ffffff', '#ffe14d', '#ff8a3d', '#c9905a'], speed: 10, size: 0.5, up: 10, life: 1 }), i * 180);
  } else {
    F.state = 'back';
    sayMaybe(F.hits >= F.hp - 1 ? 'Almost! One more bonk!' : pick(['Crack! Again!', 'Bonk! Again!', 'Crouch to charge up!']), { gap: 1.5, key: 'lm' });
  }
}

function flingPiece(q, power = 1) {
  const wp = q.getWorldPosition(q.position.clone()), ws = q.getWorldScale(q.scale.clone()), wq = q.getWorldQuaternion(q.quaternion.clone());
  q.parent.remove(q);
  q.position.copy(wp); q.scale.copy(ws); q.quaternion.copy(wq);
  W3.scene.add(q);
  const side = (wp.x - M.landmark.x) >= 0 ? 1 : -1;
  S.falling.push({ mesh: q, vx: side * (3 + Math.random() * 5) * power, vy: (5 + Math.random() * 6) * power, vz: (2 + Math.random() * 4) * power, spin: (Math.random() - 0.5) * 6, t: 0, life: 2.2, floor: groundY(M.landmark.d) });
}

function startPhoto() {
  S.phase = 'photo'; S.phaseT = 0;
  S.d = M.landmark.d - 3; S.x = M.landmark.x; S.h = 0; S.speed = 0; // the ball poses in the middle, on the rubble
  const n = parade.count;
  parade.photo(M.landmark.x, M.landmark.d - 7);
  banner(n ? `📸 PARADE: ${n} friend${n === 1 ? '' : 's'}!` : '📸 Say cheese!', { color: '#7dff6a', life: 4, big: true, key: 'photo' });
  ctx.say(n ? `Group photo! ${n} friends in the parade!` : 'Say cheese!');
  ctx.music?.jingle?.('win');
  S.flash = 1;
  ctx.recorder.event('photo', { parade: n });
}

function endRound() {
  S.phase = 'end'; S.phaseT = 0;
  const k = bestKey(), prev = bests[k] || 0;
  S.prevBest = prev; S.newBest = S.score > prev;
  if (S.newBest) { bests[k] = Math.round(S.score); saveBests(bests); }
  ctx.say(`${fmt(S.score)} points!${S.newBest && prev > 0 ? ' New best score!' : ''}${S.newStickers.length ? ` And ${S.newStickers.length} new stickers!` : ''}`);
  ctx.recorder.event('end', { seed: S.seed, theme: S.theme, score: Math.round(S.score), parade: parade.count, best: bests[k] || 0, stickers: S.newStickers.length });
  showScore();
}

function updateFalling(dt) {
  for (let i = S.falling.length - 1; i >= 0; i--) {
    const f = S.falling[i];
    f.t += dt;
    if (f.collapse) {
      // the building squashes down and sinks
      const k = Math.min(1, f.t / f.life);
      f.mesh.scale.y = Math.max(0.05, 1 - k); f.mesh.scale.x = f.mesh.scale.z = 1 + k * 0.25;
      f.mesh.position.y = f.y0 - k * 0.5;
    } else {
      f.vy -= 20 * dt;
      f.mesh.position.x += f.vx * dt; f.mesh.position.y += f.vy * dt; f.mesh.position.z += f.vz * dt;
      if (f.floor != null && f.mesh.position.y < f.floor) { f.mesh.position.y = f.floor; f.vy = Math.abs(f.vy) * 0.3; f.vx *= 0.6; f.vz *= 0.6; }
      f.mesh.rotation.x += f.spin * dt; f.mesh.rotation.z += f.spin * 0.7 * dt;
      if (f.t > f.life - 0.4) f.mesh.scale.multiplyScalar(0.9);
    }
    if (f.t > f.life) { W3.removeObject(f.mesh); S.falling.splice(i, 1); }
  }
  // wobbles after a crack (buildings + the landmark)
  for (const c of W3.chunks.values()) for (const m of c.objs.values()) {
    if (!(m.userData.wobT > 0)) continue;
    m.userData.wobT -= dt;
    m.rotation.z = Math.sin(m.userData.wobT * 30) * 0.08 * m.userData.wobT;
  }
  if (S.finale) S.finale.mesh.rotation.z = Math.sin(S.finale.wob * 28) * 0.03 * S.finale.wob;
}

function trackStats(dt) {
  const st = ctx.gestures.steer, s = S.stats.steer;
  if (st.value < -0.15) s.left += dt; else if (st.value > 0.15) s.right += dt; else s.straight += dt;
  if (st.mode === 'arms') s.arms += dt; else if (st.mode === 'lean') s.lean += dt;
  s.maxAbs = Math.max(s.maxAbs, Math.abs(st.value));
}

// ---------- DOM: theme picker + score screen ----------

const UI_STYLE = `
.mr-ui { position: fixed; inset: 0; z-index: 4; pointer-events: none; font-family: ui-rounded, system-ui, sans-serif; color: #fff; }
.mr-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
  overflow-y: auto; box-sizing: border-box; padding: 16px; border-radius: 28px; background: rgba(27,17,64,.9); border: 4px solid #ffcc33; text-align: center; pointer-events: auto; }
.mr-card[hidden] { display: none; }
.mr-card .mt { font-size: clamp(16px, 3vmin, 24px); opacity: .9; font-weight: 800; }
.mr-card .pts { font-size: clamp(50px, 13vmin, 116px); font-weight: 900; line-height: 1; color: #ffe14d; text-shadow: 0 5px 0 rgba(0,0,0,.3); }
.mr-card .par { font-size: clamp(22px, 5vmin, 40px); font-weight: 900; color: #7dff6a; margin: 4px 0; }
.mr-card .best { font-size: clamp(18px, 4vmin, 30px); font-weight: 900; margin: 4px 0 8px; }
.mr-card .best.new { color: #7dff6a; animation: mrpulse .5s ease-in-out infinite alternate; }
@keyframes mrpulse { to { transform: scale(1.08); } }
.mr-card .stk { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 6px; min-height: 20px; margin-bottom: 10px; }
.mr-card .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.mr-card .btns button { font: inherit; font-weight: 900; font-size: clamp(19px, 3.8vmin, 30px); color: #fff; border-radius: 22px; padding: 14px 18px; min-width: 150px;
  border: 4px solid rgba(255,255,255,.6); background: #ff5ea8; box-shadow: 0 6px 0 rgba(0,0,0,.3); cursor: pointer; }
.mr-card .btns button:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,.3); }
.mr-card .btns .em { font-size: 1.5em; display: block; }
.mr-card.pick .btns button { min-width: 0; flex: 1 1 180px; padding: 18px 10px; }
.mr-card.pick .btns .em { font-size: 3.4em; line-height: 1.15; }
.mr-card.pick .btns small { display: block; font-size: .55em; opacity: .85; font-weight: 800; }
.mr-card .sp { font-size: clamp(14px, 2.6vmin, 20px); opacity: .85; margin-top: 4px; }
`;

function createUI() {
  const style = document.createElement('style'); style.textContent = UI_STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'mr-ui';
  root.innerHTML = `
    <div class="mr-card pick" hidden><div class="pts" style="font-size:clamp(34px,8vmin,70px)">🏔️ Mega Roll</div><div class="mt">Where do you want to roll?</div><div class="btns themes"></div></div>
    <div class="mr-card score" hidden><div class="mt"></div><div class="pts">0</div><div class="par"></div><div class="best"></div><div class="mt nl"></div><div class="stk"></div>
      <div class="btns"><button class="same"><span class="em">🔁</span>Same mountain</button><button class="new" style="background:#4d8dff"><span class="em">🏔️</span>New mountain</button><button class="book" style="background:#3fbf6a"><span class="em">📖</span>Stickers</button></div></div>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const themes = $('.themes');
  for (const th of THEMES) {
    const T = THEME_INFO[th];
    const b = document.createElement('button');
    b.style.background = { farm: '#5fae3a', forest: '#2f7a4a', snowy: '#4d9ad8' }[th];
    b.innerHTML = `<span class="em">${T.emoji}</span>${T.title}<small class="cnt"></small>`;
    b.onclick = () => { ctx.sfx.play('tap'); startRound(loadSeeds()[th] ? randomSeed([loadSeeds()[th]]) : randomSeed(), th); };
    b.dataset.theme = th;
    themes.append(b);
  }
  $('.same').onclick = () => { ctx.sfx.play('tap'); startRound(S.seed, S.theme); };
  $('.new').onclick = () => { ctx.sfx.play('tap'); hideScore(); ui.picker(true); };
  $('.book').onclick = () => { ctx.sfx.play('tap'); hideScore(); passport.open(S.theme); };
  return {
    root, $,
    picker(on) {
      $('.pick').hidden = !on;
      if (on) {
        for (const b of themes.children) b.querySelector('.cnt').textContent = `${fmt(themeCount(col, b.dataset.theme))} stickers`;
        S.phase = 'pick';
        ctx.say('Mega Roll! Where do you want to roll? Farm, forest, or snowy?');
      }
    },
    destroy() { root.remove(); style.remove(); },
  };
}

function showScore() {
  const { $ } = ui;
  $('.score').hidden = false;
  $('.score .mt').textContent = `${M.info.emoji} Mountain ${S.seed} · ${M.name}`;
  $('.par').textContent = parade.count ? `🐾 PARADE: ${parade.count} friend${parade.count === 1 ? '' : 's'}!` : '🐾 Bonk animals to start a parade!';
  const best = bests[bestKey()] || 0;
  $('.best').textContent = S.newBest && S.prevBest ? `⭐ NEW BEST! (was ${fmt(S.prevBest)})` : `⭐ Best: ${fmt(best)}`;
  $('.best').classList.toggle('new', S.newBest && S.prevBest > 0);
  $('.nl').textContent = S.newStickers.length ? `NEW STICKERS: ${S.newStickers.length}` : `${S.stats.bonks} bonks!`;
  const stk = $('.stk'); stk.textContent = '';
  for (const id of S.newStickers.slice(0, 14)) stk.append(stickerEl(id, { size: 50 }));
  if (S.newStickers.length > 14) stk.append(Object.assign(document.createElement('div'), { textContent: `+${S.newStickers.length - 14} more`, style: 'align-self:center;font-weight:900' }));
}
function hideScore() { if (ui) ui.$('.score').hidden = true; }

// ---------- readouts / export (🔧) ----------

function readouts() {
  const gs = ctx.gestures, st = gs.steer;
  const b = ctx.body(), rec = ctx.recorder;
  const sec = M.sectionAt(S.d);
  return [
    `steer  ${st.value >= 0 ? '+' : ''}${st.value.toFixed(2)} ${st.mode}${st.hold ? ` (${st.hold})` : ''}  leans ${st.left}◀ ${st.right}▶${fake || gs.simLean != null ? ' (sim)' : ''}`,
    `ball   ${S.speed.toFixed(1)} m/s · ${S.d.toFixed(0)}/${M.length.toFixed(0)} m · tuck ${S.tuck.toFixed(2)} · charge ${Math.round(S.charge * 100)}%${S.charged ? ' READY' : ''} · run ${gs.run.intensity.toFixed(2)}`,
    `run    ${S.phase} · ${M.info.title} · act ${sec ? sec.act + 1 : '-'} ${sec ? `${sec.actName}: ${sec.id} (${sec.lead})` : ''}`,
    `plan   ${M.plan.map((p) => p.id + (p.newSpecies ? '*' : '')).join(' → ')} → ${M.info.landmark}`,
    `score  ${fmt(S.score)} · parade ${parade.count} · bonks ${S.stats.bonks} · buildings ${S.stats.buildings} (${S.stats.cracks} cracks) · combo ×${S.combo}${S.rainbow > 0 ? ` · RAINBOW ${S.rainbow.toFixed(1)} s` : ''}`,
    `moves  jumps ${S.stats.jumps} · spins ${S.stats.spins} · crouches ${S.stats.crouches} · wrecks ${S.stats.wrecks} · peekaboos ${S.stats.peekaboos}`,
    `book   ${fmt(col.count)} stickers · ${S.newStickers.length} new this run${S.finale ? ` · landmark ${S.finale.hits}/${S.finale.hp}` : ''}`,
    `zone ${b.zone}  tier ${ctx.perf.tier.name}  fps ${ctx.perf.fps.toFixed(0)} · parade drawn ${parade.visible}/${parade.count} · recording ${rec.rows.length} rows`,
  ].join('\n');
}

function exportFile() {
  const rec = ctx.recorder;
  if (!rec.rows.length && !rec.events.length) return null;
  const st = S.stats;
  return rec.download({
    trueCount: null, expected: 'session', game: '08-mega-roll', release: ctx.release, preset: tuning.preset, settings: { ...set },
    note: (tuning.notes || '').trim() || null,
    summary: { seed: S.seed, theme: S.theme, mountain: M.name, plan: M.plan.map((p) => p.id), phase: S.phase, score: Math.round(S.score), best: bests[bestKey()] || 0,
      parade: parade.count, newStickers: S.newStickers, stickersTotal: col.count, ...st,
      steer: { ...Object.fromEntries(Object.entries(st.steer).map(([k, v]) => [k, +(+v).toFixed(2)])), leans: ctx.gestures.steer.count }, distance: Math.round(S.d) },
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function applySettings(s) { set = s; applyCore(s, ctx.gestures); if (parade) parade.cap = s.paradeCap || PARADE_CAP[ctx.perf.tier.name] || 20; }

// skip helpers (🔧 buttons, debug keys, test controls ⏭ 🏁)
function skipToAct(a) {
  const s = M.sections.find((p) => p.act === a);
  if (!s || S.phase === 'finale') return;
  if (S.phase !== 'play') { S.phase = 'play'; S.phaseT = 0; }
  S.d = s.d0 - 5; S.x = M.centerX(S.d); streamChunks();
}
function skipToFinale() { if (S.phase === 'pick' || S.phase === 'end' || S.phase === 'photo') return; S.phase = 'play'; S.d = M.arena0 - 25; S.x = M.centerX(S.d); streamChunks(); }

game = {
  needs: ['pose', 'motion'],
  showCamera: false,
  background: '#86ccff',

  init(c) {
    ctx = c;
    saidAt = {};
    tuning = loadTuning();
    applySettings(tuning.settings);
    col = loadCollection();
    bests = loadBests();
    const seeds = loadSeeds();
    const th0 = THEMES.includes(params.get('theme')) ? params.get('theme') : seeds.last || 'farm';
    W3 = createWorld3D({ tier: ctx.perf.tier.name, sky: THEME_INFO[th0].sky, fog: THEME_INFO[th0].fog });
    ui = createUI();
    viewer = createViewer();
    passport = createPassport({ col, say: (t) => ctx.say(t), viewer, onClose: () => { viewer.close(); if (S.phase === 'end') showScore(); else if (S.phase === 'pick') ui.picker(true); } });
    ctx.recorder.start({ station: 'mega-roll', title: 'Mega Roll', maxRows: 30 * 60 * 10 });
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.mega = { startRound, skipToAct, skipToFinale, startRainbow, get S() { return S; }, get M() { return M; }, get parade() { return parade; }, W3, col, bests, passport, viewer }; }
    // a seed in the URL (?seed=4721&theme=forest) starts straight away; otherwise the theme picker
    const sp = Math.round(+params.get('seed'));
    M = createRun(seeds[th0] || 1, th0);
    S = freshRound(seeds[th0] || 1, th0);
    parade = createParade(W3, { cap: 20 });
    if (sp >= 1 && sp <= 9999) startRound(sp, th0);
    else { streamChunks(); ui.picker(true); }

    panel = createTuning({
      ctx, tuning,
      onChange: (s) => applySettings(s),
      onSeed: (v) => startRound(v, S.theme),
      mountain: () => ({ seed: S.seed, title: `${M.info.emoji} ${M.title}`, best: fmt(bests[bestKey()] || 0) }),
      readouts,
      graph: () => ({
        v: (ctx.gestures.steer.value + 1) / 2, aura: ctx.gestures.steer.mode === 'arms',
        lines: [{ v: (1 + ctx.gestures.steerConfig.deadzone) / 2, show: `deadzone ±${ctx.gestures.steerConfig.deadzone.toFixed(2)}`, color: '#ffcc33' }, { v: (1 - ctx.gestures.steerConfig.deadzone) / 2, show: '', color: '#ffcc33' }],
      }),
      exportFile,
      exportBook: () => { const name = `mega-roll-stickers-${new Date().toISOString().slice(0, 10)}.json`; download(name, col.exportJSON({ best2: bests })); return `saved ${name} (${col.count} stickers)`; },
      importBook: (text) => {
        const n = col.importJSON(text);
        try { for (const [k, v] of Object.entries(JSON.parse(text).best2 || {})) bests[k] = Math.max(bests[k] || 0, +v || 0); saveBests(bests); } catch { /* fine */ }
        passport.render();
        return `imported: ${n} new stickers (now ${col.count})`;
      },
      actions: [
        { label: '🐄 Farm', fn: () => startRound(null, 'farm') }, { label: '🌲 Forest', fn: () => startRound(null, 'forest') }, { label: '❄️ Snowy', fn: () => startRound(null, 'snowy') },
        { label: '⏭ Act 2', fn: () => skipToAct(1) }, { label: '⏭ Village', fn: () => skipToAct(2) }, { label: '🏁 Finale', fn: () => skipToFinale() },
        { label: '📖 Passport', fn: () => passport.open(S.theme) }, { label: '🌈 Rainbow', fn: () => startRainbow() }, { label: '🟠 Charge', fn: () => { S.charge = 1; } },
      ],
      extraButtons: ctx.testinput?.toggleButton ? [ctx.testinput.toggleButton()] : [],
    });
    game.debugSkip = { next: () => skipToAct(Math.min(2, (M.sectionAt(S.d)?.act ?? -1) + 1)), finale: () => skipToFinale() };

    const g = ctx.gestures;
    g.on('jump', () => {
      S.stats.jumps++; panel.mark('jump', '#7dff6a');
      if (S.h < 0.4 && !S.onRamp && S.phase !== 'photo' && S.phase !== 'end') { S.vy = set.bounce; S.h = Math.max(S.h, 0.01); S.air = 0; ctx.sfx.boing(); sayMaybe('Big bounce!', { gap: 5, key: 'jump' }); }
    });
    g.on('spin', () => { S.stats.spins++; S.spinRoll = 1.0; banner('🌀 SPIN-ROLL! 🌀', { color: '#b48cff', life: 1.4, key: 'spin' }); ctx.sfx.whoosh(); sayMaybe('Spin-roll!', { gap: 3, key: 'spin' }); });
    g.on('crouch', () => { S.stats.crouches++; ctx.sfx.whoosh(); sayMaybe(S.charged ? 'Zoom!' : 'Zoom! Charging up!', { gap: 4, key: 'tuck' }); });
    g.on('run', () => sayMaybe('Turbo!', { gap: 8, key: 'run' }));
    g.on('lean', (d) => { S.stats.steer.leans++; panel.mark(d.side === 'left' ? '◀' : '▶', '#5ec8ff'); });
    g.on('leave', () => { S.away = true; S.stats.leaves++; ctx.say("Where'd you go? I'll wait!"); });
    g.on('return', () => { if (!S.away) return; S.away = false; ctx.say('There you are! Roll!'); });
    g.on('hide', () => { S.hiding = true; S.hideT = 0; ctx.sfx.squeak(0.6); });
    g.on('peekaboo', () => {
      S.hiding = false; S.stats.peekaboos++; S.boo = 1.2; S.burst = 2;
      ctx.say('BOO!'); ctx.sfx.giggle(); ctx.sfx.whoosh();
      // the parade jumps in surprise
      for (const m of parade.members) if (m.state === 'walk') { m.state = 'hop'; m.vy = 6; }
    });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'e') skipToFinale();
      if (k === 'n') { hideScore(); ui.picker(true); }
      if (k === 'm') startRound(S.seed, S.theme);
      if (k === 'b') { if (passport.isOpen) passport.close(); else { hideScore(); passport.open(S.theme); } }
      if (k === 'w') startRainbow();
      if (k === 'k') S.charge = 1;
      if (k === 'g') {
        const ch = M.chunk(Math.floor((S.d + 15) / CHUNK));
        const o = { id: `g-${Math.round(S.d)}`, recipe: `${pick(M.info.species)}.gold.plain.crown.normal`, d: S.d + 15, x: S.x, r: 0.8, rot: 0, wob: 0, act: 'dance' };
        o.shape = o.recipe.split('.')[0]; o.kind = SHAPE[o.shape].kind;
        ch.objects.push(o);
        const rec = W3.chunks.get(ch.index);
        if (rec) { const m = W3.makeObject(o.recipe); m.position.set(o.x, groundY(o.d), -o.d); m.userData.o = o; rec.group.add(m); rec.objs.set(o.id, m); }
      }
    };
    if (debugOn) addEventListener('keydown', onKey);
  },

  update(dt) {
    if (debugOn && window.wiggle?.pause) return; // ?debug: freeze for screenshots
    S.phaseT += dt;
    for (const b of S.banners) b.t += dt;
    S.banners = S.banners.filter((b) => b.t < b.life);
    if (passport.isOpen || viewer.isOpen) { panel.update(dt); return; } // the world waits while the book is open

    if (S.phase === 'intro') {
      if (S.phaseT > 3.2) { S.phase = 'play'; S.phaseT = 0; ctx.say('GO!', { interrupt: false }); ctx.sfx.whoosh(); }
    } else if (S.phase === 'play') {
      trackStats(dt);
      checkReveals();
    } else if (S.phase === 'photo') {
      S.flash = Math.max(0, (S.flash || 0) - dt * 2);
      if (S.phaseT > 4.5) endRound();
    }
    if (S.reveal) { S.reveal.t += dt; if (S.reveal.t > 3) S.reveal = null; }

    S.rainbow = Math.max(0, S.rainbow - dt);
    S.spinRoll = Math.max(0, S.spinRoll - dt);
    S.burst = Math.max(0, S.burst - dt);
    S.boo = Math.max(0, S.boo - dt);
    S.shake = Math.max(0, S.shake - dt);
    if (S.hiding) { S.hideT += dt; if (S.hideT > 4 && !ctx.gestures.covering) S.hiding = false; }
    if (ctx.time - S.lastBonk > 6) S.meter = Math.max(0, S.meter - dt * 0.02);
    S.scale += ((S.rainbow > 0 ? 1.3 : S.charged ? 1.12 : 1) - S.scale) * Math.min(1, dt * 3);

    if (S.phase !== 'pick') updateBall(dt);
    if (S.phase === 'play' && !S.away) collide();
    if (S.phase !== 'photo' && S.phase !== 'end') parade.record(S.x, S.d);
    streamChunks();
    parade.update(dt, ctx.time);
    updateFalling(dt);
    W3.animate(ctx.time, dt, S.d - 10, S.d + CHUNK * 4);
    for (const p of S.pops) p.t += dt;
    S.pops = S.pops.filter((p) => p.t < (p.big ? 1.3 : 0.9));
    for (const f of S.flyers) f.t += dt;
    S.flyers = S.flyers.filter((f) => f.t < 1);
    S.shown += (S.score - S.shown) * Math.min(1, dt * 6);
    if (Math.abs(S.score - S.shown) < 1) S.shown = S.score;
    if (S.phase === 'end') ui.$('.score .pts').textContent = fmt(S.score * (1 - (1 - Math.min(1, S.phaseT / 1.6)) ** 3));
    if (S.phase === 'play' && ctx.body().zone === 'too-close') sayMaybe('Step back so I can see your knees!', { gap: 10, key: 'zone' });
    panel.update(dt);
  },

  draw(g) {
    const { W, H } = ctx;
    const st = ctx.gestures.steer;
    const photo = S.phase === 'photo' || S.phase === 'end';
    W3.setBall({ x: S.x, d: S.d, h: S.h, roll: S.roll + (S.spinRoll > 0 ? S.spinRoll * 18 : 0), lean: st.value, scale: S.scale, rainbow: S.rainbow, charged: S.charged, charge: S.charge, t: ctx.time });
    if (photo) W3.setCamera({ x: M.landmark.x, d: M.landmark.d - 10, photo: true, aspect: W / H });
    else W3.setCamera({ x: S.x, d: S.d, h: S.h, dt: 1 / 60, tuck: Math.max(S.tuck * 0.6, S.burst > 0 ? 0.5 : 0), shake: S.shake * 0.6, aspect: W / H });
    g.drawImage(W3.render(W, H, Math.min(ctx.view.dpr, ctx.perf.tier.name === 'low' ? 1 : 1.5)), 0, 0, W, H);
    if (S.phase === 'pick') return;
    const u = Math.min(W, H);
    if (S.phase === 'play' && Math.max(S.tuck, ctx.gestures.run.intensity) > 0.35) speedLines(g, u, Math.max(S.tuck, ctx.gestures.run.intensity));
    if (!photo) drawPorthole(g);
    drawPops(g);
    drawParadeFlag(g);
    drawHud(g);
    drawBanners(g);
    drawFlyers(g);
    if (S.flash > 0) { g.fillStyle = `rgba(255,255,255,${S.flash * 0.8})`; g.fillRect(0, 0, W, H); }
  },

  destroy() {
    if (onKey) removeEventListener('keydown', onKey);
    onKey = null;
    panel?.destroy(); panel = null;
    passport?.destroy(); passport = null;
    viewer?.destroy(); viewer = null;
    ui?.destroy(); ui = null;
    W3?.dispose(); W3 = null;
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.mega; }
  },
};
export default game;

// ---------- 2D drawing ----------

const font = (px, w = 900) => `${w} ${px}px ui-rounded, system-ui, sans-serif`;
function pill(g, x, y, w, h, fill, stroke) {
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
}

// speed lines only at the screen EDGES (the middle is the path)
function speedLines(g, u, k) {
  const { W, H } = ctx;
  g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, k * 0.5)})`; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, y = H * (0.25 + ((i * 0.37 + ctx.time * 1.8) % 1) * 0.7);
    const x = side > 0 ? W - W * 0.04 - (i % 3) * W * 0.03 : W * 0.04 + (i % 3) * W * 0.03;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * u * 0.08, y + u * 0.03); g.stroke();
  }
}

// his live face in a round porthole on the ball (as in v1.0). Hands over the face = "?", then BOO!
let crop = null;
function drawPorthole(g) {
  const b = W3.ballScreen(ctx.W, ctx.H);
  const R = b.r * 0.62;
  if (R < 6) return;
  const x = b.x, y = b.y - b.r * 0.05;
  g.save();
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = '#1b1140'; g.fill(); g.clip();
  const cam = ctx.camera;
  if (S.hiding) {
    g.fillStyle = '#b48cff'; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.fillStyle = '#fff'; g.font = font(R * 1.3); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y);
  } else if (set.face && cam.ready && cam.video.videoWidth) {
    const vw = cam.video.videoWidth, vh = cam.video.videoHeight, p = ctx.pose;
    let cx = vw / 2, cy = vh * 0.35, size = vh * 0.5;
    if (p.found && p.nose && p.nose.v > 0.3 && p.leftShoulder && p.rightShoulder) {
      cx = (1 - p.nose.x) * vw; cy = p.nose.y * vh;
      size = Math.max(60, Math.abs(p.leftShoulder.x - p.rightShoulder.x) * vw * 1.15);
    }
    crop = crop ? { x: crop.x + (cx - crop.x) * 0.25, y: crop.y + (cy - crop.y) * 0.25, s: crop.s + (size - crop.s) * 0.15 } : { x: cx, y: cy, s: size };
    g.translate(x, y); g.scale(-1, 1);
    try { g.drawImage(cam.video, crop.x - crop.s / 2, crop.y - crop.s / 2, crop.s, crop.s, -R, -R, R * 2, R * 2); } catch { /* frame not ready */ }
  } else {
    g.fillStyle = '#ffe0c2'; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.fillStyle = '#1b1140';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * R * 0.35, y - R * 0.15, R * 0.13, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = R * 0.1; g.strokeStyle = '#1b1140'; g.beginPath(); g.arc(x, y + R * 0.1, R * 0.4, 0.2, Math.PI - 0.2); g.stroke();
  }
  g.restore();
  g.lineWidth = Math.max(3, R * 0.14);
  g.strokeStyle = S.rainbow > 0 ? `hsl(${(ctx.time * 300) % 360},100%,65%)` : S.charged ? '#ff8a3d' : '#ffffff';
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
  // the wrecking charge ring around the porthole
  if (S.charge > 0 && !S.charged) { g.strokeStyle = '#ff8a3d'; g.lineWidth = Math.max(3, R * 0.12); g.beginPath(); g.arc(x, y, R * 1.25, -Math.PI / 2, -Math.PI / 2 + S.charge * Math.PI * 2); g.stroke(); }
  if (S.boo > 0) {
    g.font = font(R * 1.1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14d'; g.strokeStyle = '#1b1140'; g.lineWidth = 6;
    const yy = y - R * 1.8 - (1.2 - S.boo) * R;
    g.strokeText('BOO!', x, yy); g.fillText('BOO!', x, yy);
  }
}

// small, quick pop-ups at the thing (fade fast). Animals get a little heart.
function drawPops(g) {
  const u = Math.min(ctx.W, ctx.H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of S.pops) {
    const life = p.big ? 1.3 : 0.9, k = p.t / life;
    g.globalAlpha = 1 - k * k;
    const y = p.y - k * u * 0.1;
    if (p.sticker) { drawSticker(g, p.id, p.x + u * 0.05, y - u * 0.06, u * 0.022); continue; }
    g.font = font(u * (p.big ? 0.05 : 0.036)); g.lineWidth = 4; g.strokeStyle = 'rgba(27,17,64,.8)';
    const word = p.heart ? `💛 ${p.word}` : p.word;
    g.strokeText(word, p.x, y); g.fillStyle = p.color; g.fillText(word, p.x, y);
    if (p.text) { g.font = font(u * 0.03); g.strokeText(p.text, p.x, y + u * 0.04); g.fillStyle = '#ffe14d'; g.fillText(p.text, p.x, y + u * 0.04); }
  }
  g.globalAlpha = 1;
}

function drawParadeFlag(g) {
  if (!parade.extra || S.phase === 'pick') return;
  const fp = parade.flagPos;
  if (!fp) return;
  const p = W3.toScreen(fp.x, fp.y, fp.z, ctx.W, ctx.H);
  if (p.behind || p.y > ctx.H) return;
  const u = Math.min(ctx.W, ctx.H);
  g.font = font(u * 0.035); g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = `🚩 +${parade.extra}`, w = g.measureText(txt).width + 16;
  pill(g, p.x - w / 2, p.y - u * 0.025, w, u * 0.05, 'rgba(27,17,64,.75)', '#7dff6a');
  g.fillStyle = '#fff'; g.fillText(txt, p.x, p.y);
}

function bookIconPos() { const u = Math.min(ctx.W, ctx.H); return { x: ctx.W - Math.max(40, u * 0.07) - 12, y: 66 + Math.max(40, u * 0.07) }; }

function drawHud(g) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  g.textBaseline = 'middle';
  // progress to the landmark (top center): a track with the ball moving toward the landmark icon
  const tw = Math.min(W * 0.36, 360), th = Math.min(u * 0.075, 46), tx = W / 2 - tw / 2, ty = 16;
  pill(g, tx, ty, tw, th, 'rgba(27,17,64,.7)', '#ffcc33');
  const prog = clamp(S.d / M.landmarkD, 0, 1);
  g.fillStyle = 'rgba(125,255,106,.35)'; g.beginPath(); g.roundRect(tx + 4, ty + 4, Math.max(th - 8, (tw - 8) * prog), th - 8, (th - 8) / 2); g.fill();
  g.font = `${th * 0.62}px sans-serif`; g.textAlign = 'center';
  g.fillText({ bigbarn: '🛖', logtower: '🗼', icecastle: '🏰' }[M.info.landmark], tx + tw - th * 0.5, ty + th / 2 + 1);
  g.fillText('🟣', tx + th * 0.5 + (tw - th * 1.6) * prog, ty + th / 2 + 1);
  // the act markers
  for (const s of M.sections) if (s.newSpecies && S.revealed.has(s.newSpecies)) { const px = tx + th * 0.5 + (tw - th * 1.6) * (s.d0 / M.landmarkD); g.font = `${th * 0.4}px sans-serif`; g.fillText(SHAPE[s.newSpecies].emoji, px, ty + th + th * 0.35); }

  // score + parade (top left, after the back button; narrow phones: under it)
  const narrow = W / 2 - tw / 2 - 114 < 150;
  const x0 = narrow ? 16 : 104, y0 = narrow ? 104 : 18, sh = Math.min(u * 0.1, 62);
  const sw = narrow ? Math.min(W * 0.45, sh * 3.8) : Math.min(W / 2 - tw / 2 - x0 - 10, sh * 3.8);
  pill(g, x0, y0, sw, sh, 'rgba(27,17,64,.7)', null);
  g.fillStyle = '#ffe14d'; g.textAlign = 'center'; g.font = font(Math.min(sh * 0.62, sw / 5));
  g.fillText(fmt(S.shown), x0 + sw / 2, y0 + sh / 2 + 2);
  // the parade counter: big and green
  const py = y0 + sh + 8, ph = sh * 0.72;
  pill(g, x0, py, sw, ph, 'rgba(27,17,64,.7)', '#7dff6a');
  g.font = font(ph * 0.62); g.fillStyle = '#7dff6a';
  g.fillText(`🐾 ${parade.count}`, x0 + sw / 2, py + ph / 2 + 1);
  // combo / rainbow meter
  const my = py + ph + 8, mh = sh * 0.36;
  pill(g, x0, my, sw, mh, 'rgba(0,0,0,.45)', null);
  const fill = S.rainbow > 0 ? S.rainbow / set.rainbowTime : S.meter;
  if (fill > 0) {
    const grad = g.createLinearGradient(x0, 0, x0 + sw, 0);
    for (let k = 0; k <= 6; k++) grad.addColorStop(k / 6, `hsl(${(k * 55 + (S.rainbow > 0 ? ctx.time * 400 : 0)) % 360},100%,60%)`);
    g.fillStyle = grad; g.beginPath(); g.roundRect(x0, my, Math.max(mh, sw * fill), mh, mh / 2); g.fill();
  }
  g.font = font(mh * 0.8); g.fillStyle = '#fff'; g.textAlign = 'left';
  g.fillText(S.rainbow > 0 ? '🌈 RAINBOW!' : S.combo > 1 && ctx.time - S.lastBonk < 2.5 ? `×${S.combo} combo` : '🌈', x0 + 8, my + mh / 2 + 1);
  // the wrecking charge meter
  const cy = my + mh + 6;
  pill(g, x0, cy, sw, mh, 'rgba(0,0,0,.45)', null);
  if (S.charge > 0) { g.fillStyle = S.charged ? `hsl(${25 + Math.sin(ctx.time * 10) * 10},100%,60%)` : '#ff8a3d'; g.beginPath(); g.roundRect(x0, cy, Math.max(mh, sw * S.charge), mh, mh / 2); g.fill(); }
  g.fillStyle = '#fff'; g.fillText(S.charged ? '🟠 WRECKING ROLL!' : '🟠 crouch to charge', x0 + 8, cy + mh / 2 + 1);
  const best = bests[bestKey()];
  if (best) { g.font = font(mh * 0.75, 800); g.fillStyle = S.score > best ? '#7dff6a' : '#fff'; g.fillText(`⭐ ${fmt(best)}${S.score > best ? ' BEATEN!' : ''}`, x0 + 6, cy + mh * 1.9); }

  // the book icon (right, under the 🔧) with the sticker count
  const bp = bookIconPos(), br = Math.max(40, u * 0.07);
  const bounce = S.flyers.length ? 1 + Math.sin(ctx.time * 20) * 0.08 : 1;
  g.save(); g.translate(bp.x, bp.y); g.scale(bounce, bounce);
  g.fillStyle = 'rgba(27,17,64,.7)'; g.beginPath(); g.arc(0, 0, br * 0.75, 0, Math.PI * 2); g.fill();
  g.font = `${br * 0.8}px sans-serif`; g.textAlign = 'center'; g.fillText('📖', 0, 2);
  g.restore();
  g.font = font(br * 0.32); g.fillStyle = '#fff'; g.textAlign = 'center';
  g.fillText(fmt(col.count), bp.x, bp.y + br * 0.95);

  g.font = font(u * 0.028, 700); g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right';
  g.fillText(`v${ctx.release}`, W - 10, H - 14);
  if (S.phase === 'play' && ctx.body().zone === 'too-close') { g.font = font(u * 0.045); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('👣 Step back! 👣', W / 2, H - u * 0.17); }
  if (S.away && S.phase === 'play') { g.font = font(u * 0.04); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⏸ waiting for you!', W / 2, ty + th + u * 0.08); }
}

// big words in the TOP band only (the path ahead stays clear)
function drawBanners(g) {
  const { W } = ctx;
  const u = Math.min(W, ctx.H);
  const top = 16 + Math.min(u * 0.075, 46) + u * 0.07;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = top + u * 0.03;
  for (const b of S.banners) {
    const k = b.t / b.life, pop = b.t < 0.2 ? 0.6 + 2 * b.t : 1;
    g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    const size = (b.big ? u * 0.07 : u * 0.052) * pop;
    if (b.icon) { g.font = `${size * 1.6}px sans-serif`; g.fillText(b.icon, W / 2, y + size * 0.3); y += size * 1.5; }
    g.font = font(size); g.lineWidth = 7; g.strokeStyle = 'rgba(27,17,64,.85)';
    g.strokeText(b.text, W / 2, y); g.fillStyle = b.color; g.fillText(b.text, W / 2, y);
    if (b.sub) { g.font = font(size * 0.5, 800); g.lineWidth = 5; g.strokeText(b.sub, W / 2, y + size * 0.75); g.fillStyle = '#fff'; g.fillText(b.sub, W / 2, y + size * 0.75); }
    y += size * (b.sub ? 1.5 : 1.1);
  }
  g.globalAlpha = 1;
}

function drawFlyers(g) {
  const bp = bookIconPos(), u = Math.min(ctx.W, ctx.H);
  for (const f of S.flyers) {
    const k = f.t, e = k < 0.15 ? 0 : (k - 0.15) / 0.85, ee = e * e * (3 - 2 * e);
    const x = f.x + (bp.x - f.x) * ee, y = f.y - (1 - ee) * u * 0.06 * Math.sin(Math.PI * Math.min(1, k * 2)) + (bp.y - f.y) * ee;
    drawSticker(g, f.id, x, y, u * (k < 0.15 ? 0.02 + k * 0.1 : 0.035 * (1 - ee * 0.4)));
  }
}
