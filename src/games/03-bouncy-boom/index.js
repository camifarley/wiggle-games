// Bouncy Boom: wave to splurt slime and bouncy googly-eyed balls. Balls pile up.
// SPIN around and every ball bursts into confetti (more balls = bigger multiplier).
// Every ~90 s a Slime Monster naps: move sneakily to earn a MEGA ball (or wake it: ACHOO!).
// Brief: docs/briefs/03-bouncy-boom.md

const LEVELS = [
  { slime: '#6be04a', name: 'Bouncy balls' },
  { slime: '#b06bff', name: 'Glitter balls!', unlock: 'glitter' },
  { slime: '#4ab8ff', name: 'Tiny super balls!', unlock: 'tiny' },
  { slime: '#ffcc33', name: 'Beach ball!', unlock: 'beach' },
  { slime: '#ff5ea8', name: 'Rainbow balls!', unlock: 'rainbow' },
];
const TYPES = {
  rubber:  { r: 0.045, bounce: 0.85, worth: 1, weight: 4 },
  glitter: { r: 0.045, bounce: 0.86, worth: 1, weight: 3 },
  tiny:    { r: 0.026, bounce: 0.97, worth: 1, weight: 2, count: 3 },
  beach:   { r: 0.1,   bounce: 0.75, worth: 5, weight: 1, gravity: 0.5 },
  rainbow: { r: 0.05,  bounce: 0.88, worth: 2, weight: 2 },
  mega:    { r: 0.14,  bounce: 0.7,  worth: 10, weight: 0, gravity: 0.6 },
};
const CAPS = { high: 80, medium: 50, low: 30 };
const SPLAT_CAPS = { high: 60, medium: 35, low: 20 };
const TIERS = [[50, 5], [25, 3], [10, 2], [0, 1]]; // balls -> multiplier
const COLORS = ['#ff5ea8', '#ffcc33', '#5ee0ff', '#7dff6a', '#b48cff', '#ff8a3d', '#ff4d4d'];

let ctx, S, offs = [], onPointer;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const unit = () => Math.min(ctx.W, ctx.H);
const levelInfo = () => LEVELS[(S.level - 1) % LEVELS.length];
const multFor = (n) => TIERS.find(([min]) => n >= min)[1];
const ballCount = () => S.balls.reduce((s, b) => s + TYPES[b.type].worth, 0);

function fresh() {
  return {
    t: 0, mode: 'crazy', balls: [], slimes: [], splats: [], puddle: 0, jiggle: 0,
    score: 0, shown: 0, level: 1, lastBoom: 0, boomsSinceSneaky: 0, crazyTime: 0, spinTimes: [],
    look: { x: innerWidth / 2, y: innerHeight * 0.35 }, hidden: false, asleep: false, curious: 0,
    slimeAcc: 0, ballAcc: 0, sfxCool: 0, boingCool: 0, voiceCool: 4, teased: new Set(),
    banner: null, flash: 0, trophy: 0, finale: false, finaleDone: false, monster: null, sneakyCount: 0,
    noise: 0, timers: [], pulse: 0,
  };
}

function later(sec, fn) { S.timers.push({ at: S.t + sec, fn }); }

// ---------- balls & slime ----------

function addBall(type, x, y, vx, vy) {
  const T = TYPES[type];
  const cap = CAPS[ctx.perf.tier.name] || 50;
  while (S.balls.length >= cap) {
    const i = S.balls.findIndex((b) => b.type !== 'mega');
    const old = S.balls.splice(i < 0 ? 0 : i, 1)[0];
    ctx.fx.burst(old.x, old.y, { color: old.color, count: 6, size: 5 });
  }
  const r = T.r * unit();
  S.balls.push({
    type, x: Math.min(ctx.W - r, Math.max(r, x)), y: Math.min(ctx.H - r, Math.max(r, y)), vx, vy, r,
    color: pick(COLORS), hue: rand(0, 360), squash: 0, surprised: 0, spark: 0, phase: rand(0, 6),
  });
}

