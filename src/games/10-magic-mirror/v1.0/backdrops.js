// 2D backdrops for the cutout stations, drawn into any rect (full screen or a hub tile). Static parts are
// cached per size (util.layer); only the animated bits are drawn each frame.

import { layer, emoji, hsl } from './util.js';

const rnd = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

function sky(g, w, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

// ---------- Teleporter worlds ----------
export const WORLDS = [
  { id: 'space', name: 'Space!', icon: '🚀' },
  { id: 'sea', name: 'Under the sea!', icon: '🐠' },
  { id: 'jungle', name: 'Jungle!', icon: '🦜' },
  { id: 'snow', name: 'Snow land!', icon: '⛄' },
  { id: 'candy', name: 'Candy land!', icon: '🍭' },
];

const STATIC = {
  space(g, w, h) {
    sky(g, w, h, [[0, '#0b0630'], [0.6, '#2a1260'], [1, '#4b1f7a']]);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd(i) * 0.7})`; g.fillRect(rnd(i, 2) * w, rnd(i, 3) * h, 1 + rnd(i, 4) * 2.5, 1 + rnd(i, 4) * 2.5); }
    // planets
    const P = [[0.15, 0.25, 0.09, '#ff8a2b', '#ffd23f'], [0.85, 0.18, 0.06, '#5ee0ff', '#b48cff'], [0.78, 0.75, 0.04, '#ff5ea8', '#ffd1e8']];
    for (const [x, y, r, a, b] of P) {
      const gr = g.createRadialGradient(x * w - r * h * 0.3, y * h - r * h * 0.3, 1, x * w, y * h, r * h);
      gr.addColorStop(0, b); gr.addColorStop(1, a);
      g.fillStyle = gr; g.beginPath(); g.arc(x * w, y * h, r * h, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255,210,63,.7)'; g.lineWidth = h * 0.012;
    g.beginPath(); g.ellipse(0.15 * w, 0.25 * h, 0.15 * h, 0.035 * h, -0.3, 0, Math.PI * 2); g.stroke();
    // moon ground
    g.fillStyle = '#9d97b8'; g.beginPath(); g.ellipse(w / 2, h * 1.12, w * 0.8, h * 0.25, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#857ea3';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(rnd(i, 7) * w, h * (0.92 + rnd(i, 8) * 0.06), h * 0.04, h * 0.012, 0, 0, Math.PI * 2); g.fill(); }
  },
  sea(g, w, h) {
    sky(g, w, h, [[0, '#3fd0ff'], [0.5, '#1a8fd8'], [1, '#0d4f9a']]);
    g.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w * (0.1 + i * 0.17), 0); g.lineTo(w * (0.18 + i * 0.17), 0); g.lineTo(w * (0.05 + i * 0.2), h); g.lineTo(w * (-0.05 + i * 0.2), h); g.fill(); }
    g.fillStyle = '#f2d59a'; g.beginPath(); g.ellipse(w / 2, h * 1.05, w * 0.85, h * 0.16, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 5; i++) emoji(g, ['🐚', '⭐', '🪸', '🐚', '🪸'][i], w * (0.08 + i * 0.21), h * (0.93 + rnd(i) * 0.04), h * 0.07);
  },
  jungle(g, w, h) {
    sky(g, w, h, [[0, '#9ff07a'], [0.55, '#3fae5a'], [1, '#1f6b34']]);
    for (let i = 0; i < 9; i++) { g.fillStyle = `hsl(${110 + rnd(i) * 40},60%,${22 + rnd(i, 2) * 18}%)`; g.fillRect(w * rnd(i, 3), 0, w * 0.03, h); }
    g.fillStyle = '#7a4f2b'; g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = '#5e3c1f'; for (let i = 0; i < 12; i++) g.fillRect(rnd(i, 5) * w, h * (0.9 + rnd(i, 6) * 0.08), w * 0.04, h * 0.01);
    for (let i = 0; i < 6; i++) emoji(g, '🌴', w * (i / 5), h * 0.8, h * (0.25 + rnd(i) * 0.1));
    for (let i = 0; i < 4; i++) emoji(g, '🌺', w * (0.1 + i * 0.27), h * 0.94, h * 0.06);
  },
  snow(g, w, h) {
    sky(g, w, h, [[0, '#a8d8ff'], [1, '#e9f6ff']]);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(w * 0.2, h * 0.95, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w * 0.85, h * 1.0, w * 0.5, h * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d6ecff'; g.beginPath(); g.moveTo(w * 0.55, h * 0.55); g.lineTo(w * 0.72, h * 0.25); g.lineTo(w * 0.9, h * 0.55); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * 0.67, h * 0.34); g.lineTo(w * 0.72, h * 0.25); g.lineTo(w * 0.77, h * 0.34); g.fill();
    emoji(g, '⛄', w * 0.12, h * 0.76, h * 0.2);
    emoji(g, '🌲', w * 0.9, h * 0.72, h * 0.22); emoji(g, '🌲', w * 0.8, h * 0.76, h * 0.16);
  },
  candy(g, w, h) {
    sky(g, w, h, [[0, '#ffc2e6'], [1, '#ffe9a8']]);
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#ff9ed2', '#9ee6ff', '#c8ff9e', '#fff19e'][i % 4]; g.beginPath(); g.arc(w * (i / 7), h * 0.95, h * 0.16, Math.PI, 0); g.fill(); }
    for (let i = 0; i < 5; i++) emoji(g, ['🍭', '🍩', '🧁', '🍬', '🍭'][i], w * (0.06 + i * 0.22), h * (0.72 + rnd(i) * 0.08), h * (0.12 + rnd(i, 2) * 0.05));
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 4; i++) { const x = w * (0.15 + i * 0.25), y = h * (0.12 + rnd(i, 3) * 0.12); for (const [dx, r] of [[0, 0.05], [0.05, 0.065], [0.1, 0.045]]) { g.beginPath(); g.arc(x + dx * h, y, r * h, 0, Math.PI * 2); g.fill(); } }
  },
};

// fish / creatures orbiting his body: half of each orbit in front of him, half behind
function orbiters(world) {
  return {
    space: ['🛸', '☄️', '🚀', '👽'],
    sea: ['🐠', '🐟', '🐡', '🐙', '🐠'],
    jungle: ['🦜', '🦋', '🐒', '🦋'],
    snow: ['🐧', '❄️', '🦭'],
    candy: ['🍬', '🦄', '🍬', '🌈'],
  }[world];
}

export function drawWorld(g, r, worldIdx, t, center, size, front) {
  const W = WORLDS[worldIdx % WORLDS.length];
  if (!front) g.drawImage(layer('w-' + W.id, r.w, r.h, STATIC[W.id]), r.x, r.y, r.w, r.h);
  const u = Math.min(r.w, r.h);
  // orbiting friends
  const list = orbiters(W.id);
  const R = Math.max(u * 0.18, size * 1.6);
  list.forEach((ch, i) => {
    const sp = 0.6 + i * 0.13, a = t * sp + i * 2.4;
    const inFront = Math.sin(a) > 0;
    if (inFront !== !!front) return;
    const x = center.x + Math.cos(a) * R * 1.2, y = center.y + Math.sin(a * 0.7 + i) * R * 0.55;
    const s = u * (0.07 + (inFront ? 0.03 : 0)) * (W.id === 'snow' && ch === '❄️' ? 0.7 : 1);
    emoji(g, ch, x, y, s, { flip: -Math.sin(a) > 0, alpha: inFront ? 1 : 0.85 });
  });
  if (!front) {
    if (W.id === 'space') for (let i = 0; i < 12; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); g.fillStyle = `rgba(255,255,255,${tw})`; g.beginPath(); g.arc(r.x + rnd(i, 9) * r.w, r.y + rnd(i, 10) * r.h * 0.7, u * 0.006 * (1 + tw), 0, Math.PI * 2); g.fill(); }
    if (W.id === 'jungle') { const x = r.x + ((t * 0.08) % 1.2 - 0.1) * r.w; emoji(g, '🐒', x, r.y + r.h * (0.18 + Math.sin(t * 2) * 0.05), u * 0.09, { rot: Math.sin(t * 2) * 0.3 }); }
  } else {
    if (W.id === 'sea') for (let i = 0; i < 14; i++) { const y = r.y + r.h * (1 - ((t * (0.08 + rnd(i) * 0.08) + rnd(i, 2)) % 1.1)); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(r.x + r.w * rnd(i, 3) + Math.sin(t * 2 + i) * 6, y, u * (0.008 + rnd(i, 4) * 0.012), 0, Math.PI * 2); g.stroke(); }
    if (W.id === 'snow') { g.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 40; i++) { const y = r.y + r.h * ((t * (0.05 + rnd(i) * 0.06) + rnd(i, 2)) % 1); g.beginPath(); g.arc(r.x + r.w * rnd(i, 3) + Math.sin(t + i) * u * 0.02, y, u * (0.004 + rnd(i, 4) * 0.006), 0, Math.PI * 2); g.fill(); } }
    if (W.id === 'candy') for (let i = 0; i < 18; i++) { const y = r.y + r.h * ((t * (0.07 + rnd(i) * 0.05) + rnd(i, 2)) % 1); g.fillStyle = hsl(i * 40, 90, 65); g.fillRect(r.x + r.w * rnd(i, 3), y, u * 0.012, u * 0.004); }
  }
}

// ---------- Giant / Tiny town ----------
// houses along the ground, in "town units" (1 = a normal house height) around his feet
const HOUSES = Array.from({ length: 14 }, (_, i) => ({
  x: (i - 6.5) * 1.15 + (rnd(i) - 0.5) * 0.4, h: 0.7 + rnd(i, 2) * 0.6, w: 0.7 + rnd(i, 3) * 0.4,
  wall: ['#ffd23f', '#ff8a8a', '#8ad8ff', '#b9f08a', '#ffb3e6', '#ffffff'][i % 6], roof: ['#e8344a', '#3f6fd8', '#8a4fff', '#ff8a2b'][i % 4],
  tree: rnd(i, 5) > 0.55,
}));

export function drawTown(g, r, t, anchorX, groundY, unit, hops, front) {
  if (!front) {
    g.drawImage(layer('town-sky', r.w, r.h, (c, w, h) => {
      sky(c, w, h, [[0, '#7ec8ff'], [0.7, '#cdeaff'], [1, '#e8f7ff']]);
      c.fillStyle = '#9fe08a'; c.beginPath(); c.ellipse(w * 0.25, h * 0.95, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8cd47a'; c.beginPath(); c.ellipse(w * 0.85, h * 0.97, w * 0.5, h * 0.28, 0, 0, Math.PI * 2); c.fill();
    }), r.x, r.y, r.w, r.h);
    // ground + road
    g.fillStyle = '#6cc35a'; g.fillRect(r.x, groundY, r.w, r.y + r.h - groundY);
    g.fillStyle = '#5b5b6b'; g.fillRect(r.x, groundY + unit * 0.08, r.w, unit * 0.16);
    g.fillStyle = '#ffd23f';
    for (let x = ((t * unit * 0.8) % (unit * 0.6)) - unit; x < r.w; x += unit * 0.6) g.fillRect(r.x + x, groundY + unit * 0.155, unit * 0.25, unit * 0.025);
  }
  // houses: drawn back (behind him) except the ones he stomped into the air come in front
  HOUSES.forEach((hs, i) => {
    const hop = hops[i] || { y: 0, rot: 0 };
    const isFront = hop.y < -0.05;
    if (isFront !== !!front) return;
    const x = anchorX + hs.x * unit, w = hs.w * unit, h = hs.h * unit;
    if (x + w < r.x - unit || x - w > r.x + r.w + unit) return;
    g.save();
    g.translate(x, groundY + hop.y * unit); g.rotate(hop.rot);
    if (hs.tree) {
      g.fillStyle = '#8a5a2b'; g.fillRect(-w * 0.08, -h * 0.5, w * 0.16, h * 0.5);
      g.fillStyle = '#2fa04a'; g.beginPath(); g.arc(0, -h * 0.75, w * 0.38, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = hs.wall; g.fillRect(-w / 2, -h * 0.7, w, h * 0.7);
      g.fillStyle = hs.roof; g.beginPath(); g.moveTo(-w * 0.6, -h * 0.7); g.lineTo(0, -h * 1.1); g.lineTo(w * 0.6, -h * 0.7); g.fill();
      g.fillStyle = '#5ec8ff'; g.fillRect(-w * 0.32, -h * 0.55, w * 0.22, w * 0.22); g.fillRect(w * 0.1, -h * 0.55, w * 0.22, w * 0.22);
      g.fillStyle = '#8a4f2b'; g.fillRect(-w * 0.1, -h * 0.28, w * 0.2, h * 0.28);
    }
    g.restore();
  });
  if (!front) {
    // little cars
    for (let i = 0; i < 3; i++) {
      const x = r.x + (((t * (0.05 + i * 0.03) + i * 0.37) % 1.3) - 0.15) * r.w;
      emoji(g, ['🚗', '🚌', '🚙'][i], x, groundY + unit * 0.12, unit * 0.32, { flip: true });
    }
  } else {
    // clouds drift in front: a giant's head pokes into them
    for (let i = 0; i < 4; i++) {
      const x = r.x + (((t * 0.02 * (1 + i * 0.3) + i * 0.29) % 1.3) - 0.15) * r.w, y = r.y + r.h * (0.08 + rnd(i, 6) * 0.12);
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (const [dx, rr] of [[0, 0.05], [0.05, 0.07], [0.11, 0.045]]) { g.beginPath(); g.arc(x + dx * r.h, y, rr * r.h, 0, Math.PI * 2); g.fill(); }
    }
  }
}
export const HOUSE_COUNT = HOUSES.length;
export const houseX = (i) => HOUSES[i].x;

// ---------- Jelly dessert table ----------
export function drawDessert(g, r, t, feet, size, front) {
  const u = Math.min(r.w, r.h);
  if (!front) {
    g.drawImage(layer('dessert', r.w, r.h, (c, w, h) => {
      for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? '#ffe3f1' : '#ffc9e3'; c.fillRect((i / 14) * w, 0, w / 14 + 1, h); }
      const ty = h * 0.78;
      const cell = h * 0.06;
      for (let y = ty, row = 0; y < h; y += cell, row++) for (let x = 0, col = 0; x < w; x += cell, col++) { c.fillStyle = (row + col) % 2 ? '#ff5e7e' : '#ffffff'; c.fillRect(x, y, cell + 1, cell + 1); }
      emoji(c, '🎂', w * 0.12, ty - h * 0.06, h * 0.16);
      emoji(c, '🍒', w * 0.88, ty - h * 0.02, h * 0.1);
      emoji(c, '🧁', w * 0.78, ty - h * 0.05, h * 0.12);
      emoji(c, '🍓', w * 0.24, ty, h * 0.08);
    }), r.x, r.y, r.w, r.h);
    // the plate he stands on
    g.fillStyle = '#ffffff'; g.strokeStyle = '#d8d0ff'; g.lineWidth = u * 0.01;
    g.beginPath(); g.ellipse(feet.x, feet.y, Math.max(u * 0.2, size * 2.2), u * 0.05, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(180,140,255,.25)'; g.beginPath(); g.ellipse(feet.x, feet.y, Math.max(u * 0.15, size * 1.6), u * 0.03, 0, 0, Math.PI * 2); g.fill();
  }
}

// ---------- Giant: a ground shadow helper ----------
export function shadow(g, x, y, rx, ry, a = 0.25) {
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}
