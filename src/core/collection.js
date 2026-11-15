// A saved collection (sticker book, alien passport...): which ids the kid has found, saved per device, with
// export / import that MERGES (never loses an entry). Pure logic + localStorage; no DOM. Tested by npm test.
// Pattern from Mega Roll's sticker book (which keeps its own frozen copy in its v1.0 folder).
//
//   const c = createCollection('wiggle.mygame.book', { kind: 'my-game-stickers', valid: (id) => !!parseId(id) })
//   c.add(id, { m: 'where it was found' })  -> true the FIRST time (show "NEW!")
//   c.has(id), c.get(id) -> { n: times found, t: first time (ms), ...extra }, c.ids(), c.count
//   c.exportJSON(extra)  -> text; c.importJSON(text) -> how many were new (throws on a wrong file)
//   c.save() is called by add/import automatically (set { autosave: false } to batch writes)
//
// Ids should be stable readable text ("blob.pink.spots.bow.tiny"): lists may grow, never rename keys.
// `storage` can be swapped for tests (anything with getItem / setItem).

export function createCollection(key, { kind = key, valid = () => true, storage = globalThis.localStorage, autosave = true } = {}) {
  let found = {};
  const c = {
    key, kind,
    get found() { return found; },
    load() {
      found = {};
      try {
        const d = JSON.parse(storage?.getItem(key));
        if (d && d.found && typeof d.found === 'object') for (const [id, f] of Object.entries(d.found)) if (valid(id) && f) found[id] = f;
      } catch { /* empty or broken: start fresh */ }
      return c;
    },
    save() { try { storage?.setItem(key, JSON.stringify({ v: 1, found })); } catch { /* private mode / full */ } },
    has: (id) => !!found[id],
    get: (id) => found[id] || null,
    ids: () => Object.keys(found),
    get count() { return Object.keys(found).length; },
    add(id, extra = {}) {
      if (!valid(id)) return false;
      const f = found[id];
      if (f) { f.n = (f.n || 1) + 1; if (autosave) c.save(); return false; }
      found[id] = { n: 1, t: Date.now(), ...extra };
      if (autosave) c.save();
      return true;
    },
    clear() { found = {}; if (autosave) c.save(); },
    exportJSON(extra = {}) {
      return JSON.stringify({ kind, version: 1, exportedAt: new Date().toISOString(), found, ...extra });
    },
    // merges another device's file into this one; returns how many ids were new
    importJSON(text) {
      const d = typeof text === 'string' ? JSON.parse(text) : text;
      if (!d || d.kind !== kind || typeof d.found !== 'object') throw new Error(`not a ${kind} file`);
      let added = 0;
      for (const [id, f] of Object.entries(d.found)) {
        if (!valid(id) || !f) continue;
        const mine = found[id];
        if (!mine) { found[id] = { ...f, n: +f.n || 1, t: +f.t || Date.now() }; added++; }
        else {
          mine.n = Math.max(mine.n || 1, +f.n || 1);
          if (+f.t && +f.t < mine.t) Object.assign(mine, { ...f, n: mine.n, t: +f.t }); // keep the earliest find
        }
      }
      if (autosave) c.save();
      return added;
    },
  };
  return c.load();
}
