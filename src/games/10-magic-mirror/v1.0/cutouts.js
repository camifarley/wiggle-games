// Stations 8-12: they cut him out of the room (ctx.segment) and put him somewhere silly, turn him to
// stone, make him see-through or jelly. Same station shape as effects.js. Cutout shaders output
// premultiplied colour + alpha, so the 2D backdrop (drawBack) shows around him.

import { clamp, spring, sp, emoji, hsl } from './util.js';
import { WORLDS, drawWorld, drawTown, HOUSE_COUNT, houseX, drawDessert, shadow } from './backdrops.js';

// ---------------------------------------------------------------- 8 Teleporter
const teleport = {
  id: 'teleport', title: 'Teleporter', word: 'Zap', icon: '🌀', color: '#5ee0ff', usesMask: true, cutout: true,
  intro: 'Jump to teleport!', finaleLine: 'World tour!', finaleTime: 4.5, sound: 'sonic',
  shader: `
uniform float uZap, uGlow;
void main() {
  vec2 px = screenPx();
  vec2 n = toNorm(px);
  float line = floor(px.y / 3.0);
  vec2 p = n + vec2((hash(vec2(line, floor(uTime * 30.0))) - 0.5) * uZap * 0.08, 0.0);
  float m = mask(p);
  float keep = step(uZap * 1.1, hash(vec2(line, floor(p.x * 90.0))) + 0.001);
  m *= mix(1.0, keep, step(0.01, uZap));
  float ring = clamp((rawMask(p + vec2(0.007, 0.0)) + rawMask(p - vec2(0.007, 0.0)) + rawMask(p + vec2(0.0, 0.009)) + rawMask(p - vec2(0.0, 0.009))) * 0.25 - m, 0.0, 1.0);
  vec3 glow = vec3(0.45, 1.0, 1.0);
  vec3 c = mix(cam(p), glow, uZap * 0.65);
  float a = clamp(m + ring * (uGlow + uZap * 2.0) * 2.0, 0.0, 1.0);
  c = mix(glow, c, m / max(a, 0.001));
  gl_FragColor = vec4(c * a, a);
}`,
  uniforms: () => ({ uZap: 0, uGlow: 0.3 }),
  init: () => ({ world: 0, zap: 0, phase: null, pt: 0, queue: 0, flash: 0 }),
  hop(st, M) {
    if (st.phase) { st.queue = Math.min(st.queue + 1, 6); return; }
    st.phase = 'out'; st.pt = 0;
    M.sfx('sonic');
  },
  update(dt, st, B, M) {
    if (M.preview && !st.phase && Math.floor(M.time / 3) !== st.pAuto) { st.pAuto = Math.floor(M.time / 3); teleport.hop(st, M); }
    const zt = M.set.zapTime;
    if (st.phase) {
      st.pt += dt;
      if (st.phase === 'out') {
        st.zap = clamp(st.pt / zt);
        if (st.pt >= zt) {
          st.phase = 'in'; st.pt = 0;
          st.world = (st.world + 1) % WORLDS.length;
          st.flash = 1;
          M.sfx('laser');
          M.score(150, WORLDS[st.world].name);
          M.say(WORLDS[st.world].name, { interrupt: false });
          M.meter(0.2);
        }
      } else {
        st.zap = 1 - clamp(st.pt / zt);
        if (st.pt >= zt) { st.phase = null; st.zap = 0; if (st.queue > 0) { st.queue--; teleport.hop(st, M); } }
      }
    }
    st.flash = Math.max(0, st.flash - dt * 3);
    M.meter(dt * B.motion * 0.3);
  },
  on: {
    jump(st, M) { teleport.hop(st, M); },
    spin(st, M) { teleport.hop(st, M); },
    punch(st, M) { M.sfx('laser'); M.score(50, 'Zap!'); },
  },
  finale(st, M) { st.queue = 5; teleport.hop(st, M); M.fx.confetti(80); },
  values: (st) => ({ uZap: st.zap, uGlow: 0.35 }),
  drawBack(g, st, B, M) {
    const c = M.rect.toScreen(B.chest.x, B.chest.y);
    const f = M.rect.toScreen(B.feet.x, B.feet.y);
    drawWorld(g, M.rect, st.world, M.time, c, B.size * M.rect.dh, false);
    shadow(g, f.x, f.y, B.size * M.rect.dh * 1.2, B.size * M.rect.dh * 0.25, 0.22);
  },
  drawFront(g, st, B, M) {
    const r = M.rect;
    const c = r.toScreen(B.chest.x, B.chest.y);
    drawWorld(g, r, st.world, M.time, c, B.size * r.dh, true);
    if (st.zap > 0) { // the teleporter beam
      const w = B.size * r.dh * 2.6;
      const gr = g.createLinearGradient(c.x - w / 2, 0, c.x + w / 2, 0);
      gr.addColorStop(0, 'rgba(120,255,255,0)'); gr.addColorStop(0.5, `rgba(200,255,255,${0.55 * st.zap})`); gr.addColorStop(1, 'rgba(120,255,255,0)');
      g.fillStyle = gr; g.fillRect(c.x - w / 2, r.y, w, r.h);
    }
    if (st.flash > 0) { g.fillStyle = `rgba(255,255,255,${st.flash * 0.8})`; g.fillRect(r.x, r.y, r.w, r.h); }
    if (!M.preview) {
      const u = r.unit;
      emoji(g, WORLDS[st.world].icon, r.x + r.w - u * 0.1, r.y + r.h - u * 0.12, u * 0.1);
    }
  },
};

