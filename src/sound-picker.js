// Sound Picker: the parent and kid listen to candidate sounds for each game slot, vote 👍/👎, pick a ⭐
// favorite per slot, and export the picks as JSON for Claude to wire into the games.
// Candidates: public/sounds/candidates.json (built from Kenney CC0 packs). Votes persist on this device.

import { audio, synthOriginal as sfx, synthLab } from './core/audio.js';
import { music, STYLES } from './core/music.js';

// Round 2: cartoony synth designs (no download) added to rows Kenney couldn't fill well, plus rows Kenney
// has nothing for. Votes use ids like 'synth/pop-bubble'.
const SYNTH_EXTRA = {
  pop: ['pop-bubble', 'pop-cork', 'pop-blip'],
  boing: ['boing-spring', 'boing-jaw', 'boing-hop'],
  smash: ['smash-crunch'],
  boom: ['boom-cartoon'],
  punch: ['punch-pow'],
  bonk: ['bonk-head'],
  powerup: ['powerup-climb'],
  win: ['win-fanfare'],
  collect: ['collect-sparkle', 'collect-coin'],
  splat: ['splat-goo', 'splat-bloop'],
  tap: ['tap-bubble'],
};
const NEW_SLOTS = [
  { slot: 'giggle', emoji: '😆', label: 'Giggle', use: 'Bugs, animals and boulders laughing', synth: 'giggle', candidates: [] },
  { slot: 'squeak', emoji: '🐭', label: 'Squeak', use: 'Bugs and little critters', synth: 'squeak', candidates: [] },
  { slot: 'whoosh', emoji: '💨', label: 'Whoosh', use: 'Things flying past, spins', synth: 'whoosh', candidates: [] },
];
Object.assign(SYNTH_EXTRA, { giggle: ['giggle-chipmunk', 'giggle-tee-hee'], squeak: ['squeak-duck', 'squeak-toy'], whoosh: ['whoosh-air'] });

// Music rows: where it plays -> generated loops to compare (style:seed). Real tracks get added in a later round.
const gen = (style, ...seeds) => seeds.map((n) => ({ id: `gen:${style}:${n}`, music: `gen:${style}:${n}`, name: `${STYLES[style].label} ${n}`, isNew: true }));
const MUSIC_SLOTS = [
  { slot: 'music:menu', emoji: '🏠', label: 'Menu music', use: 'Picking a game', candidates: [...gen('sunny', 1, 2, 3), ...gen('hop', 4)] },
  { slot: 'music:06-smash-run', emoji: '🪨', label: 'Smash Run music', use: 'Running and smashing boulders', candidates: [...gen('zoom', 1, 2, 3), ...gen('downhill', 1)] },
  { slot: 'music:04-bounca-bugs', emoji: '🐞', label: "Bounc'a Bugs music", use: 'Bugs bouncing everywhere', candidates: [...gen('hop', 1, 2, 3), ...gen('sunny', 4)] },
  { slot: 'music:05-move-lab', emoji: '🧪', label: 'Move Lab music', use: 'Trying moves at the stations', candidates: [...gen('groove', 1, 2, 3)] },
  { slot: 'music:08-mega-roll', emoji: '⛰️', label: 'Mega Roll music', use: 'Rolling down the mountain', candidates: [...gen('downhill', 2, 3, 4), ...gen('zoom', 4)] },
  { slot: 'music:sneaky', emoji: '🤫', label: 'Sneaky music', use: '"Move slowly" rounds (tiptoe!)', candidates: [...gen('tiptoe', 1, 2, 3, 4)] },
  { slot: 'music:win', emoji: '🏆', label: 'Win jingle (made in code)', use: 'Big wins, trophies', candidates: [...gen('fanfare', 1, 2, 3)] },
];

const STORE = 'wiggle.soundPicks';
const $ = (sel) => document.querySelector(sel);

let picks = {};
try { picks = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { picks = {}; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch { /* private mode */ } render(); };
const slotPicks = (slot) => (picks[slot] ||= { favorite: null, up: [], down: [] });

let current = null; // { audio, button }
let musicBtn = null;
function stopAll() {
  if (current) { current.audio.pause(); current.button.classList.remove('playing'); current = null; }
  if (musicBtn) { music.stop({ fade: 0.2 }); musicBtn.classList.remove('playing'); musicBtn.textContent = '▶'; musicBtn = null; }
}
function playCand(c, button) {
  audio.unlock();
  if (c.music) {
    const same = musicBtn === button;
    stopAll();
    if (same) return;
    musicBtn = button; button.classList.add('playing'); button.textContent = '⏹';
    music.play(c.music, { fade: 0.05 });
    return;
  }
  if (c.synth) { stopAll(); synthLab[c.synth](); button.classList.add('playing'); setTimeout(() => button.classList.remove('playing'), 500); return; }
  play(c.file, button);
}
function play(url, button) {
  audio.unlock();
  stopAll();
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
    if (slot.slot === 'music:menu') root.append(el('h2', 'section', '🎵 Music'));
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
      now.dataset.synth = slot.synth;
      now.title = 'The sound the games use today';
      now.onclick = () => { audio.unlock(); stopAll(); if (slot.synth === 'tone') sfx.tone(880, 0.12, 'square', 0.12); else sfx[slot.synth](); };
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
      btn.onclick = () => playCand(c, btn);
      const name = el('div', 'cand-name', `#${i + 1} · ${c.name.replace(/_/g, ' ')}`);
      if (c.isNew) name.prepend(el('span', 'new', 'NEW'));
      if (c.credit) box.title = c.credit;
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

Promise.all([
  fetch('./sounds/candidates.json').then((r) => r.json()),
  fetch('./sounds/candidates-extra.json').then((r) => r.json()).catch(() => ({ slots: {}, music: {} })),
])
  .then(([d, extra]) => {
    data = d;
    data.slots.push(...NEW_SLOTS);
    // round 2: OpenGameArt CC0 files (scripts/sounds-extra.py)
    for (const sl of data.slots) sl.candidates.push(...(extra.slots[sl.slot] || []));
    for (const sl of MUSIC_SLOTS) sl.candidates.push(...(extra.music[sl.slot] || []));
    for (const sl of data.slots) for (const name of SYNTH_EXTRA[sl.slot] || [])
      sl.candidates.push({ id: `synth/${name}`, synth: name, name: `${name} (made in code)`, isNew: true });
    data.slots.push(...MUSIC_SLOTS);
    render();
  })
  .catch(() => { $('#slots').textContent = 'Could not load the sound list.'; });
