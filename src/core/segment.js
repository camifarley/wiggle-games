// Person cutout (segmentation): a soft mask of the kid, for camera effects that put him on a backdrop,
// make him see-through, clone him... A game gets it with `needs: ['segment']` (lazy: nothing downloads
// otherwise). MediaPipe ImageSegmenter with the small selfie segmenter model, run on a tiny MIRRORED copy
// of the camera (256 wide on high tier), so the mask is already in view coords like every other tracker.
//
//   ctx.segment.ready     true once a mask exists
//   ctx.segment.source    'ml' | 'fake' (?fakecam=person: the cartoon's exact mask) | 'none' (failed / loading)
//   ctx.segment.mask      a <canvas> (camera aspect, mirrored): white, alpha = how sure it is he's there.
//                         2D: draw the camera, then `globalCompositeOperation = 'destination-in'` + the mask.
//                         WebGL: new THREE.CanvasTexture(mask), read `.a`; re-upload when `frame` changes.
//   ctx.segment.width / height   mask size in px
//   ctx.segment.frame     +1 per new mask
//   ctx.segment.coverage  0..1 of the picture that is him · .box {x, y, w, h} (norm) | null · .cx / .cy
//   ctx.segment.config    { smooth 0..1 (newest mask weight), threshold, fps (null = tier) }, reset per game
//
// The camera picture never leaves the device; nothing is stored. ?fakecam=person&realseg runs the real
// model on the cartoon instead of the exact fake mask (to test the ML path without a camera).

import { camera } from './camera.js';
import { perf } from './perf.js';
import { vision, create } from './tracking.js';
import { SEGMENT_TIERS, SEGMENT_DEFAULTS, maskSize, smoothInto, toRGBA, maskStats } from './segmask.js';

const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const realSeg = new URLSearchParams(location.search).has('realseg');

let runner = null, loading = null, last = 0, lastTs = 0, values = null, rgba = null, statsT = 0;
const input = document.createElement('canvas');
const ig = input.getContext('2d');
const out = document.createElement('canvas');
const og = out.getContext('2d');

const useFake = () => camera.fake && !realSeg;

export const segment = {
  ready: false,
  source: 'none',
  mask: out,
  width: 0,
  height: 0,
  frame: 0,
  coverage: 0,
  box: null,
  cx: 0.5,
  cy: 0.5,
  config: { ...SEGMENT_DEFAULTS, fps: null },
  error: null,

  // Never throws: a game without a mask falls back to the plain camera.
  async load() {
    if (useFake() || runner) return;
    if (!loading) {
      loading = vision().then(async ({ mp, fileset }) => {
        runner = await create(mp.ImageSegmenter, fileset, MODEL, { outputConfidenceMasks: true, outputCategoryMask: false });
      }).catch((e) => { loading = null; this.error = String(e?.message || e); console.warn('[segment] model failed to load', e); });
    }
    await loading;
  },

  reset() {
    this.ready = false; this.source = 'none'; this.coverage = 0; this.box = null; this.cx = 0.5; this.cy = 0.5;
    this.config = { ...SEGMENT_DEFAULTS, fps: null };
    values = null;
    og.clearRect(0, 0, out.width, out.height);
  },

  // Called every frame by the runtime while the game needs 'segment'.
  update(now) {
    if (useFake()) return this._fake();
    if (!runner || !camera.ready || camera.video.readyState < 2) return;
    const tier = SEGMENT_TIERS[perf.settings.name] || SEGMENT_TIERS.medium;
    const fps = this.config.fps || Math.min(tier.fps, perf.settings.trackFps);
    if (now - last < 1000 / fps) return;
    last = now;
    const { w, h } = maskSize(camera.width, camera.height, tier.width);
    if (input.width !== w || input.height !== h) { input.width = w; input.height = h; }
    ig.setTransform(-1, 0, 0, 1, w, 0); // mirror: the mask comes out in view coords
    ig.drawImage(camera.video, 0, 0, w, h);
    const ts = Math.max(now, lastTs + 1);
    lastTs = ts;
    let res;
    try { res = runner.segmentForVideo(input, ts); } catch (e) { console.warn('[segment] failed', e); return; }
    const masks = res?.confidenceMasks || [];
    const m = masks[masks.length - 1]; // selfie segmenter: one mask = person (multi-class models: last = person)
    if (m) {
      const raw = m.getAsFloat32Array();
      if (raw.length === w * h) {
        values = smoothInto(values, raw, this.config.smooth);
        this._publish(w, h);
      }
    }
    for (const k of masks) k.close?.();
    res?.close?.();
  },

  _publish(w, h) {
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    rgba = toRGBA(values, rgba);
    og.putImageData(new ImageData(rgba, w, h), 0, 0);
    this.width = w; this.height = h;
    this.frame++;
    this.ready = true;
    this.source = 'ml';
    // stats are a cheap loop over ~37k values; a few times a second is plenty
    const now = performance.now();
    if (now - statsT > 150) { statsT = now; Object.assign(this, maskStats(values, w, h, this.config.threshold)); }
  },

  // ?fakecam=person: the cartoon's exact mask (same frame as the picture)
  _fake() {
    const f = camera.fake;
    if (f.frame === this._fakeFrame) return;
    this._fakeFrame = f.frame;
    this.mask = f.mask;
    this.width = f.mask.width; this.height = f.mask.height;
    this.frame++;
    this.ready = true;
    this.source = 'fake';
    const s = f.shapes;
    if (s?.found) {
      const b = s.box;
      this.box = { x: b.x / f.width, y: b.y / f.height, w: b.w / f.width, h: b.h / f.height };
      this.coverage = Math.min(1, (b.w * b.h * 0.55) / (f.width * f.height)); // a person fills ~55% of their box
      this.cx = this.box.x + this.box.w / 2; this.cy = this.box.y + this.box.h / 2;
    } else { this.box = null; this.coverage = 0; }
  },
};
