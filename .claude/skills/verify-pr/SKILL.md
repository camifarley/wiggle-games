---
name: verify-pr
description: Independently check a builder session's pull request before the parent merges it. Use when a builder reports "PR #N is open/ready", or the parent asks "is it ready?", "check the PR", "should I merge?". Test-merges the PR into the latest main in a temporary worktree, runs build + npm test with the real recordings, checks old game releases weren't edited, then smoke-tests in the Browser pane with the fake camera, and reports ready / not ready.
---

# Verify a PR

A builder's own report is a claim, not proof. Check it the same way every time, and never merge without the
parent saying so.

## 1. Automated checks (temporary worktree; the main checkout and its dev server are untouched)
```bash
bash .claude/skills/verify-pr/verify.sh <PR number> [port]     # default port 5199
```
It prints: PR title/branch/mergeable, merge-into-latest-main result (a conflict means the builder must `git merge
main` first, so send it back to the builder), build, `npm test` including every replay of `fixtures.local/`,
**edited old releases** (a hard fail: old `vX.Y` folders are frozen), the biggest bundle chunks (three.js and
other heavy libraries must stay in a game's lazy chunk; the `main-*.js` entry should stay small), and starts a
dev server at `http://localhost:<port>/`.

Also skim the PR description and the file list (`gh pr view <N> --json files,body`) for surprises: edits to
other games, changes to core detectors without tests, child-identifying info in committed files (the repo is
public).

## 2. Browser smoke test (Browser pane)
- Open `http://localhost:<port>/?fakecam&debug#/play/<game>` (add `@<version>` for a specific release, or no
  version to see the release picker). Tap ▶ Play (`find` "Play", click the ref).
- **Stay silent:** the parent may be listening to other things. `?fakecam` runs are auto-muted (sfx, music, voice);
  never add `&sound` unless the parent asks to hear it. When finished, navigate the tab to `about:blank` so
  nothing keeps playing.
- **Hidden pane = frozen animation.** Try `mcp__ccd_view__show_pane` with `preview`. If the session isn't in a
  window, drive frames from the console (test-only, never in code):
  `window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);`
- Debug keys (dispatch `KeyboardEvent('keydown', {key})` on `window`): J jump, C crouch toggle, S spin,
  P peekaboo, L leave/return, T still, hold R run / tap R walk, X punch, plus game-specific keys listed in the
  PR or the game's `onKey` (e.g. Smash Run: 1–5 worlds, G troll, B bonk, M/N music button; Move Lab: digits /
  0 / - start stations, K = do the station's move, H hub).
- In `?debug`, `window.wiggle.ctx` is the live context and `window.wiggle.game` the game state; read
  counters from there rather than squinting at screenshots. Use `resize_window` (e.g. 1100×680) for a readable
  screenshot, then reset with preset `desktop`.
- Exercise: the new/changed thing end to end, the release picker (old versions still load), one other game,
  `read_console_messages` with `onlyErrors`.

## 3. Report and clean up
- Report: **ready / not ready**, what you checked yourself (numbers, not adjectives), and what is untested on a
  real body/device. If not ready, message the builder session (SendMessage to its session id) with exact
  failures, and don't fix it yourself.
- Ask the parent whether to merge (never merge on your own). On a yes:
  `gh pr merge <N> --merge`, wait for the Pages deploy (`gh run watch`), then `git pull --ff-only` in the main checkout.
- Cleanup: `bash .claude/skills/verify-pr/verify.sh --cleanup <N>`
