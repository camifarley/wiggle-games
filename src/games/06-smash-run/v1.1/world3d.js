// v1.1: no power gloves (they blocked the view), and the whole world tilts UPHILL so things roll down a
// mountain at you. Everything that lives on the ground is in the tilted `world` group.
// The 3D canyon: three.js scene, low-poly smashables, debris, the rock troll and the
// MEGA BOULDER. Rendered into an offscreen WebGL canvas that the game draws onto the 2D stage (so the
// core's HUD, fx and screen shake stay on top).
//
// Space: the player stands still at the origin looking down -z; the world scrolls toward +z.
// Ground y = 0, eye height ~1.5 m.

import * as THREE from 'three';

export const WORLDS = [
  { n: 1, name: 'Rocky Canyon', sky: '#7ec8ff', fog: '#cdeaff', ground: '#e0a96d', stripe: '#c98f55', decor: 'rocks', kinds: ['boulder', 'boulder', 'boulder', 'boulder', 'golden'] },
  { n: 2, name: 'Pumpkin Patch', sky: '#ffb36b', fog: '#ffd9a8', ground: '#6a9c3f', stripe: '#5a8a33', decor: 'patch', kinds: ['pumpkin', 'pumpkin', 'pumpkin', 'scarecrow'] },
  { n: 3, name: 'Snowy Mountain', sky: '#9fd3ff', fog: '#eef8ff', ground: '#f7fbff', stripe: '#dce9f6', decor: 'pines', kinds: ['snowball', 'snowball', 'snowman', 'ice'] },
  { n: 4, name: 'Candy Land', sky: '#ffc2e6', fog: '#ffe3f3', ground: '#ff9ed2', stripe: '#ffd166', decor: 'candy', kinds: ['pinata', 'gumball', 'gumball', 'cupcake'] },
  { n: 5, name: 'MEGA BOULDER', sky: '#6a4aa0', fog: '#a58ad6', ground: '#b48a5e', stripe: '#9c7650', decor: 'crystals', kinds: ['boulder', 'golden', 'pumpkin', 'scarecrow', 'snowball', 'snowman', 'ice', 'pinata', 'gumball', 'cupcake'] },
];

// levels: how many times it splits (3 = giant -> medium -> small). r = radius per level.
export const KINDS = {
  boulder: { levels: 3, r: [0, 0.45, 0.8, 1.35], colors: ['#8d7b6a', '#a08f7e', '#6f6052'], points: 50, eyes: true, rolls: true },
  golden: { levels: 2, r: [0, 0.5, 0.9], colors: ['#ffd23f', '#ffb400', '#fff1a8'], points: 250, eyes: true, rolls: true, gold: true },
  pumpkin: { levels: 2, r: [0, 0.5, 0.95], colors: ['#ff8a1f', '#ffb066', '#f5e6c8'], points: 60, eyes: true, rolls: true },
  scarecrow: { levels: 1, r: [0, 0.9], colors: ['#ffd84d', '#e8b84a', '#c0392b'], points: 120, walks: true },
  snowball: { levels: 2, r: [0, 0.5, 0.85], colors: ['#ffffff', '#e6f2ff', '#cfe6ff'], points: 60, eyes: true, rolls: true, grows: true },
  snowman: { levels: 1, r: [0, 0.9], colors: ['#ffffff', '#ff8a1f', '#333344'], points: 150, walks: true },
  ice: { levels: 1, r: [0, 0.75], colors: ['#9be7ff', '#d8f6ff', '#5ec8f0'], points: 90, slides: true },
  pinata: { levels: 2, r: [0, 0.55, 0.95], colors: ['#ff5ea8', '#5ee0ff', '#ffcc33', '#7dff6a', '#b48cff'], points: 100, walks: true },
  gumball: { levels: 2, r: [0, 0.4, 0.7], colors: ['#ff4d6d', '#4dd2ff', '#ffe14d', '#7dff6a'], points: 50, rolls: true, eyes: true },
  cupcake: { levels: 1, r: [0, 0.85], colors: ['#ffa8d6', '#c98f55', '#ff4d6d'], points: 120, walks: true },
};

