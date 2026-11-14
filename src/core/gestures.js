// Whole-body gestures inferred from face tracking + motion. A game gets these when its
// `needs` include BOTH 'face' and 'motion'.
//
//   ctx.gestures.on('spin', fn)      face vanished while the body moved a lot, then came back
//   ctx.gestures.on('peekaboo', fn)  face hidden while fairly still (hands over face), then back
//   ctx.gestures.on('hide', fn)      face just disappeared (fires before spin / peekaboo / leave)
//   ctx.gestures.on('leave', fn)     face gone for > 3 s
//   ctx.gestures.on('return', fn)    face back after leaving
//   ctx.gestures.on('still', fn)     face visible and barely moving for 3 s
//   ctx.gestures.state               'present' | 'hidden' | 'away'
// Listeners are cleared automatically when the game stops. Tune via ctx.gestures.config.
//
// Testing with ?debug: keys S = spin, P = peekaboo, L = leave/return, T = still.
// With ?fakecam (no real face) the face counts as present unless P / L simulate hiding.

import { tracking } from './tracking.js';
import { motion } from './motion.js';

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

let listeners = {};

export const gestures = {
  config: { ...DEFAULTS },
  state: 'present',
  lostFor: 0,
  stillFor: 0,
  _motionSum: 0,
  _stillFired: false,
  _simLost: false,

  on(name, fn) {
    (listeners[name] ||= new Set()).add(fn);
    return () => listeners[name]?.delete(fn);
  },

  emit(name, data = {}) {
    if (debugOn) console.info(`[gestures] ${name}`, data);
    listeners[name]?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
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
  },

  update(dt) {
    const c = this.config;
    const present = fake ? !this._simLost : tracking.face.found;
    if (!present) {
      this.lostFor += dt;
      this._motionSum += motion.total * dt;
      this.stillFor = 0;
      if (this.state === 'present' && this.lostFor >= c.minLost) { this.state = 'hidden'; this.emit('hide'); }
      if (this.state === 'hidden' && this.lostFor >= c.awayTime) { this.state = 'away'; this.emit('leave'); }
      return;
    }
    if (this.state === 'away') this.emit('return');
    else if (this.state === 'hidden') {
      const avgMotion = this._motionSum / this.lostFor;
      const spin = avgMotion >= c.spinMotion && this.lostFor <= c.maxSpin;
      this.emit(spin ? 'spin' : 'peekaboo', { avgMotion, lostFor: this.lostFor });
    }
    this.state = 'present';
    this.lostFor = 0;
    this._motionSum = 0;

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
