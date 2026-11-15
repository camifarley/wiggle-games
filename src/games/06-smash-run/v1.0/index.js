// 06 · Smash Run v1.0: run in place to charge down a 3D canyon, smash everything that rolls at you.
// Brief: docs/briefs/06-smash-run.md. Body tracking only (pose): run.js + punch.js in the core.
//
// Forgiving by design: a punch smashes whatever is closest in the last `smashWindow` s (auto-aim),
// jumping is a ground pound, a spin is a tornado, running hard turns on a power aura. The only way to get
// bonked is to stand still, and the bonk is the funniest thing in the game (never a punishment).
//
// Debug (?debug): hold R = run, tap R = walk, X = punch, J = jump, C = crouch, S = spin, P = peekaboo,
// L = leave/return, Z = too close. Game keys: 1-5 = go to world (5 = MEGA BOULDER), 6 = free run after the
// finale, G = troll round, B = bonk now. The 🔧 panel is always there (no ?debug needed).

import { createWorld3D, WORLDS, KINDS } from './world3d.js';
import { loadTuning, applyCore } from './settings.js';
import { createTuning } from './tuning.js';

const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const fake = params.has('fakecam');
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ALL_KINDS = Object.keys(KINDS);

const WORDS = {
  boulder: ['SMASH!', 'CRUNCH!', 'KA-BOOM!', 'BOOM!'], golden: ['GOLD!', 'SHINY!'], pumpkin: ['SPLAT!', 'SQUISH!'],
  scarecrow: ['STRAW!', 'POOF!'], snowball: ['POOF!', 'SNOW!'], snowman: ['NOSE!', 'BRRR!'], ice: ['CRACK!', 'SHATTER!'],
  pinata: ['CANDY!', 'PIÑATA!'], gumball: ['POP!', 'BOING!'], cupcake: ['YUM!', 'SPLOOSH!'],
};
const BONK_LINES = ['Oops! Sorry!', 'Knock knock!', 'Bonk! Hello in there!', 'Oopsie! I did not see you!', 'Excuse me! Coming through!'];

let ctx, S, W3, set, tuning, panel, onKey;

function fresh() {
  return {
    t: 0, world: 0, worldT: 0, freeRun: false, speed: 0, dist: 0, score: 0, shown: 0, smashes: 0, gems: 0, bonks: 0,
    objs: [], spawnAcc: 0, chains: new Map(), chainId: 0, chainRecord: 0, chainShow: null,
    meter: 0, power: 0, still: 0, bonkT: 0, bonk: null, lastAction: -9, away: false, hiding: false, hideT: 0,
    troll: null, trollClock: 0, hardRun: 0, mega: null, banner: null, tornado: 0, pound: null,
    zoneT: 0, zoneSaid: -99, saidAt: {}, introT: 0, punchedOnce: false, lastStep: 0,
    gloveTarget: { left: null, right: null }, rings: [],
    stats: {
      smashes: 0, bonks: 0, punches: 0, punchesInWindow: 0, punchesMissed: 0, jumps: 0, spins: 0, crouches: 0, peekaboos: 0,
      ducks: 0, bumped: 0, scared: 0, chains: [], chainRecord: 0, powerModes: 0, trollRounds: 0, trollWakes: 0, gems: 0,
      worldTime: {}, runTime: { idle: 0, walking: 0, running: 0 }, maxIntensity: 0, maxSpeed: 0, distance: 0, score: 0,
      smashBy: {}, megaSmashed: false, leaves: 0,
    },
  };
}

// ---------- helpers ----------

const run = () => ctx.gestures.run;
const kindsNow = () => (S.freeRun ? ALL_KINDS : WORLDS[S.world].kinds);
const auraOn = () => S.power > 0 || run().intensity >= set.auraAt;
function sayMaybe(text, { chance = 1, gap = 4, key = text, interrupt = false } = {}) {
  if (Math.random() > chance || S.t - (S.saidAt[key] ?? -99) < gap) return;
  S.saidAt[key] = S.t;
  ctx.say(text, { interrupt });
}
function addScore(n) { S.score += n; S.stats.score = S.score; }
function screenOf(o) {
  const p = o.mesh.position;
  return W3.toScreen(p.x, p.y + (o.mesh.userData.centerY || 0), p.z, ctx.W, ctx.H);
}
function approachOf(o) {
  if (S.away) return 0;
  if (S.hiding) return 0.8;
  const I = run().intensity;
  const K = KINDS[o.kind];
  const kf = K.walks ? 0.75 : K.slides ? 1.15 : K.grows ? 1.05 : 1;
  // boulders roll slower when he runs slowly: tired legs still win
  const roll = o.bonker ? set.boulderSpeed * 1.3 : set.boulderSpeed * kf * (0.45 + 0.55 * clamp(I / Math.max(0.1, ctx.gestures.runConfig.runAt), 0, 1));
  return roll + S.speed;
}
const ttiOf = (o) => Math.max(0, -(o.z + o.r)) / Math.max(0.5, approachOf(o));

// ---------- objects ----------

function newChain() { const id = ++S.chainId; S.chains.set(id, { id, count: 0, alive: 0 }); return id; }

function spawn(kind, level, { x = (Math.random() - 0.5) * 4.8, z = -72 - Math.random() * 10, chain = null, bonker = false, roll = null } = {}) {
  const mesh = W3.makeSmashable(kind, level);
  const r = mesh.userData.r;
  const o = { kind, level, mesh, r, x, z, y: mesh.userData.baseY, chain: chain ?? newChain(), bonker, dead: false, targeted: false,
    gold: !!KINDS[kind].gold, aside: 0, hop: 0, scatter: null, grow: 1, wob: Math.random() * 6, rollBoost: roll };
  S.chains.get(o.chain).alive++;
  mesh.position.set(x, o.y, z);
  mesh.rotation.y = (Math.random() - 0.5) * 0.6;
  S.objs.push(o);
  return o;
}

function removeObj(o, smashed) {
  if (o.removed) return;
  o.removed = true;
  W3.remove(o.mesh);
  const ch = S.chains.get(o.chain);
  if (ch) { ch.alive--; if (!smashed) checkChainEnd(ch); }
}

function checkChainEnd(ch) {
  if (ch.alive > 0) return;
  S.chains.delete(ch.id);
  if (ch.count >= 3) {
    const bonus = ch.count * ch.count * 10;
    addScore(bonus);
    S.chainShow = { n: ch.count, t: 0, bonus };
    S.stats.chains.push(ch.count);
    ctx.fx.confetti(40 + ch.count * 6);
    ctx.sfx.tada();
    ctx.say(`Chain smash ${ch.count}!`, { interrupt: false });
    ctx.recorder.event('chain', { n: ch.count, bonus });
  }
  if (ch.count > S.chainRecord) { S.chainRecord = ch.count; S.stats.chainRecord = ch.count; }
}

