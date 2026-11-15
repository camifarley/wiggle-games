// The Alien Passport: every good-guy friend he has rescued (saved per device via core/collection.js), the 2D
// friend drawing (used by the passport pages, the HUD flyers and the score card), and the passport overlay
// itself (a cover with the big count + golden shelf, then a page per home planet; grey silhouettes for the
// looks still to find).
//
// Stored in localStorage: wiggle.spacepilot.passport  { v: 1, found: { "<recipe id>": { n, t, m: mission } } }

import { createCollection } from '../../../core/collection.js';
import { SHAPES, COLORS, PATTERNS, SHAPE, COLOR, HAT, SIZE, CATALOG_SIZE, PER_SHAPE, parseId, recipeName, rarity } from './recipes.js';

const STORE = 'wiggle.spacepilot.passport';
export const PASSPORT_KIND = 'space-pilot-passport';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function loadPassport() { return createCollection(STORE, { kind: PASSPORT_KIND, valid: (id) => !!parseId(id) }); }

export function passportStats(pp) {
  const ids = pp.ids();
  const byShape = {};
  let golden = 0, rare = 0;
  for (const id of ids) {
    const s = id.split('.')[0];
    byShape[s] = (byShape[s] || 0) + 1;
    const t = rarity(id);
    if (t === 'golden') golden++; else if (t === 'rare') rare++;
  }
  return { count: ids.length, total: CATALOG_SIZE, byShape, golden, rare };
}

// ---------- the friend drawing (2D canvas) ----------

function bodyPath(g, shape, R, t) {
  g.beginPath();
  if (shape === 'blob') {
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = R * (1 + Math.sin(a * 3 + t * 3) * 0.04);
      const x = Math.cos(a) * r * 1.05, y = Math.sin(a) * r * 0.95 + R * 0.05;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  } else if (shape === 'bean') {
    g.ellipse(0, 0, R * 0.78, R * 1.08, 0, 0, Math.PI * 2);
  } else if (shape === 'puff') {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.moveTo(Math.cos(a) * R * 0.72 + R * 0.34, Math.sin(a) * R * 0.72); g.arc(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72, R * 0.34, 0, Math.PI * 2); }
    g.moveTo(R * 0.8, 0); g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
  } else if (shape === 'jelly') {
    g.moveTo(-R, R * 0.2);
    g.arc(0, R * 0.2, R, Math.PI, 0);
    for (let i = 4; i >= 0; i--) { const x = -R + (i / 4) * 2 * R; g.lineTo(x, R * (0.55 + 0.25 * Math.sin(t * 4 + i * 1.7))); g.lineTo(x - R * 0.25, R * 0.2); }
    g.closePath();
  } else if (shape === 'bun') {
    for (const s of [-1, 1]) { g.moveTo(s * R * 0.35, -R * 0.6); g.ellipse(s * R * 0.38, -R * 1.15, R * 0.22, R * 0.62, s * 0.15, 0, Math.PI * 2); }
    g.moveTo(R, R * 0.1); g.ellipse(0, R * 0.1, R, R * 0.88, 0, 0, Math.PI * 2);
  } else { // twinkle: a chubby 5-point star
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? R * 0.7 : R * 1.12;
      const x = Math.cos(a) * r, y = Math.sin(a) * r + R * 0.08;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }
}

