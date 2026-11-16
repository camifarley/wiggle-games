// Every "feel" setting of Mega Roll, tunable live from the parent panel (🔧). Saved per device.
// `core` settings are pushed into the core detectors (gestures.steerConfig / runConfig) on every change.
// type 'toggle' = an on/off button (0 / 1).

export const SETTINGS = [
  { key: 'rollSpeed', label: 'Roll speed', hint: 'how fast the ball rolls downhill (m/s); a run is ~500 m + the finale', min: 4, max: 25, step: 0.5, def: 10 },
  { key: 'steerSensitivity', label: 'Steering sensitivity', hint: 'higher = a smaller lean steers more', min: 0.3, max: 3, step: 0.05, def: 1.2, core: ['steer', 'sensitivity'] },
  { key: 'deadzone', label: 'Steering deadzone', hint: 'how much lean counts as "straight"', min: 0, max: 0.5, step: 0.01, def: 0.15, core: ['steer', 'deadzone'] },
  { key: 'steerSpeed', label: 'Steering speed', hint: 'sideways speed at full lean (m/s)', min: 3, max: 20, step: 0.5, def: 10 },
  { key: 'assist', label: 'Auto-assist', hint: 'pull toward things to bonk and along the path (0 = none)', min: 0, max: 1, step: 0.05, def: 0.4 },
  { key: 'density', label: 'Object density', hint: 'how many things on the mountain (applies to the next round)', min: 0.3, max: 2, step: 0.1, def: 1 },
  { key: 'comboFill', label: 'Combo fill', hint: 'how much each bonk fills the RAINBOW meter', min: 0.02, max: 0.3, step: 0.01, def: 0.07 },
  { key: 'rainbowTime', label: 'Rainbow length', hint: 'seconds of RAINBOW ROLL', min: 3, max: 20, step: 0.5, def: 7 },
  { key: 'tuckBoost', label: 'Tuck boost', hint: 'speed x while crouching', min: 1, max: 2.5, step: 0.05, def: 1.5 },
  { key: 'chargeTime', label: 'Wrecking charge time', hint: 'seconds of crouching to fully charge the WRECKING ROLL', min: 0.5, max: 5, step: 0.1, def: 1.6 },
  { key: 'landmarkHits', label: 'Finale hits', hint: 'bonks to bring the giant landmark down (wrecking = 3, big bounce = 2)', min: 2, max: 12, step: 1, def: 6 },
  { key: 'paradeCap', label: 'Parade shown', hint: 'how many parade animals are drawn (0 = by device speed); the rest show as "+N"', min: 0, max: 60, step: 1, def: 0 },
  { key: 'runBoost', label: 'Turbo (run) boost', hint: 'speed x at full run-in-place', min: 1, max: 2, step: 0.05, def: 1.4 },
  { key: 'runSensitivity', label: 'Run sensitivity', hint: 'higher = smaller steps count as running', min: 0.3, max: 3, step: 0.05, def: 1, core: ['run', 'sensitivity'] },
  { key: 'bounce', label: 'Big bounce height', hint: 'jump launch speed (m/s)', min: 4, max: 16, step: 0.5, def: 9 },
  { key: 'face', label: 'Face porthole', hint: 'his live face on the ball (stays on this device)', type: 'toggle', min: 0, max: 1, step: 1, def: 1 },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

export const PRESETS = {
  Default: { ...DEFAULTS },
  'Super easy': {
    ...DEFAULTS, rollSpeed: 8, steerSensitivity: 1.8, deadzone: 0.1, assist: 0.7, comboFill: 0.12, rainbowTime: 10, chargeTime: 1, landmarkHits: 4,
  },
  Wild: {
    ...DEFAULTS, rollSpeed: 17, steerSpeed: 14, density: 1.6, assist: 0.2, comboFill: 0.08, rainbowTime: 9, tuckBoost: 1.9, bounce: 12,
  },
};

const STORE = 'wiggle.megaroll.tuning2'; // v2.0's own settings (v1.0 keeps its own)

export function loadTuning() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE)) || {};
    return { settings: { ...DEFAULTS, ...(d.settings || {}) }, preset: d.preset || 'Default', notes: d.notes || '' };
  } catch { return { settings: { ...DEFAULTS }, preset: 'Default', notes: '' }; }
}

export function saveTuning(t) {
  try { localStorage.setItem(STORE, JSON.stringify({ settings: t.settings, preset: t.preset, notes: t.notes })); } catch { /* private mode */ }
}

export function applyCore(settings, gestures) {
  for (const s of SETTINGS) {
    if (!s.core) continue;
    const cfg = s.core[0] === 'steer' ? gestures.steerConfig : gestures.runConfig;
    cfg[s.core[1]] = settings[s.key];
  }
}
