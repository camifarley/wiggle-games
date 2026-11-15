// The sky above the clouds: three.js scene rendered into an offscreen WebGL canvas that the game draws onto
// the 2D stage (like Smash Run / Mega Roll), so the credits, stars, basket and core fx stay crisp on top.
//
// The camera (the balloon) stays near z = 0 and looks toward -z, where the sun sets. The world flows toward it:
// cloud puffs move +z and wrap around to the far end. `dusk` 0..1 slowly turns sunset into a starry evening.

import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;
const SUNSET = { top: '#3a3f8f', mid: '#e7739a', low: '#ffb86b', fog: '#f7b38c', sun: '#fff0b0', light: '#ffd6a0', cloud: '#fff4ee' };
const DUSK = { top: '#141a4a', mid: '#5a3c8c', low: '#d9809a', fog: '#8a6a9e', sun: '#ffc9a0', light: '#c8b0ff', cloud: '#e9defa' };
const FAR = 220;

export function createWorld3D({ tier = 'high' } = {}) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 600);
  scene.add(camera);
  scene.fog = new THREE.Fog(SUNSET.fog, 60, FAR);

  const hemi = new THREE.HemisphereLight('#fff4f8', '#f0a8c8', 2.3);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(SUNSET.light, 1.8);
  sunLight.position.set(0, 6, -20); // from the sunset ahead: clouds glow warm on the sun side
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight('#ffd0e0', 0.9); // soft pink light from behind us, so the near sides aren't grey
  fill.position.set(-10, 14, 30);
  scene.add(fill);

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ---------- sky dome: a vertical gradient (vertex colors) ----------
  const skyGeo = keep(new THREE.SphereGeometry(500, 24, 16));
  const skyCols = new Float32Array(skyGeo.attributes.position.count * 3);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
  const sky = new THREE.Mesh(skyGeo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  scene.add(sky);
  const cTop = new THREE.Color(), cMid = new THREE.Color(), cLow = new THREE.Color(), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  function paintSky(k) {
    cTop.set(SUNSET.top).lerp(tmp.set(DUSK.top), k);
    cMid.set(SUNSET.mid).lerp(tmp.set(DUSK.mid), k);
    cLow.set(SUNSET.low).lerp(tmp.set(DUSK.low), k);
    const pos = skyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 500; // -1..1
      const c = h > 0.18 ? tmp2.copy(cMid).lerp(cTop, Math.min(1, (h - 0.18) / 0.55))
        : h > -0.02 ? tmp2.copy(cLow).lerp(cMid, (h + 0.02) / 0.2) : tmp2.copy(cLow);
      skyCols[i * 3] = c.r; skyCols[i * 3 + 1] = c.g; skyCols[i * 3 + 2] = c.b;
    }
    skyGeo.attributes.color.needsUpdate = true;
  }

  // ---------- sun: a glowing disc low on the horizon ahead ----------
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sunMat = keep(new THREE.SpriteMaterial({ map: glowTex, color: SUNSET.sun, fog: false, depthWrite: false, transparent: true }));
  const sun = new THREE.Sprite(sunMat);
  sun.scale.set(150, 150, 1);
  sun.position.set(0, 8, -420);
  scene.add(sun);
  const sunCore = new THREE.Mesh(keep(new THREE.CircleGeometry(16, 32)), keep(new THREE.MeshBasicMaterial({ color: '#fff6d0', fog: false })));
  sunCore.position.set(0, 8, -419);
  scene.add(sunCore);

  // ---------- the cloud sea: instanced low-poly puffs below and around us ----------
  const puffGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  const cloudMat = keep(new THREE.MeshLambertMaterial({ color: SUNSET.cloud, flatShading: true, emissive: '#4a2a40' }));
  const N = low ? 110 : tier === 'medium' ? 200 : 300;
  const sea = new THREE.InstancedMesh(puffGeo, cloudMat, N);
  scene.add(sea);
  const puffs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function placePuff(p, zFar) {
    p.x = rnd(-160, 160);
    p.z = zFar ? rnd(-FAR - 40, -FAR + 10) : rnd(-FAR, 20);
    const high = Math.random() < 0.12; // a few tall puffs poke up near eye level
    p.y = high ? rnd(-12, -6) : rnd(-21, -13);
    p.s = high ? rnd(4, 8) : rnd(6, 15);
    p.sy = p.s * rnd(0.45, 0.7);
    p.r = rnd(0, Math.PI);
  }
  for (let i = 0; i < N; i++) { const p = {}; placePuff(p, false); puffs.push(p); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  // ---------- discoveries (little surprises between the credits) ----------
  const mat = (color, o = {}) => keep(new THREE.MeshLambertMaterial({ color, flatShading: true, ...o }));
  const props = new THREE.Group(); scene.add(props);

  // rainbow: 7 half-rings far away to one side
  const rainbow = new THREE.Group();
  ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa', '#e599f7'].forEach((c, i) => {
    const m = new THREE.Mesh(keep(new THREE.TorusGeometry(60 - i * 3.2, 1.6, 6, 40, Math.PI)),
      keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.0, fog: false, depthWrite: false })));
    rainbow.add(m);
  });
  rainbow.position.set(-70, -14, -260); rainbow.visible = false; props.add(rainbow);

  // balloon friends: a few small hot-air balloons (envelope + basket)
  function makeBalloon(colA, colB) {
    const b = new THREE.Group();
    const env = new THREE.Mesh(keep(new THREE.SphereGeometry(3, 12, 10)), mat(colA));
    env.scale.set(1, 1.15, 1); env.position.y = 4;
    const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(3.05, 3.05, 1.1, 12)), mat(colB));
    band.position.y = 4;
    const neck = new THREE.Mesh(keep(new THREE.ConeGeometry(1.6, 2.2, 10)), mat(colA));
    neck.rotation.x = Math.PI; neck.position.y = 0.9;
    const basket = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 1, 1.4)), mat('#9c6b3e'));
    basket.position.y = -1.1;
    b.add(env, band, neck, basket);
    return b;
  }
  const friends = [makeBalloon('#ff7eb6', '#ffe066'), makeBalloon('#74c0fc', '#ffffff'), makeBalloon('#8ce99a', '#ff922b')];
  for (const f of friends) { f.visible = false; props.add(f); }

  // paper airplane: a folded white triangle
  const plane = (() => {
    const g = new THREE.BufferGeometry();
    const P = [0, 0, -2, -1.4, 0, 1.2, 0, -0.35, 0.9, 0, 0, -2, 0, -0.35, 0.9, 1.4, 0, 1.2];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    return new THREE.Mesh(keep(g), mat('#ffffff', { side: THREE.DoubleSide }));
  })();
  plane.visible = false; props.add(plane);

  // the moon (its sleepy face is drawn in 2D on top, at its screen position)
  const moon = new THREE.Mesh(keep(new THREE.SphereGeometry(9, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false })));
  moon.position.set(95, 70, -330); moon.visible = false; props.add(moon);

  // a friendly cloud (its face is 2D): a cluster of puffs
  const friendCloud = new THREE.Group();
  for (const [x, y, s] of [[0, 0, 5], [-5, -1, 3.8], [5, -1, 4], [-2.5, 2.5, 3.6], [2.8, 2.2, 3.4]]) {
    const m = new THREE.Mesh(puffGeo, cloudMat); m.position.set(x, y, 0); m.scale.set(s, s * 0.85, s); friendCloud.add(m);
  }
  friendCloud.visible = false; props.add(friendCloud);

  // ---------- helpers ----------
  const proj = new THREE.Vector3();
  let dusk = -1;

  return {
    canvas, camera, rainbow, friends, plane, moon, friendCloud,

    setDusk(k) {
      k = Math.max(0, Math.min(1, k));
      if (Math.abs(k - dusk) < 0.01) return;
      dusk = k;
      paintSky(k);
      scene.fog.color.set(SUNSET.fog).lerp(tmp.set(DUSK.fog), k);
      sunMat.color.set(SUNSET.sun).lerp(tmp.set(DUSK.sun), k);
      sun.position.y = lerp(8, -4, k); sunCore.position.y = sun.position.y;
      sunCore.material.color.set('#fff6d0').lerp(tmp.set('#ffb08a'), k);
      sunLight.color.set(SUNSET.light).lerp(tmp.set(DUSK.light), k);
      sunLight.intensity = lerp(1.8, 1.0, k);
      hemi.intensity = lerp(2.3, 1.5, k);
      cloudMat.color.set(SUNSET.cloud).lerp(tmp.set(DUSK.cloud), k);
    },

    // flow: metres the world moved toward us this frame
    animate(dt, flow, t) {
      for (let i = 0; i < N; i++) {
        const p = puffs[i];
        p.z += flow;
        if (p.z > 30) placePuff(p, true);
        v.set(p.x, p.y + Math.sin(t * 0.3 + i) * 0.3, p.z);
        q.setFromAxisAngle(up, p.r + t * 0.01);
        sc.set(p.s, p.sy, p.s);
        sea.setMatrixAt(i, m4.compose(v, q, sc));
      }
      sea.instanceMatrix.needsUpdate = true;
    },

    setCamera({ x, y, roll, yaw, aspect }) {
      camera.aspect = aspect;
      // portrait screens: widen the view so the scene still feels like a big sky
      camera.fov = aspect < 1 ? 74 : 60;
      camera.updateProjectionMatrix();
      camera.position.set(x, y, 0);
      camera.rotation.set(-0.04, yaw, roll);
    },

    // world -> screen px ({x, y, z: depth in front of the camera, on: in front})
    toScreen(x, y, z, W, H) {
      proj.set(x, y, z);
      const depth = proj.clone().applyMatrix4(camera.matrixWorldInverse).z * -1;
      proj.project(camera);
      return { x: (proj.x * 0.5 + 0.5) * W, y: (-proj.y * 0.5 + 0.5) * H, depth, on: depth > 0.5 };
    },

    render(W, H, dpr) {
      const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
      renderer.render(scene, camera);
      return canvas;
    },

    dispose() {
      sea.dispose();
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
