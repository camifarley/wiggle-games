// The sticker catalog: thousands of kinds of things from a few lists (shape x color x pattern x hat x size).
// Pure data + logic (no three.js / DOM), tested by `npm test` (scripts/test-mega-roll-v2.js).
// v2.0: every v1.0 shape keeps its key (old sticker books keep loading); new species are appended; every shape
// belongs to exactly ONE theme book (THEME_OF); tough things have hit points (cracks before they collapse).
//
// STABLE IDS: a recipe id is readable text, "cow.pink.spots.tophat.big". Lists may GROW (append new shapes,
// colors, ...) but never rename or remove a key: the sticker books saved on devices use these ids.
//
// kind: 'critter' (never hurt: bounces away giggling, a sticker pops out), 'thing' (bursts into cubes and
// confetti), 'tough' (houses, rocks...: the ball bounces off with a BOING unless it's in RAINBOW ROLL).

export const SHAPES = [
  // critters
  { key: 'cow', name: 'Cow', emoji: '🐄', kind: 'critter', points: 40, r: 1.0 },
  { key: 'sheep', name: 'Sheep', emoji: '🐑', kind: 'critter', points: 40, r: 0.9 },
  { key: 'pig', name: 'Pig', emoji: '🐖', kind: 'critter', points: 40, r: 0.85 },
  { key: 'chicken', name: 'Chicken', emoji: '🐔', kind: 'critter', points: 30, r: 0.55 },
  { key: 'duck', name: 'Duck', emoji: '🦆', kind: 'critter', points: 30, r: 0.55 },
  { key: 'bunny', name: 'Bunny', emoji: '🐇', kind: 'critter', points: 30, r: 0.55 },
  { key: 'penguin', name: 'Penguin', emoji: '🐧', kind: 'critter', points: 40, r: 0.6 },
  { key: 'frog', name: 'Frog', emoji: '🐸', kind: 'critter', points: 30, r: 0.5 },
  // things
  { key: 'hay', name: 'Hay Bale', emoji: '🌾', kind: 'thing', points: 20, r: 0.9 },
  { key: 'fence', name: 'Fence', emoji: '🚧', kind: 'thing', points: 15, r: 1.2 },
  { key: 'mailbox', name: 'Mailbox', emoji: '📫', kind: 'thing', points: 20, r: 0.5 },
  { key: 'cart', name: 'Cart', emoji: '🛒', kind: 'thing', points: 30, r: 0.9 },
  { key: 'pumpkin', name: 'Pumpkin', emoji: '🎃', kind: 'thing', points: 20, r: 0.7 },
  { key: 'mushroom', name: 'Mushroom', emoji: '🍄', kind: 'thing', points: 20, r: 0.6 },
  { key: 'crate', name: 'Crate', emoji: '📦', kind: 'thing', points: 15, r: 0.6 },
  { key: 'barrel', name: 'Barrel', emoji: '🛢️', kind: 'thing', points: 15, r: 0.55 },
  { key: 'flag', name: 'Flag', emoji: '🚩', kind: 'thing', points: 15, r: 0.4 },
  { key: 'bench', name: 'Bench', emoji: '🪑', kind: 'thing', points: 20, r: 0.9 },
  { key: 'lamp', name: 'Lamppost', emoji: '💡', kind: 'thing', points: 20, r: 0.4 },
  { key: 'snowman', name: 'Snowman', emoji: '⛄', kind: 'thing', points: 40, r: 0.75 },
  { key: 'bush', name: 'Bush', emoji: '🌿', kind: 'thing', points: 10, r: 0.8 },
  { key: 'tree', name: 'Tree', emoji: '🌳', kind: 'thing', points: 30, r: 0.8 },
  { key: 'pine', name: 'Pine Tree', emoji: '🌲', kind: 'thing', points: 30, r: 0.8 },
  { key: 'robot', name: 'Robot', emoji: '🤖', kind: 'thing', points: 60, r: 0.6 },
  { key: 'balloon', name: 'Hot-Air Balloon', emoji: '🎈', kind: 'thing', points: 80, r: 1.0 },
  { key: 'dino', name: 'Dino Statue', emoji: '🦖', kind: 'thing', points: 60, r: 1.0 },
  // tough (RAINBOW ROLL smashes them)
  { key: 'house', name: 'House', emoji: '🏠', kind: 'tough', points: 200, r: 2.2 },
  { key: 'barn', name: 'Barn', emoji: '🛖', kind: 'tough', points: 250, r: 2.5 },
  { key: 'windmill', name: 'Windmill', emoji: '🌬️', kind: 'tough', points: 300, r: 1.6 },
  { key: 'igloo', name: 'Igloo', emoji: '🧊', kind: 'tough', points: 200, r: 2.0 },
  { key: 'tractor', name: 'Tractor', emoji: '🚜', kind: 'tough', points: 150, r: 1.6 },
  { key: 'rock', name: 'Big Rock', emoji: '🪨', kind: 'tough', points: 100, r: 1.5 },
  // v2.0 additions (append only)
  { key: 'dog', name: 'Sheepdog', emoji: '🐕', kind: 'critter', points: 40, r: 0.6 },
  { key: 'goat', name: 'Goat', emoji: '🐐', kind: 'critter', points: 40, r: 0.7 },
  { key: 'deer', name: 'Deer', emoji: '🦌', kind: 'critter', points: 50, r: 0.8 },
  { key: 'fox', name: 'Fox', emoji: '🦊', kind: 'critter', points: 40, r: 0.6 },
  { key: 'squirrel', name: 'Squirrel', emoji: '🐿️', kind: 'critter', points: 30, r: 0.45 },
  { key: 'owl', name: 'Owl', emoji: '🦉', kind: 'critter', points: 40, r: 0.45 },
  { key: 'seal', name: 'Seal', emoji: '🦭', kind: 'critter', points: 40, r: 0.7 },
  { key: 'polar', name: 'Polar Cub', emoji: '🐻‍❄️', kind: 'critter', points: 50, r: 0.8 },
  { key: 'log', name: 'Log', emoji: '🪵', kind: 'thing', points: 15, r: 0.9 },
  { key: 'basket', name: 'Picnic Basket', emoji: '🧺', kind: 'thing', points: 20, r: 0.5 },
  { key: 'sled', name: 'Sled', emoji: '🛷', kind: 'thing', points: 20, r: 0.8 },
  { key: 'cabin', name: 'Log Cabin', emoji: '🏡', kind: 'tough', points: 200, r: 2.2 },
  { key: 'reindeer', name: 'Reindeer', emoji: '🦌', kind: 'critter', points: 50, r: 0.8 },
];

