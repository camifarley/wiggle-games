---
name: handoff-update
description: Hand a change to an existing game (playtest feedback, fixes, "make v1.3 with…") to the builder session that made that game, instead of editing it in the studio session. Use whenever the parent asks for changes to a game that already exists ("get rid of the gloves", "make it tilt", "the words cover the boulders"). Finds the game's builder session, sends a complete update brief with the release rules, or starts a fresh builder if none exists.
---

# Hand off a game update

The parent's rule: **updates to a game go to the agent that built it.** The studio session (main chat) writes
briefs, analyzes recordings, verifies PRs and talks to the parent. It doesn't edit game code itself.
Shared core detectors (`src/core/`) and Move Lab tuning driven by recordings may still be fixed in the studio
with tests, but the moment it's "change game X", hand it off.

## 1. Find the builder
```
mcp__ccd_session_mgmt__list_sessions { "linked": true }
```
Match the game by session title/name (e.g. "Build Smash Run (game 06)…" → `smash-run`; "Build Bounc'a Bugs v2.0…"
→ `bugs-v2`; "Build Move Lab…" → `move-lab`). Prefer the session whose branch/PR touched that game most recently.
- **Found (even if done/idle):** `SendMessage` with `to: <session id>`.
- **Archived or none** (games 01–04 v1.x were built in the studio): start a fresh builder with
  `mcp__ccd_session__start_session` (`initiation: "user_asked"`, `context: "fresh"`, `use_worktree: true`) and put
  the game's background in `background` (what the game is, its brief path, current releases).

## 2. Write the update message
Paste the parent's words **verbatim** (quoted), then the concrete asks. Always include:

1. **Sync first:** `git fetch origin && git merge origin/main`, because the worktree branch falls behind (other
   releases may have landed, e.g. studio-made versions). Read the latest release folder; that's the base.
2. **Release rules (CLAUDE.md → Releases):** copy the newest `src/games/<game>/vX.Y/` to the next version
   (minor for tweaks/fixes, major for big changes), change only the new folder, draw a `cover.svg` showing the
   main change, add `{ "version", "title" }` to `meta.json` (a short title the kid can read). **Never edit an
   existing release folder.**
3. **What to change**, as a numbered list from the feedback, plus the "why" when the parent gave one (e.g. "the words
   covered the boulders, so keep the middle clear").
4. **Private context** if relevant: design lessons live in `CLAUDE.local.md` (gitignored); never put the child's
   name or ratings in committed files, commits or PR text.
5. **Verify:** `npm run build` + `npm test` pass; smoke-test with `?fakecam&debug` in the Browser pane (show the
   pane; a hidden pane freezes animation); older releases still load in the picker.
6. **Done =** push the branch and open a PR (`gh pr create --base main`) describing what changed, how it was
   tested, and what's untested on a real body. Don't merge and don't push to main.

## 3. Tell the parent
One or two lines: which session got it (link it as `[title](#<session id>)`) and that you'll run `verify-pr`
when it reports back. When the builder's note arrives, run the `verify-pr` skill before telling the parent it's
ready.
