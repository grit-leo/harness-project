#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  run-harness-full.sh — Long-Running Harness Orchestrator for Kimi CLI
#  Aligned with harness-design-guide.md §9–§10.8
#
#  Features:
#    - Multi-Sprint loop (Planner → Contract → Generator → Evaluator)
#    - Configurable QA rounds per sprint (default 3)
#    - Persistent state in artifacts/harness-state.json (resume on crash)
#    - Git commit after each sprint
#    - Elapsed time tracking per phase
#    - Graceful interrupt (Ctrl-C saves state)
#
#  Usage:
#    ./run-harness-full.sh "Build a ..."          # fresh run
#    ./run-harness-full.sh --resume                # resume from saved state
#    MAX_QA_ROUNDS=5 ./run-harness-full.sh "..."   # custom QA rounds
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Load libraries ───────────────────────────────────────────────
source "${ROOT}/lib/state.sh"
source "${ROOT}/lib/parse-sprints.sh"
source "${ROOT}/lib/check-verdict.sh"
source "${ROOT}/lib/render-prompt.sh"

# ── Configuration (override via env) ─────────────────────────────
# If set before resume, overrides harness-state.json (same for MAX_QA_ROUNDS)
USER_MAX_QA="${MAX_QA_ROUNDS:-}"
MAX_QA_ROUNDS="${MAX_QA_ROUNDS:-3}"
START_FROM_SPRINT="${START_FROM_SPRINT:-1}"
KIMI_EXTRA_ARGS="${KIMI_EXTRA_ARGS:-}"
HARNESS_START_TIME="$(date +%s)"

# ── Ensure directories ───────────────────────────────────────────
mkdir -p artifacts project prompts/templates

# ── Graceful interrupt ───────────────────────────────────────────
cleanup() {
  echo ""
  echo "[$(date +%H:%M:%S)] Interrupted. State saved to artifacts/harness-state.json"
  echo "  Resume with: $0 --resume"
  exit 130
}
trap cleanup SIGINT SIGTERM

# ── Helper: run kimi with timing ─────────────────────────────────
run_kimi() {
  local label="$1"
  local prompt="$2"
  local t_start t_end elapsed

  t_start="$(date +%s)"
  echo "  [kimi] ${label} — started at $(date +%H:%M:%S)"

  kimi --print -w "$ROOT" $KIMI_EXTRA_ARGS -p "$prompt"

  t_end="$(date +%s)"
  elapsed=$(( t_end - t_start ))
  echo "  [kimi] ${label} — done in $(( elapsed / 60 ))m $(( elapsed % 60 ))s"
}

# ══════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════

# ── Parse arguments ──────────────────────────────────────────────
RESUME=false
USER_GOAL=""

for arg in "$@"; do
  case "$arg" in
    --resume) RESUME=true ;;
    *)        USER_GOAL="$arg" ;;
  esac
done

# ── Resume or fresh start ────────────────────────────────────────
if $RESUME && state_exists; then
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESUMING HARNESS from artifacts/harness-state.json"
  echo "═══════════════════════════════════════════════════════════"
  USER_GOAL="$(state_get user_goal)"
  START_FROM_SPRINT="$(state_get current_sprint)"
  if [[ -n "${CONTINUE_SPRINT:-}" ]]; then
    START_FROM_SPRINT="$CONTINUE_SPRINT"
    echo "  (CONTINUE_SPRINT=$CONTINUE_SPRINT — overrides state file)"
  fi
  MAX_QA_ROUNDS="$(state_get max_qa_rounds)"
  if [[ -n "${USER_MAX_QA}" ]]; then
    MAX_QA_ROUNDS="$USER_MAX_QA"
  fi
  echo "  Goal:          $USER_GOAL"
  echo "  Resume sprint: $START_FROM_SPRINT"
  echo "  Max QA rounds: $MAX_QA_ROUNDS"
