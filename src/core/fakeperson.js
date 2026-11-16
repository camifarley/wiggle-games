// ?fakecam=person: a cartoon kid in a cartoon room, drawn into the fake camera instead of the red ball, so
// camera effects, person cutouts (segment.js) and screenshots have someone to work on. NEVER real frames:
// the repo is public and the camera sees a child.
//
// The cartoon follows the pretend body (testbody.js): with test controls on (?keys) it is drawn from the
// same pose sample the detectors get (testinput.pose), so what you see is what the tracker "saw". With test
// controls off it stands in the middle, breathing (an idle pretend body of its own).
//
// Pure parts (tested by scripts/test-fakeperson.js, no DOM):
//   personShapes(pose, w, h)    -> { found, box, parts: [{ kind: 'circle'|'capsule'|'poly', ..., color, face? }] }
//                                  in MIRRORED pixel coords (what the kid sees), from a 33-point pose in norm coords
//   insideShapes(shapes, x, y)  -> true if (x, y) is on the person (exactly what the fake mask paints)
//   drawShapes(g, shapes, { mask })  canvas drawing (colours, or solid white for the mask)
// DOM part:
//   createFakePersonCam({ width, height, maskWidth })  -> { canvas, mask, stream, frame, shapes }
//   setFakePoseSource(fn)       fn() -> a pose or null (testinput registers itself)

import { createTestBody } from './testbody.js';

