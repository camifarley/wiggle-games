// 07 · Space Pilot v1.0 "Rescue Run!": you ARE the space pilot. Bad-guy aliens have caught the friendly aliens
// in bubble cages; zap the bad guys into cube showers (their pilots pop out in escape pods) and tractor-beam the
// good guys aboard into the Alien Passport. Ends with boss #1, Captain Clank's CRAB-TANK, and a score card.
// Brief: docs/briefs/07-space-pilot.md (v1.0 = §A–§K); progress: docs/briefs/07-space-pilot.progress.md.
//
// Body: lean steers AND aims (lasers auto-fire with aim assist), punch = double blast (bonus), jump =
// hyperspace hop, crouch = duck, spin = barrel roll (starts on the half-turn), waving hands = windshield
// wipers. Nothing ever gets hurt and nothing ends a mission early.
//
// Test keys (with ?debug or test controls on): 1 spawn wave · 2 free all cages · 3 jump to the boss ·
// 4 boss next phase · 5 end mission · 6 slime on the glass · 7 wipe · 8 duck asteroid · 9 passport.
// Core test controls: ← → lean, Space hop, ↓ duck, S spin (barrel roll), Enter punch, [ ] speed.

import { createWorld3D, DESIGN_KEYS, BAD_COLORS } from './world3d.js';
import { randomRecipe, recipeName, rarity, parseId } from './recipes.js';
import { loadPassport, passportStats, createPassport, friendEl } from './passport.js';
import { loadTuning, applyCore } from './settings.js';
import { createTuning } from './tuning.js';
import { MUSIC } from '../../../core/music-picks.js';
import * as hud from './hud.js';
import { createDuckLatch } from '../../../core/duck.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const fake = params.has('fakecam');
const pick = (a) => a[(Math.random() * a.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => k * k * (3 - 2 * k);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const rnd = {
  pick, chance: (p) => Math.random() < p,
  weighted(arr, w = arr.map((x) => x.w)) { let k = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { k -= w[i]; if (k < 0) return arr[i]; } return arr[arr.length - 1]; },
};
const MISSION = 'Rescue Run';
const HOLD_Z = -25, WAVE_EVERY = 12, PX_MAX = 12, BOSS_Z = -27;
const TRACK = MUSIC['07-space-pilot'] ? null : 'gen:zoom:7';
const BOSS_TRACK = MUSIC['07-space-pilot-boss'] || 'gen:downhill:3';

let ctx, S, W3, set, tuning, panel, passport, passUI, ui, onKey, game;

const ZAP_WORDS = ['ZAP!', 'POW!', 'BLIP!', 'ZOINK!', 'KA-ZAP!'];
// aliens and friends never speak real words (v1.1): gibberish only
const POD_WORDS = ['Bleep!', 'Blorp!', 'Eep!', 'Grr!', 'Zibba!', 'Bwah!'];

function freshMission() {
  return {
    phase: 'intro', phaseT: 0, missionT: 0, missionLen: set.missionLength, lastCount: 99,
    px: 0, vx: 0, py: 0, speed: 22, aimX: 0, aimY: 0, lock: null, lockT: 0, gun: 0, fireCool: 0, idleCool: 0,
    bolts: [], enemies: [], formations: [], cages: [], friends: [], pods: [], rocks: [], goos: [],
    slime: [], boops: [], cracks: [], banners: [], pops: [], flyers: [], beam: null,
    dizzyT: 0, spinGuard: 0, slow: 1, talk: null, onLine: null, babble: [], talkAt: {}, thanks: [], thanksBabbleAt: -9,
    tutor: { cur: null, done: {}, shownAt: {}, lastAny: -99, queue: [] }, hop: 0, duck: 0, shake: 0, rattle: 0, wipe: 0, wipeCool: 0,
    shields: 3, shieldT: 0, cue: null,
    score: 0, shown: 0, combo: 0, lastZap: -9, best: 0,
    waveIndex: 0, nextWaveAt: 0.5, nextSwoopAt: 4, nextRockAt: 7, duckAts: [], boss: null, cargo: [],
    rounds: [], round: null, roundI: -1, roundGap: 1.5, swoopsOn: false, slimeRound: null, streaks: [], goober: null,
    away: false, nextId: 1, giggleT: 0,
    stats: {
      zapped: 0, rescued: 0, rescuedWaves: 0, offered: 0, carriedOff: 0, rescuedIds: [], newFriends: [], boops: 0, rolls: 0, halfRolls: 0,
      hops: 0, ducks: 0, ducked: 0, duckWaited: 0, floatedOver: 0, duckLog: [], punches: 0, wipes: 0, dodges: 0, hits: 0, rollZaps: 0, leaves: 0, waves: 0,
      bossDefeated: false, bossTime: 0, steer: { left: 0, right: 0, straight: 0, arms: 0, lean: 0, maxAbs: 0, leans: 0 },
    },
  };
}

// ---------- helpers ----------
let saidAt = {};
function sayMaybe(text, { gap = 4, key = text, interrupt = false, chance = 1 } = {}) {
  if (Math.random() > chance || ctx.time - (saidAt[key] ?? -99) < gap) return;
  saidAt[key] = ctx.time;
  ctx.say(text, { interrupt });
}
// big words live in the TOP-RIGHT corner only. key: same key updates in place (RESCUED! ×3)
function banner(text, { sub = '', color = '#ffcc33', life = 2, key = null, big = false } = {}) {
  const same = key && S.banners.find((b) => b.key === key && b.t < b.life - 0.2);
  if (same) { Object.assign(same, { text, sub, color, life: Math.max(life, same.t + 1.2) }); return; }
  S.banners = S.banners.filter((b) => b.t < b.life - 0.3).slice(-2);
  S.banners.push({ text, sub, color, life, t: 0, key, big });
}
function pop(x, y, word, { text = '', color = '#ffffff', small = false } = {}) {
  if (S.pops.length > 14) S.pops.shift();
  S.pops.push({ x, y, word, text, color, t: 0, small });
}
function addScore(n) { S.score += n; }
const W = () => ctx.W, H = () => ctx.H;
const shipPos = () => ({ x: S.px, y: S.py - 1.3, z: -1.6 });
const particles = () => ctx.perf.settings.particles;
const pace = () => set.alienSpeed * set.pace; // v1.1: 🔧 Game pace scales every alien and rock speed
const objScale = () => set.objectSize;
const isLow = () => ctx.perf.tier.name === 'low';

function setPhase(p) { S.phase = p; S.phaseT = 0; S.lastCount = 99; }

// ---------- missions ----------

function startMission() {
  for (const e of S?.enemies || []) W3.remove(e.mesh);
  for (const c of S?.cages || []) W3.remove(c.mesh);
  for (const f of S?.friends || []) W3.remove(f.mesh);
  for (const p of S?.pods || []) W3.remove(p.mesh);
  for (const r of S?.rocks || []) W3.remove(r.mesh);
  for (const g of S?.goos || []) W3.remove(g.mesh);
  if (S?.boss) W3.remove(S.boss.mesh);
  if (S?.goober) W3.remove(S.goober.mesh);
  S = freshMission();
  // v1.1 round 2: a gentle ramp of rounds, each adding ONE thing (see buildRounds)
  S.rounds = buildRounds();
  S.duckLatch = createDuckLatch({ duckDown: set.duckDepth });
  hideScore();
  if (passUI?.isOpen) passUI.close();
  banner('🚀 RESCUE RUN!', { sub: 'Sector 1', color: '#5ee0ff', life: 3.5, big: true });
  ctx.say("Captain! The bad guys caught our friends in bubbles! Lean to fly. Your lasers zap all by themselves! Ready?");
  ctx.recorder.event('mission', { mission: MISSION, length: S.missionLen });
  if (TRACK) ctx.music.play(TRACK);
  if (debugOn) window.wiggle.game = S;
}

function endMission() {
  if (S.phase === 'end') return;
  setPhase('end');
  S.cue = null;
  const st = S.stats;
  S.stars = starsFor();
  ctx.music.jingle('win');
  ctx.sfx.play('win');
  ctx.fx.confetti(160);
  const nf = st.newFriends.length;
  ctx.say(`Mission complete! You rescued ${st.rescued} friends!${nf ? ` And ${nf} new friends for your passport!` : ''}`);
  ctx.recorder.event('end', { score: Math.round(S.score), rescued: st.rescued, zapped: st.zapped, newFriends: nf, stars: S.stars, boss: st.bossDefeated });
  showScore();
}

// stars come from the friends he freed himself during the waves (the boss frees the rest)
function starsFor() {
  const st = S.stats;
  const k = st.offered ? st.rescuedWaves / st.offered : 1;
  return k >= 0.8 ? 3 : k >= 0.45 ? 2 : 1;
}

// ---------- spawning ----------

function newFriendRecipe(opts) { return `${Object.values(randomRecipe(rnd, opts)).join('.')}`; }

function makeFriendEntity(id, x, y, z, state = 'caged') {
  const mesh = W3.add(W3.makeFriend(id));
  mesh.scale.multiplyScalar(objScale());
  const f = { id, mesh, state, t: 0, x, y, z, vx: 0, vy: 0, uid: S.nextId++ };
  mesh.position.set(x, y, z);
  S.friends.push(f);
  return f;
}

function makeCageEntity(carrier, x, y, z, friendId) {
  const mesh = W3.add(W3.makeCage());
  const c = { mesh, carrier, x, y, z, state: carrier ? 'carried' : 'loose', t: 0, hp: 3, uid: S.nextId++ };
  c.friend = makeFriendEntity(friendId, x, y, z, 'caged');
  c.friend.mesh.scale.multiplyScalar(0.85);
  mesh.position.set(x, y, z);
  S.cages.push(c);
  if (S.phase === 'waves' || S.phase === 'intro') S.stats.offered++; // stars count the wave friends
  return c;
}

function spawnWave(count) {
  const n = Math.max(1, Math.round(count ?? (isLow() ? Math.min(set.formationSize, 6) : set.formationSize)));
  const cols = n <= 2 ? n : Math.ceil(n / 2);
  const design = DESIGN_KEYS[S.waveIndex % DESIGN_KEYS.length];
  const color = BAD_COLORS[S.waveIndex % BAD_COLORS.length];
  const F = { id: S.nextId++, cx0: clamp(S.px + rand(-5, 5), -9, 9), cy: rand(0.4, 1.6), t: 0, members: [], cols, leaving: false };
  const carriers = n >= 4 ? 2 : 1;
  const carrierSlots = new Set();
  const lowRow = n > cols ? cols : 0; // the bottom row carries cages (a single row: anyone)
  while (carrierSlots.size < carriers) carrierSlots.add(lowRow + Math.floor(Math.random() * (n - lowRow)));
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = n <= cols ? 0.5 : i < cols ? 1 : 0;
    const d = Math.random() < 0.25 ? pick(DESIGN_KEYS) : design;
    const mesh = W3.add(W3.makeBadGuy(d, color));
    const e = { uid: S.nextId++, mesh, design: d, color, F, col: col - (cols - 1) / 2, row, state: 'arrive', t: 0, hp: 1, x: F.cx0, y: F.cy, z: -150, wob: Math.random() * 6 };
    if (carrierSlots.has(i)) { e.carrier = true; e.hp = 2; e.cage = makeCageEntity(e, e.x, e.y - 3, e.z, newFriendRecipe()); }
    mesh.position.set(e.x, e.y, e.z);
    F.members.push(e);
    S.enemies.push(e);
  }
  S.formations.push(F);
  S.waveIndex++;
  S.onLine = { who: 'alien', design, color };
  talk('alien', 'taunt', { design, color });
  S.stats.waves++;
  if (S.waveIndex === 1) sayMaybe('Here they come! Zap the bad guys, free the friends!', { key: 'wave1' });
  else sayMaybe(pick(['More bad guys!', 'Here comes another bunch!', 'Bad guys ahead!']), { gap: 8, key: 'wave' });
  ctx.recorder.event('wave', { n, carriers, design });
}

function spawnRock(kind = 'friend') {
  if (kind === 'duck') {
    if (S.rocks.some((r) => r.kind === 'duck' && !r.dead)) return; // one duck window at a time
    const mesh = W3.add(W3.makeAsteroid(4.2));
    const practice = !S.stats.duckLog.length && !S.rocks.some((r) => r.kind === 'duck');
    mesh.scale.multiplyScalar(objScale());
    S.rocks.push({ kind, mesh, x: S.px, y: 2.4, z: -140, vz: (practice ? 26 : 40) * pace(), hp: 99, t: 0, warned: false, practice, uid: S.nextId++ });
    return;
  }
  const mesh = W3.add(W3.makeAsteroid(1.8));
  const r = { kind, mesh, x: clamp(S.px + rand(-6, 6), -10, 10), y: rand(-1.2, 0.8), z: -130, vz: 0, hp: 3, t: 0, uid: S.nextId++ };
  r.friend = makeFriendEntity(newFriendRecipe(), r.x, r.y + 2.2, r.z, 'stranded');
  S.stats.offered++;
  S.rocks.push(r);
  sayMaybe(pick(['A friend is stuck on that rock!', 'Look! A friend on an asteroid!']), { gap: 10, key: 'rock' });
}

// ---------- zapping ----------

function comboMult() { return 1 + Math.min(4, Math.floor(S.combo / 3)); }

function zapEnemy(e, how = 'laser') {
  if (e.dead) return;
  e.dead = true;
  S.combo = ctx.time - S.lastZap < 1.8 ? S.combo + 1 : 1;
  S.lastZap = ctx.time;
  const dz = e.dizzy > 0; // dizzy bad guys are worth double
  const mult = comboMult() * (dz ? 2 : 1);
  const pts = 100 * mult;
  addScore(pts);
  S.stats.zapped++;
  if (dz) S.stats.rollZaps++;
  const close = e.z > -12;
  const n = Math.round((close ? 46 : 28) * particles());
  W3.debris(e.x, e.y, e.z, { count: n, colors: [e.color, e.color, '#ffffff', '#ffe14d', '#ff5ea8'], speed: close ? 9 : 7, size: close ? 0.32 : 0.26 });
  ctx.sfx.play('cubes', { vol: close ? 1 : 0.75 });
  if (close) { ctx.fx.shake(6); S.shake = Math.max(S.shake, 0.25); }
  const p = W3.screenOf(e.mesh, W(), H(), 1);
  if (!p.behind) {
    pop(p.x, p.y, pick(ZAP_WORDS), { text: `+${pts}`, color: mult > 1 ? '#ffe14d' : '#ffffff', small: !close });
    ctx.fx.burst(p.x, p.y, { count: Math.round(12 * particles()), speed: 360, size: 6, color: e.color });
  }
  // the pilot always escapes
  const pm = W3.add(W3.makePod(e.color));
  pm.position.set(e.x, e.y, e.z);
  const side = e.x >= S.px ? 1 : -1;
  S.pods.push({ mesh: pm, x: e.x, y: e.y, z: e.z, vx: side * rand(3, 6), vy: rand(2.5, 5), vz: -rand(3, 8), t: 0, said: Math.random() < 0.3 });
  W3.remove(e.mesh);
  if (e.cage && e.cage.state === 'carried') { e.cage.state = 'loose'; e.cage.t = 0; e.cage.carrier = null; }
  if (S.combo > 0 && S.combo % 5 === 0) { banner(`×${comboMult()} COMBO!`, { color: '#ff5ea8', life: 1.4, key: 'combo' }); sayMaybe(`${S.combo} in a row!`, { gap: 3, key: 'combo' }); }
  ctx.recorder.event('zap', { design: e.design, how, pts, combo: S.combo, state: e.state, carrier: !!e.carrier });
}

function popCage(c, how = 'laser') {
  if (c.state === 'popped') return;
  if (S.round?.kind === 'friend') tutorDone('lean');
  c.state = 'popped';
  W3.debris(c.x, c.y, c.z, { count: Math.round(18 * particles()), colors: ['#bff4ff', '#ffffff', '#7fe8ff'], speed: 5, size: 0.18 });
  ctx.sfx.pop();
  W3.remove(c.mesh);
  if (c.carrier && !c.carrier.dead) { c.carrier.cage = null; c.carrier.carrier = false; c.carrier.hp = 1; }
  freeFriend(c.friend);
  ctx.recorder.event('cage', { how });
}

function freeFriend(f) {
  if (!f || (f.state !== 'caged' && f.state !== 'stranded' && f.state !== 'cargo')) return;
  if (f.state === 'caged') f.mesh.scale.multiplyScalar(1 / 0.85);
  f.state = 'free'; f.t = 0;
  f.vx = 0; f.vy = 0.6;
  ctx.sfx.squeak(1.4);
  const p = W3.screenOf(f.mesh, W(), H(), 1);
  if (!p.behind) pop(p.x, p.y - p.r, pick(['Yippa!', 'Weeboo!', 'Boop-boop!', 'Wheee!']), { color: '#5ee0ff' });
  sayMaybe(pick(['Yay! Beam it aboard!', 'Free! Here comes the tractor beam!', 'You freed a friend!']), { gap: 5, key: 'free' });
}

function hitRock(r) {
  r.hp--;
  W3.debris(r.x, r.y, r.z, { count: Math.round(6 * particles()), colors: ['#8a7a9a', '#c8b8d8'], speed: 4, size: 0.2 });
  if (r.hp > 0) { ctx.sfx.play('bonk', { vol: 0.4 }); return; }
  breakRock(r);
}
function breakRock(r) {
  if (r.dead) return;
  r.dead = true;
  W3.debris(r.x, r.y, r.z, { count: Math.round(30 * particles()), colors: ['#8a7a9a', '#9a8a7a', '#c8b8d8', '#ffffff'], speed: 7, size: 0.35 });
  ctx.sfx.play('smash', { vol: 0.8 });
  W3.remove(r.mesh);
  addScore(150);
  freeFriend(r.friend);
}

// ---------- rescue ----------

function rescue(f) {
  const sp = W3.screenOf(f.mesh, W(), H(), 1); // where it was, for the fly-in
  f.state = 'done';
  W3.remove(f.mesh);
  const st = S.stats;
  st.rescued++;
  if (S.phase === 'waves' || S.phase === 'intro') st.rescuedWaves++;
  st.rescuedIds.push(f.id);
  addScore(500);
  const isNew = passport.add(f.id, { m: MISSION });
  const tier = rarity(f.id);
  banner(st.rescued > 1 ? `RESCUED! ×${st.rescued}` : 'RESCUED!', { color: '#5ee0ff', life: 1.8, key: 'rescued' });
  ctx.sfx.play('collect');
  ctx.sfx.tone(1320, 0.1, 'triangle', 0.1);
  setTimeout(() => ctx && ctx.sfx.tone(1760, 0.12, 'triangle', 0.1), 110); // boop-boop!
  if (isNew) {
    st.newFriends.push(f.id);
    banner('NEW FRIEND!', { sub: recipeName(f.id), color: tier === 'golden' ? '#ffd23f' : tier === 'rare' ? '#d9c2ff' : '#7dff6a', life: 2.4, key: 'new' });
  }
  if (tier === 'golden') { addScore(2000); ctx.fx.confetti(200); ctx.sfx.play('powerup'); ctx.say(`A golden friend! ${recipeName(f.id)}!`); }
  else if (isNew && tier === 'rare') sayMaybe(`Wow! A ${recipeName(f.id)}!`, { gap: 5, key: 'rare' });
  else if (isNew) sayMaybe(`New friend! ${recipeName(f.id)}!`, { gap: 6, key: 'newname', chance: 0.6 });
  else sayMaybe(pick(['Rescued!', 'Welcome aboard!', 'Got one!']), { gap: 4, key: 'rescue' });
  // v1.1: it zips across the screen into the Friends Aboard panel (trail + whoosh), lands with a pop, then waves
  ctx.sfx.whoosh();
  const sx = sp.behind ? ctx.W / 2 : clamp(sp.x, 0, ctx.W), sy = sp.behind ? ctx.H * 0.62 : clamp(sp.y, 0, ctx.H);
  if (S.flyers.length < 10) S.flyers.push({ id: f.id, x: sx, y: sy, t: 0, dur: 0.9 });
  else landFriend(f.id);
  ctx.recorder.event('rescue', { id: f.id, isNew, tier, phase: S.phase });
}

// ---------- the ship ----------

function updateShip(dt) {
  const st = ctx.gestures.steer;
  const flying = S.phase !== 'end' && !(S.phase === 'intro' && S.phaseT < 2);
  const lean = flying ? st.value : 0;
  // ship slides sideways with the lean (soft walls), banks, and the crosshair leads the turn
  const want = lean * set.steerSpeed;
  S.vx += (want - S.vx) * Math.min(1, dt * 4);
  S.px += S.vx * dt;
  if (Math.abs(S.px) > PX_MAX) { S.px = Math.sign(S.px) * PX_MAX; S.vx *= -0.3; }
  // crouch = duck (the camera drops), smoothed
  const dip = clamp((-ctx.gestures.height - 0.6) / 1.4, 0, 1); // a gentle head dip lowers the view a little too
  S.duckShow = Math.max(0, (S.duckShow || 0) - dt);
  const duckTarget = !flying ? 0 : Math.max(ctx.gestures.crouching ? 1 : 0, dip * 0.8, S.duckShow > 0 ? 1 : 0);
  S.duck += (duckTarget - S.duck) * Math.min(1, dt * 7);
  S.py = -1.3 * S.duck;
  // thrusters (run in place): speed + star streaks
  const run = ctx.gestures.run.intensity;
  const target = 22 + run * 30 + (S.hop > 0 ? 120 : 0) + (S.phase === 'bossIntro' ? 10 : 0);
  S.speed += (target - S.speed) * Math.min(1, dt * 3);
  S.hop = Math.max(0, S.hop - dt);
  S.shake = Math.max(0, S.shake - dt);
  S.rattle = Math.max(0, S.rattle - dt);
  // shields recharge (drama only)
  if (S.shields < 3) { S.shieldT += dt; if (S.shieldT > 5) { S.shieldT = 0; S.shields++; ctx.sfx.play('shield', { vol: 0.5 }); } }
}

// ---------- dizzy spin (v1.1): HE spins, the BAD GUYS get dizzy ----------
// v1.0's barrel roll rotated the whole view, which made a grown-up tester queasy. Now the screen never rotates:
// a half turn (`turn`) makes every bad guy in view dizzy (spinning, wobbly, stars round their heads, slower,
// easier to catch, no booping); finishing the spin (`spin`) makes it a bigger, longer DIZZY SPIN.

function dizzySpin(source = 'turn') {
  if (S.phase === 'end' || S.phase === 'intro') return;
  const full = source === 'spin';
  const extending = S.dizzyT > 0;
  if (extending && !full) return; // the same spin's half turn again
  const dur = full ? 6 : 4;
  S.dizzyT = Math.max(S.dizzyT, dur);
  S.spinGuard = 1.5;
  let n = 0;
  for (const e of S.enemies) {
    if (e.dead || e.gone || e.state === 'leave' || e.state === 'arrive' || e.z < -70) continue;
    if (!(e.dizzy > 0)) n++;
    e.dizzy = Math.max(e.dizzy || 0, dur);
    e.hp = 1;
    if (e.state === 'boop') { e.state = 'hover'; e.t = 0; }
  }
  const B = S.boss;
  if (B && S.phase === 'boss') {
    B.dizzy = Math.max(B.dizzy || 0, dur);
    if (B.attack && B.attack.kind !== 'goo') { B.attack = null; S.cue = null; B.nextAttack = Math.max(B.nextAttack, dur); }
    talk('crab', 'dizzy');
  }
  if (!extending || full) {
    S.stats.rolls++;
    addScore(full ? 500 : 200);
    banner(full ? '🌀 DIZZY SPIN! +500' : '🌀 DIZZY!', { color: '#b48cff', life: 2, key: 'dizzy' });
    ctx.sfx.whoosh();
    for (let k = 0; k < 5; k++) ctx.sfx.tone(700 - k * 90, 0.09, 'triangle', 0.08); // a wobbly "woo-woo-woo"
    sayMaybe(pick(['You made them dizzy!', 'Spin spin! The bad guys are dizzy!', 'Dizzy aliens! Zap them!']), { gap: 4, key: 'dizzy' });
    tutorDone('spin');
  }
  ctx.recorder.event('dizzy', { source, n, boss: !!(B && S.phase === 'boss') });
}

function landFriend(id) {
  S.thanks.unshift({ id, t: 0 });
  if (S.thanks.length > 3) S.thanks.length = 3; // the oldest slides out
  ctx.sfx.pop();
  if (ctx.time - S.thanksBabbleAt > 0.7) { S.thanksBabbleAt = ctx.time; ctx.sfx.babble(pick(['Weeboo! Bibbi-oo!', 'Yippa yippa yoo!', 'Boop-boop, bibbi!', 'Tee-hee, mwah!']), { voice: 'friend', vol: set.voiceVol, pitch: 0.9 + Math.random() * 0.3 }); }
}

function updateDizzy(dt) {
  S.slow = 1;
  S.dizzyT = Math.max(0, S.dizzyT - dt);
  S.spinGuard = Math.max(0, S.spinGuard - dt);
  for (const e of S.enemies) if (e.dizzy > 0) e.dizzy -= dt;
  if (S.boss && S.boss.dizzy > 0) S.boss.dizzy -= dt;
}
const rolling = () => S.spinGuard > 0; // a spin also dodges (the dizzy alien misses)

// ---------- "on the line": the bad-guy view under the comms screen (v1.1) ----------
// Whoever is on the line (the current wave's alien, or Captain Clank during the boss) talks GIBBERISH: a speech
// bubble with squiggles + "blah blah BLAH… BAH!" and a gibberish voice (core ctx.sfx.babble on its own voice bus; the parent's volume
// mute applies). Never ctx.say for aliens. The big "BAH!" lands with a comic bonk.
const LINES = {
  taunt: ['Blah blah BLAH… BAH!', 'Zib zab zoo… BAH!', 'Nyeh nyeh NYEH!', 'Blorp blorp… BAH!', 'Gibba gabba… BAH!'],
  hit: ['BWAH?! Blah blah!', 'Grr-blah! BAH!', 'Klonk?! Blub blub!', 'Nyaa! BAH BAH!'],
  spit: ['Ptoo! Blah!', 'Blub-a-blub… PTOO!'],
  dizzy: ['Wooo… blah… bah…?', 'Bwuh? Wibble wobble…'],
  phase: ['BAH! BAH! BAH!', 'Blah blah BLAAAH!', 'Grrr… BAH!'],
  defeat: ['Bwah… blub… blah… bah…', 'Pffft… blah… BAH…'],
};
const TALK_GAP = { taunt: 6, hit: 3.5, spit: 5, dizzy: 4, phase: 0, defeat: 0 };

function talk(who, mood, e) {
  if (!S || S.phase === 'end') return;
  const gap = TALK_GAP[mood] ?? 4;
  if (ctx.time - (S.talkAt[mood] ?? -99) < gap) return;
  if (S.talk && S.talk.t < S.talk.dur && gap > 0 && S.talk.mood !== 'taunt') return; // let a line finish
  S.talkAt[mood] = ctx.time;
  if (who === 'alien' && e) S.onLine = { who, design: e.design, color: e.color };
  if (who === 'crab') S.onLine = { who: 'crab' };
  const text = pick(LINES[mood]);
  const crab = who === 'crab';
  // v1.1 round 2: a real gibberish VOICE (core sfx.babble: formant syllables on its own bus, music ducked)
  const len = ctx.sfx.babble(text, { voice: crab ? 'crab' : 'alien', vol: set.voiceVol, pitch: crab ? 1 : 0.9 + Math.random() * 0.3 });
  S.talk = { who, mood, text, t: 0, dur: Math.max(0.8, len + 0.3) };
  if (crab && S.boss && (mood === 'hit' || mood === 'phase' || mood === 'taunt')) S.boss.tantrum = Math.max(S.boss.tantrum || 0, mood === 'hit' ? 1.2 : 2);
}

// ---------- move tutor (v1.1): one move at a time, with a big pictogram next to the comms screen ----------
const MOVES = {
  lean: { icon: '↔️', word: 'LEAN!', line: 'Lean left and right to fly and aim!' },
  punch: { icon: '👊', word: 'PUNCH!', line: 'Punch the air for a double blast!' },
  jump: { icon: '🦘', word: 'JUMP!', line: 'Jump for a hyperspace hop!' },
  spin: { icon: '🌀', word: 'SPIN!', line: 'Spin all the way around to make the bad guys dizzy!' },
  arms: { icon: '✈️', word: 'ARMS OUT!', line: 'Put your arms out like an airplane to fly!' },
  duck: { icon: '⬇️', word: 'DUCK!', line: 'Duck down! Bend your knees!' },
  stepback: { icon: '👣', word: 'STEP BACK!', line: 'Step back a little so I can see your head and shoulders!' },
  wave: { icon: '👋', word: 'WAVE!', line: 'Wave your hands over the slime to wipe it!' },
};
// v1.1: DUCK is taught first, with a slow practice rock at 2 s (see S.duckAts)
// v1.1 round 2: each move arrives with its own round (buildRounds); no clock schedule any more
const TUTOR_SHOW = 4.5;

function tutorPrompt(move, { force = false } = {}) {
  const T = S.tutor;
  if (!force && T.done[move]) return;
  if (T.cur && T.cur.t < TUTOR_SHOW) { if (!T.queue.includes(move) && T.cur.move !== move) T.queue.push(move); return; }
  T.cur = { move, t: 0 };
  T.shownAt[move] = ctx.time; T.lastAny = ctx.time;
  if (move !== 'duck') sayMaybe(MOVES[move].line, { gap: 6, key: `tutor-${move}` }); // the duck cue speaks for itself
  ctx.recorder.event('tutor', { move });
}
function tutorDone(move) {
  const T = S.tutor;
  if (!T || T.done[move]) return;
  T.done[move] = ctx.time;
  if (T.cur && T.cur.move === move) T.cur.yes = 0.9; // a quick ✓ YES! then it hides
}
function updateTutor(dt) {
  const T = S.tutor;
  if (T.cur) {
    T.cur.t += dt;
    if (T.cur.yes != null) { T.cur.yes -= dt; if (T.cur.yes <= 0) T.cur = null; }
    else if (T.cur.t > TUTOR_SHOW) T.cur = null;
  }
  if (!T.cur && T.queue.length) tutorPrompt(T.queue.shift());
  if (S.phase !== 'waves' && S.phase !== 'boss') return;
  if (ctx.gestures.steer.mode === 'arms') tutorDone('arms');
  // re-prompt a move he hasn't tried yet, now and then
  if (!T.cur && ctx.time - T.lastAny > 22) {
    const todo = Object.keys(T.shownAt).filter((m) => !T.done[m] && m !== 'wave' && m !== 'duck' && m !== 'stepback');
    if (todo.length) tutorPrompt(todo.sort((a, b) => T.shownAt[a] - T.shownAt[b])[0]);
    else T.lastAny = ctx.time;
  }
}

// ---------- aiming + lasers ----------

function collectTargets() {
  const out = [];
  const w = W(), h = H();
  const add = (kind, ref, mesh, radius, z) => {
    const p = W3.screenOf(mesh, w, h, radius);
    if (p.behind || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) return;
    out.push({ kind, ref, x: p.x, y: p.y, r: Math.max(8, p.r), z });
  };
  for (const e of S.enemies) if (!e.dead && e.state !== 'arrive' && e.state !== 'leave' && e.state !== 'boop' && e.z > -80) add('enemy', e, e.mesh, (e.dizzy > 0 ? 2.8 : 2) * objScale(), e.z);
  for (const c of S.cages) if ((c.state === 'carried' && c.carrier?.state === 'dance') || c.state === 'loose' || c.state === 'float') add('cage', c, c.mesh, 1.3 * objScale(), c.z);
  for (const r of S.rocks) if (!r.dead && r.kind === 'friend' && r.z > -80) add('rock', r, r.mesh, 1.8, r.z);
  const wk = S.boss && S.phase === 'boss' ? weakPoint() : null;
  // the weak point is guarded while a snap or a charge winds up (dodge first, then zap)
  const guarded = S.boss?.attack && S.boss.attack.kind !== 'goo';
  if (wk && !S.boss.pause && !guarded && !S.boss.swap) add('weak', S.boss, wk, 1.6 * objScale(), BOSS_Z);
  return out;
}

function updateAim(dt, targets) {
  const w = W(), h = H(), u = Math.min(w, h);
  const st = ctx.gestures.steer;
  const flying = S.phase !== 'end';
  const baseX = w / 2 + (flying ? st.value : 0) * w * 0.2;
  const baseY = h * 0.46 + S.duck * h * 0.04;
  const Ra = u * (0.04 + 0.2 * set.aimAssist) * (S.phase === 'boss' ? 1.5 : 1);
  let best = null, bestScore = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - baseX, t.y - baseY) - t.r * 0.8;
    if (d > Ra) continue;
    const sc = d - (t.z + 80) * 0.6 - (t.kind === 'weak' ? 60 : 0) - (t.kind === 'goo' ? 40 : 0) + (t.kind === 'cage' ? 30 : 0) - (t.ref === S.lock?.ref ? 25 : 0);
    if (sc < bestScore) { bestScore = sc; best = t; }
  }
  S.lock = best;
  // the crosshair is pulled toward the locked target (that's the "magnet" of the aim assist)
  const tx = best ? baseX + (best.x - baseX) * (0.35 + 0.5 * set.aimAssist) : baseX;
  const ty = best ? baseY + (best.y - baseY) * (0.35 + 0.5 * set.aimAssist) : baseY;
  if (!S.aimX) { S.aimX = tx; S.aimY = ty; }
  S.aimX += (tx - S.aimX) * Math.min(1, dt * 12);
  S.aimY += (ty - S.aimY) * Math.min(1, dt * 12);
  S.lockT = best ? S.lockT + dt : 0;
}

