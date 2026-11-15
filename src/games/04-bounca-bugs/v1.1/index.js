// Bounc'a Bugs: JUMP to pump a bug bag until it bursts. CROUCH and the bugs climb onto
// your head into a wobbly bug hat. JUMP with a hat and every bug bounces off.
// Sneaky round: crouch SLOWLY so the shy Bug King becomes your crown.
// Brief: docs/briefs/04-bounca-bugs.md
// v1.1 "New bugs!": 80 bugs on screen (Mac/iPhone); every bag bursts its FULL load of the new
// bug type; old bugs wave bye and march off to make room (v1.0 could release only ~2 when full).

const TYPES = {
  ladybug:     { r: 0.03,  worth: 1, fly: false, bounce: 0.6, speed: 0.22, name: 'Ladybugs!' },
  bee:         { r: 0.03,  worth: 1, fly: true,  bounce: 0.6, speed: 0.3,  name: 'Bumblebees!' },
  caterpillar: { r: 0.032, worth: 3, fly: false, bounce: 0.5, speed: 0.09, name: 'Caterpillars!' },
  firefly:     { r: 0.026, worth: 1, fly: true,  bounce: 0.6, speed: 0.25, name: 'Fireflies!' },
  beetle:      { r: 0.032, worth: 2, fly: false, bounce: 0.85, speed: 0.2, name: 'Rainbow beetles!' },
};
const ORDER = ['ladybug', 'bee', 'caterpillar', 'firefly', 'beetle'];
const CAPS = { high: 80, medium: 50, low: 35 };
const HAT_DRAW = { high: 40, medium: 25, low: 15 };
const HAT_TIERS = [[40, 5], [25, 3], [10, 2], [0, 1]];
const ROYALS = [
  { id: 'king', name: 'Bug King', line: "You're the Bug King!" },
  { id: 'queen', name: 'Bug Queen', line: 'The Bug Queen loves you!' },
  { id: 'prince', name: 'Bug Prince', line: 'The little Bug Prince!' },
];

let ctx, S, offs = [], onPointer;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const unit = () => Math.min(ctx.W, ctx.H);
const hatMult = (n) => HAT_TIERS.find(([m]) => n >= m)[1];
const worthOf = (list) => list.reduce((s, b) => s + TYPES[b.type].worth, 0);

function fresh() {
  return {
    t: 0, mode: 'crazy', bugs: [], hat: [], bag: null, bagNum: 0, nextBagIn: 0.5,
    score: 0, shown: 0, banner: null, flash: 0, royals: [], king: null, night: 0,
    head: { x: innerWidth / 2, y: innerHeight * 0.3, width: 150, roll: 0, found: false },
    sway: 0, swayV: 0, lastHeadX: null, lastRoll: 0,
    crazyTime: 0, jumpTimes: [], lastCrouch: 0, lastJump: 0, finale: false, finaleDone: false,
    timers: [], sfxCool: 0, voiceCool: 3, tickleCool: 0, noise: 0, forceCrouch: 0,
    buttons: [], fireflies: [],
  };
}
function later(sec, fn) { S.timers.push({ at: S.t + sec, fn }); }

// ---------- bugs ----------

function newBug(type, x, y, vx = 0, vy = 0) {
  const T = TYPES[type];
  return { type, x, y, vx, vy, r: T.r * unit(), mode: 'air', dir: Math.random() < 0.5 ? -1 : 1, surface: 'floor',
    phase: rand(0, 6), dizzy: 0, spin: 0, tx: 0, ty: 0, climbSpeed: rand(0.5, 1.1), airT: 0, hue: rand(0, 360), wallTop: 0 };
}

function freeBugs() { return S.bugs.filter((b) => b.mode !== 'hat'); }

function burstBag() {
  const bag = S.bag;
  const { fx, sfx, say } = ctx;
  const cap = CAPS[ctx.perf.tier.name] || 50;
  // always a full, visible load of the new bugs...
  const n = Math.min(bag.count, Math.round(cap * 0.8));
  // ...and the oldest bugs wave bye and march off to make room (the hat stays: those are his)
  let over = S.bugs.filter((b) => !b.leaving).length + S.hat.length + n - cap;
  let byes = 0;
  for (const b of S.bugs) {
    if (over <= 0) break;
    if (b.leaving) continue;
    b.leaving = true; b.mode = 'bye'; b.dir = b.x < ctx.W / 2 ? -1 : 1; b.dizzy = 0;
    over--; byes++;
  }
  if (byes > 5) later(1.6, () => ctx.say('Bye bye, old bugs!', { interrupt: false }));
  const u = unit();
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0);
    const sp = u * rand(1.2, 3.2);
    const type = bag.mega ? pick(ORDER) : bag.type; // the new bag is ALL new bugs
    S.bugs.push(newBug(type, bag.x + rand(-1, 1) * u * 0.05, bag.y - u * 0.1, Math.cos(a) * sp, Math.sin(a) * sp));
  }
  S.score += n;
  fx.burst(bag.x, bag.y - u * 0.1, { color: '#c8955a', count: 50, speed: 700, size: 10 });
  fx.confetti(bag.mega ? 300 : 120);
  fx.shake(bag.mega ? 34 : 20);
  S.flash = 1;
  sfx.boom();
  setTimeout(() => sfx.buzz(1.2), 150);
  if (bag.mega) {
    S.banner = { lines: ['MEGA BUG BOOM!', `+${n}`], t: 0 };
    say('MEGA BUG BOOM! Bugs everywhere!');
    S.finaleDone = true;
  } else {
    S.banner = { lines: ['BUGS', 'EVERYWHERE!'], t: 0 };
    say(pick(['Bugs everywhere!', 'Ka-boom! Bugs!', 'Whoa! Bugs!']));
    if (S.bagNum === 1) later(3.5, () => say('Crouch down low! Let the bugs climb on you!'));
  }
  S.bag = null;
  S.nextBagIn = 12;
}

