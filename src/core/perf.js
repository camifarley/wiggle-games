// Performance tiers. Picks a starting tier from the device, then watches real FPS
// and steps DOWN only if the device can't keep up. iPhone and Mac start on "high"
// and only drop if they are genuinely struggling (sustained < 24 fps).
//
// Overrides: ?tier=high|medium|low pins a tier (no auto changes). ?tier=auto clears memory.

export const TIERS = {
  high:   { name: 'high',   sampleWidth: 96, dprMax: 2,   trackFps: 30, particles: 1.0, maxParticles: 600, camWidth: 1280, camHeight: 720 },
  medium: { name: 'medium', sampleWidth: 72, dprMax: 1.5, trackFps: 20, particles: 0.6, maxParticles: 300, camWidth: 960,  camHeight: 540 },
  low:    { name: 'low',    sampleWidth: 48, dprMax: 1,   trackFps: 12, particles: 0.3, maxParticles: 120, camWidth: 640,  camHeight: 480 },
};
const ORDER = ['high', 'medium', 'low'];
const STORE_KEY = 'wiggle.tier';
const MIN_FPS = 24;
const BAD_SECONDS_TO_DROP = 3;

const listeners = new Set();
const params = new URLSearchParams(location.search);

function store(get, value) {
  try {
    if (get) return localStorage.getItem(STORE_KEY);
    if (value == null) localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, value);
  } catch { /* private mode etc. */ }
  return null;
}

function guessTier() {
  const ua = navigator.userAgent;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // not on Safari; default to "fine"
  const isApple = /iPhone|iPad|Macintosh/.test(ua);
  const isFire = /Silk|Kindle|KF[A-Z]{2,4}\b/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (isFire) return 'low';
  if (isApple) return 'high';
  if (isAndroid) return cores <= 4 || mem <= 2 ? 'low' : 'medium';
  return cores <= 4 ? 'medium' : 'high';
}

const pinned = TIERS[params.get('tier')] ? params.get('tier') : null;
if (params.get('tier') === 'auto') store(false, null);

export const perf = {
  tier: TIERS[pinned || store(true) || guessTier()] || TIERS.medium,
  pinned: !!pinned,
  fps: 60,
  _frames: 0,
  _acc: 0,
  _bad: 0,

  get settings() { return this.tier; },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  set(name, persist = true) {
    if (!TIERS[name] || this.tier.name === name) return;
    this.tier = TIERS[name];
    if (persist) store(false, name);
    console.info(`[perf] tier -> ${name}`);
    listeners.forEach((fn) => fn(this.tier));
  },

  // Called once per frame by the loop with the real frame delta (seconds).
  tick(dt, active) {
    if (document.hidden || dt > 0.25) return; // ignore tab switches / hiccups
    this._frames++;
    this._acc += dt;
    if (this._acc < 1) return;
    this.fps = this._frames / this._acc;
    this._frames = 0;
    this._acc = 0;
    if (this.pinned || !active) return;
    this._bad = this.fps < MIN_FPS ? this._bad + 1 : 0;
    if (this._bad >= BAD_SECONDS_TO_DROP) {
      this._bad = 0;
      const next = ORDER[ORDER.indexOf(this.tier.name) + 1];
      if (next) this.set(next);
    }
  },
};
