// The Move Lab stations. Each one tests ONE mechanic and always ends in a stamp.
//
//   { id, n, icon, title, color, calm, goal, time, demo, prompt,
//     gestures: { jump(st, L, data) {...} },   // gesture handlers while the station runs
//     start(st, L), update(dt, st, L), draw(g, st, L),
//     signal(st, L) -> { v, min, max, lines: [{ v, label, color }], name },  // parent graph
//     sim(st, L) }                              // debug key K: simulate this station's move
// L (the lab) gives: ctx, hit(st, opts), react(x, y, text), log(name, data), unit(), center().

const FREEZE_MOTION = 0.025;
const WAVE_MOTION = 0.2;
const pick = (a) => a[(Math.random() * a.length) | 0];

function heightSignal(L) {
  const { gestures } = L.ctx;
  return {
    name: 'head height (face sizes)', v: gestures.height, min: -5, max: 3,
    lines: [
      { v: gestures.heightConfig.jumpUp, label: 'jump', color: '#7dff6a' },
      { v: -gestures.heightConfig.standUp, label: 'stand', color: '#ffcc33' },
      { v: -gestures.heightConfig.crouchDown, label: 'crouch', color: '#5ee0ff' },
    ],
  };
}

// A big "how high am I" meter on the right: every jump / crouch visibly moves it.
function drawHeightMeter(g, L) {
  const { ctx } = L;
  const u = L.unit();
  const h = ctx.gestures.height;
  const x = ctx.W - u * 0.1, top = ctx.H * 0.28, bot = ctx.H * 0.88;
  const toY = (v) => bot - ((v + 5) / 8) * (bot - top);
  g.fillStyle = 'rgba(27,17,64,.55)';
  g.beginPath(); g.roundRect(x - u * 0.045, top - 10, u * 0.09, bot - top + 20, u * 0.045); g.fill();
  const jy = toY(ctx.gestures.heightConfig.jumpUp);
  g.fillStyle = '#7dff6a'; g.fillRect(x - u * 0.06, jy - 3, u * 0.12, 6);
  g.font = `${u * 0.05}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('⭐', x, top - u * 0.04);
  const y = toY(Math.max(-5, Math.min(3, h)));
  g.fillStyle = h > ctx.gestures.heightConfig.jumpUp ? '#7dff6a' : ctx.gestures.crouching ? '#5ee0ff' : '#ffcc33';
  g.beginPath(); g.arc(x, y, u * 0.04, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
}

export const STATIONS = [
  {
    id: 'jump', n: 1, icon: '🦘', title: 'Jump', color: '#7dff6a', goal: 5, time: 30, demo: 'jump',
    prompt: 'Jump 5 times! Like me! Boing!',
    gestures: {
      jump(st, L) { const h = L.ctx.head(); L.hit(st, { x: h.x, y: h.y, text: 'BOING!', sound: 'boing' }); },
    },
    draw(g, st, L) { drawHeightMeter(g, L); },
    signal: (st, L) => heightSignal(L),
  },
  {
    id: 'squat', n: 2, icon: '🐸', title: 'Squat', color: '#5bc85b', goal: 3, time: 30, demo: 'squat',
    prompt: 'Crouch down like a frog... then stand up! 3 times!',
    gestures: {
      crouch(st, L) { const h = L.ctx.head(); L.hit(st, { x: h.x, y: h.y, text: 'RIBBIT!', sound: 'squish' }); },
      stand(st, L) {
        const h = L.ctx.head();
        L.react(h.x, h.y, 'UP!', 'boing');
        if (st.count < st.goal) L.ctx.say('Now down again!', { interrupt: false });
      },
    },
    draw(g, st, L) {
      drawHeightMeter(g, L);
      if (L.ctx.gestures.crouching) {
        const h = L.ctx.head();
        const u = L.unit();
        g.font = `${u * 0.16}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🐸', h.x, h.y - u * 0.05 + Math.sin(st.t * 12) * u * 0.01);
      }
    },
    signal: (st, L) => heightSignal(L),
  },
  {
    id: 'spin', n: 3, icon: '🌀', title: 'Spin', color: '#b48cff', goal: 3, time: 30, demo: 'spin',
    prompt: 'Spin all the way around! 3 times!',
    gestures: {
      spin(st, L) { const c = L.center(); L.hit(st, { x: c.x, y: c.y, text: 'WHEEE!', sound: 'whoosh' }); },
      peekaboo(st, L) { const c = L.center(); L.react(c.x, c.y, 'Peekaboo!', 'giggle'); L.ctx.say('Spin all the way around!', { interrupt: false }); },
    },
    draw(g, st, L) {
      if (L.ctx.gestures.state === 'present') return;
      // swirl builds up while the face is gone
      const c = L.center(), u = L.unit();
      const k = Math.min(1, L.ctx.gestures.lostFor / 1.2);
      g.save(); g.translate(c.x, c.y); g.rotate(st.t * 6);
      for (let i = 0; i < 8; i++) {
        g.rotate(Math.PI / 4);
        g.fillStyle = `hsla(${i * 45},90%,65%,${0.25 + k * 0.4})`;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, u * (0.2 + k * 0.4), 0, 0.35); g.fill();
      }
      g.restore();
    },
    signal: (st, L) => ({
      name: 'motion.total (shaded = face hidden)', v: L.ctx.motion.total, min: 0, max: 0.3, hidden: L.ctx.gestures.state !== 'present',
      lines: [{ v: L.ctx.gestures.config.spinMotion, label: 'spin', color: '#b48cff' }],
    }),
  },
  {
    id: 'peekaboo', n: 4, icon: '🙈', title: 'Peekaboo', color: '#ffcc33', goal: 3, time: 30, demo: 'peekaboo',
    prompt: 'Hide your face with your hands... then BOO!',
    gestures: {
      hide(st, L) { L.ctx.sfx.squeak(0.7); L.log('hiding'); },
      peekaboo(st, L) { const c = L.center(); L.hit(st, { x: c.x, y: c.y, text: 'BOO!', sound: 'giggle', big: true }); },
      spin(st, L) { const c = L.center(); L.react(c.x, c.y, 'Wheee!', 'whoosh'); L.ctx.say('Now hide your face and stay still!', { interrupt: false }); },
    },
    draw(g, st, L) {
      if (L.ctx.gestures.state !== 'hidden') return;
      const u = L.unit(), c = L.center();
      g.fillStyle = 'rgba(27,17,64,.45)'; g.fillRect(0, 0, L.ctx.W, L.ctx.H);
      g.font = `bold ${u * 0.09}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('Where did you go?', c.x, c.y + Math.sin(st.t * 4) * u * 0.02);
    },
    signal: (st, L) => ({
      name: 'motion.total (shaded = face hidden)', v: L.ctx.motion.total, min: 0, max: 0.3, hidden: L.ctx.gestures.state !== 'present',
      lines: [{ v: L.ctx.gestures.config.spinMotion, label: 'spin above', color: '#b48cff' }],
    }),
  },
  {
    id: 'freeze', n: 5, icon: '🧊', title: 'Freeze', color: '#5ee0ff', goal: 3, time: 50, demo: 'freeze',
    prompt: 'Dance dance dance! When I say freeze, be a statue!',
    start(st) { st.sub = { phase: 'dance', t: 0, len: 4, still: 0, beat: 0, wobbleCool: 0 }; },
    gestures: {
      still(st, L) { if (st.sub.phase === 'freeze') freezeHit(st, L); },
    },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L;
      s.t += dt;
      if (st.phase === 'demo') return;
      if (s.phase === 'dance') {
        s.beat -= dt;
        if (s.beat <= 0) { s.beat = 0.3; ctx.sfx.tone(pick([262, 330, 392, 523]), 0.12, 'square'); }
        if (ctx.motion.total > 0.03 && Math.random() < ctx.motion.total * 3) {
          const hs = ctx.motion.hotspots(2, 0.15);
          for (const h of hs) { const p = ctx.view.toScreen(h.x, h.y); ctx.fx.burst(p.x, p.y, { count: 4, speed: 200, size: 6 }); }
          st.score += 1;
        }
        if (s.t >= s.len) {
          s.phase = 'freeze'; s.t = 0; s.still = 0;
          ctx.say('FREEZE!'); ctx.sfx.whoosh(); L.log('freeze!');
        }
      } else if (s.phase === 'freeze') {
        if (ctx.motion.total < FREEZE_MOTION) s.still += dt; else s.still = Math.max(0, s.still - dt * 0.5);
        s.wobbleCool -= dt;
        if (ctx.motion.total > FREEZE_MOTION * 3 && s.wobbleCool <= 0 && s.t > 0.6) {
          s.wobbleCool = 2; ctx.sfx.giggle(); const c = L.center();
          ctx.fx.text(c.x, c.y + L.unit() * 0.2, pick(['Wobbly!', 'Wiggly statue!', 'Hee hee!']), { size: L.unit() * 0.08, color: '#5ee0ff' });
        }
        if (s.still >= 1.2) freezeHit(st, L);
        else if (s.t > 5) { s.phase = 'dance'; s.t = 0; s.len = 3 + Math.random() * 2; ctx.say('Wobbly statue! Dance again!'); }
      } else if (s.phase === 'pause' && s.t > 1.5) {
        s.phase = 'dance'; s.t = 0; s.len = 3 + Math.random() * 2; ctx.say('Dance!', { interrupt: false });
      }
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit();
      if (s.phase === 'dance' && st.phase !== 'demo') {
        // disco lights
        for (let i = 0; i < 5; i++) {
          g.fillStyle = `hsla(${(i * 72 + st.t * 200) % 360},90%,60%,.18)`;
          g.beginPath(); g.arc(ctx.W * (0.1 + i * 0.2), ctx.H * 0.15 + Math.sin(st.t * 3 + i) * u * 0.05, u * 0.25, 0, Math.PI * 2); g.fill();
        }
      } else if (s.phase === 'freeze') {
        const k = Math.min(1, s.still / 1.2);
        g.strokeStyle = `rgba(150,230,255,${0.5 + k * 0.5})`; g.lineWidth = u * (0.02 + k * 0.04);
        g.strokeRect(0, 0, ctx.W, ctx.H);
        g.fillStyle = `rgba(150,230,255,${k * 0.25})`; g.fillRect(0, 0, ctx.W, ctx.H);
        g.font = `${u * 0.12}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🧊', ctx.W / 2, ctx.H * 0.5 + Math.sin(st.t * 30) * (1 - k) * u * 0.01);
      }
    },
    sim(st, L) { if (st.sub.phase === 'freeze') freezeHit(st, L); },
    signal: (st, L) => ({
      name: `motion.total (${st.sub?.phase || ''})`, v: L.ctx.motion.total, min: 0, max: 0.2,
      lines: [{ v: FREEZE_MOTION, label: 'statue', color: '#5ee0ff' }, { v: L.ctx.gestures.config.stillMotion, label: 'still', color: '#fff' }],
    }),
  },
  {
    id: 'wave', n: 6, icon: '👋', title: 'Wave', color: '#ff5ea8', goal: 6, time: 35, demo: 'wave',
    prompt: 'Wave your hands to pop the bubbles! Here... and here!',
    start(st, L) { st.sub = { bubble: null, zoneIdx: -1, sparkT: 0 }; nextBubble(st, L); },
    update(dt, st, L) {
      const { ctx } = L, s = st.sub;
      // sparkles wherever the kid moves: every wiggle gets a reaction
      s.sparkT -= dt;
      if (s.sparkT <= 0) {
        s.sparkT = 0.12;
        for (const h of ctx.motion.hotspots(3, 0.18)) { const p = ctx.view.toScreen(h.x, h.y); ctx.fx.burst(p.x, p.y, { count: 3, speed: 120, size: 5, gravity: 0, life: 0.4 }); }
      }
      const b = s.bubble;
      if (!b) return;
      b.age += dt;
      const n = ctx.view.toNorm(b.x * ctx.W, b.y * ctx.H);
      b.m = ctx.motion.at(n.x, n.y, 0.07);
      if (b.m > WAVE_MOTION) b.charge += dt; else b.charge = Math.max(0, b.charge - dt * 0.5);
      if (b.charge >= 0.3) popBubble(st, L);
    },
    draw(g, st, L) {
      const b = st.sub.bubble;
      if (!b) return;
      const { ctx } = L, u = L.unit();
      const x = b.x * ctx.W, y = b.y * ctx.H;
      const r = u * 0.11 * Math.min(1, b.age * 3) * (1 + b.charge * 0.8) + Math.sin(st.t * 18) * b.charge * u * 0.02;
      g.fillStyle = `hsla(${b.hue},90%,70%,.35)`; g.strokeStyle = '#fff'; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2); g.fill();
      g.font = `${r * 0.8}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('👋', x, y + Math.sin(st.t * 8) * r * 0.08);
    },
    sim(st, L) { if (st.sub.bubble) popBubble(st, L); },
    signal: (st, L) => ({
      name: 'motion.at(bubble)', v: st.sub?.bubble?.m || 0, min: 0, max: 1,
      lines: [{ v: WAVE_MOTION, label: 'pop', color: '#ff5ea8' }],
    }),
  },
  {
    id: 'face', n: 7, icon: '😮', title: 'Silly face', color: '#ff8a3d', calm: true, goal: 4, time: 40, demo: 'face',
    prompt: 'Silly faces! Copy me!',
    start(st, L) { st.sub = { i: 0, hold: 0, wait: 1.5, said: false, v: 0, sim: 0 }; },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L;
      const task = FACE_TASKS[s.i % FACE_TASKS.length];
      st.demoOpts = { task: task.k };
      const f = ctx.face;
      s.sim = Math.max(0, s.sim - dt);
      s.v = s.sim > 0 ? 1 : f.found ? task.v(f) : 0;
      if (st.phase === 'demo') return;
      if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) ctx.say(task.say); return; }
      if (s.v > task.th) s.hold += dt; else s.hold = 0;
      if (s.hold >= 0.12) {
        const c = f.found ? ctx.view.toScreen(f.center.x, f.center.y) : L.center();
        L.hit(st, { x: c.x, y: c.y, text: task.yay, sound: 'pop', emoji: task.emoji });
        s.i++; s.hold = 0; s.wait = 1.4;
      }
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit();
      const task = FACE_TASKS[s.i % FACE_TASKS.length];
      // the silly-meter: a gauge that fills with the current face signal
      const x = ctx.W - u * 0.18, y = ctx.H * 0.55, R = u * 0.11;
      g.fillStyle = 'rgba(27,17,64,.6)'; g.beginPath(); g.arc(x, y, R * 1.25, 0, Math.PI * 2); g.fill();
      const k = Math.min(1, s.v / task.th);
      g.strokeStyle = k >= 1 ? '#7dff6a' : '#ff8a3d'; g.lineWidth = R * 0.25; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.font = `${R * (1 + k * 0.4)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(task.emoji, x, y);
      if (!ctx.face.found && !L.fake && s.sim <= 0) {
        g.font = `bold ${u * 0.06}px sans-serif`; g.fillStyle = '#fff';
        g.fillText('👀 Look at me!', ctx.W / 2, ctx.H * 0.5);
      }
    },
    sim(st) { st.sub.sim = 0.3; },
    signal: (st) => {
      const task = FACE_TASKS[(st.sub?.i || 0) % FACE_TASKS.length];
      return { name: task.label, v: st.sub?.v || 0, min: 0, max: task.k === 'tilt' ? 0.8 : 1, lines: [{ v: task.th, label: task.k, color: '#ff8a3d' }] };
    },
  },
  {
    id: 'toy', n: 8, icon: '🔴', title: 'Magic toy', color: '#ff3b3b', calm: true, goal: 3, time: 50, demo: 'toy',
    colors: ['red', 'blue', 'yellow'],
    prompt: 'Find something red! Show me!',
    start(st) { st.sub = { i: 0, hold: 0, wait: 0, sim: 0, blob: null }; },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L;
      const c = TOYS[s.i % TOYS.length];
      st.demoOpts = { color: c.css };
      s.sim = Math.max(0, s.sim - dt);
      const b = ctx.color.track(c.name);
      s.blob = s.sim > 0 ? { found: true, x: 0.5, y: 0.5, size: 0.05 } : b;
      if (st.phase === 'demo') return;
      if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) ctx.say(c.say); return; }
      if (s.blob.found && s.blob.size >= TOY_SIZE) s.hold += dt; else s.hold = Math.max(0, s.hold - dt);
      if (s.blob.found && Math.random() < 0.3) { const p = ctx.view.toScreen(s.blob.x, s.blob.y); ctx.fx.burst(p.x, p.y, { color: c.css, count: 2, speed: 150, size: 6, gravity: 0, life: 0.5 }); }
      if (s.hold >= 0.4) {
        const p = ctx.view.toScreen(s.blob.x, s.blob.y);
        L.hit(st, { x: p.x, y: p.y, text: c.yay, sound: 'ding', color: c.css });
        s.i++; s.hold = 0; s.wait = 1.6;
      }
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit();
      const c = TOYS[s.i % TOYS.length];
      // colour-tinted scanner frame
      g.strokeStyle = c.css; g.globalAlpha = 0.5 + 0.3 * Math.sin(st.t * 4); g.lineWidth = u * 0.025;
      g.strokeRect(u * 0.02, u * 0.02, ctx.W - u * 0.04, ctx.H - u * 0.04); g.globalAlpha = 1;
      if (s.blob?.found) {
        const p = ctx.view.toScreen(s.blob.x, s.blob.y);
        const R = u * (0.08 + Math.min(0.15, s.blob.size * 2));
        g.strokeStyle = '#fff'; g.lineWidth = 5;
        g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = c.css; g.lineWidth = 10;
        g.beginPath(); g.arc(p.x, p.y, R, -Math.PI / 2, -Math.PI / 2 + Math.min(1, s.hold / 0.4) * Math.PI * 2); g.stroke();
      }
    },
    sim(st) { st.sub.sim = 0.6; },
    signal: (st) => ({ name: `${TOYS[(st.sub?.i || 0) % 3].name} blob size`, v: st.sub?.blob?.found ? st.sub.blob.size : 0, min: 0, max: 0.05,
      lines: [{ v: TOY_SIZE, label: 'enough', color: '#ff3b3b' }] }),
  },
  {
    id: 'closer', n: 9, icon: '👣', title: 'Come closer', color: '#ffd84d', goal: 4, time: 40, demo: 'closer',
    prompt: 'Stand back where I can see you... then step closer!',
    start(st) { st.sub = { base: 0, learnT: 0, rel: 1, hold: 0, want: 'closer', simRel: null, wait: 0 }; },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L;
      const f = ctx.face;
      let size = 0;
      if (f.found && f.leftEye && f.rightEye) {
        const aspect = ctx.camera.width / ctx.camera.height;
        size = Math.hypot((f.rightEye.x - f.leftEye.x) * aspect, f.rightEye.y - f.leftEye.y);
      }
      if (s.simRel != null) { s.base = s.base || 0.06; size = s.base * s.simRel; }
      if (!size) return;
      if (!s.base) { s.learnT += dt; s.acc = (s.acc || 0) + size * dt; if (s.learnT >= 0.8) { s.base = s.acc / s.learnT; L.log('base face size', { size: s.base }); } return; }
      s.rel = size / s.base;
      if (st.phase === 'demo') return;
      if (s.wait > 0) { s.wait -= dt; return; }
      const ok = s.want === 'closer' ? s.rel >= CLOSER : s.rel <= BACK;
      s.hold = ok ? s.hold + dt : 0;
      if (s.hold >= 0.25) {
        const c = L.center();
        L.hit(st, { x: c.x, y: c.y, text: s.want === 'closer' ? 'HELLO!' : 'BYE BYE!', sound: s.want === 'closer' ? 'boing' : 'whoosh' });
        s.want = s.want === 'closer' ? 'back' : 'closer'; s.hold = 0; s.wait = 0.8;
        if (st.count < st.goal) ctx.say(s.want === 'closer' ? 'Now step closer!' : 'Now step back!');
      }
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit();
      // zoom-o-meter: a magnifying glass that grows as you come closer
      const x = ctx.W - u * 0.2, y = ctx.H * 0.55;
      const k = Math.max(0.6, Math.min(1.8, s.rel || 1));
      const R = u * 0.08 * k;
      g.strokeStyle = '#ffd84d'; g.lineWidth = u * 0.025;
      g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x + R * 0.7, y + R * 0.7); g.lineTo(x + R * 1.5, y + R * 1.5); g.stroke();
      g.font = `${u * 0.08}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.want === 'closer' ? '⬆️' : '⬇️', x, y - R - u * 0.08);
      g.fillText('👣', x, y);
    },
    sim(st) { const s = st.sub; s.simRel = s.want === 'closer' ? 1.6 : 1.0; if (!s.base) s.base = 0.06; },
    signal: (st) => ({ name: 'face size ÷ starting size', v: st.sub?.rel || 0, min: 0.5, max: 2,
      lines: [{ v: CLOSER, label: 'closer', color: '#ffd84d' }, { v: BACK, label: 'back', color: '#5ee0ff' }] }),
  },
];

const CLOSER = 1.35, BACK = 1.1;
const TOY_SIZE = 0.006;
const TOYS = [
  { name: 'red', css: '#ff3b3b', say: 'Find something red! Show me!', yay: 'RED!' },
  { name: 'blue', css: '#3b7bff', say: 'Now something blue!', yay: 'BLUE!' },
  { name: 'yellow', css: '#ffd400', say: 'Now something yellow!', yay: 'YELLOW!' },
];
const FACE_TASKS = [
  { k: 'mouth', emoji: '😮', label: 'mouthOpen', th: 0.5, v: (f) => f.mouthOpen, say: 'Open your mouth big! Ahhh!', yay: 'AHHH!' },
  { k: 'smile', emoji: '😁', label: 'smile', th: 0.5, v: (f) => f.smile, say: 'Big smile!', yay: 'CHEESE!' },
  { k: 'blink', emoji: '😑', label: 'blink (both eyes)', th: 0.5, v: (f) => Math.min(f.blinkLeft, f.blinkRight), say: 'Blink your eyes!', yay: 'BLINK!' },
  { k: 'tilt', emoji: '🙃', label: '|roll| (radians)', th: 0.3, v: (f) => Math.abs(f.roll), say: 'Tilt your head!', yay: 'TILT!' },
];

function freezeHit(st, L) {
  const s = st.sub;
  const c = L.center();
  L.hit(st, { x: c.x, y: c.y, text: 'STATUE!', sound: 'ding', color: '#5ee0ff' });
  s.phase = 'pause'; s.t = 0;
}

const ZONES = [[0.2, 0.42], [0.8, 0.42], [0.25, 0.72], [0.75, 0.72], [0.5, 0.38], [0.15, 0.6], [0.85, 0.6]];
function nextBubble(st, L) {
  const s = st.sub;
  let i;
  do { i = (Math.random() * ZONES.length) | 0; } while (i === s.zoneIdx);
  s.zoneIdx = i;
  s.bubble = { x: ZONES[i][0], y: ZONES[i][1], age: 0, charge: 0, m: 0, hue: Math.random() * 360 };
  L.ctx.sfx.squeak(1.2);
}
function popBubble(st, L) {
  const b = st.sub.bubble, { ctx } = L;
  L.hit(st, { x: b.x * ctx.W, y: b.y * ctx.H, text: 'POP!', sound: 'pop', color: `hsl(${b.hue},90%,70%)` });
  st.sub.bubble = null;
  if (st.count < st.goal) setTimeout(() => { if (L.S.station === st && st.phase !== 'done' && !st.sub.bubble) nextBubble(st, L); }, 500);
}

// Which detector event a station's labelled count refers to (scripts/replay.js replays these).
export const REPLAY_EVENT = { jump: 'jump', squat: 'crouch' };
