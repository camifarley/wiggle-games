// The 3D space: three.js scene (stars, a far planet, nebula glow), voxel bad-guy aliens (our own pixel
// designs, extruded into blocks), round good-guy friends built from their recipe, bubble cages, escape pods,
// asteroids, the tractor beam, Captain Clank's CRAB-TANK, and instanced debris cubes. Rendered into an
// offscreen WebGL canvas that the game draws onto the 2D stage (HUD, cockpit and fx stay on top), like
// Smash Run and Mega Roll.
//
// Space: the pilot's camera sits at (x, y, 0) looking down -z. Things fly in from far away (z = -150) toward
// the glass (z = 0). +x = screen right.

import * as THREE from 'three';
import { COLOR, SIZE, parseId } from './recipes.js';

// ---------- bad-guy designs (ours): rows of pixels, 2 dance frames each ----------
// X body color, D darker body, W white, K dark (pupils/mouth), Y yellow lights, P pink
export const DESIGNS = {
  snapper: { // crab-ish: big pincers up, eyes on stalks
    frames: [[
      'XX.......XX',
      'X.X.W.W.X.X',
      'XX..K.K..XX',
      '.X.XXXXX.X.',
      '..XXXXXXX..',
      '.XXXKKKXXX.',
      '..X.X.X.X..',
      '.X..X.X..X.',
    ], [
      '.XX.....XX.',
      'X..XW.WX..X',
      'XX..K.K..XX',
      '.X.XXXXX.X.',
      '..XXXXXXX..',
      '.XXXKKKXXX.',
      '.X.X...X.X.',
      '..X.....X..',
    ]],
  },
  squirm: { // squid-ish: a yellow mohawk, wiggly tentacles
    frames: [[
      '....YYY....',
      '...XXXXX...',
      '..XWWXWWX..',
      '..XWKXKWX..',
      '..XXXXXXX..',
      '..XXKKKXX..',
      '.X.X.X.X.X.',
      'X..X...X..X',
    ], [
      '...Y.Y.Y...',
      '...XXXXX...',
      '..XWWXWWX..',
      '..XKWXKWX..',
      '..XXXXXXX..',
      '..XXKKKXX..',
      '..X.X.X.X..',
      '.X.X...X.X.',
    ]],
  },
  zoomer: { // saucer-ish: a glass bubble head on a flying plate with blinking lights
    frames: [[
      '....WWW....',
      '...WKWKW...',
      '...WWWWW...',
      '..XXXXXXX..',
      '.XYXDXDXYX.',
      'XXXXXXXXXXX',
      '.DDD...DDD.',
    ], [
      '....WWW....',
      '...WWKWK...',
      '...WWWWW...',
      '..XXXXXXX..',
      '.XDXYXYXDX.',
      'XXXXXXXXXXX',
      '..DDD.DDD..',
    ]],
  },
};
export const DESIGN_KEYS = Object.keys(DESIGNS);
export const BAD_COLORS = ['#b04dff', '#3fd16b', '#ff7a2e', '#ff4fa3', '#2fb8ff'];
export const VOXEL = 0.42;

const tmpC = new THREE.Color();
function shade(hex, k) { return '#' + tmpC.set(hex).multiplyScalar(k).getHexString(); }

