// The mirror's WebGL engine (three.js, only full-screen quads). Owns:
//  - camTex: the live camera (VideoTexture), sampled mirrored, so shaders work in NORM coords like the trackers
//  - maskTex: the person mask (ctx.segment.mask; or a body-shaped mask drawn from the pose while the
//    segmenter isn't ready, so cutout stations never show nothing)
//  - hist: a ring buffer of the last N low-res frames packed in ONE atlas texture (rgb = picture,
//    a = person mask at that moment). Clones, time smear, trails and ghosts read it. N / size by tier.
//  - plate: the room without him, learned where the mask says he isn't (for see-through / Invisible)
// Each station is one fragment shader (effects.js) that gets the common header below. The result is
// rendered into the bottom-left of an offscreen WebGL canvas; the game draws that onto the 2D stage, so
// the core's HUD, particles and screen shake stay on top (like Smash Run).

import * as THREE from 'three';
import { personShapes, drawShapes } from '../../../core/fakeperson.js';

export const GL_TIERS = {
  high: { tileW: 256, cols: 8, rows: 8, fps: 30, plateW: 256, scale: 1 },
  medium: { tileW: 192, cols: 8, rows: 5, fps: 20, plateW: 192, scale: 0.8 },
  low: { tileW: 128, cols: 5, rows: 4, fps: 15, plateW: 160, scale: 0.6 },
};

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const HEADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCam, uMask, uHist, uPlate;
uniform vec2 uRes;       // target size (px)
uniform vec4 uCover;     // camera "cover" rect in target px: ox, oy, dw, dh
uniform float uTime, uAspect; // uAspect = camera width / height
uniform vec2 uGrid;      // atlas cols, rows
uniform float uHead, uCount, uFps; // newest frame index, frames stored, frames per second
uniform vec2 uInset;     // half a texel of one atlas tile (no bleeding between tiles)
uniform float uFeather, uCut; // mask edge softness, cutout threshold
#define PI 3.14159265
vec2 screenPx() { return vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y); }
vec2 toNorm(vec2 px) { return (px - uCover.xy) / uCover.zw; }
vec2 toPx(vec2 n) { return n * uCover.zw + uCover.xy; }
float inside(vec2 n) { return step(0.0, n.x) * step(n.x, 1.0) * step(0.0, n.y) * step(n.y, 1.0); }
vec3 cam(vec2 n) { n = clamp(n, 0.002, 0.998); return texture2D(uCam, vec2(1.0 - n.x, 1.0 - n.y)).rgb; }
float rawMask(vec2 n) { return texture2D(uMask, vec2(clamp(n.x, 0.0, 1.0), 1.0 - clamp(n.y, 0.0, 1.0))).a * inside(n); }
float cut(float m) { return smoothstep(uCut - uFeather, uCut + uFeather, m); }
float mask(vec2 n) { return cut(rawMask(n)); }
vec4 histRaw(vec2 n, float k) {
  float N = max(1.0, uCount);
  float idx = mod(uHead - clamp(floor(k), 0.0, N - 1.0) + 512.0 * uGrid.x * uGrid.y, uGrid.x * uGrid.y);
  vec2 cell = vec2(mod(idx, uGrid.x), floor(idx / uGrid.x));
  vec2 t = clamp(vec2(n.x, 1.0 - n.y), uInset, 1.0 - uInset);
  return texture2D(uHist, (cell + t) / uGrid);
}
// k frames ago (0 = newest); a = his mask then (cut + feathered)
vec4 hist(vec2 n, float k) { vec4 h = histRaw(n, k); h.a = cut(h.a) * inside(n); return h; }
vec4 histSmooth(vec2 n, float k) { vec4 a = hist(n, k), b = hist(n, k + 1.0); return mix(a, b, fract(k)); }
vec4 plateRaw(vec2 n) { return texture2D(uPlate, vec2(clamp(n.x, 0.0, 1.0), 1.0 - clamp(n.y, 0.0, 1.0))); }
// the room without him: learned plate where known, else a smudge of the picture around
vec3 plate(vec2 n) {
  vec4 p = plateRaw(n);
  // unknown spots: average the room around (samples on him don't count), so he never shows through
  vec3 blur = vec3(0.0); float wsum = 0.001;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * PI * 0.25;
    for (int j = 1; j <= 2; j++) {
      vec2 q = n + vec2(cos(a) / uAspect, sin(a)) * 0.16 * float(j);
      float w = 1.0 - rawMask(q);
      blur += cam(q) * w; wsum += w;
    }
  }
  vec3 room = wsum > 0.5 ? blur / wsum : cam(n);
  return mix(room, p.rgb, smoothstep(0.3, 0.7, p.a));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

const CAPTURE = `${HEADER}
void main() { vec2 n = vec2(vUv.x, 1.0 - vUv.y); gl_FragColor = vec4(cam(n), rawMask(n)); }`;

