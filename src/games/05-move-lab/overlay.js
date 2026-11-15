// Parent overlay (🔧): live signal graph with thresholds, event log, detected / expected with
// corrections, fun rating, and 💾 recording download. Plain DOM, styled by STYLE below.

const STYLE = `
.ml-root { position: fixed; inset: 0; pointer-events: none; font-family: var(--font); color: #fff; z-index: 5; }
.ml-root > * { pointer-events: auto; }
.ml-btn { position: absolute; border-radius: 50%; cursor: pointer; color: #fff; display: flex; align-items: center; justify-content: center;
  background: rgba(27,17,64,.6); font: inherit; }
.ml-btn:active { transform: scale(.9); }
.ml-btn[hidden] { display: none; }
.ml-hub { top: max(16px, env(safe-area-inset-top)); left: calc(max(16px, env(safe-area-inset-left)) + 92px);
  width: 76px; height: 76px; font-size: 40px; border: 4px solid rgba(255,255,255,.6); }
.ml-wrench { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  width: 46px; height: 46px; font-size: 22px; border: 2px solid rgba(255,255,255,.4); opacity: .8; }
.ml-panel { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 54px);
  width: min(430px, calc(100vw - 16px)); max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(16,10,40,.92); border: 2px solid rgba(255,255,255,.25); border-radius: 16px; padding: 12px;
  font-size: 15px; line-height: 1.35; display: flex; flex-direction: column; gap: 10px; }
.ml-panel[hidden], .ml-panel [hidden] { display: none; }
.ml-panel h3 { margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ml-panel canvas { width: 100%; height: 150px; background: rgba(0,0,0,.35); border-radius: 10px; display: block; }
.ml-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ml-note { width: 100%; box-sizing: border-box; font: 15px/1.35 system-ui, sans-serif; color: #fff; background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.3); border-radius: 10px; padding: 8px 10px; resize: vertical; user-select: text; -webkit-user-select: text;
  flex-shrink: 0; min-height: 72px; }
.ml-panel button { font: inherit; font-size: 15px; font-weight: 700; color: #fff; background: rgba(255,255,255,.14);
  border: 2px solid rgba(255,255,255,.25); border-radius: 10px; padding: 8px 12px; cursor: pointer; }
.ml-panel button.on { border-color: #ffcc33; background: rgba(255,204,51,.25); }
.ml-panel button:disabled { opacity: .4; }
.ml-big { font-size: 22px; font-weight: 900; }
.ml-log { font: 12px/1.35 ui-monospace, monospace; max-height: 160px; overflow-y: auto; background: rgba(0,0,0,.3);
  border-radius: 8px; padding: 6px 8px; white-space: pre-wrap; }
.ml-dim { opacity: .7; font-size: 12px; }
`;

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createOverlay(L) {
  const style = h('style'); style.textContent = STYLE; document.head.append(style);
  const root = h('div', 'ml-root');
  const hubBtn = h('button', 'ml-btn ml-hub', '🧪'); hubBtn.setAttribute('aria-label', 'Back to the lab'); hubBtn.hidden = true;
  const wrench = h('button', 'ml-btn ml-wrench', '🔧'); wrench.setAttribute('aria-label', 'Parent overlay');
  const panel = h('div', 'ml-panel'); panel.hidden = true;
  root.append(hubBtn, wrench, panel);
  document.body.append(root);

  const title = h('h3'); const titleText = h('span'); const close = h('button', null, '✕'); title.append(titleText, close);
  const signalName = h('div', 'ml-dim');
  const canvas = h('canvas');
  const score = h('div', 'ml-big');
  const confirmRow = h('div', 'ml-row');
  const yes = h('button', null, '✅ Yes'), notQuite = h('button', null, '✏️ Not quite');
  confirmRow.append(yes, notQuite);
  const stepRow = h('div', 'ml-row'); stepRow.hidden = true;
  const minus = h('button', null, '−'), trueLbl = h('span', 'ml-big'), plus = h('button', null, '+');
  stepRow.append(h('span', null, 'Real count:'), minus, trueLbl, plus);
  const funRow = h('div', 'ml-row'); funRow.append(h('span', null, 'Fun:'));
  const funBtns = ['😐', '🙂', '😄'].map((e, i) => { const b = h('button', null, e); b.onclick = () => setFun(i + 1); funRow.append(b); return b; });
  // free-text note: what the scores mean, what he did, what he enjoyed. Saved inside the recording.
  const note = h('textarea', 'ml-note');
  note.placeholder = 'Notes for Claude: what do these scores mean? What did he do, enjoy, or find hard?';
  note.rows = 3;
  const saveRow = h('div', 'ml-row');
  const save = h('button', null, '💾 Save recording'); const saveInfo = h('span', 'ml-dim');
  saveRow.append(save, saveInfo);
  const logEl = h('div', 'ml-log');
  const status = h('div', 'ml-dim');
  const resetRow = h('div', 'ml-row');
  const reset = h('button', null, '🔄 New passport'); resetRow.append(reset);
  panel.append(title, signalName, canvas, score, confirmRow, stepRow, funRow, note, saveRow, logEl, status, resetRow);

  let samples = [], marks = [], lines = [], log = [], textT = 0, lastLogLen = -1;
  const run = () => L.S.station || L.S.last;

  wrench.onclick = () => { panel.hidden = !panel.hidden; refresh(); };
  close.onclick = () => { panel.hidden = true; };
  hubBtn.onclick = () => L.toHub();
  yes.onclick = () => { const r = run(); if (!r) return; r.result.trueCount = r.count; r.result.confirmed = 'yes'; stepRow.hidden = true; refresh(); };
  notQuite.onclick = () => { const r = run(); if (!r) return; if (r.result.trueCount == null) r.result.trueCount = r.count; r.result.confirmed = 'corrected'; stepRow.hidden = false; refresh(); };
  minus.onclick = () => { const r = run(); if (r) { r.result.trueCount = Math.max(0, (r.result.trueCount ?? r.count) - 1); refresh(); } };
  plus.onclick = () => { const r = run(); if (r) { r.result.trueCount = (r.result.trueCount ?? r.count) + 1; refresh(); } };
  save.onclick = () => {
    const r = run(); if (!r || !L.ctx.recorder.rows.length) return;
    const name = L.ctx.recorder.download({
      trueCount: r.result.trueCount, detected: r.count, confirmed: r.result.confirmed || null,
      fun: r.result.fun ?? null, timedOut: !!r.result.timedOut, replayEvent: r.def.replayEvent || null,
      note: (r.result.note || '').trim() || null,
    });
    addLog(`💾 saved ${name}`);
  };
  reset.onclick = () => { L.resetPassport(); addLog('passport reset'); };

  note.addEventListener('input', () => { const r = run(); if (r) r.result.note = note.value; });
  note.addEventListener('keydown', (e) => e.stopPropagation()); // keys type text, never trigger the lab

  function setFun(v) { const r = run(); if (!r) return; r.result.fun = v; L.saveFun(r.def.id, v); refresh(); }

  function addLog(text) {
    const r = run();
    const t = r ? r.t : 0;
    log.push(`${t.toFixed(1).padStart(5)}s  ${text}`);
    if (log.length > 200) log.shift();
    if (!panel.hidden) refresh();
  }

  function refresh() {
    const r = run();
    const has = !!r;
    titleText.textContent = has ? `${r.def.n} · ${r.def.title}${L.S.station ? '' : ' (last run)'}` : 'Move Lab · pick a station';
    for (const b of [yes, notQuite, minus, plus, ...funBtns, note]) b.disabled = !has;
    if (document.activeElement !== note) note.value = has ? (r.result.note || '') : '';
    if (has) {
      const res = r.result;
      score.textContent = `Detected ${r.count} / expected ${r.goal}` + (res.trueCount != null ? `  ·  real ${res.trueCount}` : '') + (res.timedOut ? '  (timed out)' : '');
      trueLbl.textContent = res.trueCount ?? r.count;
      yes.classList.toggle('on', res.confirmed === 'yes');
      notQuite.classList.toggle('on', res.confirmed === 'corrected');
      funBtns.forEach((b, i) => b.classList.toggle('on', res.fun === i + 1));
    } else score.textContent = '';
    const rec = L.ctx.recorder;
    save.disabled = !has || !rec.rows.length;
    saveInfo.textContent = rec.rows.length ? `${rec.rows.length} rows · ${rec.duration.toFixed(1)} s${rec.active ? ' · recording…' : ''}` : '';
    if (log.length !== lastLogLen) { logEl.textContent = log.slice().reverse().join('\n') || '(no events yet)'; lastLogLen = log.length; }
    const c = L.ctx;
    status.textContent = `tier ${c.perf.tier.name} · fps ${c.perf.fps.toFixed(0)} · face ${c.face.found ? 'yes' : 'no'} · ${c.gestures.state} · motion ${c.motion.total.toFixed(3)}`;
  }

  function drawGraph() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (!w) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    if (!samples.length) return;
    const last = samples[samples.length - 1];
    const span = 5, t0 = last.t - span;
    const { min, max } = last;
    const X = (t) => ((t - t0) / span) * w;
    const Y = (v) => hh - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (hh - 8) - 4;
    // hidden-face shading
    g.fillStyle = 'rgba(255,94,168,.18)';
    for (const s of samples) if (s.hidden && s.t >= t0) g.fillRect(X(s.t), 0, Math.max(1, w / 150), hh);
    // threshold lines
    g.setLineDash([6, 4]); g.lineWidth = 1.5; g.font = '11px ui-monospace, monospace'; g.textAlign = 'left';
    for (const l of lines) {
      g.strokeStyle = l.color; g.fillStyle = l.color;
      g.beginPath(); g.moveTo(0, Y(l.v)); g.lineTo(w, Y(l.v)); g.stroke();
      g.fillText(`${l.label} ${(+l.v).toFixed(3).replace(/\.?0+$/, '')}`, 4, Y(l.v) - 3);
    }
    g.setLineDash([]);
    if (min < 0 && max > 0) { g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); }
    // event marks
    for (const m of marks) {
      if (m.t < t0) continue;
      g.strokeStyle = m.hit ? '#7dff6a' : 'rgba(255,255,255,.6)'; g.lineWidth = m.hit ? 3 : 1;
      g.beginPath(); g.moveTo(X(m.t), 0); g.lineTo(X(m.t), hh); g.stroke();
      g.fillStyle = g.strokeStyle; g.textAlign = 'center'; g.fillText(m.name, Math.min(w - 20, Math.max(20, X(m.t))), 12);
    }
    // signal
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath();
    let first = true;
    for (const s of samples) { if (s.t < t0) continue; const x = X(s.t), y = Y(s.v); if (first) g.moveTo(x, y); else g.lineTo(x, y); first = false; }
    g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(last.v.toFixed(3), w - 4, 12);
  }

  return {
    hubBtn,
    addLog,
    mark(name, hit = false) { const r = L.S.station; if (r) marks.push({ t: r.t, name, hit }); },
    newRun() { samples = []; marks = []; log = []; lastLogLen = -1; stepRow.hidden = true; refresh(); },
    update(dt) {
      const st = L.S.station;
      if (st && st.def.signal) {
        const sig = st.def.signal(st, L);
        lines = sig.lines || [];
        signalName.textContent = `Graph: ${sig.name}`;
        samples.push({ t: st.t, v: +sig.v || 0, min: sig.min, max: sig.max, hidden: !!sig.hidden });
        while (samples.length && samples[0].t < st.t - 6) samples.shift();
        while (marks.length && marks[0].t < st.t - 6) marks.shift();
      }
      if (panel.hidden) return;
      drawGraph();
      textT -= dt;
      if (textT <= 0) { textT = 0.25; refresh(); }
    },
    get open() { return !panel.hidden; },
    destroy() { root.remove(); style.remove(); },
  };
}
