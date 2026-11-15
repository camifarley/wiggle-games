// Move Lab: Coach Boing shows a move, the kid copies it, the lab goes bananas, a stamp goes in
// the Move Passport. Every station is also an experiment: a parent overlay (🔧) shows the raw
// signal, detected / expected, and saves a numbers-only recording that `npm test` can replay.
// Brief: docs/briefs/05-move-lab.md
//
// Debug (?debug): digits 1-9 start a station (0 = 10, - = 11), H = back to the lab, K = "do this station's move"
// (wave, silly face, magic toy, distance dance, freeze). Jump/squat/spin/peekaboo/freeze use the core
// gesture keys J, C, S, P, T.

import { STATIONS, REPLAY_EVENT } from './stations.js';
import { drawCoach, demoPose } from './coach.js';
import { createOverlay } from './overlay.js';

const STORE = 'wiggle.movelab';
const DEMO_TIME = 3.2;
const DONE_TIME = 4;
const params = new URLSearchParams(location.search);
const debugOn = params.has('debug');
const fake = params.has('fakecam');
for (const d of STATIONS) d.replayEvent = REPLAY_EVENT[d.id] || null;

let ctx, S, L, overlay, offs = [], onPointer, onKey;
const unit = () => Math.min(ctx.W, ctx.H);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ stamps: S.stamps, fun: S.fun, points: S.points })); } catch { /* private mode */ }
}

function fresh() {
  const saved = load();
  return {
    mode: 'hub', t: 0, station: null, last: null,
    stamps: saved.stamps || {}, fun: saved.fun || {}, points: saved.points || 0, shown: saved.points || 0,
    suggest: null, energyRun: 0, cards: [], newStamp: null, party: 0, partied: false, confettiT: 0, hubT: 0,
  };
}

// ---------- the lab API stations use ----------

function makeLab() {
  return {
    get ctx() { return ctx; },
    get S() { return S; },
    fake,
    unit,
    center: () => ({ x: ctx.W / 2, y: ctx.H * 0.45 }),
    log: (name, data) => { ctx.recorder.event(name, data); overlay?.addLog(name + (data ? ' ' + JSON.stringify(data) : '')); overlay?.mark(name); },
    hit,
    react(x, y, text, sound) {
      const u = unit();
      ctx.fx.burst(x, y, { count: 14, speed: 300, size: 7 });
      ctx.fx.text(x, y - u * 0.05, text, { size: u * 0.08, color: '#fff' });
      ctx.sfx[sound]?.();
    },
    toHub,
    resetPassport() { S.stamps = {}; S.partied = false; S.points = 0; S.shown = 0; save(); },
    saveFun(id, v) { (S.fun[id] ||= []).push(v); save(); },
  };
}

function hit(st, { x, y, text, sound = 'pop', color, big = false, emoji }) {
  if (st.phase === 'done' || S.station !== st) return;
  const u = unit();
  y = Math.max(y, ctx.H * 0.36); // keep the reaction text clear of the counter at the top
  st.count++;
  st.combo = st.t - st.lastHit < 3 ? Math.min(5, st.combo + 1) : 1;
  st.lastHit = st.t;
  const pts = 100 * st.combo;
  st.score += pts;
  S.points += pts;
  st.flash = 1;
  st.cheer = 1.1;
  const last = st.count >= st.goal;
  ctx.fx.burst(x, y, { count: last ? 24 : big ? 70 : 45, speed: big ? 700 : 520, size: 10, color });
  if (big && !last) ctx.fx.confetti(60);
  ctx.fx.text(x, y - u * 0.12, text, { size: u * (big ? 0.2 : 0.13), color: color || '#ffcc33', life: 1.1 });
  ctx.fx.text(x, y + u * 0.06, `+${pts}`, { size: u * 0.07, color: '#fff' });
  if (emoji) ctx.fx.text(x, y - u * 0.3, emoji, { size: u * 0.2, life: 1.2 });
  ctx.fx.shake(big ? 18 : 10);
  ctx.sfx[sound]?.();
  setTimeout(() => ctx.sfx.squeak(0.9 + st.count * 0.15), 120);
  ctx.recorder.event('hit', { count: st.count, combo: st.combo });
  overlay.addLog(`✅ HIT ${st.count}/${st.goal}${st.combo > 1 ? ` combo x${st.combo}` : ''}`);
  overlay.mark('hit', true);
  if (st.count >= st.goal) finish(st, false);
  else if (!big) ctx.say(st.combo >= 3 ? `${st.count}! Combo!` : `${st.count}!`);
}

