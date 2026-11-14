// A tiny, mirrored copy of the camera frame (e.g. 96x54 on high tier).
// Cheap pixel trackers (motion, color) read from this instead of the full video.

import { camera } from './camera.js';
import { perf } from './perf.js';

const c = document.createElement('canvas');
const g = c.getContext('2d', { willReadFrequently: true });

export const frame = {
  w: 0,
  h: 0,
  data: null, // Uint8ClampedArray RGBA
  id: 0,      // increments each sample, so trackers can cache per frame

  // Returns true if a NEW camera frame was sampled (no point re-sampling the same one).
  update(now = performance.now()) {
    if (!camera.ready) return false;
    if (camera.hasFrameCallback) {
      if (camera.frameCount === this._lastCamFrame) return false;
      this._lastCamFrame = camera.frameCount;
    } else {
      if (now - (this._lastTime || 0) < 32) return false; // fallback: ~30 Hz
      this._lastTime = now;
    }
    const w = perf.settings.sampleWidth;
    const h = Math.max(1, Math.round((w * camera.height) / camera.width));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.setTransform(-1, 0, 0, 1, w, 0); // mirror so x matches the screen
    g.drawImage(camera.video, 0, 0, w, h);
    this.data = g.getImageData(0, 0, w, h).data;
    this.w = w;
    this.h = h;
    this.id++;
    return true;
  },
};
