// Finds games automatically. To add a game, create a folder:
//   src/games/NN-your-game/meta.json   { "title", "icon", "color" }
//   src/games/NN-your-game/index.js    export default { needs, init, update, draw, destroy }
// NN is the number the kid sees on the menu. Folders starting with "_" are ignored.
// Nothing in this file needs editing when you add a game.

const metas = import.meta.glob('./*/meta.json', { eager: true, import: 'default' });
const loaders = import.meta.glob('./*/index.js'); // lazy: game code loads only when picked

export const games = Object.entries(metas)
  .map(([path, meta]) => {
    const folder = path.split('/')[1];
    const m = folder.match(/^(\d+)-(.+)$/);
    return m && {
      id: folder,
      number: Number(m[1]),
      ...meta,
      load: () => loaders[`./${folder}/index.js`]().then((mod) => mod.default),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.number - b.number);
