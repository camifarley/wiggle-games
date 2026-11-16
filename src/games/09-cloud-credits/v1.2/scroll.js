// v1.1: turns src/credits.json (+ family names typed on this device) into a gentle credit scroll.
//   lines:   [{ text, kind: 'header'|'name'|'by'|'role'|'note', y, h, section, moment? }]
//            y / h in "line units" (1 = one name line); the scroll moves at a steady rate in these units.
//   moments: big cloud cards for the key sections (credits.json `highlight`), shown briefly while
//            their header line comes into view; the scroll keeps drifting underneath.
// v1.2: every credit shows its person ("by congusbongus"); sound packs are grouped under the person who made them.

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
    const header = { section: sec.title };
    if (sec.highlight) {
      const hl = sec.highlight === true
        ? [...entries.flatMap((e) => [{ text: nameOf(e), size: 'big' }, ...(e.role ? [{ text: e.role, size: 'small' }] : [])])]
        : sec.highlight.lines.map((t) => ({ text: t, size: 'mid' }));
      header.moment = moments.length;
      moments.push({ kind: 'card', key: `m${moments.length}`, lines: [{ text: `${sec.icon || '✨'} ${sec.title}`, size: 'head' }, ...hl] });
    }
    add(`${sec.icon || '✨'}  ${sec.title}`, 'header', header);
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
