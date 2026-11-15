// Every "feel" setting of Smash Run, tunable live from the parent panel (🔧). Saved per device.
// `core` settings are pushed into the core detectors (gestures.runConfig / punchConfig) on every change.

export const SETTINGS = [
  { key: 'boulderSpeed', label: 'Boulder speed', hint: 'how fast things roll at you (m/s)', min: 1, max: 15, step: 0.5, def: 6 },
  { key: 'spawnRate', label: 'How many things', hint: 'new things per second', min: 0.1, max: 2.5, step: 0.05, def: 0.7 },
  { key: 'smashWindow', label: 'Smash window', hint: 'seconds before a thing reaches you that a punch still smashes it', min: 0.3, max: 4, step: 0.1, def: 1.5 },
  { key: 'punchSensitivity', label: 'Punch sensitivity', hint: 'higher = slower, smaller punches count', min: 0.3, max: 3, step: 0.05, def: 1, core: ['punch', 'sensitivity'] },
  { key: 'runSensitivity', label: 'Run sensitivity', hint: 'higher = smaller steps count as running', min: 0.3, max: 3, step: 0.05, def: 1, core: ['run', 'sensitivity'] },
  { key: 'walkAt', label: 'Walking starts at', hint: 'run intensity that counts as walking', min: 0.03, max: 0.5, step: 0.01, def: 0.12, core: ['run', 'walkAt'] },
  { key: 'runAt', label: 'Running starts at', hint: 'run intensity that counts as running', min: 0.15, max: 0.9, step: 0.01, def: 0.45, core: ['run', 'runAt'] },
  { key: 'auraAt', label: 'Power aura above', hint: 'run intensity where things explode on contact (1 = only in POWER MODE)', min: 0.2, max: 1, step: 0.01, def: 0.6 },
  { key: 'topSpeed', label: 'Top running speed', hint: 'world speed at full intensity (m/s)', min: 3, max: 30, step: 1, def: 14 },
  { key: 'meterFill', label: 'Speed meter fill', hint: 'how fast running fills the POWER meter (per second at full speed)', min: 0.01, max: 0.5, step: 0.01, def: 0.09 },
  { key: 'powerTime', label: 'POWER MODE length', hint: 'seconds', min: 3, max: 30, step: 1, def: 10 },
  { key: 'splitCount', label: 'Split pieces', hint: 'how many pieces a big thing breaks into (0 = no splitting)', min: 0, max: 5, step: 1, def: 3 },
  { key: 'worldLength', label: 'World length', hint: 'seconds per world', min: 20, max: 180, step: 5, def: 65 },
  { key: 'debris', label: 'Explosion size', hint: 'debris amount and blast size', min: 0.2, max: 2.5, step: 0.1, def: 1 },
  { key: 'bonkEvery', label: 'Bonk when still', hint: 'seconds between bonks while standing still (30 = almost never)', min: 1.5, max: 30, step: 0.5, def: 5 },
  { key: 'trollEvery', label: 'Troll round every', hint: 'seconds between sneaky troll rounds', min: 30, max: 300, step: 10, def: 90 },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

export const PRESETS = {
  Default: { ...DEFAULTS },
  'Super easy': {
    ...DEFAULTS, boulderSpeed: 4, spawnRate: 0.5, smashWindow: 3, punchSensitivity: 2, runSensitivity: 1.8,
    walkAt: 0.08, runAt: 0.32, auraAt: 0.35, meterFill: 0.16, splitCount: 2, bonkEvery: 8,
  },
  Wild: {
    ...DEFAULTS, boulderSpeed: 10, spawnRate: 1.4, smashWindow: 1.8, splitCount: 4, debris: 2, meterFill: 0.12,
    topSpeed: 22, powerTime: 14, bonkEvery: 3,
  },
};

const STORE = 'wiggle.smashrun.tuning';

export function loadTuning() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE)) || {};
    return { settings: { ...DEFAULTS, ...(d.settings || {}) }, preset: d.preset || 'Default', notes: d.notes || '' };
  } catch { return { settings: { ...DEFAULTS }, preset: 'Default', notes: '' }; }
}

export function saveTuning(t) {
  try { localStorage.setItem(STORE, JSON.stringify({ settings: t.settings, preset: t.preset, notes: t.notes })); } catch { /* private mode */ }
}

// Push the detector settings into the core trackers (they reset to their defaults when a game starts).
export function applyCore(settings, gestures) {
  for (const s of SETTINGS) {
    if (!s.core) continue;
    const cfg = s.core[0] === 'run' ? gestures.runConfig : gestures.punchConfig;
    cfg[s.core[1]] = settings[s.key];
  }
}
