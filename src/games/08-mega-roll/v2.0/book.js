// The PASSPORT (v2.0): three theme books (🐄 Farm, 🌲 Forest, ❄️ Snowy) instead of 30 tabs. Each book is one
// scrolling page: a "Recently found" shelf, then a section per species / kind with its found stickers. Tap a
// sticker to hear its name and open the 3D viewer (viewer.js).
//
// Saved with the shared core collection under the SAME key as v1.0 ("wiggle.megaroll.book", { v: 1, found }),
// so every v1.0 sticker keeps loading (all v1.0 shapes still exist; tested in scripts/test-mega-roll-v2.js).
// Best scores per (theme, mountain) are separate from v1.0's (the v2.0 courses are different):
//   wiggle.megaroll.best2  { "farm:4721": 5230 }

import { createCollection } from '../../../core/collection.js';
import { SHAPES, COLORS, PATTERNS, HATS, SIZES, SIZE, HAT, COLOR, THEMES, THEME_OF, parseId, recipeName, rarity } from './recipes.js';
import { THEME_INFO } from './sections.js';

const BEST = 'wiggle.megaroll.best2';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const PER_SHAPE = COLORS.length * PATTERNS.length * HATS.length * SIZES.length;
export const shapesOf = (theme) => SHAPES.filter((s) => THEME_OF[s.key] === theme);
export const themeTotal = (theme) => shapesOf(theme).length * PER_SHAPE;

export function loadCollection(storage) {
  return createCollection('wiggle.megaroll.book', { kind: 'mega-roll-stickers', valid: (id) => !!parseId(id), storage });
}
export function themeCount(col, theme) { return col.ids().filter((id) => THEME_OF[id.split('.')[0]] === theme).length; }

export function loadBests() { try { return JSON.parse(localStorage.getItem(BEST)) || {}; } catch { return {}; } }
export function saveBests(b) { try { localStorage.setItem(BEST, JSON.stringify(b)); } catch { /* private mode */ } }

// ---------- sticker pictures (DOM, so CSS does patterns and grey silhouettes) ----------

const PATTERN_CSS = {
  plain: () => 'none',
  spots: (ink) => `radial-gradient(circle at 25% 25%, ${ink} 0 9%, transparent 10%), radial-gradient(circle at 75% 35%, ${ink} 0 8%, transparent 9%), radial-gradient(circle at 40% 75%, ${ink} 0 9%, transparent 10%), radial-gradient(circle at 82% 80%, ${ink} 0 7%, transparent 8%)`,
  stripes: (ink) => `repeating-linear-gradient(0deg, ${ink} 0 12%, transparent 12% 30%)`,
  checks: (ink) => `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0) 0 0 / 40% 40%`,
  sparkles: () => 'radial-gradient(circle at 25% 30%, #fff 0 5%, transparent 6%), radial-gradient(circle at 70% 22%, #fff 0 4%, transparent 5%), radial-gradient(circle at 60% 72%, #fff 0 6%, transparent 7%), radial-gradient(circle at 20% 80%, #fff 0 3%, transparent 4%)',
};

export function stickerEl(id, { found = true, size = 64 } = {}) {
  const r = parseId(id);
  const el = document.createElement('div');
  el.className = `mr-sticker ${found ? 'found' : 'unfound'} ${found ? rarity(r) : ''}`;
  el.style.setProperty('--s', `${size}px`);
  const col = COLOR[r.color];
  const ink = r.color === 'white' || r.color === 'yellow' || r.color === 'gold' ? 'rgba(60,40,90,.45)' : 'rgba(255,255,255,.75)';
  if (found) { el.style.backgroundColor = col.hex; el.style.background = `${PATTERN_CSS[r.pattern](ink)}, ${col.hex}`; }
  const shape = SHAPES.find((s) => s.key === r.shape);
  const em = document.createElement('span'); em.className = 'em'; em.textContent = shape.emoji;
  em.style.fontSize = `${size * 0.52 * SIZE[r.size].scale ** 0.5}px`;
  el.append(em);
  if (found && r.hat !== 'none') { const h = document.createElement('span'); h.className = 'hat'; h.textContent = HAT[r.hat].emoji; el.append(h); }
  if (found && r.size !== 'normal') { const z = document.createElement('span'); z.className = 'sz'; z.textContent = r.size === 'big' ? 'BIG' : 'tiny'; el.append(z); }
  return el;
}