function drawPattern(g, pattern, R, ink) {
  g.fillStyle = ink; g.strokeStyle = ink;
  if (pattern === 'spots') for (const [x, y, r] of [[-0.55, -0.4, 0.18], [0.5, -0.5, 0.15], [0.6, 0.35, 0.17], [-0.45, 0.5, 0.14], [0.05, 0.75, 0.12]]) { g.beginPath(); g.arc(x * R, y * R, r * R, 0, Math.PI * 2); g.fill(); }
  if (pattern === 'stripes') for (let y = -1.2; y < 1.3; y += 0.45) g.fillRect(-R * 1.3, y * R, R * 2.6, R * 0.17);
  if (pattern === 'swirl') { g.lineWidth = R * 0.12; g.beginPath(); for (let a = 0; a < 14; a += 0.2) { const r = a * R * 0.08; const x = Math.cos(a) * r, y = Math.sin(a) * r + R * 0.2; if (a) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
  if (pattern === 'sparkles') { g.fillStyle = '#ffffff'; for (const [x, y] of [[-0.6, -0.5], [0.55, -0.3], [-0.2, 0.6], [0.65, 0.55], [0.1, -0.85]]) { g.fillRect(x * R - R * 0.03, y * R - R * 0.14, R * 0.06, R * 0.28); g.fillRect(x * R - R * 0.14, y * R - R * 0.03, R * 0.28, R * 0.06); } }
}

// opts: { t (s, animates), silhouette (grey "still to find"), wave (0..1 waving arm), happy }
export function drawFriend(g, id, x, y, R, opts = {}) {
  const r = typeof id === 'string' ? parseId(id) : id;
  if (!r) return;
  const t = opts.t || 0;
  const col = COLOR[r.color];
  g.save();
  g.translate(x, y);
  const sil = !!opts.silhouette;
  // waving arm (behind the body)
  if (opts.wave && !sil) {
    g.strokeStyle = col.hex; g.lineCap = 'round'; g.lineWidth = R * 0.22;
    const a = -0.9 + Math.sin(t * 12) * 0.5 * opts.wave;
    g.beginPath(); g.moveTo(R * 0.7, 0); g.lineTo(R * 0.7 + Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6); g.stroke();
  }
  bodyPath(g, r.shape, R, t);
  g.fillStyle = sil ? 'rgba(255,255,255,.14)' : col.hex;
  g.fill('nonzero');
  if (!sil) {
    g.save(); bodyPath(g, r.shape, R, t); g.clip('nonzero');
    const ink = ['white', 'yellow', 'gold'].includes(r.color) ? 'rgba(90,60,140,.4)' : 'rgba(255,255,255,.55)';
    drawPattern(g, r.pattern, R, ink);
    // soft shine
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-R * 0.35, -R * 0.45, R * 0.35, R * 0.2, -0.5, 0, Math.PI * 2); g.fill();
    g.restore();
    g.lineWidth = Math.max(1.5, R * 0.07); g.strokeStyle = 'rgba(40,20,80,.55)'; bodyPath(g, r.shape, R, t); g.stroke();
    // face: big eyes, a smile, rosy cheeks
    const ey = r.shape === 'jelly' ? -R * 0.15 : -R * 0.12, ex = R * 0.34, er = R * 0.26;
    for (const s of [-1, 1]) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(s * ex, ey, er, er * 1.15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1140'; g.beginPath(); g.arc(s * ex + R * 0.03, ey + R * 0.05, er * 0.58, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * ex - R * 0.05, ey - R * 0.06, er * 0.22, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,90,140,.45)'; g.beginPath(); g.ellipse(s * R * 0.58, ey + R * 0.38, R * 0.13, R * 0.08, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#1b1140'; g.lineWidth = Math.max(1.5, R * 0.08); g.lineCap = 'round';
    g.beginPath(); g.arc(0, ey + R * 0.32, R * (opts.happy ? 0.24 : 0.17), 0.25, Math.PI - 0.25); g.stroke();
    drawHat(g, r.hat, R, t, r.shape);
  }
  g.restore();
}

function drawHat(g, hat, R, t, shape) {
  const top = shape === 'bean' ? -R * 1.05 : shape === 'twinkle' ? -R * 1.0 : shape === 'bun' ? -R * 0.78 : -R * 0.92;
  g.lineCap = 'round';
  if (hat === 'antenna') {
    g.strokeStyle = '#1b1140'; g.lineWidth = R * 0.07;
    for (const s of [-1, 1]) {
      const bx = s * R * 0.25, tx = s * R * 0.5, ty = top - R * 0.5 + Math.sin(t * 5 + s) * R * 0.05;
      g.beginPath(); g.moveTo(bx, top + R * 0.1); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(tx, ty, R * 0.12, 0, Math.PI * 2); g.fill();
    }
  } else if (hat === 'bow') {
    g.fillStyle = '#ff4d8d';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(R * 0.3, top); g.lineTo(R * 0.3 + s * R * 0.32, top - R * 0.2); g.lineTo(R * 0.3 + s * R * 0.32, top + R * 0.2); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(R * 0.3, top, R * 0.09, 0, Math.PI * 2); g.fill();
  } else if (hat === 'party') {
    g.fillStyle = '#4d8dff'; g.beginPath(); g.moveTo(-R * 0.25, top + R * 0.08); g.lineTo(R * 0.25, top + R * 0.08); g.lineTo(R * 0.05, top - R * 0.6); g.closePath(); g.fill();
    g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(R * 0.05, top - R * 0.62, R * 0.1, 0, Math.PI * 2); g.fill();
  } else if (hat === 'propeller') {
    g.fillStyle = '#ff6b3d'; g.beginPath(); g.arc(0, top + R * 0.1, R * 0.32, Math.PI, 0); g.fill();
    g.strokeStyle = '#1b1140'; g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(0, top - R * 0.2); g.lineTo(0, top - R * 0.36); g.stroke();
    const w = Math.cos(t * 18) * R * 0.45;
    g.fillStyle = '#ffe14d'; g.beginPath(); g.ellipse(0, top - R * 0.38, Math.abs(w) + 1, R * 0.07, 0, 0, Math.PI * 2); g.fill();
  } else if (hat === 'helmet') {
    g.strokeStyle = 'rgba(200,240,255,.9)'; g.lineWidth = R * 0.08; g.fillStyle = 'rgba(180,230,255,.18)';
    g.beginPath(); g.arc(0, -R * 0.05, R * 1.25, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-R * 0.6, -R * 0.7, R * 0.2, R * 0.08, -0.7, 0, Math.PI * 2); g.fill();
  } else if (hat === 'crown') {
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#c98a00'; g.lineWidth = R * 0.04;
    g.beginPath(); g.moveTo(-R * 0.35, top + R * 0.1);
    for (let i = 0; i <= 4; i++) { g.lineTo(-R * 0.35 + i * R * 0.175, top - (i % 2 ? R * 0.12 : R * 0.38)); }
    g.lineTo(R * 0.35, top + R * 0.1); g.closePath(); g.fill(); g.stroke();
  }
}

// a friend as a small canvas element (passport pages, score card)
export function friendEl(id, { found = true, size = 64 } = {}) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(size * dpr);
  cv.style.width = cv.style.height = `${size}px`;
  cv.className = `sp-friend ${found ? rarity(id) : 'unfound'}`;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const r = parseId(id);
  const R = size * 0.36 * (found ? SIZE[r.size].scale ** 0.5 : 1);
  drawFriend(g, id, size / 2, size * 0.54, R, { silhouette: !found, t: 0.3 });
  return cv;
}

// ---------- the passport (DOM overlay) ----------

const STYLE = `
.sp-pass { position: fixed; inset: 0; z-index: 6; background: radial-gradient(ellipse at 50% 0%, #2a1f6a, #0d0a2a 70%); color: #fff; display: flex; flex-direction: column;
  font-family: ui-rounded, system-ui, sans-serif; padding: max(14px, env(safe-area-inset-top)) 12px max(14px, env(safe-area-inset-bottom)); box-sizing: border-box; }
.sp-pass[hidden] { display: none; }
.sp-pass .top { display: flex; align-items: center; gap: 10px; }
.sp-pass .big { font-size: clamp(24px, 5.5vmin, 50px); font-weight: 900; }
.sp-pass button { font: inherit; font-weight: 900; color: #fff; background: rgba(255,255,255,.15); border: 3px solid rgba(255,255,255,.35);
  border-radius: 18px; padding: 8px 14px; cursor: pointer; font-size: clamp(18px, 3.4vmin, 28px); }
.sp-pass button:active { transform: scale(.94); }
.sp-pass .close { margin-left: auto; width: 64px; height: 64px; border-radius: 50%; padding: 0; font-size: 30px; flex: none; }
.sp-pass .tabs { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0; -webkit-overflow-scrolling: touch; flex: none; }
.sp-pass .tabs button { flex: none; padding: 4px 10px; font-size: 26px; position: relative; }
.sp-pass .tabs button.on { border-color: #5ee0ff; background: rgba(94,224,255,.25); }
.sp-pass .tabs button .n { position: absolute; right: -4px; bottom: -6px; font-size: 11px; background: #ff5ea8; border-radius: 8px; padding: 0 4px; }
.sp-pass .page { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.sp-pass .grid { display: grid; gap: 4px; grid-template-columns: repeat(var(--cols, 9), minmax(0, 1fr)); justify-items: center; }
.sp-pass .row-label { opacity: .7; font-size: 13px; margin: 6px 0 2px; }
.sp-pass .info { min-height: 34px; font-size: clamp(16px, 3vmin, 24px); font-weight: 800; color: #5ee0ff; padding: 6px 0; }
.sp-pass .nav { display: flex; justify-content: space-between; gap: 10px; padding-top: 8px; flex: none; }
.sp-pass .nav button { min-width: 96px; font-size: 34px; }
.sp-pass .cover { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.sp-pass .shelf { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-height: 80px; padding: 10px; border-radius: 16px; background: rgba(255,204,51,.12); border: 3px dashed rgba(255,204,51,.5); }
.sp-pass .stamp { display: inline-block; border: 4px solid #ff5ea8; color: #ff5ea8; border-radius: 12px; padding: 2px 10px; transform: rotate(-6deg); font-weight: 900; }
.sp-friend { border-radius: 50%; background: rgba(255,255,255,.06); cursor: pointer; max-width: 100%; height: auto !important; aspect-ratio: 1; }
.sp-friend.unfound { cursor: default; }
.sp-friend.rare { box-shadow: 0 0 0 3px #d9c2ff, 0 0 14px 4px rgba(180,140,255,.7); }
.sp-friend.golden { box-shadow: 0 0 0 4px #ffe14d, 0 0 22px 8px rgba(255,190,0,.8); }
`;

// opts: { passport, say(text), onClose() }
export function createPassport(opts) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'sp-pass'; root.hidden = true;
  root.innerHTML = `<div class="top"><span class="big">🛂</span><span class="big count"></span><button class="close" aria-label="Close the passport">✕</button></div>
    <div class="tabs"></div><div class="info"></div><div class="page"></div>
    <div class="nav"><button class="prev" aria-label="Previous page">◀</button><button class="next" aria-label="Next page">▶</button></div>`;
  document.body.append(root);
  for (const ev of ['keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let page = 0; // 0 = cover, 1.. = SHAPES[page - 1]
  const pp = opts.passport;

  $('.close').onclick = () => close();
  $('.prev').onclick = () => go(page - 1);
  $('.next').onclick = () => go(page + 1);
  const info = (text, speak = true) => { $('.info').textContent = text; if (speak) opts.say?.(text); };
  const clickable = (el, id) => { el.onclick = () => info(`${recipeName(id)}! From ${SHAPE[parseId(id).shape].planet}!`); };

  function render() {
    const st = passportStats(pp);
    $('.count').textContent = `${fmt(st.count)} friends`;
    const tabs = $('.tabs'); tabs.textContent = '';
    const mk = (label, i, n) => { const b = document.createElement('button'); b.textContent = label; if (n) { const s = document.createElement('span'); s.className = 'n'; s.textContent = n; b.append(s); } b.classList.toggle('on', i === page); b.onclick = () => go(i); tabs.append(b); };
    mk('🛂', 0, 0);
    SHAPES.forEach((s, i) => mk(s.planetEmoji, i + 1, st.byShape[s.key] || 0));
    const pg = $('.page'); pg.textContent = '';
    if (page === 0) {
      const c = document.createElement('div'); c.className = 'cover';
      c.innerHTML = `<div class="big">ALIEN PASSPORT</div><div class="big" style="color:#5ee0ff">${fmt(st.count)} friends rescued!</div><div>of ${fmt(st.total)} kinds · ✨ ${st.rare} rare · 🌟 ${st.golden} golden</div><div class="row-label">GOLDEN FRIENDS</div>`;
      const shelf = document.createElement('div'); shelf.className = 'shelf';
      const golden = pp.ids().filter((id) => rarity(id) === 'golden');
      if (!golden.length) shelf.append(Object.assign(document.createElement('div'), { textContent: '🌟 ? 🌟  Golden friends go here!' }));
      for (const id of golden) { const e = friendEl(id, { size: 72 }); clickable(e, id); shelf.append(e); }
      c.append(shelf);
      const recent = pp.ids().map((id) => [id, pp.get(id)]).sort((a, b) => b[1].t - a[1].t).slice(0, 18);
      if (recent.length) {
        c.append(Object.assign(document.createElement('div'), { className: 'row-label', textContent: 'NEWEST FRIENDS' }));
        const grid = document.createElement('div'); grid.className = 'grid'; grid.style.setProperty('--cols', 6); grid.style.width = '100%';
        for (const [id] of recent) { const e = friendEl(id, { size: 64 }); clickable(e, id); grid.append(e); }
        c.append(grid);
      }
      pg.append(c);
      info(`My friends: ${fmt(st.count)}`, false);
    } else {
      const shape = SHAPES[page - 1];
      // a slot per color x pattern: shows the first friend found with that look (hats / sizes are extras)
      const slots = {};
      for (const id of pp.ids()) {
        const r = parseId(id);
        if (r.shape !== shape.key) continue;
        (slots[`${r.color}.${r.pattern}`] ||= []).push({ id, t: pp.get(id).t });
      }
      const filled = Object.keys(slots).length;
      const head = document.createElement('div'); head.className = 'cover';
      head.innerHTML = `<div class="big">${shape.planetEmoji} ${shape.planet}</div><div>${shape.name}s · ${st.byShape[shape.key] || 0} / ${fmt(PER_SHAPE)} · ${filled} / ${COLORS.length * PATTERNS.length} looks</div>`;
      if (filled) { const s = document.createElement('div'); s.className = 'stamp'; s.textContent = `VISITED ${shape.planet.toUpperCase()}`; head.append(s); }
      pg.append(head);
      const grid = document.createElement('div'); grid.className = 'grid'; grid.style.setProperty('--cols', COLORS.length);
      const size = Math.max(30, Math.min(76, (innerWidth - 40) / COLORS.length - 6));
      for (const p of PATTERNS) for (const c of COLORS) {
        const list = (slots[`${c.key}.${p.key}`] || []).sort((a, b) => a.t - b.t);
        const id = list.length ? list[0].id : `${shape.key}.${c.key}.${p.key}.none.normal`;
        const e = friendEl(id, { found: !!list.length, size });
        if (list.length) clickable(e, id);
        grid.append(e);
      }
      pg.append(grid);
      info(filled ? `${shape.planet}!` : `No friends from ${shape.planet} yet!`, false);
    }
    $('.prev').style.visibility = page > 0 ? 'visible' : 'hidden';
    $('.next').style.visibility = page < SHAPES.length ? 'visible' : 'hidden';
  }
  function go(i) { page = Math.max(0, Math.min(SHAPES.length, i)); render(); }
  function open(shapeKey) { root.hidden = false; const i = SHAPES.findIndex((s) => s.key === shapeKey); go(i >= 0 ? i + 1 : 0); }
  function close() { root.hidden = true; opts.onClose?.(); }
  return {
    open, close, render,
    get isOpen() { return !root.hidden; },
    destroy() { root.remove(); style.remove(); },
  };
}

