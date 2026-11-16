// Finds games automatically. To add a game, create a folder:
//   src/games/NN-your-game/meta.json   { "title", "icon", "color" }
//   src/games/NN-your-game/index.js    export default { needs, init, update, draw, destroy }
// NN is the number the kid sees on the menu. Folders starting with "_" are ignored.
// Nothing in this file needs editing when you add a game.
//
// RELEASES: a game can keep every version playable. Put each version in its own folder
// and list them (oldest first) in meta.json:
//   src/games/NN-x/v1.0/index.js  + v1.0/cover.svg   (frozen: never edit an old release)
//   src/games/NN-x/v1.1/index.js  + v1.1/cover.svg
//   meta.json: "releases": [ { "version": "1.0", "title": "First bugs!" }, { "version": "1.1", "title": "New bugs!" } ]
// A game with one release (or a plain index.js) opens straight away; more than one shows a picker.
// meta.json "last": true keeps a card at the end of the menu whatever its number (the credits).
//
// SCREENSHOTS: each release may have a shot.webp (v1.1/shot.webp, or NN-x/shot.webp for a plain index.js game),
// made by `npm run shots <game>` from ?fakecam only (never the real camera: the repo is public). The menu card shows
// the latest release's shot, the picker each release's shot (falling back to cover.svg, then the icon).

const metas = import.meta.glob('./*/meta.json', { eager: true, import: 'default' });
const loaders = import.meta.glob(['./*/index.js', './*/v*/index.js']); // lazy: code loads only when picked
const covers = import.meta.glob('./*/v*/cover.{svg,png,jpg,webp}', { eager: true, query: '?url', import: 'default' });

// URLs only (not eager image data): the browser fetches each picture when its card is drawn
const shots = import.meta.glob(['./*/shot.webp', './*/v*/shot.webp'], { eager: true, query: '?url', import: 'default' });

function shotFor(folder, version, plain) {
  return shots[plain ? `./${folder}/shot.webp` : `./${folder}/v${version}/shot.webp`] || null;
}

function coverFor(folder, version) {
  const key = Object.keys(covers).find((k) => k.startsWith(`./${folder}/v${version}/cover.`));
  return key ? covers[key] : null;
}

export const games = Object.entries(metas)
  .map(([path, meta]) => {
    const folder = path.split('/')[1];
    const m = folder.match(/^(\d+)-(.+)$/);
    if (!m) return null;
    const releases = (meta.releases?.length ? meta.releases : [{ version: '1.0', title: meta.title }]).map((r) => {
      const file = meta.releases?.length ? `./${folder}/v${r.version}/index.js` : `./${folder}/index.js`;
      return {
        ...r,
        cover: coverFor(folder, r.version),
        shot: shotFor(folder, r.version, !meta.releases?.length),
        load: () => loaders[file]().then((mod) => mod.default),
      };
    });
    return {
      id: folder,
      number: Number(m[1]),
      ...meta,
      releases,
      latest: releases[releases.length - 1],
    };
  })
  .filter(Boolean)
  .sort((a, b) => (a.last ? 1 : 0) - (b.last ? 1 : 0) || a.number - b.number);
