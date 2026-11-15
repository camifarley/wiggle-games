// The Sticker Book: what's been found (saved per device), best scores per mountain, export / import,
// and the DOM book itself (a cover page with the big count + golden shelf, then a page per shape).
//
// Stored in localStorage:
//   wiggle.megaroll.book  { v: 1, found: { "<recipe id>": { n: times bonked, m: first mountain, t: first time } } }
//   wiggle.megaroll.best  { "<seed>": best score }
// Ids are the stable recipe ids from recipes.js, so a book keeps working as the catalog grows.

import { SHAPES, COLORS, PATTERNS, SIZE, HAT, COLOR, CATALOG_SIZE, PER_SHAPE, parseId, recipeName, rarity } from './recipes.js';

const BOOK = 'wiggle.megaroll.book', BEST = 'wiggle.megaroll.best';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function loadBook() {
  try {
    const d = JSON.parse(localStorage.getItem(BOOK));
    if (d && d.found && typeof d.found === 'object') return { v: 1, found: d.found };
  } catch { /* empty */ }
  return { v: 1, found: {} };
}
export function saveBook(book) { try { localStorage.setItem(BOOK, JSON.stringify(book)); } catch { /* private mode */ } }

// returns true the FIRST time this kind is found
export function addSticker(book, id, seed) {
  const f = book.found[id];
  if (f) { f.n++; return false; }
  book.found[id] = { n: 1, m: seed, t: Date.now() };
  return true;
}

