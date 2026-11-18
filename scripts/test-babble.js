// Gibberish voice planner (src/core/babble.js): syllables in order, no overlaps, sensible lengths, capitals
// louder/higher, a big low final "BAH", crab lower than friend, envelopes that start and end silent. Run: npm test
import { planBabble, syllableEnvelope, VOICES } from '../src/core/babble.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };
let seed = 3;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const line = planBabble('Blah blah BLAH… BAH!', { voice: 'crab' }, rnd);
const sy = line.syllables;
check('a line has syllables', sy.length >= 4, `${sy.length}`);
check('syllables are in order and never overlap (one mouth)', sy.every((s, i) => i === 0 || s.t >= sy[i - 1].t + sy[i - 1].dur - 1e-6));
check('length is talk-like (0.5..3 s)', line.total > 0.5 && line.total < 3, `${line.total} s`);
check('ends with a big low BAH', line.bah && sy[sy.length - 1].bah && sy[sy.length - 1].dur >= 0.28 && sy[sy.length - 1].f0 < VOICES.crab.base);
const loud = sy.find((s) => s.amp >= 0.99 && !s.bah), soft = sy[0];
check('capital word is louder than a lowercase one', loud && loud.amp > soft.amp);
check('vowels come from the words (blah -> a)', sy.slice(0, 3).every((s) => s.vowel === 'a'));

const avg = (p) => p.syllables.reduce((a, s) => a + s.f0, 0) / p.syllables.length;
const crab = planBabble('Zib zab zoo', { voice: 'crab' }, rnd), friend = planBabble('Zib zab zoo', { voice: 'friend' }, rnd);
check('crab is lower than a friend', avg(crab) * 2 < avg(friend), `${avg(crab).toFixed(0)} Hz vs ${avg(friend).toFixed(0)} Hz`);
check('friend talks faster than the crab', friend.total < crab.total);
check('questions rise at the end', (() => { const q = planBabble('Wibble wobble?', {}, rnd).syllables.at(-1); return q.f1end > q.f0; })());
check('speed option shortens the line', planBabble('blah blah blah', { speed: 2 }, rnd).total < planBabble('blah blah blah', { speed: 1 }, rnd).total);
check('vol scales every syllable', planBabble('blah', { vol: 0 }, rnd).syllables.every((s) => s.amp === 0));
check('no letters = no syllables (punctuation only)', planBabble('… !?', {}, rnd).syllables.length === 0);
check('unknown voice falls back to alien', planBabble('blah', { voice: 'nope' }, rnd).syllables[0].wave === VOICES.alien.wave);
const env = syllableEnvelope(0.13);
check('envelope starts and ends silent, peaks at 1', env[0][1] === 0 && env.at(-1)[1] === 0 && Math.max(...env.map((p) => p[1])) === 1 && env.at(-1)[0] === 0.13);

if (failures) { console.log(`\n${failures} babble check(s) FAILED`); process.exit(1); }
console.log('\nAll babble checks passed');
