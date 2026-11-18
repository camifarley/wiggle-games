// ?fakecam=person: the cartoon kid is drawn from the pretend body's pose (src/core/fakeperson.js).
// Checks the shapes (= the exact fake segmentation mask) follow the body. Run: npm test
import { personShapes, insideShapes } from '../src/core/fakeperson.js';
import { createTestBody } from '../src/core/testbody.js';

let failures = 0;
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };
const W = 640, H = 480, A = W / H;

function after(body, secs, step = 1 / 60) { for (let t = 0; t < secs; t += step) body.update(step); return body.sample(A).pose; }
const shapesOf = (pose) => personShapes(pose, W, H);

const body = createTestBody({ jitter: 0 });
const stand = shapesOf(after(body, 0.5));
check('standing: found', stand.found && stand.parts.length > 10);
const sh = body.sample(A).pose;
const sMid = { x: (sh.leftShoulder.x + sh.rightShoulder.x) / 2 * W, y: (sh.leftShoulder.y + sh.rightShoulder.y) / 2 * H };
const hMid = { x: (sh.leftHip.x + sh.rightHip.x) / 2 * W, y: (sh.leftHip.y + sh.rightHip.y) / 2 * H };
const chest = { x: (sMid.x + hMid.x) / 2, y: (sMid.y + hMid.y) / 2 };
check('mask: chest is the person', insideShapes(stand, chest.x, chest.y));
check('mask: head is the person', insideShapes(stand, stand.head.x, stand.head.y));
check('mask: each wrist is the person', insideShapes(stand, sh.leftWrist.x * W, sh.leftWrist.y * H) && insideShapes(stand, sh.rightWrist.x * W, sh.rightWrist.y * H));
check('mask: corners are the room', !insideShapes(stand, 5, 5) && !insideShapes(stand, W - 5, 5) && !insideShapes(stand, 5, H - 5));
check('mask: beside the waist is the room', !insideShapes(stand, chest.x + stand.size * 1.6, chest.y));
check('standing: a kid-sized figure (40-85% of the height)', stand.box.h / H > 0.4 && stand.box.h / H < 0.85, (stand.box.h / H).toFixed(2));
check('standing: in the middle', Math.abs(stand.box.x + stand.box.w / 2 - W / 2) < W * 0.05);
check('standing: feet inside the picture', stand.box.y + stand.box.h <= H + 2, `${(stand.box.y + stand.box.h).toFixed(0)}`);
check('standing: facing the camera (face drawn)', stand.facing === true);

// jump: the whole figure goes up and comes back
body.press('jump');
let top = Infinity;
for (let t = 0; t < 1.2; t += 1 / 60) { body.update(1 / 60); top = Math.min(top, shapesOf(body.sample(A).pose).box.y); }
check('jump: the figure rises', top < stand.box.y - 15, `${(stand.box.y - top).toFixed(0)} px`);
check('jump: and lands', Math.abs(shapesOf(body.sample(A).pose).box.y - stand.box.y) < 3);

// crouch: the head goes down, feet stay
body.press('crouch');
const low = shapesOf(after(body, 0.9));
check('crouch: the head drops', low.head.y > stand.head.y + 40, `${(low.head.y - stand.head.y).toFixed(0)} px`);
check('crouch: the feet stay on the floor', Math.abs(low.box.y + low.box.h - (stand.box.y + stand.box.h)) < 8);
body.release('crouch'); after(body, 0.8);

// lean right: the figure slides to the screen's right
body.press('right');
const lean = shapesOf(after(body, 1.5));
check('lean right: moves right on screen', lean.head.x > stand.head.x + 10, `${(lean.head.x - stand.head.x).toFixed(0)} px`);
body.release('right'); after(body, 2);

// peekaboo: hands over the face, so the wrists are up at the head
body.press('peekaboo');
const peek = shapesOf(after(body, 1));
const pp = body.sample(A).pose;
check('peekaboo: hands up at the head', pp.leftWrist.y * H < peek.head.y + peek.headR && insideShapes(peek, pp.leftWrist.x * W, pp.leftWrist.y * H));
body.release('peekaboo'); after(body, 1.5);

// spin: side-on half way, back of the head when facing away
body.press('spin');
let sawBack = false, narrowest = Infinity;
for (let t = 0; t < 1.8; t += 1 / 60) { body.update(1 / 60); const s = shapesOf(body.sample(A).pose); if (!s.facing) sawBack = true; narrowest = Math.min(narrowest, s.box.w); }
check('spin: shows the back of the head', sawBack);
check('spin: narrower side-on', narrowest < stand.box.w * 0.8, `${narrowest.toFixed(0)} vs ${stand.box.w.toFixed(0)}`);

// leave: nobody in the picture (the mask is empty)
body.press('leave');
const gone = shapesOf(after(body, 1.2));
check('leave: no person', !gone.found && !insideShapes(gone, W / 2, H / 2));
check('no pose: no person', !personShapes({ found: false, points: [] }, W, H).found && !personShapes(null, W, H).found);

if (failures) { console.error(`\n${failures} fake person check(s) failed`); process.exit(1); }
console.log('\nfake person: all checks passed');
