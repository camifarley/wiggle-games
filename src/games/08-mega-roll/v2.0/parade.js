// The PARADE (v2.0): every animal the ball bonks hops up happily and joins a parade trotting behind the ball,
// following the exact path the ball rolled. The chase camera only sees a few meters behind the ball, so the
// parade flies in a V (like geese): row r trots r meters back and a little further out to each side, and the
// front rows stay in view right beside the ball. Rows beyond the cap show as a "+N" flag. At the finish they
// all pile into a group photo.
//
//   const P = createParade(W3, { cap })   cap = how many are drawn (per perf tier); the rest show as a "+N" flag
//   P.record(x, d)                        call every frame with the ball's position (builds the trail)
//   P.join(mesh, o)                       an animal joins (its mesh leaves its chunk)
//   P.update(dt, t, ball)                 trot along the trail (or stand in the photo)
//   P.photo(x, d)                         arrange everyone in rows facing the camera, cheering, in front of (x, d)
//   P.count, P.visible, P.extra, P.flagPos  (flagPos: world point above the last drawn animal, for the "+N" sign)

import { groundY } from './world3d.js';

const ROW_BACK = 0.8, ROW_SIDE = 0.55, FIRST_SIDE = 1.7; // V formation: meters back / out per row
const SHRINK = 0.72; // parade animals are a bit smaller (BIG ones too), so they never hide the ball or the path

export function createParade(W3, { cap = 24 } = {}) {
  const members = []; // { mesh, o, t (since joined), x, d, y, hop, state: 'hop' | 'walk' | 'photo', slot }
  const trail = [];   // ball positions, newest last, every ~0.35 m of travel: { x, d }
  let photoMode = false;

  // the point `dist` meters back along the trail from the newest point
  function along(dist) {
    let need = dist;
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i], b = trail[i - 1];
      const seg = Math.hypot(a.x - b.x, a.d - b.d);
      if (seg >= need) { const k = need / seg; return { x: a.x + (b.x - a.x) * k, d: a.d + (b.d - a.d) * k, dirX: a.x - b.x, dirD: a.d - b.d }; }
      need -= seg;
    }
    const last = trail[0] || { x: 0, d: 0 };
    return { x: last.x, d: last.d - need, dirX: 0, dirD: 1 };
  }

  const api = {
    get count() { return members.length; },
    get visible() { return Math.min(members.length, cap); },
    get extra() { return Math.max(0, members.length - cap); },
    members,
    set cap(v) { cap = v; },
    get flagPos() {
      const m = members[Math.min(members.length, cap) - 1];
      return m ? { x: m.x, y: groundY(m.d) + m.y + 2.4, z: -m.d } : null;
    },

    record(x, d) {
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(x - last.x, d - last.d) > 0.35) trail.push({ x, d });
      // keep enough trail for the whole visible line
      const keep = Math.ceil((cap / 2 + 2) * ROW_BACK / 0.35) + 30;
      if (trail.length > keep) trail.splice(0, trail.length - keep);
    },

    join(mesh, o) {
      W3.adopt(mesh);
      const p = mesh.position;
      const m = { mesh, o, t: 0, x: p.x, d: -p.z, y: 0, vy: 7.5, state: 'hop', slot: members.length };
      members.push(m);
      mesh.visible = m.slot < cap;
      mesh.userData.body.rotation.set(0, 0, 0);
      mesh.scale.setScalar(Math.min(SHRINK, SHRINK / Math.max(0.6, mesh.userData.body.scale.x)));
      return m;
    },

    update(dt, t) {
      for (const [i, m] of members.entries()) {
        m.t += dt;
        const show = i < cap;
        m.mesh.visible = show;
        if (!show && m.state !== 'hop') continue;
        if (m.state === 'hop') {
          // happy hop straight up, then off to its place in the line
          m.vy -= 22 * dt; m.y += m.vy * dt;
          if (m.y <= 0 && m.vy < 0) { m.y = 0; m.state = photoMode ? 'photo' : 'walk'; }
          m.mesh.rotation.y += dt * 9;
        } else if (m.state === 'walk') {
          const row = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
          const p = along(row * ROW_BACK);
          const len = Math.hypot(p.dirX, p.dirD) || 1;
          const lat = side * (FIRST_SIDE + row * ROW_SIDE);
          p.x += (p.dirD / len) * lat; p.d -= (p.dirX / len) * lat;
          const k = Math.min(1, dt * (m.t < 1.5 ? 3 : 7));
          m.x += (p.x - m.x) * k; m.d += (p.d - m.d) * k;
          m.y = Math.abs(Math.sin(t * 9 + i * 0.7)) * 0.25; // trotting bounce
          m.mesh.rotation.y = Math.atan2(p.dirX, p.dirD) + Math.PI; // facing downhill, the way they go
          m.mesh.userData.body.rotation.z = Math.sin(t * 9 + i * 0.7) * 0.08;
        } else if (m.state === 'photo') {
          const k = Math.min(1, dt * 3);
          m.x += (m.px - m.x) * k; m.d += (m.pd - m.d) * k;
          m.y = Math.max(0, Math.sin(t * 6 + i * 0.9)) * 0.8; // cheering jumps
          m.mesh.rotation.y = 0; // face the camera
        }
        m.mesh.position.set(m.x, groundY(m.d) + m.y, -m.d);
      }
    },

    // everyone lines up for the group photo in rows, facing the camera, in front of (x, d)
    photo(x, d, max = 40) {
      photoMode = true;
      const shown = Math.min(members.length, max);
      const perRow = Math.min(9, Math.max(4, Math.ceil(Math.sqrt(shown * 2))));
      members.forEach((m, i) => {
        const row = Math.floor(i / perRow), col = i % perRow, n = Math.min(perRow, shown - row * perRow);
        m.px = x + (col - (n - 1) / 2) * 1.7 + (row % 2) * 0.5;
        m.pd = d - row * 1.9;
        if (m.state === 'walk') m.state = 'photo';
        m.mesh.visible = i < shown;
      });
      cap = shown;
    },

    clear() {
      for (const m of members) W3.removeObject(m.mesh);
      members.length = 0; trail.length = 0; photoMode = false;
    },
  };
  return api;
}
