// Sound effects made with Web Audio (no files to load), plus a spoken voice.
// iOS requires a tap before audio works: ui.js calls audio.unlock() on the Play tap.
//
//   sfx.pop()  sfx.ding()  sfx.boing()  sfx.whoosh()  sfx.tada()  sfx.tone(freq, dur, type)
//   say('Pop the bubbles!')

let ac = null;

export const audio = {
  unlock() {
    try {
      if (ac) { if (ac.state !== 'running') ac.resume(); return; }
      ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      // play a silent blip so iOS fully unlocks
      const o = ac.createOscillator(), g = ac.createGain();
      g.gain.value = 0; o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.01);
      // warm up speech on iOS
      if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    } catch { /* no audio, no problem */ }
  },
  get ctx() { return ac; },
};

function env(freqFrom, freqTo, dur, type = 'sine', vol = 0.3, when = 0) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqFrom, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tone: (f, dur = 0.2, type = 'sine', vol = 0.3) => env(f, f, dur, type, vol),
  pop: () => env(500 + Math.random() * 400, 1400, 0.09, 'sine', 0.35),
  ding: () => { env(880, 880, 0.35, 'triangle', 0.25); env(1320, 1320, 0.4, 'sine', 0.15, 0.05); },
  boing: () => env(180, 520, 0.35, 'square', 0.12),
  whoosh: () => env(1200, 120, 0.3, 'sawtooth', 0.06),
  tada: () => [523, 659, 784, 1047].forEach((f, i) => env(f, f, 0.3, 'triangle', 0.22, i * 0.09)),
};

let lastSay = 0;
export function say(text, { rate = 1.05, pitch = 1.3, interrupt = true } = {}) {
  if (!('speechSynthesis' in window)) return;
  const now = performance.now();
  if (!interrupt && speechSynthesis.speaking) return;
  if (now - lastSay < 300) return;
  lastSay = now;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = pitch;
  speechSynthesis.speak(u);
}
