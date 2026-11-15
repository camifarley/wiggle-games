// Mountains from a seed. Pure (no three.js / DOM): `npm test` checks that the same seed always gives the same
// name, course and objects, and that different seeds differ.
//
// A mountain is a downhill course measured in meters `d` from the top. It's generated in CHUNKS of CHUNK m,
// each from its chunk index alone (plus a small, cheap walk over the biome plan), so any chunk can be made in
// any order: the game streams chunks in ahead of the ball and throws them away behind it.
//
// Separate random streams (rng.js), each keyed by (seed, stream, chunk, item):
//   'name'   the mountain's name          'course'  center line, width, biome plan, ramps, rivers
//   'place'  where each object sits      'recipe'  which sticker each object is
//   'look'   rotation / wobble (cosmetic, never affects play)
// Object j of a chunk always uses its own (chunk, j) streams, so changing the density only adds or removes
// objects at the end of a chunk's list: the others stay exactly where and what they were.

import { stream, hash } from './rng.js';
import { SHAPE, randomRecipe, recipeId } from './recipes.js';

export const CHUNK = 40;           // m per chunk
export const MAX_SEED = 9999;

const ADJ = ['Wobbly', 'Giggly', 'Bouncy', 'Sleepy', 'Fluffy', 'Zoomy', 'Silly', 'Sparkly', 'Jiggly', 'Wiggly', 'Snuggly', 'Bumpy',
  'Sneezy', 'Tickly', 'Squishy', 'Rumbly', 'Twisty', 'Dizzy', 'Happy', 'Noodly', 'Burpy', 'Dancing', 'Tumbly', 'Cozy'];
const NOUN = ['Pickle', 'Pancake', 'Noodle', 'Muffin', 'Banana', 'Marshmallow', 'Pudding', 'Cupcake', 'Waffle', 'Jellybean', 'Meatball',
  'Potato', 'Popcorn', 'Cookie', 'Taco', 'Dumpling', 'Sock', 'Teapot', 'Bubble', 'Giraffe', 'Penguin', 'Donut', 'Broccoli', 'Pajama'];
const END = ['Peak', 'Mountain', 'Hill', 'Slopes', 'Top', 'Bumps'];

export function mountainName(seed) {
  const r = stream(seed, 'name');
  return `${r.pick(ADJ)} ${r.pick(NOUN)} ${r.pick(END)}`;
}
export const mountainTitle = (seed) => `Mountain ${seed} · ${mountainName(seed)}`;

export function randomSeed(avoid = []) {
  let s;
  do { s = 1 + Math.floor(Math.random() * MAX_SEED); } while (avoid.includes(s));
  return s;
}

// biome pools: shapes that live there (tough ones separately: they line the street or sit to the side)
export const BIOMES = {
  village: { busy: true, ground: '#9fd86b', road: '#e8d6a8', edge: '#5aa04a', things: ['fence', 'mailbox', 'cart', 'bench', 'lamp', 'flag', 'crate', 'barrel', 'hay', 'pumpkin', 'cow', 'pig', 'chicken', 'duck'], tough: ['house', 'house', 'barn', 'windmill', 'tractor'] },
  farm: { busy: true, ground: '#b5e06b', road: '#e3c98f', edge: '#6aa83f', things: ['hay', 'hay', 'fence', 'cart', 'pumpkin', 'cow', 'cow', 'sheep', 'pig', 'chicken', 'duck', 'barrel'], tough: ['barn', 'tractor', 'windmill'] },
  meadow: { ground: '#8fd45e', road: '#cfe9a0', edge: '#4f9a3c', things: ['cow', 'sheep', 'pig', 'chicken', 'bunny', 'hay', 'fence', 'mushroom', 'bush', 'flag', 'balloon', 'frog', 'duck', 'pumpkin', 'tree'], tough: ['rock'] },
  forest: { ground: '#6fbf5a', road: '#c9dd9a', edge: '#2f7a4a', things: ['tree', 'pine', 'bush', 'mushroom', 'bunny', 'frog', 'crate', 'robot', 'dino', 'barrel'], tough: ['rock'] },
  snow: { ground: '#eef6ff', road: '#ffffff', edge: '#cfe0f0', things: ['snowman', 'snowman', 'pine', 'penguin', 'penguin', 'sheep', 'flag', 'crate', 'bunny'], tough: ['igloo', 'rock'] },
};

// 0..1 smooth interpolation between knots
const smooth = (k) => k * k * (3 - 2 * k);

