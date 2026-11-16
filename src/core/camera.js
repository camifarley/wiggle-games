// The ONLY place that touches getUserMedia. The iOS Safari rules are baked in here:
//  1. <video> has: autoplay playsinline webkit-playsinline muted disablePictureInPicture (see index.html)
//  2. Never call play() right after getUserMedia: wait for onloadeddata, THEN play().
//  3. The loop calls camera.keepAlive() every frame to undo iOS auto-pauses.
// The stream is acquired ONCE per session and kept alive across games (no re-prompts).
// The only exception: the parent picks another camera (camera.use), which swaps the stream
// from a tap and follows the same rules. The choice is remembered on this device.
//
// ?fakecam uses a generated test stream (moving red ball) so you can test without a camera.
// ?fakecam=person draws a cartoon kid driven by the pretend body instead (fakeperson.js), with an exact
// person mask (camera.fake.mask) that segment.js uses.

import { perf } from './perf.js';
import { createFakePersonCam } from './fakeperson.js';

const video = document.getElementById('cam');
const fakeParam = new URLSearchParams(location.search).get('fakecam');
const fake = fakeParam != null;
const STORE_KEY = 'wiggle.camera';
let starting = null;

function fakeStream() {
  if (fakeParam === 'person') {
    camera.fake = createFakePersonCam();
    return camera.fake.stream;
  }
  const c = document.createElement('canvas');
  c.width = 640; c.height = 480;
  const g = c.getContext('2d');
  const draw = (t) => {
    g.fillStyle = '#556'; g.fillRect(0, 0, 640, 480);
    const x = 320 + Math.sin(t / 350) * 220, y = 240 + Math.cos(t / 470) * 150; // a fast "waving hand"
    g.fillStyle = '#e22'; g.beginPath(); g.arc(x, y, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '24px sans-serif'; g.fillText('FAKE CAMERA', 20, 40);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return c.captureStream(30);
}

function saved(id) {
  try {
    if (id === undefined) return localStorage.getItem(STORE_KEY);
    localStorage.setItem(STORE_KEY, id);
  } catch { /* private mode */ }
  return null;
}

async function open(deviceId) {
  if (fake) return fakeStream();
  const s = perf.settings;
  const video = {
    width: { ideal: s.camWidth },
    height: { ideal: s.camHeight },
    frameRate: { ideal: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video });
  } catch (e) {
    if (!deviceId) throw e;
    // saved camera unplugged or renamed: fall back to the default front camera
    console.warn('[camera] saved camera unavailable, using default', e);
    return open(null);
  }
}

// Attach a stream and start playing it, following the iOS rules.
async function attach(stream) {
  const loaded = new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
  video.srcObject = stream;
  await loaded; // Rule 2: frames are flowing
  await video.play().catch(() => {});
}

export const camera = {
  video,
  ready: false,
  frameCount: 0,          // increments once per NEW camera frame
  hasFrameCallback: false,
  deviceId: null,         // the camera in use (null = default / fake)
  switching: false,
  fake: null,             // ?fakecam=person: { canvas, mask (mirrored person mask), frame, shapes } (fakeperson.js)
  fakeMode: fake ? (fakeParam || 'ball') : null,

  start() {
    if (starting) return starting;
    starting = (async () => {
      const stream = await open(saved());
      await attach(stream);
      this.deviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || null;
      this.ready = true;
      // Count real camera frames (screen may run at 60-120Hz, camera at ~30).
      if ('requestVideoFrameCallback' in video) {
        const onFrame = () => { this.frameCount++; video.requestVideoFrameCallback(onFrame); };
        video.requestVideoFrameCallback(onFrame);
        this.hasFrameCallback = true;
      }
    })();
    starting.catch(() => { starting = null; });
    return starting;
  },

  // All cameras on this device: [{ deviceId, label }]. Labels appear once permission is granted.
  async list() {
    if (fake || !navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  },

  // Switch to another camera. Call from a tap. Remembered for next time.
  async use(deviceId) {
    if (fake || this.switching || deviceId === this.deviceId) return;
    this.switching = true;
    try {
      // stop first: phones often can't run two cameras at once
      video.srcObject?.getTracks?.().forEach((t) => t.stop());
      const stream = await open(deviceId);
      await attach(stream);
      this.deviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || deviceId;
      saved(this.deviceId);
    } finally {
      this.switching = false;
    }
  },

  // Rule 3: call every frame.
  keepAlive() {
    if (!this.switching && video.paused && video.readyState >= 2) video.play().catch(() => {});
  },

  get width() { return video.videoWidth || 640; },
  get height() { return video.videoHeight || 480; },
};
