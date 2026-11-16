// A Mega Roll v2.0 run from a seed + a theme. Pure (no three.js / DOM): `npm test` (scripts/test-mega-roll-v2.js)
// checks that the same seed and theme always give the same run, and that different seeds differ.
//
// A run = 4 ACTS (sections.js): calm intro -> busier -> village rush -> finale. Each act draws hand-made SECTIONS
// from its own pool in a seeded order (no section twice in a row), with seeded variety inside each section.
// Species arrive one at a time (INTRODUCE_AT): the section that introduces one stars it, and its first animal
// carries `reveal: true` (the NEW FRIEND! moment). The run ends at the theme's giant landmark.
// The game streams it in CHUNKS of CHUNK m (chunk(i)), like v1.0.
//
// Random streams (core rng.js), keyed by (seed, theme, purpose, ...): 'name', 'course' (center line, width),
// 'plan' (which sections, leads, mirroring), 'place' (positions inside a section), 'recipe' (which sticker each
// thing is), 'look' (rotation / wobble, cosmetic only).

import { stream, hash } from '../../../core/rng.js';
import { SHAPE, HP, randomRecipe, recipeId } from './recipes.js';
import { THEME_INFO, ACTS, INTRODUCE_AT, FINALE_APPROACH, ARENA, sectionsFor } from './sections.js';

export const CHUNK = 40;
export const MAX_SEED = 9999;
export const LANDMARK_HP = 8;

const ADJ = ['Wobbly', 'Giggly', 'Bouncy', 'Sleepy', 'Fluffy', 'Zoomy', 'Silly', 'Sparkly', 'Jiggly', 'Wiggly', 'Snuggly', 'Bumpy',
  'Sneezy', 'Tickly', 'Squishy', 'Rumbly', 'Twisty', 'Dizzy', 'Happy', 'Noodly', 'Burpy', 'Dancing', 'Tumbly', 'Cozy'];
const NOUN = ['Pickle', 'Pancake', 'Noodle', 'Muffin', 'Banana', 'Marshmallow', 'Pudding', 'Cupcake', 'Waffle', 'Jellybean', 'Meatball',
  'Potato', 'Popcorn', 'Cookie', 'Taco', 'Dumpling', 'Sock', 'Teapot', 'Bubble', 'Giraffe', 'Penguin', 'Donut', 'Broccoli', 'Pajama'];
const END = { farm: ['Farm', 'Meadow', 'Hill', 'Fields'], forest: ['Woods', 'Forest', 'Hollow', 'Grove'], snowy: ['Peak', 'Mountain', 'Slopes', 'Glacier'] };

export function mountainName(seed, theme = 'farm') {
  const r = stream(seed, 'name');
  const a = r.pick(ADJ), n = r.pick(NOUN);
  return `${a} ${n} ${stream(seed, theme, 'name').pick(END[theme])}`;
}
export const mountainTitle = (seed, theme) => `Mountain ${seed} · ${mountainName(seed, theme)}`;
export function randomSeed(avoid = []) {
  let s;
  do { s = 1 + Math.floor(Math.random() * MAX_SEED); } while (avoid.includes(s));
  return s;
}

const smooth = (k) => k * k * (3 - 2 * k);