export function createMountain(seed, { density = 1 } = {}) {
  seed = Math.max(1, Math.round(+seed || 1));
  const snowy = stream(seed, 'course', 'theme').chance(0.35); // a snowy mountain: more snow stretches
  const cache = new Map();
  const knotCache = new Map();

  // center line: knots every CHUNK m, random offsets that grow from 0 at the top
  function knot(k) {
    if (knotCache.has(k)) return knotCache.get(k);
    const r = stream(seed, 'course', 'knot', k);
    const amp = Math.min(1, Math.max(0, k - 1) / 3) * 9;
    const v = { x: k <= 1 ? 0 : r.range(-1, 1) * amp, w: k <= 0 ? 10 : r.range(9, 13) };
    knotCache.set(k, v);
    return v;
  }
  const lerpKnot = (d, f) => {
    const k = Math.max(0, Math.floor(d / CHUNK)), a = knot(k)[f], b = knot(k + 1)[f];
    return a + (b - a) * smooth(Math.min(1, Math.max(0, d / CHUNK - k)));
  };
  const centerX = (d) => lerpKnot(d, 'x');
  const baseHalf = (d) => lerpKnot(d, 'w');

  // biome plan: busy (village / farm) stretches alternate with calm ones (meadow / forest / snow)
  const plan = ['start'];
  function biomeOf(i) {
    let seg = plan.segs || 0;
    while (plan.length <= i) {
      const r = stream(seed, 'course', 'seg', seg);
      const busy = seg % 2 === 1;
      const biome = busy ? r.weighted(['village', 'farm'], [snowy ? 0.5 : 0.65, snowy ? 0.5 : 0.35])
        : r.weighted(['meadow', 'forest', 'snow'], snowy ? [0.25, 0.2, 0.55] : [0.45, 0.4, 0.15]);
      const len = busy ? r.int(1, 2) : r.int(1, 2);
      for (let n = 0; n < len; n++) plan.push(biome);
      seg++;
    }
    plan.segs = seg;
    return plan[i];
  }

  function chunk(i) {
    const key = `${i}:${density}`;
    if (cache.has(key)) return cache.get(key);
    const biomeKey = biomeOf(i);
    const biome = BIOMES[biomeKey === 'start' ? 'meadow' : biomeKey];
    const d0 = i * CHUNK, d1 = d0 + CHUNK;
    const course = stream(seed, 'course', 'chunk', i);
    const ramps = [], rivers = [];
    if (i >= 2 && course.chance(biome.busy ? 0.25 : 0.4)) ramps.push({ d: d0 + course.range(8, 32), off: course.range(-3, 3), w: 4.5, len: 5 });
    if (i >= 3 && !biome.busy && course.chance(0.3)) rivers.push({ d: d0 + course.range(10, 30), w: 5 });
    const busy = !!biome.busy;
    const half = (d) => baseHalf(d) + (busy ? 2 : 0);

    const objects = [];
    const clear = (d, off, r) => ramps.every((rp) => Math.abs(d - rp.d) > rp.len / 2 + r + 1 || Math.abs(off - rp.off) > rp.w / 2 + r + 1)
      && rivers.every((rv) => Math.abs(d - rv.d) > rv.w / 2 + r + 0.5);
    const add = (j, d, off, shapes, opts = {}) => {
      const rec = randomRecipe(stream(seed, 'recipe', i, j), shapes, opts);
      const sh = SHAPE[rec.shape];
      const scale = { tiny: 0.6, normal: 1, big: 1.6 }[rec.size];
      const r = sh.r * scale;
      if (!clear(d, off, r)) return;
      const look = stream(seed, 'look', i, j);
      objects.push({ id: `${i}-${j}`, recipe: recipeId(rec), shape: rec.shape, kind: sh.kind, d: +d.toFixed(2), x: +(centerX(d) + off).toFixed(2),
        r: +r.toFixed(2), rot: +look.range(-Math.PI, Math.PI).toFixed(3), wob: +look.range(0, 6.28).toFixed(3), hidden: !!opts.rare });
    };

    if (biomeKey === 'start') {
      // the top: a short empty run-up, then an easy line of things straight ahead (quick first bonks)
      for (let j = 0; j < 6; j++) add(j, d0 + 16 + j * 4, stream(seed, 'place', i, j).range(-1.5, 1.5), ['hay', 'crate', 'pumpkin', 'cow', 'sheep', 'mushroom']);
    } else if (busy) {
      // the street is lined with houses / barns (tough: they bounce you back unless RAINBOW ROLL)
      const nTough = Math.round(4 * Math.min(1.5, density));
      for (let j = 0; j < nTough; j++) {
        const p = stream(seed, 'place', i, j);
        const side = j % 2 ? 1 : -1;
        const d = d0 + (j >> 1) * 13 + p.range(2, 8); // rows every 13 m (independent of how many)
        add(j, d, side * (half(d) - p.range(2.5, 4)), biome.tough);
      }
      // ... and packed with smashables in rows across the road: the big combo moments
      const n = Math.round(14 * density);
      for (let j = 0; j < n; j++) {
        const p = stream(seed, 'place', i, 100 + j);
        const d = d0 + p.range(2, CHUNK - 2);
        add(100 + j, d, p.range(-1, 1) * (half(d) - 5), biome.things);
      }
    } else {
      // calm stretch: a few things, a big rock or two, and a hidden rare sticker near the edge
      const n = Math.round(6 * density);
      for (let j = 0; j < n; j++) {
        const p = stream(seed, 'place', i, 100 + j);
        const d = d0 + p.range(2, CHUNK - 2);
        add(100 + j, d, p.range(-1, 1) * (half(d) - 2), biome.things);
      }
      const p = stream(seed, 'place', i, 0);
      if (p.chance(0.6)) { const d = d0 + p.range(5, 35); add(0, d, p.range(-1, 1) * (half(d) - 3), biome.tough); }
      const q = stream(seed, 'place', i, 1);
      if (q.chance(0.7)) { const d = d0 + q.range(5, 35); add(1, d, (q.chance(0.5) ? 1 : -1) * (half(d) - 1.6), biome.things, { rare: true, goldenChance: 0.12 }); }
    }
    objects.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
    const out = { index: i, d0, d1, biome: biomeKey, ramps, rivers, objects };
    cache.set(key, out);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    return out;
  }

  return {
    seed,
    snowy,
    name: mountainName(seed),
    title: mountainTitle(seed),
    centerX,
    halfWidth: (d) => baseHalf(d) + (BIOMES[biomeOf(Math.max(0, Math.floor(d / CHUNK)))]?.busy ? 2 : 0),
    biomeAt: (d) => biomeOf(Math.max(0, Math.floor(d / CHUNK))),
    chunk,
    // a fingerprint of the first n chunks (tests and the 🔧 panel: "same seed = same mountain")
    fingerprint(n = 10) { let h = 0; for (let i = 0; i < n; i++) h = hash(h, JSON.stringify(chunk(i))); return h.toString(16); },
  };
}
