// The Move Lab stations. Each one tests ONE mechanic and always ends in a stamp.
//
//   { id, n, icon, title, color, calm, goal, time, demo, prompt,
//     gestures: { jump(st, L, data) {...} },   // gesture handlers while the station runs
//     start(st, L), update(dt, st, L), draw(g, st, L),
//     signal(st, L) -> { v, min, max, lines: [{ v, label, color }], name },  // parent graph
//     sim(st, L),                               // debug key K: simulate this station's move
//     end(st, L) }                              // the station is left (undo anything start() changed)
// L (the lab) gives: ctx, hit(st, opts), react(x, y, text), log(name, data), unit(), center().

import { createToyStation, TOY_CONFIG, TOY_COLORS } from './toy.js';
import { createDistanceStation } from './distance.js';

const FREEZE_MOTION = 0.025;
const WAVE_MOTION = 0.2;
const pick = (a) => a[(Math.random() * a.length) | 0];

function heightSignal(L) {
  const { gestures } = L.ctx;
  return {
    // body = shoulder line via pose tracking (works from across the room); face = eye line (close only)
    name: `${gestures.heightSource === 'body' ? 'shoulder height · BODY tracking' : 'head height · FACE tracking'}${gestures.raw ? '' : ' · ⚠️ not seen'}`,
    v: gestures.height, min: -5, max: 3,
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
      const gs = L.ctx.gestures;
      const k = gs.heightSource === 'body' ? gs.turn : Math.min(1, gs.lostFor / 1.2);
      g.save(); g.translate(c.x, c.y); g.rotate(st.t * 6);
      for (let i = 0; i < 8; i++) {
        g.rotate(Math.PI / 4);
        g.fillStyle = `hsla(${i * 45},90%,65%,${0.25 + k * 0.4})`;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, u * (0.2 + k * 0.4), 0, 0.35); g.fill();
      }
      g.restore();
    },
    signal: (st, L) => L.ctx.gestures.heightSource === 'body'
      // body: a spin = two dips toward 1 (side-on) and back down
      ? { name: `side-on amount · BODY tracking${L.ctx.gestures.raw ? '' : ' · ⚠️ not seen'}`, v: L.ctx.gestures.turn, min: 0, max: 1,
        lines: [{ v: 0.55, label: 'side-on', color: '#b48cff' }, { v: 0.5, label: 'facing again', color: '#7dff6a' }] }
      : { name: 'motion.total (shaded = face hidden)', v: L.ctx.motion.total, min: 0, max: 0.3, hidden: L.ctx.gestures.state !== 'present',
        lines: [{ v: L.ctx.gestures.config.spinMotion, label: 'spin', color: '#b48cff' }] },
  },
  {
    id: 'peekaboo', n: 4, icon: '🙈', title: 'Peekaboo', color: '#ffcc33', goal: 3, time: 30, demo: 'peekaboo',
    prompt: 'Hide your face with your hands... then BOO!',
    // Body peekaboo (both hands up at the head, then dropped: core peekaboo.js) works from across the
    // room, so this station tests it whenever pose is tracked. Face peekaboo is used otherwise.
    start(st, L) { if (L.ctx.gestures._usesPose) L.ctx.gestures.peekabooSource = 'body'; },
    end(st, L) { L.ctx.gestures.peekabooSource = 'face'; },
    gestures: {
      hide(st, L) { L.ctx.sfx.squeak(0.7); L.log('hiding'); },
      peekaboo(st, L) { const c = L.center(); L.hit(st, { x: c.x, y: c.y, text: 'BOO!', sound: 'giggle', big: true }); },
      spin(st, L) { const c = L.center(); L.react(c.x, c.y, 'Wheee!', 'whoosh'); L.ctx.say('Now hide your face and stay still!', { interrupt: false }); },
    },
    draw(g, st, L) {
      if (L.ctx.gestures.state !== 'hidden' && !L.ctx.gestures.covering) return;
      const u = L.unit(), c = L.center();
      g.fillStyle = 'rgba(27,17,64,.45)'; g.fillRect(0, 0, L.ctx.W, L.ctx.H);
      g.font = `bold ${u * 0.09}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('Where did you go?', c.x, c.y + Math.sin(st.t * 4) * u * 0.02);
    },
    signal: (st, L) => L.ctx.gestures.peekabooSource === 'body'
      // body: the farther hand's distance to the head (shoulder widths). Below 'covered' for 0.4 s = hide.
      ? { name: `hands → head · BODY tracking (shaded = covering)${L.ctx.gestures.handsNear == null ? ' · ⚠️ not seen' : ''}`,
        v: Math.min(3, L.ctx.gestures.handsNear ?? 3), min: 0, max: 3, hidden: L.ctx.gestures.covering,
        lines: [{ v: L.ctx.gestures.peekabooConfig.near, label: 'covered', color: '#ffcc33' },
          { v: L.ctx.gestures.peekabooConfig.release, label: 'BOO', color: '#7dff6a' }] }
      : {
      name: 'motion.total (shaded = face hidden)', v: L.ctx.motion.total, min: 0, max: 0.3, hidden: L.ctx.gestures.state !== 'present',
      lines: [{ v: L.ctx.gestures.config.spinMotion, label: 'spin above', color: '#b48cff' }],
    },
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
    // A fresh random order of FACE_TASKS each time. Each face is HELD (~2 s): a ring fills with rising
    // tones, growing sparkles and Coach copying harder; letting go drains it slowly (forgiving).
    start(st) {
      const order = [...FACE_TASKS].sort(() => Math.random() - 0.5);
      st.sub = { order, i: 0, hold: 0, wait: 1.5, v: 0, sim: 0, tried: 0, toneAt: 0, task: order[0] };
    },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L;
      const task = s.task;
      st.demoOpts = { task: task.k, k: s.wait > 0 ? 0 : Math.min(1, s.hold / task.hold) };
      if (st.phase === 'done') return;
      const f = ctx.face;
      s.sim = Math.max(0, s.sim - dt);
      s.v = s.sim > 0 ? task.th + 0.25 : f.found ? task.v(f, f.blend || {}) : 0;
      if (st.phase === 'demo') return;
      if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) ctx.say(task.say); return; }
      const on = s.v >= task.th;
      s.hold = on ? s.hold + dt : Math.max(0, s.hold - dt * FACE_DRAIN);
      const k = Math.min(1, s.hold / task.hold);
      const c = f.found ? ctx.view.toScreen(f.center.x, f.center.y) : L.center();
      if (on) {
        // rising tone every ~0.22 s while it builds
        s.toneAt -= dt;
        if (s.toneAt <= 0) { s.toneAt = 0.22; ctx.sfx.tone(320 + 700 * k, 0.09, 'triangle'); }
        if (Math.random() < 0.25 + 0.6 * k) {
          const a = Math.random() * Math.PI * 2, R = L.unit() * (0.16 + 0.04 * k);
          ctx.fx.burst(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, { color: k > 0.66 ? '#7dff6a' : '#ffcc33', count: 1 + Math.round(3 * k), speed: 120 + 200 * k, size: 5 + 6 * k, gravity: 0, life: 0.45 });
        }
      } else s.toneAt = 0;
      s.tried = s.hold > 0.1 ? 0 : s.tried + dt;
      if (s.hold >= task.hold) {
        L.hit(st, { x: c.x, y: c.y, text: task.yay, sound: 'tada', emoji: task.emoji, big: true });
        nextFace(st, L, 1.6);
      } else if (s.tried >= FACE_GIVE_UP) {
        L.log('face skip', { face: task.k });
        nextFace(st, L, 0.6);
      }
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit();
      const task = s.task;
      const k = Math.min(1, s.hold / task.hold), on = s.v >= task.th && s.wait <= 0;
      // big hold ring around his face (or the middle when the face isn't found)
      const f = ctx.face;
      const c = f.found ? ctx.view.toScreen(f.center.x, f.center.y) : L.center();
      const R = u * (0.17 + 0.03 * k) * (1 + (on ? 0.04 * Math.sin(st.t * (10 + 20 * k)) : 0));
      if (st.phase !== 'demo' && s.wait <= 0) {
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(27,17,64,.5)'; g.lineWidth = u * 0.045;
        g.beginPath(); g.arc(c.x, c.y, R, 0, Math.PI * 2); g.stroke();
        if (k > 0) {
          g.strokeStyle = k > 0.66 ? '#7dff6a' : k > 0.33 ? '#ffcc33' : '#ff8a3d'; g.lineWidth = u * (0.035 + 0.02 * k);
          g.beginPath(); g.arc(c.x, c.y, R, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
        }
        g.lineCap = 'butt';
        g.font = `900 ${u * (0.055 + 0.03 * k)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const label = !on ? (k > 0 ? 'Keep going!' : '') : k < 0.5 ? 'HOLD IT!' : k < 0.85 ? 'MORE!' : 'ALMOST!';
        if (label) {
          const ly = Math.max(ctx.H * 0.36, c.y - R - u * 0.07);
          g.lineWidth = u * 0.012; g.strokeStyle = '#1b1140'; g.strokeText(label, c.x, ly);
          g.fillStyle = '#fff'; g.fillText(label, c.x, ly);
        }
      }
      // which face: a big emoji badge on the right that grows as the hold fills
      const x = ctx.W - u * 0.18, y = ctx.H * 0.55, r = u * 0.11;
      g.fillStyle = 'rgba(27,17,64,.6)'; g.beginPath(); g.arc(x, y, r * 1.25, 0, Math.PI * 2); g.fill();
      g.font = `${r * (1.1 + k * 0.5)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(task.emoji, x, y);
      if (!ctx.face.found && !L.fake && s.sim <= 0 && st.phase !== 'demo') {
        g.font = `bold ${u * 0.06}px sans-serif`; g.fillStyle = '#fff';
        g.fillText('👀 Look at me!', ctx.W / 2, ctx.H * 0.5);
      }
    },
    sim(st) { st.sub.sim = 2.4; },
    signal: (st) => {
      const task = st.sub?.task || FACE_TASKS[0];
      const hold = st.sub?.hold || 0;
      return { name: `${task.label} · hold ${hold.toFixed(1)} / ${task.hold} s`, v: st.sub?.v || 0, min: 0, max: task.k === 'tilt' ? 0.8 : 1, lines: [{ v: task.th, label: task.k, color: '#ff8a3d' }] };
    },
  },
  {
    // Magic toy: logic in toy.js (shared with scripts/replay.js). A toy only counts above that colour's
    // background, and "big enough" shrinks with distance (shoulder width), so it works from play distance.
    id: 'toy', n: 8, icon: '🔴', title: 'Magic toy', color: '#ff3b3b', calm: true, goal: 3, time: 50, demo: 'toy',
    colors: TOY_CONFIG.order,
    prompt: 'Find something red! Show me!',
    start(st) { st.sub = { toy: createToyStation(), sim: 0, hintT: 0, saidHold: false }; },
    update(dt, st, L) {
      const s = st.sub, toy = s.toy, { ctx } = L;
      const c = TOY_COLORS[toy.target || toy.pick()];
      st.demoOpts = { color: c.css };
      if (st.phase === 'done') return; // don't ask for another colour over "You did it!"
      s.sim = Math.max(0, s.sim - dt);
      const blobs = {};
      for (const name of TOY_CONFIG.order) { const b = ctx.color.track(name); blobs[name] = { found: b.found, x: b.x, y: b.y, size: b.size }; }
      const body = ctx.body();
      const p = ctx.pose, wrists = [];
      for (const w of [p.leftWrist, p.rightWrist]) if (p.found && w && (w.v ?? 1) >= 0.5) wrists.push({ x: w.x, y: w.y });
      if (s.sim > 0 && toy.target) { // ?debug K: pretend he holds the toy up in his hand
        const at = wrists[0] || { x: 0.5, y: 0.5 };
        blobs[toy.target] = { found: true, x: at.x, y: at.y, size: (toy.base[toy.target] || 0) + 0.02 };
      }
      const events = toy.update(dt, st.phase === 'demo' ? 'demo' : 'go',
        { blobs, bodyWidth: body.found ? body.width : 0, wrists, aspect: ctx.camera.width / ctx.camera.height || 16 / 9 });
      for (const e of events) {
        const col = TOY_COLORS[e.color];
        if (e.name === 'ask') {
          s.saidHold = false; s.hintT = 0;
          if (!e.first || e.color !== 'red') ctx.say(col.say);
          L.log('toy ask', { color: e.color, background: +(toy.base[e.color] || 0).toFixed(4) });
        } else if (e.name === 'hit') {
          const at = toy.blob ? ctx.view.toScreen(toy.blob.x, toy.blob.y) : L.center();
          L.hit(st, { x: at.x, y: at.y, text: col.yay, sound: 'ding', color: col.css });
        } else if (e.name === 'skip') {
          L.log('toy skip', { color: e.color });
        }
      }
      if (st.phase === 'demo' || toy.wait > 0) return;
      // sparkles only on a real candidate (not on the background blob)
      if (toy.blob && toy.almost > 0.3 && Math.random() < 0.15 + 0.4 * toy.almost) {
        const q = ctx.view.toScreen(toy.blob.x, toy.blob.y);
        ctx.fx.burst(q.x, q.y, { color: c.css, count: 2 + Math.round(4 * toy.progress), speed: 150, size: 6, gravity: 0, life: 0.5 });
      }
      // seen but not quite enough for a while: tell him what to do (once per colour)
      s.hintT = toy.blob && toy.almost > 0.3 && !toy.showing ? s.hintT + dt : 0;
      if (s.hintT > 2.5 && !s.saidHold) { s.saidHold = true; ctx.say('Hold it up high! Show me!', { interrupt: false }); }
    },
    draw(g, st, L) {
      const s = st.sub, toy = s.toy, { ctx } = L, u = L.unit();
      const c = TOY_COLORS[toy.target || toy.pick()];
      // colour-tinted scanner frame
      g.strokeStyle = c.css; g.globalAlpha = 0.5 + 0.3 * Math.sin(st.t * 4); g.lineWidth = u * 0.025;
      g.strokeRect(u * 0.02, u * 0.02, ctx.W - u * 0.04, ctx.H - u * 0.04); g.globalAlpha = 1;
      if (st.phase === 'demo' || toy.wait > 0 || !toy.blob || toy.almost <= 0.3) return;
      // a ring around the toy that FILLS while he holds it: the "almost there" meter
      const p = ctx.view.toScreen(toy.blob.x, toy.blob.y);
      const R = u * (0.11 + 0.03 * toy.almost) * (1 + 0.06 * Math.sin(st.t * 10) * toy.progress);
      const prog = toy.progress;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = u * 0.03;
      if (!toy.showing) g.setLineDash([u * 0.03, u * 0.03]);
      g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      if (prog > 0) {
        g.strokeStyle = c.css; g.lineWidth = u * 0.045;
        g.beginPath(); g.arc(p.x, p.y, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke();
      }
      g.lineCap = 'butt';
      g.font = `900 ${u * 0.06}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = u * 0.012; g.strokeStyle = '#1b1140'; g.fillStyle = '#fff';
      const label = toy.showing ? 'HOLD IT!' : 'Hold it up!';
      const ly = Math.max(ctx.H * 0.36, p.y - R - u * 0.06);
      g.strokeText(label, p.x, ly); g.fillText(label, p.x, ly);
    },
    sim(st) { st.sub.sim = 0.9; },
    signal: (st) => {
      const toy = st.sub?.toy;
      const name = toy?.target || 'red';
      return {
        name: `${name}: size above background (bg ${((toy?.base[name] || 0) * 100).toFixed(2)}% of view)${toy?.near ? ' · in hand' : ''}`,
        v: Math.max(0, toy?.excess || 0), min: 0, max: 0.02,
        lines: [{ v: toy?.need || TOY_CONFIG.maxSize, label: 'enough', color: TOY_COLORS[name].css }],
      };
    },
  },
  {
    // Distance Dance: hop between a FAR spot (camera sees down to the knees) and a NEAR spot, measured from
    // the shoulders (body tracking), so it works from anywhere in the room with real steps.
    id: 'distance', n: 9, icon: '👣', iconTint: '#ffd84d', title: 'Distance Dance', color: '#ffd84d', goal: 4, time: 60, demo: 'closer',
    prompt: 'Step back until I can see your knees!',
    // logic in distance.js (shared with scripts/replay.js): smoothed width, far width taken when the
    // far step counts, and a near step he can actually reach
    start(st) { st.sub = { d: createDistanceStation(), sim: null, simT: 0, mx: null }; },
    update(dt, st, L) {
      const s = st.sub, d = s.d, { ctx } = L;
      if (st.phase === 'done') return;
      let b = ctx.body();
      s.simT = Math.max(0, s.simT - dt);
      if (s.simT > 0 && s.sim) b = s.sim; // ?debug K key
      s.zone = b.zone;
      for (const e of d.update(dt, st.phase === 'demo' ? 'demo' : 'go', b)) {
        const c = L.center();
        L.hit(st, { x: c.x, y: c.y, text: e.want === 'far' ? (b.feetIn ? 'KNEES AND FEET!' : 'I SEE YOUR KNEES!') : 'HELLO, NOSE!', sound: e.want === 'far' ? 'ding' : 'boing' });
        if (st.count < st.goal) ctx.say(d.want === 'near' ? 'Now come closer! Two big steps!' : 'Back to your jumping spot! Show me your knees!');
      }
    },
    draw(g, st, L) {
      const s = st.sub, d = s.d, { ctx } = L, u = L.unit();
      // near <-> far meter along the bottom, with the target zone glowing
      const x0 = ctx.W * 0.12, x1 = ctx.W * 0.88, y = ctx.H - u * 0.13, hh = u * 0.06;
      const X = (p) => x0 + (x1 - x0) * Math.max(0, Math.min(1, p));
      const pulse = 0.55 + 0.45 * Math.sin(st.t * 6);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, y - hh / 2, x1 - x0, hh);
      const zoneFar = [0, 0.25], zoneNear = [0.8, 1];
      for (const [z, want, col] of [[zoneFar, 'far', '#7dff6a'], [zoneNear, 'near', '#ffd84d']]) {
        g.globalAlpha = d.want === want ? pulse : 0.25;
        g.fillStyle = col; g.fillRect(X(z[0]), y - hh / 2, X(z[1]) - X(z[0]), hh);
      }
      g.globalAlpha = 1;
      g.font = `${u * 0.07}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🦶', X(0.12), y - hh * 1.4);
      g.fillText('👃', X(0.9), y - hh * 1.4);
      // the kid's marker: eased on screen too, greyed out while we can't see him
      const target = X(d.pos);
      s.mx = s.mx == null ? target : s.mx + (target - s.mx) * Math.min(1, (1 / 60) * 10);
      const mx = s.mx;
      g.globalAlpha = d.seen ? 1 : 0.35;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(mx, y, hh * 0.75, 0, Math.PI * 2); g.fill();
      if (d.progress > 0) { // fills while he's in the target zone
        g.strokeStyle = d.want === 'far' ? '#7dff6a' : '#ffd84d'; g.lineWidth = hh * 0.25;
        g.beginPath(); g.arc(mx, y, hh * 0.95, -Math.PI / 2, -Math.PI / 2 + d.progress * Math.PI * 2); g.stroke();
      }
      g.font = `${u * 0.06}px sans-serif`; g.fillText(d.seen ? '🧒' : '❓', mx, y + 2);
      g.globalAlpha = 1;
      // arrow telling which way to go
      const goFar = d.want === 'far';
      g.font = `900 ${u * 0.06}px ui-rounded, system-ui, sans-serif`; g.fillStyle = goFar ? '#7dff6a' : '#ffd84d';
      g.fillText(goFar ? '⬅ STEP BACK' : 'COME CLOSER ➡', ctx.W / 2, y - hh * 1.6 - Math.abs(Math.sin(st.t * 4)) * u * 0.015);
      drawBodyPip(g, L, d.seen ? (d.knees ? ['I can see you!', '#7dff6a'] : ["I can't see your knees", '#ffd84d']) : ["I can't see you", '#ff7a7a']);
    },
    sim(st) {
      const s = st.sub, d = s.d;
      const w = d.farW || 0.22;
      const far = { found: true, width: w, kneesIn: true, feetIn: true, headIn: true, wholeBody: true, zone: 'good' };
      const near = { found: true, width: w * (d.C.nearRatio + 0.1), kneesIn: false, feetIn: false, headIn: true, wholeBody: false, zone: 'too-close' };
      s.sim = d.want === 'far' ? far : near; s.simT = 1.2;
    },
    signal: (st) => {
      const d = st.sub?.d;
      return { name: `shoulder width ÷ far-spot width · BODY${st.sub?.zone ? ' · zone: ' + st.sub.zone : ''}${d && !d.seen ? ' · ⚠️ not seen' : ''}`,
        v: d?.ratio || 0, min: 0.5, max: 2,
        lines: [{ v: 1, label: 'far spot', color: '#7dff6a' }, { v: d?.C.farBack || 1.2, label: 'back', color: '#3e9d4a' },
          { v: d?.C.closeRatio || 1.25, label: 'close (knees out)', color: '#c9a83a' }, { v: d?.C.nearRatio || 1.45, label: 'near', color: '#ffd84d' }] };
    },
  },
  {
    // Run in place: fill the speed meter by running, then STOP, then run again. Tests core run.js
    // (shoulder bob + knees). Labelled count = how many separate runs (scripts/replay.js replays it).
    id: 'run', n: 10, icon: '🏃', title: 'Run in place', color: '#ff8a3d', goal: 3, time: 50, demo: 'run',
    prompt: 'Run in place! Run run run! Fill up the meter!',
    start(st) { st.sub = { phase: 'run', fill: 0, rest: 0, peak: 0 }; },
    update(dt, st, L) {
      const s = st.sub, { ctx } = L, r = ctx.gestures.run;
      s.peak = Math.max(s.peak * (1 - dt * 0.5), r.intensity);
      if (st.phase === 'demo') return;
      if (s.phase === 'run') {
        // running fills fast, walking a little; the meter never drains (effort is kept)
        s.fill = Math.min(1, s.fill + dt * (r.state === 'running' ? 0.5 : r.state === 'walking' ? 0.12 : 0));
        if (s.fill >= 1) {
          // every full meter counts. No STOP required: a real playtest showed he keeps running his heart out,
          // and the old "stop before the next one" rule threw away all of that effort.
          const c = L.center();
          L.hit(st, { x: c.x, y: c.y, text: 'ZOOM!', sound: 'whoosh', color: '#ff8a3d' });
          s.phase = 'refill'; s.rest = 0.8; s.fill = 0;
          if (st.count < st.goal) L.ctx.say(pick(['Keep going!', 'Again! Faster!', 'Zoom zoom!']), { interrupt: false });
        }
      } else {
        // short celebration pause, then the meter fills again (running or not)
        s.rest -= dt;
        if (s.rest <= 0) { s.phase = 'run'; L.log('run-again'); }
      }
    },
    gestures: {
      run(st, L) { L.log('running'); },
      jump(st, L) { const c = L.center(); L.react(c.x, c.y, 'Boing! Now run!', 'boing'); },
    },
    draw(g, st, L) {
      const s = st.sub, { ctx } = L, u = L.unit(), r = ctx.gestures.run;
      // speed meter on the right: intensity with walk/run marks
      const x = ctx.W - u * 0.1, top = ctx.H * 0.28, bot = ctx.H * 0.88, H = bot - top;
      const toY = (v) => bot - v * H;
      g.fillStyle = 'rgba(27,17,64,.55)'; g.beginPath(); g.roundRect(x - u * 0.045, top - 10, u * 0.09, H + 20, u * 0.045); g.fill();
      const cfg = ctx.gestures.runConfig;
      for (const [v, col] of [[cfg.walkAt, '#ffcc33'], [cfg.runAt, '#ff8a3d']]) { g.fillStyle = col; g.fillRect(x - u * 0.06, toY(v) - 2, u * 0.12, 4); }
      g.fillStyle = r.state === 'running' ? '#ff8a3d' : r.state === 'walking' ? '#ffcc33' : '#fff';
      g.beginPath(); g.roundRect(x - u * 0.03, toY(r.intensity), u * 0.06, Math.max(4, r.intensity * H), u * 0.03); g.fill();
      g.font = `${u * 0.05}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(r.state === 'running' ? '🏃' : r.state === 'walking' ? '🚶' : '🧍', x, top - u * 0.05);
      // the big fill bar along the bottom (the goal)
      const x0 = ctx.W * 0.15, x1 = ctx.W * 0.8, y = ctx.H - u * 0.12, hh = u * 0.07;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(x0, y - hh / 2, x1 - x0, hh, hh / 2); g.fill();
      g.fillStyle = `hsl(${30 + s.fill * 20},100%,60%)`; g.beginPath(); g.roundRect(x0, y - hh / 2, Math.max(hh, (x1 - x0) * s.fill), hh, hh / 2); g.fill();
      g.font = `900 ${u * 0.06}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff';
      g.fillText(s.phase === 'refill' ? '⭐ ZOOM! ⭐' : 'RUN RUN RUN!', (x0 + x1) / 2, y - hh * 1.3 - Math.abs(Math.sin(st.t * (s.phase === 'run' ? 8 : 2))) * u * 0.015);
      // speed lines while running
      if (r.intensity > 0.2) {
        g.strokeStyle = `rgba(255,255,255,${Math.min(0.6, r.intensity * 0.7)})`; g.lineWidth = 3;
        for (let i = 0; i < 14; i++) {
          const a = i * 2.39 + st.t * 0.3, rr = u * (0.35 + ((st.t * 2 * (1 + r.intensity * 2) + i * 0.37) % 1) * 0.5);
          const cx = ctx.W / 2 + Math.cos(a) * rr, cy = ctx.H * 0.45 + Math.sin(a) * rr * 0.7;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * u * 0.08, cy + Math.sin(a) * u * 0.056); g.stroke();
        }
      }
    },
    sim(st) { st.sub.fill = st.sub.phase === 'run' ? 1 : st.sub.fill; },
    signal: (st, L) => {
      const gs = L.ctx.gestures, r = gs.run;
      return {
        name: `run intensity · ${r.state} · ${r.rate.toFixed(1)} steps/s${gs.knees ? ' · knees ✓' : ' · no knees'}${r.jumping ? ' · JUMP' : ''}${gs.raw ? '' : ' · ⚠️ not seen'}`,
        v: r.intensity, min: 0, max: 1, hidden: r.jumping,
        lines: [{ v: gs.runConfig.walkAt, label: 'walk', color: '#ffcc33' }, { v: gs.runConfig.runAt, label: 'run', color: '#ff8a3d' }],
      };
    },
  },
  {
    // Smash: punch (or swing) to smash rocks. Tests core punch.js. Labelled count = punches.
    id: 'punch', n: 11, icon: '👊', title: 'Smash', color: '#c9905a', goal: 8, time: 40, demo: 'punch',
    prompt: 'Punch the air! Smash the rocks! Punch, punch!',
    start(st) { st.sub = { rocks: [0, 1, 2].map((i) => ({ x: 0.3 + i * 0.2, y: 0.55, wob: Math.random() * 6, hit: 0 })), saidAir: false }; },
    gestures: {
      punch(st, L, data) {
        const { ctx } = L, s = st.sub;
        // smash the rock nearest the punching hand (auto-aim), then a new one rolls in
        const wx = data.x ?? 0.5;
        let best = s.rocks[0];
        for (const r of s.rocks) if (Math.abs(r.x - wx) < Math.abs(best.x - wx)) best = r;
        const x = best.x * ctx.W, y = best.y * ctx.H;
        ctx.fx.burst(x, y, { count: 40, speed: 600, size: 12, color: '#a0785a' });
        L.hit(st, { x, y, text: data.hand === 'both' ? 'MEGA SMASH!' : 'SMASH!', sound: 'boom', color: '#ffcc33', big: data.hand === 'both' });
        best.hit = 1; best.wob = Math.random() * 6;
      },
    },
    update(dt, st) { for (const r of st.sub.rocks) r.hit = Math.max(0, r.hit - dt * 2); },
    draw(g, st, L) {
      const { ctx } = L, u = L.unit();
      for (const r of st.sub.rocks) {
        const x = r.x * ctx.W, y = r.y * ctx.H, R = u * 0.09 * (1 - r.hit * 0.8 + Math.sin(st.t * 3 + r.wob) * 0.03);
        g.globalAlpha = 1 - r.hit * 0.7;
        g.fillStyle = '#8a6a50'; g.beginPath(); g.ellipse(x, y, R * 1.15, R, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#a8876a'; g.beginPath(); g.ellipse(x - R * 0.3, y - R * 0.3, R * 0.45, R * 0.3, -0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x - R * 0.35, y - R * 0.05, R * 0.22, 0, Math.PI * 2); g.arc(x + R * 0.35, y - R * 0.05, R * 0.22, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(x - R * 0.3, y, R * 0.1, 0, Math.PI * 2); g.arc(x + R * 0.4, y, R * 0.1, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      // fists on the real wrists, glowing with the punch signal
      const p = ctx.pose, v = Math.min(1.5, ctx.gestures.punch.value || 0);
      if (p.found) for (const w of [p.leftWrist, p.rightWrist]) {
        if (!w || w.v < 0.4) continue;
        const q = ctx.view.toScreen(w.x, w.y);
        g.font = `${u * (0.08 + v * 0.04)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('👊', q.x, q.y);
      }
    },
    sim(st, L) { L.ctx.gestures.simPunch(); },
    signal: (st, L) => {
      const pc = L.ctx.gestures.punchConfig, ps = L.ctx.gestures.punch;
      return {
        name: `fastest wrist ÷ punch speed · BODY${ps.pump ? ' · arm pump' : ''}${ps.clap ? ' · clap' : ''}`,
        v: Math.min(3, ps.value || 0), min: 0, max: 3, hidden: ps.clap || ps.pump,
        lines: [{ v: 1, label: 'punch', color: '#ffcc33' }, { v: pc.pumpBoost, label: 'pump punch', color: '#ff8a3d' }],
      };
    },
  },
  {
    // Lean / Airplane arms: lean left and right (or tilt airplane arms) to fly the plane to the clouds.
    // Tests core steer.js. Every detected lean counts (labelled count = leans, both sides; replay.js replays it);
    // leaning the side the cloud is on gives a bigger reaction.
    id: 'lean', n: 12, icon: '✈️', title: 'Lean', color: '#5ec8ff', goal: 6, time: 45, demo: 'lean',
    prompt: 'Be an airplane! Arms out! Lean left... and lean right!',
    start(st) { st.sub = { want: 'left', x: 0, trail: [], said: 0 }; },
    gestures: {
      lean(st, L, data) {
        const { ctx } = L, s = st.sub, u = L.unit();
        const onSide = data.side === s.want;
        const x = ctx.W / 2 + (data.side === 'right' ? 1 : -1) * ctx.W * 0.3, y = ctx.H * 0.4;
        L.hit(st, { x, y, text: onSide ? 'WHOOSH!' : 'ZOOM!', sound: onSide ? 'whoosh' : 'boing', color: '#5ec8ff', big: onSide });
        if (onSide) ctx.fx.burst(x, y, { count: 30, speed: 500, size: u * 0.012, color: '#ffffff' });
        L.log('lean', { side: data.side, mode: data.mode, asked: s.want });
        s.want = data.side === 'left' ? 'right' : 'left';
        if (st.count < st.goal) ctx.say(s.want === 'left' ? 'Now lean left!' : 'Now lean right!', { interrupt: false });
      },
    },
    update(dt, st, L) {
      const s = st.sub, v = L.ctx.gestures.steer.value;
      s.x += (v - s.x) * Math.min(1, dt * 10);
      s.trail.push(s.x); if (s.trail.length > 24) s.trail.shift();
    },
    draw(g, st, L) {
      const { ctx } = L, s = st.sub, u = L.unit(), gs = ctx.gestures, sv = gs.steer;
      const cx = ctx.W / 2, span = ctx.W * 0.32, y = ctx.H * 0.42;
      // the cloud to fly to (pulsing on the side he should lean)
      const side = s.want === 'right' ? 1 : -1, pulse = 1 + Math.sin(st.t * 5) * 0.08;
      g.font = `${u * 0.16 * pulse}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('☁️', cx + side * span, y);
      g.font = `900 ${u * 0.07}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff';
      g.fillText(side < 0 ? '⬅' : '➡', cx + side * span * 0.62, y + Math.sin(st.t * 6) * u * 0.01);
      // the plane follows the steering value (tilted with it), with a little trail
      g.fillStyle = 'rgba(255,255,255,.35)';
      s.trail.forEach((tx, i) => { g.beginPath(); g.arc(cx + tx * span, y + u * 0.08 + (s.trail.length - i) * u * 0.008, u * 0.006 * (i / s.trail.length) + 1, 0, Math.PI * 2); g.fill(); });
      g.save(); g.translate(cx + s.x * span, y); g.rotate(s.x * 0.6 - Math.PI / 4); // the emoji points up-right: turn it to fly up
      g.font = `${u * 0.14}px sans-serif`; g.fillText('✈️', 0, 0); g.restore();
      // steering meter along the bottom: value, deadzone and the count lines
      const x0 = ctx.W * 0.15, x1 = ctx.W * 0.85, my = ctx.H - u * 0.12, hh = u * 0.05, mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(x0, my - hh / 2, x1 - x0, hh, hh / 2); g.fill();
      for (const v of [-gs.steerConfig.countAt, gs.steerConfig.countAt]) { g.fillStyle = '#ffcc33'; g.fillRect(mid + v * half - 2, my - hh, 4, hh * 2); }
      g.fillStyle = sv.mode === 'arms' ? '#ff8a3d' : '#5ec8ff';
      const vx = mid + sv.value * half;
      g.beginPath(); g.roundRect(Math.min(mid, vx), my - hh * 0.35, Math.max(4, Math.abs(vx - mid)), hh * 0.7, hh * 0.35); g.fill();
      g.font = `900 ${u * 0.045}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff';
      g.fillText(sv.mode === 'arms' ? '✈️ ARMS' : sv.mode === 'lean' ? 'LEAN' : '', mid, my - hh * 1.4);
    },
    sim(st, L) { L.ctx.gestures.emit('lean', { side: st.sub.want, value: st.sub.want === 'left' ? -1 : 1, mode: 'sim', simulated: true }); },
    signal: (st, L) => {
      const gs = L.ctx.gestures, sv = gs.steer;
      return {
        name: `steer value · ${sv.mode}${sv.hold ? ' · ' + sv.hold : ''} · ${sv.left}◀ ${sv.right}▶${gs.raw ? '' : ' · ⚠️ not seen'}`,
        v: sv.value, min: -1, max: 1, hidden: !!sv.hold,
        lines: [{ v: gs.steerConfig.countAt, label: 'right', color: '#ffcc33' }, { v: -gs.steerConfig.countAt, label: 'left', color: '#ffcc33' }, { v: 0, label: 'straight', color: '#ffffff' }],
      };
    },
  },
];

// Silly faces from the face tracker's blendshapes (b = ctx.face.blend). Thresholds are deliberately
// gentle because each face must be HELD for `hold` seconds. (MediaPipe has no tongue-out blendshape.)
const avg = (a, b) => ((a || 0) + (b || 0)) / 2;
const FACE_TASKS = [
  { k: 'mouth', emoji: '😮', label: 'mouthOpen', th: 0.45, hold: 2, v: (f) => f.mouthOpen, say: 'Open your mouth big! Ahhh! Hold it!', yay: 'AHHH!' },
  { k: 'smile', emoji: '😁', label: 'smile', th: 0.45, hold: 2, v: (f) => f.smile, say: 'Biggest smile! Hold it!', yay: 'CHEESE!' },
  { k: 'puff', emoji: '🐡', label: 'cheekPuff', th: 0.3, hold: 2, v: (f, b) => b.cheekPuff || 0, say: 'Puff up your cheeks like a balloon!', yay: 'PUFFER FISH!' },
  { k: 'kiss', emoji: '😗', label: 'mouthPucker', th: 0.55, hold: 2, v: (f, b) => b.mouthPucker || 0, say: 'Fishy lips! Make a kiss!', yay: 'MWAH!' },
  { k: 'brows', emoji: '😲', label: 'browInnerUp', th: 0.5, hold: 2, v: (f, b) => Math.max(b.browInnerUp || 0, avg(b.browOuterUpLeft, b.browOuterUpRight)), say: 'Eyebrows up high! So surprised!', yay: 'WHOA!' },
  { k: 'grumpy', emoji: '😠', label: 'browDown / mouthFrown', th: 0.35, hold: 2, v: (f, b) => Math.max(avg(b.browDownLeft, b.browDownRight), avg(b.mouthFrownLeft, b.mouthFrownRight) * 1.5), say: 'Grumpy face! Grrr!', yay: 'GRRR!' },
  { k: 'eyes', emoji: '😑', label: 'both eyes closed', th: 0.5, hold: 2, v: (f) => Math.min(f.blinkLeft, f.blinkRight), say: 'Close both eyes and listen! Keep them shut!', yay: 'PEEKABOO!' },
  { k: 'wink', emoji: '😉', label: 'wink (one eye shut)', th: 0.35, hold: 1.5, v: (f) => Math.abs(f.blinkLeft - f.blinkRight), say: 'Wink one eye!', yay: 'WINK!' },
  { k: 'tilt', emoji: '🙃', label: '|roll| (radians)', th: 0.28, hold: 2, v: (f) => Math.abs(f.roll), say: 'Tilt your head! Hold it!', yay: 'TILT!' },
  { k: 'wide', emoji: '🤪', label: 'mouthOpen + eyes wide', th: 0.4, hold: 2, v: (f, b) => Math.min(f.mouthOpen, Math.max(avg(b.eyeWideLeft, b.eyeWideRight) * 1.6, b.browInnerUp || 0)), say: 'Crazy face! Big eyes and big mouth!', yay: 'CRAZY!' },
];
const FACE_DRAIN = 0.4;    // letting go drains the hold at this fraction of real time
const FACE_GIVE_UP = 12;   // s with no progress on a face -> try another one
function nextFace(st, L, wait) {
  const s = st.sub;
  s.i++; s.hold = 0; s.tried = 0; s.wait = wait;
  s.task = s.order[s.i % s.order.length];
}

// Small mirrored camera picture-in-picture with the tracked joints (like Smash Run), so he (and the
// grown-up) can see whether the body tracker sees him. status = [text, color] under it.
function drawBodyPip(g, L, status) {
  const { ctx } = L, cam = ctx.camera, u = L.unit();
  if (!cam.ready || !cam.video) return;
  const { W, H } = ctx;
  const w = Math.min(W * 0.2, 220), h = w / ((cam.width / cam.height) || 16 / 9);
  const x = W - w - 14, y = Math.max(H * 0.3, 90);
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.clip();
  g.translate(x + w, y); g.scale(-1, 1);
  g.drawImage(cam.video, 0, 0, w, h);
  g.restore();
  g.strokeStyle = status[1]; g.lineWidth = 4;
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.stroke();
  const p = ctx.pose;
  if (p.found) {
    const pt = (q) => [x + q.x * w, y + q.y * h];
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2;
    for (const [a, b] of [['leftShoulder', 'rightShoulder'], ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'], ['leftHip', 'leftKnee'], ['rightHip', 'rightKnee'], ['leftHip', 'rightHip']]) {
      const qa = p[a], qb = p[b];
      if (!qa || !qb || qa.v < 0.4 || qb.v < 0.4) continue;
      g.beginPath(); g.moveTo(...pt(qa)); g.lineTo(...pt(qb)); g.stroke();
    }
    for (const [name, col] of [['nose', '#fff'], ['leftShoulder', '#fff'], ['rightShoulder', '#fff'], ['leftKnee', '#7dff6a'], ['rightKnee', '#7dff6a']]) {
      const q = p[name];
      if (!q || q.v < 0.4) continue;
      g.fillStyle = col; g.beginPath(); g.arc(...pt(q), name.includes('Knee') ? 6 : 4, 0, Math.PI * 2); g.fill();
    }
  }
  g.font = `800 ${Math.max(13, u * 0.032)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
  g.lineWidth = 4; g.strokeStyle = '#1b1140'; g.strokeText(status[0], x + w / 2, y + h + 6);
  g.fillStyle = status[1]; g.fillText(status[0], x + w / 2, y + h + 6);
}

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
export const REPLAY_EVENT = { jump: 'jump', squat: 'crouch', run: 'run', punch: 'punch', lean: 'lean' };
