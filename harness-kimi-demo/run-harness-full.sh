#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  run-harness-full.sh — Multi-Epoch Evolution Harness for Kimi CLI
#
#  Architecture:
#    Epoch 1 (build):   Planner → Sprint 1..N → QA loops
#    Epoch 2 (review):  Product Reviewer → Quality Score
#    Epoch 3 (polish):  Polish Sprints from improvement backlog
#    Epoch 4+ (evolve): New goals from queue → incremental sprints
#
#  The harness loops through review→polish cycles until quality
#  threshold is met, then picks up new goals from the queue.
#
#  Usage:
#    ./run-harness-full.sh "Build a ..."            # fresh run
#    ./run-harness-full.sh --resume                  # resume from state
#    ./run-harness-full.sh --add-goal "Add feature"  # queue a new goal
#    QUALITY_THRESHOLD=7 ./run-harness-full.sh "..." # custom threshold
#    STRICT_MODE=true ./run-harness-full.sh "..."    # halt on Sprint FAIL
#    MAX_POLISH_ROUNDS=3 ./run-harness-full.sh "..." # max polish iterations
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Load libraries ───────────────────────────────────────────────
source "${ROOT}/lib/state.sh"
source "${ROOT}/lib/parse-sprints.sh"
source "${ROOT}/lib/check-verdict.sh"
source "${ROOT}/lib/render-prompt.sh"
source "${ROOT}/lib/restart-servers.sh"
source "${ROOT}/lib/quality-gate.sh"

# ── Configuration (override via env) ─────────────────────────────
USER_MAX_QA="${MAX_QA_ROUNDS:-}"
MAX_QA_ROUNDS="${MAX_QA_ROUNDS:-3}"
START_FROM_SPRINT="${START_FROM_SPRINT:-1}"
KIMI_EXTRA_ARGS="${KIMI_EXTRA_ARGS:-}"
STRICT_MODE="${STRICT_MODE:-false}"
QUALITY_THRESHOLD="${QUALITY_THRESHOLD:-7.0}"
MAX_POLISH_ROUNDS="${MAX_POLISH_ROUNDS:-3}"
MAX_EPOCHS="${MAX_EPOCHS:-10}"
HARNESS_START_TIME="$(date +%s)"

# ── Log setup ────────────────────────────────────────────────────
LOG_DIR="/tmp/harness-logs"
mkdir -p "$LOG_DIR" artifacts project prompts/templates

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
#  ARGUMENT PARSING
# ══════════════════════════════════════════════════════════════════
RESUME=false
USER_GOAL=""
ADD_GOAL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resume)
      RESUME=true
      shift
      ;;
    --add-goal)
      shift
      ADD_GOAL="${1:-}"
      shift 2>/dev/null || true
      ;;
    *)
      USER_GOAL="$1"
      shift
      ;;
  esac
done

# Handle --add-goal (queue a goal and exit)
if [[ -n "$ADD_GOAL" ]]; then
  if state_exists; then
    state_push_goal "$ADD_GOAL"
    echo "Goal added to queue: $ADD_GOAL"
    echo "Queue contents: $(state_get goal_queue)"
  else
    echo "ERROR: No harness state found. Start a run first."
    exit 1
  fi
  exit 0
fi

# ══════════════════════════════════════════════════════════════════
#  INIT / RESUME
# ══════════════════════════════════════════════════════════════════
CURRENT_EPOCH=1

