// The 3D mountain (v2.0): three.js scene, the rolling ball, chunked course meshes in the theme's colors, flat
// decor (ponds, mud, ice, picnic blankets), every object built from its recipe (meshes.js), animals doing their
// idle acts, the finale landmark, small debris that flies OFF the path, and a higher chase camera. Rendered into an offscreen WebGL canvas that the
// game draws onto the 2D stage (so the core's HUD, fx and screen shake stay on top), like Smash Run.
//
// Space: downhill distance d (m from the top) runs along -z; the slope drops y as d grows.
//   world (x, d, h) -> three (x, groundY(d) + h, -d)

import * as THREE from 'three';
import { createMeshes } from './meshes.js';
import { CHUNK } from './mountain.js';

export const SLOPE = 0.14;                 // m down per m forward
export const groundY = (d) => -d * SLOPE;
export const BALL_R = 1.1;
export const RAMP_H = 1.3;

export function createWorld3D({ tier = 'high', sky: skyColor = '#86ccff', fog: fogColor = '#d4efff' } = {}) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(fogColor, 80, low ? 150 : 190);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 400);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#ffffff', '#6a8a50', 1.7));
  const sun = new THREE.DirectionalLight('#ffffff', 1.7);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  // ---------- meshes (shared with the passport's 3D viewer) ----------
  const MS = createMeshes(THREE);
  const { G, mat, makeObject } = MS;
  const textures = [];

  // ---------- the ball ----------
  const ballTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
    const g = cv.getContext('2d');
    g.fillStyle = '#ff5ea8'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#ffe14d'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 32);
    g.fillStyle = '#ffffff'; g.fillRect(0, 14, 64, 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; textures.push(t); return t;
  })();
  const ballMat = new THREE.MeshLambertMaterial({ map: ballTex, flatShading: true });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 2), ballMat);
  const ballSpin = new THREE.Group(); // rolls; the ball mesh sits inside so steering can lean it
  ballSpin.add(ball);
  scene.add(ballSpin);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.05, 16), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R * 1.25, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  scene.add(glow);

  // ---------- far mountains (a backdrop that follows the camera) ----------
  const backdrop = new THREE.Group();
  for (const [x, h, r, col] of [[0, 70, 60, '#9fb5d8'], [-110, 55, 50, '#a9bede'], [120, 60, 55, '#93abd2'], [-220, 45, 45, '#b3c6e2'], [230, 50, 48, '#a2b8da']]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshBasicMaterial({ color: col, fog: false }));
    p.position.set(x, h / 2 - 30, -300);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.35, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
    cap.position.y = h * 0.33; p.add(cap);
    backdrop.add(p);
  }
  scene.add(backdrop);

  // ---------- course chunks ----------
  const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const chunks = new Map();
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();

  function buildGround(ch, M) {
    const b = ch.colors;
    const pos = [], col = [];
    const quad = (a, bb, c, d, color) => {
      pos.push(...a, ...bb, ...c, ...a, ...c, ...d);
      for (let k = 0; k < 6; k++) col.push(color.r, color.g, color.b);
    };
    const STEP = 2;
    // strips across the course as [offset from the edge (outward = +), height]; mirrored to both sides
    const P = (d, side, out, h) => { const half = M.halfWidth(d); return [M.centerX(d) + side * (half + out), groundY(d) + h, -d]; };
    for (let d = ch.d0; d < ch.d1 - 1e-6; d += STEP) {
      const e = d + STEP;
      const stripe = Math.floor(d / 4) % 2;
      tmpC.set(b.road).multiplyScalar(stripe ? 1 : 0.93);
      // road (left half and right half meet in the middle)
      quad(P(d, -1, 0, 0), P(d, 1, 0, 0), P(e, 1, 0, 0), P(e, -1, 0, 0), tmpC);
      for (const side of [-1, 1]) {
        const o = (a, bb, c, dd, cc) => (side > 0 ? quad(a, bb, c, dd, cc) : quad(bb, a, dd, c, cc));
        // bumper bank (the edge that bounces you back)
        tmpC2.set(b.edge);
        o(P(d, side, 0, 0), P(d, side, 1.0, 0.9), P(e, side, 1.0, 0.9), P(e, side, 0, 0), tmpC2);
        tmpC2.set(b.edge).multiplyScalar(1.12);
        o(P(d, side, 1.0, 0.9), P(d, side, 2.2, 0.9), P(e, side, 2.2, 0.9), P(e, side, 1.0, 0.9), tmpC2);
        // the meadow beyond, rising into hills
        tmpC2.set(b.ground).multiplyScalar(stripe ? 1 : 0.96);
        o(P(d, side, 2.2, 0.9), P(d, side, 18, 3.5), P(e, side, 18, 3.5), P(e, side, 2.2, 0.9), tmpC2);
        tmpC2.set(b.ground).multiplyScalar(0.9);
        o(P(d, side, 18, 3.5), P(d, side, 60, 14), P(e, side, 60, 14), P(e, side, 18, 3.5), tmpC2);
      }
    }
    // rivers across the road
    for (const rv of ch.rivers) {
      tmpC.set('#4fb8ff');
      const a = rv.d - rv.w / 2, z = rv.d + rv.w / 2;
      const R = (d, side) => { const half = M.halfWidth(d) + 1.2; return [M.centerX(d) + side * half, groundY(d) + 0.05, -d]; };
      quad(R(a, -1), R(a, 1), R(z, 1), R(z, -1), tmpC);
      tmpC.set('#ffffff');
      const m = rv.d - 0.3, n = rv.d + 0.3;
      quad(R(m, -1).map((v, i) => (i === 1 ? v + 0.02 : v)), R(m, 1).map((v, i) => (i === 1 ? v + 0.02 : v)), R(n, 1).map((v, i) => (i === 1 ? v + 0.02 : v)), R(n, -1).map((v, i) => (i === 1 ? v + 0.02 : v)), tmpC);
    }
    // flat decor: ponds, mud, ice, picnic blankets (a fan of triangles just above the ground)
    for (const dc of ch.decor || []) {
      const disc = (r, color, lift, n = 12) => {
        tmpC.set(color);
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          const pt = (a) => [dc.x + Math.cos(a) * r, groundY(dc.d - Math.sin(a) * r) + lift, -(dc.d - Math.sin(a) * r)];
          pos.push(dc.x, groundY(dc.d) + lift, -dc.d, ...pt(a0), ...pt(a1));
          for (let q = 0; q < 3; q++) col.push(tmpC.r, tmpC.g, tmpC.b);
        }
      };
      if (dc.type === 'pond') { disc(dc.r + 0.5, '#e8d6a8', 0.03); disc(dc.r, '#4fb8ff', 0.05); disc(dc.r * 0.45, '#8fd6ff', 0.06, 8); }
      else if (dc.type === 'mud') disc(dc.r, '#8a5a3a', 0.04);
      else if (dc.type === 'ice') { disc(dc.r, '#bfe8ff', 0.04); disc(dc.r * 0.6, '#e6f8ff', 0.05, 8); }
      else if (dc.type === 'blanket') {
        for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) {
          tmpC.set((a + c) % 2 ? '#ffffff' : '#ff4d6d');
          const x0 = dc.x - dc.r + c * dc.r / 2, d0 = dc.d - dc.r + a * dc.r / 2, s2 = dc.r / 2;
          const q = (x, dd) => [x, groundY(dd) + 0.05, -dd];
          quad(q(x0, d0), q(x0 + s2, d0), q(x0 + s2, d0 + s2), q(x0, d0 + s2), tmpC);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, groundMat);
  }

  function addChunk(ch, M, { decor = true } = {}) {
    if (chunks.has(ch.index)) return chunks.get(ch.index);
    const group = new THREE.Group();
    const ground = buildGround(ch, M);
    group.add(ground);
    for (const rp of ch.ramps) {
      const x = M.centerX(rp.d) + rp.off;
      const wedge = new THREE.Group();
      const ramp = new THREE.Mesh(G.wedge, mat('#ffcc33', { side: THREE.DoubleSide }));
      ramp.scale.set(rp.w, RAMP_H, rp.len);
      wedge.add(ramp);
      for (let k = 0; k < 3; k++) { // arrows painted on the slope
        const st = new THREE.Mesh(G.box, mat('#ff5ea8'));
        const zz = rp.len * (0.3 - k * 0.3);
        st.scale.set(rp.w * 0.5, 0.06, 0.35); st.position.set(0, RAMP_H * (0.5 - zz / rp.len) + 0.03, zz); st.rotation.x = -Math.atan(RAMP_H / rp.len);
        wedge.add(st);
      }
      wedge.position.set(x, groundY(rp.d), -rp.d);
      wedge.rotation.x = -Math.atan(SLOPE);
      group.add(wedge);
    }
    // scenery on the hills (never interactive)
    if (decor) {
      const th = ch.theme, village = ch.pool === 'village';
      const n = low ? 3 : 6;
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1;
        const d = ch.d0 + (k + 0.5) * (CHUNK / n);
        const off = M.halfWidth(d) + 5 + ((k * 7919 + ch.index * 104729) % 9);
        const kind = th === 'snowy' ? (village && k % 2 ? 'igloo' : 'pine') : th === 'forest' ? (village && k % 2 ? 'cabin' : k % 3 ? 'pine' : 'tree') : village ? (k % 2 ? 'house' : 'tree') : (k % 3 ? 'tree' : k % 2 ? 'barn' : 'bush');
        const color = kind === 'house' || kind === 'barn' || kind === 'cabin' ? ['red', 'yellow', 'blue', 'white'][k % 4] : th === 'snowy' ? 'white' : 'green';
        const m = makeObject(`${kind}.${color}.plain.none.${k % 3 === 0 ? 'big' : 'normal'}`);
        const x = M.centerX(d) + side * off;
        m.position.set(x, groundY(d) + 1.2 + (off - M.halfWidth(d)) * 0.15, -d);
        m.rotation.y = side * 0.4;
        group.add(m);
      }
    }
    const objs = new Map();
    for (const o of ch.objects) {
      const m = makeObject(o.recipe);
      m.position.set(o.x, groundY(o.d), -o.d);
      m.rotation.y = o.kind === 'tough' ? o.rot * 0.12 : o.act === 'waddle' || o.act === 'slide' ? (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : o.rot * 0.6;
      m.userData.o = o;
      group.add(m);
      objs.set(o.id, m);
    }
    scene.add(group);
    const rec = { group, ground, objs };
    chunks.set(ch.index, rec);
    return rec;
  }
  function removeChunk(i) {
    const c = chunks.get(i);
    if (!c) return;
    scene.remove(c.group);
    c.ground.geometry.dispose();
    chunks.delete(i);
  }
  function objectMesh(o) { return chunks.get(Math.floor(o.d / CHUNK))?.objs.get(o.id) || null; }

  // ---------- debris (chunky cubes) ----------
  const DEBRIS = low ? 80 : 160;
  const debrisMesh = new THREE.InstancedMesh(G.box, new THREE.MeshLambertMaterial({ flatShading: true }), DEBRIS);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setColorAt(i, tmpC.set('#ffffff'));
  scene.add(debrisMesh);
  const parts = Array.from({ length: DEBRIS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2, rx: 0, ry: 0, spin: 0, floor: 0 }));
  let partNext = 0;
  const dummy = new THREE.Object3D();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setMatrixAt(i, hide);
  // v2.0: fewer, smaller, shorter-lived, and pushed AWAY from the path (side = -1 / +1) so it never covers the
  // way ahead; vz pushes it back toward the camera (it's behind the ball a moment later).
  function debris(x, y, z, { count = 12, colors = ['#ffffff'], speed = 6, size = 0.22, up = 4, vz = 0, side = 0, life = 0.55 } = {}) {
    count = Math.min(count, DEBRIS);
    for (let k = 0; k < count; k++) {
      const i = partNext; partNext = (partNext + 1) % DEBRIS;
      const p = parts[i];
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      const vx = side ? side * Math.abs(Math.cos(a)) * s * 1.3 : Math.cos(a) * s;
      Object.assign(p, { life: life * (0.7 + Math.random() * 0.6), x, y, z, vx, vy: up * (0.5 + Math.random()), vz: Math.abs(Math.sin(a)) * s * 0.6 + vz, s: size * (0.5 + Math.random()), rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 14, floor: y - 1.5 });
      debrisMesh.setColorAt(i, tmpC.set(colors[(Math.random() * colors.length) | 0]));
    }
    debrisMesh.instanceColor.needsUpdate = true;
  }
  function updateDebris(dt) {
    let any = false;
    for (let i = 0; i < DEBRIS; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.spin * dt; p.ry += p.spin * dt * 0.7;
      if (p.life <= 0) { debrisMesh.setMatrixAt(i, hide); continue; }
      const k = Math.min(1, p.life / 0.25);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0); dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    if (any) debrisMesh.instanceMatrix.needsUpdate = true;
  }

  // what each animal is DOING in its scene (sections.js `act`). Cheap: only the body group's transform.
  // waddle / slide also move the animal sideways (o.dx, read by the game for bonks) across the path and back.
  function actAnim(m, u, t) {
    const o = u.o, b = u.body, w = t + o.wob;
    b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    switch (o.act) {
      case 'drink': b.rotation.x = Math.max(0, Math.sin(w * 1.3)) * 0.55; break;
      case 'peck': b.rotation.x = Math.max(0, Math.sin(w * 7)) * 0.5; break;
      case 'graze': b.rotation.x = 0.25 + Math.sin(w * 0.9) * 0.15; b.position.y = Math.abs(Math.sin(w * 2)) * 0.03; break;
      case 'hop': b.position.y = Math.max(0, Math.sin(w * 5)) * 0.5; break;
      case 'dance': b.position.y = Math.abs(Math.sin(w * 6)) * 0.25; b.rotation.z = Math.sin(w * 6) * 0.25; break;
      case 'sit': b.rotation.z = Math.sin(w * 1.5) * 0.06; break;
      case 'wave': b.rotation.z = Math.sin(w * 2.5) * 0.18; break;
      case 'flop': b.rotation.x = Math.sin(w * 3) * 0.25; b.position.y = Math.max(0, Math.sin(w * 3)) * 0.15; break;
      case 'look': b.rotation.y = Math.sin(w * 0.8) * 1.2; break;
      case 'herd': { const a = w * 1.2; o.dx = Math.cos(a) * 1.5; o.dz = Math.sin(a) * 1.5; m.rotation.y = -a; b.position.y = Math.abs(Math.sin(w * 8)) * 0.12; break; }
      case 'waddle': case 'slide': {
        // cross the path and back (a slow ping-pong), turned the way they go
        const span = 6, sp = o.act === 'slide' ? 1.6 : 0.9, ph = ((w * sp) % (span * 2)) - span;
        const dir = (o.dir || 1) * (Math.floor((w * sp) / (span * 2)) % 2 ? -1 : 1);
        o.dx = Math.abs(ph) * Math.sign(dir) - span / 2 * Math.sign(dir);
        m.rotation.y = (dir * (ph >= 0 ? 1 : -1)) > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (o.act === 'slide') { b.rotation.x = 1.2; b.position.y = 0.3; } else { b.rotation.z = Math.sin(w * 9) * 0.12; b.position.y = Math.abs(Math.sin(w * 9)) * 0.06; }
        break;
      }
      default: b.position.y = Math.abs(Math.sin(w * 4)) * 0.15;
    }
    if (o.dx != null || o.dz != null) m.position.set(o.x + (o.dx || 0), groundY(o.d - (o.dz || 0)), -(o.d - (o.dz || 0)));
  }

  const v3 = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let camX = 0, camFov = 60, finaleBack = 0;

  return {
    camera, scene, G, chunks, meshes: MS, actAnim,
    addChunk, removeChunk, objectMesh, makeObject, debris,

    setSky(sky, fog) { scene.background.set(sky); scene.fog.color.set(fog); },
    // the finale: pull the camera back to see the whole landmark (0..1)
    setFinale(k) { finaleBack = k * 8; },
    adopt(mesh) { mesh.parent?.remove(mesh); scene.add(mesh); }, // parade members leave their chunk
    makeLandmark(kind, x, d) {
      const g = MS.makeLandmark(kind);
      g.position.set(x, groundY(d), -d);
      scene.add(g);
      return g;
    },
    removeObject(mesh) { mesh.parent?.remove(mesh); },

    // ball at world (x, d, h = height of the ball's bottom above the ground). roll = radians rolled.
    setBall({ x, d, h, roll, lean = 0, scale = 1, rainbow = 0, charged = false, charge = 0, t = 0 }) {
      const y = groundY(d) + h + BALL_R * scale;
      ballSpin.position.set(x, y, -d);
      ballSpin.scale.setScalar(scale);
      ball.rotation.set(-roll, 0, 0);
      ballSpin.rotation.set(0, 0, -lean * 0.25);
      shadow.position.set(x, groundY(d) + 0.04, -d);
      shadow.scale.setScalar(scale * Math.max(0.4, 1 - h * 0.08));
      shadow.material.opacity = Math.max(0.08, 0.28 - h * 0.03);
      if (rainbow > 0) {
        const c = tmpC.setHSL((t * 0.9) % 1, 1, 0.6);
        ballMat.emissive.copy(c).multiplyScalar(0.55);
        glow.material.color.copy(c); glow.material.opacity = 0.28 + Math.sin(t * 12) * 0.08;
      } else if (charged) { // WRECKING ROLL ready: a hot orange pulse
        ballMat.emissive.set('#ff6a00').multiplyScalar(0.35 + Math.sin(t * 10) * 0.15);
        glow.material.color.set('#ff8a3d'); glow.material.opacity = 0.3 + Math.sin(t * 10) * 0.1;
      } else { ballMat.emissive.set('#ff6a00').multiplyScalar(charge * 0.25); glow.material.opacity = 0; }
      glow.position.copy(ballSpin.position); glow.scale.setScalar(scale);
    },

    // chase camera behind and above the ball, looking downhill. tuck = 0..1 (FOV stretch), lag-smoothed x.
    setCamera({ x, d, h, dt, tuck = 0, shake = 0, aspect = 16 / 9, photo = false }) {
      if (photo) {
        // the group photo: close and low, everyone in the frame, the rubble behind them
        camX = x;
        camera.position.set(x, groundY(d - 9) + 3.4, -(d - 9));
        camLook.set(x, groundY(d + 2) + 1.6, -(d + 2));
        camera.lookAt(camLook);
        const f = aspect < 1 ? 78 : 56;
        if (Math.abs(camera.fov - f) > 0.01) { camera.fov = camFov = f; camera.updateProjectionMatrix(); }
        backdrop.position.set(camera.position.x * 0.9, camera.position.y, camera.position.z);
        return;
      }
      camX += (x - camX) * Math.min(1, dt * 4);
      // v2.0: higher and tilted further down, so the path ahead is always clearly visible
      const back = 10 + tuck * 2.5 + finaleBack, up = 8.2 + h * 0.4 + finaleBack * 0.4;
      camera.position.set(camX + (x - camX) * 0.3, groundY(d - back) + up, -(d - back));
      camLook.set(x * 0.7 + camX * 0.3, groundY(d + 11) - 0.5 + finaleBack * 0.3, -(d + 11 + finaleBack));
      camera.lookAt(camLook);
      if (shake) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
      const base = aspect < 1 ? 80 : 60;
      camFov += (base + tuck * 16 - camFov) * Math.min(1, dt * 5);
      if (Math.abs(camera.fov - camFov) > 0.01) { camera.fov = camFov; camera.updateProjectionMatrix(); }
      backdrop.position.set(camera.position.x * 0.9, camera.position.y, camera.position.z);
    },

    // idle animations (windmills spin, sparkles twirl, critters bob) for objects in view
    animate(t, dt, fromD, toD) {
      for (const [i, c] of chunks) {
        if ((i + 1) * CHUNK < fromD || i * CHUNK > toD) continue;
        for (const m of c.objs.values()) {
          const u = m.userData;
          if (u.spin) u.spin.rotation.z += dt * 1.6;
          if (u.sparkle) { u.sparkle.rotation.y += dt * 3; u.sparkle.position.y += Math.sin(t * 3 + u.o.wob) * dt * 0.3; }
          if (u.o.kind === 'critter' && !u.hit) actAnim(m, u, t);
          if (u.float && !u.hit) u.body.position.y = Math.sin(t * 1.2 + u.o.wob) * 0.25;
        }
      }
      updateDebris(dt);
    },

    toScreen(x, y, z, W, H) {
      v3.set(x, y, z).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, behind: v3.z > 1 };
    },
    ballScreen(W, H) {
      const p = ballSpin.position;
      const c = this.toScreen(p.x, p.y, p.z, W, H);
      const top = this.toScreen(p.x, p.y + BALL_R * ballSpin.scale.x, p.z, W, H);
      return { x: c.x, y: c.y, r: Math.abs(c.y - top.y) };
    },

    render(W, H, dpr) {
      const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      return canvas;
    },

    dispose() {
      for (const i of [...chunks.keys()]) removeChunk(i);
      for (const t of textures) t.dispose();
      MS.dispose();
      groundMat.dispose(); ballMat.dispose(); ball.geometry.dispose(); shadow.geometry.dispose(); shadow.material.dispose();
      glow.geometry.dispose(); glow.material.dispose();
      debrisMesh.geometry.dispose?.(); debrisMesh.material.dispose();
      backdrop.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
