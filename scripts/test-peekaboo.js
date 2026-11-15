// Simulated playtests for body-based peekaboo (wrists vs head, from pose landmarks). Run: npm test
// Each scenario moves a pretend stick-kid's wrists over time and checks how many BOOs come out.
import { createPeekabooTracker } from '../src/core/peekaboo.js';

const ASPECT = 4 / 3;
let failures = 0;

// A child ~3 m away: shoulder width 0.11 frame heights, shoulders at y 0.45, nose 0.75 widths above.
function kid({ sw = 0.11, cx = 0.5, my = 0.45 } = {}) {
  const half = sw / 2 / ASPECT; // half shoulder width in x norm units
  const nose = { x: cx, y: my - 0.75 * sw };
  return {
    sw, cx, my, nose,
    // wrist targets in norm coords
    down: (side) => ({ x: cx + side * half * 1.2, y: my + 2 * sw }),
    face: (side) => ({ x: cx + side * half * 0.35, y: nose.y + 0.05 * sw }),
    onHead: (side) => ({ x: cx + side * half * 0.6, y: nose.y - 0.55 * sw }),
    up: (side) => ({ x: cx + side * half * 1.1, y: nose.y - 2.2 * sw }),
    shoulders: { leftShoulder: { x: cx - half, y: my, v: 0.99 }, rightShoulder: { x: cx + half, y: my, v: 0.99 } },
  };
}

const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

// segment: { dur, at(k) -> { l, r, noseV?, lv?, rv?, gone? } } with l/r = wrist positions
function scenario(name, K, segments, expected, fps, { noise = 0.004 } = {}) {
  const tr = createPeekabooTracker();
  const dt = 1 / fps;
  let rng = 3;
  const jit = () => { rng = (rng * 16807) % 2147483647; return (rng / 2147483647 - 0.5) * noise; };
  const p = (pt, v = 0.99) => ({ x: pt.x + jit(), y: pt.y + jit(), v });
  const got = [];
  let t = 0, hides = 0;
  for (const seg of segments) {
    for (let st = 0; st < seg.dur; st += dt, t += dt) {
      const f = seg.at(st / seg.dur);
      const pts = f.gone ? {} : {
        ...K.shoulders,
        nose: p(K.nose, f.noseV ?? 0.99),
        leftWrist: p(f.l, f.lv ?? 0.95), rightWrist: p(f.r, f.rv ?? 0.95),
      };
      for (const e of tr.update(dt, pts, ASPECT)) {
        if (e === 'peekaboo') got.push(t.toFixed(1));
        if (e === 'hide') hides++;
      }
    }
  }
  const ok = got.length === expected && hides >= got.length;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${fps}fps] ${name}: expected ${expected} peekaboo(s), got ${got.length} [${got.join(', ')}] (hides ${hides})`);
}

const hold = (l, r, dur, extra = {}) => ({ dur, at: () => ({ l, r, ...extra }) });
const move = (l0, l1, r0, r1, dur, extra = {}) => ({ dur, at: (k) => ({ l: lerp(l0, l1, ease(k)), r: lerp(r0, r1, ease(k)), ...extra }) });

for (const fps of [30, 12]) {
  const K = kid();
  const D = [K.down(-1), K.down(1)], F = [K.face(-1), K.face(1)];
  const cover = (dur = 1, extra) => [move(D[0], F[0], D[1], F[1], 0.35), hold(F[0], F[1], dur, extra), move(F[0], D[0], F[1], D[1], 0.3)];
  const rest = (dur) => hold(D[0], D[1], dur);

  scenario('three peekaboos', K, [rest(1), ...cover(), rest(1), ...cover(0.8), rest(1), ...cover(1.5), rest(1)], 3, fps);
  scenario('nose hidden by the hands (low visibility) while covering', K, [rest(1), ...cover(1, { noseV: 0.1 }), rest(1)], 1, fps);
  scenario('one wrist flickers out while covering', K, [rest(1), move(D[0], F[0], D[1], F[1], 0.35),
    hold(F[0], F[1], 0.5), hold(F[0], F[1], 0.25, { lv: 0.1 }), hold(F[0], F[1], 0.5), move(F[0], D[0], F[1], D[1], 0.3), rest(1)], 1, fps);
  scenario('body tracking drops for 0.3 s mid-cover', K, [rest(1), move(D[0], F[0], D[1], F[1], 0.35),
    hold(F[0], F[1], 0.5), hold(F[0], F[1], 0.3, { gone: true }), hold(F[0], F[1], 0.5), move(F[0], D[0], F[1], D[1], 0.3), rest(1)], 1, fps);
  scenario('hands on head for 5 s, then down (still one BOO)', K, [rest(1), move(D[0], K.onHead(-1), D[1], K.onHead(1), 0.4),
    hold(K.onHead(-1), K.onHead(1), 5), move(K.onHead(-1), D[0], K.onHead(1), D[1], 0.4), rest(1)], 1, fps);
  scenario('quick clap in front of the face', K, [rest(1), move(D[0], F[0], D[1], F[1], 0.25), hold(F[0], F[1], 0.1),
    move(F[0], D[0], F[1], D[1], 0.25), rest(1)], 0, fps);
  scenario('jumping with arms flung overhead (x5)', K, Array.from({ length: 5 }, () => [
    move(D[0], K.up(-1), D[1], K.up(1), 0.3), move(K.up(-1), D[0], K.up(1), D[1], 0.3)]).flat(), 0, fps);
  scenario('arms straight up, held', K, [rest(1), move(D[0], K.up(-1), D[1], K.up(1), 0.4), hold(K.up(-1), K.up(1), 3), rest(1)], 0, fps);
  scenario('one hand on the face only', K, [rest(1), move(D[0], F[0], D[1], D[1], 0.3), hold(F[0], D[1], 2), move(F[0], D[0], D[1], D[1], 0.3), rest(1)], 0, fps);
  scenario('dancing: arms swinging past the head', K, [rest(1), { dur: 5, at: (k) => {
    const a = Math.sin(k * Math.PI * 2 * 7), b = Math.sin(k * Math.PI * 2 * 7 + 1.2);
    return { l: lerp(D[0], K.up(-1), (a + 1) / 2), r: lerp(D[1], K.up(1), (b + 1) / 2) };
  } }, rest(1)], 0, fps, { noise: 0.008 });

  const far = kid({ sw: 0.06, cx: 0.4 });
  const fD = [far.down(-1), far.down(1)], fF = [far.face(-1), far.face(1)];
  scenario('far away (4 m): two peekaboos', far, [hold(fD[0], fD[1], 1),
    move(fD[0], fF[0], fD[1], fF[1], 0.35), hold(fF[0], fF[1], 1), move(fF[0], fD[0], fF[1], fD[1], 0.3), hold(fD[0], fD[1], 1),
    move(fD[0], fF[0], fD[1], fF[1], 0.35), hold(fF[0], fF[1], 1), move(fF[0], fD[0], fF[1], fD[1], 0.3), hold(fD[0], fD[1], 1)], 2, fps, { noise: 0.003 });
}

if (failures) { console.log(`\n${failures} peekaboo scenario(s) failed`); process.exit(1); }
console.log('\nAll peekaboo scenarios passed');