// pixel rows -> one merged BufferGeometry of cubes with only the outside faces (vertex colors)
function voxelGeometry(rows, palette, vs = VOXEL, depth = 2) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const at = (x, y, z) => z >= 0 && z < depth && y >= 0 && y < h && x >= 0 && x < w && rows[y][x] && rows[y][x] !== '.' && rows[y][x] !== ' ';
  const pos = [], nor = [], col = [], idx = [];
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < depth; z++) {
    if (!at(x, y, z)) continue;
    tmpC.set(palette[rows[y][x]] || '#ff00ff');
    for (const f of FACES) {
      // grid y goes down, world y goes up: neighbor in -world-y is grid y+1
      const nx = x + f.n[0], ny = y - f.n[1], nz = z + f.n[2];
      if (at(nx, ny, nz)) continue;
      const base = pos.length / 3;
      for (const c of f.c) {
        pos.push((x + c[0] - w / 2) * vs, (h - y - 1 + c[1] - h / 2) * vs, (z + c[2] - depth / 2) * vs);
        nor.push(...f.n);
        col.push(tmpC.r, tmpC.g, tmpC.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function createWorld3D({ tier = 'high' } = {}) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060518');
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 800);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.HemisphereLight('#ffffff', '#5a4a9a', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(-5, 8, 10);
  scene.add(sun);

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const G = {
    box: keep(new THREE.BoxGeometry(1, 1, 1)),
    sph: keep(new THREE.SphereGeometry(1, 16, 12)),
    sphLo: keep(new THREE.SphereGeometry(1, 10, 8)),
    half: keep(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    ico: keep(new THREE.IcosahedronGeometry(1, 1)),
    cone: keep(new THREE.ConeGeometry(1, 1, 10)),
    cyl: keep(new THREE.CylinderGeometry(1, 1, 1, 12)),
    torus: keep(new THREE.TorusGeometry(1, 0.06, 6, 24)),
    smile: keep(new THREE.TorusGeometry(1, 0.18, 6, 12, Math.PI)),
    beam: keep(new THREE.CylinderGeometry(0.08, 1, 1, 20, 1, true)),
    star: keep((() => {
      const s = new THREE.Shape();
      for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.62 : 1.1; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.18, bevelSegments: 2 });
      g.translate(0, 0, -0.35); return g;
    })()),
  };
  const mats = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
    return mats.get(key);
  };
  const basic = (color, opts = {}) => {
    const key = 'b' + color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ color, ...opts }));
    return mats.get(key);
  };
  // the play layer is the brightest thing on screen (v1.1): a little self-glow on the bad guys
  const voxMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: '#2a2438' }));
  const glassMat = keep(new THREE.MeshPhongMaterial({ color: '#a8ecff', transparent: true, opacity: 0.28, shininess: 90, depthWrite: false, side: THREE.DoubleSide }));
  const textures = [];
  function patternMat(colorKey, patternKey) {
    const key = `pat:${colorKey}:${patternKey}`;
    if (mats.has(key)) return mats.get(key);
    const c = COLOR[colorKey];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = c.hex; g.fillRect(0, 0, 64, 64);
    g.fillStyle = ['white', 'yellow', 'gold'].includes(colorKey) ? 'rgba(90,60,140,.45)' : 'rgba(255,255,255,.7)';
    if (patternKey === 'spots') for (const [x, y] of [[10, 12], [40, 8], [26, 32], [54, 36], [12, 52], [44, 56]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
    if (patternKey === 'stripes') for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 6);
    if (patternKey === 'swirl') { g.strokeStyle = g.fillStyle; g.lineWidth = 5; for (let k = 0; k < 2; k++) { g.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = a * 2.2; g.lineTo(16 + k * 32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.stroke(); } }
    if (patternKey === 'sparkles') { g.fillStyle = '#ffffff'; for (const [x, y] of [[10, 10], [44, 18], [24, 44], [54, 52], [6, 34]]) { g.fillRect(x - 1.5, y - 7, 3, 14); g.fillRect(x - 7, y - 1.5, 14, 3); } }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.push(tex);
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: c.golden ? '#6a4800' : patternKey === 'sparkles' ? '#3a2a55' : '#000000' });
    mats.set(key, m);
    return m;
  }
  const part = (parent, geo, material, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const googly = (parent, x, y, z, s) => {
    const eye = new THREE.Group(); eye.position.set(x, y, z); parent.add(eye);
    part(eye, G.sph, '#ffffff', s, s, s * 0.7);
    const pupil = part(eye, G.sph, '#1b1140', s * 0.5, s * 0.5, s * 0.4, 0, 0, s * 0.45);
    return { eye, pupil };
  };

  // ---------- stars, planet, nebula (v1.1: far away, small, dim, slow: a calm backdrop, not the action) ----------
  const STARS = low ? 260 : 700;
  const STAR_NEAR = -140, STAR_FAR = -460;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) { starPos[i * 3] = (Math.random() - 0.5) * 700; starPos[i * 3 + 1] = (Math.random() - 0.5) * 460; starPos[i * 3 + 2] = STAR_NEAR + (STAR_FAR - STAR_NEAR) * Math.random(); }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = keep(new THREE.PointsMaterial({ color: '#8f95c4', size: low ? 2 : 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  const backdrop = new THREE.Group();
  scene.add(backdrop);
  const planet = part(backdrop, G.sph, mat('#6e5a86', { flatShading: false, emissive: '#140c22' }), 20, 20, 20, 300, 140, -560);
  part(backdrop, G.torus, basic('#8a8070', { transparent: true, opacity: 0.3 }), 34, 34, 10, 300, 140, -560, 1.25, 0.2, 0.3);
  part(backdrop, G.sph, mat('#5a6f86', { flatShading: false, emissive: '#081420' }), 5, 5, 5, -200, 110, -540);
  const nebTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); textures.push(t); return t;
  })();
  for (const [x, y, s, c] of [[-60, 10, 160, '#6a3cff'], [50, 30, 140, '#ff4fa3'], [0, -40, 180, '#2fb8ff'], [-20, 50, 120, '#8a5cff']]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex, color: c, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(s * 2, s * 2, 1); sp.position.set(x * 2, y * 2, -580); backdrop.add(sp); disposables.push(sp.material);
  }
  void planet;

  // ---------- bad guys ----------
  const voxCache = new Map();
  function voxGeo(design, color, frame) {
    const key = `${design}:${color}:${frame}`;
    if (!voxCache.has(key)) {
      const pal = { X: color, D: shade(color, 0.6), W: '#ffffff', K: '#1b1140', Y: '#ffe14d', P: '#ff5ea8' };
      voxCache.set(key, voxelGeometry(DESIGNS[design].frames[frame], pal));
    }
    return voxCache.get(key);
  }
  function makeBadGuy(design, color) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const frames = [0, 1].map((f) => { const m = new THREE.Mesh(voxGeo(design, color, f), voxMat); body.add(m); return m; });
    frames[1].visible = false;
    g.userData = { design, color, frames, body, frame: 0 };
    return g;
  }

  // ---------- good guys (from recipe) ----------
  function makeFriend(id) {
    const r = parseId(id);
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const M = patternMat(r.color, r.pattern);
    const C = COLOR[r.color].hex;
    let top = 0.95;
    if (r.shape === 'blob') part(body, G.sph, M, 1.05, 0.95, 0.95);
    else if (r.shape === 'bean') { part(body, G.sph, M, 0.78, 1.1, 0.75); top = 1.1; }
    else if (r.shape === 'puff') { part(body, G.ico, M, 0.85, 0.85, 0.85); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(body, G.sphLo, M, 0.38, 0.38, 0.38, Math.cos(a) * 0.72, Math.sin(a) * 0.72, -0.1); } }
    else if (r.shape === 'jelly') { part(body, G.half, M, 1, 0.95, 0.9, 0, -0.1, 0); for (let i = 0; i < 4; i++) part(body, G.cone, C, 0.14, 0.6, 0.14, -0.6 + i * 0.4, -0.4, 0, Math.PI); top = 0.85; }
    else if (r.shape === 'bun') { part(body, G.sph, M, 1, 0.88, 0.88); for (const s of [-1, 1]) part(body, G.sph, M, 0.2, 0.6, 0.18, s * 0.38, 1.1, -0.1, 0, 0, -s * 0.15); top = 0.85; }
    else { part(body, G.star, M, 0.85, 0.85, 0.85); top = 0.95; }
    // face: big googly eyes + a smile
    const ez = r.shape === 'twinkle' ? 0.6 : r.shape === 'bean' ? 0.62 : 0.78;
    const eyes = [-1, 1].map((s) => googly(body, s * 0.33, 0.12, ez, 0.25));
    part(body, G.smile, '#1b1140', 0.16, 0.16, 0.16, 0, -0.2, ez + 0.06, 0, 0, Math.PI);
    for (const s of [-1, 1]) part(body, G.sphLo, mat('#ff6fa0', { transparent: true, opacity: 0.7 }), 0.11, 0.07, 0.04, s * 0.58, -0.12, ez - 0.05);
    // a waving arm
    const arm = new THREE.Group(); arm.position.set(0.85, 0, 0); body.add(arm);
    part(arm, G.sphLo, M, 0.15, 0.42, 0.15, 0, 0.32, 0);
    // hat
    if (r.hat === 'antenna') for (const s of [-1, 1]) { part(body, G.cyl, '#1b1140', 0.03, 0.55, 0.03, s * 0.28, top + 0.2, 0, 0, 0, -s * 0.35); part(body, G.sphLo, basic('#ffe14d'), 0.11, 0.11, 0.11, s * 0.38, top + 0.47, 0); }
    if (r.hat === 'bow') for (const s of [-1, 1]) part(body, G.cone, '#ff4d8d', 0.18, 0.32, 0.12, 0.35 + s * 0.18, top, 0.1, 0, 0, s * Math.PI / 2);
    if (r.hat === 'party') { part(body, G.cone, '#4d8dff', 0.25, 0.6, 0.25, 0, top + 0.25, 0); part(body, G.sphLo, '#ffe14d', 0.09, 0.09, 0.09, 0, top + 0.56, 0); }
    if (r.hat === 'propeller') { part(body, G.half, '#ff6b3d', 0.38, 0.25, 0.38, 0, top - 0.08, 0); const blade = part(body, G.box, '#ffe14d', 0.9, 0.04, 0.12, 0, top + 0.25, 0); g.userData.propeller = blade; }
    if (r.hat === 'helmet') { const hm = part(body, G.sph, glassMat, 1.35, 1.35, 1.35, 0, 0.05, 0); hm.renderOrder = 2; }
    if (r.hat === 'crown') { part(body, G.cyl, mat('#ffd23f', { emissive: '#5a3a00' }), 0.32, 0.22, 0.32, 0, top + 0.05, 0); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(body, G.cone, mat('#ffd23f', { emissive: '#5a3a00' }), 0.08, 0.2, 0.08, Math.cos(a) * 0.28, top + 0.24, Math.sin(a) * 0.28); } }
    if (COLOR[r.color].golden) { const glow = part(g, G.sphLo, basic('#ffe680', { transparent: true, opacity: 0.25, depthWrite: false }), 1.5, 1.5, 1.5); glow.renderOrder = 1; }
    const s = SIZE[r.size].scale * 0.8;
    g.scale.setScalar(s);
    g.userData = { id, body, arm, eyes, radius: 1.1 * s, propeller: g.userData.propeller };
    return g;
  }

  function makeCage() {
    const g = new THREE.Group();
    const ball = part(g, G.sph, glassMat, 1.3, 1.3, 1.3); ball.renderOrder = 3;
    for (let i = 0; i < 3; i++) part(g, G.torus, basic('#7fe8ff'), 1.32, 1.32, 1.32, 0, 0, 0, Math.PI / 2, (i / 3) * Math.PI, 0);
    part(g, G.torus, basic('#7fe8ff'), 1.32, 1.32, 1.32, Math.PI / 2, 0, 0);
    part(g, G.box, '#ffcc33', 0.36, 0.3, 0.2, 0, -1.25, 0.6);
    g.userData = { radius: 1.35 };
    return g;
  }

  function makePod(color = '#b04dff') {
    const g = new THREE.Group();
    part(g, G.sph, mat('#e8e8f8'), 0.45, 0.3, 0.45, 0, -0.1, 0);
    const pilot = part(g, G.sphLo, color, 0.22, 0.22, 0.22, 0, 0.1, 0);
    for (const s of [-1, 1]) part(g, G.sphLo, '#ffffff', 0.07, 0.07, 0.05, s * 0.08, 0.14, 0.18);
    const dome = part(g, G.sph, glassMat, 0.36, 0.36, 0.36, 0, 0.08, 0); dome.renderOrder = 3;
    const fist = part(g, G.box, color, 0.1, 0.1, 0.1, 0.32, 0.35, 0.1);
    part(g, G.cone, basic('#ffb02e'), 0.18, 0.5, 0.18, 0, -0.55, 0, Math.PI);
    g.userData = { fist, pilot };
    return g;
  }

  const rockMats = ['#8a7a9a', '#9a8a7a', '#7a8aa0'].map((c) => mat(c, { side: THREE.FrontSide }));
  function makeAsteroid(r = 2) {
    // v1.1 fix: IcosahedronGeometry is NON-indexed (each face has its own copies of the corners), so jittering every
    // vertex on its own tore the faces apart ("broken" rocks). Jitter by POSITION instead: every copy of a corner
    // moves the same way, the surface stays closed, then flat normals.
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    const seed = Math.random() * 1000;
    const bump = (x, y, z) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453; return 0.82 + (h - Math.floor(h)) * 0.32; };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = bump(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(z * 1000) / 1000);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMats[(Math.random() * 3) | 0]);
    m.scale.setScalar(r);
    m.userData = { radius: r, ownGeo: true };
    return m;
  }

  // ---------- the boss: Captain Clank's CRAB-TANK ----------
  function makeBoss() {
    const g = new THREE.Group();
    const S = '#ff6b3d', SD = '#c9472a', METAL = '#8a93b8', DARK = '#2a2450';
    const hull = new THREE.Group(); g.add(hull);
    const shell = part(hull, G.sph, S, 4.6, 2.1, 3.2, 0, 1.2, 0);
    part(hull, G.box, SD, 9, 0.5, 4.8, 0, 0.1, 0);
    for (let i = 0; i < 7; i++) part(hull, G.sphLo, '#ffd27a', 0.22, 0.22, 0.22, -3.6 + i * 1.2, 0.35, 2.4);
    // treads
    for (const s of [-1, 1]) {
      part(hull, G.box, DARK, 3.2, 1.1, 4.4, s * 3.2, -0.8, 0);
      for (let i = 0; i < 4; i++) part(hull, G.cyl, METAL, 0.5, 0.4, 0.5, s * 3.2, -0.8, -1.5 + i, 0, 0, Math.PI / 2).scale.set(0.5, 3.3, 0.5);
    }
    // legs (they scuttle)
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group(); leg.position.set(s * 4.2, 0.6, -1.2 + i * 1.2); hull.add(leg);
      part(leg, G.box, S, 2.4, 0.35, 0.35, s * 1.1, 0.4, 0, 0, 0, s * 0.5);
      part(leg, G.box, SD, 0.35, 2.2, 0.35, s * 2.2, -0.4, 0, 0, 0, -s * 0.2);
      leg.userData.s = s; leg.userData.i = i;
      legs.push(leg);
    }
    // googly eyes on stalks
    const eyes = [];
    for (const s of [-1, 1]) {
      part(hull, G.cyl, SD, 0.18, 1.6, 0.18, s * 1.6, 3.4, 1.8);
      eyes.push(googly(hull, s * 1.6, 4.3, 1.9, 0.7));
    }
    // a big grin plate
    part(hull, G.box, '#ffffff', 2.6, 0.5, 0.2, 0, 0.95, 3.15);
    for (let i = 0; i < 5; i++) part(hull, G.box, DARK, 0.06, 0.5, 0.22, -1 + i * 0.5, 0.95, 3.16);
    // the glass dome with the driver inside
    const domeGroup = new THREE.Group(); domeGroup.position.set(0, 3.1, -0.4); hull.add(domeGroup);
    const driver = makeBadGuy('squirm', '#3fd16b'); driver.scale.setScalar(0.55); driver.position.set(0, 0.6, 0); domeGroup.add(driver);
    const dome = part(domeGroup, G.half, glassMat, 1.7, 1.9, 1.7, 0, 0, 0); dome.renderOrder = 3;
    part(domeGroup, G.cyl, METAL, 1.75, 0.3, 1.75, 0, 0, 0);
    // the power core (phase 3), behind an armor plate
    const core = part(hull, G.sph, basic('#5ee0ff'), 0.9, 0.9, 0.5, 0, 1.6, 3.05);
    const coreRing = part(hull, G.torus, basic('#ffffff'), 1.05, 1.05, 1.05, 0, 1.6, 3.15);
    const plate = part(hull, G.box, METAL, 2.6, 2, 0.4, 0, 1.6, 3.2);
    for (const [x, y] of [[-1, 0.8], [1, 0.8], [-1, -0.8], [1, -0.8]]) part(plate, G.sphLo, '#ffd27a', 0.06, 0.08, 0.3, x * 0.4, y * 0.35, 0.5);
    // the cargo hatch on the back (friends inside!)
    const hatch = part(hull, G.box, SD, 3, 0.3, 1.6, 0, 2.6, -2.2, -0.5, 0, 0);
    // arms + claws
    const claws = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 4.6, 1.4, 1.2); hull.add(arm);
      part(arm, G.box, S, 2.2, 0.7, 0.7, s * 1.0, 0.6, 0.6, 0, -s * 0.4, s * 0.5);
      const claw = new THREE.Group(); claw.position.set(s * 2.2, 2.0, 1.6); arm.add(claw);
      const upper = new THREE.Group(); claw.add(upper);
      part(upper, G.box, S, 1.0, 0.7, 3.0, 0, 0.75, 1.0, 0.2, 0, 0);
      part(upper, G.cone, '#ffd27a', 0.3, 0.6, 0.3, 0, 0.55, 2.6, Math.PI / 2 + 0.3, 0, 0);
      const lower = new THREE.Group(); claw.add(lower);
      part(lower, G.box, SD, 0.9, 0.6, 2.6, 0, -0.7, 0.9, -0.2, 0, 0);
      const armor = part(claw, G.box, METAL, 1.4, 1.4, 1.2, 0, 0, -0.6);
      const glow = part(claw, G.sph, basic('#ffe14d', { transparent: true, opacity: 0.85 }), 0.6, 0.6, 0.6, 0, 0, 0.2);
      const glowRing = part(claw, G.torus, basic('#ffffff', { transparent: true, opacity: 0.9 }), 0.85, 0.85, 0.85, 0, 0, 0.3);
      const anchor = new THREE.Object3D(); anchor.position.set(0, 0, 1.6); claw.add(anchor);
      // v1.1: a shield bubble for the arm that's "powered up" (raised high, can't be hurt)
      const shield = part(claw, G.sph, new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.22, depthWrite: false }), 2.4, 2.4, 2.4, 0, 0.3, 0.6);
      shield.renderOrder = 4; shield.visible = false; disposables.push(shield.material);
      arm.userData.z0 = arm.position.z;
      claws.push({ side: s, arm, claw, upper, lower, armor, glow, glowRing, anchor, shield });
    }
    g.userData = { hull, shell, legs, eyes, domeGroup, driver, core, coreRing, plate, hatch, claws };
    return g;
  }

  // ---------- debris cubes (instanced; space = no gravity, a little drag) ----------
  const DEBRIS = low ? 160 : 420;
  const debrisMesh = new THREE.InstancedMesh(G.box, keep(new THREE.MeshLambertMaterial({ flatShading: true })), DEBRIS);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setColorAt(i, tmpC.set('#ffffff'));
  scene.add(debrisMesh);
  const parts = Array.from({ length: DEBRIS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2, rx: 0, ry: 0, spin: 0 }));
  let partNext = 0;
  const dummy = new THREE.Object3D();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setMatrixAt(i, hide);
  function debris(x, y, z, { count = 20, colors = ['#ffffff'], speed = 7, size = 0.25, vz = 0, vy = 0, life = 1.4 } = {}) {
    count = Math.min(count, DEBRIS);
    for (let k = 0; k < count; k++) {
      const i = partNext; partNext = (partNext + 1) % DEBRIS;
      const p = parts[i];
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      const s = speed * (0.35 + Math.random() * 0.85);
      Object.assign(p, { life: life * (0.7 + Math.random() * 0.6), x, y, z, vx: q * Math.cos(a) * s, vy: u * s + vy, vz: q * Math.sin(a) * s + vz, s: size * (0.5 + Math.random()), rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12 });
      debrisMesh.setColorAt(i, tmpC.set(colors[(Math.random() * colors.length) | 0]));
    }
    debrisMesh.instanceColor.needsUpdate = true;
  }
  function updateDebris(dt) {
    let any = false;
    const drag = Math.exp(-dt * 0.9);
    for (let i = 0; i < DEBRIS; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * dt * 0.7;
      if (p.life <= 0 || p.z > -0.3) { p.life = 0; debrisMesh.setMatrixAt(i, hide); continue; }
      const k = Math.min(1, p.life / 0.4);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0); dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    if (any) debrisMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- the tractor beam ----------
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: '#5ec8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(G.beam, beamMat);
  beam.visible = false; beam.renderOrder = 5;
  scene.add(beam);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), mid = new THREE.Vector3();

  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
  let fov = 70;

  return {
    scene, camera,
    makeBadGuy, makeFriend, makeCage, makePod, makeAsteroid, makeBoss, debris,
    add(o) { scene.add(o); return o; },
    remove(o) {
      if (!o) return;
      o.parent?.remove(o);
      if (o.userData?.ownGeo) o.geometry.dispose();
    },

    // v1.1: live star look (🔧 Star size / Star brightness)
    setStars({ size, bright }) { if (size != null) starMat.size = size * (low ? 1.2 : 1); if (bright != null) starMat.opacity = bright; },
    // the beam from the ship (from) to the friend (to), 0..1 strength
    setBeam(from, to, alpha) {
      if (!(alpha > 0.01)) { beam.visible = false; return; }
      beam.visible = true;
      dir.set(from.x - to.x, from.y - to.y, from.z - to.z);
      const len = dir.length();
      mid.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      beam.position.copy(mid);
      beam.quaternion.setFromUnitVectors(up, dir.normalize());
      const r = 1.6 + Math.sin(performance.now() / 60) * 0.1;
      beam.scale.set(r, len, r);
      beamMat.opacity = 0.35 * alpha;
    },

    // stars rush past at `speed` (m/s); call every frame
    tick(dt, speed) {
      const p = starGeo.attributes.position;
      for (let i = 0; i < STARS; i++) {
        let z = p.array[i * 3 + 2] + speed * dt * 0.12; // slow parallax: the stars are far away
        if (z > STAR_NEAR) z -= STAR_NEAR - STAR_FAR;
        p.array[i * 3 + 2] = z;
      }
      p.needsUpdate = true;
      updateDebris(dt);
    },

    setCamera({ x = 0, y = 0, roll = 0, yaw = 0, pitch = 0, fov: f = 70, shake = 0, aspect = 16 / 9 }) {
      camera.position.set(x + (shake ? (Math.random() - 0.5) * shake : 0), y + (shake ? (Math.random() - 0.5) * shake : 0), 0);
      camera.rotation.set(pitch, yaw, roll);
      const base = aspect < 1 ? f + 18 : f;
      if (Math.abs(fov - base) > 0.01) { fov = base; camera.fov = fov; camera.updateProjectionMatrix(); }
      backdrop.position.set(camera.position.x * 0.95, camera.position.y * 0.95, 0);
      stars.position.x = x * 0.3;
    },

    toScreen(x, y, z, W, H) {
      v3.set(x, y, z).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, behind: v3.z > 1 || v3.z < -1 };
    },
    worldPos(obj) { obj.getWorldPosition(v3b); return { x: v3b.x, y: v3b.y, z: v3b.z }; },
    // a world object's screen position + its on-screen radius (px)
    screenOf(obj, W, H, radius = obj.userData?.radius ?? 1) {
      obj.getWorldPosition(v3b);
      const c = this.toScreen(v3b.x, v3b.y, v3b.z, W, H);
      const e = this.toScreen(v3b.x, v3b.y + radius, v3b.z, W, H);
      return { x: c.x, y: c.y, r: Math.abs(c.y - e.y), behind: c.behind, z: v3b.z, wx: v3b.x, wy: v3b.y };
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
      scene.traverse((o) => { if (o.userData?.ownGeo) o.geometry.dispose(); });
      for (const g of voxCache.values()) g.dispose();
      for (const m of mats.values()) m.dispose();
      for (const t of textures) t.dispose();
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