function spawnBallsAt(x, y, power) {
  const unlocked = ['rubber', ...LEVELS.slice(1, S.level).map((l) => l.unlock)];
  const total = unlocked.reduce((s, t) => s + TYPES[t].weight, 0);
  let roll = Math.random() * total, type = 'rubber';
  for (const t of unlocked) { roll -= TYPES[t].weight; if (roll <= 0) { type = t; break; } }
  const u = unit();
  for (let i = 0; i < (TYPES[type].count || 1); i++) {
    addBall(type, x, y, rand(-0.9, 0.9) * u, -rand(1.0, 1.8) * u * (0.6 + power));
  }
  S.score += 1;
  if (S.boingCool <= 0) { ctx.sfx.boing(); S.boingCool = 0.12; }
}

function spawnSlime(x, y, power, { glass = Math.random() < 0.2, color } = {}) {
  const u = unit();
  const a = rand(-Math.PI * 0.95, -Math.PI * 0.05); // mostly upward
  const sp = u * rand(0.9, 2.2) * (0.5 + power);
  S.slimes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: u * rand(0.018, 0.04) * (0.7 + power),
    color: color || levelInfo().slime, glass, flight: rand(0.25, 0.6), wob: rand(0, 6) });
}

function stick(s) {
  const cap = SPLAT_CAPS[ctx.perf.tier.name] || 35;
  if (S.splats.length >= cap) S.splats.shift();
  S.splats.push({ x: s.x, y: s.y, r: s.r * 1.4, color: s.color, drip: 0, maxDrip: s.r * rand(2, 6), life: 6, wob: s.wob });
  if (S.sfxCool <= 0) { ctx.sfx.splat(); S.sfxCool = 0.1; }
}

// ---------- big moments ----------

function boom(source = 'spin') {
  if (S.mode !== 'crazy') return;
  const { fx, sfx, say } = ctx;
  const n = ballCount();
  const mult = multFor(n);
  const points = n * mult;
  S.score += points;
  for (const b of S.balls) {
    fx.burst(b.x, b.y, { color: b.type === 'rainbow' || b.type === 'mega' ? undefined : b.color,
      count: b.type === 'rainbow' || b.type === 'mega' ? 30 : 14, speed: 520, size: b.r * 0.25 });
  }
  S.balls.length = 0;
  fx.confetti(n >= 20 ? 220 : n > 0 ? 100 : 40);
  fx.shake(Math.min(32, 8 + n * 0.5));
  S.flash = 1;
  sfx.boom();
  if (n >= 10) sfx.tada();
  S.banner = { lines: n > 0 ? [`${n} BALLS!`, mult > 1 ? `×${mult}!` : null, `+${points}`].filter(Boolean) : ['BOOM!'], t: 0 };
  say(n === 0 ? 'Boom! Wave to make more balls!' : mult >= 3 ? 'MEGA BOOM!' : pick(['BOOOM!', 'Ka-boom!', 'Kaboom!']));
  S.lastBoom = S.t;
  S.boomsSinceSneaky++;
  if (source === 'spin') S.spinTimes.push(S.t);
  S.spinTimes = S.spinTimes.filter((t) => S.t - t < 20);

  if (S.finale && !S.finaleDone) {
    S.finaleDone = true;
    S.trophy = 6;
    fx.confetti(400);
    later(1.2, () => say(`Super party! You got ${S.score} points!`));
  } else if (n > 0) {
    S.level++;
    const info = levelInfo();
    later(1.5, () => say(S.level <= LEVELS.length ? `Level ${S.level}! ${info.name}` : `Level ${S.level}!`));
  }
  if (S.spinTimes.length >= 3) { S.spinTimes = []; later(2.5, () => startSneaky(true)); }
  else if (S.boomsSinceSneaky >= 3 && !S.finale) later(2.5, () => startSneaky(false));
}

