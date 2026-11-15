// The 3D mountain: three.js scene, the rolling ball, chunked course meshes, every object built from its
// recipe (recipes.js), debris cubes, and the chase camera. Rendered into an offscreen WebGL canvas that the
// game draws onto the 2D stage (so the core's HUD, fx and screen shake stay on top), like Smash Run.
//
// Space: downhill distance d (m from the top) runs along -z; the slope drops y as d grows.
//   world (x, d, h) -> three (x, groundY(d) + h, -d)

import * as THREE from 'three';
import { COLOR, SIZE, parseId, rarity } from './recipes.js';
import { BIOMES, CHUNK } from './mountain.js';

export const SLOPE = 0.14;                 // m down per m forward
export const groundY = (d) => -d * SLOPE;
export const BALL_R = 1.1;
export const RAMP_H = 1.3;

export function createWorld3D({ tier = 'high', snowy = false } = {}) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const sky = snowy ? '#a8d8ff' : '#86ccff';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(snowy ? '#e6f4ff' : '#d4efff', 70, low ? 140 : 175);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 400);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#ffffff', '#6a8a50', 1.7));
  const sun = new THREE.DirectionalLight('#ffffff', 1.7);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  // ---------- shared geometry + cached materials ----------
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sph: new THREE.SphereGeometry(1, 9, 6),
    ico: new THREE.IcosahedronGeometry(1, 0),
    ico1: new THREE.IcosahedronGeometry(1, 1),
    cone: new THREE.ConeGeometry(1, 1, 7),
    pyr: new THREE.ConeGeometry(1, 1, 4),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    oct: new THREE.OctahedronGeometry(1, 0),
    half: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    // a ramp wedge: 1 x 1 x 1, rising toward the downhill end (-z)
    wedge: (() => {
      const A = [-0.5, 0, 0.5], Bq = [0.5, 0, 0.5], C = [0.5, 0, -0.5], D = [-0.5, 0, -0.5], E = [-0.5, 1, -0.5], F = [0.5, 1, -0.5];
      const tri = [A, Bq, F, A, F, E, D, E, F, D, F, C, A, E, D, Bq, C, F, A, D, C, A, C, Bq].flat();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); return g;
    })(),
    prism: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateZ(Math.PI / 2); return g; })(),
  };
  const mats = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
    return mats.get(key);
  };
  // the main (sticker) color with its pattern painted on a tiny texture
  const textures = [];
  function patternMat(colorKey, patternKey) {
    const key = `pat:${colorKey}:${patternKey}`;
    if (mats.has(key)) return mats.get(key);
    const col = COLOR[colorKey];
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d');
    g.fillStyle = col.hex; g.fillRect(0, 0, 32, 32);
    const ink = colorKey === 'white' || colorKey === 'yellow' || colorKey === 'gold' ? 'rgba(60,40,90,.55)' : 'rgba(255,255,255,.85)';
    g.fillStyle = ink;
    if (patternKey === 'spots') for (const [x, y] of [[8, 8], [24, 8], [16, 20], [4, 26], [28, 26]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
    if (patternKey === 'stripes') for (let y = 0; y < 32; y += 10) g.fillRect(0, y, 32, 4);
    if (patternKey === 'checks') for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 8, y * 8, 8, 8);
    if (patternKey === 'sparkles') { g.fillStyle = '#ffffff'; for (const [x, y] of [[6, 6], [22, 10], [12, 22], [27, 26], [3, 17]]) { g.fillRect(x - 1, y - 4, 2, 8); g.fillRect(x - 4, y - 1, 8, 2); } }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    textures.push(tex);
    const m = new THREE.MeshLambertMaterial({ map: tex, flatShading: true,
      emissive: col.golden ? '#6a4800' : patternKey === 'sparkles' ? '#3a2a55' : '#000000' });
    mats.set(key, m);
    return m;
  };

  const part = (parent, geo, material, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const eyes = (g, x, y, z, s = 0.12, gap = 0.16) => {
    for (const side of [-1, 1]) {
      part(g, G.sph, '#ffffff', s, s, s * 0.6, x + side * gap, y, z);
      part(g, G.sph, '#1b1140', s * 0.5, s * 0.5, s * 0.4, x + side * gap, y, z + s * 0.45);
    }
  };

  // ---------- shape builders: (group, main material) -> { head: [x, y, z], hs: hat scale } ----------
  // Facing +z (toward the chase camera). Base on y = 0. ~1 m tall for normal-size small things.
  const DARK = '#3a2a2a', WOOD = '#9a6a3a', PINKY = '#ffb3c8', ORANGE = '#ff9f1c';
  const B = {
    cow(g, M) { part(g, G.box, M, 1.0, 0.8, 1.5, 0, 0.95, 0); for (const [x, z] of [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]]) part(g, G.box, DARK, 0.2, 0.6, 0.2, x, 0.3, z);
      part(g, G.box, M, 0.62, 0.55, 0.55, 0, 1.4, 0.85); part(g, G.box, PINKY, 0.5, 0.25, 0.15, 0, 1.25, 1.15); eyes(g, 0, 1.5, 1.12);
      for (const s of [-1, 1]) part(g, G.cone, '#fff4d6', 0.08, 0.25, 0.08, s * 0.28, 1.75, 0.8); return { head: [0, 1.7, 0.85], hs: 0.7 }; },
    sheep(g, M) { part(g, G.ico1, M, 0.75, 0.6, 0.85, 0, 0.95, 0); for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) part(g, G.box, DARK, 0.15, 0.5, 0.15, x, 0.25, z);
      part(g, G.box, DARK, 0.42, 0.45, 0.42, 0, 1.25, 0.8); eyes(g, 0, 1.32, 1.02, 0.1, 0.12); return { head: [0, 1.5, 0.8], hs: 0.55 }; },
    pig(g, M) { part(g, G.sph, M, 0.65, 0.55, 0.8, 0, 0.7, 0); for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) part(g, G.box, M, 0.18, 0.35, 0.18, x, 0.18, z);
      part(g, G.cyl, PINKY, 0.2, 0.16, 0.2, 0, 0.75, 0.82, Math.PI / 2); eyes(g, 0, 0.98, 0.66, 0.1, 0.18);
      for (const s of [-1, 1]) part(g, G.cone, M, 0.12, 0.2, 0.08, s * 0.3, 1.25, 0.45); return { head: [0, 1.22, 0.4], hs: 0.6 }; },
    chicken(g, M) { part(g, G.sph, M, 0.4, 0.42, 0.45, 0, 0.6, 0); part(g, G.sph, M, 0.25, 0.27, 0.25, 0, 1.05, 0.22); part(g, G.box, '#ff3b3b', 0.06, 0.18, 0.2, 0, 1.33, 0.2);
      part(g, G.cone, ORANGE, 0.08, 0.2, 0.08, 0, 1.02, 0.5, Math.PI / 2); eyes(g, 0, 1.12, 0.4, 0.07, 0.11); for (const s of [-1, 1]) part(g, G.box, ORANGE, 0.05, 0.25, 0.05, s * 0.12, 0.12, 0);
      return { head: [0, 1.3, 0.22], hs: 0.4 }; },
    duck(g, M) { part(g, G.sph, M, 0.42, 0.35, 0.55, 0, 0.45, 0); part(g, G.sph, M, 0.24, 0.24, 0.24, 0, 0.92, 0.3); part(g, G.box, ORANGE, 0.22, 0.07, 0.25, 0, 0.88, 0.58);
      eyes(g, 0, 1.0, 0.5, 0.07, 0.1); return { head: [0, 1.14, 0.3], hs: 0.4 }; },
    bunny(g, M) { part(g, G.sph, M, 0.38, 0.42, 0.4, 0, 0.45, 0); part(g, G.sph, M, 0.28, 0.27, 0.27, 0, 0.98, 0.12); for (const s of [-1, 1]) part(g, G.box, M, 0.1, 0.45, 0.06, s * 0.12, 1.45, 0.1, 0, 0, s * 0.15);
      part(g, G.sph, PINKY, 0.06, 0.05, 0.05, 0, 0.95, 0.4); eyes(g, 0, 1.06, 0.33, 0.07, 0.1); return { head: [0, 1.22, 0.12], hs: 0.4 }; },
    penguin(g, M) { part(g, G.sph, M, 0.42, 0.62, 0.38, 0, 0.62, 0); part(g, G.sph, '#ffffff', 0.32, 0.48, 0.12, 0, 0.58, 0.3); part(g, G.cone, ORANGE, 0.08, 0.16, 0.08, 0, 0.98, 0.38, Math.PI / 2);
      eyes(g, 0, 1.08, 0.3, 0.07, 0.12); for (const s of [-1, 1]) part(g, G.box, M, 0.08, 0.5, 0.25, s * 0.44, 0.65, 0, 0, 0, s * 0.3); return { head: [0, 1.22, 0], hs: 0.45 }; },
    frog(g, M) { part(g, G.sph, M, 0.45, 0.3, 0.42, 0, 0.3, 0); for (const s of [-1, 1]) { part(g, G.sph, M, 0.15, 0.15, 0.15, s * 0.2, 0.58, 0.18); part(g, G.sph, '#ffffff', 0.1, 0.1, 0.06, s * 0.2, 0.6, 0.3); part(g, G.sph, '#1b1140', 0.05, 0.05, 0.03, s * 0.2, 0.6, 0.35); }
      part(g, G.box, '#c0392b', 0.4, 0.03, 0.05, 0, 0.27, 0.42); return { head: [0, 0.7, 0.05], hs: 0.45 }; },
    hay(g, M) { part(g, G.cyl, M, 0.75, 1.5, 0.75, 0, 0.75, 0, 0, 0, Math.PI / 2); part(g, G.cyl, '#d9b44a', 0.76, 0.1, 0.76, 0.45, 0.75, 0, 0, 0, Math.PI / 2); part(g, G.cyl, '#d9b44a', 0.76, 0.1, 0.76, -0.45, 0.75, 0, 0, 0, Math.PI / 2);
      return { head: [0, 1.5, 0], hs: 0.7 }; },
    fence(g, M) { for (const x of [-1.1, 0, 1.1]) part(g, G.box, M, 0.18, 1.1, 0.18, x, 0.55, 0); for (const y of [0.4, 0.85]) part(g, G.box, M, 2.4, 0.14, 0.1, 0, y, 0.08); return { head: [0, 1.12, 0], hs: 0.45 }; },
    mailbox(g, M) { part(g, G.box, WOOD, 0.12, 1.0, 0.12, 0, 0.5, 0); part(g, G.box, M, 0.4, 0.35, 0.6, 0, 1.15, 0); part(g, G.cyl, M, 0.2, 0.6, 0.2, 0, 1.32, 0, Math.PI / 2);
      part(g, G.box, '#ff3b3b', 0.04, 0.3, 0.1, 0.24, 1.35, -0.1); return { head: [0, 1.52, 0], hs: 0.45 }; },
    cart(g, M) { part(g, G.box, M, 1.1, 0.55, 1.4, 0, 0.75, 0); for (const s of [-1, 1]) part(g, G.cyl, DARK, 0.38, 0.12, 0.38, s * 0.62, 0.38, 0, 0, 0, Math.PI / 2);
      part(g, G.box, WOOD, 0.08, 0.08, 0.9, 0.3, 0.7, 1.1); part(g, G.box, WOOD, 0.08, 0.08, 0.9, -0.3, 0.7, 1.1); return { head: [0, 1.05, 0], hs: 0.6 }; },
    pumpkin(g, M) { part(g, G.sph, M, 0.7, 0.55, 0.7, 0, 0.55, 0); part(g, G.cyl, '#3f7a2a', 0.08, 0.25, 0.08, 0, 1.15, 0); eyes(g, 0, 0.7, 0.62, 0.09, 0.2); return { head: [0, 1.1, 0], hs: 0.55 }; },
    mushroom(g, M) { part(g, G.cyl, '#fff4e0', 0.18, 0.6, 0.18, 0, 0.3, 0); part(g, G.half, M, 0.6, 0.45, 0.6, 0, 0.58, 0); eyes(g, 0, 0.45, 0.17, 0.06, 0.08); return { head: [0, 1.03, 0], hs: 0.5 }; },
    crate(g, M) { part(g, G.box, M, 1.0, 1.0, 1.0, 0, 0.5, 0); part(g, G.box, WOOD, 1.02, 0.12, 1.02, 0, 0.92, 0); part(g, G.box, WOOD, 1.02, 0.12, 1.02, 0, 0.08, 0); return { head: [0, 1.0, 0], hs: 0.55 }; },
    barrel(g, M) { part(g, G.cyl, M, 0.5, 1.1, 0.5, 0, 0.55, 0); for (const y of [0.2, 0.9]) part(g, G.cyl, DARK, 0.52, 0.08, 0.52, 0, y, 0); return { head: [0, 1.1, 0], hs: 0.5 }; },
    flag(g, M) { part(g, G.cyl, '#dddddd', 0.05, 2.2, 0.05, 0, 1.1, 0); part(g, G.box, M, 0.9, 0.55, 0.05, 0.47, 1.9, 0); return { head: [0, 2.25, 0], hs: 0.3 }; },
    bench(g, M) { part(g, G.box, M, 1.6, 0.12, 0.5, 0, 0.5, 0); part(g, G.box, M, 1.6, 0.45, 0.1, 0, 0.8, -0.22); for (const s of [-1, 1]) part(g, G.box, DARK, 0.1, 0.5, 0.45, s * 0.7, 0.25, 0); return { head: [0, 1.05, -0.2], hs: 0.45 }; },
    lamp(g, M) { part(g, G.cyl, '#4a4a5a', 0.07, 2.2, 0.07, 0, 1.1, 0); part(g, G.sph, M, 0.28, 0.28, 0.28, 0, 2.35, 0); part(g, G.cone, '#4a4a5a', 0.3, 0.15, 0.3, 0, 2.62, 0);
      return { head: [0, 2.6, 0], hs: 0.35 }; },
    snowman(g, M) { part(g, G.sph, M, 0.55, 0.5, 0.55, 0, 0.5, 0); part(g, G.sph, M, 0.4, 0.38, 0.4, 0, 1.25, 0); part(g, G.sph, M, 0.3, 0.3, 0.3, 0, 1.85, 0);
      part(g, G.cone, ORANGE, 0.06, 0.3, 0.06, 0, 1.85, 0.4, Math.PI / 2); eyes(g, 0, 1.95, 0.25, 0.06, 0.1); return { head: [0, 2.12, 0], hs: 0.5 }; },
    bush(g, M) { part(g, G.ico1, M, 0.7, 0.55, 0.65, 0, 0.5, 0); part(g, G.ico1, M, 0.45, 0.4, 0.45, 0.45, 0.45, 0.1); part(g, G.ico1, M, 0.45, 0.4, 0.45, -0.45, 0.45, 0.05); eyes(g, 0, 0.6, 0.6, 0.08, 0.15); return { head: [0, 1.02, 0], hs: 0.5 }; },
    tree(g, M) { part(g, G.cyl, WOOD, 0.15, 1.2, 0.15, 0, 0.6, 0); part(g, G.ico, M, 0.8, 0.85, 0.8, 0, 1.8, 0); return { head: [0, 2.6, 0], hs: 0.6 }; },
    pine(g, M) { part(g, G.cyl, WOOD, 0.14, 0.7, 0.14, 0, 0.35, 0); for (let k = 0; k < 3; k++) part(g, G.cone, M, 0.85 - k * 0.22, 0.9, 0.85 - k * 0.22, 0, 1.0 + k * 0.6, 0); return { head: [0, 2.6, 0], hs: 0.45 }; },
    robot(g, M) { part(g, G.box, M, 0.7, 0.75, 0.5, 0, 0.75, 0); part(g, G.box, M, 0.5, 0.42, 0.45, 0, 1.38, 0); part(g, G.cyl, '#cccccc', 0.03, 0.3, 0.03, 0, 1.75, 0);
      part(g, G.sph, '#ff3b3b', 0.07, 0.07, 0.07, 0, 1.92, 0, 0, 0, 0); for (const s of [-1, 1]) { part(g, G.box, '#5ee0ff', 0.1, 0.08, 0.05, s * 0.12, 1.42, 0.23); part(g, G.box, '#999999', 0.15, 0.38, 0.15, s * 0.2, 0.2, 0); part(g, G.box, M, 0.12, 0.5, 0.12, s * 0.45, 0.8, 0); }
      return { head: [0, 1.6, 0], hs: 0.5 }; },
    balloon(g, M) { part(g, G.sph, M, 1.0, 1.15, 1.0, 0, 2.7, 0); part(g, G.box, WOOD, 0.6, 0.45, 0.6, 0, 0.35, 0); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) part(g, G.box, '#dddddd', 0.02, 1.2, 0.02, x, 1.1, z);
      return { head: [0, 3.85, 0], hs: 0.6, float: true }; },
    dino(g, M) { part(g, G.box, M, 0.8, 0.7, 1.4, 0, 0.8, 0); part(g, G.box, M, 0.35, 0.8, 0.35, 0, 1.4, 0.55, -0.3); part(g, G.box, M, 0.45, 0.35, 0.6, 0, 1.85, 0.8); part(g, G.cone, M, 0.3, 1.0, 0.3, 0, 0.75, -1.1, -Math.PI / 2);
      for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) part(g, G.box, M, 0.22, 0.45, 0.22, x, 0.22, z); eyes(g, 0, 1.95, 1.08, 0.08, 0.14); return { head: [0, 2.05, 0.8], hs: 0.5 }; },
    house(g, M) { part(g, G.box, M, 3.2, 2.4, 3.0, 0, 1.2, 0); part(g, G.pyr, '#d9483b', 2.6, 1.6, 2.6, 0, 3.2, 0, 0, Math.PI / 4); part(g, G.box, WOOD, 0.8, 1.3, 0.1, 0, 0.65, 1.52);
      for (const s of [-1, 1]) part(g, G.box, '#bfe8ff', 0.6, 0.6, 0.1, s * 1.0, 1.5, 1.52); part(g, G.box, '#8a5a3a', 0.4, 1.0, 0.4, 0.9, 3.5, -0.4); return { head: [0, 4.0, 0], hs: 1.4 }; },
    barn(g, M) { part(g, G.box, M, 3.6, 2.6, 3.4, 0, 1.3, 0); part(g, G.prism, '#7a3b2b', 2.0, 3.8, 2.2, 0, 3.1, 0, 0, Math.PI / 2); part(g, G.box, '#ffffff', 1.6, 1.8, 0.1, 0, 0.9, 1.72);
      part(g, G.box, M, 0.15, 2.3, 0.12, 0, 0.9, 1.78, 0, 0, 0.73); part(g, G.box, M, 0.15, 2.3, 0.12, 0, 0.9, 1.78, 0, 0, -0.73); return { head: [0, 4.1, 0], hs: 1.5 }; },
    windmill(g, M) { part(g, G.cone, M, 1.2, 4.5, 1.2, 0, 2.25, 0); part(g, G.pyr, '#d9483b', 0.9, 0.9, 0.9, 0, 4.7, 0); const hub = new THREE.Group(); hub.position.set(0, 4.0, 0.95); g.add(hub);
      for (let k = 0; k < 4; k++) part(hub, G.box, '#fff4e0', 0.35, 2.2, 0.06, Math.sin(k * Math.PI / 2) * 1.1, Math.cos(k * Math.PI / 2) * 1.1, 0, 0, 0, -k * Math.PI / 2);
      g.userData.spin = hub; return { head: [0, 5.1, 0], hs: 0.8 }; },
    igloo(g, M) { part(g, G.half, M, 2.0, 1.7, 2.0, 0, 0, 0); part(g, G.cyl, M, 0.6, 1.2, 0.6, 0, 0.55, 1.9, Math.PI / 2); part(g, G.box, '#1b1140', 0.6, 0.7, 0.1, 0, 0.4, 2.5); return { head: [0, 1.75, 0], hs: 1.1 }; },
    tractor(g, M) { part(g, G.box, M, 1.4, 0.9, 2.4, 0, 1.0, 0); part(g, G.box, M, 1.2, 1.0, 1.0, 0, 1.9, -0.5); part(g, G.box, '#bfe8ff', 1.22, 0.5, 0.8, 0, 2.0, -0.5);
      for (const s of [-1, 1]) { part(g, G.cyl, DARK, 0.85, 0.4, 0.85, s * 0.85, 0.85, -0.6, 0, 0, Math.PI / 2); part(g, G.cyl, DARK, 0.45, 0.3, 0.45, s * 0.75, 0.45, 0.85, 0, 0, Math.PI / 2); }
      part(g, G.cyl, '#555', 0.08, 0.8, 0.08, 0.4, 1.8, 0.8); return { head: [0, 2.45, -0.5], hs: 0.8 }; },
    rock(g, M) { part(g, G.ico, M, 1.5, 1.2, 1.4, 0, 1.0, 0, 0.3, 0.5, 0.1); eyes(g, 0, 1.25, 1.25, 0.16, 0.35); return { head: [0, 2.15, 0], hs: 0.9 }; },
  };

  const HAT_BUILD = {
    tophat(g, s) { part(g, G.cyl, '#1b1140', 0.42 * s, 0.05 * s, 0.42 * s, 0, 0.02 * s, 0); part(g, G.cyl, '#1b1140', 0.28 * s, 0.45 * s, 0.28 * s, 0, 0.25 * s, 0); part(g, G.cyl, '#ff3b5c', 0.29 * s, 0.08 * s, 0.29 * s, 0, 0.1 * s, 0); },
    party(g, s) { part(g, G.cone, '#ff5ea8', 0.25 * s, 0.6 * s, 0.25 * s, 0, 0.3 * s, 0); part(g, G.sph, '#ffe14d', 0.09 * s, 0.09 * s, 0.09 * s, 0, 0.62 * s, 0); },
    bow(g, s) { for (const k of [-1, 1]) part(g, G.cone, '#ff4d9d', 0.16 * s, 0.32 * s, 0.16 * s, k * 0.17 * s, 0.08 * s, 0, 0, 0, k * Math.PI / 2); part(g, G.sph, '#ff4d9d', 0.09 * s, 0.09 * s, 0.09 * s, 0, 0.08 * s, 0); },
    shades(g, s) { for (const k of [-1, 1]) part(g, G.box, '#111111', 0.22 * s, 0.13 * s, 0.05 * s, k * 0.16 * s, -0.2 * s, 0.32 * s); part(g, G.box, '#111111', 0.12 * s, 0.03 * s, 0.03 * s, 0, -0.17 * s, 0.32 * s); },
    crown(g, s) { part(g, G.cyl, '#ffc61a', 0.3 * s, 0.18 * s, 0.3 * s, 0, 0.09 * s, 0); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; part(g, G.cone, '#ffc61a', 0.07 * s, 0.2 * s, 0.07 * s, Math.sin(a) * 0.24 * s, 0.27 * s, Math.cos(a) * 0.24 * s); }
      part(g, G.sph, '#ff3b5c', 0.06 * s, 0.06 * s, 0.06 * s, 0, 0.12 * s, 0.3 * s); },
  };

  // one template per recipe id (cached), cloned for every object (clones share geometry + materials)
  const templates = new Map();
  function template(id) {
    if (templates.has(id)) return templates.get(id);
    const r = parseId(id);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const info = B[r.shape](body, patternMat(r.color, r.pattern));
    if (r.hat !== 'none') { const h = new THREE.Group(); h.position.set(...info.head); body.add(h); HAT_BUILD[r.hat](h, info.hs * 1.6); }
    const tier = rarity(r);
    if (tier !== 'common') {
      const sp = part(body, G.oct, mat(tier === 'golden' ? '#fff1a8' : '#ffffff', { emissive: tier === 'golden' ? '#ffb400' : '#8888ff' }), 0.18, 0.3, 0.18, 0, info.head[1] + (r.hat !== 'none' ? 1.0 : 0.5) * info.hs + 0.3, 0);
      body.userData.sparkle = sp;
    }
    body.scale.setScalar(SIZE[r.size].scale);
    root.userData = { headY: info.head[1] * SIZE[r.size].scale, float: !!info.float };
    templates.set(id, root);
    return root;
  }
  function makeObject(id) {
    const t = template(id);
    const m = t.clone(true);
    m.userData = { ...t.userData, body: m.children[0] };
    const src = t.children[0];
    m.userData.spin = src.userData.spin ? m.children[0].children[src.children.indexOf(src.userData.spin)] : null;
    m.userData.sparkle = src.userData.sparkle ? m.children[0].children[src.children.indexOf(src.userData.sparkle)] : null;
    return m;
  }

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
    const b = BIOMES[ch.biome === 'start' ? 'meadow' : ch.biome];
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
      const b = ch.biome === 'start' ? 'meadow' : ch.biome;
      const n = low ? 3 : 6;
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1;
        const d = ch.d0 + (k + 0.5) * (CHUNK / n);
        const off = M.halfWidth(d) + 5 + ((k * 7919 + ch.index * 104729) % 9);
        const kind = b === 'snow' ? 'pine' : b === 'forest' ? (k % 3 ? 'pine' : 'tree') : b === 'village' ? (k % 2 ? 'house' : 'tree') : b === 'farm' ? (k % 2 ? 'barn' : 'tree') : (k % 3 ? 'tree' : 'bush');
        const color = kind === 'house' || kind === 'barn' ? ['red', 'yellow', 'blue', 'white'][k % 4] : b === 'snow' ? 'white' : 'green';
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
      m.rotation.y = o.kind === 'tough' ? o.rot * 0.12 : o.rot * 0.3;
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
  const DEBRIS = low ? 120 : 260;
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
  function debris(x, y, z, { count = 20, colors = ['#ffffff'], speed = 7, size = 0.25, up = 5, vz = 0 } = {}) {
    count = Math.min(count, DEBRIS);
    for (let k = 0; k < count; k++) {
      const i = partNext; partNext = (partNext + 1) % DEBRIS;
      const p = parts[i];
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      Object.assign(p, { life: 1 + Math.random() * 0.6, x, y, z, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s + vz, s: size * (0.5 + Math.random()), rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 14, floor: y - 1.5 });
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
      const k = Math.min(1, p.life / 0.4);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0); dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    if (any) debrisMesh.instanceMatrix.needsUpdate = true;
  }

  const v3 = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let camX = 0, camFov = 62;

  return {
    camera, scene, G, chunks,
    addChunk, removeChunk, objectMesh, makeObject, debris,

    setSky(snowy) {
      scene.background.set(snowy ? '#a8d8ff' : '#86ccff');
      scene.fog.color.set(snowy ? '#e6f4ff' : '#d4efff');
    },

    // ball at world (x, d, h = height of the ball's bottom above the ground). roll = radians rolled.
    setBall({ x, d, h, roll, lean = 0, scale = 1, rainbow = 0, t = 0 }) {
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
      } else { ballMat.emissive.set('#000000'); glow.material.opacity = 0; }
      glow.position.copy(ballSpin.position); glow.scale.setScalar(scale);
    },

    // chase camera behind and above the ball, looking downhill. tuck = 0..1 (FOV stretch), lag-smoothed x.
    setCamera({ x, d, h, dt, tuck = 0, shake = 0, aspect = 16 / 9 }) {
      camX += (x - camX) * Math.min(1, dt * 4);
      const back = 9 + tuck * 2.5, up = 5.2 + h * 0.4;
      camera.position.set(camX + (x - camX) * 0.3, groundY(d - back) + up, -(d - back));
      camLook.set(x * 0.7 + camX * 0.3, groundY(d + 14) + 0.5, -(d + 14));
      camera.lookAt(camLook);
      if (shake) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
      const base = aspect < 1 ? 82 : 62;
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
          if (u.o.kind === 'critter' && !u.hit) u.body.position.y = Math.abs(Math.sin(t * 4 + u.o.wob)) * 0.15;
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
      for (const m of mats.values()) m.dispose();
      for (const t of textures) t.dispose();
      for (const g of Object.values(G)) g.dispose?.();
      groundMat.dispose(); ballMat.dispose(); ball.geometry.dispose(); shadow.geometry.dispose(); shadow.material.dispose();
      glow.geometry.dispose(); glow.material.dispose();
      debrisMesh.geometry.dispose?.(); debrisMesh.material.dispose();
      backdrop.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
