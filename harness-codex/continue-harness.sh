#!/usr/bin/env bash
# continue-harness.sh — Resume harness from a specific sprint (Codex CLI edition)
# Usage:
#   ./continue-harness.sh --project /path/to/git/repo        # default Sprint 5
#   ./continue-harness.sh --project /path/to/git/repo 2      # only Sprint 2
#   ./continue-harness.sh --project /path/to/git/repo 2 5    # Sprint 2~5
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HARNESS_PROJECT_ARG=""
START_SPRINT=""
END_SPRINT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      shift
      HARNESS_PROJECT_ARG="${1:-}"
      shift
      ;;
    *)
      if [[ -z "$START_SPRINT" ]]; then
        START_SPRINT="$1"
      elif [[ -z "$END_SPRINT" ]]; then
        END_SPRINT="$1"
      fi
      shift
      ;;
  esac
done

LEGACY_PROJECT="${HARNESS_PROJECT_ARG:-${HARNESS_PROJECT_ROOT:-}}"
if [[ -n "$LEGACY_PROJECT" ]]; then
  LEGACY_PROJECT="$(cd "$LEGACY_PROJECT" && pwd)"
  export HARNESS_PROJECT_ROOT="$LEGACY_PROJECT"
fi

# Default: continue from Sprint 5
CONTINUE_SPRINT="${START_SPRINT:-5}"
export CONTINUE_SPRINT

# Wipe handoff/QA for the range to force re-generation
if [[ -n "$END_SPRINT" ]]; then
  for (( s=CONTINUE_SPRINT; s<=END_SPRINT; s++ )); do
    rm -f "${SCRIPT_DIR}/artifacts/sprint-${s}-handoff.md"
    rm -f "${SCRIPT_DIR}/artifacts/sprint-${s}-qa-round-"*.md
  done
else
  rm -f "${SCRIPT_DIR}/artifacts/sprint-${CONTINUE_SPRINT}-handoff.md"
  rm -f "${SCRIPT_DIR}/artifacts/sprint-${CONTINUE_SPRINT}-qa-round-"*.md
fi

echo "Continuing harness from Sprint ${CONTINUE_SPRINT}..."
exec "${SCRIPT_DIR}/run-harness-full.sh" --project "${LEGACY_PROJECT:-}" --resume
