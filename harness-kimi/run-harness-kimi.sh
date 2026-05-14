#!/usr/bin/env bash
# run-harness-kimi.sh — Full Harness: Planner → Contract → Generator → Evaluator
# Aligned with harness-design-guide.md §10.8
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p artifacts project prompts

export USER_GOAL="${1:-Build a personal bookmark manager with tagging and search.}"

echo "============================================================"
echo "  HARNESS — Phase 1: PLANNER"
echo "============================================================"
if [[ -f artifacts/spec.md ]]; then
  echo "[SKIP] artifacts/spec.md already exists ($(wc -l < artifacts/spec.md) lines). Delete it to re-run Planner."
else
  kimi --print -w "$ROOT" -p "$(cat "$ROOT/prompts/01-planner.txt")

${USER_GOAL}"
  if [[ ! -f artifacts/spec.md ]]; then
    echo "ERROR: artifacts/spec.md was not created." >&2; exit 1
  fi
fi
echo "[OK] artifacts/spec.md ready."
echo ""

echo "============================================================"
echo "  HARNESS — Phase 2: SPRINT 1 CONTRACT"
echo "============================================================"
if [[ -f artifacts/sprint-1-contract-final.md ]]; then
  echo "[SKIP] artifacts/sprint-1-contract-final.md already exists. Delete it to re-run."
else
  kimi --print -w "$ROOT" -p "$(cat "$ROOT/prompts/02-sprint1-contract.txt")"
  if [[ ! -f artifacts/sprint-1-contract-final.md ]]; then
    echo "ERROR: artifacts/sprint-1-contract-final.md was not created." >&2; exit 1
  fi
fi
echo "[OK] Sprint 1 contract ready."
echo ""

echo "============================================================"
echo "  HARNESS — Phase 3: GENERATOR (Sprint 1)"
echo "============================================================"
kimi --print -w "$ROOT" -p "$(cat "$ROOT/prompts/03-sprint1-generator.txt")"
if [[ ! -f artifacts/sprint-1-handoff.md ]]; then
  echo "WARNING: artifacts/sprint-1-handoff.md was not created."
fi
echo "[OK] Generator complete."
echo ""

echo "============================================================"
echo "  HARNESS — Phase 4: EVALUATOR (Sprint 1 QA)"
echo "============================================================"
kimi --print -w "$ROOT" -p "$(cat "$ROOT/prompts/04-sprint1-evaluator.txt")"
echo "[OK] Evaluator complete."
echo ""

echo "============================================================"
echo "  HARNESS COMPLETE"
echo "============================================================"
echo "Artifacts:"
ls -la artifacts/
echo ""
echo "Project:"
ls project/ 2>/dev/null || echo "(empty)"
echo ""
echo "To run the app:  cd project && npm install && npm run dev"
