// v1.1: turns src/credits.json (+ family names typed on this device) into a gentle credit scroll.
//   lines:   [{ text, kind: 'header'|'name'|'role'|'note', y, h, section, say?, moment? }]
//            y / h in "line units" (1 = one name line); the scroll moves at a steady rate in these units.
//   moments: big cloud cards for the key sections (credits.json `highlight`), shown briefly while
//            their header line comes into view; the scroll keeps drifting underneath.
// Same-source sound packs collapse into one name line + a list of packs, so the scroll stays ~2½ min.

const H = { header: 1.5, name: 1.15, role: 0.95, note: 0.95, gapBefore: 1.6 };
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
      moments.push({ kind: 'card', key: `m${moments.length}`, lines: [{ text: `${sec.icon || '✨'} ${sec.title}`, size: 'head' }, ...hl], say: `${sec.title}!` });
    }
    add(`${sec.icon || '✨'}  ${sec.title}`, 'header', { ...header, say: sec.highlight ? null : `${sec.title}!` });
    for (let i = 0; i < entries.length;) {
      const e = entries[i];
      let j = i + 1;
      while (sec.id === 'sounds' && e.source && j < entries.length && entries[j].source === e.source) j++;
      if (j - i >= 2) { // a run of packs from one source: "Kenney.nl" + "Interface Sounds · Digital Audio · ..."
        const run = entries.slice(i, j);
        add(e.source, 'name');
        const names = run.map((r) => (r.name === e.source ? r.role : r.name));
        for (let k = 0; k < names.length; k += 2) add(names.slice(k, k + 2).join('  ·  '), 'note');
        if (run.every((r) => r.license === e.license)) add(e.license, 'role');
        i = j; continue;
      }
      const fam = e.family && String(family[e.family] || '').trim();
      add(nameOf(e), 'name', { say: fam || e.isExtra ? `Thank you, ${fam || e.name}!` : null });
      if (fam) add(e.name, 'role');
      if (e.role) add(e.role, 'role');
      if (meta(e)) add(meta(e), 'role');
      i++;
    }
  }
  return { lines, moments, height: y };
}
