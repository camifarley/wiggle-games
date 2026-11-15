// Body-based peekaboo detector: both hands come up to the head, stay there a moment, then drop away.
// Pure logic (no DOM): tested by `npm test` (scripts/test-peekaboo.js).
//
// Used by gestures.js when the game tracks the body ('pose') but not the face: the face tracker can't
// see a child 2-4 m away, but body tracking still sees the wrists and the nose (or the shoulders).
//
// Signal: "hands near head" = the FARTHER of the two wrists' distance to the head, in shoulder widths.
// Both hands must be within `near` (about one shoulder width) for `hold` seconds -> 'hide'.
// Then EITHER hand dropping past `release` for `dropFor` seconds -> 'peekaboo' (BOO!).
// The head point is the nose; when the nose isn't trusted (hands over it can lower its visibility, or the
// head is above the frame) it is estimated from the shoulders with the offset learned while it was seen.
// Quick claps in front of the face, arms flung up while jumping and hands passing the head while dancing
// all last well under `hold`, so they don't count.

export const PEEKABOO_DEFAULTS = {
  near: 1.0,      // both wrists within this many shoulder widths of the head = covering
  release: 1.4,   // a wrist farther than this = hands dropped (hysteresis vs. near)
  hold: 0.4,      // s both hands must stay near before it counts as hiding
  dropFor: 0.12,  // s hands must stay dropped before BOO (ignores a one-sample flicker)
  minVis: 0.5,    // landmark visibility to trust a point
  lostReset: 1.5, // s with no body before a half-done peekaboo is forgotten
  headUp: 0.75,   // default nose height above the shoulder midpoint, in shoulder widths (learned live)
};

// points: { nose, leftWrist, rightWrist, leftShoulder, rightShoulder } as { x, y, v } in norm coords
// (missing points = undefined). aspect = camera width / height (x norm units -> frame heights).
export function createPeekabooTracker(config = {}) {
  const c = { ...PEEKABOO_DEFAULTS, ...config };
  const s = { t: 0, state: 'open', nearT: 0, nearSince: null, dropSince: null, dropT: 0, lostT: 0, coverStart: 0, value: null, headUp: c.headUp, headDx: 0 };
  const ok = (p) => p && p.v >= c.minVis;
  return {
    state: s,
    config: c,
    get covering() { return s.state === 'covering'; },
    reset() { s.state = 'open'; s.nearT = 0; s.nearSince = null; s.dropSince = null; s.dropT = 0; s.lostT = 0; s.value = null; },

    // Returns events: 'hide' (hands just covered the head) and 'peekaboo' (hands dropped: BOO!).
    update(dt, pts, aspect = 4 / 3) {
      const events = [];
      s.t += dt;
      const ls = pts?.leftShoulder, rs = pts?.rightShoulder;
      if (!ok(ls) || !ok(rs)) {
        // no body: keep the state for a moment (tracking flicker), then forget a half-done peekaboo
        s.value = null;
        s.lostT += dt;
        if (s.state === 'open') s.nearSince = null;
        if (s.lostT > c.lostReset) { s.state = 'open'; s.nearT = 0; s.nearSince = null; }
        return events;
      }
      s.lostT = 0;
      const mx = (ls.x + rs.x) / 2, my = (ls.y + rs.y) / 2;
      const sw = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
      if (!(sw > 0.01)) { s.value = null; return events; }
      // head point: the nose when trusted (and learn where it sits above the shoulders), else estimated.
      // Don't learn while covering: hands over the face can drag the nose estimate around.
      let hx, hy;
      const n = pts.nose;
      if (ok(n) && n.y > 0 && s.state !== 'covering') {
        hx = n.x; hy = n.y;
        const k = Math.min(1, dt / 1.0);
        s.headUp += ((my - n.y) / sw - s.headUp) * k;
        s.headDx += (((n.x - mx) * aspect) / sw - s.headDx) * k;
      } else {
        hx = mx + (s.headDx * sw) / aspect; hy = my - s.headUp * sw;
      }
      const dist = (w) => (ok(w) ? Math.hypot((w.x - hx) * aspect, w.y - hy) / sw : Infinity);
      const v = Math.max(dist(pts.leftWrist), dist(pts.rightWrist));
      s.value = Number.isFinite(v) ? v : null;

      if (s.state === 'open') {
        // time since the FIRST near sample (not a sum of dt: at 12 fps that over-counts a quick clap)
        if (v < c.near) { if (s.nearSince == null) s.nearSince = s.t; } else s.nearSince = null;
        s.nearT = s.nearSince == null ? 0 : s.t - s.nearSince;
        if (s.nearT >= c.hold) { s.state = 'covering'; s.coverStart = s.t; s.dropT = 0; s.dropSince = null; events.push('hide'); }
      } else {
        // a wrist that vanishes while covering usually just went behind the head: only a clear drop counts
        const dropped = Number.isFinite(v) && v > c.release;
        if (dropped) { if (s.dropSince == null) s.dropSince = s.t; } else s.dropSince = null;
        s.dropT = s.dropSince == null ? 0 : s.t - s.dropSince;
        if (dropped && (s.dropT >= c.dropFor || dt >= c.dropFor)) { // at low fps one clear sample is enough
          s.state = 'open'; s.nearT = 0; s.nearSince = null; s.dropSince = null; events.push('peekaboo');
        }
      }
      return events;
    },
  };
}
