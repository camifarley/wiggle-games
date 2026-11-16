// Cloud Credits settings (🔧 panel), saved per device. Family names live here too: localStorage only,
// never in the repo or the build (the repo is public).

export const SETTINGS = [
  { key: 'speed', label: 'Scroll speed', hint: '1 = a relaxed scroll, about 2½ minutes; 2 = twice as fast', min: 0.5, max: 3, step: 0.1, def: 1 },
  { key: 'textSize', label: 'Text size', hint: 'how big the credits are', min: 0.7, max: 1.6, step: 0.05, def: 1 },
  { key: 'drift', label: 'Lean drift', hint: 'how far leaning moves the balloon', min: 0, max: 2, step: 0.1, def: 1 },
  { key: 'layout', label: 'Layout', hint: 'A Big first: all big cards, then the roll · B Chapters: each section opens with its card. Restarts the ride. (?layout=a|b in the URL overrides it)', type: 'toggle', labels: ['A · Big first', 'B · Chapters'], min: 0, max: 1, step: 1, def: 0 },
  { key: 'interaction', label: 'Body interaction', hint: 'lean, puff and wave at stars (off = just watch)', type: 'toggle', min: 0, max: 1, step: 1, def: 1 },
];
export const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

// family slots: credits.json entries with `family: <key>` show the name typed here
export const FAMILY = [
  { key: 'codesigner', label: 'Playtesting & game design (our little co-designer)', placeholder: 'a name' },
  { key: 'family', label: 'The whole family', placeholder: 'e.g. Grandma, Grandpa and Rex' },
];

const STORE = 'wiggle.cloudcredits.tuning';
const FAMILY_STORE = 'wiggle.cloudcredits.family';

export function loadTuning() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE)) || {};
    return { settings: { ...DEFAULTS, ...(d.settings || {}) }, notes: d.notes || '' };
  } catch { return { settings: { ...DEFAULTS }, notes: '' }; }
}
export function saveTuning(t) {
  try { localStorage.setItem(STORE, JSON.stringify({ settings: t.settings, notes: t.notes })); } catch { /* private mode */ }
}
// { grownup, codesigner, tester, family, extra: 'one thank-you per line: Name - for what' }
export function loadFamily() {
  try { return JSON.parse(localStorage.getItem(FAMILY_STORE)) || {}; } catch { return {}; }
}
export function saveFamily(f) {
  try { localStorage.setItem(FAMILY_STORE, JSON.stringify(f)); } catch { /* private mode */ }
}