// ---------------------------------------------------------------- 9 Giant / Tiny
const giant = {
  id: 'giant', title: 'Giant / Tiny', word: 'Giant', icon: '🦖', color: '#ff8a2b', usesMask: true, cutout: true,
  intro: 'Squat to get tiny! Arms up to get GIANT!', finaleLine: 'Monster stomp!', finaleTime: 4.5, sound: 'smash',
  shader: `
uniform float uScale; uniform vec2 uSrc, uDst;
void main() {
  vec2 n = toNorm(screenPx());
  vec2 src = uSrc + (n - uDst) / max(0.05, uScale);
  float m = mask(src);
  gl_FragColor = vec4(cam(src) * m, m);
}`,
  uniforms: () => ({ uScale: 1, uSrc: [0.5, 0.95], uDst: [0.5, 0.95] }),
  init: () => ({ scale: sp(1), until: -9, hops: Array.from({ length: HOUSE_COUNT }, () => ({ y: 0, v: 0, rot: 0, rv: 0 })), mode: 'normal', stompT: 0 }),
  stomp(st, M, big = false) {
    const B = M.body, r = M.rect;
    const f = r.toScreen(B.feet.x, B.feet.y);
    st.hops.forEach((h, i) => {
      const dist = Math.abs(houseX(i) * giant.unit(st, M) + giant.anchorX(st, M) - f.x) / r.unit;
      if (big || dist < 0.6) { h.v -= (big ? 5 : 3.2) * (1 - Math.min(0.8, dist)); h.rv += (Math.random() - 0.5) * (big ? 8 : 4); }
    });
    if (M.preview) return;
    M.fx.shake(big ? 26 : 16);
    M.fx.burst(f.x, f.y, { count: 30, speed: 420, size: 10, color: '#c9a27a' });
    M.sfx(big ? 'boom' : 'smash');
    M.score(big ? 300 : 150, 'STOMP!', f.x, f.y - r.unit * 0.25);
    M.meter(0.14);
  },
  unit: (st, M) => (M.rect.h * 0.2) / Math.max(0.3, st.scale.x),
  // st.scale is RELATIVE: 1 = he fills ~55% of the screen height whatever his distance to the camera;
  // GIANT is capped so his head stays on screen
  base(B, M) {
    const px = Math.max(20, (B.feet.y - B.top) * M.rect.dh);
    return clamp((0.55 * M.rect.h) / px, 0.2, 2.5);
  },
  maxRel(B, M) {
    const px = Math.max(20, (B.feet.y - B.top) * M.rect.dh);
    return Math.max(1.25, (0.86 * M.rect.h) / px / giant.base(B, M));
  },
  anchorX: (st, M) => M.rect.toScreen(M.body.feet.x, 0).x,
  update(dt, st, B, M) {
    const s = M.set;
    const t = M.time;
    let target = 1;
    const big = Math.min(s.giantScale, giant.maxRel(B, M));
    if (M.preview) target = [1, big, 1, s.tinyScale][Math.floor(t / 2.5) % 4];
    else if (st.finaleT != null) target = Math.min(s.giantScale * 1.25, giant.maxRel(B, M) * 1.08);
    else if (B.crouch > 0.5) target = s.tinyScale;
    else if (B.armsUp > 0.55 || t < st.until) target = big;
    spring(st.scale, target, dt, 30, 6.5);
    const mode = st.scale.x > 1.22 ? 'giant' : st.scale.x < 0.7 ? 'tiny' : 'normal';
    if (mode !== st.mode && !M.preview) {
      if (mode === 'giant') { M.sfx('powerup'); M.say("I'm a GIANT!", { interrupt: false }); M.score(100, 'GIANT!'); M.meter(0.1); }
      if (mode === 'tiny') { [1.8, 1.6, 1.4].forEach((p, i) => setTimeout(() => M.sfx('squeak', p), i * 90)); M.say("I'm tiny!", { interrupt: false }); M.score(100, 'tiny!'); M.meter(0.1); }
    }
    st.mode = mode;
    for (const h of st.hops) {
      h.v += 12 * dt; h.y += h.v * dt; h.rot += h.rv * dt;
      if (h.y > 0) { h.y = 0; h.v = h.v > 1 ? -h.v * 0.3 : 0; h.rv *= 0.5; if (Math.abs(h.v) < 0.3) { h.v = 0; } h.rot *= 0.6; if (Math.abs(h.rot) < 0.02) h.rot = 0; }
    }
    if (st.finaleT != null) {
      st.stompT -= dt;
      if (st.stompT <= 0) { st.stompT = 0.55; giant.stomp(st, M, true); }
    }
    if (M.preview && st.mode === 'giant' && Math.sin(t * 3) > 0.98) giant.stomp(st, M);
    M.meter(dt * B.motion * 0.3);
  },
  on: {
    jump(st, M) {
      st.until = M.time + 3;
      if (st.mode === 'giant') giant.stomp(st, M);
      else { M.sfx('boing'); M.score(100, st.mode === 'tiny' ? 'tiny jump!' : 'BIG!'); M.meter(0.08); }
    },
    step(st, M) { if (st.mode === 'giant' && M.time - (st.lastStep || 0) > 0.35) { st.lastStep = M.time; giant.stomp(st, M); } },
    punch(st, M) { if (st.mode === 'giant') giant.stomp(st, M); },
  },
  finale(st, M) { st.stompT = 0; M.fx.confetti(120); },
  values(st, B, M) {
    const ground = M.rect.toNorm(0, M.rect.y + M.rect.h * 0.9).y;
    return { uScale: st.scale.x * giant.base(B, M), uSrc: [B.feet.x, B.feet.y], uDst: [B.feet.x, ground] };
  },
  drawBack(g, st, B, M) {
    const r = M.rect, groundY = r.y + r.h * 0.9;
    drawTown(g, r, M.time, giant.anchorX(st, M), groundY, giant.unit(st, M), st.hops, false);
    const w = B.size * r.dh * st.scale.x * giant.base(B, M);
    shadow(g, giant.anchorX(st, M), groundY, w * 1.3, w * 0.22, 0.25);
  },
  drawFront(g, st, B, M) {
    const r = M.rect;
    drawTown(g, r, M.time, giant.anchorX(st, M), r.y + r.h * 0.9, giant.unit(st, M), st.hops, true);
  },
};

