// Mega Roll v2.0: seeded runs (themes, sections in 4 acts, species reveals, landmark), the catalog, and the
// passport (v1.0 sticker books keep loading). Run: npm test
import { createRun, mountainName, CHUNK } from '../src/games/08-mega-roll/v2.0/mountain.js';
import { SECTIONS, ACTS, THEME_INFO } from '../src/games/08-mega-roll/v2.0/sections.js';
import { SHAPES, THEMES, THEME_OF, HP, CATALOG_SIZE, parseId, recipeId, recipeName, allIds } from '../src/games/08-mega-roll/v2.0/recipes.js';
import { SHAPES as V1_SHAPES, allIds as v1Ids } from '../src/games/08-mega-roll/v1.0/recipes.js';
import { loadCollection, themeCount, themeTotal, PER_SHAPE } from '../src/games/08-mega-roll/v2.0/book.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };
const FP_4721 = { farm: '', forest: '', snowy: '' };

// --- same seed + theme, same run ---
for (const th of THEMES) {
  const a = createRun(4721, th), b = createRun(4721, th);
  check(`${th}: same seed, same run (plan, objects, decor, landmark)`, a.fingerprint() === b.fingerprint());
  const c = createRun(4721, th);
  const order = [9, 2, 13, 0, 5, 11, 1];
  for (const i of order) c.chunk(i);
  check(`${th}: chunks made out of order are identical`, Array.from({ length: 14 }, (_, i) => JSON.stringify(c.chunk(i))).join() === Array.from({ length: 14 }, (_, i) => JSON.stringify(a.chunk(i))).join());
  FP_4721[th] = a.fingerprint();
  // --- different seeds differ ---
  const fps = new Set(Array.from({ length: 120 }, (_, i) => createRun(i + 1, th).fingerprint()));
  check(`${th}: 120 seeds give 120 different runs`, fps.size === 120, `${fps.size}`);
  const plans = new Set(Array.from({ length: 120 }, (_, i) => createRun(i + 1, th).plan.map((p) => p.id).join()));
  check(`${th}: sections get shuffled (many different orders)`, plans.size > 12, `${plans.size} section orders`);
}
check('same seed, different theme = different run', createRun(7, 'farm').fingerprint() !== createRun(7, 'forest').fingerprint());
check('mountain names are per theme and stable', mountainName(4721, 'farm') === mountainName(4721, 'farm') && mountainName(4721, 'farm') !== mountainName(4721, 'snowy'), `${mountainName(4721, 'farm')} / ${mountainName(4721, 'snowy')}`);

// --- structure: 4 acts, pools, species progression, landmark ---
let ok = { acts: true, pools: true, firstSparse: true, reveals: true, unlocked: true, themeBook: true, onCourse: true, landmark: true, villageBuilding: true, density: true };
for (const th of THEMES) for (let seed = 1; seed <= 60; seed++) {
  const r = createRun(seed, th), T = THEME_INFO[th];
  const acts = r.plan.map((p) => p.act);
  if (acts.join() !== ACTS.flatMap((a, i) => Array(a.sections).fill(i)).join()) ok.acts = false;
  for (const p of r.sections) if (p.def.pool !== ACTS[p.act].pool || p.def.theme !== th) ok.pools = false;
  const first = r.objects.filter((o) => o.section === 0 && o.kind === 'critter');
  if (new Set(first.map((o) => o.shape)).size > 2) ok.firstSparse = false;
  const rev = r.objects.filter((o) => o.reveal).map((o) => o.shape);
  if (rev.join() !== T.species.join()) ok.reveals = false; // every species revealed once, in order
  for (const o of r.objects) {
    const sec = r.sections[o.section];
    if (o.kind === 'critter' && sec && !sec.unlocked.includes(o.shape)) ok.unlocked = false;
    if (THEME_OF[o.shape] !== th) ok.themeBook = false;
    if (Math.abs(o.x - r.centerX(o.d)) > r.halfWidth(o.d) + 0.01 || !parseId(o.recipe)) ok.onCourse = false;
    if (o.d >= r.landmark.d - 6) ok.landmark = false;
    if (o.kind === 'tough' && o.hp !== (HP[o.shape] || 2)) ok.landmark = false;
  }
  for (const p of r.sections.filter((s) => s.def.pool === 'village')) if (!r.objects.some((o) => o.section === p.index && o.kind === 'tough' && Math.abs(o.off) < 3)) ok.villageBuilding = false;
  const dens = (s) => s.density;
  if (!(dens(r.sections[0]) < dens(r.sections[r.sections.length - 1]))) ok.density = false;
}
check('every run = 4 acts in order (calm 2, busier 3, village rush 3, finale)', ok.acts);
check('each act draws from its own section pool, in its theme', ok.pools);
check('the first section is sparse: at most 2 species', ok.firstSparse);
check('every species gets exactly one NEW FRIEND reveal, in order', ok.reveals);
check('animals only appear after their species was introduced', ok.unlocked);
check('every sticker in a run belongs to that theme\'s book', ok.themeBook);
check('everything sits on the course with a valid recipe', ok.onCourse);
check('the landmark is last; buildings have 2–3 hit points', ok.landmark);
check('every village scene has a building right in the path', ok.villageBuilding);
check('density climbs toward the finale', ok.density);
const lo = createRun(55, 'farm', { density: 0.6 }), hi = createRun(55, 'farm', { density: 1.6 });
check('more density = more objects', hi.objects.length > lo.objects.length, `${lo.objects.length} -> ${hi.objects.length}`);
for (const th of THEMES) {
  const n = SECTIONS.filter((s) => s.theme === th).length;
  check(`${th}: has hand-made sections in every pool`, ['intro', 'busy', 'village'].every((p) => SECTIONS.some((s) => s.theme === th && s.pool === p)), `${n} sections`);
}
const r0 = createRun(4721, 'farm');
check('run length ~ a minute at the default speed', r0.length > 380 && r0.length < 700, `${Math.round(r0.length)} m`);
check('chunks cover the whole run', r0.chunk(Math.floor(r0.landmark.d / CHUNK)).index >= 0);

