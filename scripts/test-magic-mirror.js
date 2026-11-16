// Magic Mirror stations without a browser: every station runs a few simulated seconds of a pretend kid
// (jumps, squats, leans, spins, peekaboo, claps, standing still) plus its finale, and every shader value
// must stay a finite number (a NaN would show a black or frozen picture). Also the clap detector.
// Run: npm test
import { EFFECT_STATIONS } from '../src/games/10-magic-mirror/v1.0/effects.js';
import { CUTOUT_STATIONS } from '../src/games/10-magic-mirror/v1.0/cutouts.js';
import { createClapDetector, spring, sp } from '../src/games/10-magic-mirror/v1.0/util.js';
import { DEFAULTS, SETTINGS } from '../src/games/10-magic-mirror/v1.0/settings.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };
const STATIONS = [...EFFECT_STATIONS, ...CUTOUT_STATIONS];
globalThis.setTimeout = (fn) => fn(); // sounds scheduled for later just play now

check('12 stations', STATIONS.length === 12, STATIONS.map((d) => d.id).join(' '));
check('unique ids', new Set(STATIONS.map((d) => d.id)).size === 12);
for (const d of STATIONS) {
  check(`${d.id}: has the parts`, d.title && d.word && d.icon && d.intro && d.finaleLine && d.shader && d.init && d.update && d.values && d.finaleTime > 0);
  check(`${d.id}: short word for the menu`, d.word.length <= 8, d.word);
  check(`${d.id}: shader writes a colour`, /gl_FragColor/.test(d.shader) && /void main\(\)/.test(d.shader));
}
check('settings: every station group exists', SETTINGS.every((s) => s.group === 'global' || STATIONS.some((d) => d.id === s.group)));

function rect(w = 1280, h = 720) {
  const vw = 640, vh = 480, s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
  return { x: 0, y: 0, w, h, dw, dh, unit: Math.min(w, h), k: 1, toScreen: (nx, ny) => ({ x: ox + nx * dw, y: oy + ny * dh }), toNorm: (px, py) => ({ x: (px - ox) / dw, y: (py - oy) / dh }) };
}
const finite = (v) => (Array.isArray(v) ? v.every(finite) : typeof v === 'number' ? Number.isFinite(v) : true);

for (const def of STATIONS) {
  for (const preview of [false, true]) {
    const B = { found: true, chest: { x: 0.5, y: 0.55 }, feet: { x: 0.5, y: 0.95 }, top: 0.25, size: 0.16, lean: 0, height: 0, crouch: 0, armsUp: 0, motion: 0.1, vel: { x: 0, y: 0 }, wrists: [{ x: 0.4, y: 0.6, ok: true }, { x: 0.6, y: 0.6, ok: true }] };
    const st = Object.assign(def.init(), { def, t: 0, meter: 0, finaleT: null });
    let meter = 0, scored = 0, said = 0;
    const M = {
      set: { ...DEFAULTS }, preview, time: 0, rect: rect(), body: B, aspect: 4 / 3, tierName: 'medium', maxClones: 6, finaleTime: def.finaleTime,
      gl: { historyFrames: 40, fps: 20, maxFrames: 40 }, music: { play() {}, resume() {} },
      fx: { burst() {}, confetti() {}, text() {}, shake() {} },
      meter: (v) => { meter += v; }, score: () => { scored++; }, sfx: () => {}, say: () => { said++; }, meterBurst() {},
    };
    let bad = null;
    const dt = 1 / 30;
    for (let i = 0; i < 360; i++) {
      const t = i * dt;
      M.time = t; st.t = t;
      B.lean = Math.sin(t * 1.5); B.height = i % 60 < 10 ? 3 : 0; B.crouch = i % 120 > 90 ? 1 : 0; B.armsUp = (Math.sin(t) + 1) / 2;
      B.motion = i > 200 && i < 260 ? 0.01 : 0.2 + 0.2 * Math.sin(t * 3); B.vel.x = Math.cos(t * 2) * 0.4;
      B.wrists[0].x = 0.4 + Math.sin(t * 2) * 0.1; B.wrists[1].y = 0.6 + Math.cos(t * 3) * 0.1;
      if (!preview && def.on) {
        if (i % 45 === 0) def.on.jump?.(st, M, {});
        if (i % 90 === 30) def.on.crouch?.(st, M, {});
        if (i % 100 === 50) def.on.spin?.(st, M, {});
        if (i % 70 === 20) def.on.clap?.(st, M, {});
        if (i % 80 === 10) def.on.lean?.(st, M, { side: 'left' });
        if (i % 120 === 60) { def.on.hide?.(st, M, {}); def.on.still?.(st, M, {}); }
        if (i % 120 === 100) def.on.peekaboo?.(st, M, {});
        if (i % 50 === 25) def.on.punch?.(st, M, { hand: 'right', x: 0.6, y: 0.5 });
      }
      if (!preview && i === 150) { st.finaleT = 0; def.finale?.(st, M); }
      if (st.finaleT != null) { st.finaleT += dt; if (st.finaleT >= def.finaleTime) { def.finaleEnd?.(st, M); st.finaleT = null; } }
      def.update(dt, st, B, M);
      const v = def.values(st, B, M);
      for (const [k, x] of Object.entries(v)) if (!finite(x)) { bad = `${k}=${JSON.stringify(x)} at frame ${i}`; break; }
      if (bad) break;
    }
    check(`${def.id}${preview ? ' (hub preview)' : ''}: shader values stay finite`, !bad, bad || '');
    if (!preview) {
      check(`${def.id}: playing fills the meter`, meter > (def.id === 'statue' ? 0.05 : 0.3), meter.toFixed(2));
      check(`${def.id}: moves are rewarded with points`, scored > 0 || def.id === 'statue', `${scored} scores`);
    }
  }
}

// clap: hands apart, then together within the window = one clap; staying together doesn't repeat
const c = createClapDetector();
let claps = 0, t = 0;
const feed = (d, secs) => { for (let i = 0; i < secs * 30; i++) { t += 1 / 30; if (c.update(t, d)) claps++; } };
feed(1.5, 0.5); feed(0.3, 0.5);
check('clap: apart then together = 1 clap', claps === 1, claps);
feed(0.3, 2);
check('clap: holding hands together is still 1', claps === 1, claps);
feed(1.5, 0.3); feed(0.3, 0.3);
check('clap: a second clap counts', claps === 2, claps);
feed(0.7, 2); feed(0.3, 0.3);
check('clap: slowly bringing hands together is not a clap', claps === 2, claps);
c.update(t += 0.03, null);
check('clap: hands not seen = no clap', claps === 2);

// spring: a big frame hitch never explodes
const s = sp(0); s.v = 50;
for (let i = 0; i < 20; i++) spring(s, 1, 0.25, 300, 5);
check('spring: stable with slow frames', Number.isFinite(s.x) && Math.abs(s.x - 1) < 0.5, s.x.toFixed(3));

if (failures) { console.error(`\n${failures} Magic Mirror check(s) failed`); process.exit(1); }
console.log('\nMagic Mirror: all checks passed');
