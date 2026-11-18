// Space Pilot: the Alien Passport catalog (stable recipe ids, names, rarity) and saving friends.
// Run: npm test
import { SHAPES, CATALOG_SIZE, recipeId, parseId, recipeName, rarity, randomRecipe, allIds } from '../src/games/07-space-pilot/v1.0/recipes.js';
import * as R11 from '../src/games/07-space-pilot/v1.1/recipes.js';
import { stream } from '../src/core/rng.js';
import { createCollection } from '../src/core/collection.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };

// --- catalog ---
const ids = [...allIds()];
check('catalog: hundreds of friends', CATALOG_SIZE >= 500 && ids.length === CATALOG_SIZE, `${CATALOG_SIZE}`);
check('catalog: ids are unique', new Set(ids).size === ids.length);
check('catalog: every id parses back', ids.every((id) => parseId(id) && recipeId(parseId(id)) === id));
check('catalog: junk ids are rejected', !parseId('blob.pink') && !parseId('cow.pink.plain.none.normal') && !parseId('blob.pink.plain.none.normal.extra'));
// pinned names: a rename would break passports saved on devices (append new keys, never rename)
check('name: plain', recipeName('blob.pink.plain.none.normal') === 'Bubblegum Bloblet', recipeName('blob.pink.plain.none.normal'));
check('name: full', recipeName('bun.gold.spots.bow.tiny') === 'Tiny Polka-dot Golden Bunbun with a Bow', recipeName('bun.gold.spots.bow.tiny'));
check('name: prefix hat', recipeName('twinkle.blue.swirl.helmet.big') === 'BIG Swirly Astronaut Sky Twinkle', recipeName('twinkle.blue.swirl.helmet.big'));
check('rarity', rarity('blob.gold.plain.none.normal') === 'golden' && rarity('bean.red.sparkles.none.tiny') === 'rare' && rarity('puff.red.plain.crown.tiny') === 'rare' && rarity('jelly.green.stripes.antenna.normal') === 'common');
check('every shape has a home planet', SHAPES.every((s) => s.planet && s.planetEmoji));

// --- every release shares ONE passport: v1.1's catalog must list exactly the same ids (append-only) ---
const ids11 = [...R11.allIds()];
check('v1.1 catalog keeps every v1.0 id (shared passport)', ids.every((id) => R11.parseId(id)) && ids11.slice(0, ids.length).join() === ids.join());
check('v1.1 names match v1.0', ids.filter((_, i) => i % 97 === 0).every((id) => R11.recipeName(id) === recipeName(id)));

// --- random friends: valid, varied, golden is rare, rare forcing works ---
const rnd = stream(7, 'test');
const made = Array.from({ length: 4000 }, () => recipeId(randomRecipe(rnd)));
check('random: always valid', made.every((id) => parseId(id)));
check('random: varied', new Set(made).size > 1500, `${new Set(made).size} distinct of 4000`);
const golden = made.filter((id) => rarity(id) === 'golden').length;
check('random: golden is rare (0.1%..1%)', golden >= 4 && golden <= 40, `${golden} golden`);
check('random: rare forcing', Array.from({ length: 200 }, () => rarity(recipeId(randomRecipe(rnd, { rare: true })))).every((t) => t !== 'common'));

// --- the passport (collection with the game's id rule) ---
const mem = new Map();
const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
const pp = createCollection('wiggle.spacepilot.passport', { kind: 'space-pilot-passport', valid: (id) => !!parseId(id), storage });
check('passport: new friend first time', pp.add('blob.pink.plain.none.normal', { m: 'Rescue Run' }) === true);
check('passport: not new the second time', pp.add('blob.pink.plain.none.normal') === false);
check('passport: refuses unknown ids', pp.add('blob.pink') === false && pp.count === 1);
const again = createCollection('wiggle.spacepilot.passport', { kind: 'space-pilot-passport', valid: (id) => !!parseId(id), storage });
check('passport: survives a reload', again.count === 1 && again.get('blob.pink.plain.none.normal').m === 'Rescue Run');

if (failures) { console.log(`\n${failures} space pilot check(s) FAILED`); process.exit(1); }
console.log('\nspace pilot: all checks passed');
