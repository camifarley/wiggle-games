// Pause keys (src/core/pause.js): Escape always toggles; Space toggles only when test controls are off, and with
// test controls on Space is still exactly ONE jump (testbody key mapper), never a pause. Run: npm test
import { pauseKeyAction } from '../src/core/pause.js';
import { createKeyMapper } from '../src/core/testbody.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };

check('Escape toggles (keys off)', pauseKeyAction({ key: 'Escape' }) === 'toggle');
check('Escape toggles (keys on)', pauseKeyAction({ key: 'Escape', testKeysOn: true }) === 'toggle');
check('Space toggles when test controls are off', pauseKeyAction({ key: ' ' }) === 'toggle');
check('Space does NOT pause when test controls are on', pauseKeyAction({ key: ' ', testKeysOn: true }) === null);
check('auto-repeat never toggles', pauseKeyAction({ key: 'Escape', repeat: true }) === null && pauseKeyAction({ key: ' ', repeat: true }) === null);
check('typing in the notes box never toggles', pauseKeyAction({ key: ' ', typing: true }) === null);
check('other keys do nothing', ['p', 'Enter', 'ArrowLeft', 's'].every((key) => pauseKeyAction({ key }) === null));
check('Cmd/Ctrl combos do nothing', pauseKeyAction({ key: ' ', modifier: true }) === null);

// keys on: holding Space = one jump press, and the pause rule ignores every one of those keydowns
const presses = [];
const keys = createKeyMapper({ press: (n) => presses.push(n), release: () => {} });
let pauses = 0;
for (const repeat of [false, true, true, true]) {
  const e = { key: ' ', repeat, shiftKey: false };
  keys.keyDown(e);
  if (pauseKeyAction({ key: ' ', repeat, testKeysOn: keys.handles(' ') })) pauses++;
}
keys.keyUp({ key: ' ' });
check('keys on: holding Space = one jump, zero pauses', presses.filter((n) => n === 'jump').length === 1 && pauses === 0, `presses ${presses.join(',')}`);

if (failures) { console.log(`\n${failures} pause check(s) FAILED`); process.exit(1); }
console.log('\nAll pause checks passed');
