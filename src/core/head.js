// Where to put things ON the kid's head (hats, crowns, bugs...). Needs 'face' or 'pose'.
//
//   const h = ctx.head()  ->  { found, x, y, width, roll, source, estimated }
//     x, y       screen px of the TOP of the head (a bit above the hairline)
//     width      head width in screen px
//     roll       head tilt in radians (rotate your drawing by this)
//     source     'face' | 'body' | 'fake' | 'none' (what the answer came from)
//     estimated  true when the head itself isn't visible (body: above the top of the frame while
//                jumping) and its place is worked out from the shoulders
// Face first (precise, but only within ~1.2 m). Otherwise BODY tracking (pose, works 1-4 m away):
//   position from the nose, tilt from the ears (or eyes, or the shoulder line), size from shoulder
//   width. When the head leaves the top of the frame (jumping) it's estimated from the shoulders,
//   using where the head sat above them a moment ago, so the hat doesn't vanish or jump around.
//   The body answer is smoothed (pose landmarks jitter); the face answer is returned as before.
// When nothing is tracked, the last known position is returned with found = false.
// With ?fakecam a pretend head is returned (it drops when crouching via the C debug key).

import { tracking } from './tracking.js';
import { view } from './view.js';
import { gestures } from './gestures.js';

const fake = new URLSearchParams(location.search).has('fakecam');
let last = { found: false, x: innerWidth / 2, y: innerHeight * 0.3, width: 160, roll: 0, source: 'none', estimated: false };

export const HEAD_BODY = {
  minVis: 0.5,     // landmark visibility to trust a point
  widthK: 0.5,     // head width = shoulder width x this (child: ~13 cm head vs ~26 cm shoulders)
  crownUp: 0.85,   // nose -> top of head, in head widths
  headUp: 0.75,    // default nose height above the shoulder midpoint, in shoulder widths (learned live)
  posRate: 14,     // smoothing speeds (1/s): higher = snappier, lower = steadier
  sizeRate: 4,
  rollRate: 8,
  maxRoll: 0.6,    // clamp tilt (rad): ear landmarks at a distance can be wild
};

// body smoothing state
const B = { have: false, x: 0, y: 0, width: 0, roll: 0, t: 0, lastPose: null, target: null, headUp: HEAD_BODY.headUp, headDx: 0 };
const ok = (p) => p && p.v >= HEAD_BODY.minVis;
const angleOf = (a, b) => { const pa = view.toScreen(a.x, a.y), pb = view.toScreen(b.x, b.y); return Math.atan2(pb.y - pa.y, pb.x - pa.x); };

// Raw (unsmoothed) top-of-head from one pose sample, or null.
function bodyTarget(p) {
  const c = HEAD_BODY;
  const ls = p.leftShoulder, rs = p.rightShoulder;
  if (!p.found || !ok(ls) || !ok(rs)) return null;
  const a = view.toScreen(ls.x, ls.y), b = view.toScreen(rs.x, rs.y);
  const sw = Math.hypot(b.x - a.x, b.y - a.y);
  if (sw < 4) return null;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const width = sw * c.widthK;
  // tilt: ears, else eyes (after mirroring, the subject's right is on the screen's right), else shoulders
  const pts = p.points;
  let roll;
  if (ok(pts[7]) && ok(pts[8])) roll = angleOf(pts[7], pts[8]);
  else if (ok(pts[2]) && ok(pts[5])) roll = angleOf(pts[2], pts[5]);
  else roll = angleOf(ls, rs) * 0.5;
  if (!(Math.abs(roll) < Math.PI / 2)) roll = 0; // landmarks swapped (turned around): don't flip the hat
  roll = Math.max(-c.maxRoll, Math.min(c.maxRoll, roll));
  const n = p.nose;
  let nx, ny, estimated = false;
  if (ok(n) && n.y > 0.01) {
    const np = view.toScreen(n.x, n.y);
    nx = np.x; ny = np.y;
    // remember where the head sits above the shoulders (for when it leaves the frame)
    B.headUp += ((my - ny) / sw - B.headUp) * 0.15;
    B.headDx += ((nx - mx) / sw - B.headDx) * 0.15;
  } else {
    nx = mx + B.headDx * sw; ny = my - B.headUp * sw; estimated = true;
  }
  const up = width * c.crownUp;
  return { x: nx + Math.sin(roll) * up, y: ny - Math.cos(roll) * up, width, roll, estimated };
}

function bodyHead() {
  const p = tracking.pose;
  const now = performance.now() / 1000;
  const dt = Math.min(0.25, B.t ? now - B.t : 0);
  B.t = now;
  if (p !== B.lastPose) { B.lastPose = p; B.target = bodyTarget(p); } // new tracking sample
  const tg = B.target;
  if (!tg) {
    if (now - (B.seenAt || 0) > 1) B.have = false; // gone a while: snap to the next sighting
    return null;
  }
  B.seenAt = now;
  if (!B.have) { Object.assign(B, { have: true, x: tg.x, y: tg.y, width: tg.width, roll: tg.roll }); }
  else {
    const k = (rate) => 1 - Math.exp(-rate * dt);
    B.x += (tg.x - B.x) * k(HEAD_BODY.posRate);
    B.y += (tg.y - B.y) * k(HEAD_BODY.posRate);
    B.width += (tg.width - B.width) * k(HEAD_BODY.sizeRate);
    B.roll += (tg.roll - B.roll) * k(HEAD_BODY.rollRate);
  }
  return { found: true, x: B.x, y: B.y, width: B.width, roll: B.roll, source: 'body', estimated: tg.estimated };
}

export function head() {
  const f = tracking.face;
  if (f.found && f.points.length > 10) {
    const top = f.points[10]; // top of forehead
    const p = view.toScreen(top.x, top.y);
    const width = view.scale(f.size) * 2.4;
    // nudge up from the forehead to the top of the head, along the tilt
    const up = width * 0.28;
    last = { found: true, x: p.x + Math.sin(f.roll) * up, y: p.y - Math.cos(f.roll) * up, width, roll: f.roll, source: 'face', estimated: false };
    B.have = false; // body smoothing restarts from here if the face is lost
    return last;
  }
  const b = bodyHead();
  if (b) { last = b; return last; }
  if (fake) {
    const u = Math.min(view.W, view.H);
    const y = gestures.crouching ? view.H * 0.62 : view.H * 0.3 - Math.max(0, gestures.height) * u * 0.06;
    last = { found: true, x: view.W * 0.5, y, width: u * 0.26, roll: Math.sin(performance.now() / 900) * 0.12, source: 'fake', estimated: false };
    return last;
  }
  return { ...last, found: false };
}