const pick = (a) => a[(Math.random() * a.length) | 0];

export function createWorld3D({ tier = 'high' } = {}) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#7ec8ff');
  scene.fog = new THREE.Fog('#cdeaff', 26, 135); // far enough to see the mountain as a misty shape
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 170);
  camera.position.set(0, 1.5, 0);
  camera.rotation.x = 0.07; // look a little up the hill
  scene.add(camera);
  // the slope: far away is higher, so smashables come rolling DOWN the mountain toward you
  const SLOPE = 0.17; // radians (~10 degrees)
  const world = new THREE.Group();
  world.rotation.x = SLOPE;
  scene.add(world);
  world.updateMatrixWorld();

  const hemi = new THREE.HemisphereLight('#ffffff', '#806040', 1.6);
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(-4, 10, 6);
  scene.add(hemi, sun);

  // ---------- shared geometry + cached materials ----------
  const G = {
    ico: new THREE.IcosahedronGeometry(1, 0),
    ico1: new THREE.IcosahedronGeometry(1, 1),
    sph: new THREE.SphereGeometry(1, 10, 7),
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 7),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 9),
    oct: new THREE.OctahedronGeometry(1, 0),
    tet: new THREE.TetrahedronGeometry(1, 0),
  };
  const mats = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
    return mats.get(key);
  };
  const mesh = (geo, color, sx = 1, sy = sx, sz = sx, opts) => {
    const m = new THREE.Mesh(geo, mat(color, opts));
    m.scale.set(sx, sy, sz);
    return m;
  };

  // ---------- ground (scrolling stripes) + side decor ----------
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 64; groundCanvas.height = 64;
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(4, 30);
  groundTex.magFilter = THREE.NearestFilter;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 180), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -70;
  world.add(ground);
  // the mountain at the top of the hill, where everything comes rolling down from
  const mountain = new THREE.Group();
  for (const [x, h, r, col] of [[0, 34, 26, '#8c7a6b'], [-30, 24, 20, '#7d6e62'], [32, 27, 21, '#9a8676'], [-58, 16, 16, '#6f6358'], [60, 18, 17, '#857364']]) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshLambertMaterial({ color: col, flatShading: true }));
    peak.position.set(x, h / 2 - 1, -118 - Math.abs(x) * 0.15);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
    cap.position.set(0, h * 0.34, 0);
    peak.add(cap);
    mountain.add(peak);
  }
  world.add(mountain);
  function paintGround(c1, c2) {
    const g = groundCanvas.getContext('2d');
    g.fillStyle = c1; g.fillRect(0, 0, 64, 64);
    g.fillStyle = c2; g.fillRect(0, 0, 64, 32);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(28, 0, 8, 64); // the path down the middle
    groundTex.needsUpdate = true;
  }

  const decor = new THREE.Group();
  world.add(decor);
  const DECOR_N = low ? 10 : 18, DECOR_SPAN = 110;
  function buildDecor(kind) {
    decor.clear();
    for (let i = 0; i < DECOR_N * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const g = new THREE.Group();
      const s = 1 + Math.random() * 1.5;
      if (kind === 'rocks') {
        g.add(mesh(G.ico, pick(['#b0703f', '#9a5f34', '#c27f48']), 3 * s, 4 * s, 3 * s));
        g.children[0].position.y = 1.5 * s; g.children[0].rotation.set(Math.random(), Math.random(), 0);
      } else if (kind === 'patch') {
        const bush = mesh(G.ico, '#3f7a2a', 1.4 * s); bush.position.y = 0.8 * s; g.add(bush);
        const p = mesh(G.sph, '#ff8a1f', 0.6, 0.45, 0.6); p.position.set(1.2, 0.4, 0.5); g.add(p);
        const post = mesh(G.box, '#8a5a2b', 0.2, 1.4, 0.2); post.position.set(-1.6, 0.7, 0); g.add(post);
      } else if (kind === 'pines') {
        for (let k = 0; k < 3; k++) { const c = mesh(G.cone, k === 2 ? '#ffffff' : '#2f7a4a', 1.6 * s - k * 0.4 * s, 1.6 * s, 1.6 * s - k * 0.4 * s); c.position.y = (1 + k * 1.1) * s; g.add(c); }
        const tr = mesh(G.cyl, '#6b4a2b', 0.25, 0.8, 0.25); tr.position.y = 0.4; g.add(tr);
      } else if (kind === 'candy') {
        const stick = mesh(G.cyl, '#ffffff', 0.15, 3 * s, 0.15); stick.position.y = 1.5 * s; g.add(stick);
        const pop = mesh(G.cyl, pick(['#ff4d6d', '#4dd2ff', '#7dff6a', '#ffcc33', '#b48cff']), 1.1 * s, 0.25, 1.1 * s); pop.rotation.x = Math.PI / 2; pop.position.y = 3 * s; g.add(pop);
      } else {
        for (let k = 0; k < 3; k++) { const c = mesh(G.oct, pick(['#b48cff', '#5ee0ff', '#ff5ea8']), 0.6 * s, 2 * s, 0.6 * s, { emissive: '#3a1a6a' }); c.position.set((k - 1) * 0.9, s * 1.5, 0); c.rotation.z = (k - 1) * 0.3; g.add(c); }
      }
      g.position.set(side * (6.5 + Math.random() * 5), 0, -i / 2 * (DECOR_SPAN / DECOR_N) + 10);
      g.userData.side = side;
      decor.add(g);
    }
  }

  // ---------- smashables ----------
  function eyes(r) {
    const e = new THREE.Group();
    for (const sx of [-1, 1]) {
      const w = mesh(G.sph, '#ffffff', r * 0.28); w.position.set(sx * r * 0.36, r * 0.18, r * 0.82);
      const p = mesh(G.sph, '#111111', r * 0.13); p.position.set(sx * r * 0.36, r * 0.14, r * 1.08);
      e.add(w, p);
    }
    return e;
  }

  // Returns a THREE.Group with userData.body (the part that rolls) and userData.eyes.
  function makeSmashable(kind, level) {
    const K = KINDS[kind];
    const r = K.r[level];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const c = K.colors;
    switch (kind) {
      case 'boulder': case 'golden': {
        const m = mesh(G.ico, kind === 'golden' ? c[0] : pick(c), r, r * 0.92, r, kind === 'golden' ? { emissive: '#664400' } : undefined);
        body.add(m);
        break;
      }
      case 'pumpkin': {
        const m = mesh(G.sph, c[0], r, r * 0.78, r); body.add(m);
        for (let k = 0; k < 4; k++) { const rib = mesh(G.sph, '#e8730f', r * 0.25, r * 0.76, r * 0.98); rib.rotation.y = (k * Math.PI) / 4; body.add(rib); }
        const stem = mesh(G.cyl, '#3f7a2a', r * 0.1, r * 0.35, r * 0.1); stem.position.y = r * 0.85; body.add(stem);
        break;
      }
      case 'snowball': case 'gumball': {
        body.add(mesh(kind === 'snowball' ? G.ico1 : G.sph, pick(c), r));
        break;
      }
      case 'scarecrow': {
        const shirt = mesh(G.box, '#c0392b', r * 0.8, r * 1.0, r * 0.4); shirt.position.y = r * 1.0; body.add(shirt);
        const arms = mesh(G.box, '#e8b84a', r * 2.0, r * 0.18, r * 0.18); arms.position.y = r * 1.3; body.add(arms);
        const head = mesh(G.sph, '#f3d08a', r * 0.42); head.position.y = r * 1.8; body.add(head);
        const hat = mesh(G.cone, '#8a5a2b', r * 0.6, r * 0.5, r * 0.6); hat.position.y = r * 2.25; body.add(hat);
        const pole = mesh(G.cyl, '#8a5a2b', r * 0.08, r * 1.2, r * 0.08); pole.position.y = r * 0.3; body.add(pole);
        break;
      }
      case 'snowman': {
        [[0.55, 0.55], [0.4, 1.35], [0.3, 1.95]].forEach(([s, y]) => { const b = mesh(G.ico1, '#ffffff', r * s); b.position.y = r * y; body.add(b); });
        const nose = mesh(G.cone, '#ff8a1f', r * 0.08, r * 0.4, r * 0.08); nose.rotation.x = Math.PI / 2; nose.position.set(0, r * 1.95, r * 0.45); nose.name = 'nose'; body.add(nose);
        const hat = mesh(G.cyl, '#333344', r * 0.25, r * 0.35, r * 0.25); hat.position.y = r * 2.35; body.add(hat);
        break;
      }
      case 'ice': {
        body.add(mesh(G.box, c[0], r * 1.6, r * 1.4, r * 1.6, { transparent: true, opacity: 0.8, emissive: '#1a4a66' }));
        break;
      }
      case 'pinata': {
        const col = pick(c);
        const b = mesh(G.box, col, r * 1.4, r * 0.9, r * 0.7); b.position.y = r * 1.0; body.add(b);
        const neck = mesh(G.box, pick(c), r * 0.4, r * 0.8, r * 0.4); neck.position.set(r * 0.5, r * 1.6, 0); body.add(neck);
        const head = mesh(G.box, pick(c), r * 0.6, r * 0.4, r * 0.45); head.position.set(r * 0.7, r * 2.0, 0); body.add(head);
        for (const lx of [-0.45, 0.45]) { const leg = mesh(G.box, col, r * 0.22, r * 0.6, r * 0.22); leg.position.set(r * lx, r * 0.3, 0); body.add(leg); }
        break;
      }
      case 'cupcake': {
        const cup = mesh(G.cyl, '#c98f55', r * 0.55, r * 0.6, r * 0.55); cup.position.y = r * 0.3; body.add(cup);
        const icing = mesh(G.cone, '#ffa8d6', r * 0.7, r * 0.9, r * 0.7); icing.position.y = r * 1.05; body.add(icing);
        const cherry = mesh(G.sph, '#ff4d6d', r * 0.16); cherry.position.y = r * 1.55; body.add(cherry);
        break;
      }
    }
    if (K.eyes) { const e = eyes(r); root.add(e); root.userData.eyes = e; }
    else if (K.walks) { const e = eyes(r * 0.5); e.position.y = kind === 'snowman' ? r * 1.85 : kind === 'scarecrow' ? r * 1.75 : r * 1.2; e.position.z = kind === 'pinata' ? 0 : -r * 0.1; root.add(e); root.userData.eyes = e; }
    root.userData.body = body;
    root.userData.r = r;
    root.userData.centerY = K.walks ? r : 0; // aim point above the root (rollers are centered on it)
    root.userData.baseY = K.walks ? 0 : kind === 'ice' ? r * 0.7 : r * 0.92;
    world.add(root);
    return root;
  }

  function remove(obj) { world.remove(obj); }

  // ---------- debris (instanced) ----------
  const DEBRIS = low ? 140 : tier === 'medium' ? 320 : 650;
  const debrisMesh = new THREE.InstancedMesh(G.tet, new THREE.MeshLambertMaterial({ flatShading: true }), DEBRIS);
  debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debrisMesh.frustumCulled = false;
  const tmpColor = new THREE.Color();
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setColorAt(i, tmpColor.set('#ffffff'));
  world.add(debrisMesh);
  const parts = Array.from({ length: DEBRIS }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, rx: 0, ry: 0, spin: 0 }));
  let partNext = 0;
  const dummy = new THREE.Object3D();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEBRIS; i++) debrisMesh.setMatrixAt(i, hide);

  function debris(x, y, z, { count = 20, colors = ['#888'], speed = 6, size = 0.18, up = 4 } = {}) {
    count = Math.min(count, DEBRIS);
    for (let k = 0; k < count; k++) {
      const p = parts[partNext]; const i = partNext;
      partNext = (partNext + 1) % DEBRIS;
      const a = Math.random() * Math.PI * 2, el = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      Object.assign(p, { life: 1 + Math.random() * 0.6, max: 1.6, x, y, z,
        vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.abs(Math.sin(el)) * sp + up, vz: Math.sin(a) * Math.cos(el) * sp + 2,
        s: size * (0.5 + Math.random()), rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 18 });
      debrisMesh.setColorAt(i, tmpColor.set(pick(colors)));
    }
    debrisMesh.instanceColor.needsUpdate = true;
  }

  function updateDebris(dt, scroll) {
    let any = false;
    for (let i = 0; i < DEBRIS; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + scroll) * dt;
      if (p.y < p.s) { p.y = p.s; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      if (p.life <= 0 || p.z > 2) { p.life = 0; debrisMesh.setMatrixAt(i, hide); continue; }
      const k = Math.min(1, p.life / 0.4);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0); dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    if (any) debrisMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- (v1.1: power gloves removed: they were in the way. Blasts start from the lower corners.) ----------
  const gloves = {};
  const gloveMats = [];

  // ---------- projectiles (auto-aim fist blasts) ----------
  const shots = [];
  function shoot(from, target, onHit) {
    const m = mesh(G.sph, '#ffe14d', 0.25, 0.25, 0.25, { emissive: '#ff8a00' });
    const local = world.worldToLocal(from.clone()); // shots fly in the tilted world's coordinates
    m.position.copy(local);
    world.add(m);
    shots.push({ m, from: local, target, t: 0, onHit });
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += dt / 0.13;
      const to = s.target.position;
      s.m.position.lerpVectors(s.from, new THREE.Vector3(to.x, to.y + (s.target.userData.centerY || 0.5), to.z), Math.min(1, s.t));
      s.m.scale.setScalar(0.25 + s.t * 0.4);
      if (s.t >= 1) { world.remove(s.m); shots.splice(i, 1); s.onHit(); }
    }
  }

  // ---------- the sleeping rock troll ----------
  const troll = new THREE.Group();
  {
    const body = mesh(G.ico, '#7d8a6a', 3.2, 2.6, 2.6); body.position.y = 2.2; troll.add(body);
    const moss = mesh(G.ico, '#5e8a3a', 2.2, 0.8, 2.0); moss.position.set(0.4, 4.4, -0.4); troll.add(moss);
    const head = mesh(G.ico, '#8d9a78', 1.7); head.position.set(0, 4.2, 1.8); troll.add(head);
    const nose = mesh(G.ico, '#a0ad8a', 0.6, 0.5, 0.7); nose.position.set(0, 3.9, 3.4); troll.add(nose);
    for (const sx of [-1, 1]) {
      const ear = mesh(G.cone, '#7d8a6a', 0.5, 1.0, 0.5); ear.position.set(sx * 1.6, 5.2, 1.6); ear.rotation.z = -sx * 0.6; troll.add(ear);
      const lid = mesh(G.box, '#3a3a2a', 0.6, 0.1, 0.1); lid.position.set(sx * 0.65, 4.5, 3.35); lid.userData.lid = true; troll.add(lid);
      const eye = mesh(G.sph, '#ffffff', 0.32); eye.position.set(sx * 0.65, 4.55, 3.2); eye.visible = false; eye.userData.open = true; troll.add(eye);
      const pupil = mesh(G.sph, '#111111', 0.15); pupil.position.set(sx * 0.65, 4.5, 3.5); pupil.visible = false; pupil.userData.open = true; troll.add(pupil);
      const foot = mesh(G.ico, '#6a7558', 1.0, 0.6, 1.3); foot.position.set(sx * 1.8, 0.4, 1.6); troll.add(foot);
    }
  }
  troll.visible = false;
  world.add(troll);
  function trollEyes(open) {
    troll.traverse((o) => { if (o.userData.open) o.visible = open; if (o.userData.lid) o.visible = !open; });
  }
  const gems = [];
  function makeGem() {
    const m = mesh(G.oct, pick(['#5ee0ff', '#ff5ea8', '#7dff6a', '#ffcc33', '#b48cff']), 0.35, 0.5, 0.35, { emissive: '#333366' });
    world.add(m);
    return m;
  }

  // ---------- MEGA BOULDER ----------
  const mega = new THREE.Group();
  {
    const b = mesh(G.ico, '#8d7b6a', 6, 5.6, 6); b.position.y = 5.2; mega.add(b);
    const e = eyes(6); e.position.y = 5.2; mega.add(e);
    mega.userData.cracks = new THREE.Group(); mega.add(mega.userData.cracks);
  }
  mega.visible = false;
  world.add(mega);
  function megaCrack(n) {
    const cr = mega.userData.cracks;
    while (cr.children.length < n) {
      const k = cr.children.length;
      const c = mesh(G.box, '#2a1d14', 0.18, 1.6 + Math.random() * 2.2, 0.2);
      const a = Math.random() * Math.PI * 2, rr = 1.5 + Math.random() * 3;
      c.position.set(Math.cos(a) * rr, 5.2 + Math.sin(a) * rr * 0.9, 5.6 - rr * 0.25);
      c.rotation.z = a + Math.PI / 2 + (Math.random() - 0.5);
      c.scale.y *= 1 + k * 0.08;
      cr.add(c);
    }
  }

  // ---------- theme ----------
  let lightK = 1, theme = WORLDS[0];
  function setWorld(w) {
    theme = w;
    paintGround(w.ground, w.stripe);
    buildDecor(w.decor);
    applyLight();
  }
  function applyLight() {
    const sky = new THREE.Color(theme.sky).multiplyScalar(0.25 + 0.75 * lightK);
    scene.background.copy(sky);
    scene.fog.color.copy(new THREE.Color(theme.fog).multiplyScalar(0.25 + 0.75 * lightK));
    hemi.intensity = 0.5 + 1.1 * lightK;
    sun.intensity = 0.4 + 1.4 * lightK;
  }

  const v3 = new THREE.Vector3();
  let groundScroll = 0;

  return {
    canvas, scene, camera, gloves, troll, mega, gems, G,
    makeSmashable, remove, debris, shoot, makeGem, megaCrack, trollEyes, setWorld,
    get theme() { return theme; },
    // 0 = dark (troll round), 1 = full daylight
    setLight(k) { lightK = k; applyLight(); },
    setPower(k) { for (const m of gloveMats) m.emissive.setRGB(k * 0.9, k * 0.6, 0); },

    // scroll = how far the world moved toward the player this frame (m)
    update(dt, scroll, t) {
      groundScroll += scroll;
      groundTex.offset.y = (groundScroll / (180 / 30)) % 1;
      for (const d of decor.children) {
        d.position.z += scroll;
        if (d.position.z > 12) { d.position.z -= DECOR_SPAN + 10; d.position.x = d.userData.side * (6.5 + Math.random() * 5); }
      }
      updateDebris(dt, scroll);
      updateShots(dt);
      for (const g of gems) { g.rotation.y += dt * 3; g.position.y = 0.8 + Math.sin(t * 3 + g.position.x) * 0.15; }
    },

    // screen position (CSS px) of a world point
    toScreen(x, y, z, W, H) {
      v3.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera); // x, y, z are on the tilted hill
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, behind: v3.z > 1 };
    },

    // where a punch blast starts: just below the view, left or right (there are no gloves any more)
    gloveWorldPos(side) { camera.updateMatrixWorld(); return camera.localToWorld(new THREE.Vector3(side === 'left' ? -0.5 : 0.5, -0.45, -1.2)); },

    render(W, H, dpr) {
      const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        camera.aspect = W / H;
        // portrait phones: widen the view so the path still fits
        camera.fov = W < H ? 92 : 70;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      return canvas;
    },

    dispose() {
      scene.traverse((o) => { if (o.isMesh && o.material?.map) o.material.map.dispose(); });
      for (const m of mats.values()) m.dispose();
      for (const g of Object.values(G)) g.dispose();
      debrisMesh.geometry.dispose?.(); debrisMesh.material.dispose();
      groundTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
