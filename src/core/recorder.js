// Records tracker NUMBERS (never video or images) so real movement can become a test.
// Used by Move Lab; any game may use it.
//
//   recorder.start({ station: 'jump', expected: 5, colors: ['red'] })  // begin a new recording
//   recorder.start({ station: 'smash-run', maxRows: 18000 })          // games: longer cap (default 2 min)
//   recorder.event('hit', { n: 3 })      // log a game event (gesture events are logged automatically)
//   recorder.stop()                      // stop; the data stays until the next start()
//   recorder.active, recorder.rows, recorder.events, recorder.duration
//   recorder.toJSON({ trueCount: 6 })    // labelled recording object
//   recorder.download({ trueCount: 6 })  // saves it as a .json file (drop into fixtures.local/)
//
// One row per new tracking sample (new face result or new camera frame), at most ~30 per second:
//   t    s since start          hdt  s of head-height updates since the last row (0 = none)
//   y    eye-line height and  s  eye distance, both in frame heights: exactly what gestures feeds
//        createHeightTracker (height.js), so `npm test` can replay jumps / crouches (scripts/replay.js)
//   f    face found (0/1)       m    motion.total       h  gestures.height
//   mo, sm, bl, br, r           mouthOpen, smile, blinkLeft, blinkRight, roll (only when a face is found)
//   fs   face eye distance in frame heights (0 when no face)
//   bw, ft, kn, hd, z           body (pose): shoulder width, feet / knees / head in view, zone code
//   hn   gestures.handsNear (body peekaboo signal, shoulder widths)   cv  covering (0/1)
//   pk   [nose, leftWrist, rightWrist, leftShoulder, rightShoulder] as x,y,v triples (15 numbers):
//        what peekaboo.js reads, so a real peekaboo recording can be replayed later
//   kq   [leftKnee.y, rightKnee.y] fed to run.js (only when both knees are visible)
//   ri   gestures.run.intensity (0..1)   rs  run state (0 idle, 1 walking, 2 running)   rr  steps/s
//   pv   punch signal: fastest wrist speed / punch threshold (>= 1 = fast enough)
//   pz   [leftWrist.z, rightWrist.z] depth, so punch.js can be replayed with the pk points
//   hp   [leftHip, rightHip] as x,y,v triples (6 numbers): with pk, what steer.js reads (lean / airplane arms)
//   sv   gestures.steer.value (-1..1, + = screen right)   sm  steer mode (0 none, 1 lean, 2 arms, 3 sim)
//   c    { red: [x, y, size] }  color blobs for the colors asked for in start() (null = not found)
//   pp   FULL POSE (only with recorder.start({ fullPose: true }) or ?recpose): all 33 MediaPipe pose
//        landmarks as one flat array of 33 x [x, y, z, v] = 132 numbers (mirrored norm coords like
//        tracking.pose; x, y rounded to 4 decimals, z to 3, v to 2; a missing point = null, null, null, 0).
//        Written only on rows where a NEW pose sample arrived (rows follow camera frames, the pose
//        tracker runs slower), so a replayer holds the last pp until the next one. Enough to rebuild
//        tracking.pose exactly and drive every body detector (height, spin, run, punch, peekaboo, body
//        zones, head) for a future ?replay=<file> mode. Adds ~0.5 KB per sample. The file says
//        poseFormat: 'mp33-xyzv' when it has pp rows.
// Events: [{ t, i, name, data }] where i = index of the row that follows the event.
//
// Test input: a recording made while test controls (?keys, testinput.js), ?fakecam or the ?debug
// gesture keys were used is labelled testInput: true (+ testInputSource), and its filename starts with
// TEST-. scripts/replay.js reports those as TEST-INPUT and never counts them as real data.

import { body } from './body.js';
import { tracking } from './tracking.js';
import { motion } from './motion.js';
import { color } from './color.js';
import { gestures } from './gestures.js';
import { frame } from './frame.js';
import { camera } from './camera.js';
import { perf } from './perf.js';
import { testinput } from './testinput.js';

