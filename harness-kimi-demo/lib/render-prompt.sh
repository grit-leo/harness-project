#!/usr/bin/env bash
# lib/render-prompt.sh — Render prompt templates with variable substitution
# Supports: planner, contract, generator, generator-fix, evaluator, reviewer, polish

render_prompt() {
  local template_file="$1"
  shift

  local content
  content="$(cat "$template_file")"

  while [[ $# -gt 0 ]]; do
    local key="$1"
    local val="$2"
    content="${content//$key/$val}"
    shift 2
  done

  echo "$content"
}

# ── Visual Context: collect screenshot paths for Generator ──────────
collect_visual_context() {
  local screenshot_dir="${ROOT}/artifacts/screenshots"
  local prototype_dir="${ROOT}/artifacts/visual/prototypes"
  local result=""

  if [[ -f "${ROOT}/artifacts/visual/visual-contract.md" ]]; then
    result="## VISUAL SOURCE OF TRUTH\nRead and follow artifacts/visual/visual-contract.md.\n"
  fi

  if [[ -d "$prototype_dir" ]]; then
    local prototypes
    prototypes="$(find "$prototype_dir" -maxdepth 1 -type f -name '*.png' -print | sort | head -10)"
    if [[ -n "$prototypes" ]]; then
      result="${result}\n## TARGET PROTOTYPES\nImplement these as the intended visual target. Correct any known image inaccuracies listed in the prototype manifest:\n"
      while IFS= read -r img; do
        result="${result}\n- artifacts/visual/prototypes/$(basename "$img")"
      done <<< "$prototypes"
    fi
  fi

  if [[ -d "$screenshot_dir" ]]; then
    local screenshots
    screenshots="$(ls -t "$screenshot_dir"/*.png 2>/dev/null | head -10)"
    if [[ -n "$screenshots" ]]; then
      result="${result}\n\n## CURRENT APP STATE\nThese screenshots show the current implementation baseline:\n"
      while IFS= read -r img; do
        result="${result}\n- artifacts/screenshots/$(basename "$img")"
      done <<< "$screenshots"
    fi
  fi

  if [[ -z "$result" ]]; then
    echo ""
    return
  fi
  result="${result}\n\nUse the visual contract for exact implementation rules; use prototypes for composition and hierarchy."
  echo -e "$result"
}

# ── Unresolved Bugs: collect from prior failed sprints ──────────────
collect_unresolved_bugs() {
  local current_sprint="$1"
  python3 -c "
import re, os, glob

current = int('${current_sprint}')
bugs_section = []

for s in range(1, current):
    rounds = sorted(glob.glob(f'${ROOT}/artifacts/sprint-{s}-qa-round-*.md'))
    if not rounds:
        continue
    last_report = rounds[-1]
    with open(last_report) as f:
        text = f.read()

    vpos = text.find('Overall Verdict:')
    if vpos == -1:
        continue
    snippet = text[vpos:vpos+100].upper()
    if 'FAIL' not in snippet:
        continue

    bug_lines = re.findall(r'^\d+\.\s+\*\*\[BUG-\d+\]\*\*.*', text, re.MULTILINE)
    if bug_lines:
        rname = os.path.basename(last_report)
        bugs_section.append(f'### From {rname} (Sprint {s} — FAIL)')
        for bl in bug_lines:
            bugs_section.append(bl)
        bugs_section.append('')

if bugs_section:
    print('## UNRESOLVED BUGS FROM PREVIOUS SPRINTS (MUST FIX FIRST)')
    print()
    print('\n'.join(bugs_section))
else:
    print('')
"
}

# ── Regression Criteria: extract from prior passing sprints ─────────
collect_regression_criteria() {
  local current_sprint="$1"
  python3 -c "
import os, re

current = int('${current_sprint}')
if current <= 1:
    print('No prior sprints to regress.')
    exit()

lines = []
lines.append('Spot-check the following key flows from prior sprints:')
for s in range(1, current):
    contract = '${ROOT}/artifacts/sprint-{}-contract-final.md'.format(s)
    if not os.path.exists(contract):
        continue
    with open(contract) as f:
        text = f.read()
    rows = re.findall(r'^\|\s*\d+\s*\|(.+?)\|', text, re.MULTILINE)
    picks = rows[:3]
    if picks:
        lines.append(f'   - **Sprint {s}**: ' + '; '.join(c.strip() for c in picks))

if len(lines) <= 1:
    print('No prior contracts found for regression.')
else:
    print('\n'.join(lines))
"
}

# ── Detect existing project tech stack (for --project mode) ─────────
detect_project_tech_stack() {
  local project_dir="$1"
  if [[ -z "$project_dir" || ! -d "$project_dir" ]]; then
    echo ""
    return
  fi

  local findings=()

  # --- Frontend detection (search up to 2 levels deep) ---
  local pkg_json
  pkg_json="$(find -L "$project_dir" -maxdepth 2 -name "package.json" -print -quit 2>/dev/null)"
  if [[ -n "$pkg_json" ]]; then
    local fw="Unknown"
    if grep -q '"react"' "$pkg_json" 2>/dev/null; then fw="React"; fi
    if grep -q '"vue"' "$pkg_json" 2>/dev/null; then fw="Vue"; fi
    if grep -q '"angular"' "$pkg_json" 2>/dev/null; then fw="Angular"; fi
    if grep -q '"svelte"' "$pkg_json" 2>/dev/null; then fw="Svelte"; fi
    if grep -q '"next"' "$pkg_json" 2>/dev/null; then fw="Next.js"; fi
    findings+=("Frontend: $fw (package.json found)")

    if grep -q '"tailwindcss"' "$pkg_json" 2>/dev/null || find -L "$project_dir" -maxdepth 2 -name "tailwind.config.*" -print -quit 2>/dev/null | grep -q .; then
      findings+=("  - Tailwind CSS detected")
    fi
    if find -L "$project_dir" -maxdepth 2 -name "vite.config.*" -print -quit 2>/dev/null | grep -q .; then
      findings+=("  - Vite detected")
    fi
  fi

  # --- Backend detection ---
  if find -L "$project_dir" -maxdepth 2 -name "pom.xml" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Java (Maven / Spring Boot)")
  fi
  if find -L "$project_dir" -maxdepth 2 -name "build.gradle*" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Java/Kotlin (Gradle / Spring Boot)")
  fi
  if find -L "$project_dir" -maxdepth 2 -name "requirements.txt" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Python (requirements.txt)")
  fi
  if find -L "$project_dir" -maxdepth 2 -name "pyproject.toml" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Python (pyproject.toml)")
  fi
  if find -L "$project_dir" -maxdepth 2 -name "go.mod" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Go")
  fi
  if find -L "$project_dir" -maxdepth 2 -name "Cargo.toml" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Backend: Rust")
  fi

  # --- Database / DevOps ---
  if find -L "$project_dir" -maxdepth 3 -name "*.sql" -print -quit 2>/dev/null | grep -q .; then
    findings+=("Database: SQL schema files present")
  fi
  if find -L "$project_dir" -maxdepth 1 -name "Dockerfile*" -print -quit 2>/dev/null | grep -q .; then
    findings+=("DevOps: Dockerfile present")
  fi

  if [[ ${#findings[@]} -eq 0 ]]; then
    echo "No existing project detected. This is a GREENFIELD build."
  else
    echo "EXISTING PROJECT TECH STACK DETECTED:"
    printf '  - %s\n' "${findings[@]}"
    echo ""
    echo "INSTRUCTION: The specification below MUST respect this existing tech stack. Do NOT propose replacing the backend language/framework or the frontend framework. Focus on REVIEWING, IMPROVING, and EXTENDING the EXISTING codebase."
  fi
}

# ── Detect build command for evaluator ──────────────────────────────
detect_build_command() {
  if find -L "${ROOT}/project" -maxdepth 2 -name "pom.xml" -print -quit 2>/dev/null | grep -q .; then
    echo "cd project && mvn clean compile"
  elif find -L "${ROOT}/project" -maxdepth 2 -name "build.gradle*" -print -quit 2>/dev/null | grep -q .; then
    echo "cd project && ./gradlew build"
  elif [[ -f "${ROOT}/project/package.json" ]]; then
    echo "cd project && npm run build"
  else
    echo "cd project && npm run build"
  fi
}

# ── Detect actual frontend URL (from restart-servers.sh record or fallback) ──
detect_frontend_url() {
  local ports_file="${ROOT}/artifacts/harness-server-ports.json"
  if [[ -f "$ports_file" ]]; then
    local url
    url="$(python3 -c "import json; print(json.load(open('${ports_file}')).get('frontend_url',''))" 2>/dev/null || echo "")"
    if [[ -n "$url" ]]; then
      echo "$url"
      return
    fi
  fi
  # Fallback: infer from package.json scripts or vite config
  local pkg_json
  pkg_json="$(find -L "${ROOT}/project" -maxdepth 2 -name "package.json" -print -quit 2>/dev/null)"
  if [[ -f "$pkg_json" ]]; then
    local vite_cfg
    vite_cfg="$(find "$(dirname "$pkg_json")" -maxdepth 1 -name 'vite.config.*' -print -quit 2>/dev/null || echo "")"
    if [[ -n "$vite_cfg" && -f "$vite_cfg" ]] && grep -qE 'port.*3000' "$vite_cfg" 2>/dev/null; then
      echo "http://localhost:3000"
      return
    fi
    if grep -qE '\-\-port.*3000|\-\-port 3000' "$pkg_json" 2>/dev/null; then
      echo "http://localhost:3000"
      return
    fi
  fi
  echo "http://localhost:5173"
}

# ══════════════════════════════════════════════════════════════════════
#  Prompt Renderers
# ══════════════════════════════════════════════════════════════════════

render_planner_prompt() {
  local user_goal="$1"
  local tech_stack_info=""

  if [[ -n "${LEGACY_PROJECT:-}" && -d "${LEGACY_PROJECT}" ]]; then
    tech_stack_info="$(detect_project_tech_stack "$LEGACY_PROJECT")"
  fi

  if [[ -z "$tech_stack_info" ]]; then
    tech_stack_info="No existing project detected. This is a GREENFIELD build."
  fi

  render_prompt "${SCRIPT_DIR}/prompts/templates/planner.txt" \
    "__USER_GOAL__" "$user_goal" \
    "__EXISTING_TECH_STACK__" "$tech_stack_info"
}

render_visual_brief_prompt() {
  cat "${SCRIPT_DIR}/prompts/templates/visual-brief.txt"
}

render_visual_prototype_prompt() {
  cat "${SCRIPT_DIR}/prompts/templates/visual-prototype.txt"
}

render_visual_contract_prompt() {
  cat "${SCRIPT_DIR}/prompts/templates/visual-contract.txt"
}

render_contract_prompt() {
  local sprint_num="$1"
  local sprint_section="$2"
  render_prompt "${SCRIPT_DIR}/prompts/templates/contract.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__SPRINT_SECTION__" "$sprint_section"
}

render_generator_prompt() {
  local sprint_num="$1"
  local qa_feedback_line="${2:-}"

  if [[ -n "$qa_feedback_line" ]]; then
    qa_feedback_line="- QA Feedback to fix: ${qa_feedback_line}"
  fi

  local unresolved_bugs
  unresolved_bugs="$(collect_unresolved_bugs "$sprint_num")"

  local visual_ctx
  visual_ctx="$(collect_visual_context)"

  render_prompt "${SCRIPT_DIR}/prompts/templates/generator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_FEEDBACK_LINE__" "$qa_feedback_line" \
    "__UNRESOLVED_BUGS__" "$unresolved_bugs" \
    "__VISUAL_CONTEXT__" "$visual_ctx"
}

render_generator_fix_prompt() {
  local sprint_num="$1"
  local qa_round="$2"

  local all_reports_line=""
  local read_prior_line=""
  if (( qa_round > 1 )); then
    local refs=""
    for (( r=1; r<qa_round; r++ )); do
      local rfile="artifacts/sprint-${sprint_num}-qa-round-${r}.md"
      if [[ -f "${ROOT}/${rfile}" ]]; then
        refs="${refs}\n- Prior QA Report (Round ${r}): ${rfile}"
      fi
    done
    if [[ -n "$refs" ]]; then
      all_reports_line="$(echo -e "$refs")"
      read_prior_line="   Also read the prior QA reports listed above — any bug still open from earlier rounds MUST be fixed in this pass."
    fi
  fi

  render_prompt "${SCRIPT_DIR}/prompts/templates/generator-fix.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round" \
    "__ALL_QA_REPORTS_LINE__" "$all_reports_line" \
    "__READ_PRIOR_ROUNDS_LINE__" "$read_prior_line"
}

render_evaluator_prompt() {
  local sprint_num="$1"
  local qa_round="$2"
  local prev_qa_round=$(( qa_round - 1 ))

  local prev_qa_line=""
  local prev_bug_section=""
  if (( prev_qa_round > 0 )); then
    local prev_report="${ROOT}/artifacts/sprint-${sprint_num}-qa-round-${prev_qa_round}.md"
    if [[ -f "$prev_report" ]]; then
      prev_qa_line="- Previous QA report: artifacts/sprint-${sprint_num}-qa-round-${prev_qa_round}.md — verify all previous bugs are FIXED."
      prev_bug_section="## Round ${prev_qa_round} Bug Status
| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
(Fill in by checking each bug from the previous QA report)"
    fi
  fi

  local regression_criteria
  regression_criteria="$(collect_regression_criteria "$sprint_num")"

  local build_cmd
  build_cmd="$(detect_build_command)"

  local frontend_url
  frontend_url="$(detect_frontend_url)"

  render_prompt "${SCRIPT_DIR}/prompts/templates/evaluator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round" \
    "__PREV_QA_LINE__" "$prev_qa_line" \
    "__PREV_BUG_STATUS_SECTION__" "$prev_bug_section" \
    "__REGRESSION_CRITERIA__" "$regression_criteria" \
    "__BUILD_CMD__" "$build_cmd" \
    "__FRONTEND_URL__" "$frontend_url"
}

# ── Reviewer prompt ─────────────────────────────────────────────────
render_reviewer_prompt() {
  local epoch="$1"

  local core_journeys
  core_journeys="$(source "${SCRIPT_DIR}/lib/quality-gate.sh" && generate_core_journeys)"

  local frontend_url
  frontend_url="$(detect_frontend_url)"

  render_prompt "${SCRIPT_DIR}/prompts/templates/reviewer.txt" \
    "__EPOCH__" "$epoch" \
    "__CORE_JOURNEYS__" "$core_journeys" \
    "__FRONTEND_URL__" "$frontend_url"
}

# ── Polish Contract prompt ──────────────────────────────────────────
render_polish_contract_prompt() {
  local polish_num="$1"
  local epoch="$2"
  local num_items="${3:-5}"

  render_prompt "${SCRIPT_DIR}/prompts/templates/polish-contract.txt" \
    "__POLISH_NUM__" "$polish_num" \
    "__EPOCH__" "$epoch" \
    "__NUM_ITEMS__" "$num_items"
}

# ── Polish Generator prompt ─────────────────────────────────────────
render_polish_generator_prompt() {
  local polish_num="$1"
  local epoch="$2"

  local visual_ctx
  visual_ctx="$(collect_visual_context)"

  render_prompt "${SCRIPT_DIR}/prompts/templates/polish-generator.txt" \
    "__POLISH_NUM__" "$polish_num" \
    "__EPOCH__" "$epoch" \
    "__VISUAL_CONTEXT__" "$visual_ctx"
}

# ── Polish Verifier prompt (Fast Verify — incremental) ───────────────
render_polish_verifier_prompt() {
  local polish_num="$1"
  local epoch="$2"
  local prev_epoch="$3"

  local prev_review="artifacts/product-review-epoch-${prev_epoch}.md"
  local polish_contract="artifacts/polish-${polish_num}-contract-final.md"
  local frontend_url
  frontend_url="$(detect_frontend_url)"

  # Extract pages from polish contract
  local polish_pages=""
  if [[ -f "${ROOT}/${polish_contract}" ]]; then
    polish_pages="$(grep -oE '(AdminHome|TalentList|AgreementList|DisputeList|SettlementList|RuleList|ReconciliationList|CalculationList|DashboardLayout|TalentReconciliation)' "${ROOT}/${polish_contract}" | sort -u | tr '\n' ',' | sed 's/,$//')"
  fi
  if [[ -z "$polish_pages" ]]; then
    polish_pages="(auto-detect from contract)"
  fi

  # Extract core journeys from previous review
  local polish_journeys=""
  if [[ -f "${ROOT}/${prev_review}" ]]; then
    polish_journeys="$(grep -A 5 'Journey' "${ROOT}/${prev_review}" | grep -E '(登录|Dashboard|上传协议|异议|对账|计算)' | head -3 | sed 's/^/- /')"
  fi

  render_prompt "${SCRIPT_DIR}/prompts/templates/polish-verifier.txt" \
    "__POLISH_NUM__" "$polish_num" \
    "__EPOCH__" "$epoch" \
    "__PREV_EPOCH__" "$prev_epoch" \
    "__PREV_REVIEW_FILE__" "$prev_review" \
    "__POLISH_CONTRACT__" "$polish_contract" \
    "__POLISH_PAGES__" "$polish_pages" \
    "__POLISH_JOURNEYS__" "$polish_journeys" \
    "__VERIFY_OUTPUT__" "artifacts/polish-${polish_num}-verify.md" \
    "__FRONTEND_URL__" "$frontend_url"
}
