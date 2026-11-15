// Bubble Pop v1.1 "Giant bubbles!": wave to pop bubbles, but WAITING pays.
//
// - Bubbles that touch MERGE into bigger bubbles (capped), so standing still grows GIANT bubbles.
//   Popping a giant bursts it into a shower of small bubbles that pop one after another: CHAIN ×N.
//   A mini that pops next to another bubble pops it too, so chains can spread across the screen.
// - Special bubbles, one at a time, spaced through the round: 💣 boom (pops everything near it),
//   🌈 rainbow (clears the screen), 🐟🦆🐸 critter (a friend floats out, waves and swims off giggling),
//   ⭐ golden (big points), 🪄 wand (10 s: bubbles stream from a coloured toy, or his hand, or wherever he moves).
// - SPIN (and a little burst on each half turn) sends a swirl of new bubbles out from around him.
// - 60-second round → BUBBLE STORM finale → score screen (best score per device, play again).
//
// Debug keys (?debug): 1 boom · 2 rainbow · 3 critter · 4 golden · 5 wand · 6 giant bubble · 7 fill the screen ·
// K pretend toy (wand follows a fake toy for 3 s) · G storm now · E end the round. Test controls (?keys): S = spin,
// ] = fast-forward; ⏭ ends the round (or starts the next one), 🏁 jumps to the storm.

import { createToyFinder, toySample } from '../../../core/toy.js';

const ROUND = 60;          // s of normal play before the storm
const STORM = 9;           // s of storm
const SPECIAL_AT = [6, 15, 24, 33, 42, 51]; // when a special may appear (never two at once)
const SPECIAL_STAY = 9;    // s a special waits under the ceiling before it floats away
const WAND_TIME = 10;
const MAX_BUBBLES = { low: 20, medium: 30, high: 42 };
const MAX_MINIS = { low: 24, medium: 40, high: 60 };
const BEST_KEY = 'wiggle.bubble-pop.v1.1.best';
const CRITTERS = [
  { emoji: '🐟', say: 'Hi little fish!' },
  { emoji: '🦆', say: 'Quack! Hello duck!' },
  { emoji: '🐸', say: 'Ribbit! Hi froggy!' },
];
const SPECIALS = {
  boom: { emoji: '💣', hue: 10 },
  rainbow: { emoji: '🌈', hue: 290 },
  critter: { emoji: null, hue: 140 },
  golden: { emoji: '⭐', hue: 48 },
  wand: { emoji: '🪄', hue: 200 },
};
const TOY_CSS = { red: '#ff3b3b', blue: '#3b7bff', yellow: '#ffd400', green: '#2fd35a' };

const params = new URLSearchParams(globalThis.location?.search || ''); // (no location in the node playtest)
const debugOn = params.has('debug');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let S = null;    // all round state
let ctx = null;
let onKey = null, onPointer = null;
const sprites = new Map(); // hue bucket -> offscreen bubble picture (no gradients per frame)

function loadBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode */ } }

function unit() { return Math.min(ctx.W, ctx.H); }
function tier() { return ctx.perf.settings.name || 'medium'; }
function maxBubbles() { return (MAX_BUBBLES[tier()] || 30) * (S.phase === 'storm' ? 1.4 : 1); }
function hudBottom() { return Math.max(70, ctx.H * 0.17); } // bubbles stay below the score band
function r0() { return unit() * 0.055; }
function giantR() { return unit() * 0.12; }
function maxR() { return unit() * 0.23; }

function newRound() {
  const first = Math.random() < 0.5 ? 'golden' : 'critter';
  const order = [first, ...shuffle(['boom', 'rainbow', 'wand', 'critter']), first === 'golden' ? 'critter' : 'golden'];
  S = {
    phase: 'play', t: 0, score: 0, bump: 0,
    bubbles: [], minis: [], pending: [], critters: [], rings: [], waves: [], swirls: [],
    spawnIn: 0, specials: order, specialIdx: 0, specialAlive: null,
    chain: { n: 0, quiet: 0, best: 0 },
    stats: { popped: 0, giants: 0, bestChain: 0, spins: 0 },
    callout: null,
    wand: null, simToy: 0,
    toy: createToyFinder(),
    wrists: { l: null, r: null, speedL: 0, speedR: 0 },
    stormSaid: false, stormSpawned: 0, finalPop: false,
    best: loadBest(), newBest: false, scoreT: 0, nextIn: 10,
    lastSay: -10, milestone: 0,
  };
  if (debugOn && window.wiggle) window.wiggle.game = S;
  for (let i = 0; i < 6; i++) spawnBubble({ y: ctx.H * (0.45 + Math.random() * 0.5) });
}

// ---------------------------------------------------------------- bubbles

function spawnBubble({ x, y, r, vx = 0, vy, kind = 'normal', hue, safe = 0, n = 1, critter = null } = {}) {
  const u = unit();
  r = r ?? u * (0.04 + Math.random() * 0.03);
  const b = {
    x: x ?? r + Math.random() * (ctx.W - 2 * r), y: y ?? ctx.H + r, r, vx: vx || (Math.random() - 0.5) * u * 0.05,
    vy: vy ?? -(u * (0.1 + Math.random() * 0.08)), kind, n, value: 10 * n,
    hue: hue ?? (kind === 'normal' ? 170 + Math.random() * 160 : SPECIALS[kind].hue),
    phase: Math.random() * 6, age: 0, safe, squish: 0, critter, gone: false,
  };
  S.bubbles.push(b);
  return b;
}

// normal bubbles stay cyan → pink, so none looks like the gold ⭐ bubble
function bubbleHue(h) { return 170 + (((h % 160) + 160) % 160); }