else
  if [[ -z "$USER_GOAL" ]]; then
    USER_GOAL="Build a personal bookmark manager with tagging, full-text search, and a clean modern UI."
  fi
  state_init "$USER_GOAL" "$MAX_QA_ROUNDS"

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  HARNESS — Long-Running Application Development"
  echo "═══════════════════════════════════════════════════════════"
  echo "  Goal:          $USER_GOAL"
  echo "  Max QA rounds: $MAX_QA_ROUNDS"
  echo "  State file:    artifacts/harness-state.json"
  echo "═══════════════════════════════════════════════════════════"
fi

# ══════════════════════════════════════════════════════════════════
#  PHASE 1: PLANNER
# ══════════════════════════════════════════════════════════════════
if [[ ! -f artifacts/spec.md ]]; then
  log_phase "PHASE 1: PLANNER" "Expanding user goal into full product spec..."
  state_set phase "planning"

  prompt="$(render_planner_prompt "$USER_GOAL")"
  run_kimi "Planner" "$prompt"

  if [[ ! -f artifacts/spec.md ]]; then
    echo "ERROR: Planner did not create artifacts/spec.md" >&2
    exit 1
  fi
  state_set phase "planning_done"
else
  echo ""
  echo "  [SKIP] artifacts/spec.md already exists ($(wc -l < artifacts/spec.md | tr -d ' ') lines)."
fi

# ── Parse sprint count ───────────────────────────────────────────
TOTAL_SPRINTS="$(parse_sprint_count)"
state_set total_sprints "$TOTAL_SPRINTS"
echo "  Spec contains $TOTAL_SPRINTS sprints."

if (( TOTAL_SPRINTS == 0 )); then
  echo "ERROR: No sprints found in spec.md" >&2
  exit 1
fi

# ── Init git in project/ ─────────────────────────────────────────
if [[ ! -d project/.git ]]; then
  (cd project && git init -q && git add -A 2>/dev/null && git commit -q --allow-empty -m "init: empty project" 2>/dev/null) || true
fi