if $RESUME && state_exists; then
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESUMING HARNESS from artifacts/harness-state.json"
  echo "═══════════════════════════════════════════════════════════"
  USER_GOAL="$(state_get user_goal)"
  CURRENT_EPOCH="$(state_get epoch)"
  [[ -z "$CURRENT_EPOCH" || "$CURRENT_EPOCH" == "0" ]] && CURRENT_EPOCH=1

  local_phase="$(state_get phase)"
  case "$local_phase" in
    planning|planning_done|building|qa|qa_fix|sprint_contract)
      START_FROM_SPRINT="$(state_get current_sprint)"
      [[ "$START_FROM_SPRINT" == "0" ]] && START_FROM_SPRINT=1
      ;;
    review|polishing|polish_qa)
      # Will enter the correct epoch loop below
      ;;
    complete|blocked)
      echo "  Previous run is ${local_phase}. Starting next epoch."
      CURRENT_EPOCH=$(( CURRENT_EPOCH + 1 ))
      ;;
  esac

  if [[ -n "${CONTINUE_SPRINT:-}" ]]; then
    START_FROM_SPRINT="$CONTINUE_SPRINT"
  fi
  MAX_QA_ROUNDS="$(state_get max_qa_rounds)"
  if [[ -n "${USER_MAX_QA}" ]]; then
    MAX_QA_ROUNDS="$USER_MAX_QA"
  fi
  echo "  Goal:              $USER_GOAL"
  echo "  Current epoch:     $CURRENT_EPOCH"
  echo "  Resume phase:      $local_phase"
  echo "  Max QA rounds:     $MAX_QA_ROUNDS"
  echo "  Quality threshold: $QUALITY_THRESHOLD"
  echo "  Strict mode:       $STRICT_MODE"
else
  if [[ -z "$USER_GOAL" ]]; then
    USER_GOAL="Build a personal bookmark manager with tagging, full-text search, and a clean modern UI."
  fi
  state_init "$USER_GOAL" "$MAX_QA_ROUNDS"

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  HARNESS — Multi-Epoch Evolution Architecture"
  echo "═══════════════════════════════════════════════════════════"
  echo "  Goal:              $USER_GOAL"
  echo "  Max QA rounds:     $MAX_QA_ROUNDS"
  echo "  Quality threshold: $QUALITY_THRESHOLD / 10"
  echo "  Max polish rounds: $MAX_POLISH_ROUNDS"
  echo "  Strict mode:       $STRICT_MODE"
  echo "  State file:        artifacts/harness-state.json"
  echo "═══════════════════════════════════════════════════════════"
fi