function spawnSpecial(kind) {
  const u = unit();
  const critter = kind === 'critter' ? pick(CRITTERS) : null;
  const b = spawnBubble({ kind, r: u * 0.085, x: u * 0.12 + Math.random() * (ctx.W - u * 0.24), vy: -u * 0.12, critter });
  S.specialAlive = b;
  ctx.sfx.play('powerup', { vol: 0.5 });
  const lines = {
    boom: 'A boom bubble! Pop it!', rainbow: 'A rainbow bubble!', golden: 'A golden bubble!',
    wand: 'A magic wand bubble! Pop it!', critter: 'Somebody is inside that bubble!',
  };
  sayMaybe(lines[kind], { gap: 2 });
  return b;
}

// cause: 'hand' | 'chain' | 'boom' | 'rainbow' | 'storm' | 'tap'
function popBubble(b, cause = 'hand') {
  if (b.gone) return;
  b.gone = true;
  const { fx, sfx } = ctx;
  S.stats.popped++;
  if (b === S.specialAlive) S.specialAlive = null;
  const col = `hsl(${b.hue} 90% 70%)`;
  fx.burst(b.x, b.y, { color: col, count: Math.min(60, 14 + b.n * 4), size: Math.max(4, b.r * 0.12), speed: 300 + b.r * 3 });

  if (b.kind !== 'normal') return popSpecial(b);

  const giant = b.r >= giantR();
  let pts = b.value * (giant ? 2 : 1);
  if (cause === 'rainbow') pts *= 2;
  if (cause === 'chain') { S.chain.n++; S.chain.quiet = 0; pts += chainPts(); sfx.squeak(0.9 + Math.min(S.chain.n, 20) * 0.06); }
  else sfx.pop();
  addScore(pts, b.x, b.y, giant ? 64 : 40, cause === 'chain' && S.chain.n > 6);

  if (giant || b.n >= 4) burstIntoMinis(b);
  if (giant) {
    S.stats.giants++;
    fx.shake(10 + b.r * 0.06);
    sfx.boing();
    setCallout(`GIANT POP! +${pts}`, '#b48cff');
  }
}

// A merged bubble bursts into a shower of small bubbles that pop one after another (CHAIN ×N).
function burstIntoMinis(b) {
  const room = (MAX_MINIS[tier()] || 40) - S.minis.length;
  const count = clamp(Math.min(b.n, 16), 4, Math.max(0, room));
  const u = unit();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const sp = u * (0.5 + Math.random() * 0.5);
    S.minis.push({
      x: b.x, y: b.y, r: u * (0.022 + Math.random() * 0.012), hue: (b.hue + i * 25) % 360,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, popAt: 0.25 + i * 0.09 + Math.random() * 0.04,
    });
  }
  S.chain.quiet = 0;
}

function popSpecial(b) {
  const { fx, sfx } = ctx;
  const u = unit();
  if (b.kind === 'boom') {
    sfx.boom(); fx.shake(28);
    S.rings.push({ x: b.x, y: b.y, t: 0, R: u * 0.55, color: '#ffb347' });
    setCallout('BOOM!', '#ff7a3b', 2);
    addScore(100, b.x, b.y, 56);
    for (const o of S.bubbles) {
      if (o.gone || o === b || o.kind !== 'normal') continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < u * 0.55 + o.r) S.pending.push({ b: o, at: S.t + d / (u * 1.6), cause: 'boom' });
    }
    sayMaybe('BOOM!', { gap: 1 });
  } else if (b.kind === 'rainbow') {
    sfx.tada(); fx.confetti(200);
    S.waves.push({ t: 0, dur: 1.3 });
    setCallout('RAINBOW!', '#ff5ea8', 2);
    addScore(200, b.x, b.y, 56);
    for (const o of S.bubbles) if (!o.gone && o !== b && o.kind === 'normal') S.pending.push({ b: o, at: S.t + (o.x / ctx.W) * 1.3, cause: 'rainbow' });
    sayMaybe('Rainbow! Pop pop pop!', { gap: 1 });
  } else if (b.kind === 'golden') {
    sfx.ding(); sfx.tada(); fx.confetti(160); fx.shake(14);
    fx.burst(b.x, b.y, { color: '#ffcc33', count: 70, size: 10, speed: 520 });
    addScore(500, b.x, b.y, 80);
    setCallout('GOLDEN! +500', '#ffcc33', 2);
    sayMaybe('Golden bubble! Five hundred!', { gap: 1 });
  } else if (b.kind === 'critter') {
    const c = b.critter || CRITTERS[0];
    S.critters.push({ emoji: c.emoji, x: b.x, y: b.y, t: 0, dir: b.x < ctx.W / 2 ? -1 : 1, giggled: false });
    sfx.pop(); sfx.squeak(1.4);
    addScore(100, b.x, b.y, 56);
    setCallout(`${c.emoji} HELLO! +100`, '#7dff6a', 2);
    sayMaybe(c.say, { gap: 1 });
  } else if (b.kind === 'wand') {
    startWand(b.x, b.y);
  }
}

function startWand(x, y) {
  S.wand = { t: WAND_TIME, x, y, px: x, py: y, vx: 0, vy: 0, emit: 0, source: 'motion', said: false };
  ctx.sfx.tada(); ctx.fx.confetti(80);
  setCallout('🪄 MAGIC WAND!', '#5ee0ff', 2);
  addScore(100, x, y, 56);
  sayMaybe('Magic wand! Hold up a toy, or wave your hand, to make bubbles!', { gap: 0 });
}

// each link in a chain is worth a bit more: 15, 20, 25 ... up to 60
function chainPts() { return 10 + 5 * Math.min(S.chain.n, 10); }

