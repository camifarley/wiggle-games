#!/usr/bin/env bash
# Independent check of a builder's PR before the parent merges it.
# Usage (from the main checkout's repo root):  bash .claude/skills/verify-pr/verify.sh <PR number> [port]
#
# Builds "what main would look like after merging" in a TEMPORARY worktree (never touches the main
# checkout or its dev server), then: npm ci, build, npm test (with the real recordings from
# fixtures.local), checks that old game releases weren't edited, reports bundle sizes, and starts a dev
# server on the given port (default 5199) for the browser smoke test.
# When done:  bash .claude/skills/verify-pr/verify.sh --cleanup <PR number>
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
SCRATCH="${TMPDIR:-/tmp}/wiggle-verify"

if [[ "${1:-}" == "--cleanup" ]]; then
  PR="$2"; WT="$SCRATCH/pr-$PR"
  if [[ -f "$WT.server.pid" ]]; then kill "$(cat "$WT.server.pid")" 2>/dev/null || true; rm -f "$WT.server.pid"; fi
  git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
  git -C "$REPO" branch -D "verify/pr-$PR" 2>/dev/null || true
  echo "cleaned up PR $PR"
  exit 0
fi

PR="${1:?usage: verify.sh <PR number> [port]}"
PORT="${2:-5199}"
WT="$SCRATCH/pr-$PR"
mkdir -p "$SCRATCH"

echo "== PR #$PR"
gh pr view "$PR" --json title,headRefName,mergeable,additions,deletions,state \
  --jq '"\(.title)\n  branch \(.headRefName) · \(.state) · mergeable \(.mergeable) · +\(.additions)/-\(.deletions)"'
HEAD_REF="$(gh pr view "$PR" --json headRefName --jq .headRefName)"

git -C "$REPO" fetch -q origin main "$HEAD_REF"
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
git -C "$REPO" branch -D "verify/pr-$PR" 2>/dev/null || true
git -C "$REPO" worktree add -q -b "verify/pr-$PR" "$WT" origin/main
cd "$WT"
echo "== merge into latest main"
if ! git merge -q --no-edit "origin/$HEAD_REF"; then
  echo "MERGE CONFLICT: the builder must merge main into its branch first"; git merge --abort || true; exit 2
fi
echo "merged OK"

# real recordings (private, gitignored) so npm test replays them too
[[ -d "$REPO/fixtures.local" ]] && ln -sfn "$REPO/fixtures.local" fixtures.local

echo "== install, build, test"
npm ci --silent >/dev/null 2>&1 || npm install --silent >/dev/null 2>&1
npm run build 2>&1 | grep -E "error|✓ built" || true
npm run build >/dev/null 2>&1 || { echo "BUILD FAILED"; exit 3; }
if npm test > "$WT.test.log" 2>&1; then echo "npm test: PASS"; else echo "npm test: FAIL (see $WT.test.log)"; grep -E "FAIL" "$WT.test.log" | head -20; fi
grep -E "^(PASS|FAIL|INFO|SKIP) .*\.json" "$WT.test.log" | sed 's/^/  /' | head -40 || true

echo "== old releases untouched?"
CHANGED_OLD=0
for meta in src/games/*/meta.json; do
  dir="$(dirname "$meta")"
  # versions that existed on main before this PR
  OLD=$(git show "origin/main:$meta" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s);console.log((m.releases||[]).map(r=>r.version).join(" "))}catch{}})')
  for v in $OLD; do
    if [[ -n "$(git diff --name-only origin/main -- "$dir/v$v")" ]]; then echo "  EDITED OLD RELEASE: $dir/v$v"; CHANGED_OLD=1; fi
  done
done
[[ $CHANGED_OLD == 0 ]] && echo "  ok (no existing release folder was edited)"

echo "== bundle sizes (biggest chunks)"
npm run build 2>/dev/null | grep -E "\.js " | sort -k2 -h | tail -5 | sed 's/^/  /'

echo "== dev server for the smoke test"
( HTTP=1 nohup npx vite --port "$PORT" --strictPort > "$WT.server.log" 2>&1 & echo $! > "$WT.server.pid" )
sleep 2
echo "  http://localhost:$PORT/?fakecam&debug   (log: $WT.server.log)"
echo "  cleanup afterwards: bash .claude/skills/verify-pr/verify.sh --cleanup $PR"