// --- pinned: mountain 4721 is the same run as when v2.0 shipped (change generation => new release) ---
const SHIPPED = { farm: '989d22a0', forest: 'e6a328d1', snowy: '2f4289c8' };
for (const th of THEMES) check(`${th}: mountain 4721 unchanged since v2.0`, FP_4721[th] === SHIPPED[th], `${FP_4721[th]}`);

// --- catalog: v1.0 ids still valid, new species appended, one theme per shape ---
check('every v1.0 shape still exists (old stickers stay valid)', V1_SHAPES.every((s) => SHAPES.find((t) => t.key === s.key)));
let v1valid = true, n = 0;
for (const id of v1Ids()) { if (n++ % 7) continue; if (!parseId(id) || recipeId(parseId(id)) !== id) v1valid = false; }
check('v1.0 sticker ids parse in v2.0', v1valid);
check('every shape is in exactly one theme book', SHAPES.every((s) => THEMES.includes(THEME_OF[s.key])));
const names = new Set([...allIds()].map(recipeName));
check('every sticker has its own name', names.size === CATALOG_SIZE, `${names.size.toLocaleString('en-US')} names`);
check('theme totals add up', THEMES.reduce((a, th) => a + themeTotal(th), 0) === CATALOG_SIZE && PER_SHAPE * SHAPES.length === CATALOG_SIZE);

// --- passport: a v1.0 book (same storage key) loads; export / import merges ---
const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, _m: m }; };
const v1Book = { v: 1, found: { 'cow.pink.spots.party.normal': { n: 3, m: 4721, t: 1 }, 'penguin.blue.plain.none.tiny': { n: 1, m: 12, t: 2 }, 'house.yellow.stripes.shades.tiny': { n: 1, m: 9, t: 3 }, 'mushroom.gold.plain.crown.big': { n: 2, m: 5, t: 4 }, 'nonsense.id': { n: 1 } } };
const store = mem({ 'wiggle.megaroll.book': JSON.stringify(v1Book) });
const col = loadCollection(store);
check('v1.0 sticker book loads in v2.0 (4 valid stickers, junk dropped)', col.count === 4 && col.get('cow.pink.spots.party.normal').n === 3, `${col.count}`);
check('v1.0 stickers land in the right theme books', themeCount(col, 'farm') === 2 && themeCount(col, 'forest') === 1 && themeCount(col, 'snowy') === 1);
check('a new find is saved under the same key', col.add('deer.red.plain.none.normal', { m: 1 }) && JSON.parse(store._m['wiggle.megaroll.book']).found['deer.red.plain.none.normal']);
const v1Export = JSON.stringify({ kind: 'mega-roll-stickers', version: 1, found: { 'sheep.white.plain.none.normal': { n: 1, m: 3, t: 5 } }, best: { 3: 900 } });
const col2 = loadCollection(mem());
check('a v1.0 sticker export file imports into v2.0', col2.importJSON(v1Export) === 1 && col2.has('sheep.white.plain.none.normal'));

if (failures) { console.log(`\n${failures} Mega Roll v2.0 check(s) failed`); process.exit(1); }
console.log('\nAll Mega Roll v2.0 checks passed');