function gunPos(side) { return { x: ctx.W * (side < 0 ? 0.22 : 0.78), y: ctx.H - hud.dashHeight(ctx) - 6 }; }

function fire(dt) {
  if (S.phase === 'end' || S.phase === 'bossDown' || (S.phase === 'intro' && S.phaseT < 4.2) || S.away) return;
  S.fireCool -= dt; S.idleCool -= dt;
  if (S.lock && S.fireCool <= 0) {
    S.fireCool = 1 / set.fireRate;
    S.gun = -S.gun || 1;
    shoot(S.gun, S.lock, { color: '#ff7ad9', dmg: 1 });
  } else if (!S.lock && S.idleCool <= 0 && S.phase !== 'bossIntro') {
    S.idleCool = 0.45;
    S.gun = -S.gun || 1;
    shoot(S.gun, null, { color: '#ff7ad9', dmg: 0 });
  }
}

function shoot(side, target, { color, dmg, twin = false }) {
  const g = gunPos(side);
  const tx = target ? target.x : S.aimX, ty = target ? target.y : S.aimY;
  S.bolts.push({ x0: g.x, y0: g.y, x1: tx, y1: ty, t: 0, dur: target ? 0.09 : 0.18, color, dmg, target, twin });
  ctx.sfx.play(twin ? 'sonic' : 'laser', { vol: twin ? 0.7 : 0.32, rate: 0.95 + Math.random() * 0.1 });
}

