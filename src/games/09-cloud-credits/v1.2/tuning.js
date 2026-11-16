// Grown-up panel (🔧), styled like Mega Roll's: scroll speed, text size, lean drift, interaction on/off, the
// Family credits box (names typed here stay in this device's localStorage, never in the repo), notes, 💾 export
// (settings + notes + what happened, never the family names). Always visible; the ride keeps going underneath.

import { SETTINGS, DEFAULTS, FAMILY, saveTuning, saveFamily } from './settings.js';

const STYLE = `
.cc-root { position: fixed; inset: 0; pointer-events: none; font-family: var(--font, system-ui, sans-serif); color: #fff; z-index: 5; }
.cc-root > * { pointer-events: auto; }
.cc-wrench { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  width: 46px; height: 46px; border-radius: 50%; font-size: 22px; border: 2px solid rgba(255,255,255,.4); opacity: .7;
  background: rgba(40,24,80,.55); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cc-wrench:active { transform: scale(.9); }
.cc-panel { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 54px);
  width: min(420px, calc(100vw - 16px)); max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(30,18,64,.94); border: 2px solid rgba(255,255,255,.25); border-radius: 16px; padding: 12px;
  font-size: 14px; line-height: 1.35; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; }
.cc-panel[hidden] { display: none; }
.cc-panel h3 { margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.cc-panel h4 { margin: 4px 0 0; font-size: 15px; }
.cc-panel button { font: inherit; font-size: 14px; font-weight: 700; color: #fff; background: rgba(255,255,255,.14);
  border: 2px solid rgba(255,255,255,.25); border-radius: 10px; padding: 7px 11px; cursor: pointer; }
.cc-panel button.on { border-color: #ffcc33; background: rgba(255,204,51,.25); }
.cc-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.cc-read { font: 12px/1.45 ui-monospace, monospace; background: rgba(0,0,0,.3); border-radius: 8px; padding: 6px 8px; white-space: pre-wrap; }
.cc-slider { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.cc-slider label { font-weight: 700; }
.cc-slider .val { font: 700 13px ui-monospace, monospace; color: #ffcc33; text-align: right; }
.cc-slider input { grid-column: 1 / -1; width: 100%; accent-color: #ffcc33; }
.cc-slider .hint { grid-column: 1 / -1; opacity: .6; font-size: 11px; margin-top: -2px; }
.cc-toggle { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.cc-toggle label { font-weight: 700; }
.cc-field { display: flex; flex-direction: column; gap: 3px; }
.cc-field label { font-weight: 700; font-size: 13px; }
.cc-in, .cc-note { width: 100%; box-sizing: border-box; font: 15px/1.35 system-ui, sans-serif; color: #fff; background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.3); border-radius: 10px; padding: 7px 10px; user-select: text; -webkit-user-select: text; }
.cc-note { resize: vertical; min-height: 64px; }
.cc-dim { opacity: .65; font-size: 12px; }
`;

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmtVal = (s, v) => (s.step >= 1 ? String(Math.round(v)) : (+v).toFixed(s.step < 0.1 ? 2 : 1));

