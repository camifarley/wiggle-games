// The ONLY place that touches getUserMedia. The iOS Safari rules are baked in here:
//  1. <video> has: autoplay playsinline webkit-playsinline muted disablePictureInPicture (see index.html)
//  2. Never call play() right after getUserMedia: wait for onloadeddata, THEN play().
//  3. The loop calls camera.keepAlive() every frame to undo iOS auto-pauses.
// The stream is acquired ONCE per session and kept alive across games (no re-prompts).
//
// ?fakecam uses a generated test stream (moving red ball) so you can test without a camera.

import { perf } from './perf.js';

const video = document.getElementById('cam');
let starting = null;

function fakeStream() {
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

export const camera = {
  video,
  ready: false,
  frameCount: 0,          // increments once per NEW camera frame
  hasFrameCallback: false,

  start() {
    if (starting) return starting;
    starting = (async () => {
      const s = perf.settings;
      const stream = new URLSearchParams(location.search).has('fakecam')
        ? fakeStream()
        : await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: 'user',
              width: { ideal: s.camWidth },
              height: { ideal: s.camHeight },
              frameRate: { ideal: 30 },
            },
          });
      video.srcObject = stream;
      // Rule 2: wait until frames are actually flowing before play().
      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = () => resolve();
      });
      await video.play().catch(() => {});
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

  // Rule 3: call every frame.
  keepAlive() {
    if (video.paused && video.readyState >= 2) video.play().catch(() => {});
  },

  get width() { return video.videoWidth || 640; },
  get height() { return video.videoHeight || 480; },
};