function surprise(power = 1) {
  const u = unit();
  for (const b of S.balls) {
    b.vy = -u * rand(1.8, 2.6) * power;
    b.vx += rand(-1, 1) * u * 0.6;
    b.surprised = 1.3;
  }
}

// ---------- sneaky round ----------

function startSneaky(dizzy) {
  if (S.mode !== 'crazy' || S.finale) return;
  S.mode = 'sneaky';
  S.sneakyCount++;
  S.monster = { enter: 0, leaving: 0, awake: 0, progress: 0, wakes: 0, loudFor: 0, snoreIn: 2, hat: S.sneakyCount > 1, done: false };
  ctx.sfx.whoosh();
  ctx.say(dizzy ? "Whoa, I'm dizzy! Shhh. The slime monster is sleeping. Move slowly!"
    : 'Shhh! The slime monster is sleeping. Move slowly and sneaky!');
}

function monsterMouth() {
  const u = unit();
  return { x: ctx.W / 2, y: ctx.H - u * 0.2 + (1 - Math.min(1, S.monster.enter)) * u * 0.5 };
}

function wakeMonster() {
  const m = S.monster;
  m.awake = 3;
  m.wakes++;
  m.progress *= 0.5;
  m.loudFor = 0;
  ctx.sfx.sneeze();
  ctx.say('Ah... ah... ACHOO!');
  later(0.6, () => {
    const p = monsterMouth();
    for (let i = 0; i < 40; i++) spawnSlime(p.x, p.y, 1.2, { glass: Math.random() < 0.6, color: '#55cc44' });
    ctx.fx.shake(20);
    S.puddle = unit() * 0.09;
  });
  later(1.8, () => ctx.say(m.wakes >= 3 ? 'Bless me! Here, have a mega ball!' : 'Bless me! Shhh, try again.'));
  if (m.wakes >= 3) later(2.6, () => winSneaky(false));
}

function winSneaky(sneaky = true) {
  const m = S.monster;
  if (!m || m.done) return;
  m.done = true;
  const p = monsterMouth();
  addBall('mega', p.x, p.y - unit() * 0.1, rand(-0.3, 0.3) * unit(), -unit() * 2.2);
  ctx.sfx.tada();
  ctx.fx.burst(p.x, p.y, { count: 60, speed: 600 });
  if (sneaky) ctx.say('So sneaky! Mega ball!');
  later(1.5, () => { m.leaving = 0.001; ctx.sfx.whoosh(); });
  later(3, () => {
    S.mode = 'crazy'; S.monster = null; S.crazyTime = 0; S.boomsSinceSneaky = 0; S.spinTimes = [];
    ctx.say('Wave your hands! Make more balls!');
  });
}

function updateSneaky(dt) {
  const m = S.monster;
  if (m.leaving) { m.leaving += dt; return; }
  m.enter += dt / 1.5;
  if (m.enter < 1 || m.done) return;
  if (m.awake > 0) { m.awake -= dt; return; }
  const QUIET = 0.035, LOUD = 0.09;
  m.snoreIn -= dt;
  if (m.snoreIn <= 0) {
    m.snoreIn = 2.4;
    ctx.sfx.snore();
    const p = monsterMouth();
    ctx.fx.text(p.x + unit() * 0.2, p.y - unit() * 0.3, 'Z', { size: 56, color: '#cfe' });
  }
  if (S.noise < QUIET) m.progress += dt / 10;
  if (S.noise > LOUD) { m.loudFor += dt; if (m.loudFor > 0.35) wakeMonster(); }
  else m.loudFor = Math.max(0, m.loudFor - dt);
  if (m.progress >= 1) winSneaky(true);
}

// ---------- game ----------

