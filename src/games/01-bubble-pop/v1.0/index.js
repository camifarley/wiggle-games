// Bubble Pop: bubbles float up, wave your hands (or anything!) to pop them.
// Uses cheap motion detection, so it runs well on every device.

const bubbles = [];
let score = 0;
let spawnIn = 0;
let bump = 0; // score "pulse" animation

export default {
  needs: ['motion'],

  init(ctx) {
    bubbles.length = 0;
    score = 0;
    spawnIn = 0;
    ctx.say('Wave your hands to pop the bubbles!');
  },

  update(dt, ctx) {
    const { W, H, view, motion, fx, sfx } = ctx;
    const unit = Math.min(W, H);

    spawnIn -= dt;
    if (spawnIn <= 0 && bubbles.length < 14) {
      spawnIn = 0.45 + Math.random() * 0.5;
      const golden = Math.random() < 0.08;
      const r = unit * (golden ? 0.09 : 0.05 + Math.random() * 0.05);
      bubbles.push({
        x: r + Math.random() * (W - 2 * r), y: H + r, r, golden,
        vy: -(unit * (0.12 + Math.random() * 0.1)), phase: Math.random() * 6, age: 0,
        hue: golden ? 48 : 170 + Math.random() * 160,
      });
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(ctx.time * 2 + b.phase) * unit * 0.03 * dt;
      if (b.y < -b.r) { bubbles.splice(i, 1); continue; }

      // Is something moving where the bubble is?
      const n = view.toNorm(b.x, b.y);
      if (b.age > 0.3 && motion.at(n.x, n.y, (b.r / view.dw) * 0.8) > 0.18) {
        bubbles.splice(i, 1);
        const pts = b.golden ? 5 : 1;
        score += pts;
        bump = 1;
        sfx.pop();
        fx.burst(b.x, b.y, { color: `hsl(${b.hue} 90% 70%)`, count: b.golden ? 50 : 18, size: b.r * 0.15 });
        fx.text(b.x, b.y, `+${pts}`, { size: b.golden ? 72 : 44, color: b.golden ? '#ffcc33' : '#fff' });
        if (b.golden) { sfx.ding(); fx.shake(14); }
        if (Math.floor(score / 10) > Math.floor((score - pts) / 10)) {
          sfx.tada();
          fx.confetti(140);
          ctx.say(['Wow!', 'Amazing!', 'Super popper!', 'Keep going!'][Math.floor(Math.random() * 4)]);
        }
      }
    }
    bump = Math.max(0, bump - dt * 3);
  },

  draw(g, ctx) {
    for (const b of bubbles) {
      const wob = 1 + Math.sin(ctx.time * 6 + b.phase) * 0.04;
      g.save();
      g.translate(b.x, b.y);
      g.scale(wob, 2 - wob);
      const grad = g.createRadialGradient(-b.r * 0.3, -b.r * 0.3, b.r * 0.1, 0, 0, b.r);
      grad.addColorStop(0, `hsla(${b.hue} 100% 95% / .55)`);
      grad.addColorStop(0.7, `hsla(${b.hue} 90% 70% / .25)`);
      grad.addColorStop(1, `hsla(${b.hue} 90% 60% / .7)`);
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.fill();
      g.lineWidth = Math.max(2, b.r * 0.06);
      g.strokeStyle = `hsla(${b.hue} 100% 85% / .9)`;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.ellipse(-b.r * 0.38, -b.r * 0.42, b.r * 0.18, b.r * 0.1, -0.7, 0, Math.PI * 2); g.fill();
      if (b.golden) { g.font = `${b.r}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⭐', 0, 0); }
      g.restore();
    }

    // Big score, top-center
    const size = Math.min(ctx.W, ctx.H) * 0.13 * (1 + bump * 0.35);
    g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = size / 8;
    g.strokeStyle = 'rgba(27,17,64,.8)';
    g.strokeText(score, ctx.W / 2, 20);
    g.fillStyle = '#ffcc33';
    g.fillText(score, ctx.W / 2, 20);
  },

  destroy() {
    bubbles.length = 0;
  },
};