// ---------- stations ----------

function startStation(def) {
  leaveStation(false);
  const st = {
    def, count: 0, goal: def.goal, t: 0, phase: 'demo', score: 0, combo: 0, lastHit: -9,
    flash: 0, cheer: 0, doneT: 0, demoOpts: {}, sub: {},
    result: { expected: def.goal, trueCount: null, confirmed: null, fun: null, timedOut: false },
  };
  S.station = st; S.last = st; S.mode = 'station';
  ctx.recorder.start({ station: def.id, title: def.title, expected: def.goal, colors: def.colors || [], replayEvent: def.replayEvent });
  overlay.newRun();
  overlay.addLog(`▶ station ${def.n} ${def.title}: expecting ${def.goal}`);
  overlay.hubBtn.hidden = false;
  for (const [name, fn] of Object.entries(def.gestures || {})) {
    offs.push(ctx.gestures.on(name, (data) => { if (S.station === st && st.phase !== 'done') fn(st, L, data); }));
  }
  offs.push(ctx.gestures.onAny((name, data) => {
    if (S.station !== st) return;
    const extra = Object.entries(data || {}).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(' ');
    overlay.addLog(`${name}${extra ? ' ' + extra : ''}`);
    overlay.mark(name);
  }));
  def.start?.(st, L);
  ctx.sfx.whoosh();
  ctx.say(def.prompt);
}

function finish(st, timedOut) {
  st.phase = 'done';
  st.doneT = 0;
  st.result.timedOut = timedOut;
  st.recStopAt = st.t + 1; // keep recording a moment: the frame that finished it must be in the file
  S.points += 500;
  const first = !S.stamps[st.def.id];
  S.stamps[st.def.id] = true;
  S.newStamp = first ? st.def.id : null;
  S.energyRun = st.def.calm ? 0 : S.energyRun + 1;
  save();
  // celebration in waves, not 220 confetti + the hit burst in one frame (a playtest saw a hitch here)
  st.confettiWaves = [0.05, 0.3, 0.55];
  ctx.fx.shake(16);
  ctx.sfx.tada();
  ctx.say(timedOut ? 'Great try! Here is your stamp!' : 'You did it! Stamp!');
  overlay.addLog(`${timedOut ? '⏰ timeout' : '🏁 done'}: detected ${st.count} / expected ${st.goal}`);
}

function leaveStation(toHub = true) {
  offs.forEach((off) => off());
  offs = [];
  if (S.station) { S.station.def.end?.(S.station, L); ctx.recorder.stop(); S.last = S.station; }
  S.station = null;
  overlay.hubBtn.hidden = true;
  if (toHub) S.mode = 'hub';
}

function toHub() {
  const wasDone = S.station?.phase === 'done';
  leaveStation(true);
  S.hubT = 0;
  pickSuggestion();
  if (Object.keys(S.stamps).length >= STATIONS.length && !S.partied) {
    S.partied = true; S.party = 7; S.confettiT = 0;
    ctx.sfx.tada();
    ctx.say('Your passport is full! LAB PARTY!');
  } else if (S.suggest) {
    ctx.say(wasDone ? `Stamp! Now let's try ${S.suggest.title}!` : `Let's try ${S.suggest.title}!`);
  }
}

// Calm station after every two energetic ones; otherwise the next one without a stamp.
function pickSuggestion() {
  const open = STATIONS.filter((d) => !S.stamps[d.id]);
  const calm = STATIONS.filter((d) => d.calm);
  if (S.energyRun >= 2) S.suggest = calm.find((d) => !S.stamps[d.id]) || calm[(Math.random() * calm.length) | 0];
  else S.suggest = open.find((d) => !(S.energyRun >= 1 && d.calm && open.some((o) => !o.calm))) || open[0] || null;
}

