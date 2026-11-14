// DOM screens: Play (start), game menu, back button, loading, error.

const root = document.getElementById('ui');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
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

  menu(games, onPick) {
    this.clear();
    const s = el(`<div class="screen menu"><h1 class="title">Pick a game!</h1><div class="grid"></div></div>`);
    const grid = s.querySelector('.grid');
    for (const g of games) {
      const card = el(`<button class="card" style="border-color:${g.color || 'rgba(255,255,255,.25)'}">
        <span class="num">${g.number}</span>
        <span class="icon">${g.icon}</span>
        <span class="name"></span>
      </button>`);
      card.querySelector('.name').textContent = g.title;
      card.addEventListener('click', () => onPick(g));
      grid.append(card);
    }
    root.append(s);
  },

  backButton(onBack) {
    this.clear();
    const b = el(`<button class="back-btn" aria-label="Back to games">⬅</button>`);
    b.addEventListener('click', onBack);
    root.append(b);
  },

  loading(text = 'Getting ready…') {
    this.clear();
    const s = el(`<div class="screen dim loading"><div class="spinner">🌀</div><p class="subtitle"></p></div>`);
    s.querySelector('p').textContent = text;
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
