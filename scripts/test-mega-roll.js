// Mega Roll determinism + sticker catalog checks. Run: npm test
// Same seed => identical mountain (name, chunks, objects). Different seeds differ. Recipe ids are stable.
import { createMountain, mountainName, mountainTitle, CHUNK } from '../src/games/08-mega-roll/v1.0/mountain.js';
import { SHAPES, CATALOG_SIZE, recipeId, parseId, recipeName, rarity, recipePoints, randomRecipe, allIds } from '../src/games/08-mega-roll/v1.0/recipes.js';
import { stream, hash } from '../src/games/08-mega-roll/v1.0/rng.js';

let failures = 0;
const PINNED_FP = 'b136c253'; // fingerprint(10) of mountain 4721 in v1.0
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };
const dump = (m, n = 20) => JSON.stringify(Array.from({ length: n }, (_, i) => m.chunk(i)));

// --- same seed, same mountain ---
const a = createMountain(4721), b = createMountain(4721);
check('same seed: same name', a.name === b.name && mountainName(4721) === a.name, a.title);
check('same seed: identical chunks + objects (20 chunks)', dump(a) === dump(b));
// generated in a different order (streaming jumps around) => still identical
const c = createMountain(4721);
for (const i of [7, 3, 15, 0, 19, 11]) c.chunk(i);
check('same seed, chunks made out of order: identical', dump(c) === dump(a));
check('same seed: identical center line', [0, 33, 120, 401, 799].every((d) => a.centerX(d) === b.centerX(d) && a.halfWidth(d) === b.halfWidth(d)));

// --- known values: a change to the generator that reshuffles old mountains must be deliberate ---
// (if you change generation on purpose, make a NEW release and update these numbers)
const GOLDEN = { name: mountainName(4721), fp: a.fingerprint(10) };
console.log(`     mountain 4721 = "${GOLDEN.name}", fingerprint ${GOLDEN.fp}`);
check('name of mountain 4721 is stable', GOLDEN.name === 'Squishy Taco Slopes', `got "${GOLDEN.name}"`);
check('mountain 4721 is the same mountain as when v1.0 shipped', GOLDEN.fp === PINNED_FP, `fingerprint ${GOLDEN.fp}, pinned ${PINNED_FP}`);
check('mountain title format', mountainTitle(4721) === `Mountain 4721 · ${mountainName(4721)}`);

// --- different seeds differ ---
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const fps = new Set(seeds.map((s) => createMountain(s).fingerprint(6)));
check('200 seeds give 200 different mountains', fps.size === 200, `${fps.size} distinct`);
const names = new Set(seeds.map(mountainName));
check('mountain names vary (200 seeds)', names.size >= 180, `${names.size} distinct names`);
check('different seeds: different objects', JSON.stringify(createMountain(1).chunk(4)) !== JSON.stringify(createMountain(2).chunk(4)));

// --- separate streams: density only adds/removes objects, never reshuffles the others ---
const lo = createMountain(77, { density: 1 }), hi = createMountain(77, { density: 1.5 });
let kept = true, more = 0;
for (let i = 0; i < 20; i++) {
  const A = new Map(lo.chunk(i).objects.map((o) => [o.id, JSON.stringify(o)]));
  const B = new Map(hi.chunk(i).objects.map((o) => [o.id, JSON.stringify(o)]));
  for (const [id, o] of A) if (B.has(id) && B.get(id) !== o) kept = false;
  more += B.size - A.size;
}
check('more density: existing objects stay identical', kept);
check('more density: more objects', more > 20, `+${more}`);
check('same course regardless of density', [0, 50, 300, 700].every((d) => lo.centerX(d) === hi.centerX(d)));

// --- course sanity ---
let ok = true, total = 0, crit = 0, tough = 0, busy = 0;
for (const s of [1, 42, 4721, 9999]) {
  const m = createMountain(s);
  for (let i = 0; i < 25; i++) {
    const ch = m.chunk(i);
    if (ch.biome === 'village' || ch.biome === 'farm') busy++;
    for (const o of ch.objects) {
      total++; if (o.kind === 'critter') crit++; if (o.kind === 'tough') tough++;
      if (o.d < ch.d0 || o.d > ch.d1 || Math.abs(o.x - m.centerX(o.d)) > m.halfWidth(o.d) || !parseId(o.recipe)) ok = false;
    }
  }
}
check('objects stay on the course, inside their chunk, with valid recipes', ok);
check('a busy village stretch on every mountain (alternating with calm)', busy >= 4 * 6, `${busy} busy chunks in 100`);
check('a good mix of critters / tough things', crit > total * 0.1 && tough > total * 0.05 && tough < total * 0.3, `${total} objects, ${crit} critters, ${tough} tough`);
check('start chunk has easy things straight ahead', createMountain(5).chunk(0).objects.length >= 5);

// --- recipes: stable ids, unique names ---
check('catalog has thousands of stickers', CATALOG_SIZE >= 2000, `${CATALOG_SIZE.toLocaleString('en-US')}`);
const ids = [...allIds()];
check('every id is unique and round-trips', new Set(ids).size === CATALOG_SIZE && ids.every((id) => recipeId(parseId(id)) === id));
const nm = new Set(ids.map(recipeName));
check('every sticker has its own name', nm.size === CATALOG_SIZE, `${nm.size} names`);
check('stable id format', recipeId({ shape: 'cow', color: 'pink', pattern: 'spots', hat: 'party', size: 'normal' }) === 'cow.pink.spots.party.normal');
check('funny names', recipeName('cow.pink.spots.party.normal') === 'Polka-dot Party Bubblegum Cow' && recipeName('house.yellow.stripes.shades.tiny') === 'Tiny Stripy Banana House with Sunglasses',
  `${recipeName('cow.pink.spots.party.normal')} / ${recipeName('house.yellow.stripes.shades.tiny')}`);
check('rarity tiers', rarity('cow.gold.plain.none.normal') === 'golden' && rarity('cow.red.sparkles.none.normal') === 'rare' && rarity('cow.red.plain.crown.normal') === 'rare' && rarity('cow.red.plain.none.normal') === 'common');
check('bad ids are rejected', parseId('cow.plaid.spots.none.normal') === null && parseId('nope') === null);
check('golden scores most', recipePoints('cow.gold.plain.none.normal') > recipePoints('cow.red.sparkles.none.normal') && recipePoints('cow.red.sparkles.none.normal') > recipePoints('cow.red.plain.none.normal'));
const r1 = stream(9, 'recipe', 3, 4), r2 = stream(9, 'recipe', 3, 4);
check('recipe streams are deterministic', recipeId(randomRecipe(r1, ['cow', 'pig'])) === recipeId(randomRecipe(r2, ['cow', 'pig'])));
let gold = 0, rare = 0;
for (let i = 0; i < 20000; i++) { const t = rarity(randomRecipe(stream('odds', i), SHAPES.map((s) => s.key))); if (t === 'golden') gold++; if (t === 'rare') rare++; }
check('golden is very rare, rare is uncommon', gold > 0 && gold < 20000 * 0.03 && rare > 20000 * 0.05 && rare < 20000 * 0.25, `golden ${(gold / 200).toFixed(2)}%, rare ${(rare / 200).toFixed(1)}%`);
check('hash is stable', hash('mega', 'roll', 1) === hash('mega', 'roll', 1) && hash('ab', 'c') !== hash('a', 'bc'));
check('CHUNK length', CHUNK === 40);

if (failures) { console.log(`\n${failures} Mega Roll check(s) failed`); process.exit(1); }
console.log('\nAll Mega Roll checks passed');
