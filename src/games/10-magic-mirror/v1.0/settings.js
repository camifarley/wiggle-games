// Every feel setting of Magic Mirror, tunable live from the 🔧 panel and saved on this device.
// group: 'global' or a station id (the panel shows Global + the current station's group).

export const SETTINGS = [
  { group: 'global', key: 'meterSpeed', label: 'Magic meter speed', hint: 'how fast moving fills the meter (finale sooner)', min: 0.2, max: 4, step: 0.1, def: 1 },
  { group: 'global', key: 'sharpness', label: 'Picture sharpness', hint: 'x the tier\'s render size (lower = faster on slow tablets)', min: 0.4, max: 1.5, step: 0.05, def: 1 },
  { group: 'global', key: 'maskSmooth', label: 'Cutout smoothing', hint: 'newest mask weight: lower = steadier edges, more lag', min: 0.1, max: 1, step: 0.05, def: 0.65 },
  { group: 'global', key: 'maskFeather', label: 'Cutout edge softness', hint: 'soft / blurry edge around him', min: 0.01, max: 0.35, step: 0.01, def: 0.12 },
  { group: 'global', key: 'maskCut', label: 'Cutout threshold', hint: 'how sure the mask must be (lower = more of the room sneaks in)', min: 0.2, max: 0.8, step: 0.02, def: 0.5 },
  { group: 'global', key: 'plateRate', label: 'Room learning speed', hint: 'how fast it learns the room behind him (Invisible)', min: 0.01, max: 0.3, step: 0.01, def: 0.08 },
  { group: 'global', key: 'stillAt', label: '"Still" below', hint: 'motion that counts as standing still (Statue, Invisible)', min: 0.03, max: 0.4, step: 0.01, def: 0.12 },
  { group: 'global', key: 'surpriseTime', label: 'Surprise me: seconds per effect', min: 10, max: 90, step: 1, def: 25 },

  { group: 'funhouse', key: 'fhBend', label: 'Lean bend', min: 0, max: 2.5, step: 0.05, def: 1 },
  { group: 'funhouse', key: 'fhStretch', label: 'Jump stretch / squat squash', min: 0, max: 2.5, step: 0.05, def: 1 },
  { group: 'clones', key: 'cloneDelay', label: 'Clone delay (s)', hint: 'each clone copies him this much later than the last', min: 0.05, max: 0.5, step: 0.01, def: 0.2 },
  { group: 'clones', key: 'maxClones', label: 'Max clones', hint: 'capped by tier (high 8, medium 6, low 4)', min: 1, max: 8, step: 1, def: 8 },
  { group: 'smear', key: 'smearSpan', label: 'Smear length', hint: 'fraction of the remembered frames', min: 0.1, max: 1, step: 0.05, def: 0.8 },
  { group: 'trails', key: 'trailCount', label: 'Trail ghosts', min: 2, max: 12, step: 1, def: 8 },
  { group: 'trails', key: 'trailGap', label: 'Frames between ghosts', min: 1, max: 6, step: 1, def: 2 },
  { group: 'light', key: 'ribbonLife', label: 'Ribbon life (s)', min: 1, max: 15, step: 0.5, def: 5 },
  { group: 'light', key: 'ribbonWidth', label: 'Ribbon width', min: 0.3, max: 3, step: 0.1, def: 1 },
  { group: 'kaleido', key: 'kMax', label: 'Most mirror pieces', hint: 'arms all the way up', min: 4, max: 16, step: 1, def: 12 },
  { group: 'kaleido', key: 'kSpin', label: 'Spin power', min: 0, max: 3, step: 0.1, def: 1 },
  { group: 'pixel', key: 'pxBlock', label: 'Pixel size', min: 4, max: 40, step: 1, def: 14 },
  { group: 'teleport', key: 'zapTime', label: 'Zap time (s)', min: 0.1, max: 1, step: 0.05, def: 0.35 },
  { group: 'giant', key: 'giantScale', label: 'Giant size', min: 1.2, max: 2.6, step: 0.05, def: 1.8 },
  { group: 'giant', key: 'tinyScale', label: 'Tiny size', min: 0.2, max: 0.9, step: 0.05, def: 0.45 },
  { group: 'statue', key: 'turnTime', label: 'Seconds to turn to stone', min: 1, max: 15, step: 0.5, def: 5 },
  { group: 'statue', key: 'crackSpeed', label: 'Crack speed', min: 0.2, max: 4, step: 0.1, def: 1 },
  { group: 'invisible', key: 'fadeSpeed', label: 'Fade speed', min: 0.2, max: 3, step: 0.1, def: 1 },
  { group: 'jelly', key: 'wobbly', label: 'Wobbliness', min: 0, max: 3, step: 0.1, def: 1 },
  { group: 'jelly', key: 'springy', label: 'Springiness', hint: 'higher = faster jiggle', min: 0.3, max: 2.5, step: 0.05, def: 1 },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));
const STORE = 'wiggle.magicmirror.tuning';

export function loadTuning() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE)) || {};
    return { settings: { ...DEFAULTS, ...(d.settings || {}) }, notes: d.notes || '' };
  } catch { return { settings: { ...DEFAULTS }, notes: '' }; }
}

export function saveTuning(t) {
  try { localStorage.setItem(STORE, JSON.stringify({ settings: t.settings, notes: t.notes })); } catch { /* private mode */ }
}
