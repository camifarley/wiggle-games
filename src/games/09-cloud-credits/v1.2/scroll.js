// v1.2: turns src/credits.json (+ family names typed on this device) into ONE credit roll plus big cloud cards.
//   lines:   [{ text, kind: 'header'|'name'|'by'|'role'|'note', y, h, section }]
//            y / h in "line units" (1 = one name line); the roll moves at a steady rate in these units.
//   moments: big cloud cards for the key sections (credits.json `highlight`), in section order. `p` = the roll
//            position where that section starts. People on a card are left out of the roll (nobody repeated).
// An ARRANGER turns moments into "stops": { card, p } = when the roll reaches p, it pauses and hides while the card
// shows alone. Two layouts the parent is comparing (delete the loser here, plus its 🔧 choice in settings.js):
//   a "Big first": every card first (all stops at p = 0, makers -> musicians -> the rest), then the roll.
//   b "Chapters":  each section opens with its card, then its remaining entries roll.
// Every credit shows its person ("by congusbongus"); sound packs are grouped under the person who made them.

export const ARRANGERS = {
  a: (moments) => [...moments].sort((x, y) => x.order - y.order).map((card) => ({ card, p: 0 })),
  b: (moments) => moments.map((card) => ({ card, p: card.p })),
};
export const LAYOUT_NAMES = { a: 'Big first', b: 'Chapters' };

const H = { header: 1.5, name: 1.15, by: 1.0, role: 0.95, note: 0.95, gapBefore: 1.6 };
const meta = (e) => [e.source, e.license].filter(Boolean).join(' · ');

export function parseExtra(text = '') {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l) => {
    const [name, ...rest] = l.split(/\s+[-–:]\s+|:\s*/);
    return { name: name.trim(), role: rest.join(' ').trim() || 'Thank you!' };
  });
}

export function buildScroll(credits, family = {}) {
  const lines = [], moments = [];
  let y = 0;
  const add = (text, kind, extra = {}) => { lines.push({ text, kind, y, h: H[kind], ...extra }); y += H[kind]; };
  for (const sec of credits.sections) {
    if (lines.length) y += H.gapBefore;
    const nameOf = (e) => (e.family && String(family[e.family] || '').trim()) || e.name;
    let entries = sec.entries;
    if (sec.id === 'thanks') {
      const extra = parseExtra(family.extra).map((x) => ({ ...x, isExtra: true }));
      const you = entries.filter((e) => e.name === 'You!');
      entries = [...entries.filter((e) => e.name !== 'You!'), ...extra, ...you];
    }
    // Part 1 (big cards): a `highlight` section becomes a card. Whoever is on a card is NOT repeated in the roll:
    // highlight: true = the whole section; "Track · by Person" lines = that track's entry.
    if (sec.highlight) {
      let hl;
      if (sec.highlight === true) {
        hl = entries.flatMap((e) => [{ text: nameOf(e), size: 'big' }, ...(e.role ? [{ text: e.role, size: 'small' }] : [])]);
        entries = [];
      } else {
        hl = sec.highlight.lines.flatMap((t) => {
          const [what, who] = t.split(' · by ');
          return who ? [{ text: who, size: 'big' }, { text: what, size: 'small' }] : [{ text: t, size: 'mid' }];
        });
        const shown = sec.highlight.lines.filter((t) => t.includes(' · by ')).map((t) => t.split(' · by ')[0]);
        entries = entries.filter((e) => !shown.includes(e.name));
      }
      // people first (the makers), then the musicians, then the rest
      const order = sec.highlight === true ? 0 : sec.id === 'music' ? 1 : 2;
      moments.push({ kind: 'card', key: `m${sec.id}`, order, lines: [{ text: `${sec.icon || '✨'} ${sec.title}`, size: 'head' }, ...hl] });
    }
    const card = sec.highlight ? moments[moments.length - 1] : null;
    if (!entries.length) { if (lines.length) y -= H.gapBefore; if (card) card.p = y; continue; } // everyone in it was on a big card
    if (card) card.p = y;
    add(`${sec.icon || '✨'}  ${sec.title}`, 'header', { section: sec.title });
    // v1.2: sound packs are grouped by the person who made them, so each name shows once with its packs under it
    if (sec.id === 'sounds') {
      const groups = new Map();
      for (const e of entries) {
        const k = e.author || `#${e.name}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(e);
      }
      for (const [k, run] of groups) {
        const e = run[0];
        if (!e.author) { add(e.name, 'name'); if (e.role) add(e.role, 'role'); continue; }
        add(e.author, 'name');
        const packs = run.map((r) => (r.name === r.source ? r.role : r.name));
        for (let n = 0; n < packs.length; n += 2) add(packs.slice(n, n + 2).join('  ·  '), 'note');
        const where = [...new Set(run.map((r) => r.source))].join(', ');
        add([where, run.every((r) => r.license === e.license) ? e.license : ''].filter(Boolean).join(' · '), 'role');
      }
      continue;
    }
    for (const e of entries) {
      const fam = e.family && String(family[e.family] || '').trim();
      add(nameOf(e), 'name');
      if (e.author) add(`by ${e.author}`, 'by');
      if (fam) add(e.name, 'role');
      if (e.role) add(e.role, 'role');
      if (meta(e)) add(meta(e), 'role');
    }
  }
  return { lines, moments, height: y };
}