function dropBag(mega = false) {
  S.bagNum++;
  const typeIdx = Math.min(S.bagNum - 1, ORDER.length - 1);
  const u = unit();
  S.bag = {
    type: ORDER[typeIdx], typeIdx, mega, jumps: 0, need: mega ? 10 : S.bagNum === 1 ? 3 : S.bagNum === 2 ? 5 : 7,
    count: mega ? 70 : 14 + S.bagNum * 6, x: ctx.W / 2, y: -u * 0.3, landed: false, squash: 0, wob: 0,
  };
  ctx.sfx.whoosh();
  if (mega) ctx.say('MEGA BAG! Ten jumps! Ready?');
  else if (S.bagNum === 1) ctx.say('Jump! Jump!');
  else later(1.5, () => ctx.say(`New bag! ${TYPES[S.bag?.type]?.name || ''} Jump ${S.bag?.need} times!`));
}

// ---------- jumping ----------

function onJump() {
  const { sfx, fx, say } = ctx;
  const u = unit();
  S.lastJump = S.t;
  S.jumpTimes.push(S.t);
  S.jumpTimes = S.jumpTimes.filter((t) => S.t - t < 30);
  fx.shake(6);
  // every jump: bugs on the ground hop
  for (const b of S.bugs) if (b.mode === 'crawl' && b.surface === 'floor') { b.mode = 'air'; b.vy = -u * rand(0.6, 1.0); b.vx = rand(-0.3, 0.3) * u; }

  if (S.hat.length) launchHat();

  const bag = S.bag;
  if (bag && bag.landed && S.mode === 'crazy') {
    bag.jumps++;
    bag.squash = 1;
    sfx.squeak(0.8 + (bag.jumps / bag.need) * 0.9);
    if (bag.jumps >= bag.need) { burstBag(); }
    else {
      fx.text(bag.x, bag.y - u * 0.35, `${bag.jumps}!`, { size: u * 0.12, color: '#ffcc33' });
      say(`${bag.jumps}!`);
    }
  } else if (!S.hat.length) {
    sfx.boing();
  }
  if (S.mode === 'crazy' && S.jumpTimes.length > 30 && !S.finale) {
    S.jumpTimes = [];
    say('Phew! Bugs need a nap!');
    later(2, () => startKing());
  }
}

function launchHat() {
  const { sfx, fx, say } = ctx;
  const u = unit();
  const n = worthOf(S.hat);
  const mult = hatMult(n);
  const pts = n * mult;
  S.score += pts;
  const h = S.head;
  for (const b of S.hat) {
    const p = hatPos(b.slot);
    b.mode = 'air'; b.x = p.x; b.y = p.y;
    b.vx = rand(-1.2, 1.2) * u; b.vy = -u * rand(2.0, 3.3); b.spin = rand(-12, 12); b.airT = 0;
    S.bugs.push(b);
  }
  S.hat = [];
  for (let i = 0; i < 4; i++) setTimeout(() => sfx.boing(), i * 70);
  fx.burst(h.x, h.y, { count: 40, speed: 600, color: S.royals.length ? '#ffd700' : undefined });
  if (S.royals.length) fx.burst(h.x, h.y, { count: 40, speed: 400, color: '#fff6a0', gravity: 100 });
  fx.shake(14);
  S.banner = { lines: ["BOUNC'A BUGS!", mult > 1 ? `${n} × ${mult}` : `${n}`, `+${pts}`], t: 0 };
  say(mult >= 3 ? "Mega bounc'a bugs!" : "Bounc'a bugs!");
}

// ---------- crouch / hat ----------

const LAYER = [7, 6, 5, 4, 4, 3, 3, 2, 2, 1];
function slotInfo(i) {
  let layer = 0, idx = i;
  while (layer < LAYER.length - 1 && idx >= LAYER[layer]) { idx -= LAYER[layer]; layer++; }
  const n = LAYER[layer];
  return { layer, frac: n === 1 ? 0.5 : idx / (n - 1) };
}

function hatPos(slot) {
  const h = S.head;
  const { layer, frac } = slotInfo(slot);
  const bug = unit() * 0.03;
  const span = Math.max(h.width * 0.8, (LAYER[layer] - 1) * bug * 2.1); // never closer than a bug apart
  // squeeze layers so the whole tower fits between the head and the score
  const layers = slotInfo(Math.max(0, S.hat.length - 1)).layer + 1;
  const lift = S.royals.length ? h.width * 0.4 : 0; // sit on top of the crown
  const room = Math.max(bug * 2, h.y - unit() * 0.17 - lift);
  const step = Math.min(bug * 1.7, room / layers);
  let lx = (frac - 0.5) * span + S.sway * layer * bug * 0.8;
  let ly = -layer * step - lift;
  if (layer === 0) ly += Math.pow(Math.abs(frac - 0.5) * 2, 2) * bug * 1.5; // follow the head curve
  const c = Math.cos(h.roll), s = Math.sin(h.roll);
  return { x: h.x + lx * c - ly * s, y: h.y + lx * s + ly * c, layer };
}

function joinHat(b) {
  b.mode = 'hat';
  b.slot = S.hat.length;
  S.bugs.splice(S.bugs.indexOf(b), 1);
  S.hat.push(b);
  if (S.sfxCool <= 0) { ctx.sfx.skitter(); S.sfxCool = 0.12; }
  if (S.tickleCool <= 0) { S.tickleCool = rand(5, 8); ctx.sfx.giggle(); ctx.say(pick(['Tickle tickle!', "They're climbing on you!", 'Bug hat!']), { interrupt: false }); }
  const n = worthOf(S.hat);
  for (const at of [10, 25, 40]) if (n >= at && n - TYPES[b.type].worth < at) ctx.say(`${at} bugs! Jump!`);
}