function updateBolts(dt) {
  for (const b of S.bolts) {
    b.t += dt;
    if (b.t >= b.dur && !b.hit) {
      b.hit = true;
      if (b.target && b.dmg > 0) applyHit(b.target, b.dmg);
      // lasers pass through friends harmlessly: they giggle
      for (const f of S.friends) {
        if (f.state !== 'free' || ctx.time < S.giggleT) continue;
        const p = W3.screenOf(f.mesh, W(), H(), 1);
        if (Math.hypot(p.x - b.x1, p.y - b.y1) < p.r * 1.4) { S.giggleT = ctx.time + 1.5; ctx.sfx.giggle(); pop(p.x, p.y - p.r, 'hee hee!', { color: '#ff9ad5', small: true }); }
      }
    }
  }
  S.bolts = S.bolts.filter((b) => b.t < b.dur + 0.08);
}

function applyHit(t, dmg) {
  const ref = t.ref;
  if (t.kind === 'enemy') {
    if (ref.dead) return;
    ref.hp -= dmg;
    ref.flash = 0.12;
    if (ref.hp <= 0) zapEnemy(ref);
    else ctx.sfx.play('bonk', { vol: 0.35 });
  } else if (t.kind === 'cage') {
    if (ref.state !== 'carried' && ref.state !== 'loose' && ref.state !== 'float') return;
    ref.hp -= dmg; ref.wob = 0.3;
    if (ref.hp <= 0) popCage(ref); else ctx.sfx.play('bonk', { vol: 0.3, rate: 1.6 });
  } else if (t.kind === 'rock') {
    if (!ref.dead) for (let k = 0; k < dmg; k++) if (!ref.dead) hitRock(ref);
  } else if (t.kind === 'goo') {
    if (!ref.dead) splatGoo(ref, true);
  } else if (t.kind === 'weak') {
    for (let k = 0; k < dmg * (ref.dizzy > 0 ? 2 : 1); k++) hitWeak(); // dizzy boss: double damage
  }
}

function doublBlast(e) {
  S.stats.punches++;
  panel?.mark('👊', '#5ee0ff');
  const targets = collectTargets().sort((a, b) => Math.hypot(a.x - S.aimX, a.y - S.aimY) - Math.hypot(b.x - S.aimX, b.y - S.aimY));
  const a = S.lock || targets[0] || null;
  const b2 = targets.find((t) => t !== a && t.ref !== a?.ref) || a;
  shoot(-1, a, { color: '#5ef2ff', dmg: 3, twin: true });
  shoot(1, b2, { color: '#5ef2ff', dmg: 3, twin: true });
  banner('👊 DOUBLE BLAST!', { color: '#5ef2ff', life: 1.2, key: 'punch' });
  sayMaybe(pick(['Double blast!', 'Pow pow!']), { gap: 4, key: 'punch' });
  ctx.recorder.event('blast', { hand: e?.hand || null });
}

// ---------- the waves ----------

function updateFormations(dt) {
  const spd = pace();
  for (const F of S.formations) {
    F.t += dt * spd;
    const live = F.members.filter((e) => !e.dead);
    const carriersLeft = live.some((e) => e.carrier);
    if (!F.leaving && (F.t > 19 || (!live.length && F.t > 1))) {
      F.leaving = true;
      for (const e of live) { e.state = 'leave'; e.t = 0; }
      if (carriersLeft) sayMaybe("They flew off with a friend! We'll get them at the boss!", { gap: 6, key: 'gotaway' });
    }
    if (!F.leaving && F.t > 13.5 && carriersLeft && !F.lastChance) { F.lastChance = true; sayMaybe('Zap the ones carrying bubbles!', { gap: 6, key: 'lastchance' }); }
  }
  S.formations = S.formations.filter((F) => F.members.some((e) => !e.dead && !e.gone));

  for (const e of S.enemies) {
    if (e.dead || e.gone) continue;
    const dizzy = e.dizzy > 0;
    e.t += dt * spd * (dizzy ? (e.state === 'hover' ? 0 : 0.4) : 1); // dizzy: slow, and swoopers forget to boop
    const F = e.F;
    const cx = F.cx0 + Math.sin(F.t * 0.35) * 4;
    const dx = cx + e.col * 4.3 + Math.sin(F.t * 1.3 + e.row) * 1.1;
    const dy = F.cy + (e.row - 0.5) * 3.6 + Math.sin(F.t * 2.6 + e.col) * 0.35 + (e.carrier ? 0.3 : 0);
    let hz = HOLD_Z;
    // last chance: carriers come closer and line up near the pilot
    if (e.carrier && F.lastChance && !F.leaving) hz = -17;
    if (e.state === 'arrive') {
      const k = Math.min(1, e.t / 3.5);
      e.x = dx; e.y = dy + (1 - k) * 6; e.z = -150 + (hz + 150) * ease(k);
      if (k >= 1) { e.state = 'dance'; e.t = 0; }
    } else if (e.state === 'dance') {
      const k = Math.min(1, dt * 2);
      e.x += ((e.carrier && F.lastChance ? S.px + e.col * 2 : dx) - e.x) * k; e.y += (dy - e.y) * k; e.z += (hz - e.z) * k;
    } else if (e.state === 'swoop') {
      const k = Math.min(1, e.t / 1.1), kk = ease(k);
      e.x = e.sx + (e.hx - e.sx) * kk + Math.sin(k * Math.PI) * 3 * e.arc;
      e.y = e.sy + (e.hy - e.sy) * kk + Math.sin(k * Math.PI) * 2;
      e.z = e.sz + (e.hz - e.sz) * kk;
      if (k >= 1) { e.state = 'hover'; e.t = 0; ctx.sfx.squeak(0.7 + Math.random() * 0.4); talk('alien', 'taunt', e); }
    } else if (e.state === 'hover') {
      // right up at the glass, wiggling and making faces
      e.x = e.hx + Math.sin(e.t * 5) * 0.4; e.y = e.hy + Math.sin(e.t * 7) * 0.25; e.z = e.hz;
      if (e.t > 2.1) { e.state = 'boop'; e.t = 0; e.bx = e.x; e.by = e.y; ctx.sfx.whoosh(); }
    } else if (e.state === 'boop') {
      const k = Math.min(1, e.t / 0.35);
      e.x = e.bx + (S.px - e.bx) * k; e.y = e.by + (S.py + 0.2 - e.by) * k; e.z = e.hz + (-0.9 - e.hz) * k;
      if (k >= 1) windshieldBoop(e);
    } else if (e.state === 'leave') {
      e.y += dt * 8; e.z -= dt * 40; e.x += Math.sign(e.x - S.px || 1) * dt * 4;
      if (e.z < -160) {
        e.gone = true; W3.remove(e.mesh);
        if (e.cage && e.cage.state === 'carried') { // carried off: that friend waits in the boss's cargo hold
          e.cage.state = 'gone'; W3.remove(e.cage.mesh); W3.remove(e.cage.friend.mesh);
          e.cage.friend.state = 'gone';
          S.cargo.push(e.cage.friend.id);
          S.stats.carriedOff++;
        }
      }
    }
    // dizzy: wobble and drift toward the pilot's crosshair lane (easier to catch)
    if (dizzy && e.state !== 'leave') {
      e.x += (S.px - e.x) * Math.min(1, dt * 0.6) + Math.sin(ctx.time * 3 + e.wob) * dt * 2;
      e.y += Math.cos(ctx.time * 2.5 + e.wob) * dt * 1.2;
    }
    // animate: 2 dance frames, wiggle, flash when hit
    const u = e.mesh.userData;
    const fps = e.state === 'hover' ? 8 : 3;
    const fr = Math.floor((ctx.time + e.wob) * fps) % 2;
    if (fr !== u.frame) { u.frame = fr; u.frames[0].visible = fr === 0; u.frames[1].visible = fr === 1; }
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.rotation.z = Math.sin(ctx.time * (dizzy ? 6 : 3) + e.wob) * (dizzy ? 0.5 : e.state === 'hover' ? 0.3 : 0.12);
    e.mesh.rotation.y = dizzy ? (e.mesh.rotation.y + dt * 7) % (Math.PI * 2) : e.state === 'hover' ? Math.sin(ctx.time * 4) * 0.4 : 0;
    const sc = e.state === 'hover' || e.state === 'swoop' ? 1.1 + Math.sin(ctx.time * 9) * 0.05 : 1;
    e.mesh.scale.setScalar(sc * objScale() * (e.flash > 0 ? 1.15 : 1));
    if (e.flash > 0) e.flash -= dt;
    if (e.cage && e.cage.state === 'carried') { e.cage.x = e.x; e.cage.y = e.y - 3 * objScale(); e.cage.z = e.z; }
  }
  S.enemies = S.enemies.filter((e) => !e.dead && !e.gone);

  // swoops: one bad guy at a time leaves the dance and zooms right up to the glass
  if (S.phase === 'waves' && S.swoopsOn && !S.away && S.missionT > S.nextSwoopAt) {
    S.nextSwoopAt = S.missionT + set.boopEvery / spd * rand(0.8, 1.25);
    const busy = S.enemies.filter((e) => e.state === 'swoop' || e.state === 'hover').length;
    const pool = S.enemies.filter((e) => e.state === 'dance' && !e.carrier);
    if (pool.length && busy < 2) {
      const e = pick(pool);
      Object.assign(e, { state: 'swoop', t: 0, sx: e.x, sy: e.y, sz: e.z, hx: clamp(S.px + rand(-2.4, 2.4), -PX_MAX, PX_MAX), hy: S.py + rand(-0.6, 1.0), hz: -set.swoopClose, arc: Math.random() < 0.5 ? -1 : 1 });
      ctx.sfx.play('engine', { vol: 0.5, rate: 1.4 });
    }
  }
}

