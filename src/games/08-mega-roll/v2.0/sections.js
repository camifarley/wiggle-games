// Hand-made scenes (vignettes) for Mega Roll v2.0, the Robot Unicorn Attack 2 approach: authored SECTIONS snapped
// together in a seeded order, with seeded variety inside each (colors, patterns, hats, mirroring, small offsets),
// so sections become familiar ("the duck pond!") while every mountain is still different. Pure data + logic.
//
// A section: { id, theme, pool: 'intro' | 'busy' | 'village', len (m), leads: species that can star in it,
//              build(S) }. build() places things with S.put(shape, x, d, opts) where x = meters from the path's
// center line (mirrored for free by S.mx) and d = meters into the section. opts: { act, group, look, size, rare }.
//   act   what an animal is DOING (idle animation): drink, peck, graze, waddle (cross the path in a line), hop,
//         slide (penguins), herd (sheepdog circles), sit, dance, wave, flop, look (owls turn their heads)
//   group things in one group share a look (a flock of matching sheep); look = fixed recipe fields
// Decor (flat, never in the way): S.pond / S.mud / S.ice (x, d, r), S.blanket (x, d), S.stream (d, w) = a stream
// across the path (jump it for a bonus), S.ramp (x, d).
// S.lead = the species this section stars (the run's newest species when one is due: it gets the NEW FRIEND reveal),
// S.any() = any species unlocked so far, S.n(k) = k scaled by the act's density.

export const THEME_INFO = {
  farm: {
    key: 'farm', title: 'Farm', emoji: '🐄', color: '#9fd86b', sky: '#86ccff', fog: '#d4efff',
    // the order species are introduced in a run (dog always comes with the sheep)
    species: ['duck', 'chicken', 'sheep', 'cow', 'pig', 'goat'],
    companions: { sheep: ['dog'] },
    things: ['hay', 'fence', 'mailbox', 'cart', 'pumpkin', 'crate', 'barrel', 'flag', 'bench', 'lamp'],
    tough: ['house', 'barn', 'windmill', 'tractor'], marker: 'flag',
    ground: { calm: ['#9fd86b', '#e8d6a8', '#5aa04a'], village: ['#b5e06b', '#e3c98f', '#6aa83f'] },
    landmark: 'bigbarn', landmarkName: 'GIANT BARN',
  },
  forest: {
    key: 'forest', title: 'Forest', emoji: '🌲', color: '#4fa860', sky: '#8fd0f0', fog: '#d8f0e4',
    species: ['bunny', 'deer', 'frog', 'fox', 'squirrel', 'owl'],
    companions: {},
    things: ['mushroom', 'bush', 'tree', 'log', 'basket', 'rock', 'dino'],
    tough: ['cabin', 'rock'], marker: 'mushroom',
    ground: { calm: ['#6fbf5a', '#c9dd9a', '#2f7a4a'], village: ['#7cc65e', '#d8c592', '#3a7f45'] },
    landmark: 'logtower', landmarkName: 'LOG TOWER',
  },
  snowy: {
    key: 'snowy', title: 'Snowy', emoji: '❄️', color: '#bfe8ff', sky: '#a8d8ff', fog: '#e6f4ff',
    species: ['penguin', 'reindeer', 'seal', 'polar'],
    companions: {},
    things: ['snowman', 'pine', 'sled', 'robot'],
    tough: ['igloo'], marker: 'pine',
    ground: { calm: ['#eef6ff', '#ffffff', '#cfe0f0'], village: ['#e8f2fc', '#f6fbff', '#bcd4ea'] },
    landmark: 'icecastle', landmarkName: 'ICE CASTLE',
  },
};


