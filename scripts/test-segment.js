// Person-mask helpers (src/core/segmask.js) used by the segment tracker. Run: npm test
import { maskSize, smoothInto, toRGBA, maskStats, SEGMENT_TIERS, SEGMENT_DEFAULTS } from '../src/core/segmask.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };

// sizes keep the camera aspect
const a = maskSize(1280, 720, 256), b = maskSize(640, 480, 144);
check('size: 16:9 camera -> 256x144', a.w === 256 && a.h === 144, `${a.w}x${a.h}`);
check('size: 4:3 camera -> 144x108', b.w === 144 && b.h === 108, `${b.w}x${b.h}`);
check('size: unknown camera falls back to 16:9', maskSize(0, 0, 160).h === 90);
check('tiers: low is smaller and slower than high', SEGMENT_TIERS.low.width < SEGMENT_TIERS.high.width && SEGMENT_TIERS.low.fps < SEGMENT_TIERS.high.fps);

// smoothing: first mask is copied, then eased toward the newest
let st = smoothInto(null, new Float32Array([1, 0, 0.5]), 0.5);
check('smooth: first mask copied', st[0] === 1 && st[1] === 0 && st[2] === 0.5);
st = smoothInto(st, new Float32Array([0, 1, 0.5]), 0.5);
check('smooth: halfway with k = 0.5', Math.abs(st[0] - 0.5) < 1e-6 && Math.abs(st[1] - 0.5) < 1e-6 && Math.abs(st[2] - 0.5) < 1e-6);
const st2 = smoothInto(st, new Float32Array([1, 1, 1]), 1);
check('smooth: k = 1 is no smoothing', st2[0] === 1 && st2[1] === 1);
check('smooth: resized mask starts fresh', smoothInto(st, new Float32Array(5).fill(0.25), 0.1).length === 5);
// a flickering pixel (person / not / person...) stays mostly "person" with the default smoothing
let flick = null;
for (let i = 0; i < 30; i++) flick = smoothInto(flick, new Float32Array([i % 3 === 2 ? 0 : 1]), SEGMENT_DEFAULTS.smooth);
check('smooth: one-frame dropouts do not blink the cutout off', flick[0] > 0.3, flick[0].toFixed(2));

// RGBA: white, alpha = confidence
const px = toRGBA(new Float32Array([0, 1, 0.5]));
check('rgba: white with alpha', px.length === 12 && px[0] === 255 && px[3] === 0 && px[7] === 255 && Math.abs(px[11] - 128) <= 1);
check('rgba: reuses the output buffer', toRGBA(new Float32Array([1, 1, 1]), px) === px);

// stats: a 10x10 mask with a 4x6 person block at x 3..6, y 2..7
const w = 10, h = 10, v = new Float32Array(w * h);
for (let y = 2; y < 8; y++) for (let x = 3; x < 7; x++) v[y * w + x] = 0.9;
const s = maskStats(v, w, h);
check('stats: coverage', Math.abs(s.coverage - 0.24) < 1e-6, s.coverage.toFixed(2));
check('stats: box', Math.abs(s.box.x - 0.3) < 1e-6 && Math.abs(s.box.y - 0.2) < 1e-6 && Math.abs(s.box.w - 0.4) < 1e-6 && Math.abs(s.box.h - 0.6) < 1e-6, JSON.stringify(s.box));
check('stats: centre', Math.abs(s.cx - 0.5) < 1e-6 && Math.abs(s.cy - 0.5) < 1e-6, `${s.cx}, ${s.cy}`);
check('stats: nobody there', maskStats(new Float32Array(100), 10, 10).box === null);
check('stats: low confidence is not a person', maskStats(new Float32Array(100).fill(0.3), 10, 10).coverage === 0);

if (failures) { console.error(`\n${failures} segment check(s) failed`); process.exit(1); }
console.log('\nsegment: all checks passed');
