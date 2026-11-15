// Sound Picker: the parent and kid listen to candidate sounds for each game slot, vote 👍/👎, pick a ⭐
// favorite per slot, and export the picks as JSON for Claude to wire into the games.
// Candidates: public/sounds/candidates.json (built from Kenney CC0 packs). Votes persist on this device.

import { audio, sfx } from './core/audio.js';

const STORE = 'wiggle.soundPicks';
const $ = (sel) => document.querySelector(sel);

let picks = {};
try { picks = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { picks = {}; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch { /* private mode */ } render(); };
const slotPicks = (slot) => (picks[slot] ||= { favorite: null, up: [], down: [] });

let current = null; // { audio, button }
function play(url, button) {
  audio.unlock();
  if (current) { current.audio.pause(); current.button.classList.remove('playing'); }
  const a = new Audio(url);
  button.classList.add('playing');
  a.addEventListener('ended', () => button.classList.remove('playing'));
  a.play().catch(() => button.classList.remove('playing'));
  current = { audio: a, button };
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

let data = null;

function render() {
  const root = $('#slots');
  root.replaceChildren();
  let favs = 0;
  for (const slot of data.slots) {
    const p = slotPicks(slot.slot);
    if (p.favorite) favs++;
    const card = el('section', 'slot');
    const head = el('div', 'slot-head');
    head.append(el('span', 'slot-emoji', slot.emoji));
    const titles = el('div');
    titles.append(el('div', 'slot-title', slot.label), el('div', 'slot-use', slot.use));
    head.append(titles);
    if (slot.synth && sfx[slot.synth]) {
      const now = el('button', 'now', '▶ Now');
      now.title = 'The sound the games use today';
      now.onclick = () => { audio.unlock(); sfx[slot.synth](); };
      head.append(now);
    }
    card.append(head);

    const grid = el('div', 'cands');
    slot.candidates.forEach((c, i) => {
      const box = el('div', 'cand');
      if (p.favorite === c.id) box.classList.add('fav');
      if (p.down.includes(c.id)) box.classList.add('down');
      const btn = el('button', 'play', '▶');
      btn.setAttribute('aria-label', `Play ${slot.label} option ${i + 1}`);
      btn.onclick = () => play(c.file, btn);
      const name = el('div', 'cand-name', `#${i + 1} · ${c.name.replace(/_/g, ' ')}`);
      const votes = el('div', 'votes');
      const up = el('button', 'up' + (p.up.includes(c.id) ? ' on' : ''), '👍');
      const down = el('button', 'down' + (p.down.includes(c.id) ? ' on' : ''), '👎');
      const star = el('button', 'star' + (p.favorite === c.id ? ' on' : ''), '⭐');
      up.setAttribute('aria-label', 'Thumbs up'); down.setAttribute('aria-label', 'Thumbs down'); star.setAttribute('aria-label', 'Favorite');
      up.onclick = () => { toggle(p.up, c.id); remove(p.down, c.id); save(); };
      down.onclick = () => { toggle(p.down, c.id); remove(p.up, c.id); if (p.favorite === c.id) p.favorite = null; save(); };
      star.onclick = () => { p.favorite = p.favorite === c.id ? null : c.id; if (p.favorite) { remove(p.down, c.id); if (!p.up.includes(c.id)) p.up.push(c.id); } save(); };
      votes.append(up, down, star);
      box.append(btn, name, votes);
      grid.append(box);
    });
    card.append(grid);
    root.append(card);
  }
  $('#progress').textContent = `⭐ ${favs} / ${data.slots.length} sounds picked`;
}

function toggle(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id); }
function remove(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }

$('#notes').value = picks._notes || '';
$('#notes').addEventListener('input', () => { picks._notes = $('#notes').value; try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch { /* */ } });

$('#export').onclick = () => {
  const out = {
    kind: 'wiggle-sound-picks',
    exportedAt: new Date().toISOString(),
    source: data.source,
    notes: picks._notes || '',
    slots: Object.fromEntries(data.slots.map((s) => [s.slot, slotPicks(s.slot)])),
  };
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sound-picks-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

fetch('./sounds/candidates.json')
  .then((r) => r.json())
  .then((d) => { data = d; render(); })
  .catch(() => { $('#slots').textContent = 'Could not load the sound list.'; });
