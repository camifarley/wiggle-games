// Distance Dance (station 9) logic, kept pure (no DOM, no ctx) so scripts/replay.js replays real
// recordings through exactly the code the station runs.
//
// Hop between a FAR spot (body tracking sees down to the knees) and a NEAR spot (shoulders clearly
// wider than at the far spot). What two real playtests taught us:
// - The marker jumped around: single-frame misdetections (shoulder width 0.03 when it's really 0.25).
//   The width is now a median of the last few samples, then eased.
// - "Near" was out of reach: the far-spot width was learned whenever the knees were in view, and a
//   laptop camera still sees the knees well inside the room, so the far width crept up as he walked
//   in and the 1.5x target ran away from him. Now the far width is taken once, when the far step
//   counts, and "near" also counts when he's come so close that the knees leave the view (or the body
//   tracker loses him) after getting most of the way.

export const DISTANCE_CONFIG = {
  nearRatio: 1.45,   // near spot = shoulders this many times wider than at the far spot
  closeRatio: 1.25,  // ...or this much wider AND the knees are out of view (he's as close as he can get)
  farBack: 1.2,      // going back counts when the knees are in view AND shoulders are within this of the far width
                     // (a laptop camera can see the knees well inside the room)
  hold: 0.4,         // s in the zone to count
  drain: 1,          // leaving the zone drains the hold at this speed (not an instant reset)
  median: 7,         // samples in the width median (rejects one-frame glitches)
  ease: 8,           // then eased at this rate (1/s)
  lostGrace: 0.6,    // body lost within this long of being near-ish counts as "came all the way close"
  wait: 0.8,         // s between steps
};

// sample: { found, width, kneesIn, zone } from ctx.body() (zone already steadied by body.js)
export function createDistanceStation(config = {}) {
  const C = { ...DISTANCE_CONFIG, ...config };
  const buf = [];
  const s = {
    C, want: 'far', farW: 0, w: 0, pos: 0, hold: 0, wait: 0, count: 0, seen: false, knees: false,
    sinceNear: 9, // s since the eased ratio was last >= closeRatio
    get ratio() { return s.farW && s.w ? s.w / s.farW : 0; },
    // phase: 'demo' (only track) or 'go'. Returns events: [{ name: 'hit', want }]
    update(dt, phase, b) {
      const ev = [];
      s.seen = !!(b && b.found && b.width > 0);
      s.knees = s.seen && (b.zone === 'good' || b.zone === 'too-far');
      if (s.seen) {
        buf.push(b.width); if (buf.length > C.median) buf.shift();
        const med = [...buf].sort((a, c) => a - c)[buf.length >> 1];
        s.w = s.w ? s.w + (med - s.w) * Math.min(1, dt * C.ease) : med;
      }
      const r = s.ratio;
      s.sinceNear = s.seen && r >= C.closeRatio ? 0 : s.sinceNear + dt;
      // marker: 0 = far spot, 1 = near spot
      if (s.farW) s.pos = Math.max(0, Math.min(1.15, (r - 1) / (C.nearRatio - 1)));
      else if (s.seen) s.pos = s.knees ? 0 : 0.7;
      if (phase === 'demo') return ev;
      if (s.wait > 0) { s.wait -= dt; return ev; }
      let inZone;
      if (s.want === 'far') inZone = s.knees && (!s.farW || r <= C.farBack);
      else inZone = s.farW > 0 && (
        (s.seen && r >= C.nearRatio) ||
        (s.seen && !s.knees && r >= C.closeRatio) ||
        (!s.seen && s.sinceNear <= C.lostGrace));
      s.hold = inZone ? s.hold + dt : Math.max(0, s.hold - dt * C.drain);
      if (s.hold >= C.hold) {
        if (s.want === 'far') s.farW = s.w; // the far spot is wherever he is when it counts
        ev.push({ name: 'hit', want: s.want });
        s.count++;
        s.want = s.want === 'far' ? 'near' : 'far'; s.hold = 0; s.wait = C.wait;
      }
      return ev;
    },
    // 0..1 how far the hold has filled
    get progress() { return Math.min(1, s.hold / C.hold); },
  };
  return s;
}
