// Simulated checks for the core toy finder (src/core/toy.js createToyFinder), used by Bubble Pop's wand.
// Kid at play distance: shoulders 0.2 of the frame wide, wrists visible.  Run: node scripts/test-toy.js
import { createToyFinder } from '../src/core/toy.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const DT = 1 / 20;
const wrist = { x: 0.62, y: 0.45 };
function sample(extra = {}) {
  const blobs = { red: { found: false }, blue: { found: false }, yellow: { found: false }, green: { found: false } };
  return { blobs: { ...blobs, ...extra }, bodyWidth: 0.2, wrists: [wrist], aspect: 16 / 9 };
}
function run(f, secs, mk, opts) { let seen = 0, last = null; for (let t = 0; t < secs; t += DT) { last = f.update(DT, mk(t), opts); if (last) seen += DT; } return { seen, last }; }

{ // a big blue sofa in the background: never a toy
  const f = createToyFinder();
  const r = run(f, 20, () => sample({ blue: { found: true, x: 0.2, y: 0.7, size: 0.05 } }));
  check(r.seen < 0.5, `big blue background is not a toy (seen ${r.seen.toFixed(2)} s)`);
}
{ // after learning the room, a small red toy in his hand is found quickly
  const f = createToyFinder();
  run(f, 3, () => sample({ blue: { found: true, x: 0.2, y: 0.7, size: 0.05 } }));
  const r = run(f, 1, () => sample({ blue: { found: true, x: 0.2, y: 0.7, size: 0.05 }, red: { found: true, x: wrist.x, y: wrist.y - 0.03, size: 0.004 } }));
  check(r.last?.color === 'red' && r.seen > 0.7, `small red toy in hand found (${r.last?.color}, ${r.seen.toFixed(2)} s of 1)`);
}
{ // while the wand is on (learn: false) a toy held for 10 s is never learned away
  const f = createToyFinder();
  run(f, 3, () => sample());
  const r = run(f, 10, (t) => sample({ green: { found: true, x: 0.3 + 0.3 * Math.sin(t), y: 0.4, size: 0.0045 } }), { learn: false });
  check(r.seen > 9.5, `toy waved for 10 s with learn:false stays found (${r.seen.toFixed(2)} s)`);
}
{ // a tiny speck of colour (not enough) is not a toy
  const f = createToyFinder();
  run(f, 3, () => sample());
  const r = run(f, 3, () => sample({ yellow: { found: true, x: 0.9, y: 0.1, size: 0.0021 } }));
  check(r.seen === 0, `tiny yellow speck far from hands is not a toy (seen ${r.seen.toFixed(2)} s)`);
}
if (fails) { console.log(`\n${fails} toy check(s) failed`); process.exit(1); }
console.log('\nToy finder checks passed');
