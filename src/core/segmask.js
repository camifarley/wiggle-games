// Pure person-mask helpers for segment.js (no DOM; tested by scripts/test-segment.js).
//
//   maskSize(camW, camH, maxW)            -> { w, h } segmenter input / mask size (camera aspect, <= maxW wide)
//   SEGMENT_TIERS[tier]                   -> { width, fps } per perf tier
//   smoothInto(state, next, k)            temporal smoothing: state = state + (next - state) * k, per pixel
//                                         (Float32Array 0..1; state is created / resized on demand)
//   toRGBA(values, out)                   0..1 -> RGBA bytes: white, alpha = confidence (2D 'destination-in'
//                                         and WebGL `.a` both read it)
//   maskStats(values, w, h, thresh)       -> { coverage 0..1, box {x, y, w, h} (norm) | null, cx, cy }

export const SEGMENT_TIERS = {
  high: { width: 256, fps: 30 },
  medium: { width: 192, fps: 20 },
  low: { width: 144, fps: 12 },
};

export const SEGMENT_DEFAULTS = {
  smooth: 0.65,    // 0..1: weight of the newest mask (1 = no smoothing, lower = steadier but laggier)
  threshold: 0.5,  // confidence that counts as "person" for stats
};

export function maskSize(camW, camH, maxW) {
  const w = Math.max(16, Math.round(maxW));
  const h = Math.max(9, Math.round((w * (camH || 9)) / (camW || 16)));
  return { w, h };
}

export function smoothInto(state, next, k) {
  if (!state || state.length !== next.length) return Float32Array.from(next);
  const a = Math.max(0, Math.min(1, k));
  for (let i = 0; i < next.length; i++) state[i] += (next[i] - state[i]) * a;
  return state;
}

export function toRGBA(values, out) {
  const n = values.length;
  const o = out && out.length === n * 4 ? out : new Uint8ClampedArray(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    o[j] = 255; o[j + 1] = 255; o[j + 2] = 255;
    o[j + 3] = values[i] * 255;
  }
  return o;
}

export function maskStats(values, w, h, thresh = SEGMENT_DEFAULTS.threshold) {
  let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      if (values[i] < thresh) continue;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!n) return { coverage: 0, box: null, cx: 0.5, cy: 0.5 };
  return {
    coverage: n / (w * h),
    box: { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h },
    cx: (sx / n + 0.5) / w,
    cy: (sy / n + 0.5) / h,
  };
}
