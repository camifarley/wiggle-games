// Head-height tracker: turns face position into jump / crouch / stand events.
// Pure logic (no DOM), so it can be tested with simulated data: `npm test`.
//
// Units: y and size are both in "frame heights" (0..1 down the image), so heights are measured
// in face sizes (eye distance) and work at any distance from the camera.
//
// Standing height ("baseline") is learned, never assumed:
//  - it is only set once the face has been a steady size for a moment (not while walking back
//    from tapping Play),
//  - it is re-learned whenever the face size changes a lot (kid moved closer / further away),
//  - a "crouch" that lasts very long is treated as the new standing height (never stuck),
//  - sitting steadily part-way off standing height (camera bumped, standing on a cushion) for a few
//    seconds also re-learns it. (The original bug: a slightly-off standing height left every jump
//    short of the threshold forever.)

export const HEIGHT_DEFAULTS = {
  jumpUp: 1.0,        // face sizes above standing that count as a jump (~5 cm for a child)
  jumpRise: 0.5,      // s: must rise that far this quickly (not a slow lean)
  jumpGap: 0.3,       // s between jumps
  crouchDown: 2.0,    // face sizes below standing that count as a crouch
  crouchHold: 0.3,    // s held before it counts
  standUp: 1.0,       // back within this many face sizes = standing
  settle: 0.6,        // s of steady face size before (re)learning standing height
  resizeTol: 0.25,    // face size change (fraction) that means "moved closer/further"
  maxCrouch: 15,      // s: a crouch longer than this becomes the new standing height
  learnRate: 1.5,     // s time constant for drifting standing height while standing still
  offTime: 2.5,       // s steady between "standing" and "crouching" before re-learning standing height
};

export function createHeightTracker(config = HEIGHT_DEFAULTS) {
  const c = { ...HEIGHT_DEFAULTS, ...config };
  const s = {
    height: 0, crouching: false, ready: false,
    base: null, refSize: null, steadyT: 0, clock: 0,
    lowT: 0, air: false, lastJump: -9, crouchT: 0, crouchedFor: 0, offT: 0, offY: 0,
  };

  function relearn() { s.base = null; s.ready = false; s.steadyT = 0; s.crouching = false; s.crouchT = 0; s.height = 0; }

  return {
    state: s,
    config: c,
    reset() { relearn(); s.refSize = null; s.air = false; },

    // y: eye-line height in frame heights; size: eye distance in frame heights.
    // Returns a list of events: 'jump' | 'crouch' | 'stand'.
    update(dt, y, size) {
      const events = [];
      s.clock += dt;
      if (!(size > 0)) return events;

      // Has the face size changed a lot? (walked closer / further) -> re-learn standing height.
      if (s.refSize == null) s.refSize = size;
      const ratio = size / s.refSize;
      if (Math.abs(ratio - 1) > c.resizeTol) {
        s.refSize = size;
        const wasCrouching = s.crouching;
        relearn();
        if (wasCrouching) events.push('stand');
        return events;
      }
      s.refSize += (size - s.refSize) * Math.min(1, dt / 1.5);

      if (!s.ready) {
        s.steadyT += dt;
        s.base = s.base == null ? y : s.base + (y - s.base) * Math.min(1, dt / 0.3);
        if (s.steadyT >= c.settle) { s.ready = true; s.lowT = s.clock; }
        return events;
      }

      const h = (s.base - y) / s.refSize;
      s.height = h;
      // drift standing height while roughly standing (not jumping or crouching)
      if (!s.crouching && Math.abs(h) < 0.5) s.base += (y - s.base) * Math.min(1, dt / c.learnRate);
      // steady in the dead zone (neither standing nor crouching)? that's the new standing height
      if (!s.crouching && Math.abs(h) >= 0.5 && h > -c.crouchDown && Math.abs(y - s.offY) < s.refSize * 0.4) {
        s.offT += dt;
        if (s.offT > c.offTime) { s.base = y; s.offT = 0; }
      } else { s.offT = 0; s.offY = y; }

      if (h < 0.3) { s.lowT = s.clock; s.air = false; }
      if (!s.air && !s.crouching && h > c.jumpUp && s.clock - s.lowT < c.jumpRise && s.clock - s.lastJump > c.jumpGap) {
        s.air = true;
        s.lastJump = s.clock;
        events.push('jump');
      }

      if (!s.crouching) {
        s.crouchT = h < -c.crouchDown ? s.crouchT + dt : 0;
        if (s.crouchT >= c.crouchHold) { s.crouching = true; s.crouchedFor = 0; events.push('crouch'); }
      } else {
        s.crouchedFor += dt;
        if (h > -c.standUp) {
          s.crouching = false; s.crouchT = 0; events.push('stand');
        } else if (s.crouchedFor > c.maxCrouch) {
          // That wasn't a crouch; that's where they stand now.
          s.base = y; s.crouching = false; s.crouchT = 0; events.push('stand');
        }
      }
      return events;
    },
  };
}
