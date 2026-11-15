// The sounds the parent and kid picked in the Sound Picker (sounds.html). Data only.
//
//   slot: {
//     files: ['sounds/sfx/pop-1.m4a', ...],  // one is picked at random each time (relative to the site root)
//     synth: 'pop-bubble',                   // or a synthLab design from audio.js (no download)
//     vol: 1,                                 // loudness trim
//     jitter: 0.06,                           // random pitch wobble so repeats don't sound robotic
//     replaces: ['ding'],                     // classic sfx names this slot takes over (sfx.ding() → this)
//   }
//
// Slot names match the Sound Picker rows. A slot named like a classic sfx (pop, boing, boom, splat)
// takes over that call automatically. Empty = every sound stays the original synth.
// Files are copied from public/sounds/candidates/ to public/sounds/sfx/ by scripts/sounds-apply-picks.mjs.

export const PICKS = {};
