// Small shared helpers for the stations (pure, no DOM).

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => k * k * (3 - 2 * k);

// damped spring { x, v } toward target (sub-stepped so a slow frame never explodes)
export function spring(o, target, dt, k = 120, d = 12) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) { o.v += ((target - o.x) * k - o.v * d) * h; o.x += o.v * h; }
  return o.x;
}
export const sp = (x = 0) => ({ x, v: 0 });

// hand clap from the two wrists: hands far apart, then together within `window` s
// (sizes in body sizes, so it works near and far). Pure: returns { clap, state }.
export function createClapDetector({ apart = 1.0, together = 0.5, window = 0.9, cooldown = 0.5 } = {}) {
  let lastApart = -9, lastClap = -9, wasTogether = false;
  return {
    update(t, d) {
      if (d == null) { wasTogether = false; return false; }
      if (d > apart) lastApart = t;
      const isTogether = d < together;
      const clap = isTogether && !wasTogether && t - lastApart < window && t - lastClap > cooldown;
      wasTogether = isTogether;
      if (clap) lastClap = t;
      return clap;
    },
  };
}

// cached static layers (backdrops): one canvas per key + size, drawn once
const layers = new Map();
export function layer(key, w, h, draw) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const id = `${key}|${w}x${h}`;
  let c = layers.get(id);
  if (!c) {
    if (layers.size > 40) layers.clear();
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    layers.set(id, c);
  }
  return c;
}

export function emoji(g, ch, x, y, size, { flip = false, rot = 0, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.font = `${Math.round(size)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 0);
  g.restore();
}

export const hsl = (h, s = 90, l = 60, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
