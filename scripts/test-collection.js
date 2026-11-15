// Shared core helpers: rng.js streams are deterministic, collection.js saves / merges without losing entries.
// Run: npm test
import { stream, hash } from '../src/core/rng.js';
import { createCollection } from '../src/core/collection.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };

// --- rng ---
const seq = (...k) => { const s = stream(...k); return Array.from({ length: 8 }, () => s.next()); };
check('rng: same key, same numbers', JSON.stringify(seq(7, 'a', 1)) === JSON.stringify(seq(7, 'a', 1)));
check('rng: different keys differ', JSON.stringify(seq(7, 'a', 1)) !== JSON.stringify(seq(7, 'a', 2)));
check('rng: hash separates parts', hash('ab', 'c') !== hash('a', 'bc'));
const s = stream(1, 'w');
const ints = Array.from({ length: 500 }, () => s.int(1, 3));
check('rng: int is inclusive', ints.includes(1) && ints.includes(3) && ints.every((v) => v >= 1 && v <= 3));

// --- collection (in-memory storage) ---
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const st = mem();
const valid = (id) => /^[a-z]+\.[a-z]+$/.test(id);
const a = createCollection('test.book', { kind: 'test-book', valid, storage: st });
check('collection: starts empty', a.count === 0);
check('collection: first add is new', a.add('blob.pink', { m: 1 }) === true);
check('collection: second add is not new', a.add('blob.pink') === false && a.get('blob.pink').n === 2);
check('collection: invalid ids are ignored', a.add('nope') === false && a.count === 1);
const b = createCollection('test.book', { kind: 'test-book', valid, storage: st });
check('collection: persists (reload sees it)', b.has('blob.pink') && b.get('blob.pink').m === 1);
// import merges
const other = createCollection('other', { kind: 'test-book', valid, storage: mem() });
other.add('bean.blue'); other.add('blob.pink'); other.add('blob.pink'); other.add('blob.pink');
const added = b.importJSON(other.exportJSON());
check('collection: import adds only new ids', added === 1 && b.count === 2, `added ${added}`);
check('collection: import keeps the bigger count', b.get('blob.pink').n === 3);
let threw = false;
try { b.importJSON(JSON.stringify({ kind: 'something-else', found: {} })); } catch { threw = true; }
check('collection: refuses a different kind of file', threw && b.count === 2);
st.setItem('test.broken', '{not json');
check('collection: broken storage starts fresh', createCollection('test.broken', { storage: st }).count === 0);

if (failures) { console.log(`\n${failures} collection check(s) FAILED`); process.exit(1); }
console.log('\ncollection + rng: all checks passed');
