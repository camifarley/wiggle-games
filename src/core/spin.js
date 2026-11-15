// Body-based spin detector: counts quick "shoulders vanish, then come back" dips.
// Pure logic (no DOM): tested by `npm test` (scripts/test-spin.js + real recordings via replay.js).
//
// Turning side-on makes the shoulder line nearly vanish (width ~0); facing OR back-to-camera it's wide.
// So one full spin = TWO sharp V-shaped dips (side-on going round, side-on coming back) about 0.5–1 s
// apart. Walking toward/away from the camera changes width gradually (no sharp V), and turning
// sideways and staying there never recovers, so neither counts.
// Known limit: turning to the side and quickly back also makes two dips and counts as a spin. For a
// 4-year-old that is basically a spin attempt, so it's rewarded.

export const SPIN_DEFAULTS = {
  narrow: 0.45,   // width below this fraction of recent "wide" width = side-on
  recover: 0.5,   // back above this fraction of the pre-dip width (and well up from the dip's bottom) = dip over
  maxDip: 1.0,    // s: a dip longer than this isn't a turn (stood side-on / walked off)
  pairWithin: 2.2, // s: two dips within this = one spin
  wideWindow: 0.5, // s of history for the "wide" reference (short: walking closer/further changes width too)
  bounce: 2.5,     // must come back to this many times the dip's lowest width
  minWidth: 0.004, // ignore tiny/garbage widths before tracking settles
};

export function createSpinTracker(config = {}) {
  const c = { ...SPIN_DEFAULTS, ...config };
  const s = { t: 0, hist: [], state: 'wide', dipRef: 0, dipMin: 0, dipStart: 0, lastDip: null, dips: 0 };
  return {
    state: s,
    config: c,
    reset() { s.hist = []; s.state = 'wide'; s.lastDip = null; },

    // width: shoulder width in any consistent unit. Returns events: 'turn' (one dip) and 'spin'.
    update(dt, width) {
      const events = [];
      s.t += dt;
      if (!(width > 0)) return events;
      s.hist.push({ t: s.t, w: width });
      while (s.hist.length && s.hist[0].t < s.t - c.wideWindow) s.hist.shift();
      if (s.state === 'wide') {
        const wide = Math.max(...s.hist.map((h) => h.w));
        if (wide > c.minWidth && width < c.narrow * wide) { s.state = 'narrow'; s.dipRef = wide; s.dipMin = width; s.dipStart = s.t; }
      } else if (s.state === 'narrow') {
        s.dipMin = Math.min(s.dipMin, width);
        if (width > c.recover * s.dipRef && width > c.bounce * s.dipMin) {
          s.state = 'wide';
          if (s.t - s.dipStart <= c.maxDip) {
            events.push('turn');
            if (s.lastDip != null && s.t - s.lastDip <= c.pairWithin) { events.push('spin'); s.lastDip = null; }
            else s.lastDip = s.t;
          }
        } else if (s.t - s.dipStart > c.maxDip) {
          s.state = 'lost'; // side-on for a while / walked away: wait until wide again
        }
      } else if (s.state === 'lost') {
        // side-on for a while: only "facing again" when the shoulders are back to their earlier width
        // (otherwise tiny side-on jitter would look like dips). After 6 s, accept the new width.
        if (width >= c.recover * s.dipRef || s.t - s.dipStart > 6) { s.state = 'wide'; s.lastDip = null; s.hist = [{ t: s.t, w: width }]; }
      }
      if (s.lastDip != null && s.t - s.lastDip > c.pairWithin) s.lastDip = null; // half turn only
      return events;
    },
  };
}
