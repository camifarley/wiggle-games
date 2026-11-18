// "Where is the kid standing?" from body tracking. Needs 'pose' in the game's needs.
//
//   const b = ctx.body()  ->  {
//     found,        a body is in view
//     width,        shoulder width in frame heights (bigger = closer). Compare it to an earlier width.
//     headIn, kneesIn, feetIn, wholeBody,   nose / both knees / both ankles inside the frame
//     shouldersIn, hipsIn,                  both shoulders / both hips inside the frame (for games that only
//                                           read the upper body and let the kid stand closer, e.g. Space Pilot)
//     zone,         'none' | 'too-close' (can't see the knees) | 'good' (shoulders to knees) | 'too-far' (tiny)
//   }
// Knees, not feet: a laptop camera on a table often can't see feet even 2 m away (real recording), and
// every detector (jump, squat, spin) uses the shoulders. Shoulders-to-knees leaves room to jump.
// zone is steadied (must hold ~0.3 s before it changes) so a flickering ankle doesn't flip it.
// Typical use in a jumping game: if (ctx.body().zone === 'too-close') say('Step back so I can see your knees!')
// Testing with ?debug: key Z toggles a pretend 'too-close' zone (to see a game's step-back prompt).

import { tracking } from './tracking.js';
import { camera } from './camera.js';

export const BODY_ZONES = {
  minVis: 0.5,       // landmark visibility to count as seen
  farWidth: 0.055,   // shoulder width (frame heights) below this = too far (~4-5 m for a child)
  hold: 0.3,         // s a new zone must hold before it's reported
};

const inFrame = (p) => p && p.v >= BODY_ZONES.minVis && p.x >= -0.02 && p.x <= 1.02 && p.y >= -0.02 && p.y <= 1.02;

const debugOn = new URLSearchParams(location.search).has('debug');
let simClose = false;
if (debugOn) {
  addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, [contenteditable]')) return;
    if (e.key.toLowerCase() === 'z') { simClose = !simClose; console.info(`[body] pretend too-close: ${simClose}`); }
  });
}

let zone = 'none', pending = 'none', pendingSince = 0, lastPose = null, last = null;

export function body() {
  const b = readBody();
  return simClose ? { ...b, found: true, kneesIn: false, feetIn: false, hipsIn: false, wholeBody: false, zone: 'too-close' } : b;
}

function readBody() {
  const p = tracking.pose;
  if (p === lastPose && last) return last; // same tracking sample: same answer
  lastPose = p;
  const now = performance.now() / 1000;
  let raw = 'none', width = 0, headIn = false, kneesIn = false, feetIn = false, shouldersIn = false, hipsIn = false;
  const ls = p.leftShoulder, rs = p.rightShoulder;
  if (p.found && ls && rs && Math.min(ls.v, rs.v) >= BODY_ZONES.minVis) {
    const aspect = camera.width / camera.height;
    width = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
    headIn = inFrame(p.nose);
    kneesIn = inFrame(p.leftKnee) && inFrame(p.rightKnee);
    feetIn = inFrame(p.leftAnkle) && inFrame(p.rightAnkle);
    shouldersIn = inFrame(ls) && inFrame(rs);
    hipsIn = inFrame(p.leftHip) && inFrame(p.rightHip);
    raw = !kneesIn ? 'too-close' : width < BODY_ZONES.farWidth ? 'too-far' : 'good';
  }
  if (raw !== pending) { pending = raw; pendingSince = now; }
  if (pending !== zone && (now - pendingSince >= BODY_ZONES.hold || zone === 'none')) zone = pending;
  last = { found: raw !== 'none', width, headIn, kneesIn, feetIn, shouldersIn, hipsIn, wholeBody: headIn && feetIn, zone };
  return last;
}
