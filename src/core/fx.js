// "Juice": particles, confetti, floating text, screen shake. Particle counts are
// scaled by the perf tier automatically, so games can ask for big bursts freely.
//
//   fx.burst(x, y, { color: '#6cf', count: 24, speed: 400, size: 8 })
//   fx.confetti(count)
//   fx.text(x, y, '+1', { color: '#fff', size: 48 })
//   fx.shake(12)

import { perf } from './perf.js';

const COLORS = ['#ff5ea8', '#ffcc33', '#5ee0ff', '#7dff6a', '#b48cff', '#ff8a3d'];
const parts = [];
const texts = [];
let shakeAmt = 0;

export const fx = {
  COLORS,

  burst(x, y, { color, count = 24, speed = 380, size = 8, gravity = 600, life = 0.8 } = {}) {
    const n = Math.max(2, Math.round(count * perf.settings.particles));
    for (let i = 0; i < n && parts.length < perf.settings.maxParticles; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, gravity,
        size: size * (0.6 + Math.random() * 0.8), life, max: life,
        color: color || COLORS[(Math.random() * COLORS.length) | 0], spin: Math.random() * 10, rect: false });
    }
  },

  confetti(count = 120) {
    const n = Math.round(count * perf.settings.particles);
    for (let i = 0; i < n && parts.length < perf.settings.maxParticles; i++) {
      parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 120, vy: 150 + Math.random() * 200, gravity: 80,
        size: 8 + Math.random() * 8, life: 3, max: 3,
        color: COLORS[(Math.random() * COLORS.length) | 0], spin: Math.random() * 10, rect: true });
    }
  },

  text(x, y, str, { color = '#fff', size = 48, life = 0.9 } = {}) {
    texts.push({ x, y, str, color, size, life, max: life });
  },

  shake(px = 10) { shakeAmt = Math.max(shakeAmt, px); },

  // Called by the runtime. Returns the shake offset to apply this frame.
  shakeOffset(dt) {
    shakeAmt *= Math.pow(0.001, dt);
    if (shakeAmt < 0.5) { shakeAmt = 0; return { x: 0, y: 0 }; }
    return { x: (Math.random() - 0.5) * shakeAmt * 2, y: (Math.random() - 0.5) * shakeAmt * 2 };
  },

  update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 8;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 90 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
  },

  draw(g) {
    for (const p of parts) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      g.fillStyle = p.color;
      if (p.rect) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.spin);
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.size * (p.life / p.max), 0, Math.PI * 2); g.fill();
      }
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of texts) {
      const k = t.life / t.max;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${t.size * (1 + (1 - k) * 0.3)}px ui-rounded, system-ui, sans-serif`;
      g.lineWidth = t.size / 8;
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.strokeText(t.str, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.str, t.x, t.y);
    }
    g.globalAlpha = 1;
  },

  clear() { parts.length = 0; texts.length = 0; shakeAmt = 0; },
};
