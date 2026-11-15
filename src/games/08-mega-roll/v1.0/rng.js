// Seeded randomness for Mega Roll. Pure (no DOM), so `npm test` can check that a seed always makes the same
// mountain. Every purpose gets its OWN stream, keyed by (seed, stream name, chunk index, item index):
// tweaking how objects are placed can never reshuffle which stickers they are, and vice versa.

// 32-bit string/number hash (FNV-1a, then a murmur-style finalizer)
export function hash(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x2c; h = Math.imul(h, 16777619); // separator, so ('ab','c') != ('a','bc')
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// mulberry32: tiny, fast, good enough for games
export function mulberry32(a) {
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A random stream with helpers. stream(seed, 'place', chunk, item)
export function stream(...key) {
  const r = mulberry32(hash(...key));
  return {
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => a + Math.floor(r() * (b - a + 1)), // inclusive
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    // weighted pick: items [{ w, ... }] or a parallel weights array
    weighted(arr, weights = arr.map((x) => x.w)) {
      const total = weights.reduce((a, b) => a + b, 0);
      let k = r() * total;
      for (let i = 0; i < arr.length; i++) { k -= weights[i]; if (k < 0) return arr[i]; }
      return arr[arr.length - 1];
    },
  };
}