function smash(o, how) {
  if (o.dead) return;
  o.dead = true;
  const K = KINDS[o.kind];
  const ch = S.chains.get(o.chain);
  ch.count++;
  S.smashes++; S.stats.smashes++;
  S.stats.smashBy[how] = (S.stats.smashBy[how] || 0) + 1;
  const power = S.power > 0;
  const pts = Math.round(K.points * o.level * (o.gold ? 5 : 1) * (power ? 2 : 1) * Math.min(ch.count, 25));
  addScore(pts);
  const p = o.mesh.position, cy = p.y + (o.mesh.userData.centerY || 0);
  const amount = set.debris * (power ? 1.5 : 1);
  const n = Math.round((10 + 12 * o.level) * amount * ctx.perf.settings.particles + 4);
  W3.debris(p.x, cy, p.z, { count: n, colors: K.colors, speed: (4 + o.level * 2) * Math.sqrt(amount), size: 0.1 + 0.07 * o.level });
  if (o.kind === 'pumpkin') W3.debris(p.x, cy, p.z, { count: Math.round(n / 2), colors: ['#fff3c4', '#ffe9a8'], speed: 7, size: 0.07 });
  if (o.kind === 'snowman') W3.debris(p.x, cy + o.r, p.z, { count: 1, colors: ['#ff8a1f'], speed: 3, size: 0.5, up: 9 });
  if (o.kind === 'pinata') { W3.debris(p.x, cy, p.z, { count: Math.round(n * 1.5), colors: K.colors, speed: 8, size: 0.09, up: 7 }); ctx.fx.confetti(25); }
  const s = screenOf(o);
  const u = Math.min(ctx.W, ctx.H);
  if (!s.behind) {
    ctx.fx.burst(s.x, s.y, { count: 10 + o.level * 8, speed: 420 + o.level * 120, size: 8, color: pick(K.colors) });
    ctx.fx.text(s.x, s.y - u * 0.05, o.gold ? 'GOLD ×5!' : pick(WORDS[o.kind]), { size: u * (0.06 + o.level * 0.025), color: o.gold ? '#ffd23f' : '#fff', life: 0.9 });
    ctx.fx.text(s.x, s.y + u * 0.05, `+${fmt(pts)}`, { size: u * 0.045, color: '#ffcc33', life: 0.9 });
  }
  ctx.fx.shake(3 + o.level * 4 * Math.min(1.5, amount));
  if (o.level >= 3) ctx.sfx.boom(); else if (o.level === 2) (o.kind === 'pumpkin' ? ctx.sfx.splat() : ctx.sfx.boom()); else (o.kind === 'pumpkin' || o.kind === 'cupcake' ? ctx.sfx.splat() : ctx.sfx.pop());
  setTimeout(() => ctx?.sfx.squeak(0.8 + Math.min(ch.count, 20) * 0.08), 60);
  // split into smaller pieces that keep rolling at you (same chain: the counter climbs)
  const pieces = Math.round(set.splitCount);
  if (o.level > 1 && pieces > 0) {
    for (let i = 0; i < pieces; i++) {
      spawn(o.kind === 'golden' ? 'boulder' : o.kind, o.level - 1, {
        x: clamp(o.x + (i - (pieces - 1) / 2) * 1.4 + (Math.random() - 0.5) * 0.4, -2.8, 2.8),
        z: Math.min(o.z - 5 - Math.random() * 4, -9), chain: o.chain,
      });
    }
  }
  ctx.recorder.event('smash', { kind: o.kind, level: o.level, how, chain: ch.count, pts });
  removeObj(o, true);
  checkChainEnd(ch);
  if (how === 'punch') sayMaybe(pick(['SMASH!', 'Smash!', 'Pow!', 'Crunch!']), { chance: 0.25, gap: 5, key: 'smash' });
}

// a punch / any big move: the nearest thing in the smash window explodes (auto-aim)
function punch(hand, x) {
  S.lastAction = S.t; S.still = 0;
  S.stats.punches++;
  panel?.mark('punch', '#ffcc33');
  const side = x == null ? (hand === 'right' ? 'right' : 'left') : x < 0.5 ? 'left' : 'right';
  const sides = hand === 'both' ? ['left', 'right'] : [side];
  for (const sd of sides) W3.gloves[sd].userData.punchT = 0;
  ctx.sfx.whoosh();
  if (!S.punchedOnce) { S.punchedOnce = true; }
  if (S.mega?.active) { W3.shoot(W3.gloveWorldPos(sides[0]), W3.mega, () => chipMega(hand === 'both' ? 2 : 1)); return; }
  const live = S.objs.filter((o) => !o.dead && !o.targeted && !o.aside && !o.hop && !o.scatter && o.z < -0.3);
  let best = null, bt = Infinity;
  for (const o of live) { const tt = ttiOf(o); if (tt < bt) { bt = tt; best = o; } }
  const inWindow = best && bt <= set.smashWindow;
  if (best && (inWindow || bt <= set.smashWindow * 2)) {
    if (inWindow) S.stats.punchesInWindow++;
    const targets = [best];
    if (hand === 'both') { // two fists: smash the next one too
      const second = live.filter((o) => o !== best && ttiOf(o) <= set.smashWindow * 2).sort((a, b) => ttiOf(a) - ttiOf(b))[0];
      if (second) targets.push(second);
    }
    targets.forEach((o, i) => { o.targeted = true; W3.shoot(W3.gloveWorldPos(sides[i % sides.length]), o.mesh, () => smash(o, 'punch')); });
  } else {
    // nothing close: still a big reaction (and a few points for the effort)
    S.stats.punchesMissed++;
    const u = Math.min(ctx.W, ctx.H);
    ctx.fx.text(ctx.W * (side === 'left' ? 0.38 : 0.62), ctx.H * 0.55, pick(['WHOOSH!', 'HI-YA!', 'POW!']), { size: u * 0.06, color: '#fff' });
    ctx.fx.burst(ctx.W * (side === 'left' ? 0.38 : 0.62), ctx.H * 0.6, { count: 10, speed: 300, size: 6, color: '#ffe14d' });
    addScore(5);
  }
}

function groundPound() {
  S.lastAction = S.t; S.still = 0;
  S.stats.jumps++;
  panel?.mark('jump', '#7dff6a');
  S.pound = { t: 0 };
  ctx.sfx.boom();
  ctx.fx.shake(14);
  sayMaybe('Ground pound!', { chance: 0.5, gap: 8 });
  if (S.mega?.active) { chipMega(2); return; }
  for (const o of S.objs) if (!o.dead && !o.scatter && !o.aside && (ttiOf(o) <= set.smashWindow * 1.3 || o.z > -12)) smash(o, 'jump');
}

function tornado() {
  S.lastAction = S.t; S.still = 0; S.hiding = false;
  S.stats.spins++;
  S.tornado = 1.4;
  ctx.sfx.whoosh(); setTimeout(() => ctx?.sfx.whoosh(), 150);
  ctx.say('Tornado smash!');
  if (S.mega?.active) { chipMega(3); return; }
  for (const o of S.objs) if (!o.dead && o.z > -65) smash(o, 'tornado');
}