# ══════════════════════════════════════════════════════════════════
#  EPOCH LOOP
# ══════════════════════════════════════════════════════════════════
while (( CURRENT_EPOCH <= MAX_EPOCHS )); do
  state_set epoch "$CURRENT_EPOCH"

  log_phase "EPOCH ${CURRENT_EPOCH}" "Starting..."

  # ════════════════════════════════════════════════════════════════
  #  PHASE 1: PLANNER (only on first epoch or new goals)
  # ════════════════════════════════════════════════════════════════
  if [[ ! -f artifacts/spec.md ]]; then
    log_phase "EPOCH ${CURRENT_EPOCH} — PLANNER" "Expanding user goal into full product spec..."
    state_set phase "planning"
    state_set epoch_type "build"

    prompt="$(render_planner_prompt "$USER_GOAL")"
    run_kimi "Planner" "$prompt"

    if [[ ! -f artifacts/spec.md ]]; then
      echo "ERROR: Planner did not create artifacts/spec.md" >&2
      exit 1
    fi
    state_set phase "planning_done"
  else
    echo "  [SKIP] artifacts/spec.md already exists ($(wc -l < artifacts/spec.md | tr -d ' ') lines)."
  fi

  # ── Parse sprint count ─────────────────────────────────────────
  TOTAL_SPRINTS="$(parse_sprint_count)"
  state_set total_sprints "$TOTAL_SPRINTS"
  echo "  Spec contains $TOTAL_SPRINTS sprints."

  if (( TOTAL_SPRINTS == 0 )); then
    echo "ERROR: No sprints found in spec.md" >&2
    exit 1
  fi

  # ── Init git in project/ ───────────────────────────────────────
  if [[ ! -d project/.git ]]; then
    (cd project && git init -q && git add -A 2>/dev/null && git commit -q --allow-empty -m "init: empty project" 2>/dev/null) || true
  fi

  # ════════════════════════════════════════════════════════════════
  #  PHASE 2: SPRINT LOOP (Build)
  # ════════════════════════════════════════════════════════════════
  SKIP_BUILD=false
  current_phase="$(state_get phase)"
  if [[ "$current_phase" == "review" || "$current_phase" == "polishing" || "$current_phase" == "polish_qa" ]]; then
    SKIP_BUILD=true
    echo "  [SKIP] Build phase — resuming from ${current_phase} phase."
  fi

  if ! $SKIP_BUILD; then
    state_set epoch_type "build"

    for (( sprint=START_FROM_SPRINT; sprint<=TOTAL_SPRINTS; sprint++ )); do
      state_set current_sprint "$sprint"
      state_set qa_round "0"

      log_phase "SPRINT ${sprint}/${TOTAL_SPRINTS}" "Starting..."

      # ── Contract Negotiation ─────────────────────────────────
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

      # ── Generator (Build) ───────────────────────────────────
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

      # ── QA Loop ─────────────────────────────────────────────
      PASSED=false
      EFFECTIVE_MAX_QA="$MAX_QA_ROUNDS"
      for (( qa_round=1; qa_round<=EFFECTIVE_MAX_QA; qa_round++ )); do
        state_set qa_round "$qa_round"
        QA_REPORT="artifacts/sprint-${sprint}-qa-round-${qa_round}.md"

        if [[ -f "$QA_REPORT" ]]; then
          echo "  [SKIP] QA report already exists: $QA_REPORT"
          verdict="$(check_qa_passed "$QA_REPORT")"
          if [[ "$verdict" == "true" ]]; then
            PASSED=true
            break
          fi
          continue
        fi

        restart_backend

        log_phase "SPRINT ${sprint} — QA ROUND ${qa_round}/${EFFECTIVE_MAX_QA}" "Evaluating..."
        state_set phase "qa"

        prompt="$(render_evaluator_prompt "$sprint" "$qa_round")"
        run_kimi "Evaluator Sprint ${sprint} R${qa_round}" "$prompt"

        if [[ ! -f "$QA_REPORT" ]]; then
          echo "  WARNING: QA report not written. Treating as FAIL."
        fi

        verdict="$(check_qa_passed "$QA_REPORT")"
        if [[ "$verdict" == "true" ]]; then
          PASSED=true
          echo ""
          echo "  ✓ Sprint ${sprint} PASSED on QA round ${qa_round}"
          break
        else
          echo ""
          echo "  ✗ Sprint ${sprint} FAILED QA round ${qa_round}"

          # Overtime: grant extra round if <=2 bugs remain
          if (( qa_round == EFFECTIVE_MAX_QA && EFFECTIVE_MAX_QA == MAX_QA_ROUNDS )); then
            remaining="$(count_bugs_in_report "$QA_REPORT")"
            if (( remaining > 0 && remaining <= 2 )); then
              EFFECTIVE_MAX_QA=$(( EFFECTIVE_MAX_QA + 1 ))
              echo "  ⏱ Overtime: only ${remaining} bug(s) left — granting 1 extra round."
            fi
          fi

          if (( qa_round < EFFECTIVE_MAX_QA )); then
            log_phase "SPRINT ${sprint} — FIX (Round ${qa_round})" "Fixing QA issues..."
            state_set phase "qa_fix"

            prompt="$(render_generator_fix_prompt "$sprint" "$qa_round")"
            run_kimi "Generator Fix Sprint ${sprint} R${qa_round}" "$prompt"

            rm -f "$HANDOFF_FILE"
          fi
        fi
      done

      if ! $PASSED; then
        echo ""
        echo "  ⚠ Sprint ${sprint} did not pass after ${EFFECTIVE_MAX_QA} QA rounds."
        if [[ "$STRICT_MODE" == "true" ]]; then
          echo "  STRICT MODE: Halting harness. Fix Sprint ${sprint} before proceeding."
          state_set phase "blocked"
          exit 1
        else
          echo "    Continuing to next sprint..."
        fi
      fi

      # ── Git tag ────────────────────────────────────────────
      (cd project && git add -A 2>/dev/null && git commit -q -m "Sprint ${sprint} complete (QA round ${qa_round})" 2>/dev/null) || true
      (cd project && git tag -f "sprint-${sprint}-done" 2>/dev/null) || true

      echo ""
      echo "  Sprint ${sprint}/${TOTAL_SPRINTS} complete."
    done

    # Reset START_FROM_SPRINT for future epochs
    START_FROM_SPRINT=1

    echo ""
    echo "  ═══ Build phase complete. All ${TOTAL_SPRINTS} sprints processed. ═══"
  fi

  # ════════════════════════════════════════════════════════════════
  #  PHASE 3: PRODUCT REVIEW
  # ════════════════════════════════════════════════════════════════
  REVIEW_FILE="artifacts/product-review-epoch-${CURRENT_EPOCH}.md"

  if [[ ! -f "$REVIEW_FILE" ]]; then
    log_phase "EPOCH ${CURRENT_EPOCH} — PRODUCT REVIEW" "Full-site quality evaluation..."
    state_set phase "review"
    state_set epoch_type "review"

    restart_backend
    restart_frontend

    # Wait for servers to be ready
    echo "  Waiting for servers..."
    sleep 5

    prompt="$(render_reviewer_prompt "$CURRENT_EPOCH")"
    run_kimi "Product Reviewer Epoch ${CURRENT_EPOCH}" "$prompt"

    if [[ ! -f "$REVIEW_FILE" ]]; then
      echo "  WARNING: Product review not written. Skipping quality gate."
      state_set phase "review_failed"
    fi
  else
    echo "  [SKIP] Product review already exists for epoch ${CURRENT_EPOCH}."
  fi

  # ════════════════════════════════════════════════════════════════
  #  PHASE 4: QUALITY GATE
  # ════════════════════════════════════════════════════════════════
  QUALITY_SCORE="0"
  if [[ -f "$REVIEW_FILE" ]]; then
    QUALITY_SCORE="$(extract_quality_score "$REVIEW_FILE")"
    state_record_quality "$CURRENT_EPOCH" "$QUALITY_SCORE"

    echo ""
    echo "  ┌─────────────────────────────────────┐"
    echo "  │  Quality Score: ${QUALITY_SCORE} / 10          │"
    echo "  │  Threshold:     ${QUALITY_THRESHOLD} / 10          │"
    MEETS="$(quality_meets_threshold "$QUALITY_SCORE" "$QUALITY_THRESHOLD")"
    if [[ "$MEETS" == "true" ]]; then
      echo "  │  Status:        ✓ PASSED             │"
    else
      echo "  │  Status:        ✗ BELOW THRESHOLD     │"
    fi
    echo "  └─────────────────────────────────────┘"
  fi

  # ════════════════════════════════════════════════════════════════
  #  PHASE 5: POLISH LOOP (if quality below threshold)
  # ════════════════════════════════════════════════════════════════
  MEETS="$(quality_meets_threshold "$QUALITY_SCORE" "$QUALITY_THRESHOLD")"
  POLISH_ROUND=0

  if [[ "$MEETS" != "true" && -f "$REVIEW_FILE" ]]; then
    state_set epoch_type "polish"
    BACKLOG_COUNT="$(count_backlog_items "$REVIEW_FILE")"
    echo "  Improvement backlog has ${BACKLOG_COUNT} items."

    while (( POLISH_ROUND < MAX_POLISH_ROUNDS )); do
      POLISH_ROUND=$(( POLISH_ROUND + 1 ))
      state_set polish_round "$POLISH_ROUND"

      log_phase "EPOCH ${CURRENT_EPOCH} — POLISH ${POLISH_ROUND}/${MAX_POLISH_ROUNDS}" "Improving product quality..."

      # ── Polish Contract ──────────────────────────────────
      POLISH_CONTRACT="artifacts/polish-${POLISH_ROUND}-contract-final.md"
      if [[ ! -f "$POLISH_CONTRACT" ]]; then
        state_set phase "polishing"

        prompt="$(render_polish_contract_prompt "$POLISH_ROUND" "$CURRENT_EPOCH" 5)"
        run_kimi "Polish Contract ${POLISH_ROUND}" "$prompt"

        if [[ ! -f "$POLISH_CONTRACT" ]]; then
          echo "  WARNING: Polish contract not created. Skipping this polish round."
          continue
        fi
      fi

      # ── Polish Generator ─────────────────────────────────
      POLISH_HANDOFF="artifacts/polish-${POLISH_ROUND}-handoff.md"
      if [[ ! -f "$POLISH_HANDOFF" ]]; then
        state_set phase "polish_build"

        prompt="$(render_polish_generator_prompt "$POLISH_ROUND" "$CURRENT_EPOCH")"
        run_kimi "Polish Generator ${POLISH_ROUND}" "$prompt"
      fi

      # ── Git commit for polish ────────────────────────────
      (cd project && git add -A 2>/dev/null && git commit -q -m "Polish round ${POLISH_ROUND}: quality improvements" 2>/dev/null) || true

      # ── Re-review after polish ───────────────────────────
      POLISH_REVIEW="artifacts/product-review-epoch-${CURRENT_EPOCH}-polish-${POLISH_ROUND}.md"
      if [[ ! -f "$POLISH_REVIEW" ]]; then
        log_phase "EPOCH ${CURRENT_EPOCH} — RE-REVIEW after Polish ${POLISH_ROUND}" "Checking improvements..."
        state_set phase "polish_qa"

        restart_backend
        restart_frontend
        sleep 5

        # Use reviewer but with updated epoch marker
        prompt="$(render_reviewer_prompt "${CURRENT_EPOCH}.${POLISH_ROUND}")"
        run_kimi "Re-review after Polish ${POLISH_ROUND}" "$prompt"

        # The reviewer might write to a different filename; check both
        if [[ ! -f "$POLISH_REVIEW" ]]; then
          local_candidate="artifacts/product-review-epoch-${CURRENT_EPOCH}.${POLISH_ROUND}.md"
          if [[ -f "$local_candidate" ]]; then
            mv "$local_candidate" "$POLISH_REVIEW"
          fi
        fi
      fi

      # ── Check if quality improved enough ─────────────────
      if [[ -f "$POLISH_REVIEW" ]]; then
        NEW_SCORE="$(extract_quality_score "$POLISH_REVIEW")"
        PRE_POLISH_SCORE="$QUALITY_SCORE"
        state_record_quality "${CURRENT_EPOCH}.${POLISH_ROUND}" "$NEW_SCORE"
        QUALITY_SCORE="$NEW_SCORE"

        echo ""
        echo "  Post-polish quality: ${NEW_SCORE} / 10 (was: ${PRE_POLISH_SCORE})"

        MEETS="$(quality_meets_threshold "$NEW_SCORE" "$QUALITY_THRESHOLD")"
        if [[ "$MEETS" == "true" ]]; then
          echo "  ✓ Quality threshold met after Polish ${POLISH_ROUND}!"
          break
        else
          echo "  ✗ Still below threshold. Will continue polishing..."
        fi
      else
        echo "  WARNING: Re-review not written. Assuming quality unchanged."
      fi
    done

    state_set total_polish_rounds "$POLISH_ROUND"
  fi

  # ════════════════════════════════════════════════════════════════
  #  PHASE 6: CHECK GOAL QUEUE (Evolution)
  # ════════════════════════════════════════════════════════════════
  NEXT_GOAL="$(state_pop_goal)"
  if [[ -n "$NEXT_GOAL" ]]; then
    log_phase "EVOLUTION" "New goal from queue: ${NEXT_GOAL}"
    state_set epoch_type "evolve"
    CURRENT_EPOCH=$(( CURRENT_EPOCH + 1 ))
    state_set epoch "$CURRENT_EPOCH"

    # Create an evolution spec addendum
    EVOLUTION_PROMPT="You are a senior product manager. The application already exists with the features described in artifacts/spec.md.

