// Every Mega Roll mesh, built from flat-shaded low-poly primitives: the sticker shapes (one cached template per
// recipe id, cloned for every object), hats, sparkles, and the three finale landmarks. Shared by the 3D world and
// the passport's 3D sticker viewer, so a sticker looks exactly like the thing you bonked.
//   const M = createMeshes(THREE); M.makeObject(id) -> Group; M.makeLandmark('bigbarn') -> Group; M.dispose()

import { COLOR, SIZE, parseId, rarity } from './recipes.js';

export function createMeshes(THREE) {
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
    house(g, M) { part(g, G.box, M, 3.2, 2.4, 3.0, 0, 1.2, 0); g.userData.roof = part(g, G.pyr, '#d9483b', 2.6, 1.6, 2.6, 0, 3.2, 0, 0, Math.PI / 4); part(g, G.box, WOOD, 0.8, 1.3, 0.1, 0, 0.65, 1.52);
      for (const s of [-1, 1]) part(g, G.box, '#bfe8ff', 0.6, 0.6, 0.1, s * 1.0, 1.5, 1.52); part(g, G.box, '#8a5a3a', 0.4, 1.0, 0.4, 0.9, 3.5, -0.4); return { head: [0, 4.0, 0], hs: 1.4 }; },
    barn(g, M) { part(g, G.box, M, 3.6, 2.6, 3.4, 0, 1.3, 0); g.userData.roof = part(g, G.prism, '#7a3b2b', 2.0, 3.8, 2.2, 0, 3.1, 0, 0, Math.PI / 2); part(g, G.box, '#ffffff', 1.6, 1.8, 0.1, 0, 0.9, 1.72);
      part(g, G.box, M, 0.15, 2.3, 0.12, 0, 0.9, 1.78, 0, 0, 0.73); part(g, G.box, M, 0.15, 2.3, 0.12, 0, 0.9, 1.78, 0, 0, -0.73); return { head: [0, 4.1, 0], hs: 1.5 }; },
    windmill(g, M) { part(g, G.cone, M, 1.2, 4.5, 1.2, 0, 2.25, 0); g.userData.roof = part(g, G.pyr, '#d9483b', 0.9, 0.9, 0.9, 0, 4.7, 0); const hub = new THREE.Group(); hub.position.set(0, 4.0, 0.95); g.add(hub);
      for (let k = 0; k < 4; k++) part(hub, G.box, '#fff4e0', 0.35, 2.2, 0.06, Math.sin(k * Math.PI / 2) * 1.1, Math.cos(k * Math.PI / 2) * 1.1, 0, 0, 0, -k * Math.PI / 2);
      g.userData.spin = hub; return { head: [0, 5.1, 0], hs: 0.8 }; },
    igloo(g, M) { part(g, G.half, M, 2.0, 1.7, 2.0, 0, 0, 0); g.userData.roof = part(g, G.cone, M, 0.5, 0.4, 0.5, 0, 1.75, 0); part(g, G.cyl, M, 0.6, 1.2, 0.6, 0, 0.55, 1.9, Math.PI / 2); part(g, G.box, '#1b1140', 0.6, 0.7, 0.1, 0, 0.4, 2.5); return { head: [0, 1.75, 0], hs: 1.1 }; },
    tractor(g, M) { part(g, G.box, M, 1.4, 0.9, 2.4, 0, 1.0, 0); g.userData.roof = part(g, G.box, M, 1.2, 1.0, 1.0, 0, 1.9, -0.5); part(g, G.box, '#bfe8ff', 1.22, 0.5, 0.8, 0, 2.0, -0.5);
      for (const s of [-1, 1]) { part(g, G.cyl, DARK, 0.85, 0.4, 0.85, s * 0.85, 0.85, -0.6, 0, 0, Math.PI / 2); part(g, G.cyl, DARK, 0.45, 0.3, 0.45, s * 0.75, 0.45, 0.85, 0, 0, Math.PI / 2); }
      part(g, G.cyl, '#555', 0.08, 0.8, 0.08, 0.4, 1.8, 0.8); return { head: [0, 2.45, -0.5], hs: 0.8 }; },
    rock(g, M) { part(g, G.ico, M, 1.5, 1.2, 1.4, 0, 1.0, 0, 0.3, 0.5, 0.1); g.userData.roof = part(g, G.ico, M, 0.6, 0.45, 0.6, 0.3, 2.1, -0.1, 0.4); eyes(g, 0, 1.25, 1.25, 0.16, 0.35); return { head: [0, 2.15, 0], hs: 0.9 }; },
    // ---- v2.0 species and things ----
    dog(g, M) { part(g, G.box, M, 0.45, 0.4, 0.85, 0, 0.5, 0); for (const [x, z] of [[-0.15, -0.3], [0.15, -0.3], [-0.15, 0.3], [0.15, 0.3]]) part(g, G.box, M, 0.12, 0.35, 0.12, x, 0.18, z);
      part(g, G.box, M, 0.4, 0.36, 0.42, 0, 0.82, 0.48); part(g, G.box, '#ffffff', 0.22, 0.16, 0.2, 0, 0.74, 0.74); part(g, G.sph, '#1b1140', 0.06, 0.05, 0.05, 0, 0.8, 0.85);
      for (const s of [-1, 1]) part(g, G.box, DARK, 0.1, 0.28, 0.08, s * 0.22, 0.88, 0.42, 0, 0, s * 0.3); part(g, G.box, M, 0.08, 0.08, 0.4, 0, 0.7, -0.55, -0.6); eyes(g, 0, 0.92, 0.7, 0.07, 0.1);
      return { head: [0, 1.0, 0.48], hs: 0.45 }; },
    goat(g, M) { part(g, G.box, M, 0.6, 0.55, 1.0, 0, 0.8, 0); for (const [x, z] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.35], [0.2, 0.35]]) part(g, G.box, DARK, 0.12, 0.55, 0.12, x, 0.28, z);
      part(g, G.box, M, 0.36, 0.42, 0.45, 0, 1.2, 0.6); for (const s of [-1, 1]) part(g, G.cone, '#d9c9a8', 0.06, 0.35, 0.06, s * 0.12, 1.5, 0.48, -0.5); part(g, G.cone, '#f4f0e6', 0.08, 0.25, 0.08, 0, 0.92, 0.75, Math.PI);
      eyes(g, 0, 1.3, 0.83, 0.07, 0.11); return { head: [0, 1.45, 0.6], hs: 0.5 }; },
    deer(g, M) { part(g, G.box, M, 0.55, 0.55, 1.15, 0, 1.05, 0); for (const [x, z] of [[-0.18, -0.4], [0.18, -0.4], [-0.18, 0.4], [0.18, 0.4]]) part(g, G.box, M, 0.1, 0.8, 0.1, x, 0.4, z);
      part(g, G.box, M, 0.22, 0.6, 0.22, 0, 1.45, 0.5, 0.35); part(g, G.box, M, 0.3, 0.3, 0.45, 0, 1.75, 0.72); part(g, G.sph, '#1b1140', 0.05, 0.05, 0.05, 0, 1.73, 0.96);
      for (const s of [-1, 1]) { part(g, G.box, '#8a5a3a', 0.04, 0.45, 0.04, s * 0.12, 2.1, 0.62, 0, 0, s * 0.35); part(g, G.box, '#8a5a3a', 0.04, 0.2, 0.04, s * 0.22, 2.2, 0.64, 0, 0, -s * 0.5); }
      part(g, G.sph, '#ffffff', 0.08, 0.1, 0.06, 0, 1.2, -0.6); eyes(g, 0, 1.82, 0.9, 0.06, 0.1); return { head: [0, 2.0, 0.7], hs: 0.45 }; },
    fox(g, M) { part(g, G.box, M, 0.4, 0.36, 0.8, 0, 0.48, 0); for (const [x, z] of [[-0.13, -0.28], [0.13, -0.28], [-0.13, 0.28], [0.13, 0.28]]) part(g, G.box, DARK, 0.09, 0.32, 0.09, x, 0.16, z);
      part(g, G.box, M, 0.38, 0.32, 0.34, 0, 0.75, 0.45); part(g, G.cone, '#ffffff', 0.12, 0.3, 0.12, 0, 0.7, 0.72, Math.PI / 2); part(g, G.sph, '#1b1140', 0.04, 0.04, 0.04, 0, 0.7, 0.88);
      for (const s of [-1, 1]) part(g, G.cone, M, 0.08, 0.22, 0.06, s * 0.13, 1.0, 0.42); part(g, G.cone, M, 0.16, 0.7, 0.16, 0, 0.62, -0.7, -1.2); part(g, G.cone, '#ffffff', 0.08, 0.2, 0.08, 0, 0.82, -1.0, -1.2);
      eyes(g, 0, 0.82, 0.62, 0.06, 0.1); return { head: [0, 0.95, 0.45], hs: 0.4 }; },
    squirrel(g, M) { part(g, G.sph, M, 0.24, 0.32, 0.24, 0, 0.35, 0); part(g, G.sph, M, 0.2, 0.2, 0.2, 0, 0.75, 0.08); for (const s of [-1, 1]) part(g, G.cone, M, 0.06, 0.14, 0.05, s * 0.1, 0.98, 0.05);
      part(g, G.ico1, M, 0.22, 0.45, 0.2, 0, 0.62, -0.32, -0.3); part(g, G.sph, '#9a6a3a', 0.08, 0.08, 0.08, 0, 0.45, 0.24); eyes(g, 0, 0.8, 0.24, 0.05, 0.08); return { head: [0, 0.95, 0.08], hs: 0.3 }; },
    owl(g, M) { part(g, G.sph, M, 0.34, 0.42, 0.3, 0, 0.45, 0); for (const s of [-1, 1]) { part(g, G.cyl, '#ffffff', 0.12, 0.03, 0.12, s * 0.13, 0.62, 0.27, Math.PI / 2); part(g, G.sph, '#1b1140', 0.06, 0.06, 0.03, s * 0.13, 0.62, 0.3);
      part(g, G.cone, M, 0.06, 0.18, 0.05, s * 0.2, 0.9, 0.05); part(g, G.box, M, 0.06, 0.35, 0.25, s * 0.33, 0.42, 0, 0, 0, s * 0.15); } part(g, G.cone, '#ff9f1c', 0.04, 0.1, 0.04, 0, 0.5, 0.33, Math.PI);
      return { head: [0, 0.88, 0], hs: 0.35 }; },
    seal(g, M) { part(g, G.sph, M, 0.4, 0.3, 0.75, 0, 0.3, 0); part(g, G.sph, M, 0.28, 0.27, 0.28, 0, 0.62, 0.52); part(g, G.sph, '#1b1140', 0.05, 0.04, 0.04, 0, 0.6, 0.8);
      for (const s of [-1, 1]) { part(g, G.box, M, 0.3, 0.05, 0.18, s * 0.38, 0.12, 0.2, 0, 0, s * 0.3); part(g, G.box, '#dddddd', 0.18, 0.01, 0.01, s * 0.14, 0.57, 0.8); }
      part(g, G.box, M, 0.4, 0.05, 0.2, 0, 0.1, -0.75); eyes(g, 0, 0.7, 0.75, 0.06, 0.11); return { head: [0, 0.88, 0.52], hs: 0.4 }; },
    polar(g, M) { part(g, G.sph, M, 0.55, 0.5, 0.75, 0, 0.62, 0); for (const [x, z] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) part(g, G.cyl, M, 0.14, 0.4, 0.14, x, 0.2, z);
      part(g, G.sph, M, 0.34, 0.32, 0.34, 0, 1.0, 0.6); part(g, G.sph, M, 0.16, 0.13, 0.16, 0, 0.93, 0.88); part(g, G.sph, '#1b1140', 0.06, 0.05, 0.05, 0, 0.98, 1.02);
      for (const s of [-1, 1]) part(g, G.sph, M, 0.1, 0.1, 0.06, s * 0.24, 1.28, 0.55); eyes(g, 0, 1.08, 0.88, 0.06, 0.13); return { head: [0, 1.3, 0.6], hs: 0.5 }; },
    log(g, M) { part(g, G.cyl, M, 0.4, 2.0, 0.4, 0, 0.4, 0, 0, 0, Math.PI / 2); for (const s of [-1, 1]) part(g, G.cyl, '#e8c98f', 0.34, 0.03, 0.34, s * 1.0, 0.4, 0, 0, 0, Math.PI / 2); return { head: [0, 0.8, 0], hs: 0.5 }; },
    basket(g, M) { part(g, G.box, M, 0.75, 0.42, 0.5, 0, 0.21, 0); part(g, G.box, WOOD, 0.78, 0.06, 0.53, 0, 0.44, 0); for (const s of [-1, 1]) part(g, G.box, WOOD, 0.05, 0.4, 0.05, s * 0.3, 0.62, 0, 0, 0, s * -0.4);
      part(g, G.box, WOOD, 0.36, 0.05, 0.05, 0, 0.8, 0); return { head: [0, 0.85, 0], hs: 0.45 }; },
    sled(g, M) { for (const s of [-1, 1]) part(g, G.box, DARK, 0.06, 0.08, 1.6, s * 0.35, 0.06, 0); for (const z of [-0.5, 0, 0.5]) part(g, G.box, M, 0.85, 0.08, 0.3, 0, 0.32, z);
      for (const [x, z] of [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]]) part(g, G.box, DARK, 0.05, 0.25, 0.05, x, 0.18, z); part(g, G.box, M, 0.85, 0.3, 0.06, 0, 0.5, -0.65);
      return { head: [0, 0.6, 0], hs: 0.45 }; },
    cabin(g, M) { part(g, G.box, M, 3.0, 2.2, 2.8, 0, 1.1, 0); for (let y = 0.3; y < 2.2; y += 0.45) part(g, G.box, '#7a4a2a', 3.05, 0.08, 2.85, 0, y, 0);
      g.userData.roof = part(g, G.prism, '#2f6a3a', 1.8, 3.4, 2.0, 0, 2.75, 0, 0, Math.PI / 2); part(g, G.box, WOOD, 0.8, 1.3, 0.1, 0, 0.65, 1.42); part(g, G.box, '#ffe49a', 0.6, 0.55, 0.1, -0.95, 1.3, 1.42);
      part(g, G.box, '#8a8a8a', 0.4, 1.2, 0.4, 0.9, 3.0, -0.5); return { head: [0, 3.8, 0], hs: 1.3 }; },
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
    root.userData = { headY: info.head[1] * SIZE[r.size].scale, float: !!info.float, shape: r.shape };
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
    m.userData.roof = src.userData.roof ? m.children[0].children[src.children.indexOf(src.userData.roof)] : null;
    return m;
  }

  // ---------- finale landmarks: a giant themed building made of chunky PIECES that crack off hit by hit ----------
  // Each piece has a stage (0 = falls first: roof / flags / tops ... higher = holds out till the collapse).
  function landmark(kind) {
    const g = new THREE.Group();
    const pieces = [];
    const P = (geo, color, sx, sy, sz, x, y, z, stage, rx = 0, ry = 0, rz = 0, opts) => {
      const m = part(g, geo, typeof color === 'string' ? mat(color, opts) : color, sx, sy, sz, x, y, z, rx, ry, rz);
      m.userData.stage = stage; m.userData.home = m.position.clone(); pieces.push(m); return m;
    };
    if (kind === 'bigbarn') {
      for (let i = 0; i < 4; i++) P(G.box, i % 2 ? '#d9483b' : '#c63d31', 2.6, 6.5, 7, -3.9 + i * 2.6, 3.25, 0, 3);
      P(G.prism, '#7a3b2b', 4.5, 11, 4.8, 0, 8.2, 0, 0, 0, Math.PI / 2);
      P(G.box, '#ffffff', 4, 4.2, 0.2, 0, 2.1, 3.6, 2); P(G.box, '#c63d31', 0.4, 5.5, 0.25, 0, 2.1, 3.75, 1, 0, 0, 0.75); P(G.box, '#c63d31', 0.4, 5.5, 0.25, 0, 2.1, 3.75, 1, 0, 0, -0.75);
      P(G.box, '#ffe49a', 1.6, 1.4, 0.2, 0, 6.4, 3.6, 1);
      for (let k = 0; k < 3; k++) P(G.cyl, k % 2 ? '#d8d8e0' : '#c4c4d0', 1.8, 2.6, 1.8, 7.6, 1.3 + k * 2.6, -1, 2 - Math.min(2, k));
      P(G.half, '#9aa0b0', 1.85, 1.4, 1.85, 7.6, 7.8, -1, 0);
      P(G.cone, '#ffcc33', 0.25, 1.2, 0.25, 0, 11.1, 0, 0);
    } else if (kind === 'logtower') {
      for (let lvl = 0; lvl < 7; lvl++) for (let s = 0; s < 4; s++) {
        const y = 0.6 + lvl * 1.15 + (s % 2) * 0.55, along = s % 2 === 0;
        P(G.cyl, lvl % 2 ? '#8a5a3a' : '#9a6a3a', 0.6, 7, 0.6, along ? 0 : (s === 1 ? -3 : 3), y, along ? (s === 0 ? 3 : -3) : 0, Math.min(3, 3 - Math.floor(lvl / 2)), along ? 0 : Math.PI / 2, 0, along ? Math.PI / 2 : 0);
      }
      P(G.cone, '#2f6a3a', 5.5, 4, 5.5, 0, 10.5, 0, 0); P(G.cyl, '#dddddd', 0.08, 3, 0.08, 0, 13.5, 0, 0); P(G.box, '#ff5ea8', 1.4, 0.8, 0.06, 0.72, 14.5, 0, 0);
    } else { // icecastle
      const ice = { transparent: true, opacity: 0.88 };
      for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
        for (let k = 0; k < 3; k++) P(G.cyl, k % 2 ? '#bfe8ff' : '#a8dcff', 1.4, 2.4, 1.4, x, 1.2 + k * 2.4, z, 3 - k, 0, 0, 0, ice);
        P(G.cone, '#7fc4ff', 1.7, 2.4, 1.7, x, 8.4, z, 0);
      }
      P(G.box, '#d6f2ff', 8.6, 4, 0.8, 0, 2, 3, 2, 0, 0, 0, ice); P(G.box, '#d6f2ff', 8.6, 4, 0.8, 0, 2, -3, 3, 0, 0, 0, ice);
      P(G.box, '#c8ecff', 0.8, 4, 5.2, -5, 2, 0, 3, 0, 0, 0, ice); P(G.box, '#c8ecff', 0.8, 4, 5.2, 5, 2, 0, 3, 0, 0, 0, ice);
      P(G.box, '#5ea8e0', 2.2, 2.8, 0.3, 0, 1.4, 3.45, 1);
      P(G.box, '#e6f8ff', 4, 6, 4, 0, 5, 0, 2, 0, 0, 0, ice); P(G.cone, '#5ec8ff', 3, 4, 3, 0, 10, 0, 0); P(G.box, '#ff5ea8', 1.2, 0.7, 0.06, 0.6, 12.6, 0, 0);
    }
    for (const p of pieces) p.userData.home = p.position.clone();
    g.userData.pieces = pieces;
    return g;
  }

  return {
    G, mat, makeObject, makeLandmark: landmark, part,
    dispose() {
      for (const m of mats.values()) m.dispose();
      for (const t of textures) t.dispose();
      for (const g of Object.values(G)) g.dispose?.();
      templates.clear();
    },
  };
}
