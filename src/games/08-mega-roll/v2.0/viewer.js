// The 3D sticker viewer (v2.0 passport): tap a sticker and the real low-poly thing spins on a little stage.
// Drag to turn it (it keeps spinning slowly on its own). On phones, tilting turns it: iPhone needs a one-time
// "📱 Tilt" tap first (DeviceOrientationEvent.requestPermission must come from a tap).
// Its own small WebGL renderer, created on first open and disposed when the game ends.

import * as THREE from 'three';
import { createMeshes } from './meshes.js';

const STYLE = `
.mr-viewer { position: fixed; inset: 0; z-index: 7; background: rgba(10,6,30,.92); display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: ui-rounded, system-ui, sans-serif; color: #fff; touch-action: none; }
.mr-viewer[hidden] { display: none; }
.mr-viewer canvas { width: min(90vw, 70vh); height: min(90vw, 70vh); border-radius: 28px; background: radial-gradient(circle at 50% 40%, #6fc3ff, #2a4a9a); cursor: grab; }
.mr-viewer .name { font-size: clamp(20px, 4.5vmin, 38px); font-weight: 900; margin: 12px; text-align: center; padding: 0 12px; }
.mr-viewer .btns { display: flex; gap: 10px; }
.mr-viewer button { font: inherit; font-weight: 900; font-size: clamp(18px, 3.4vmin, 26px); color: #fff; background: rgba(255,255,255,.18);
  border: 3px solid rgba(255,255,255,.4); border-radius: 18px; padding: 10px 18px; cursor: pointer; }
.mr-viewer .x { position: absolute; top: max(14px, env(safe-area-inset-top)); right: 14px; width: 64px; height: 64px; border-radius: 50%; padding: 0; font-size: 30px; }
`;

export function createViewer({ onOpen } = {}) {
  let root, renderer, scene, camera, meshes, current, raf = 0, rotY = 0, rotX = 0.15, spin = 0.6, drag = null, tilt = null, style;

  function build() {
    style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
    root = document.createElement('div'); root.className = 'mr-viewer'; root.hidden = true;
    root.innerHTML = `<button class="x" aria-label="Close">✕</button><canvas></canvas><div class="name"></div><div class="btns"></div>`;
    document.body.append(root);
    for (const ev of ['keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation());
    root.querySelector('.x').onclick = close;
    const canvas = root.querySelector('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#ffffff', '#6a8a50', 1.8));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-3, 6, 5); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.15, 24), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    floor.position.y = -0.08; scene.add(floor);
    meshes = createMeshes(THREE);
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ry: rotY, rx: rotX }; canvas.setPointerCapture(e.pointerId); spin = 0; });
    canvas.addEventListener('pointermove', (e) => { if (!drag) return; rotY = drag.ry + (e.clientX - drag.x) * 0.012; rotX = Math.max(-0.4, Math.min(0.9, drag.rx + (e.clientY - drag.y) * 0.008)); });
    const up = () => { if (drag) { drag = null; spin = 0.6; } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    // tilt to turn (phones). iPhone: permission from a tap.
    const btns = root.querySelector('.btns');
    if (typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches) {
      const b = document.createElement('button'); b.textContent = '📱 Tilt to turn';
      b.onclick = async () => {
        try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') { b.textContent = '📱 Tilt: not allowed'; return; } } catch { return; }
        addEventListener('deviceorientation', onTilt);
        b.textContent = '📱 Tilt: ON'; b.disabled = true;
      };
      btns.append(b);
    }
  }
  function onTilt(e) { if (e.gamma == null) return; tilt = { y: (e.gamma / 45) * 1.4, x: ((e.beta - 40) / 60) * 0.6 }; }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!current) return;
    const c = renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * Math.min(2, devicePixelRatio))) { renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    rotY += spin / 60;
    const ty = tilt ? rotY + tilt.y : rotY, tx = tilt ? rotX + tilt.x : rotX;
    current.rotation.set(tx * 0.5, ty, 0);
    renderer.render(scene, camera);
  }

  function open(id, name) {
    if (!root) build();
    if (current) { scene.remove(current); current = null; }
    const m = meshes.makeObject(id);
    // frame it: size the camera to the thing's height
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const h = Math.max(size.y, size.x, size.z * 0.8, 0.5);
    m.position.y = -box.min.y;
    scene.add(m); current = m;
    camera.position.set(0, h * 0.75, h * 2.4 + 1.2); camera.lookAt(0, h * 0.45, 0);
    root.querySelector('.name').textContent = name;
    rotY = 0.6; spin = 0.6; root.hidden = false;
    cancelAnimationFrame(raf); frame();
    onOpen?.(id);
  }
  function close() { if (!root) return; root.hidden = true; cancelAnimationFrame(raf); }
  return {
    open, close,
    get isOpen() { return !!root && !root.hidden; },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('deviceorientation', onTilt);
      if (!root) return;
      meshes.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
      root.remove(); style.remove(); root = null;
    },
  };
}