A user has requested an enhancement:
\"${NEXT_GOAL}\"

Read the current spec and the existing code under project/. Then:
1. Add NEW sprint sections to artifacts/spec.md for this enhancement (append after existing sprints).
2. Number them as Sprint N+1, N+2, etc. (continuing from existing sprint numbers).
3. Follow the same format as existing sprints.
4. Do NOT modify existing sprint sections.
5. Keep scope tight: 1-2 new sprints maximum.

IMPORTANT: Actually modify artifacts/spec.md. Do NOT just describe the changes."

    run_kimi "Evolution Planner: ${NEXT_GOAL}" "$EVOLUTION_PROMPT"

    # Re-parse sprint count and continue the build loop
    TOTAL_SPRINTS="$(parse_sprint_count)"
    state_set total_sprints "$TOTAL_SPRINTS"
    # START_FROM_SPRINT should be the first new sprint
    START_FROM_SPRINT=$(( TOTAL_SPRINTS - 1 ))
    (( START_FROM_SPRINT < 1 )) && START_FROM_SPRINT=1

    echo "  New total sprints: ${TOTAL_SPRINTS}. Building from sprint ${START_FROM_SPRINT}."
    continue  # Re-enter the epoch loop for the build phase
  fi

  # ════════════════════════════════════════════════════════════════
  #  EPOCH COMPLETE
  # ════════════════════════════════════════════════════════════════
  MEETS="$(quality_meets_threshold "$QUALITY_SCORE" "$QUALITY_THRESHOLD")"
  if [[ "$MEETS" == "true" ]]; then
    echo ""
    echo "  ✓ Epoch ${CURRENT_EPOCH} complete. Quality score: ${QUALITY_SCORE}/10 — meets threshold."
  else
    echo ""
    echo "  ⚠ Epoch ${CURRENT_EPOCH} complete. Quality score: ${QUALITY_SCORE}/10 — below threshold."
    echo "    Consider adding improvement goals to the queue."
  fi

  # Check if there are more goals
  REMAINING_GOALS="$(state_get goal_queue)"
  if [[ "$REMAINING_GOALS" == "[]" || -z "$REMAINING_GOALS" ]]; then
    echo "  No more goals in queue. Harness complete."
    break
  else
    CURRENT_EPOCH=$(( CURRENT_EPOCH + 1 ))
  fi