// ---------------------------------------------------------------- 10 Statue
const MATERIALS = [
  { name: 'stone', say: 'You are turning to stone!', color: '#a8a39a' },
  { name: 'gold', say: 'You are turning to GOLD!', color: '#ffcc33' },
  { name: 'ice', say: 'You are turning to ice!', color: '#bfe9ff' },
  { name: 'chocolate', say: 'You are turning to chocolate!', color: '#8a5a2b' },
];
const statue = {
  id: 'statue', title: 'Statue', word: 'Statue', icon: '🗿', color: '#ffcc33', usesMask: true, calm: true,
  intro: 'Freeze like a statue! Then wiggle out!', finaleLine: 'Golden statue! Move super slowly... don\'t crack!', finaleTime: 14, sound: 'smash',
  shader: `
uniform float uStone, uCrack, uMat, uTop, uBottom, uFlash;
vec3 material(vec3 c, vec2 n) {
  float l = luma(c);
  float g = noise(n * vec2(uAspect, 1.0) * 60.0);
  if (uMat < 0.5) return vec3(0.6, 0.58, 0.55) * (0.5 + l * 0.75) * (0.82 + g * 0.36);
  if (uMat < 1.5) {
    vec3 gold = mix(vec3(0.5, 0.32, 0.05), vec3(1.0, 0.86, 0.35), smoothstep(0.08, 0.85, l));
    return gold + pow(max(0.0, sin((n.x * uAspect + n.y) * 7.0 - uTime * 3.0)), 24.0) * 0.7;
  }
  if (uMat < 2.5) return mix(mix(vec3(0.5, 0.78, 1.0), vec3(0.95, 1.0, 1.0), l), c, 0.18) + g * 0.08 + pow(max(0.0, sin((n.x * uAspect - n.y) * 9.0 - uTime * 2.0)), 30.0) * 0.5;
  return mix(vec3(0.22, 0.11, 0.04), vec3(0.62, 0.38, 0.2), l) + pow(max(0.0, sin((n.x * uAspect - n.y) * 9.0 - uTime * 2.0)), 30.0) * 0.4;
}
float cracks(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)); vec2 r = o + hash2(i + o) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
void main() {
  vec2 n = toNorm(screenPx());
  vec3 c = cam(n);
  float m = mask(n);
  float rel = clamp((uBottom - n.y) / max(0.05, uBottom - uTop), 0.0, 1.0);
  float turned = smoothstep(rel - 0.06, rel + 0.06, uStone * 1.12) * m;
  vec3 st = material(c, n);
  float cr = cracks(n * vec2(uAspect, 1.0) * 9.0);
  float grow = step(noise(n * 6.0) * 0.8, uCrack);
  float line = (1.0 - smoothstep(0.0, 0.025 + uCrack * 0.05, cr)) * grow * smoothstep(0.03, 0.3, uCrack);
  st = mix(st, vec3(1.0, 0.96, 0.65) * 1.5, line);
  c = mix(c, st, turned);
  c += uFlash;
  gl_FragColor = vec4(c, 1.0);
}`,
  uniforms: () => ({ uStone: 0, uCrack: 0, uMat: 1, uTop: 0.25, uBottom: 0.95, uFlash: 0 }),
  init: () => ({ stone: 0, crack: 0, mat: 1, said: false, flash: 0, hum: 0, slowPts: 0, slowT: 0, sneakCracks: 0 }),
  burst(st, M, funny = false) {
    const B = M.body, r = M.rect, mat = MATERIALS[st.mat];
    const pts = Math.round((100 + st.stone * 900) / 50) * 50;
    if (!M.preview) {
      for (let i = 0; i < 7; i++) {
        const p = r.toScreen(B.feet.x + (Math.random() - 0.5) * B.size * 1.6 / M.aspect, B.top + (B.feet.y - B.top) * (i / 6));
        M.fx.burst(p.x, p.y, { count: 14, speed: 520, size: 11, color: i % 2 ? mat.color : '#ffffff' });
      }
      M.fx.shake(18);
      M.sfx('smash'); setTimeout(() => M.sfx(funny ? 'giggle' : 'boing'), 150);
      const c = r.toScreen(B.chest.x, B.chest.y);
      M.score(funny ? 100 : pts, funny ? 'Oops! CRACK!' : st.stone > 0.9 ? 'BURST FREE!' : 'CRACK!', c.x, c.y);
      if (!funny) M.meter(0.18 + 0.2 * st.stone);
    }
    st.flash = 0.6;
    st.crack = 0;
    if (!funny) { st.stone = 0; st.mat = (st.mat + 1) % MATERIALS.length; st.said = false; }
    else st.stone = 0.3;
  },
  update(dt, st, B, M) {
    const s = M.set;
    const still = s.stillAt;
    const m = M.preview ? (Math.sin(M.time * 0.5) > -0.2 ? 0 : 0.2) : B.motion;
    st.flash = Math.max(0, st.flash - dt * 2);
    if (st.finaleT != null) {
      // sneaky round: he's a golden statue; slow moves earn sparkles, a fast move cracks it (funny)
      st.mat = 1;
      st.stone = Math.min(1, st.stone + dt / 0.8);
      if (m > still * 3) st.crack += (m - still * 3) * dt * 14 * s.crackSpeed;
      else st.crack = Math.max(0, st.crack - dt * 0.3);
      if (st.crack >= 1) { st.sneakCracks++; statue.burst(st, M, true); }
      if (m > still * 0.6 && m <= still * 3) {
        st.slowT += dt;
        if (st.slowT > 0.5) { st.slowT = 0; const c = M.rect.toScreen(B.chest.x, B.chest.y); M.score(50, '✨ Sooo slow!', c.x + (Math.random() - 0.5) * 120, c.y - 60, { small: true }); M.sfx('collect'); }
      }
      return;
    }
    if (m < still) {
      if (st.stone < 1) M.meter(dt * 0.05); // freezing is progress too (build-up), bursting free is the big chunk
      st.stone = Math.min(1, st.stone + dt / s.turnTime);
      st.crack = Math.max(0, st.crack - dt * 0.2);
      if (st.stone > 0.08 && !st.said && !M.preview) { st.said = true; M.say(MATERIALS[st.mat].say, { interrupt: false }); }
      st.hum -= dt;
      if (st.hum <= 0 && st.stone < 1 && !M.preview) { st.hum = 0.45; M.sfx('tone', 300 + st.stone * 700, 0.12, 'sine', 0.05); }
      if (st.stone >= 1 && !st.full && !M.preview) { st.full = true; M.sfx('collect'); M.score(200, `${MATERIALS[st.mat].name.toUpperCase()} STATUE!`); M.say('Now wiggle out!', { interrupt: false }); }
    } else if (st.stone > 0.2) {
      st.crack += (m - still) * dt * 10 * s.crackSpeed + dt * 0.15;
      if (st.crack >= 1) { st.full = false; statue.burst(st, M); }
    } else {
      st.stone = Math.max(0, st.stone - dt * 0.4);
      st.said = st.stone > 0.02 ? st.said : false;
    }
    if (M.preview && st.stone >= 1 && m > 0) statue.burst(st, M);
  },
  on: {
    still(st, M) { if (st.finaleT == null && st.stone < 0.5) M.say('Shhh... freeze...', { interrupt: false }); },
    jump(st, M) { if (st.stone > 0.2) st.crack += 0.5; },
    punch(st, M) { if (st.stone > 0.2) st.crack += 0.35; },
    spin(st, M) { if (st.stone > 0.2) st.crack += 0.6; },
  },
  finale(st, M) {
    st.mat = 1; st.crack = 0; st.sneakCracks = 0;
    M.music.play('sneaky');
  },
  finaleEnd(st, M) {
    M.music.resume();
    M.fx.confetti(200); M.sfx('powerup');
    M.score(1000, st.sneakCracks ? 'Golden dancer!' : 'SUPER sneaky!');
    M.say(st.sneakCracks ? 'You are a golden dancer!' : 'Super sneaky! You did it!');
    st.stone = 0; st.crack = 0; st.mat = 0; st.said = false; st.full = false;
  },
  values: (st, B) => ({ uStone: st.stone, uCrack: clamp(st.crack), uMat: st.mat, uTop: B.top, uBottom: B.feet.y + 0.02, uFlash: st.flash }),
  drawFront(g, st, B, M) {
    if (M.preview) return;
    const r = M.rect, u = r.unit;
    // a stone-o-meter beside him: fills while he's still
    const x = r.x + r.w - u * 0.12, y0 = r.y + r.h * 0.3, h = r.h * 0.42;
    g.fillStyle = 'rgba(27,17,64,.55)'; g.beginPath(); g.roundRect(x - u * 0.035, y0, u * 0.07, h, u * 0.035); g.fill();
    g.fillStyle = MATERIALS[st.mat].color;
    const fh = h * st.stone;
    g.beginPath(); g.roundRect(x - u * 0.025, y0 + h - fh, u * 0.05, fh, u * 0.025); g.fill();
    emoji(g, st.crack > 0.2 ? '💥' : '🗿', x, y0 - u * 0.06, u * 0.07, { rot: st.crack * Math.sin(M.time * 30) * 0.3 });
    if (st.finaleT != null) {
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${u * 0.07}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#ffcc33';
      g.fillText(`🤫 ${Math.max(0, Math.ceil(M.finaleTime - st.finaleT))}`, r.x + r.w / 2, r.y + r.h * 0.8);
      g.restore();
    }
  },
};