// ---------- bonk (standing still) ----------

function bonk(o) {
  S.bonks++; S.stats.bonks++;
  panel?.mark('bonk', '#ff5ea8');
  const K = KINDS[o.kind];
  const cracks = [];
  const cx = 0.5 + (Math.random() - 0.5) * 0.2, cy = 0.42;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const pts = [[cx, cy]];
    let x = cx, y = cy;
    for (let k = 0; k < 4; k++) { x += Math.cos(a + (Math.random() - 0.5) * 0.7) * 0.07; y += Math.sin(a + (Math.random() - 0.5) * 0.7) * 0.09; pts.push([x, y]); }
    cracks.push(pts);
  }
  S.bonk = { t: 0, kind: o.kind, color: K.colors[0], cracks, cx, cy, line: pick(BONK_LINES) };
  removeObj(o, false);
  ctx.sfx.tone(140, 0.12, 'square', 0.3); ctx.sfx.boing();
  for (let i = 0; i < 9; i++) setTimeout(() => ctx?.sfx.squeak(1.7 - i * 0.13), 500 + i * 140); // slide whistle
  ctx.fx.shake(20);
  setTimeout(() => ctx?.say(S.bonk?.line || 'Oops!'), 250);
  ctx.recorder.event('bonk', { kind: o.kind });
}

// ---------- worlds, finale, troll ----------

function clearObjects(how = 'bonus') {
  for (const o of S.objs.slice()) { if (how === 'bonus') smash(o, 'bonus'); else removeObj(o, false); }
  S.objs = [];
}

function goWorld(i, { silent = false } = {}) {
  if (S.troll) endTroll(true);
  clearObjects(silent ? 'remove' : 'bonus');
  S.world = clamp(i, 0, WORLDS.length - 1);
  S.worldT = 0;
  S.mega = null;
  W3.mega.visible = false;
  S.freeRun = false;
  const w = WORLDS[S.world];
  W3.setWorld(w);
  S.banner = { t: 0, text: `World ${w.n}`, sub: w.name };
  ctx.recorder.event('world', { n: w.n });
  if (!silent) { ctx.sfx.tada(); ctx.fx.confetti(80); }
  if (w.n === 5) {
    S.mega = { active: true, hits: 0, t: 0, auraT: 0, z: -40 };
    W3.mega.userData.cracks.clear();
    W3.mega.visible = true;
    W3.mega.position.set(0, 0, -40);
    ctx.say('The MEGA BOULDER! Smash it ten times!');
  } else if (!silent) ctx.say(`World ${w.n}! ${w.name}!`);
}

function chipMega(n = 1) {
  const m = S.mega;
  if (!m?.active) return;
  for (let k = 0; k < n && m.hits < 10; k++) m.hits++;
  W3.megaCrack(m.hits);
  m.pulse = 1;
  const p = W3.mega.position;
  W3.debris(p.x + (Math.random() - 0.5) * 4, 5 + (Math.random() - 0.5) * 4, p.z + 5, { count: Math.round(30 * set.debris), colors: KINDS.boulder.colors, speed: 9, size: 0.3 });
  ctx.fx.shake(12); ctx.sfx.boom();
  addScore(200 * m.hits);
  S.smashes++; S.stats.smashes++;
  const u = Math.min(ctx.W, ctx.H);
  ctx.fx.text(ctx.W / 2, ctx.H * 0.35, `${m.hits}!`, { size: u * 0.22, color: '#ffcc33', life: 1 });
  ctx.say(m.hits >= 10 ? 'Ten!' : String(m.hits));
  if (m.hits >= 10) setTimeout(megaExplode, 350);
}

function megaExplode() {
  if (!S.mega?.active) return;
  S.mega.active = false;
  W3.mega.visible = false;
  S.stats.megaSmashed = true;
  const p = W3.mega.position;
  const colors = ALL_KINDS.flatMap((k) => KINDS[k].colors);
  for (let i = 0; i < 4; i++) W3.debris(p.x, 5, p.z + 4, { count: Math.round(120 * set.debris * ctx.perf.settings.particles), colors, speed: 16, size: 0.35, up: 8 });
  ctx.fx.confetti(320); ctx.fx.shake(34); ctx.sfx.boom(); setTimeout(() => ctx?.sfx.tada(), 300);
  addScore(5000);
  ctx.recorder.event('mega', {});
  S.banner = { t: 0, text: 'MEGA SMASH!', sub: 'Free run!' };
  ctx.say('MEGA SMASH! You did it! Free run!');
  S.freeRun = true;
  // it explodes into every smashable from every world
  ALL_KINDS.forEach((k, i) => spawn(k, KINDS[k].levels, { z: -18 - i * 4, x: (Math.random() - 0.5) * 4.5 }));
}

function startTroll() {
  if (S.troll || S.mega?.active) return;
  clearObjects('remove');
  S.troll = { t: 0, progress: 0, wakes: 0, awake: 0, sneezeT: -1, snoreT: 1, done: 0, light: 1 };
  S.trollClock = 0; S.hardRun = 0;
  S.stats.trollRounds++;
  W3.troll.visible = true;
  W3.troll.position.set(0, 0, -30);
  W3.trollEyes(false);
  for (let i = 0; i < 10; i++) { const g = W3.makeGem(); g.position.set(Math.sin(i * 1.7) * 1.3, 0.8, -4 - i * 2.4); W3.gems.push(g); }
  S.banner = { t: 0, text: 'Shhh…', sub: 'Sleeping rock troll' };
  ctx.recorder.event('troll', { phase: 'start' });
  ctx.say('Shhh! A sleeping rock troll! Walk very slowly and quietly to get the gems!');
}

function endTroll(silent = false) {
  const tr = S.troll;
  if (!tr) return;
  S.troll = null;
  for (const g of W3.gems) W3.scene.remove(g);
  W3.gems.length = 0;
  W3.troll.visible = false;
  W3.setLight(1);
  ctx.recorder.event('troll', { phase: 'end', wakes: tr.wakes });
  if (silent) return;
  addScore(500); S.gems += 3; S.stats.gems += 3;
  ctx.fx.confetti(120); ctx.sfx.tada();
  ctx.say('You snuck past the troll! Hooray! Now run!');
}