function addScore(pts, x, y, size = 40, quiet = false) {
  const before = S.score;
  S.score += pts;
  S.bump = 1;
  if (x != null && !quiet) ctx.fx.text(x, y, `+${pts}`, { size: Math.min(size, unit() * 0.12), color: pts >= 100 ? '#ffcc33' : '#fff', life: 0.7 });
  // every 1000 points: a big cheer (only at the top, never over the bubbles)
  if (Math.floor(S.score / 1000) > Math.floor(before / 1000)) {
    ctx.sfx.tada(); ctx.fx.confetti(120);
    setCallout(`${Math.floor(S.score / 1000) * 1000}!`, '#ffcc33');
    sayMaybe(pick(['Wow!', 'Amazing!', 'Super popper!', 'Keep going!', 'Bubble champion!']), { gap: 3 });
  }
}

function setCallout(text, color = '#fff', prio = 1) {
  const c = S.callout;
  if (c && c.prio > prio && c.t < 1) return;
  S.callout = { text, color, t: 0, life: 1.6, prio };
}

function sayMaybe(text, { gap = 4 } = {}) {
  if (S.t - S.lastSay < gap) return;
  S.lastSay = S.t;
  ctx.say(text, { interrupt: false });
}

// ---------------------------------------------------------------- swirls (spin)

function swirl(count, power = 1) {
  const u = unit();
  // around him: shoulders if the body tracker sees him, else the middle of the screen
  const p = ctx.pose;
  let cx = ctx.W / 2, cy = ctx.H * 0.55;
  if (p?.found && p.leftShoulder && p.rightShoulder) {
    const q = ctx.view.toScreen((p.leftShoulder.x + p.rightShoulder.x) / 2, (p.leftShoulder.y + p.rightShoulder.y) / 2);
    cx = clamp(q.x, u * 0.2, ctx.W - u * 0.2); cy = clamp(q.y, hudBottom() + u * 0.2, ctx.H - u * 0.1);
  }
  S.swirls.push({ x: cx, y: cy, left: Math.round(count * Math.max(0.5, ctx.perf.settings.particles)), every: 0.05, next: 0, a: Math.random() * 6, power, t: 0 });
}

function updateSwirls(dt) {
  const u = unit();
  for (let i = S.swirls.length - 1; i >= 0; i--) {
    const s = S.swirls[i];
    s.t += dt; s.next -= dt;
    while (s.next <= 0 && s.left > 0) {
      s.next += s.every; s.left--; s.a += 0.7;
      if (S.bubbles.length >= maxBubbles() + 6) continue;
      const R = u * 0.16;
      const sp = u * (0.45 + 0.25 * s.power);
      // tangent + outward: a spiral
      spawnBubble({
        x: s.x + Math.cos(s.a) * R, y: s.y + Math.sin(s.a) * R, r: u * (0.035 + Math.random() * 0.025),
        vx: (Math.cos(s.a) * 0.6 - Math.sin(s.a)) * sp, vy: (Math.sin(s.a) * 0.6 + Math.cos(s.a)) * sp, safe: 1.1,
        hue: bubbleHue(s.a * 40),
      });
    }
    if (s.left <= 0) S.swirls.splice(i, 1);
  }
}

// ---------------------------------------------------------------- wand

function wristSpeeds(dt) {
  const p = ctx.pose, w = S.wrists;
  for (const [k, sk, pt] of [['l', 'speedL', p?.leftWrist], ['r', 'speedR', p?.rightWrist]]) {
    if (p?.found && pt && (pt.v ?? 1) >= 0.5) {
      if (w[k]) { const sp = Math.hypot(pt.x - w[k].x, pt.y - w[k].y) / Math.max(dt, 1e-3); w[sk] += (sp - w[sk]) * Math.min(1, dt * 8); }
      w[k] = { x: pt.x, y: pt.y };
    } else { w[k] = null; w[sk] *= 0.9; }
  }
}

function updateWand(dt, toy) {
  const W = S.wand, u = unit();
  W.t -= dt;
  // where's the wand? 1) a coloured toy  2) his faster-moving hand  3) wherever the movement is
  let target = null, source = 'motion';
  if (S.simToy > 0) {
    target = { x: ctx.W / 2 + Math.cos(S.t * 2.2) * ctx.W * 0.3, y: ctx.H * 0.6 + Math.sin(S.t * 3.1) * ctx.H * 0.2 }; source = 'toy';
  } else if (toy) { target = ctx.view.toScreen(toy.x, toy.y); source = 'toy'; W.toyColor = toy.color; }
  else {
    const w = S.wrists;
    const hand = w.speedL > w.speedR ? (w.l || w.r) : (w.r || w.l);
    if (hand && Math.max(w.speedL, w.speedR) > 0.15) { target = ctx.view.toScreen(hand.x, hand.y); source = 'hand'; }
    else {
      const hs = ctx.motion.hotspots(1, 0.15)[0];
      if (hs) target = ctx.view.toScreen(hs.x, hs.y);
    }
  }
  W.source = source;
  if (target) {
    const k = Math.min(1, dt * (source === 'motion' ? 4 : 14)); // hotspots jump around: follow them gently
    W.x += (target.x - W.x) * k;
    W.y += (target.y - W.y) * k;
  }
  W.vx = (W.x - W.px) / Math.max(dt, 1e-3); W.vy = (W.y - W.py) / Math.max(dt, 1e-3);
  W.px = W.x; W.py = W.y;
  const speed = Math.hypot(W.vx, W.vy) / u; // units per s
  // more bubbles the faster it moves (and a gentle trickle when it's still)
  W.emit += dt * clamp(3 + speed * 9, 3, 22);
  while (W.emit >= 1) {
    W.emit -= 1;
    if (S.bubbles.length >= maxBubbles() + 4) { ctx.fx.burst(W.x, W.y, { color: '#cff6ff', count: 3, size: 4, gravity: 0, life: 0.4 }); continue; }
    spawnBubble({
      x: W.x + (Math.random() - 0.5) * u * 0.04, y: W.y + (Math.random() - 0.5) * u * 0.04, r: u * (0.028 + Math.random() * 0.022),
      vx: W.vx * 0.35 + (Math.random() - 0.5) * u * 0.25, vy: W.vy * 0.35 - u * (0.08 + Math.random() * 0.15),
      safe: 0.9, hue: bubbleHue(S.t * 140 + Math.random() * 40),
    });
  }
  if (Math.random() < 0.5) ctx.fx.burst(W.x, W.y, { color: pick(['#fff', '#cff6ff', '#ffcc33', '#ff9ad5']), count: 2, size: 5, gravity: -40, speed: 120, life: 0.5 });
  if (W.t <= 3 && !W.said) { W.said = true; sayMaybe('Three, two, one...', { gap: 0 }); }
  if (W.t <= 0) { S.wand = null; ctx.sfx.whoosh(); setCallout('Wand all done!', '#5ee0ff'); }
}