// 2D canvas sticker (the in-game "NEW STICKER!" flyer): colored disc + emoji (+ hat)
export function drawSticker(g, id, x, y, R) {
  const r = parseId(id);
  const col = COLOR[r.color];
  g.save();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, R * 1.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = col.hex;
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
  if (rarity(r) !== 'common') { g.strokeStyle = rarity(r) === 'golden' ? '#ffb400' : '#b48cff'; g.lineWidth = R * 0.14; g.stroke(); }
  g.font = `${R * 1.1}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(SHAPES.find((s) => s.key === r.shape).emoji, x, y + R * 0.06);
  if (r.hat !== 'none') { g.font = `${R * 0.7}px sans-serif`; g.fillText(HAT[r.hat].emoji, x + R * 0.45, y - R * 0.6); }
  g.restore();
}

// ---------- the passport (DOM overlay) ----------

const STYLE = `
.mr-book { position: fixed; inset: 0; z-index: 6; background: rgba(20,12,50,.96); color: #fff; display: flex; flex-direction: column;
  font-family: ui-rounded, system-ui, sans-serif; padding: max(14px, env(safe-area-inset-top)) 12px max(14px, env(safe-area-inset-bottom)); box-sizing: border-box; }
.mr-book[hidden] { display: none; }
.mr-book .top { display: flex; align-items: center; gap: 8px; flex: none; }
.mr-book .big { font-size: clamp(24px, 5.5vmin, 50px); font-weight: 900; }
.mr-book button { font: inherit; font-weight: 900; color: #fff; background: rgba(255,255,255,.15); border: 3px solid rgba(255,255,255,.35);
  border-radius: 18px; padding: 8px 14px; cursor: pointer; font-size: clamp(16px, 3.2vmin, 26px); }
.mr-book button:active { transform: scale(.94); }
.mr-book .close { margin-left: auto; width: 64px; height: 64px; border-radius: 50%; padding: 0; font-size: 30px; flex: none; }
.mr-book .books { display: flex; gap: 8px; flex-wrap: wrap; }
.mr-book .books button { display: flex; flex-direction: column; align-items: center; line-height: 1.1; padding: 6px 12px; }
.mr-book .books button .e { font-size: 1.6em; }
.mr-book .books button .n { font-size: .65em; opacity: .85; }
.mr-book .books button.on { border-color: #ffcc33; background: rgba(255,204,51,.3); }
.mr-book .info { min-height: 30px; font-size: clamp(15px, 3vmin, 22px); font-weight: 800; color: #ffe14d; padding: 6px 0; flex: none; }
.mr-book .page { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: 20px; }
.mr-book h4 { margin: 14px 0 4px; font-size: clamp(18px, 3.6vmin, 28px); display: flex; align-items: center; gap: 8px; }
.mr-book h4 .c { font-size: .6em; opacity: .75; font-weight: 700; }
.mr-book .row { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.mr-book .shelf { display: flex; gap: 8px; overflow-x: auto; padding: 8px; border-radius: 16px; background: rgba(255,204,51,.12); border: 3px dashed rgba(255,204,51,.5); min-height: 70px; align-items: center; }
.mr-sticker { width: var(--s); height: var(--s); flex: none; border-radius: 50%; position: relative; display: flex; align-items: center;
  justify-content: center; box-shadow: 0 0 0 3px #fff, 0 3px 0 4px rgba(0,0,0,.25); margin: 6px; cursor: pointer; overflow: visible; }
.mr-sticker .em { line-height: 1; }
.mr-sticker .hat { position: absolute; top: -18%; right: -8%; font-size: calc(var(--s) * .34); }
.mr-sticker .sz { position: absolute; bottom: -10%; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 900; background: #1b1140; border-radius: 6px; padding: 0 4px; }
.mr-sticker.unfound { background: rgba(255,255,255,.08); box-shadow: 0 0 0 2px rgba(255,255,255,.18); cursor: default; }
.mr-sticker.unfound .em { filter: grayscale(1) brightness(0); opacity: .22; }
.mr-sticker.rare { box-shadow: 0 0 0 3px #d9c2ff, 0 0 14px 4px rgba(180,140,255,.8); }
.mr-sticker.golden { box-shadow: 0 0 0 4px #ffe14d, 0 0 22px 8px rgba(255,190,0,.9); animation: mrshine 1.2s ease-in-out infinite alternate; }
@keyframes mrshine { to { box-shadow: 0 0 0 4px #fff3a8, 0 0 30px 12px rgba(255,210,0,1); } }
`;

// opts: { col (collection), say(text), onClose(), viewer: { open(id, name) } }
export function createPassport(opts) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'mr-book'; root.hidden = true;
  root.innerHTML = `<div class="top"><span class="big">📖</span><div class="books"></div><button class="close" aria-label="Close the passport">✕</button></div>
    <div class="info"></div><div class="page"></div>`;
  document.body.append(root);
  for (const ev of ['keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let theme = 'farm';
  $('.close').onclick = () => close();
  const info = (text, speak = true) => { $('.info').textContent = text; if (speak) opts.say?.(text); };
  const sticker = (id, found = true, size = 60) => {
    const e = stickerEl(id, { found, size });
    if (found) e.onclick = () => { const f = opts.col.get(id); info(`${recipeName(id)}!${f?.m ? ` Found on Mountain ${f.m}` : ''}`); opts.viewer?.open(id, recipeName(id)); };
    return e;
  };

  function render() {
    const books = $('.books'); books.textContent = '';
    for (const th of THEMES) {
      const T = THEME_INFO[th];
      const b = document.createElement('button');
      b.innerHTML = `<span class="e">${T.emoji}</span><span>${T.title}</span><span class="n">${fmt(themeCount(opts.col, th))} / ${fmt(themeTotal(th))}</span>`;
      b.classList.toggle('on', th === theme);
      b.onclick = () => { theme = th; render(); opts.say?.(`${T.title} book!`); };
      books.append(b);
    }
    const pg = $('.page'); pg.textContent = ''; pg.scrollTop = 0;
    const T = THEME_INFO[theme];
    const mine = opts.col.ids().filter((id) => THEME_OF[id.split('.')[0]] === theme);
    // recently found shelf
    const h = document.createElement('h4'); h.innerHTML = `🆕 Recently found <span class="c">${T.emoji} ${T.title}: ${fmt(mine.length)} / ${fmt(themeTotal(theme))}</span>`; pg.append(h);
    const shelf = document.createElement('div'); shelf.className = 'shelf';
    const recent = mine.sort((a, b) => (opts.col.get(b).t || 0) - (opts.col.get(a).t || 0)).slice(0, 14);
    if (!recent.length) shelf.append(Object.assign(document.createElement('div'), { textContent: `Roll down a ${T.title} mountain to find stickers!` }));
    for (const id of recent) shelf.append(sticker(id, true, 64));
    pg.append(shelf);
    // a section per species / kind (animals first)
    const shapes = shapesOf(theme).sort((a, b) => (a.kind === 'critter' ? 0 : a.kind === 'thing' ? 1 : 2) - (b.kind === 'critter' ? 0 : b.kind === 'thing' ? 1 : 2));
    for (const s of shapes) {
      const found = mine.filter((id) => id.startsWith(`${s.key}.`)).sort((a, b) => (opts.col.get(a).t || 0) - (opts.col.get(b).t || 0));
      const hh = document.createElement('h4'); hh.innerHTML = `${s.emoji} ${s.name}${s.kind === 'critter' ? ' 🐾' : ''} <span class="c">${found.length} / ${fmt(PER_SHAPE)}</span>`; pg.append(hh);
      const row = document.createElement('div'); row.className = 'row';
      for (const id of found) row.append(sticker(id, true, 56));
      // a few grey "still to find" silhouettes
      for (let k = 0; k < (found.length ? 2 : 4); k++) row.append(sticker(`${s.key}.white.plain.none.normal`, false, 56));
      pg.append(row);
    }
    info(`${T.title} book: ${fmt(mine.length)} stickers`, false);
  }
  function open(th) { if (th) theme = th; root.hidden = false; render(); }
  function close() { root.hidden = true; opts.onClose?.(); }
  return { open, close, render, get isOpen() { return !root.hidden; }, destroy() { root.remove(); style.remove(); } };
}
