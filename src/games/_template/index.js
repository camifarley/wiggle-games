// TEMPLATE — copy this folder to src/games/NN-your-game/ (NN = next free number).
// Folders starting with "_" are hidden from the menu.
//
// needs: pick only what you use (each one costs performance):
//   'motion' cheap  -> ctx.motion.at(nx, ny, r), ctx.motion.total
//   'color'  cheap  -> ctx.color.track('red' | 'blue' | 'green' | 'yellow' | ...)
//   'face'   ML     -> ctx.face  (center, roll, size, mouthOpen, smile, blinkLeft/Right, points)
//   'hands'  ML     -> ctx.hands (array: tip, palm, points)
//   'pose'   ML     -> ctx.pose  (nose, leftWrist, rightWrist, leftAnkle, ... points)
// Tracker points are 0..1 "norm" coords. Convert with ctx.view.toScreen(x, y).
//
// Also available: ctx.W, ctx.H, ctx.time, ctx.sfx.pop()/ding()/boing()/whoosh()/tada(),
// ctx.say('text'), ctx.fx.burst()/confetti()/text()/shake(), ctx.perf.settings.

let stars = [];

export default {
  needs: ['motion'],
  showCamera: true, // false = draw your own background (set `background: '#123'`)

  init(ctx) {
    stars = [];
    ctx.say('Wiggle to make stars!');
  },

  update(dt, ctx) {
    if (ctx.motion.total > 0.05 && Math.random() < 0.3) {
      stars.push({ x: Math.random() * ctx.W, y: Math.random() * ctx.H, life: 1 });
    }
    for (const s of stars) s.life -= dt;
    stars = stars.filter((s) => s.life > 0);
  },

  draw(g, ctx) {
    g.font = '64px sans-serif';
    g.textAlign = 'center';
    for (const s of stars) {
      g.globalAlpha = s.life;
      g.fillText('⭐', s.x, s.y);
    }
    g.globalAlpha = 1;
  },

  destroy() {
    stars = [];
  },
};