export const FAKE_PERSON_COLORS = {
  skin: '#e9b48e', cheek: '#f39a8a', hair: '#6b3f22', shirt: '#ff8a2b', stripe: '#ffd23f',
  pants: '#3f6fd8', shoe: '#e8344a', eye: '#2a1d14', mouth: '#a8323e',
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// pose (norm, mirrored) -> drawable parts in mirrored pixels
export function personShapes(pose, w, h) {
  const P = pose?.points;
  if (!pose?.found || !P || P.length < 33) return { found: false, parts: [], box: null };
  const px = (i) => ({ x: P[i].x * w, y: P[i].y * h });
  const C = FAKE_PERSON_COLORS;
  const ls = px(11), rs = px(12), lh = px(23), rh = px(24);
  const sMid = mid(ls, rs), hMid = mid(lh, rh);
  // size from the torso length: stays the same when he turns side-on (the shoulder width shrinks then)
  const s = Math.max(4, dist(sMid, hMid) / 1.5);
  const facing = (P[0].v ?? 1) > 0.5; // testbody: the face points fade when turned away
  const ears = mid(px(7), px(8));
  const head = { x: ears.x, y: ears.y + s * 0.02 };
  const headR = s * 0.5;
  const limb = s * 0.17;
  const parts = [];
  const cap = (a, b, r, color) => parts.push({ kind: 'capsule', a, b, r, color });
  const circ = (c, r, color, face = false) => parts.push({ kind: 'circle', c, r, color, face });
  // legs first (behind the shirt)
  for (const [hip, knee, ankle, toe] of [[23, 25, 27, 31], [24, 26, 28, 32]]) {
    cap(px(hip), px(knee), limb * 1.25, C.pants);
    cap(px(knee), px(ankle), limb * 1.1, C.pants);
    cap(px(ankle), px(toe), limb * 0.95, C.shoe);
  }
  // torso: a rounded shirt from the shoulders to the hips (half-width follows the real shoulder line, so a
  // spin shows him side-on), plus a neck
  const half = Math.max(s * 0.12, dist(ls, rs) / 2);
  const ux = (rs.x - ls.x) / (2 * half || 1), uy = (rs.y - ls.y) / (2 * half || 1); // shoulder direction
  const hx = (rh.x - lh.x) / 2, hy = (rh.y - lh.y) / 2;
  const hipHalf = Math.max(s * 0.12, Math.hypot(hx, hy) * 1.15);
  const hux = hx / (Math.hypot(hx, hy) || 1), huy = hy / (Math.hypot(hx, hy) || 1);
  cap(sMid, { x: head.x, y: head.y + headR * 0.6 }, s * 0.13, C.skin); // neck
  parts.push({
    kind: 'poly', color: C.shirt, stripe: C.stripe, round: s * 0.14,
    pts: [
      { x: sMid.x - ux * half * 1.08, y: sMid.y - uy * half * 1.08 - s * 0.04 },
      { x: sMid.x + ux * half * 1.08, y: sMid.y + uy * half * 1.08 - s * 0.04 },
      { x: hMid.x + hux * hipHalf, y: hMid.y + huy * hipHalf + s * 0.12 },
      { x: hMid.x - hux * hipHalf, y: hMid.y - huy * hipHalf + s * 0.12 },
    ],
  });
  // head (after the shirt) with hair
  circ(head, headR, C.skin, facing);
  parts.push({ kind: 'hair', c: head, r: headR, color: C.hair, back: !facing });
  // arms last: they go in front of the body and the face (peekaboo hands cover the face)
  for (const [sh, el, wr] of [[11, 13, 15], [12, 14, 16]]) {
    cap(px(sh), px(el), limb * 1.2, C.shirt);
    cap(px(el), px(wr), limb, C.skin);
    circ(px(wr), limb * 1.45, C.skin);
  }
  // bounding box (for segment stats and tests)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  for (const p of parts) {
    if (p.kind === 'circle' || p.kind === 'hair') grow(p.c.x, p.c.y, p.r * 1.08);
    else if (p.kind === 'capsule') { grow(p.a.x, p.a.y, p.r); grow(p.b.x, p.b.y, p.r); }
    else for (const q of p.pts) grow(q.x, q.y, p.round || 0);
  }
  return { found: true, parts, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, size: s, head, headR, facing };
}

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Is this mirrored pixel on the person? (same shapes the mask paints; poly corners are rounded in the
// drawing, so this is exact except within `round` px of a shirt corner)
export function insideShapes(shapes, x, y) {
  if (!shapes?.found) return false;
  const p = { x, y };
  for (const s of shapes.parts) {
    if (s.kind === 'circle' && dist(p, s.c) <= s.r) return true;
    if (s.kind === 'hair' && dist(p, s.c) <= s.r * 1.08 && y <= s.c.y + s.r * 0.2) return true;
    if (s.kind === 'capsule' && segDist(p, s.a, s.b) <= s.r) return true;
    if (s.kind === 'poly' && inPoly(s.pts, x, y)) return true;
  }
  return false;
}

export function drawShapes(g, shapes, { mask = false } = {}) {
  if (!shapes?.found) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of shapes.parts) {
    const col = mask ? '#fff' : s.color;
    g.fillStyle = col; g.strokeStyle = col;
    if (s.kind === 'capsule') {
      g.lineWidth = s.r * 2;
      g.beginPath(); g.moveTo(s.a.x, s.a.y); g.lineTo(s.b.x, s.b.y); g.stroke();
    } else if (s.kind === 'circle') {
      g.beginPath(); g.arc(s.c.x, s.c.y, s.r, 0, Math.PI * 2); g.fill();
      if (s.face && !mask) drawFace(g, s.c, s.r);
    } else if (s.kind === 'hair') {
      g.beginPath();
      if (s.back) g.arc(s.c.x, s.c.y, s.r * 1.04, 0, Math.PI * 2);
      else { g.arc(s.c.x, s.c.y, s.r * 1.08, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); }
      g.fill();
      if (!s.back) { // a little tuft
        g.beginPath(); g.arc(s.c.x + s.r * 0.15, s.c.y - s.r * 1.02, s.r * 0.22, 0, Math.PI * 2); g.fill();
      }
    } else if (s.kind === 'poly') {
      g.lineWidth = s.round * 2;
      g.beginPath(); s.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
      g.fill(); g.stroke();
      if (!mask) { // two stripes across the shirt
        g.save(); g.clip();
        g.strokeStyle = s.stripe; g.lineWidth = s.round * 1.3;
        const [a, b, c, d] = s.pts;
        for (const k of [0.33, 0.66]) {
          g.beginPath();
          g.moveTo(a.x + (d.x - a.x) * k - 50, a.y + (d.y - a.y) * k);
          g.lineTo(b.x + (c.x - b.x) * k + 50, b.y + (c.y - b.y) * k);
          g.stroke();
        }
        g.restore();
      }
    }
  }
}

