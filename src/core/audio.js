// Sound effects, a spoken voice, and the shared audio buses that music (music.js) plugs into.
// iOS requires a tap before audio works: main.js calls audio.unlock() on the Play tap.
//
//   sfx.pop()  sfx.ding()  sfx.boing()  sfx.whoosh()  sfx.tada()  sfx.tone(freq, dur, type)
//   sfx.play('smash')            any named slot (file if picked, else the synth fallback)
//   say('Pop the bubbles!')
//
// Every sound is synthesized in code unless the parent picked a real file for it in the Sound Picker:
// those live in src/core/sound-picks.js (slot -> files). A picked file plays instead of the synth;
// if it hasn't loaded yet (or fails to), the synth plays, so games never go silent.
// Sounds are rate-limited so 30 pops in one frame don't turn into noise.

import { PICKS } from './sound-picks.js';

let ac = null;
let master = null, sfxBus = null, musicBus = null, duckGain = null;

// ---- parent settings: volume steps + music on/off (remembered per device) ----
const STORE = 'wiggle.audio';
const VOLUMES = [1, 0.55, 0.25, 0]; // 🔊 🔉 🔈 🔇
const settings = { volume: 1, music: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* */ } };
const listeners = new Set();

// ---- test mode: agents test with ?fakecam, the parent never does. Those runs are silent so the parent can
// listen to other things. ?mute forces silence anywhere; &sound overrides it (e.g. ?fakecam&sound).
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const TEST_MUTE = params.has('mute') || (params.has('fakecam') && !params.has('sound'));
const effectiveVolume = () => (TEST_MUTE ? 0 : settings.volume);

// Catch-all for sounds played with HTML <audio> (e.g. new Audio(...) jingles): follow test mute and the
// parent's volume. Never touches the camera <video> (it has a srcObject and is already muted).
if (typeof HTMLMediaElement !== 'undefined') {
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (!this.srcObject && !(this instanceof HTMLVideoElement)) {
      if (TEST_MUTE || settings.volume === 0) this.muted = true;
      else this.volume = Math.min(this.volume, settings.volume);
    }
    return origPlay.apply(this, a);
  };
}
if (TEST_MUTE && typeof document !== 'undefined') {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const badge = () => {
    const b = document.createElement('div');
    b.textContent = '🔇 test mode';
    b.title = 'Silent because the URL has ?fakecam or ?mute. Add &sound to hear it.';
    b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;pointer-events:none;font:600 12px system-ui,sans-serif;'
      + 'color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:999px';
    document.body.append(b);
  };
  if (document.body) badge(); else addEventListener('DOMContentLoaded', badge);
}
const changed = () => { saveSettings(); applyVolume(); listeners.forEach((fn) => fn(settings)); };

function applyVolume() {
  if (!ac) return;
  master.gain.setTargetAtTime(effectiveVolume(), ac.currentTime, 0.03);
  musicBus.gain.setTargetAtTime(settings.music ? MUSIC_LEVEL : 0, ac.currentTime, 0.08);
}
const MUSIC_LEVEL = 0.45; // music sits under the sound effects and the voice

export const audio = {
  unlock() {
    try {
      if (ac) { if (ac.state !== 'running') ac.resume(); return; }
      ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      master = ac.createGain();
      // gentle limiter so stacked sounds never clip harshly
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.15;
      master.connect(comp).connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      duckGain = ac.createGain(); duckGain.connect(master);
      musicBus = ac.createGain(); musicBus.connect(duckGain);
      master.gain.value = effectiveVolume();
      musicBus.gain.value = settings.music ? MUSIC_LEVEL : 0;
      // play a silent blip so iOS fully unlocks
      const o = ac.createOscillator(), g = ac.createGain();
      g.gain.value = 0; o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.01);
      // warm up speech on iOS
      if ('speechSynthesis' in window && !TEST_MUTE) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      loadPicks();
    } catch { /* no audio, no problem */ }
  },
  get ctx() { return ac; },
  /** Bus nodes for music.js. null until unlock(). */
  get musicBus() { return musicBus; },
  get sfxBus() { return sfxBus; },

  // Parent controls (menu 🔊 / 🎵 buttons).
  get volume() { return settings.volume; },
  set volume(v) { settings.volume = Math.max(0, Math.min(1, +v || 0)); changed(); },
  /** true when nothing is audible: test mode (?fakecam / ?mute) or the parent's 🔇. Read-only. */
  get muted() { return TEST_MUTE || settings.volume === 0; },
  /** true when silenced by the URL (?fakecam without &sound, or ?mute). */
  get testMuted() { return TEST_MUTE; },
  /** Step 🔊 → 🔉 → 🔈 → 🔇 → 🔊. Returns the new volume. */
  nextVolume() {
    const i = VOLUMES.findIndex((v) => Math.abs(v - settings.volume) < 0.01);
    settings.volume = VOLUMES[(i + 1) % VOLUMES.length];
    changed();
    return settings.volume;
  },
  get musicOn() { return settings.music; },
  set musicOn(on) { settings.music = !!on; changed(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  volumeIcon(v = settings.volume) { return v === 0 ? '🔇' : v < 0.3 ? '🔈' : v < 0.8 ? '🔉' : '🔊'; },

  /** Lower the music for a while (speech). depth 0..1, 1 = silent. */
  duck(on, depth = 0.7) {
    if (!ac) return;
    duckGain.gain.setTargetAtTime(on ? 1 - depth : 1, ac.currentTime, on ? 0.05 : 0.35);
  },
};

// ---------------------------------------------------------------- synth building blocks
function env(freqFrom, freqTo, dur, type = 'sine', vol = 0.3, when = 0) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqFrom, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
// Filtered noise burst: splats, booms, snores, sneezes. attack > 0 fades in.
function noise(dur, vol, fFrom, fTo, { when = 0, attack = 0, type = 'lowpass', q = 1 } = {}) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + when;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(fFrom, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, fTo), t + dur);
  if (attack) { g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); }
  else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

