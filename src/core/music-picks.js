// Which music plays where, picked by the parent and kid in the Sound Picker's Music section. Data only.
// Keys: 'menu', a game id (folder name like '06-smash-run'), or a mood a game can ask for
// ('sneaky', 'win'). Values: 'gen:<style>:<seed>' (generated in code, see music.js STYLES)
// or a file path like 'sounds/music/flowerbed.m4a'. A screen with no entry plays no music.
// Picks: sound-picks export of 2026-11-15 (music rows).

export const MUSIC = {
  menu: 'sounds/music/napping_on_a_cloud.m4a', // ⭐ Napping on a Cloud (OpenGameArt, CC0)
  '06-smash-run': 'sounds/music/platformer_0.m4a', // ⭐ Overworld Theme (OpenGameArt, CC0)
  '04-bounca-bugs': 'gen:hop:1', // 👍 (no ⭐ yet)
  '05-move-lab': 'gen:groove:1', // ⭐
  '08-mega-roll': 'gen:zoom:4', // ⭐ (game lands with PR #7)
  sneaky: 'gen:tiptoe:1', // ⭐ for "move slowly" rounds: ctx.music.play('sneaky')
  win: 'gen:fanfare:1', // ⭐ ctx.music.jingle('win')
};
