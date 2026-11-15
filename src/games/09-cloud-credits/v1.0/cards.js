// Turns src/credits.json (+ the family names typed on this device) into the ride's list of cards:
//   { kind: 'banner', title, icon, say }                       a ribbon with the section title
//   { kind: 'card', section, lines: [{ text, size }], say? }   a cloud with the credit on it
// size: 'big' (the name), 'mid' (list lines), 'small' (role, source · license).
// Sections with "group" entries sharing a `source` (sound packs) become a few list cards instead of one card
// per pack, so the ride stays about 2½ minutes.

const MAX_LINES = 4;
const meta = (e) => [e.source, e.license].filter(Boolean).join(' · ');

export function parseExtra(text = '') {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l) => {
    const [name, ...rest] = l.split(/\s+[-–:]\s+|:\s*/);
    return { name: name.trim(), role: rest.join(' ').trim() || 'Thank you!' };
  });
}

export function buildCards(credits, family = {}) {
  const out = [];
  for (const sec of credits.sections) {
    out.push({ kind: 'banner', title: sec.title, icon: sec.icon || '✨', say: `${sec.title}!` });
    let entries = sec.entries;
    if (sec.id === 'thanks') {
      const extra = parseExtra(family.extra);
      const you = entries.filter((e) => e.name === 'You!');
      entries = [...entries.filter((e) => e.name !== 'You!'), ...extra.map((x) => ({ ...x, isExtra: true })), ...you];
    }
    for (let i = 0; i < entries.length;) {
      const e = entries[i];
      // a run of entries from the same source -> list cards ("Kenney.nl": Interface Sounds, Digital Audio, ...)
      let j = i + 1;
      while (e.source && j < entries.length && entries[j].source === e.source && entries[j].assets && e.assets) j++;
      if (sec.id === 'sounds' && j - i >= 2) {
        const run = entries.slice(i, j);
        const chunks = Math.ceil(run.length / MAX_LINES), per = Math.ceil(run.length / chunks);
        const lic = run.every((r) => r.license === run[0].license) ? run[0].license : '';
        for (let c = 0; c < chunks; c++) {
          const part = run.slice(c * per, (c + 1) * per);
          out.push({ kind: 'card', section: sec.title, lines: [
            { text: e.source, size: 'big' },
            ...part.map((r) => ({ text: r.name === e.source ? r.role : r.name, size: 'mid' })),
            ...(lic ? [{ text: lic, size: 'small' }] : []),
          ], say: c === 0 ? `Thank you, ${e.source.replace('.nl', '').replace('.org', '')}!` : null });
        }
        i = j;
        continue;
      }
      // the chief tester is the co-designer unless another name is typed
      const fam = e.family && String(family[e.family] || (e.family === 'tester' ? family.codesigner : '') || '').trim();
      const lines = fam
        ? [{ text: fam, size: 'big' }, { text: e.name, size: 'small' }, ...(e.role ? [{ text: e.role, size: 'small' }] : [])]
        : [{ text: e.name, size: 'big' }, ...(e.role ? [{ text: e.role, size: 'small' }] : []), ...(meta(e) ? [{ text: meta(e), size: 'small' }] : [])];
      out.push({ kind: 'card', section: sec.title, lines, say: fam || e.isExtra ? `Thank you, ${fam || e.name}!` : null, family: !!(fam || e.isExtra) });
      i++;
    }
  }
  return out;
}
