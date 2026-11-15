// Background music: happy chiptune loops generated in code (no download) or picked music files.
// Plays through audio.js's music bus, so the menu's 🎵 / 🔊 buttons and speech ducking apply.
//
//   music.play('menu')            a name from music-picks.js (menu, a game id, 'sneaky', ...)
//   music.play('gen:sunny:1')     a generated loop: style + seed (see STYLES)
//   music.play('sounds/music/x.m4a')  a file (looped)
//   music.stop()   music.resume()  (back to this game's own track after e.g. a sneaky round)
//   music.jingle('gen:fanfare:1')  one-shot over the music (music dips under it)
//
// The runtime starts each game's track automatically (music-picks.js), so games don't have to.
// Generated loops are pre-rendered once into a buffer (OfflineAudioContext), so they loop perfectly
// and cost nothing per frame.

import { audio } from './audio.js';
import { MUSIC } from './music-picks.js';

// ------------------------------------------------------------------ generator
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], pent: [0, 2, 4, 7, 9] };

// Styles: every one in a major key, bouncy, bright. prog = scale degrees of the chord roots, one per bar.
export const STYLES = {
  sunny:    { label: 'Sunny menu',     bpm: 108, root: 60, prog: [0, 5, 3, 4], lead: 'bell',   bass: 'oompah', drums: 'soft',  arp: false, density: 0.55 },
  zoom:     { label: 'Zoom! (fast)',   bpm: 152, root: 62, prog: [0, 4, 5, 3], lead: 'square', bass: 'drive',  drums: 'drive', arp: true,  density: 0.7 },
  hop:      { label: 'Bug hop',        bpm: 126, root: 65, prog: [0, 3, 0, 4], lead: 'pluck',  bass: 'oompah', drums: 'pop',   arp: false, density: 0.6 },
  groove:   { label: 'Lab groove',     bpm: 116, root: 67, prog: [0, 3, 1, 4], lead: 'pulse',  bass: 'walk',   drums: 'four',  arp: true,  density: 0.5 },
  downhill: { label: 'Downhill roll',  bpm: 140, root: 57, prog: [0, 3, 4, 0], lead: 'square', bass: 'gallop', drums: 'gallop', arp: false, density: 0.65 },
  tiptoe:   { label: 'Tiptoe (sneaky)', bpm: 96, root: 60, prog: [0, 0, 3, 4], lead: 'pluck',  bass: 'tiptoe', drums: 'tick',  arp: false, density: 0.4, staccato: true },
  fanfare:  { label: 'Win fanfare',    bpm: 150, root: 60, prog: [0, 3, 4, 0], lead: 'square', bass: 'drive',  drums: 'drive', arp: true,  density: 0.9, bars: 2, oneShot: true },
};

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// degree (can be negative / > 7) in the major scale -> semitones from root
function deg(d) { const s = SCALES.major, o = Math.floor(d / 7); return s[((d % 7) + 7) % 7] + 12 * o; }