// A cartoon "voice": oscillator with a pitch path [[time, freq], ...], vibrato and a soft envelope.
function sweep(points, { type = 'sine', vol = 0.25, dur, vib = 0, vibRate = 0, when = 0, attack = 0.005 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const end = dur ?? points[points.length - 1][0];
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(points[0][1], t);
  for (const [pt, f] of points.slice(1)) o.frequency.exponentialRampToValueAtTime(Math.max(1, f), t + pt);
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = vibRate; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + end + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + end);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + end + 0.05);
}

// ---------------------------------------------------------------- synthesized sounds
// The original sounds (v1 synth). Kept exactly so old game releases sound the same when nothing is picked.
const synth = {
  buzz: (dur = 0.6) => {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
    const f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 170 + Math.random() * 60;
    lfo.frequency.value = 22; lg.gain.value = 25; lfo.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(sfxBus);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  squeak: (pitch = 1) => env(520 * pitch, 980 * pitch, 0.14, 'sine', 0.22),
  skitter: () => { for (let i = 0; i < 5; i++) noise(0.025, 0.12, 5000, 3000, { when: i * 0.035, type: 'highpass' }); },
  splat: () => { noise(0.18, 0.35, 2600, 250); env(320, 70, 0.14, 'sine', 0.25); },
  squish: () => { env(650 + Math.random() * 200, 160, 0.16, 'triangle', 0.16); noise(0.1, 0.08, 1500, 400, { type: 'bandpass', q: 4 }); },
  snore: () => { noise(1.1, 0.22, 250, 700, { attack: 0.7, q: 6 }); env(85, 70, 1.1, 'sawtooth', 0.04); },
  boom: () => { noise(1.2, 0.6, 1800, 60); env(140, 32, 0.9, 'sine', 0.7); },
  giggle: () => [900, 1100, 950, 1200, 1000].forEach((f, i) => env(f, f * 0.9, 0.08, 'sine', 0.18, i * 0.09)),
  sneeze: () => { noise(0.6, 0.15, 400, 2500, { attack: 0.55, type: 'bandpass', q: 2 }); noise(0.35, 0.5, 4000, 300, { when: 0.6 }); },
  tone: (f, dur = 0.2, type = 'sine', vol = 0.3) => env(f, f, dur, type, vol),
  pop: () => env(500 + Math.random() * 400, 1400, 0.09, 'sine', 0.35),
  ding: () => { env(880, 880, 0.35, 'triangle', 0.25); env(1320, 1320, 0.4, 'sine', 0.15, 0.05); },
  boing: () => env(180, 520, 0.35, 'square', 0.12),
  whoosh: () => env(1200, 120, 0.3, 'sawtooth', 0.06),
  tada: () => [523, 659, 784, 1047].forEach((f, i) => env(f, f, 0.3, 'triangle', 0.22, i * 0.09)),
};

// New cartoony synth designs (v2). Offered as candidates in the Sound Picker; a slot can pick one with
// { synth: 'pop-bubble' } in sound-picks.js. Cute, bright, never dark.
const r = (a, b) => a + Math.random() * (b - a);
export const synthLab = {
  'pop-bubble': () => { const f = r(380, 520); sweep([[0, f], [0.05, f * 3.2], [0.09, f * 2.4]], { vol: 0.32 }); noise(0.02, 0.08, 6000, 3000, { type: 'highpass' }); },
  'pop-cork': () => { noise(0.03, 0.3, 3500, 1200, { type: 'bandpass', q: 3 }); sweep([[0, 900], [0.12, 300]], { type: 'triangle', vol: 0.18, when: 0.01 }); },
  'pop-blip': () => { const f = r(700, 900); sweep([[0, f], [0.04, f * 1.9]], { type: 'triangle', vol: 0.3, dur: 0.07 }); },
  'boing-spring': () => sweep([[0, 140], [0.08, 420], [0.55, 260]], { type: 'triangle', vol: 0.3, vib: 60, vibRate: 18 }),
  'boing-jaw': () => sweep([[0, 220], [0.5, 110]], { type: 'square', vol: 0.09, vib: 45, vibRate: 22, attack: 0.01 }),
  'boing-hop': () => sweep([[0, 260], [0.14, 760], [0.22, 620]], { type: 'sine', vol: 0.3 }),
  'splat-goo': () => { noise(0.25, 0.35, 1800, 180, { q: 2 }); sweep([[0, 260], [0.18, 70]], { vol: 0.25 }); sweep([[0.1, 900], [0.25, 500]], { vol: 0.08, when: 0.08 }); },
  'splat-bloop': () => { sweep([[0, 180], [0.06, 420], [0.2, 90]], { vol: 0.32 }); noise(0.12, 0.12, 1200, 300, { type: 'bandpass', q: 5 }); },
  'giggle-chipmunk': () => [1, 1.15, 1.05, 1.25, 1.1, 1.3].forEach((m, i) =>
    sweep([[0, 820 * m], [0.04, 1050 * m], [0.07, 760 * m]], { type: 'triangle', vol: 0.16, when: i * 0.085, vib: 30, vibRate: 30 })),
  'giggle-tee-hee': () => [[1200, 0], [1350, 0.13], [1100, 0.34], [1250, 0.47]].forEach(([f, w]) =>
    sweep([[0, f * 0.85], [0.03, f], [0.09, f * 0.8]], { vol: 0.17, when: w, vib: 50, vibRate: 25 })),
  'squeak-duck': (p = 1) => sweep([[0, 900 * p], [0.05, 1300 * p], [0.16, 1000 * p]], { type: 'square', vol: 0.07, vib: 80, vibRate: 35 }),
  'squeak-toy': (p = 1) => { sweep([[0, 1400 * p], [0.08, 1800 * p], [0.2, 1500 * p]], { vol: 0.2, vib: 40, vibRate: 12 }); },
  'collect-sparkle': () => [1047, 1319, 1568, 2093].forEach((f, i) => sweep([[0, f], [0.15, f]], { type: 'triangle', vol: 0.14, when: i * 0.045 })),
  'collect-coin': () => { sweep([[0, 988], [0.07, 988]], { type: 'square', vol: 0.07 }); sweep([[0, 1319], [0.3, 1319]], { type: 'square', vol: 0.07, when: 0.07 }); },
  'powerup-climb': () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => sweep([[0, f], [0.08, f * 1.02]], { type: 'square', vol: 0.06, when: i * 0.055 })),
  'win-fanfare': () => [[523, 0, 0.12], [523, 0.13, 0.12], [523, 0.26, 0.12], [698, 0.4, 0.5], [880, 0.4, 0.5], [784, 0.95, 0.15], [1047, 1.12, 0.7]]
    .forEach(([f, w, d]) => { sweep([[0, f], [d, f]], { type: 'square', vol: 0.06, when: w }); sweep([[0, f / 2], [d, f / 2]], { type: 'triangle', vol: 0.15, when: w }); }),
  'smash-crunch': () => { noise(0.35, 0.55, 3000, 200, { q: 1.5 }); noise(0.08, 0.3, 5000, 2000, { type: 'highpass', when: 0.02 }); sweep([[0, 160], [0.25, 50]], { vol: 0.45 }); },
  'boom-cartoon': () => { noise(0.9, 0.5, 1400, 80); sweep([[0, 120], [0.7, 35]], { vol: 0.6 }); sweep([[0.3, 700], [0.6, 1200]], { type: 'triangle', vol: 0.05, when: 0.35 }); },
  'bonk-head': () => { sweep([[0, 620], [0.25, 560]], { type: 'triangle', vol: 0.25 }); sweep([[0, 1240], [0.2, 1120]], { vol: 0.1 }); noise(0.03, 0.2, 2500, 800, { type: 'bandpass', q: 2 }); },
  'punch-pow': () => { noise(0.12, 0.5, 2400, 300, { q: 1 }); sweep([[0, 220], [0.1, 70]], { vol: 0.5 }); },
  'tap-bubble': () => sweep([[0, 600], [0.05, 1100]], { type: 'sine', vol: 0.2, dur: 0.07 }),
  'whoosh-air': () => noise(0.3, 0.18, 600, 3000, { attack: 0.12, type: 'bandpass', q: 1.5 }),
};