// v2.0: which theme book each shape lives in (exactly one), and hits a tough thing takes before it collapses
export const THEMES = ['farm', 'forest', 'snowy'];
export const THEME_OF = {
  cow: 'farm', sheep: 'farm', pig: 'farm', chicken: 'farm', duck: 'farm', dog: 'farm', goat: 'farm',
  hay: 'farm', fence: 'farm', mailbox: 'farm', cart: 'farm', pumpkin: 'farm', crate: 'farm', barrel: 'farm', flag: 'farm',
  bench: 'farm', lamp: 'farm', balloon: 'farm', house: 'farm', barn: 'farm', windmill: 'farm', tractor: 'farm',
  bunny: 'forest', frog: 'forest', deer: 'forest', fox: 'forest', squirrel: 'forest', owl: 'forest',
  mushroom: 'forest', bush: 'forest', tree: 'forest', dino: 'forest', rock: 'forest', log: 'forest', basket: 'forest', cabin: 'forest',
  penguin: 'snowy', seal: 'snowy', polar: 'snowy', reindeer: 'snowy', snowman: 'snowy', pine: 'snowy', igloo: 'snowy', robot: 'snowy', sled: 'snowy',
};
export const HP = { house: 2, igloo: 2, tractor: 2, rock: 2, cabin: 2, barn: 3, windmill: 3 };

export const COLORS = [
  { key: 'red', word: 'Cherry', hex: '#ff4d6d', w: 1 },
  { key: 'orange', word: 'Tangerine', hex: '#ff9f1c', w: 1 },
  { key: 'yellow', word: 'Banana', hex: '#ffd93d', w: 1 },
  { key: 'green', word: 'Minty', hex: '#4fd67e', w: 1 },
  { key: 'blue', word: 'Blueberry', hex: '#4d8dff', w: 1 },
  { key: 'purple', word: 'Grape', hex: '#a66bff', w: 1 },
  { key: 'pink', word: 'Bubblegum', hex: '#ff8fd0', w: 1 },
  { key: 'white', word: 'Snowy', hex: '#f4f7ff', w: 1 },
  { key: 'gold', word: 'Golden', hex: '#ffc61a', w: 0.012, golden: true },
];

