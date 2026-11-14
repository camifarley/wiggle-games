// Frame-difference motion detection on the tiny frame. Very cheap; great for
// "wave to pop", "jump", "freeze!" style games.
//
//   motion.at(nx, ny, r)  -> 0..1 how much movement in a circle (norm coords, r = radius)
//   motion.total          -> 0..1 how much of the whole view is moving
//   motion.mask, w, h     -> raw per-pixel 0/1 mask, if you need it

import { frame } from './frame.js';

const THRESHOLD = 70; // summed R+G+B change (0..765) that counts as movement.
// Color (not just brightness) so a red shirt on a same-brightness wall still counts.

export const motion = {
  mask: null,
  w: 0,
  h: 0,
  total: 0,
  _prev: null,

  reset() { this._prev = null; this.total = 0; this.mask = null; },

  update() {
    const { data, w, h } = frame;
    if (!data) return;
    const n = w * h;
    if (!this._prev || this._prev.length !== n * 3) {
      this._prev = new Uint8Array(n * 3);
      this.mask = new Uint8Array(n);
      this.w = w; this.h = h;
      for (let i = 0; i < n; i++) { this._prev[i * 3] = data[i * 4]; this._prev[i * 3 + 1] = data[i * 4 + 1]; this._prev[i * 3 + 2] = data[i * 4 + 2]; }
      return;
    }
    const prev = this._prev;
    let moving = 0;
    for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 3) {
      const r = data[j], g = data[j + 1], b = data[j + 2];
      const d = Math.abs(r - prev[k]) + Math.abs(g - prev[k + 1]) + Math.abs(b - prev[k + 2]);
      const m = d > THRESHOLD ? 1 : 0;
      this.mask[i] = m;
      moving += m;
      prev[k] = r; prev[k + 1] = g; prev[k + 2] = b;
    }
    // light smoothing so it doesn't flicker
    this.total = this.total * 0.6 + (moving / n) * 0.4;
  },

  at(nx, ny, r = 0.06) {
    if (!this.mask) return 0;
    const { w, h, mask } = this;
    const cx = nx * w, cy = ny * h, rr = Math.max(1, r * w);
    const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(w - 1, Math.ceil(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(h - 1, Math.ceil(cy + rr));
    let hit = 0, count = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > rr * rr) continue;
        count++;
        hit += mask[y * w + x];
      }
    }
    return count ? hit / count : 0;
  },
};