function windshieldBoop(e) {
  e.dead = true;
  W3.remove(e.mesh);
  if (S.hop > 0 || rolling()) {
    // hyperspace / rolling: it whooshes right past
    ctx.sfx.whoosh();
    banner('MISSED ME!', { color: '#7dff6a', life: 1.2, key: 'dodge' });
    addScore(100);
    return;
  }
  S.stats.boops++;
  const u = Math.min(W(), H());
  const x = W() / 2 + rand(-0.22, 0.22) * W(), y = H() * rand(0.28, 0.45);
  S.boops.push({ x, y, t: 0, design: e.design, color: e.color, size: u * 0.042 });
  S.cracks.push({ x, y, t: 0, seed: Math.random() * 1000 });
  ctx.sfx.play('bonk');
  setTimeout(() => ctx && ctx.sfx.play('splat', { vol: 0.8 }), 650);
  ctx.fx.shake(10);
  S.shake = 0.3;
  banner('BOOP!', { color: '#7dff6a', life: 1.2, key: 'boop' });
  sayMaybe(pick(['Boop! Right on the window!', 'Bonk! Silly alien!', 'Hee hee, boop!']), { gap: 5, key: 'boop' });
  ctx.recorder.event('boop', { design: e.design });
}

// v1.1: slime holds on the glass ~3 s, then slides off by itself. Waving a hand over a splat wipes it (squelch!).
function addSlime(x, y, r, big = false, hold = null) {
  if (S.slime.length > 8) S.slime.shift();
  S.slime.push({ x, y, r, a: 1, seed: Math.random() * 1000, t: 0, big, hold: hold ?? (big ? 3.2 : 2.6) });
  tutorPrompt('wave');
}

function updateGlass(dt) {
  for (const b of S.boops) {
    b.t += dt;
    if (b.t > 1.6 && !b.slimed) { b.slimed = true; addSlime(b.x, b.y + Math.min(W(), H()) * 0.18, Math.min(W(), H()) * 0.075); }
  }
  S.boops = S.boops.filter((b) => b.t < 1.8);
  for (const c of S.cracks) c.t += dt;
  S.cracks = S.cracks.filter((c) => c.t < 3);
  // wipers: hand waving in the lower part of the view (or key 7)
  const wave = ctx.motion.at(0.5, 0.75, 0.35);
  S.wipeCool -= dt;
  if (S.slime.length && wave > set.wipeAt && S.wipe <= 0 && S.wipeCool <= 0) startWipe();
  if (S.wipe > 0) {
    S.wipe -= dt;
    for (const s of S.slime) s.a -= dt * 2.2;
  }
  const u = Math.min(W(), H());
  for (const s of S.slime) {
    s.t += dt;
    // wave a hand over THIS splat to wipe it
    if (!s.wiped && s.t > 0.3) {
      const n = ctx.view.toNorm(s.x, s.y);
      const m = ctx.motion.at(n.x, n.y, Math.max(0.06, (s.r / ctx.view.dw) * 1.1));
      if (m > set.wipeAt) wipeSplat(s);
    }
    if (s.wiped) s.a -= dt * 3;
    else if (s.t > s.hold) { s.y += dt * u * 0.35 * Math.min(1, s.t - s.hold); s.a -= dt * 0.9; } // slides off
  }
  S.slime = S.slime.filter((s) => s.a > 0);
}
function wipeSplat(s) {
  s.wiped = true;
  S.stats.wipes++;
  addScore(100);
  ctx.sfx.play('splat', { vol: 0.6, rate: 1.5 });
  ctx.sfx.squeak(1.6);
  pop(s.x, s.y, 'SQUEAKY CLEAN!', { text: '+100', color: '#7dff6a', small: true });
  S.streaks.push({ x: s.x, y: s.y, r: s.r, t: 0 }); // squeegee streaks
  ctx.sfx.squeak(1.9); setTimeout(() => ctx && ctx.sfx.squeak(2.3), 90);
  if (S.slimeRound) { S.slimeRound.wipes++; S.slimeRound.demo = false; }
  ctx.fx.burst(s.x, s.y, { count: Math.round(16 * particles()), speed: 320, size: 7, color: '#7dff6a' });
  tutorDone('wave');
}

function startWipe() {
  S.wipe = 1.0; S.wipeCool = 0.4;
  S.stats.wipes++;
  ctx.sfx.whoosh();
  if (S.slime.length) { banner('🧽 WIPE WIPE!', { color: '#7dff6a', life: 1.2, key: 'wipe' }); addScore(50 * S.slime.length); }
  panel?.mark('wipe', '#7dff6a');
  ctx.recorder.event('wipe', { slime: S.slime.length });
}

function updateCagesFriends(dt) {
  for (const c of S.cages) {
    if (c.state === 'float') {
      c.t += dt;
      const help = c.t > 16 ? Math.min(1, (c.t - 16) / 6) : 0; // after a while it drifts into the crosshair lane
      c.x += ((c.homeX * (1 - help) + S.px * help) + Math.sin(c.t * 0.5) * 1.2 - c.x) * Math.min(1, dt * 0.8);
      c.y = c.homeY + Math.sin(c.t * 1.3) * 0.5;
      if (c.t > 32) popCage(c, 'timeout');
    }
    if (c.state === 'loose') {
      c.t += dt;
      c.y += dt * 0.4; c.z += dt * 2;
      if (c.t > 0.7) popCage(c, 'dropped');
    }
    if (c.state === 'carried' || c.state === 'loose' || c.state === 'float') {
      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.rotation.y += dt * 0.8;
      c.wob = Math.max(0, (c.wob || 0) - dt);
      c.mesh.scale.setScalar(objScale() * (1 + Math.sin(c.wob * 40) * c.wob * 0.4));
      if (c.friend.state === 'caged') { c.friend.x = c.x; c.friend.y = c.y; c.friend.z = c.z; }
    }
  }
  S.cages = S.cages.filter((c) => c.state === 'carried' || c.state === 'loose' || c.state === 'held' || c.state === 'float');

  // friends: caged (inside the bubble), free (wave, drift toward us), beam (pulled aboard)
  let beamAlpha = 0;
  const ship = shipPos();
  const u = Math.min(W(), H());
  for (const f of S.friends) {
    f.t += dt;
    const ud = f.mesh.userData;
    if (ud.propeller) ud.propeller.rotation.y += dt * 18;
    if (f.state === 'cargo' && f.freeAt != null && f.t > f.freeAt) freeFriend(f);
    if (f.state === 'caged' || f.state === 'stranded' || f.state === 'cargo') {
      ud.arm.rotation.z = Math.sin(f.t * 6) * 0.4 + 0.6; // knocking on the bubble
      ud.body.rotation.z = Math.sin(f.t * 3) * 0.1;
    } else if (f.state === 'free') {
      ud.arm.rotation.z = -0.6 + Math.sin(f.t * 14) * 0.7; // waving hello
      ud.body.position.y = Math.abs(Math.sin(f.t * 5)) * 0.25;
      f.z = Math.min(-11, f.z + dt * 3); f.y += f.vy * dt; f.vy *= 0.97;
      f.x += (S.px - f.x) * Math.min(1, dt * 0.4);
      const p = W3.screenOf(f.mesh, W(), H(), 1);
      const near = Math.hypot(p.x - S.aimX, p.y - S.aimY) < u * 0.2;
      if (!S.beam && f.t > 0.7 && (near || f.t > 2.2)) { S.beam = { f, t: 0, x0: f.x, y0: f.y, z0: f.z, dur: S.phase === 'bossDown' ? 0.6 : 0.95 }; f.state = 'beam'; ctx.sfx.play('engine', { vol: 0.4, rate: 0.7 }); }
    }
    if (f.state !== 'done') f.mesh.position.set(f.x, f.y, f.z);
  }
  if (S.beam) {
    const b = S.beam, f = b.f;
    b.t += dt;
    const k = ease(Math.min(1, b.t / b.dur));
    f.x = b.x0 + (ship.x - b.x0) * k; f.y = b.y0 + (ship.y - b.y0) * k; f.z = b.z0 + (ship.z - 1 - b.z0) * k;
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.y += dt * 6;
    f.mesh.userData.arm.rotation.z = -0.6 + Math.sin(f.t * 16) * 0.8;
    beamAlpha = Math.min(1, b.t * 5) * (1 - Math.max(0, (b.t - b.dur) * 6));
    W3.setBeam(ship, f, beamAlpha);
    if (b.t >= b.dur) { S.beam = null; rescue(f); W3.setBeam(ship, ship, 0); }
  } else W3.setBeam(ship, ship, 0);
  S.friends = S.friends.filter((f) => f.state !== 'done' && f.state !== 'gone');
}

function updatePods(dt) {
  for (const p of S.pods) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.z = Math.sin(p.t * 8) * 0.3;
    p.mesh.userData.fist.position.y = 0.35 + Math.sin(p.t * 22) * 0.08; // shaking a tiny fist
    if (p.said && p.t > 0.4) {
      p.said = false;
      const s = W3.screenOf(p.mesh, W(), H(), 0.5);
      if (!s.behind) pop(s.x, s.y - 20, pick(POD_WORDS), { color: '#ffe14d', small: true });
    }
  }
  for (const p of S.pods) if (p.t > 2.6) W3.remove(p.mesh);
  S.pods = S.pods.filter((p) => p.t <= 2.6);
}

function updateRocks(dt) {
  for (const r of S.rocks) {
    if (r.dead) continue;
    r.t += dt;
    r.mesh.rotation.x += dt * 0.5; r.mesh.rotation.y += dt * 0.3;
    if (r.kind === 'duck') {
      updateDuckRock(r, dt);
    } else {
      // a friend stranded on a drifting rock: it hovers in range for a while, then the friend jumps off anyway
      const hz = -21;
      if (r.z < hz) r.z = Math.min(hz, r.z + dt * 30 * pace());
      r.x += Math.sin(r.t * 0.6) * dt * 1.2;
      if (r.t > 12) breakRock(r);
      if (r.friend.state === 'stranded') { r.friend.x = r.x; r.friend.y = r.y + 2.2; r.friend.z = r.z; }
    }
    // guard (v1.1): no rock lives longer than this, whatever path it took (wait, float, Again, boss...)
    const maxLife = r.kind === 'duck' ? 12 + set.duckWait + 6 : 30;
    if (!r.dead && r.t > maxLife) {
      if (r.kind === 'duck' && !r.passed) finishDuck(r);
      if (r.friend && r.friend.state === 'stranded') freeFriend(r.friend);
      r.dead = true; W3.remove(r.mesh);
      ctx.recorder.event('rockTimeout', { kind: r.kind, stage: r.stage || 'approach', z: +r.z.toFixed(1) });
    }
    if (!r.dead) r.mesh.position.set(r.x, r.y, r.z);
  }
  S.rocks = S.rocks.filter((r) => !r.dead);
}

// ---------- duck rocks (v1.1: easy and never a fail) ----------
// The window opens at the "DUCK!" warning; ANY duck until the rock passes counts (core/duck.js latch: a head dip,
// the crouch state or event, a hop or a spin). Not ducked yet when it arrives? The rock slows to a wobbling
// near-stop in front of him and waits up to 6 s ("Duck down!" + the big ⬇). Still nothing: it gently floats over.
// Never a bonk.
const DUCK_HOLD_Z = -14; // the wait comes from 🔧 Duck wait time (set.duckWait)