// Compose: returns note events { t (beats), d (beats), m (midi), v, inst }
function compose(style, seed) {
  const R = rng(seed);
  const S = STYLES[style];
  const bars = S.bars || 8;
  const prog = Array.from({ length: bars }, (_, i) => S.prog[i % S.prog.length]);
  const notes = [];

  // ---- melody: 2-bar motifs in the form A A' B A'' (motifs make it sound composed, not random)
  const motif = () => {
    const out = []; // [{slot 0..15, len, d}]
    let d = 4 + ((R() * 3) | 0);
    for (let s = 0; s < 16;) {
      const strong = s % 4 === 0;
      if (R() < (strong ? 0.9 : S.density)) {
        const len = R() < 0.25 && s % 2 === 0 ? 2 : 1;
        d += strong ? Math.round((R() - 0.5) * 4) : R() < 0.5 ? 1 : -1;
        d = Math.max(0, Math.min(11, d));
        out.push({ slot: s, len, d });
        s += len;
      } else s++;
    }
    return out;
  };
  const A = motif(), B = motif();
  const vary = (m) => m.map((n, i) => (i >= m.length - 3 ? { ...n, d: n.d + (R() < 0.5 ? 2 : -1) } : n));
  const form = bars >= 8 ? [A, vary(A), B, vary(A)] : [A];
  form.forEach((m, mi) => {
    for (const n of m) {
      const bar = mi * 2 + (n.slot >> 3);
      if (bar >= bars) continue;
      const chord = prog[bar];
      let d = n.d;
      // snap strong beats to a chord tone (chord = degrees chord, chord+2, chord+4)
      if (n.slot % 4 === 0) {
        const tones = [-7, 0, 7].flatMap((o) => [chord, chord + 2, chord + 4].map((x) => x + o));
        d = tones.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), tones[0]);
      }
      notes.push({ t: bar * 4 + (n.slot % 8) / 2, d: n.len / 2 * (S.staccato ? 0.45 : 0.9), m: S.root + 12 + deg(d), v: 0.9, inst: S.lead });
    }
  });
  // end on the root so the loop "lands"
  if (!S.oneShot) notes.push({ t: bars * 4 - 1, d: 0.9, m: S.root + 12, v: 0.8, inst: S.lead });
  else notes.push({ t: bars * 4, d: 2, m: S.root + 24, v: 1, inst: S.lead }, { t: bars * 4, d: 2, m: S.root + 16, v: 0.7, inst: S.lead });

  // ---- bass + arp
  for (let b = 0; b < bars; b++) {
    const root = S.root - 24 + deg(prog[b]);
    const fifth = S.root - 24 + deg(prog[b] + 4);
    const t0 = b * 4;
    const B_ = (t, d, m, v = 0.9) => notes.push({ t: t0 + t, d, m, v, inst: 'bass' });
    if (S.bass === 'oompah') [0, 1, 2, 3].forEach((q) => B_(q, 0.4, q % 2 ? fifth : root));
    else if (S.bass === 'drive') for (let e = 0; e < 8; e++) B_(e / 2, 0.35, e % 2 ? root + 12 : root, 0.8);
    else if (S.bass === 'walk') [0, 1, 2, 3].forEach((q) => B_(q, 0.8, S.root - 24 + deg(prog[b] + [0, 2, 4, 5][q])));
    else if (S.bass === 'gallop') [0, 0.75, 1, 2, 2.75, 3].forEach((q, i) => B_(q, 0.25, i % 3 === 2 ? fifth : root));
    else if (S.bass === 'tiptoe') [0, 1, 2, 3].forEach((q) => B_(q, 0.2, q % 2 ? fifth : root, 0.7));
    if (S.arp) for (let s = 0; s < 8; s++) {
      notes.push({ t: t0 + s / 2, d: 0.2, m: S.root + deg(prog[b] + [0, 2, 4, 7][s % 4]), v: 0.35, inst: 'arp' });
    }
  }

  // ---- drums
  const hits = [];
  for (let b = 0; b < bars + (S.oneShot ? 1 : 0); b++) {
    const t0 = b * 4;
    const H = (t, inst, v = 1) => hits.push({ t: t0 + t, inst, v });
    if (S.oneShot && b === bars) { H(0, 'kick'); H(0, 'crash'); break; }
    switch (S.drums) {
      case 'soft': H(0, 'kick', 0.7); H(2, 'kick', 0.6); [1, 3].forEach((q) => H(q, 'snare', 0.4)); for (let e = 0; e < 8; e++) H(e / 2, 'hat', 0.25); break;
      case 'drive': for (let q = 0; q < 4; q++) H(q, 'kick'); [1, 3].forEach((q) => H(q, 'snare')); for (let e = 0; e < 8; e++) H(e / 2 + 0.5 * 0, 'hat', e % 2 ? 0.5 : 0.3); break;
      case 'pop': H(0, 'kick'); H(1.5, 'kick', 0.7); H(2, 'kick'); [1, 3].forEach((q) => H(q, 'clap', 0.7)); for (let e = 1; e < 8; e += 2) H(e / 2, 'hat', 0.35); break;
      case 'four': for (let q = 0; q < 4; q++) H(q, 'kick', 0.9); [1, 3].forEach((q) => H(q, 'clap', 0.6)); for (let e = 1; e < 8; e += 2) H(e / 2, 'hat', 0.5); break;
      case 'gallop': [0, 0.75, 1, 2, 2.75, 3].forEach((q, i) => H(q, i % 3 === 2 ? 'snare' : 'kick', i % 3 === 2 ? 0.8 : 0.7)); for (let e = 0; e < 8; e++) H(e / 2, 'hat', 0.3); break;
      case 'tick': [0, 1, 2, 3].forEach((q) => H(q, 'tick', q % 2 ? 0.5 : 0.8)); if (b % 2) H(3.5, 'tick', 0.4); break;
    }
  }
  return { notes, hits, beats: bars * 4, bpm: S.bpm, oneShot: !!S.oneShot };
}