export const PATTERNS = [
  { key: 'plain', word: '', w: 0.4 },
  { key: 'spots', word: 'Polka-dot', w: 0.2 },
  { key: 'stripes', word: 'Stripy', w: 0.17 },
  { key: 'checks', word: 'Checkered', w: 0.15 },
  { key: 'sparkles', word: 'Sparkly', w: 0.06, rare: true },
];

// prefix: a word before the color ("Party"); suffix: "with ..." after the shape
export const HATS = [
  { key: 'none', w: 0.5, emoji: '' },
  { key: 'tophat', suffix: 'with a Top Hat', w: 0.1, emoji: '🎩' },
  { key: 'party', prefix: 'Party', w: 0.12, emoji: '🥳' },
  { key: 'bow', suffix: 'with a Bow', w: 0.1, emoji: '🎀' },
  { key: 'shades', suffix: 'with Sunglasses', w: 0.12, emoji: '🕶️' },
  { key: 'crown', suffix: 'with a Crown', w: 0.05, emoji: '👑', rare: true },
];

export const SIZES = [
  { key: 'tiny', word: 'Tiny', scale: 0.6, mult: 0.6, w: 0.25 },
  { key: 'normal', word: '', scale: 1, mult: 1, w: 0.55 },
  { key: 'big', word: 'BIG', scale: 1.6, mult: 2, w: 0.2 },
];

const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));
export const SHAPE = byKey(SHAPES), COLOR = byKey(COLORS), PATTERN = byKey(PATTERNS), HAT = byKey(HATS), SIZE = byKey(SIZES);

export const CATALOG_SIZE = SHAPES.length * COLORS.length * PATTERNS.length * HATS.length * SIZES.length;
export const PER_SHAPE = CATALOG_SIZE / SHAPES.length;

export function recipeId(r) { return `${r.shape}.${r.color}.${r.pattern}.${r.hat}.${r.size}`; }

export function parseId(id) {
  const [shape, color, pattern, hat, size] = String(id).split('.');
  if (!SHAPE[shape] || !COLOR[color] || !PATTERN[pattern] || !HAT[hat] || !SIZE[size]) return null;
  return { shape, color, pattern, hat, size };
}

export function recipeName(r) {
  if (typeof r === 'string') r = parseId(r);
  const h = HAT[r.hat];
  return [SIZE[r.size].word, PATTERN[r.pattern].word, h.prefix, COLOR[r.color].word, SHAPE[r.shape].name, h.suffix]
    .filter(Boolean).join(' ');
}

// 'golden' (very rare: big celebration) | 'rare' (sparkly or crowned) | 'common'
export function rarity(r) {
  if (typeof r === 'string') r = parseId(r);
  if (COLOR[r.color].golden) return 'golden';
  if (PATTERN[r.pattern].rare || HAT[r.hat].rare) return 'rare';
  return 'common';
}

// score for bonking one (before combo / rainbow multipliers)
export function recipePoints(r) {
  if (typeof r === 'string') r = parseId(r);
  const tier = rarity(r);
  return Math.round(SHAPE[r.shape].points * SIZE[r.size].mult * (tier === 'golden' ? 5 : tier === 'rare' ? 2 : 1) / 5) * 5;
}

// A random recipe from a stream (rng.js). shapes = keys allowed here (a biome pool). opts.rare = force at
// least rare (hidden treasures off the main line), opts.goldenChance overrides the golden odds.
export function randomRecipe(rnd, shapes, opts = {}) {
  const shape = rnd.pick(shapes);
  const sh = SHAPE[shape];
  const colors = opts.goldenChance != null ? COLORS.map((c) => (c.golden ? opts.goldenChance * 8 : 1)) : COLORS.map((c) => c.w);
  const color = rnd.weighted(COLORS, colors).key;
  let pattern = rnd.weighted(PATTERNS).key;
  let hat = rnd.weighted(HATS).key;
  // tough things are huge already: tiny or normal only
  const size = rnd.weighted(SIZES, SIZES.map((s) => (sh.kind === 'tough' && s.key === 'big' ? 0 : s.w))).key;
  if (opts.rare && rarity({ shape, color, pattern, hat, size }) === 'common') {
    if (rnd.chance(0.5)) pattern = 'sparkles'; else hat = 'crown';
  }
  return { shape, color, pattern, hat, size };
}

// Every recipe id, in a fixed order (for the book's pages and tests).
export function* allIds(shapes = SHAPES) {
  for (const s of shapes) for (const c of COLORS) for (const p of PATTERNS) for (const h of HATS) for (const z of SIZES) {
    yield `${s.key}.${c.key}.${p.key}.${h.key}.${z.key}`;
  }
}