// ---------- hub layout ----------

function layoutHub() {
  const { W, H } = ctx;
  const u = unit();
  const landscape = W > H * 1.15;
  // header: title, passport slots, points (below the corner buttons on narrow screens)
  const titleSize = Math.min(u * 0.09, 56);
  const tx = landscape ? W * 0.6 : W * 0.5;
  const titleY = W - 2 * 190 < titleSize * 7 ? 120 : Math.max(46, H * 0.07);
  const slot = Math.min((landscape ? W * 0.6 : W * 0.9) / STATIONS.length, u * 0.085);
  const passY = titleY + titleSize * 0.65 + slot * 0.6;
  const pointsY = passY + slot * 0.85;
  const top = pointsY + Math.min(u * 0.06, 36);
  const coach = landscape
    ? { x: W * 0.11, y: H * 0.86, r: Math.min(W * 0.07, H * 0.13) }
    : { r: Math.min(W * 0.11, H * 0.065), x: W * 0.5, y: H - 14 };
  const bottom = landscape ? H * 0.98 : H - coach.r * 2.5 - 20;
  const area = landscape ? { x: W * 0.22, y: top, w: W * 0.76, h: bottom - top } : { x: W * 0.03, y: top, w: W * 0.94, h: bottom - top };
  let best = 0, cols = 3;
  const N = STATIONS.length;
  for (let c = 1; c <= N; c++) {
    const rows = Math.ceil(N / c);
    const cell = Math.min(area.w / c, area.h / rows);
    if (cell > best) { best = cell; cols = c; }
  }
  const rows = Math.ceil(N / cols);
  const cw = Math.min(area.w / cols, best * 1.25), ch = area.h / rows;
  const ox = area.x + (area.w - cw * cols) / 2;
  S.cards = STATIONS.map((d, i) => {
    const cx = ox + (i % cols) * cw, cy = area.y + Math.floor(i / cols) * ch;
    return { def: d, x: cx + cw * 0.05, y: cy + ch * 0.05, w: cw * 0.9, h: ch * 0.9 };
  });
  return { coach, landscape, tx, titleY, titleSize, slot, passY, pointsY };
}

function drawHub(g) {
  const { W, H } = ctx;
  const u = unit();
  const { coach, tx, titleY, titleSize, slot, passY: py, pointsY } = layoutHub();
  g.fillStyle = 'rgba(27,17,64,.72)'; g.fillRect(0, 0, W, H);
  if (S.party > 0) {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `hsla(${(i * 60 + S.t * 240) % 360},90%,60%,.16)`;
      g.beginPath(); g.arc(W * (i + 0.5) / 6, H * 0.5 + Math.sin(S.t * 4 + i) * H * 0.2, u * 0.3, 0, Math.PI * 2); g.fill();
    }
  }
  // title + passport
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.font = `900 ${titleSize}px ui-rounded, system-ui, sans-serif`;
  g.fillText('🧪 Move Lab', tx, titleY);
  const n = STATIONS.length;
  STATIONS.forEach((d, i) => {
    const x = tx + (i - (n - 1) / 2) * slot;
    const got = S.stamps[d.id];
    const pop = S.newStamp === d.id ? 1 + Math.max(0, 1 - S.hubT * 2) * 1.2 : 1;
    g.save(); g.translate(x, py); g.scale(pop, pop);
    g.strokeStyle = got ? d.color : 'rgba(255,255,255,.45)'; g.lineWidth = 3; g.setLineDash(got ? [] : [4, 4]);
    g.fillStyle = got ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)';
    g.beginPath(); g.arc(0, 0, slot * 0.42, 0, Math.PI * 2); g.fill(); g.stroke(); g.setLineDash([]);
    g.font = `${slot * (got ? 0.5 : 0.4)}px sans-serif`; g.fillStyle = '#fff';
    if (got) drawIcon(g, d, 0, 2); else g.fillText(String(d.n), 0, 2);
    g.restore();
  });
  S.shown += (S.points - S.shown) * 0.08;
  g.font = `900 ${Math.min(u * 0.055, 34)}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#ffcc33';
  g.fillText(`⭐ ${fmt(S.shown)}`, tx, pointsY);

  // station cards
  for (const c of S.cards) {
    const d = c.def, got = S.stamps[d.id];
    const sug = S.suggest === d && S.party <= 0;
    const s = sug ? 1 + Math.sin(S.t * 6) * 0.04 : 1;
    g.save();
    g.translate(c.x + c.w / 2, c.y + c.h / 2); g.scale(s, s);
    g.fillStyle = got ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.12)';
    g.strokeStyle = sug ? '#fff' : d.color; g.lineWidth = sug ? 6 : 4;
    g.beginPath(); g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, Math.min(c.w, c.h) * 0.16); g.fill(); g.stroke();
    const m = Math.min(c.w, c.h);
    g.fillStyle = '#ffcc33'; g.font = `900 ${m * 0.2}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'left';
    g.fillText(String(d.n), -c.w / 2 + m * 0.08, -c.h / 2 + m * 0.15);
    g.textAlign = 'center';
    g.font = `${m * 0.42}px sans-serif`;
    drawIcon(g, d, 0, -m * 0.06);
    g.fillStyle = '#fff'; g.font = `800 ${Math.min(m * 0.15, c.w / d.title.length * 1.6)}px ui-rounded, system-ui, sans-serif`;
    g.fillText(d.title, 0, c.h / 2 - m * 0.14);
    if (got) {
      g.save(); g.translate(c.w / 2 - m * 0.14, -c.h / 2 + m * 0.14); g.rotate(0.3);
      g.font = `${m * 0.24}px sans-serif`; g.fillText('⭐', 0, 0); g.restore();
    }
    g.restore();
  }

  // Coach Boing waves (or dances at the party) and points at the suggested card
  const pose = S.party > 0 ? demoPose('dance', S.t) : S.hubT < 2.5 ? demoPose('wave', S.t) : demoPose('idle', S.t);
  drawCoach(g, coach.x, coach.y, coach.r, pose, S.t);
}

