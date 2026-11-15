// Whole-body gestures inferred from face/body tracking + motion. A game gets these when its
// `needs` include 'motion' and 'face' and/or 'pose'.
//
//   ctx.gestures.on('spin', fn)      face vanished while the body moved a lot, then came back
//   ctx.gestures.on('peekaboo', fn)  face hidden while fairly still (hands over face), then back
//                                    BODY (pose, no face): both hands up at the head >= 0.4 s, then dropped
//   ctx.gestures.on('hide', fn)      face just disappeared (fires before spin / peekaboo / leave)
//                                    BODY: hands just covered the head (fires before peekaboo)
//   ctx.gestures.on('leave', fn)     face gone for > 3 s
//   ctx.gestures.on('return', fn)    face back after leaving
//   ctx.gestures.on('still', fn)     face visible and barely moving for 3 s
//   ctx.gestures.on('jump', fn)      head popped up above standing height and came down
//   ctx.gestures.on('crouch', fn)    head dropped well below standing height (held > 0.3 s)
//   ctx.gestures.on('stand', fn)     back up after a crouch
//   ctx.gestures.state               'present' | 'hidden' | 'away'
//   ctx.gestures.height              head height vs standing, in face sizes (+ up, - crouching)
//   ctx.gestures.crouching           true while crouched
//   ctx.gestures.peekabooSource      'face' | 'body' (body when needs have 'pose' but not 'face'; settable)
//   ctx.gestures.handsNear           body: farther wrist's distance to the head in shoulder widths (null = unseen)
//   ctx.gestures.covering            body: hands are over the head right now (between 'hide' and 'peekaboo')
//   ctx.gestures.run                 body: run-in-place state (run.js): { intensity 0..1, state 'idle'|'walking'|
//                                    'running', rate steps/s, bob, jumping, kneeDiff }. Events: 'step', 'walk',
//                                    'run' (started running), 'runstop' (back to idle)
//   ctx.gestures.on('punch', fn)     body: fast push/swing of a hand (punch.js): { hand: 'left'|'right'|'both',
//                                    speed (x threshold), x, y (wrist, norm) }. ctx.gestures.punch = live state
//   ctx.gestures.runConfig / punchConfig   live-tunable thresholds (incl. `sensitivity`)
// Listeners are cleared automatically when the game stops. Tune via ctx.gestures.config.
//
// Testing with ?debug: keys S = spin, P = peekaboo, L = leave/return, T = still,
// J = jump, C = crouch / stand (toggle), hold R = run (tap R = walk a few steps), X = punch.
// With ?fakecam (no real face) the face counts as present unless P / L simulate hiding.
// With test controls on (?keys, testinput.js) those keys instead move a pretend body whose tracker
// samples go through the real detectors (no shortcuts), and Space / arrows / Enter work too.

import { tracking } from './tracking.js';
import { motion } from './motion.js';
import { camera } from './camera.js';
import { createHeightTracker, BODY_SCALE } from './height.js';
import { createSpinTracker } from './spin.js';
import { createPeekabooTracker } from './peekaboo.js';
import { createRunTracker } from './run.js';
import { createPunchTracker } from './punch.js';
import { testinput } from './testinput.js';

const params = new URLSearchParams(location.search);
const fakecam = params.has('fakecam');
// ?fakecam has no real body, so gestures simulate one... unless test controls (testinput.js) are on:
// then a pretend body drives the real detectors instead.
let fake = fakecam;
// Test controls: the pretend body's face (eye line, presence) and motion level stand in for the real ones.
const faceNow = () => (testinput.active ? testinput.face : tracking.face);
const motionNow = () => (testinput.active ? testinput.motion : motion.total);
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
// Body source: shoulder line height, scaled by BODY_SCALE (height.js) to eye-distance equivalents.
const heightTracker = createHeightTracker();
// Body spin: shoulders vanish side-on twice per turn (spin.js, tested by npm test + real recordings).
const spinTracker = createSpinTracker();
// Body peekaboo: both wrists up at the head, held, then dropped (peekaboo.js, tested by npm test).
const peekTracker = createPeekabooTracker();
// Body run-in-place (shoulder bob + knees + motion) and punches (wrist speed): run.js, punch.js.
const runTracker = createRunTracker();
const punchTracker = createPunchTracker();
let lastPose = null, poseDt = 0;

