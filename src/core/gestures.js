// Whole-body gestures inferred from face tracking + motion. A game gets these when its
// `needs` include BOTH 'face' and 'motion'.
//
//   ctx.gestures.on('spin', fn)      face vanished while the body moved a lot, then came back
//   ctx.gestures.on('peekaboo', fn)  face hidden while fairly still (hands over face), then back
//   ctx.gestures.on('hide', fn)      face just disappeared (fires before spin / peekaboo / leave)
//   ctx.gestures.on('leave', fn)     face gone for > 3 s
//   ctx.gestures.on('return', fn)    face back after leaving
//   ctx.gestures.on('still', fn)     face visible and barely moving for 3 s
//   ctx.gestures.on('jump', fn)      head popped up above standing height and came down
//   ctx.gestures.on('crouch', fn)    head dropped well below standing height (held > 0.3 s)
//   ctx.gestures.on('stand', fn)     back up after a crouch
//   ctx.gestures.state               'present' | 'hidden' | 'away'
//   ctx.gestures.height              head height vs standing, in face sizes (+ up, - crouching)
//   ctx.gestures.crouching           true while crouched
// Listeners are cleared automatically when the game stops. Tune via ctx.gestures.config.
//
// Testing with ?debug: keys S = spin, P = peekaboo, L = leave/return, T = still,\n// J = jump, C = crouch / stand (toggle).
// With ?fakecam (no real face) the face counts as present unless P / L simulate hiding.

import { tracking } from './tracking.js';
import { motion } from './motion.js';
import { camera } from './camera.js';
import { createHeightTracker } from './height.js';

const params = new URLSearchParams(location.search);
const fake = params.has('fakecam');
const debugOn = params.has('debug');
const DEFAULTS = {
  minLost: 0.35,     // s of no face before it counts as hidden (ignores tracking flicker)
  maxSpin: 3,        // s: longer than this is "leave", not spin
  spinMotion: 0.08,  // avg motion.total while hidden to count as a spin (vs peekaboo)
  stillMotion: 0.012,
  stillTime: 3,
  awayTime: 3,
};
// Jump / crouch tuning lives in height.js (HEIGHT_DEFAULTS); tested by `npm test`.
const heightTracker = createHeightTracker();

let listeners = {};

export const gestures = {
  config: { ...DEFAULTS },
  state: 'present',
  lostFor: 0,
  stillFor: 0,
  _motionSum: 0,
  _stillFired: false,
  _simLost: false,
  height: 0,
  crouching: false,
  heightConfig: heightTracker.config, // tune jump/crouch thresholds per game if needed
  raw: null, // { y, size, dt } fed to the height tracker this frame (null if none); read by recorder.js
  _sim: { used: false, jumpT: 0, crouch: false },

  on(name, fn) {
    (listeners[name] ||= new Set()).add(fn);
    return () => listeners[name]?.delete(fn);
  },

  // Every event: fn(name, data). Used by the recorder and Move Lab's event log.
  onAny(fn) { return this.on('*', fn); },

  emit(name, data = {}) {
    if (debugOn) console.info(`[gestures] ${name}`, data);
    listeners[name]?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    listeners['*']?.forEach((fn) => { try { fn(name, data); } catch (e) { console.error(e); } });
  },

  reset() {
    listeners = {};
    this.config = { ...DEFAULTS };
    this.state = 'present';
    this.lostFor = 0;
    this.stillFor = 0;
    this._motionSum = 0;
    this._stillFired = false;
    this._simLost = false;
    this.height = 0;
    this.crouching = false;
    this.raw = null;
    heightTracker.reset();
    this._sim = { used: false, jumpT: 0, crouch: false };
  },

  // Head height relative to standing, in face sizes. Distance-independent. Logic in height.js.
  _updateHeight(dt) {
    const sim = this._sim;
    let y, size;
    if (fake || sim.used) {
      sim.jumpT = Math.max(0, sim.jumpT - dt);
      const h = sim.crouch ? -3 : sim.jumpT > 0 ? 1.4 : 0;
      size = 0.06; y = 0.4 - h * size;
    } else {
      const f = tracking.face;
      if (!f.found || !f.leftEye || !f.rightEye) return;
      // eye line (moves less than the nose when nodding); size in frame heights
      const aspect = camera.width / camera.height;
      y = (f.leftEye.y + f.rightEye.y) / 2;
      size = Math.hypot((f.rightEye.x - f.leftEye.x) * aspect, f.rightEye.y - f.leftEye.y);
    }
    this.raw = { y, size, dt };
    for (const e of heightTracker.update(dt, y, size)) this.emit(e, { height: heightTracker.state.height });
    this.height = heightTracker.state.height;
    this.crouching = heightTracker.state.crouching;
  },

  update(dt) {
    const c = this.config;
    this.raw = null;
    const present = fake ? !this._simLost : tracking.face.found;
    if (!present) {
      this.lostFor += dt;
      this._motionSum += motion.total * dt;
      this.stillFor = 0;
      if (this.state === 'present' && this.lostFor >= c.minLost) { this.state = 'hidden'; this.emit('hide'); }
      if (this.state === 'hidden' && this.lostFor >= c.awayTime) { this.state = 'away'; this.emit('leave'); }
      return;
    }
    if (this.state === 'away') { heightTracker.reset(); this.emit('return'); }
    else if (this.state === 'hidden') {
      const avgMotion = this._motionSum / this.lostFor;
      const spin = avgMotion >= c.spinMotion && this.lostFor <= c.maxSpin;
      this.emit(spin ? 'spin' : 'peekaboo', { avgMotion, lostFor: this.lostFor });
    }
    this.state = 'present';
    this.lostFor = 0;
    this._motionSum = 0;
    this._updateHeight(dt);

    if (motion.total < c.stillMotion) {
      this.stillFor += dt;
      if (this.stillFor >= c.stillTime && !this._stillFired) { this._stillFired = true; this.emit('still'); }
    } else {
      this.stillFor = 0;
      this._stillFired = false;
    }
  },
};

if (debugOn) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 's') { gestures.emit('hide', { simulated: true }); gestures.emit('spin', { simulated: true }); }
    if (k === 't') gestures.emit('still', { simulated: true });
    if (k === 'j') { gestures._sim.used = true; gestures._sim.jumpT = 0.4; }
    if (k === 'c') { gestures._sim.used = true; gestures._sim.crouch = !gestures._sim.crouch; }
    if (k === 'p') {
      if (fake) { gestures._simLost = true; setTimeout(() => { gestures._simLost = false; }, 1200); }
      else { gestures.emit('hide', { simulated: true }); setTimeout(() => gestures.emit('peekaboo', { simulated: true }), 1200); }
    }
    if (k === 'l') {
      if (fake) gestures._simLost = !gestures._simLost;
      else {
        gestures.emit(gestures._leftSim ? 'return' : 'leave', { simulated: true });
        gestures._leftSim = !gestures._leftSim;
      }
    }
  });
}