export function createRun(seed, theme = 'farm', { density = 1 } = {}) {
  seed = Math.max(1, Math.round(+seed || 1));
  const T = THEME_INFO[theme] || THEME_INFO.farm;
  theme = T.key;

  // ---------- plan: which sections, in which order, starring whom ----------
  const plan = [];
  const unlocked = [];
  const reveals = [];
  let idx = 0, prev = null;
  for (const [a, act] of ACTS.entries()) {
    for (let k = 0; k < act.sections; k++, idx++) {
      const r = stream(seed, theme, 'plan', idx);
      const due = T.species.findIndex((sp, i) => INTRODUCE_AT[i] === idx);
      const newSp = due >= 0 ? T.species[due] : null;
      if (newSp) { unlocked.push(newSp, ...(T.companions[newSp] || [])); }
      const pool = sectionsFor(theme, act.pool).filter((s) => s.id !== prev);
      let sec, lead;
      if (newSp) {
        const starring = pool.filter((s) => s.leads?.includes(newSp));
        sec = r.pick(starring.length ? starring : pool.filter((s) => !s.leads).length ? pool.filter((s) => !s.leads) : pool);
        lead = newSp;
      } else {
        const ok = pool.filter((s) => !s.leads || s.leads.some((sp) => unlocked.includes(sp)));
        sec = r.pick(ok.length ? ok : pool);
        const can = (sec.leads || unlocked).filter((sp) => unlocked.includes(sp) && !(T.companions.sheep || []).includes(sp) || false);
        lead = can.length ? r.pick(can) : unlocked[0];
      }
      prev = sec.id;
      plan.push({ index: idx, act: a, actName: act.name, id: sec.id, def: sec, lead, newSpecies: newSp, mirror: r.chance(0.5) ? -1 : 1, unlocked: [...unlocked], density: act.density * density });
    }
  }

  // ---------- course: center line + width ----------
  const knotCache = new Map();
  function knot(k) {
    if (knotCache.has(k)) return knotCache.get(k);
    const r = stream(seed, theme, 'course', 'knot', k);
    const amp = Math.min(1, Math.max(0, k - 1) / 3) * 7;
    const v = { x: k <= 1 ? 0 : r.range(-1, 1) * amp, w: k <= 0 ? 10 : r.range(9.5, 11.5) };
    knotCache.set(k, v);
    return v;
  }
  const lerpKnot = (d, f) => {
    const k = Math.max(0, Math.floor(d / CHUNK)), a = knot(k)[f], b = knot(k + 1)[f];
    return a + (b - a) * smooth(Math.min(1, Math.max(0, d / CHUNK - k)));
  };

  // lay the sections end to end
  let d = 24; // a short empty run-up at the top
  for (const s of plan) { s.d0 = d; s.d1 = d + s.def.len; d = s.d1; }
  const approach0 = d, arena0 = d + FINALE_APPROACH;
  const landmarkD = arena0 + ARENA;
  const length = landmarkD + 30;
  // the arena is straight and wide, centered where the course arrives
  const arenaX = lerpKnot(arena0 - 10, 'x');
  const centerX = (dd) => (dd >= arena0 - 10 ? arenaX : lerpKnot(dd, 'x'));
  const sectionAt = (dd) => plan.find((s) => dd >= s.d0 && dd < s.d1) || null;
  const halfWidth = (dd) => {
    if (dd >= arena0 - 10) return 10 + Math.min(1, (dd - (arena0 - 10)) / 12) * 6;
    const s = sectionAt(dd);
    return lerpKnot(dd, 'w') + (s?.def.pool === 'village' ? 2.5 : 0);
  };

  // ---------- objects ----------
  const objects = [], decor = [], ramps = [], rivers = [];
  for (const s of plan) {
    const place = stream(seed, theme, 'place', s.index);
    const groupLook = {};
    let j = 0, revealed = false;
    const S = {
      lead: s.lead, mx: s.mirror,
      range: (a, b) => place.range(a, b),
      pick: (arr) => place.pick(arr),
      any: () => place.pick(s.unlocked),
      n: (k) => Math.max(1, Math.round(k * s.density)),
      put(shape, x, dd, opts = {}) {
        if (!SHAPE[shape]) return;
        const jx = place.range(-0.35, 0.35), jd = place.range(-0.35, 0.35);
        const ad = s.d0 + dd + jd;
        const off = (x + jx) * s.mirror;
        const rr = stream(seed, theme, 'recipe', s.index, j);
        const rec = randomRecipe(rr, [shape]);
        if (opts.group) {
          const g = groupLook[opts.group] ||= { color: rec.color, pattern: rec.pattern, hat: rec.hat, size: rec.size };
          Object.assign(rec, { color: g.color, pattern: g.pattern });
          if (!opts.size) rec.size = SHAPE[shape].kind === 'tough' ? rec.size : g.size;
        }
        if (opts.look) Object.assign(rec, opts.look);
        if (opts.size) rec.size = opts.size;
        const sh = SHAPE[shape];
        const scale = { tiny: 0.6, normal: 1, big: 1.6 }[rec.size];
        const look = stream(seed, theme, 'look', s.index, j);
        const o = {
          id: `${s.index}-${j}`, recipe: recipeId(rec), shape, kind: sh.kind, d: +ad.toFixed(2), x: +(centerX(ad) + off).toFixed(2), off: +off.toFixed(2),
          r: +(sh.r * scale).toFixed(2), rot: +look.range(-0.5, 0.5).toFixed(3), wob: +look.range(0, 6.28).toFixed(3),
          act: opts.act || null, section: s.index, hp: sh.kind === 'tough' ? HP[shape] || 2 : 0,
        };
        if (opts.act === 'waddle' || opts.act === 'slide') o.dir = s.mirror; // which way they cross
        if (!revealed && s.newSpecies && shape === s.newSpecies) { o.reveal = true; revealed = true; }
        objects.push(o);
        j++;
      },
      pond: (x, dd, r) => decor.push({ type: 'pond', x: centerX(s.d0 + dd) + x * s.mirror, d: s.d0 + dd, r }),
      mud: (x, dd, r) => decor.push({ type: 'mud', x: centerX(s.d0 + dd) + x * s.mirror, d: s.d0 + dd, r }),
      ice: (x, dd, r) => decor.push({ type: 'ice', x: centerX(s.d0 + dd) + x * s.mirror, d: s.d0 + dd, r }),
      blanket: (x, dd) => decor.push({ type: 'blanket', x: centerX(s.d0 + dd) + x * s.mirror, d: s.d0 + dd, r: 2.4 }),
      stream: (dd, w) => rivers.push({ d: s.d0 + dd, w }),
      ramp: (x, dd) => ramps.push({ d: s.d0 + dd, off: x * s.mirror, w: 4.5, len: 5 }),
    };
    s.def.build(S);
    // a hidden rare treasure near the edge in calm / busy stretches (steering practice)
    if (s.def.pool !== 'village' && place.chance(0.6)) {
      const dd = s.d0 + place.range(6, s.def.len - 6), side = place.chance(0.5) ? 1 : -1;
      const rec = randomRecipe(stream(seed, theme, 'recipe', s.index, 'rare'), T.things, { rare: true, goldenChance: 0.12 });
      const look = stream(seed, theme, 'look', s.index, 'rare');
      objects.push({ id: `${s.index}-r`, recipe: recipeId(rec), shape: rec.shape, kind: SHAPE[rec.shape].kind, d: +dd.toFixed(2),
        x: +(centerX(dd) + side * (halfWidth(dd) - 1.6)).toFixed(2), off: side * 9, r: +(SHAPE[rec.shape].r * { tiny: 0.6, normal: 1, big: 1.6 }[rec.size]).toFixed(2),
        rot: +look.range(-0.5, 0.5).toFixed(3), wob: +look.range(0, 6.28).toFixed(3), act: null, section: s.index, hp: 0, hidden: true });
    }
  }
  // the finale approach: flags lining the way, a few things to bonk
  const fin = stream(seed, theme, 'place', 'finale');
  for (let k = 0; k < 5; k++) {
    const dd = approach0 + 3 + k * 6;
    for (const side of [-1, 1]) {
      const rec = randomRecipe(stream(seed, theme, 'recipe', 'finale', k * 2 + (side > 0)), ['flag']);
      objects.push({ id: `f-${k}-${side}`, recipe: recipeId(rec), shape: 'flag', kind: 'thing', d: dd, x: +(centerX(dd) + side * 7).toFixed(2), off: side * 7, r: 0.4, rot: 0, wob: k, act: null, section: 'finale', hp: 0 });
    }
    const t = randomRecipe(stream(seed, theme, 'recipe', 'finale', 'mid', k), T.things);
    objects.push({ id: `f-${k}-m`, recipe: recipeId(t), shape: t.shape, kind: SHAPE[t.shape].kind, d: dd + 3, x: +(centerX(dd) + fin.range(-3, 3)).toFixed(2), off: 0,
      r: +(SHAPE[t.shape].r * { tiny: 0.6, normal: 1, big: 1.6 }[t.size]).toFixed(2), rot: 0, wob: k, act: null, section: 'finale', hp: SHAPE[t.shape].kind === 'tough' ? HP[t.shape] || 2 : 0 });
  }
  objects.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  const landmark = { id: 'landmark', kind: 'landmark', shape: T.landmark, d: landmarkD, x: arenaX, r: 6.5, hp: LANDMARK_HP };

  const chunkCache = new Map();
  function chunk(i) {
    if (chunkCache.has(i)) return chunkCache.get(i);
    const d0 = i * CHUNK, d1 = d0 + CHUNK;
    const s = sectionAt(d0 + CHUNK / 2);
    const palette = T.ground[s?.def.pool === 'village' ? 'village' : 'calm'];
    const ch = {
      index: i, d0, d1, theme, pool: s?.def.pool || (d0 >= approach0 ? 'finale' : 'intro'), section: s?.id || null,
      colors: { ground: palette[0], road: palette[1], edge: palette[2] },
      objects: objects.filter((o) => o.d >= d0 && o.d < d1),
      decor: decor.filter((o) => o.d >= d0 && o.d < d1),
      ramps: ramps.filter((o) => o.d >= d0 && o.d < d1),
      rivers: rivers.filter((o) => o.d >= d0 && o.d < d1),
    };
    chunkCache.set(i, ch);
    return ch;
  }

  return {
    seed, theme, info: T,
    name: mountainName(seed, theme), title: mountainTitle(seed, theme),
    plan: plan.map(({ def, ...p }) => p), sections: plan,
    objects, decor, ramps, rivers, landmark, length, approach0, arena0, landmarkD,
    centerX, halfWidth, sectionAt, chunk,
    speciesOf: () => [...new Set(plan.flatMap((p) => p.unlocked))],
    fingerprint() { return hash(JSON.stringify({ plan: plan.map(({ def, ...p }) => p), objects, decor, ramps, rivers, landmark })).toString(16); },
  };
}
