// Records tracker NUMBERS (never video or images) so real movement can become a test.
// Used by Move Lab; any game may use it.
//
//   recorder.start({ station: 'jump', expected: 5, colors: ['red'] })  // begin a new recording
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
//   c    { red: [x, y, size] }  color blobs for the colors asked for in start() (null = not found)
// Events: [{ t, i, name, data }] where i = index of the row that follows the event.

import { tracking } from './tracking.js';
import { motion } from './motion.js';
import { color } from './color.js';
import { gestures } from './gestures.js';
import { frame } from './frame.js';
import { camera } from './camera.js';
import { perf } from './perf.js';

const MAX_ROWS = 30 * 120; // 2 minutes at 30 Hz is plenty for one station
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

let unsub = null;
let acc = { hdt: 0, y: null, s: null };
let lastFace = null, lastFrame = -1;

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
    acc = { hdt: 0, y: null, s: null };
    lastFace = null; lastFrame = -1;
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
    const raw = gestures.raw;
    if (raw) { acc.hdt += raw.dt; acc.y = raw.y; acc.s = raw.size; }
    const f = tracking.face;
    const fresh = f !== lastFace || frame.id !== lastFrame;
    if (!fresh) return;
    lastFace = f; lastFrame = frame.id;
    if (this.rows.length >= MAX_ROWS) { this.stop(); return; }

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
      device: { tier: perf.tier.name, ua: uaFamily(), trackFps: perf.settings.trackFps, camera: [camera.width, camera.height] },
      heightConfig: { ...gestures.heightConfig },
      duration: round(this.t, 2),
      rows: this.rows,
      events: this.events,
    };
  },

  filename(label = {}) {
    const d = { ...this.meta, ...label };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const count = d.trueCount != null ? `true${d.trueCount}` : 'unlabelled';
    return `${d.station || 'rec'}-${count}-of${d.expected ?? '?'}-${perf.tier.name}-${uaFamily()}-${stamp}.json`;
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