// ---------------------------------------------------------------- round flow

function startStorm() {
  if (S.phase !== 'play') return;
  S.phase = 'storm'; S.t = Math.max(S.t, ROUND);
  S.stormSpawned = 0;
  ctx.sfx.whoosh(); ctx.sfx.boom(); ctx.fx.shake(18); ctx.fx.confetti(120);
  setCallout('🌪️ BUBBLE STORM!', '#b48cff', 2);
  S.lastSay = -10;
  sayMaybe('BUBBLE STORM! Pop them all!', { gap: 0 });
}

function endStorm() {
  // everything left pops in one last cascade: all his bubbles count
  S.finalPop = true;
  let i = 0;
  for (const b of S.bubbles) if (!b.gone) S.pending.push({ b, at: S.t + 0.25 + (i++) * 0.04, cause: b.kind === 'normal' ? 'storm' : 'hand' });
  S.phase = 'finale'; S.finaleT = 0;
  setCallout('STORM OVER!', '#fff');
}

function showScore() {
  S.phase = 'score'; S.scoreT = 0; S.nextIn = 10;
  S.wand = null;
  S.newBest = S.score > S.best;
  if (S.newBest) { S.best = S.score; saveBest(S.score); }
  ctx.music.jingle('win');
  ctx.fx.confetti(S.newBest ? 260 : 120);
  if (S.newBest) { ctx.sfx.tada(); ctx.say(`New best score! ${S.score}!`); }
  else ctx.say(`You got ${S.score}! Great popping!`);
}

function againButton() {
  const u = unit();
  return { x: ctx.W / 2, y: ctx.H * 0.8, r: u * 0.11 };
}

function restart() {
  newRound();
  ctx.fx.clear?.();
  ctx.say('Here come the bubbles! Wait for them to get giant!');
}

// ---------------------------------------------------------------- game