function updateTroll(dt) {
  const tr = S.troll;
  tr.t += dt;
  const I = run().intensity;
  tr.light += ((tr.awake > 0 ? 0.6 : 0.3) - tr.light) * Math.min(1, dt * 2);
  if (tr.done > 0) { tr.done += dt; W3.troll.position.x += dt * 6; tr.light += (1 - tr.light) * dt * 2; if (tr.done > 1.6) endTroll(); else W3.setLight(tr.light); return; }
  W3.setLight(tr.light);
  if (tr.awake > 0) {
    tr.awake -= dt;
    if (tr.sneezeT >= 0) {
      tr.sneezeT -= dt;
      if (tr.sneezeT < 0) {
        ctx.sfx.sneeze();
        const z = W3.troll.position.z + 4;
        ctx.fx.text(ctx.W / 2, ctx.H * 0.3, 'ACHOO!', { size: Math.min(ctx.W, ctx.H) * 0.15, color: '#7dff6a', life: 1.2 });
        for (let i = 0; i < 5; i++) spawn('boulder', Math.random() < 0.4 ? 2 : 1, { z: z - Math.random() * 2, x: (i - 2) * 1.1 });
      }
    }
    if (tr.awake <= 0) { W3.trollEyes(false); ctx.say(tr.wakes >= 3 ? 'He is fast asleep now. Tiptoe past!' : 'Zzz… he fell asleep again. Tiptoe!', { interrupt: false }); }
    return;
  }
  // tiptoeing moves you forward; running too fast wakes him (only 3 times: then he's fast asleep)
  if (run().state === 'running' && tr.t > 2 && tr.wakes < 3) {
    tr.wakes++; S.stats.trollWakes++;
    tr.awake = 3.2; tr.sneezeT = 0.7;
    W3.trollEyes(true);
    ctx.fx.shake(10);
    ctx.say('Uh oh! Too loud!');
    ctx.recorder.event('troll', { phase: 'wake', n: tr.wakes });
    return;
  }
  const step = Math.min(S.speed, 2.6) * dt + (tr.t > 8 ? 0.35 * dt : 0) + (tr.wakes >= 3 ? 0.6 * dt : 0);
  tr.progress += step;
  W3.troll.position.z = -30 + tr.progress;
  for (let i = W3.gems.length - 1; i >= 0; i--) {
    const g = W3.gems[i];
    g.position.z += step;
    if (g.position.z > -1.2) {
      const s = W3.toScreen(g.position.x, g.position.y, g.position.z - 0.5, ctx.W, ctx.H);
      W3.scene.remove(g); W3.gems.splice(i, 1);
      S.gems++; S.stats.gems++; addScore(100);
      ctx.sfx.ding();
      ctx.fx.burst(s.x, s.y, { count: 16, speed: 300, size: 6, color: '#5ee0ff' });
      ctx.fx.text(s.x, s.y - 30, '💎 +1', { size: 40, color: '#5ee0ff' });
    }
  }
  tr.snoreT -= dt;
  if (tr.snoreT <= 0) { tr.snoreT = 2.6; ctx.sfx.snore(); }
  if (I < 0.01 && tr.t > 6) sayMaybe('Walk in place, very slowly!', { gap: 12, key: 'tiptoe' });
  if (W3.troll.position.z > -7 || tr.t > 45) { tr.done = 0.001; W3.trollEyes(true); ctx.sfx.giggle(); }
}

// ---------- the game ----------

function applySettings(s) {
  set = s;
  applyCore(s, ctx.gestures);
}

function readouts() {
  const r = run(), gs = ctx.gestures;
  const live = S.objs.filter((o) => !o.dead && !o.aside && !o.scatter);
  const inWin = live.filter((o) => ttiOf(o) <= set.smashWindow).length;
  const nearest = live.length ? Math.min(...live.map(ttiOf)) : null;
  const b = ctx.body();
  const w = WORLDS[S.world];
  const rec = ctx.recorder;
  return [
    `run    ${r.intensity.toFixed(2)} ${r.state.padEnd(7)} ${r.rate.toFixed(1)} steps/s ${gs.knees ? 'knees ✓' : 'no knees'}${r.jumping ? ' JUMP' : ''}${fake || gs._simRun.used ? ' (sim keys)' : ''}`,
    `punch  ${S.stats.punches} detected (${S.stats.punchesInWindow} in window, ${S.stats.punchesMissed} whoosh)  signal ${(gs.punch.value || 0).toFixed(2)}`,
    `jumps ${S.stats.jumps}  spins ${S.stats.spins}  ducks ${S.stats.ducks}  peekaboos ${S.stats.peekaboos}`,
    `speed  ${S.speed.toFixed(1)} m/s  aura ${auraOn() ? 'ON' : 'off'}  meter ${Math.round(S.meter * 100)}%${S.power > 0 ? `  POWER ${S.power.toFixed(1)}s` : ''}`,
    `window ${inWin} in window · nearest ${nearest == null ? '-' : nearest.toFixed(1) + ' s'} · still ${S.still.toFixed(1)} s`,
    `world  ${w.n} ${S.freeRun ? 'Free run' : w.name} ${S.worldT.toFixed(0)}/${set.worldLength} s${S.troll ? ' · TROLL' : ` · troll in ${Math.max(0, set.trollEvery - S.trollClock).toFixed(0)} s`}`,
    `smashes ${S.smashes}  bonks ${S.bonks}  best chain ×${S.chainRecord}  score ${fmt(S.score)}`,
    `zone ${b.zone}  tier ${ctx.perf.tier.name}  fps ${ctx.perf.fps.toFixed(0)}`,
    `recording ${rec.rows.length} rows · ${rec.duration.toFixed(0)} s${rec.full ? ' (full)' : rec.active ? '' : ' (stopped)'}`,
  ].join('\n');
}

function exportFile() {
  const rec = ctx.recorder;
  if (!rec.rows.length && !rec.events.length) return null;
  const st = S.stats;
  st.distance = Math.round(S.dist);
  return rec.download({
    trueCount: null, expected: 'session',
    game: '06-smash-run', release: ctx.release,
    preset: tuning.preset, settings: { ...set },
    note: (tuning.notes || '').trim() || null,
    summary: { ...st, worldTime: Object.fromEntries(Object.entries(st.worldTime).map(([k, v]) => [k, Math.round(v)])),
      runTime: Object.fromEntries(Object.entries(st.runTime).map(([k, v]) => [k, +v.toFixed(1)])), sessionSeconds: Math.round(S.t) },
  });
}

