// The stage canvas + the mapping between camera space and screen space.
//
// COORDINATES: every tracker (motion, color, face, hands, pose) reports points in
// "norm" space: 0..1 across the MIRRORED camera image, exactly what the kid sees.
// Use view.toScreen(nx, ny) to get CSS-pixel screen coordinates for drawing.
// Games draw in CSS pixels; the canvas is already scaled for devicePixelRatio.

import { camera } from './camera.js';
import { perf } from './perf.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d');

export const view = {
  canvas,
  g,
  W: innerWidth,
  H: innerHeight,
  dpr: 1,
  // camera "cover" rect in screen pixels
  ox: 0, oy: 0, dw: innerWidth, dh: innerHeight,

  resize() {
    this.W = innerWidth;
    this.H = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, perf.settings.dprMax);
    canvas.width = Math.round(this.W * this.dpr);
    canvas.height = Math.round(this.H * this.dpr);
    this.updateCover();
  },

  updateCover() {
    const vw = camera.width, vh = camera.height;
    const s = Math.max(this.W / vw, this.H / vh);
    this.dw = vw * s;
    this.dh = vh * s;
    this.ox = (this.W - this.dw) / 2;
    this.oy = (this.H - this.dh) / 2;
  },

  toScreen(nx, ny) {
    return { x: this.ox + nx * this.dw, y: this.oy + ny * this.dh };
  },
  toNorm(x, y) {
    return { x: (x - this.ox) / this.dw, y: (y - this.oy) / this.dh };
  },
  // Length in norm units (relative to camera width) -> screen pixels
  scale(n) { return n * this.dw; },

  beginFrame() {
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  },

  clear(color = '#1b1140') {
    g.fillStyle = color;
    g.fillRect(0, 0, this.W, this.H);
  },

  drawCamera(alpha = 1) {
    if (!camera.ready) return this.clear();
    if (camera.width !== this._lastVW || camera.height !== this._lastVH) {
      this._lastVW = camera.width; this._lastVH = camera.height;
      this.updateCover();
    }
    g.save();
    g.globalAlpha = alpha;
    g.translate(this.W, 0);
    g.scale(-1, 1); // mirror
    g.drawImage(camera.video, this.ox, this.oy, this.dw, this.dh);
    g.restore();
  },
};

addEventListener('resize', () => view.resize());
perf.onChange(() => view.resize());
view.resize();
