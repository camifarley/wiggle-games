// Coach Boing: a bouncy blob in lab goggles who DEMONSTRATES each move (the kid can't read).
// drawCoach(g, x, y, r, pose, t): x, y = feet position, r = body radius.
// demoPose(move, t, opts) -> pose for a looping demo of that move.

const BODY = '#3fd8c4', BODY_DARK = '#22a596', INK = '#1b1140';

export const POSE = () => ({
  dy: 0, sx: 1, sy: 1, rot: 0, turn: 1, scale: 1, tilt: 0,
  eyes: 'look', mouth: 'smile', armL: 0.5, armR: 0.5, hold: null, ice: 0, covered: 0, look: { x: 0, y: 0 },
});

const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, k)));

export function demoPose(move, t, opts = {}) {
  const p = POSE();
  switch (move) {
    case 'jump': {
      const k = (t * 1.4) % 1;
      const air = Math.sin(Math.PI * k);
      p.dy = -air * 1.3;
      p.sy = k < 0.12 || k > 0.88 ? 0.75 : 1 + air * 0.15;
      p.sx = 2 - p.sy;
      p.armL = p.armR = 0.4 + air * 2.4;
      p.mouth = air > 0.5 ? 'open' : 'smile';
      p.eyes = air > 0.6 ? 'happy' : 'look';
      break;
    }
    case 'squat': {
      const k = (t / 2.2) % 1;
      const down = k < 0.5 ? ease(k / 0.25) : 1 - ease((k - 0.5) / 0.2);
      p.sy = 1 - down * 0.42; p.sx = 1 + down * 0.3;
      p.armL = p.armR = 0.5 + down * 1.0;
      p.mouth = down > 0.5 ? 'o' : 'smile';
      if (k > 0.72 && k < 0.85) { p.dy = -0.4; p.sy = 1.15; p.sx = 0.9; p.armL = p.armR = 2.6; p.eyes = 'happy'; }
      break;
    }
    case 'spin': {
      const a = t * 4.2;
      p.turn = Math.cos(a);
      p.dy = -Math.abs(Math.sin(a)) * 0.25;
      p.armL = p.armR = 1.6;
      p.eyes = 'swirl';
      p.mouth = 'open';
      break;
    }
    case 'peekaboo': {
      const k = (t / 2.4) % 1;
      p.covered = k < 0.55 ? ease(k / 0.15) : 0;
      p.armL = p.armR = p.covered > 0 ? 2.6 : 2.2;
      if (k >= 0.55) { p.eyes = 'wide'; p.mouth = 'big'; p.sx = 1.12; p.sy = 1.12; p.dy = -0.25 * Math.sin(Math.min(1, (k - 0.55) / 0.2) * Math.PI); }
      else p.mouth = 'smile';
      break;
    }
    case 'freeze': {
      const k = (t / 3) % 1;
      if (k < 0.55) {
        p.rot = Math.sin(t * 14) * 0.25; p.dy = -Math.abs(Math.sin(t * 7)) * 0.35;
        p.armL = 1.2 + Math.sin(t * 14) * 1.2; p.armR = 1.2 - Math.sin(t * 14) * 1.2;
        p.mouth = 'open'; p.eyes = 'happy';
      } else { p.rot = 0.15; p.armL = 2.4; p.armR = 0.9; p.ice = 1; p.mouth = 'o'; p.eyes = 'wide'; }
      break;
    }
    case 'wave': {
      p.armR = 2.6 + Math.sin(t * 10) * 0.5;
      p.armL = 0.4;
      p.rot = Math.sin(t * 5) * 0.06;
      p.mouth = 'grin';
      break;
    }
    case 'face': {
      const task = opts.task || ['mouth', 'smile', 'blink', 'tilt'][Math.floor(t / 1.2) % 4];
      if (task === 'mouth') p.mouth = 'big';
      if (task === 'smile') { p.mouth = 'grin'; p.eyes = 'happy'; }
      if (task === 'blink') { p.eyes = (t % 0.8) < 0.25 ? 'closed' : 'look'; }
      if (task === 'tilt') p.tilt = Math.sin(t * 3) * 0.45;
      p.sy = 1 + Math.sin(t * 6) * 0.03;
      break;
    }
    case 'toy': {
      p.hold = opts.color || '#ff3b3b';
      p.armR = 2.4 + Math.sin(t * 4) * 0.25;
      p.armL = 0.5;
      p.dy = -Math.abs(Math.sin(t * 4)) * 0.15;
      p.mouth = 'grin';
      break;
    }
    case 'closer': {
      const k = (t / 2.6) % 1;
      const big = k < 0.5 ? ease(k / 0.3) : 1 - ease((k - 0.5) / 0.3);
      p.scale = 1 + big * 0.6;
      p.mouth = big > 0.5 ? 'big' : 'smile';
      p.eyes = big > 0.5 ? 'wide' : 'look';
      p.dy = -Math.abs(Math.sin(t * 8)) * 0.12;
      break;
    }
    case 'run': {
      // run in place: quick little bounces, arms pumping in turn
      const a = t * 2 * Math.PI * 1.4;
      p.dy = -Math.abs(Math.sin(a)) * 0.3;
      p.sy = 1 + Math.abs(Math.sin(a)) * 0.06; p.sx = 2 - p.sy;
      p.armL = 1.3 + Math.sin(a) * 0.9; p.armR = 1.3 - Math.sin(a) * 0.9;
      p.rot = Math.sin(a) * 0.08;
      p.mouth = 'open'; p.eyes = 'happy';
      break;
    }
    case 'punch': {
      // left, right, left, right: one arm shoots up/out, the body leans into it
      const k = (t * 1.6) % 1, side = Math.floor(t * 1.6) % 2;
      const hit = k < 0.25 ? ease(k / 0.25) : 1 - ease((k - 0.45) / 0.4);
      p.armL = side ? 0.8 : 0.8 + hit * 1.8; p.armR = side ? 0.8 + hit * 1.8 : 0.8;
      p.rot = (side ? 1 : -1) * hit * 0.12;
      p.sx = 1 + hit * 0.06;
      p.mouth = hit > 0.6 ? 'big' : 'grin'; p.eyes = hit > 0.6 ? 'wide' : 'look';
      break;
    }
    case 'lean': {
      // lean left ... lean right, arms out like airplane wings, tilting with the body
      const k = Math.sin(t * 1.6);
      const lean = Math.sign(k) * Math.min(1, Math.abs(k) * 1.6);
      p.rot = lean * 0.32;
      p.armL = 1.55 + lean * 0.25; p.armR = 1.55 - lean * 0.25;
      p.look = { x: lean * 0.6, y: 0 };
      p.mouth = Math.abs(lean) > 0.8 ? 'open' : 'grin'; p.eyes = Math.abs(lean) > 0.8 ? 'wide' : 'look';
      break;
    }
    case 'cheer': {
      const k = (t * 2.5) % 1;
      p.dy = -Math.sin(Math.PI * k) * 0.9;
      p.armL = p.armR = 2.7;
      p.eyes = 'happy'; p.mouth = 'big';
      break;
    }
    case 'dance': {
      p.rot = Math.sin(t * 8) * 0.3;
      p.dy = -Math.abs(Math.sin(t * 8)) * 0.6;
      p.armL = 1.5 + Math.sin(t * 8) * 1.3; p.armR = 1.5 - Math.sin(t * 8) * 1.3;
      p.eyes = 'happy'; p.mouth = 'big';
      break;
    }
    default: { // idle bounce
      p.dy = -Math.abs(Math.sin(t * 3)) * 0.12;
      p.sy = 1 + Math.sin(t * 6) * 0.04; p.sx = 2 - p.sy;
      p.armL = 0.5 + Math.sin(t * 2) * 0.2; p.armR = 0.5 - Math.sin(t * 2) * 0.2;
      p.eyes = (t % 4) < 0.15 ? 'closed' : 'look';
    }
  }
  return p;
}