// opts: { tuning, family, onChange(settings), onFamily(family), readouts() -> string, exportFile() -> name, actions: [{label, fn}] }
export function createTuning(opts) {
  const { tuning, family } = opts;
  const style = h('style'); style.textContent = STYLE; document.head.append(style);
  const root = h('div', 'cc-root');
  const wrench = h('button', 'cc-wrench', '🔧'); wrench.setAttribute('aria-label', 'Settings (for grown-ups)');
  const panel = h('div', 'cc-panel'); panel.hidden = true;
  root.append(wrench, panel);
  document.body.append(root);
  for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation()); // typing never reaches the game

  const title = h('h3'); const close = h('button', null, '✕'); title.append(h('span', null, '🔧 Cloud Credits'), close);
  const read = h('div', 'cc-read');
  const actionRow = h('div', 'cc-row');
  for (const a of opts.actions || []) { const b = h('button', null, a.label); b.onclick = a.fn; actionRow.append(b); }

  const sliders = h('div'); sliders.style.cssText = 'display:flex;flex-direction:column;gap:9px';
  const inputs = {};
  for (const s of SETTINGS) {
    if (s.type === 'toggle') {
      const box = h('div', 'cc-toggle'); const b = h('button');
      box.append(h('label', null, s.label), b, h('div', 'cc-dim', s.hint));
      b.onclick = () => { tuning.settings[s.key] = tuning.settings[s.key] ? 0 : 1; changed(); };
      inputs[s.key] = { toggle: b, s }; sliders.append(box);
      continue;
    }
    const box = h('div', 'cc-slider');
    const lab = h('label', null, s.label); const val = h('span', 'val');
    const inp = h('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step;
    inp.id = `cc-${s.key}`; lab.htmlFor = inp.id;
    box.append(lab, val, inp, h('div', 'hint', s.hint));
    inp.addEventListener('input', () => { tuning.settings[s.key] = +inp.value; changed(); });
    inputs[s.key] = { inp, val, s }; sliders.append(box);
  }
  const reset = h('button', null, '↺ Defaults'); reset.onclick = () => { Object.assign(tuning.settings, DEFAULTS); changed(); };

  // family credits: on this device only
  const famBox = h('div'); famBox.style.cssText = 'display:flex;flex-direction:column;gap:7px';
  for (const f of FAMILY) {
    const box = h('div', 'cc-field'); const inp = h('input', 'cc-in'); inp.type = 'text'; inp.placeholder = f.placeholder;
    inp.id = `cc-fam-${f.key}`; inp.maxLength = 40; inp.autocomplete = 'off'; inp.value = family[f.key] || '';
    const lab = h('label', null, f.label); lab.htmlFor = inp.id;
    inp.addEventListener('input', () => { family[f.key] = inp.value; famChanged(); });
    box.append(lab, inp); famBox.append(box);
  }
  const extra = h('textarea', 'cc-note'); extra.placeholder = 'More thank-yous, one per line:\nRex - best dog\nGrandma - cheering';
  extra.value = family.extra || '';
  extra.addEventListener('input', () => { family.extra = extra.value; famChanged(); });
  const famInfo = h('div', 'cc-dim', 'Saved only on this device (never uploaded). Shows on the next ride (🔁 Restart).');
  famBox.append(extra, famInfo);

  const note = h('textarea', 'cc-note');
  note.placeholder = 'Notes: did it calm him down? Too long? Did he chase stars or just watch? Readable from 2 m?';
  note.value = tuning.notes || '';
  note.addEventListener('input', () => { tuning.notes = note.value; saveTuning(tuning); });
  const exportRow = h('div', 'cc-row'); const exportBtn = h('button', null, '💾 Export'); const exportInfo = h('span', 'cc-dim');
  exportRow.append(exportBtn, exportInfo);
  exportBtn.onclick = () => { exportInfo.textContent = `saved ${opts.exportFile()} (no family names)`; };

  panel.append(title, read, actionRow, h('h4', null, 'Ride'), sliders, reset,
    h('h4', null, '💖 Family credits'), famBox, h('h4', null, '📝 Notes'), note, exportRow);

  wrench.onclick = () => { panel.hidden = !panel.hidden; refresh(); };
  close.onclick = () => { panel.hidden = true; };

  let famT = 0;
  function famChanged() { saveFamily(family); clearTimeout(famT); famT = setTimeout(() => opts.onFamily(family), 400); }
  function changed() { saveTuning(tuning); opts.onChange(tuning.settings); sync(); }
  function sync() {
    for (const { inp, val, s, toggle } of Object.values(inputs)) {
      const v = tuning.settings[s.key];
      if (toggle) { toggle.textContent = v ? 'ON' : 'OFF'; toggle.classList.toggle('on', !!v); continue; }
      if (document.activeElement !== inp) inp.value = v;
      val.textContent = fmtVal(s, v);
    }
  }
  function refresh() { sync(); read.textContent = opts.readouts(); }
  sync();

  let textT = 0;
  return {
    get open() { return !panel.hidden; },
    update(dt) { if (panel.hidden) return; textT -= dt; if (textT <= 0) { textT = 0.3; read.textContent = opts.readouts(); } },
    destroy() { clearTimeout(famT); root.remove(); style.remove(); },
  };
}
