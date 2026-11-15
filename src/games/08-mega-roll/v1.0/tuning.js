// Parent tuning panel (🔧), from Smash Run's: live sliders for every feel setting, live readouts + a 5 s graph,
// presets saved on this device, a notes box, 💾 Export (settings + notes + session summary + numbers-only
// recording). Mega Roll adds: a SEED field (type a mountain number to roll it), on/off toggles, and sticker book
// export / import (to move stickers between devices). Always visible. The game keeps running underneath.

import { SETTINGS, PRESETS, DEFAULTS, saveTuning } from './settings.js';

const STYLE = `
.mr-root { position: fixed; inset: 0; pointer-events: none; font-family: var(--font, system-ui, sans-serif); color: #fff; z-index: 5; }
.mr-root > * { pointer-events: auto; }
.mr-wrench { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  width: 46px; height: 46px; border-radius: 50%; font-size: 22px; border: 2px solid rgba(255,255,255,.4); opacity: .8;
  background: rgba(27,17,64,.6); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.mr-wrench:active { transform: scale(.9); }
.mr-panel { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 54px);
  width: min(440px, calc(100vw - 16px)); max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(16,10,40,.93); border: 2px solid rgba(255,255,255,.25); border-radius: 16px; padding: 12px;
  font-size: 14px; line-height: 1.35; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; }
.mr-panel[hidden] { display: none; }
.mr-panel h3 { margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.mr-panel button { font: inherit; font-size: 14px; font-weight: 700; color: #fff; background: rgba(255,255,255,.14);
  border: 2px solid rgba(255,255,255,.25); border-radius: 10px; padding: 7px 11px; cursor: pointer; }
.mr-panel button.on { border-color: #ffcc33; background: rgba(255,204,51,.25); }
.mr-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mr-read { font: 12px/1.45 ui-monospace, monospace; background: rgba(0,0,0,.3); border-radius: 8px; padding: 6px 8px; white-space: pre-wrap; }
.mr-panel canvas { width: 100%; height: 130px; background: rgba(0,0,0,.35); border-radius: 10px; display: block; }
.mr-slider { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.mr-slider label { font-weight: 700; }
.mr-slider .val { font: 700 13px ui-monospace, monospace; color: #ffcc33; text-align: right; }
.mr-slider .val.changed::after { content: ' •'; color: #ff5ea8; }
.mr-slider input { grid-column: 1 / -1; width: 100%; accent-color: #ffcc33; }
.mr-slider .hint { grid-column: 1 / -1; opacity: .6; font-size: 11px; margin-top: -2px; }
.mr-note { width: 100%; box-sizing: border-box; font: 14px/1.35 system-ui, sans-serif; color: #fff; background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.3); border-radius: 10px; padding: 8px 10px; resize: vertical; min-height: 70px;
  user-select: text; -webkit-user-select: text; }
.mr-dim { opacity: .65; font-size: 12px; }
.mr-seed { width: 90px; font: 700 16px ui-monospace, monospace; color: #fff; background: rgba(0,0,0,.35); border: 2px solid rgba(255,255,255,.3);
  border-radius: 10px; padding: 6px 8px; user-select: text; -webkit-user-select: text; }
.mr-toggle { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.mr-toggle label { font-weight: 700; }
`;

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmtVal = (s, v) => (s.step >= 1 ? String(Math.round(v)) : (+v).toFixed(s.step < 0.05 ? 2 : s.step < 0.5 ? 2 : 1));