function updateDuckRock(r, dt) {
  const L = S.duckLatch;
  r.x += (S.px - r.x) * Math.min(1, dt * 0.8);
  if (!r.warned && r.z > -95) {
    r.warned = true;
    L.open(ctx.time);
    r.zone = ctx.body().zone;
    tutorPrompt('duck', { force: true });
    S.cue = { kind: 'duck', t: 0, life: 99 };
    ctx.say(r.practice ? "Here comes a big space rock! Duck down! Bend your knees!" : 'Big rock! DUCK!');
    ctx.sfx.play('shield', { vol: 0.5, rate: 1.3 });
  }
  if (r.warned && !r.passed) {
    if (S.hop > 0) L.mark('hop', ctx.time);
    if (rolling()) L.mark('spin', ctx.time);
    L.update(dt, ctx.time, { height: ctx.gestures.height, crouching: ctx.gestures.crouching });
    if (L.ducked && !r.gotDuck) { r.gotDuck = true; S.duckShow = 0.7; ctx.sfx.play('whoosh'); } // the view dips: you ducked!
  }
  if (r.stage === 'wait') {
    // slow-mo wobble right in front, waiting for any duck
    r.t2 += dt;
    r.z += (DUCK_HOLD_Z - r.z) * Math.min(1, dt * 3);
    r.mesh.rotation.z = Math.sin(r.t2 * 6) * 0.15;
    r.y = 3.4 + Math.sin(r.t2 * 3) * 0.3; // hovering just above, so ducking under it reads clearly
    if (!S.tutor.cur || S.tutor.cur.move !== 'duck') { S.tutor.cur = { move: 'duck', t: 0 }; } // keep the ⬇ card up while it waits
    else if (S.tutor.cur.t > 3) S.tutor.cur.t = 0.3;
    if (r.t2 - (r.saidAt ?? -9) > 3) { r.saidAt = r.t2; ctx.say(pick(['Duck down!', 'Bend your knees and duck!', 'Squat down low!']), { interrupt: false }); }
    if (L.ducked) { r.stage = 'go'; r.vz = 60; }
    else if (r.t2 > set.duckWait) { r.stage = 'float'; r.vz = 14; }
  } else if (r.stage === 'float') {
    r.z += r.vz * dt; r.y += dt * 4; // gently up and over
  } else {
    r.z += r.vz * dt;
    if (!r.passed && !L.ducked && r.z > DUCK_HOLD_Z - 3 && r.stage !== 'go') { r.stage = 'wait'; r.t2 = 0; r.vz = 0; S.cue = { kind: 'duck', t: 0, life: 99 }; }
  }
  if (r.z > -1.5 && !r.passed) finishDuck(r);
  if (r.z > 8 || r.y > 30) { r.dead = true; W3.remove(r.mesh); }
}

function finishDuck(r) {
  r.passed = true;
  S.cue = null;
  const sum = S.duckLatch.close(ctx.time);
  const st = S.stats;
  let result;
  if (sum.ducked) {
    result = r.t2 != null ? 'waited' : 'ducked';
    st.ducked++; if (result === 'waited') st.duckWaited++;
    S.duckShow = 0.6; // the view ducks as it whooshes over
    addScore(200);
    banner('DUCKED! +200', { color: '#7dff6a', life: 1.6, key: 'dodge' });
    ctx.sfx.whoosh(); ctx.sfx.play('collect');
    sayMaybe(pick(['Great duck!', 'Whoosh! Right over your head!', 'You ducked it!']), { gap: 3, key: 'ducked' });
    tutorDone('duck');
  } else {
    result = 'floated';
    st.floatedOver++;
    addScore(50);
    banner('WHEW! +50', { sub: 'it floated over', color: '#5ee0ff', life: 1.6, key: 'dodge' });
    sayMaybe('Whew! It floated right over us. Next time, duck down!', { gap: 6, key: 'floated' });
  }
  const rec = { ...sum, result, practice: !!r.practice, zone: r.zone, zoneEnd: ctx.body().zone, start: +sum.start.toFixed(2), seenAt: sum.seenAt != null ? +sum.seenAt.toFixed(2) : null };
  st.duckLog.push(rec);
  ctx.recorder.event('duck', rec);
}

function canopyHit(say) {
  S.stats.hits++;
  S.rattle = 0.6; S.shake = 0.5;
  ctx.fx.shake(14);
  ctx.sfx.play('bonk');
  ctx.sfx.play('shield', { vol: 0.7 });
  if (S.shields > 0) { S.shields--; S.shieldT = 0; }
  banner('RATTLE!', { sub: 'shields up!', color: '#ffcc33', life: 1.3, key: 'hit' });
  if (say) sayMaybe(say, { gap: 3, key: 'hit' });
}

// ---------- the boss: Captain Clank's CRAB-TANK ----------

function jumpToBoss() {
  if (S.boss || S.phase === 'end') return;
  if (S.slimeRound) endSlimeRound();
  S.round = null;
  for (const e of S.enemies) { e.state = 'leave'; e.t = 0; }
  for (const r of S.rocks) if (r.kind === 'friend') breakRock(r);
  setPhase('bossIntro');
  S.cue = null;
  const mesh = W3.add(W3.makeBoss());
  mesh.scale.setScalar(1.2 * Math.sqrt(objScale()));
  mesh.position.set(0, -1, -170);
  const cargo = [...S.cargo];
  while (cargo.length < 3 + S.cargo.length && cargo.length < 10) cargo.push(newFriendRecipe({ rare: cargo.length === 0 }));
  // v1.1 round 2: phase 1 = the ARM SWAP (one claw powered down, low and glowing; the other up high behind a
  // shield; he swaps every 🔧 Crab arm-swap time or when the low arm is half done), phase 3 = the heart
  S.boss = { mesh, phase: 1, hp: set.bossHealth, maxHp: set.bossHealth, x: 0, z: -170, t: 0, attack: null, nextAttack: 6, pause: 0, flustered: 0, cargo, wobble: 0, lastHitAt: 0, hitFlash: 0,
    armHp: [set.bossHealth, set.bossHealth], armHalf: [false, false], armSide: S.px > 0 ? 0 : 1, armT: 0, swap: null, armDown: [0, 0], swaps: 0 };
  // a caged friend in each claw
  S.boss.clawCages = mesh.userData.claws.map((c) => {
    const cage = makeCageEntity(null, 0, 0, -170, newFriendRecipe());
    cage.state = 'held'; cage.claw = c;
    return cage;
  });
  ctx.music.play(BOSS_TRACK);
  ctx.sfx.play('engine', { vol: 1, rate: 0.6 });
  ctx.say("Uh oh! It's Captain Clank's CRAB-TANK! Zap the glowing claws to free our friends!");
  ctx.recorder.event('boss', { stage: 'intro' });
}

function weakPoint() {
  const B = S.boss, u = B.mesh.userData;
  if (B.phase === 1) return u.claws[B.armSide].glow;
  return u.core;
}

function hitWeak() {
  const B = S.boss;
  if (!B || S.phase !== 'boss' || B.pause > 0 || B.swap) return;
  if (B.phase === 1) {
    const sd = B.armSide;
    B.armHp[sd]--;
    B.hitFlash = 0.1; B.lastHitAt = B.t; addScore(20);
    if (Math.random() < 0.15) talk('crab', 'hit');
    const wp = W3.worldPos(weakPoint());
    W3.debris(wp.x, wp.y, wp.z + 0.5, { count: Math.round(4 * particles()), colors: ['#ffe14d', '#ffffff'], speed: 5, size: 0.15 });
    if (Math.random() < 0.3) ctx.sfx.play('bonk', { vol: 0.35, rate: 1.3 });
    if (B.armHp[sd] <= 0) breakArm(sd);
    else if (!B.armHalf[sd] && B.armHp[sd] <= B.maxHp / 2) { B.armHalf[sd] = true; startSwap(); }
    return;
  }
  B.hp--;
  B.hitFlash = 0.1;
  if (Math.random() < 0.15) talk('crab', 'hit'); // indignant (the talk gap keeps it from nagging)
  B.lastHitAt = B.t;
  addScore(20);
  const wp = W3.worldPos(weakPoint());
  W3.debris(wp.x, wp.y, wp.z + 0.5, { count: Math.round(4 * particles()), colors: ['#ffe14d', '#ffffff'], speed: 5, size: 0.15 });
  if (Math.random() < 0.3) ctx.sfx.play('bonk', { vol: 0.35, rate: 1.3 });
  if (B.hp <= 0) bossPhaseDone();
}

// swap arms: the low arm spins, sparks and powers back on (shield up, raised), the other one drops low and glows
function startSwap() {
  const B = S.boss;
  if (!B || B.swap || B.phase !== 1) return;
  const other = 1 - B.armSide;
  const next = B.armHp[other] > 0 ? other : B.armSide;
  B.swap = { t: 0, from: B.armSide, to: next };
  B.swaps++;
  B.attack = null; S.cue = null;
  ctx.sfx.play('shield'); ctx.sfx.tone(300, 0.5, 'square', 0.06); setTimeout(() => ctx && ctx.sfx.tone(600, 0.4, 'square', 0.06), 250);
  S.talkAt.phase = -99; talk('crab', 'phase');
  ctx.recorder.event('boss', { stage: 'swap', from: B.armSide, to: next, hp: [...B.armHp] });
}

function breakArm(sd) {
  const B = S.boss, u = B.mesh.userData;
  const metal = ['#8a93b8', '#c0c8e8', '#ff6b3d', '#ffe14d', '#ffffff'];
  const claw = u.claws[sd];
  const wp = W3.worldPos(claw.glow);
  W3.debris(wp.x, wp.y, wp.z, { count: Math.round(60 * particles()), colors: metal, speed: 10, size: 0.4 });
  claw.armor.visible = false; claw.glow.visible = false; claw.glowRing.visible = false; claw.shield.visible = false;
  claw.open = 1; claw.broken = true;
  const cage = B.clawCages[sd];
  if (cage.state === 'held') { cage.state = 'loose'; cage.t = 0.3; }
  ctx.sfx.play('smash'); ctx.sfx.play('cubes');
  ctx.fx.shake(14);
  addScore(1000);
  B.flustered++;
  const both = B.armHp[0] <= 0 && B.armHp[1] <= 0;
  banner(both ? 'BOTH CLAWS FREE!' : 'CLAW FREE!', { sub: '+1000', color: '#ffe14d', life: 2, key: 'boss' });
  if (both) {
    B.phase = 3; B.hp = B.maxHp; B.pause = 2; B.attack = null; B.nextAttack = 4; B.attackN = -1; B.swap = null;
    u.plate.visible = false;
    W3.debris(B.x, 0.6, B.z + 3.2, { count: Math.round(40 * particles()), colors: metal, speed: 9, size: 0.45 });
    ctx.say('Both claws! Now zap the glowing heart!');
    S.talkAt.phase = -99; talk('crab', 'phase');
    ctx.recorder.event('boss', { stage: 'heart' });
  } else {
    ctx.say('A claw is free! Now the other one!');
    startSwap();
  }
}

function bossPhaseDone() {
  // the heart's done (phase 3); arms are handled by breakArm / startSwap
  defeatBoss();
}

function defeatBoss() {
  const B = S.boss;
  if (S.phase !== 'boss') return;
  setPhase('bossDown');
  B.attack = null;
  S.cue = null;
  S.stats.bossDefeated = true;
  S.stats.bossTime = B.t;
  for (const g of S.goos) splatGoo(g, true);
  addScore(5000);
  ctx.sfx.play('powerup');
  ctx.say("You did it! The Crab-Tank is going down!");
  ctx.recorder.event('boss', { stage: 'defeated', time: +B.t.toFixed(1) });
}

