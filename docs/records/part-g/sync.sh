#!/usr/bin/env bash
# Part G: keep the writers' work in the repository as it is written
# (run-10-part-6-attempt-1.md, "For the next attempt").
#
# Every INTERVAL seconds, copies each writer's folder — text and .pwk only, no
# browser profile, no screenshots — into books/<id>/, and commits and pushes it.
# Usage: sync.sh <scratchpad partg folder> [interval seconds]
set -u
SRC=${1:?partg folder}
INTERVAL=${2:-600}
REPO=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
DEST=docs/records/part-g/books
BRANCH=$(git -C "$REPO" rev-parse --abbrev-ref HEAD)
cd "$REPO" || exit 1

once() {
  [ -d "$SRC" ] || return 0
  mkdir -p "$DEST"
  python3 -I - "$SRC" "$DEST" <<'PY'
import os, shutil, sys
src, dest = sys.argv[1], sys.argv[2]
keep = ('.md', '.txt', '.json', '.pwk', '.mjs', '.js', '.cjs', '.py', '.sh')
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('profile', 'node_modules')]
    for f in files:
        p = os.path.join(root, f)
        if not f.endswith(keep) or os.path.islink(p) or os.path.getsize(p) > 20 << 20:
            continue
        q = os.path.join(dest, os.path.relpath(p, src))
        if os.path.exists(q) and os.path.getmtime(q) >= os.path.getmtime(p) and os.path.getsize(q) == os.path.getsize(p):
            continue
        os.makedirs(os.path.dirname(q), exist_ok=True)
        shutil.copy2(p, q)
PY
  git add -A "$DEST"
  git diff --cached --quiet -- "$DEST" && return 0
  git commit -q -m "Part G: the writers' work as of $(date -u +%H:%MZ)" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012HJuZ3q12imk2q9iq8d945" -- "$DEST" || return 0
  for wait in 2 4 8 16 0; do
    git push -q -u origin "$BRANCH" && return 0
    [ "$wait" = 0 ] || sleep "$wait"
  done
  echo "push failed at $(date -u +%FT%TZ)" >&2
}

while true; do
  flock "$REPO/.git/part-g-sync.lock" bash -c "$(declare -f once); SRC='$SRC' DEST='$DEST' BRANCH='$BRANCH' once"
  sleep "$INTERVAL"
done