export const SECTIONS = [
  // ===================== FARM =====================
  { id: 'duck-pond', theme: 'farm', pool: 'intro', len: 40, leads: ['duck', 'goat'], build(S) {
    S.pond(-6, 20, 4.2);
    const k = S.n(5);
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 1.4 - 0.2; S.put(S.lead, -6 + Math.cos(a) * 4.6, 20 + Math.sin(a) * 4.6, { act: 'drink', group: 'flock' }); }
    S.put('flag', 3, 8); S.put('fence', 7, 30);
  } },
  { id: 'duckling-crossing', theme: 'farm', pool: 'intro', len: 36, leads: ['duck', 'chicken'], build(S) {
    // mom in front, a line of tiny babies waddling across the path
    S.put(S.lead, -4, 18, { act: 'waddle', group: 'mom' });
    const k = S.n(5);
    for (let i = 0; i < k; i++) S.put(S.lead, -5.4 - i * 1.1, 18, { act: 'waddle', group: 'babies', size: 'tiny' });
    S.put('mailbox', 6, 6); S.put('hay', 7, 30);
  } },
  { id: 'pecking', theme: 'farm', pool: 'intro', len: 40, leads: ['chicken', 'duck'], build(S) {
    S.put('hay', 5, 16); S.put('fence', 7, 26);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-3, 6), S.range(10, 32), { act: 'peck' });
  } },
  { id: 'meadow', theme: 'farm', pool: 'intro', len: 44, leads: null, build(S) {
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(i % 3 === 2 ? S.any() : S.lead, S.range(-7, 7), S.range(6, 40), { act: 'graze' });
    S.put('flag', -8, 12); S.put('pumpkin', 7, 22); S.ramp(0, 34);
  } },
  { id: 'sheepdog', theme: 'farm', pool: 'busy', len: 46, leads: ['sheep'], build(S) {
    const cx = S.range(-2, 2), cd = 24, k = S.n(8);
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2; S.put('sheep', cx + Math.cos(a) * 2.6, cd + Math.sin(a) * 2.6, { act: 'graze', group: 'flock' }); }
    S.put('dog', cx + 4, cd, { act: 'herd' });
    S.put('fence', -8, 10); S.put('fence', 8, 38);
  } },
  { id: 'barnyard', theme: 'farm', pool: 'busy', len: 48, leads: ['chicken', 'pig', 'duck'], build(S) {
    S.put('barn', -8, 22); S.put('tractor', S.range(-1, 1), 44);
    const k = S.n(7);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-4, 3), S.range(12, 34), { act: S.lead === 'pig' ? 'graze' : 'peck' });
    S.put('hay', 4, 14); S.put('hay', 5, 17); S.put('cart', 3, 38); S.put('barrel', -2, 42);
  } },
  { id: 'pig-pen', theme: 'farm', pool: 'busy', len: 44, leads: ['pig', 'goat'], build(S) {
    S.mud(3, 22, 4.5);
    for (const [x, d] of [[-1.5, 16], [7.5, 16], [-1.5, 28], [7.5, 28]]) S.put('fence', x, d);
    const k = S.n(5);
    for (let i = 0; i < k; i++) S.put(S.lead, 3 + S.range(-3, 3), 22 + S.range(-3, 3), { act: 'dance', group: 'herd' });
    S.put('pumpkin', -6, 34); S.put(S.any(), -5, 8, { act: 'graze' });
  } },
  { id: 'cow-field', theme: 'farm', pool: 'busy', len: 50, leads: ['cow', 'sheep', 'goat'], build(S) {
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, (i % 2 ? 1 : -1) * S.range(1.5, 6), 8 + i * 6, { act: 'graze' });
    S.put('fence', -9, 12); S.put('fence', 9, 30); S.put('balloon', 6, 44); S.ramp(-1, 40);
  } },
  { id: 'main-street', theme: 'farm', pool: 'village', len: 56, leads: null, build(S) {
    for (let i = 0; i < 3; i++) { S.put('house', -9.5, 10 + i * 16); S.put(i === 1 ? 'barn' : 'house', 9.5, 16 + i * 14); }
    for (const d of [6, 24, 42]) { S.put('lamp', -5.5, d); S.put('mailbox', 5.5, d + 4); }
    S.put('house', S.range(-2, 2), 32); // one right in the way: bonk-bonk-CRASH
    const k = S.n(8);
    for (let i = 0; i < k; i++) S.put(i % 2 ? S.lead : S.pick(['crate', 'barrel', 'bench', 'cart']), S.range(-4, 4), S.range(8, 52), { act: 'waddle' });
  } },
  { id: 'market', theme: 'farm', pool: 'village', len: 52, leads: null, build(S) {
    S.put('house', -9.5, 14); S.put('tractor', S.range(-2, 2), 46); S.put('house', -9.5, 40);
    for (let row = 0; row < 3; row++) for (let c = -1; c <= 1; c++) S.put(S.pick(['pumpkin', 'crate', 'barrel', 'hay', 'cart']), c * 3 + S.range(-0.5, 0.5), 12 + row * 12, { group: `row${row}` });
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-5, 5), S.range(6, 48), { act: 'peck' });
  } },
  { id: 'windmill-hill', theme: 'farm', pool: 'village', len: 50, leads: null, build(S) {
    S.put('windmill', -9, 20); S.put('barn', S.range(-1.5, 1.5), 40); S.put('tractor', 6, 12);
    for (let i = 0; i < 4; i++) S.put('hay', S.range(-4, 4), 10 + i * 9);
    const k = S.n(7);
    for (let i = 0; i < k; i++) S.put(i % 3 ? S.lead : S.any(), S.range(-5, 5), S.range(8, 46), { act: 'graze' });
  } },

  // ===================== FOREST =====================
  { id: 'bunny-clearing', theme: 'forest', pool: 'intro', len: 40, leads: ['bunny', 'frog', 'squirrel'], build(S) {
    for (const [x, d] of [[-7, 10], [7, 16], [-8, 30]]) S.put('tree', x, d);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-5, 5), S.range(10, 34), { act: 'hop' });
    S.put('mushroom', 4, 26); S.put('mushroom', 5, 27.5);
  } },
  { id: 'deer-stream', theme: 'forest', pool: 'intro', len: 46, leads: ['deer', 'bunny', 'fox'], build(S) {
    S.stream(24, 4.5);
    const k = S.n(5);
    for (let i = 0; i < k; i++) S.put(S.lead, -6 + i * 2.8, 20.2, { act: 'drink', group: 'herd' });
    S.put('log', 6, 34); S.put('rock', -8, 40);
  } },
  { id: 'mushroom-ring', theme: 'forest', pool: 'intro', len: 40, leads: ['frog', 'bunny'], build(S) {
    const cx = S.range(-3, 3), k = S.n(7);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; S.put('mushroom', cx + Math.cos(a) * 3.4, 22 + Math.sin(a) * 3.4, { group: 'ring' }); }
    for (let i = 0; i < k; i++) S.put(S.lead, cx + S.range(-1.8, 1.8), 22 + S.range(-1.8, 1.8), { act: 'dance' });
    S.put('tree', -8, 8); S.put('tree', 8, 36);
  } },
  { id: 'picnic', theme: 'forest', pool: 'busy', len: 46, leads: null, build(S) {
    S.blanket(0, 22);
    S.put('basket', 0.5, 22); S.put('basket', -1.2, 23);
    const k = S.n(6);
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2; S.put(i % 2 ? S.lead : S.any(), Math.cos(a) * 3, 22 + Math.sin(a) * 3, { act: 'sit' }); }
    S.put('tree', -8, 12); S.put('tree', 8, 34);
  } },
  { id: 'fox-den', theme: 'forest', pool: 'busy', len: 44, leads: ['fox', 'bunny'], build(S) {
    S.put('rock', S.range(-2, 2), 38); S.put('log', 4, 12); S.put('log', 5, 30);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-4, 4), S.range(14, 36), { act: 'dance' });
  } },
  { id: 'squirrel-trees', theme: 'forest', pool: 'busy', len: 50, leads: ['squirrel', 'owl', 'bunny'], build(S) {
    for (let i = 0; i < 5; i++) S.put('tree', (i % 2 ? 1 : -1) * S.range(4, 8), 6 + i * 9);
    const k = S.n(8);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-5, 5), S.range(8, 46), { act: S.lead === 'owl' ? 'look' : 'hop' });
  } },
  { id: 'owl-logs', theme: 'forest', pool: 'busy', len: 44, leads: ['owl', 'squirrel', 'frog'], build(S) {
    const k = S.n(5);
    for (let i = 0; i < k; i++) { const x = S.range(-5, 5), d = 10 + i * 7; S.put('log', x, d); S.put(S.lead, x, d - 1.2, { act: 'look' }); }
    S.put('dino', 8, 30);
  } },
  { id: 'cabins', theme: 'forest', pool: 'village', len: 54, leads: null, build(S) {
    for (let i = 0; i < 3; i++) { S.put('cabin', -9.5, 10 + i * 16); S.put(i === 1 ? 'rock' : 'cabin', 9.5, 18 + i * 14); }
    S.put('cabin', S.range(-2, 2), 30);
    const k = S.n(9);
    for (let i = 0; i < k; i++) S.put(i % 3 === 0 ? S.pick(['log', 'basket', 'mushroom']) : i % 3 === 1 ? S.lead : S.any(), S.range(-4.5, 4.5), S.range(6, 50), { act: 'hop' });
  } },
  { id: 'logging-camp', theme: 'forest', pool: 'village', len: 50, leads: null, build(S) {
    S.put('cabin', S.range(-1.5, 1.5), 44); S.put('rock', 9, 20);
    for (let row = 0; row < 3; row++) for (let c = 0; c < 3; c++) S.put('log', -6 + c * 2.2, 10 + row * 13);
    const k = S.n(7);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-2, 6), S.range(8, 46), { act: 'dance' });
    S.ramp(2, 40);
  } },

  // ===================== SNOWY =====================
  { id: 'penguin-slide', theme: 'snowy', pool: 'intro', len: 44, leads: ['penguin', 'seal'], build(S) {
    S.ice(0, 22, 6);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-4, 4), 14 + i * 3, { act: 'slide', group: 'team' });
    S.put('pine', -8, 10); S.put('pine', 8, 34);
  } },
  { id: 'reindeer-games', theme: 'snowy', pool: 'intro', len: 40, leads: ['reindeer', 'penguin', 'polar'], build(S) {
    for (const [x, d] of [[-7, 8], [8, 18], [-8, 32]]) S.put('pine', x, d);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-5, 5), S.range(10, 34), { act: S.lead === 'reindeer' ? 'dance' : 'hop' });
  } },
  { id: 'snowman-builders', theme: 'snowy', pool: 'busy', len: 46, leads: null, build(S) {
    for (let i = 0; i < 3; i++) S.put('snowman', -5 + i * 5, 24 + S.range(-2, 2), { act: 'wave' });
    S.put('igloo', S.range(-2, 2), 42);
    const k = S.n(6);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-6, 6), S.range(10, 40), { act: 'dance' });
    S.ramp(0, 40);
  } },
  { id: 'seal-pool', theme: 'snowy', pool: 'busy', len: 46, leads: ['seal', 'penguin', 'polar'], build(S) {
    S.pond(-5, 22, 4.5);
    const k = S.n(6);
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 1.6; S.put(S.lead, -5 + Math.cos(a) * 5, 22 + Math.sin(a) * 5, { act: 'flop', group: 'pod' }); }
    S.put('pine', 7, 12); S.put('sled', 5, 34);
  } },
  { id: 'sled-hill', theme: 'snowy', pool: 'busy', len: 48, leads: null, build(S) {
    const k = S.n(5);
    for (let i = 0; i < k; i++) { const x = S.range(-5, 5), d = 8 + i * 8; S.put('sled', x, d); S.put(S.lead, x, d - 1.4, { act: 'sit' }); }
    S.put('pine', -8, 20); S.put('pine', 8, 40); S.ramp(0, 44);
  } },
  { id: 'igloo-town', theme: 'snowy', pool: 'village', len: 54, leads: null, build(S) {
    for (let i = 0; i < 3; i++) { S.put('igloo', -9.5, 10 + i * 16); S.put('igloo', 9.5, 18 + i * 14); }
    S.put('igloo', S.range(-2, 2), 30);
    for (const d of [14, 34]) S.put('snowman', S.range(-3, 3), d, { act: 'wave' });
    const k = S.n(9);
    for (let i = 0; i < k; i++) S.put(i % 3 ? S.lead : S.any(), S.range(-4.5, 4.5), S.range(6, 50), { act: 'slide' });
  } },
  { id: 'ice-market', theme: 'snowy', pool: 'village', len: 50, leads: null, build(S) {
    S.put('igloo', -9.5, 16); S.put('igloo', S.range(-1.5, 1.5), 44); S.put('igloo', 9.5, 34);
    for (let row = 0; row < 3; row++) for (let c = -1; c <= 1; c++) S.put(S.pick(['sled', 'robot', 'snowman', 'pine']), c * 3 + S.range(-0.5, 0.5), 10 + row * 12, { group: `row${row}` });
    const k = S.n(7);
    for (let i = 0; i < k; i++) S.put(S.lead, S.range(-5, 5), S.range(6, 46), { act: 'dance' });
  } },
];

// The finale stretch: a short approach lined with flags, then the landmark arena.
export const FINALE_APPROACH = 30; // m of approach before the landmark
export const ARENA = 26;           // m from the landmark's front to where the ball rolls back to between hits

// acts: 4 slots, each drawing sections from its own pool, with density climbing toward the finale
export const ACTS = [
  { name: 'calm', pool: 'intro', sections: 2, density: 0.6 },
  { name: 'busier', pool: 'busy', sections: 3, density: 0.9 },
  { name: 'village rush', pool: 'village', sections: 3, density: 1.25 },
  { name: 'finale', pool: null, sections: 0, density: 1 },
];
// which overall section index introduces species i of the theme (0 = from the start)
export const INTRODUCE_AT = [0, 1, 2, 3, 5, 6];

export const sectionsFor = (theme, pool) => SECTIONS.filter((s) => s.theme === theme && s.pool === pool);