// ---------------------------------------------------------------- picked files (sound-picks.js)
const buffers = {}; // slot -> [AudioBuffer]
function decode(arr) {
  // callback form: older Safari doesn't return a promise
  return new Promise((res, rej) => ac.decodeAudioData(arr, res, rej));
}
async function loadOne(slot, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const buf = await decode(await res.arrayBuffer());
    (buffers[slot] ||= []).push(buf);
  } catch (e) { console.warn('sound file failed, using synth:', slot, url, e); }
}
function loadPicks() {
  for (const [slot, p] of Object.entries(PICKS)) for (const f of p.files || []) loadOne(slot, f);
}

function playBuffer(buf, { vol = 1, rate = 1 } = {}) {
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  g.gain.value = vol;
  src.connect(g).connect(sfxBus);
  src.start();
  return buf.duration / rate;
}

// ---------------------------------------------------------------- rate limiting
// Each sound name may play at most once per MIN_GAP seconds, and at most MAX_VOICES sounds ring at once.
const MIN_GAP = 0.045;
const MAX_VOICES = 14;
const lastPlay = {};
let voices = []; // end times
function allow(name, dur = 0.3) {
  if (!ac) return false;
  const now = ac.currentTime;
  if (now - (lastPlay[name] ?? -1) < MIN_GAP) return false;
  voices = voices.filter((t) => t > now);
  if (voices.length >= MAX_VOICES) return false;
  lastPlay[name] = now;
  voices.push(now + dur);
  return true;
}