// opts: { ctx, tuning: {settings, preset, notes}, onChange(settings), readouts() -> string,
//         graph() -> { v, lines: [{v, label, color}] }, exportFile() -> filename, actions: [{label, fn}] }
export function createTuning(opts) {
  const { tuning } = opts;
  const style = h('style'); style.textContent = STYLE; document.head.append(style);
  const root = h('div', 'mr-root');
  const wrench = h('button', 'mr-wrench', '🔧'); wrench.setAttribute('aria-label', 'Tuning panel (for grown-ups)');
  const panel = h('div', 'mr-panel'); panel.hidden = true;
  root.append(wrench, panel);
  document.body.append(root);
  // typing in the panel (notes, slider arrows) must never reach the game or the debug keys
  for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());

  const title = h('h3'); const close = h('button', null, '✕'); title.append(h('span', null, '🔧 Mega Roll tuning'), close);

  // mountain seed: type a number and roll it (same number = same mountain)
  const seedRow = h('div', 'mr-row');
  const seedIn = h('input', 'mr-seed'); seedIn.type = 'number'; seedIn.min = 1; seedIn.max = 9999; seedIn.inputMode = 'numeric';
  seedIn.setAttribute('aria-label', 'Mountain number');
  const seedGo = h('button', null, '🏔️ Roll it'); const seedNew = h('button', null, '🎲 New'); const seedInfo = h('div', 'mr-dim');
  seedRow.append(h('span', null, 'Mountain'), seedIn, seedGo, seedNew);
  seedGo.onclick = () => { const v = Math.round(+seedIn.value); if (v >= 1 && v <= 9999) opts.onSeed(v); };
  seedIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') seedGo.onclick(); });
  seedNew.onclick = () => opts.onSeed(null);

  const presetRow = h('div', 'mr-row');
  const presetBtns = Object.keys(PRESETS).map((name) => { const b = h('button', null, name); b.onclick = () => applyPreset(name); presetRow.append(b); return b; });
  const resetBtn = h('button', null, '↺ Reset'); resetBtn.onclick = () => applyPreset('Default');
  presetRow.append(resetBtn);
  const presetInfo = h('div', 'mr-dim');

  const read = h('div', 'mr-read');
  const graphName = h('div', 'mr-dim', 'Last 5 s: steering (white: up = right, down = left; middle = straight), deadzone (yellow), bonks / jumps (lines). Shaded = airplane arms');
  const canvas = h('canvas');

  const sliders = h('div'); sliders.style.cssText = 'display:flex;flex-direction:column;gap:9px';
  const inputs = {};
  for (const s of SETTINGS) {
    if (s.type === 'toggle') {
      const box = h('div', 'mr-toggle');
      const b = h('button');
      box.append(h('label', null, s.label), b, h('div', 'mr-dim', s.hint));
      b.onclick = () => { tuning.settings[s.key] = tuning.settings[s.key] ? 0 : 1; tuning.preset = 'Custom'; changed(); };
      inputs[s.key] = { toggle: b, s };
      sliders.append(box);
      continue;
    }
    const box = h('div', 'mr-slider');
    const lab = h('label', null, s.label); const val = h('span', 'val');
    const inp = h('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step;
    const id = `mr-${s.key}`; inp.id = id; lab.htmlFor = id;
    box.append(lab, val, inp, h('div', 'hint', s.hint));
    inp.addEventListener('input', () => {
      tuning.settings[s.key] = +inp.value;
      tuning.preset = 'Custom';
      changed();
    });
    inputs[s.key] = { inp, val, s };
    sliders.append(box);
  }

  const actionRow = h('div', 'mr-row');
  for (const a of opts.actions || []) { const b = h('button', null, a.label); b.onclick = a.fn; actionRow.append(b); }

  const note = h('textarea', 'mr-note');
  note.placeholder = 'Notes: does leaning feel good, or does he try airplane arms? Assist too strong? Same mountain or new? Which stickers does he point at? Is 60 s right?';
  note.value = tuning.notes || '';
  note.addEventListener('input', () => { tuning.notes = note.value; saveTuning(tuning); });
  const exportRow = h('div', 'mr-row');
  const exportBtn = h('button', null, '💾 Export'); const exportInfo = h('span', 'mr-dim');
  exportRow.append(exportBtn, exportInfo);
  exportBtn.onclick = () => { const name = opts.exportFile(); exportInfo.textContent = name ? `saved ${name}` : 'nothing recorded yet'; };
  // sticker book: export / import (moves stickers + best scores between devices; import merges, never deletes)
  const bookRow = h('div', 'mr-row');
  const bookExport = h('button', null, '📖 Export stickers'); const bookImport = h('button', null, '📥 Import stickers'); const bookInfo = h('div', 'mr-dim');
  const file = h('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
  bookRow.append(bookExport, bookImport, file);
  bookExport.onclick = () => { bookInfo.textContent = opts.exportBook(); };
  bookImport.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0]; if (!f) return;
    try { bookInfo.textContent = opts.importBook(await f.text()); } catch (e) { bookInfo.textContent = `Could not import: ${e.message}`; }
    file.value = '';
  };

  panel.append(title, seedRow, seedInfo, presetRow, presetInfo, read, graphName, canvas,
    h('div', 'mr-dim', 'Settings apply instantly and are saved on this device.'), sliders,
    h('div', 'mr-dim', 'Game:'), actionRow, note, exportRow, h('div', 'mr-dim', 'Sticker book (this device):'), bookRow, bookInfo);

  wrench.onclick = () => { panel.hidden = !panel.hidden; refresh(); };
  close.onclick = () => { panel.hidden = true; };

  function applyPreset(name) {
    Object.assign(tuning.settings, name === 'Default' ? DEFAULTS : PRESETS[name]);
    tuning.preset = name;
    changed();
  }
  function changed() {
    saveTuning(tuning);
    opts.onChange(tuning.settings);
    syncInputs();
  }
  function syncInputs() {
    for (const { inp, val, s, toggle } of Object.values(inputs)) {
      const v = tuning.settings[s.key];
      if (toggle) { toggle.textContent = v ? 'ON' : 'OFF'; toggle.classList.toggle('on', !!v); continue; }
      if (document.activeElement !== inp) inp.value = v;
      val.textContent = fmtVal(s, v);
      val.classList.toggle('changed', Math.abs(v - s.def) > 1e-9);
    }
    presetBtns.forEach((b) => b.classList.toggle('on', b.textContent === tuning.preset));
    presetInfo.textContent = `Preset: ${tuning.preset}${tuning.preset === 'Custom' ? ' (your own settings)' : ''}`;
  }

  // ---------- graph ----------
  let samples = [], marks = [], lines = [], t = 0, textT = 0;
  function drawGraph() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (!w) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    const span = 5, t0 = t - span;
    const X = (tt) => ((tt - t0) / span) * w;
    const Y = (v) => hh - Math.max(0, Math.min(1, v)) * (hh - 10) - 5;
    g.setLineDash([6, 4]); g.lineWidth = 1.5; g.font = '11px ui-monospace, monospace'; g.textAlign = 'left';
    for (const l of lines) {
      g.strokeStyle = l.color; g.fillStyle = l.color;
      g.beginPath(); g.moveTo(0, Y(l.v)); g.lineTo(w, Y(l.v)); g.stroke();
      g.fillText(l.show ?? `${l.label} ${(+l.v).toFixed(2)}`, 4, Y(l.v) - 3);
    }
    g.setLineDash([]);
    for (const m of marks) {
      if (m.t < t0) continue;
      g.strokeStyle = m.color; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(m.t), 0); g.lineTo(X(m.t), hh); g.stroke();
      g.fillStyle = m.color; g.textAlign = 'center'; g.fillText(m.name, Math.min(w - 20, Math.max(20, X(m.t))), 12);
    }
    // shaded where airplane arms were steering
    g.fillStyle = 'rgba(255,204,51,.12)';
    for (const s of samples) if (s.aura && s.t >= t0) g.fillRect(X(s.t), 0, Math.max(1, w / 150), hh);
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath();
    let first = true;
    for (const s of samples) { if (s.t < t0) continue; const x = X(s.t), y = Y(s.v); if (first) g.moveTo(x, y); else g.lineTo(x, y); first = false; }
    g.stroke();
    const last = samples[samples.length - 1];
    if (last) { g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(last.v.toFixed(2), w - 4, 12); }
  }

  function refresh() {
    syncInputs(); read.textContent = opts.readouts();
    const m = opts.mountain();
    if (document.activeElement !== seedIn) seedIn.value = m.seed;
    seedInfo.textContent = `${m.title} · best ${m.best}`;
  }
  syncInputs();

  return {
    get open() { return !panel.hidden; },
    mark(name, color = '#ffcc33') { marks.push({ t, name, color }); },
    update(dt) {
      t += dt;
      const gs = opts.graph();
      lines = gs.lines;
      samples.push({ t, v: gs.v, aura: gs.aura });
      while (samples.length && samples[0].t < t - 6) samples.shift();
      while (marks.length && marks[0].t < t - 6) marks.shift();
      if (panel.hidden) return;
      drawGraph();
      textT -= dt;
      if (textT <= 0) { textT = 0.25; refresh(); }
    },
    destroy() { root.remove(); style.remove(); },
  };
}