const game = {
  needs: ['motion', 'pose', 'color'],

  init(c) {
    ctx = c;
    sprites.clear();
    newRound();
    c.say('Pop the bubbles! Or wait, and they get GIANT!');

    c.gestures.on('spin', () => {
      if (!S || (S.phase !== 'play' && S.phase !== 'storm')) return;
      S.stats.spins++;
      swirl(14, 1);
      c.sfx.whoosh(); c.fx.shake(8);
      setCallout('🌀 SPIN BUBBLES!', '#5ee0ff');
      sayMaybe(pick(['Spinny bubbles!', 'Whoosh!', 'Spin spin spin!']), { gap: 4 });
    });
    c.gestures.on('turn', () => {
      if (!S || (S.phase !== 'play' && S.phase !== 'storm')) return;
      swirl(4, 0.6);
      c.sfx.squeak(1.2);
    });

    onPointer = (e) => {
      if (!S) return;
      if (S.phase === 'score') {
        const b = againButton();
        if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r * 1.3 && S.scoreT > 1) restart();
        return;
      }
      for (const b of S.bubbles) if (!b.gone && Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r * 1.1) { popBubble(b, 'tap'); break; }
    };
    c.view.canvas.addEventListener('pointerdown', onPointer);

    onKey = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      const kinds = { 1: 'boom', 2: 'rainbow', 3: 'critter', 4: 'golden', 5: 'wand' };
      if (kinds[k] && S.phase !== 'score') { if (S.specialAlive) S.specialAlive.gone = true; spawnSpecial(kinds[k]).y = c.H * 0.7; }
      if (k === '6') spawnBubble({ r: maxR() * 0.85, n: 12, y: c.H * 0.6, x: c.W / 2, vy: -unit() * 0.05 });
      if (k === '7') for (let i = 0; i < 14; i++) spawnBubble({ y: c.H * (0.3 + Math.random() * 0.6) });
      if (k === 'k') { S.simToy = 3; if (!S.wand) startWand(c.W / 2, c.H / 2); }
      if (k === 'g') startStorm();
      if (k === 'e') { if (S.phase !== 'score') showScore(); }
    };
    if (debugOn) addEventListener('keydown', onKey);
    if (debugOn && window.wiggle) window.wiggle.gameApi = game; // console: step the game by hand (wiggle.gameApi.update(dt, wiggle.ctx))
    game.debugSkip = {
      next: () => { if (S.phase === 'score') restart(); else showScore(); },
      finale: () => { if (S.phase === 'play') startStorm(); },
    };
  },

  // for scripts/test-bubble-pop.js and the console
  debugState: () => S,
  debugWand: () => startWand(ctx.W / 2, ctx.H / 2),

  update(dt, c) {
    if (!S) return;
    const u = unit();
    S.t += dt;
    S.bump = Math.max(0, S.bump - dt * 3);
    if (S.callout) { S.callout.t += dt; if (S.callout.t > S.callout.life) S.callout = null; }
    S.simToy = Math.max(0, S.simToy - dt);

    // the toy finder learns the room all round; while the wand is on, nothing is learned away
    const toy = S.toy.update(dt, toySample(c, S.toy.colors), { learn: !S.wand });
    wristSpeeds(dt);

    if (S.phase === 'score') {
      S.scoreT += dt;
      S.nextIn -= dt;
      if (S.nextIn <= 0) restart();
      return;
    }

    // ---- round clock
    if (S.phase === 'play') {
      if (S.t >= ROUND - 8 && !S.stormSaid) { S.stormSaid = true; S.lastSay = -10; sayMaybe('A bubble storm is coming!', { gap: 0 }); }
      if (S.t >= ROUND) startStorm();
      // specials, one at a time
      if (S.specialIdx < S.specials.length && S.t >= SPECIAL_AT[S.specialIdx] && !S.specialAlive && !S.wand) {
        spawnSpecial(S.specials[S.specialIdx++]);
      }
    } else if (S.phase === 'storm') {
      if (S.t >= ROUND + STORM) endStorm();
    } else if (S.phase === 'finale') {
      S.finaleT += dt;
      if (S.finaleT > 2.6 && !S.pending.length && !S.minis.length) showScore();
    }

    // ---- spawning
    S.spawnIn -= dt;
    if (S.phase === 'storm') {
      if (S.spawnIn <= 0 && S.bubbles.length < maxBubbles() && S.stormSpawned < (MAX_BUBBLES[tier()] || 30) * 1.6) {
        S.spawnIn = 0.07; S.stormSpawned++;
        const side = Math.random();
        if (side < 0.7) spawnBubble({ vy: -u * (0.3 + Math.random() * 0.3) });
        else { const left = side < 0.85; spawnBubble({ x: left ? -u * 0.05 : c.W + u * 0.05, y: c.H * (0.4 + Math.random() * 0.5), vx: (left ? 1 : -1) * u * 0.5, vy: -u * 0.1 }); }
      }
    } else if (S.phase === 'play' && S.spawnIn <= 0 && S.bubbles.length < maxBubbles()) {
      S.spawnIn = 0.35 + Math.random() * 0.35;
      spawnBubble();
    }

    updateSwirls(dt);
    if (S.wand) updateWand(dt, toy);

    // ---- move bubbles
    const top = hudBottom();
    for (const b of S.bubbles) {
      if (b.gone) continue;
      b.age += dt;
      b.squish = Math.max(0, b.squish - dt * 3);
      const big = b.r / u;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x += Math.sin(c.time * 1.5 + b.phase) * u * 0.02 * dt;
      // drag toward a gentle float (bigger bubbles float slower)
      const floatVy = -u * (0.13 - Math.min(0.09, big * 0.35));
      b.vx *= Math.pow(0.35, dt);
      b.vy += (floatVy - b.vy) * Math.min(1, dt * 1.2);
      // walls + ceiling (under the score band); specials drift away after a while
      const leaving = b.kind !== 'normal' && b.age > SPECIAL_STAY; // not popped: it floats away so the next one can come
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > c.W - b.r) { b.x = c.W - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      if (!leaving && b.y < top + b.r) { b.y += (top + b.r - b.y) * Math.min(1, dt * 6); b.vy = Math.max(b.vy, 0); }
      if (leaving && b.y < -b.r) { b.gone = true; if (b === S.specialAlive) S.specialAlive = null; }
    }

    // ---- merging: bubbles that touch become one bigger bubble
    const list = S.bubbles;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.gone) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.gone) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), sum = a.r + b.r;
        if (d >= sum) continue;
        const canMerge = a.kind === 'normal' && b.kind === 'normal' && a.age > 0.4 && b.age > 0.4 && d < sum * 0.8;
        const newR = Math.sqrt(a.r * a.r + b.r * b.r);
        if (canMerge && newR <= maxR()) { merge(a, b, newR); if (a.gone) break; continue; }
        // can't merge (special, or already as big as they get): push apart softly
        const push = (sum - d) / 2 * Math.min(1, dt * 8);
        const nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
    }

    // ---- popping (movement where the bubble is)
    const { view, motion } = c;
    for (const b of list) {
      if (b.gone || b.age < Math.max(0.3, b.safe) || S.phase === 'finale') continue;
      const probe = Math.min(b.r, u * 0.07);
      const pts = [[b.x, b.y]];
      if (b.r > u * 0.08) for (let k = 0; k < 4; k++) pts.push([b.x + Math.cos(k * 1.57) * b.r * 0.55, b.y + Math.sin(k * 1.57) * b.r * 0.55]);
      for (const [x, y] of pts) {
        const n = view.toNorm(x, y);
        if (motion.at(n.x, n.y, (probe / view.dw) * 0.8) > 0.18) { popBubble(b, 'hand'); break; }
      }
    }

    // ---- delayed pops (boom shockwave, rainbow wave, final cascade)
    for (let i = S.pending.length - 1; i >= 0; i--) {
      const p = S.pending[i];
      if (S.t >= p.at) { S.pending.splice(i, 1); if (!p.b.gone) popBubble(p.b, p.cause); }
    }

    // ---- minis: the chain shower
    for (let i = S.minis.length - 1; i >= 0; i--) {
      const m = S.minis[i];
      m.t += dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vx *= Math.pow(0.08, dt); m.vy *= Math.pow(0.08, dt);
      m.vy -= u * 0.1 * dt;
      if (m.t >= m.popAt) {
        S.minis.splice(i, 1);
        S.chain.n++; S.chain.quiet = 0;
        // long chains: the top callout counts, so the screen doesn't fill up with "+50"s
        addScore(chainPts(), m.x, m.y, 30 + Math.min(S.chain.n, 20) * 1.5, S.chain.n > 6);
        c.sfx.squeak(0.9 + Math.min(S.chain.n, 24) * 0.05);
        c.fx.burst(m.x, m.y, { color: `hsl(${m.hue} 95% 70%)`, count: 10, size: 5, speed: 260 });
        // a chain pop spreads to the bubbles right next to it
        for (const b of S.bubbles) {
          if (b.gone || b.kind !== 'normal') continue;
          if (Math.hypot(b.x - m.x, b.y - m.y) < b.r + m.r * 2.5) popBubble(b, 'chain');
        }
      }
    }
    if (S.chain.n > 0) {
      S.chain.quiet += dt;
      if (!S.minis.length && S.chain.quiet > 0.45) endChain();
    }

    // ---- critters (never get hurt: they wave and swim away)
    for (let i = S.critters.length - 1; i >= 0; i--) {
      const cr = S.critters[i];
      cr.t += dt;
      if (cr.t > 1.8) {
        if (!cr.giggled) { cr.giggled = true; c.sfx.giggle(); }
        cr.x += cr.dir * u * 0.7 * dt;
        cr.y += Math.sin(cr.t * 8) * u * 0.25 * dt;
        if (cr.x < -u * 0.3 || cr.x > c.W + u * 0.3) S.critters.splice(i, 1);
      } else cr.y -= u * 0.03 * dt;
    }
    for (let i = S.rings.length - 1; i >= 0; i--) { S.rings[i].t += dt; if (S.rings[i].t > 0.6) S.rings.splice(i, 1); }
    for (let i = S.waves.length - 1; i >= 0; i--) { S.waves[i].t += dt; if (S.waves[i].t > S.waves[i].dur + 0.3) S.waves.splice(i, 1); }

    S.bubbles = S.bubbles.filter((b) => !b.gone);
  },

  draw(g, c) {
    if (!S) return;
    const { W, H } = c;
    const u = unit();

    // rainbow wave sweeping across
    for (const w of S.waves) {
      const x = (w.t / w.dur) * W;
      const band = u * 0.35;
      g.save(); g.globalAlpha = 0.35 * (1 - Math.max(0, w.t - w.dur) / 0.3);
      ['#ff3b3b', '#ff9f1c', '#ffd400', '#2fd35a', '#3b7bff', '#b48cff'].forEach((col, i) => {
        g.fillStyle = col; g.fillRect(x - band + (i * band) / 6, 0, band / 6 + 1, H);
      });
      g.restore();
    }
    // boom shockwaves
    for (const r of S.rings) {
      const k = r.t / 0.6;
      g.save(); g.globalAlpha = 1 - k; g.lineWidth = u * 0.03 * (1 - k) + 2; g.strokeStyle = r.color;
      g.beginPath(); g.arc(r.x, r.y, r.R * k, 0, Math.PI * 2); g.stroke(); g.restore();
    }

    // bubbles
    for (const b of S.bubbles) drawBubble(g, b, c);
    // chain minis
    for (const m of S.minis) {
      const k = 1 - Math.max(0, m.popAt - m.t) / m.popAt;
      g.drawImage(sprite(m.hue), m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      if (k > 0.8) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, m.r * (1 + (k - 0.8) * 2), 0, 7); g.stroke(); }
    }
    // critters
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const cr of S.critters) {
      const s = Math.min(1, cr.t / 0.35);
      const size = u * 0.14 * (0.4 + 0.6 * s) * (1 + 0.08 * Math.sin(cr.t * 10));
      g.save(); g.translate(cr.x, cr.y);
      if (cr.t < 1.8) g.rotate(Math.sin(cr.t * 9) * 0.25); else g.scale(cr.dir, 1); // swim facing away
      g.font = `${size}px sans-serif`; g.fillText(cr.emoji, 0, 0);
      g.restore();
      if (cr.t > 0.3 && cr.t < 1.8) { g.font = `${u * 0.07}px sans-serif`; g.fillText('👋', cr.x + u * 0.09, cr.y - u * 0.07 + Math.sin(cr.t * 12) * u * 0.015); }
    }

    // wand: sparkly tip + countdown ring that empties over 10 s
    if (S.wand) drawWand(g, S.wand, c);

    drawHud(g, c);
    if (S.phase === 'score') drawScoreScreen(g, c);
  },

  destroy(c) {
    if (onKey) removeEventListener('keydown', onKey);
    if (onPointer) c.view.canvas.removeEventListener('pointerdown', onPointer);
    onKey = onPointer = null;
    S = null;
    if (debugOn && window.wiggle) window.wiggle.game = null;
  },
};