export default {
  needs: ['motion', 'face'],

  init(c) {
    ctx = c;
    S = fresh();
    const g = ctx.gestures;
    offs = [
      g.on('spin', () => boom('spin')),
      g.on('hide', () => { S.hidden = true; }),
      g.on('peekaboo', () => {
        S.hidden = false;
        surprise();
        ctx.sfx.giggle();
        ctx.say(pick(['Boo!', 'Peekaboo!', 'There you are!']));
      }),
      g.on('leave', () => { S.hidden = false; S.asleep = true; }),
      g.on('return', () => {
        S.asleep = false;
        surprise(1.2);
        ctx.sfx.ding();
        ctx.say("You're back!");
      }),
      g.on('still', () => { if (S.mode === 'crazy') S.curious = 4; }),
    ];
    onPointer = (e) => {
      if (!S.showButton) return;
      const b = buttonPos();
      if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r * 1.2) boom('button');
    };
    ctx.view.canvas.addEventListener('pointerdown', onPointer);
    ctx.say('Wave your hands!');
  },

  update(dt) {
    const { W, H, view, motion } = ctx;
    const u = unit();
    S.t += dt;
    S.sfxCool -= dt; S.boingCool -= dt; S.voiceCool -= dt;
    S.flash = Math.max(0, S.flash - dt * 3);
    S.trophy = Math.max(0, S.trophy - dt);
    S.pulse += dt;
    S.curious = Math.max(0, S.curious - dt);
    S.noise += (motion.total - S.noise) * Math.min(1, dt * 5);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.6) S.banner = null; }
    for (let i = S.timers.length - 1; i >= 0; i--) {
      if (S.t >= S.timers[i].at) { const fn = S.timers[i].fn; S.timers.splice(i, 1); fn(); }
    }
    // Score counts up quickly
    S.shown += Math.max(1, (S.score - S.shown) * 4 * dt);
    if (S.shown > S.score) S.shown = S.score;

    if (ctx.face.found) {
      const p = view.toScreen(ctx.face.center.x, ctx.face.center.y);
      S.look.x += (p.x - S.look.x) * Math.min(1, dt * 10);
      S.look.y += (p.y - S.look.y) * Math.min(1, dt * 10);
    }

    // ----- crazy mode: waving makes slime + balls -----
    if (S.mode === 'crazy') {
      S.crazyTime += dt;
      for (const hs of motion.hotspots(3, 0.18)) {
        const p = view.toScreen(hs.x, hs.y);
        const power = Math.min(1, hs.strength * 1.6);
        S.slimeAcc += 9 * power * dt;
        S.ballAcc += 1.6 * power * dt;
        while (S.slimeAcc >= 1) { S.slimeAcc--; spawnSlime(p.x, p.y, power); if (S.sfxCool <= 0) { ctx.sfx.squish(); S.sfxCool = 0.09; } }
        while (S.ballAcc >= 1) { S.ballAcc--; spawnBallsAt(p.x, p.y, power); }
      }
      const n = ballCount();
      for (const [at, line] of [[10, 'Ten balls! Spin around to BOOM!'], [25, 'So many balls! Times three!'], [50, 'FIFTY balls! Spin! Spin!']]) {
        if (n >= at && !S.teased.has(at)) { S.teased.add(at); ctx.say(line); }
      }
      if (n < 5) S.teased.clear();
      if (S.voiceCool <= 0 && S.slimeAcc > 0.5) { S.voiceCool = rand(8, 14); ctx.say(pick(['Splat!', 'Sploosh!', 'Slimy!', 'More balls!']), { interrupt: false }); }
      if (S.crazyTime > 85 && !S.finale) startSneaky(false);
      if (S.t > 240 && !S.finale) {
        S.finale = true;
        ctx.say('Super party! Biggest spin ever! Get ready!');
        for (let i = 0; i < 30; i++) later(i * 0.1, () => spawnBallsAt(rand(0.1, 0.9) * W, H * 0.3, 0.8));
        later(3.5, () => ctx.say('Now SPIN!'));
      }
      S.showButton = (ballCount() >= 25 && S.t - S.lastBoom > 20) || (S.finale && !S.finaleDone && S.t > 252);
    } else {
      S.showButton = false;
      updateSneaky(dt);
    }

    // ----- physics -----
    S.puddle = Math.max(0, S.puddle - u * 0.004 * dt);
    S.jiggle *= Math.pow(0.02, dt);
    const floorY = H - S.puddle;
    const calm = S.mode === 'sneaky' || S.asleep;
    for (const b of S.balls) {
      const T = TYPES[b.type];
      b.vy += u * 2.4 * (T.gravity || 1) * dt;
      if ((S.hidden || S.curious > 0) && !S.asleep) b.vx += Math.sign(S.look.x - b.x) * u * 0.8 * dt;
      if (S.asleep) b.vx *= Math.pow(0.3, dt);
      const vmax = u * 4;
      b.vx = Math.max(-vmax, Math.min(vmax, b.vx));
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * T.bounce; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * T.bounce; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * T.bounce; }
      if (b.y > floorY - b.r) {
        b.y = floorY - b.r;
        if (b.vy > 0) {
          b.squash = Math.min(1, b.vy / (u * 3));
          b.vy = -b.vy * T.bounce;
          S.jiggle = Math.max(S.jiggle, b.squash * 0.6);
          b.vx *= 0.97;
        }
        // keep them lively (they're bouncy balls!)
        if (!S.asleep && Math.abs(b.vy) < u * 0.9) {
          if (!calm) b.vy = -u * rand(1.0, 1.9);
          else if (Math.random() < dt * 0.5) b.vy = -u * rand(0.3, 0.6);
        }
      }
      b.squash = Math.max(0, b.squash - dt * 5);
      b.surprised = Math.max(0, b.surprised - dt);
      if (b.type === 'glitter' || b.type === 'mega') {
        b.spark -= dt;
        if (b.spark <= 0) { b.spark = 0.12; ctx.fx.burst(b.x, b.y, { color: '#fff', count: 2, speed: 50, size: 3, gravity: 0, life: 0.5 }); }
      }
      if (S.asleep && Math.random() < dt * 0.15) ctx.fx.text(b.x, b.y - b.r, 'z', { size: 28, color: '#cfe' });
    }

    for (let i = S.slimes.length - 1; i >= 0; i--) {
      const s = S.slimes[i];
      s.vy += u * 2 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.flight -= dt;
      if (s.glass && s.flight <= 0) { stick(s); S.slimes.splice(i, 1); continue; }
      if (s.x < 0 || s.x > W || s.y < 0) {
        s.x = Math.max(0, Math.min(W, s.x)); s.y = Math.max(0, s.y);
        stick(s); S.slimes.splice(i, 1); continue;
      }
      if (s.y > floorY) {
        S.puddle = Math.min(u * 0.09, S.puddle + s.r * 0.06);
        S.jiggle = Math.max(S.jiggle, 0.4);
        S.slimes.splice(i, 1);
      }
    }
    for (let i = S.splats.length - 1; i >= 0; i--) {
      const sp = S.splats[i];
      sp.life -= dt;
      sp.drip = Math.min(sp.maxDrip, sp.drip + u * 0.03 * dt);
      if (sp.life <= 0) S.splats.splice(i, 1);
    }
  },

  draw(g) {
    const { W, H } = ctx;
    const u = unit();
    drawSplats(g);
    drawPuddle(g, W, H, u);
    if (S.monster) drawMonster(g, u);
    for (const s of S.slimes) {
      g.fillStyle = s.color;
      g.beginPath(); g.arc(s.x, s.y, s.r * (1 + Math.sin(S.t * 20 + s.wob) * 0.12), 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.25, 0, Math.PI * 2); g.fill();
    }
    for (const b of S.balls) drawBall(g, b);
    drawHud(g, W, H, u);
    if (S.showButton) drawButton(g);
    if (S.banner) drawBanner(g, W, H, u);
    if (S.trophy > 0) drawTrophy(g, W, H, u);
    if (S.flash > 0) { g.fillStyle = `rgba(255,255,255,${S.flash * 0.35})`; g.fillRect(0, 0, W, H); }
  },

  destroy() {
    offs.forEach((off) => off());
    offs = [];
    ctx.view.canvas.removeEventListener('pointerdown', onPointer);
  },
};

