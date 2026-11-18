// The Alien Passport catalog: good-guy friends built from a few lists (shape x color x pattern x hat x size),
// the same recipe pattern as Mega Roll's stickers. Pure data + logic (no three.js / DOM), tested by npm test.
//
// STABLE IDS: "blob.pink.spots.bow.tiny". Lists may GROW (append new keys) but never rename or remove a key:
// passports saved on devices use these ids. Each shape lives on its own home planet (= a passport page).
// All our own designs and names.

export const SHAPES = [
  { key: 'blob', name: 'Bloblet', planet: 'Planet Wobble', planetEmoji: '🟣', planetColor: '#b48cff' },
  { key: 'bean', name: 'Beanie', planet: 'Bean Moon', planetEmoji: '🌙', planetColor: '#ffd93d' },
  { key: 'puff', name: 'Puffball', planet: 'Cloud Planet', planetEmoji: '☁️', planetColor: '#bfe8ff' },
  { key: 'jelly', name: 'Jellybop', planet: 'Jelly Ocean', planetEmoji: '🌊', planetColor: '#4fb8ff' },
  { key: 'bun', name: 'Bunbun', planet: 'Carrot Star', planetEmoji: '🥕', planetColor: '#ff9f1c' },
  { key: 'twinkle', name: 'Twinkle', planet: 'Star Village', planetEmoji: '⭐', planetColor: '#ffe14d' },
];

export const COLORS = [
  { key: 'red', word: 'Cherry', hex: '#ff6b81', w: 1 },
  { key: 'orange', word: 'Tangerine', hex: '#ffa94d', w: 1 },
  { key: 'yellow', word: 'Lemon', hex: '#ffe066', w: 1 },
  { key: 'green', word: 'Minty', hex: '#69e59a', w: 1 },
  { key: 'blue', word: 'Sky', hex: '#5ec8ff', w: 1 },
  { key: 'purple', word: 'Grape', hex: '#b48cff', w: 1 },
  { key: 'pink', word: 'Bubblegum', hex: '#ff9ad5', w: 1 },
  { key: 'white', word: 'Snowy', hex: '#f4f7ff', w: 1 },
  { key: 'gold', word: 'Golden', hex: '#ffc61a', w: 0.015, golden: true },
];

export const PATTERNS = [
  { key: 'plain', word: '', w: 0.4 },
  { key: 'spots', word: 'Polka-dot', w: 0.2 },
  { key: 'stripes', word: 'Stripy', w: 0.17 },
  { key: 'swirl', word: 'Swirly', w: 0.15 },
  { key: 'sparkles', word: 'Sparkly', w: 0.06, rare: true },
];

// prefix: a word before the color; suffix: "with ..." after the shape
export const HATS = [
  { key: 'none', w: 0.4, emoji: '' },
  { key: 'antenna', suffix: 'with Antennas', w: 0.14, emoji: '📡' },
  { key: 'bow', suffix: 'with a Bow', w: 0.12, emoji: '🎀' },
  { key: 'party', prefix: 'Party', w: 0.12, emoji: '🥳' },
  { key: 'propeller', suffix: 'with a Propeller Hat', w: 0.1, emoji: '🧢' },
  { key: 'helmet', prefix: 'Astronaut', w: 0.08, emoji: '🧑‍🚀' },
  { key: 'crown', suffix: 'with a Crown', w: 0.04, emoji: '👑', rare: true },
];

export const SIZES = [
  { key: 'tiny', word: 'Tiny', scale: 0.7, w: 0.3 },
  { key: 'normal', word: '', scale: 1, w: 0.55 },
  { key: 'big', word: 'BIG', scale: 1.3, w: 0.15 },
];

const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));
export const SHAPE = byKey(SHAPES), COLOR = byKey(COLORS), PATTERN = byKey(PATTERNS), HAT = byKey(HATS), SIZE = byKey(SIZES);

export const CATALOG_SIZE = SHAPES.length * COLORS.length * PATTERNS.length * HATS.length * SIZES.length;
export const PER_SHAPE = CATALOG_SIZE / SHAPES.length;

export function recipeId(r) { return `${r.shape}.${r.color}.${r.pattern}.${r.hat}.${r.size}`; }

export function parseId(id) {
  const [shape, color, pattern, hat, size, extra] = String(id).split('.');
  if (extra !== undefined || !SHAPE[shape] || !COLOR[color] || !PATTERN[pattern] || !HAT[hat] || !SIZE[size]) return null;
  return { shape, color, pattern, hat, size };
}

export function recipeName(r) {
  if (typeof r === 'string') r = parseId(r);
  const h = HAT[r.hat];
  return [SIZE[r.size].word, PATTERN[r.pattern].word, h.prefix, COLOR[r.color].word, SHAPE[r.shape].name, h.suffix]
    .filter(Boolean).join(' ');
}

// 'golden' (very rare) | 'rare' (sparkly or crowned) | 'common'
export function rarity(r) {
  if (typeof r === 'string') r = parseId(r);
  if (COLOR[r.color].golden) return 'golden';
  if (PATTERN[r.pattern].rare || HAT[r.hat].rare) return 'rare';
  return 'common';
}

// a random friend. rnd = a stream from core/rng.js (or anything with pick / weighted / chance).
// opts.rare forces at least rare (the boss's cargo hold), opts.goldenChance overrides the golden odds.
export function randomRecipe(rnd, opts = {}) {
  const shape = rnd.pick(opts.shapes || SHAPES.map((s) => s.key));
  const cw = COLORS.map((c) => (c.golden && opts.goldenChance != null ? opts.goldenChance * 8 : c.w));
  const color = rnd.weighted(COLORS, cw).key;
  let pattern = rnd.weighted(PATTERNS).key;
  let hat = rnd.weighted(HATS).key;
  const size = rnd.weighted(SIZES).key;
  if (opts.rare && rarity({ shape, color, pattern, hat, size }) === 'common') {
    if (rnd.chance(0.5)) pattern = 'sparkles'; else hat = 'crown';
  }
  return { shape, color, pattern, hat, size };
}

// Every recipe id in a fixed order (for passport pages and tests).
export function* allIds(shapes = SHAPES) {
  for (const s of shapes) for (const c of COLORS) for (const p of PATTERNS) for (const h of HATS) for (const z of SIZES) {
    yield `${s.key}.${c.key}.${p.key}.${h.key}.${z.key}`;
  }
}