function merge(a, b, newR) {
  // the bigger one swallows the smaller one
  const [big, small] = a.r >= b.r ? [a, b] : [b, a];
  const wb = big.r * big.r, ws = small.r * small.r;
  big.x = (big.x * wb + small.x * ws) / (wb + ws);
  big.y = (big.y * wb + small.y * ws) / (wb + ws);
  big.vx = (big.vx * wb + small.vx * ws) / (wb + ws);
  big.vy = (big.vy * wb + small.vy * ws) / (wb + ws);
  const wasGiant = big.r >= giantR();
  big.r = newR; big.n += small.n; big.value += small.value; big.squish = 1;
  big.safe = Math.min(big.safe, big.age + 0.1);
  small.gone = true;
  ctx.sfx.tone(clamp(520 - newR * 2.2, 150, 520), 0.09, 'sine', 0.12);
  if (!wasGiant && big.r >= giantR()) {
    ctx.sfx.boing();
    ctx.fx.burst(big.x, big.y, { color: '#fff', count: 16, size: 6, gravity: 0, speed: 200, life: 0.5 });
    setCallout('GIANT BUBBLE!', '#b48cff');
    sayMaybe(pick(['It\'s getting GIANT!', 'Woah, a giant bubble!', 'So big!']), { gap: 8 });
  }
}

