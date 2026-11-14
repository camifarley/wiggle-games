// Animal Face: a cartoon animal head follows your face, tilts with you,
// blinks when you blink and opens its mouth when you do.
// Open your mouth WIDE and hold it to switch animals.
// Uses MediaPipe face tracking (loaded only for this game).

const ANIMALS = [
  { name: 'Puppy', head: '#c98a4b', ear: '#8a5a2b', ears: 'floppy', snout: '#f1d3a8', nose: '#2b1a10' },
  { name: 'Kitty', head: '#f0a04b', ear: '#f0a04b', ears: 'pointy', snout: '#fff1dc', nose: '#ff6f91', whiskers: true },
  { name: 'Bear',  head: '#7a4e2d', ear: '#7a4e2d', ears: 'round',  snout: '#c89b6d', nose: '#1c120b' },
  { name: 'Frog',  head: '#5bc85b', ear: null,      ears: 'frog',   snout: null,      nose: '#2f7d2f' },
  { name: 'Piggy', head: '#ffb3c6', ear: '#ff8fab', ears: 'pointy', snout: '#ff8fab', nose: '#d45d7b', pig: true },
];

let idx = 0;
let openFor = 0;
let cooldown = 0;
let lost = 0;
const s = { x: 0, y: 0, r: 0, roll: 0, mouth: 0, bl: 0, br: 0, smile: 0, pop: 0 }; // smoothed

export default {
  needs: ['face'],

  init(ctx) {
    idx = 0; openFor = 0; cooldown = 0; s.r = 0;
    ctx.say('Look at the screen! Open your mouth really wide!');
  },

  update(dt, ctx) {
    const f = ctx.face;
    cooldown -= dt;
    s.pop = Math.max(0, s.pop - dt * 3);
    if (!f.found) { lost += dt; return; }
    lost = 0;

    const { view } = ctx;
    const eyes = { x: (f.leftEye.x + f.rightEye.x) / 2, y: (f.leftEye.y + f.rightEye.y) / 2 };
    const c = view.toScreen((eyes.x + f.center.x) / 2, (eyes.y + f.center.y) / 2);
    const r = view.scale(f.size) * 1.7;
    const k = s.r === 0 ? 1 : Math.min(1, dt * 18);
    s.x += (c.x - s.x) * k;
    s.y += (c.y - s.y) * k;
    s.r += (r - s.r) * k;
    s.roll += (f.roll - s.roll) * k;
    s.mouth += (f.mouthOpen - s.mouth) * Math.min(1, dt * 25);
    s.bl += (f.blinkLeft - s.bl) * Math.min(1, dt * 30);
    s.br += (f.blinkRight - s.br) * Math.min(1, dt * 30);
    s.smile += (f.smile - s.smile) * k;

    if (f.mouthOpen > 0.7) openFor += dt; else openFor = 0;
    if (openFor > 0.6 && cooldown <= 0) {
      idx = (idx + 1) % ANIMALS.length;
      openFor = 0; cooldown = 1.2; s.pop = 1;
      ctx.sfx.boing();
      ctx.fx.burst(s.x, s.y, { count: 40, speed: 500 });
      ctx.say(ANIMALS[idx].name + '!');
    }
  },

  draw(g, ctx) {
    if (!ctx.face.found && lost > 0.4) {
      const size = Math.min(ctx.W, ctx.H) * 0.08;
      g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText('👀 Look at me!', ctx.W / 2, ctx.H / 2 + Math.sin(ctx.time * 3) * 12);
      return;
    }
    if (s.r === 0) return;
    const a = ANIMALS[idx];
    const R = s.r * (1 + s.pop * 0.25);
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.roll);
    drawAnimal(g, a, R);
    g.restore();
  },
};