let listeners = {};
const RUN_BASE = { ...runTracker.config }, PUNCH_BASE = { ...punchTracker.config };

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
  raw: null, // { y, size, dt, source } fed to the height tracker this frame (null if none); read by recorder.js
  heightSource: 'face', // 'body' when the game needs 'pose' (works from across the room), else 'face'
  presenceSource: 'face',
  turn: 0, // body only: 0 = facing (or back to camera), 1 = fully side-on (for spin effects/graphs)
  peekabooSource: 'face', // 'body' = hands-to-head from pose (peekaboo.js); games/stations may override
  peekabooConfig: peekTracker.config,
  handsNear: null, // body: farther wrist to head, in shoulder widths (< peekabooConfig.near = covering)
  covering: false,
  run: runTracker.state,
  runConfig: runTracker.config,
  punch: punchTracker.state,
  punchConfig: punchTracker.config,
  knees: null, // body: { l, r } knee y (norm) fed to run.js this frame, when both are visible
  _usesPose: false,
  _simCover: false,
  _sim: { used: false, jumpT: 0, crouch: false },
  _simRun: { held: false, downAt: 0, walkUntil: 0, used: false, t: 0, step: 0, hand: 0 },

  on(name, fn) {
    (listeners[name] ||= new Set()).add(fn);
    return () => listeners[name]?.delete(fn);
  },

  // Every event: fn(name, data). Used by the recorder and Move Lab's event log.
  onAny(fn) { return this.on('*', fn); },

  emit(name, data = {}) {
    if (debugOn) console.info(`[gestures] ${name}`, data);
    // catch-all listeners first, so a recorder logs the event before a game reacts (and maybe stops recording)
    listeners['*']?.forEach((fn) => { try { fn(name, data); } catch (e) { console.error(e); } });
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
    this.height = 0;
    this.crouching = false;
    this.raw = null;
    heightTracker.reset();
    spinTracker.reset();
    this.turn = 0;
    peekTracker.reset();
    this.handsNear = null;
    this.covering = false;
    this._simCover = false;
    this._sim = { used: false, jumpT: 0, crouch: false };
    runTracker.reset();
    punchTracker.reset();
    Object.assign(runTracker.config, RUN_BASE);
    Object.assign(punchTracker.config, PUNCH_BASE);
    this.knees = null;
    lastPose = null; poseDt = 0;
    this._simRun = { held: false, downAt: 0, walkUntil: 0, used: false, t: 0, step: 0, hand: 0 };
  },

  // Which trackers drive height and presence. Called by the runtime when a game starts.
  setSources(needs) {
    this.heightSource = needs.includes('pose') ? 'body' : 'face';
    this.presenceSource = needs.includes('face') ? 'face' : 'body';
    this._usesPose = needs.includes('pose');
    this.peekabooSource = needs.includes('face') || !this._usesPose ? 'face' : 'body';
  },

  // Body peekaboo (hands up at the head). The signal runs whenever pose is tracked (graphs);
  // events only fire when peekabooSource === 'body'.
  _updatePeekaboo(dt) {
    if (this._simCover) { this.covering = true; return; }
    if (!this._usesPose || fake) { this.handsNear = null; this.covering = false; return; }
    const p = tracking.pose;
    const pts = p.found ? { nose: p.nose, leftWrist: p.leftWrist, rightWrist: p.rightWrist, leftShoulder: p.leftShoulder, rightShoulder: p.rightShoulder } : null;
    const events = peekTracker.update(dt, pts, camera.width / camera.height);
    this.handsNear = peekTracker.state.value;
    this.covering = this.peekabooSource === 'body' && peekTracker.covering;
    if (this.peekabooSource !== 'body') return;
    for (const e of events) this.emit(e, { source: 'body', held: peekTracker.state.t - peekTracker.state.coverStart });
  },

  // Run-in-place + punches (body only). Simulated by debug keys R / X (and always with ?fakecam).
  _updateRun(dt, y, size) {
    const sim = this._simRun;
    if (fake || sim.used) { this._simulateRun(dt); return; }
    if (!this._usesPose) return;
    const p = tracking.pose;
    const ok = (q) => q && q.v >= 0.5 && q.y <= 1.02;
    this.knees = p.found && ok(p.leftKnee) && ok(p.rightKnee) ? { l: p.leftKnee.y, r: p.rightKnee.y } : null;
    const s0 = runTracker.state.state;
    for (const e of runTracker.update(dt, y, size, this.knees, motionNow())) {
      this.emit(e === 'stop' ? 'runstop' : e, e === 'step' ? { rate: runTracker.state.rate } : { intensity: runTracker.state.intensity, from: s0 });
    }
    // punches: once per new pose sample (velocities need real time between samples)
    poseDt += dt;
    if (p === lastPose) return;
    lastPose = p;
    const pts = p.found ? { leftWrist: p.leftWrist, rightWrist: p.rightWrist, leftShoulder: p.leftShoulder, rightShoulder: p.rightShoulder } : null;
    const evs = punchTracker.update(poseDt, pts, camera.width / camera.height);
    poseDt = 0;
    for (const e of evs) this.emit('punch', { hand: e.hand, speed: e.speed, x: e.x, y: e.y, source: 'body' });
  },

  // Debug keys: hold R = run (intensity climbs), tap R = walk for 2 s, X = punch. Same events as real ones.
  _simulateRun(dt) {
    const sim = this._simRun, s = runTracker.state;
    sim.t += dt;
    const held = sim.held && sim.t - sim.downAt > 0.25;
    const target = held ? 0.9 : sim.t < sim.walkUntil ? 0.3 : 0;
    s.intensity += (target - s.intensity) * Math.min(1, dt * (target > s.intensity ? 3 : 1.6));
    if (s.intensity < 0.005) s.intensity = 0;
    s.rate = target ? (held ? 3 : 1.3) : 0;
    s.raw = target;
    const c = runTracker.config;
    const prev = s.state;
    s.state = s.intensity >= c.runAt ? 'running' : s.intensity >= c.walkAt ? 'walking' : 'idle';
    if (s.rate) { sim.step += dt * s.rate; if (sim.step >= 1) { sim.step -= 1; this.emit('step', { rate: s.rate, simulated: true }); } }
    if (s.state !== prev) this.emit(s.state === 'running' ? 'run' : s.state === 'walking' ? 'walk' : 'runstop', { intensity: s.intensity, from: prev, simulated: true });
  },

  simPunch() {
    const sim = this._simRun;
    sim.hand ^= 1;
    const hand = sim.hand ? 'right' : 'left';
    punchTracker.state.count++;
    punchTracker.state.value = 1.5;
    this.emit('punch', { hand, speed: 1.5, x: hand === 'right' ? 0.62 : 0.38, y: 0.45, simulated: true });
  },

  // Head/shoulder height relative to standing, in face sizes. Distance-independent. Logic in height.js.
  _updateHeight(dt) {
    const sim = this._sim;
    let y, size;
    if (fake || sim.used) {
      sim.jumpT = Math.max(0, sim.jumpT - dt);
      const h = sim.crouch ? -3 : sim.jumpT > 0 ? 1.4 : 0;
      size = 0.06; y = 0.4 - h * size;
    } else if (this.heightSource === 'body') {
      // shoulder line: still visible when the head pops off the top of the frame
      const p = tracking.pose;
      const ls = p.leftShoulder, rs = p.rightShoulder;
      if (!p.found || !ls || !rs || Math.min(ls.v, rs.v) < 0.5) return;
      const aspect = camera.width / camera.height;
      y = (ls.y + rs.y) / 2;
      size = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y) * BODY_SCALE;
    } else {
      const f = faceNow();
      if (!f.found || !f.leftEye || !f.rightEye) return;
      // eye line (moves less than the nose when nodding); size in frame heights
      const aspect = camera.width / camera.height;
      y = (f.leftEye.y + f.rightEye.y) / 2;
      size = Math.hypot((f.rightEye.x - f.leftEye.x) * aspect, f.rightEye.y - f.leftEye.y);
    }
    this.raw = { y, size, dt, source: fake || sim.used ? 'sim' : this.heightSource };
    if (this.raw.source === 'body') {
      for (const e of spinTracker.update(dt, size)) this.emit(e, { source: 'body' }); // 'turn' (half) and 'spin'
      const hist = spinTracker.state.hist;
      const wide = hist.length ? Math.max(...hist.map((h) => h.w)) : size;
      this.turn = wide > 0 ? Math.max(0, Math.min(1, 1 - size / wide)) : 0;
    }
    for (const e of heightTracker.update(dt, y, size)) this.emit(e, { height: heightTracker.state.height });
    this.height = heightTracker.state.height;
    this.crouching = heightTracker.state.crouching;
  },

  update(dt) {
    const c = this.config;
    this.raw = null;
    fake = fakecam && !testinput.active;
    if (testinput.active) { this._sim.used = false; this._simRun.used = false; this._simCover = false; }
    // height first: with body tracking it keeps working while the face is out of view
    this._updateHeight(dt);
    // run/punch: body only; a lost body (no raw sample) lets the run intensity fade
    if (this._usesPose) this._updateRun(dt, this.raw?.source === 'body' ? this.raw.y : null, this.raw?.size);
    this._updatePeekaboo(dt);
    const facePeek = this.peekabooSource === 'face'; // body peekaboo comes from the hands instead
    const present = fake ? !this._simLost : this.presenceSource === 'face' ? faceNow().found : tracking.pose.found;
    const mt = motionNow();
    if (!present) {
      this.lostFor += dt;
      this._motionSum += mt * dt;
      this.stillFor = 0;
      if (this.state === 'present' && this.lostFor >= c.minLost) { this.state = 'hidden'; if (facePeek) this.emit('hide'); }
      if (this.state === 'hidden' && this.lostFor >= c.awayTime) { this.state = 'away'; this.emit('leave'); }
      return;
    }
    if (this.state === 'away') { heightTracker.reset(); this.emit('return'); }
    else if (this.state === 'hidden') {
      const avgMotion = this._motionSum / this.lostFor;
      const spin = avgMotion >= c.spinMotion && this.lostFor <= c.maxSpin;
      // with body tracking, spins are counted from the shoulders; don't double count from the face
      // with body peekaboo, a short body/face dropout is just tracking flicker: no event
      if (spin ? this.heightSource !== 'body' : facePeek) this.emit(spin ? 'spin' : 'peekaboo', { avgMotion, lostFor: this.lostFor });
    }
    this.state = 'present';
    this.lostFor = 0;
    this._motionSum = 0;

    if (mt < c.stillMotion) {
      this.stillFor += dt;
      if (this.stillFor >= c.stillTime && !this._stillFired) { this._stillFired = true; this.emit('still'); }
    } else {
      this.stillFor = 0;
      this._stillFired = false;
    }
  },
};