// Which slot each classic sfx name plays when the parent picked a file for it.
// (slot defaults to the same name; sound-picks.js may add `replaces: ['ding']` to take over others.)
function slotFor(name) {
  if (PICKS[name]) return name;
  for (const [slot, p] of Object.entries(PICKS)) if (p.replaces?.includes(name)) return slot;
  return null;
}

// Fallback synth for slots that aren't classic sfx names.
const FALLBACK = {
  smash: 'boom', punch: 'boing', bonk: 'boing', laser: () => synth.tone(880, 0.12, 'square', 0.12), sonic: 'whoosh',
  powerup: 'tada', win: 'tada', collect: 'ding', step: () => noise(0.05, 0.12, 900, 300), engine: null,
  shield: () => synthLab['whoosh-air'](), cubes: 'pop', tap: () => synthLab['tap-bubble'](),
};

/** Play a slot or sfx name: picked file, picked synthLab design, or the original synth. */
function play(name, args = [], opts = {}) {
  const slot = slotFor(name);
  const p = slot && PICKS[slot];
  if (p) {
    const list = buffers[slot];
    if (list?.length) {
      const buf = list[(Math.random() * list.length) | 0];
      if (!allow(name, buf.duration)) return;
      const jitter = p.jitter ?? 0.06; // tiny random pitch so repeats don't sound robotic
      playBuffer(buf, { vol: (p.vol ?? 1) * (opts.vol ?? 1), rate: (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter) });
      return;
    }
    if (p.synth && synthLab[p.synth]) { if (allow(name)) synthLab[p.synth](...args); return; }
  }
  if (!allow(name)) return;
  const fb = synth[name] ? name : FALLBACK[name];
  if (typeof fb === 'function') fb(...args);
  else if (fb && synth[fb]) synth[fb](...args);
}

const NAMES = Object.keys(synth).filter((n) => n !== 'tone');
export const sfx = {
  // tone() is a raw building block (games build melodies from it): not rate-limited per name
  tone: (...a) => { if (ac) synth.tone(...a); },
  /** Any named slot: sfx.play('smash'), sfx.play('win'), sfx.play('collect', { vol: 0.5 }) */
  play: (slot, opts = {}) => play(slot, [], opts),
};
for (const n of NAMES) sfx[n] = (...a) => play(n, a);
/** Raw synths, ignoring picks + limits (Sound Picker "Now" buttons). */
export const synthOriginal = synth;

// ---------------------------------------------------------------- voice
let lastSay = 0;
let unduckTimer = 0;
export function say(text, { rate = 1.05, pitch = 1.3, interrupt = true } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (TEST_MUTE || settings.volume === 0) return; // test mode or parent muted everything
  const now = performance.now();
  if (!interrupt && speechSynthesis.speaking) return;
  if (now - lastSay < 300) return;
  lastSay = now;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = pitch;
  u.volume = Math.min(1, settings.volume + 0.25); // the voice stays clear even when effects are quieter
  // duck music under speech; Safari's onend is unreliable, so also unduck after a length-based guess
  audio.duck(true);
  clearTimeout(unduckTimer);
  const unduck = () => { clearTimeout(unduckTimer); unduckTimer = setTimeout(() => { if (!speechSynthesis.speaking) audio.duck(false); }, 150); };
  u.onend = unduck; u.onerror = unduck;
  unduckTimer = setTimeout(() => audio.duck(false), 900 + text.length * 75);
  speechSynthesis.speak(u);
}