done

# ══════════════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════
state_set phase "complete"

HARNESS_END_TIME="$(date +%s)"
TOTAL_ELAPSED=$(( HARNESS_END_TIME - HARNESS_START_TIME ))
TOTAL_MIN=$(( TOTAL_ELAPSED / 60 ))
TOTAL_SEC=$(( TOTAL_ELAPSED % 60 ))

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  HARNESS COMPLETE — Multi-Epoch Evolution"
echo "═══════════════════════════════════════════════════════════"
echo "  Epochs completed:    ${CURRENT_EPOCH}"
echo "  Final quality score: ${QUALITY_SCORE} / 10"
echo "  Quality threshold:   ${QUALITY_THRESHOLD} / 10"
echo "  Total elapsed:       ${TOTAL_MIN}m ${TOTAL_SEC}s"
echo "  State:               artifacts/harness-state.json"
echo ""
echo "  Quality History:"
state_get quality_scores
echo ""
echo "  Artifacts:"
ls -la artifacts/*.md 2>/dev/null
echo ""
echo "  To continue evolving:"
echo "    $0 --add-goal \"Your new feature request\""
echo "    $0 --resume"
echo ""
echo "  To run the app:  cd project && npm install && npm run dev"
echo "═══════════════════════════════════════════════════════════"
