// Pause, for every game. Pure key rule here (tested by scripts/test-pause.js); the runtime owns the state.
//
//   ⏸ button next to Back (ui.js) · Escape always toggles · Space toggles ONLY when test controls are off
//   (with ?keys / 🎮 on, Space stays "jump" for the pretend body).
// While paused the runtime stops calling game.update (ctx.time stands still), keeps drawing the frozen frame
// under a big "Paused ▶" overlay, ducks the music, and keeps the detectors running, but gesture events don't
// reach the game (gestures.muted). Games can read ctx.paused and may define game.onPause(paused).

// returns 'toggle' or null
export function pauseKeyAction({ key, repeat = false, typing = false, testKeysOn = false, modifier = false } = {}) {
  if (typing || repeat || modifier) return null;
  if (key === 'Escape') return 'toggle';
  if (key === ' ' && !testKeysOn) return 'toggle';
  return null;
}