function endChain() {
  const n = S.chain.n;
  S.chain.n = 0; S.chain.quiet = 0;
  if (n < 3) return;
  S.stats.bestChain = Math.max(S.stats.bestChain, n);
  const bonus = n * 10;
  addScore(bonus);
  setCallout(`CHAIN ×${n}! +${bonus}`, '#ffcc33');
  if (n >= 8) { ctx.sfx.tada(); ctx.fx.confetti(Math.min(220, 60 + n * 8)); sayMaybe(pick(['Super chain!', 'Chain reaction!', 'Pop pop pop pop!']), { gap: 3 }); }
}

// ---------------------------------------------------------------- drawing

// One picture per hue bucket, drawn once (no gradients per bubble per frame).
function sprite(hue) {
  const key = Math.round(((hue % 360) + 360) % 360 / 15) * 15;
  let s = sprites.get(key);
  if (s) return s;
  const R = 64;
  s = document.createElement('canvas');
  s.width = s.height = R * 2;
  const g = s.getContext('2d');
  g.translate(R, R);
  const grad = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  grad.addColorStop(0, `hsla(${key} 100% 95% / .55)`);
  grad.addColorStop(0.7, `hsla(${key} 90% 70% / .25)`);
  grad.addColorStop(1, `hsla(${key} 90% 60% / .75)`);
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, R - 3, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = `hsla(${key} 100% 85% / .9)`; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath(); g.ellipse(-R * 0.38, -R * 0.42, R * 0.18, R * 0.1, -0.7, 0, Math.PI * 2); g.fill();
  sprites.set(key, s);
  return s;
}