// ---------- station drawing ----------

function drawStation(g, st) {
  const { W, H } = ctx;
  const u = unit();
  const def = st.def;
  def.draw?.(g, st, L);

  // counter: icon + big number + pips (the lab lights). Sits between the corner buttons when it fits.
  const boxH = Math.min(u * 0.2, 130);
  const roomy = W - 400 >= u * 0.55;
  const boxW = roomy ? Math.min(W - 400, u * 0.8) : Math.min(W * 0.92, u * 0.8);
  const cx = W / 2, cy = (roomy ? 12 : 104) + boxH / 2;
  const bump = 1 + st.flash * 0.5;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = st.flash > 0 ? `hsla(${(st.t * 600) % 360},90%,55%,.75)` : 'rgba(27,17,64,.65)';
  g.beginPath(); g.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, boxH / 2); g.fill();
  g.strokeStyle = def.color; g.lineWidth = 4; g.stroke();
  g.font = `${boxH * 0.5}px sans-serif`;
  drawIcon(g, def, cx - boxW * 0.37, cy);
  g.save(); g.translate(cx - boxW * 0.18, cy); g.scale(bump, bump);
  g.fillStyle = '#fff'; g.font = `900 ${boxH * 0.8}px ui-rounded, system-ui, sans-serif`;
  g.fillText(String(st.count), 0, boxH * 0.04);
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `800 ${boxH * 0.38}px ui-rounded, system-ui, sans-serif`;
  g.fillText(`/ ${st.goal}`, cx - boxW * 0.01, cy + boxH * 0.05);
  // pips
  const pr = Math.min(boxH * 0.13, (boxW * 0.32) / (st.goal * 2.6));
  for (let i = 0; i < st.goal; i++) {
    const px = cx + boxW * 0.28 + (i - (st.goal - 1) / 2) * pr * 2.6;
    g.fillStyle = i < st.count ? def.color : 'rgba(255,255,255,.25)';
    g.beginPath(); g.arc(px, cy, i < st.count ? pr * (1 + st.flash * 0.4) : pr * 0.8, 0, Math.PI * 2); g.fill();
  }
  // lab points + combo
  g.fillStyle = '#ffcc33'; g.font = `900 ${u * 0.055}px ui-rounded, system-ui, sans-serif`;
  g.fillText(`⭐ ${fmt(st.score)}`, cx, cy + boxH * 0.8);
  if (st.combo > 1 && st.t - st.lastHit < 3) {
    g.save(); g.translate(cx + boxW * 0.3, cy + boxH * 0.8); g.rotate(0.2 + Math.sin(st.t * 10) * 0.05);
    g.fillStyle = '#ff5ea8'; g.font = `900 ${u * 0.07}px ui-rounded, system-ui, sans-serif`;
    g.fillText(`x${st.combo}!`, 0, 0); g.restore();
  }

  // Coach Boing: big demo in the middle first, then cheering from the corner
  const demoK = st.phase === 'demo' ? 1 : Math.max(0, 1 - (st.t - DEMO_TIME) * 3);
  const big = { x: W / 2, y: H * 0.86, r: u * 0.18 }, small = { x: u * 0.16, y: H - u * 0.04, r: u * 0.085 };
  const k = st.phase === 'done' ? 1 : demoK;
  const pos = { x: small.x + (big.x - small.x) * k, y: small.y + (big.y - small.y) * k, r: small.r + (big.r - small.r) * k };
  let pose;
  if (st.phase === 'done' || st.cheer > 0) pose = demoPose('cheer', st.t);
  else if (def.id === 'freeze' && st.phase !== 'demo') pose = st.sub.phase === 'freeze' ? demoPose('freeze', 2) : demoPose('dance', st.t);
  else pose = demoPose(def.demo, st.t, st.demoOpts);
  if (st.phase === 'demo') {
    g.fillStyle = 'rgba(27,17,64,.35)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.font = `900 ${u * 0.08}px ui-rounded, system-ui, sans-serif`;
    g.fillText('👀 Watch me!', W / 2, cy + boxH * 1.4);
  }
  drawCoach(g, pos.x, pos.y, pos.r, pose, st.t);

  if (st.phase === 'done') {
    const t = st.doneT;
    g.fillStyle = `rgba(27,17,64,${Math.min(0.55, t)})`; g.fillRect(0, 0, W, H);
    const slam = t < 0.35 ? 3 - (t / 0.35) * 2 : 1 + Math.max(0, 0.15 - (t - 0.35)) ;
    const R = u * 0.2;
    g.save(); g.translate(W / 2, H * 0.45); g.rotate(-0.2); g.scale(slam, slam);
    g.globalAlpha = Math.min(1, t * 4);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = def.color; g.lineWidth = R * 0.12;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.setLineDash([R * 0.1, R * 0.08]); g.lineWidth = R * 0.04;
    g.beginPath(); g.arc(0, 0, R * 0.8, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.font = `${R * 0.9}px sans-serif`; g.fillStyle = '#000'; drawIcon(g, def, 0, -R * 0.05);
    g.font = `${R * 0.45}px sans-serif`; g.fillText('⭐', R * 0.7, -R * 0.7);
    g.restore();
    g.globalAlpha = 1;
    g.fillStyle = '#fff'; g.font = `900 ${u * 0.1}px ui-rounded, system-ui, sans-serif`;
    g.fillText(st.result.timedOut ? 'Great try!' : 'You did it!', W / 2, H * 0.45 + R * 1.45);
  }
}

