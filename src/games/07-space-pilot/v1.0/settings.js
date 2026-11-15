// Every "feel" setting of Space Pilot, tunable live from the parent panel (🔧). Saved per device.
// `core` settings are pushed into the core detectors (gestures.steerConfig / runConfig / punchConfig).
// type 'toggle' = an on/off button (0 / 1).

export const SETTINGS = [
  { key: 'missionLength', label: 'Mission length', hint: 'seconds of alien waves before the boss (next mission)', min: 30, max: 120, step: 5, def: 60 },
  { key: 'bossHealth', label: 'Boss health', hint: 'laser hits per glowing weak point (3 weak points; ~6 hits a second)', min: 10, max: 120, step: 5, def: 40 },
  { key: 'steerSensitivity', label: 'Steering sensitivity', hint: 'higher = a smaller lean steers more', min: 0.3, max: 3, step: 0.05, def: 1.2, core: ['steer', 'sensitivity'] },
  { key: 'deadzone', label: 'Steering deadzone', hint: 'how much lean counts as "straight"', min: 0, max: 0.5, step: 0.01, def: 0.12, core: ['steer', 'deadzone'] },
  { key: 'steerSpeed', label: 'Steering speed', hint: 'how fast the ship slides sideways at full lean (m/s)', min: 3, max: 20, step: 0.5, def: 9 },
  { key: 'aimAssist', label: 'Aim assist', hint: 'how far from the crosshair the lasers still find a bad guy (0 = none)', min: 0, max: 1, step: 0.05, def: 0.6 },
  { key: 'fireRate', label: 'Laser rate', hint: 'auto-fire shots per second', min: 2, max: 12, step: 0.5, def: 6 },
  { key: 'alienSpeed', label: 'Alien speed', hint: 'how fast formations fly in and dance (x)', min: 0.4, max: 2, step: 0.05, def: 1 },
  { key: 'formationSize', label: 'Formation size', hint: 'bad guys per formation', min: 3, max: 14, step: 1, def: 7 },
  { key: 'swoopClose', label: 'Swoop distance', hint: 'how close swooping aliens come (m; smaller = closer, bigger on screen)', min: 3, max: 12, step: 0.5, def: 5 },
  { key: 'boopEvery', label: 'Swoop every', hint: 'seconds between aliens swooping at the glass', min: 1, max: 8, step: 0.25, def: 2.5 },
  { key: 'punchSensitivity', label: 'Punch sensitivity', hint: 'double blast; higher = softer punches count (bonus only)', min: 0.3, max: 3, step: 0.05, def: 1, core: ['punch', 'sensitivity'] },
  { key: 'runSensitivity', label: 'Run sensitivity', hint: 'thrusters; higher = smaller steps count as running', min: 0.3, max: 3, step: 0.05, def: 1, core: ['run', 'sensitivity'] },
  { key: 'wipeAt', label: 'Wiper motion', hint: 'how much hand waving (lower screen) runs the wipers', min: 0.02, max: 0.5, step: 0.01, def: 0.12 },
  { key: 'face', label: 'Comms camera', hint: 'his live face on the comms screen (stays on this device)', type: 'toggle', min: 0, max: 1, step: 1, def: 1 },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

export const PRESETS = {
  Default: { ...DEFAULTS },
  'Super easy': { ...DEFAULTS, steerSensitivity: 1.8, deadzone: 0.08, aimAssist: 0.9, alienSpeed: 0.75, bossHealth: 20, boopEvery: 3.5, missionLength: 50 },
  Wild: { ...DEFAULTS, alienSpeed: 1.5, formationSize: 11, boopEvery: 1.5, swoopClose: 4, fireRate: 9, bossHealth: 60, missionLength: 80 },
};

const STORE = 'wiggle.spacepilot.tuning';

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
  const cfgs = { steer: gestures.steerConfig, run: gestures.runConfig, punch: gestures.punchConfig };
  for (const s of SETTINGS) {
    if (!s.core) continue;
    const cfg = cfgs[s.core[0]];
    if (cfg) cfg[s.core[1]] = settings[s.key];
  }
}