// ---------- Bug King (sneaky) ----------

function startKing() {
  if (S.mode !== 'crazy' || S.royals.length >= ROYALS.length) return;
  const royal = ROYALS[S.royals.length];
  const u = unit();
  S.mode = 'sneaky';
  S.king = { royal, x: -u * 0.2, y: ctx.H - u * 0.05, startles: 0, state: 'enter', loud: 0, remind: 6, zip: 0, dir: 1, auto: false };
  ctx.sfx.whoosh();
  ctx.say(`Shhh! The ${royal.name} is shy. Crouch down slowly, slowly...`);
}

function updateKing(dt) {
  const k = S.king;
  const u = unit();
  const crouching = ctx.gestures.crouching || S.forceCrouch > 0;
  S.night = Math.min(1, S.night + dt);
  if (k.state === 'done') return;
  if (k.state === 'enter') {
    k.x += u * 0.25 * dt;
    if (k.x > ctx.W * 0.3) k.state = 'wander';
    return;
  }
  if (k.state === 'zip') {
    k.x += k.dir * u * 2.2 * dt;
    if (k.x < u * 0.08 || k.x > ctx.W - u * 0.08) { k.x = Math.max(u * 0.08, Math.min(ctx.W - u * 0.08, k.x)); k.state = 'wander'; }
    return;
  }
  // startle on loud movement
  if (!k.auto) {
    if (S.noise > 0.09) k.loud += dt; else k.loud = Math.max(0, k.loud - dt);
    if (k.loud > 0.3) {
      k.loud = 0; k.startles++;
      k.state = 'zip'; k.dir = k.x > ctx.W / 2 ? -1 : 1;
      k.y = ctx.H - u * 0.05;
      ctx.sfx.giggle();
      if (k.startles >= 3) {
        ctx.say(`Okay, okay! You can be the ${k.royal.name.replace('Bug ', '')}!`, {});
        k.auto = true;
      } else ctx.say(pick(['Eek! Too fast! Slowly...', 'Hee hee! Sneakier!', 'Oops! Slowly, slowly...']));
      return;
    }
  }
  const h = S.head;
  if (crouching || k.auto) {
    // creep toward the head
    const dx = h.x - k.x, dy = h.y - k.y, d = Math.hypot(dx, dy);
    const sp = u * (k.auto ? 0.5 : S.noise < 0.05 ? 0.28 : 0);
    if (d < h.width * 0.3) {
      k.state = 'done';
      S.royals.push(k.royal.id);
      ctx.sfx.tada();
      ctx.fx.burst(h.x, h.y, { color: '#ffd700', count: 60, speed: 500 });
      ctx.fx.confetti(120);
      ctx.say(k.royal.line);
      later(3, endKing);
      return;
    }
    if (d > 0) { k.x += (dx / d) * sp * dt; k.y += (dy / d) * sp * dt; }
  } else {
    k.remind -= dt;
    if (k.remind <= 0) { k.remind = 9; ctx.say('Crouch down low, slowly...', { interrupt: false }); }
    k.x += Math.sin(S.t * 0.7) * u * 0.08 * dt;
    k.y += (ctx.H - u * 0.05 - k.y) * Math.min(1, dt * 2);
  }
}

function endKing() {
  S.mode = 'crazy';
  S.king = null;
  S.crazyTime = 0;
  ctx.say('Now jump! Show everyone your crown!');
}

// ---------- game ----------