export default {
  needs: ['pose', 'motion'],
  showCamera: false,
  background: '#7ec8ff',

  init(c) {
    ctx = c;
    S = fresh();
    tuning = loadTuning();
    applySettings(tuning.settings);
    W3 = createWorld3D({ tier: ctx.perf.tier.name });
    W3.setWorld(WORLDS[0]);
    ctx.recorder.start({ station: 'smash-run', title: 'Smash Run', maxRows: 30 * 60 * 10 });
    panel = createTuning({
      ctx, tuning,
      onChange: (s) => applySettings(s),
      readouts,
      graph: () => ({
        v: run().intensity, aura: auraOn(),
        lines: [{ v: ctx.gestures.runConfig.walkAt, label: 'walk', color: '#ffcc33' }, { v: ctx.gestures.runConfig.runAt, label: 'run', color: '#ff8a3d' },
          { v: set.auraAt, label: 'aura', color: '#ff5ea8' }],
      }),
      exportFile,
      actions: [
        ...WORLDS.map((w, i) => ({ label: `${w.n}`, fn: () => goWorld(i) })),
        { label: '😴 Troll', fn: () => startTroll() },
        { label: '🪨 Bonk', fn: () => { S.still = 3; S.bonkT = 0; } },
      ],
    });
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.game = S; window.wiggle.smash = { goWorld, startTroll, megaExplode, get S() { return S; }, W3 }; }

    const g = ctx.gestures;
    g.on('punch', (d) => punch(d.hand, d.x));
    g.on('jump', () => groundPound());
    g.on('spin', () => tornado());
    g.on('crouch', () => { S.stats.crouches++; });
    g.on('leave', () => { S.away = true; S.stats.leaves++; ctx.say("Where'd you go?"); });
    g.on('return', () => { if (!S.away) return; S.away = false; ctx.say('There you are! Run!'); });
    g.on('hide', () => { if (S.troll || S.mega?.active) return; S.hiding = true; S.hideT = 0; ctx.sfx.squeak(0.6); });
    g.on('peekaboo', () => {
      S.hiding = false; S.stats.peekaboos++;
      ctx.say('BOO!'); ctx.sfx.giggle();
      for (const o of S.objs) if (!o.dead && !o.scatter) { o.scatter = { vx: (o.x >= 0 ? 1 : -1) * (5 + Math.random() * 5), vy: 5 + Math.random() * 3, t: 0 }; addScore(20); S.stats.scared++; }
      ctx.fx.text(ctx.W / 2, ctx.H * 0.4, 'BOO!', { size: Math.min(ctx.W, ctx.H) * 0.2, color: '#fff', life: 1.2 });
    });
    g.on('step', () => {
      if (S.t - S.lastStep < 0.12 || S.troll) return;
      S.lastStep = S.t;
      ctx.sfx.tone(70 + Math.random() * 25, 0.06, 'sine', 0.22);
    });
    g.on('run', () => { sayMaybe(pick(['Run run run!', 'Faster!', 'Go go go!']), { chance: 0.5, gap: 10, key: 'run' }); });

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (/^[1-5]$/.test(k)) goWorld(+k - 1);
      if (k === '6') { goWorld(4, { silent: true }); megaExplode(); }
      if (k === 'g') startTroll();
      if (k === 'b') { S.still = 3; S.bonkT = 0; }
    };
    if (debugOn) addEventListener('keydown', onKey);

    S.banner = { t: 0, text: 'World 1', sub: WORLDS[0].name };
    ctx.say('Smash Run! Run in place to go fast! Punch the air to smash the boulders!');
  },

  update(dt) {
    S.t += dt;
    const r = run(), I = r.intensity;
    const st = S.stats;
    // hands over the face: things tiptoe closer until BOO (a 'hide' with no covering after 3 s just ends)
    if (S.hiding) { S.hideT += dt; if (S.hideT > 3 && !ctx.gestures.covering) S.hiding = false; }
    st.runTime[r.state] = (st.runTime[r.state] || 0) + dt;
    st.maxIntensity = Math.max(st.maxIntensity, I);

    // speed: running moves the world (tiptoe speed in the troll round)
    const target = S.away ? 0 : S.troll ? (S.troll.awake > 0 ? 0 : Math.min(I * set.topSpeed, 3)) : I * set.topSpeed;
    S.speed += (target - S.speed) * Math.min(1, dt * (target > S.speed ? 2.2 : 1.5));
    S.dist += S.speed * dt;
    st.maxSpeed = Math.max(st.maxSpeed, S.speed);
    const scroll = S.speed * dt;

    // standing still = getting bonked (on purpose, it's funny)
    const idle = r.state === 'idle' && S.t - S.lastAction > 1.5 && !S.away && !S.troll && !S.hiding && !S.mega?.active;
    S.still = idle ? S.still + dt : 0;
    S.bonkT = idle ? S.bonkT - dt : Math.min(S.bonkT, 0.5);

    // speed meter -> POWER MODE
    if (S.power > 0) { S.power -= dt; if (S.power <= 0) { S.power = 0; W3.setPower(0); } }
    else if (r.state === 'running' && !S.troll) {
      S.meter += set.meterFill * I * dt;
      if (S.meter >= 1) {
        S.meter = 0; S.power = set.powerTime; st.powerModes++;
        W3.setPower(1);
        ctx.say('POWER MODE! HYPER!'); ctx.sfx.tada(); ctx.fx.confetti(60);
        ctx.recorder.event('power', {});
      }
    }
    if (r.state === 'running') S.hardRun += dt;

    // worlds
    if (!S.troll && !S.away) {
      S.worldT += dt;
      st.worldTime[WORLDS[S.world].n] = (st.worldTime[WORLDS[S.world].n] || 0) + dt;
      if (!S.freeRun && S.world < WORLDS.length - 1 && S.worldT >= set.worldLength) goWorld(S.world + 1);
      S.trollClock += dt;
      if ((S.trollClock >= set.trollEvery || S.hardRun >= 90) && S.t > 20) startTroll();
    }
    if (S.troll) updateTroll(dt);

    // finale: the MEGA BOULDER creeps closer; running with the aura chips it too
    const m = S.mega;
    if (m?.active) {
      m.t += dt;
      m.z += (-17 - m.z) * Math.min(1, dt * 0.6);
      m.pulse = Math.max(0, (m.pulse || 0) - dt * 3);
      W3.mega.position.set(Math.sin(m.t * 1.3) * 0.4, Math.abs(Math.sin(m.t * 2)) * 0.3, m.z);
      W3.mega.scale.setScalar(1 + m.pulse * 0.08);
      if (auraOn()) { m.auraT += dt; if (m.auraT >= 1.2) { m.auraT = 0; chipMega(1); } }
    }

    // spawning
    const cap = ctx.perf.tier.name === 'low' ? 14 : 28;
    const canSpawn = !S.away && !S.troll && !S.hiding && !m?.active && S.t > 4 && S.still < 1.5;
    if (canSpawn) {
      S.spawnAcc += dt * set.spawnRate;
      while (S.spawnAcc >= 1) {
        S.spawnAcc -= 1;
        if (S.objs.length >= cap) continue;
        const kind = pick(kindsNow());
        const K = KINDS[kind];
        spawn(kind, Math.random() < 0.65 ? K.levels : Math.max(1, K.levels - 1));
      }
    }
    if (S.still > 1.8 && S.t > 8 && S.bonkT <= 0 && !S.bonk && !S.objs.some((o) => o.bonker)) {
      const kind = pick(kindsNow());
      spawn(kind, KINDS[kind].levels, { x: 0, z: -22, bonker: true });
      S.bonkT = set.bonkEvery;
    }

    // move things
    const aura = auraOn();
    for (const o of S.objs) {
      if (o.removed) continue;
      const mesh = o.mesh, body = mesh.userData.body;
      if (o.scatter) { // BOO! they run away
        o.scatter.t += dt; o.x += o.scatter.vx * dt; o.y += o.scatter.vy * dt; o.scatter.vy -= 9 * dt; o.z -= 3 * dt;
        mesh.rotation.z += o.scatter.vx * dt * 0.3;
        mesh.position.set(o.x, Math.max(o.y, mesh.userData.baseY), o.z);
        if (o.scatter.t > 1.6) removeObj(o, false);
        continue;
      }
      if (S.away) { // line up politely and wait
        const live = S.objs.filter((q) => !q.removed && !q.scatter);
        const i = live.indexOf(o), n = live.length;
        const tx = (i - (n - 1) / 2) * Math.min(1.6, 9 / Math.max(1, n)), tz = -14 - (i % 2) * 2;
        o.x += (tx - o.x) * Math.min(1, dt * 1.5); o.z += (tz - o.z) * Math.min(1, dt * 1.5);
        mesh.position.set(o.x, mesh.userData.baseY + Math.abs(Math.sin(S.t * 3 + o.wob)) * 0.1, o.z);
        continue;
      }
      const ap = approachOf(o);
      o.z += ap * dt;
      const K = KINDS[o.kind];
      if (K.rolls) body.rotation.x += (ap * dt) / o.r;
      if (K.grows && o.grow < 1.6) { o.grow += dt * 0.07; body.scale.setScalar(o.grow); }
      let y = mesh.userData.baseY * (K.grows ? o.grow : 1);
      if (K.walks) { y += Math.abs(Math.sin(S.t * 8 + o.wob)) * 0.25; body.rotation.z = Math.sin(S.t * 8 + o.wob) * 0.12; }
      if (S.hiding) { y += Math.abs(Math.sin(S.t * 5 + o.wob)) * 0.15; o.z = Math.min(o.z, -4); } // tiptoe closer
      if (o.aside) { o.x += o.aside * 7 * dt; mesh.rotation.z = -o.aside * 0.4; }
      if (o.hop) { o.hop += dt; y += Math.sin(Math.min(1, o.hop / 0.8) * Math.PI) * 3.2; }
      // in the smash window: wiggle so he can see "now!"
      const inWin = !o.aside && !o.hop && ttiOf(o) <= set.smashWindow;
      mesh.scale.setScalar(inWin ? 1 + Math.sin(S.t * 18 + o.wob) * 0.05 : 1);
      mesh.position.set(o.x, y, o.z);

      // reaching the player
      if (!o.aside && !o.hop && !o.targeted && o.z + o.r > -0.7) {
        if (aura) smash(o, S.power > 0 ? 'power' : 'aura');
        else if (!S.bonk && !S.troll && (o.bonker || S.still > 1)) bonk(o);
        else if (ctx.gestures.crouching) { o.hop = 0.001; S.stats.ducks++; addScore(20); ctx.sfx.whoosh(); sayMaybe('Phew!', { gap: 4 }); }
        else { o.aside = o.x >= 0 ? 1 : -1; S.stats.bumped++; ctx.sfx.boing(); }
      }
      if (o.z > 4 || Math.abs(o.x) > 14) removeObj(o, false);
    }
    S.objs = S.objs.filter((o) => !o.removed);

    // gloves follow the real wrists (left glove = the wrist on the left of the screen)
    const p = ctx.pose;
    const ws = p.found ? [p.leftWrist, p.rightWrist].filter((w) => w && w.v > 0.4).sort((a, b) => a.x - b.x) : [];
    const pairs = ws.length === 2 ? { left: ws[0], right: ws[1] } : ws.length === 1 ? { [ws[0].x < 0.5 ? 'left' : 'right']: ws[0] } : {};
    for (const side of ['left', 'right']) {
      const gl = W3.gloves[side], ud = gl.userData;
      const w = pairs[side];
      const bob = Math.sin(S.t * 2 * Math.PI * 1.4 + (side === 'left' ? 0 : Math.PI)) * 0.08 * I;
      const tx = w ? clamp((w.x - 0.5) * 1.5, -0.8, 0.8) : (side === 'left' ? -0.42 : 0.42);
      const ty = w ? clamp(-(w.y - 0.5) * 1.1 - 0.15, -0.6, 0.25) : -0.38 + bob;
      ud.x += (tx - ud.x) * Math.min(1, dt * 14); ud.y += (ty - ud.y) * Math.min(1, dt * 14);
      ud.punchT = Math.min(1, ud.punchT + dt / 0.28);
      const thrust = Math.sin(ud.punchT * Math.PI);
      gl.position.set(ud.x * (1 - thrust * 0.4), ud.y + thrust * 0.15, -1.1 - thrust * 1.1);
      gl.scale.setScalar(1 + (S.power > 0 ? 0.25 + Math.sin(S.t * 12) * 0.08 : 0));
    }

    // camera: bob while running, sway in power mode
    W3.camera.position.y = 1.5 + Math.abs(Math.sin(S.t * Math.PI * 2.6)) * 0.08 * I;
    W3.camera.rotation.z = Math.sin(S.t * 1.7) * 0.02 * I + (S.tornado > 0 ? Math.sin(S.tornado * 9) * 0.1 : 0);
    W3.update(dt, scroll, S.t);

    // timers
    if (S.bonk) { S.bonk.t += dt; if (S.bonk.t > 3.8) S.bonk = null; }
    if (S.banner) { S.banner.t += dt; if (S.banner.t > 3) S.banner = null; }
    if (S.chainShow) { S.chainShow.t += dt; if (S.chainShow.t > 2.2) S.chainShow = null; }
    if (S.pound) { S.pound.t += dt; if (S.pound.t > 0.7) S.pound = null; }
    S.tornado = Math.max(0, S.tornado - dt);
    S.shown += (S.score - S.shown) * Math.min(1, dt * 6);

    // where's the kid standing?
    const zone = ctx.body().zone;
    S.zoneT = zone === 'too-close' ? S.zoneT + dt : 0;
    if (S.zoneT > 1.5 && S.t - S.zoneSaid > 10) { S.zoneSaid = S.t; ctx.say('Step back so I can see your knees!', { interrupt: false }); }
    S.introT += dt;
    if (S.introT > 7 && !S.saidAt.punchAir) { S.saidAt.punchAir = S.t; ctx.say('Punch the air! Not people!', { interrupt: false }); }

    panel.update(dt);
  },

  draw(g) {
    const { W, H } = ctx;
    const u = Math.min(W, H);
    g.drawImage(W3.render(W, H, Math.min(ctx.view.dpr, ctx.perf.tier.name === 'low' ? 1 : 1.5)), 0, 0, W, H);
    const I = run().intensity;

    // speed lines
    if (S.speed > 3) {
      const n = Math.round(10 + S.speed * 1.5);
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.55, S.speed / 30)})`; g.lineWidth = 3;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399, k = (S.t * (0.8 + S.speed / 10) + i * 0.137) % 1;
        const r0 = u * (0.25 + k * 0.6), len = u * (0.04 + S.speed / 200);
        const cx = W / 2 + Math.cos(a) * r0, cy = H * 0.45 + Math.sin(a) * r0 * 0.75;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.75); g.stroke();
      }
    }

    // smash-window targets
    for (const o of S.objs) {
      if (o.dead || o.aside || o.hop || o.scatter || S.away) continue;
      const tt = ttiOf(o);
      if (tt > set.smashWindow) continue;
      const s = screenOf(o);
      if (s.behind) continue;
      const k = 1 - tt / set.smashWindow;
      g.strokeStyle = `rgba(255,225,77,${0.5 + 0.4 * Math.sin(S.t * 14)})`; g.lineWidth = 4 + k * 4;
      g.beginPath(); g.arc(s.x, s.y, u * (0.05 + k * 0.1), 0, Math.PI * 2); g.stroke();
    }

    // power aura glow around the edges
    if (auraOn()) {
      const pw = S.power > 0;
      const grad = g.createRadialGradient(W / 2, H / 2, u * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      grad.addColorStop(0, 'rgba(255,200,40,0)');
      grad.addColorStop(1, pw ? `hsla(${(S.t * 300) % 360},100%,60%,.55)` : 'rgba(255,200,40,.35)');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
    if (S.pound) { // ground-pound shockwave
      const k = S.pound.t / 0.7;
      g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 12 * (1 - k);
      g.beginPath(); g.ellipse(W / 2, H * 0.85, u * k * 0.9, u * k * 0.25, 0, 0, Math.PI * 2); g.stroke();
    }
    if (S.tornado > 0) {
      g.save(); g.translate(W / 2, H * 0.5); g.rotate(S.t * 9);
      for (let i = 0; i < 10; i++) { g.rotate(Math.PI / 5); g.fillStyle = `hsla(${i * 36},90%,70%,${S.tornado * 0.25})`; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, u * 0.6, 0, 0.3); g.fill(); }
      g.restore();
    }
    if (S.troll && S.troll.done === 0) { // Zzz over the troll's head
      const tp = W3.troll.position;
      const s = W3.toScreen(tp.x + 1.5, 6.2, tp.z, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (S.troll.awake > 0) { g.font = `900 ${u * 0.1}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#ff5ea8'; g.fillText('!!', s.x, s.y); }
      else for (let i = 0; i < 3; i++) { const k = (S.t * 0.6 + i / 3) % 1; g.globalAlpha = 1 - k; g.fillStyle = '#fff'; g.font = `900 ${u * (0.04 + k * 0.04)}px ui-rounded, system-ui, sans-serif`; g.fillText('Z', s.x + k * u * 0.08, s.y - k * u * 0.15); }
      g.globalAlpha = 1;
    }

    drawHud(g, I);
    if (S.bonk) drawBonk(g);
    drawBanners(g);
    drawPip(g);
  },

  destroy() {
    if (onKey) removeEventListener('keydown', onKey);
    onKey = null;
    panel?.destroy(); panel = null;
    W3?.dispose(); W3 = null;
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.smash; }
  },
};