// ---------- game ----------

export default {
  // 'pose' = body tracking: Jump/Squat measure the shoulders, so they work 1-4 m away and when the head
  // leaves the frame. 'face' drives Silly face and face spin; the Peekaboo station switches to body
  // peekaboo (hands up at the head) while it runs.
  needs: ['face', 'pose', 'motion', 'color'],
  showCamera: true,

  init(c) {
    ctx = c;
    S = fresh();
    L = makeLab();
    overlay = createOverlay(L, ctx);
    if (debugOn) { window.wiggle = window.wiggle || {}; window.wiggle.game = S; window.wiggle.lab = { start: (n) => startStation(STATIONS[n - 1]), toHub, L }; }
    pickSuggestion();
    ctx.say("Welcome to the Move Lab! I'm Coach Boing! Pick a station!");

    onPointer = (e) => {
      if (S.mode !== 'hub') return;
      for (const card of S.cards) {
        if (e.clientX >= card.x && e.clientX <= card.x + card.w && e.clientY >= card.y && e.clientY <= card.y + card.h) {
          ctx.sfx.pop();
          startStation(card.def);
          return;
        }
      }
    };
    ctx.view.canvas.addEventListener('pointerdown', onPointer);
    if (debugOn) {
      onKey = (e) => {
        const k = e.key.toLowerCase();
        if (/^[1-9]$/.test(k)) startStation(STATIONS[+k - 1]);
        if (k === '0' && STATIONS[9]) startStation(STATIONS[9]);   // station 10
        if (k === '-' && STATIONS[10]) startStation(STATIONS[10]); // station 11
        if (k === '=' && STATIONS[11]) startStation(STATIONS[11]); // station 12
        if (k === 'h' && S.station) toHub();
        if (k === 'k' && S.station && S.station.phase !== 'done') { S.station.def.sim?.(S.station, L); overlay.addLog('(K: simulated move)'); }
      };
      addEventListener('keydown', onKey);
    }
  },

  update(dt) {
    S.t += dt;
    S.hubT += dt;
    if (S.party > 0) {
      S.party -= dt; S.confettiT -= dt;
      if (S.confettiT <= 0) { S.confettiT = 0.5; ctx.fx.confetti(80); ctx.fx.burst(Math.random() * ctx.W, Math.random() * ctx.H * 0.6, { count: 30, speed: 500 }); ctx.sfx.pop(); }
    }
    const st = S.station;
    if (st) {
      st.t += dt;
      st.flash = Math.max(0, st.flash - dt * 2.5);
      st.cheer = Math.max(0, st.cheer - dt);
      st.def.update?.(dt, st, L);
      if (st.phase === 'demo' && st.t >= DEMO_TIME) { st.phase = 'go'; ctx.sfx.ding(); overlay.addLog('go'); }
      if (st.phase !== 'done' && st.t >= st.def.time) finish(st, true);
      if (st.recStopAt != null && st.t >= st.recStopAt && ctx.recorder.active) ctx.recorder.stop();
      if (st.phase === 'done') {
        st.doneT += dt;
        while (st.confettiWaves?.length && st.doneT >= st.confettiWaves[0]) { st.confettiWaves.shift(); ctx.fx.confetti(70); }
        if (st.doneT >= DONE_TIME) toHub();
      }
    }
    overlay.update(dt);
  },

  draw(g) {
    if (S.mode === 'hub') drawHub(g);
    else if (S.station) drawStation(g, S.station);
  },

  destroy() {
    offs.forEach((off) => off());
    offs = [];
    ctx.view.canvas.removeEventListener('pointerdown', onPointer);
    if (onKey) removeEventListener('keydown', onKey);
    overlay?.destroy();
    overlay = null;
    if (debugOn && window.wiggle) { delete window.wiggle.game; delete window.wiggle.lab; }
  },
};

// Station icons are emoji. Some (👣) are dark gray and vanish on the dark cards, so a station can set
// `iconTint` to draw its emoji as a solid bright silhouette instead. Cached per emoji/color/size.
const tintCache = new Map();
function drawIcon(g, def, x, y) {
  if (!def.iconTint) { g.fillText(def.icon, x, y); return; }
  const px = parseFloat((g.font.match(/([\d.]+)px/) || [0, 48])[1]);
  const key = `${def.icon}|${def.iconTint}|${Math.round(px)}`;
  let c = tintCache.get(key);
  if (!c) {
    const k = 2; // draw at 2x so it stays crisp on retina screens
    const size = Math.ceil(px * 1.5);
    c = document.createElement('canvas');
    c.width = c.height = size * k;
    const cg = c.getContext('2d');
    cg.scale(k, k);
    cg.font = `${px}px sans-serif`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.fillText(def.icon, size / 2, size / 2);
    cg.globalCompositeOperation = 'source-in';
    cg.fillStyle = def.iconTint;
    cg.fillRect(0, 0, size, size);
    c.cssSize = size;
    tintCache.set(key, c);
  }
  g.drawImage(c, x - c.cssSize / 2, y - c.cssSize / 2, c.cssSize, c.cssSize);
}
