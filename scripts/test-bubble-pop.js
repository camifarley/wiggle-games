// Simulated playtests for Bubble Pop v1.1 (src/games/01-bubble-pop/v1.1/index.js): runs the real game logic
// (update only, no drawing) against a pretend kid made of motion. Run: node scripts/test-bubble-pop.js
// Checks the round flow (60 s → storm → score screen → best saved), that specials come one at a time,
// that the wand lasts 10 s, that spins make bubbles, and that WAITING then flailing beats flailing all the time.
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const { default: game } = await import('../src/games/01-bubble-pop/v1.1/index.js');

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// A pretend ctx. kid(t) says where movement is: null (standing still), 'all' (flailing everywhere),
// or { x, y, r } a moving hand (norm coords).
function makeCtx(kid) {
  const listeners = {};
  const noop = () => {};
  const ctx = {
    W: 1280, H: 720, time: 0, release: '1.1',
    view: {
      dw: 1280, dh: 720, canvas: { addEventListener: noop, removeEventListener: noop },
      toScreen: (x, y) => ({ x: x * 1280, y: y * 720 }), toNorm: (x, y) => ({ x: x / 1280, y: y / 720 }),
    },
    motion: {
      at(nx, ny) {
        const k = kid(ctx.time);
        if (!k) return 0;
        if (k === 'all') return 1;
        return Math.hypot((nx - k.x) * 16 / 9, ny - k.y) < k.r ? 1 : 0;
      },
      hotspots() { const k = kid(ctx.time); return k && k !== 'all' ? [{ x: k.x, y: k.y, strength: 0.5 }] : k ? [{ x: 0.5, y: 0.5, strength: 0.5 }] : []; },
    },
    color: { track: () => ({ found: false, x: 0.5, y: 0.5, size: 0 }) },
    body: () => ({ found: true, width: 0.2 }),
    pose: { found: false },
    camera: { width: 1280, height: 720 },
    perf: { settings: { name: 'high', particles: 1 } },
    gestures: { on: (n, fn) => { (listeners[n] ||= []).push(fn); }, emit: (n) => (listeners[n] || []).forEach((f) => f({})) },
    sfx: new Proxy({}, { get: () => noop }),
    music: { jingle: noop, play: noop, resume: noop },
    fx: { burst: noop, text: noop, confetti: noop, shake: noop, clear: noop },
    say: noop,
  };
  return ctx;
}

function play(kid, secs, each) {
  const ctx = makeCtx(kid);
  game.init(ctx);
  const DT = 1 / 30;
  for (let i = 0; i < secs / DT; i++) { ctx.time += DT; game.update(DT, ctx); each?.(ctx, game); }
  return ctx;
}
const state = () => game.debugState(); // the game's round state (exported for tests + console)

// A hand sweeping left-right across the middle (a kid waving).
const wave = (t) => ({ x: 0.5 + 0.4 * Math.sin(t * 2.5), y: 0.45 + 0.25 * Math.sin(t * 1.3), r: 0.12 });

{ // 1. round flow
  const phases = new Set();
  let maxSpecials = 0, specialsSeen = 0, lastSpecial = null;
  play((t) => (Math.floor(t) % 4 === 0 ? wave(t) : null), 80, () => {
    const s = state();
    phases.add(s.phase);
    const alive = s.bubbles.filter((b) => b.kind !== 'normal' && !b.gone).length;
    maxSpecials = Math.max(maxSpecials, alive);
    if (s.specialAlive && s.specialAlive !== lastSpecial) { specialsSeen++; lastSpecial = s.specialAlive; }
  });
  const s = state();
  check(phases.has('storm') && phases.has('score'), `round reaches the storm and the score screen (${[...phases].join(' → ')})`);
  check(maxSpecials <= 1, `never two specials at once (max ${maxSpecials})`);
  check(specialsSeen >= 5, `specials spaced through the round (${specialsSeen} of 6 appeared)`);
  check(s.best === s.score && Number(store['wiggle.bubble-pop.v1.1.best']) === s.score, `best score saved per device (${s.best})`);
  check(s.score >= 500 && s.score < 20000, `score lands in the hundreds/thousands (${s.score})`);
}
{ // 2. waiting then flailing beats flailing all the time (his own strategy is the core mechanic)
  play(() => 'all', 40);
  const flail = state().score;
  play((t) => (t < 30 ? null : 'all'), 40);
  const wait = state().score;
  check(wait > flail, `stand still 30 s then flail 10 s (${wait}) beats flailing 40 s (${flail})`);
  play((t) => null, 30);
  const s = state();
  const biggest = Math.max(...s.bubbles.map((b) => b.n));
  check(biggest >= 5, `standing still grows giant bubbles (biggest has ${biggest} bubbles in it)`);
}
{ // 3. the wand lasts 10 s, streams bubbles from the moving hand, then turns off
  let wandOn = 0, made = 0, before = 0;
  play((t) => wave(t), 14, (ctx, g) => {
    const s = state();
    if (ctx.time > 1 && ctx.time < 1.04 && !s.wand) game.debugWand();
    if (s.wand) { wandOn += 1 / 30; if (s.bubbles.length > before) made += s.bubbles.length - before; }
    before = s.bubbles.length;
  });
  check(Math.abs(wandOn - 10) < 0.2, `wand lasts 10 s (${wandOn.toFixed(2)} s)`);
  check(made >= 20, `wand streams bubbles (${made} made)`);
}
{ // 4. a spin sends out a swirl of bubbles
  let n0 = 0, n1 = 0;
  play(() => null, 4, (ctx) => {
    if (Math.abs(ctx.time - 2) < 0.017) { n0 = state().bubbles.length; ctx.gestures.emit('spin'); }
    if (Math.abs(ctx.time - 3.2) < 0.017) n1 = state().bubbles.length;
  });
  check(state().stats.spins === 1 && n1 - n0 >= 8, `spin makes a swirl of bubbles (+${n1 - n0})`);
}

{ // 5. a zero-size view (hidden tab) never makes NaN bubbles, and play resumes when it has a size again
  const ctx = makeCtx(() => null);
  ctx.W = 0; ctx.H = 0;
  game.init(ctx);
  for (let i = 0; i < 60; i++) { ctx.time += 1 / 30; game.update(1 / 30, ctx); }
  ctx.W = 1280; ctx.H = 720;
  for (let i = 0; i < 300; i++) { ctx.time += 1 / 30; game.update(1 / 30, ctx); }
  const bad = state().bubbles.filter((b) => !(b.r > 0) || !Number.isFinite(b.x + b.y)).length;
  check(bad === 0 && state().bubbles.length > 3, `zero-size view: no broken bubbles afterwards (${bad} broken, ${state().bubbles.length} ok)`);
}

if (fails) { console.log(`\n${fails} Bubble Pop check(s) failed`); process.exit(1); }
console.log('\nBubble Pop playtests passed');
