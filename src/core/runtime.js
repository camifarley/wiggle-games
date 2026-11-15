// Runs ONE requestAnimationFrame loop for the whole app, owns the current game,
// and wires up only the trackers that game asks for in `needs`.

import { camera } from './camera.js';
import { perf } from './perf.js';
import { view } from './view.js';
import { frame } from './frame.js';
import { motion } from './motion.js';
import { color } from './color.js';
import { tracking } from './tracking.js';
import { sfx, say } from './audio.js';
import { fx } from './fx.js';
import { debug } from './debug.js';
import { gestures } from './gestures.js';
import { head } from './head.js';
import { recorder } from './recorder.js';

const ML = ['face', 'hands', 'pose'];

let game = null;
let needs = [];
let last = performance.now();
let wakeLock = null;

// The object every game receives. Stable across frames.
export const ctx = {
  view, motion, color, tracking, gestures, head, recorder, sfx, say, fx, perf, camera,
  get W() { return view.W; },
  get H() { return view.H; },
  get face() { return tracking.face; },
  get hands() { return tracking.hands; },
  get pose() { return tracking.pose; },
  time: 0, // seconds since the game started
  release: '1.0', // which release of the game is running (see games/registry.js)
};
if (debug.on) window.wiggle = { ctx, frame }; // inspect live state from the console

export const runtime = {
  get game() { return game; },

  async start(mod, { release = '1.0' } = {}) {
    this.stop();
    ctx.release = release;
    needs = mod.needs || [];
    const ml = needs.filter((n) => ML.includes(n));
    if (ml.length) await tracking.load(ml);
    game = mod;
    ctx.time = 0;
    await game.init?.(ctx);
  },

  stop() {
    if (game) { try { game.destroy?.(ctx); } catch (e) { console.error(e); } }
    game = null;
    needs = [];
    recorder.stop();
    fx.clear();
    motion.reset();
    tracking.reset();
    gestures.reset();
  },

  begin() {
    requestAnimationFrame(tick);
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  },
};

function tick(now) {
  requestAnimationFrame(tick);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(rawDt, 1 / 20); // clamp so a hiccup doesn't teleport things
  camera.keepAlive();
  perf.tick(rawDt, !!game);

  view.beginFrame();
  if (!game) {
    // Menu: show the mirror camera, a little dimmed, behind the cards.
    view.drawCamera(0.9);
    debug.draw(view.g, needs);
    return;
  }

  ctx.time += dt;
  const fresh = (needs.includes('motion') || needs.includes('color')) && frame.update(now);
  if (fresh && needs.includes('motion')) motion.update();
  tracking.update(needs, now);
  if (needs.includes('face') && needs.includes('motion')) gestures.update(dt);
  recorder.tick(dt);

  try {
    game.update?.(dt, ctx);
    const s = fx.shakeOffset(dt);
    view.g.save();
    view.g.translate(s.x, s.y);
    if (game.showCamera !== false) view.drawCamera();
    else view.clear(game.background || '#1b1140');
    game.draw?.(view.g, ctx);
    fx.update(dt);
    fx.draw(view.g);
    view.g.restore();
  } catch (e) {
    console.error('[game]', e);
  }
  debug.draw(view.g, needs);
}

async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
}