function drawBubble(g, b, c) {
  const wob = 1 + Math.sin(c.time * 6 + b.phase) * 0.04 + b.squish * 0.12 * Math.sin(b.squish * 18);
  const fresh = b.age < b.safe ? 0.55 + 0.45 * (b.age / b.safe) : 1;
  g.save();
  g.translate(b.x, b.y);
  g.scale(wob, 2 - wob);
  g.globalAlpha = fresh;
  if (b.kind !== 'normal') {
    // specials glow and pulse so he sees them coming
    const pulse = 1 + 0.08 * Math.sin(c.time * 8);
    g.fillStyle = `hsla(${b.hue} 100% 70% / .25)`;
    g.beginPath(); g.arc(0, 0, b.r * 1.35 * pulse, 0, Math.PI * 2); g.fill();
  }
  g.drawImage(sprite(b.hue), -b.r, -b.r, b.r * 2, b.r * 2);
  if (b.r >= giantR()) {
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(3, b.r * 0.04);
    g.setLineDash([b.r * 0.12, b.r * 0.12]); g.lineDashOffset = -c.time * 30;
    g.beginPath(); g.arc(0, 0, b.r * 1.07, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (b.kind !== 'normal') {
    const em = b.kind === 'critter' ? b.critter.emoji : SPECIALS[b.kind].emoji;
    g.font = `${b.r * 1.05}px sans-serif`;
    g.fillText(em, 0, b.kind === 'critter' ? Math.sin(c.time * 4) * b.r * 0.08 : 0);
  } else if (b.n >= 3) {
    // how many bubbles are inside: ×8
    const fs = Math.min(b.r * 0.6, unit() * 0.09);
    g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
    g.lineWidth = fs / 6; g.strokeStyle = 'rgba(27,17,64,.55)'; g.strokeText(`×${b.n}`, 0, 0);
    g.fillStyle = '#fff'; g.fillText(`×${b.n}`, 0, 0);
  }
  g.restore();
}

function drawWand(g, W, c) {
  const u = unit();
  const R = u * 0.085;
  const frac = clamp(W.t / WAND_TIME, 0, 1);
  const col = W.source === 'toy' ? (TOY_CSS[W.toyColor] || '#5ee0ff') : '#5ee0ff';
  g.save();
  g.lineWidth = u * 0.018; g.lineCap = 'round';
  g.strokeStyle = 'rgba(27,17,64,.45)';
  g.beginPath(); g.arc(W.x, W.y, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = frac < 0.3 ? '#ff5ea8' : col;
  g.beginPath(); g.arc(W.x, W.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
  g.font = `${u * 0.08}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(W.source === 'toy' ? '✨' : W.source === 'hand' ? '✋' : '🪄', W.x, W.y);
  g.restore();
  // the same countdown big and readable at the top right (a number he can read)
  const hx = c.W - u * 0.1, hy = u * 0.1, hr = u * 0.065;
  g.save();
  g.fillStyle = 'rgba(27,17,64,.6)'; g.beginPath(); g.arc(hx, hy, hr * 1.15, 0, Math.PI * 2); g.fill();
  g.lineWidth = u * 0.014; g.strokeStyle = frac < 0.3 ? '#ff5ea8' : '#5ee0ff';
  g.beginPath(); g.arc(hx, hy, hr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
  g.font = `900 ${hr}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(Math.ceil(W.t), hx, hy + hr * 0.05);
  g.font = `${hr * 0.6}px sans-serif`; g.fillText('🪄', hx - hr * 1.2, hy + hr * 0.9);
  g.restore();
}

function drawHud(g, c) {
  const { W, H } = c;
  const u = unit();
  if (S.phase === 'score') { drawTag(g, c); return; } // the score screen shows the big score
  // big score, top-center
  const size = u * 0.12 * (1 + S.bump * 0.3);
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'top';
  g.lineWidth = size / 8; g.strokeStyle = 'rgba(27,17,64,.8)';
  g.strokeText(S.score, W / 2, 12);
  g.fillStyle = '#ffcc33';
  g.fillText(S.score, W / 2, 12);

  // round bar under the score: fills up to the storm cloud
  if (S.phase !== 'score') {
    const bw = Math.min(W * 0.5, u * 0.8), bh = Math.max(8, u * 0.022);
    const bx = W / 2 - bw / 2, by = 12 + u * 0.13;
    const storm = S.phase !== 'play';
    const frac = storm ? 1 - clamp((S.t - ROUND) / STORM, 0, 1) : clamp(S.t / ROUND, 0, 1);
    g.fillStyle = 'rgba(27,17,64,.55)'; roundRect(g, bx, by, bw, bh, bh / 2); g.fill();
    g.fillStyle = storm ? '#b48cff' : '#5ee0ff'; roundRect(g, bx, by, Math.max(bh, bw * frac), bh, bh / 2); g.fill();
    g.font = `${bh * 2.6}px sans-serif`; g.textBaseline = 'middle';
    g.fillText(storm ? '🌪️' : '⛈️', bx + bw + bh * 2, by + bh / 2);
    g.fillText('🫧', bx - bh * 2, by + bh / 2);
  }

  // callouts (CHAIN ×8!, GIANT!, BOOM!) live up here, never over the bubbles
  const c0 = S.callout, busy = c0 && (c0.text.startsWith('CHAIN') || (c0.prio > 1 && c0.t < 1));
  const live = S.chain.n >= 2 && !busy ? { text: `CHAIN ×${S.chain.n}`, color: '#ffcc33', t: 0.3, life: 9 } : S.callout;
  if (live) {
    const pop = Math.min(1, live.t / 0.15);
    const fade = live.life - live.t < 0.3 ? (live.life - live.t) / 0.3 : 1;
    const fs = u * 0.075 * (0.6 + 0.4 * pop) * (live === S.callout ? 1 : 1 + 0.02 * S.chain.n);
    g.save(); g.globalAlpha = fade;
    g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.lineWidth = fs / 6; g.strokeStyle = 'rgba(27,17,64,.85)';
    const y = 12 + u * 0.165;
    g.strokeText(live.text, W / 2, y); g.fillStyle = live.color; g.fillText(live.text, W / 2, y);
    g.restore();
  }

  drawTag(g, c);
}

function drawTag(g, c) {
  const { W, H } = c;
  const u = unit();
  // release tag, small
  g.font = `700 ${Math.max(11, u * 0.025)}px system-ui, sans-serif`;
  g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(255,255,255,.6)';
  g.fillText(`v${c.release}`, W - 10, H - 8);
}

function drawScoreScreen(g, c) {
  const { W, H } = c;
  const u = unit();
  const k = Math.min(1, S.scoreT / 0.4);
  g.save();
  g.fillStyle = `rgba(27,17,64,${0.72 * k})`; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // big score
  const fs = u * 0.24 * (0.7 + 0.3 * k) * (1 + 0.03 * Math.sin(S.scoreT * 5));
  g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = fs / 10; g.strokeStyle = 'rgba(0,0,0,.4)';
  g.strokeText(S.score, W / 2, H * 0.32); g.fillStyle = '#ffcc33'; g.fillText(S.score, W / 2, H * 0.32);
  g.font = `${u * 0.09}px sans-serif`; g.fillText('🫧', W / 2 - fs * 0.25 * String(S.score).length - u * 0.08, H * 0.32);
  // best
  const bs = u * 0.065;
  g.font = `900 ${bs}px ui-rounded, system-ui, sans-serif`;
  g.fillStyle = S.newBest ? '#7dff6a' : '#fff';
  g.fillText(S.newBest ? `🏆 NEW BEST!` : `🏆 BEST ${S.best}`, W / 2, H * 0.48);
  // little stats he can read: bubbles popped, best chain, giants
  g.font = `800 ${u * 0.05}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#cff6ff';
  g.fillText(`🫧 ${S.stats.popped}    🔗 ×${S.stats.bestChain}    🟣 ${S.stats.giants}`, W / 2, H * 0.6);
  // play again button with the countdown ring
  const b = againButton();
  const pulse = 1 + 0.05 * Math.sin(S.scoreT * 6);
  g.fillStyle = '#7dff6a'; g.beginPath(); g.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2); g.fill();
  g.lineWidth = u * 0.016; g.strokeStyle = '#fff';
  g.beginPath(); g.arc(b.x, b.y, b.r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(S.nextIn / 10, 0, 1)); g.stroke();
  g.fillStyle = '#1b1140';
  g.beginPath(); g.moveTo(b.x - b.r * 0.3, b.y - b.r * 0.42); g.lineTo(b.x + b.r * 0.45, b.y); g.lineTo(b.x - b.r * 0.3, b.y + b.r * 0.42); g.closePath(); g.fill();
  g.font = `900 ${u * 0.045}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff';
  g.fillText(Math.ceil(Math.max(0, S.nextIn)), b.x + b.r * 1.6, b.y);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export default game;