// ------------------------------------------------------------------ render
const RATE = 32000;
function voice(oc, out, inst, t, dur, hz, v) {
  const g = oc.createGain();
  const o = oc.createOscillator();
  const end = t + dur;
  let peak = 0.18 * v, rel = 0.06;
  if (inst === 'square') { o.type = 'square'; peak = 0.075 * v; }
  else if (inst === 'pulse') { // 25% pulse from two saws
    o.type = 'sawtooth'; const o2 = oc.createOscillator(), inv = oc.createGain();
    o2.type = 'sawtooth'; o2.frequency.value = hz; inv.gain.value = -1;
    const dl = oc.createDelay(); dl.delayTime.value = 0.25 / hz;
    o2.connect(dl).connect(inv).connect(g); o2.start(t); o2.stop(end + 0.2); peak = 0.07 * v;
  }
  else if (inst === 'pluck') { o.type = 'triangle'; peak = 0.3 * v; rel = 0.02; }
  else if (inst === 'bell') { o.type = 'sine'; peak = 0.2 * v; rel = 0.3;
    const o2 = oc.createOscillator(), g2 = oc.createGain(); o2.frequency.value = hz * 2; g2.gain.value = 0.35;
    o2.connect(g2).connect(g); o2.start(t); o2.stop(end + 0.4); }
  else if (inst === 'bass') { o.type = 'triangle'; peak = 0.38 * v; rel = 0.03; }
  else if (inst === 'arp') { o.type = 'square'; peak = 0.03 * v; rel = 0.02; }
  o.frequency.value = hz;
  if (inst === 'square' && dur > 0.3) { // delayed vibrato on long lead notes
    const l = oc.createOscillator(), lg = oc.createGain(); l.frequency.value = 6; lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(hz * 0.012, t + dur); l.connect(lg).connect(o.frequency); l.start(t); l.stop(end + 0.1);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  if (inst === 'pluck' || inst === 'bell') g.gain.exponentialRampToValueAtTime(peak * 0.05, end + rel);
  else { g.gain.setValueAtTime(peak * 0.8, Math.max(t + 0.01, end - 0.02)); g.gain.linearRampToValueAtTime(0, end + rel); }
  o.connect(g).connect(out);
  o.start(t); o.stop(end + rel + 0.3);
}
let noiseBuf = null;
function drum(oc, out, inst, t, v) {
  if (!noiseBuf || noiseBuf.sampleRate !== oc.sampleRate) {
    noiseBuf = oc.createBuffer(1, oc.sampleRate, oc.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const g = oc.createGain();
  g.connect(out);
  if (inst === 'kick') {
    const o = oc.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); o.start(t); o.stop(t + 0.2); return;
  }
  const n = oc.createBufferSource(), f = oc.createBiquadFilter(); n.buffer = noiseBuf;
  const len = { snare: 0.12, clap: 0.1, hat: 0.03, tick: 0.015, crash: 0.8 }[inst];
  f.type = inst === 'snare' || inst === 'clap' ? 'bandpass' : 'highpass';
  f.frequency.value = { snare: 1800, clap: 1200, hat: 7000, tick: 4000, crash: 5000 }[inst];
  const vol = { snare: 0.25, clap: 0.28, hat: 0.07, tick: 0.12, crash: 0.12 }[inst] * v;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(f).connect(g); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
  if (inst === 'snare') { const o = oc.createOscillator(), og = oc.createGain(); o.frequency.value = 220; og.gain.setValueAtTime(0.1 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07); o.connect(og).connect(out); o.start(t); o.stop(t + 0.1); }
}

async function renderGen(style, seed) {
  const song = compose(style, seed);
  const spb = 60 / song.bpm;
  const loopLen = song.beats * spb;
  const tail = song.oneShot ? 2.5 : 1.5;
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frames = Math.ceil((loopLen + tail) * RATE);
  const oc = new OC(1, frames, RATE);
  const out = oc.createGain(); out.gain.value = 0.9;
  // tiny echo for sparkle
  const dl = oc.createDelay(1), fb = oc.createGain(), wet = oc.createGain();
  dl.delayTime.value = spb * 0.75; fb.gain.value = 0.25; wet.gain.value = 0.18;
  const lead = oc.createGain(); lead.connect(out); lead.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(out);
  out.connect(oc.destination);
  for (const n of song.notes) voice(oc, n.inst === 'bass' ? out : lead, n.inst, n.t * spb, n.d * spb, midiHz(n.m), n.v);
  for (const h of song.hits) drum(oc, out, h.inst, h.t * spb, h.v);
  const rendered = await new Promise((res, rej) => {
    oc.oncomplete = (e) => res(e.renderedBuffer);
    const p = oc.startRendering(); if (p?.then) p.then(res, rej);
  });
  if (song.oneShot) return { buffer: rendered, loop: false };
  // fold the tail (notes ringing past the end) back onto the start => seamless loop
  const ac = audio.ctx;
  const n = Math.floor(loopLen * RATE);
  const buf = ac.createBuffer(1, n, RATE);
  const src = rendered.getChannelData(0), dst = buf.getChannelData(0);
  for (let i = 0; i < n; i++) dst[i] = src[i];
  for (let i = n; i < src.length && i - n < n; i++) dst[i - n] += src[i];
  return { buffer: buf, loop: true };
}

// ------------------------------------------------------------------ player
const cache = new Map(); // spec -> Promise<{buffer, loop}>
function resolve(name) { return MUSIC[name] || name; }
function load(spec) {
  if (!cache.has(spec)) {
    cache.set(spec, (async () => {
      const m = /^gen:(\w+):(\d+)$/.exec(spec);
      if (m) return renderGen(m[1], +m[2]);
      const res = await fetch(spec);
      if (!res.ok) throw new Error(`music ${spec}: ${res.status}`);
      const arr = await res.arrayBuffer();
      const buffer = await new Promise((ok, no) => audio.ctx.decodeAudioData(arr, ok, no));
      return { buffer, loop: true };
    })().catch((e) => { cache.delete(spec); throw e; }));
  }
  return cache.get(spec);
}

let current = null; // { spec, src, gain }
let wanted = null;  // spec we're trying to play (handles races)
let gameTrack = null;

function fadeOut(cur, secs = 0.6) {
  if (!cur) return;
  const ac = audio.ctx, t = ac.currentTime;
  cur.gain.gain.cancelScheduledValues(t);
  cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
  cur.gain.gain.linearRampToValueAtTime(0, t + secs);
  try { cur.src.stop(t + secs + 0.05); } catch { /* already stopped */ }
}

export const music = {
  get playing() { return current?.spec || null; },
  get gameTrack() { return gameTrack; },
  styles: STYLES,

  /** Start a looping track (crossfades from the current one). Unknown/empty name = stop. */
  async play(name, { fade = 0.8 } = {}) {
    const spec = resolve(name);
    if (!spec || !audio.ctx) { if (!spec) this.stop(); return; }
    if (current?.spec === spec) return;
    wanted = spec;
    let track;
    try { track = await load(spec); } catch (e) { console.warn(e); return; }
    if (wanted !== spec) return; // something else was asked for meanwhile
    const ac = audio.ctx;
    fadeOut(current, fade);
    const src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = track.buffer; src.loop = track.loop;
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(1, ac.currentTime + fade);
    src.connect(gain).connect(audio.musicBus);
    src.start();
    current = { spec, src, gain };
  },

  stop({ fade = 0.6 } = {}) { wanted = null; if (audio.ctx) fadeOut(current, fade); current = null; },

  /** Back to the running game's own track (after e.g. music.play('sneaky')). */
  resume() { return gameTrack ? this.play(gameTrack) : this.stop(); },

  /** One-shot jingle over the music; the music dips while it plays. */
  async jingle(name = 'win') {
    const spec = resolve(name);
    if (!spec || !audio.ctx) return;
    let track; try { track = await load(spec); } catch (e) { console.warn(e); return; }
    const ac = audio.ctx, src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = track.buffer; g.gain.value = 1.4;
    src.connect(g).connect(audio.sfxBus);
    audio.duck(true, 0.85);
    src.onended = () => audio.duck(false);
    src.start();
  },

  /** Pre-render / pre-fetch a track so play() starts instantly. */
  preload(name) { const s = resolve(name); if (s && audio.ctx) load(s).catch(() => {}); },

  /** Runtime hook: called when a game (or the menu) starts. */
  forScreen(id) { gameTrack = MUSIC[id] || null; return gameTrack ? this.play(gameTrack) : this.stop(); },
};