// ---------------------------------------------------------------- 11 Invisible
const invisible = {
  id: 'invisible', title: 'Invisible', word: 'Ghost', icon: '👻', color: '#c8d8ff', usesMask: true,
  intro: 'Cover your eyes to turn invisible!', finaleLine: 'Ghost party!', finaleTime: 6, sound: 'shield',
  shader: `
uniform float uInv, uFlash; uniform vec4 uG[6];
void main() {
  vec2 px = screenPx(); vec2 n = toNorm(px);
  float m = mask(n);
  vec2 rip = vec2(sin(n.y * 40.0 + uTime * 5.0), cos(n.x * 34.0 + uTime * 4.0)) * 0.006;
  vec3 col = mix(cam(n), plate(n + rip * m), m * uInv);
  float dx = 4.0 / uCover.z, dy = 4.0 / uCover.w;
  float e = abs(mask(n + vec2(dx, 0.0)) - mask(n - vec2(dx, 0.0))) + abs(mask(n + vec2(0.0, dy)) - mask(n - vec2(0.0, dy)));
  vec3 sh = hsv(fract(n.y * 2.0 + uTime * 0.8), 0.55, 1.0);
  col += sh * clamp(e, 0.0, 1.0) * uInv * (0.75 + 0.25 * sin(uTime * 9.0 + n.y * 30.0));
  col += step(0.985, hash(floor(px / 6.0) + floor(uTime * 8.0))) * m * uInv * 0.5;
  for (int i = 0; i < 6; i++) {
    vec4 gi = uG[i];
    if (gi.w <= 0.0) continue;
    vec4 h = hist(n - gi.xy, gi.z);
    col = mix(col, mix(col, vec3(0.88, 0.95, 1.0), 0.6), h.a * gi.w);
  }
  gl_FragColor = vec4(col + uFlash, 1.0);
}`,
  uniforms: () => ({ uInv: 0, uFlash: 0, uG: Array.from({ length: 6 }, () => [0, 0, 0, 0]) }),
  init: () => ({ inv: sp(0), target: 0, flash: 0, ghostFade: false, booT: 0 }),
  boo(st, M) {
    const B = M.body;
    st.inv.x = 0; st.inv.v = 0; st.target = 0; st.flash = 0.7; st.ghostFade = false;
    if (M.preview) return;
    const h = M.rect.toScreen(B.chest.x, B.top + 0.03);
    M.fx.burst(h.x, h.y, { count: 60, speed: 640, size: 11, color: '#ffffff' });
    M.fx.shake(14);
    M.sfx('boing'); setTimeout(() => M.sfx('giggle'), 160);
    M.score(200, 'BOO!', h.x, h.y - M.rect.unit * 0.05, { big: true });
    M.meter(0.25);
  },
  update(dt, st, B, M) {
    if (M.preview) st.target = Math.sin(M.time * 0.8) > 0 ? 1 : 0;
    else if (st.ghostFade && B.motion > M.set.stillAt * 2.5) { st.ghostFade = false; if (st.inv.x > 0.5) invisible.boo(st, M); else st.target = 0; }
    spring(st.inv, st.target, dt, 25 * M.set.fadeSpeed, 9);
    st.flash = Math.max(0, st.flash - dt * 2.5);
    M.meter(dt * B.motion * 0.2);
  },
  on: {
    hide(st, M) { st.target = 1; M.sfx('shield'); M.say('Where did you go?', { interrupt: false }); M.score(100, '👻 Invisible!'); M.meter(0.08); },
    peekaboo(st, M) { invisible.boo(st, M); },
    leave(st) { st.target = 1; },
    return(st, M) { invisible.boo(st, M); },
    still(st, M) { if (st.target < 0.5) { st.ghostFade = true; st.target = 0.85; M.sfx('shield'); M.say("Shhh... you're fading away...", { interrupt: false }); } },
  },
  finale(st, M) { M.sfx('shield'); st.target = 0.6; },
  finaleEnd(st) { st.target = 0; },
  values(st, B, M) {
    const g = Array.from({ length: 6 }, (_, i) => {
      if (st.finaleT == null) return [0, 0, 0, 0];
      const t = st.finaleT, a = clamp(Math.min(t * 2, (M.finaleTime - t) * 2)) * 0.9;
      return [Math.sin(t * 0.9 + i * 1.1) * 0.32, Math.cos(t * 1.3 + i * 2) * 0.1 - 0.06, Math.min(M.gl.historyFrames - 1, (i + 1) * 4), a];
    });
    return { uInv: clamp(st.inv.x, 0, 1.1), uFlash: st.flash, uG: g };
  },
  drawFront(g, st, B, M) {
    if (st.finaleT == null || M.preview) return;
    const r = M.rect, u = r.unit;
    for (let i = 0; i < 6; i++) {
      const t = st.finaleT + i;
      emoji(g, '👻', r.x + r.w * (0.5 + Math.sin(t * 0.8 + i) * 0.42), r.y + r.h * (0.3 + Math.cos(t * 1.1 + i * 2) * 0.2), u * 0.09, { rot: Math.sin(t * 3) * 0.3 });
    }
    if (Math.floor(st.finaleT / 0.7) !== st.booBeat) {
      st.booBeat = Math.floor(st.finaleT / 0.7);
      M.fx.text(r.x + r.w * (0.15 + Math.random() * 0.7), r.y + r.h * (0.2 + Math.random() * 0.4), 'BOO!', { size: u * 0.1, color: '#c8d8ff' });
      M.sfx('pop');
    }
  },
};

