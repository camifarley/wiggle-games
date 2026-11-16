// DOM screens: Play (start), game menu, back button, loading, error.

import { audio, sfx } from './audio.js';

const root = document.getElementById('ui');
// every on-screen button gives a little tap sound (the picked 'tap' slot); bubbles after the button's own
// handler, so the Play tap has already unlocked audio and the 🔊 button plays at the new volume
root.addEventListener('click', (e) => { if (e.target.closest('button')) sfx.play('tap'); });

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Fill a card's picture box: an image URL (screenshot / cover), or the emoji fallback if there is none or it fails.
function picture(box, src, fallback) {
  const emoji = () => { box.replaceChildren(); box.classList.add('emoji'); box.textContent = fallback || '🎮'; };
  if (!src) return emoji();
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.onerror = emoji;
  img.src = src;
  box.append(img);
}

export const ui = {
  clear() { root.replaceChildren(); },

  start(onPlay) {
    this.clear();
    const s = el(`<div class="screen dim">
      <h1 class="title">Wiggle Games</h1>
      <p class="subtitle">Move your body to play!</p>
      <button class="big-btn">▶ Play</button>
    </div>`);
    s.querySelector('button').addEventListener('click', onPlay, { once: true });
    root.append(s);
  },

  menu(games, onPick, onCamera) {
    this.clear();
    const s = el(`<div class="screen menu"><h1 class="title">Pick a game!</h1><div class="grid"></div></div>`);
    // parent corner: sound volume, music on/off, camera
    const corner = el(`<div class="corner-btns"></div>`);
    const vol = el(`<button class="corner-btn" aria-label="Sound volume"></button>`);
    const mus = el(`<button class="corner-btn" aria-label="Music on or off">🎵</button>`);
    const paint = () => { vol.textContent = audio.volumeIcon(); mus.classList.toggle('off', !audio.musicOn); };
    vol.addEventListener('click', () => { audio.nextVolume(); paint(); });
    mus.addEventListener('click', () => { audio.musicOn = !audio.musicOn; paint(); });
    paint();
    corner.append(vol, mus);
    if (onCamera) {
      const cam = el(`<button class="corner-btn" aria-label="Choose camera">📷</button>`);
      cam.addEventListener('click', onCamera);
      corner.append(cam);
    }
    s.append(corner);
    const grid = s.querySelector('.grid');
    for (const g of games) {
      // picture = a screenshot of the latest release (shot.webp); the emoji icon only until a game has one
      const card = el(`<button class="card${g.latest.shot ? ' has-shot' : ''}" style="border-color:${g.color || 'rgba(255,255,255,.25)'}">
        <span class="pic"></span>
        <span class="num">${g.number}</span>
        <span class="name"></span>
        ${g.releases.length > 1 ? `<span class="ver">v${g.latest.version}</span>` : ''}
      </button>`);
      card.querySelector('.name').textContent = g.title;
      picture(card.querySelector('.pic'), g.latest.shot, g.icon);
      card.addEventListener('click', () => onPick(g));
      grid.append(card);
    }
    root.append(s);
  },

  // Pick which release of a game to play. Oldest -> newest, so the kid sees how it grew.
  releasePicker(game, onPick, onBack) {
    this.clear();
    const s = el(`<div class="screen menu releases"><h1 class="title"></h1><div class="grid"></div></div>`);
    s.querySelector('.title').textContent = game.title;
    const grid = s.querySelector('.grid');
    game.releases.forEach((r, i) => {
      const isNew = i === game.releases.length - 1;
      const card = el(`<button class="card release" style="border-color:${isNew ? 'var(--accent)' : 'rgba(255,255,255,.25)'}">
        ${isNew ? '<span class="new">NEW</span>' : ''}
        <span class="num"></span>
        <span class="cover"></span>
        <span class="name"></span>
      </button>`);
      card.querySelector('.num').textContent = `v${r.version}`;
      card.querySelector('.name').textContent = r.title || game.title;
      const cover = card.querySelector('.cover');
      // this version's own screenshot, else its drawn cover, else the icon
      if (r.shot) cover.classList.add('shot');
      picture(cover, r.shot || r.cover, game.icon);
      card.addEventListener('click', () => onPick(r));
      grid.append(card);
    });
    const back = el(`<button class="back-btn" aria-label="Back to games">⬅</button>`);
    back.addEventListener('click', onBack);
    s.append(back);
    root.append(s);
  },

  // Parent-facing camera chooser. cameras = [{ deviceId, label }]
  cameraPicker(cameras, currentId, onChoose, onClose) {
    const s = el(`<div class="screen dim picker">
      <h2 class="subtitle">Which camera?</h2><div class="list"></div>
      <button class="big-btn small">Done</button></div>`);
    const list = s.querySelector('.list');
    if (cameras.length < 2) {
      const p = el(`<p class="subtitle"></p>`);
      p.textContent = cameras.length ? 'Only one camera found. Plug in a webcam and try again.' : 'No cameras found.';
      list.append(p);
    }
    for (const c of cameras) {
      const b = el(`<button class="cam-option"></button>`);
      b.textContent = (c.deviceId === currentId ? '✅ ' : '📷 ') + c.label;
      if (c.deviceId === currentId) b.classList.add('current');
      b.addEventListener('click', async () => {
        b.textContent = '⏳ ' + c.label;
        await onChoose(c.deviceId);
        s.remove();
        onClose();
      });
      list.append(b);
    }
    s.querySelector('.big-btn').addEventListener('click', () => { s.remove(); onClose(); });
    root.append(s);
  },

  backButton(onBack) {
    this.clear();
    const b = el(`<button class="back-btn" aria-label="Back to games">⬅</button>`);
    b.addEventListener('click', onBack);
    root.append(b);
  },

  // shot (optional) = the game's screenshot, shown above the title while the game loads
  loading(text = 'Getting ready…', shot = null) {
    this.clear();
    const s = el(`<div class="screen dim loading"><div class="spinner">🌀</div><p class="subtitle"></p></div>`);
    s.querySelector('p').textContent = text;
    if (shot) {
      const img = el(`<img class="loading-shot" alt="">`);
      img.src = shot;
      s.querySelector('.spinner').replaceWith(img);
    }
    root.append(s);
  },

  error(text, onRetry) {
    this.clear();
    const s = el(`<div class="screen dim"><div style="font-size:96px">🙈</div>
      <p class="subtitle"></p><button class="big-btn">Try again</button></div>`);
    s.querySelector('p').textContent = text;
    s.querySelector('button').addEventListener('click', onRetry, { once: true });
    root.append(s);
  },
};