if (debugOn) {
  addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() !== 'r' || testinput.handles(e.key)) return;
    const s = gestures._simRun;
    if (s.held && s.t - s.downAt <= 0.25) s.walkUntil = s.t + 2; // a tap = a few walking steps
    s.held = false;
  });
  addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, [contenteditable]')) return; // typing a note, not a debug key
    if (testinput.handles(e.key)) return; // test controls on: the key moves the pretend body instead
    const k = e.key.toLowerCase();
    if (k === 's') { gestures.emit('hide', { simulated: true }); gestures.emit('spin', { simulated: true }); }
    if (k === 't') gestures.emit('still', { simulated: true });
    if (k === 'j') { gestures._sim.used = true; gestures._sim.jumpT = 0.4; }
    if (k === 'c') { gestures._sim.used = true; gestures._sim.crouch = !gestures._sim.crouch; }
    if (k === 'r' && !e.repeat) { const s = gestures._simRun; s.used = true; s.held = true; s.downAt = s.t; }
    if (k === 'x' && !e.repeat) gestures.simPunch();
    if (k === 'p') {
      if (gestures.peekabooSource === 'body') {
        // pretend both hands went up to the head, then dropped
        gestures._simCover = true; gestures.emit('hide', { simulated: true, source: 'body' });
        setTimeout(() => { gestures._simCover = false; gestures.covering = false; gestures.emit('peekaboo', { simulated: true, source: 'body' }); }, 1200);
      } else if (fake) { gestures._simLost = true; setTimeout(() => { gestures._simLost = false; }, 1200); }
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