// ---------------------------------------------------------------- 12 Jelly Me
const jelly = {
  id: 'jelly', title: 'Jelly Me', word: 'Jelly', icon: '🍮', color: '#ff5e7e', usesMask: true, cutout: true,
  intro: "You're made of jelly! Jump and wiggle!", finaleLine: 'Jelly quake!', finaleTime: 4, sound: 'squish',
  shader: `
uniform vec2 uWob, uAnchor; uniform float uSquash, uTop, uWave, uHue, uRainbow;
void main() {
  vec2 n = toNorm(screenPx());
  float hgt = max(0.05, uAnchor.y - uTop);
  float h = clamp((uAnchor.y - n.y) / hgt, 0.0, 1.4);
  float sq = max(0.4, 1.0 + uSquash);
  vec2 src;
  src.y = uAnchor.y - (uAnchor.y - n.y) / sq;
  src.x = uAnchor.x + (n.x - uAnchor.x) * sqrt(sq);
  src -= uWob * h * h;
  src.x -= sin(h * 5.0 - uTime * 7.0) * uWave * 0.03 * h;
  float m = mask(src);
  vec3 c = cam(src);
  vec3 jel = hsv(fract(uHue + uRainbow * (h * 0.6 + uTime * 0.2)), 0.75, 1.0);
  c = mix(c, c * 0.45 + jel * 0.75, 0.5);
  float ex = mask(src + vec2(0.012, 0.0)) - mask(src - vec2(0.012, 0.0));
  float ey = mask(src + vec2(0.0, 0.016)) - mask(src - vec2(0.0, 0.016));
  c += clamp(ex * 0.7 + ey * 0.9, 0.0, 1.0) * 0.55;
  vec2 bp = src * vec2(uAspect, 1.0) * 14.0 + vec2(0.0, uTime * 1.5);
  c += smoothstep(0.14, 0.08, length(fract(bp) - 0.5)) * step(0.8, hash(floor(bp))) * 0.35;
  float a = m * 0.93;
  gl_FragColor = vec4(c * a, a);
}`,
  uniforms: () => ({ uWob: [0, 0], uAnchor: [0.5, 0.95], uSquash: 0, uTop: 0.3, uWave: 0, uHue: 0.9, uRainbow: 0 }),
  init: () => ({ wx: sp(), wy: sp(), squash: sp(), wave: 0, hue: 0.92, rainbow: 0, quakeT: 0, squishT: 0, sprinkles: [] }),
  update(dt, st, B, M) {
    const s = M.set;
    const jig = s.wobbly;
    let vx = B.vel.x, vy = B.vel.y;
    if (M.preview) { vx = Math.sin(M.time * 2.3) * 0.5; vy = 0; if (Math.sin(M.time * 1.2) > 0.99) st.squash.v -= 3; }
    spring(st.wx, -vx * 0.12 * jig, dt, 55 * s.springy, 3.2);
    spring(st.wy, -vy * 0.06 * jig, dt, 70 * s.springy, 3.5);
    spring(st.squash, -B.crouch * 0.25 + clamp(B.height, -2, 4) * 0.015, dt, 80 * s.springy, 4);
    st.wave = Math.min(1.5, st.wave * Math.exp(-dt * 1.5) + Math.abs(st.wx.v) * dt * 4);
    const energy = Math.abs(st.wx.v) + Math.abs(st.wy.v) + Math.abs(st.squash.v);
    M.meter(dt * Math.min(1, energy * 0.25) * 0.5 + dt * B.motion * 0.2);
    st.squishT -= dt;
    if (energy > 1.5 && st.squishT <= 0) { st.squishT = 0.3; M.sfx('squish'); }
    st.rainbow = st.finaleT != null ? 1 : Math.max(0, st.rainbow - dt);
    if (st.finaleT != null) {
      st.quakeT -= dt;
      if (st.quakeT <= 0) { st.quakeT = 0.28; st.wx.v += (Math.random() - 0.5) * 6; st.squash.v += (Math.random() - 0.5) * 6; M.sfx(Math.random() < 0.5 ? 'squish' : 'boing'); }
      if (!M.preview) for (let i = 0; i < 3; i++) st.sprinkles.push({ x: Math.random(), y: -0.05, v: 0.3 + Math.random() * 0.4, h: Math.random() * 360, r: Math.random() * 3 });
    }
    for (const p of st.sprinkles) { p.y += p.v * dt; p.r += dt * 3; }
    st.sprinkles = st.sprinkles.filter((p) => p.y < 1.05);
  },
  on: {
    jump(st, M) { st.squash.v -= 4.5 * M.set.wobbly; st.hue = (st.hue + 0.15) % 1; M.sfx('boing'); M.score(100, 'JIGGLE!'); M.meter(0.1); },
    crouch(st, M) { st.squash.v -= 2; M.sfx('squish'); M.score(100, 'SQUISH!'); M.meter(0.08); },
    lean(st, M, d) { st.wx.v += (d?.side === 'left' ? -1 : 1) * 2 * M.set.wobbly; M.score(50, 'Wobble!'); M.meter(0.05); },
    spin(st, M) { st.wx.v += 5; st.rainbow = 1.5; M.sfx('splat'); M.score(150, 'JELLY SPIN!'); M.meter(0.15); },
    punch(st, M, d) { st.wx.v += (d?.hand === 'left' ? -1 : 1) * 1.5; M.sfx('squish'); M.score(50, 'Wibble!'); },
  },
  finale(st, M) { M.fx.confetti(100); M.sfx('splat'); },
  values: (st, B) => ({ uWob: [st.wx.x, st.wy.x], uAnchor: [B.feet.x, B.feet.y], uSquash: st.squash.x, uTop: B.top, uWave: st.wave, uHue: st.hue, uRainbow: st.rainbow }),
  drawBack(g, st, B, M) {
    const r = M.rect;
    drawDessert(g, r, M.time, r.toScreen(B.feet.x, B.feet.y), B.size * r.dh, false);
  },
  drawFront(g, st, B, M) {
    const r = M.rect, u = r.unit;
    for (const p of st.sprinkles) {
      g.save(); g.translate(r.x + p.x * r.w, r.y + p.y * r.h); g.rotate(p.r);
      g.fillStyle = hsl(p.h, 90, 62); g.fillRect(-u * 0.012, -u * 0.004, u * 0.024, u * 0.008); g.restore();
    }
  },
};

export const CUTOUT_STATIONS = [teleport, giant, statue, invisible, jelly];