function circle(g, x, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

function drawAnimal(g, a, R) {
  // ears (behind head)
  if (a.ears === 'pointy') {
    for (const side of [-1, 1]) {
      g.fillStyle = a.ear;
      g.beginPath();
      g.moveTo(side * R * 0.25, -R * 0.8); g.lineTo(side * R * 0.85, -R * 1.25); g.lineTo(side * R * 0.9, -R * 0.35);
      g.fill();
    }
  } else if (a.ears === 'round') {
    for (const side of [-1, 1]) { circle(g, side * R * 0.72, -R * 0.72, R * 0.32, a.ear); circle(g, side * R * 0.72, -R * 0.72, R * 0.17, a.snout); }
  } else if (a.ears === 'floppy') {
    for (const side of [-1, 1]) {
      g.fillStyle = a.ear;
      g.beginPath(); g.ellipse(side * R * 0.9, -R * 0.1, R * 0.28, R * 0.6, side * -0.35, 0, Math.PI * 2); g.fill();
    }
  }

  // head
  circle(g, 0, 0, R, a.head);

  // frog eyes sit on top
  const eyeY = a.ears === 'frog' ? -R * 0.75 : -R * 0.18;
  if (a.ears === 'frog') for (const side of [-1, 1]) circle(g, side * R * 0.45, eyeY, R * 0.3, a.head);

  // eyes (blink squashes them)
  for (const [side, blink] of [[-1, s.bl], [1, s.br]]) {
    const ex = side * R * (a.ears === 'frog' ? 0.45 : 0.38);
    const open = Math.max(0.08, 1 - blink * 1.2);
    g.save(); g.translate(ex, eyeY); g.scale(1, open);
    circle(g, 0, 0, R * 0.17, '#fff');
    circle(g, 0, R * 0.02, R * 0.1, '#1b1140');
    circle(g, R * 0.04, -R * 0.03, R * 0.035, '#fff');
    g.restore();
  }

  // cheeks when smiling
  if (s.smile > 0.3) {
    g.globalAlpha = Math.min(0.7, s.smile);
    for (const side of [-1, 1]) circle(g, side * R * 0.6, R * 0.25, R * 0.14, '#ff6f91');
    g.globalAlpha = 1;
  }

  // snout
  const mouthY = R * 0.45;
  if (a.snout && !a.pig) { g.fillStyle = a.snout; g.beginPath(); g.ellipse(0, R * 0.3, R * 0.42, R * 0.3, 0, 0, Math.PI * 2); g.fill(); }

  // mouth (opens with yours)
  const mh = R * (0.04 + s.mouth * 0.38);
  g.fillStyle = '#5a1020';
  g.beginPath(); g.ellipse(0, mouthY + mh * 0.4, R * (0.18 + s.mouth * 0.08), mh, 0, 0, Math.PI * 2); g.fill();
  if (s.mouth > 0.25) { g.fillStyle = '#ff6f91'; g.beginPath(); g.ellipse(0, mouthY + mh * 0.95, R * 0.13, mh * 0.4, 0, 0, Math.PI * 2); g.fill(); }

  // nose
  if (a.pig) {
    g.fillStyle = a.snout; g.beginPath(); g.ellipse(0, R * 0.15, R * 0.28, R * 0.2, 0, 0, Math.PI * 2); g.fill();
    for (const side of [-1, 1]) circle(g, side * R * 0.1, R * 0.15, R * 0.06, a.nose);
  } else {
    g.fillStyle = a.nose; g.beginPath(); g.ellipse(0, R * 0.15, R * 0.12, R * 0.08, 0, 0, Math.PI * 2); g.fill();
  }

  // whiskers
  if (a.whiskers) {
    g.strokeStyle = 'rgba(60,40,20,.8)'; g.lineWidth = Math.max(2, R * 0.02);
    for (const side of [-1, 1]) for (const dy of [-0.06, 0.06]) {
      g.beginPath(); g.moveTo(side * R * 0.3, R * (0.3 + dy)); g.lineTo(side * R * 0.85, R * (0.25 + dy * 2.5)); g.stroke();
    }
  }
}
