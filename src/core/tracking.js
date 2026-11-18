// ML body tracking via MediaPipe (face, hands, pose). Loaded lazily: a game that
// doesn't list 'face' / 'hands' / 'pose' in `needs` never downloads any of it.
// Runs at perf.settings.trackFps (30 high / 20 medium / 12 low).
//
// All points are in mirrored norm space (see view.js). Use view.toScreen().
//
//   tracking.face  -> { found, points[478], center, leftEye, rightEye, roll, size,
//                       mouthOpen 0..1, smile 0..1, blinkLeft 0..1, blinkRight 0..1, blend{} }
//   tracking.hands -> [{ points[21], tip (index fingertip), palm, handedness }]
//   tracking.pose  -> { found, points[33], nose, leftWrist, rightWrist, leftAnkle, rightAnkle, ... }

import { camera } from './camera.js';
import { perf } from './perf.js';

const WASM = new URL('mediapipe/wasm', document.baseURI).href; // self-hosted (scripts/copy-mediapipe.js)
const MODELS = {
  face:  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  hands: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  pose:  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

let visionPromise = null;
const tasks = {}; // name -> { runner, last, lastTs }
const loading = {};

// Shared with segment.js (the person cutout), so every MediaPipe task loads the WASM runtime once.
export function vision() {
  if (!visionPromise) {
    visionPromise = import('@mediapipe/tasks-vision').then(async (mp) => ({
      mp,
      fileset: await mp.FilesetResolver.forVisionTasks(WASM),
    }));
  }
  return visionPromise;
}

export async function create(Cls, fileset, modelAssetPath, opts) {
  for (const delegate of ['GPU', 'CPU']) {
    try {
      return await Cls.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        ...opts,
      });
    } catch (e) {
      if (delegate === 'CPU') throw e;
      console.warn(`[tracking] GPU failed, falling back to CPU`, e);
    }
  }
}

const mirror = (p) => ({ x: 1 - p.x, y: p.y, z: p.z ?? 0, v: p.visibility ?? 1 }); // v = visibility (pose)

const emptyFace = () => ({ found: false, points: [], center: { x: 0.5, y: 0.5 }, leftEye: null, rightEye: null,
  roll: 0, size: 0, mouthOpen: 0, smile: 0, blinkLeft: 0, blinkRight: 0, blend: {} });
const emptyPose = () => ({ found: false, points: [] });

const POSE_NAMES = { nose: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28 };

export const tracking = {
  face: emptyFace(),
  hands: [],
  pose: emptyPose(),

  // Load the models a game needs. Resolves when they're ready to run.
  load(names) {
    return Promise.all(names.filter((n) => MODELS[n]).map((name) => {
      if (tasks[name]) return tasks[name];
      if (!loading[name]) {
        loading[name] = vision().then(async ({ mp, fileset }) => {
          let runner;
          if (name === 'face') runner = await create(mp.FaceLandmarker, fileset, MODELS.face,
            { numFaces: 1, outputFaceBlendshapes: true });
          if (name === 'hands') runner = await create(mp.HandLandmarker, fileset, MODELS.hands, { numHands: 2 });
          if (name === 'pose') runner = await create(mp.PoseLandmarker, fileset, MODELS.pose, { numPoses: 1 });
          tasks[name] = { runner, last: 0, lastTs: 0 };
          return tasks[name];
        }).catch((e) => { delete loading[name]; throw e; });
      }
      return loading[name];
    }));
  },

  reset() {
    this.face = emptyFace();
    this.hands = [];
    this.pose = emptyPose();
  },

  // Called each frame by the runtime with the list of active needs.
  update(needs, now) {
    if (!camera.ready || camera.video.readyState < 2) return;
    const interval = 1000 / perf.settings.trackFps;
    for (const name of needs) {
      const t = tasks[name];
      if (!t || now - t.last < interval) continue;
      t.last = now;
      const ts = Math.max(now, t.lastTs + 1); // timestamps must strictly increase
      t.lastTs = ts;
      try {
        const res = t.runner.detectForVideo(camera.video, ts);
        if (name === 'face') this.face = readFace(res);
        if (name === 'hands') this.hands = readHands(res);
        if (name === 'pose') this.pose = readPose(res);
      } catch (e) {
        console.warn(`[tracking] ${name} failed`, e);
      }
    }
  },
};

function readFace(res) {
  const raw = res.faceLandmarks?.[0];
  if (!raw) return { ...emptyFace() };
  const points = raw.map(mirror);
  // After mirroring, landmark 33 (subject's right eye) is on the screen's right.
  const rightEye = points[33], leftEye = points[263];
  const blend = {};
  for (const c of res.faceBlendshapes?.[0]?.categories || []) blend[c.categoryName] = c.score;
  const dx = rightEye.x - leftEye.x, dy = rightEye.y - leftEye.y;
  return {
    found: true,
    points,
    center: points[1], // nose tip
    leftEye,
    rightEye,
    roll: Math.atan2(dy, dx),           // radians, tilt of the head
    size: Math.hypot(dx, dy),           // eye distance in norm units
    mouthOpen: Math.min(1, (blend.jawOpen || 0) * 1.6),
    smile: ((blend.mouthSmileLeft || 0) + (blend.mouthSmileRight || 0)) / 2,
    blinkLeft: blend.eyeBlinkLeft || 0,
    blinkRight: blend.eyeBlinkRight || 0,
    blend,
  };
}

function readHands(res) {
  return (res.landmarks || []).map((raw, i) => {
    const points = raw.map(mirror);
    return { points, tip: points[8], palm: points[9], handedness: res.handedness?.[i]?.[0]?.categoryName };
  });
}

function readPose(res) {
  const raw = res.landmarks?.[0];
  if (!raw) return emptyPose();
  const points = raw.map(mirror);
  const out = { found: true, points };
  for (const [k, i] of Object.entries(POSE_NAMES)) out[k] = points[i];
  return out;
}
