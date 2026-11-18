// v1.2: turns src/credits.json (+ family names typed on this device) into ONE calm credit roll (no big cards,
// no emojis: the parent's call). Two steps:
//   buildScroll(credits, family) -> items: [{ text, kind, gap }]   what to show, in order
//   flow(items, fits)            -> { lines: [{ text, kind, y, h }], height }
//     lays the items out for the current screen: a line wider than the column wraps at spaces (fits(text, kind)
//     says whether it fits), so nothing runs off the edge on a phone. y / h are in "line units" (1 = one name line).
// Spacing: a blank line between credits (each person / track block), a bigger gap before each section title.
// Every credit shows its person ("by congusbongus"); sound packs are grouped under the person who made them,
// listed "A · B · C" and wrapped between packs (never inside a pack's name unless one name alone is too wide).

export const H = { header: 1.5, name: 1.15, by: 1.0, role: 0.95, note: 0.95 };
const GAP = { section: 2.2, credit: 1.0 }; // line units of empty space before a section title / between credits
const meta = (e) => [e.source, e.license].filter(Boolean).join(' · ');

export function parseExtra(text = '') {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l) => {
    const [name, ...rest] = l.split(/\s+[-–:]\s+|:\s*/);
    return { name: name.trim(), role: rest.join(' ').trim() || 'Thank you!' };
  });
}

export function buildScroll(credits, family = {}) {
  const items = [];
  let gap = 0;
  const add = (text, kind) => { if (text) { items.push({ text, kind, gap }); gap = 0; } };
  const block = (fn, first) => { if (!first) gap = GAP.credit; fn(); }; // one credit = one block, a blank line between
  const nameOf = (e) => (e.family && String(family[e.family] || '').trim()) || e.name;
  for (const sec of credits.sections) {
    let entries = sec.entries;
    if (sec.id === 'thanks') {
      const extra = parseExtra(family.extra).map((x) => ({ ...x, isExtra: true }));
      const you = entries.filter((e) => e.name === 'You!');
      entries = [...entries.filter((e) => e.name !== 'You!'), ...extra, ...you];
    }
    if (!entries.length) continue;
    gap = items.length ? GAP.section : 0;
    add(sec.title, 'header');
    gap = 0.3;
    if (sec.id === 'sounds') {
      // grouped by the person who made them: each name once, its packs listed under it
      const groups = new Map();
      for (const e of entries) {
        const k = e.author || `#${e.name}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(e);
      }
      [...groups.values()].forEach((run, i) => block(() => {
        const e = run[0];
        if (!e.author) { add(e.name, 'name'); add(e.role, 'role'); return; }
        add(e.author, 'name');
        add(run.map((r) => (r.name === r.source ? r.role : r.name)).join(' · '), 'note'); // wraps between packs
        const where = [...new Set(run.map((r) => r.source))].join(', ');
        add([where, run.every((r) => r.license === e.license) ? e.license : ''].filter(Boolean).join(' · '), 'role');
      }, i === 0));
      continue;
    }
    entries.forEach((e, i) => block(() => {
      const fam = e.family && String(family[e.family] || '').trim();
      add(nameOf(e), 'name');
      if (e.author) add(`by ${e.author}`, 'by');
      if (fam) add(e.name, 'role');
      add(e.role, 'role');
      add(meta(e), 'role');
    }, i === 0));
  }
  return items;
}

// wrap so every line fits the column: lists ("A · B · C") break between items, anything else at spaces
function wrapWords(text, kind, fits) {
  const out = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && !fits(next, kind)) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
function wrap(text, kind, fits) {
  if (fits(text, kind)) return [text];
  if (!text.includes(' · ')) return wrapWords(text, kind, fits);
  const out = [];
  let cur = '';
  for (const part of text.split(' · ')) {
    const next = cur ? `${cur} · ${part}` : part;
    if (fits(next, kind)) { cur = next; continue; }
    if (cur) out.push(cur);
    if (fits(part, kind)) cur = part;
    else { const w = wrapWords(part, kind, fits); cur = w.pop(); out.push(...w); }
  }
  if (cur) out.push(cur);
  return out;
}

export function flow(items, fits) {
  const lines = [];
  let y = 0;
  for (const it of items) {
    y += it.gap || 0;
    const parts = wrap(it.text, it.kind, fits);
    parts.forEach((text, i) => {
      const h = H[it.kind] * (i < parts.length - 1 ? 0.92 : 1); // wrapped continuation lines sit a little tighter
      lines.push({ text, kind: it.kind, y, h });
      y += h;
    });
  }
  return { lines, height: y };
}