export default {
  needs: ['face', 'motion'],

  init(c) {
    ctx = c;
    S = fresh();
    if (new URLSearchParams(location.search).has('debug')) window.wiggle.game = S; // inspect from console
    const g = ctx.gestures;
    const u = unit();
    offs = [
      g.on('jump', onJump),
      g.on('crouch', () => { S.lastCrouch = S.t; }),
      g.on('hide', () => { for (const b of S.bugs) if (b.mode !== 'air') { b.mode = 'hide'; } }),
      g.on('peekaboo', () => {
        for (const b of S.bugs) { b.mode = 'air'; b.vy = -u * rand(1.5, 2.4); b.vx = rand(-1, 1) * u; }
        ctx.sfx.giggle(); ctx.say(pick(['Boo!', 'Peekaboo!', 'There you are!']));
      }),
      g.on('spin', () => {
        for (const b of S.bugs.concat(S.hat)) b.dizzy = 3;
        ctx.sfx.whoosh(); ctx.say('Dizzy bugs!');
        for (const b of S.bugs) if (b.mode === 'hide') b.mode = 'air';
      }),
      g.on('leave', () => {
        for (const b of S.hat) { const p = hatPos(b.slot); b.mode = 'air'; b.x = p.x; b.y = p.y; b.vy = -u; S.bugs.push(b); }
        S.hat = [];
        for (const b of S.bugs) b.mode = 'party';
      }),
      g.on('return', () => {
        for (const b of S.bugs) { b.mode = 'air'; b.vy = -u * rand(1.5, 2.5); b.vx = rand(-1.5, 1.5) * u; }
        ctx.sfx.ding(); ctx.say("He's back! Hide!");
      }),
      g.on('still', () => {
        const b = S.bugs.find((x) => x.mode === 'crawl');
        if (b && S.mode === 'crazy') { b.mode = 'wave'; b.waveT = 3; ctx.sfx.squeak(1.3); }
      }),
    ];
    onPointer = (e) => {
      for (const btn of S.buttons) {
        if (Math.hypot(e.clientX - btn.x, e.clientY - btn.y) < btn.r * 1.2) btn.act();
      }
    };
    ctx.view.canvas.addEventListener('pointerdown', onPointer);
  },

  update(dt) {
    const { W, H } = ctx;
    const u = unit();
    S.t += dt;
    S.sfxCool -= dt; S.voiceCool -= dt; S.tickleCool -= dt;
    S.forceCrouch = Math.max(0, S.forceCrouch - dt);
    S.flash = Math.max(0, S.flash - dt * 3);
    S.noise += (ctx.motion.total - S.noise) * Math.min(1, dt * 5);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.4) S.banner = null; }
    for (let i = S.timers.length - 1; i >= 0; i--) if (S.t >= S.timers[i].at) { const fn = S.timers[i].fn; S.timers.splice(i, 1); fn(); }
    S.shown = Math.min(S.score, S.shown + Math.max(1, (S.score - S.shown) * 4 * dt));

    // head anchor (smoothed) + hat sway
    const hd = ctx.head();
    const k = Math.min(1, dt * 14);
    S.head.x += (hd.x - S.head.x) * k; S.head.y += (hd.y - S.head.y) * k;
    S.head.width += (hd.width - S.head.width) * k; S.head.roll += (hd.roll - S.head.roll) * k;
    S.head.found = hd.found;
    const hvx = S.lastHeadX == null ? 0 : (S.head.x - S.lastHeadX) / Math.max(dt, 1e-3);
    S.lastHeadX = S.head.x;
    S.swayV += ((-hvx / (u * 2)) * 2 - S.sway) * 30 * dt;
    S.swayV *= Math.pow(0.05, dt);
    S.sway = Math.max(-2, Math.min(2, S.sway + S.swayV * dt));
    // head wiggle knocks the top bugs off
    const rollV = Math.abs(S.head.roll - S.lastRoll) / Math.max(dt, 1e-3);
    S.lastRoll = S.head.roll;
    if (rollV > 1.6 && S.hat.length > 3 && S.sfxCool <= 0) {
      const b = S.hat.pop();
      const p = hatPos(b.slot);
      Object.assign(b, { mode: 'air', x: p.x, y: p.y, vx: rand(-1, 1) * u, vy: -u * 0.8 });
      S.bugs.push(b);
      ctx.sfx.squeak(1.4); S.sfxCool = 0.15;
      if (S.voiceCool <= 0) { S.voiceCool = 6; ctx.say('Whoa, hold on!', { interrupt: false }); }
    }

    // ----- bag lifecycle -----
    if (S.mode === 'crazy') {
      S.crazyTime += dt;
      if (!S.bag) {
        S.nextBagIn -= dt;
        if (S.t > 240 && !S.finale) { S.finale = true; dropBag(true); }
        else if (S.crazyTime > 85 && S.royals.length < ROYALS.length && S.bagNum >= 2) startKing();
        else if (S.nextBagIn <= 0) dropBag(false);
      }
    } else if (S.mode === 'sneaky') {
      updateKing(dt);
    }
    if (S.mode === 'crazy') S.night = Math.max(0, S.night - dt);
    const bag = S.bag;
    if (bag) {
      const groundY = H - u * 0.04;
      if (!bag.landed) {
        bag.y += u * 0.35 * dt;
        if (bag.y >= groundY) { bag.y = groundY; bag.landed = true; bag.squash = 0.8; ctx.sfx.boing(); }
      }
      bag.squash = Math.max(0, bag.squash - dt * 3);
      bag.wob += dt;
      if (bag.landed && Math.random() < dt * 0.5) ctx.sfx.buzz(0.3);
    }

    // ----- fallback buttons -----
    S.buttons = [];
    const free = freeBugs().filter((b) => b.mode === 'crawl' || b.mode === 'fly').length;
    if (S.mode === 'crazy' && free >= 10 && S.t - Math.max(S.lastCrouch, 10) > 40 && !S.hat.length) {
      S.buttons.push({ icon: '⬇️', x: 24 + u * 0.1, y: H - u * 0.1 - 24, r: u * 0.09, act: () => { S.forceCrouch = 4; S.lastCrouch = S.t; ctx.say('Bugs, come here!'); } });
    }
    if (S.mode === 'sneaky' && S.king && S.king.state !== 'done' && S.t - S.lastCrouch > 40) {
      S.buttons.push({ icon: '⬇️', x: 24 + u * 0.1, y: H - u * 0.1 - 24, r: u * 0.09, act: () => { S.king.auto = true; S.lastCrouch = S.t; } });
    }
    if (bag && bag.landed && S.t - S.lastJump > (bag.mega ? 15 : 25)) {
      S.buttons.push({ icon: '⬆️', x: W - 24 - u * 0.1, y: H - u * 0.1 - 24, r: u * 0.09, act: () => onJump() });
    }

    // ----- bugs -----
    const crouching = ctx.gestures.crouching || S.forceCrouch > 0;
    const floorY = H;
    for (let i = S.bugs.length - 1; i >= 0; i--) {
      const b = S.bugs[i];
      const T = TYPES[b.type];
      b.phase += dt * 10;
      if (b.leaving) {
        // waving bye, marching off the nearest side
        b.mode = 'bye';
        b.x += b.dir * u * 0.75 * dt;
        b.y += (T.fly ? -u * 0.1 * dt : (H - b.r - b.y) * Math.min(1, dt * 4)) - Math.abs(Math.sin(b.phase * 0.5)) * u * 0.02 * dt;
        if (b.x < -b.r * 4 || b.x > W + b.r * 4) S.bugs.splice(i, 1);
        continue;
      }
      b.dizzy = Math.max(0, b.dizzy - dt);
      if (crouching && S.mode === 'crazy' && (b.mode === 'crawl' || b.mode === 'fly' || b.mode === 'wave')) b.mode = 'climb';
      if (!crouching && b.mode === 'climb') { b.mode = 'air'; b.vy = 0; b.vx = 0; }

      if (b.mode === 'air') {
        b.airT += dt;
        b.vy += u * 2.4 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.spin *= Math.pow(0.3, dt);
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * T.bounce; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * T.bounce; }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * T.bounce; }
        if (T.fly && b.airT > 0.6 && b.vy > 0) { b.mode = 'fly'; b.tx = rand(0.1, 0.9) * W; b.ty = rand(0.15, 0.7) * H; }
        if (b.y > floorY - b.r) {
          b.y = floorY - b.r;
          if (b.vy > u * 0.6) { b.vy = -b.vy * T.bounce; b.vx *= 0.8; }
          else { b.mode = T.fly ? 'fly' : 'crawl'; b.surface = 'floor'; b.vy = 0; b.spin = 0; b.tx = rand(0.1, 0.9) * W; b.ty = rand(0.15, 0.7) * H; }
        }
      } else if (b.mode === 'crawl') {
        const sp = u * T.speed * (b.dizzy > 0 ? 0.5 : 1);
        if (b.surface === 'floor') {
          b.y = floorY - b.r;
          b.x += b.dir * sp * dt + (b.dizzy > 0 ? Math.sin(S.t * 9 + b.phase) * u * 0.2 * dt : 0);
          if (b.x < b.r || b.x > W - b.r) {
            b.x = Math.max(b.r, Math.min(W - b.r, b.x));
            if (Math.random() < 0.5) { b.surface = b.x < W / 2 ? 'left' : 'right'; b.wallTop = rand(0.35, 0.75) * H; }
            else b.dir *= -1;
          }
          if (Math.random() < dt * 0.15) b.dir *= -1;
        } else {
          b.x = b.surface === 'left' ? b.r : W - b.r;
          if (b.climbUp === undefined) b.climbUp = true;
          b.y += (b.climbUp ? -sp : sp * 2) * dt;
          if (b.climbUp && b.y < b.wallTop) b.climbUp = false;
          if (!b.climbUp && b.y > floorY - b.r) { b.surface = 'floor'; b.climbUp = undefined; b.dir = b.x < W / 2 ? 1 : -1; }
        }
      } else if (b.mode === 'fly') {
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        const sp = u * T.speed;
        if (d < u * 0.03) { b.tx = rand(0.1, 0.9) * W; b.ty = rand(0.15, 0.7) * H; }
        else { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt + Math.sin(S.t * 6 + b.phase) * u * 0.05 * dt; }
        b.dir = dx >= 0 ? 1 : -1;
      } else if (b.mode === 'climb') {
        const h = S.head;
        const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy);
        if (d < Math.max(h.width * 0.35, u * 0.04)) { joinHat(b); continue; }
        const sp = u * b.climbSpeed;
        b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt;
        b.dir = dx >= 0 ? 1 : -1;
      } else if (b.mode === 'hide') {
        const tx = S.bag ? S.bag.x : W / 2, ty = S.bag ? S.bag.y - u * 0.05 : H - b.r;
        b.x += (tx - b.x) * Math.min(1, dt * 3); b.y += (ty - b.y) * Math.min(1, dt * 3);
      } else if (b.mode === 'party') {
        const idx = i / Math.max(1, S.bugs.length);
        const a = idx * Math.PI * 2 + S.t * 1.2;
        const tx = W / 2 + Math.cos(a) * u * 0.28, ty = H * 0.65 + Math.sin(a) * u * 0.12 - Math.abs(Math.sin(S.t * 6 + i)) * u * 0.03;
        b.x += (tx - b.x) * Math.min(1, dt * 4); b.y += (ty - b.y) * Math.min(1, dt * 4);
        if (Math.random() < dt * 0.05) ctx.fx.text(b.x, b.y - b.r * 2, '♪', { size: 30 });
      } else if (b.mode === 'wave') {
        b.waveT -= dt;
        const h = S.head;
        const tx = h.x + (b.x < h.x ? -1 : 1) * h.width * 0.8, ty = Math.min(H - b.r, h.y + h.width);
        b.x += (tx - b.x) * Math.min(1, dt * 1.5); b.y += (ty - b.y) * Math.min(1, dt * 1.5);
        if (b.waveT <= 0) { b.mode = 'air'; ctx.fx.text(b.x, b.y - b.r * 2, 'hi!', { size: 36 }); }
      }
    }
  },

  draw(g) {
    const { W, H } = ctx;
    const u = unit();
    if (S.night > 0) {
      g.fillStyle = `rgba(10,10,50,${S.night * 0.5})`; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        const x = (Math.sin(i * 12.9 + S.t * 0.3) * 0.5 + 0.5) * W, y = (Math.cos(i * 7.3 + S.t * 0.25) * 0.4 + 0.45) * H;
        g.globalAlpha = S.night * (0.4 + 0.6 * Math.abs(Math.sin(S.t * 2 + i)));
        g.fillStyle = '#fff6a0'; g.beginPath(); g.arc(x, y, u * 0.008, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (S.bag) drawBag(g, S.bag, u);
    for (const b of S.bugs) drawBugAt(g, b, b.x, b.y, u);
    if (S.king) drawKing(g, S.king, u);
    const maxDraw = HAT_DRAW[ctx.perf.tier.name] || 25;
    for (let i = 0; i < Math.min(S.hat.length, maxDraw); i++) {
      const b = S.hat[i];
      const p = hatPos(b.slot);
      drawBug(g, b, p.x, p.y, u, { upright: true, roll: S.head.roll });
    }
    drawRoyals(g, u);
    drawHatCounter(g, u);
    drawHud(g, W, u);
    for (const btn of S.buttons) drawButton(g, btn);
    if (S.banner) drawBanner(g, W, H, u);
    if (S.flash > 0) { g.fillStyle = `rgba(255,255,255,${S.flash * 0.3})`; g.fillRect(0, 0, W, H); }
  },

  destroy() {
    offs.forEach((off) => off());
    offs = [];
    ctx.view.canvas.removeEventListener('pointerdown', onPointer);
  },
};

// ---------- drawing ----------

function drawBugAt(g, b, x, y, u) {
  if (b.mode === 'crawl' && b.surface !== 'floor') {
    // on a wall: face up or down the wall
    return drawBug(g, { ...b, dir: 1 }, x, y, u, { angle: b.climbUp ? -Math.PI / 2 : Math.PI / 2 });
  }
  drawBug(g, b, x, y, u, { angle: b.mode === 'air' ? b.spin * S.t * 0.2 : 0 });
}

function drawBug(g, b, x, y, u, { angle = 0, upright = false, roll = 0 } = {}) {
  const r = b.r;
  const walking = b.mode === 'crawl' || b.mode === 'climb' || b.mode === 'party' || b.mode === 'wave' || b.mode === 'bye';
  g.save();
  g.translate(x, y);
  if (upright) g.rotate(roll);
  else g.rotate(angle);
  if (b.dir < 0 && !upright) g.scale(-1, 1);
  if (b.dizzy > 0) g.rotate(Math.sin(S.t * 12 + b.phase) * 0.3);
  const legPhase = walking ? Math.sin(b.phase) * r * 0.25 : 0;
  // legs
  if (b.type !== 'caterpillar') {
    g.strokeStyle = '#1b1140'; g.lineWidth = Math.max(1.5, r * 0.1); g.lineCap = 'round';
    for (const lx of [-0.45, 0, 0.45]) {
      const sw = (lx === 0 ? -legPhase : legPhase);
      g.beginPath(); g.moveTo(lx * r, r * 0.3); g.lineTo(lx * r + sw, r * 0.95); g.stroke();
    }
  }
  const T = b.type;
  if (T === 'ladybug') {
    g.fillStyle = '#e8262b'; g.beginPath(); g.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1140';
    g.fillRect(-r * 0.04, -r * 0.8, r * 0.08, r * 1.6);
    for (const [sx, sy] of [[-0.45, -0.3], [0.4, 0.25], [-0.35, 0.35], [0.45, -0.35]]) { g.beginPath(); g.arc(sx * r, sy * r, r * 0.17, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(r * 0.85, 0, r * 0.45, 0, Math.PI * 2); g.fill();
  } else if (T === 'bee') {
    const flap = Math.sin(S.t * 40 + b.phase) * 0.5;
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath(); g.ellipse(-r * 0.2, -r * 0.8, r * 0.5, r * 0.3, -0.6 + flap, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(r * 0.2, -r * 0.85, r * 0.45, r * 0.28, 0.5 - flap, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffcc1a'; g.beginPath(); g.ellipse(0, 0, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1140';
    for (const sx of [-0.45, 0.05]) g.fillRect(sx * r, -r * 0.75, r * 0.22, r * 1.5);
    g.beginPath(); g.moveTo(-r * 1.05, -r * 0.1); g.lineTo(-r * 1.35, 0); g.lineTo(-r * 1.05, r * 0.1); g.fill();
  } else if (T === 'caterpillar') {
    for (let k = 3; k >= 0; k--) {
      const bob = Math.sin(b.phase * 0.6 - k) * r * 0.25;
      g.fillStyle = k % 2 ? '#5bc85b' : '#7de07d';
      g.beginPath(); g.arc(-k * r * 0.75, bob, r * 0.62, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#4caf50'; g.beginPath(); g.arc(r * 0.55, -r * 0.1, r * 0.7, 0, Math.PI * 2); g.fill();
  } else if (T === 'firefly') {
    const glow = 0.5 + 0.5 * Math.sin(S.t * 5 + b.phase);
    g.fillStyle = `rgba(255,240,120,${0.25 + glow * 0.35})`; g.beginPath(); g.arc(-r * 0.7, 0, r * (1.2 + glow * 0.6), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff36b'; g.beginPath(); g.arc(-r * 0.6, 0, r * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a3b2e'; g.beginPath(); g.ellipse(r * 0.15, 0, r * 0.7, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(0, -r * 0.6, r * 0.5, r * 0.25, -0.3 + Math.sin(S.t * 30) * 0.4, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = b.gold ? '#ffcf33' : `hsl(${(b.hue + S.t * 120) % 360} 85% 55%)`; g.beginPath(); g.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.4, r * 0.35, r * 0.15, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1140'; g.beginPath(); g.arc(r * 0.85, 0, r * 0.42, 0, Math.PI * 2); g.fill();
  }
  // antennae
  const hx = T === 'caterpillar' ? r * 0.55 : r * 0.9;
  g.strokeStyle = '#1b1140'; g.lineWidth = Math.max(1.5, r * 0.08);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx, -r * 0.3); g.quadraticCurveTo(hx + r * 0.2, -r * 0.9, hx + r * 0.45 + s * r * 0.15, -r * 1.05); g.stroke(); }
  // googly eyes looking at the kid
  const er = r * 0.32;
  const ex = hx + r * 0.05, ey = -r * 0.15;
  for (const s of [-1, 1]) {
    const cx = ex + s * er * 0.85;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, ey, er, 0, Math.PI * 2); g.fill();
    if (b.dizzy > 0) {
      g.strokeStyle = '#1b1140'; g.lineWidth = Math.max(1, er * 0.18); g.beginPath();
      for (let a = 0; a < 9; a += 0.4) { const rr = (a / 9) * er * 0.85; const aa = a + S.t * 8; g.lineTo(cx + Math.cos(aa) * rr, ey + Math.sin(aa) * rr); }
      g.stroke();
    } else {
      const dx = (S.head.x - x) * (b.dir < 0 && !upright ? -1 : 1), dy = S.head.y - y;
      const d = Math.hypot(dx, dy) || 1;
      g.fillStyle = '#1b1140'; g.beginPath(); g.arc(cx + (dx / d) * er * 0.45, ey + (dy / d) * er * 0.45, er * 0.5, 0, Math.PI * 2); g.fill();
    }
  }
  if (b.mode === 'wave' || b.mode === 'bye') { g.font = `${r * 1.4}px sans-serif`; g.textAlign = 'center'; g.fillText('👋', 0, -r * 1.8); }
  g.restore();
}

function drawBag(g, bag, u) {
  const fill = bag.jumps / bag.need;
  const base = u * (bag.mega ? 0.2 : 0.14) * (1 + fill * 0.55);
  const sq = bag.squash;
  const wob = Math.sin(bag.wob * 10) * 0.04 * (0.3 + fill);
  g.save();
  g.translate(bag.x, bag.y);
  if (!bag.landed) {
    // parachute
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    const py = -base * 2.6;
    for (const s of [-1, -0.3, 0.3, 1]) { g.beginPath(); g.moveTo(s * base * 0.9, py); g.lineTo(s * base * 0.3, -base * 1.4); g.stroke(); }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#ff4d4d';
      g.beginPath(); g.moveTo(0, py); g.arc(0, py, base * 1.1, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI); g.fill();
    }
  }
  g.rotate(wob);
  g.scale(1 + sq * 0.25, 1 - sq * 0.25);
  // peeking bugs at the opening
  for (let i = 0; i < 3; i++) {
    const a = bag.wob * (1.3 + i * 0.4) + i * 2;
    const px = Math.sin(a) * base * 0.3, py = -base * 1.55 - Math.abs(Math.sin(a * 1.7)) * base * 0.25;
    drawBug(g, { type: bag.mega ? ORDER[i + 1] : bag.type, r: u * 0.022, mode: 'peek', dir: px > 0 ? 1 : -1, phase: a, dizzy: 0, hue: i * 90 }, px, py, u, { upright: true, roll: Math.sin(a) * 0.4 - Math.PI / 2 });
  }
  // sack body
  g.fillStyle = bag.mega ? '#d9a441' : '#c8955a';
  g.beginPath();
  g.moveTo(-base * 0.35, -base * 1.25);
  g.bezierCurveTo(-base * 1.3, -base * 0.9, -base * 1.25, 0, -base * 0.9, 0);
  g.lineTo(base * 0.9, 0);
  g.bezierCurveTo(base * 1.25, 0, base * 1.3, -base * 0.9, base * 0.35, -base * 1.25);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(80,45,15,.5)'; g.lineWidth = Math.max(2, base * 0.03); g.setLineDash([base * 0.08, base * 0.08]);
  g.beginPath(); g.moveTo(-base * 0.8, -base * 0.5); g.quadraticCurveTo(0, -base * 0.3, base * 0.8, -base * 0.5); g.stroke();
  g.setLineDash([]);
  // neck + tie
  g.fillStyle = bag.mega ? '#c48f2f' : '#a8743f';
  g.beginPath(); g.ellipse(0, -base * 1.35, base * 0.42, base * 0.16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff4d4d'; g.fillRect(-base * 0.4, -base * 1.25, base * 0.8, base * 0.12);
  // bumps of bugs pushing from inside
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (let i = 0; i < 4; i++) {
    const a = bag.wob * 2 + i * 1.6;
    g.beginPath(); g.arc(Math.sin(a) * base * 0.6, -base * 0.55 + Math.cos(a * 1.3) * base * 0.3, base * 0.14, 0, Math.PI * 2); g.fill();
  }
  if (bag.mega) { g.font = `900 ${base * 0.35}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#5a3b10'; g.fillText('MEGA', 0, -base * 0.45); }
  g.restore();
  // jump counter: big number + dots
  if (bag.landed) {
    const fs = u * 0.1;
    const y = bag.y - base * 1.9 - fs * 0.6;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
    g.lineWidth = fs / 7; g.strokeStyle = '#1b1140';
    const label = `${bag.jumps}`;
    g.strokeText(label, bag.x, y); g.fillStyle = '#ffcc33'; g.fillText(label, bag.x, y);
    const dot = Math.min(u * 0.022, (u * 0.6) / bag.need / 2.6);
    for (let i = 0; i < bag.need; i++) {
      const dx = bag.x + (i - (bag.need - 1) / 2) * dot * 2.6;
      g.fillStyle = i < bag.jumps ? '#ffcc33' : 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(dx, y + fs * 0.75, dot, 0, Math.PI * 2); g.fill();
    }
    if (bag.jumps === 0) {
      g.font = `900 ${fs * 0.55}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = '#fff'; g.fillText('⬆️ JUMP!', bag.x, y - fs * 0.85 + Math.sin(S.t * 6) * 6);
    }
  }
}

function drawKing(g, k, u) {
  const r = u * 0.055;
  const kingBug = { type: 'beetle', gold: true, r, mode: 'crawl', dir: k.state === 'zip' ? k.dir : 1, phase: S.t * (k.state === 'zip' ? 30 : 8), dizzy: 0, hue: 45 };
  // golden glow
  g.fillStyle = `rgba(255,215,0,${0.2 + Math.sin(S.t * 3) * 0.08})`;
  g.beginPath(); g.arc(k.x, k.y, r * 2, 0, Math.PI * 2); g.fill();
  drawBug(g, kingBug, k.x, k.y, u, {});
  drawCrown(g, k.x, k.y - r * 1.15, r * 1.1, k.royal.id);
}

function drawCrown(g, x, y, w, kind) {
  g.save();
  g.translate(x, y);
  if (kind === 'queen') {
    g.fillStyle = '#ff8fd0';
    g.beginPath(); g.arc(0, 0, w * 0.5, Math.PI, 0); g.fill();
    g.fillStyle = '#fff'; for (const s of [-0.3, 0, 0.3]) { g.beginPath(); g.arc(s * w, -w * 0.25, w * 0.08, 0, Math.PI * 2); g.fill(); }
  } else {
    g.fillStyle = kind === 'prince' ? '#7ec8ff' : '#ffd700';
    g.beginPath();
    g.moveTo(-w * 0.5, w * 0.2); g.lineTo(-w * 0.5, -w * 0.3); g.lineTo(-w * 0.25, -w * 0.05); g.lineTo(0, -w * 0.4);
    g.lineTo(w * 0.25, -w * 0.05); g.lineTo(w * 0.5, -w * 0.3); g.lineTo(w * 0.5, w * 0.2); g.closePath(); g.fill();
    g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(0, w * 0.02, w * 0.08, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawRoyals(g, u) {
  if (!S.royals.length) return;
  const h = S.head;
  S.royals.forEach((id, i) => {
    const w = h.width * (id === 'king' ? 0.55 : 0.38);
    const off = (i - (S.royals.length - 1) / 2) * h.width * 0.35;
    const c = Math.cos(h.roll), s = Math.sin(h.roll);
    const ly = -w * 0.15;
    g.save();
    g.translate(h.x + off * c - ly * s, h.y + off * s + ly * c);
    g.rotate(h.roll);
    drawCrown(g, 0, 0, w, id);
    g.restore();
  });
}

function drawHatCounter(g, u) {
  if (!S.hat.length) return;
  const n = worthOf(S.hat);
  const mult = hatMult(n);
  const maxDraw = HAT_DRAW[ctx.perf.tier.name] || 25;
  const fs = Math.max(26, u * 0.055);
  // beside the head (left or right, whichever has more room)
  const side = S.head.x < ctx.W / 2 ? 1 : -1;
  const cx = S.head.x + side * (S.head.width * 0.5 + fs * 2.6);
  const y = Math.max(fs * 2.5, S.head.y);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
  const extra = S.hat.length > maxDraw ? `  +${S.hat.length - maxDraw}` : '';
  const label = `🐞 ${n}${mult > 1 ? ` ×${mult}` : ''}${extra}`;
  g.lineWidth = fs / 6; g.strokeStyle = '#1b1140'; g.strokeText(label, cx, y);
  g.fillStyle = '#fff'; g.fillText(label, cx, y);
  const next = [...HAT_TIERS].reverse().find(([m]) => m > n);
  if (next) {
    g.font = `800 ${fs * 0.5}px ui-rounded, system-ui, sans-serif`;
    g.fillStyle = '#ffcc33'; g.fillText(`×${next[1]} at ${next[0]}`, cx, y + fs * 0.75);
  }
}

function drawHud(g, W, u) {
  const ss = Math.max(48, u * 0.12);
  g.textAlign = 'center'; g.textBaseline = 'top';
  g.font = `900 ${ss}px ui-rounded, system-ui, sans-serif`;
  g.lineWidth = ss / 8; g.strokeStyle = 'rgba(27,17,64,.85)';
  const score = Math.floor(S.shown);
  g.strokeText(score, W / 2, 16); g.fillStyle = '#ffcc33'; g.fillText(score, W / 2, 16);
  if (S.bagNum) {
    const ls = Math.max(22, u * 0.045);
    g.font = `900 ${ls}px ui-rounded, system-ui, sans-serif`;
    const txt = `Bag ${S.bagNum}`;
    const tw = g.measureText(txt).width;
    g.fillStyle = '#c8955a'; g.beginPath();
    if (g.roundRect) g.roundRect(W - tw - 44, 20, tw + 28, ls * 1.5, ls * 0.75); else g.rect(W - tw - 44, 20, tw + 28, ls * 1.5);
    g.fill();
    g.fillStyle = '#1b1140'; g.textAlign = 'right'; g.fillText(txt, W - 30, 20 + ls * 0.25);
  }
  const vs = Math.max(16, u * 0.03);
  g.font = `800 ${vs}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(`v${ctx.release}`, W - 30, 20 + Math.max(22, u * 0.045) * 1.7);
}

function drawButton(g, b) {
  const p = 1 + Math.sin(S.t * 6) * 0.08;
  g.fillStyle = '#ff5ea8'; g.beginPath(); g.arc(b.x, b.y, b.r * p, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  g.font = `${b.r}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(b.icon, b.x, b.y + 2);
}

function drawBanner(g, W, H, u) {
  const t = S.banner.t;
  const pop = t < 0.25 ? 0.5 + (t / 0.25) * 0.7 : t < 0.4 ? 1.2 - ((t - 0.25) / 0.15) * 0.2 : 1;
  g.save();
  g.globalAlpha = Math.min(1, (2.4 - t) * 2);
  g.translate(W / 2, H * 0.42);
  g.scale(pop, pop);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = S.banner.lines;
  const fs = u * 0.11;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * fs * 1.1;
    g.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
    g.lineWidth = fs / 7; g.strokeStyle = '#1b1140'; g.strokeText(line, 0, y);
    g.fillStyle = i === lines.length - 1 ? '#ffcc33' : '#fff'; g.fillText(line, 0, y);
  });
  g.restore();
}
