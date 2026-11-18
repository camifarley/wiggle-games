---
name: new-release
description: Start a new release (v1.1, v2.0…) of an existing game the safe way, or check that no old release was edited. Use when a builder is about to change a game ("make v1.3 with…", "Bubble Pop v1.1", playtest fixes), when converting a plain index.js game to release folders, and before opening a PR that touches a game. Copies the latest release folder, adds a placeholder cover and the meta.json entry, and runs the frozen-old-releases check.
---

# New release

Every game keeps every version playable (CLAUDE.md "Releases"). Old `vX.Y/` folders are frozen. This skill does
the bookkeeping so builders only write the new version.

## 1. Make the release folder
```bash
node .claude/skills/new-release/new-release.mjs <game> <version> "<title>"     # e.g. 01 1.2 "Fishy friends!"
```
- `<game>`: folder name or number (`01-bubble-pop`, `01`, `1`). `<version>`: minor for tweaks/fixes (`1.1`), major
  for big changes (`2.0`). `<title>`: 2–3 short words the kid sees on the picker card.
- A game with a **plain `index.js`** (no releases yet) is first moved to `v1.0/` with `git mv` (unchanged, history
  kept) and gets a placeholder `v1.0/cover.svg` and a `releases` list. Other files in the folder move too: fix
  relative imports (`../../core` becomes `../../../core` in the NEW release only; v1.0 must stay byte-identical, so if
  v1.0 imports the core with a relative path that breaks, stop and ask: that is a real conflict with the freeze rule).
- Then it copies the latest release (or `--from <version>`) to `v<version>/`, writes a **placeholder** cover and adds
  the `meta.json` entry (oldest first, one line per release).

## 2. Build the release
- Edit only `v<version>/` (and `src/core/` under the core rules). Show `v${ctx.release}` small in the HUD.
- **Redraw the cover** (`v<version>/cover.svg`, 400×300): a picture of the main thing that changed. The placeholder
  says PLACEHOLDER in a comment; don't ship it. Give a moved v1.0 a real cover too.
- Fix any `../` import depth in the new folder if it was copied from a plain game.
- **Take the menu screenshot** once the release plays: `npm run shots <game>` writes `v<version>/shot.webp`
  (640×400, fake camera only; the menu card shows the latest release's shot). If the default moment is dull, export a
  `shot` hook on the game object (`shot: { wait, keys, setup(ctx) }`, see `scripts/shots.mjs`) to stage mid-action.
  Commit the `.webp`. `npm test` warns about latest releases with no shot.

## 3. Check before the PR
```bash
node .claude/skills/new-release/new-release.mjs --check            # vs origin/main (git fetch first), or: --check main
```
Fails if any release that exists on main changed (adding or re-shooting its `shot.webp` is fine), or if a game moved from `index.js` to `v1.0/index.js` with edits.
The one allowed exception (a 🔧 grown-up/test tool hook with no gameplay change) must be called out in the PR.
Then check the picker in the browser: `#/play/<game>` shows every version, and the old ones still play.

`--root <dir>` points the script at another games folder (used to test the script on a scratch copy).
