// Parent panel (🔧): live sliders (global + the current station), live readouts, how often each station
// was played (playtest data), 🎮 Keyboard, notes, 💾 Export. Plain DOM; the game keeps running underneath.

import { SETTINGS, DEFAULTS, saveTuning } from './settings.js';

const STYLE = `
.mm-wrench { position: fixed; top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); z-index: 6;
  width: 50px; height: 50px; border-radius: 50%; font-size: 22px; border: 2px solid rgba(255,255,255,.4); opacity: .8;
  background: rgba(27,17,64,.6); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.mm-panel { position: fixed; z-index: 7; right: max(8px, env(safe-area-inset-right)); top: calc(max(16px, env(safe-area-inset-top)) + 58px);
  width: min(440px, calc(100vw - 16px)); max-height: calc(100vh - 90px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(16,10,40,.94); border: 2px solid rgba(255,255,255,.25); border-radius: 16px; padding: 12px; color: #fff;
  font: 14px/1.35 system-ui, sans-serif; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; }
.mm-panel[hidden] { display: none; }
.mm-panel h3 { margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.mm-panel h4 { margin: 4px 0 0; font-size: 15px; color: #ffcc33; }
.mm-panel button { font: inherit; font-size: 14px; font-weight: 700; color: #fff; background: rgba(255,255,255,.14);
  border: 2px solid rgba(255,255,255,.25); border-radius: 10px; padding: 7px 11px; cursor: pointer; }
.mm-panel button.on { border-color: #ffcc33; background: rgba(255,204,51,.25); }
.mm-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mm-read { font: 12px/1.45 ui-monospace, monospace; background: rgba(0,0,0,.3); border-radius: 8px; padding: 6px 8px; white-space: pre-wrap; }
.mm-slider { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.mm-slider label { font-weight: 700; }
.mm-slider .val { font: 700 13px ui-monospace, monospace; color: #ffcc33; text-align: right; }
.mm-slider .val.changed::after { content: ' •'; color: #ff5ea8; }
.mm-slider input { grid-column: 1 / -1; width: 100%; accent-color: #ffcc33; }
.mm-slider .hint { grid-column: 1 / -1; opacity: .6; font-size: 11px; margin-top: -2px; }
.mm-note { width: 100%; box-sizing: border-box; font: 14px/1.35 system-ui, sans-serif; color: #fff; background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.3); border-radius: 10px; padding: 8px 10px; resize: vertical; min-height: 70px; user-select: text; -webkit-user-select: text; }
.mm-dim { opacity: .65; font-size: 12px; }
`;

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = (s, v) => (s.step >= 1 ? String(Math.round(v)) : (+v).toFixed(s.step < 0.05 ? 2 : 2));

// opts: { ctx, tuning, stations, group() -> current station id, onChange(), readouts() -> string,
//         stats() -> string, exportFile() -> filename, actions: [{label, fn}] }
export function createPanel(opts) {
  const { tuning } = opts;
  const style = h('style'); style.textContent = STYLE; document.head.append(style);
  const wrench = h('button', 'mm-wrench', '🔧'); wrench.setAttribute('aria-label', 'Tuning panel (for grown-ups)');
  const panel = h('div', 'mm-panel'); panel.hidden = true;
  document.body.append(wrench, panel);
  for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());

  const close = h('button', null, '✕');
  const title = h('h3'); title.append(h('span', null, '🔧 Magic Mirror'), close);
  const read = h('div', 'mm-read');
  const actions = h('div', 'mm-row');
  for (const a of opts.actions || []) { const b = h('button', null, a.label); b.onclick = a.fn; actions.append(b); }
  if (opts.ctx?.testinput) actions.append(opts.ctx.testinput.toggleButton());
  const globalBox = h('div'); const stationBox = h('div'); const stationTitle = h('h4');
  const reset = h('button', null, '↺ Reset all'); reset.onclick = () => { Object.assign(tuning.settings, DEFAULTS); changed(); build(); };
  const stats = h('div', 'mm-read');
  const note = h('textarea', 'mm-note');
  note.placeholder = 'Notes: which effects made him laugh? Did he get the voice lines? Was the cutout good enough?';
  note.value = tuning.notes || '';
  note.addEventListener('input', () => { tuning.notes = note.value; saveTuning(tuning); });
  const exp = h('div', 'mm-row'); const expBtn = h('button', null, '💾 Export'); const expInfo = h('span', 'mm-dim');
  exp.append(expBtn, expInfo);
  expBtn.onclick = () => { const name = opts.exportFile(); expInfo.textContent = name ? `saved ${name}` : 'nothing recorded yet'; };

  panel.append(title, read, actions, h('h4', null, 'Global'), globalBox, stationTitle, stationBox, h('div', 'mm-row'),
    reset, h('h4', null, 'Played on this device'), stats, note, exp,
    h('div', 'mm-dim', 'Export saves numbers only (tracking + settings + notes), never pictures. The camera picture never leaves this device.'));

  const inputs = [];
  function slider(s) {
    const box = h('div', 'mm-slider');
    const lab = h('label', null, s.label); const val = h('span', 'val');
    const inp = h('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step;
    inp.id = `mm-${s.key}`; lab.htmlFor = inp.id;
    box.append(lab, val);
    box.append(inp);
    if (s.hint) box.append(h('div', 'hint', s.hint));
    inp.addEventListener('input', () => { tuning.settings[s.key] = +inp.value; changed(); });
    inputs.push({ inp, val, s });
    return box;
  }
  let builtFor = null;
  function build() {
    inputs.length = 0;
    globalBox.replaceChildren(...SETTINGS.filter((s) => s.group === 'global').map(slider));
    const g = opts.group();
    const def = opts.stations.find((d) => d.id === g);
    stationTitle.textContent = def ? `${def.n} ${def.icon} ${def.title}` : 'Station';
    const list = SETTINGS.filter((s) => s.group === g);
    stationBox.replaceChildren(...(list.length ? list.map(slider) : [h('div', 'mm-dim', 'Pick a station to tune it.')]));
    builtFor = g;
    sync();
  }
  function sync() {
    for (const { inp, val, s } of inputs) {
      const v = tuning.settings[s.key];
      if (document.activeElement !== inp) inp.value = v;
      val.textContent = fmt(s, v);
      val.classList.toggle('changed', Math.abs(v - s.def) > 1e-9);
    }
  }
  function changed() { saveTuning(tuning); opts.onChange(); sync(); }

  wrench.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) { build(); refresh(); } };
  close.onclick = () => { panel.hidden = true; };
  function refresh() { read.textContent = opts.readouts(); stats.textContent = opts.stats(); }
  let tt = 0;
  return {
    get open() { return !panel.hidden; },
    update(dt) {
      if (panel.hidden) return;
      if (opts.group() !== builtFor) build();
      tt -= dt;
      if (tt <= 0) { tt = 0.25; refresh(); }
    },
    destroy() { wrench.remove(); panel.remove(); style.remove(); },
  };
}