// ---------- 2D HUD ----------

function pill(g, x, y, w, h, fill, stroke) {
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
}

function drawHud(g, I) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  const font = (px, w = 900) => `${w} ${px}px ui-rounded, system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const narrow = W < 620;
  // smash counter (big) + score, top center (below the corner buttons on narrow screens)
  const topY = narrow ? 112 : 14;
  const bh = Math.min(u * 0.13, 84);
  const bw = Math.min(W * 0.5, bh * 3.6);
  pill(g, W / 2 - bw / 2, topY, bw, bh, 'rgba(27,17,64,.7)', '#ffcc33');
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = font(bh * 0.7);
  g.fillText(`💥 ${fmt(S.smashes)}`, W / 2, topY + bh * 0.53);
  g.font = font(bh * 0.4); g.fillStyle = '#ffcc33';
  g.fillText(`⭐ ${fmt(S.shown)}`, W / 2, topY + bh * 1.38);
  // world, distance, gems (left column under the back button)
  const lx = 16, ly = narrow ? topY + bh * 1.9 : 112, lh = Math.min(u * 0.07, 40);
  const w = WORLDS[S.world];
  g.textAlign = 'left'; g.font = font(lh * 0.6, 800);
  const rows = [`🌍 ${w.n} ${S.freeRun ? 'Free run!' : w.name}`, `📏 ${fmt(S.dist)} m`, `💎 ${S.gems}`];
  rows.forEach((t, i) => {
    const tw = g.measureText(t).width + lh * 0.8;
    pill(g, lx, ly + i * lh * 1.15, tw, lh, 'rgba(27,17,64,.6)');
    g.fillStyle = '#fff'; g.fillText(t, lx + lh * 0.4, ly + i * lh * 1.15 + lh * 0.54);
  });
  // chain counter
  let chain = 0;
  for (const c of S.chains.values()) if (c.count > chain) chain = c.count;
  if (chain >= 2) {
    g.save(); g.translate(W / 2, topY + bh * 2.2); g.rotate(-0.06 + Math.sin(S.t * 10) * 0.04);
    const s = 1 + Math.min(0.6, chain * 0.04);
    g.scale(s, s);
    g.textAlign = 'center'; g.font = font(u * 0.07); g.lineWidth = 6; g.strokeStyle = '#1b1140';
    g.strokeText(`CHAIN ×${chain}`, 0, 0); g.fillStyle = '#ff5ea8'; g.fillText(`CHAIN ×${chain}`, 0, 0);
    g.restore();
  }
  // speed meter (POWER) along the bottom + the run icon
  const mx0 = W * 0.2, mx1 = W * 0.8, my = H - Math.max(26, u * 0.06), mh = Math.max(18, u * 0.035);
  pill(g, mx0, my - mh / 2, mx1 - mx0, mh, 'rgba(27,17,64,.6)', 'rgba(255,255,255,.6)');
  const fill = S.power > 0 ? S.power / set.powerTime : S.meter;
  pill(g, mx0, my - mh / 2, Math.max(mh, (mx1 - mx0) * fill), mh, S.power > 0 ? `hsl(${(S.t * 300) % 360},95%,60%)` : '#ffcc33');
  g.textAlign = 'center'; g.font = font(mh * 0.75); g.fillStyle = '#1b1140';
  g.fillText(S.power > 0 ? 'POWER MODE!' : 'POWER', (mx0 + mx1) / 2, my + 1);
  const r = run();
  g.font = `${mh * 1.8}px sans-serif`;
  g.fillText(r.state === 'running' ? '🏃' : r.state === 'walking' ? '🚶' : '🧍', mx0 - mh * 1.4, my);
  // little intensity bar next to the runner
  pill(g, mx1 + mh * 0.6, my - mh / 2, mh * 4, mh, 'rgba(27,17,64,.6)');
  pill(g, mx1 + mh * 0.6, my - mh / 2, Math.max(mh * 0.6, mh * 4 * I), mh, auraOn() ? '#ff5ea8' : '#7dff6a');
  // finale counter
  if (S.mega?.active) {
    g.textAlign = 'center'; g.font = font(u * 0.06); g.fillStyle = '#fff'; g.strokeStyle = '#1b1140'; g.lineWidth = 6;
    const t = `🪨 MEGA SMASH ${S.mega.hits} / 10`;
    g.strokeText(t, W / 2, H * 0.78); g.fillText(t, W / 2, H * 0.78);
  }
  // version (small)
  g.textAlign = 'right'; g.font = font(12, 700); g.fillStyle = 'rgba(255,255,255,.6)';
  g.fillText(`v${ctx.release}`, W - 10, H - 8);
}

function drawBanners(g) {
  const { W, H } = ctx;
  const u = Math.min(W, H);
  const font = (px) => `900 ${px}px ui-rounded, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const outline = (t, x, y, px, color) => { g.font = font(px); g.lineWidth = px * 0.12; g.strokeStyle = '#1b1140'; g.strokeText(t, x, y); g.fillStyle = color; g.fillText(t, x, y); };
  if (S.banner) {
    const k = S.banner.t;
    const s = k < 0.3 ? 0.5 + k / 0.3 * 0.6 : 1.1 - Math.min(0.1, (k - 0.3) * 0.3);
    g.save(); g.globalAlpha = Math.min(1, (3 - k) * 2); g.translate(W / 2, H * 0.42); g.scale(s, s);
    outline(S.banner.text, 0, 0, u * 0.13, '#ffcc33');
    outline(S.banner.sub, 0, u * 0.11, u * 0.07, '#fff');
    g.restore();
  }
  if (S.chainShow) {
    const k = S.chainShow.t;
    g.save(); g.globalAlpha = Math.min(1, (2.2 - k) * 2); g.translate(W / 2, H * 0.55); g.rotate(-0.08); g.scale(1 + Math.max(0, 0.4 - k), 1 + Math.max(0, 0.4 - k));
    outline(`CHAIN SMASH ×${S.chainShow.n}!`, 0, 0, u * 0.11, '#ff5ea8');
    outline(`+${fmt(S.chainShow.bonus)}`, 0, u * 0.09, u * 0.06, '#ffcc33');
    g.restore();
  }
  if (S.away) outline("Where'd you go? 👀", W / 2, H * 0.4 + Math.sin(S.t * 3) * 8, u * 0.08, '#fff');
  if (S.hiding) outline('Shhh… they are sneaking closer…', W / 2, H * 0.3, u * 0.055, '#fff');
  if (S.troll && S.troll.done === 0) outline(S.troll.awake > 0 ? 'Uh oh! Too loud!' : '🤫 Walk slowly…', W / 2, H * 0.72, u * 0.06, S.troll.awake > 0 ? '#ff5ea8' : '#fff');
  if (S.zoneT > 1.5) outline('⬅ Step back! Show me your knees 🦵', W / 2, H * 0.62, u * 0.055, '#7dff6a');
  if (S.still > 2.5 && !S.bonk && !S.away) outline('🏃 Run in place to go!', W / 2, H * 0.66, u * 0.05, '#fff');
}

