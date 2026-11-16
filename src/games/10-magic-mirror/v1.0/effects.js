// Stations 1-7: effects on the whole camera picture (warps, clones, time, light, pixels).
// A station = { id, title, word, icon, color, intro, finaleLine, shader, uniforms(), init(), update(dt, st, B, M),
//   on: { jump, crouch, stand, spin, hide, peekaboo, punch, clap, still, lean, step, leave, return }(st, M, data),
//   finale(st, M), finaleTime, values(st, B, M) -> shader uniforms, drawBack / drawFront(g, st, B, M) }
// B = the body this frame (index.js bodyNow): chest, feet, top, size, lean, height, crouch, armsUp, motion, vel, wrists.
// M = the mirror (index.js): settings, meter(), score(), sfx(), say(), fx, rect (the area being drawn), preview.
// Shaders get gl.js HEADER: toNorm(screenPx()), cam(n), mask(n), hist(n, framesAgo), plate(n), hsv(), noise()...

import { clamp, spring, sp, hsl, emoji } from './util.js';

// ---------------------------------------------------------------- 1 Funhouse
const funhouse = {
  id: 'funhouse', title: 'Funhouse', word: 'Bendy', icon: '🎪', color: '#ff5ea8',
  intro: 'Funhouse mirror! Lean, jump and squat!', finaleLine: 'Jelly wobble!', finaleTime: 4,
  sound: 'boing',
  shader: `
uniform float uLean, uStretch, uSquash, uWobble, uBend, uFloor, uCx;
void main() {
  vec2 n = toNorm(screenPx());
  vec2 p = n;
  float st = clamp(uStretch, -0.4, 0.8), sq = clamp(uSquash, -0.3, 1.2);
  float sy = max(0.4, 1.0 + st * 0.6 - sq * 0.42);
  float sx = max(0.4, 1.0 - st * 0.28 + sq * 0.6);
  p.y = uFloor - (uFloor - p.y) / sy;
  p.x = uCx + (p.x - uCx) / sx;
  float up = clamp(uFloor - p.y, 0.0, 1.2);
  p.x -= uLean * (0.09 * sin(p.y * 7.0 + uTime * 2.2) + 0.2 * up * up);
  p.x += 0.014 * uBend * sin(p.y * 21.0 + uTime * 2.3);
  p.y += 0.01 * uBend * sin(p.x * 15.0 + uTime * 1.7);
  p += uWobble * 0.07 * vec2(sin(p.y * 9.0 + uTime * 13.0), cos(p.x * 8.0 + uTime * 11.0));
  vec3 c = cam(p);
  c = mix(c, c * hsv(fract(p.y * 0.8 + uTime * 0.6), 0.55, 1.25), clamp(uWobble, 0.0, 1.0) * 0.6);
  float sh = smoothstep(0.035, 0.0, abs(vUv.x - vUv.y * 0.55 - 0.25 - 0.12 * sin(uTime * 0.4)));
  c += sh * 0.12;
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uLean: 0, uStretch: 0, uSquash: 0, uWobble: 0, uBend: 1, uFloor: 0.95, uCx: 0.5 }),
  init: () => ({ lean: sp(), stretch: sp(), squash: sp(), wobble: 0 }),
  update(dt, st, B, M) {
    const s = M.set;
    const lean = M.preview ? Math.sin(M.time * 1.4) * 0.8 : B.lean;
    spring(st.lean, lean * s.fhBend, dt, 40, 5);
    spring(st.stretch, clamp(B.height / 6, -0.15, 0.4) * s.fhStretch, dt, 90, 7);
    spring(st.squash, (M.preview ? Math.max(0, Math.sin(M.time * 0.9)) * 0.7 : B.crouch) * s.fhStretch, dt, 70, 6);
    if (M.preview && Math.sin(M.time * 1.1) > 0.995) st.stretch.v += 4;
    st.wobble = st.finaleT != null ? Math.max(0, 1.2 - st.finaleT / 3.5) : st.wobble * Math.exp(-dt * 2);
    M.meter(dt * B.motion * 0.5);
  },
  on: {
    jump(st, M) { st.stretch.v += 5 * M.set.fhStretch; M.sfx('boing'); M.score(100, 'BOING!'); M.meter(0.12); },
    crouch(st, M) { st.squash.v += 5; M.sfx('squish'); M.score(100, 'SQUISH!'); M.meter(0.1); },
    lean(st, M) { M.sfx('whoosh'); M.score(50, 'WOBBLE!'); M.meter(0.06); },
    spin(st, M) { st.wobble = Math.max(st.wobble, 0.6); M.sfx('boing'); M.score(150, 'WHEE!'); M.meter(0.15); },
  },
  finale(st, M) { st.wobble = 1.2; for (let i = 0; i < 6; i++) setTimeout(() => M.sfx('boing'), i * 260); },
  values: (st, B, M) => ({
    uLean: st.lean.x, uStretch: st.stretch.x, uSquash: st.squash.x, uWobble: st.wobble, uBend: M.set.fhBend,
    uFloor: Math.min(0.98, B.feet.y), uCx: B.chest.x,
  }),
  drawFront(g, st, B, M) { mirrorFrame(g, M.rect, M.time, '#ff5ea8', '#ffd23f'); },
};

// a carnival mirror frame with blinking bulbs
function mirrorFrame(g, r, t, c1, c2) {
  const u = Math.min(r.w, r.h);
  const bw = u * 0.035;
  g.save();
  g.strokeStyle = c1; g.lineWidth = bw;
  g.beginPath(); g.roundRect(r.x + bw / 2, r.y + bw / 2, r.w - bw, r.h - bw, u * 0.06); g.stroke();
  const n = Math.max(8, Math.round((r.w + r.h) / (u * 0.12)));
  const per = 2 * (r.w + r.h) / n;
  for (let i = 0; i < n; i++) {
    let d = i * per, x, y;
    if (d < r.w) { x = r.x + d; y = r.y + bw / 2; }
    else if ((d -= r.w) < r.h) { x = r.x + r.w - bw / 2; y = r.y + d; }
    else if ((d -= r.h) < r.w) { x = r.x + r.w - d; y = r.y + r.h - bw / 2; }
    else { d -= r.w; x = r.x + bw / 2; y = r.y + r.h - d; }
    const on = (i + Math.floor(t * 4)) % 2 === 0;
    g.fillStyle = on ? c2 : 'rgba(255,255,255,.55)';
    g.beginPath(); g.arc(x, y, bw * (on ? 0.42 : 0.3), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- 2 Clone Party
// clone slots: [dx (norm x), dy (norm y, up = behind), scale] around his feet; back rows are smaller and higher
const SLOTS = [[-0.24, 0, 0.88], [0.24, 0, 0.88], [-0.43, -0.02, 0.78], [0.43, -0.02, 0.78], [-0.12, -0.06, 0.62], [0.12, -0.06, 0.62], [-0.32, -0.08, 0.55], [0.32, -0.08, 0.55]];
const clones = {
  id: 'clones', title: 'Clone Party', word: 'Clones', icon: '👯', color: '#5ee0ff',
  intro: 'Jump to make a clone!', finaleLine: 'Conga line!', finaleTime: 6, sound: 'pop', usesMask: true,
  shader: `
uniform float uN; uniform vec4 uClone[8]; uniform float uHue[8]; uniform vec2 uAnchor;
void main() {
  vec2 n = toNorm(screenPx());
  vec3 live = cam(n);
  vec3 c = live;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uN) break;
    vec4 k = uClone[i];
    vec2 src = uAnchor + (n - uAnchor - k.xy) / max(0.05, k.z);
    vec4 h = hist(src, k.w);
    vec3 tint = mix(h.rgb, h.rgb * hsv(uHue[i], 0.7, 1.35), 0.5);
    c = mix(c, tint, h.a);
  }
  c = mix(c, live, mask(n)); // the real him is always in front
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uN: 0, uClone: Array.from({ length: 8 }, () => [0, 0, 1, 0]), uHue: new Array(8).fill(0), uAnchor: [0.5, 0.95] }),
  init: () => ({ list: [], hue: 0 }),
  spawn(st, M, quiet = false) {
    const max = M.maxClones;
    if (st.list.length >= max) {
      const old = st.list.shift();
      if (!quiet) poof(M, old.slot);
    }
    const used = new Set(st.list.map((c) => c.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    st.hue = (st.hue + 0.137) % 1;
    st.list.push({ slot, born: M.time, hue: st.hue });
    if (!quiet) {
      const p = slotScreen(M, SLOTS[slot]);
      M.fx.burst(p.x, p.y, { count: 30, speed: 420, size: 8, color: hsl(st.hue * 360) });
      M.sfx('pop'); setTimeout(() => M.sfx('squeak', 1 + st.list.length * 0.12), 90);
      M.score(100 * st.list.length, st.list.length >= 2 ? `${st.list.length} CLONES!` : 'CLONE!', p.x, p.y - M.rect.unit * 0.2);
      M.meter(0.14);
    }
  },
  update(dt, st, B, M) {
    if (M.preview && st.list.length < 4) clones.spawn(st, M, true);
    M.meter(dt * B.motion * 0.35);
  },
  on: {
    jump(st, M) { clones.spawn(st, M); },
    clap(st, M) { clones.spawn(st, M); },
    punch(st, M) { clones.spawn(st, M); },
    spin(st, M) { clones.spawn(st, M); clones.spawn(st, M); },
  },
  finale(st, M) {
    while (st.list.length < M.maxClones) clones.spawn(st, M, true);
    M.fx.confetti(120);
    st.beat = 0;
  },
  values(st, B, M) {
    const fps = M.gl.fps, maxK = M.gl.historyFrames - 1;
    const delay = M.set.cloneDelay;
    const conga = st.finaleT != null;
    if (conga) {
      const beat = Math.floor(st.finaleT * 2.4);
      if (beat !== st.beat) { st.beat = beat; M.sfx('step'); }
    }
    const rows = st.list.map((c, i) => {
      let [dx, dy, s] = SLOTS[c.slot];
      const pop = clamp((M.time - c.born) / 0.3);
      s *= pop < 1 ? 0.2 + 0.8 * pop + Math.sin(pop * Math.PI) * 0.25 : 1;
      let d = (i + 1) * delay;
      if (conga) {
        const n = st.list.length;
        const ph = (st.finaleT * 0.18 + i / n) % 1;
        dx = ph * 1.5 - 0.75; dy = -Math.abs(Math.sin(st.finaleT * 7.5 + i)) * 0.05; s = 0.72;
        d = 0.1 + i * 0.12;
      }
      return { v: [dx, dy, s, clamp(Math.round(d * fps), 1, maxK)], hue: c.hue, s };
    }).sort((a, b) => a.s - b.s);
    const arr = Array.from({ length: 8 }, (_, i) => rows[i]?.v || [0, 0, 1, 0]);
    return { uN: rows.length, uClone: arr, uHue: Array.from({ length: 8 }, (_, i) => rows[i]?.hue || 0), uAnchor: [B.feet.x, Math.min(0.98, B.feet.y)] };
  },
  drawFront(g, st, B, M) {
    if (M.preview) return;
    // a counter badge per clone: tiny numbers over their heads would be noise; one big "x N"
    if (st.list.length) {
      const u = M.rect.unit;
      g.save();
      g.font = `900 ${u * 0.07}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'top';
      g.fillStyle = '#fff'; g.strokeStyle = 'rgba(27,17,64,.7)'; g.lineWidth = u * 0.012;
      const txt = `👯 ×${st.list.length + 1}`;
      g.strokeText(txt, M.rect.x + M.rect.w - u * 0.04, M.rect.y + u * 0.2); g.fillText(txt, M.rect.x + M.rect.w - u * 0.04, M.rect.y + u * 0.2);
      g.restore();
    }
  },
};
function slotScreen(M, [dx, dy, s]) {
  const B = M.body;
  return M.rect.toScreen(B.feet.x + dx, B.feet.y + dy - (B.feet.y - B.chest.y) * s);
}
function poof(M, slot) {
  const p = slotScreen(M, SLOTS[slot]);
  M.fx.burst(p.x, p.y, { count: 16, speed: 260, size: 9, color: '#ffffff' });
}

// ---------------------------------------------------------------- 3 Time Smear
const SMEAR_MODES = ['Noodle legs!', 'Stretchy head!', 'Side smear!', 'Time bubble!'];
const smear = {
  id: 'smear', title: 'Time Smear', word: 'Smear', icon: '⏳', color: '#b48cff',
  intro: 'Wiggle slow, then wiggle fast! Jump to change the magic!', finaleLine: 'Rewind!', finaleTime: 4, sound: 'laser',
  shader: `
uniform float uMode, uSpan, uRewind, uSmooth; uniform vec2 uCenter;
void main() {
  vec2 n = toNorm(screenPx());
  float f;
  if (uMode < 0.5) f = n.y;
  else if (uMode < 1.5) f = 1.0 - n.y;
  else if (uMode < 2.5) f = n.x;
  else f = length((n - uCenter) * vec2(uAspect, 1.0)) * 1.4;
  f = clamp(f, 0.0, 1.0);
  float k = f * uSpan;
  k = mix(k, uSpan * (0.5 + 0.5 * sin(f * 14.0 - uTime * 10.0)), uRewind);
  vec3 c = uSmooth > 0.5 ? histSmooth(n, k).rgb : hist(n, k).rgb;
  c = mix(c, c * hsv(fract(f * 1.6 - uTime * 0.3), 0.45, 1.2), 0.18 + uRewind * 0.45);
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uMode: 0, uSpan: 10, uRewind: 0, uSmooth: 1, uCenter: [0.5, 0.5] }),
  init: () => ({ mode: 0, span: sp(8), rewind: 0, energy: 0 }),
  update(dt, st, B, M) {
    st.energy += (clamp(B.motion * 3) - st.energy) * Math.min(1, dt * 2);
    const max = Math.max(2, M.gl.historyFrames - 2) * M.set.smearSpan;
    spring(st.span, max * (0.4 + 0.6 * st.energy), dt, 20, 6);
    st.rewind = st.finaleT != null ? Math.min(1, st.finaleT * 3, (M.finaleTime - st.finaleT) * 2) : 0;
    if (M.preview) st.mode = Math.floor(M.time / 4) % 4;
    M.meter(dt * B.motion * 0.5);
  },
  on: {
    jump(st, M) { st.mode = (st.mode + 1) % 4; M.sfx('laser'); M.score(100, SMEAR_MODES[st.mode]); M.meter(0.12); },
    spin(st, M) { M.sfx('sonic'); M.score(150, 'Time twist!'); M.meter(0.15); },
    lean(st, M) { M.score(50, 'Smeeear!'); M.meter(0.05); },
  },
  finale(st, M) { M.sfx('sonic'); setTimeout(() => M.sfx('sonic'), 500); },
  values: (st, B, M) => ({ uMode: st.mode, uSpan: Math.max(0, st.span.x), uRewind: st.rewind, uSmooth: M.tierName === 'low' ? 0 : 1, uCenter: [B.chest.x, B.chest.y] }),
  drawFront(g, st, B, M) {
    const u = M.rect.unit;
    // a little clock that spins with how wild time is
    emoji(g, '⏰', M.rect.x + M.rect.w - u * 0.1, M.rect.y + M.rect.h - u * 0.12, u * 0.09, { rot: Math.sin(M.time * (2 + st.energy * 12)) * 0.4 });
  },
};

// ---------------------------------------------------------------- 4 Rainbow Trails
const trails = {
  id: 'trails', title: 'Rainbow Trails', word: 'Rainbow', icon: '🌈', color: '#ffcc33', usesMask: true,
  intro: 'Move to make rainbows! Stand still to make them go away!', finaleLine: 'Rainbow blast!', finaleTime: 3.5, sound: 'powerup',
  shader: `
uniform float uK, uStep, uBurst;
void main() {
  vec2 n = toNorm(screenPx());
  vec3 base = cam(n);
  float now = mask(n);
  vec3 acc = vec3(0.0); float cover = 0.0;
  for (int i = 1; i <= 12; i++) {
    if (float(i) > uK) break;
    float fi = float(i);
    vec4 h = hist(n, fi * uStep);
    float fade = 1.0 - (fi - 1.0) / uK;
    vec3 hc = hsv(fract(fi * 0.085 - uTime * 0.25), 0.9, 1.0);
    float w = h.a * fade * (1.0 - cover);
    acc += hc * w; cover += w;
  }
  vec3 trail = acc / max(cover, 0.001);
  float a = clamp(cover, 0.0, 1.0) * (0.8 + uBurst * 0.2) * (1.0 - now);
  vec3 c = mix(base, trail + uBurst * 0.25, a);
  c += now * uBurst * 0.25 * hsv(fract(n.y + uTime), 0.8, 1.0);
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uK: 8, uStep: 2, uBurst: 0 }),
  init: () => ({ burst: 0 }),
  update(dt, st, B, M) {
    st.burst = st.finaleT != null ? Math.max(0, 1 - st.finaleT / M.finaleTime) : 0;
    M.meter(dt * B.motion * 0.6);
  },
  on: {
    jump(st, M) { M.sfx('boing'); M.score(100, 'RAINBOW!'); M.meter(0.1); rainbowBurst(M, M.body.chest, 30); },
    spin(st, M) { M.sfx('whoosh'); M.score(150, 'Rainbow spin!'); M.meter(0.15); rainbowBurst(M, M.body.chest, 40); },
    punch(st, M, d) { M.sfx('laser'); M.score(50, 'Zap!'); M.meter(0.06); if (d) rainbowBurst(M, d, 14); },
  },
  finale(st, M) { M.meterBurst(); M.fx.confetti(220); M.sfx('powerup'); M.fx.shake(14); },
  values: (st, B, M) => ({ uK: Math.min(M.tierName === 'low' ? 6 : 12, Math.round(M.set.trailCount * (1 + st.burst * 0.5))), uStep: M.set.trailGap, uBurst: st.burst }),
};
function rainbowBurst(M, n, count) {
  const p = M.rect.toScreen(n.x, n.y);
  for (let i = 0; i < 6; i++) M.fx.burst(p.x, p.y, { count: Math.ceil(count / 6), speed: 520, size: 9, color: hsl(i * 60) });
}

// ---------------------------------------------------------------- 5 Light Painter
const light = {
  id: 'light', title: 'Light Painter', word: 'Light', icon: '✨', color: '#7dff6a',
  intro: 'Paint with your hands! Clap for fireworks!', finaleLine: 'Fireworks show!', finaleTime: 4, sound: 'shield',
  shader: `
uniform float uDark, uFlash;
void main() {
  vec2 n = toNorm(screenPx());
  vec3 c = cam(n);
  float m = mask(n);
  vec3 night = c * vec3(0.22, 0.26, 0.48) + vec3(0.01, 0.0, 0.04);
  night = mix(night, c * 0.55, m * 0.55);
  gl_FragColor = vec4(mix(c, night, uDark) + uFlash, 1.0);
}`,
  uniforms: () => ({ uDark: 1, uFlash: 0 }),
  init: () => ({ ribbons: [[], []], hue: 0, flash: 0, rockets: [], painted: 0 }),
  update(dt, st, B, M) {
    const life = M.set.ribbonLife;
    const t = M.time;
    const wr = M.preview
      ? [0, 1].map((i) => ({ x: B.chest.x + Math.sin(t * 1.7 + i * 2.1) * 0.18, y: B.chest.y + Math.sin(t * 2.6 + i) * 0.16, ok: true }))
      : B.wrists;
    wr.forEach((w, i) => {
      const rib = st.ribbons[i];
      if (!w?.ok) { if (rib.length && rib[rib.length - 1].gap !== true) rib.push({ gap: true, t }); return; }
      const p = M.rect.toScreen(w.x, w.y);
      const last = rib[rib.length - 1];
      const d = last && !last.gap ? Math.hypot(p.x - last.x, p.y - last.y) : 99;
      if (d > 3) {
        st.hue = (st.hue + Math.min(d, 60) * 0.6) % 360;
        rib.push({ x: p.x, y: p.y, t, h: st.hue });
        if (d < 99) { st.painted += d; M.meter(d / (M.rect.unit * 9)); }
        if (!M.preview && d > 18 && Math.random() < 0.3) M.fx.burst(p.x, p.y, { count: 2, speed: 120, size: 4, color: hsl(st.hue, 100, 75) });
      }
      while (rib.length && t - rib[0].t > life) rib.shift();
      if (rib.length > 260) rib.splice(0, rib.length - 260);
    });
    st.flash = Math.max(0, st.flash - dt * 2.5);
    // finale rockets
    for (const r of st.rockets) {
      r.t += dt;
      if (!r.done && r.t >= r.at) { r.done = true; firework(M, r.x, r.y, r.h, 60); }
    }
    st.rockets = st.rockets.filter((r) => !r.done);
  },
  on: {
    clap(st, M) { light.fireworks(st, M); },
    punch(st, M) { light.fireworks(st, M); },
    jump(st, M) { M.sfx('collect'); M.score(50, 'Sparkle!'); M.meter(0.05); },
  },
  fireworks(st, M) {
    const pts = st.ribbons.flat().filter((p) => !p.gap);
    if (pts.length < 4) { M.sfx('pop'); M.say('Paint first, then clap!', { interrupt: false }); return; }
    const n = Math.min(M.tierName === 'low' ? 10 : 26, Math.ceil(pts.length / 6));
    for (let i = 0; i < n; i++) {
      const p = pts[Math.floor((i / n) * pts.length)];
      setTimeout(() => firework(M, p.x, p.y, p.h, 26), i * 30);
    }
    const pts100 = Math.round(pts.length * 10 / 50) * 50;
    M.score(Math.max(100, pts100), pts.length > 120 ? 'MEGA FIREWORKS!' : 'FIREWORKS!');
    M.sfx('boom'); M.fx.shake(10);
    st.flash = 0.5;
    st.ribbons = [[], []];
    M.meter(0.15);
  },
  finale(st, M) {
    const r = M.rect;
    for (let i = 0; i < 9; i++) st.rockets.push({ t: 0, at: 0.2 + i * 0.4, x: r.x + r.w * (0.15 + Math.random() * 0.7), y: r.y + r.h * (0.15 + Math.random() * 0.35), h: Math.random() * 360 });
    if (st.ribbons.flat().length > 4) light.fireworks(st, M);
  },
  values: (st) => ({ uDark: 1, uFlash: st.flash }),
  drawFront(g, st, B, M) {
    const k = M.rect.unit / 700;
    const passes = M.tierName === 'low' ? [[16, 0.22], [4, 0.95]] : [[26, 0.13], [12, 0.35], [4, 0.95]];
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineJoin = 'round';
    const now = M.time, life = M.set.ribbonLife, wmul = M.set.ribbonWidth;
    for (const [w, a] of passes) {
      g.lineWidth = w * k * wmul;
      for (const rib of st.ribbons) {
        for (let i = 1; i < rib.length; i++) {
          const p0 = rib[i - 1], p1 = rib[i];
          if (p0.gap || p1.gap) continue;
          const age = clamp(1 - (now - p1.t) / life);
          g.strokeStyle = w <= 4 ? `rgba(255,255,255,${a * age})` : hsl(p1.h, 100, 62, a * age);
          g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
        }
      }
    }
    // glowing hand tips
    for (const rib of st.ribbons) {
      const p = rib[rib.length - 1];
      if (!p || p.gap || now - p.t > 0.3) continue;
      g.fillStyle = hsl(p.h, 100, 70, 0.6);
      g.beginPath(); g.arc(p.x, p.y, 18 * k * wmul + Math.sin(now * 20) * 3 * k, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  },
};
function firework(M, x, y, h, count) {
  for (let j = 0; j < 3; j++) M.fx.burst(x, y, { count: Math.ceil(count / 3), speed: 380 + j * 160, size: 7, color: hsl(h + j * 40, 100, 65) });
  M.sfx('pop');
}

// ---------------------------------------------------------------- 6 Kaleidoscope
const kaleido = {
  id: 'kaleido', title: 'Kaleidoscope', word: 'Flower', icon: '🔮', color: '#ff8a2b',
  intro: 'Put your arms up! Spin around!', finaleLine: 'Flower power!', finaleTime: 4, sound: 'cubes',
  shader: `
uniform float uSeg, uRot, uZoom, uBloom; uniform vec2 uCenter;
void main() {
  vec2 px = screenPx();
  vec2 p = (px - uRes * 0.5) / min(uRes.x, uRes.y);
  float r = length(p);
  float a = atan(p.y, p.x) + uRot;
  float seg = 2.0 * PI / uSeg;
  a = mod(a, seg); a = abs(a - seg * 0.5);
  float rr = r * uZoom * (1.0 + uBloom * 0.22 * sin(r * 22.0 - uTime * 9.0));
  vec2 q = vec2(cos(a), sin(a)) * rr;
  vec2 s = uCenter + vec2(q.x / uAspect, q.y);
  s = 1.0 - abs(1.0 - mod(s, 2.0));
  vec3 c = cam(s);
  c = mix(c, c * hsv(fract(r * 1.4 - uTime * 0.35), 0.6, 1.35), 0.22 + uBloom * 0.4);
  c *= 1.0 - smoothstep(0.5, 0.95, r) * 0.3;
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uSeg: 6, uRot: 0, uZoom: 0.9, uBloom: 0, uCenter: [0.5, 0.5] }),
  init: () => ({ seg: 6, rot: 0, rotV: 0.15, zoom: sp(0.9), bloom: 0, cx: 0.5, cy: 0.5, petals: 0 }),
  update(dt, st, B, M) {
    const up = M.preview ? 0.5 + 0.5 * Math.sin(M.time * 0.7) : B.armsUp;
    const max = Math.round(M.set.kMax);
    const goal = 4 + up * (max - 4);
    st.segT = (st.segT || 0) - dt;
    // hysteresis + a short cooldown: a jittery arm never flickers the count (or kicks the zoom every frame)
    if (Math.abs(goal - st.seg) >= 0.85 && st.segT <= 0) {
      const want = Math.max(3, Math.round(goal));
      st.seg = want; st.segT = 0.35; st.zoom.v -= 1.2;
      if (!M.preview) { M.sfx('cubes'); M.score(50, `${want}!`); M.meter(0.05); }
    }
    st.rotV += (M.preview ? 0.4 : B.lean * 1.2) * dt * M.set.kSpin;
    st.rotV *= Math.exp(-dt * 0.6);
    st.rot += (st.rotV + 0.12) * dt;
    spring(st.zoom, 0.9 - B.motion * 0.3, dt, 60, 7);
    st.zoom.x = Math.max(0.45, Math.min(1.6, st.zoom.x));
    st.cx += (B.chest.x - st.cx) * Math.min(1, dt * 3);
    st.cy += (B.chest.y - st.cy) * Math.min(1, dt * 3);
    st.bloom = st.finaleT != null ? Math.min(1, st.finaleT * 2, (M.finaleTime - st.finaleT) * 1.5) : 0;
    M.meter(dt * B.motion * 0.5);
  },
  on: {
    spin(st, M) { st.rotV += 5 * M.set.kSpin; M.sfx('whoosh'); M.score(150, 'WHEEE!'); M.meter(0.18); },
    turn(st, M) { st.rotV += 1.5 * M.set.kSpin; },
    jump(st, M) { st.zoom.v += 5; M.sfx('boing'); M.score(100, 'BLOOP!'); M.meter(0.1); },
    lean(st, M) { M.score(50, 'Swirl!'); M.meter(0.05); },
  },
  finale(st, M) { M.sfx('powerup'); M.fx.confetti(100); },
  values: (st) => ({ uSeg: st.seg, uRot: st.rot, uZoom: st.zoom.x, uBloom: st.bloom, uCenter: [st.cx, st.cy] }),
  drawFront(g, st, B, M) {
    if (st.bloom <= 0) return;
    const r = M.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, u = r.unit;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 3; ring++) {
      const n = 8 + ring * 4, R = u * (0.12 + ring * 0.13) * (0.4 + st.bloom * 0.8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + M.time * (ring % 2 ? -0.6 : 0.6);
        g.fillStyle = hsl(ring * 70 + i * 12 + M.time * 80, 100, 65, 0.28 * st.bloom);
        g.beginPath(); g.ellipse(cx + Math.cos(a) * R, cy + Math.sin(a) * R, u * 0.09 * st.bloom, u * 0.035, a, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  },
};

// ---------------------------------------------------------------- 7 Pixel Me
const pixel = {
  id: 'pixel', title: 'Pixel Me', word: 'Pixels', icon: '👾', color: '#36c98a',
  intro: "You're a video game! Jump! Squat!", finaleLine: '8-bit party!', finaleTime: 4, sound: 'laser',
  shader: `
uniform float uBlock, uExplode, uBuild, uCycle;
void main() {
  vec2 px = screenPx();
  float B = max(2.0, uBlock);
  vec2 cell = floor(px / B);
  vec2 r = hash2(cell);
  vec2 f = fract(px / B);
  vec2 dir = normalize(r - 0.5 + 0.0001);
  vec2 src = (cell + 0.5 - dir * uExplode * (5.0 + r.x * 16.0)) * B;
  vec3 c = cam(toNorm(src));
  c = floor(c * 4.0 + 0.5) / 4.0;
  c *= 1.0 - step(0.9, max(f.x, f.y)) * 0.5;
  c += (1.0 - step(0.16, min(f.x, f.y))) * 0.12;
  vec3 empty = vec3(0.07, 0.05, 0.16) + 0.05 * hsv(fract(cell.x * 0.07 + uTime), 0.8, 1.0);
  c = mix(c, empty, step(1.0 - uExplode * 0.45, r.y));
  float rows = uRes.y / B;
  float need = (1.0 - (cell.y + 1.0) / rows) * 0.8 + r.x * 0.2;
  c = mix(empty, c, step(need, uBuild));
  c = mix(c, hsv(fract(luma(c) * 1.5 + uTime * 0.6 + cell.x * 0.013), 0.9, luma(c) * 1.4 + 0.15), uCycle);
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uBlock: 14, uExplode: 0, uBuild: 2, uCycle: 0 }),
  init: () => ({ block: sp(14), explode: sp(0), build: 2, cycle: 0 }),
  update(dt, st, B, M) {
    const base = M.set.pxBlock;
    const crouch = M.preview ? Math.max(0, Math.sin(M.time * 0.8)) : B.crouch;
    spring(st.block, base * (1 - 0.55 * crouch), dt, 50, 7);
    spring(st.explode, 0, dt, 26, 5);
    if (M.preview && Math.sin(M.time * 1.3) > 0.993) { st.explode.v += 4; st.block.v += 90; }
    if (st.finaleT != null) { st.build = Math.min(1.05, st.finaleT / 2.6); st.cycle = Math.min(1, st.finaleT * 2, (M.finaleTime - st.finaleT) * 2); }
    else { st.build = 2; st.cycle = 0; }
    if (st.finaleT != null) {
      const row = Math.floor(st.finaleT * 10);
      if (row !== st.blip && st.finaleT < 2.7) { st.blip = row; M.sfx('tone', 300 + row * 40, 0.05, 'square', 0.05); }
    }
    M.meter(dt * B.motion * 0.5);
  },
  on: {
    jump(st, M) { st.explode.v += 6; st.block.v += 260; M.sfx('laser'); M.score(100, 'GIANT PIXELS!'); M.meter(0.12); chip(M, [523, 659, 784]); },
    crouch(st, M) { M.score(100, 'tiny pixels!'); M.meter(0.08); chip(M, [1046, 1318]); },
    spin(st, M) { st.explode.v += 9; M.sfx('laser'); M.score(150, 'GLITCH!'); M.meter(0.15); },
    punch(st, M) { st.explode.v += 3; M.score(50, 'BLIP!'); M.meter(0.05); chip(M, [880]); },
  },
  finale(st, M) { st.build = 0; M.sfx('powerup'); },
  values: (st, B, M) => ({ uBlock: Math.max(3, st.block.x) * M.rect.k, uExplode: Math.max(0, st.explode.x), uBuild: st.build, uCycle: st.cycle }),
};
function chip(M, notes) { notes.forEach((f, i) => setTimeout(() => M.sfx('tone', f, 0.07, 'square', 0.06), i * 70)); }

export const EFFECT_STATIONS = [funhouse, clones, smear, trails, light, kaleido, pixel];
export { mirrorFrame };
