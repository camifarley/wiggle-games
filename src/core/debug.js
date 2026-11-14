// Add ?debug to the URL to see FPS, perf tier, the motion mask, color blobs and
// face/hand/pose points drawn over the camera. Handy for tuning games.

import { perf } from './perf.js';
import { view } from './view.js';
import { motion } from './motion.js';
import { color } from './color.js';
import { tracking } from './tracking.js';

const on = new URLSearchParams(location.search).has('debug');

export const debug = {
  on,
  draw(g, needs) {
    if (!on) return;
    g.save();
    if (needs.includes('motion') && motion.mask) {
      const { w, h, mask } = motion;
      const cw = view.dw / w, ch = view.dh / h;
      g.fillStyle = 'rgba(0,255,120,.35)';
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) g.fillRect(view.ox + (i % w) * cw, view.oy + ((i / w) | 0) * ch, cw, ch);
      }
    }
    if (needs.includes('color')) {
      for (const name of Object.keys(color.PRESETS)) {
        const r = color.track(name);
        if (!r.found) continue;
        const p = view.toScreen(r.x, r.y);
        g.strokeStyle = '#fff'; g.lineWidth = 3;
        g.beginPath(); g.arc(p.x, p.y, 20 + r.size * 400, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText(name, p.x + 24, p.y);
      }
    }
    g.fillStyle = '#ff0';
    const dots = [
      ...(tracking.face.found ? tracking.face.points.filter((_, i) => i % 6 === 0) : []),
      ...tracking.hands.flatMap((h) => h.points),
      ...(tracking.pose.found ? tracking.pose.points : []),
    ];
    for (const d of dots) { const p = view.toScreen(d.x, d.y); g.fillRect(p.x - 2, p.y - 2, 4, 4); }
    g.font = '16px monospace';
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(view.W - 230, view.H - 56, 222, 48);
    g.fillStyle = '#fff';
    g.textAlign = 'left';
    g.fillText(`fps ${perf.fps.toFixed(0)}  tier ${perf.tier.name}${perf.pinned ? ' (pinned)' : ''}`, view.W - 222, view.H - 36);
    g.fillText(`needs ${needs.join(',') || '-'}  dpr ${view.dpr}`, view.W - 222, view.H - 16);
    g.restore();
  },
};