function drawFace(g, c, r) {
  const C = FAKE_PERSON_COLORS;
  g.fillStyle = C.eye;
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(c.x + sx * r * 0.35, c.y - r * 0.05, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff';
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(c.x + sx * r * 0.35 + r * 0.04, c.y - r * 0.1, r * 0.045, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = C.cheek; g.globalAlpha = 0.7;
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(c.x + sx * r * 0.58, c.y + r * 0.22, r * 0.14, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  g.strokeStyle = C.mouth; g.lineWidth = r * 0.09;
  g.beginPath(); g.arc(c.x, c.y + r * 0.2, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

// ---------- the room (drawn once) ----------
function drawRoom(g, w, h) {
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#a9dcf0'); wall.addColorStop(1, '#d6f0f7');
  g.fillStyle = wall; g.fillRect(0, 0, w, h);
  // wallpaper dots
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let y = 18; y < h * 0.75; y += 36) for (let x = (y / 36) % 2 ? 18 : 0; x < w; x += 36) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  // floor
  const fy = h * 0.8;
  g.fillStyle = '#d9a46a'; g.fillRect(0, fy, w, h - fy);
  g.strokeStyle = '#c38c55'; g.lineWidth = 2;
  for (let x = -40; x < w + 40; x += 64) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x - 50, h); g.stroke(); }
  g.fillStyle = '#b9e86a'; g.beginPath(); g.ellipse(w * 0.5, h * 0.92, w * 0.3, h * 0.06, 0, 0, Math.PI * 2); g.fill(); // rug
  // window (left) with a sun and a cloud
  const wx = w * 0.06, wy = h * 0.1, ww = w * 0.22, wh = h * 0.3;
  g.fillStyle = '#7fd0ff'; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(wx + ww * 0.7, wy + wh * 0.3, ww * 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; for (const [dx, r] of [[0.25, 0.1], [0.36, 0.13], [0.48, 0.09]]) { g.beginPath(); g.arc(wx + ww * dx, wy + wh * 0.6, ww * r, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(wx, wy, ww, wh);
  g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
  // bookshelf (right) with colourful books
  const bx = w * 0.76, by = h * 0.3, bw = w * 0.2, bh = h * 0.5;
  g.fillStyle = '#9a6a3f'; g.fillRect(bx, by, bw, bh);
  const cols = ['#e8344a', '#ffd23f', '#3f6fd8', '#36c98a', '#b468ff', '#ff8a2b'];
  for (let r = 0; r < 3; r++) {
    const sy = by + 8 + r * (bh / 3);
    let x = bx + 8, i = r;
    while (x < bx + bw - 14) {
      const bkw = 9 + ((i * 7) % 6), bkh = bh / 3 - 18 - ((i * 5) % 10);
      g.fillStyle = cols[i % cols.length]; g.fillRect(x, sy + (bh / 3 - 14 - bkh), bkw, bkh);
      x += bkw + 2; i++;
    }
    g.fillStyle = '#7a4f2b'; g.fillRect(bx, sy + bh / 3 - 14, bw, 6);
  }
  // potted plant (left, on the floor)
  g.fillStyle = '#d0603a'; g.beginPath(); g.moveTo(w * 0.1, fy - 4); g.lineTo(w * 0.2, fy - 4); g.lineTo(w * 0.185, fy + 34); g.lineTo(w * 0.115, fy + 34); g.closePath(); g.fill();
  g.fillStyle = '#3fae5a';
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38; g.beginPath(); g.ellipse(w * 0.15 + Math.cos(a) * 26, fy - 30 + Math.sin(a) * 30, 9, 26, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
}

// ---------- the live fake camera ----------
let poseSource = null;
export function setFakePoseSource(fn) { poseSource = fn; }

export function createFakePersonCam({ width = 640, height = 480, maskWidth = 320 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  const room = document.createElement('canvas');
  room.width = width; room.height = height;
  drawRoom(room.getContext('2d'), width, height);
  const mask = document.createElement('canvas');
  mask.width = maskWidth; mask.height = Math.round((maskWidth * height) / width);
  const mg = mask.getContext('2d');
  const idle = createTestBody({ jitter: 0 });
  const cam = { canvas, mask, stream: null, frame: 0, shapes: { found: false, parts: [], box: null }, width, height };
  let last = performance.now();
  const draw = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    idle.update(dt);
    let pose = null;
    try { pose = poseSource?.() || null; } catch { pose = null; }
    if (!pose) pose = idle.sample(width / height).pose;
    const shapes = personShapes(pose, width, height);
    cam.shapes = shapes;
    // colour image: the RAW camera (unmirrored), like a real webcam; the view mirrors it
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(room, 0, 0);
    g.setTransform(-1, 0, 0, 1, width, 0);
    drawShapes(g, shapes);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.font = '16px sans-serif'; g.fillText('FAKE CAMERA', 10, height - 10);
    // exact person mask, already MIRRORED (view coords), white on transparent
    const k = mask.width / width;
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.clearRect(0, 0, mask.width, mask.height);
    mg.setTransform(k, 0, 0, k, 0, 0);
    drawShapes(mg, shapes, { mask: true });
    cam.frame++;
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  cam.stream = canvas.captureStream(30);
  return cam;
}