// Blend a pose toward 'cheer' etc. is overkill; poses switch instantly but bouncily.
export function drawCoach(g, x, y, r, pose, t) {
  const p = pose;
  r *= p.scale;
  g.save();
  g.translate(x, y + p.dy * r);
  g.rotate(p.rot);
  // shadow
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(0, -p.dy * r + r * 0.05, r * 0.9 * (1 + p.dy * 0.3), r * 0.18, 0, 0, Math.PI * 2); g.fill();

  const turn = p.turn; // 1 = facing us, -1 = back
  const bw = r * p.sx * (0.75 + 0.25 * Math.abs(turn)), bh = r * p.sy;
  const cy = -bh; // body centre

  // feet
  g.fillStyle = BODY_DARK;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * bw * 0.45 * turn, -r * 0.08, r * 0.32, r * 0.16, 0, 0, Math.PI * 2); g.fill(); }

  // arms (behind body when facing away)
  const arm = (side, angle, front) => {
    const sx = side * bw * 0.85 * (Math.abs(turn) < 0.2 ? 0.2 : 1), sy = cy + bh * 0.1;
    const len = r * 0.75;
    const a = side * angle; // 0 = down, PI = up (mirrored per side)
    const hx = sx + Math.sin(a) * len, hy = sy + Math.cos(a) * len;
    if (front !== undefined && !front) return { hx, hy };
    g.strokeStyle = BODY_DARK; g.lineWidth = r * 0.16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + Math.sin(a) * len * 0.5 + side * r * 0.1, sy + Math.cos(a) * len * 0.5, hx, hy); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, r * 0.17, 0, Math.PI * 2); g.fill();
    return { hx, hy };
  };
  if (turn < 0) { arm(-1, p.armL); arm(1, p.armR); }

  // body
  const grad = g.createRadialGradient(-bw * 0.35, cy - bh * 0.4, r * 0.1, 0, cy, bw * 1.1);
  grad.addColorStop(0, p.ice ? '#c9f4ff' : '#8ff5e8');
  grad.addColorStop(1, p.ice ? '#6cc8ff' : BODY);
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(0, cy, bw, bh, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(27,17,64,.35)'; g.lineWidth = Math.max(2, r * 0.05); g.stroke();

  if (turn > 0.2) {
    g.save();
    g.translate(0, cy);
    g.rotate(p.tilt);
    g.scale(turn, 1);
    // goggles strap + goggles on the forehead
    g.strokeStyle = '#ff5ea8'; g.lineWidth = r * 0.1;
    g.beginPath(); g.ellipse(0, -bh * 0.55, bw * 0.98, bh * 0.2, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    for (const s of [-1, 1]) {
      g.fillStyle = 'rgba(180,240,255,.85)'; g.strokeStyle = '#ff5ea8'; g.lineWidth = r * 0.06;
      g.beginPath(); g.arc(s * r * 0.24, -bh * 0.68, r * 0.15, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // googly eyes
    const er = r * 0.24, ey = -bh * 0.18;
    for (const s of [-1, 1]) {
      const ex = s * r * 0.3;
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.04);
      g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.strokeStyle = INK;
      if (p.eyes === 'closed') {
        g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(ex - er * 0.7, ey); g.lineTo(ex + er * 0.7, ey); g.stroke();
      } else if (p.eyes === 'happy') {
        g.lineWidth = r * 0.07; g.beginPath(); g.arc(ex, ey + er * 0.25, er * 0.55, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      } else if (p.eyes === 'swirl') {
        g.lineWidth = r * 0.045; g.beginPath();
        for (let a = 0; a < 10; a += 0.35) { const rr = (a / 10) * er * 0.85, aa = a + t * 9 * s; g.lineTo(ex + Math.cos(aa) * rr, ey + Math.sin(aa) * rr); }
        g.stroke();
      } else {
        const wob = Math.sin(t * 7 + s) * er * 0.12;
        const pr = p.eyes === 'wide' ? er * 0.35 : er * 0.5;
        g.beginPath(); g.arc(ex + p.look.x * er * 0.4 + wob, ey + p.look.y * er * 0.4 + er * 0.1, pr, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + p.look.x * er * 0.4 + wob - pr * 0.3, ey + er * 0.1 - pr * 0.35, pr * 0.3, 0, Math.PI * 2); g.fill();
      }
    }
    // cheeks
    g.fillStyle = 'rgba(255,94,168,.35)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.58, bh * 0.12, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); g.fill(); }
    // mouth
    const my = bh * 0.22;
    g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = r * 0.07; g.lineCap = 'round';
    if (p.mouth === 'smile') { g.beginPath(); g.arc(0, my - r * 0.12, r * 0.2, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
    else if (p.mouth === 'grin') {
      g.beginPath(); g.arc(0, my - r * 0.1, r * 0.3, 0.1, Math.PI - 0.1); g.closePath(); g.fill();
      g.fillStyle = '#ff7aa8'; g.beginPath(); g.arc(0, my + r * 0.12, r * 0.1, Math.PI, 0); g.fill();
    } else if (p.mouth === 'o') { g.beginPath(); g.ellipse(0, my, r * 0.09, r * 0.11, 0, 0, Math.PI * 2); g.fill(); }
    else {
      const big = p.mouth === 'big' ? 1.5 : 1;
      g.beginPath(); g.ellipse(0, my, r * 0.17 * big, r * 0.15 * big, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff7aa8'; g.beginPath(); g.ellipse(0, my + r * 0.07 * big, r * 0.1 * big, r * 0.06 * big, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  if (turn >= 0) {
    // front arms; peekaboo pulls the hands over the eyes
    if (p.covered > 0) {
      for (const s of [-1, 1]) {
        const tx = s * r * 0.3, ty = cy - bh * 0.18;
        const sx = s * bw * 0.85, sy = cy + bh * 0.1;
        const hx = sx + (tx - sx) * p.covered, hy = sy + (ty - sy) * p.covered;
        g.strokeStyle = BODY_DARK; g.lineWidth = r * 0.16; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, r * 0.27, 0, Math.PI * 2); g.fill();
      }
    } else {
      arm(-1, p.armL);
      const h = arm(1, p.armR);
      if (p.hold) {
        g.fillStyle = p.hold; g.strokeStyle = '#fff'; g.lineWidth = r * 0.05;
        g.beginPath(); g.arc(h.hx, h.hy - r * 0.25, r * 0.26, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(h.hx - r * 0.08, h.hy - r * 0.34, r * 0.07, 0, Math.PI * 2); g.fill();
      }
    }
  }
  if (p.ice) {
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = r * 0.04;
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * 1.3, sx = Math.cos(a) * bw * 1.1, sy = cy + Math.sin(a * 1.3) * bh;
      g.beginPath(); for (let k = 0; k < 3; k++) { const aa = (k / 3) * Math.PI; g.moveTo(sx - Math.cos(aa) * r * 0.08, sy - Math.sin(aa) * r * 0.08); g.lineTo(sx + Math.cos(aa) * r * 0.08, sy + Math.sin(aa) * r * 0.08); } g.stroke();
    }
  }
  g.restore();
}
