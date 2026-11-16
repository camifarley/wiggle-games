// Gibberish voices for aliens, creatures and friends: a tiny syllable synth that sounds like TALKING, not beeps.
// Pure planning here (no Web Audio; tested by scripts/test-babble.js); audio.js renders a plan through its own
// voice bus (sfx.babble). No real words are ever spoken: the text only shapes the rhythm, the vowels and the
// emphasis ("blah blah BLAH… BAH!" → five syllables, the capitals louder and higher, a big low "BAH" at the end).
//
// Each syllable = a sawtooth / pulse source with a pitch glide, through two band-pass "formant" filters set to a
// vowel (a e i o u), with a short attack / hold / decay envelope. Voices differ by base pitch, formant shift,
// wobble and speed: 'crab' low and gravelly, 'friend' high and chirpy, 'alien' in between, 'robot' flat.

export const VOWELS = {
  a: [800, 1200], e: [420, 2100], i: [310, 2500], o: [520, 900], u: [360, 760],
};

export const VOICES = {
  alien: { base: 210, shift: 1.0, wobble: 0.12, glide: 0.16, wave: 'sawtooth', syl: 0.13, gap: 0.04, gravel: 0 },
  crab: { base: 105, shift: 0.82, wobble: 0.18, glide: 0.22, wave: 'sawtooth', syl: 0.16, gap: 0.05, gravel: 1 },
  friend: { base: 430, shift: 1.28, wobble: 0.1, glide: 0.3, wave: 'square', syl: 0.095, gap: 0.03, gravel: 0 },
  robot: { base: 160, shift: 0.95, wobble: 0.02, glide: 0, wave: 'square', syl: 0.12, gap: 0.05, gravel: 0 },
};

const VOWEL_KEYS = Object.keys(VOWELS);

// text -> word list with emphasis / pauses / the final BAH
function words(text) {
  const out = [];
  for (const m of String(text).matchAll(/([A-Za-z]+)|([.…,!?]+)/g)) {
    if (m[1]) out.push({ w: m[1], loud: m[1].length > 1 && m[1] === m[1].toUpperCase() });
    else if (out.length) {
      const p = m[2];
      const last = out[out.length - 1];
      last.pause = (last.pause || 0) + (p.includes('…') || p.includes('.') ? 0.16 : p.includes(',') ? 0.1 : 0.04);
      if (p.includes('?')) last.ask = true;
      if (p.includes('!')) last.bang = true;
    }
  }
  return out;
}

// how many syllables a gibberish word gets (vowel groups, 1..3)
function syllablesOf(w) {
  const groups = w.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, Math.min(3, groups ? groups.length : 1));
}

// plan a line. opts: { voice, pitch (x), speed (x), vol (0..2) }. rnd: () => 0..1 (inject for tests)
export function planBabble(text, opts = {}, rnd = Math.random) {
  const v = VOICES[opts.voice] || VOICES.alien;
  const pitch = opts.pitch ?? 1, speed = Math.max(0.3, opts.speed ?? 1), vol = opts.vol ?? 1;
  const syllables = [];
  let t = 0;
  const ws = words(text);
  ws.forEach((wd, wi) => {
    const lower = wd.w.toLowerCase();
    const isBah = lower === 'bah' && wi === ws.length - 1;
    const vowelsHere = lower.match(/[aeiou]/g) || [VOWEL_KEYS[Math.floor(rnd() * VOWEL_KEYS.length)]];
    const n = isBah ? 1 : syllablesOf(wd.w);
    for (let k = 0; k < n; k++) {
      const vowel = vowelsHere[Math.min(k, vowelsHere.length - 1)];
      const last = k === n - 1;
      let dur = (v.syl * (0.8 + rnd() * 0.5)) / speed;
      let f0 = v.base * pitch * (1 + (rnd() * 2 - 1) * v.wobble);
      let amp = 0.75 + rnd() * 0.2;
      if (wd.loud) { f0 *= 1.22; amp = 1; dur *= 1.15; }
      if (isBah) { f0 = v.base * pitch * 0.7; dur = Math.max(0.28, dur * 2.2) / Math.sqrt(speed); amp = 1.15; }
      // intonation: questions rise at the end, "!" words jump up then drop
      const glideTo = wd.ask && last ? 1 + v.glide * 1.6 : wd.bang && last ? 1 - v.glide : 1 + (rnd() * 2 - 1) * v.glide;
      const [f1, f2] = VOWELS[vowel].map((f) => f * v.shift);
      syllables.push({ t: +t.toFixed(4), dur: +dur.toFixed(4), f0: +f0.toFixed(1), f1end: +(f0 * glideTo).toFixed(1), vowel, formants: [f1, f2], amp: +(amp * vol).toFixed(3), bah: isBah, gravel: v.gravel, wave: v.wave });
      t += dur + v.gap / speed;
    }
    t += (wd.pause || 0) / speed + 0.03 / speed;
  });
  const total = syllables.length ? syllables[syllables.length - 1].t + syllables[syllables.length - 1].dur : 0;
  return { voice: opts.voice || 'alien', syllables, total: +total.toFixed(3), bah: syllables.some((s) => s.bah) };
}

// The envelope of one syllable (attack / hold / decay), as gain points [time from syllable start, level 0..1].
export function syllableEnvelope(dur) {
  const a = Math.min(0.018, dur * 0.2), d = Math.min(0.07, dur * 0.45);
  return [[0, 0], [a, 1], [Math.max(a, dur - d), 0.85], [dur, 0]];
}