// ---------- drawing ----------

function drawBall(g, b) {
  const T = b.type;
  g.save();
  g.translate(b.x, b.y);
  g.scale(1 + b.squash * 0.35, 1 - b.squash * 0.35);
  const r = b.r;
  if (T === 'beach') {
    const cols = ['#ff4d4d', '#fff', '#4ab8ff', '#fff', '#ffcc33', '#fff'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i / 6) * Math.PI * 2 + S.t, ((i + 1) / 6) * Math.PI * 2 + S.t); g.fill();
    }
  } else {
    g.fillStyle = T === 'rainbow' || T === 'mega' ? `hsl(${(b.hue + S.t * 200) % 360} 90% 60%)` : b.color;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    if (T === 'mega') { g.lineWidth = r * 0.12; g.strokeStyle = '#fff'; g.stroke(); }
  }
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); g.fill();

  // googly eyes that look at the kid
  const er = r * 0.3 * (b.surprised > 0 ? 1.35 : 1);
  const ex = r * 0.36, ey = -r * 0.1;
  if (S.asleep) {
    g.strokeStyle = '#1b1140'; g.lineWidth = Math.max(2, r * 0.08); g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * ex, ey, er * 0.7, 0.2, Math.PI - 0.2); g.stroke(); }
  } else {
    let dx = S.look.x - b.x, dy = S.look.y - b.y;
    if (S.hidden) { dx = Math.cos(S.t * 3 + b.phase); dy = Math.sin(S.t * 2 + b.phase) * 0.5; }
    const d = Math.hypot(dx, dy) || 1;
    const px = (dx / d) * er * 0.45, py = (dy / d) * er * 0.45;
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(s * ex, ey, er, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1140';
      g.beginPath(); g.arc(s * ex + px, ey + py, er * 0.5, 0, Math.PI * 2); g.fill();
    }
    if (b.surprised > 0) { g.fillStyle = '#5a1020'; g.beginPath(); g.ellipse(0, r * 0.45, r * 0.15, r * 0.2, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}

function drawSplats(g) {
  for (const s of S.splats) {
    g.globalAlpha = Math.min(1, s.life);
    g.fillStyle = s.color;
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const a = s.wob + k * 1.7;
      g.beginPath(); g.arc(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, s.r * 0.4, 0, Math.PI * 2); g.fill();
    }
    const w = s.r * 0.5;
    g.fillRect(s.x - w / 2, s.y, w, s.drip);
    g.beginPath(); g.arc(s.x, s.y + s.drip, w * 0.7, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function drawPuddle(g, W, H, u) {
  if (S.puddle < 1) return;
  const top = H - S.puddle;
  g.fillStyle = levelInfo().slime;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W + 24; x += 24) {
    g.lineTo(x, top + Math.sin(x * 0.015 + S.t * 3) * S.puddle * (0.12 + S.jiggle * 0.4));
  }
  g.lineTo(W, H);
  g.fill();
}

function drawMonster(g, u) {
  const m = S.monster;
  const enter = Math.min(1, m.enter);
  const leave = Math.min(1, m.leaving / 1.2);
  const W = ctx.W, H = ctx.H;
  const bw = u * 0.42, bh = u * 0.34;
  const cx = W / 2, by = H + (1 - enter + leave) * bh * 1.6;
  const breathe = 1 + Math.sin(S.t * 2) * 0.03;
  g.save();
  g.translate(cx, by);
  g.scale(breathe, 2 - breathe);
  g.fillStyle = '#55cc44';
  g.beginPath(); g.ellipse(0, 0, bw, bh * 1.3, 0, Math.PI, 0); g.fill();
  // drips
  for (const k of [-0.7, -0.2, 0.4, 0.8]) { g.beginPath(); g.arc(k * bw, -bh * 0.05, u * 0.03, 0, Math.PI * 2); g.fill(); }
  const awake = m.awake > 0;
  const eyeY = -bh * 0.8;
  for (const s of [-1, 1]) {
    if (awake) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s * bw * 0.35, eyeY, u * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1140'; g.beginPath(); g.arc(s * bw * 0.35, eyeY, u * 0.035, 0, Math.PI * 2); g.fill();
    } else {
      // twitchy eyelids when it's getting loud
      const twitch = m.loudFor > 0 ? Math.sin(S.t * 40) * 3 : 0;
      g.strokeStyle = '#1e5a17'; g.lineWidth = u * 0.012; g.lineCap = 'round';
      g.beginPath(); g.arc(s * bw * 0.35, eyeY + twitch, u * 0.05, 0.2, Math.PI - 0.2); g.stroke();
    }
  }
  g.fillStyle = '#1e5a17';
  const mouthR = awake ? u * 0.08 : u * (0.025 + Math.max(0, Math.sin(S.t * 2.6)) * 0.015);
  g.beginPath(); g.ellipse(0, -bh * 0.4, mouthR, mouthR * (awake ? 1.1 : 0.8), 0, 0, Math.PI * 2); g.fill();
  if (m.hat) {
    g.fillStyle = '#ff5ea8';
    g.beginPath(); g.moveTo(-u * 0.08, -bh * 1.22); g.lineTo(u * 0.08, -bh * 1.22); g.lineTo(u * 0.02, -bh * 1.75); g.fill();
    g.fillStyle = '#ffcc33'; g.beginPath(); g.arc(u * 0.02, -bh * 1.75, u * 0.025, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  // sleep bar (fills while sneaky) + noise bar
  if (enter >= 1 && !m.leaving) {
    const bwid = Math.min(W * 0.6, u * 0.9), x = (W - bwid) / 2, y = Math.max(110, H * 0.16);
    const hgt = u * 0.045;
    g.fillStyle = 'rgba(27,17,64,.7)';
    roundRect(g, x - 8, y - 8, bwid + 16, hgt * 2 + 36, 16); g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)'; roundRect(g, x + hgt * 1.4, y, bwid - hgt * 1.4, hgt, hgt / 2); g.fill();
    const grad = g.createLinearGradient(x, 0, x + bwid, 0);
    grad.addColorStop(0, '#5ee0ff'); grad.addColorStop(0.5, '#b48cff'); grad.addColorStop(1, '#ff5ea8');
    g.fillStyle = grad; roundRect(g, x + hgt * 1.4, y, Math.max(hgt, (bwid - hgt * 1.4) * Math.min(1, m.progress)), hgt, hgt / 2); g.fill();
    const ny = y + hgt + 14;
    const level = Math.min(1, S.noise / 0.12);
    g.fillStyle = 'rgba(255,255,255,.2)'; roundRect(g, x + hgt * 1.4, ny, bwid - hgt * 1.4, hgt, hgt / 2); g.fill();
    g.fillStyle = level < 0.3 ? '#7dff6a' : level < 0.75 ? '#ffcc33' : '#ff4d4d';
    roundRect(g, x + hgt * 1.4, ny, Math.max(hgt, (bwid - hgt * 1.4) * level), hgt, hgt / 2); g.fill();
    g.font = `${hgt * 1.1}px sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('💤', x, y + hgt / 2);
    g.fillText('🔊', x, ny + hgt / 2);
  }
}

function drawHud(g, W, H, u) {
  // ball counter (right of the back button) + progress to next multiplier
  const n = ballCount();
  const x = 112, y = 22;
  const fs = Math.max(34, u * 0.075);
  g.textBaseline = 'top'; g.textAlign = 'left';
  g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = fs / 7; g.strokeStyle = 'rgba(27,17,64,.8)';
  const mult = multFor(n);
  const label = `🔴 ${n}${mult > 1 ? `  ×${mult}` : ''}`;
  g.strokeText(label, x, y); g.fillStyle = '#fff'; g.fillText(label, x, y);
  const next = [...TIERS].reverse().find(([min]) => min > n);
  if (next) {
    const prev = [...TIERS].find(([min]) => min <= n)[0];
    const bw = fs * 3.2, by = y + fs * 1.15;
    g.fillStyle = 'rgba(27,17,64,.6)'; roundRect(g, x, by, bw, fs * 0.3, fs * 0.15); g.fill();
    g.fillStyle = '#ffcc33'; roundRect(g, x, by, Math.max(fs * 0.3, bw * ((n - prev) / (next[0] - prev))), fs * 0.3, fs * 0.15); g.fill();
    g.font = `800 ${fs * 0.42}px ui-rounded, system-ui, sans-serif`;
    g.fillStyle = '#fff'; g.fillText(`×${next[1]} at ${next[0]}`, x + bw + 8, by - fs * 0.05);
  }
  // score
  const ss = Math.max(48, u * 0.12);
  g.textAlign = 'center';
  g.font = `900 ${ss}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = ss / 8; g.strokeStyle = 'rgba(27,17,64,.85)';
  const score = Math.floor(S.shown);
  g.strokeText(score, W / 2, 16); g.fillStyle = '#ffcc33'; g.fillText(score, W / 2, 16);
  // level badge
  const ls = Math.max(22, u * 0.045);
  g.font = `900 ${ls}px ui-rounded, system-ui, sans-serif`;
  const txt = `Level ${S.level}`;
  const tw = g.measureText(txt).width;
  g.fillStyle = levelInfo().slime; roundRect(g, W - tw - 44, 20, tw + 28, ls * 1.5, ls * 0.75); g.fill();
  g.fillStyle = '#1b1140'; g.textAlign = 'right'; g.fillText(txt, W - 30, 20 + ls * 0.25);
}

function buttonPos() {
  const r = Math.max(56, unit() * 0.1);
  return { x: ctx.W - r - 24, y: ctx.H - r - 24, r };
}

function drawButton(g) {
  const b = buttonPos();
  const p = 1 + Math.sin(S.pulse * 6) * 0.08;
  g.fillStyle = '#ff5ea8';
  g.beginPath(); g.arc(b.x, b.y, b.r * p, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  g.font = `${b.r * 1.1}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('💥', b.x, b.y + 2);
}

function drawBanner(g, W, H, u) {
  const t = S.banner.t;
  const pop = t < 0.25 ? 0.5 + (t / 0.25) * 0.7 : t < 0.4 ? 1.2 - ((t - 0.25) / 0.15) * 0.2 : 1;
  g.save();
  g.globalAlpha = Math.min(1, (2.6 - t) * 2);
  g.translate(W / 2, H * 0.45);
  g.scale(pop, pop);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = S.banner.lines;
  const fs = u * 0.13;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * fs * 1.1;
    g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
    g.lineWidth = fs / 7; g.strokeStyle = '#1b1140'; g.strokeText(line, 0, y);
    g.fillStyle = i === lines.length - 1 ? '#ffcc33' : '#fff'; g.fillText(line, 0, y);
  });
  g.restore();
}

function drawTrophy(g, W, H, u) {
  g.save();
  g.globalAlpha = Math.min(1, S.trophy);
  g.fillStyle = 'rgba(27,17,64,.5)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${u * 0.3}px sans-serif`;
  g.fillText('⭐', W / 2, H * 0.4 + Math.sin(S.t * 4) * 10);
  g.font = `900 ${u * 0.09}px ui-rounded, system-ui, sans-serif`;
  g.fillStyle = '#ffcc33'; g.fillText('SUPER PARTY!', W / 2, H * 0.62);
  g.fillStyle = '#fff'; g.fillText(Math.floor(S.score), W / 2, H * 0.74);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}
