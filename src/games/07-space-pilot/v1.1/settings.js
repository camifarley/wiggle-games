// Every "feel" setting of Space Pilot, tunable live from the parent panel (🔧). Saved per device.
// `core` settings are pushed into the core detectors (gestures.steerConfig / runConfig / punchConfig).
// type 'toggle' = an on/off button (0 / 1).

export const SETTINGS = [
  // v1.1 (round 2): the things the parent reacts to, grouped at the top. 💾 Export saves them with the recording.
  { type: 'header', label: 'Pace' },
  { key: 'pace', label: 'Game pace', hint: 'all alien and rock speeds (x)', min: 0.4, max: 1.5, step: 0.05, def: 0.7 },
  { key: 'rampRounds', label: 'Ramp rounds', hint: 'rounds with a few bad guys before the full formation', min: 1, max: 8, step: 1, def: 4 },
  { key: 'formationSize', label: 'Max formation size', hint: 'bad guys in the full formation', min: 3, max: 14, step: 1, def: 7 },
  { key: 'boopEvery', label: 'Swoop every', hint: 'seconds between aliens swooping at the glass (once swoops are taught)', min: 1, max: 10, step: 0.25, def: 4 },
  { type: 'header', label: 'Look (for a far-away viewer)' },
  { key: 'starSize', label: 'Star size', hint: 'background star dots (px)', min: 0.5, max: 5, step: 0.1, def: 2.6 },
  { key: 'starBright', label: 'Star brightness', hint: 'how bright the background stars are', min: 0.1, max: 1, step: 0.05, def: 0.65 },
  { key: 'hudSize', label: 'HUD size', hint: 'side panels, words and cards (x)', min: 0.7, max: 1.7, step: 0.05, def: 1.15 },
  { key: 'objectSize', label: 'Object size', hint: 'bad guys, friends, bubbles, rocks (x)', min: 0.7, max: 1.7, step: 0.05, def: 1.25 },
  { type: 'header', label: 'Slime round' },
  { key: 'slimeLength', label: 'Slime round length', hint: 'seconds of the wave-to-wipe round', min: 10, max: 45, step: 1, def: 25 },
  { key: 'slimeSplats', label: 'Slime splats', hint: 'how many goo balls in the slime round', min: 2, max: 10, step: 1, def: 5 },
  { type: 'header', label: 'Duck' },
  { key: 'duckDepth', label: 'Duck dip depth', hint: 'how low the head must dip (face sizes; core duck.js default 1.2)', min: 0.6, max: 3, step: 0.1, def: 1.2 },
  { key: 'duckWait', label: 'Duck wait time', hint: 'seconds the rock waits in front of him before floating over', min: 3, max: 15, step: 0.5, def: 9 },
  { type: 'header', label: 'Boss' },
  { key: 'bossHealth', label: 'Boss health', hint: 'laser hits per weak point (left claw, right claw, heart; ~6 hits a second)', min: 8, max: 120, step: 2, def: 24 },
  { key: 'armSwap', label: 'Crab arm-swap time', hint: 'seconds one claw stays down (glowing) before he swaps arms', min: 5, max: 20, step: 0.5, def: 12 },
  { type: 'header', label: 'Play distance' },
  { key: 'playDistance', label: 'Play distance rule', hint: '0 = head + shoulders is enough (stand close) · 1 = hips too · 2 = knees (classic)', min: 0, max: 2, step: 1, def: 0 },
  { type: 'header', label: 'More' },
  { key: 'missionLength', label: 'Mission length cap', hint: 'seconds: after this the current round finishes and the boss comes', min: 40, max: 240, step: 5, def: 150 },
  { key: 'steerSensitivity', label: 'Steering sensitivity', hint: 'higher = a smaller lean steers more', min: 0.3, max: 3, step: 0.05, def: 1.2, core: ['steer', 'sensitivity'] },
  { key: 'deadzone', label: 'Steering deadzone', hint: 'how much lean counts as "straight"', min: 0, max: 0.5, step: 0.01, def: 0.12, core: ['steer', 'deadzone'] },
  { key: 'steerSpeed', label: 'Steering speed', hint: 'how fast the ship slides sideways at full lean (m/s)', min: 3, max: 20, step: 0.5, def: 9 },
  { key: 'aimAssist', label: 'Aim assist', hint: 'how far from the crosshair the lasers still find a bad guy (0 = none)', min: 0, max: 1, step: 0.05, def: 0.6 },
  { key: 'fireRate', label: 'Laser rate', hint: 'auto-fire shots per second', min: 2, max: 12, step: 0.5, def: 6 },
  { key: 'alienSpeed', label: 'Alien speed', hint: 'how fast formations fly in and dance (x)', min: 0.4, max: 2, step: 0.05, def: 1 },
  { key: 'swoopClose', label: 'Swoop distance', hint: 'how close swooping aliens come (m; smaller = closer, bigger on screen)', min: 3, max: 12, step: 0.5, def: 5 },
  { key: 'punchSensitivity', label: 'Punch sensitivity', hint: 'double blast; higher = softer punches count (bonus only)', min: 0.3, max: 3, step: 0.05, def: 1, core: ['punch', 'sensitivity'] },
  { key: 'runSensitivity', label: 'Run sensitivity', hint: 'thrusters; higher = smaller steps count as running', min: 0.3, max: 3, step: 0.05, def: 1, core: ['run', 'sensitivity'] },
  { key: 'wipeAt', label: 'Wiper motion', hint: 'how much hand waving (lower screen) runs the wipers', min: 0.02, max: 0.5, step: 0.01, def: 0.12 },
  { key: 'face', label: 'Comms camera', hint: 'his live face on the comms screen (stays on this device)', type: 'toggle', min: 0, max: 1, step: 1, def: 1 },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.filter((s) => s.key).map((s) => [s.key, s.def]));

export const PRESETS = {
  Default: { ...DEFAULTS },
  'Super easy': { ...DEFAULTS, steerSensitivity: 1.8, deadzone: 0.08, aimAssist: 0.9, alienSpeed: 0.75, bossHealth: 20, boopEvery: 3.5, missionLength: 120 },
  Wild: { ...DEFAULTS, alienSpeed: 1.5, formationSize: 11, boopEvery: 1.5, swoopClose: 4, fireRate: 9, bossHealth: 60, missionLength: 180 },
};

const STORE = 'wiggle.spacepilot.v11.tuning'; // v1.1 has its own (new defaults; v1.0 keeps its saved tuning)

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