// learn the room where he isn't: a = how sure we are (grows only where the mask is clear, with a margin)
const PLATE = `${HEADER}
uniform sampler2D uPrev; uniform float uRate;
void main() {
  vec2 n = vec2(vUv.x, 1.0 - vUv.y);
  vec4 old = texture2D(uPrev, vUv);
  float m = 0.0;
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0; m = max(m, rawMask(n + vec2(cos(a) / uAspect, sin(a)) * 0.04)); }
  m = max(m, rawMask(n));
  float learn = (1.0 - smoothstep(0.08, 0.3, m)) * uRate;
  gl_FragColor = vec4(mix(old.rgb, cam(n), learn), min(1.0, old.a + learn * 1.5));
}`;

export function createMirrorGL({ tier = 'high', video }) {
  const T = GL_TIERS[tier] || GL_TIERS.medium;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders work on raw camera values
  renderer.autoClear = false;
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const camTex = new THREE.VideoTexture(video);
  camTex.minFilter = camTex.magFilter = THREE.LinearFilter;
  camTex.generateMipmaps = false;

  // ---------- mask ----------
  let maskTex = null, maskImg = null, maskFrame = -1;
  const poseMask = document.createElement('canvas');
  const pmg = poseMask.getContext('2d');
  function setMaskImage(img) {
    if (maskImg === img && maskTex && maskTex.image.width === img.width && maskTex.image.height === img.height) return;
    maskTex?.dispose();
    maskTex = new THREE.CanvasTexture(img);
    maskTex.minFilter = maskTex.magFilter = THREE.LinearFilter;
    maskTex.generateMipmaps = false;
    maskImg = img;
  }

  // ---------- history atlas ----------
  let hist = null, tileW = T.tileW, tileH = 144, head = -1, count = 0, lastCap = -1, capAcc = 0;
  const N = T.cols * T.rows;
  function makeHist(aspect) {
    hist?.dispose();
    tileH = Math.max(8, Math.round(tileW / aspect));
    hist = new THREE.WebGLRenderTarget(tileW * T.cols, tileH * T.rows, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    hist.texture.generateMipmaps = false;
    hist.scissorTest = true;
    head = -1; count = 0;
  }
  // ---------- room plate ----------
  let plates = null, plateIdx = 0;
  function makePlates(aspect) {
    plates?.forEach((p) => p.dispose());
    const w = T.plateW, h = Math.round(w / aspect);
    plates = [0, 1].map(() => {
      const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      rt.texture.generateMipmaps = false;
      return rt;
    });
    for (const p of plates) { renderer.setRenderTarget(p); renderer.setClearColor(0x000000, 0); renderer.clear(); }
    renderer.setRenderTarget(null);
  }

  const common = {
    uCam: { value: camTex }, uMask: { value: null }, uHist: { value: null }, uPlate: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) }, uCover: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTime: { value: 0 }, uAspect: { value: 4 / 3 }, uGrid: { value: new THREE.Vector2(T.cols, T.rows) },
    uHead: { value: 0 }, uCount: { value: 0 }, uFps: { value: T.fps }, uInset: { value: new THREE.Vector2(0.01, 0.01) },
    uFeather: { value: 0.12 }, uCut: { value: 0.5 },
  };
  const mat = (frag, extra = {}) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms: { ...common, ...extra },
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, transparent: false,
  });
  const capture = mat(CAPTURE);
  const plateMat = mat(PLATE, { uPrev: { value: null }, uRate: { value: 0.08 } });
  const materials = new Map(); // station id -> material

  let aspect = 0, W = 1, H = 1, scale = T.scale;

  function draw(material, target, x, y, w, h) {
    quad.material = material;
    if (target) {
      target.viewport.set(x, y, w, h); target.scissor.set(x, y, w, h); target.scissorTest = true;
      renderer.setRenderTarget(target);
    } else {
      renderer.setRenderTarget(null);
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
    }
    renderer.render(scene, camera);
  }

  const api = {
    canvas, tier: T, renderer,
    get scale() { return scale; },
    get historyFrames() { return count; },
    get maxFrames() { return N; },
    get fps() { return T.fps; },
    get historySeconds() { return N / T.fps; },
    settings: { feather: 0.12, cut: 0.5, plateRate: 0.08 },

    resize(w, h, s = scale) {
      W = w; H = h; scale = s;
      const gw = Math.max(2, Math.round(w * s)), gh = Math.max(2, Math.round(h * s));
      if (canvas.width !== gw || canvas.height !== gh) renderer.setSize(gw, gh, false);
    },

    // Once per frame, before any render(): new mask, record a history frame, learn the room.
    frame(ctx, dt) {
      const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
      const a = vw / vh;
      if (Math.abs(a - aspect) > 0.01) { aspect = a; makeHist(a); makePlates(a); }
      common.uAspect.value = a;
      common.uTime.value = ctx.time;
      common.uFeather.value = this.settings.feather;
      common.uCut.value = this.settings.cut;
      // mask: the segmenter's, or a body-shaped stand-in from the pose
      const seg = ctx.segment;
      if (seg?.ready && seg.mask?.width) {
        setMaskImage(seg.mask);
        if (seg.frame !== maskFrame) { maskFrame = seg.frame; maskTex.needsUpdate = true; }
      } else {
        const pw = 160, ph = Math.round(pw / a);
        if (poseMask.width !== pw || poseMask.height !== ph) { poseMask.width = pw; poseMask.height = ph; }
        pmg.setTransform(1, 0, 0, 1, 0, 0); pmg.clearRect(0, 0, pw, ph);
        const shapes = personShapes(ctx.pose, pw, ph);
        if (shapes.found) {
          pmg.filter = 'blur(2px)'; drawShapes(pmg, shapes, { mask: true }); pmg.filter = 'none';
          // shapes are a skeleton, a real kid is wider: grow it a little
          pmg.globalAlpha = 0.5; drawShapes(pmg, shapes, { mask: true }); pmg.globalAlpha = 1;
        }
        setMaskImage(poseMask);
        maskTex.needsUpdate = true;
      }
      common.uMask.value = maskTex;
      // history: one tile per captured frame at the tier's rate
      capAcc += dt;
      const fresh = ctx.camera.frameCount !== lastCap || !ctx.camera.hasFrameCallback;
      if (capAcc >= 1 / T.fps - 0.004 && fresh) {
        capAcc = Math.min(capAcc - 1 / T.fps, 1 / T.fps);
        lastCap = ctx.camera.frameCount;
        head = (head + 1) % N;
        count = Math.min(N, count + 1);
        const cx = head % T.cols, cy = Math.floor(head / T.cols);
        draw(capture, hist, cx * tileW, cy * tileH, tileW, tileH);
        if (count === 1) { // fill the whole ring with the first frame (no black ghosts at the start)
          for (let i = 1; i < N; i++) draw(capture, hist, (i % T.cols) * tileW, Math.floor(i / T.cols) * tileH, tileW, tileH);
          count = N;
        }
        // room plate
        const src = plates[plateIdx], dst = plates[1 - plateIdx];
        plateMat.uniforms.uPrev.value = src.texture;
        plateMat.uniforms.uRate.value = this.settings.plateRate;
        draw(plateMat, dst, 0, 0, dst.width, dst.height);
        plateIdx = 1 - plateIdx;
      }
      common.uHist.value = hist.texture;
      common.uHead.value = Math.max(0, head);
      common.uCount.value = count;
      common.uInset.value.set(0.5 / tileW + 0.002, 0.5 / tileH + 0.002);
      common.uPlate.value = plates[plateIdx].texture;
      renderer.setRenderTarget(null);
    },

    // Render one station's shader for a rect of the stage (css px). Returns the source rect in `canvas`
    // to drawImage right away (the next render reuses the same corner).
    render(def, uniforms, w, h) {
      let m = materials.get(def.id);
      if (!m) {
        const extra = {};
        // [x, y] / [x, y, z, w] -> Vector2..4; arrays of those -> arrays of vectors; longer number arrays stay float[]
        const vec = (a) => (a.length === 2 ? new THREE.Vector2(...a) : a.length === 3 ? new THREE.Vector3(...a) : new THREE.Vector4(...a));
        for (const [k, v] of Object.entries(def.uniforms?.() || {})) {
          if (Array.isArray(v) && Array.isArray(v[0])) extra[k] = { value: v.map(vec) };
          else if (Array.isArray(v) && v.length <= 4) extra[k] = { value: vec(v) };
          else extra[k] = { value: v };
        }
        m = mat(`${HEADER}\n${def.shader}`, extra);
        materials.set(def.id, m);
      }
      for (const [k, v] of Object.entries(uniforms || {})) {
        const u = m.uniforms[k];
        if (!u) continue;
        if (u.value?.set && Array.isArray(v)) u.value.set(...v);
        else if (Array.isArray(u.value) && Array.isArray(v)) v.forEach((x, i) => { if (u.value[i]?.set) u.value[i].set(...x); else u.value[i] = x; });
        else u.value = v;
      }
      const gw = Math.min(canvas.width, Math.max(2, Math.round(w * scale)));
      const gh = Math.min(canvas.height, Math.max(2, Math.round(h * scale)));
      // camera cover rect for this target
      const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
      const s = Math.max(gw / vw, gh / vh);
      common.uRes.value.set(gw, gh);
      common.uCover.value.set((gw - vw * s) / 2, (gh - vh * s) / 2, vw * s, vh * s);
      draw(m, null, 0, 0, gw, gh);
      return { sx: 0, sy: canvas.height - gh, sw: gw, sh: gh };
    },

    // Precompile one station (spreads the shader compile hitch over the hub's first second)
    warm(def) { if (!materials.has(def.id)) this.render(def, null, 4, 4); },

    destroy() {
      for (const m of materials.values()) m.dispose();
      capture.dispose(); plateMat.dispose();
      hist?.dispose(); plates?.forEach((p) => p.dispose());
      camTex.dispose(); maskTex?.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
  return api;
}