export function bookStats(book) {
  const ids = Object.keys(book.found).filter((id) => parseId(id));
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

export function loadBests() { try { return JSON.parse(localStorage.getItem(BEST)) || {}; } catch { return {}; } }
export function saveBests(b) { try { localStorage.setItem(BEST, JSON.stringify(b)); } catch { /* private mode */ } }

export function exportBookJSON(book, bests) {
  return JSON.stringify({ kind: 'mega-roll-stickers', version: 1, exportedAt: new Date().toISOString(), found: book.found, best: bests });
}
// merges another device's book into this one (never loses a sticker). Returns how many were new.
export function importBookJSON(book, bests, text) {
  const d = JSON.parse(text);
  if (d.kind !== 'mega-roll-stickers' || typeof d.found !== 'object') throw new Error('not a Mega Roll sticker file');
  let added = 0;
  for (const [id, f] of Object.entries(d.found)) {
    if (!parseId(id)) continue;
    const mine = book.found[id];
    if (!mine) { book.found[id] = { n: +f.n || 1, m: f.m ?? null, t: +f.t || Date.now() }; added++; }
    else { mine.n = Math.max(mine.n, +f.n || 1); if (+f.t && +f.t < mine.t) { mine.t = +f.t; mine.m = f.m; } }
  }
  for (const [seed, s] of Object.entries(d.best || {})) bests[seed] = Math.max(bests[seed] || 0, +s || 0);
  return added;
}

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

// ---------- the book (DOM overlay) ----------

const STYLE = `
.mr-book { position: fixed; inset: 0; z-index: 6; background: rgba(20,12,50,.96); color: #fff; display: flex; flex-direction: column;
  font-family: ui-rounded, system-ui, sans-serif; padding: max(14px, env(safe-area-inset-top)) 12px max(14px, env(safe-area-inset-bottom)); box-sizing: border-box; }
.mr-book[hidden] { display: none; }
.mr-book .top { display: flex; align-items: center; gap: 10px; }
.mr-book .big { font-size: clamp(26px, 6vmin, 54px); font-weight: 900; }
.mr-book button { font: inherit; font-weight: 900; color: #fff; background: rgba(255,255,255,.15); border: 3px solid rgba(255,255,255,.35);
  border-radius: 18px; padding: 8px 14px; cursor: pointer; font-size: clamp(18px, 3.4vmin, 28px); }
.mr-book button:active { transform: scale(.94); }
.mr-book .close { margin-left: auto; width: 64px; height: 64px; border-radius: 50%; padding: 0; font-size: 30px; }
.mr-book .tabs { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0; -webkit-overflow-scrolling: touch; flex: none; }
.mr-book .tabs button { flex: none; padding: 4px 8px; font-size: 26px; position: relative; }
.mr-book .tabs button.on { border-color: #ffcc33; background: rgba(255,204,51,.3); }
.mr-book .tabs button .n { position: absolute; right: -4px; bottom: -6px; font-size: 11px; background: #ff5ea8; border-radius: 8px; padding: 0 4px; }
.mr-book .page { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.mr-book .grid { display: grid; gap: 6px; grid-template-columns: repeat(var(--cols, 9), minmax(0, 1fr)); }
.mr-book .row-label { opacity: .7; font-size: 13px; margin: 6px 0 2px; }
.mr-book .info { min-height: 34px; font-size: clamp(16px, 3vmin, 24px); font-weight: 800; color: #ffe14d; padding: 6px 0; }
.mr-book .nav { display: flex; justify-content: space-between; gap: 10px; padding-top: 8px; flex: none; }
.mr-book .nav button { min-width: 96px; font-size: 34px; }
.mr-sticker { width: var(--s); height: var(--s); max-width: 100%; aspect-ratio: 1; border-radius: 50%; position: relative; display: flex; align-items: center;
  justify-content: center; box-shadow: 0 0 0 3px #fff, 0 3px 0 4px rgba(0,0,0,.25); margin: 4px auto; cursor: pointer; overflow: visible; }
.mr-sticker .em { line-height: 1; }
.mr-sticker .hat { position: absolute; top: -18%; right: -8%; font-size: calc(var(--s) * .34); }
.mr-sticker .sz { position: absolute; bottom: -10%; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 900; background: #1b1140; border-radius: 6px; padding: 0 4px; }
.mr-sticker.unfound { background: rgba(255,255,255,.08); box-shadow: 0 0 0 2px rgba(255,255,255,.18); cursor: default; }
.mr-sticker.unfound .em { filter: grayscale(1) brightness(0); opacity: .22; }
.mr-sticker.rare { box-shadow: 0 0 0 3px #d9c2ff, 0 0 14px 4px rgba(180,140,255,.8); }
.mr-sticker.golden { box-shadow: 0 0 0 4px #ffe14d, 0 0 22px 8px rgba(255,190,0,.9); animation: mrshine 1.2s ease-in-out infinite alternate; }
@keyframes mrshine { to { box-shadow: 0 0 0 4px #fff3a8, 0 0 30px 12px rgba(255,210,0,1); } }
.mr-sticker .cnt { position: absolute; top: -8%; left: -8%; font-size: 11px; font-weight: 900; background: #ff5ea8; border-radius: 8px; padding: 0 4px; }
.mr-book .cover { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.mr-book .shelf { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-height: 80px; padding: 10px; border-radius: 16px; background: rgba(255,204,51,.12); border: 3px dashed rgba(255,204,51,.5); }
.mr-book .stars { font-size: 26px; }
`;

// opts: { book, say(text), onClose() }
export function createBook(opts) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('div'); root.className = 'mr-book'; root.hidden = true;
  root.innerHTML = `<div class="top"><span class="big">📖</span><span class="big count"></span><button class="close" aria-label="Close the sticker book">✕</button></div>
    <div class="tabs"></div><div class="info"></div><div class="page"></div>
    <div class="nav"><button class="prev" aria-label="Previous page">◀</button><button class="next" aria-label="Next page">▶</button></div>`;
  document.body.append(root);
  for (const ev of ['keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let page = 0; // 0 = cover, 1.. = SHAPES[page - 1]

  $('.close').onclick = () => close();
  $('.prev').onclick = () => go(page - 1);
  $('.next').onclick = () => go(page + 1);

  const info = (text, speak = true) => { $('.info').textContent = text; if (speak) opts.say?.(text); };
  const clickable = (el, id) => {
    el.onclick = () => {
      const f = opts.book.found[id];
      info(f ? `${recipeName(id)}${f.m ? `! Found on Mountain ${f.m}` : '!'}` : '???');
    };
  };

  function stars(n) { const k = n >= COLORS.length * PATTERNS.length ? 3 : n >= 15 ? 2 : n >= 5 ? 1 : 0; return '⭐'.repeat(k) + '☆'.repeat(3 - k); }

  function render() {
    const st = bookStats(opts.book);
    $('.count').textContent = `${fmt(st.count)} / ${fmt(st.total)}`;
    // tabs: cover + one per shape (with how many found)
    const tabs = $('.tabs'); tabs.textContent = '';
    const mk = (label, i, n) => { const b = document.createElement('button'); b.textContent = label; if (n) { const s = document.createElement('span'); s.className = 'n'; s.textContent = n; b.append(s); } b.classList.toggle('on', i === page); b.onclick = () => go(i); tabs.append(b); return b; };
    mk('⭐', 0, 0);
    SHAPES.forEach((s, i) => mk(s.emoji, i + 1, st.byShape[s.key] || 0));
    tabs.children[page]?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    const pg = $('.page'); pg.textContent = '';
    if (page === 0) {
      const c = document.createElement('div'); c.className = 'cover';
      c.innerHTML = `<div class="big">${fmt(st.count)} stickers!</div><div>of ${fmt(st.total)} · ✨ ${st.rare} rare · 🌟 ${st.golden} golden</div><div class="row-label">GOLDEN SHELF</div>`;
      const shelf = document.createElement('div'); shelf.className = 'shelf';
      const golden = Object.keys(opts.book.found).filter((id) => parseId(id) && rarity(id) === 'golden');
      if (!golden.length) shelf.append(Object.assign(document.createElement('div'), { textContent: '🌟 ? 🌟  Golden stickers go here!' }));
      for (const id of golden) { const e = stickerEl(id, { size: 72 }); clickable(e, id); shelf.append(e); }
      c.append(shelf);
      const recent = Object.entries(opts.book.found).filter(([id]) => parseId(id)).sort((a, b) => b[1].t - a[1].t).slice(0, 18);
      if (recent.length) {
        c.append(Object.assign(document.createElement('div'), { className: 'row-label', textContent: 'NEWEST' }));
        const grid = document.createElement('div'); grid.className = 'grid'; grid.style.setProperty('--cols', 6); grid.style.width = '100%';
        for (const [id] of recent) { const e = stickerEl(id, { size: 64 }); clickable(e, id); grid.append(e); }
        c.append(grid);
      }
      pg.append(c);
      info(`My stickers: ${fmt(st.count)}`, false);
    } else {
      const shape = SHAPES[page - 1];
      // a slot per color x pattern; it shows the first sticker found with that look (hats / sizes are
      // extra variants: the pink badge counts how many of them)
      const slots = {};
      for (const [id, f] of Object.entries(opts.book.found)) {
        const r = parseId(id);
        if (!r || r.shape !== shape.key) continue;
        const k = `${r.color}.${r.pattern}`;
        (slots[k] ||= []).push({ id, t: f.t });
      }
      const filled = Object.keys(slots).length;
      const head = document.createElement('div');
      head.className = 'cover';
      head.innerHTML = `<div class="big">${shape.emoji} ${shape.name}</div><div class="stars">${stars(filled)}</div><div>${st.byShape[shape.key] || 0} / ${fmt(PER_SHAPE)} stickers · ${filled} / ${COLORS.length * PATTERNS.length} looks</div>`;
      pg.append(head);
      const grid = document.createElement('div'); grid.className = 'grid'; grid.style.setProperty('--cols', COLORS.length);
      const size = Math.max(30, Math.min(76, (innerWidth - 40) / COLORS.length - 8));
      for (const p of PATTERNS) for (const c of COLORS) {
        const list = (slots[`${c.key}.${p.key}`] || []).sort((a, b) => a.t - b.t);
        const id = list.length ? list[0].id : `${shape.key}.${c.key}.${p.key}.none.normal`;
        const e = stickerEl(id, { found: !!list.length, size });
        if (list.length > 1) { const n = document.createElement('span'); n.className = 'cnt'; n.textContent = `×${list.length}`; e.append(n); }
        if (list.length) clickable(e, id);
        grid.append(e);
      }
      pg.append(grid);
      info(filled ? `${shape.name} page!` : `No ${shape.name} stickers yet!`, false);
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