function updateBoss(dt) {
  const B = S.boss;
  if (!B) return;
  B.t += dt;
  const u = B.mesh.userData;
  const spd = pace();
  if (S.phase === 'bossIntro') {
    B.z += (BOSS_Z - B.z) * Math.min(1, dt * 1.2);
    if (S.phaseT > 4.2) { setPhase('boss'); B.z = BOSS_Z; B.armT = 0; S.talkAt.taunt = -99; talk('crab', 'taunt'); B.nextTantrum = 6; banner('ZAP THE LOW CLAW!', { color: '#ffe14d', life: 2.5, key: 'boss' }); ctx.say(`Zap the glowing claw down low! Lean ${B.armSide ? 'right' : 'left'}!`); }
  } else if (S.phase === 'boss') {
    B.pause = Math.max(0, B.pause - dt);
    // scuttle side to side across the pilot's lane, and drift to help if he hasn't hit for a while
    const helping = B.t - B.lastHitAt > 4;
    let target;
    if (B.phase === 1) {
      // he stays near the middle and sways; the LOW claw is off to one side, so the pilot leans to it.
      // Forgiving: no hits for a while and the low claw drifts partway toward the pilot.
      // the low claw sits off to one side (lean to it) but never under the left HUD column or off screen
      target = Math.sin(B.t * 0.4 * spd) * 1.5 + (B.armSide ? -2.5 : 2.5);
      if (helping) { // the longer without a hit, the more the low claw slides over to him
        const g = W3.worldPos(u.claws[B.armSide].glow), k = Math.min(0.95, 0.35 + (B.t - B.lastHitAt - 4) * 0.12);
        target += (B.x + (S.px - g.x) - target) * k;
      }
      B.armT += dt;
      if (!B.swap && B.armT > set.armSwap) startSwap();
      if (B.swap) {
        B.swap.t += dt;
        if (B.swap.t > 0.15 && B.swap.t < 1.3) {
          B.sparkT = (B.sparkT || 0) - dt;
          if (B.sparkT <= 0) { B.sparkT = isLow() ? 0.16 : 0.08; const g = W3.worldPos(u.claws[B.swap.from].glow); W3.debris(g.x, g.y, g.z, { count: 4, colors: ['#ffe14d', '#ffffff', '#5ee0ff'], speed: 7, size: 0.15, life: 0.6 }); }
        }
        if (B.swap.t >= 1.4) {
          B.armSide = B.swap.to; B.swap = null; B.armT = 0;
          banner(B.armSide ? 'RIGHT CLAW! ➡' : '⬅ LEFT CLAW!', { color: '#ffe14d', life: 2, key: 'boss' });
          sayMaybe(pick(['The other claw is down! Lean over there!', 'He switched! Lean the other way!']), { gap: 3, key: 'swap' });
        }
      }
    } else target = S.px * 0.5 + Math.sin(B.t * 0.6 * spd) * 3;
    B.x += (target - B.x) * Math.min(1, dt * (helping ? 0.9 : 0.5));
    // attacks: telegraphed, forgiving
    if (!B.attack && B.pause <= 0 && !S.away && !(B.dizzy > 0)) {
      B.nextAttack -= dt * spd;
      if (B.nextAttack <= 0) startAttack();
    }
    if (B.attack) updateAttack(dt);
  } else if (S.phase === 'bossDown') {
    B.wobble += dt;
    B.mesh.rotation.z = Math.sin(B.wobble * 18) * 0.08 * Math.min(1, B.wobble);
    if (B.wobble > 1.3 && !B.burst) {
      B.burst = true;
      const cols = ['#ff6b3d', '#c9472a', '#8a93b8', '#ffe14d', '#ffffff', '#5ee0ff', '#ff5ea8'];
      for (let k = 0; k < 4; k++) W3.debris(B.x + rand(-4, 4), rand(-1, 3), B.z + rand(-1, 2), { count: Math.round(90 * particles()), colors: cols, speed: 14, size: 0.55, life: 2.2 });
      ctx.sfx.play('boom'); ctx.sfx.play('cubes'); ctx.sfx.play('smash');
      ctx.fx.shake(22); ctx.fx.confetti(220);
      B.mesh.visible = false;
      // the driver escapes in a pod
      const pm = W3.add(W3.makePod('#3fd16b'));
      pm.scale.setScalar(2);
      pm.position.set(B.x, 3, B.z);
      S.pods.push({ mesh: pm, x: B.x, y: 3, z: B.z, vx: 2, vy: 6, vz: -10, t: 0, said: false });
      talk('crab', 'defeat');
      banner('🦀 BOSS DEFEATED!', { sub: '+5000', color: '#ffe14d', life: 3, key: 'boss', big: true });
      // everyone it was holding is freed at once
      for (const c of B.clawCages) if (c.state === 'held') { c.state = 'loose'; c.t = 0.3; c.x = B.x; c.y = 0; c.z = B.z + 2; }
      B.cargo.forEach((id, i) => {
        const f = makeFriendEntity(id, B.x + (i - (B.cargo.length - 1) / 2) * 1.8, rand(1, 3), B.z + 3, 'cargo');
        f.freeAt = 0.2 + i * 0.16;
      });
      ctx.say('Everybody is free! Beam them all aboard!', { interrupt: false });
    }
    const waiting = S.friends.length + S.cages.length;
    if (B.burst && B.wobble > 3 && !waiting) endMission();
  }
  // a cartoon tantrum (v1.1): claws out and shaking at the pilot, stomping, steam puffing from the dome
  if (S.phase === 'boss') {
    B.nextTantrum = (B.nextTantrum ?? 6) - dt;
    if (B.nextTantrum <= 0 && !B.attack) { B.nextTantrum = rand(7, 10); B.tantrum = 2; }
  }
  B.tantrum = Math.max(0, (B.tantrum || 0) - dt);
  const dizzyB = B.dizzy > 0 && S.phase === 'boss';
  const tan = dizzyB || S.phase === 'bossDown' ? 0 : Math.min(1, B.tantrum);
  if (tan > 0) {
    B.puffT = (B.puffT || 0) - dt;
    if (B.puffT <= 0) {
      B.puffT = isLow() ? 0.25 : 0.12;
      const d = W3.worldPos(u.domeGroup);
      W3.debris(d.x + rand(-0.8, 0.8), d.y + 1.6, d.z, { count: isLow() ? 2 : 3, colors: ['#ffffff', '#eef0f8', '#d4d8ea'], speed: 1.2, size: 0.7, vy: 4, life: 1 });
      if (Math.random() < 0.5) ctx.sfx.play('step', { vol: 0.5, rate: 0.6 + Math.random() * 0.2 });
    }
  }
  // pose the crab
  B.mesh.position.set(B.x, -1.2 + (B.attack?.kind === 'charge' ? B.attack.lift || 0 : 0) + Math.abs(Math.sin(B.t * 16)) * 0.5 * tan, B.z + (B.attack?.lunge || 0));
  const scut = Math.sin(B.t * 8 * spd);
  for (const leg of u.legs) leg.rotation.x = Math.sin(B.t * (8 + tan * 14) * spd + leg.userData.i * 2 + (leg.userData.s > 0 ? 1 : 0)) * (0.35 + tan * 0.25);
  u.hull.rotation.z = scut * 0.03 + Math.sin(B.t * 20) * 0.05 * tan;
  u.hull.rotation.y = dizzyB ? Math.sin(B.t * 5) * 0.3 : 0;
  u.hull.rotation.x = -(B.attack?.kind === 'charge' && B.attack.stage === 'tele' ? Math.min(0.35, B.attack.t * 0.3) : 0);
  for (const [i, c] of u.claws.entries()) {
    const raised = B.attack?.kind === 'snap' && B.attack.claw === i;
    const snap = raised ? (B.attack.stage === 'tele' ? 0.9 : Math.max(0, 0.9 - B.attack.t * 6)) : 0;
    const open = c.open ? 0.8 : 0.25 + Math.max(0, Math.sin(B.t * 3 + i)) * 0.2 + snap;
    c.upper.rotation.x = -open * 0.5; c.lower.rotation.x = open * 0.5;
    // arm swap pose: down = low, out and close to the glass; up = raised high behind a shield
    const armPhase = B.phase === 1 && (S.phase === 'boss' || S.phase === 'bossIntro');
    const wantDown = armPhase && !c.broken && (B.swap ? (B.swap.t > 0.7 ? i === B.swap.to : i === B.swap.from) : i === B.armSide);
    B.armDown[i] += ((wantDown ? 1 : 0) - B.armDown[i]) * Math.min(1, dt * 3);
    const dn = B.armDown[i], upA = armPhase && !c.broken ? 1 - dn : 0;
    c.arm.rotation.x = raised && B.attack.stage === 'tele' ? -0.6 : Math.sin(B.t * 22 + i) * 0.35 * tan * (1 - dn);
    c.arm.rotation.z = c.side * tan * (0.55 + Math.sin(B.t * 28 + i * 2) * 0.25) * (1 - dn) - c.side * 0.25 * dn + c.side * 0.85 * upA;
    c.arm.position.z = c.arm.userData.z0 + dn * 2.4;
    c.claw.rotation.z = B.swap && B.swap.from === i && B.swap.t < 1.2 ? c.claw.rotation.z + dt * 22 : c.claw.rotation.z * 0.85; // power-on spin
    c.shield.visible = upA > 0.5;
    if (c.shield.visible) c.shield.material.opacity = 0.16 + Math.sin(B.t * 6 + i) * 0.06;
    const weakNow = S.phase === 'boss' && (B.phase === 1 ? i === B.armSide && !B.swap : false) && B.pause <= 0;
    const pulse = 1 + Math.sin(B.t * 8) * 0.18 + (weakNow && B.hitFlash > 0 ? 0.35 : 0);
    c.glow.scale.setScalar(0.6 * pulse * (weakNow ? 1.25 : 0.8));
    c.glow.material.opacity = weakNow ? 0.95 : 0.4;
    c.glowRing.rotation.z += dt * (weakNow ? 4 : 1);
  }
  if (B.phase === 3) { const pulse = 1 + Math.sin(B.t * 9) * 0.2; u.core.scale.set(0.9 * pulse, 0.9 * pulse, 0.5); u.coreRing.rotation.z += dt * 5; }
  B.hitFlash = Math.max(0, B.hitFlash - dt);
  // the driver gets more flustered each phase (and right after hits)
  const fl = B.flustered + (B.t - B.lastHitAt < 0.4 ? 1 : 0);
  u.driver.position.x = Math.sin(B.t * (6 + fl * 6)) * 0.08 * (1 + fl);
  u.driver.rotation.z = Math.sin(B.t * (5 + fl * 5)) * 0.15 * (1 + fl);
  const fr = Math.floor(B.t * (2 + fl * 3)) % 2;
  if (fr !== u.driver.userData.frame) { u.driver.userData.frame = fr; u.driver.userData.frames[0].visible = !fr; u.driver.userData.frames[1].visible = !!fr; }
  const es = dizzyB ? 12 : 0; // dizzy: pupils go round and round
  for (const e of u.eyes) { e.pupil.position.x = Math.sin(B.t * (2 + fl * 3 + es)) * 0.2; e.pupil.position.y = Math.cos(B.t * (1.5 + fl * 2 + es)) * (dizzyB ? 0.2 : 0.12); }
  if (fl >= 1 && Math.random() < dt * 0.4) { const p = W3.screenOf(u.domeGroup, W(), H(), 1); if (!p.behind) pop(p.x, p.y - p.r * 2, pick(['Klonk!', 'Bwaah!', 'Blib-blab!', 'Gnarf!', 'Zort?!']), { color: '#7dff6a', small: true }); }
  // claw cages ride in the claws
  for (const c of B.clawCages || []) {
    if (c.state !== 'held') continue;
    const p = W3.worldPos(c.claw.anchor);
    c.x = p.x; c.y = p.y; c.z = p.z;
    c.mesh.position.set(c.x, c.y, c.z);
    c.friend.x = c.x; c.friend.y = c.y; c.friend.z = c.z;
  }
}

function startAttack() {
  const B = S.boss;
  // each phase opens with its new attack, then alternates
  const kinds = B.phase === 1 ? ['snap'] : ['charge', 'goo'];
  const kind = kinds[(B.attackN = (B.attackN ?? -1) + 1) % kinds.length];
  if (kind === 'snap') {
    B.attack = { kind, stage: 'tele', t: 0, aimX: S.px, claw: B.phase === 1 ? 1 - B.armSide : S.px < B.x ? 0 : 1 };
    S.cue = { kind: 'lean', t: 0, life: 1.6, aimX: S.px };
    ctx.say(pick(['Snap attack! Lean!', 'Watch the claw! Lean away!']));
    ctx.sfx.tone(300, 0.6, 'square', 0.08);
    setTimeout(() => ctx && ctx.sfx.tone(450, 0.5, 'square', 0.08), 500);
  } else if (kind === 'goo') {
    B.attack = { kind, stage: 'spit', t: 0, n: 0 };
    sayMaybe(pick(['Goo balls! Zap them!', 'Ptoo! Goo!']), { gap: 6, key: 'goo' });
  } else {
    B.attack = { kind, stage: 'tele', t: 0 };
    S.cue = { kind: 'jump', t: 0, life: 1.8 };
    ctx.say(pick(['It is charging! JUMP!', 'Here it comes! JUMP or DUCK!']));
    ctx.sfx.play('engine', { vol: 1, rate: 0.8 });
  }
  ctx.recorder.event('attack', { kind, phase: B.phase });
}

function dodging(aimX) {
  return S.hop > 0 || rolling() || S.duck > 0.55 || (aimX != null && Math.abs(S.px - aimX) > 2.2);
}

function updateAttack(dt) {
  const B = S.boss, a = B.attack;
  a.t += dt;
  const done = (hit) => {
    B.attack = null;
    if (hit) { canopyHit(pick(['Bonk! Shields held!', 'Rattle rattle! You are okay!'])); B.nextAttack = 6; }
    else { S.stats.dodges++; addScore(200); banner('DODGED! +200', { color: '#7dff6a', life: 1.4, key: 'dodge' }); ctx.sfx.whoosh(); sayMaybe(pick(['Missed you!', 'Great dodge!', 'Nope!']), { gap: 3, key: 'dodged' }); B.nextAttack = 4.5; }
    ctx.recorder.event('attackEnd', { kind: a.kind, hit });
  };
  if (a.kind === 'snap') {
    if (a.stage === 'tele' && a.t > 1.6) { a.stage = 'strike'; a.t = 0; ctx.sfx.play('smash', { vol: 0.8 }); S.cue = null; done(!dodging(a.aimX)); }
  } else if (a.kind === 'goo') {
    if (a.t > a.n * 0.9 && a.n < 2) { a.n++; spitGoo(); } // v1.1: two big slow ones
    if (a.n >= 2 && a.t > 2.5) { B.attack = null; B.nextAttack = 4.5; }
  } else if (a.kind === 'charge') {
    if (a.stage === 'tele') { a.lift = Math.min(1.5, a.t); if (a.t > 1.8) { a.stage = 'lunge'; a.t = 0; ctx.sfx.whoosh(); } }
    else if (a.stage === 'lunge') {
      a.lunge = Math.sin(Math.min(1, a.t / 1.1) * Math.PI) * 24;
      a.lift = 1.5 * (1 - a.t / 1.1);
      if (!a.checked && a.t > 0.55) { a.checked = true; S.cue = null; done(!dodging(null)); B.attack = a; }
      if (a.t > 1.1) { a.lunge = 0; a.lift = 0; B.attack = null; }
    }
  }
}

function spitGoo(src = S.boss) {
  const B = src;
  const mesh = W3.add(W3.makeAsteroid(1.5));
  mesh.material = mesh.material.clone(); mesh.material.color.set('#5be36b'); mesh.material.emissive?.set('#1d5a1d'); mesh.userData.ownMat = true;
  // v1.1: big, slow and readable, and it really reaches the glass (lasers leave it alone)
  const g = { mesh, x: B.x + rand(-1, 1), y: B.y ?? 0.8, z: B.z + 3, z0: B.z + 3, tx: S.px + rand(-2.2, 2.2), ty: S.py + rand(-0.3, 0.8), t: 0, dur: 3.6 / pace() };
  mesh.scale.multiplyScalar(objScale());
  if (src === S.boss) talk('crab', 'spit'); else talk('alien', 'spit', src);
  S.goos.push(g);
  ctx.sfx.play('splat', { vol: 0.5, rate: 1.4 });
}

function splatGoo(g, zapped) {
  if (g.dead) return;
  g.dead = true;
  W3.remove(g.mesh);
  g.mesh.material.dispose?.();
  if (zapped) {
    W3.debris(g.x, g.y, g.z, { count: Math.round(14 * particles()), colors: ['#5be36b', '#a8ff9a', '#ffffff'], speed: 5, size: 0.2 });
    ctx.sfx.play('splat', { vol: 0.6 });
    addScore(100);
    const p = W3.toScreen(g.x, g.y, g.z, W(), H());
    if (!p.behind) pop(p.x, p.y, 'SPLAT!', { text: '+100', color: '#7dff6a', small: true });
  }
}

function updateGoos(dt) {
  for (const g of S.goos) {
    if (g.dead) continue;
    g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    g.x += (g.tx - g.x) * Math.min(1, dt * 1.5); g.y += (g.ty - g.y) * Math.min(1, dt * 1.5);
    g.z = g.z0 + (-0.8 - g.z0) * k;
    g.mesh.position.set(g.x, g.y, g.z);
    g.mesh.rotation.x += dt * 2;
    const jig = 1 + Math.sin(g.t * 9) * 0.12; // jelly wobble
    g.mesh.scale.set(1.5 * jig * objScale(), 1.5 / jig * objScale(), 1.5 * objScale());
    if (k >= 1) {
      // SPLAT on the cockpit glass, right where it was flying
      const p = W3.toScreen(g.x, g.y, -2, W(), H());
      splatGoo(g, false);
      const u = Math.min(W(), H());
      addSlime(clamp(p.x, W() * 0.3, W() * 0.75), clamp(p.y, H() * 0.25, H() * 0.6), u * rand(0.13, 0.17), true, S.slimeRound ? S.slimeRound.len : null);
      if (S.slimeRound) S.slimeRound.landed++;
      ctx.sfx.play('splat');
      ctx.sfx.play('bonk', { vol: 0.5, rate: 0.7 });
      ctx.fx.shake(9);
      banner('SPLAT!', { sub: 'wave to wipe!', color: '#7dff6a', life: 1.6, key: 'splat' });
    }
  }
  S.goos = S.goos.filter((g) => !g.dead);
}