# ══════════════════════════════════════════════════════════════════
#  PHASE 2: SPRINT LOOP
# ══════════════════════════════════════════════════════════════════
for (( sprint=START_FROM_SPRINT; sprint<=TOTAL_SPRINTS; sprint++ )); do
  state_set current_sprint "$sprint"
  state_set qa_round "0"

  log_phase "SPRINT ${sprint}/${TOTAL_SPRINTS}" "Starting..."

  # ── 2a. Contract Negotiation ─────────────────────────────────
  CONTRACT_FILE="artifacts/sprint-${sprint}-contract-final.md"
  if [[ ! -f "$CONTRACT_FILE" ]]; then
    log_phase "SPRINT ${sprint} — CONTRACT" "Negotiating sprint contract..."
    state_set phase "sprint_contract"

    sprint_section="$(extract_sprint_section "$sprint")"
    prompt="$(render_contract_prompt "$sprint" "$sprint_section")"
    run_kimi "Contract Sprint ${sprint}" "$prompt"

    if [[ ! -f "$CONTRACT_FILE" ]]; then
      echo "  WARNING: Contract file not created. Retrying once..."
      run_kimi "Contract Sprint ${sprint} (retry)" "$prompt"
    fi
    if [[ ! -f "$CONTRACT_FILE" ]]; then
      echo "  WARNING: Contract still not created. Using draft if available."
      draft="artifacts/sprint-${sprint}-contract-draft.md"
      if [[ -f "$draft" ]]; then
        cp "$draft" "$CONTRACT_FILE"
      else
        echo "  WARNING: No contract for Sprint ${sprint}. Skipping this sprint."
        continue
      fi
    fi
  else
    echo "  [SKIP] Sprint ${sprint} contract already exists."
  fi

  # ── 2b. Generator (Build) ───────────────────────────────────
  HANDOFF_FILE="artifacts/sprint-${sprint}-handoff.md"
  LAST_QA_FOR_SPRINT="artifacts/sprint-${sprint}-qa-round-1.md"
  if [[ ! -f "$HANDOFF_FILE" ]] && [[ ! -f "$LAST_QA_FOR_SPRINT" ]]; then
    log_phase "SPRINT ${sprint} — GENERATOR" "Building Sprint ${sprint}..."
    state_set phase "building"

    prompt="$(render_generator_prompt "$sprint")"
    run_kimi "Generator Sprint ${sprint}" "$prompt"
  else
    echo "  [SKIP] Sprint ${sprint} generator already ran (handoff or QA exists)."
  fi

  # ── 2c. QA Loop ─────────────────────────────────────────────
  PASSED=false
  for (( qa_round=1; qa_round<=MAX_QA_ROUNDS; qa_round++ )); do
    state_set qa_round "$qa_round"
    QA_REPORT="artifacts/sprint-${sprint}-qa-round-${qa_round}.md"

    # Evaluator
    log_phase "SPRINT ${sprint} — QA ROUND ${qa_round}/${MAX_QA_ROUNDS}" "Evaluating..."
    state_set phase "qa"

    prompt="$(render_evaluator_prompt "$sprint" "$qa_round")"
    run_kimi "Evaluator Sprint ${sprint} R${qa_round}" "$prompt"

    if [[ ! -f "$QA_REPORT" ]]; then
      echo "  WARNING: QA report not written. Treating as FAIL."
    fi

    # Check verdict
    verdict="$(check_qa_passed "$QA_REPORT")"
    if [[ "$verdict" == "true" ]]; then
      PASSED=true
      echo ""
      echo "  ✓ Sprint ${sprint} PASSED on QA round ${qa_round}"
      break
    else
      echo ""
      echo "  ✗ Sprint ${sprint} FAILED QA round ${qa_round}"

      if (( qa_round < MAX_QA_ROUNDS )); then
        # Generator Fix
        log_phase "SPRINT ${sprint} — FIX (Round ${qa_round})" "Fixing QA issues..."
        state_set phase "qa_fix"

        prompt="$(render_generator_fix_prompt "$sprint" "$qa_round")"
        run_kimi "Generator Fix Sprint ${sprint} R${qa_round}" "$prompt"

        # Remove old handoff so evaluator reads fresh one
        rm -f "$HANDOFF_FILE"
      fi
    fi
  done

  if ! $PASSED; then
    echo ""
    echo "  ⚠ Sprint ${sprint} did not pass after ${MAX_QA_ROUNDS} QA rounds."
    echo "    Continuing to next sprint. You can re-run with:"
    echo "    START_FROM_SPRINT=${sprint} ./run-harness-full.sh --resume"
  fi

  # ── Git tag for sprint ──────────────────────────────────────
  (cd project && git add -A 2>/dev/null && git commit -q -m "Sprint ${sprint} complete (QA round ${qa_round})" 2>/dev/null) || true
  (cd project && git tag -f "sprint-${sprint}-done" 2>/dev/null) || true

  echo ""
  echo "  Sprint ${sprint}/${TOTAL_SPRINTS} complete. Artifacts:"
  ls -la artifacts/sprint-${sprint}-* 2>/dev/null || true

done

# ══════════════════════════════════════════════════════════════════
#  PHASE 3: COMPLETE
# ══════════════════════════════════════════════════════════════════
state_set phase "complete"

HARNESS_END_TIME="$(date +%s)"
TOTAL_ELAPSED=$(( HARNESS_END_TIME - HARNESS_START_TIME ))
TOTAL_MIN=$(( TOTAL_ELAPSED / 60 ))
TOTAL_SEC=$(( TOTAL_ELAPSED % 60 ))

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  HARNESS COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "  Sprints completed: ${TOTAL_SPRINTS}/${TOTAL_SPRINTS}"
echo "  Total elapsed:     ${TOTAL_MIN}m ${TOTAL_SEC}s"
echo "  State:             artifacts/harness-state.json"
echo ""
echo "  Artifacts:"
ls -la artifacts/*.md 2>/dev/null
echo ""
echo "  Project:"
ls project/ 2>/dev/null || echo "  (empty)"
echo ""
echo "  To run the app:  cd project && npm install && npm run dev"
echo "═══════════════════════════════════════════════════════════"
