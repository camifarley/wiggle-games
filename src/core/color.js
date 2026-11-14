// Track a brightly colored object (a red ball, a green toy, a yellow wand).
// Runs on the tiny frame, so it's cheap even on the Fire tablet.
//
//   const red = color.track('red')    // or { hue: 0, tol: 18, minSat: 0.5, minVal: 0.3 }
//   if (red.found) { const p = view.toScreen(red.x, red.y); ... }
//   red.size -> 0..1 fraction of the view covered (bigger = closer)
//
// Tip: works best with saturated toys and decent light. Skin can read as red/orange,
// so prefer blue, green or yellow for "magic wand" games when possible.

import { frame } from './frame.js';

export const PRESETS = {
  red:    { hue: 0,   tol: 16, minSat: 0.55, minVal: 0.35 },
  orange: { hue: 25,  tol: 10, minSat: 0.6,  minVal: 0.45 },
  yellow: { hue: 55,  tol: 12, minSat: 0.5,  minVal: 0.5 },
  green:  { hue: 125, tol: 30, minSat: 0.4,  minVal: 0.25 },
  blue:   { hue: 215, tol: 25, minSat: 0.45, minVal: 0.25 },
  pink:   { hue: 320, tol: 18, minSat: 0.4,  minVal: 0.45 },
};

const cache = new Map(); // key -> { frameId, result, smooth }

export const color = {
  PRESETS,

  track(spec = 'red') {
    const key = typeof spec === 'string' ? spec : JSON.stringify(spec);
    const p = typeof spec === 'string' ? PRESETS[spec] : spec;
    let entry = cache.get(key);
    if (!entry) { entry = { frameId: -1, result: { found: false, x: 0.5, y: 0.5, size: 0 } }; cache.set(key, entry); }
    if (entry.frameId === frame.id || !frame.data) return entry.result;
    entry.frameId = frame.id;

    const { data, w, h } = frame;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4;
        if (matches(data[j], data[j + 1], data[j + 2], p)) { sx += x; sy += y; n++; }
      }
    }
    const r = entry.result;
    const size = n / (w * h);
    const found = n >= 4 && size > 0.002;
    if (found) {
      const nx = (sx / n + 0.5) / w, ny = (sy / n + 0.5) / h;
      // smooth position, snap if it just appeared
      const k = r.found ? 0.5 : 1;
      r.x += (nx - r.x) * k;
      r.y += (ny - r.y) * k;
    }
    r.found = found;
    r.size = size;
    return r;
  },
};

function matches(R, G, B, p) {
  const r = R / 255, g = G / 255, b = B / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max, d = max - min;
  if (v < p.minVal || max === 0) return false;
  const s = d / max;
  if (s < p.minSat) return false;
  let hue;
  if (max === r) hue = 60 * (((g - b) / d) % 6);
  else if (max === g) hue = 60 * ((b - r) / d + 2);
  else hue = 60 * ((r - g) / d + 4);
  if (hue < 0) hue += 360;
  let diff = Math.abs(hue - p.hue);
  if (diff > 180) diff = 360 - diff;
  return diff <= p.tol;
}