// ---------- the mission clock ----------

function updateMission(dt) {
  if (S.phase === 'intro') {
    const n = 3 - Math.floor(S.phaseT - 1.2);
    if (S.phaseT > 1.2 && n !== S.lastCount && n >= 1 && n <= 3) { S.lastCount = n; ctx.say(String(n), { interrupt: false }); ctx.sfx.tone(520, 0.12, 'square', 0.12); }
    if (S.phaseT > 4.2) { setPhase('waves'); ctx.say('GO!', { interrupt: false }); ctx.sfx.tone(880, 0.25, 'square', 0.15); ctx.sfx.whoosh(); }
    return;
  }
  if (S.phase !== 'waves' || S.away) return;
  S.missionT += dt;
  // before the first round: can the camera see his head and shoulders? (once, only if it can't; a picture + a line)
  if (!S.stepChecked && S.missionT > 0.3) {
    S.stepChecked = true;
    const ts = hud.trackingState(ctx, S, set.playDistance);
    if (!ts.ok) tutorPrompt('stepback', { force: true });
    ctx.recorder.event('stepcheck', { kind: ts.kind, zone: ctx.body().zone });
  }
  updateRounds(dt);
}

// ---------- rounds (v1.1 round 2): a slow ramp, and each round adds exactly ONE thing ----------
// 1 a lonely friend in a bubble off to the side (lean + beam) · 2 a practice duck rock (duck) · then bad-guy rounds
// whose counts grow toward the full formation (🔧 Ramp rounds), with a teaching round slotted between them
// (punch → swoops + jump → spin), the slime round (wave), and the full formation (airplane arms). Then the boss.
function buildRounds() {
  const max = Math.round(isLow() ? Math.min(set.formationSize, 6) : set.formationSize);
  const n = Math.max(1, Math.round(set.rampRounds));
  const counts = [];
  for (let i = 0; i < n; i++) {
    const c = Math.max(1, Math.round(Math.pow(Math.max(1, max - 1), i / Math.max(1, n - 1))));
    if (c < max && (!counts.length || c > counts[counts.length - 1])) counts.push(c);
  }
  const teach = [
    { kind: 'wave', teach: 'punch', same: true },
    { kind: 'wave', teach: 'jump', swoops: true, same: true },
    { kind: 'wave', teach: 'spin', same: true },
  ];
  const R = [{ kind: 'friend', teach: 'lean' }, { kind: 'duck', teach: 'duck' }];
  counts.forEach((c, i) => {
    R.push({ kind: 'wave', n: c });
    if (teach[i]) R.push({ ...teach[i], n: c });
  });
  for (const t of teach.slice(counts.length)) R.push({ ...t, n: counts[counts.length - 1] || 1 });
  R.push({ kind: 'slime', teach: 'wave' });
  R.push({ kind: 'wave', n: max, teach: 'arms', full: true });
  return R;
}

function startRound(i) {
  S.roundI = i;
  const r = S.rounds[i];
  if (!r) { S.round = null; jumpToBoss(); return; }
  S.round = { ...r, t: 0, num: i + 1 };
  banner(`ROUND ${i + 1}`, { sub: r.full ? 'the big formation!' : '', color: '#ffffff', life: 2, key: 'round' });
  if (r.swoops) S.swoopsOn = true;
  if (r.teach) tutorPrompt(r.teach, { force: r.teach === 'duck' || r.teach === 'lean' });
  if (r.kind === 'friend') {
    const side = S.px > 0 ? -1 : 1;
    const c = makeCageEntity(null, side * 7, 0.6, -24, newFriendRecipe());
    Object.assign(c, { state: 'float', homeX: side * 7, homeY: 0.6, t: 0, hp: 2 });
    sayMaybe('A friend is floating all alone! Lean to point at the bubble!', { key: 'lonely', gap: 1 });
  } else if (r.kind === 'duck') spawnRock('duck');
  else if (r.kind === 'wave') spawnWave(r.n);
  else if (r.kind === 'slime') startSlimeRound();
  ctx.recorder.event('round', { num: i + 1, kind: r.kind, n: r.n || 0, teach: r.teach || null });
}

function roundDone() {
  const r = S.round;
  if (!r) return true;
  const friendsBusy = S.beam || S.friends.some((f) => f.state === 'free') || S.flyers.length;
  if (r.kind === 'friend') return !S.cages.some((c) => c.state === 'float') && !friendsBusy;
  if (r.kind === 'duck') return !S.rocks.some((x) => x.kind === 'duck');
  if (r.kind === 'slime') return !S.slimeRound && !S.goos.length;
  return !S.formations.length && !S.cages.some((c) => c.state === 'loose') && !friendsBusy;
}

function updateRounds(dt) {
  if (S.roundI < 0) { startRound(0); return; }
  if (S.round) S.round.t += dt;
  if (!roundDone()) return;
  S.roundGap -= dt;
  if (S.roundGap > 0) return;
  S.roundGap = 2.2 / Math.max(0.5, set.pace);
  if (S.missionT > S.missionLen) { S.round = null; jumpToBoss(); return; } // the 🔧 length cap
  startRound(S.roundI + 1);
}

// ---------- the slime round (v1.1 round 2): a goo-blaster, several big splats, WAVE to wipe ----------
function startSlimeRound() {
  const mesh = W3.add(W3.makeBadGuy('zoomer', '#3fd16b'));
  mesh.scale.setScalar(1.3 * objScale());
  S.goober = { mesh, design: 'zoomer', color: '#3fd16b', x: S.px, y: 2.2, z: -20, t: 0 };
  S.slimeRound = { t: 0, spat: 0, landed: 0, wipes: 0, demo: true, len: set.slimeLength, n: Math.round(set.slimeSplats), need: Math.min(3, Math.round(set.slimeSplats)) };
  S.onLine = { who: 'alien', design: 'zoomer', color: '#3fd16b' };
  ctx.say("Uh oh! A goo blaster! When the window gets slimy, wave your hands over the slime to wipe it!");
  ctx.recorder.event('slimeRound', { len: S.slimeRound.len, n: S.slimeRound.n });
}

function updateSlimeRound(dt) {
  const R = S.slimeRound, G = S.goober;
  if (G) {
    G.t += dt;
    G.x += (S.px + Math.sin(G.t * 0.8) * 3 - G.x) * Math.min(1, dt * 0.8);
    G.y = 2.2 + Math.sin(G.t * 2) * 0.4;
    if (G.leaving) { G.z -= dt * 50; G.y += dt * 6; if (G.z < -150) { W3.remove(G.mesh); S.goober = null; } }
    else G.z += (-20 - G.z) * Math.min(1, dt * 2);
    if (S.goober) {
      G.mesh.position.set(G.x, G.y, G.z);
      G.mesh.rotation.z = Math.sin(G.t * 3) * 0.15;
      const u = G.mesh.userData, fr = Math.floor(G.t * 4) % 2;
      if (fr !== u.frame) { u.frame = fr; u.frames[0].visible = !fr; u.frames[1].visible = !!fr; }
    }
  }
  if (!R) return;
  R.t += dt;
  // spits spread over the round (the first one quickly)
  const every = R.len / (R.n + 1);
  if (R.spat < R.n && R.t > 1.5 + R.spat * every) { R.spat++; spitGoo({ x: G.x, y: G.y, z: G.z, design: 'zoomer', color: '#3fd16b' }); }
  if (R.landed === 1 && R.demo && !R.demoSaid) { R.demoSaid = true; ctx.say('Wave your hands! Wipe wipe wipe!', { interrupt: false }); tutorPrompt('wave', { force: true }); }
  if ((R.wipes >= R.need && R.spat >= R.need) || R.t > R.len) endSlimeRound();
}

function endSlimeRound() {
  const R = S.slimeRound;
  S.slimeRound = null;
  for (const sl of S.slime) sl.hold = Math.min(sl.hold, sl.t + 0.6); // the rest slides off
  addScore(300 + R.wipes * 100);
  banner(R.wipes ? 'SQUEAKY CLEAN!' : 'BYE BYE GOO!', { sub: R.wipes ? `${R.wipes} wipes!` : '', color: '#7dff6a', life: 2.2, key: 'slime' });
  if (S.goober) {
    // the goo-blaster gets zapped with a big release, its pilot pops out like everyone else's
    const G = S.goober;
    W3.debris(G.x, G.y, G.z, { count: Math.round(50 * particles()), colors: ['#3fd16b', '#7dff6a', '#ffffff', '#ffe14d'], speed: 9, size: 0.35 });
    ctx.sfx.play('cubes'); ctx.sfx.play('smash', { vol: 0.6 });
    const pm = W3.add(W3.makePod('#3fd16b')); pm.position.set(G.x, G.y, G.z);
    S.pods.push({ mesh: pm, x: G.x, y: G.y, z: G.z, vx: 3, vy: 4, vz: -6, t: 0, said: true });
    W3.remove(G.mesh); S.goober = null;
    S.stats.zapped++;
  }
  ctx.recorder.event('slimeRoundEnd', { wipes: R.wipes, spat: R.spat, t: +R.t.toFixed(1) });
}

// ---------- score card (DOM, big buttons) ----------

const UI_STYLE = `
.sp-ui { position: fixed; inset: 0; z-index: 4; pointer-events: none; font-family: ui-rounded, system-ui, sans-serif; color: #fff; }
.sp-score { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
  overflow-y: auto; box-sizing: border-box; padding: 16px; border-radius: 28px; background: rgba(13,10,42,.9); border: 4px solid #5ee0ff; text-align: center; pointer-events: auto; }
.sp-score[hidden] { display: none; }
.sp-score .mt { font-size: clamp(16px, 3vmin, 24px); opacity: .85; font-weight: 800; }
.sp-score .stars { font-size: clamp(40px, 10vmin, 80px); line-height: 1.1; }
.sp-score .stars .off { opacity: .25; filter: grayscale(1); }
.sp-score .head { display: flex; align-items: center; justify-content: center; gap: 12px; }
.sp-score .pts { font-size: clamp(54px, 14vmin, 120px); font-weight: 900; line-height: 1; color: #5ee0ff; text-shadow: 0 5px 0 rgba(0,0,0,.3); }
.sp-score .lbl { font-size: clamp(18px, 4vmin, 30px); font-weight: 900; text-align: left; }
.sp-score .faces { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 4px; margin: 6px 0; }
.sp-score .row { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; font-size: clamp(18px, 4vmin, 30px); font-weight: 900; margin: 6px 0; }
.sp-score .stamp { display: inline-block; border: 5px solid #ff5ea8; color: #ff5ea8; border-radius: 14px; padding: 2px 12px; transform: rotate(-7deg); font-weight: 900; font-size: clamp(18px, 4vmin, 30px); }
.sp-score .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }
.sp-score .btns button { font: inherit; font-weight: 900; font-size: clamp(20px, 4vmin, 30px); color: #fff; border-radius: 22px; padding: 14px 18px; min-width: 150px;
  border: 4px solid rgba(255,255,255,.6); background: #ff5ea8; box-shadow: 0 6px 0 rgba(0,0,0,.3); cursor: pointer; }
.sp-score .btns button:nth-child(2) { background: #4d8dff; }
.sp-score .btns button:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,.3); }
.sp-score .btns .em { font-size: 1.5em; display: block; }
`;