const params = new URLSearchParams(location.search);
const FAKECAM = params.has('fakecam');
const FULL_POSE = params.has('recpose');

const MAX_ROWS = 30 * 120; // 2 minutes at 30 Hz is plenty for one station
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

let unsub = null;
let acc = { hdt: 0, y: null, s: null };
let lastFace = null, lastFrame = -1, lastPose = null;
const POSE_POINTS = 33;

export function uaFamily(ua = navigator.userAgent) {
  const device = /iPhone/.test(ua) ? 'iphone' : /iPad/.test(ua) ? 'ipad'
    : /Silk|Kindle|KF[A-Z]{2,4}\b/.test(ua) ? 'fire' : /Android/.test(ua) ? 'android'
    : /Macintosh/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'windows' : 'other';
  const browser = /Silk/.test(ua) ? 'silk' : /CriOS|Chrome/.test(ua) ? 'chrome'
    : /FxiOS|Firefox/.test(ua) ? 'firefox' : /Safari/.test(ua) ? 'safari' : 'other';
  return `${device}-${browser}`;
}

export const recorder = {
  active: false,
  meta: {},
  rows: [],
  events: [],
  t: 0,
  get duration() { return this.t; },

  start(meta = {}) {
    this.stop();
    this.meta = { colors: [], ...meta };
    this.rows = [];
    this.events = [];
    this.t = 0;
    this.full = false;
    acc = { hdt: 0, y: null, s: null };
    lastFace = null; lastFrame = -1; lastPose = null;
    this.fullPose = !!(meta.fullPose ?? FULL_POSE);
    this.testSources = new Set();
    this.active = true;
    unsub = gestures.onAny((name, data) => this.event(name, data, true));
  },

  stop() {
    this.active = false;
    unsub?.(); unsub = null;
  },

  event(name, data, fromGestures = false) {
    if (!this.active) return;
    const clean = {};
    for (const [k, v] of Object.entries(data || {})) if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') clean[k] = typeof v === 'number' ? round(v) : v;
    this.events.push({ t: round(this.t, 3), i: this.rows.length, name, src: fromGestures ? 'gestures' : 'game', data: clean });
  },

  // Called by the runtime every frame, after the trackers and gestures have updated.
  tick(dt) {
    if (!this.active) return;
    this.t += dt;
    // was anything other than a real body driving the detectors?
    if (testinput.active) this.testSources.add('keys');
    if (FAKECAM) this.testSources.add('fakecam');
    if (gestures._sim.used || gestures._simRun.used || gestures._simCover) this.testSources.add('debug-keys');
    const raw = gestures.raw;
    if (raw) { acc.hdt += raw.dt; acc.y = raw.y; acc.s = raw.size; }
    const f = tracking.face;
    const fresh = f !== lastFace || frame.id !== lastFrame;
    if (!fresh) return;
    lastFace = f; lastFrame = frame.id;
    if (this.rows.length >= (this.meta.maxRows || MAX_ROWS)) { this.full = true; this.stop(); return; }

    const row = {
      t: round(this.t, 3), hdt: round(acc.hdt, 4),
      y: acc.hdt > 0 ? round(acc.y, 5) : null, s: acc.hdt > 0 ? round(acc.s, 5) : null,
      f: f.found ? 1 : 0, m: round(motion.total), h: round(gestures.height, 3),
    };
    if (f.found && f.leftEye && f.rightEye) {
      const aspect = camera.width / camera.height;
      row.fs = round(Math.hypot((f.rightEye.x - f.leftEye.x) * aspect, f.rightEye.y - f.leftEye.y), 5);
      row.mo = round(f.mouthOpen, 3); row.sm = round(f.smile, 3);
      row.bl = round(f.blinkLeft, 3); row.br = round(f.blinkRight, 3); row.r = round(f.roll, 3);
    } else row.fs = 0;
    // body position (pose): shoulder width, feet/head in view, zone code (0 none, 1 too-close, 2 good, 3 too-far)
    if (tracking.pose.found) { const b = body(); row.bw = round(b.width, 4); row.ft = b.feetIn ? 1 : 0; row.kn = b.kneesIn ? 1 : 0; row.hd = b.headIn ? 1 : 0; row.z = ['none', 'too-close', 'good', 'too-far'].indexOf(b.zone);
      const p = tracking.pose;
      row.hn = gestures.handsNear == null ? null : round(gestures.handsNear, 3); row.cv = gestures.covering ? 1 : 0;
      row.pk = [p.nose, p.leftWrist, p.rightWrist, p.leftShoulder, p.rightShoulder].flatMap((q) => (q ? [round(q.x, 4), round(q.y, 4), round(q.v, 2)] : [null, null, 0]));
      row.pz = [round(p.leftWrist?.z, 4), round(p.rightWrist?.z, 4)];
      row.hp = [p.leftHip, p.rightHip].flatMap((q) => (q ? [round(q.x, 4), round(q.y, 4), round(q.v, 2)] : [null, null, 0]));
      if (this.fullPose && p !== lastPose) {
        lastPose = p;
        row.pp = [];
        for (let i = 0; i < POSE_POINTS; i++) {
          const q = p.points[i];
          row.pp.push(...(q ? [round(q.x, 4), round(q.y, 4), round(q.z, 3), round(q.v, 2)] : [null, null, null, 0]));
        }
      }
    }
    if (gestures._usesPose) {
      const k = gestures.knees, r = gestures.run;
      if (k) row.kq = [round(k.l, 4), round(k.r, 4)];
      row.ri = round(r.intensity, 3); row.rs = ['idle', 'walking', 'running'].indexOf(r.state); row.rr = round(r.rate, 2);
      row.pv = round(gestures.punch.value, 3);
      row.sv = round(gestures.steer.value, 3); row.sm = ['none', 'lean', 'arms', 'sim'].indexOf(gestures.steer.mode);
    }
    if (this.meta.colors.length) {
      row.c = {};
      for (const name of this.meta.colors) {
        const b = color.track(name);
        row.c[name] = b.found ? [round(b.x, 3), round(b.y, 3), round(b.size, 5)] : null;
      }
    }
    this.rows.push(row);
    acc = { hdt: 0, y: null, s: null };
  },

  toJSON(label = {}) {
    return {
      kind: 'wiggle-recording',
      version: 1,
      createdAt: new Date().toISOString(),
      ...this.meta,
      ...label,
      ...(this.testSources?.size ? { testInput: true, testInputSource: [...this.testSources] } : {}),
      ...(this.fullPose ? { poseFormat: 'mp33-xyzv' } : {}),
      device: { tier: perf.tier.name, ua: uaFamily(), trackFps: perf.settings.trackFps, camera: [camera.width, camera.height] },
      heightConfig: { ...gestures.heightConfig },
      heightSource: gestures.heightSource, // "body" (shoulders) or "face" (eye line)
      runConfig: { ...gestures.runConfig },
      punchConfig: { ...gestures.punchConfig },
      steerConfig: { ...gestures.steerConfig },
      duration: round(this.t, 2),
      rows: this.rows,
      events: this.events,
    };
  },

  filename(label = {}) {
    const d = { ...this.meta, ...label };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const count = d.trueCount != null ? `true${d.trueCount}` : 'unlabelled';
    return `${this.testSources?.size ? 'TEST-' : ''}${d.station || 'rec'}-${count}-of${d.expected ?? '?'}-${perf.tier.name}-${uaFamily()}-${stamp}.json`;
  },

  download(label = {}) {
    const blob = new Blob([JSON.stringify(this.toJSON(label))], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename(label);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return a.download;
  },
};
