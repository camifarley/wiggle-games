// Where to put things ON the kid's head (hats, crowns, bugs...). Needs 'face'.
//
//   const h = ctx.head()  ->  { found, x, y, width, roll }
//     x, y   screen px of the TOP of the head (a bit above the hairline)
//     width  head width in screen px
//     roll   head tilt in radians (rotate your drawing by this)
// When the face is briefly lost, the last known position is returned with found = false.
// With ?fakecam a pretend head is returned (it drops when crouching via the C debug key).

import { tracking } from './tracking.js';
import { view } from './view.js';
import { gestures } from './gestures.js';

const fake = new URLSearchParams(location.search).has('fakecam');
let last = { found: false, x: innerWidth / 2, y: innerHeight * 0.3, width: 160, roll: 0 };

export function head() {
  const f = tracking.face;
  if (f.found && f.points.length > 10) {
    const top = f.points[10]; // top of forehead
    const p = view.toScreen(top.x, top.y);
    const width = view.scale(f.size) * 2.4;
    // nudge up from the forehead to the top of the head, along the tilt
    const up = width * 0.28;
    last = { found: true, x: p.x + Math.sin(f.roll) * up, y: p.y - Math.cos(f.roll) * up, width, roll: f.roll };
    return last;
  }
  if (fake) {
    const u = Math.min(view.W, view.H);
    const y = gestures.crouching ? view.H * 0.62 : view.H * 0.3 - Math.max(0, gestures.height) * u * 0.06;
    last = { found: true, x: view.W * 0.5, y, width: u * 0.26, roll: Math.sin(performance.now() / 900) * 0.12 };
    return last;
  }
  return { ...last, found: false };
}