// the boulder squished against the "camera": cracked glass, googly eyes, slowly sliding down
function drawBonk(g) {
  const { W, H } = ctx;
  const b = S.bonk, k = b.t;
  const u = Math.min(W, H);
  const slam = k < 0.15 ? k / 0.15 : 1;
  const slide = Math.max(0, k - 1.2) ** 1.6 * H * 0.22;
  const x = b.cx * W, y = b.cy * H + slide;
  const R = u * 0.42 * (0.4 + slam * 0.6);
  g.save();
  g.globalAlpha = Math.min(1, (3.8 - k) * 1.5);
  // cracked glass
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3;
  for (const pts of b.cracks) { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px * W, py * H) : g.moveTo(px * W, py * H))); g.stroke(); }
  // squished face
  g.translate(x, y);
  g.scale(1.25 + Math.sin(k * 20) * 0.03 * Math.max(0, 1 - k), 0.85);
  g.fillStyle = b.color; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(R * 0.25, R * 0.2, R * 0.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.45, R * 0.35, R * 0.15, -0.5, 0, Math.PI * 2); g.fill();
  for (const sx of [-1, 1]) { // googly eyes
    const ex = sx * R * 0.35, ey = -R * 0.12, er = R * 0.22;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
    const a = S.t * (sx > 0 ? 9 : -7);
    g.fillStyle = '#000'; g.beginPath(); g.arc(ex + Math.cos(a) * er * 0.45, ey + Math.abs(Math.sin(a)) * er * 0.45, er * 0.45, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = '#1b1140'; g.lineWidth = R * 0.06; g.beginPath(); g.ellipse(0, R * 0.35, R * 0.2, R * 0.12, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.textAlign = 'center'; g.font = `900 ${u * 0.1}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = 8; g.strokeStyle = '#1b1140'; g.strokeText('BONK!', W / 2, H * 0.14 + slide * 0.2); g.fillStyle = '#ffcc33'; g.fillText('BONK!', W / 2, H * 0.14 + slide * 0.2);
  if (k > 0.5) { g.font = `800 ${u * 0.055}px ui-rounded, system-ui, sans-serif`; g.strokeText(b.line, W / 2, y + R * 0.9); g.fillStyle = '#fff'; g.fillText(b.line, W / 2, y + R * 0.9); }
}

// small mirrored camera picture-in-picture (so he can see himself), with the tracked joints
function drawPip(g) {
  const cam = ctx.camera;
  if (!cam.ready) return;
  const { W, H } = ctx;
  const w = Math.min(W * 0.2, 220), h = w / (cam.width / cam.height);
  const x = 12, y = H - h - Math.max(52, Math.min(W, H) * 0.1);
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.clip();
  g.translate(x + w, y); g.scale(-1, 1);
  g.drawImage(cam.video, 0, 0, w, h);
  g.restore();
  g.strokeStyle = auraOn() ? '#ff5ea8' : 'rgba(255,255,255,.7)'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.stroke();
  const p = ctx.pose;
  if (p.found) {
    for (const [name, col] of [['leftWrist', '#ff4d4d'], ['rightWrist', '#ff4d4d'], ['leftShoulder', '#fff'], ['rightShoulder', '#fff'], ['leftKnee', '#7dff6a'], ['rightKnee', '#7dff6a']]) {
      const q = p[name];
      if (!q || q.v < 0.4) continue;
      g.fillStyle = col; g.beginPath(); g.arc(x + q.x * w, y + q.y * h, 4, 0, Math.PI * 2); g.fill();
    }
  }
}