function createUI() {
  const style = document.createElement('style'); style.textContent = UI_STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'sp-ui';
  root.innerHTML = `<div class="sp-score" hidden><div class="mt">Rescue Run · Sector 1</div><div class="stars"></div>
    <div class="head"><div class="pts">0</div><div class="lbl">friends<br>rescued!</div></div><div class="faces"></div>
    <div class="row"><span class="zapped"></span><span class="new"></span><span class="score"></span></div><div class="boss"></div>
    <div class="btns"><button class="again"><span class="em">🔁</span>Again</button><button class="pass"><span class="em">🛂</span>Passport</button></div></div>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  $('.again').onclick = () => { ctx.sfx.play('tap'); startMission(); };
  $('.pass').onclick = () => { ctx.sfx.play('tap'); hideScore(); passUI.open(S.stats.newFriends.length ? parseId(S.stats.newFriends[S.stats.newFriends.length - 1]).shape : null); };
  return { root, $, destroy() { root.remove(); style.remove(); } };
}

function showScore() {
  const { $ } = ui, st = S.stats;
  $('.sp-score').hidden = false;
  $('.stars').innerHTML = [1, 2, 3].map((k) => `<span class="${k <= S.stars ? '' : 'off'}">⭐</span>`).join('');
  const faces = $('.faces'); faces.textContent = '';
  for (const id of st.rescuedIds.slice(0, 18)) faces.append(friendEl(id, { size: 46 }));
  if (st.rescuedIds.length > 18) faces.append(Object.assign(document.createElement('div'), { textContent: `+${st.rescuedIds.length - 18}`, style: 'align-self:center;font-weight:900' }));
  $('.zapped').textContent = `👾 ${st.zapped} zapped`;
  $('.new').textContent = st.newFriends.length ? `🛂 ${st.newFriends.length} new friends!` : '🛂 passport';
  $('.score').textContent = `⭐ ${fmt(S.score)}`;
  $('.boss').innerHTML = st.bossDefeated ? '<span class="stamp">🦀 CRAB-TANK DEFEATED!</span>' : '';
  $('.pts').textContent = '0';
}
function hideScore() { ui && (ui.$('.sp-score').hidden = true); }

// ---------- readouts / export (🔧) ----------

function readouts() {
  const gs = ctx.gestures, st = gs.steer, s = S.stats;
  const b = ctx.body(), rec = ctx.recorder, B = S.boss;
  return [
    `steer  ${st.value >= 0 ? '+' : ''}${st.value.toFixed(2)} ${st.mode}  raw ${st.raw.toFixed(2)} · ship x ${S.px.toFixed(1)}${fake || gs.simLean != null ? ' (sim keys)' : ''}`,
    `aim    ${S.lock ? `LOCK ${S.lock.kind}` : 'no target'} · assist ${set.aimAssist.toFixed(2)} · ${set.fireRate}/s · punch ${gs.punch?.value?.toFixed?.(2) ?? '-'}`,
    `moves  run ${gs.run.intensity.toFixed(2)} ${gs.run.state} · duck ${S.duck.toFixed(2)} · hop ${S.hop.toFixed(1)} · turn ${gs.turn.toFixed(2)} · dizzy ${S.dizzyT.toFixed(1)} s`,
    `mission ${S.phase} ${S.missionT.toFixed(0)}/${S.missionLen} s · round ${S.round ? `${S.round.num} ${S.round.kind}${S.round.n ? ` ×${S.round.n}` : ''}${S.round.teach ? ` (${S.round.teach})` : ''}` : '-'}/${S.rounds.length} · waves ${s.waves} · on screen ${S.enemies.length} bad, ${S.friends.length} friends${S.away ? ' · AWAY (paused)' : ''}`,
    `score  ${fmt(S.score)} · zapped ${s.zapped} · rescued ${s.rescued} (${s.rescuedWaves}/${s.offered} in waves, ${s.carriedOff} carried off) · combo ×${S.combo}`,
    `body   boops ${s.boops} · dizzy spins ${s.rolls} (${s.rollZaps} dizzy zaps) · hops ${s.hops} · ducks ${s.ducked} (${s.duckWaited} after a wait, ${s.floatedOver} floated over) · blasts ${s.punches} · wipes ${s.wipes}`,
    B ? `boss   ${B.phase === 1 ? `arms L${B.armHp[0]} R${B.armHp[1]} low=${B.armSide ? 'R' : 'L'}${B.swap ? ' SWAP' : ''} ${B.armT.toFixed(0)}/${set.armSwap}s` : `heart ${B.hp}/${B.maxHp}`} · ${B.attack ? `attack ${B.attack.kind}/${B.attack.stage}` : `next ${B.nextAttack.toFixed(1)} s`} · dodges ${s.dodges} hits ${s.hits}` : 'boss   (after the waves)',
    `passport ${passportStats(passport).count} friends · ${s.newFriends.length} new this mission`,
    `zone ${b.zone}  tier ${ctx.perf.tier.name}  fps ${ctx.perf.fps.toFixed(0)} · recording ${rec.rows.length} rows${rec.full ? ' (full)' : ''}`,
  ].join('\n');
}

function exportFile() {
  const rec = ctx.recorder;
  if (!rec.rows.length && !rec.events.length) return null;
  const st = S.stats;
  return rec.download({
    trueCount: null, expected: 'session',
    game: '07-space-pilot', release: ctx.release,
    preset: tuning.preset, settings: { ...set },
    note: (tuning.notes || '').trim() || null,
    summary: {
      mission: MISSION, phase: S.phase, score: Math.round(S.score), stars: S.stars ?? null,
      rescued: st.rescued, rescuedWaves: st.rescuedWaves, offered: st.offered, carriedOff: st.carriedOff, newFriends: st.newFriends, passportTotal: passportStats(passport).count,
      zapped: st.zapped, dizzyZaps: st.rollZaps, boops: st.boops, dizzySpins: st.rolls, hops: st.hops, ducks: { ducked: st.ducked, waited: st.duckWaited, floatedOver: st.floatedOver, crouches: st.ducks, windows: st.duckLog },
      punches: st.punches, wipes: st.wipes, boss: { defeated: st.bossDefeated, time: +st.bossTime.toFixed(1), dodges: st.dodges, hits: st.hits },
      steer: { ...Object.fromEntries(Object.entries(st.steer).map(([k, v]) => [k, +(+v).toFixed(2)])), leans: ctx.gestures.steer.count },
      leaves: st.leaves,
    },
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// screen spots of dizzy heads (stars circle them)
function dizzyMarks() {
  const out = [];
  for (const e of S.enemies) if (e.dizzy > 0 && !e.dead) { const p = W3.screenOf(e.mesh, W(), H(), 1.6); if (!p.behind) out.push({ x: p.x, y: p.y - p.r, r: p.r, seed: e.wob }); }
  if (S.boss && S.boss.dizzy > 0 && S.phase === 'boss') { const p = W3.screenOf(S.boss.mesh.userData.domeGroup, W(), H(), 2.2); if (!p.behind) out.push({ x: p.x, y: p.y - p.r, r: p.r * 1.3, seed: 1 }); }
  return out;
}

function trackStats(dt) {
  const st = ctx.gestures.steer, s = S.stats.steer;
  if (st.value < -0.15) s.left += dt; else if (st.value > 0.15) s.right += dt; else s.straight += dt;
  if (st.mode === 'arms') s.arms += dt; else if (st.mode === 'lean') s.lean += dt;
  s.maxAbs = Math.max(s.maxAbs, Math.abs(st.value));
}

// ---------- test helpers ----------

function freeAll() {
  for (const c of [...S.cages]) if (c.state === 'carried' || c.state === 'loose') popCage(c, 'test');
  for (const r of [...S.rocks]) if (r.kind === 'friend') breakRock(r);
}
function bossNextPhase() {
  if (S.phase !== 'boss') { if (!S.boss) jumpToBoss(); else if (S.phase === 'bossIntro') S.phaseT = 99; return; }
  const B = S.boss;
  B.pause = 0; B.swap = null;
  if (B.phase === 1) { B.armHp[B.armSide] = 0; breakArm(B.armSide); }
  else { B.hp = 0; bossPhaseDone(); }
}

// ---------- the game ----------

function applySettings(s) {
  set = s; applyCore(s, ctx.gestures);
  W3?.setStars({ size: s.starSize, bright: s.starBright });
  if (S?.duckLatch) S.duckLatch.config.duckDown = s.duckDepth; // live: 🔧 Duck dip depth
}

game = {
  needs: ['pose', 'motion'],
  showCamera: false,
  background: '#0b0824',

  init(c) {
    ctx = c;
    saidAt = {};
    tuning = loadTuning();
    applySettings(tuning.settings);
    passport = loadPassport();
    W3 = createWorld3D({ tier: ctx.perf.tier.name });
    W3.setStars({ size: set.starSize, bright: set.starBright });
    ui = createUI();
    passUI = createPassport({ passport, say: (t) => ctx.say(t), onClose: () => { if (S.phase === 'end') showScore(); } });
    ctx.recorder.start({ station: 'space-pilot', title: 'Space Pilot', maxRows: 30 * 60 * 10 });
    S = null;
    hud.reset();
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.space = { game, startMission, endMission, addSlime, startWipe, spawnRock, doublBlast, spawnWave, jumpToBoss, bossNextPhase, freeAll, dizzySpin, talk, get S() { return S; }, get set() { return set; }, W3, passport }; }
    startMission();

    panel = createTuning({
      ctx, tuning,
      onChange: (s) => applySettings(s),
      readouts,
      graph: () => ({
        v: (ctx.gestures.steer.value + 1) / 2, aura: ctx.gestures.steer.mode === 'arms',
        lines: [{ v: (1 + ctx.gestures.steerConfig.deadzone) / 2, show: `deadzone ±${ctx.gestures.steerConfig.deadzone.toFixed(2)}`, color: '#ffcc33' }, { v: (1 - ctx.gestures.steerConfig.deadzone) / 2, show: '', color: '#ffcc33' }],
      }),
      exportFile,
      exportBook: () => { const name = `space-pilot-passport-${new Date().toISOString().slice(0, 10)}.json`; download(name, passport.exportJSON()); return `saved ${name} (${passport.count} friends)`; },
      importBook: (text) => { const n = passport.importJSON(text); passUI.render(); return `imported: ${n} new friends (now ${passport.count})`; },
      actions: [
        { label: '👾 Wave', fn: () => spawnWave() },
        { label: '🫧 Free all', fn: () => freeAll() },
        { label: '🦀 Boss', fn: () => jumpToBoss() },
        { label: '⏭ Boss phase', fn: () => bossNextPhase() },
        { label: '⏹ End', fn: () => endMission() },
        { label: '🔁 Again', fn: () => startMission() },
        { label: '🛂 Passport', fn: () => passUI.open() },
      ],
    });

    const g = ctx.gestures;
    g.on('jump', () => { tutorDone('jump'); });
    g.on('jump', () => {
      S.stats.hops++; panel.mark('hop', '#7dff6a');
      if (S.phase === 'end') return;
      S.hop = 1.0;
      ctx.sfx.whoosh();
      banner('⚡ HYPERSPACE!', { color: '#5ee0ff', life: 1.2, key: 'hop' });
      sayMaybe(pick(['Hyperspace!', 'Zoom!']), { gap: 4, key: 'hop' });
      ctx.recorder.event('hop', {});
    });
    g.on('crouch', () => { S.stats.ducks++; panel.mark('duck', '#5ec8ff'); S.duckLatch?.mark('crouch', ctx.time); });
    g.on('turn', () => { panel.mark('turn', '#b48cff'); dizzySpin('turn'); });
    g.on('spin', () => { panel.mark('spin', '#b48cff'); dizzySpin('spin'); });
    g.on('punch', (e) => { if (S.phase !== 'end' && S.phase !== 'intro') { doublBlast(e); tutorDone('punch'); } });
    g.on('run', () => { sayMaybe('Thrusters!', { gap: 8, key: 'run' }); ctx.sfx.play('engine', { vol: 0.7 }); });
    g.on('lean', (d) => { S.stats.steer.leans++; tutorDone('lean'); panel.mark(d.side === 'left' ? '◀' : '▶', '#5ec8ff'); });
    g.on('leave', () => { S.away = true; S.stats.leaves++; if (S.phase !== 'end') ctx.say("Captain? Where did you go? I'll wait!"); });
    g.on('return', () => { if (!S.away) return; S.away = false; if (S.phase !== 'end') ctx.say("There you are, Captain! Let's fly!"); });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      if (!debugOn && !ctx.testinput.active) return;
      const k = e.key;
      if (k === '1') spawnWave();
      else if (k === '2') freeAll();
      else if (k === '3') jumpToBoss();
      else if (k === '4') bossNextPhase();
      else if (k === '5') endMission();
      else if (k === '6') addSlime(rand(0.3, 0.7) * ctx.W, rand(0.3, 0.6) * ctx.H, Math.min(ctx.W, ctx.H) * 0.08);
      else if (k === '7') startWipe();
      else if (k === '8') spawnRock('duck');
      else if (k === '9') { if (passUI.isOpen) passUI.close(); else { hideScore(); passUI.open(); } }
    };
    addEventListener('keydown', onKey);
  },

  update(dt) {
    S.phaseT += dt;
    for (const b of S.banners) b.t += dt;
    S.banners = S.banners.filter((b) => b.t < b.life);
    if (passUI.isOpen) { panel.update(dt); return; } // the world waits while the passport is open
    updateDizzy(dt);
    const wdt = dt * S.slow; // the barrel roll's slow-motion moment
    updateMission(wdt);
    updateShip(dt);
    if (S.phase === 'waves' || S.phase === 'boss') trackStats(dt);
    updateFormations(wdt);
    updateBoss(wdt);
    updateGoos(wdt);
    updateSlimeRound(wdt);
    updateRocks(wdt);
    updateCagesFriends(wdt);
    updatePods(wdt);
    const targets = collectTargets();
    updateAim(dt, targets);
    fire(dt);
    updateBolts(dt);
    updateGlass(dt);
    for (const k of S.streaks) k.t += dt;
    S.streaks = S.streaks.filter((k) => k.t < 0.8);
    updateTutor(dt);
    if (S.talk) S.talk.t += dt;
    for (const f of S.thanks) f.t += dt;
    if (S.cue) { S.cue.t += dt; if (S.cue.t > S.cue.life) S.cue = null; }
    for (const p of S.pops) p.t += dt;
    S.pops = S.pops.filter((p) => p.t < 0.9);
    for (const f of S.flyers) { f.t += dt; if (f.t >= f.dur && !f.landed) { f.landed = true; landFriend(f.id); } }
    S.flyers = S.flyers.filter((f) => !f.landed);
    S.shown += (S.score - S.shown) * Math.min(1, dt * 6);
    if (Math.abs(S.score - S.shown) < 1) S.shown = S.score;
    W3.tick(wdt, S.speed);
    if (S.phase === 'end') {
      const k = Math.min(1, S.phaseT / 1.4);
      ui.$('.pts').textContent = String(Math.round(S.stats.rescued * (1 - (1 - k) ** 3)));
    }
    // tracking feedback lives on the comms screen; the voice says it now and then
    const seen = hud.trackingState(ctx, S, set.playDistance);
    const ducking = S.rocks.some((r) => r.kind === 'duck' && r.warned && !r.passed);
    if (S.phase !== 'end' && !seen.ok && !(ducking && seen.kind === 'close')) sayMaybe(seen.say, { gap: 10, key: 'zone' });
    panel.update(dt);
  },

  draw(g) {
    const w = ctx.W, h = ctx.H;
    const st = ctx.gestures.steer;
    const hopK = S.hop > 0 ? Math.sin((1 - S.hop) * Math.PI) : 0;
    W3.setCamera({
      x: S.px, y: S.py, roll: -st.value * 0.05 * (S.phase === 'end' ? 0 : 1) + (S.rattle > 0 ? Math.sin(ctx.time * 60) * 0.02 : 0), // v1.1: no screen rotation on spin, only a hint of bank
      yaw: -S.vx * 0.012, pitch: 0, fov: 70 + hopK * 30 + ctx.gestures.run.intensity * 8, shake: S.shake * 0.5 + S.rattle * 0.4, aspect: w / h,
    });
    g.drawImage(W3.render(w, h, Math.min(ctx.view.dpr, isLow() ? 1 : 1.5)), 0, 0, w, h);
    hud.drawAll(g, ctx, S, { set, passport, rolling: rolling(), W3, MOVES, dizzy: dizzyMarks(), hudScale: set.hudSize });
  },

  destroy() {
    if (onKey) removeEventListener('keydown', onKey);
    onKey = null;
    panel?.destroy(); panel = null;
    passUI?.destroy(); passUI = null;
    ui?.destroy(); ui = null;
    W3?.dispose(); W3 = null;
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.space; }
  },
};

// test controls: ⏭ = next wave (or the boss's next phase), 🏁 = straight to the boss
game.debugSkip = {
  next: () => { if (S.phase === 'waves' || S.phase === 'intro') { if (S.phase === 'intro') setPhase('waves'); startRound(S.roundI + 1); } else bossNextPhase(); },
  finale: () => jumpToBoss(),
};

export default game;
