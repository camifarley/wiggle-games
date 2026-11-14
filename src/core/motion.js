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

  // Where is the movement? Returns up to n hot regions, strongest first:
  //   [{ x, y, strength }]  (norm coords; strength = 0..1 fraction of that region moving)
  // Great as spawn points ("slime shoots out of your waving hands").
  hotspots(n = 3, minStrength = 0.12) {
    if (!this.mask) return [];
    if (this._hsFrame === frame.id && this._hsN === n && this._hsMin === minStrength) return this._hs;
    const { w, h, mask } = this;
    const GX = 8, GY = 6;
    const cells = Array.from({ length: GX * GY }, () => ({ c: 0, sx: 0, sy: 0, total: 0 }));
    for (let y = 0; y < h; y++) {
      const gy = Math.min(GY - 1, ((y * GY) / h) | 0);
      for (let x = 0; x < w; x++) {
        const cell = cells[gy * GX + Math.min(GX - 1, ((x * GX) / w) | 0)];
        cell.total++;
        if (mask[y * w + x]) { cell.c++; cell.sx += x; cell.sy += y; }
      }
    }
    const ranked = cells
      .map((cell, i) => ({ i, strength: cell.total ? cell.c / cell.total : 0, cell }))
      .filter((r) => r.strength >= minStrength)
      .sort((a, b) => b.strength - a.strength);
    const picked = [];
    for (const r of ranked) {
      if (picked.length >= n) break;
      const gx = r.i % GX, gy = (r.i / GX) | 0;
      if (picked.some((p) => Math.abs(p.gx - gx) <= 1 && Math.abs(p.gy - gy) <= 1)) continue; // skip neighbours
      picked.push({ gx, gy, x: (r.cell.sx / r.cell.c + 0.5) / w, y: (r.cell.sy / r.cell.c + 0.5) / h, strength: r.strength });
    }
    this._hs = picked.map(({ x, y, strength }) => ({ x, y, strength }));
    this._hsFrame = frame.id; this._hsN = n; this._hsMin = minStrength;
    return this._hs;
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
