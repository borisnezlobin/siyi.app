#!/usr/bin/env bash
# Keeps an agent's checkout current with origin without ever risking your work.
#
# Two people driving agents on the same branch is the case this exists for: an
# agent that started an hour ago is editing files that moved under it, and the
# first sign is a conflict at commit time. So every session start, and at most
# once every few minutes while a session runs, this fetches and fast-forwards.
#
# It only ever fast-forwards. A branch that has diverged, a rebase or merge in
# progress, or a checkout with staged work is left exactly as it is and simply
# reported — an automatic rebase of somebody else's half-finished work is a far
# worse morning than an out-of-date branch.
#
# Wired up in .claude/settings.json. Run it by hand any time: scripts/agent-autopull.sh

set -uo pipefail

throttle_seconds=${AGENT_AUTOPULL_THROTTLE_SECONDS:-180}

git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
branch=$(git symbolic-ref --short -q HEAD) || exit 0
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null) || exit 0

note() {
  # Claude reads systemMessage; a person running this in a terminal reads the
  # same sentence, so it goes to stderr as well.
  printf '%s\n' "$1" >&2
  printf '{"systemMessage": %s}\n' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')"
}

stamp="$git_dir/agent-autopull-stamp"
if [ "${1:-}" = "--throttled" ] && [ -f "$stamp" ]; then
  age=$(( $(date +%s) - $(date -r "$stamp" +%s 2>/dev/null || echo 0) ))
  [ "$age" -lt "$throttle_seconds" ] && exit 0
fi
touch "$stamp"

git fetch --quiet 2>/dev/null || exit 0

behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo 0)
[ "$behind" -eq 0 ] && exit 0

ahead=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)
if [ "$ahead" -gt 0 ]; then
  note "$branch is $behind commit(s) behind $upstream and $ahead ahead. Not pulling — rebase or merge yourself."
  exit 0
fi

if [ -d "$git_dir/rebase-merge" ] || [ -d "$git_dir/rebase-apply" ] ||
   [ -f "$git_dir/MERGE_HEAD" ] || [ -f "$git_dir/CHERRY_PICK_HEAD" ]; then
  note "$branch is $behind commit(s) behind $upstream, but a rebase or merge is in progress. Not pulling."
  exit 0
fi

if ! git diff --quiet --cached 2>/dev/null; then
  note "$branch is $behind commit(s) behind $upstream, but there is staged work. Not pulling."
  exit 0
fi

if git merge --ff-only --autostash --quiet "$upstream" 2>/dev/null; then
  note "Pulled $behind new commit(s) into $branch from $upstream. Re-read any file you had already read."
else
  note "$branch is $behind commit(s) behind $upstream and could not be fast-forwarded. Pull it yourself."
fi
